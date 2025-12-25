import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="min-h-screen p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Student Dashboard</h1>
        <p className="text-gray-400">Your personalized UPSC preparation journey</p>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="neon-glass p-6 rounded-xl">
          <p className="text-gray-400 text-sm">Today's Progress</p>
          <p className="text-3xl font-bold text-neon-blue">45%</p>
          <div className="w-full bg-gray-700 h-2 rounded-full mt-2">
            <div className="bg-neon-blue h-2 rounded-full" style={{ width: '45%' }}></div>
          </div>
        </div>
        <div className="neon-glass p-6 rounded-xl">
          <p className="text-gray-400 text-sm">Topics Completed</p>
          <p className="text-3xl font-bold text-neon-green">127</p>
          <p className="text-green-400 text-sm mt-2">+8 this week</p>
        </div>
        <div className="neon-glass p-6 rounded-xl">
          <p className="text-gray-400 text-sm">Videos Watched</p>
          <p className="text-3xl font-bold text-neon-purple">89</p>
          <p className="text-gray-400 text-sm mt-2">342 hours total</p>
        </div>
        <div className="neon-glass p-6 rounded-xl">
          <p className="text-gray-400 text-sm">Practice Score</p>
          <p className="text-3xl font-bold text-neon-pink">72%</p>
          <p className="text-green-400 text-sm mt-2">+5% improvement</p>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/doubt" className="neon-glass p-6 rounded-xl hover:border-neon-blue/50 transition-all group">
          <div className="w-12 h-12 bg-neon-blue/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-neon-blue/30 transition-colors">
            <svg className="w-6 h-6 text-neon-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Ask a Doubt</h3>
          <p className="text-gray-400 text-sm">Get AI-powered explanations for any UPSC topic</p>
        </Link>

        <Link href="/notes" className="neon-glass p-6 rounded-xl hover:border-neon-purple/50 transition-all group">
          <div className="w-12 h-12 bg-neon-purple/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-neon-purple/30 transition-colors">
            <svg className="w-6 h-6 text-neon-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Comprehensive Notes</h3>
          <p className="text-gray-400 text-sm">Generate AI-synthesized notes from syllabus topics</p>
        </Link>

        <Link href="/daily-news" className="neon-glass p-6 rounded-xl hover:border-neon-green/50 transition-all group">
          <div className="w-12 h-12 bg-neon-green/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-neon-green/30 transition-colors">
            <svg className="w-6 h-6 text-neon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Daily News Video</h3>
          <p className="text-gray-400 text-sm">Watch AI-generated daily current affairs summary</p>
        </Link>

        <Link href="/syllabus" className="neon-glass p-6 rounded-xl hover:border-neon-orange/50 transition-all group">
          <div className="w-12 h-12 bg-neon-orange/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-neon-orange/30 transition-colors">
            <svg className="w-6 h-6 text-neon-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Syllabus Navigator</h3>
          <p className="text-gray-400 text-sm">Interactive 3D view of UPSC syllabus</p>
        </Link>

        <Link href="/test-series" className="neon-glass p-6 rounded-xl hover:border-pink-500/50 transition-all group">
          <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-pink-500/30 transition-colors">
            <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Test Series</h3>
          <p className="text-gray-400 text-sm">Practice tests with AI evaluation</p>
        </Link>

        <Link href="/pyq" className="neon-glass p-6 rounded-xl hover:border-cyan-500/50 transition-all group">
          <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-cyan-500/30 transition-colors">
            <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Previous Year Questions</h3>
          <p className="text-gray-400 text-sm">Browse and practice PYQs with video explanations</p>
        </Link>
      </div>
    </div>
  );
}
