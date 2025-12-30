'use client';

// Social Media Auto-Publisher - Admin Dashboard
// Story 16.2: All 10 ACs implemented
// AC 1: Platform support (YouTube, Instagram, Facebook, Twitter/X, Telegram)
// AC 2: Content types (Daily CA, Topic Shorts, Weekly Documentary)
// AC 3: Auto-publishing scheduler
// AC 4: Platform formatting
// AC 5: OAuth integration
// AC 6: Draft mode
// AC 7: Analytics
// AC 8: Scheduling
// AC 9: Team collaboration
// AC 10: Compliance/disclaimers

import React, { useState, useEffect } from 'react';

interface Platform {
  id: string;
  name: string;
  slug: string;
  icon: string;
  formatting_rules: Record<string, unknown>;
  optimal_posting_hours: number[];
}

interface ConnectedAccount {
  id: string;
  platform_id: string;
  account_name: string;
  account_handle: string;
  status: string;
  platform?: Platform;
}

interface ContentType {
  id: string;
  name: string;
  slug: string;
  description: string;
  target_platforms: string[];
  auto_schedule: boolean;
}

interface Post {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  media_urls: string[];
  status: string;
  scheduled_at: string;
  published_at: string;
  platform_url: string;
  platform?: Platform;
  account?: ConnectedAccount;
  content_type?: ContentType;
  analytics?: PostAnalytics[];
  disclaimer?: string;
}

interface PostAnalytics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  can_publish: boolean;
  can_schedule: boolean;
  can_connect_accounts: boolean;
  can_manage_team: boolean;
}

interface Dashboard {
  pending_drafts: Post[];
  scheduled: Post[];
  recent_published: Post[];
  analytics_summary: {
    total_posts: number;
    total_views: number;
    total_engagement: number;
    avg_engagement_rate: number;
  };
  connected_accounts: ConnectedAccount[];
}

// Platform icons
const PLATFORM_ICONS: Record<string, string> = {
  youtube: '📺',
  instagram: '📷',
  facebook: '📘',
  twitter: '🐦',
  telegram: '✈️'
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  publishing: 'bg-purple-100 text-purple-800',
  published: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
};

export default function SocialPublisherPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'posts' | 'schedule' | 'analytics' | 'accounts' | 'team'>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  
  // Modals
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showConnectAccount, setShowConnectAccount] = useState(false);
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  // Form state
  const [newPost, setNewPost] = useState({
    title: '',
    caption: '',
    content_type_slug: 'daily_ca',
    platform_id: '',
    scheduled_at: '',
    media_urls: [''],
    as_draft: false
  });
  
  const [newTeamMember, setNewTeamMember] = useState({
    email: '',
    role: 'editor',
    can_publish: false,
    can_schedule: true,
    can_connect: false,
    can_manage: false
  });

  useEffect(() => {
    loadDashboard();
    loadPlatforms();
    loadContentTypes();
  }, []);

  useEffect(() => {
    if (activeTab === 'posts') loadPosts();
    if (activeTab === 'accounts') loadAccounts();
    if (activeTab === 'team') loadTeam();
  }, [activeTab, statusFilter, platformFilter]);

  async function loadDashboard() {
    try {
      const res = await fetch('/api/social?action=dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      const data = await res.json();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function loadPlatforms() {
    const res = await fetch('/api/social?action=platforms');
    if (res.ok) {
      const data = await res.json();
      setPlatforms(data.platforms || []);
    }
  }

  async function loadContentTypes() {
    const res = await fetch('/api/social?action=content-types');
    if (res.ok) {
      const data = await res.json();
      setContentTypes(data.content_types || []);
    }
  }

  async function loadPosts() {
    const params = new URLSearchParams({ action: 'posts' });
    if (statusFilter) params.set('status', statusFilter);
    if (platformFilter) params.set('platform', platformFilter);
    
    const res = await fetch(`/api/social?${params}`);
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts || []);
    }
  }

  async function loadAccounts() {
    const res = await fetch('/api/social?action=accounts');
    if (res.ok) {
      const data = await res.json();
      setAccounts(data.accounts || []);
    }
  }

  async function loadTeam() {
    const res = await fetch('/api/social?action=team');
    if (res.ok) {
      const data = await res.json();
      setTeamMembers(data.team || []);
    }
  }

  async function createPost() {
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-post',
          ...newPost,
          media_urls: newPost.media_urls.filter(u => u)
        })
      });
      
      if (!res.ok) throw new Error('Failed to create post');
      
      setShowCreatePost(false);
      setNewPost({
        title: '',
        caption: '',
        content_type_slug: 'daily_ca',
        platform_id: '',
        scheduled_at: '',
        media_urls: [''],
        as_draft: false
      });
      loadDashboard();
      loadPosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create post');
    }
  }

  async function approvePost(postId: string) {
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', post_id: postId })
    });
    
    if (res.ok) {
      loadDashboard();
      loadPosts();
    }
  }

  async function publishNow(postId: string) {
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish-now', post_id: postId })
    });
    
    if (res.ok) {
      const data = await res.json();
      alert(`Published! URL: ${data.platform_url}`);
      loadDashboard();
      loadPosts();
    }
  }

  async function cancelPost(postId: string) {
    if (!confirm('Cancel this post?')) return;
    
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', post_id: postId })
    });
    
    if (res.ok) {
      loadDashboard();
      loadPosts();
    }
  }

  async function connectPlatform(platform: string) {
    const res = await fetch(`/api/social?action=oauth-url&platform=${platform}`);
    if (res.ok) {
      const data = await res.json();
      if (data.type === 'bot_token') {
        const token = prompt('Enter your Telegram Bot Token:');
        if (token) {
          await fetch('/api/social', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'connect-account',
              platform: 'telegram',
              code: token
            })
          });
          loadAccounts();
        }
      } else {
        window.open(data.auth_url, '_blank');
      }
    }
  }

  async function disconnectAccount(accountId: string) {
    if (!confirm('Disconnect this account?')) return;
    
    await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect-account', account_id: accountId })
    });
    loadAccounts();
  }

  async function addTeamMember() {
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add-team-member',
        email: newTeamMember.email,
        role: newTeamMember.role,
        permissions: {
          can_publish: newTeamMember.can_publish,
          can_schedule: newTeamMember.can_schedule,
          can_connect: newTeamMember.can_connect,
          can_manage: newTeamMember.can_manage
        }
      })
    });
    
    if (res.ok) {
      setShowAddTeamMember(false);
      loadTeam();
    }
  }

  async function removeTeamMember(memberId: string) {
    if (!confirm('Remove this team member?')) return;
    
    await fetch('/api/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove-team-member', member_id: memberId })
    });
    loadTeam();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={loadDashboard} className="px-4 py-2 bg-blue-600 text-white rounded">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Social Media Publisher</h1>
              <p className="text-gray-600">Manage your social media presence</p>
            </div>
            <button
              onClick={() => setShowCreatePost(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <span>+</span> Create Post
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b -mb-px">
            {['dashboard', 'posts', 'schedule', 'analytics', 'accounts', 'team'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`px-4 py-2 font-medium capitalize ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Total Posts</p>
                <p className="text-3xl font-bold">{dashboard.analytics_summary.total_posts}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Total Views</p>
                <p className="text-3xl font-bold">{dashboard.analytics_summary.total_views.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Total Engagement</p>
                <p className="text-3xl font-bold">{dashboard.analytics_summary.total_engagement.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Avg. Engagement Rate</p>
                <p className="text-3xl font-bold">{dashboard.analytics_summary.avg_engagement_rate.toFixed(2)}%</p>
              </div>
            </div>

            {/* Connected Accounts (AC 5) */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Connected Accounts</h2>
              <div className="flex gap-4 flex-wrap">
                {dashboard.connected_accounts.map(account => (
                  <div key={account.id} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                    <span>{PLATFORM_ICONS[account.platform?.slug || ''] || '🌐'}</span>
                    <span>{account.account_name}</span>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                ))}
                <button
                  onClick={() => setShowConnectAccount(true)}
                  className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600"
                >
                  + Connect Account
                </button>
              </div>
            </div>

            {/* Pending Drafts (AC 6) */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Pending Review</h2>
              {dashboard.pending_drafts.length === 0 ? (
                <p className="text-gray-500">No drafts pending review</p>
              ) : (
                <div className="space-y-3">
                  {dashboard.pending_drafts.map(post => (
                    <div key={post.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{PLATFORM_ICONS[post.platform?.slug || '']}</span>
                        <div>
                          <p className="font-medium">{post.title}</p>
                          <p className="text-sm text-gray-500">{post.content_type?.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedPost(post)}
                          className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => approvePost(post.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scheduled Posts (AC 8) */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Upcoming Scheduled</h2>
              {dashboard.scheduled.length === 0 ? (
                <p className="text-gray-500">No scheduled posts</p>
              ) : (
                <div className="space-y-3">
                  {dashboard.scheduled.slice(0, 5).map(post => (
                    <div key={post.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{PLATFORM_ICONS[post.platform?.slug || '']}</span>
                        <div>
                          <p className="font-medium">{post.title}</p>
                          <p className="text-sm text-gray-500">
                            Scheduled: {formatDate(post.scheduled_at)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => cancelPost(post.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Published */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Recently Published</h2>
              <div className="space-y-3">
                {dashboard.recent_published.map(post => (
                  <div key={post.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{PLATFORM_ICONS[post.platform?.slug || '']}</span>
                      <div>
                        <p className="font-medium">{post.title}</p>
                        <p className="text-sm text-gray-500">
                          Published: {formatDate(post.published_at)}
                        </p>
                      </div>
                    </div>
                    {post.platform_url && (
                      <a
                        href={post.platform_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div>
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex gap-4">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={platformFilter}
                onChange={e => setPlatformFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Platforms</option>
                {platforms.map(p => (
                  <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                ))}
              </select>
            </div>

            {/* Posts List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Platform</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Scheduled</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Analytics</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {posts.map(post => (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <span className="text-2xl">{PLATFORM_ICONS[post.platform?.slug || '']}</span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium">{post.title}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">{post.caption}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[post.status]}`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {post.scheduled_at ? formatDate(post.scheduled_at) : '-'}
                      </td>
                      <td className="px-4 py-4">
                        {post.analytics?.[0] ? (
                          <div className="text-sm">
                            <p>{post.analytics[0].views.toLocaleString()} views</p>
                            <p className="text-gray-500">{post.analytics[0].engagement_rate}% engagement</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {post.status === 'draft' && (
                            <button
                              onClick={() => approvePost(post.id)}
                              className="px-2 py-1 text-green-600 hover:bg-green-50 rounded text-sm"
                            >
                              Approve
                            </button>
                          )}
                          {post.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => publishNow(post.id)}
                                className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                              >
                                Publish Now
                              </button>
                              <button
                                onClick={() => cancelPost(post.id)}
                                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {post.platform_url && (
                            <a
                              href={post.platform_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedule Tab (AC 8) */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Publishing Schedule</h2>
            
            {/* Calendar-like view */}
            <div className="grid grid-cols-7 gap-2 mb-6">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: 28 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dayPosts = dashboard?.scheduled.filter(p => 
                  new Date(p.scheduled_at).toDateString() === date.toDateString()
                ) || [];
                
                return (
                  <div 
                    key={i} 
                    className={`min-h-24 border rounded-lg p-2 ${
                      date.toDateString() === new Date().toDateString() ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <p className="text-sm font-medium">{date.getDate()}</p>
                    <div className="mt-1 space-y-1">
                      {dayPosts.map(post => (
                        <div 
                          key={post.id}
                          className="text-xs p-1 bg-blue-100 rounded truncate"
                          title={post.title}
                        >
                          {PLATFORM_ICONS[post.platform?.slug || '']} {post.title.slice(0, 15)}...
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optimal Times (AC 8) */}
            <div className="border-t pt-6">
              <h3 className="font-medium mb-4">Optimal Posting Times by Platform</h3>
              <div className="grid grid-cols-5 gap-4">
                {platforms.map(p => (
                  <div key={p.id} className="text-center p-4 bg-gray-50 rounded-lg">
                    <span className="text-3xl">{p.icon}</span>
                    <p className="font-medium mt-2">{p.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Best times: {p.optimal_posting_hours?.join(', ')}:00
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab (AC 7) */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Total Views (30d)</p>
                <p className="text-3xl font-bold">{dashboard?.analytics_summary.total_views.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Total Engagement</p>
                <p className="text-3xl font-bold">{dashboard?.analytics_summary.total_engagement.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Posts Published</p>
                <p className="text-3xl font-bold">{dashboard?.analytics_summary.total_posts}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Avg. Engagement Rate</p>
                <p className="text-3xl font-bold">{dashboard?.analytics_summary.avg_engagement_rate.toFixed(2)}%</p>
              </div>
            </div>

            {/* Per-Platform Analytics */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Performance by Platform</h2>
              <div className="grid grid-cols-5 gap-4">
                {platforms.map(p => (
                  <div key={p.id} className="text-center p-4 border rounded-lg">
                    <span className="text-4xl">{p.icon}</span>
                    <p className="font-medium mt-2">{p.name}</p>
                    <div className="mt-3 text-sm text-gray-500">
                      <p>Posts: {dashboard?.recent_published.filter(post => post.platform?.id === p.id).length || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Performing Posts */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Top Performing Posts</h2>
              <div className="space-y-3">
                {dashboard?.recent_published
                  .filter(p => p.analytics?.[0])
                  .sort((a, b) => (b.analytics?.[0]?.views || 0) - (a.analytics?.[0]?.views || 0))
                  .slice(0, 5)
                  .map((post, i) => (
                    <div key={post.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-400">#{i + 1}</span>
                        <span className="text-2xl">{PLATFORM_ICONS[post.platform?.slug || '']}</span>
                        <div>
                          <p className="font-medium">{post.title}</p>
                          <p className="text-sm text-gray-500">{formatDate(post.published_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{post.analytics?.[0]?.views.toLocaleString()} views</p>
                        <p className="text-sm text-gray-500">
                          {post.analytics?.[0]?.likes} likes, {post.analytics?.[0]?.shares} shares
                        </p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* Accounts Tab (AC 5) */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Connected Accounts</h2>
              <button
                onClick={() => setShowConnectAccount(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Connect Account
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {accounts.map(account => (
                <div key={account.id} className="bg-white p-6 rounded-xl shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{PLATFORM_ICONS[account.platform?.slug || '']}</span>
                    <div>
                      <p className="font-medium">{account.account_name}</p>
                      <p className="text-sm text-gray-500">{account.account_handle}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                        account.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {account.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => disconnectAccount(account.id)}
                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>

            {accounts.length === 0 && (
              <div className="bg-white p-12 rounded-xl shadow-sm text-center">
                <p className="text-gray-500 mb-4">No accounts connected yet</p>
                <button
                  onClick={() => setShowConnectAccount(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Connect Your First Account
                </button>
              </div>
            )}
          </div>
        )}

        {/* Team Tab (AC 9) */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Team Members</h2>
              <button
                onClick={() => setShowAddTeamMember(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Member
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Member</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Permissions</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {teamMembers.map(member => (
                    <tr key={member.id}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {member.role === 'admin' ? '👑' : '👤'}
                          </div>
                          <div>
                            <p className="font-medium">{member.user_id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          member.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          member.role === 'editor' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {member.can_publish && <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">Publish</span>}
                          {member.can_schedule && <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">Schedule</span>}
                          {member.can_connect_accounts && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">Connect</span>}
                          {member.can_manage_team && <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">Manage</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => removeTeamMember(member.id)}
                          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">Create New Post</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Content Type</label>
                <select
                  value={newPost.content_type_slug}
                  onChange={e => setNewPost({...newPost, content_type_slug: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  {contentTypes.map(ct => (
                    <option key={ct.id} value={ct.slug}>{ct.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Platform</label>
                <select
                  value={newPost.platform_id}
                  onChange={e => setNewPost({...newPost, platform_id: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select Platform</option>
                  {platforms.map(p => (
                    <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={e => setNewPost({...newPost, title: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Post title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Caption</label>
                <textarea
                  value={newPost.caption}
                  onChange={e => setNewPost({...newPost, caption: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg h-32"
                  placeholder="Post caption/description"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Media URL</label>
                <input
                  type="text"
                  value={newPost.media_urls[0]}
                  onChange={e => setNewPost({...newPost, media_urls: [e.target.value]})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="https://..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Schedule For</label>
                <input
                  type="datetime-local"
                  value={newPost.scheduled_at}
                  onChange={e => setNewPost({...newPost, scheduled_at: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="asDraft"
                  checked={newPost.as_draft}
                  onChange={e => setNewPost({...newPost, as_draft: e.target.checked})}
                />
                <label htmlFor="asDraft">Save as draft (requires approval)</label>
              </div>
              
              {/* Disclaimer Preview (AC 10) */}
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Disclaimer:</strong> This content is for educational purposes only. UPSC Mastery is not affiliated with UPSC.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreatePost(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={createPost}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!newPost.title || !newPost.platform_id}
              >
                {newPost.as_draft ? 'Save Draft' : 'Schedule Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Account Modal (AC 5) */}
      {showConnectAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Connect Social Account</h2>
            
            <div className="space-y-3">
              {platforms.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => {
                    connectPlatform(platform.slug);
                    setShowConnectAccount(false);
                  }}
                  className="w-full p-4 border rounded-lg flex items-center gap-4 hover:bg-gray-50"
                >
                  <span className="text-3xl">{platform.icon}</span>
                  <div className="text-left">
                    <p className="font-medium">{platform.name}</p>
                    <p className="text-sm text-gray-500">
                      {platform.slug === 'telegram' ? 'Connect via Bot Token' : 'Connect via OAuth'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowConnectAccount(false)}
              className="w-full mt-4 px-4 py-2 border rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Team Member Modal (AC 9) */}
      {showAddTeamMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Add Team Member</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newTeamMember.email}
                  onChange={e => setNewTeamMember({...newTeamMember, email: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="team@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={newTeamMember.role}
                  onChange={e => setNewTeamMember({...newTeamMember, role: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newTeamMember.can_schedule}
                      onChange={e => setNewTeamMember({...newTeamMember, can_schedule: e.target.checked})}
                    />
                    Can schedule posts
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newTeamMember.can_publish}
                      onChange={e => setNewTeamMember({...newTeamMember, can_publish: e.target.checked})}
                    />
                    Can publish posts
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newTeamMember.can_connect}
                      onChange={e => setNewTeamMember({...newTeamMember, can_connect: e.target.checked})}
                    />
                    Can connect accounts
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newTeamMember.can_manage}
                      onChange={e => setNewTeamMember({...newTeamMember, can_manage: e.target.checked})}
                    />
                    Can manage team
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddTeamMember(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={addTeamMember}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!newTeamMember.email}
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Preview Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Post Preview</h2>
              <button onClick={() => setSelectedPost(null)} className="text-gray-500">
                &times;
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{PLATFORM_ICONS[selectedPost.platform?.slug || '']}</span>
                <div>
                  <p className="font-medium">{selectedPost.platform?.name}</p>
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[selectedPost.status]}`}>
                    {selectedPost.status}
                  </span>
                </div>
              </div>
              
              <div>
                <h3 className="font-bold text-lg">{selectedPost.title}</h3>
                <p className="text-gray-600 mt-2 whitespace-pre-wrap">{selectedPost.caption}</p>
              </div>
              
              {selectedPost.hashtags?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedPost.hashtags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              {selectedPost.disclaimer && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">{selectedPost.disclaimer}</p>
                </div>
              )}
              
              {selectedPost.scheduled_at && (
                <p className="text-sm text-gray-500">
                  Scheduled for: {formatDate(selectedPost.scheduled_at)}
                </p>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedPost(null)}
                className="px-4 py-2 border rounded-lg"
              >
                Close
              </button>
              {selectedPost.status === 'draft' && (
                <button
                  onClick={() => {
                    approvePost(selectedPost.id);
                    setSelectedPost(null);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve & Schedule
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
