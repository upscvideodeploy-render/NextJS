/**
 * User Referral API
 * Story 5.10 - Referral Program - User Acquisition
 *
 * AC#1: Referral page with unique referral code
 * AC#5: Referral dashboard with stats
 * AC#8: Max 10 referrals rewarded per month (enforced in database)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/referrals/me
 * Get user's referral code and referral statistics
 */
export async function GET(request: NextRequest) {
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

    // Get user profile with referral code
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('referral_code')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Generate referral link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://upsc-prepx.ai';
    const referralLink = `${baseUrl}/signup?ref=${profile?.referral_code || ''}`;

    // Get referral statistics
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select(`
        *,
        referred:users(id, email, full_name)
      `)
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    if (referralsError) {
      console.error('Referrals fetch error:', referralsError);
      return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total_referrals: referrals?.length || 0,
      signed_up_count: referrals?.filter(r => r.status === 'signed_up').length || 0,
      subscribed_count: referrals?.filter(r => r.status === 'subscribed' || r.status === 'rewarded').length || 0,
      rewarded_count: referrals?.filter(r => r.status === 'rewarded').length || 0,
      pending_count: referrals?.filter(r => r.status === 'pending').length || 0,
    };

    // Check monthly reward limit (AC#8)
    const { data: monthlyRewards } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_id', user.id)
      .eq('status', 'rewarded')
      .gte('reward_applied_at', new Date(new Date().setDate(1)).toISOString());

    const monthlyRewardsCount = monthlyRewards?.length || 0;
    const maxRewardsPerMonth = 10;
    const canStillEarnRewards = monthlyRewardsCount < maxRewardsPerMonth;

    return NextResponse.json({
      referral_code: profile?.referral_code,
      referral_link: referralLink,
      stats,
      rewards: {
        monthly_count: monthlyRewardsCount,
        max_per_month: maxRewardsPerMonth,
        can_earn_more: canStillEarnRewards,
        remaining_this_month: maxRewardsPerMonth - monthlyRewardsCount,
      },
      referrals: referrals?.map(r => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        reward_type: r.reward_type,
        reward_applied_at: r.reward_applied_at,
        referred_user: r.referred ? {
          id: r.referred.id,
          email: r.referred.email,
        } : null,
      })),
    });

  } catch (error) {
    console.error('Referral me API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
