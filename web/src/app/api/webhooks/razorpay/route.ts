/**
 * Razorpay Webhook Handler
 * Story 5.2 - Payment Gateway Integration
 *
 * Handles Razorpay payment events:
 * - payment.captured: Successful payment
 * - payment.failed: Failed payment
 * - subscription.charged: Recurring payment
 * - subscription.cancelled: Subscription cancelled
 *
 * AC#5: POST /api/webhooks/razorpay verifies signature, creates subscription
 * AC#6: Transaction logging to payment_transactions table
 * AC#7: Failed payment handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Supabase client with service role for webhook processing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

interface RazorpayWebhookEvent {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
        email: string;
        contact: string;
        notes: {
          user_id?: string;
          plan_id?: string;
          plan_slug?: string;
          coupon_code?: string;
        };
        error_code?: string;
        error_description?: string;
        created_at: number;
      };
    };
    subscription?: {
      entity: {
        id: string;
        plan_id: string;
        status: string;
        current_start: number;
        current_end: number;
        customer_id: string;
        notes: {
          user_id?: string;
        };
      };
    };
  };
  created_at: number;
}

/**
 * Verify Razorpay webhook signature (AC#5)
 */
function verifySignature(body: string, signature: string): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.warn('RAZORPAY_WEBHOOK_SECRET not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle successful payment capture
 */
async function handlePaymentCaptured(payment: RazorpayWebhookEvent['payload']['payment']) {
  if (!payment) return;

  const entity = payment.entity;
  const userId = entity.notes.user_id;
  const planSlug = entity.notes.plan_slug;
  const couponCode = entity.notes.coupon_code;

  if (!userId) {
    console.error('Payment missing user_id in notes');
    return;
  }

  // Get plan details
  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', planSlug)
    .single();

  // Calculate GST (18%)
  const amountInr = entity.amount / 100; // Convert paise to INR
  const gstAmount = Math.round(amountInr * 0.18);

  // Update payment transaction (AC#6)
  await supabase
    .from('payment_transactions')
    .update({
      razorpay_payment_id: entity.id,
      status: 'captured',
      payment_method: entity.method,
      captured_at: new Date().toISOString(),
      gst_amount: gstAmount,
    })
    .eq('razorpay_order_id', entity.order_id);

  // Activate subscription
  const subscriptionExpiresAt = new Date();
  subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + (plan?.duration_days || 30));

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      plan_id: plan?.id,
      subscription_started_at: new Date().toISOString(),
      subscription_expires_at: subscriptionExpiresAt.toISOString(),
      auto_renew: true,
      trial_expires_at: null, // Clear trial
    })
    .eq('user_id', userId);

  // Update entitlements to unlimited
  const { data: features } = await supabase
    .from('feature_manifests')
    .select('feature_slug')
    .in('tier', ['free', 'trial', 'pro']);

  if (features) {
    for (const feature of features) {
      await supabase
        .from('entitlements')
        .upsert({
          user_id: userId,
          feature_slug: feature.feature_slug,
          limit_type: 'unlimited',
          limit_value: null,
          usage_count: 0,
        }, { onConflict: 'user_id,feature_slug' });
    }
  }

  // Update coupon usage if used
  if (couponCode) {
    await supabase.rpc('increment_coupon_usage', { p_code: couponCode });
  }

  // Log subscription event
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (subscription) {
    await supabase.from('subscription_events').insert({
      subscription_id: subscription.id,
      user_id: userId,
      event_type: 'subscription_created',
      metadata: {
        plan_slug: planSlug,
        amount: amountInr,
        payment_id: entity.id,
      },
    });
  }

  // Check for referral reward (Story 5.10)
  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_id', userId)
    .eq('status', 'signed_up')
    .single();

  if (referral) {
    // Update referral status
    await supabase
      .from('referrals')
      .update({
        status: 'subscribed',
        reward_type: 'free_month',
        reward_value: 30,
      })
      .eq('id', referral.id);

    // Extend referrer's subscription by 30 days
    const { data: referrerSub } = await supabase
      .from('subscriptions')
      .select('subscription_expires_at')
      .eq('user_id', referral.referrer_id)
      .single();

    if (referrerSub?.subscription_expires_at) {
      const newExpiry = new Date(referrerSub.subscription_expires_at);
      newExpiry.setDate(newExpiry.getDate() + 30);

      await supabase
        .from('subscriptions')
        .update({ subscription_expires_at: newExpiry.toISOString() })
        .eq('user_id', referral.referrer_id);

      // Mark reward as applied
      await supabase
        .from('referrals')
        .update({
          status: 'rewarded',
          reward_applied_at: new Date().toISOString(),
        })
        .eq('id', referral.id);
    }
  }

  console.log(`Payment captured for user ${userId}, plan ${planSlug}`);
}

/**
 * Handle failed payment (AC#7)
 */
async function handlePaymentFailed(payment: RazorpayWebhookEvent['payload']['payment']) {
  if (!payment) return;

  const entity = payment.entity;
  const userId = entity.notes.user_id;

  // Update payment transaction
  await supabase
    .from('payment_transactions')
    .update({
      razorpay_payment_id: entity.id,
      status: 'failed',
      error_code: entity.error_code,
      error_description: entity.error_description,
    })
    .eq('razorpay_order_id', entity.order_id);

  // Log event for retry email
  if (userId) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (subscription) {
      await supabase.from('subscription_events').insert({
        subscription_id: subscription.id,
        user_id: userId,
        event_type: 'renewal_failed',
        metadata: {
          error_code: entity.error_code,
          error_description: entity.error_description,
          payment_id: entity.id,
        },
      });
    }
  }

  console.log(`Payment failed for order ${entity.order_id}: ${entity.error_description}`);
}

/**
 * Handle subscription charged (recurring)
 */
async function handleSubscriptionCharged(subscription: RazorpayWebhookEvent['payload']['subscription']) {
  if (!subscription) return;

  const entity = subscription.entity;
  const userId = entity.notes.user_id;

  if (!userId) return;

  // Extend subscription
  const newExpiry = new Date(entity.current_end * 1000);

  await supabase
    .from('subscriptions')
    .update({
      subscription_expires_at: newExpiry.toISOString(),
      renewal_attempts: 0,
      last_renewal_attempt_at: null,
    })
    .eq('user_id', userId);

  // Log renewal event
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (sub) {
    await supabase.from('subscription_events').insert({
      subscription_id: sub.id,
      user_id: userId,
      event_type: 'subscription_renewed',
      metadata: {
        razorpay_subscription_id: entity.id,
        new_expiry: newExpiry.toISOString(),
      },
    });
  }

  console.log(`Subscription renewed for user ${userId}`);
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(subscription: RazorpayWebhookEvent['payload']['subscription']) {
  if (!subscription) return;

  const entity = subscription.entity;
  const userId = entity.notes.user_id;

  if (!userId) return;

  // Mark subscription as cancelled (will expire at period end)
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      auto_renew: false,
    })
    .eq('user_id', userId);

  // Log cancellation event
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (sub) {
    await supabase.from('subscription_events').insert({
      subscription_id: sub.id,
      user_id: userId,
      event_type: 'subscription_canceled',
      metadata: {
        razorpay_subscription_id: entity.id,
      },
    });
  }

  console.log(`Subscription cancelled for user ${userId}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature (AC#5)
    if (!verifySignature(body, signature)) {
      console.error('Invalid Razorpay webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event: RazorpayWebhookEvent = JSON.parse(body);

    console.log(`Razorpay webhook received: ${event.event}`);

    // Handle different event types
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(event.payload.subscription);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(event.payload.subscription);
        break;

      default:
        console.log(`Unhandled Razorpay event: ${event.event}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/razorpay',
    description: 'Razorpay payment webhook handler',
  });
}
