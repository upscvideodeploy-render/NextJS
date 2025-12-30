'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// Story 8.9: Practice Session Interface
// AC 1-10: Complete focused practice session with timer, navigation, feedback

interface Question {
  index: number;
  id: string;
  text: string;
  type: 'mcq' | 'mains';
  difficulty: 'easy' | 'medium' | 'hard';
  source: 'generated' | 'pyq';
  topic?: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
}

interface SessionConfig {
  topic?: string;
  question_type?: string;
  difficulty?: string;
  count: number;
  source?: string;
}

type SessionPhase = 'config' | 'active' | 'paused' | 'complete';

export default function PracticeSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('resume');

  const [phase, setPhase] = useState<SessionPhase>(resumeId ? 'active' : 'config');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Config state (AC 2)
  const [config, setConfig] = useState<SessionConfig>({
    topic: '',
    question_type: 'mcq',
    difficulty: 'all',
    count: 10,
    source: 'both',
  });

  // Mains answer state (AC 6)
  const [mainsAnswer, setMainsAnswer] = useState('');

  // Session results
  const [results, setResults] = useState<any>(null);

  // Paused sessions
  const [pausedSessions, setPausedSessions] = useState<any[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 'active') {
      timer = setInterval(() => setTimeElapsed((t) => t + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [phase]);

  // Load resume session if specified
  useEffect(() => {
    if (resumeId) {
      handleResume(resumeId);
    } else {
      loadPausedSessions();
    }
  }, [resumeId]);

  // Track time per question
  useEffect(() => {
    setQuestionStartTime(Date.now());
  }, [currentIndex]);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  };

  const loadPausedSessions = async () => {
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/practice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'get_paused' }),
      });
      const data = await res.json();
      setPausedSessions(data.sessions || []);
    } catch (e) {
      console.error('Failed to load paused sessions:', e);
    }
  };

  // AC 1, AC 2: Start new session
  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      const authHeader = await getAuthHeader();
      const sessionType = config.source === 'pyq' ? 'pyq_practice' : 
                         config.source === 'generated' ? 'generated_practice' : 'mixed';

      const res = await fetch('/api/practice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'start',
          session_type: sessionType,
          config,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      setSessionId(data.session_id);
      setQuestions(data.questions);
      setPhase('active');
      setTimeElapsed(0);
      setCurrentIndex(0);
      setAnswers({});
      setQuestionTimes({});

      // Enter fullscreen (AC 3)
      if (document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        } catch (e) {
          // Fullscreen not critical
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // AC 8: Resume paused session
  const handleResume = async (sId: string) => {
    setLoading(true);
    setError(null);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/practice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'resume', session_id: sId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resume session');
      }

      setSessionId(sId);
      setQuestions(data.questions);
      setAnswers(data.answers || {});
      setQuestionTimes(data.question_times || {});
      setCurrentIndex(data.current_index || 0);
      setTimeElapsed(data.elapsed_seconds || 0);
      setConfig(data.config);
      setPhase('active');
    } catch (e: any) {
      setError(e.message);
      setPhase('config');
    } finally {
      setLoading(false);
    }
  };

  // AC 8: Pause session
  const handlePause = async () => {
    if (!sessionId) return;

    // Record time for current question
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    const updatedTimes = { ...questionTimes, [currentIndex]: (questionTimes[currentIndex] || 0) + timeSpent };

    try {
      const authHeader = await getAuthHeader();
      await fetch('/api/practice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'pause',
          session_id: sessionId,
          current_index: currentIndex,
          answers,
          question_times: updatedTimes,
        }),
      });

      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }

      setPhase('paused');
    } catch (e) {
      console.error('Failed to pause:', e);
    }
  };

  // AC 5: Handle MCQ answer with instant feedback
  const handleMCQAnswer = (option: string) => {
    const q = questions[currentIndex];
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

    setAnswers({ ...answers, [currentIndex]: option });
    setQuestionTimes({ ...questionTimes, [currentIndex]: (questionTimes[currentIndex] || 0) + timeSpent });
    setShowFeedback(true);

    // Auto-advance after feedback (AC 5)
    setTimeout(() => {
      setShowFeedback(false);
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }, 2000);
  };

  // AC 6: Handle Mains answer submission
  const handleMainsAnswer = () => {
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    setAnswers({ ...answers, [currentIndex]: mainsAnswer });
    setQuestionTimes({ ...questionTimes, [currentIndex]: (questionTimes[currentIndex] || 0) + timeSpent });
    setMainsAnswer('');

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // AC 9: Complete session
  const handleComplete = async () => {
    if (!sessionId) return;
    setLoading(true);

    // Record final question time
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    const finalTimes = { ...questionTimes, [currentIndex]: (questionTimes[currentIndex] || 0) + timeSpent };

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/practice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'complete',
          session_id: sessionId,
          answers,
          question_times: finalTimes,
          total_time: timeElapsed,
        }),
      });

      const data = await res.json();

      if (document.fullscreenElement) {
        document.exitFullscreen();
      }

      setResults(data);
      setPhase('complete');
    } catch (e) {
      console.error('Failed to complete:', e);
    } finally {
      setLoading(false);
    }
  };

  // AC 4: Navigation
  const goToQuestion = (idx: number) => {
    // Save current question time
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    setQuestionTimes({ ...questionTimes, [currentIndex]: (questionTimes[currentIndex] || 0) + timeSpent });
    setShowFeedback(false);
    setCurrentIndex(idx);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const currentQuestion = questions[currentIndex];

  // ============================================
  // PHASE: CONFIG (AC 2)
  // ============================================
  if (phase === 'config') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Start Practice Session</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Paused Sessions */}
          {pausedSessions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="font-semibold text-blue-800 mb-3">Resume Paused Session</h2>
              <div className="space-y-2">
                {pausedSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleResume(s.id)}
                    className="w-full text-left p-3 bg-white rounded border hover:bg-blue-50 transition"
                  >
                    <div className="flex justify-between">
                      <span>{s.session_config?.topic || 'Mixed Topics'}</span>
                      <span className="text-sm text-gray-500">
                        {s.answered_count}/{s.question_count} answered
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            {/* Topic */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Topic (optional)</label>
              <input
                type="text"
                value={config.topic}
                onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                placeholder="e.g., Indian Polity, Environment"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Question Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
              <select
                value={config.question_type}
                onChange={(e) => setConfig({ ...config, question_type: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="mcq">MCQ (Prelims)</option>
                <option value="mains_150">Mains 150-word</option>
                <option value="mains_250">Mains 250-word</option>
                <option value="all">All Types</option>
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              <div className="flex gap-2">
                {['all', 'easy', 'medium', 'hard'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setConfig({ ...config, difficulty: d })}
                    className={`flex-1 py-2 rounded-lg border-2 transition capitalize ${
                      config.difficulty === d
                        ? d === 'easy' ? 'border-green-500 bg-green-50' :
                          d === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                          d === 'hard' ? 'border-red-500 bg-red-50' :
                          'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Questions</label>
              <div className="flex gap-2">
                {[10, 20, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setConfig({ ...config, count: n as 10 | 20 | 50 })}
                    className={`flex-1 py-3 rounded-lg border-2 font-semibold transition ${
                      config.count === n
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Source</label>
              <div className="flex gap-2">
                {[
                  { value: 'both', label: 'Both' },
                  { value: 'pyq', label: 'PYQs Only' },
                  { value: 'generated', label: 'AI Generated' },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setConfig({ ...config, source: s.value })}
                    className={`flex-1 py-2 rounded-lg border-2 transition ${
                      config.source === s.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Loading Questions...' : 'Start Practice'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // PHASE: PAUSED
  // ============================================
  if (phase === 'paused') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⏸️</div>
          <h1 className="text-2xl font-bold mb-4">Session Paused</h1>
          <p className="text-gray-600 mb-6">
            Your progress has been saved. You can resume anytime.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => handleResume(sessionId!)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Resume Session
            </button>
            <button
              onClick={() => router.push('/practice')}
              className="w-full py-3 border rounded-lg hover:bg-gray-50"
            >
              Back to Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // PHASE: COMPLETE (AC 9)
  // ============================================
  if (phase === 'complete' && results) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-8 text-center">Session Complete!</h1>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{results.score}/{results.total}</div>
                <div className="text-gray-600">Score</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{results.accuracy}%</div>
                <div className="text-gray-600">Accuracy</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{formatTime(results.time_taken)}</div>
                <div className="text-gray-600">Time</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">
                  {Math.round(results.time_taken / results.total)}s
                </div>
                <div className="text-gray-600">Avg/Question</div>
              </div>
            </div>

            {/* Difficulty Breakdown */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Performance by Difficulty</h2>
              <div className="grid grid-cols-3 gap-4">
                {['easy', 'medium', 'hard'].map((d) => {
                  const stats = results.difficulty_breakdown?.[d] || { correct: 0, total: 0 };
                  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                  return (
                    <div key={d} className={`p-4 rounded-lg ${getDifficultyColor(d)}`}>
                      <div className="font-semibold capitalize mb-2">{d}</div>
                      <div className="text-2xl font-bold">{stats.correct}/{stats.total}</div>
                      <div className="text-sm">{pct}% accuracy</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weak/Strong Topics */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {results.weak_topics?.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-2">Needs Improvement</h3>
                  <ul className="text-sm space-y-1">
                    {results.weak_topics.map((t: string) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {results.strong_topics?.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">Strong Areas</h3>
                  <ul className="text-sm space-y-1">
                    {results.strong_topics.map((t: string) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Question Review */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Question Review</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {results.results?.map((r: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      r.is_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Q{idx + 1}</span>
                      <span className={r.is_correct ? 'text-green-600' : 'text-red-600'}>
                        {r.is_correct ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{r.question_text?.substring(0, 150)}...</p>
                    <div className="text-xs text-gray-500">
                      Your answer: {r.user_answer} | Correct: {r.correct_answer} | Time: {r.time_taken}s
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setPhase('config');
                  setResults(null);
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start New Session
              </button>
              <button
                onClick={() => router.push('/practice/analytics')}
                className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
              >
                View Analytics
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // PHASE: ACTIVE (AC 3, AC 4, AC 5, AC 6, AC 7)
  // ============================================
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isAnswered = answers[currentIndex] !== undefined;
  const isCorrect = isAnswered && answers[currentIndex] === currentQuestion.correct_answer;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header (AC 3: Minimal UI) */}
      <div className="bg-white shadow-sm px-6 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePause}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            ⏸️ Pause
          </button>
          <span className="text-gray-600">
            Question <span className="font-semibold">{currentIndex + 1}</span> of {questions.length}
          </span>
          <span className={`px-2 py-1 rounded text-xs ${getDifficultyColor(currentQuestion.difficulty)}`}>
            {currentQuestion.difficulty.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            {answeredCount}/{questions.length} answered
          </span>
          <div className="text-xl font-mono bg-gray-100 px-4 py-2 rounded">
            {formatTime(timeElapsed)}
          </div>
        </div>
      </div>

      {/* Progress Grid (AC 4) */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex flex-wrap gap-1.5 max-w-4xl mx-auto">
          {questions.map((_, idx) => {
            const answered = answers[idx] !== undefined;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={idx}
                onClick={() => goToQuestion(idx)}
                className={`w-8 h-8 rounded text-sm font-medium transition ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                    : answered
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Content (AC 3: Full-screen focus) */}
      <div className="flex-1 overflow-auto py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            {/* Question Text */}
            <p className="text-xl leading-relaxed mb-8">{currentQuestion.text}</p>

            {/* MCQ Options (AC 5) */}
            {currentQuestion.type === 'mcq' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = answers[currentIndex] === letter;
                  const isCorrectOption = letter === currentQuestion.correct_answer;

                  return (
                    <button
                      key={idx}
                      onClick={() => !isAnswered && handleMCQAnswer(letter)}
                      disabled={isAnswered}
                      className={`w-full p-4 text-left border-2 rounded-lg transition ${
                        showFeedback && isCorrectOption
                          ? 'border-green-500 bg-green-50'
                          : showFeedback && isSelected && !isCorrectOption
                          ? 'border-red-500 bg-red-50'
                          : isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-semibold mr-3">
                        {letter}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Mains Text Input (AC 6) */}
            {currentQuestion.type === 'mains' && (
              <div className="space-y-4">
                <textarea
                  value={isAnswered ? answers[currentIndex] : mainsAnswer}
                  onChange={(e) => !isAnswered && setMainsAnswer(e.target.value)}
                  disabled={isAnswered}
                  placeholder="Write your answer here..."
                  className="w-full h-64 p-4 border-2 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {(isAnswered ? answers[currentIndex] : mainsAnswer).split(/\s+/).filter(Boolean).length} words
                  </span>
                  {!isAnswered && (
                    <button
                      onClick={handleMainsAnswer}
                      disabled={!mainsAnswer.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Submit Answer
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Feedback (AC 5) */}
            {showFeedback && currentQuestion.type === 'mcq' && (
              <div
                className={`mt-6 p-4 rounded-lg ${
                  isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="font-bold mb-2">{isCorrect ? '✓ Correct!' : '✗ Incorrect'}</div>
                <p className="text-sm">
                  {isCorrect
                    ? 'Well done! Moving to next question...'
                    : `The correct answer is: ${currentQuestion.correct_answer}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Footer (AC 4) */}
      <div className="bg-white border-t px-6 py-4">
        <div className="max-w-3xl mx-auto flex justify-between">
          <button
            onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="px-6 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            ← Previous
          </button>
          <button
            onClick={() => {
              if (currentIndex === questions.length - 1) {
                handleComplete();
              } else {
                goToQuestion(currentIndex + 1);
              }
            }}
            disabled={loading}
            className={`px-8 py-2 rounded-lg font-semibold ${
              currentIndex === questions.length - 1
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Saving...' : currentIndex === questions.length - 1 ? 'Finish Session' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
