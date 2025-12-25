'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/supabase-js';
import { debounce } from '@/lib/utils';

interface SearchResult {
  id: string;
  rank: number;
  content: string;
  full_content: string;
  confidence_score: number;
  confidence_label: 'high' | 'moderate' | 'low';
  source: {
    book_title: string;
    chapter: string;
    page: number;
  };
}

interface SearchResponse {
  results: SearchResult[];
  insufficient_confidence?: boolean;
  message?: string;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [insufficientConfidence, setInsufficientConfidence] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Handle initial search from URL params
  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [searchParams]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) return;

    setIsLoading(true);
    setHasSearched(true);
    setInsufficientConfidence(false);

    try {
      const { data, error } = await supabase.functions.invoke('rag_search_pipe', {
        body: { query: searchQuery, top_k: 10 },
      });

      if (error) {
        console.error('Search error:', error);
        return;
      }

      const response = data as SearchResponse;
      setResults(response.results || []);
      setInsufficientConfidence(response.insufficient_confidence || false);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedSearch = debounce((q: string) => performSearch(q), 300);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const getConfidenceColor = (label: string) => {
    switch (label) {
      case 'high': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'moderate': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'low': return 'text-red-400 bg-red-400/10 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Search</h1>
          <p className="text-gray-400">Ask questions about UPSC syllabus topics</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Ask anything about UPSC topics... e.g., 'What are the fundamental rights?'"
            className="w-full px-6 py-4 pr-14 bg-slate-800/50 border border-white/10 rounded-2xl text-white text-lg focus:outline-none focus:border-neon-blue focus:ring-2 focus:ring-neon-blue/20"
            autoFocus
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Filters Sidebar Toggle (mobile) */}
        <div className="lg:hidden mb-6">
          <button className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-gray-300">
            Filters
          </button>
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            {/* Low Confidence Warning */}
            {insufficientConfidence && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 mb-6">
                <p className="font-medium">Low Confidence Results</p>
                <p className="text-sm mt-1">No highly confident matches found. Cross-check with standard texts.</p>
              </div>
            )}

            {/* Result Count */}
            <p className="text-gray-400 text-sm mb-4">
              {results.length > 0 ? `Found ${results.length} results` : 'No results found'}
            </p>

            {/* Result Cards */}
            {results.map((result) => (
              <div
                key={result.id}
                className="neon-glass p-6 rounded-xl hover:border-neon-blue/30 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Rank & Confidence */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-neon-blue font-mono text-sm">#{result.rank}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(result.confidence_label)}`}>
                        {result.confidence_label === 'high' ? 'High Confidence' : result.confidence_label === 'moderate' ? 'Moderate' : 'Low - Verify'}
                        {' '}({Math.round(result.confidence_score * 100)}%)
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-gray-200 mb-4">{result.content}</p>

                    {/* Source */}
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span>
                        Based on <strong>{result.source.book_title}</strong>
                        {result.source.chapter !== 'N/A' && `, ${result.source.chapter}`}
                        {result.source.page > 0 && `, Page ${result.source.page}`}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Expand">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Report Issue">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {!isLoading && results.length === 0 && query.length >= 2 && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">No confident matches found</h3>
                <p className="text-gray-400">Try rephrasing your query or searching for specific topics</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
