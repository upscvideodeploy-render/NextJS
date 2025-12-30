/**
 * Cancel Subscription API
 * Story 5.5 - Subscription Management
 * Story 5.9 - Subscription Lifecycle
 *
 * AC#6 (5.5): Cancel flow - cancels at period end (not immediately)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CancelRequest {
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CancelRequest = await request.json();
    const { reason } = body;

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Cannot cancel - subscription is not active' },
        { status: 400 }
      );
    }

    // Update subscription - mark as canceled but keep active until expiry
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        auto_renew: false,
      })
      .eq('id', subscription.id);

    if (updateError) {
      throw updateError;
    }

    // Log cancellation event
    await supabase.from('subscription_events').insert({
      subscription_id: subscription.id,
      user_id: user.id,
      event_type: 'subscription_canceled',
      metadata: {
        reason: reason || 'User requested',
        canceled_at: new Date().toISOString(),
        expires_at: subscription.subscription_expires_at,
      },
    });

    // Log to audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'subscription_canceled',
      resource_type: 'subscription',
      resource_id: subscription.id,
      metadata: { reason },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled. You will have access until the end of your billing period.',
      expires_at: subscription.subscription_expires_at,
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
