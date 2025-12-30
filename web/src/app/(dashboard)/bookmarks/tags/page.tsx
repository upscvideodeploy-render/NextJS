/**
 * Story 9.10 AC 7: Tags Management Page
 * View, rename, merge, and delete tags
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TagWithCount {
  tag: string;
  count: number;
}

export default function TagsManagementPage() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  
  // Modals
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [renameTag, setRenameTag] = useState<string>('');
  const [newTagName, setNewTagName] = useState('');
  const [mergeTargetTag, setMergeTargetTag] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/bookmarks/tags');
        const data = await res.json();
        setTags(data.tags || []);
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTags();
  }, []);

  // Filter tags by search
  const filteredTags = tags.filter(t => 
    t.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    const newSet = new Set(selectedTags);
    if (newSet.has(tag)) {
      newSet.delete(tag);
    } else {
      newSet.add(tag);
    }
    setSelectedTags(newSet);
  };

  // Rename tag
  const handleRename = async () => {
    if (!renameTag || !newTagName.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/bookmarks/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          old_tag: renameTag,
          new_tag: newTagName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Renamed "${renameTag}" to "${newTagName}" (${data.affected} bookmarks updated)` });
        // Refresh tags
        const tagsRes = await fetch('/api/bookmarks/tags');
        const tagsData = await tagsRes.json();
        setTags(tagsData.tags || []);
        setShowRenameModal(false);
        setRenameTag('');
        setNewTagName('');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to rename tag' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Merge tags
  const handleMerge = async () => {
    if (selectedTags.size < 2 || !mergeTargetTag) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/bookmarks/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge',
          source_tags: Array.from(selectedTags).filter(t => t !== mergeTargetTag),
          target_tag: mergeTargetTag
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Merged ${selectedTags.size} tags into "${mergeTargetTag}"` });
        // Refresh tags
        const tagsRes = await fetch('/api/bookmarks/tags');
        const tagsData = await tagsRes.json();
        setTags(tagsData.tags || []);
        setShowMergeModal(false);
        setSelectedTags(new Set());
        setMergeTargetTag('');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to merge tags' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete tag
  const handleDelete = async (tag: string) => {
    if (!confirm(`Delete tag "${tag}"? This will remove it from all bookmarks.`)) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/bookmarks/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Deleted tag "${tag}" (${data.affected} bookmarks updated)` });
        setTags(prev => prev.filter(t => t.tag !== tag));
        selectedTags.delete(tag);
        setSelectedTags(new Set(selectedTags));
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete tag' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedTags.size === 0) return;
    if (!confirm(`Delete ${selectedTags.size} tags? This will remove them from all bookmarks.`)) return;
    setIsProcessing(true);
    try {
      for (const tag of selectedTags) {
        await fetch('/api/bookmarks/tags', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag })
        });
      }
      setMessage({ type: 'success', text: `Deleted ${selectedTags.size} tags` });
      // Refresh tags
      const tagsRes = await fetch('/api/bookmarks/tags');
      const tagsData = await tagsRes.json();
      setTags(tagsData.tags || []);
      setSelectedTags(new Set());
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete some tags' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-3xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/bookmarks/library" className="text-gray-400 hover:text-gray-600">
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tag Management</h1>
            <p className="text-gray-500">{tags.length} tags across your bookmarks</p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bulk Actions */}
        {selectedTags.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="font-medium text-blue-700">
              {selectedTags.size} tag{selectedTags.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (selectedTags.size >= 2) {
                    setMergeTargetTag(Array.from(selectedTags)[0]);
                    setShowMergeModal(true);
                  }
                }}
                disabled={selectedTags.size < 2}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 disabled:opacity-50"
              >
                Merge Tags
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                Delete All
              </button>
              <button
                onClick={() => setSelectedTags(new Set())}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Tags Grid */}
        {filteredTags.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No tags match your search.' : 'No tags yet.'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTags.map(({ tag, count }) => (
              <div
                key={tag}
                className={`bg-white rounded-lg border p-4 ${
                  selectedTags.has(tag) ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedTags.has(tag)}
                    onChange={() => toggleTag(tag)}
                    className="mt-1 w-4 h-4 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">#{tag}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                        {count}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setRenameTag(tag);
                          setNewTagName(tag);
                          setShowRenameModal(true);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(tag)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Rename Tag</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Current Name</label>
                <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700">#{renameTag}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">New Name</label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter new tag name"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRenameModal(false);
                    setRenameTag('');
                    setNewTagName('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  disabled={isProcessing || !newTagName.trim() || newTagName.trim() === renameTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Renaming...' : 'Rename'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Merge Tags</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Tags to merge:</label>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedTags).map(tag => (
                    <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Merge into:</label>
                <select
                  value={mergeTargetTag}
                  onChange={(e) => setMergeTargetTag(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {Array.from(selectedTags).map(tag => (
                    <option key={tag} value={tag}>#{tag}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  All selected tags will be replaced with the target tag.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowMergeModal(false);
                    setMergeTargetTag('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMerge}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Merging...' : 'Merge Tags'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
