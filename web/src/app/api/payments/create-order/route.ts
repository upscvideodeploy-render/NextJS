/**
 * API Route: /api/payments/create-order
 * Story 5.2: Razorpay Payment Integration
 * 
 * Creates a Razorpay order for subscription payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Razorpay configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

// Subscription plans
const PLANS = {
  monthly: { id: 'monthly', name: 'Monthly Pro', priceInr: 599, durationDays: 30 },
  quarterly: { id: 'quarterly', name: 'Quarterly Pro', priceInr: 1499, durationDays: 90 },
  half_yearly: { id: 'half_yearly', name: 'Half-Yearly Pro', priceInr: 2699, durationDays: 180 },
  annual: { id: 'annual', name: 'Annual Pro', priceInr: 4999, durationDays: 365 },
};

async function createRazorpayOrder(amount: number, receipt: string, notes: Record<string, string>) {
  const response = await fetch(`${RAZORPAY_API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
    },
    body: JSON.stringify({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt,
      notes,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.description || 'Failed to create order');
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, userId, email, name, phone } = body;

    if (!planId || !userId) {
      return NextResponse.json(
        { error: 'planId and userId are required' },
        { status: 400 }
      );
    }

    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Check if user already has active subscription
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (existingSub) {
      return NextResponse.json(
        { error: 'Active subscription already exists' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const receipt = `sub_${userId.substring(0, 8)}_${Date.now()}`;
    const order = await createRazorpayOrder(plan.priceInr, receipt, {
      user_id: userId,
      plan_id: planId,
      plan_name: plan.name,
    });

    // Store order in database
    const { error: dbError } = await supabase
      .from('payment_orders')
      .insert({
        id: order.id,
        user_id: userId,
        plan_id: planId,
        amount: plan.priceInr,
        currency: 'INR',
        status: 'created',
        razorpay_order_id: order.id,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Failed to store order:', dbError);
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: plan.priceInr,
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        durationDays: plan.durationDays,
      },
      prefill: {
        name: name || '',
        email: email || '',
        contact: phone || '',
      },
    });

  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    // Return available plans
    return NextResponse.json({
      success: true,
      plans: Object.values(PLANS),
      key: RAZORPAY_KEY_ID,
    });
  }

  // Get order status from Razorpay
  try {
    const response = await fetch(`${RAZORPAY_API_URL}/orders/${orderId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = await response.json();
    return NextResponse.json({ success: true, order });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
