/**
 * Referral Tracking API
 * Story 5.10 - Referral Program - User Acquisition
 *
 * AC#3: Track referred users and save referrer_id
 * AC#9: Fraud detection (IP/device fingerprinting)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TrackReferralRequest {
  referral_code: string;
  user_id: string;
  ip_address?: string;
  device_fingerprint?: string;
}

/**
 * POST /api/referrals/track
 * Track a referral when user signs up with referral code
 */
export async function POST(request: NextRequest) {
  try {
    const body: TrackReferralRequest = await request.json();
    const { referral_code, user_id, ip_address, device_fingerprint } = body;

    if (!referral_code || !user_id) {
      return NextResponse.json(
        { error: 'referral_code and user_id are required' },
        { status: 400 }
      );
    }

    // Find referrer by code
    const { data: referrer, error: referrerError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('referral_code', referral_code.toUpperCase())
      .single();

    if (referrerError || !referrer) {
      // Invalid referral code - don't fail signup, just don't track
      return NextResponse.json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    // Fraud detection (AC#9) - Check for self-referral
    if (referrer.user_id === user_id) {
      return NextResponse.json({
        success: false,
        message: 'Cannot refer yourself'
      });
    }

    // Check for existing referral
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', user_id)
      .single();

    if (existingReferral) {
      return NextResponse.json({
        success: false,
        message: 'User already has a referral recorded'
      });
    }

    // Fraud detection - Same IP check (if IP is provided)
    if (ip_address) {
      const { data: ipReferrals } = await supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', referrer.user_id)
        .eq('ip_address', ip_address);

      if (ipReferrals && ipReferrals.length >= 3) {
        // Too many referrals from same IP
        return NextResponse.json({
          success: false,
          message: 'Referral limit reached for this IP'
        });
      }
    }

    // Fraud detection - Device fingerprint check
    if (device_fingerprint) {
      const { data: deviceReferrals } = await supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', referrer.user_id)
        .eq('device_fingerprint', device_fingerprint);

      if (deviceReferrals && deviceReferrals.length >= 3) {
        return NextResponse.json({
          success: false,
          message: 'Referral limit reached for this device'
        });
      }
    }

    // Create referral record
    const { data: referral, error: createError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.user_id,
        referred_id: user_id,
        referral_code: referral_code.toUpperCase(),
        status: 'signed_up',
        ip_address: ip_address || null,
        device_fingerprint: device_fingerprint || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Create referral error:', createError);
      return NextResponse.json({ error: 'Failed to create referral' }, { status: 500 });
    }

    // Update referred_by in user profile
    await supabase
      .from('user_profiles')
      .update({ referred_by: referrer.user_id })
      .eq('user_id', user_id);

    return NextResponse.json({
      success: true,
      referral: {
        id: referral.id,
        referrer_id: referrer.user_id,
        status: referral.status,
      },
      message: 'Referral tracked successfully'
    });

  } catch (error) {
    console.error('Referral track API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/referrals/track?code=ABC123
 * Validate referral code (for pre-check before signup)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'code query parameter is required' },
        { status: 400 }
      );
    }

    // Find referrer by code
    const { data: referrer, error: referrerError } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .eq('referral_code', code.toUpperCase())
      .single();

    if (referrerError || !referrer) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid referral code'
      });
    }

    return NextResponse.json({
      valid: true,
      referrer_name: referrer.full_name,
      code: code.toUpperCase()
    });

  } catch (error) {
    console.error('Referral validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
