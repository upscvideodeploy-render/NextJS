/**
 * Admin Refund Management API
 * Story 5.9 - Refund Processing & Money-Back Guarantee
 *
 * AC#3: Admin review queue in /admin/refunds
 * AC#5: Approval triggers Razorpay refund API
 * AC#6: Refund timeline (48 hours processing)
 * AC#10: Analytics and refund rate tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verify admin authentication
 */
async function verifyAdmin(authHeader: string | null) {
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return null;

  return user;
}

/**
 * GET /api/admin/refunds
 * List all refund requests with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    let query = supabase
      .from('refunds')
      .select(`
        *,
        user:users(email, full_name),
        subscription:subscriptions(plan:plans!slug)
        plan:plans!name,
        reviewed_by:users!full_name,
        reviewed_at,
        transaction:payment_transactions(amount_inr, created_at)
      `)
      .order('requested_at', { ascending: false })
      .limit(100);

    if (status && ['pending', 'approved', 'rejected', 'completed', 'failed'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: refunds, error } = await query;

    if (error) {
      console.error('Fetch refunds error:', error);
      return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 });
    }

    return NextResponse.json({ refunds });

  } catch (error) {
    console.error('GET refunds error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/refunds/[id]
 * Approve or reject a refund request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAdmin(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, admin_notes, rejection_reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 });
    }

    const { data: refund } = await supabase
      .from('refunds')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!refund) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }

    if (refund.status !== 'pending') {
      return NextResponse.json(
        { error: 'Refund already processed' },
        { status: 400 }
      );
    }

    const updateData = {
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      admin_notes: admin_notes || null,
      rejection_reason: action === 'reject' ? rejection_reason : null
    };

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { error: updateError } = await supabase
      .from('refunds')
      .update(updateData)
      .eq('id', params.id)
      .select();

    if (updateError) {
      console.error('Update refund error:', updateError);
      return NextResponse.json({ error: 'Failed to update refund' }, { status: 500 });
    }

    // If approved, trigger Razorpay refund
    if (action === 'approve' && refund.razorpay_payment_id) {
      // Note: This is a placeholder for Razorpay integration
      // Actual Razorpay refund API call would be in Story 5.2
      console.log('Would call Razorpay refund API for:', refund.razorpay_payment_id);
    }

    return NextResponse.json({
      refund: { ...refund, status: newStatus, ...updateData },
      message: `Refund ${newStatus} successfully`
    });

  } catch (error) {
    console.error('PATCH refund error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/refunds/analytics
 * Refund statistics dashboard data
 */
export async function GET_analytics(request: NextRequest) {
  try {
    const user = await verifyAdmin(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch refund analytics view
    const { data: analytics } = await supabase
      .from('refund_analytics')
      .select('*')
      .single();

    if (!analytics) {
      return NextResponse.json({ error: 'Analytics view not found' }, { status: 404 });
    }

    return NextResponse.json({ analytics });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
