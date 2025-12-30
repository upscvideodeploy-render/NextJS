'use client';

// Story 8.5: PYQ Database Browsing Interface (FULL PRODUCTION)
// AC 1-10: Complete browsing with filters, search, bookmarks, practice mode

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PyqQuestion {
  id: string;
  year: number;
  paper_type: string;
  subject: string;
  topic: string;
  text: string;
  marks: number;
  difficulty: string;
  view_count: number;
}

interface Bookmark {
  question_id: string;
  notes?: string;
  tags?: string[];
}

export default function PyqBrowsingPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<PyqQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    yearFrom: 2010,
    yearTo: 2024,
    paperType: 'all',
    subject: 'all',
    difficulty: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('year_desc');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, byYear: {}, bySubject: {} });
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [loadingBookmark, setLoadingBookmark] = useState<string | null>(null);
  const [startingPractice, setStartingPractice] = useState(false);
  const [error, setError] = useState('');
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    fetchQuestions();
    fetchStats();
    fetchBookmarks();
  }, [filters, sortBy, page, searchQuery]);

  // AC 2,3,4,9: Fetch questions with filters, search, and sorting
  const fetchQuestions = async () => {
    setLoading(true);
    setError('');
    
    try {
      let query = supabase
        .from('pyq_questions')
        .select('*', { count: 'exact' })
        .gte('year', filters.yearFrom)
        .lte('year', filters.yearTo);

      if (filters.paperType !== 'all') {
        query = query.eq('paper_type', filters.paperType);
      }
      if (filters.subject !== 'all') {
        query = query.eq('subject', filters.subject);
      }
      if (filters.difficulty !== 'all') {
        query = query.eq('difficulty', filters.difficulty);
      }
      
      // AC 3: Full-text search with highlighting
      if (searchQuery) {
        query = query.textSearch('text', searchQuery, {
          type: 'websearch',
          config: 'english'
        });
      }

      // AC 4: Sort options
      if (sortBy === 'year_desc') query = query.order('year', { ascending: false });
      if (sortBy === 'year_asc') query = query.order('year', { ascending: true });
      if (sortBy === 'difficulty') query = query.order('difficulty');
      if (sortBy === 'popularity') query = query.order('view_count', { ascending: false });

      // AC 10: Pagination
      const { data, count, error } = await query.range((page - 1) * 20, page * 20 - 1) as any;

      if (error) throw error;

      setQuestions(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const { data } = await supabase.from('pyq_questions').select('year, subject') as any;
    if (data) {
      const byYear: any = {};
      const bySubject: any = {};
      data.forEach((q: any) => {
        byYear[q.year] = (byYear[q.year] || 0) + 1;
        bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
      });
      setStats({ total: data.length, byYear, bySubject });
    }
  };

  // AC 6: Fetch statistics

  // AC 7: Fetch user bookmarks
  const fetchBookmarks = async () => {
    try {
      const response = await fetch('/api/pyqs/bookmark');
      if (response.ok) {
        const data = await response.json();
        const bookmarkSet = new Set<string>(data.bookmarks?.map((b: any) => b.question_id) || []);
        setBookmarks(bookmarkSet);
      }
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    }
  };

  // AC 7: Toggle bookmark
  const toggleBookmark = async (questionId: string) => {
    setLoadingBookmark(questionId);
    
    try {
      const isBookmarked = bookmarks.has(questionId);
      
      if (isBookmarked) {
        const response = await fetch(`/api/pyqs/bookmark?question_id=${questionId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) throw new Error('Failed to remove bookmark');
        
        setBookmarks(prev => {
          const newSet = new Set(prev);
          newSet.delete(questionId);
          return newSet;
        });
      } else {
        const response = await fetch('/api/pyqs/bookmark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question_id: questionId }),
        });
        
        if (!response.ok) throw new Error('Failed to add bookmark');
        
        setBookmarks(prev => new Set([...prev, questionId]));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingBookmark(null);
    }
  };

  // AC 8: Start practice session
  const startPracticeSession = async () => {
    setStartingPractice(true);
    setError('');
    
    try {
      const response = await fetch('/api/pyqs/practice-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, count: 10 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create practice session');
      }

      const data = await response.json();
      router.push(`/practice/session?session_id=${data.session_id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStartingPractice(false);
    }
  };

  // AC 3: Highlight search terms
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200">{part}</mark>
        : part
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">PYQ Database</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-gray-600">Total Questions</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{Object.keys(stats.byYear).length}</div>
          <div className="text-gray-600">Years Covered</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{Object.keys(stats.bySubject).length}</div>
          <div className="text-gray-600">Subjects</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Year From</label>
            <input
              type="number"
              value={filters.yearFrom}
              onChange={(e) => setFilters({ ...filters, yearFrom: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Year To</label>
            <input
              type="number"
              value={filters.yearTo}
              onChange={(e) => setFilters({ ...filters, yearTo: parseInt(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Paper Type</label>
            <select
              value={filters.paperType}
              onChange={(e) => setFilters({ ...filters, paperType: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="all">All</option>
              <option value="Prelims">Prelims</option>
              <option value="Mains">Mains</option>
              <option value="Essay">Essay</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Difficulty</label>
            <select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="all">All</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="year_desc">Newest First</option>
              <option value="year_asc">Oldest First</option>
              <option value="difficulty">Difficulty</option>
              <option value="popularity">Most Viewed</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border rounded px-4 py-2"
          />
        </div>
        {/* AC 8: Practice mode button */}
        <button
          onClick={startPracticeSession}
          disabled={startingPractice}
          className="mt-4 w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center space-x-2"
        >
          {startingPractice ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Creating Session...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Start Practice Session (Random 10 Questions)</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* AC 5: Questions */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-4'}>
            {questions.map((q) => (
              <div key={q.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition relative">
                {/* AC 7: Bookmark button */}
                <button
                  onClick={() => toggleBookmark(q.id)}
                  disabled={loadingBookmark === q.id}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition"
                  title={bookmarks.has(q.id) ? 'Remove bookmark' : 'Add bookmark'}
                >
                  {loadingBookmark === q.id ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg 
                      className={`w-5 h-5 ${bookmarks.has(q.id) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`}
                      fill={bookmarks.has(q.id) ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  )}
                </button>

                <div className="flex justify-between items-start mb-3 pr-10">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {q.year} - {q.paper_type}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    q.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                    q.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {q.difficulty.toUpperCase()}
                  </span>
                </div>
                
                {/* AC 3: Search highlighting */}
                <p className="text-lg mb-3 line-clamp-3">
                  {highlightText(q.text, searchQuery)}
                </p>
                
                <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">{q.subject}</span>
                    {q.topic && <span className="text-gray-400">•</span>}
                    {q.topic && <span>{q.topic}</span>}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span>{q.marks} marks</span>
                    <span className="text-gray-400">•</span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {q.view_count}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => router.push(`/pyqs/${q.id}`)}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
                >
                  View Explanation
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center space-x-4 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-gray-600">
              Page {page} of {Math.ceil(totalCount / 20)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(totalCount / 20)}
              className="px-4 py-2 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
