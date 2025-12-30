'use client';

import { useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface GenerateShortButtonProps {
  syllabusNodeId: string;
  topicTitle: string;
  variant?: 'icon' | 'button' | 'card';
  className?: string;
}

export function GenerateShortButton({
  syllabusNodeId,
  topicTitle,
  variant = 'button',
  className = '',
}: GenerateShortButtonProps) {
  const supabase = getSupabaseBrowserClient(
  );
  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: funcError } = await supabase.functions.invoke(
        'topic_shorts_pipe',
        {
          body: { syllabus_node_id: syllabusNodeId },
          method: 'POST',
        }
      );

      if (funcError) {
        throw new Error(funcError.message);
      }

      if (data.error) {
        if (data.upgrade_required) {
          // Show upgrade prompt
          setError('UPGRADE_REQUIRED');
          return;
        }
        if (data.error === 'INSUFFICIENT_CREDITS') {
          setError('INSUFFICIENT_CREDITS');
          return;
        }
        throw new Error(data.error);
      }

      if (data.cached && data.video_url) {
        // Cached video available
        setVideoUrl(data.video_url);
      } else if (data.job_id) {
        setJobId(data.job_id);
        setShowModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }, [syllabusNodeId, supabase]);

  const handleClose = () => {
    setShowModal(false);
    setJobId(null);
    setError(null);
  };

  const handleWatch = () => {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  };

  // Icon variant - small button for cards
  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          disabled={loading}
          className={`p-2 rounded-lg bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20 transition-colors ${className}`}
          title="Generate 60s video"
        >
          {loading ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </button>

        {showModal && (
          <TopicShortModal
            topicTitle={topicTitle}
            jobId={jobId}
            videoUrl={videoUrl}
            error={error}
            loading={loading}
            onGenerate={handleGenerate}
            onClose={handleClose}
            onWatch={handleWatch}
            onUpgrade={() => router.push('/dashboard/pricing')}
          />
        )}
      </>
    );
  }

  // Button variant - full button
  if (variant === 'button') {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors ${className}`}
        >
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Generate 60s Video
            </>
          )}
        </button>

        {showModal && (
          <TopicShortModal
            topicTitle={topicTitle}
            jobId={jobId}
            videoUrl={videoUrl}
            error={error}
            loading={loading}
            onGenerate={handleGenerate}
            onClose={handleClose}
            onWatch={handleWatch}
            onUpgrade={() => router.push('/dashboard/pricing')}
          />
        )}
      </>
    );
  }

  // Card variant - integrated into a card UI
  return (
    <>
      <div
        className={`bg-slate-800/50 rounded-xl p-4 border border-white/10 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-medium">Quick Video Summary</h4>
            <p className="text-gray-400 text-sm">60-second explainer in ~30 seconds</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={loading}
            className="px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {showModal && (
        <TopicShortModal
          topicTitle={topicTitle}
          jobId={jobId}
          videoUrl={videoUrl}
          error={error}
          loading={loading}
          onGenerate={handleGenerate}
          onClose={handleClose}
          onWatch={handleWatch}
          onUpgrade={() => router.push('/dashboard/pricing')}
        />
      )}
    </>
  );
}

/**
 * Confirmation and Status Modal for Topic Short Generation
 */
interface TopicShortModalProps {
  topicTitle: string;
  jobId: string | null;
  videoUrl: string | null;
  error: string | null;
  loading: boolean;
  onGenerate: () => void;
  onClose: () => void;
  onWatch: () => void;
  onUpgrade: () => void;
}

function TopicShortModal({
  topicTitle,
  jobId,
  videoUrl,
  error,
  loading,
  onGenerate,
  onClose,
  onWatch,
  onUpgrade,
}: TopicShortModalProps) {
  const [pollCount, setPollCount] = useState(0);

  // Determine modal state
  const isUpgradeRequired = error === 'UPGRADE_REQUIRED';
  const isInsufficientCredits = error === 'INSUFFICIENT_CREDITS';
  const isGenerating = loading || (jobId && !videoUrl);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="neon-glass p-6 rounded-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">60-Second Topic Short</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Topic */}
        <p className="text-gray-300 mb-4">{topicTitle}</p>

        {/* Upgrade Required State */}
        {isUpgradeRequired && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-400 text-sm">
                You've reached your daily limit of 2 topic shorts.
              </p>
            </div>
            <button
              onClick={onUpgrade}
              className="w-full py-3 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
            >
              Upgrade to Pro
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Maybe Later
            </button>
          </div>
        )}

        {/* Insufficient Credits State */}
        {isInsufficientCredits && (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">
                You don't have enough credits for this feature.
              </p>
            </div>
            <button
              onClick={onUpgrade}
              className="w-full py-3 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
            >
              Get More Credits
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Video Ready State */}
        {videoUrl && !isGenerating && (
          <div className="space-y-4">
            <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden">
              <video
                src={videoUrl}
                controls
                className="w-full h-full"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={onWatch}
                className="flex-1 py-3 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
              >
                Watch Full
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white hover:bg-slate-700/50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Generation State */}
        {isGenerating && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-neon-blue/10 border border-neon-blue/30 rounded-xl">
              <div className="w-10 h-10 bg-neon-blue/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-neon-blue animate-spin"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Generating your video...</p>
                <p className="text-gray-400 text-sm">
                  {pollCount < 3 ? 'Preparing script' : 'Rendering video'}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-800/50 rounded-full h-2">
              <div
                className="h-full bg-neon-blue rounded-full transition-all duration-1000"
                style={{ width: `${Math.min((pollCount / 10) * 100, 90)}%` }}
              />
            </div>

            <p className="text-gray-400 text-xs text-center">
              Takes about 30-45 seconds
            </p>

            <button
              onClick={onClose}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Generate in Background
            </button>
          </div>
        )}

        {/* Initial State - Confirmation */}
        {!isUpgradeRequired && !isInsufficientCredits && !videoUrl && !isGenerating && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                150-word script tailored to UPSC
              </div>
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Visual diagram included
              </div>
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Cached for 7 days (reuse free)
              </div>
            </div>

            <button
              onClick={onGenerate}
              disabled={loading}
              className="w-full py-3 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Now'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GenerateShortButton;
