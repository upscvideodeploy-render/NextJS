import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admin Dashboard | UPSC PrepX-AI',
  description: 'Admin panel for managing UPSC PrepX-AI platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-slate-900/80 border-r border-white/10 p-4">
            <div className="mb-8">
              <h1 className="text-xl font-bold gradient-text">UPSC PrepX-AI</h1>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
            <nav className="space-y-2">
              <a href="/" className="block px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-neon-blue transition-colors">
                Dashboard
              </a>
              <a href="/queue/monitoring" className="block px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-neon-blue transition-colors">
                Queue Monitor
              </a>
              <a href="#" className="block px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-neon-blue transition-colors">
                Content Management
              </a>
              <a href="#" className="block px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-neon-blue transition-colors">
                User Management
              </a>
              <a href="#" className="block px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-neon-blue transition-colors">
                Analytics
              </a>
              <a href="#" className="block px-4 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-neon-blue transition-colors">
                Settings
              </a>
            </nav>
          </aside>
          {/* Main Content */}
          <main className="flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
