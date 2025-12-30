/**
 * Story 9.10: Enhanced Bookmark Library UI
 * AC 1-10: Complete library organization features
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Bookmark {
  id: string;
  content_type: string;
  content_id: string;
  title: string;
  snippet: string;
  tags: string[];
  collection_id: string | null;
  review_count: number;
  ease_factor: number;
  next_review_date: string;
  bookmarked_at: string;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bookmark_count: number;
}

interface Stats {
  total_bookmarks: number;
  by_type: Record<string, number>;
  top_tags: { tag: string; count: number }[];
  current_streak: number;
  longest_streak: number;
  total_reviews: number;
  this_week: number;
  collections_count: number;
}

const CONTENT_TYPES = [
  { value: 'note', label: 'Notes', icon: '📝' },
  { value: 'video', label: 'Videos', icon: '🎥' },
  { value: 'question', label: 'Questions', icon: '❓' },
  { value: 'topic', label: 'Topics', icon: '📚' },
  { value: 'mindmap', label: 'Mindmaps', icon: '🧠' },
  { value: 'pyq', label: 'PYQs', icon: '📋' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'reviewed', label: 'Most Reviewed' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

export default function EnhancedBookmarksPage() {
  // Data states
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // AC 1: View mode
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // AC 2, 3, 4: Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('newest');

  // AC 6: Selection for bulk operations
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // AC 5: Collection modal
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '', icon: '📁', color: '#3B82F6' });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch collections
        const colRes = await fetch('/api/bookmarks/library');
        const colData = await colRes.json();
        setCollections(colData.collections || []);

        // Fetch stats
        const statsRes = await fetch('/api/bookmarks/library?action=stats');
        const statsData = await statsRes.json();
        setStats(statsData);

        // Fetch bookmarks
        await searchBookmarks();
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // AC 2, 3, 4: Search with filters
  const searchBookmarks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: 'search' });
      if (searchQuery) params.set('q', searchQuery);
      if (contentTypeFilter) params.set('type', contentTypeFilter);
      if (collectionFilter) params.set('collection', collectionFilter);
      if (tagFilter) params.set('tags', tagFilter);
      params.set('sort', sortBy);

      const res = await fetch(`/api/bookmarks/library?${params}`);
      const data = await res.json();
      setBookmarks(data.bookmarks || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, [searchQuery, contentTypeFilter, collectionFilter, tagFilter, sortBy]);

  useEffect(() => {
    const timer = setTimeout(searchBookmarks, 300);
    return () => clearTimeout(timer);
  }, [searchBookmarks]);

  // AC 5: Create collection
  const createCollection = async () => {
    if (!newCollection.name.trim()) return;
    try {
      const res = await fetch('/api/bookmarks/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCollection)
      });
      if (res.ok) {
        const colRes = await fetch('/api/bookmarks/library');
        const colData = await colRes.json();
        setCollections(colData.collections || []);
        setShowCollectionModal(false);
        setNewCollection({ name: '', description: '', icon: '📁', color: '#3B82F6' });
      }
    } catch (error) {
      console.error('Create collection error:', error);
    }
  };

  // AC 6: Bulk operations
  const handleBulkAction = async (action: 'move' | 'add_tags' | 'delete', extra?: { collection_id?: string; tags?: string[] }) => {
    if (selectedBookmarks.size === 0) return;
    try {
      const res = await fetch('/api/bookmarks/library?action=bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          bookmark_ids: Array.from(selectedBookmarks),
          ...extra
        })
      });
      if (res.ok) {
        setSelectedBookmarks(new Set());
        setShowBulkMenu(false);
        searchBookmarks();
      }
    } catch (error) {
      console.error('Bulk action error:', error);
    }
  };

  // AC 9: Export
  const handleExport = async (format: 'json' | 'csv') => {
    window.open(`/api/bookmarks/library?action=export&format=${format}`, '_blank');
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedBookmarks);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBookmarks(newSet);
  };

  const selectAll = () => {
    if (selectedBookmarks.size === bookmarks.length) {
      setSelectedBookmarks(new Set());
    } else {
      setSelectedBookmarks(new Set(bookmarks.map(b => b.id)));
    }
  };

  // Get all unique tags
  const allTags = [...new Set(bookmarks.flatMap(b => b.tags || []))].sort();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto animate-pulse space-y-6">
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // AC 10: Empty state
  if (bookmarks.length === 0 && !searchQuery && !contentTypeFilter && !collectionFilter) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <span className="text-6xl mb-6 block">🔖</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Bookmarks Yet</h1>
          <p className="text-gray-600 mb-8">
            Start bookmarking notes, videos, and questions to build your personal study library.
          </p>
          <div className="bg-blue-50 rounded-xl p-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-3">How to bookmark:</h3>
            <ol className="space-y-2 text-blue-800 text-sm">
              <li>1. Navigate to any note, video, or question</li>
              <li>2. Click the 🔖 bookmark icon</li>
              <li>3. Add tags to organize your content</li>
              <li>4. Review bookmarks regularly to retain knowledge</li>
            </ol>
          </div>
          <Link href="/" className="mt-8 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Start Exploring
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">My Library</h1>
            <div className="flex items-center gap-3">
              <Link
                href="/bookmarks/review"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                🏃 Review ({stats?.total_bookmarks || 0})
              </Link>
              <Link
                href="/bookmarks/tags"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                🏷️ Tags
              </Link>
              <div className="relative">
                <button
                  onClick={() => setShowBulkMenu(!showBulkMenu)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  ⚙️ Actions
                </button>
                {showBulkMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <button onClick={() => handleExport('json')} className="w-full px-4 py-2 text-left hover:bg-gray-50">
                      📥 Export JSON
                    </button>
                    <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-left hover:bg-gray-50">
                      📊 Export CSV
                    </button>
                    <hr className="my-2" />
                    <button onClick={() => setShowCollectionModal(true)} className="w-full px-4 py-2 text-left hover:bg-gray-50">
                      📁 New Collection
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* AC 8: Statistics Dashboard */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-3xl font-bold text-blue-600">{stats.total_bookmarks}</div>
              <div className="text-sm text-gray-500">Total Bookmarks</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-3xl font-bold text-orange-600">🔥 {stats.current_streak}</div>
              <div className="text-sm text-gray-500">Review Streak</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-3xl font-bold text-green-600">{stats.this_week}</div>
              <div className="text-sm text-gray-500">Reviews This Week</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-3xl font-bold text-purple-600">{stats.collections_count}</div>
              <div className="text-sm text-gray-500">Collections</div>
            </div>
          </div>
        )}

        {/* AC 5: Collections */}
        {collections.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Collections</h2>
              <button
                onClick={() => setShowCollectionModal(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                + New Collection
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              <button
                onClick={() => setCollectionFilter(null)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-colors ${
                  !collectionFilter ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                All ({stats?.total_bookmarks || 0})
              </button>
              {collections.map(col => (
                <button
                  key={col.id}
                  onClick={() => setCollectionFilter(col.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                    collectionFilter === col.id ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  style={{ borderColor: collectionFilter === col.id ? col.color : undefined }}
                >
                  <span>{col.icon}</span>
                  <span>{col.name}</span>
                  <span className="text-xs text-gray-400">({col.bookmark_count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AC 2, 3, 4: Search and Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Content Type Filter */}
            <select
              value={contentTypeFilter || ''}
              onChange={(e) => setContentTypeFilter(e.target.value || null)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Types</option>
              {CONTENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>

            {/* Tag Filter */}
            <select
              value={tagFilter || ''}
              onChange={(e) => setTagFilter(e.target.value || null)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              {SORT_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* AC 1: View Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('card')}
                className={`px-3 py-2 ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                ▦
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* AC 6: Bulk Selection Bar */}
        {selectedBookmarks.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <span className="font-medium text-blue-700">
              {selectedBookmarks.size} bookmark{selectedBookmarks.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAction('move', { collection_id: e.target.value });
                    e.target.value = '';
                  }
                }}
                className="px-3 py-1 border border-blue-300 rounded bg-white text-sm"
              >
                <option value="">Move to...</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedBookmarks(new Set())}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Bookmarks Grid/List */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedBookmarks.size === bookmarks.length && bookmarks.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-500">{bookmarks.length} bookmarks</span>
          </div>
        </div>

        {bookmarks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No bookmarks match your filters.
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookmarks.map(bookmark => (
              <div
                key={bookmark.id}
                className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${
                  selectedBookmarks.has(bookmark.id) ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedBookmarks.has(bookmark.id)}
                    onChange={() => toggleSelection(bookmark.id)}
                    className="mt-1 w-4 h-4 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <Link href={`/bookmarks/${bookmark.id}`} className="font-medium text-gray-900 hover:text-blue-600 line-clamp-2">
                      {bookmark.title}
                    </Link>
                    {bookmark.snippet && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">{bookmark.snippet}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(bookmark.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{CONTENT_TYPES.find(t => t.value === bookmark.content_type)?.icon}</span>
                      <span>{new Date(bookmark.bookmarked_at).toLocaleDateString()}</span>
                      {bookmark.review_count > 0 && <span>• {bookmark.review_count} reviews</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {bookmarks.map(bookmark => (
              <div
                key={bookmark.id}
                className={`p-4 hover:bg-gray-50 flex items-center gap-4 ${
                  selectedBookmarks.has(bookmark.id) ? 'bg-blue-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedBookmarks.has(bookmark.id)}
                  onChange={() => toggleSelection(bookmark.id)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-lg">{CONTENT_TYPES.find(t => t.value === bookmark.content_type)?.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <Link href={`/bookmarks/${bookmark.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                    {bookmark.title}
                  </Link>
                </div>
                <div className="flex gap-1">
                  {(bookmark.tags || []).slice(0, 2).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(bookmark.bookmarked_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AC 5: New Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Collection</h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newCollection.icon}
                  onChange={(e) => setNewCollection({ ...newCollection, icon: e.target.value })}
                  className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-center text-xl"
                  maxLength={2}
                />
                <input
                  type="text"
                  placeholder="Collection name"
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <input
                type="text"
                placeholder="Description (optional)"
                value={newCollection.description}
                onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCollectionModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={createCollection}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
