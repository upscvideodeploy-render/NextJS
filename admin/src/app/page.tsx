import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Monitor and manage your UPSC PrepX-AI platform</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <p className="text-gray-400 text-sm mb-1">Total Users</p>
          <p className="text-3xl font-bold text-neon-blue">1,247</p>
          <p className="text-green-400 text-sm mt-2">+12% this week</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-sm mb-1">Active Subscriptions</p>
          <p className="text-3xl font-bold text-neon-green">892</p>
          <p className="text-green-400 text-sm mt-2">71.5% conversion</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-sm mb-1">Videos Generated</p>
          <p className="text-3xl font-bold text-neon-purple">3,456</p>
          <p className="text-gray-400 text-sm mt-2">This month</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-sm mb-1">Queue Pending</p>
          <p className="text-3xl font-bold text-neon-orange">23</p>
          <p className="text-gray-400 text-sm mt-2">Avg wait: 5 min</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/queue/monitoring" className="neon-glass p-6 rounded-xl hover:border-neon-blue/50 transition-colors">
          <h3 className="text-xl font-bold text-neon-blue mb-2">Queue Monitor</h3>
          <p className="text-gray-400 text-sm">View and manage video generation queue</p>
        </Link>

        <div className="neon-glass p-6 rounded-xl cursor-pointer hover:border-neon-purple/50 transition-colors">
          <h3 className="text-xl font-bold text-neon-purple mb-2">Upload Content</h3>
          <p className="text-gray-400 text-sm">Add PDFs and study materials to knowledge base</p>
        </div>

        <div className="neon-glass p-6 rounded-xl cursor-pointer hover:border-neon-green/50 transition-colors">
          <h3 className="text-xl font-bold text-neon-green mb-2">User Analytics</h3>
          <p className="text-gray-400 text-sm">View user engagement and learning metrics</p>
        </div>
      </div>
    </div>
  );
}
