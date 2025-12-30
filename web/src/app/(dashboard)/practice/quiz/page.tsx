'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  gs_paper: string;
  topic: string;
  difficulty: string;
}

interface QuizResult {
  question_id: string;
  selected_option: number;
  correct_option: number;
  is_correct: boolean;
  explanation: string;
  confidence?: number;
}

interface QuizData {
  quiz_id: string;
  date: string;
  questions: QuizQuestion[];
  total_questions: number;
}

interface UserStats {
  streak: { current: number; longest: number };
  today_completed: boolean;
  today_score: number;
  overall: {
    total_quizzes: number;
    avg_score: number;
    accuracy: number;
  };
  badges: Array<{ id: string; name: string; icon: string; description: string }>;
}

export default function DailyQuizPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const fetchQuiz = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('daily_quiz_pipe', {
        body: { action: 'get_daily' },
      });

      if (data?.success) {
        setQuizData(data.data);
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('daily_quiz_pipe', {
        body: { action: 'get_stats' },
      });

      if (data?.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchQuiz();
    fetchStats();
  }, [fetchQuiz, fetchStats]);

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleConfidence = (questionId: string, confidence: number) => {
    setConfidences((prev) => ({ ...prev, [questionId]: confidence }));
  };

  const handleSubmit = async () => {
    if (!quizData) return;

    const answers = quizData.questions.map((q) => ({
      question_id: q.id,
      selected_option: selectedAnswers[q.id] ?? 0,
      confidence: confidences[q.id] ?? 3,
    }));

    try {
      const { data } = await supabase.functions.invoke('daily_quiz_pipe', {
        body: {
          action: 'submit',
          attempt_id: quizData.quiz_id,
          answers,
          time_taken_seconds: 600, // 10 minutes default
        },
      });

      if (data?.success) {
        setResults(data.data.results);
        setScore(data.data.score);
        setSubmitted(true);
        fetchStats();
      }
    } catch (err) {
      console.error('Error submitting quiz:', err);
    }
  };

  const handleRetry = () => {
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setConfidences({});
    setSubmitted(false);
    setResults([]);
    setScore(0);
    fetchQuiz();
  };

  const getOptionClass = (question: QuizQuestion, optionIndex: number) => {
    if (!submitted) {
      return selectedAnswers[question.id] === optionIndex
        ? 'border-neon-blue bg-neon-blue/20'
        : 'border-white/10 hover:border-white/30';
    }

    const result = results.find((r) => r.question_id === question.id);
    if (!result) return 'border-white/10';

    if (optionIndex === result.correct_option) {
      return 'border-green-500 bg-green-500/20';
    }
    if (optionIndex === result.selected_option && !result.is_correct) {
      return 'border-red-500 bg-red-500/20';
    }
    return 'border-white/10 opacity-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show stats if already completed today
  if (stats?.today_completed && !quizData) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="neon-glass rounded-2xl p-8">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold text-white mb-2">Today's Quiz Complete!</h1>
            <p className="text-gray-400 mb-6">Come back tomorrow for a new set of questions</p>

            {stats.today_score !== null && (
              <div className="text-5xl font-bold text-neon-blue mb-6">
                {stats.today_score}%
              </div>
            )}

            <button
              onClick={() => window.location.href = '/dashboard/practice/quiz'}
              className="px-6 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 transition-colors"
            >
              View Today's Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="neon-glass p-8 rounded-2xl text-center">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-2xl font-bold text-white mb-2">No Quiz Available</h2>
          <p className="text-gray-400">Please try again later</p>
        </div>
      </div>
    );
  }

  const question = quizData.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quizData.questions.length) * 100;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white">Daily Quiz</h1>
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1 bg-slate-800 text-gray-400 rounded-lg text-sm hover:text-white"
            >
              📊 Stats
            </button>
          </div>

          {/* Stats Panel */}
          {showStats && stats && (
            <div className="neon-glass rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-400">🔥 {stats.streak.current}</p>
                  <p className="text-gray-400 text-xs">Day Streak</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-neon-blue">{stats.overall.avg_score}%</p>
                  <p className="text-gray-400 text-xs">Avg Score</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{stats.overall.total_quizzes}</p>
                  <p className="text-gray-400 text-xs">Quizzes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-400">{stats.overall.accuracy}%</p>
                  <p className="text-gray-400 text-xs">Accuracy</p>
                </div>
              </div>
              {stats.badges.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                  {stats.badges.map((badge) => (
                    <span key={badge.id} className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-400">
                      {badge.icon} {badge.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {!submitted && (
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-slate-800/50 rounded-full h-2">
                <div
                  className="h-full bg-neon-blue rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-gray-400 text-sm">
                {currentQuestion + 1}/{quizData.questions.length}
              </span>
            </div>
          )}
        </div>

        {/* Question Card */}
        <div className="neon-glass rounded-xl p-6 mb-6">
          {/* Question Header */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 bg-neon-blue/20 text-neon-blue text-xs rounded">
              {question.gs_paper}
            </span>
            <span className={`px-2 py-1 text-xs rounded ${
              question.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
              question.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {question.difficulty}
            </span>
            <span className="text-gray-500 text-xs">#{currentQuestion + 1}</span>
          </div>

          {/* Question Text */}
          <p className="text-white text-lg mb-6">{question.question_text}</p>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => !submitted && handleSelectAnswer(question.id, index)}
                disabled={submitted}
                className={`w-full p-4 rounded-xl text-left border transition-all ${getOptionClass(question, index)} ${
                  submitted ? '' : 'hover:bg-slate-700/50'
                }`}
              >
                <span className="inline-block w-8 h-8 bg-slate-800 rounded-lg text-center leading-8 mr-3 text-sm font-bold">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-gray-200">{option}</span>
              </button>
            ))}
          </div>

          {/* Confidence Slider (before submit) */}
          {!submitted && selectedAnswers[question.id] !== undefined && (
            <div className="mt-6 p-4 bg-slate-800/30 rounded-xl">
              <p className="text-gray-400 text-sm mb-3">How confident are you?</p>
              <div className="flex items-center gap-4">
                {[1, 2, 3, 4, 5].map((conf) => (
                  <button
                    key={conf}
                    onClick={() => handleConfidence(question.id, conf)}
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
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Not sure</span>
                <span>Very sure</span>
              </div>
            </div>
          )}

          {/* Explanation (after submit) */}
          {submitted && results[currentQuestion] && (
            <div className={`mt-6 p-4 rounded-xl ${
              results[currentQuestion].is_correct
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <p className={`font-medium mb-2 ${
                results[currentQuestion].is_correct ? 'text-green-400' : 'text-red-400'
              }`}>
                {results[currentQuestion].is_correct ? '✓ Correct!' : `✗ Incorrect (Answer: ${String.fromCharCode(65 + results[currentQuestion].correct_option)})`}
              </p>
              {results[currentQuestion].explanation && (
                <p className="text-gray-300 text-sm">{results[currentQuestion].explanation}</p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        {!submitted ? (
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
              className="px-4 py-3 bg-slate-800 text-white rounded-xl disabled:opacity-50"
            >
              Previous
            </button>

            {currentQuestion < quizData.questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestion((prev) => prev + 1)}
                className="flex-1 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={Object.keys(selectedAnswers).length < quizData.questions.length}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:bg-slate-700"
              >
                Submit Quiz
              </button>
            )}
          </div>
        ) : (
          /* Results View */
          <div className="space-y-6">
            {/* Score Card */}
            <div className="neon-glass rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-2">Your Score</p>
              <p className={`text-6xl font-bold ${
                score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {score}%
              </p>
              <p className="text-gray-400 mt-2">
                {results.filter((r) => r.is_correct).length} out of {results.length} correct
              </p>
            </div>

            {/* Question Navigator */}
            <div className="neon-glass rounded-xl p-4">
              <p className="text-white font-medium mb-3">Question Navigator</p>
              <div className="flex flex-wrap gap-2">
                {results.map((result, index) => (
                  <button
                    key={result.question_id}
                    onClick={() => setCurrentQuestion(index)}
                    className={`w-10 h-10 rounded-lg font-bold text-sm ${
                      currentQuestion === index
                        ? 'bg-neon-blue text-white'
                        : result.is_correct
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleRetry}
              className="w-full py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80"
            >
              Retry Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
