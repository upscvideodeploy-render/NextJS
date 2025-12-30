/**
 * Admin Revenue Dashboard
 * Story 5.8 - Admin Revenue Dashboard & Analytics
 *
 * AC#1: /admin/revenue with key metrics
 * AC#2: MRR calculation and trends
 * AC#3: Subscription counts and churn
 * AC#4: Trial metrics and conversion
 * AC#5: Revenue breakdown by plan
 * AC#6: Charts
 * AC#9: Export to CSV/PDF
 * AC#10: Real-time updates
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RevenueMetrics {
  mrr: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  canceled_subscriptions: number;
  expired_subscriptions: number;
  trials_last_30_days: number;
  churn_rate_percent: number;
}

interface RevenueByPlan {
  plan_name: string;
  count: number;
  revenue: number;
}

interface Transaction {
  id: string;
  amount_inr: number;
  final_amount: number;
  status: string;
  created_at: string;
  coupon_code: string | null;
  user: { email: string } | null;
  plan: { name: string } | null;
}

export default function RevenueDashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [revenueByPlan, setRevenueByPlan] = useState<RevenueByPlan[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [topCoupons, setTopCoupons] = useState<{ code: string; count: number; revenue: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndFetch();
    // Auto-refresh every 5 minutes (AC#10)
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    setIsAdmin(true);
    fetchData();
  };

  const fetchData = async () => {
    // Fetch revenue analytics view
    const { data: analyticsData } = await supabase
      .from('revenue_analytics')
      .select('*')
      .single();

    if (analyticsData) {
      setMetrics(analyticsData);
    }

    // Fetch revenue by plan
    const { data: planData } = await supabase
      .from('subscriptions')
      .select('plan:plans(name, price_inr)')
      .eq('status', 'active');

    if (planData) {
      const planCounts: Record<string, { count: number; revenue: number }> = {};
      planData.forEach((s: any) => {
        const planName = s.plan?.name || 'Unknown';
        const price = s.plan?.price_inr || 0;
        if (!planCounts[planName]) {
          planCounts[planName] = { count: 0, revenue: 0 };
        }
        planCounts[planName].count++;
        planCounts[planName].revenue += price;
      });

      setRevenueByPlan(
        Object.entries(planCounts).map(([name, data]) => ({
          plan_name: name,
          count: data.count,
          revenue: data.revenue,
        }))
      );
    }

    // Fetch recent transactions
    const { data: txnData } = await supabase
      .from('payment_transactions')
      .select('*, user:users(email), plan:plans(name)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (txnData) {
      setRecentTransactions(txnData as Transaction[]);
    }

    // Fetch top coupons
    const { data: couponData } = await supabase
      .from('coupon_usages')
      .select('coupon:coupons(code), discount_applied');

    if (couponData) {
      const couponStats: Record<string, { count: number; revenue: number }> = {};
      couponData.forEach((usage: any) => {
        const code = usage.coupon?.code || 'Unknown';
        if (!couponStats[code]) {
          couponStats[code] = { count: 0, revenue: 0 };
        }
        couponStats[code].count++;
        couponStats[code].revenue += usage.discount_applied;
      });

      setTopCoupons(
        Object.entries(couponStats)
          .map(([code, data]) => ({ code, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );
    }

    setIsLoading(false);
  };

  const exportCSV = () => {
    if (!recentTransactions.length) return;

    const headers = ['Date', 'User', 'Plan', 'Amount', 'Coupon', 'Status'];
    const rows = recentTransactions.map(txn => [
      new Date(txn.created_at).toLocaleString(),
      txn.user?.email || '-',
      txn.plan?.name || '-',
      txn.final_amount,
      txn.coupon_code || '-',
      txn.status,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Revenue Dashboard</h1>
          <button
            onClick={exportCSV}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
          >
            Export CSV
          </button>
        </div>

        {/* Key Metrics Cards (AC#1, AC#2, AC#3) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-500/30 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">MRR</p>
            <p className="text-3xl font-bold">₹{metrics?.mrr?.toLocaleString() || 0}</p>
            <p className="text-sm text-green-400 mt-2">Monthly Recurring Revenue</p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Active Subscriptions</p>
            <p className="text-3xl font-bold text-green-400">{metrics?.active_subscriptions || 0}</p>
            <p className="text-sm text-gray-500 mt-2">
              +{metrics?.trials_last_30_days || 0} trials (30d)
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Trial Users</p>
            <p className="text-3xl font-bold text-blue-400">{metrics?.trial_subscriptions || 0}</p>
            <p className="text-sm text-gray-500 mt-2">
              {metrics?.trials_last_30_days || 0} started this month
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Churn Rate</p>
            <p className={`text-3xl font-bold ${
              (metrics?.churn_rate_percent || 0) > 5 ? 'text-red-400' : 'text-green-400'
            }`}>
              {metrics?.churn_rate_percent || 0}%
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {metrics?.canceled_subscriptions || 0} cancelled
            </p>
          </div>
        </div>

        {/* Revenue by Plan (AC#5) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Revenue by Plan</h2>
            {revenueByPlan.length > 0 ? (
              <div className="space-y-4">
                {revenueByPlan.map((plan) => (
                  <div key={plan.plan_name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span>{plan.plan_name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{plan.revenue.toLocaleString()}</p>
                      <p className="text-sm text-gray-400">{plan.count} users</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No data yet</p>
            )}
          </div>

          {/* Top Coupons (AC#8) */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Top Coupons</h2>
            {topCoupons.length > 0 ? (
              <div className="space-y-3">
                {topCoupons.map((coupon) => (
                  <div key={coupon.code} className="flex items-center justify-between">
                    <span className="font-mono text-purple-400">{coupon.code}</span>
                    <div className="text-right">
                      <p className="font-semibold">{coupon.count} uses</p>
                      <p className="text-sm text-gray-400">₹{coupon.revenue} saved</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No coupons used yet</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
          {recentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">User</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Coupon</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-gray-800/50">
                      <td className="py-3 text-sm">
                        {new Date(txn.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-sm">{txn.user?.email || '-'}</td>
                      <td className="py-3">{txn.plan?.name || '-'}</td>
                      <td className="py-3">₹{txn.final_amount}</td>
                      <td className="py-3">
                        {txn.coupon_code ? (
                          <span className="text-purple-400 font-mono text-sm">
                            {txn.coupon_code}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          txn.status === 'captured' ? 'bg-green-500/20 text-green-400' :
                          txn.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
