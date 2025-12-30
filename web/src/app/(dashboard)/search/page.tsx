'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { debounce } from '@/lib/utils';
import { useAuth } from '@/app/providers/AuthProvider';

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
    topic: string;
  };
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  insufficient_confidence?: boolean;
  message?: string;
  query_time_ms: number;
  total_chunks_searched?: number;
  suggested_topics?: string[];
}

interface SearchHistoryItem {
  id: string;
  query: string;
  filters: Record<string, unknown>;
  results_count: number;
  created_at: string;
}

// UPSC Topics for filters
const TOPICS = [
  { id: 'polity', label: 'Polity', color: 'blue' },
  { id: 'history', label: 'History', color: 'green' },
  { id: 'geography', label: 'Geography', color: 'yellow' },
  { id: 'economy', label: 'Economy', color: 'purple' },
  { id: 'environment', label: 'Environment', color: 'emerald' },
  { id: 'science', label: 'Science & Tech', color: 'cyan' },
  { id: 'ir', label: 'International Relations', color: 'rose' },
  { id: 'ethics', label: 'Ethics', color: 'amber' },
];

// Shimmer Skeleton Component (AC 3)
function SearchSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="neon-glass p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-6 bg-slate-700/50 rounded animate-pulse shimmer" />
            <div className="w-24 h-6 bg-slate-700/50 rounded-full animate-pulse shimmer" />
            <div className="w-20 h-6 bg-slate-700/50 rounded-full animate-pulse shimmer" />
          </div>
          <div className="space-y-2 mb-4">
            <div className="w-full h-4 bg-slate-700/50 rounded animate-pulse shimmer" />
            <div className="w-5/6 h-4 bg-slate-700/50 rounded animate-pulse shimmer" />
            <div className="w-4/6 h-4 bg-slate-700/50 rounded animate-pulse shimmer" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-700/50 rounded animate-pulse shimmer" />
            <div className="w-48 h-4 bg-slate-700/50 rounded animate-pulse shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [insufficientConfidence, setInsufficientConfidence] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [queryTime, setQueryTime] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // AC 10: Search history
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  
  // AC 8: Report modal
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; resultId: string | null }>({ isOpen: false, resultId: null });
  const [reportType, setReportType] = useState<'incorrect' | 'outdated' | 'incomplete' | 'other'>('incorrect');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  
  // AC 6: Explain More / Paywall
  const [showPaywall, setShowPaywall] = useState(false);
  const [isProUser, setIsProUser] = useState(false);

  // Load search history on mount
  useEffect(() => {
    if (user) {
      loadSearchHistory();
      checkProStatus();
    }
  }, [user]);

  // Handle initial search from URL params
  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [searchParams]);

  const loadSearchHistory = async () => {
    if (!user) return;
    try {
      // @ts-expect-error - RPC function types not yet generated
      const { data, error } = await supabase.rpc('get_search_history', {
        p_user_id: user.id,
        p_limit: 10
      });
      if (data && !error) {
        setSearchHistory(data as SearchHistoryItem[]);
      }
    } catch (err) {
      console.error('Failed to load search history:', err);
    }
  };

  const saveSearchHistory = async (searchQuery: string, resultsCount: number, topScore: number | null) => {
    if (!user) return;
    try {
      // @ts-expect-error - RPC function types not yet generated
      await supabase.rpc('save_search_history', {
        p_user_id: user.id,
        p_query: searchQuery,
        p_filters: { subjects: activeFilters },
        p_results_count: resultsCount,
        p_top_confidence_score: topScore
      });
      loadSearchHistory();
    } catch (err) {
      console.error('Failed to save search history:', err);
    }
  };

  const checkProStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single() as { data: { plan: string; status: string } | null };
      setIsProUser(data?.plan === 'pro' || data?.plan === 'enterprise');
    } catch {
      setIsProUser(false);
    }
  };

  const performSearch = useCallback(
    async (searchQuery: string, filters?: string[]) => {
      if (searchQuery.trim().length < 2) return;

      setIsLoading(true);
      setHasSearched(true);
      setInsufficientConfidence(false);

      try {
        const { data, error } = await supabase.functions.invoke('rag_search_pipe', {
          body: {
            query: searchQuery,
            top_k: 10,
            filters: {
              subjects: filters?.length ? filters : undefined,
            },
          },
        });

        if (error) {
          console.error('Search error:', error);
          return;
        }

        const response = data as SearchResponse;
        setResults(response.results || []);
        setInsufficientConfidence(response.insufficient_confidence || false);
        setSuggestedTopics(response.suggested_topics || []);
        setQueryTime(response.query_time_ms || 0);
        
        // Save to history (AC 10)
        const topScore = response.results?.[0]?.confidence_score ?? null;
        saveSearchHistory(searchQuery, response.results?.length || 0, topScore);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  const debouncedSearch = debounce((q: string) => performSearch(q, activeFilters), 300);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const toggleFilter = (filterId: string) => {
    const newFilters = activeFilters.includes(filterId)
      ? activeFilters.filter((f) => f !== filterId)
      : [...activeFilters, filterId];
    setActiveFilters(newFilters);
    if (query.trim().length >= 2) {
      performSearch(query, newFilters);
    }
  };

  const handleTopicClick = (topic: string) => {
    setQuery(topic);
    performSearch(topic, activeFilters);
  };

  const handleCopyContent = async (result: SearchResult) => {
    await navigator.clipboard.writeText(result.full_content);
    setCopiedId(result.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (result: SearchResult) => {
    const shareData = {
      title: `UPSC PrepX-AI: ${result.source.book_title}`,
      text: result.full_content,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(`${result.full_content}\n\nSource: ${result.source.book_title}`);
      setCopiedId(result.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // AC 6: Handle Explain More
  const handleExplainMore = async (result: SearchResult) => {
    if (!isProUser) {
      setShowPaywall(true);
      return;
    }
    // Queue video generation for Pro users
    try {
      const { error } = await (supabase.from('video_renders') as any).insert({
        user_id: user?.id,
        type: 'doubt_explainer',
        status: 'queued',
        priority: 'medium',
        input_params: {
          chunk_id: result.id,
          query: query,
          content: result.full_content,
          source: result.source
        }
      });
      if (!error) {
        alert('Video explanation queued! Check your videos section.');
      }
    } catch (err) {
      console.error('Failed to queue video:', err);
    }
  };

  // AC 8: Submit content report
  const handleSubmitReport = async () => {
    if (!reportModal.resultId || !user) return;
    setReportSubmitting(true);
    try {
      // @ts-expect-error - RPC function types not yet generated
      await supabase.rpc('submit_content_report', {
        p_user_id: user.id,
        p_chunk_id: reportModal.resultId,
        p_report_type: reportType,
        p_description: reportDescription,
        p_query_context: query
      });
      setReportModal({ isOpen: false, resultId: null });
      setReportDescription('');
      alert('Thank you for your feedback! Our team will review this.');
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setReportSubmitting(false);
    }
  };

  // Handle history chip click (AC 10)
  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    performSearch(historyQuery, activeFilters);
  };

  const getConfidenceColor = (label: string) => {
    switch (label) {
      case 'high':
        return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'moderate':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'low':
        return 'text-red-400 bg-red-400/10 border-red-400/30';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getTopicColor = (topic: string) => {
    const topicObj = TOPICS.find((t) => t.id === topic.toLowerCase());
    switch (topicObj?.color) {
      case 'blue':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'green':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'yellow':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'purple':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'emerald':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'cyan':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'rose':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'amber':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Search</h1>
          <p className="text-gray-400">
            Ask questions about UPSC syllabus topics and get AI-powered answers with citations
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <input
            type="text"
            ref={searchInputRef}
            value={query}
            onChange={handleQueryChange}
            placeholder="Ask anything about UPSC topics... e.g., 'What are the fundamental rights under Indian Constitution?'"
            className="w-full px-6 py-4 pr-14 bg-slate-800/50 border border-white/10 rounded-2xl text-white text-lg focus:outline-none focus:border-neon-blue focus:ring-2 focus:ring-neon-blue/20"
            autoFocus
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* AC 10: Search History Chips */}
        {user && searchHistory.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-gray-500">Recent searches:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleHistoryClick(item.query)}
                  className="px-3 py-1.5 bg-slate-800/30 border border-white/10 rounded-full text-xs text-gray-400 hover:bg-slate-700/50 hover:text-white transition-colors flex items-center gap-2"
                >
                  {item.query.length > 30 ? `${item.query.slice(0, 30)}...` : item.query}
                  {item.results_count > 0 && (
                    <span className="text-gray-600">({item.results_count})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters and Quick Actions */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              showFilters || activeFilters.length > 0
                ? 'bg-neon-blue text-white'
                : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilters.length > 0 && (
              <span className="w-5 h-5 bg-white text-neon-blue rounded-full text-xs flex items-center justify-center">
                {activeFilters.length}
              </span>
            )}
          </button>

          {/* Topic Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => toggleFilter(topic.label)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeFilters.includes(topic.label)
                      ? 'bg-neon-blue/20 border-neon-blue text-white'
                      : 'bg-slate-800/30 border-white/10 text-gray-400 hover:bg-slate-700/50'
                  }`}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          )}

          {/* Query Time */}
          {hasSearched && !isLoading && (
            <span className="ml-auto text-sm text-gray-500">
              Found in {queryTime}ms
            </span>
          )}
        </div>

        {/* Suggested Topics */}
        {suggestedTopics.length > 0 && !isLoading && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">Related topics:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleTopicClick(topic)}
                  className="px-3 py-1.5 bg-slate-800/30 border border-white/10 rounded-full text-xs text-gray-400 hover:bg-slate-700/50 hover:text-white transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            {/* AC 3: Loading Shimmer Skeleton */}
            {isLoading && <SearchSkeleton />}

            {/* Low Confidence Warning */}
            {!isLoading && insufficientConfidence && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-medium">Low Confidence Results</p>
                    <p className="text-sm mt-1">
                      No highly confident matches found. Cross-check with standard texts or try different keywords.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Result Count */}
            {!isLoading && (
              <p className="text-gray-400 text-sm mb-4">
                {results.length > 0
                  ? `Found ${results.length} result${results.length !== 1 ? 's' : ''}`
                  : 'No results found'}
              </p>
            )}

            {/* Result Cards */}
            {!isLoading && results.map((result) => (
              <div
                key={result.id}
                className="neon-glass p-6 rounded-xl hover:border-neon-blue/30 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Rank & Confidence */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-neon-blue font-mono text-sm">#{result.rank}</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(
                          result.confidence_label
                        )}`}
                      >
                        {result.confidence_label === 'high'
                          ? 'High Confidence'
                          : result.confidence_label === 'moderate'
                          ? 'Moderate'
                          : 'Low - Verify'}{' '}
                        ({Math.round(result.confidence_score * 100)}%)
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getTopicColor(
                          result.source.topic
                        )}`}
                      >
                        {result.source.topic}
                      </span>
                    </div>

                    {/* Content - Expandable */}
                    <div className="mb-4">
                      {expandedResult === result.id ? (
                        <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                          {result.full_content}
                        </div>
                      ) : (
                        <p className="text-gray-200">{result.content}</p>
                      )}
                    </div>

                    {/* Source */}
                    <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
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
                    <button
                      onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      title={expandedResult === result.id ? 'Collapse' : 'Expand'}
                    >
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {expandedResult === result.id ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => handleCopyContent(result)}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      title={copiedId === result.id ? 'Copied!' : 'Copy'}
                    >
                      {copiedId === result.id ? (
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleShare(result)}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      title="Share"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleExplainMore(result)}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      title="Explain More"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    {/* AC 8: Report Incorrect Information */}
                    <button
                      onClick={() => setReportModal({ isOpen: true, resultId: result.id })}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      title="Report Incorrect Information"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {!isLoading && results.length === 0 && query.length >= 2 && (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">No confident matches found</h3>
                <p className="text-gray-400">
                  Try rephrasing your query, using simpler terms, or searching for specific topics
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!hasSearched && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Search the Knowledge Base</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Ask questions about UPSC syllabus topics and get AI-powered answers with citations from
              standard reference books
            </p>

            {/* Example Queries */}
            <div className="mt-8">
              <p className="text-sm text-gray-500 mb-4">Try searching for:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Fundamental Rights',
                  'GST Implementation',
                  'Climate Change',
                  'Indian Constitution',
                  'Economic Reforms',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setQuery(example);
                      performSearch(example);
                    }}
                    className="px-4 py-2 bg-slate-800/30 border border-white/10 rounded-lg text-sm text-gray-400 hover:bg-slate-700/50 hover:text-white transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AC 8: Report Incorrect Information Modal */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Report Incorrect Information</h3>
            <p className="text-sm text-gray-400 mb-4">
              Help us improve by reporting inaccurate or outdated content.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Issue Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as typeof reportType)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              >
                <option value="incorrect">Incorrect Information</option>
                <option value="outdated">Outdated Content</option>
                <option value="incomplete">Incomplete Answer</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Please describe what's wrong..."
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-neon-blue resize-none h-24"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setReportModal({ isOpen: false, resultId: null })}
                className="flex-1 px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-gray-400 hover:bg-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={reportSubmitting}
                className="flex-1 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 disabled:opacity-50"
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AC 6: Paywall Modal for Free Users */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neon-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Upgrade to Pro</h3>
            <p className="text-gray-400 mb-6">
              Video explanations are a Pro feature. Upgrade now to unlock AI-generated video explanations for any topic.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaywall(false)}
                className="flex-1 px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-gray-400 hover:bg-slate-700/50"
              >
                Maybe Later
              </button>
              <button
                onClick={() => router.push('/pricing')}
                className="flex-1 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80"
              >
                View Plans
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
