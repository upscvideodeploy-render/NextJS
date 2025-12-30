/**
 * Story 9.7: Bookmarks Library Page
 * Full bookmark management UI
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BookmarkContext {
  video_position?: number;
  scroll_position?: number;
  page?: number;
  highlight?: string;
}

interface Bookmark {
  id: string;
  content_type: string;
  content_id: string;
  title: string;
  snippet: string;
  url: string;
  tags: string[];
  context: BookmarkContext;
  is_favorite: boolean;
  bookmarked_at: string;
}

const CONTENT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; path: string }> = {
  note: { label: 'Notes', icon: '📝', color: 'bg-blue-100 text-blue-700', path: '/notes' },
  video: { label: 'Videos', icon: '🎥', color: 'bg-purple-100 text-purple-700', path: '/videos' },
  question: { label: 'Questions', icon: '❓', color: 'bg-green-100 text-green-700', path: '/practice' },
  topic: { label: 'Topics', icon: '📚', color: 'bg-orange-100 text-orange-700', path: '/topics' },
  mindmap: { label: 'Mindmaps', icon: '🧠', color: 'bg-pink-100 text-pink-700', path: '/mindmap' },
  pyq: { label: 'PYQs', icon: '📋', color: 'bg-yellow-100 text-yellow-700', path: '/pyq' },
  custom: { label: 'Custom', icon: '🔗', color: 'bg-gray-100 text-gray-700', path: '' }
};

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  // Fetch bookmarks
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        let url = '/api/bookmarks';
        if (filter) url += `?type=${filter}`;
        else if (tagFilter) url += `?tag=${tagFilter}`;
        
        const res = await fetch(url);
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      } catch (error) {
        console.error('Failed to fetch bookmarks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookmarks();
  }, [filter, tagFilter]);

  // Get unique tags
  const allTags = [...new Set(bookmarks.flatMap(b => b.tags || []))].sort();

  // Filter by search
  const filteredBookmarks = bookmarks.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.snippet?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Delete bookmark
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/bookmarks?id=${id}`, { method: 'DELETE' });
      setBookmarks(prev => prev.filter(b => b.id !== id));
      window.dispatchEvent(new CustomEvent('bookmark-changed'));
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
    }
  };

  // Update tags (AC 6)
  const handleUpdateTags = async (bookmarkId: string, tags: string[]) => {
    try {
      await fetch('/api/bookmarks?action=tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmark_id: bookmarkId, tags })
      });
      setBookmarks(prev => prev.map(b => 
        b.id === bookmarkId ? { ...b, tags } : b
      ));
      setEditingTags(null);
      setNewTag('');
    } catch (error) {
      console.error('Failed to update tags:', error);
    }
  };

  // Add tag to bookmark
  const addTag = (bookmarkId: string, currentTags: string[]) => {
    if (newTag && !currentTags.includes(newTag)) {
      handleUpdateTags(bookmarkId, [...currentTags, newTag]);
    }
  };

  // Remove tag from bookmark
  const removeTag = (bookmarkId: string, currentTags: string[], tagToRemove: string) => {
    handleUpdateTags(bookmarkId, currentTags.filter(t => t !== tagToRemove));
  };

  // Get link for content
  const getContentLink = (bookmark: Bookmark): string => {
    if (bookmark.content_type === 'custom' && bookmark.url) {
      return bookmark.url;
    }
    const config = CONTENT_TYPE_CONFIG[bookmark.content_type];
    if (config && bookmark.content_id) {
      return `${config.path}/${bookmark.content_id}`;
    }
    return '#';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Bookmarks</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/bookmarks/review"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              🏃 Review Due
            </Link>
            <span className="text-gray-500">{bookmarks.length} total</span>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => { setFilter(null); setTagFilter(null); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !filter && !tagFilter
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {Object.entries(CONTENT_TYPE_CONFIG).map(([type, config]) => (
            <button
              key={type}
              onClick={() => { setFilter(type); setTagFilter(null); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                filter === type
                  ? config.color
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>

        {/* Tag Cloud */}
        {allTags.length > 0 && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Tags:</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => { setTagFilter(tag); setFilter(null); }}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    tagFilter === tag
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bookmarks List */}
        {filteredBookmarks.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">🔖</span>
            <p className="text-gray-500">
              {searchQuery ? 'No bookmarks match your search' : 'No bookmarks yet'}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Bookmark notes, videos, and questions to access them quickly
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookmarks.map(bookmark => {
              const config = CONTENT_TYPE_CONFIG[bookmark.content_type] || CONTENT_TYPE_CONFIG.custom;
              
              return (
                <div
                  key={bookmark.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Type Icon */}
                    <span className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg ${config.color}`}>
                      {config.icon}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={getContentLink(bookmark)}
                        className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
                      >
                        {bookmark.title}
                      </Link>

                      {/* Snippet */}
                      {bookmark.snippet && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {bookmark.snippet}
                        </p>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {editingTags === bookmark.id ? (
                          <>
                            {(bookmark.tags || []).map(tag => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                              >
                                #{tag}
                                <button
                                  onClick={() => removeTag(bookmark.id, bookmark.tags, tag)}
                                  className="hover:text-red-500"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addTag(bookmark.id, bookmark.tags || []);
                                }
                              }}
                              placeholder="Add tag..."
                              className="px-2 py-0.5 text-xs border rounded w-20"
                              autoFocus
                            />
                            <button
                              onClick={() => setEditingTags(null)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Done
                            </button>
                          </>
                        ) : (
                          <>
                            {(bookmark.tags || []).slice(0, 3).map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                              >
                                #{tag}
                              </span>
                            ))}
                            {(bookmark.tags?.length || 0) > 3 && (
                              <span className="text-xs text-gray-400">
                                +{bookmark.tags.length - 3} more
                              </span>
                            )}
                            <button
                              onClick={() => setEditingTags(bookmark.id)}
                              className="text-xs text-blue-500 hover:text-blue-600"
                            >
                              Edit tags
                            </button>
                          </>
                        )}
                      </div>

                      {/* Context info (AC 7) */}
                      {bookmark.context && Object.keys(bookmark.context).length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          {bookmark.context.video_position && (
                            <span>📍 Saved at {Math.floor(bookmark.context.video_position / 60)}:{String(bookmark.context.video_position % 60).padStart(2, '0')}</span>
                          )}
                          {bookmark.context.page && (
                            <span>📄 Page {bookmark.context.page}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {new Date(bookmark.bookmarked_at).toLocaleDateString()}
                      </span>
                      <Link
                        href={`/bookmarks/${bookmark.id}`}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="View related content"
                      >
                        🔗
                      </Link>
                      <button
                        onClick={() => handleDelete(bookmark.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove bookmark"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
