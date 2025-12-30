/**
 * Story 10.2: Documentary Chapter Assembly - Render Controls
 * AC 1-10: Render, monitor, stitch, quality check
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { DocumentaryChapterTemplate, DEFAULT_TEMPLATE_CONFIG, MUSIC_TRACKS, TRANSITION_TYPES } from '@/components/documentary/DocumentaryChapterTemplate';

interface RenderProgress {
  total_chapters: number;
  completed_chapters: number;
  failed_chapters: number;
  rendering_chapters: number;
  queued_chapters: number;
  estimated_time_remaining_minutes: number;
  final_status: string;
}

interface ChapterStatus {
  chapter_number: number;
  title: string;
  render_status: string;
  video_url: string | null;
  render_error: string | null;
}

interface ScriptData {
  id: string;
  title: string;
  topic: string;
  final_render_status: string;
  final_video_url: string | null;
  quality_check_passed: boolean;
  credits_data: any;
}

export default function DocumentaryRenderPage() {
  const searchParams = useSearchParams();
  const scriptId = searchParams.get('id');

  const [script, setScript] = useState<ScriptData | null>(null);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [chapters, setChapters] = useState<ChapterStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [isStitching, setIsStitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [credits, setCredits] = useState({
    sources: [] as string[],
    acknowledgments: ['UPSC Preparation Platform'],
    music_credits: ['Royalty-free music from audio library']
  });

  // Fetch progress
  const fetchProgress = useCallback(async () => {
    if (!scriptId) return;

    try {
      const token = localStorage.getItem('supabase_token') || '';
      const res = await fetch(`/api/documentary/render?script_id=${scriptId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      setProgress(data.progress);
      setChapters(data.chapters || []);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  }, [scriptId]);

  // Fetch script details
  useEffect(() => {
    const fetchScript = async () => {
      if (!scriptId) {
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('supabase_token') || '';
        const res = await fetch(`/api/documentary?id=${scriptId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.script) {
          setScript(data.script);
          if (data.script.credits_data) {
            setCredits(data.script.credits_data);
          }
        }
        
        await fetchProgress();
      } catch (err) {
        console.error('Failed to fetch script:', err);
        setError('Failed to load script');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScript();
  }, [scriptId, fetchProgress]);

  // Poll progress while rendering
  useEffect(() => {
    if (progress?.final_status === 'rendering_chapters' || progress?.final_status === 'stitching') {
      const interval = setInterval(fetchProgress, 5000);
      return () => clearInterval(interval);
    }
  }, [progress?.final_status, fetchProgress]);

  // AC 1: Start rendering all chapters
  const startRender = async () => {
    if (!scriptId) return;
    
    setIsRendering(true);
    setError(null);

    try {
      const token = localStorage.getItem('supabase_token') || '';
      const res = await fetch('/api/documentary/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'start_render',
          script_id: scriptId
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start render');
      }

      await fetchProgress();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRendering(false);
    }
  };

  // AC 8: Stitch final video
  const stitchVideo = async () => {
    if (!scriptId) return;
    
    setIsStitching(true);
    setError(null);

    try {
      const token = localStorage.getItem('supabase_token') || '';
      const res = await fetch('/api/documentary/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'stitch_video',
          script_id: scriptId
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to stitch video');
      }

      await fetchProgress();
      
      // Refresh script data
      const scriptRes = await fetch(`/api/documentary?id=${scriptId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const scriptData = await scriptRes.json();
      if (scriptData.script) {
        setScript(scriptData.script);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsStitching(false);
    }
  };

  // AC 9: Save credits
  const saveCredits = async () => {
    if (!scriptId) return;

    try {
      const token = localStorage.getItem('supabase_token') || '';
      await fetch('/api/documentary/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'set_credits',
          script_id: scriptId,
          credits
        })
      });

      setShowCreditsModal(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // AC 10: Run quality check
  const runQualityCheck = async () => {
    if (!scriptId) return;

    try {
      const token = localStorage.getItem('supabase_token') || '';
      const res = await fetch('/api/documentary/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'quality_check',
          script_id: scriptId
        })
      });

      const data = await res.json();
      alert(data.passed ? 'Quality check passed!' : `Quality check issues: ${data.notes}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      queued: 'bg-yellow-100 text-yellow-800',
      rendering: 'bg-blue-100 text-blue-800 animate-pulse',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      stitching: 'bg-purple-100 text-purple-800 animate-pulse'
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto animate-pulse">
          <div className="h-12 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!scriptId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Script Selected</h1>
          <Link href="/documentary" className="text-blue-600 hover:underline">
            Go to Documentary Studio
          </Link>
        </div>
      </div>
    );
  }

  const totalChapters = progress?.total_chapters ?? 0;
  const completedChapters = progress?.completed_chapters ?? 0;
  const allCompleted = completedChapters === totalChapters && totalChapters > 0;
  const hasFailed = (progress?.failed_chapters || 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/documentary" className="text-gray-400 hover:text-gray-600">
              ←
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">Render Documentary</h1>
              <p className="text-sm text-gray-500">{script?.title || 'Loading...'}</p>
            </div>
            <span className={getStatusBadge(progress?.final_status || script?.final_render_status || 'pending')}>
              {(progress?.final_status || script?.final_render_status || 'pending').replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-500">✕</button>
          </div>
        )}

        {/* Progress Overview */}
        {progress && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rendering Progress</h2>
            
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{progress.completed_chapters} of {progress.total_chapters} chapters</span>
                <span>
                  {progress.total_chapters > 0 
                    ? Math.round((progress.completed_chapters / progress.total_chapters) * 100)
                    : 0}%
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                  style={{ 
                    width: `${progress.total_chapters > 0 
                      ? (progress.completed_chapters / progress.total_chapters) * 100 
                      : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{progress.total_chapters}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600">{progress.completed_chapters}</div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-600">{progress.rendering_chapters}</div>
                <div className="text-xs text-gray-500">Rendering</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-600">{progress.queued_chapters}</div>
                <div className="text-xs text-gray-500">Queued</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-600">{progress.failed_chapters}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>

            {progress.estimated_time_remaining_minutes > 0 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Estimated time remaining: ~{progress.estimated_time_remaining_minutes} minutes
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {/* Start Render (AC 1) */}
            <button
              onClick={startRender}
              disabled={isRendering || progress?.final_status === 'rendering_chapters'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isRendering ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Starting...
                </>
              ) : (
                <>🎬 Start Rendering</>
              )}
            </button>

            {/* Stitch Video (AC 8) */}
            <button
              onClick={stitchVideo}
              disabled={!allCompleted || isStitching}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isStitching ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Stitching...
                </>
              ) : (
                <>🔗 Stitch Final Video</>
              )}
            </button>

            {/* Edit Credits (AC 9) */}
            <button
              onClick={() => setShowCreditsModal(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              📜 Edit Credits
            </button>

            {/* Quality Check (AC 10) */}
            <button
              onClick={runQualityCheck}
              disabled={!allCompleted}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              ✓ Quality Check
            </button>
          </div>
        </div>

        {/* Final Video */}
        {script?.final_video_url && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Final Documentary</h2>
              {script.quality_check_passed && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  ✓ Quality Approved
                </span>
              )}
            </div>
            <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
              <video
                src={script.final_video_url}
                controls
                className="w-full h-full rounded-lg"
                poster="/video-poster.jpg"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <a
                href={script.final_video_url}
                download
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                📥 Download
              </a>
            </div>
          </div>
        )}

        {/* Chapters List */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Chapters</h2>
          <div className="space-y-2">
            {chapters.map(chapter => (
              <div
                key={chapter.chapter_number}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
              >
                <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                  {chapter.chapter_number}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{chapter.title}</div>
                  {chapter.render_error && (
                    <div className="text-xs text-red-500 truncate">{chapter.render_error}</div>
                  )}
                </div>
                <span className={getStatusBadge(chapter.render_status)}>
                  {chapter.render_status}
                </span>
                {chapter.video_url && (
                  <a
                    href={chapter.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Preview
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Template Preview */}
        {chapters.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Preview</h2>
            <DocumentaryChapterTemplate
              chapterNumber={1}
              title={chapters[0]?.title || 'Sample Chapter'}
              config={DEFAULT_TEMPLATE_CONFIG}
              isPreview={true}
            />
          </div>
        )}
      </div>

      {/* Credits Modal (AC 9) */}
      {showCreditsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit End Credits</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sources & References
                </label>
                <textarea
                  value={credits.sources.join('\n')}
                  onChange={(e) => setCredits({ ...credits, sources: e.target.value.split('\n').filter(Boolean) })}
                  className="w-full px-3 py-2 border rounded-lg h-24"
                  placeholder="One source per line"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Acknowledgments
                </label>
                <textarea
                  value={credits.acknowledgments.join('\n')}
                  onChange={(e) => setCredits({ ...credits, acknowledgments: e.target.value.split('\n').filter(Boolean) })}
                  className="w-full px-3 py-2 border rounded-lg h-20"
                  placeholder="One acknowledgment per line"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Music Credits
                </label>
                <textarea
                  value={credits.music_credits.join('\n')}
                  onChange={(e) => setCredits({ ...credits, music_credits: e.target.value.split('\n').filter(Boolean) })}
                  className="w-full px-3 py-2 border rounded-lg h-20"
                  placeholder="Music attribution"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreditsModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveCredits}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
