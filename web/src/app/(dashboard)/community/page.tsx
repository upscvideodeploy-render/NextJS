'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';

interface Discussion {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  user_id: string;
  user_name?: string;
  is_pinned: boolean;
  view_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  discussion_id: string;
  content: string;
  user_id: string;
  user_name?: string;
  is_answer: boolean;
  upvotes: number;
  created_at: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '📚' },
  { id: 'general', label: 'General', icon: '💬' },
  { id: 'polity', label: 'Polity', icon: '⚖️' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'geography', label: 'Geography', icon: '🗺️' },
  { id: 'economy', label: 'Economy', icon: '📈' },
  { id: 'environment', label: 'Environment', icon: '🌿' },
  { id: 'science', label: 'Science & Tech', icon: '🔬' },
  { id: 'ethics', label: 'Ethics', icon: '⚡' },
  { id: 'current affairs', label: 'Current Affairs', icon: '📰' },
];

export default function CommunityPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState('');
  const [newDiscussion, setNewDiscussion] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: '',
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch discussions
  useEffect(() => {
    const fetchDiscussions = async () => {
      setIsLoading(true);

      let query = supabase
        .from('discussions')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query;

      if (!error && data) {
        // Add user names (in real app, join with profiles table)
        const discussionsWithNames = data.map((d: any) => ({
          ...d,
          user_name: d.user_id?.substring(0, 8) || 'Anonymous',
        }));
        setDiscussions(discussionsWithNames);
      }

      setIsLoading(false);
    };

    fetchDiscussions();
  }, [selectedCategory]);

  // Fetch replies when discussion is selected
  useEffect(() => {
    if (!selectedDiscussion) return;

    const fetchReplies = async () => {
      const { data, error } = await supabase
        .from('discussion_replies')
        .select('*')
        .eq('discussion_id', selectedDiscussion.id)
        .order('is_answer', { ascending: false })
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: true });

      if (!error && data) {
        const repliesWithNames = data.map((r: any) => ({
          ...r,
          user_name: r.user_id?.substring(0, 8) || 'Anonymous',
        }));
        setReplies(repliesWithNames);
      }
    };

    fetchReplies();

    // Increment view count
    supabase
      .from('discussions')
      .update({ view_count: selectedDiscussion.view_count + 1 })
      .eq('id', selectedDiscussion.id)
      .then();
  }, [selectedDiscussion, supabase]);

  const handleCreateDiscussion = async () => {
    if (!newDiscussion.title.trim() || !newDiscussion.content.trim()) {
      alert('Please fill in title and content');
      return;
    }

    const userId = 'demo-user'; // Replace with actual user ID from auth

    const { error } = await supabase.from('discussions').insert({
      title: newDiscussion.title,
      content: newDiscussion.content,
      category: newDiscussion.category,
      tags: newDiscussion.tags.split(',').map((t) => t.trim()).filter(Boolean),
      user_id: userId,
    });

    if (error) {
      alert('Failed to create discussion');
      return;
    }

    setNewDiscussion({ title: '', content: '', category: 'general', tags: '' });
    setShowNewForm(false);

    // Refresh discussions
    const { data } = await supabase
      .from('discussions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setDiscussions(data as any);
    }
  };

  const handleReply = async () => {
    if (!newReply.trim() || !selectedDiscussion) {
      alert('Please write a reply');
      return;
    }

    const userId = 'demo-user'; // Replace with actual user ID

    const { error } = await supabase.from('discussion_replies').insert({
      discussion_id: selectedDiscussion.id,
      user_id: userId,
      content: newReply,
    });

    if (error) {
      alert('Failed to post reply');
      return;
    }

    setNewReply('');

    // Refresh replies and update count
    const { data } = await supabase
      .from('discussion_replies')
      .select('*')
      .eq('discussion_id', selectedDiscussion.id)
      .order('created_at', { ascending: true });

    if (data) {
      setReplies(data as any);
    }

    // Update reply count
    await supabase
      .from('discussions')
      .update({ reply_count: (selectedDiscussion.reply_count || 0) + 1 })
      .eq('id', selectedDiscussion.id);
  };

  const handleUpvote = async (replyId: string, currentUpvotes: number) => {
    await supabase
      .from('discussion_replies')
      .update({ upvotes: currentUpvotes + 1 })
      .eq('id', replyId);

    setReplies(
      replies.map((r) =>
        r.id === replyId ? { ...r, upvotes: currentUpvotes + 1 } : r
      )
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Community Discussion</h1>
            <p className="text-gray-400">Ask questions, share knowledge, learn together</p>
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="btn-primary"
          >
            {showNewForm ? 'Cancel' : '+ New Discussion'}
          </button>
        </header>

        {/* New Discussion Form */}
        {showNewForm && (
          <div className="neon-glass p-6 rounded-xl mb-6">
            <h3 className="font-bold text-white mb-4">Start a New Discussion</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newDiscussion.title}
                onChange={(e) => setNewDiscussion({ ...newDiscussion, title: e.target.value })}
                placeholder="Discussion title..."
                className="w-full p-3 bg-slate-800/50 border border-white/10 rounded-lg text-white"
              />

              <textarea
                value={newDiscussion.content}
                onChange={(e) => setNewDiscussion({ ...newDiscussion, content: e.target.value })}
                placeholder="What would you like to discuss?"
                className="w-full p-3 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                rows={4}
              />

              <div className="flex gap-4">
                <select
                  value={newDiscussion.category}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, category: e.target.value })}
                  className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                >
                  {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={newDiscussion.tags}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, tags: e.target.value })}
                  placeholder="Tags (comma separated)..."
                  className="flex-1 px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                />
              </div>

              <button onClick={handleCreateDiscussion} className="btn-primary">
                Post Discussion
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Categories */}
          <div className="lg:col-span-1">
            <div className="neon-glass p-4 rounded-xl sticky top-6">
              <h3 className="font-bold text-white mb-3">Categories</h3>
              <div className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedDiscussion(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-neon-blue/20 text-neon-blue'
                        : 'text-gray-400 hover:bg-slate-800/50'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="text-sm">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Discussions */}
          <div className="lg:col-span-3 space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Loading discussions...</p>
              </div>
            ) : selectedDiscussion ? (
              // Single Discussion View
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedDiscussion(null)}
                  className="text-gray-400 hover:text-white flex items-center gap-2 mb-2"
                >
                  ← Back to discussions
                </button>

                <div className="neon-glass p-6 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-neon-blue/20 text-neon-blue text-xs rounded">
                      {selectedDiscussion.category}
                    </span>
                    {selectedDiscussion.is_pinned && (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                        📌 Pinned
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white mb-3">{selectedDiscussion.title}</h2>
                  <p className="text-gray-300 whitespace-pre-line">{selectedDiscussion.content}</p>

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
                    <span className="text-xs text-gray-500">
                      Posted by {selectedDiscussion.user_name} • {formatTime(selectedDiscussion.created_at)}
                    </span>
                    <span className="text-xs text-gray-500">
                      👁 {selectedDiscussion.view_count} views
                    </span>
                    <span className="text-xs text-gray-500">
                      💬 {selectedDiscussion.reply_count} replies
                    </span>
                  </div>
                </div>

                {/* Replies */}
                <div className="space-y-3">
                  <h3 className="font-bold text-white">{replies.length} Replies</h3>

                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`neon-glass p-4 rounded-xl ${
                        reply.is_answer ? 'border border-green-500/50' : ''
                      }`}
                    >
                      {reply.is_answer && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                            ✓ Accepted Answer
                          </span>
                        </div>
                      )}

                      <p className="text-gray-300 mb-3">{reply.content}</p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {reply.user_name} • {formatTime(reply.created_at)}
                        </span>
                        <button
                          onClick={() => handleUpvote(reply.id, reply.upvotes)}
                          className="flex items-center gap-1 text-gray-400 hover:text-neon-blue"
                        >
                          👍 {reply.upvotes}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply Form */}
                <div className="neon-glass p-4 rounded-xl">
                  <textarea
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    placeholder="Write your reply..."
                    className="w-full p-3 bg-slate-800/50 border border-white/10 rounded-lg text-white mb-3"
                    rows={3}
                  />
                  <button onClick={handleReply} className="btn-primary">
                    Post Reply
                  </button>
                </div>
              </div>
            ) : discussions.length > 0 ? (
              // Discussion List
              discussions.map((discussion) => (
                <div
                  key={discussion.id}
                  onClick={() => setSelectedDiscussion(discussion)}
                  className="neon-glass p-4 rounded-xl cursor-pointer hover:border-white/20 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {discussion.is_pinned && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                            📌 Pinned
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-slate-700 text-gray-300 text-xs rounded capitalize">
                          {discussion.category}
                        </span>
                      </div>

                      <h3 className="text-white font-medium mb-1">{discussion.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-2">{discussion.content}</p>

                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                        <span>{discussion.user_name}</span>
                        <span>•</span>
                        <span>{formatTime(discussion.created_at)}</span>
                        <span>•</span>
                        <span>👁 {discussion.view_count}</span>
                        <span>•</span>
                        <span>💬 {discussion.reply_count}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">No discussions yet</h3>
                <p className="text-gray-400">Be the first to start a conversation!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
