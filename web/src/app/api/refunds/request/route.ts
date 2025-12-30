/**
 * User Refund Request API
 * Story 5.9 - Refund Processing & Money-Back Guarantee
 *
 * AC#2: POST /api/refunds/request creates refund request (user_id, subscription_id, amount, reason)
 * AC#4: Uses check_refund_eligibility() function from migration 021
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RefundRequest {
  subscription_id: string;
  reason: string;
}

/**
 * POST /api/refunds/request
 * Users can request a refund for their subscription
 */
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

    const body: RefundRequest = await request.json();
    const { subscription_id, reason } = body;

    // Validate required fields
    if (!subscription_id || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: subscription_id and reason' },
        { status: 400 }
      );
    }

    // Check refund eligibility using migration 021 function
    const { data: eligibility } = await supabase
      .rpc('check_refund_eligibility', {
        p_user_id: user.id,
        p_subscription_id: subscription_id
      });

    if (!eligibility || eligibility.length === 0) {
      const reason = eligibility?.[0]?.reason || 'Not eligible for refund';
      return NextResponse.json({ error: reason, eligible: false }, { status: 400 });
    }

    const { eligible, reason: _reason, refund_amount, refund_type, days_since_purchase } = eligibility[0];

    // Create refund request
    const { data: refund, error } = await supabase
      .from('refunds')
      .insert({
        user_id: user.id,
        subscription_id: subscription_id,
        transaction_id: null, // Will be linked when approved
        amount: refund_amount,
        refund_type: refund_type,
        reason: reason,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Create refund request error:', error);
      return NextResponse.json({ error: 'Failed to create refund request' }, { status: 500 });
    }

    return NextResponse.json({
      refund: {
        id: refund.id,
        eligible,
        reason: _reason,
        refund_amount: refund_amount,
        refund_type: refund_type,
        days_since_purchase
      },
      message: 'Refund request submitted. Admin will review within 48 hours.'
    });

  } catch (error) {
    console.error('Refund request API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
