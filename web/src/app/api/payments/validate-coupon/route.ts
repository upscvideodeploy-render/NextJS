/**
 * Validate Coupon API
 * Story 5.7 - Coupon & Discount Code System
 *
 * AC#4: Coupon input validation
 * AC#5: Check code exists, not expired, uses not exceeded, restrictions met
 * AC#6: Price calculation with discount
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ValidateCouponRequest {
  code: string;
  planSlug: string;
  amount: number;
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

    const body: ValidateCouponRequest = await request.json();
    const { code, planSlug, amount } = body;

    if (!code) {
      return NextResponse.json(
        { valid: false, reason: 'Coupon code is required' },
        { status: 400 }
      );
    }

    // Call database validation function
    const { data: result, error } = await supabase.rpc('validate_coupon', {
      p_code: code,
      p_user_id: user.id,
      p_plan_slug: planSlug,
      p_amount: amount,
    });

    if (error) {
      console.error('Coupon validation error:', error);
      return NextResponse.json(
        { valid: false, reason: 'Failed to validate coupon' },
        { status: 500 }
      );
    }

    const validation = result?.[0];

    if (!validation) {
      return NextResponse.json(
        { valid: false, reason: 'Invalid coupon' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: validation.valid,
      reason: validation.reason,
      discount_amount: validation.discount_amount,
      final_amount: validation.final_amount,
      coupon_id: validation.coupon_id,
    });

  } catch (error) {
    console.error('Validate coupon error:', error);
    return NextResponse.json(
      { valid: false, reason: 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}
