/**
 * Admin Referral Analytics API
 * Story 5.10 - Referral Program - User Acquisition
 *
 * AC#10: Admin analytics - referral conversion rate, viral coefficient (K-factor)
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
 * GET /api/admin/referrals
 * Get all referrals with analytics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query
    let query = supabase
      .from('referrals')
      .select(`
        *,
        referrer:user_profiles!referrals_referrer_id_fkey(user_id, full_name, referral_code),
        referred:user_profiles!referrals_referred_id_fkey(user_id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && ['pending', 'signed_up', 'subscribed', 'rewarded'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: referrals, error } = await query;

    if (error) {
      console.error('Fetch referrals error:', error);
      return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
    }

    return NextResponse.json({ referrals });

  } catch (error) {
    console.error('GET referrals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/referrals/analytics
 * Get referral analytics and K-factor (viral coefficient)
 */
export async function GET_analytics(request: NextRequest) {
  try {
    const user = await verifyAdmin(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Total referrals
    const { count: totalReferrals } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true });

    // Referrals by status
    const { data: statusBreakdown } = await supabase
      .from('referrals')
      .select('status')
      .order('created_at', { ascending: false });

    const statusCounts = statusBreakdown?.reduce((acc: any, r: any) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Referrals by month (last 6 months)
    const { data: monthlyReferrals } = await supabase
      .from('referrals')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    const monthlyData = monthlyReferrals?.reduce((acc: any, r: any) => {
      const month = new Date(r.created_at).toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {}) || {};

    // Total users
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    // Calculate referral conversion rate (subscribed / total referrals)
    const conversionRateStr = totalReferrals && totalReferrals > 0
      ? ((statusCounts.subscribed || 0) / totalReferrals * 100).toFixed(2)
      : '0';

    // Calculate viral coefficient (K-factor)
    // K-factor = (number of referrals / number of active users) * conversion rate
    // For simplicity: K-factor = (referrals_per_user) * conversion_rate
    const referralsPerUserValue = totalUsers && totalUsers > 0 && totalReferrals
      ? totalReferrals / totalUsers
      : 0;
    const referralsPerUserStr = referralsPerUserValue.toFixed(3);
    const kFactor = (parseFloat(referralsPerUserStr) * parseFloat(conversionRateStr) / 100).toFixed(3);

    // Top referrers (leaderboard - AC#6)
    const { data: topReferrers } = await supabase
      .from('referrals')
      .select('referrer_id, user_profiles!referrals_referrer_id_fkey(full_name, referral_code)')
      .eq('status', 'rewarded');

    const referrerCounts = topReferrers?.reduce((acc: any, r: any) => {
      const key = r.referrer_id;
      if (!acc[key]) {
        acc[key] = {
          user_id: key,
          full_name: r.user_profiles?.full_name || 'Unknown',
          referral_code: r.user_profiles?.referral_code || '',
          count: 0
        };
      }
      acc[key].count++;
      return acc;
    }, {});

    const leaderboard = Object.values(referrerCounts || {})
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    // Rewards distributed
    const { data: rewardData } = await supabase
      .from('referrals')
      .select('reward_type, reward_value')
      .eq('status', 'rewarded');

    const totalRewardsCount = rewardData?.length || 0;

    // Average time from signup to reward
    const { data: timeData } = await supabase
      .from('referrals')
      .select('created_at, reward_applied_at')
      .eq('status', 'rewarded')
      .not('reward_applied_at', 'is', null);

    let avgDaysToReward = '0';
    if (timeData && timeData.length > 0) {
      const totalDays = timeData.reduce((sum: number, r: any) => {
        const created = new Date(r.created_at).getTime();
        const rewarded = new Date(r.reward_applied_at!).getTime();
        return sum + (rewarded - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgDaysToReward = (totalDays / timeData.length).toFixed(1);
    }

    return NextResponse.json({
      analytics: {
        overview: {
          total_referrals: totalReferrals || 0,
          total_users: totalUsers || 0,
          conversion_rate: `${conversionRateStr}%`,
          k_factor: kFactor,
          referrals_per_user: parseFloat(referralsPerUserStr).toFixed(2),
        },
        status_breakdown: {
          pending: statusCounts.pending || 0,
          signed_up: statusCounts.signed_up || 0,
          subscribed: statusCounts.subscribed || 0,
          rewarded: statusCounts.rewarded || 0,
        },
        monthly_trend: monthlyData,
        leaderboard: leaderboard,
        rewards: {
          total_distributed: totalRewardsCount,
          avg_days_to_reward: avgDaysToReward,
        },
      },
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
