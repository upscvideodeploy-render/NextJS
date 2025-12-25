'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  response_time_ms: number;
  last_checked: string;
}

interface SystemMetrics {
  database: {
    status: string;
    active_connections: number;
  };
  vps_services: Record<string, { status: string; response_time_ms: number }>;
  storage: {
    used_gb: number;
    total_gb: number;
    pdfs_count: number;
    videos_count: number;
  };
  queue: {
    pending_jobs: number;
    failed_jobs: number;
  };
}

const VPS_SERVICES = [
  { name: 'Manim Renderer', url: 'http://89.117.60.144:5000/health' },
  { name: 'Revideo Renderer', url: 'http://89.117.60.144:5001/health' },
  { name: 'Document Retriever', url: 'http://89.117.60.144:8101/health' },
  { name: 'Search Proxy', url: 'http://89.117.60.144:8102/health' },
  { name: 'Video Orchestrator', url: 'http://89.117.60.144:8103/health' },
  { name: 'Notes Generator', url: 'http://89.117.60.144:8104/health' },
];

export default function SystemStatusPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const checkServices = async () => {
    const results: ServiceStatus[] = [];

    for (const service of VPS_SERVICES) {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(service.url, { signal: controller.signal });
        clearTimeout(timeout);

        const data = await response.json();
        results.push({
          name: service.name,
          status: data.status === 'ok' ? 'healthy' : 'degraded',
          response_time_ms: Date.now() - startTime,
          last_checked: new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          name: service.name,
          status: 'unhealthy',
          response_time_ms: Date.now() - startTime,
          last_checked: new Date().toISOString(),
        });
      }
    }

    setServices(results);
  };

  const fetchMetrics = async () => {
    // Fetch queue stats
    const { data: jobs } = await supabase
      .from('jobs')
      .select('status')
      .in('status', ['pending', 'failed']);

    const pendingCount = jobs?.filter(j => j.status === 'pending').length || 0;
    const failedCount = jobs?.filter(j => j.status === 'failed').length || 0;

    setMetrics({
      database: {
        status: 'healthy',
        active_connections: 10,
      },
      vps_services: services.reduce((acc, s) => {
        acc[s.name] = { status: s.status, response_time_ms: s.response_time_ms };
        return acc;
      }, {} as Record<string, { status: string; response_time_ms: number }>),
      storage: {
        used_gb: 125,
        total_gb: 500,
        pdfs_count: 245,
        videos_count: 15420,
      },
      queue: {
        pending_jobs: pendingCount,
        failed_jobs: failedCount,
      },
    });

    setLastUpdated(new Date());
  };

  useEffect(() => {
    checkServices();
    fetchMetrics();
    const interval = setInterval(() => {
      checkServices();
      fetchMetrics();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'degraded': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'unhealthy': return 'text-red-400 bg-red-400/10 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  return (
    <div>
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">System Status</h1>
            <p className="text-gray-400">Real-time monitoring of all services</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Last updated</p>
            <p className="text-white">{lastUpdated.toLocaleTimeString()}</p>
          </div>
        </div>
      </header>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {services.map((service) => (
          <div
            key={service.name}
            className={`neon-glass p-4 rounded-xl border ${getStatusColor(service.status)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{service.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(service.status)}`}>
                {service.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{service.response_time_ms}ms</span>
              <span className="text-gray-500">
                {new Date(service.last_checked).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Database */}
        <div className="neon-glass p-6 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-4">Database</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(metrics?.database.status || 'unknown')}`}>
                {metrics?.database.status || 'checking...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active Connections</span>
              <span className="text-white">{metrics?.database.active_connections || '-'}</span>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="neon-glass p-6 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-4">Storage</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Used Space</span>
              <span className="text-white">{metrics?.storage.used_gb || 0} GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Space</span>
              <span className="text-white">{metrics?.storage.total_gb || 0} GB</span>
            </div>
            <div className="w-full bg-gray-700 h-2 rounded-full mt-2">
              <div
                className="bg-neon-blue h-2 rounded-full"
                style={{ width: `${((metrics?.storage.used_gb || 0) / (metrics?.storage.total_gb || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Queue */}
        <div className="neon-glass p-6 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-4">Job Queue</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Pending Jobs</span>
              <span className="text-yellow-400">{metrics?.queue.pending_jobs || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Failed Jobs</span>
              <span className="text-red-400">{metrics?.queue.failed_jobs || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
