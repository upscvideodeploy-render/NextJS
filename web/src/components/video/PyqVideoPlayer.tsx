'use client';

// Story 8.4: PYQ Video Player Component (FULL PRODUCTION)
// AC 1,7,8,9: Complete video player with generation, status tracking, error handling

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PyqVideoPlayerProps {
  questionId: string;
  questionText: string;
  questionYear?: number;
  questionPaper?: string;
  videoUrl?: string;
  onGenerate?: () => void;
}

interface VideoJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  render_metadata?: any;
  created_at: string;
  updated_at: string;
}

export default function PyqVideoPlayer({ 
  questionId, 
  questionText,
  questionYear,
  questionPaper,
  videoUrl: initialVideoUrl,
  onGenerate 
}: PyqVideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(5);
  const [retryCount, setRetryCount] = useState(0);
  const [videoMetadata, setVideoMetadata] = useState<any>(null);
  const supabase = getSupabaseBrowserClient();

  // AC 8: Initialize video state
  useEffect(() => {
    if (initialVideoUrl) {
      setStatus('completed');
      setVideoUrl(initialVideoUrl);
    } else {
      checkExistingVideo();
    }
  }, [initialVideoUrl, questionId]);

  // Check if video already exists or is being generated
  const checkExistingVideo = async () => {
    try {
      const { data, error } = await supabase
        .from('pyq_videos')
        .select('*')
        .eq('question_id', questionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as any;

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error checking existing video:', error);
        return;
      }

      if (data) {
        setJobId(data.id);
        setStatus(data.status);
        setVideoMetadata(data.render_metadata);
        
        if (data.status === 'completed' && data.video_url) {
          setVideoUrl(data.video_url);
        }
      }
    } catch (err) {
      console.error('Failed to check existing video:', err);
    }
  };

  // AC 9: Poll for video status with progress simulation
  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    let pollInterval: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;

    // Poll database every 5 seconds
    pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('pyq_videos')
          .select('status, video_url, render_metadata, updated_at')
          .eq('id', jobId)
          .single() as any;

        if (error) {
          console.error('Polling error:', error);
          return;
        }

        if (data && data.status) {
          setStatus(data.status);
          setVideoMetadata(data.render_metadata);
          
          if (data.status === 'completed' && data.video_url) {
            setVideoUrl(data.video_url);
            setProgress(100);
          } else if (data.status === 'failed') {
            setError(data.render_metadata?.error || 'Video generation failed');
          }
        }
      } catch (err) {
        console.error('Polling failed:', err);
      }
    }, 5000);

    // Simulate progress for better UX
    if (status === 'queued' || status === 'processing') {
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return prev; // Cap at 95% until actually complete
          const increment = status === 'queued' ? 1 : 2;
          return Math.min(prev + increment, 95);
        });
      }, 3000);
    }

    return () => {
      clearInterval(pollInterval);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [jobId, status, supabase]);

  // AC 1: Handle video generation request
  const handleGenerate = async () => {
    setStatus('queued');
    setError(null);
    setProgress(0);
    setRetryCount(0);
    
    try {
      const response = await fetch('/api/supabase/functions/pyq_video_explanation_pipe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ 
          question_id: questionId,
          priority: questionPaper?.toLowerCase().includes('prelims') ? 'prelims' : 'mains',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError('Pro subscription required for video generation');
          setStatus('idle');
          return;
        }
        if (response.status === 503) {
          setError('Video generation queue is full. Please try again in a few minutes.');
          setStatus('idle');
          return;
        }
        throw new Error(result.message || result.error || 'Generation failed');
      }

      if (result.jobId) {
        setJobId(result.jobId);
        setStatus(result.status);
        setEstimatedTime(result.estimated_time_minutes || 5);
        
        if (result.status === 'completed' && result.video_url) {
          setVideoUrl(result.video_url);
          setProgress(100);
        }
      }
      
      onGenerate?.();
    } catch (err: any) {
      console.error('Generation request failed:', err);
      setError(err.message || 'Failed to start video generation');
      setStatus('failed');
    }
  };

  // AC 9: Handle retry for failed generation
  const handleRetry = async () => {
    if (retryCount >= 3) {
      setError('Maximum retry attempts reached. Please contact support.');
      return;
    }
    
    setRetryCount(prev => prev + 1);
    await handleGenerate();
  };

  // AC 7: Completed state with video player
  if (status === 'completed' && videoUrl) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Video Explanation</h3>
          <span className="text-sm text-gray-500">
            {questionYear && questionPaper && `${questionYear} ${questionPaper}`}
          </span>
        </div>
        
        <video 
          controls 
          className="w-full rounded-lg shadow-lg"
          src={videoUrl}
          poster="/video-thumbnail-placeholder.jpg"
          preload="metadata"
        >
          Your browser does not support video playback.
        </video>
        
        {videoMetadata && (
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Duration: {Math.floor((videoMetadata.duration_seconds || 0) / 60)}:{((videoMetadata.duration_seconds || 0) % 60).toString().padStart(2, '0')}</span>
            <span>Generated: {new Date(videoMetadata.render_started_at || Date.now()).toLocaleDateString()}</span>
          </div>
        )}
        
        <button
          onClick={handleGenerate}
          className="w-full py-2 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition"
        >
          Regenerate Video
        </button>
      </div>
    );
  }

  // AC 9: Processing state with progress indicator
  if (status === 'queued' || status === 'processing') {
    return (
      <div className="p-6 border rounded-lg bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center mb-4">
          <div className="inline-block animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">
            {status === 'queued' ? 'Video Queued for Generation' : 'Generating Video Explanation'}
          </h3>
          <p className="text-gray-600 mb-4">
            {status === 'queued' 
              ? 'Your video is in the queue and will start processing shortly...'
              : 'Creating your personalized video explanation with AI-generated visuals...'}
          </p>
        </div>
        
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        <div className="text-sm text-gray-600 space-y-2">
          <div className="flex items-center">
            <span className={`mr-2 ${status === 'processing' ? 'text-green-500' : 'text-gray-400'}`}>●</span>
            <span>Generating script with AI</span>
          </div>
          <div className="flex items-center">
            <span className={`mr-2 ${progress > 30 ? 'text-green-500' : 'text-gray-400'}`}>●</span>
            <span>Creating visual diagrams and animations</span>
          </div>
          <div className="flex items-center">
            <span className={`mr-2 ${progress > 60 ? 'text-green-500' : 'text-gray-400'}`}>●</span>
            <span>Assembling video with narration</span>
          </div>
          <div className="flex items-center">
            <span className={`mr-2 ${progress > 90 ? 'text-green-500' : 'text-gray-400'}`}>●</span>
            <span>Finalizing and uploading</span>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 mt-4 text-center">
          Estimated time: {estimatedTime} minutes • You can leave this page and come back later
        </p>
      </div>
    );
  }

  // AC 9: Failed state with retry option
  if (status === 'failed') {
    return (
      <div className="p-6 border-2 border-red-300 rounded-lg bg-red-50">
        <div className="flex items-start mb-4">
          <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Video Generation Failed</h3>
            <p className="text-red-700 text-sm mb-4">
              {error || 'An unexpected error occurred during video generation.'}
            </p>
            {videoMetadata?.error && (
              <details className="text-xs text-red-600 mb-4">
                <summary className="cursor-pointer">Technical details</summary>
                <pre className="mt-2 p-2 bg-red-100 rounded overflow-x-auto">
                  {videoMetadata.error}
                </pre>
              </details>
            )}
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={handleRetry}
            disabled={retryCount >= 3}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {retryCount >= 3 ? 'Max Retries Reached' : `Retry (${retryCount}/3)`}
          </button>
          <button 
            onClick={() => setStatus('idle')}
            className="flex-1 px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // AC 1: Idle state with generate button
  return (
    <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition">
      <div className="text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-semibold mb-2">Video Explanation</h3>
        <p className="text-gray-600 mb-4 text-sm">
          Get a detailed 3-5 minute video explanation covering:
        </p>
        <ul className="text-sm text-gray-600 mb-6 space-y-1 text-left max-w-md mx-auto">
          <li className="flex items-center">
            <span className="text-blue-500 mr-2">✓</span>
            Question analysis and key requirements
          </li>
          <li className="flex items-center">
            <span className="text-blue-500 mr-2">✓</span>
            Core concepts with visual diagrams
          </li>
          <li className="flex items-center">
            <span className="text-blue-500 mr-2">✓</span>
            Common mistakes to avoid
          </li>
          <li className="flex items-center">
            <span className="text-blue-500 mr-2">✓</span>
            Exam strategy and tips
          </li>
        </ul>
        
        <button 
          onClick={handleGenerate}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          Generate Video Explanation
        </button>
        
        <p className="text-xs text-gray-500 mt-4">
          <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">PRO</span>
          {' '}feature • ~5 minutes generation time
        </p>
      </div>
    </div>
  );
}
