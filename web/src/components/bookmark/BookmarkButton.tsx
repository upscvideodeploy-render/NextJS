/**
 * Story 9.7: Bookmark Button Component
 * AC 1: Appears on all content types
 * AC 2: One-click bookmarking with visual confirmation
 * AC 7: Saves context (video position, scroll)
 * AC 10: Shows "Already bookmarked" state
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface BookmarkButtonProps {
  contentType: 'note' | 'video' | 'question' | 'topic' | 'mindmap' | 'pyq' | 'custom';
  contentId: string;
  title: string;
  fullContent?: string;  // For auto-snippet
  url?: string;  // For custom bookmarks
  tags?: string[];
  context?: {
    video_position?: number;
    scroll_position?: number;
    highlight?: string;
    page?: number;
  };
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onBookmarkChange?: (isBookmarked: boolean) => void;
}

export function BookmarkButton({
  contentType,
  contentId,
  title,
  fullContent,
  url,
  tags = [],
  context,
  size = 'md',
  showLabel = false,
  className = '',
  onBookmarkChange
}: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'added' | 'removed'>('added');

  // Size classes
  const sizeClasses = {
    sm: 'p-1 text-sm',
    md: 'p-2 text-base',
    lg: 'p-3 text-lg'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  // Check initial bookmark status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(
          `/api/bookmarks?content_type=${contentType}&content_id=${contentId}`,
          { method: 'HEAD' }
        );
        setIsBookmarked(res.ok);
      } catch (error) {
        console.error('Failed to check bookmark status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, [contentType, contentId]);

  // Toggle bookmark with visual confirmation
  const handleToggle = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get current context
      const currentContext = {
        ...context,
        scroll_position: typeof window !== 'undefined' ? window.scrollY : undefined
      };

      const res = await fetch('/api/bookmarks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          title,
          full_content: fullContent,
          url,
          tags,
          context: currentContext
        })
      });

      const data = await res.json();

      if (data.action === 'added') {
        setIsBookmarked(true);
        setConfirmationType('added');
      } else {
        setIsBookmarked(false);
        setConfirmationType('removed');
      }

      // Show visual confirmation (AC 2)
      setShowConfirmation(true);
      setTimeout(() => setShowConfirmation(false), 2000);

      // Callback
      onBookmarkChange?.(data.action === 'added');

    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    } finally {
      setIsLoading(false);
    }
  }, [contentType, contentId, title, fullContent, url, tags, context, onBookmarkChange]);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`
          ${sizeClasses[size]}
          rounded-lg transition-all duration-200
          ${isBookmarked 
            ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
          }
          ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
          flex items-center gap-2
        `}
        title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        {/* Bookmark Icon */}
        <svg
          className={`${iconSizes[size]} transition-transform ${isBookmarked ? 'scale-110' : ''}`}
          fill={isBookmarked ? 'currentColor' : 'none'}
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

        {/* Label */}
        {showLabel && (
          <span className="font-medium">
            {isLoading ? 'Loading...' : (isBookmarked ? 'Bookmarked' : 'Bookmark')}
          </span>
        )}
      </button>

      {/* AC 2: Visual Confirmation Toast */}
      {showConfirmation && (
        <div
          className={`
            absolute -top-12 left-1/2 -translate-x-1/2
            px-3 py-1.5 rounded-full text-sm font-medium
            whitespace-nowrap z-50
            animate-fade-in-up
            ${confirmationType === 'added' 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-500 text-white'
            }
          `}
        >
          {confirmationType === 'added' ? '✓ Bookmarked!' : '✓ Removed'}
        </div>
      )}

      {/* AC 10: Already Bookmarked indicator (subtle) */}
      {isBookmarked && !isLoading && !showConfirmation && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full" />
      )}
    </div>
  );
}

// Quick bookmark for inline use (minimal UI)
export function QuickBookmark({
  contentType,
  contentId,
  title
}: {
  contentType: BookmarkButtonProps['contentType'];
  contentId: string;
  title: string;
}) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: contentType, content_id: contentId, title })
      });
      const data = await res.json();
      setIsBookmarked(data.action === 'added');
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={isLoading}
      className={`
        p-1 rounded transition-colors
        ${isBookmarked ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}
        ${isLoading ? 'animate-pulse' : ''}
      `}
    >
      {isBookmarked ? '★' : '☆'}
    </button>
  );
}
