'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface QueueStats {
  total_queued: number;
  total_processing: number;
  total_completed_today: number;
  total_failed_today: number;
  avg_wait_time_minutes: number;
  high_priority_count: number;
  medium_priority_count: number;
  low_priority_count: number;
}

export default function QueueMonitoringPage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: statsData } = await supabase.rpc('get_queue_stats');
    if (statsData && statsData.length > 0) setStats(statsData[0]);

    const { data: jobsData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(50);
    setJobs(jobsData || []);
    setLoading(false);
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Video Queue Monitoring</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Queued" value={stats?.total_queued || 0} color="blue" />
        <StatCard title="Processing" value={stats?.total_processing || 0} color="yellow" />
        <StatCard title="Completed Today" value={stats?.total_completed_today || 0} color="green" />
        <StatCard title="Failed Today" value={stats?.total_failed_today || 0} color="red" />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Queue by Priority</h2>
        <div className="space-y-2">
          <PriorityBar label="High Priority" count={stats?.high_priority_count || 0} color="red" />
          <PriorityBar label="Medium Priority" count={stats?.medium_priority_count || 0} color="yellow" />
          <PriorityBar label="Low Priority" count={stats?.low_priority_count || 0} color="green" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Average Wait Time</h2>
        <p className="text-3xl font-bold text-blue-600">{stats?.avg_wait_time_minutes?.toFixed(1) || 0} minutes</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="text-xl font-semibold p-6 pb-4">Recent Jobs</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Queue Pos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retry</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{job.id.slice(0, 8)}...</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{job.job_type}</td>
                  <td className="px-6 py-4 text-sm"><PriorityBadge priority={job.priority} /></td>
                  <td className="px-6 py-4 text-sm"><StatusBadge status={job.status} /></td>
                  <td className="px-6 py-4 text-sm text-gray-900">{job.queue_position || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{job.retry_count}/{job.max_retries}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(job.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600'
  };
  return (
    <div className={`rounded-lg shadow p-6 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <h3 className="text-sm font-medium opacity-75">{title}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

function PriorityBar({ label, count, color }: { label: string; count: number; color: string }) {
  const colorClasses = { red: 'bg-red-500', yellow: 'bg-yellow-500', green: 'bg-green-500' };
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-medium">{count}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClasses[color as keyof typeof colorClasses]}`} style={{ width: `${Math.min(count * 10, 100)}%` }} />
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = { high: 'bg-red-100 text-red-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-green-100 text-green-800' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority as keyof typeof colors]}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors = { queued: 'bg-blue-100 text-blue-800', processing: 'bg-yellow-100 text-yellow-800', completed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800', cancelled: 'bg-gray-100 text-gray-800' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>{status}</span>;
}
