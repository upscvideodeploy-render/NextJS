'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PYQVideo {
  id: string;
  question_text: string;
  gs_paper: string;
  year: number;
  topics: string[];
  difficulty: string;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  model_answer: string;
  view_count: number;
}

interface Bookmark {
  id: string;
  question_id: string;
  question_text: string;
  gs_paper: string;
  year: number;
  topics: string[];
  bookmarked_at: string;
}

const GS_PAPERS = ['GS Paper I', 'GS Paper II', 'GS Paper III', 'GS Paper IV', 'CSAT'];

export default function PYQVideosPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [videos, setVideos] = useState<PYQVideo[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'bookmarks'>('browse');
  const [selectedVideo, setSelectedVideo] = useState<PYQVideo | null>(null);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [filters, setFilters] = useState({
    gs_paper: '',
    year: '',
    topic: '',
  });
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [modelAnswerLoading, setModelAnswerLoading] = useState(false);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { action: 'list', limit: 50 };
      if (filters.gs_paper) params.gs_paper = filters.gs_paper;
      if (filters.year) params.year = Number(filters.year);
      if (filters.topic) params.topic = filters.topic;

      const { data } = await supabase.functions.invoke('pyq_videos_pipe', {
        body: params,
      });

      if (data?.success) {
        setVideos(data.data);
        if (data.filters?.years) {
          setAvailableYears(data.filters.years);
        }
      }
    } catch (err) {
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, filters]);

  const fetchBookmarks = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('pyq_videos_pipe', {
        body: { action: 'list_bookmarks', limit: 50 },
      });

      if (data?.success) {
        setBookmarks(data.data);
      }
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchVideos();
    fetchBookmarks();
  }, [fetchVideos, fetchBookmarks]);

  const handleBookmark = async (videoId: string) => {
    try {
      const { data } = await supabase.functions.invoke('pyq_videos_pipe', {
        body: { action: 'bookmark', question_id: videoId },
      });

      if (data?.success) {
        fetchBookmarks();
      }
    } catch (err) {
      console.error('Error bookmarking:', err);
    }
  };

  const handleUnbookmark = async (videoId: string) => {
    try {
      const { data } = await supabase.functions.invoke('pyq_videos_pipe', {
        body: { action: 'unbookmark', question_id: videoId },
      });

      if (data?.success) {
        fetchBookmarks();
      }
    } catch (err) {
      console.error('Error unbookmarking:', err);
    }
  };

  const handleGetModelAnswer = async (videoId: string) => {
    setModelAnswerLoading(true);
    try {
      const { data } = await supabase.functions.invoke('pyq_videos_pipe', {
        body: { action: 'generate_model_answer', question_id: videoId },
      });

      if (data?.success) {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, model_answer: data.data.model_answer } : v
          )
        );
        setSelectedVideo((prev) =>
          prev?.id === videoId ? { ...prev, model_answer: data.data.model_answer } : prev
        );
        setShowModelAnswer(true);
      }
    } catch (err) {
      console.error('Error generating model answer:', err);
    } finally {
      setModelAnswerLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isBookmarked = (videoId: string) => {
    return bookmarks.some((b) => b.question_id === videoId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">PYQ Video Explanations</h1>
          <p className="text-gray-400">Learn from previous year UPSC questions with video explanations</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('browse')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'browse'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Browse Questions
          </button>
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'bookmarks'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Bookmarks ({bookmarks.length})
          </button>
        </div>

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="neon-glass rounded-xl p-4">
              <div className="flex flex-wrap gap-4">
                <select
                  value={filters.gs_paper}
                  onChange={(e) => setFilters({ ...filters, gs_paper: e.target.value })}
                  className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                >
                  <option value="">All Papers</option>
                  {GS_PAPERS.map((paper) => (
                    <option key={paper} value={paper}>{paper}</option>
                  ))}
                </select>
                <select
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                  className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                >
                  <option value="">All Years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year.toString()}>{year}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search by topic..."
                  value={filters.topic}
                  onChange={(e) => setFilters({ ...filters, topic: e.target.value })}
                  className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-gray-500"
                />
                <button
                  onClick={fetchVideos}
                  className="px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Video Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="neon-glass rounded-xl overflow-hidden hover:border-neon-blue/30 transition-colors"
                >
                  <div className="flex">
                    {/* Thumbnail */}
                    <div
                      className="w-40 h-32 bg-slate-800 flex-shrink-0 cursor-pointer"
                      onClick={() => setSelectedVideo(video)}
                    >
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.gs_paper}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-1 bg-neon-blue/20 text-neon-blue text-xs rounded">
                              {video.gs_paper}
                            </span>
                            <span className="text-gray-500 text-xs">{video.year}</span>
                          </div>
                          <p className="text-white text-sm line-clamp-2">{video.question_text}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            isBookmarked(video.id)
                              ? handleUnbookmark(video.id)
                              : handleBookmark(video.id);
                          }}
                          className={`p-1 rounded ${isBookmarked(video.id) ? 'text-yellow-400' : 'text-gray-500 hover:text-white'}`}
                        >
                          <svg className="w-5 h-5" fill={isBookmarked(video.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                      </div>

                      {/* Topics */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {video.topics?.slice(0, 3).map((topic) => (
                          <span key={topic} className="px-2 py-1 bg-slate-700 text-gray-400 text-xs rounded">
                            #{topic}
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedVideo(video)}
                          className="flex items-center gap-1 px-3 py-1 bg-neon-blue/20 text-neon-blue text-sm rounded hover:bg-neon-blue/30 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Watch
                        </button>
                        <button
                          onClick={() => handleGetModelAnswer(video.id)}
                          disabled={modelAnswerLoading || !!video.model_answer}
                          className="flex items-center gap-1 px-3 py-1 bg-slate-800 text-gray-400 text-sm rounded hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          {video.model_answer ? '✓ Model Answer' : 'Get Model Answer'}
                        </button>
                        <span className="text-gray-500 text-xs ml-auto">
                          {formatDuration(video.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {videos.length === 0 && (
                <div className="neon-glass rounded-2xl p-12 text-center">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-xl font-bold text-white mb-2">No Questions Found</h3>
                  <p className="text-gray-400">Try adjusting your filters</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bookmarks Tab */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-4">
            {bookmarks.length === 0 ? (
              <div className="neon-glass rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">🔖</div>
                <h3 className="text-xl font-bold text-white mb-2">No Bookmarks Yet</h3>
                <p className="text-gray-400">Bookmark PYQs to save them for revision</p>
              </div>
            ) : (
              bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="neon-glass rounded-xl p-4 hover:border-neon-blue/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-slate-700 text-gray-300 text-xs rounded">
                          {bookmark.gs_paper}
                        </span>
                        <span className="text-gray-500 text-xs">{bookmark.year}</span>
                      </div>
                      <p className="text-white mb-2">{bookmark.question_text}</p>
                      <div className="flex flex-wrap gap-1">
                        {bookmark.topics?.map((topic) => (
                          <span key={topic} className="px-2 py-1 bg-slate-800 text-gray-400 text-xs rounded">
                            #{topic}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnbookmark(bookmark.question_id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Video Modal */}
        {selectedVideo && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="neon-glass p-6 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-neon-blue/20 text-neon-blue text-xs rounded">
                    {selectedVideo.gs_paper}
                  </span>
                  <span className="text-gray-400 text-sm">{selectedVideo.year}</span>
                </div>
                <button
                  onClick={() => { setSelectedVideo(null); setShowModelAnswer(false); }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              {/* Question */}
              <div className="mb-4">
                <p className="text-white font-medium text-lg">{selectedVideo.question_text}</p>
              </div>

              {/* Video Player */}
              {!showModelAnswer && (
                <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden mb-4">
                  {selectedVideo.video_url ? (
                    <video
                      src={selectedVideo.video_url}
                      controls
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-gray-400">Video not available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Model Answer */}
              {showModelAnswer && selectedVideo.model_answer && (
                <div className="p-4 bg-slate-800/50 rounded-xl mb-4">
                  <h4 className="text-white font-medium mb-3">Model Answer</h4>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 whitespace-pre-wrap">{selectedVideo.model_answer}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModelAnswer(!showModelAnswer)}
                  className="flex-1 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white hover:bg-slate-700/50 transition-colors"
                >
                  {showModelAnswer ? '📺 Watch Video' : '📝 View Model Answer'}
                </button>
                <button
                  onClick={() => !isBookmarked(selectedVideo.id) ? handleBookmark(selectedVideo.id) : handleUnbookmark(selectedVideo.id)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    isBookmarked(selectedVideo.id)
                      ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                      : 'bg-slate-800/50 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {isBookmarked(selectedVideo.id) ? '✓ Bookmarked' : '🔖 Bookmark'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
