'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';
import Link from 'next/link';

interface DailyNews {
  id: string;
  date: string;
  title: string;
  summary: string;
  key_points: string[];
  detailed_explanation?: string;
  category: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All News' },
  { id: 'polity', label: 'Polity' },
  { id: 'economy', label: 'Economy' },
  { id: 'environment', label: 'Environment' },
  { id: 'international', label: 'International' },
  { id: 'science', label: 'Science & Tech' },
];

export default function NewsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [news, setNews] = useState<DailyNews[]>([]);
  const [selectedNews, setSelectedNews] = useState<DailyNews | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch news
  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true);
      let query = supabase
        .from('daily_updates')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query;

      if (!error && data) {
        setNews(data as DailyNews[]);
      }
      setIsLoading(false);
    };

    fetchNews();
  }, [selectedCategory]);

  // Generate today's news
  const handleGenerateNews = async () => {
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('daily_news_pipe', {
        body: {
          date: new Date().toISOString().split('T')[0],
          category: 'all',
          include_explanations: true,
        },
      });

      if (error) {
        alert('Failed to generate news. Please try again.');
      } else {
        // Refresh news list
        const { data: newsData } = await supabase
          .from('daily_updates')
          .select('*')
          .order('date', { ascending: false })
          .limit(10);

        if (newsData) {
          setNews(newsData as DailyNews[]);
        }
      }
    } catch (err) {
      console.error('Failed to generate news:', err);
      alert('Failed to generate news. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Daily News</h1>
          <p className="text-gray-400">Daily current affairs in simple easy-to-understand language</p>
        </header>

        {/* Category Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-neon-blue text-black font-medium'
                  : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Generate Button */}
        <div className="mb-6">
          <button
            onClick={handleGenerateNews}
            disabled={isGenerating}
            className="btn-primary disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating today's news...
              </span>
            ) : (
              "Get Today's News"
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* News List */}
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Loading news...</p>
              </div>
            ) : news.length > 0 ? (
              news.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedNews(item)}
                  className={`neon-glass p-6 rounded-xl cursor-pointer transition-all ${
                    selectedNews?.id === item.id
                      ? 'border-neon-blue/50'
                      : 'hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500">{item.date}</span>
                        <span className="px-2 py-0.5 bg-neon-blue/20 text-neon-blue text-xs rounded">
                          {item.category}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-2">{item.summary}</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">No news yet</h3>
                <p className="text-gray-400 mb-4">Click the button above to get today's news</p>
              </div>
            )}
          </div>

          {/* News Detail */}
          <div className="lg:col-span-1">
            {selectedNews ? (
              <div className="neon-glass p-6 rounded-xl sticky top-6">
                <div className="mb-4">
                  <span className="text-xs text-gray-500">{selectedNews.date}</span>
                  <h2 className="text-xl font-bold text-white mt-1">{selectedNews.title}</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Quick Summary</h4>
                    <p className="text-white">{selectedNews.summary}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Key Points</h4>
                    <ul className="space-y-2">
                      {selectedNews.key_points.map((point, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1.5 flex-shrink-0"></span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedNews.detailed_explanation && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Easy Explanation</h4>
                      <div className="text-gray-300 text-sm whitespace-pre-line">
                        {selectedNews.detailed_explanation}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedNews(null)}
                  className="mt-6 w-full py-2 bg-slate-800 rounded-lg text-gray-300 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="neon-glass p-6 rounded-xl">
                <p className="text-gray-400 text-center">Select a news item to read more</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
