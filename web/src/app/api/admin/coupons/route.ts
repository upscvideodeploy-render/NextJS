/**
 * Admin Coupon Management API
 * Story 5.7 - Coupon & Discount Code System
 *
 * AC#2: Admin can create coupons with restrictions
 * AC#3: Coupon listing and analytics
 *
 * GET  /api/admin/coupons - List all coupons with usage stats
 * POST /api/admin/coupons - Create new coupon
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CreateCouponRequest {
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  valid_until?: string;
  max_uses?: number;
  min_plan?: string;
  first_purchase_only?: boolean;
  per_user_limit?: number;
  email_locked?: string;
  campaign_name?: string;
}

/**
 * GET /api/admin/coupons
 * List all coupons with usage statistics
 */
export async function GET(request: NextRequest) {
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

    // Fetch all coupons with usage stats
    const { data: coupons, error } = await supabase
      .from('coupons')
      .select(`
        *,
        coupon_usages(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch coupons error:', error);
      return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
    }

    // Calculate usage statistics
    const couponsWithStats = coupons?.map(coupon => {
      const usageCount = coupon.coupon_usages?.[0]?.count || 0;
      const usagePercent = coupon.max_uses
        ? Math.round((usageCount / coupon.max_uses) * 100)
        : 0;

      return {
        ...coupon,
        usage_count: usageCount,
        usage_percent: usagePercent,
        is_expired: coupon.valid_until ? new Date(coupon.valid_until) < new Date() : false,
        is_maxed_out: coupon.max_uses ? usageCount >= coupon.max_uses : false
      };
    });

    return NextResponse.json({ coupons: couponsWithStats });

  } catch (error) {
    console.error('GET coupons error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/coupons
 * Create a new coupon
 */
export async function POST(request: NextRequest) {
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

    const body: CreateCouponRequest = await request.json();

    // Validate required fields
    if (!body.code || !body.discount_type || !body.discount_value) {
      return NextResponse.json(
        { error: 'Missing required fields: code, discount_type, discount_value' },
        { status: 400 }
      );
    }

    // Validate discount value
    if (body.discount_type === 'percent' && (body.discount_value < 1 || body.discount_value > 100)) {
      return NextResponse.json(
        { error: 'Percentage discount must be between 1 and 100' },
        { status: 400 }
      );
    }

    if (body.discount_type === 'fixed' && body.discount_value < 1) {
      return NextResponse.json(
        { error: 'Fixed discount must be greater than 0' },
        { status: 400 }
      );
    }

    // Check if coupon code already exists
    const { data: existing } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', body.code.toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Coupon code already exists' },
        { status: 409 }
      );
    }

    // Create coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .insert({
        code: body.code.toUpperCase(),
        discount_type: body.discount_type,
        discount_value: body.discount_value,
        valid_until: body.valid_until || null,
        max_uses: body.max_uses || null,
        min_plan: body.min_plan || null,
        first_purchase_only: body.first_purchase_only || false,
        per_user_limit: body.per_user_limit || 1,
        email_locked: body.email_locked || null,
        campaign_name: body.campaign_name || null,
        created_by: user.id,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Create coupon error:', error);
      return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
    }

    return NextResponse.json({ coupon }, { status: 201 });

  } catch (error) {
    console.error('POST coupon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
