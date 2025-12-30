'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Story 8.10: Question Bank Analytics & Insights Dashboard
// AC 1-10: Comprehensive analytics with AI recommendations

interface SubjectStats {
  subject: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avg_time: number;
}

interface DifficultyStats {
  difficulty: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

interface TimeAnalysis {
  avg_time: number;
  total_minutes: number;
  is_rushing: boolean;
  is_too_slow: boolean;
  status: string;
  recommendation: string;
  by_difficulty?: Record<string, number>;
}

interface TopicInfo {
  topic: string;
  accuracy: number;
  attempts: number;
  recommendation: string;
}

interface PYQCoverage {
  total: number;
  attempted: number;
  percent: number;
  by_year?: Record<string, { total: number; attempted: number; percent: number }>;
  by_paper?: Record<string, { total: number; attempted: number; percent: number }>;
}

interface DayTrend {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

interface AIInsight {
  type: string;
  priority: number;
  data: {
    message: string;
    [key: string]: any;
  };
}

export default function PracticeAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'pyq' | 'insights'>('overview');

  // Analytics data
  const [overall, setOverall] = useState({
    total_attempts: 0,
    correct_attempts: 0,
    accuracy: 0,
    avg_time: 0,
  });
  const [subjects, setSubjects] = useState<SubjectStats[]>([]);
  const [difficulty, setDifficulty] = useState<DifficultyStats[]>([]);
  const [time, setTime] = useState<TimeAnalysis | null>(null);
  const [topics, setTopics] = useState<{ weak: TopicInfo[]; strong: TopicInfo[] }>({ weak: [], strong: [] });
  const [pyq, setPyq] = useState<PYQCoverage | null>(null);
  const [trend, setTrend] = useState<DayTrend[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  };

  const fetchAnalytics = async () => {
    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        setError('Please log in to view analytics');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'get_complete', days: 30 }),
      });

      if (!res.ok) throw new Error('Failed to fetch analytics');

      const data = await res.json();

      setOverall(data.overall || {});
      setSubjects(data.subjects || []);
      setDifficulty(data.difficulty || []);
      setTime(data.time || null);
      setTopics({
        weak: data.topics?.weak || data.topics?.weak_topics || [],
        strong: data.topics?.strong || data.topics?.strong_topics || [],
      });
      setPyq(data.pyq || null);
      setTrend(data.trend || []);
      setInsights(data.insights || []);
      setRecommendations(data.recommendations || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // AC 10: Generate AI recommendations
  const generateRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'generate_ai_recommendations' }),
      });
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (e) {
      console.error('Failed to generate recommendations:', e);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'hard': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-600';
    if (accuracy >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-xl mb-2">Error</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Practice Analytics</h1>
        <div className="flex gap-2">
          {['overview', 'subjects', 'pyq', 'insights'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* AC 2: Overall Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-blue-600">{overall.total_attempts}</div>
          <div className="text-gray-600">Questions Attempted</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className={`text-3xl font-bold ${getAccuracyColor(overall.accuracy)}`}>
            {overall.accuracy}%
          </div>
          <div className="text-gray-600">Overall Accuracy</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-purple-600">{overall.avg_time}s</div>
          <div className="text-gray-600">Avg Time/Question</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl font-bold text-orange-600">{trend.length}</div>
          <div className="text-gray-600">Days Active (30d)</div>
        </div>
      </div>

      {/* AC 10: AI Insights Banner */}
      {recommendations.length > 0 && activeTab === 'overview' && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <span className="mr-2">🤖</span> AI Insights
            </h2>
            <button
              onClick={generateRecommendations}
              disabled={loadingRecommendations}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loadingRecommendations ? 'Generating...' : 'Refresh'}
            </button>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <p key={idx} className="text-gray-700 flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                {rec}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* AC 5: Time Analysis */}
          {time && (
            <div className={`rounded-lg p-6 mb-8 ${
              time.is_rushing ? 'bg-yellow-50 border border-yellow-200' :
              time.is_too_slow ? 'bg-orange-50 border border-orange-200' :
              'bg-green-50 border border-green-200'
            }`}>
              <h2 className="text-xl font-bold mb-3 flex items-center">
                <span className="mr-2">⏱️</span> Time Analysis
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-700">{time.recommendation}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Total practice time: {time.total_minutes || 0} minutes
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-lg font-semibold ${
                  time.status === 'rushing' ? 'bg-yellow-200 text-yellow-800' :
                  time.status === 'too_slow' ? 'bg-orange-200 text-orange-800' :
                  'bg-green-200 text-green-800'
                }`}>
                  {time.status === 'rushing' ? '⚡ Rushing' :
                   time.status === 'too_slow' ? '🐢 Too Slow' : '✓ Optimal'}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* AC 4: Difficulty Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Difficulty Breakdown</h2>
              <div className="space-y-4">
                {difficulty.map((d) => (
                  <div key={d.difficulty}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold text-white capitalize ${getDifficultyColor(d.difficulty)}`}>
                        {d.difficulty}
                      </span>
                      <span className={getAccuracyColor(d.accuracy)}>{d.accuracy}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${getDifficultyColor(d.difficulty)}`}
                        style={{ width: `${d.accuracy}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {d.correct}/{d.attempts} correct
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AC 7 & 8: Weak/Strong Topics */}
            <div className="space-y-4">
              {topics.weak.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-2">⚠️ Weak Topics (&lt;50%)</h3>
                  <ul className="space-y-2">
                    {topics.weak.slice(0, 3).map((t, i) => (
                      <li key={i} className="flex justify-between items-center text-sm">
                        <span>{t.topic}</span>
                        <span className="text-red-600">{t.accuracy}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {topics.strong.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">✓ Strong Topics (&gt;80%)</h3>
                  <ul className="space-y-2">
                    {topics.strong.slice(0, 3).map((t, i) => (
                      <li key={i} className="flex justify-between items-center text-sm">
                        <span>{t.topic}</span>
                        <span className="text-green-600">{t.accuracy}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* AC 6: 30-Day Trend */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">30-Day Accuracy Trend</h2>
            {trend.length > 0 ? (
              <>
                <div className="h-48 flex items-end space-x-1">
                  {trend.map((day, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition cursor-pointer"
                      style={{ height: `${Math.max(5, day.accuracy)}%` }}
                      title={`${day.date}: ${day.accuracy}% (${day.correct}/${day.attempts})`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-sm text-gray-600 mt-2">
                  <span>{trend[0]?.date}</span>
                  <span>{trend[trend.length - 1]?.date}</span>
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">
                Start practicing to see your progress trend!
              </div>
            )}
          </div>
        </>
      )}

      {/* AC 3: Subject-wise Tab */}
      {activeTab === 'subjects' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-6">Subject-wise Performance</h2>
          {subjects.length > 0 ? (
            <div className="space-y-4">
              {subjects.map((s) => (
                <div key={s.subject} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{s.subject}</span>
                    <span className={`text-lg font-bold ${getAccuracyColor(s.accuracy)}`}>
                      {s.accuracy}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div
                      className={`h-3 rounded-full ${
                        s.accuracy >= 80 ? 'bg-green-500' :
                        s.accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${s.accuracy}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{s.correct}/{s.attempts} correct</span>
                    <span>Avg time: {s.avg_time}s</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              No subject data available yet. Start practicing!
            </div>
          )}
        </div>
      )}

      {/* AC 9: PYQ Coverage Tab */}
      {activeTab === 'pyq' && pyq && (
        <div className="space-y-6">
          {/* Overall PYQ Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">PYQ Coverage Overview</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{pyq.total}</div>
                <div className="text-gray-600">Total PYQs</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{pyq.attempted}</div>
                <div className="text-gray-600">Attempted</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{pyq.percent}%</div>
                <div className="text-gray-600">Coverage</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{ width: `${pyq.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* By Year */}
          {pyq.by_year && Object.keys(pyq.by_year).length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Coverage by Year</h2>
              <div className="grid grid-cols-5 gap-4">
                {Object.entries(pyq.by_year)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .slice(0, 10)
                  .map(([year, stats]) => (
                    <div key={year} className="text-center p-3 border rounded-lg">
                      <div className="font-semibold text-lg">{year}</div>
                      <div className={`text-2xl font-bold ${getAccuracyColor(stats.percent)}`}>
                        {stats.percent}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {stats.attempted}/{stats.total}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* By Paper Type */}
          {pyq.by_paper && Object.keys(pyq.by_paper).length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Coverage by Paper</h2>
              <div className="space-y-3">
                {Object.entries(pyq.by_paper).map(([paper, stats]) => (
                  <div key={paper} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">{paper}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${stats.percent}%` }}
                        />
                      </div>
                      <span className={`font-semibold ${getAccuracyColor(stats.percent)}`}>
                        {stats.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AC 10: Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">AI-Powered Insights</h2>
              <button
                onClick={generateRecommendations}
                disabled={loadingRecommendations}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingRecommendations ? 'Generating...' : 'Generate New Insights'}
              </button>
            </div>

            {recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">
                        {idx === 0 ? '🎯' : idx === 1 ? '💡' : idx === 2 ? '📈' : idx === 3 ? '⚡' : '✨'}
                      </span>
                      <p className="text-gray-700">{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">🤖</div>
                <p>Click "Generate New Insights" to get personalized recommendations!</p>
              </div>
            )}
          </div>

          {/* Raw Insights Data */}
          {insights.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Performance Insights</h2>
              <div className="space-y-3">
                {insights.map((insight, idx) => (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{insight.type.replace('_', ' ')}</span>
                      <span className="text-sm text-gray-500">Priority: {insight.priority}</span>
                    </div>
                    <p className="text-gray-700 mt-2">{insight.data?.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
