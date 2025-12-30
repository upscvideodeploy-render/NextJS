/**
 * Admin Coupon Update/Delete API
 * Story 5.7 - Coupon & Discount Code System
 *
 * PATCH  /api/admin/coupons/[id] - Update coupon (e.g., deactivate)
 * DELETE /api/admin/coupons/[id] - Delete coupon
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UpdateCouponRequest {
  is_active?: boolean;
  max_uses?: number;
  valid_until?: string;
}

/**
 * PATCH /api/admin/coupons/[id]
 * Update coupon properties (typically to activate/deactivate)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body: UpdateCouponRequest = await request.json();
    const couponId = params.id;

    // Update coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', couponId)
      .select()
      .single();

    if (error) {
      console.error('Update coupon error:', error);
      return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 });
    }

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    return NextResponse.json({ coupon });

  } catch (error) {
    console.error('PATCH coupon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/coupons/[id]
 * Delete a coupon (use with caution - affects usage tracking)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const couponId = params.id;

    // Check if coupon has been used
    const { data: usages } = await supabase
      .from('coupon_usages')
      .select('id')
      .eq('coupon_id', couponId)
      .limit(1);

    if (usages && usages.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete coupon that has been used. Deactivate it instead.' },
        { status: 400 }
      );
    }

    // Delete coupon
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', couponId);

    if (error) {
      console.error('Delete coupon error:', error);
      return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Coupon deleted successfully' });

  } catch (error) {
    console.error('DELETE coupon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
