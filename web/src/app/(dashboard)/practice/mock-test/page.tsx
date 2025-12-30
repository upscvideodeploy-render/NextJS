'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface MockTestQuestion {
  id: string;
  question_text: string;
  gs_paper: string;
  word_limit: number;
  syllabus_topic: string;
}

interface MockTestResult {
  attempt_id: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  percentile: number;
  all_india_rank: number;
}

const TEST_TYPES = [
  { id: 'gs1', name: 'GS Paper I', questions: 20, time: 120, icon: '📜' },
  { id: 'gs2', name: 'GS Paper II', questions: 20, time: 120, icon: '⚖️' },
  { id: 'gs3', name: 'GS Paper III', questions: 20, time: 120, icon: '📊' },
  { id: 'gs4', name: 'GS Paper IV', questions: 20, time: 120, icon: '🎯' },
  { id: 'csat', name: 'CSAT', questions: 30, time: 120, icon: '🧮' },
  { id: 'full', name: 'Full Mock (All GS)', questions: 80, time: 180, icon: '🏆' },
];

export default function MockTestPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [activeTab, setActiveTab] = useState<'tests' | 'analytics'>('tests');
  const [selectedTest, setSelectedTest] = useState<typeof TEST_TYPES[0] | null>(null);
  const [testQuestions, setTestQuestions] = useState<MockTestQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | number>>({});
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [result, setResult] = useState<MockTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [rankings, setRankings] = useState<any[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('mock_test_pipe', {
        body: { action: 'get_analytics' },
      });

      if (data?.success) {
        setAnalytics(data.data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  }, [supabase]);

  const fetchRankings = useCallback(async (testType: string) => {
    try {
      const { data } = await supabase.functions.invoke('mock_test_pipe', {
        body: { action: 'get_rankings', test_type: testType },
      });

      if (data?.success) {
        setRankings(data.data);
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (testStarted && !testCompleted && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [testStarted, testCompleted, timeRemaining]);

  const handleStartTest = async (testType: typeof TEST_TYPES[0]) => {
    setLoading(true);
    setSelectedTest(testType);

    try {
      // Create test
      const { data: createData } = await supabase.functions.invoke('mock_test_pipe', {
        body: { action: 'create', test_type: testType.id },
      });

      if (!createData?.success) {
        throw new Error('Failed to create test');
      }

      // Get questions
      const { data: testData } = await supabase.functions.invoke('mock_test_pipe', {
        body: { action: 'get', test_id: createData.data.test_id },
      });

      if (testData?.success) {
        setTestQuestions(testData.data.questions);
        setTimeRemaining(testType.time * 60);
        setTestStarted(true);
        setCurrentQuestion(0);
        setSelectedAnswers({});
        setConfidences({});
        setTestCompleted(false);
        setResult(null);
      }
    } catch (err) {
      console.error('Error starting test:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTest || testQuestions.length === 0) return;

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const answers = testQuestions.map((q) => ({
        question_id: q.id,
        selected_option: selectedAnswers[q.id] ?? 0,
        confidence: confidences[q.id] ?? 3,
      }));

      const { data } = await supabase.functions.invoke('mock_test_pipe', {
        body: {
          action: 'submit',
          test_id: testQuestions[0]?.id || '',
          answers,
          time_taken_seconds: selectedTest.time * 60 - timeRemaining,
        },
      });

      if (data?.success) {
        setResult(data.data);
        setTestCompleted(true);
        fetchAnalytics();
        fetchRankings(selectedTest.id);
      }
    } catch (err) {
      console.error('Error submitting test:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRetry = () => {
    setTestStarted(false);
    setSelectedTest(null);
    setTestQuestions([]);
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setConfidences({});
    setTestCompleted(false);
    setResult(null);
  };

  if (testStarted && selectedTest && !testCompleted) {
    const question = testQuestions[currentQuestion];
    const progress = ((currentQuestion + 1) / testQuestions.length) * 100;

    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          {/* Test Header */}
          <div className="neon-glass rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">{selectedTest.name}</h1>
                <p className="text-gray-400 text-sm">Question {currentQuestion + 1} of {testQuestions.length}</p>
              </div>
              <div className={`text-right ${timeRemaining < 300 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                <p className="text-2xl font-mono font-bold">{formatTime(timeRemaining)}</p>
                <p className="text-gray-400 text-xs">Time Remaining</p>
              </div>
            </div>
            <div className="w-full bg-slate-800/50 rounded-full h-2 mt-4">
              <div className="h-full bg-neon-blue rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Question */}
          <div className="neon-glass rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 bg-slate-700 text-gray-300 text-xs rounded">{question.gs_paper}</span>
              <span className="text-gray-500 text-xs">Word limit: {question.word_limit}</span>
            </div>
            <p className="text-white text-lg mb-6">{question.question_text}</p>

            <textarea
              value={selectedAnswers[question.id] || ''}
              onChange={(e) => setSelectedAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              placeholder="Write your answer here..."
              className="w-full h-48 bg-slate-800/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue resize-none"
            />

            {/* Confidence Slider */}
            <div className="mt-4 p-4 bg-slate-800/30 rounded-xl">
              <p className="text-gray-400 text-sm mb-3">Confidence level for this answer:</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((conf) => (
                  <button
                    key={conf}
                    onClick={() => setConfidences((prev) => ({ ...prev, [question.id]: conf }))}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                      confidences[question.id] === conf
                        ? 'bg-neon-blue text-white'
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                    }`}
                  >
                    {conf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
              className="px-4 py-3 bg-slate-800 text-white rounded-xl disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentQuestion((prev) => Math.min(testQuestions.length - 1, prev + 1))}
              disabled={currentQuestion === testQuestions.length - 1}
              className="px-4 py-3 bg-slate-800 text-white rounded-xl disabled:opacity-50"
            >
              Next
            </button>
            {currentQuestion === testQuestions.length - 1 && (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600"
              >
                Submit Test
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (testCompleted && result) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Result Card */}
          <div className="neon-glass rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-6">Test Complete!</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-gray-400 text-sm">Score</p>
                <p className={`text-3xl font-bold ${result.score >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {result.score}%
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-gray-400 text-sm">Correct</p>
                <p className="text-3xl font-bold text-white">
                  {result.correct_answers}/{result.total_questions}
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-gray-400 text-sm">All-India Rank</p>
                <p className="text-3xl font-bold text-neon-blue">#{result.all_india_rank || 'N/A'}</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-gray-400 text-sm">Percentile</p>
                <p className="text-3xl font-bold text-purple-400">{result.percentile}%</p>
              </div>
            </div>

            <button
              onClick={handleRetry}
              className="px-8 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80"
            >
              Take Another Test
            </button>
          </div>

          {/* Rankings */}
          {rankings.length > 0 && (
            <div className="neon-glass rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Top Performers</h2>
              <div className="space-y-2">
                {rankings.slice(0, 10).map((r: any, i: number) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-500 text-black' :
                        i === 1 ? 'bg-gray-400 text-black' :
                        i === 2 ? 'bg-orange-500 text-white' :
                        'bg-slate-700 text-gray-300'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-gray-400 text-sm">Candidate</span>
                    </div>
                    <span className="text-white font-medium">{r.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Mock Test Platform</h1>
          <p className="text-gray-400">Practice with full-length mock tests and track your progress</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('tests')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'tests'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Available Tests
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Analytics
          </button>
        </div>

        {/* Tests Tab */}
        {activeTab === 'tests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEST_TYPES.map((test) => (
              <div
                key={test.id}
                className="neon-glass rounded-xl p-6 hover:border-neon-blue/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{test.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-white">{test.name}</h3>
                    <p className="text-gray-400 text-sm">{test.questions} questions</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-400 text-sm">⏱️ {test.time} minutes</span>
                  <span className="text-neon-blue text-sm">📊 All-India Ranking</span>
                </div>
                <button
                  onClick={() => handleStartTest(test)}
                  disabled={loading}
                  className="w-full py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Start Test'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="neon-glass rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-neon-blue">{analytics.overall?.total_tests || 0}</p>
                <p className="text-gray-400 text-sm">Tests Taken</p>
              </div>
              <div className="neon-glass rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{analytics.overall?.avg_score || 0}%</p>
                <p className="text-gray-400 text-sm">Average Score</p>
              </div>
              <div className="neon-glass rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">{analytics.overall?.total_questions_attempted || 0}</p>
                <p className="text-gray-400 text-sm">Questions Attempted</p>
              </div>
              <div className="neon-glass rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-purple-400">
                  {analytics.by_paper?.reduce((sum: number, p: any) => sum + p.total_attempts, 0) || 0}
                </p>
                <p className="text-gray-400 text-sm">Papers Covered</p>
              </div>
            </div>

            {/* Paper-wise Performance */}
            <div className="neon-glass rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Performance by Paper</h3>
              <div className="space-y-4">
                {analytics.by_paper?.map((paper: any) => (
                  <div key={paper.test_type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-300">{TEST_TYPES.find(t => t.id === paper.test_type)?.name || paper.test_type}</span>
                      <span className="text-gray-400 text-sm">{paper.avg_score}% avg</span>
                    </div>
                    <div className="w-full bg-slate-800/50 rounded-full h-2">
                      <div
                        className="h-full bg-gradient-to-r from-neon-blue to-green-400 rounded-full"
                        style={{ width: `${paper.avg_score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
