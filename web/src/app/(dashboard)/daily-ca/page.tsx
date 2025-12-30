'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface DailyArticle {
  id: string;
  title: string;
  summary: string;
  source_name: string;
  published_date: string;
  papers: string[];
  tags: string[];
}

interface DailyScript {
  id: string;
  date: string;
  script_sections: any[];
  total_duration_seconds: number;
  word_count: number;
  article_count: number;
  topics_covered: string[];
  status: string;
  video_url?: string;
}

export default function DailyCAPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [todayScript, setTodayScript] = useState<DailyScript | null>(null);
  const [articles, setArticles] = useState<DailyArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'video' | 'articles' | 'archive'>('video');
  const [videoLoading, setVideoLoading] = useState(false);

  const fetchTodayContent = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch today's script
      const today = new Date().toISOString().split('T')[0];
      const { data: scriptData } = await supabase
        .from('daily_ca_scripts')
        .select('*')
        .eq('date', today)
        .single();

      if (scriptData) {
        setTodayScript(scriptData as DailyScript);
      }

      // Fetch today's articles
      const { data: articlesData } = await supabase
        .from('daily_updates')
        .select('*')
        .eq('date', today)
        .eq('upsc_relevant', true)
        .order('relevance_score', { ascending: false });

      if (articlesData) {
        setArticles(articlesData as DailyArticle[]);
      }
    } catch (err) {
      console.error('Error fetching content:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTodayContent();
  }, [fetchTodayContent]);

  const handleRegenerate = async () => {
    setVideoLoading(true);
    try {
      // Trigger script regeneration
      const { data } = await supabase.functions.invoke('generate_ca_script_pipe', {
        body: { force_regenerate: true },
      });

      if (data?.success) {
        fetchTodayContent();
      }
    } catch (err) {
      console.error('Error regenerating:', err);
    } finally {
      setVideoLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
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
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Daily Current Affairs</h1>
          <p className="text-gray-400">Your daily dose of UPSC-relevant news and analysis</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('video')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'video'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Today's Video
          </button>
          <button
            onClick={() => setActiveTab('articles')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'articles'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Articles ({articles.length})
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'archive'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Archive
          </button>
        </div>

        {/* Video Tab */}
        {activeTab === 'video' && (
          <div className="space-y-6">
            {todayScript ? (
              <>
                {/* Video Player */}
                <div className="neon-glass rounded-2xl overflow-hidden">
                  {todayScript.video_url ? (
                    <div className="aspect-video bg-slate-900">
                      <video
                        src={todayScript.video_url}
                        controls
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-900 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-neon-blue animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-white font-medium mb-2">Video Processing</p>
                        <p className="text-gray-400 text-sm">Check back in a few minutes</p>
                      </div>
                    </div>
                  )}

                  {/* Video Info */}
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-neon-blue/20 text-neon-blue rounded-full text-sm">
                        {formatDate(todayScript.date)}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {formatDuration(todayScript.total_duration_seconds)}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {todayScript.article_count} articles
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">Today's Current Affairs</h2>
                    <p className="text-gray-400 mb-4">
                      Topics: {todayScript.topics_covered?.join(', ') || 'N/A'}
                    </p>

                    {/* Topics Covered */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {todayScript.topics_covered?.map((topic) => (
                        <span key={topic} className="px-2 py-1 bg-slate-700 text-gray-300 text-xs rounded">
                          {topic}
                        </span>
                      ))}
                    </div>

                    {/* Script Sections */}
                    <div className="space-y-4 mt-6 pt-6 border-t border-white/10">
                      <h3 className="text-white font-medium mb-3">Script Sections</h3>
                      {todayScript.script_sections?.map((section: any, index: number) => (
                        <div key={index} className="p-4 bg-slate-800/30 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-neon-blue font-medium">{section.title}</span>
                            <span className="text-gray-400 text-sm">{formatDuration(section.duration_seconds)}</span>
                          </div>
                          <p className="text-gray-300 text-sm line-clamp-2">{section.narration}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={handleRegenerate}
                    disabled={videoLoading}
                    className="flex-1 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 disabled:opacity-50"
                  >
                    {videoLoading ? 'Regenerating...' : 'Regenerate Video'}
                  </button>
                  <button className="flex-1 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700">
                    Share
                  </button>
                </div>
              </>
            ) : (
              <div className="neon-glass rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">📰</div>
                <h2 className="text-2xl font-bold text-white mb-2">Today's Paper Coming Soon</h2>
                <p className="text-gray-400 mb-6">
                  Daily current affairs video is generated every morning at 5:00 AM IST
                </p>
                <button
                  onClick={handleRegenerate}
                  disabled={videoLoading}
                  className="px-6 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 disabled:opacity-50"
                >
                  {videoLoading ? 'Generating...' : 'Generate Now'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Articles Tab */}
        {activeTab === 'articles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Today's Articles</h2>
              <span className="text-gray-400">{articles.length} articles</span>
            </div>

            {articles.length === 0 ? (
              <div className="neon-glass rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">📄</div>
                <h3 className="text-xl font-bold text-white mb-2">No Articles Yet</h3>
                <p className="text-gray-400">Articles will appear here after scraping</p>
              </div>
            ) : (
              articles.map((article) => (
                <div key={article.id} className="neon-glass rounded-xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-slate-700 text-gray-300 text-xs rounded">
                          {article.source_name}
                        </span>
                        {article.papers?.map((paper) => (
                          <span key={paper} className="px-2 py-1 bg-neon-blue/20 text-neon-blue text-xs rounded">
                            {paper}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-white font-medium mb-2">{article.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-2">{article.summary}</p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {article.tags?.map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-slate-800 text-gray-500 text-xs rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <a
                      href={article.source_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-slate-800 text-gray-400 text-sm rounded hover:text-white"
                    >
                      Read More
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Archive Tab */}
        {activeTab === 'archive' && (
          <div className="space-y-4">
            <div className="neon-glass rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-bold text-white mb-2">Archive Coming Soon</h3>
              <p className="text-gray-400">Previous daily updates will be available here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
