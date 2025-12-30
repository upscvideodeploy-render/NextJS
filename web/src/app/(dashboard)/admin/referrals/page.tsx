/**
 * Admin Referral Management Dashboard
 * Story 5.10 - Referral Program - User Acquisition
 *
 * AC#6: Leaderboard for top referrers (gamification)
 * AC#10: Admin analytics - referral conversion rate, viral coefficient (K-factor)
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Referral {
  id: string;
  status: string;
  created_at: string;
  reward_type: string | null;
  reward_applied_at: string | null;
  referrer: {
    user_id: string;
    full_name: string;
    referral_code: string;
  } | null;
  referred: {
    user_id: string;
    full_name: string;
    email: string;
  } | null;
}

interface Analytics {
  overview: {
    total_referrals: number;
    total_users: number;
    conversion_rate: string;
    k_factor: string;
    referrals_per_user: string;
  };
  status_breakdown: {
    pending: number;
    signed_up: number;
    subscribed: number;
    rewarded: number;
  };
  monthly_trend: Record<string, number>;
  leaderboard: LeaderboardItem[];
  rewards: {
    total_distributed: number;
    avg_days_to_reward: string;
  };
}

interface LeaderboardItem {
  user_id: string;
  full_name: string;
  referral_code: string;
  count: number;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  signed_up: { label: 'Signed Up', color: 'bg-blue-100 text-blue-800' },
  subscribed: { label: 'Subscribed', color: 'bg-purple-100 text-purple-800' },
  rewarded: { label: 'Rewarded', color: 'bg-green-100 text-green-800' },
};

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    fetchData();
  }, [selectedStatus]);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const referralsUrl = selectedStatus === 'all'
        ? '/api/admin/referrals'
        : `/api/admin/referrals?status=${selectedStatus}`;

      const [referralsRes, analyticsRes] = await Promise.all([
        fetch(referralsUrl, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch('/api/admin/referrals/analytics', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
      ]);

      if (referralsRes.ok) {
        const data = await referralsRes.json();
        setReferrals(data.referrals || []);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const monthlyLabels = Object.keys(analytics?.monthly_trend || {}).sort();
  const monthlyValues = monthlyLabels.map(month => analytics?.monthly_trend?.[month] || 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Referral Management</h1>
        <p className="text-gray-600 mt-2">
          Track user referrals, conversion rates, and top referrers
        </p>
      </div>

      {/* Overview Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-gray-900">
              {analytics.overview.total_referrals}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Referrals</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-blue-600">
              {analytics.overview.total_users}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Users</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-purple-600">
              {analytics.overview.conversion_rate}
            </div>
            <div className="text-sm text-gray-600 mt-1">Conversion Rate</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-green-600">
              {analytics.overview.k_factor}
            </div>
            <div className="text-sm text-gray-600 mt-1">K-Factor</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 col-span-2 md:col-span-1">
            <div className="text-3xl font-bold text-orange-600">
              {analytics.overview.referrals_per_user}
            </div>
            <div className="text-sm text-gray-600 mt-1">Referrals/User</div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Status Breakdown */}
        {analytics && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Referral Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="font-medium">{analytics.status_breakdown.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Signed Up</span>
                <span className="font-medium text-blue-600">{analytics.status_breakdown.signed_up}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Subscribed</span>
                <span className="font-medium text-purple-600">{analytics.status_breakdown.subscribed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Rewarded</span>
                <span className="font-medium text-green-600">{analytics.status_breakdown.rewarded}</span>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Trend Chart */}
        {analytics && monthlyLabels.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 col-span-2">
            <h3 className="text-lg font-semibold mb-4">Monthly Referrals (Last 6 Months)</h3>
            <div className="h-40 flex items-end gap-2">
              {monthlyLabels.map((month, index) => {
                const value = analytics.monthly_trend?.[month] || 0;
                const maxValue = Math.max(...Object.values(analytics.monthly_trend)) || 1;
                const height = (value / maxValue) * 100;

                return (
                  <div key={month} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm transition-all hover:opacity-80"
                      style={{ height: `${Math.max(height, 5)}%` }}
                      title={`${value} referrals`}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard (AC#6) */}
      {analytics?.leaderboard && analytics.leaderboard.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <h3 className="text-lg font-semibold mb-4">Top Referrers</h3>
          <div className="space-y-2">
            {analytics.leaderboard.map((item, index) => {
              const medals = ['🥇', '🥈', '🥉'];
              const medal = medals[index] || `#${index + 1}`;

              return (
                <div key={item.user_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-8">{medal}</span>
                    <div>
                      <div className="font-medium">{item.full_name || 'Anonymous'}</div>
                      <div className="text-xs text-gray-500">Code: {item.referral_code}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{item.count}</div>
                    <div className="text-xs text-gray-500">referrals</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Referrals Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold">All Referrals</h3>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="signed_up">Signed Up</option>
            <option value="subscribed">Subscribed</option>
            <option value="rewarded">Rewarded</option>
          </select>
        </div>

        {referrals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referrer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referred</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {referrals.map((referral) => {
                  const statusInfo = statusLabels[referral.status] || statusLabels.pending;
                  return (
                    <tr key={referral.id}>
                      <td className="px-6 py-4 text-sm">
                        {new Date(referral.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">
                          {referral.referrer?.full_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {referral.referrer?.referral_code}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">{referral.referred?.email || 'Hidden'}</div>
                        <div className="text-xs text-gray-500">
                          {referral.referred?.full_name || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {referral.reward_applied_at ? (
                          <div>
                            <span className="text-green-600 font-medium">
                              +1 month free
                            </span>
                            <div className="text-xs text-gray-500">
                              {new Date(referral.reward_applied_at).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-gray-500">
            No referrals found for the selected status.
          </div>
        )}
      </div>

      {/* Key Metrics Info */}
      {analytics && (
        <div className="mt-8 bg-blue-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Key Metrics Explained</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="font-medium text-blue-900 mb-1">Conversion Rate</div>
              <div className="text-sm text-gray-700">
                Percentage of referrals that result in paid subscriptions.
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-900 mb-1">K-Factor (Viral Coefficient)</div>
              <div className="text-sm text-gray-700">
                Average number of new users each existing user brings. K-Factor &gt; 1 indicates viral growth.
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-900 mb-1">Referrals/User</div>
              <div className="text-sm text-gray-700">
                Average number of referrals per user.
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-900 mb-1">Avg Days to Reward</div>
              <div className="text-sm text-gray-700">
                {analytics.rewards.avg_days_to_reward} days average from signup to reward.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
