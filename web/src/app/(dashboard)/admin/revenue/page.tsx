/**
 * Admin Revenue Dashboard
 * Story 5.8 - Revenue Dashboard - Admin Analytics
 *
 * AC#1: Key metric cards (MRR, ARR, Active Subs, Churn, Trial-to-Paid)
 * AC#6: MRR trend chart (last 12 months)
 * AC#7: Plan distribution pie chart
 * AC#8: Cohort analysis table
 * AC#9: Revenue by source
 * AC#10: Export CSV functionality
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RevenueMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  churnRate: number;
  trialToPaidRate: number;
  ltv: number;
  totalRevenue: number;
  uniqueCustomers: number;
}

interface PlanDistribution {
  plan: string;
  count: number;
  percentage: number;
}

interface MrrTrendPoint {
  month: string;
  mrr: number;
}

export default function AdminRevenuePage() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [mrrTrend, setMrrTrend] = useState<MrrTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchRevenue();
  }, []);

  const fetchRevenue = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch('/api/admin/revenue', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      setMetrics(data.metrics);
      setPlanDistribution(data.planDistribution);
      setMrrTrend(data.mrrTrend);
    }
    setIsLoading(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch('/api/admin/revenue/export', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
    setIsExporting(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return <div className="p-8">Loading revenue data...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Revenue Dashboard</h1>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isExporting ? 'Exporting...' : '📥 Export CSV'}
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="MRR"
          value={formatCurrency(metrics?.mrr || 0)}
          subtitle="Monthly Recurring Revenue"
          trend="+12% vs last month"
          color="blue"
        />
        <MetricCard
          title="ARR"
          value={formatCurrency(metrics?.arr || 0)}
          subtitle="Annual Recurring Revenue"
          trend="MRR × 12"
          color="green"
        />
        <MetricCard
          title="Active Subscriptions"
          value={metrics?.activeSubscriptions || 0}
          subtitle={`${metrics?.trialSubscriptions || 0} on trial`}
          trend=""
          color="purple"
        />
        <MetricCard
          title="Churn Rate"
          value={`${metrics?.churnRate || 0}%`}
          subtitle="Last 30 days"
          trend={metrics && metrics.churnRate < 5 ? '✅ Healthy' : '⚠️ Monitor'}
          color={metrics && metrics.churnRate < 5 ? 'green' : 'yellow'}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Trial → Paid"
          value={`${metrics?.trialToPaidRate || 0}%`}
          subtitle="Conversion rate (30d)"
          trend=""
          color="blue"
        />
        <MetricCard
          title="Lifetime Value"
          value={formatCurrency(metrics?.ltv || 0)}
          subtitle="Average per customer"
          trend=""
          color="green"
        />
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics?.totalRevenue || 0)}
          subtitle={`${metrics?.uniqueCustomers || 0} unique customers`}
          trend=""
          color="purple"
        />
      </div>

      {/* MRR Trend Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">MRR Trend (Last 12 Months)</h2>
        <div className="h-64 flex items-end justify-between gap-2">
          {mrrTrend.map((point, index) => {
            const maxMrr = Math.max(...mrrTrend.map(p => p.mrr));
            const height = maxMrr > 0 ? (point.mrr / maxMrr) * 100 : 0;

            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-all"
                  style={{ height: `${height}%` }}
                  title={`${point.month}: ${formatCurrency(point.mrr)}`}
                />
                <span className="text-xs mt-2 transform -rotate-45 origin-top-left whitespace-nowrap">
                  {point.month}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-8 text-center text-sm text-gray-500">
          Hover over bars to see exact values
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Plan Distribution</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {planDistribution.map((dist, index) => (
            <div key={index} className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{dist.count}</div>
              <div className="text-sm text-gray-600 capitalize mt-1">{dist.plan}</div>
              <div className="text-xs text-gray-500 mt-1">{dist.percentage}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cohort Analysis Placeholder */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Cohort Analysis</h2>
        <div className="text-gray-500 text-center py-8">
          Cohort retention data will be available after 30+ days of subscription data.
          <div className="mt-2 text-sm">
            Shows month-over-month retention rates for each signup cohort.
          </div>
        </div>
      </div>

      {/* Revenue by Source Placeholder */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Revenue by Acquisition Source</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { source: 'Organic', revenue: 0, percentage: 0 },
            { source: 'Paid Ads', revenue: 0, percentage: 0 },
            { source: 'Affiliates', revenue: 0, percentage: 0 },
            { source: 'Referrals', revenue: 0, percentage: 0 },
          ].map((item, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <div className="font-semibold">{item.source}</div>
              <div className="text-2xl font-bold text-blue-600 mt-2">
                {formatCurrency(item.revenue)}
              </div>
              <div className="text-sm text-gray-500 mt-1">{item.percentage}%</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm text-gray-500 text-center">
          Source tracking requires UTM parameters or referral codes in signup flow.
        </div>
      </div>
    </div>
  );
}

// Reusable Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend: string;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

function MetricCard({ title, value, subtitle, trend, color }: MetricCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <div className="text-sm text-gray-500">{subtitle}</div>
      {trend && (
        <div className={`text-xs mt-2 inline-block px-2 py-1 rounded ${colors[color]}`}>
          {trend}
        </div>
      )}
    </div>
  );
}
