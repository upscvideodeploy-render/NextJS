/**
 * Admin Revenue Analytics API
 * Story 5.8 - Revenue Dashboard - Admin Analytics
 *
 * AC#1: Key metrics (MRR, ARR, Active Subs, Churn, Trial-to-Paid)
 * AC#2: MRR calculation (normalize all plans to monthly)
 * AC#3: ARR calculation (MRR * 12)
 * AC#4: Churn rate (% cancelled in last 30 days)
 * AC#5: LTV (average revenue per user)
 * AC#10: Export CSV data
 *
 * GET /api/admin/revenue - Get all revenue metrics
 * GET /api/admin/revenue/export - Export transaction CSV
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
 * GET /api/admin/revenue
 * Fetch comprehensive revenue analytics
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await verifyAdmin(authHeader);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch revenue analytics view (created in migration 021)
    const { data: analytics, error: analyticsError } = await supabase
      .from('revenue_analytics')
      .select('*')
      .single();

    if (analyticsError) {
      console.error('Analytics fetch error:', analyticsError);
    }

    // Calculate MRR from active subscriptions
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:plans(slug, price_inr, duration_days)
      `)
      .eq('status', 'active');

    let mrr = 0;
    let activeSubscriptions = 0;

    subscriptions?.forEach((sub: any) => {
      if (sub.plan) {
        activeSubscriptions++;
        const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;

        switch (plan.slug) {
          case 'monthly':
            mrr += plan.price_inr;
            break;
          case 'quarterly':
            mrr += plan.price_inr / 3;
            break;
          case 'half-yearly':
            mrr += plan.price_inr / 6;
            break;
          case 'annual':
            mrr += plan.price_inr / 12;
            break;
        }
      }
    });

    const arr = mrr * 12;

    // Get trial subscriptions
    const { count: trialCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'trial');

    // Calculate churn (cancelled in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: cancelledCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'canceled')
      .gte('canceled_at', thirtyDaysAgo.toISOString());

    const churnRate = activeSubscriptions > 0
      ? ((cancelledCount || 0) / (activeSubscriptions + (cancelledCount || 0))) * 100
      : 0;

    // Calculate trial-to-paid conversion
    const { count: trialsStartedLast30 } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .gte('trial_started_at', thirtyDaysAgo.toISOString());

    const { count: convertedFromTrial } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('trial_started_at', thirtyDaysAgo.toISOString())
      .not('subscription_started_at', 'is', null);

    const trialToPaidRate = trialsStartedLast30 && trialsStartedLast30 > 0
      ? ((convertedFromTrial || 0) / trialsStartedLast30) * 100
      : 0;

    // Calculate LTV (simplified: average revenue per active user)
    const { data: transactions } = await supabase
      .from('payment_transactions')
      .select('final_amount, user_id')
      .eq('status', 'captured');

    let totalRevenue = 0;
    const uniqueUsers = new Set();

    transactions?.forEach((txn: any) => {
      totalRevenue += txn.final_amount;
      uniqueUsers.add(txn.user_id);
    });

    const ltv = uniqueUsers.size > 0 ? totalRevenue / uniqueUsers.size : 0;

    // Get plan distribution
    const { data: planDistribution } = await supabase
      .from('subscriptions')
      .select('status, plan:plans(name, slug)');

    const distribution: Record<string, number> = {
      free: 0,
      trial: 0,
      monthly: 0,
      quarterly: 0,
      'half-yearly': 0,
      annual: 0,
    };

    planDistribution?.forEach((sub: any) => {
      if (sub.status === 'trial') {
        distribution.trial++;
      } else if (sub.status === 'active' && sub.plan) {
        const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
        if (plan && plan.slug) {
          distribution[plan.slug] = (distribution[plan.slug] || 0) + 1;
        }
      } else if (sub.status === 'expired' || sub.status === 'canceled') {
        distribution.free++;
      }
    });

    // Get MRR trend (last 12 months)
    const mrrTrend = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const { data: monthSubs } = await supabase
        .from('subscriptions')
        .select('plan:plans(slug, price_inr)')
        .eq('status', 'active')
        .gte('subscription_started_at', monthStart.toISOString())
        .lte('subscription_started_at', monthEnd.toISOString());

      let monthMrr = 0;
      monthSubs?.forEach((sub: any) => {
        if (sub.plan) {
          const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
          switch (plan?.slug) {
            case 'monthly': monthMrr += plan.price_inr; break;
            case 'quarterly': monthMrr += plan.price_inr / 3; break;
            case 'half-yearly': monthMrr += plan.price_inr / 6; break;
            case 'annual': monthMrr += plan.price_inr / 12; break;
          }
        }
      });

      mrrTrend.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        mrr: Math.round(monthMrr / 100), // Convert paise to rupees
      });
    }

    return NextResponse.json({
      metrics: {
        mrr: Math.round(mrr / 100), // Convert paise to rupees
        arr: Math.round(arr / 100),
        activeSubscriptions,
        trialSubscriptions: trialCount || 0,
        churnRate: Math.round(churnRate * 100) / 100,
        trialToPaidRate: Math.round(trialToPaidRate * 100) / 100,
        ltv: Math.round(ltv / 100),
        totalRevenue: Math.round(totalRevenue / 100),
        uniqueCustomers: uniqueUsers.size,
      },
      planDistribution: Object.entries(distribution).map(([plan, count]) => ({
        plan,
        count,
        percentage: planDistribution && planDistribution.length > 0
          ? Math.round((count / planDistribution.length) * 100)
          : 0
      })),
      mrrTrend,
    });

  } catch (error) {
    console.error('Revenue API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
