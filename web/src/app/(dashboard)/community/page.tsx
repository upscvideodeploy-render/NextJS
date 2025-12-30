'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Forum {
  id: string;
  name: string;
  description: string;
  category: string;
  thread_count: number;
  post_count: number;
}

interface Thread {
  id: string;
  title: string;
  content: string;
  tags: string[];
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  reply_count: number;
  user_name: string;
  last_activity_at: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
}

interface Post {
  id: string;
  content: string;
  user_name: string;
  user_avatar?: string;
  parent_id: string | null;
  is_accepted_answer: boolean;
  upvotes: number;
  downvotes: number;
  created_at: string;
  replies?: Post[];
}

export default function CommunityPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [forums, setForums] = useState<Forum[]>([]);
  const [selectedForum, setSelectedForum] = useState<Forum | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'forums' | 'threads' | 'thread'>('forums');
  const [newThread, setNewThread] = useState({ title: '', content: '', tags: '' });
  const [newReply, setNewReply] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [totalThreads, setTotalThreads] = useState(0);

  const fetchForums = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('community_pipe', {
        body: { action: 'list_forums' },
      });

      if (data?.success) {
        setForums(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching forums:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchForums();
  }, [fetchForums]);

  const fetchThreads = useCallback(async (forum: Forum) => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('community_pipe', {
        body: {
          action: 'list_threads',
          forum_id: forum.id,
          limit: 20,
          offset: page * 20,
        },
      });

      if (data?.success) {
        setThreads(data.data?.threads || []);
        setTotalThreads(data.data?.total_count || 0);
      }
    } catch (err) {
      console.error('Error fetching threads:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, page]);

  const fetchThread = useCallback(async (threadId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('community_pipe', {
        body: { action: 'get_thread', thread_id: threadId },
      });

      if (data?.success) {
        setSelectedThread(data.data);
        setPosts(data.data.posts || []);
      }
    } catch (err) {
      console.error('Error fetching thread:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleSelectForum = (forum: Forum) => {
    setSelectedForum(forum);
    setViewMode('threads');
    setPage(0);
    fetchThreads(forum);
  };

  const handleSelectThread = (thread: Thread) => {
    setSelectedThread(thread);
    setViewMode('thread');
    fetchThread(thread.id);
  };

  const handleCreateThread = async () => {
    if (!newThread.title.trim() || !newThread.content.trim() || !selectedForum) return;

    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke('community_pipe', {
        body: {
          action: 'create_thread',
          forum_id: selectedForum.id,
          thread: {
            title: newThread.title,
            content: newThread.content,
            tags: newThread.tags.split(',').map((t) => t.trim()).filter(Boolean),
          },
        },
      });

      if (data?.success) {
        setNewThread({ title: '', content: '', tags: '' });
        fetchThreads(selectedForum);
      }
    } catch (err) {
      console.error('Error creating thread:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (content: string, parentId?: string) => {
    if (!content.trim() || !selectedThread) return;

    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke('community_pipe', {
        body: {
          action: 'create_post',
          thread_id: selectedThread.id,
          post: { content },
          parent_id: parentId,
        },
      });

      if (data?.success) {
        setNewReply('');
        setReplyingTo(null);
        fetchThread(selectedThread.id);
      }
    } catch (err) {
      console.error('Error creating reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (postId: string, direction: 'up' | 'down') => {
    try {
      await supabase.functions.invoke('community_pipe', {
        body: {
          action: 'vote',
          post_id: postId,
          vote: { direction },
        },
      });

      if (selectedThread) {
        fetchThread(selectedThread.id);
      }
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: 'bg-gray-500/20 text-gray-400',
      gs1: 'bg-red-500/20 text-red-400',
      gs2: 'bg-blue-500/20 text-blue-400',
      gs3: 'bg-green-500/20 text-green-400',
      gs4: 'bg-yellow-500/20 text-yellow-400',
      optional: 'bg-purple-500/20 text-purple-400',
      essay: 'bg-pink-500/20 text-pink-400',
      current_affairs: 'bg-orange-500/20 text-orange-400',
    };
    return colors[category] || colors.general;
  };

  if (viewMode === 'forums') {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Community Discussions</h1>
            <p className="text-gray-400">Connect with fellow UPSC aspirants</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forums.map((forum) => (
                <div
                  key={forum.id}
                  onClick={() => handleSelectForum(forum)}
                  className="neon-glass rounded-xl p-6 cursor-pointer hover:border-neon-blue/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(forum.category)}`}>
                        {forum.category.replace('gs', 'GS ').toUpperCase()}
                      </span>
                      <h3 className="text-xl font-bold text-white mt-2">{forum.name}</h3>
                    </div>
                    <div className="text-right text-gray-400 text-sm">
                      <div>{forum.thread_count} threads</div>
                      <div>{forum.post_count} posts</div>
                    </div>
                  </div>
                  <p className="text-gray-400">{forum.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'threads' && selectedForum) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              setViewMode('forums');
              setSelectedForum(null);
            }}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back to Forums
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">{selectedForum.name}</h1>
              <p className="text-gray-400">{selectedForum.description}</p>
            </div>
            <button
              onClick={() => {
                const modal = document.getElementById('new-thread-modal');
                if (modal) modal.classList.remove('hidden');
              }}
              className="px-4 py-2 bg-neon-blue text-white rounded-xl text-sm font-medium hover:bg-neon-blue/80"
            >
              New Thread
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => handleSelectThread(thread)}
                    className="neon-glass rounded-xl p-4 cursor-pointer hover:border-neon-blue/50 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <button className="hover:text-neon-blue">▲</button>
                        <span className="text-white font-medium">{thread.upvotes - thread.downvotes}</span>
                        <button className="hover:text-red-400">▼</button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {thread.is_pinned && (
                            <span className="px-2 py-0.5 bg-neon-blue/20 text-neon-blue text-xs rounded">
                              📌 Pinned
                            </span>
                          )}
                          {thread.is_locked && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                              🔒 Locked
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-medium text-white mb-1">{thread.title}</h3>
                        <p className="text-gray-400 text-sm line-clamp-2 mb-2">{thread.content}</p>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>by {thread.user_name}</span>
                          <span>{formatDate(thread.created_at)}</span>
                          <span>💬 {thread.reply_count} replies</span>
                          <span>👁️ {thread.view_count} views</span>
                        </div>

                        {thread.tags && thread.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {thread.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="px-2 py-0.5 bg-slate-800 text-gray-400 text-xs rounded">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalThreads > 20 && (
                <div className="flex justify-center gap-2 mt-6">
                  <button
                    onClick={() => {
                      setPage((p) => Math.max(0, p - 1));
                      fetchThreads(selectedForum);
                    }}
                    disabled={page === 0}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-400">
                    Page {page + 1} of {Math.ceil(totalThreads / 20)}
                  </span>
                  <button
                    onClick={() => {
                      setPage((p) => p + 1);
                      fetchThreads(selectedForum);
                    }}
                    disabled={(page + 1) * 20 >= totalThreads}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          <div id="new-thread-modal" className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 hidden">
            <div className="max-w-2xl w-full neon-glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Create New Thread</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    value={newThread.title}
                    onChange={(e) => setNewThread((t) => ({ ...t, title: e.target.value }))}
                    placeholder="What's your question or topic?"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Content</label>
                  <textarea
                    value={newThread.content}
                    onChange={(e) => setNewThread((t) => ({ ...t, content: e.target.value }))}
                    placeholder="Provide details..."
                    rows={6}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={newThread.tags}
                    onChange={(e) => setNewThread((t) => ({ ...t, tags: e.target.value }))}
                    placeholder="e.g., polity, mains, essay"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      const modal = document.getElementById('new-thread-modal');
                      if (modal) modal.classList.add('hidden');
                    }}
                    className="flex-1 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateThread}
                    disabled={submitting || !newThread.title.trim() || !newThread.content.trim()}
                    className="flex-1 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Thread'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'thread' && selectedThread) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => {
              setViewMode('threads');
              setSelectedThread(null);
              setPosts([]);
            }}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back to {selectedForum?.name}
          </button>

          <div className="neon-glass rounded-xl p-6 mb-6">
            <h1 className="text-2xl font-bold text-white mb-4">{selectedThread.title}</h1>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-neon-blue/20 flex items-center justify-center text-neon-blue font-medium">
                {selectedThread.user_name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-300">{selectedThread.user_name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">{formatDate(selectedThread.created_at)}</span>
            </div>

            <p className="text-gray-300 whitespace-pre-wrap">{selectedThread.content}</p>

            {selectedThread.tags && selectedThread.tags.length > 0 && (
              <div className="flex gap-2 mt-4">
                {selectedThread.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-slate-800 text-gray-400 text-sm rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <h2 className="text-white font-medium">{posts.length} Answers</h2>

            {posts.map((post) => (
              <PostItem
                key={post.id}
                post={post}
                onReply={() => setReplyingTo(post.id)}
                onVote={(dir) => handleVote(post.id, dir)}
                replyingTo={replyingTo}
                onSubmitReply={(content) => handleReply(content, post.id)}
                onCancelReply={() => setReplyingTo(null)}
                submitting={submitting}
              />
            ))}
          </div>

          {replyingTo === null && (
            <div className="neon-glass rounded-xl p-4">
              <textarea
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                placeholder="Write your reply..."
                rows={4}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => handleReply(newReply)}
                  disabled={submitting || !newReply.trim()}
                  className="px-6 py-2 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 disabled:opacity-50"
                >
                  {submitting ? 'Posting...' : 'Post Reply'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function PostItem({
  post,
  onReply,
  onVote,
  replyingTo,
  onSubmitReply,
  onCancelReply,
  submitting,
}: {
  post: Post;
  onReply: () => void;
  onVote: (dir: 'up' | 'down') => void;
  replyingTo: string | null;
  onSubmitReply: (content: string) => void;
  onCancelReply: () => void;
  submitting: boolean;
}) {
  const [replyContent, setReplyContent] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const handleSubmit = () => {
    onSubmitReply(replyContent);
    setReplyContent('');
  };

  return (
    <div className={`neon-glass rounded-xl p-4 ${collapsed ? 'opacity-50' : ''}`}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <button onClick={() => onVote('up')} className="text-gray-400 hover:text-neon-blue">▲</button>
          <span className="text-white font-medium">{post.upvotes - post.downvotes}</span>
          <button onClick={() => onVote('down')} className="text-gray-400 hover:text-red-400">▼</button>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-gray-300 text-xs font-medium">
              {post.user_name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-gray-300 text-sm">{post.user_name}</span>
            <span className="text-gray-500 text-xs">{new Date(post.created_at).toLocaleDateString()}</span>
            {post.is_accepted_answer && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">✓ Accepted</span>
            )}
          </div>

          {!collapsed && (
            <>
              <p className="text-gray-300 whitespace-pre-wrap mb-3">{post.content}</p>

              <div className="flex items-center gap-4">
                <button onClick={onReply} className="text-gray-400 hover:text-white text-sm">Reply</button>
                <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white text-sm">
                  {collapsed ? 'Expand' : 'Collapse'}
                </button>
              </div>
            </>
          )}

          {!collapsed && post.replies && post.replies.length > 0 && (
            <div className="mt-4 space-y-3 pl-4 border-l-2 border-slate-700">
              {post.replies.map((reply) => (
                <PostItem
                  key={reply.id}
                  post={reply}
                  onReply={() => {}}
                  onVote={() => {}}
                  replyingTo={replyingTo}
                  onSubmitReply={() => {}}
                  onCancelReply={() => {}}
                  submitting={false}
                />
              ))}
            </div>
          )}

          {replyingTo === post.id && (
            <div className="mt-4">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write your reply..."
                rows={3}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={onCancelReply} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting || !replyContent.trim()} className="px-4 py-2 bg-neon-blue text-white rounded-lg text-sm hover:bg-neon-blue/80 disabled:opacity-50">Reply</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
