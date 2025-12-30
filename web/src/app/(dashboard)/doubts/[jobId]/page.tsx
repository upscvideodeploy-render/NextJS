'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Job {
  id: string;
  job_type: string;
  priority: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payload: {
    question: string;
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    style?: string;
    render_job_id?: string;
  };
  queue_position: number | null;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const STATUS_CONFIG = {
  queued: {
    icon: '📋',
    color: 'blue',
    title: 'In Queue',
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
  cancelled: {
    icon: '⚫',
    color: 'gray',
    title: 'Cancelled',
    description: 'This job was cancelled',
  },
};

export default function DoubtStatusPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const supabase = getSupabaseBrowserClient(
  );

  const loadJob = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        setError('Job not found');
        setIsPolling(false);
        return;
      }

      setJob(data as Job);

      // Stop polling on terminal states
      if (['completed', 'failed', 'cancelled'].includes((data as any).status)) {
        setIsPolling(false);
      }
    } catch (err) {
      setError('Failed to load job status');
      setIsPolling(false);
    } finally {
      setLoading(false);
    }
  }, [jobId, supabase]);

  useEffect(() => {
    loadJob();

    // Polling interval decreases as we get closer to completion
    if (isPolling) {
      const interval = setInterval(loadJob, 3000);
      return () => clearInterval(interval);
    }
  }, [loadJob, isPolling]);

  const handleDownload = async () => {
    if (!job?.payload.video_url) return;

    try {
      const response = await fetch(job.payload.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `upsc-prepx-doubt-${jobId.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'UPSC PrepX-AI Video Explanation',
      text: `Check out this video explanation: ${job?.payload.question}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
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

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="neon-glass p-8 rounded-2xl text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-white mb-2">Job Not Found</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => router.push('/dashboard/ask-doubt')} className="btn-primary w-full">
            Submit Another Doubt
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/ask-doubt')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Ask Doubt
          </button>
          <h1 className="text-3xl font-bold text-white">Video Generation</h1>
        </div>

        {/* Status Card */}
        <div className="neon-glass rounded-2xl p-8 mb-6">
          {/* Question */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Your Question:</h3>
            <p className="text-lg text-white leading-relaxed">{job.payload.question}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="px-3 py-1 bg-slate-800/50 rounded-full text-xs text-gray-400 capitalize">
                {job.payload.style || 'detailed'} style
              </span>
              <span className="px-3 py-1 bg-slate-800/50 rounded-full text-xs text-gray-400">
                {job.payload.duration || 60}s video
              </span>
            </div>
          </div>

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

            {/* Status-specific content */}
            {job.status === 'queued' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-2xl">
                    {statusConfig.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium">{statusConfig.description}</p>
                    <p className="text-gray-400 text-sm">
                      Queue position: <span className="text-blue-400 font-semibold">#{job.queue_position || 'Calculating...'}</span>
                    </p>
                  </div>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '20%' }}></div>
                </div>
                <p className="text-gray-400 text-sm text-center">
                  Estimated wait: ~{Math.ceil((job.queue_position || 1) * 3)} minutes
                </p>
              </div>
            )}

            {job.status === 'processing' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center text-2xl animate-spin">
                    {statusConfig.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{statusConfig.description}</p>
                    <p className="text-gray-400 text-sm">This usually takes 2-5 minutes</p>
                  </div>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div
                    className="h-full bg-yellow-500 rounded-full animate-pulse"
                    style={{ width: '60%', transition: 'width 5s ease-in-out' }}
                  ></div>
                </div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    ></div>
                  ))}
                </div>
              </div>
            )}

            {job.status === 'completed' && job.payload.video_url && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-2xl">
                    {statusConfig.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium">{statusConfig.description}</p>
                    <p className="text-gray-400 text-sm">
                      Completed in{' '}
                      {job.completed_at && job.created_at
                        ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000 / 60)
                        : '~3'} minutes
                    </p>
                  </div>
                </div>

                {/* Video Player */}
                <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden">
                  <video
                    src={job.payload.video_url}
                    controls
                    poster={job.payload.thumbnail_url}
                    className="w-full h-full"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

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
                    onClick={handleShare}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white hover:bg-slate-700/50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/ask-doubt')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Doubt
                  </button>
                </div>
              </div>
            )}

            {job.status === 'failed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-2xl">
                    {statusConfig.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium">{statusConfig.description}</p>
                    {job.retry_count > 0 && job.retry_count < 3 && (
                      <p className="text-gray-400 text-sm">
                        Retries remaining: {3 - job.retry_count}
                      </p>
                    )}
                  </div>
                </div>
                {job.error_message && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
                    <strong>Error:</strong> {job.error_message}
                  </div>
                )}
                <div className="flex gap-4">
                  {job.retry_count < 3 ? (
                    <button
                      onClick={() => router.push('/dashboard/ask-doubt')}
                      className="flex-1 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 transition-colors"
                    >
                      Try Again
                    </button>
                  ) : (
                    <p className="text-gray-400 text-sm">Maximum retries reached. Please contact support.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="border-t border-white/10 pt-6 mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400 block mb-1">Job ID</span>
              <p className="text-white font-mono text-xs">{job.id.slice(0, 13)}...</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Created</span>
              <p className="text-white">{new Date(job.created_at).toLocaleString()}</p>
            </div>
            {job.started_at && (
              <div>
                <span className="text-gray-400 block mb-1">Started</span>
                <p className="text-white">{new Date(job.started_at).toLocaleString()}</p>
              </div>
            )}
            {job.completed_at && (
              <div>
                <span className="text-gray-400 block mb-1">Completed</span>
                <p className="text-white">{new Date(job.completed_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tips */}
        {job.status === 'queued' && (
          <div className="neon-glass p-6 rounded-xl">
            <h4 className="text-white font-medium mb-3">While you wait...</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/dashboard/search"
                className="p-4 bg-slate-800/30 rounded-lg hover:bg-slate-700/50 transition-colors group"
              >
                <p className="text-white font-medium group-hover:text-neon-blue transition-colors">Search Knowledge Base</p>
                <p className="text-gray-400 text-sm mt-1">Find instant answers to related topics</p>
              </a>
              <a
                href="/dashboard/notes"
                className="p-4 bg-slate-800/30 rounded-lg hover:bg-slate-700/50 transition-colors group"
              >
                <p className="text-white font-medium group-hover:text-neon-blue transition-colors">Generate Notes</p>
                <p className="text-gray-400 text-sm mt-1">Create study notes on any topic</p>
              </a>
              <a
                href="/dashboard/practice"
                className="p-4 bg-slate-800/30 rounded-lg hover:bg-slate-700/50 transition-colors group"
              >
                <p className="text-white font-medium group-hover:text-neon-blue transition-colors">Practice Questions</p>
                <p className="text-gray-400 text-sm mt-1">Test your knowledge with MCQs</p>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
