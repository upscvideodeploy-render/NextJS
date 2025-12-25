import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-6xl font-bold mb-6">
          <span className="gradient-text">UPSC PrepX-AI</span>
        </h1>
        <p className="text-xl text-gray-300 mb-8 leading-relaxed">
          Enterprise AI-powered UPSC exam preparation platform with video generation,
          adaptive learning, and comprehensive study materials.
        </p>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <Link
            href="/dashboard"
            className="neon-glass neon-glass-hover p-8 rounded-2xl text-left transition-all duration-300"
          >
            <h2 className="text-2xl font-bold text-neon-blue mb-2">Student Dashboard</h2>
            <p className="text-gray-400">
              Access your personalized learning path, notes, and video content.
            </p>
          </Link>

          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="neon-glass neon-glass-hover p-8 rounded-2xl text-left transition-all duration-300"
          >
            <h2 className="text-2xl font-bold text-neon-purple mb-2">Admin Panel</h2>
            <p className="text-gray-400">
              Manage content, monitor video renders, and view analytics.
            </p>
          </a>
        </div>

        {/* Status Indicators */}
        <div className="mt-16 flex justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-gray-400">Supabase Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-gray-400">A4F API Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-gray-400">VPS Services Online</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-24 text-center text-gray-500 text-sm">
        <p>UPSC PrepX-AI v1.0.0 | Built with BMAD Methodology</p>
        <p className="mt-2">
          Powered by Supabase, A4F Unified AI, Manim & Revideo
        </p>
      </footer>
    </main>
  );
}
