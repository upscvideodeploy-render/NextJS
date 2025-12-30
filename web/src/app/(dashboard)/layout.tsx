'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { useState } from 'react';
import { useLanguage, getLocalizedText } from '@/contexts/LanguageContext';
import LanguageToggle from '@/components/LanguageToggle';

const navItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'home' },
  { href: '/search', labelKey: 'nav.search', icon: 'search' },
  { href: '/syllabus', labelKey: 'nav.syllabus', icon: 'book' },
  { href: '/notes', labelKey: 'nav.notes', icon: 'file-text' },
  { href: '/news', labelKey: 'nav.news', icon: 'newspaper' },
  { href: '/practice', labelKey: 'nav.practice', icon: 'target' },
  { href: '/videos', labelKey: 'nav.videos', icon: 'play' },
  { href: '/essay', labelKey: 'nav.essays', icon: 'edit' },
  { href: '/answers', labelKey: 'nav.answers', icon: 'check-square' },
  { href: '/ethics', labelKey: 'nav.ethics', icon: 'heart' },
  { href: '/interview', labelKey: 'nav.interview', icon: 'mic' },
  { href: '/memory', labelKey: 'nav.memory', icon: 'brain' },
  { href: '/lectures', labelKey: 'nav.lectures', icon: 'graduation' },
  { href: '/community', labelKey: 'nav.community', icon: 'users' },
];

const iconPaths: Record<string, string> = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'file-text': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  newspaper: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  target: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  play: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  'check-square': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  mic: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  brain: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  graduation: 'M12 14l9-5-9-5-9 5 9 5 9-5zm0 0l6.5-3.5M12 14l-6.5-3.5M12 14v7m0 0l6.5-3.5M12 14l-6.5 3.5m0 0l-1.5 6m1.5-6L12 8m0 0l-6.5 3.5',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
};

// Helper component for localized navigation labels
function NavLabel({ labelKey }: { labelKey: string }) {
  const { t } = useLanguage();
  return <span>{t(labelKey as any)}</span>;
}

// Trial banner component
function TrialBanner() {
  const { t } = useLanguage();
  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neon-blue/10 border border-neon-blue/20 rounded-full">
      <span className="w-2 h-2 bg-neon-blue rounded-full animate-pulse"></span>
      <span className="text-xs text-neon-blue">{t('trial.freeTrial' as any)} - {t('trial.active' as any)}</span>
    </div>
  );
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900/50 border-r border-white/5 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
              <span className="text-lg font-bold">U</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-white">UPSC PrepX-AI</h1>
                <p className="text-xs text-gray-500">AI-Powered Learning</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPaths[item.icon]} />
                </svg>
                {sidebarOpen && <NavLabel labelKey={item.labelKey} />}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/5">
          {sidebarOpen && user && (
            <div className="mb-3">
              <p className="text-sm text-gray-400 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>{t('nav.signOut' as any)}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="h-16 bg-slate-900/30 border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            {/* Language Toggle */}
            <LanguageToggle />

            {/* Trial Banner */}
            <TrialBanner />

            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-sm font-semibold">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

// Default export without LanguageProvider wrapper (already in root providers)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
