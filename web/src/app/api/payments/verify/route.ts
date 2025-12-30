/**
 * API Route: /api/payments/verify
 * Story 5.2: Payment Verification
 * 
 * Verifies Razorpay payment signature after client-side payment completion
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

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

// Subscription plans
const PLANS: Record<string, { durationDays: number; name: string }> = {
  monthly: { durationDays: 30, name: 'Monthly Pro' },
  quarterly: { durationDays: 90, name: 'Quarterly Pro' },
  half_yearly: { durationDays: 180, name: 'Half-Yearly Pro' },
  annual: { durationDays: 365, name: 'Annual Pro' },
};

function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expectedSignature === signature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      userId 
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment verification parameters' },
        { status: 400 }
      );
    }

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get order details
    const { data: orderRecord } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (!orderRecord) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Update order status
    await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        razorpay_payment_id,
        paid_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id);

    // Calculate subscription dates
    const plan = PLANS[orderRecord.plan_id] || { durationDays: 30, name: 'Pro' };
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    // Create or update subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: orderRecord.user_id,
        plan_id: orderRecord.plan_id,
        status: 'active',
        current_period_start: startDate.toISOString(),
        current_period_end: endDate.toISOString(),
        razorpay_subscription_id: razorpay_payment_id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (subError) {
      console.error('Failed to create subscription:', subError);
      return NextResponse.json(
        { error: 'Failed to activate subscription' },
        { status: 500 }
      );
    }

    // Create invoice
    await supabase
      .from('invoices')
      .insert({
        user_id: orderRecord.user_id,
        amount: orderRecord.amount * 100, // Store in paise
        status: 'paid',
        razorpay_payment_id,
        razorpay_order_id,
        created_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      message: 'Payment verified and subscription activated',
      subscription: {
        id: subscription?.id,
        plan_id: orderRecord.plan_id,
        plan_name: plan.name,
        status: 'active',
        current_period_start: startDate.toISOString(),
        current_period_end: endDate.toISOString(),
      },
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
