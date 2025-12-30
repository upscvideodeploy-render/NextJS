/**
 * API Route: /api/payments/webhook
 * Story 5.2: Razorpay Webhook Handler
 * 
 * Handles Razorpay payment webhooks for:
 * - payment.captured: Payment successful
 * - payment.failed: Payment failed
 * - subscription.activated: Subscription started
 * - subscription.cancelled: Subscription cancelled
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// Subscription plans
const PLANS: Record<string, { durationDays: number }> = {
  monthly: { durationDays: 30 },
  quarterly: { durationDays: 90 },
  half_yearly: { durationDays: 180 },
  annual: { durationDays: 365 },
};

function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature
    if (RAZORPAY_WEBHOOK_SECRET && !verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const { event: eventType, payload } = event;

    console.log(`Razorpay webhook: ${eventType}`);

    const supabase = getSupabaseClient();

    switch (eventType) {
      case 'payment.captured': {
        const { payment, order } = payload.payment.entity;
        const orderId = payload.payment.entity.order_id;
        const paymentId = payload.payment.entity.id;
        const amount = payload.payment.entity.amount / 100; // Convert from paise
        const email = payload.payment.entity.email;
        const notes = payload.payment.entity.notes;

        // Get order details
        const { data: orderRecord } = await supabase
          .from('payment_orders')
          .select('*')
          .eq('razorpay_order_id', orderId)
          .single();

        if (!orderRecord) {
          console.error('Order not found:', orderId);
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Update order status
        await supabase
          .from('payment_orders')
          .update({
            status: 'paid',
            razorpay_payment_id: paymentId,
            paid_at: new Date().toISOString(),
          })
          .eq('razorpay_order_id', orderId);

        // Calculate subscription dates
        const plan = PLANS[orderRecord.plan_id] || { durationDays: 30 };
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.durationDays);

        // Create or update subscription
        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: orderRecord.user_id,
            plan_id: orderRecord.plan_id,
            status: 'active',
            current_period_start: startDate.toISOString(),
            current_period_end: endDate.toISOString(),
            razorpay_subscription_id: paymentId,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (subError) {
          console.error('Failed to create subscription:', subError);
        }

        // Create invoice record
        await supabase
          .from('invoices')
          .insert({
            user_id: orderRecord.user_id,
            amount: amount * 100, // Store in paise
            status: 'paid',
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId,
            created_at: new Date().toISOString(),
          });

        console.log(`Payment captured: ${paymentId} for user ${orderRecord.user_id}`);
        break;
      }

      case 'payment.failed': {
        const orderId = payload.payment.entity.order_id;
        const error = payload.payment.entity.error_description;

        // Update order status
        await supabase
          .from('payment_orders')
          .update({
            status: 'failed',
            error_message: error,
          })
          .eq('razorpay_order_id', orderId);

        console.log(`Payment failed: ${orderId} - ${error}`);
        break;
      }

      case 'subscription.activated': {
        const subscriptionId = payload.subscription.entity.id;
        const customerId = payload.subscription.entity.customer_id;
        const planId = payload.subscription.entity.plan_id;

        // Update subscription status
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            razorpay_subscription_id: subscriptionId,
          })
          .eq('razorpay_customer_id', customerId);

        console.log(`Subscription activated: ${subscriptionId}`);
        break;
      }

      case 'subscription.cancelled': {
        const subscriptionId = payload.subscription.entity.id;

        // Update subscription status
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancel_at_period_end: true,
          })
          .eq('razorpay_subscription_id', subscriptionId);

        console.log(`Subscription cancelled: ${subscriptionId}`);
        break;
      }

      case 'subscription.charged': {
        const subscriptionId = payload.subscription.entity.id;
        const paymentId = payload.payment.entity.id;
        const amount = payload.payment.entity.amount / 100;

        // Create invoice for recurring payment
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id, plan_id')
          .eq('razorpay_subscription_id', subscriptionId)
          .single();

        if (sub) {
          const plan = PLANS[sub.plan_id] || { durationDays: 30 };
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + plan.durationDays);

          // Extend subscription
          await supabase
            .from('subscriptions')
            .update({
              current_period_end: endDate.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('razorpay_subscription_id', subscriptionId);

          // Create invoice
          await supabase
            .from('invoices')
            .insert({
              user_id: sub.user_id,
              amount: amount * 100,
              status: 'paid',
              razorpay_payment_id: paymentId,
              created_at: new Date().toISOString(),
            });
        }

        console.log(`Subscription charged: ${subscriptionId}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// GET: Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'razorpay-webhook',
    timestamp: new Date().toISOString(),
  });
}
