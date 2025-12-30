'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface TopicShort {
  id: string;
  syllabus_node_id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  script_text: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  credits_used: number;
  created_at: string;
}

const STATUS_CONFIG = {
  pending: {
    icon: '⏳',
    color: 'gray',
    title: 'Queued',
    description: 'Your video is waiting to be generated',
  },
  processing: {
    icon: '⚙️',
    color: 'yellow',
    title: 'Generating',
    description: 'Your video is being created',
  },
  completed: {
    icon: '✅',
    color: 'green',
    title: 'Ready',
    description: 'Your video is ready to watch',
  },
  failed: {
    icon: '❌',
    color: 'red',
    title: 'Failed',
    description: 'Something went wrong',
  },
};

export default function TopicShortStatusPage() {
  const params = useParams();
  const router = useRouter();
  const shortId = params.shortId as string;
  const [topicShort, setTopicShort] = useState<TopicShort | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const supabase = getSupabaseBrowserClient(
  );

  const loadTopicShort = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('topic_shorts')
        .select('*')
        .eq('id', shortId)
        .single();

      if (error) {
        setError('Topic short not found');
        setIsPolling(false);
        return;
      }

      const topicShortData = data as TopicShort;
      setTopicShort(topicShortData);

      // Stop polling on terminal states
      if (['completed', 'failed'].includes(topicShortData.status)) {
        setIsPolling(false);
      }
    } catch (err) {
      setError('Failed to load topic short');
      setIsPolling(false);
    } finally {
      setLoading(false);
    }
  }, [shortId, supabase]);

  useEffect(() => {
    loadTopicShort();

    if (isPolling) {
      const interval = setInterval(loadTopicShort, 2000);
      return () => clearInterval(interval);
    }
  }, [loadTopicShort, isPolling]);

  const handleDownload = async () => {
    if (!topicShort?.video_url) return;

    try {
      const response = await fetch(topicShort.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `topic-short-${shortId.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !topicShort) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="neon-glass p-8 rounded-2xl text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-2">Not Found</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary w-full">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[topicShort.status as keyof typeof STATUS_CONFIG];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white">60-Second Topic Short</h1>
        </div>

        {/* Status Card */}
        <div className="neon-glass rounded-2xl p-8 mb-6">
          {/* Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Status</h3>
              <span
                className={`px-4 py-2 rounded-full text-sm font-medium bg-${statusConfig.color}-500/20 text-${statusConfig.color}-400 border border-${statusConfig.color}-500/30`}
              >
                {statusConfig.icon} {statusConfig.title}
              </span>
            </div>

            {/* Pending/Processing State */}
            {(topicShort.status === 'pending' || topicShort.status === 'processing') && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center text-2xl animate-spin">
                    {statusConfig.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium">{statusConfig.description}</p>
                    <p className="text-gray-400 text-sm">
                      {topicShort.status === 'pending'
                        ? 'Waiting in queue...'
                        : 'Generating script and video...'}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div
                    className="h-full bg-yellow-500 rounded-full animate-pulse"
                    style={{ width: topicShort.status === 'pending' ? '20%' : '60%' }}
                  />
                </div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed State */}
            {topicShort.status === 'completed' && topicShort.video_url && (
              <div className="space-y-6">
                {/* Video Player */}
                <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden">
                  <video
                    src={topicShort.video_url}
                    controls
                    poster={topicShort.thumbnail_url || undefined}
                    className="w-full h-full"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                {/* Script Preview */}
                {topicShort.script_text && (
                  <div className="p-4 bg-slate-800/30 rounded-xl">
                    <h4 className="text-white font-medium mb-2">Script Preview</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">{topicShort.script_text}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white hover:bg-slate-700/50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 transition-colors"
                  >
                    More Topics
                  </button>
                </div>

                {/* Cache Info */}
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Video cached for 7 days - reuse anytime for free
                </div>
              </div>
            )}

            {/* Failed State */}
            {topicShort.status === 'failed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-2xl">
                    {statusConfig.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium">{statusConfig.description}</p>
                    <p className="text-gray-400 text-sm">Please try again in a few moments.</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 transition-colors"
                >
                  Try Another Topic
                </button>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="border-t border-white/10 pt-6 mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400 block mb-1">Created</span>
              <p className="text-white">{new Date(topicShort.created_at).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Credits Used</span>
              <p className="text-white">{topicShort.credits_used}</p>
            </div>
            {topicShort.status === 'completed' && (
              <div>
                <span className="text-gray-400 block mb-1">Cached Until</span>
                <p className="text-white">
                  {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
