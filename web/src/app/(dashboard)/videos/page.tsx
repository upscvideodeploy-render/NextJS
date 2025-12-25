'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';
import { VideoPlayer } from '@/components/VideoPlayer';

interface DailyNewsVideo {
  id: string;
  news_date: string;
  category: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds: number;
  style: string;
}

interface DoubtVideo {
  id: string;
  doubt_text: string;
  topic: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  script?: string;
  video_url?: string;
  duration_seconds: number;
  created_at: string;
}

export default function VideosPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [activeTab, setActiveTab] = useState<'news' | 'doubt'>('news');
  const [newsVideos, setNewsVideos] = useState<DailyNewsVideo[]>([]);
  const [doubtVideos, setDoubtVideos] = useState<DoubtVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<DailyNewsVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch videos
  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoading(true);

      // Fetch news videos
      const { data: newsData } = await supabase
        .from('daily_news_videos')
        .select('*')
        .in('status', ['completed', 'processing'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (newsData) {
        setNewsVideos(newsData as DailyNewsVideo[]);
      }

      // Fetch doubt videos
      const { data: doubtData } = await supabase
        .from('doubt_videos')
        .select('*')
        .in('status', ['completed', 'processing'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (doubtData) {
        setDoubtVideos(doubtData as DoubtVideo[]);
      }

      setIsLoading(false);
    };

    fetchVideos();
  }, []);

  // Create new doubt video
  const handleCreateDoubtVideo = async () => {
    const doubt = prompt('Enter your doubt or question:');
    if (!doubt) return;

    const topic = prompt('Enter topic (optional):') || undefined;

    try {
      const { error } = await supabase.functions.invoke('doubt_video_pipe', {
        body: { doubt, topic },
      });

      if (error) {
        alert('Failed to create video. Please try again.');
      } else {
        alert('Video is being generated! Check back in a few minutes.');
      }
    } catch (err) {
      console.error('Failed to create doubt video:', err);
      alert('Failed to create video. Please try again.');
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Videos</h1>
          <p className="text-gray-400">Watch daily news videos and doubt explanations</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('news')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'news'
                ? 'bg-neon-blue text-black'
                : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700'
            }`}
          >
            Daily News Videos
          </button>
          <button
            onClick={() => setActiveTab('doubt')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'doubt'
                ? 'bg-neon-blue text-black'
                : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700'
            }`}
          >
            My Doubt Videos
          </button>
        </div>

        {activeTab === 'doubt' && (
          <div className="mb-6">
            <button onClick={handleCreateDoubtVideo} className="btn-primary">
              + Create Doubt Video
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading videos...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Video List */}
            <div className="lg:col-span-2 space-y-4">
              {(activeTab === 'news' ? newsVideos : doubtVideos).length > 0 ? (
                (activeTab === 'news' ? newsVideos : doubtVideos).map((video) => (
                  <div
                    key={video.id}
                    onClick={() => setSelectedVideo(video as any)}
                    className={`neon-glass p-4 rounded-xl cursor-pointer transition-all ${
                      selectedVideo?.id === video.id
                        ? 'border-neon-blue/50'
                        : 'hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="w-32 h-20 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        {'thumbnail_url' in video && video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt="Thumbnail"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {'news_date' in video && (
                          <p className="text-xs text-gray-500 mb-1">{video.news_date}</p>
                        )}
                        {'doubt_text' in video && (
                          <p className="text-xs text-gray-500 mb-1">
                            {new Date(video.created_at).toLocaleDateString()}
                          </p>
                        )}
                        <h3 className="text-white font-medium truncate">
                          {'doubt_text' in video ? video.doubt_text : `News Video - ${video.category}`}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            video.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : video.status === 'processing'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {video.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
                          </span>
                        </div>
                      </div>

                      {/* Play Icon */}
                      <svg className="w-8 h-8 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-xl font-medium text-white mb-2">No videos yet</h3>
                  <p className="text-gray-400">
                    {activeTab === 'news'
                      ? 'Daily news videos will appear here'
                      : 'Create your first doubt video'}
                  </p>
                </div>
              )}
            </div>

            {/* Video Player */}
            <div className="lg:col-span-1">
              {selectedVideo ? (
                <div className="sticky top-6">
                  {'video_url' in selectedVideo && selectedVideo.video_url ? (
                    <VideoPlayer
                      src={selectedVideo.video_url}
                      title={'news_date' in selectedVideo ? `News - ${selectedVideo.news_date}` : 'Doubt Explanation'}
                    />
                  ) : (
                    <div className="neon-glass p-8 rounded-xl text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-gray-400">Video is being generated...</p>
                      <p className="text-gray-500 text-sm mt-2">This may take a few minutes</p>
                    </div>
                  )}

                  {'script' in selectedVideo && selectedVideo.script && (
                    <div className="mt-4 neon-glass p-4 rounded-xl">
                      <h4 className="font-medium text-white mb-2">Script</h4>
                      <p className="text-gray-400 text-sm whitespace-pre-line">
                        {selectedVideo.script.substring(0, 500)}...
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="neon-glass p-6 rounded-xl">
                  <p className="text-gray-400 text-center">Select a video to watch</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
