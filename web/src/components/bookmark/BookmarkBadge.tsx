/**
 * Story 9.7: Bookmark Badge for Navigation
 * AC 8: Quick access icon with count badge
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BookmarkBadgeProps {
  className?: string;
}

export function BookmarkBadge({ className = '' }: BookmarkBadgeProps) {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/bookmarks?count=true');
        const data = await res.json();
        setCount(data.count || 0);
      } catch (error) {
        console.error('Failed to fetch bookmark count:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCount();

    // Refresh count every minute
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Listen for bookmark changes
  useEffect(() => {
    const handleBookmarkChange = () => {
      fetch('/api/bookmarks?count=true')
        .then(res => res.json())
        .then(data => setCount(data.count || 0))
        .catch(console.error);
    };

    window.addEventListener('bookmark-changed', handleBookmarkChange);
    return () => window.removeEventListener('bookmark-changed', handleBookmarkChange);
  }, []);

  return (
    <Link
      href="/bookmarks"
      className={`
        relative inline-flex items-center justify-center
        p-2 rounded-lg transition-colors
        text-gray-600 hover:bg-gray-100 hover:text-gray-900
        ${className}
      `}
      title="My Bookmarks"
    >
      {/* Bookmark Icon */}
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>

      {/* AC 8: Count Badge */}
      {!isLoading && count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-yellow-500 text-white text-xs font-bold rounded-full px-1">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

// Inline bookmark counter for other contexts
export function BookmarkCount({ className = '' }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch('/api/bookmarks?count=true')
      .then(res => res.json())
      .then(data => setCount(data.count || 0))
      .catch(console.error);
  }, []);

  return (
    <span className={`text-sm text-gray-500 ${className}`}>
      {count} bookmark{count !== 1 ? 's' : ''}
    </span>
  );
}
