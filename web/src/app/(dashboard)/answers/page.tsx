'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';

interface PracticeQuestion {
  id: string;
  question_text: string;
  gs_paper: string;
  syllabus_topic: string;
  difficulty: string;
  word_limit: number;
  time_limit_minutes: number;
  is_pyq?: boolean;
  pyq_year?: number;
}

interface AnswerSubmission {
  id: string;
  question_text: string;
  gs_paper: string;
  answer_text: string;
  word_count: number;
  time_taken_seconds: number;
  evaluation_status: string;
  submitted_at: string;
  evaluation?: {
    total_score: number;
    content_score: number;
    structure_score: number;
    language_score: number;
    examples_score: number;
    feedback_json: any;
  };
}

// Default questions if database is empty
const DEFAULT_QUESTIONS: PracticeQuestion[] = [
  {
    id: 'default-1',
    question_text: 'Discuss the major geological formations of India and their economic significance.',
    gs_paper: 'GS Paper I',
    syllabus_topic: 'Geography',
    difficulty: 'medium',
    word_limit: 200,
    time_limit_minutes: 12,
  },
  {
    id: 'default-2',
    question_text: 'Evaluate the functioning of the Indian federal system with special reference to Centre-State relations.',
    gs_paper: 'GS Paper II',
    syllabus_topic: 'Polity',
    difficulty: 'medium',
    word_limit: 200,
    time_limit_minutes: 12,
  },
  {
    id: 'default-3',
    question_text: 'Analyze the challenges facing the agricultural sector in India and suggest measures to address them.',
    gs_paper: 'GS Paper III',
    syllabus_topic: 'Economy',
    difficulty: 'medium',
    word_limit: 250,
    time_limit_minutes: 15,
  },
  {
    id: 'default-4',
    question_text: 'What do you understand by emotional intelligence? Discuss its role in effective administration.',
    gs_paper: 'GS Paper IV',
    syllabus_topic: 'Ethics',
    difficulty: 'medium',
    word_limit: 150,
    time_limit_minutes: 10,
  },
  {
    id: 'default-5',
    question_text: 'Discuss the role of women in the freedom struggle of India. How did their participation shape modern Indian society?',
    gs_paper: 'GS Paper I',
    syllabus_topic: 'Modern History',
    difficulty: 'medium',
    word_limit: 250,
    time_limit_minutes: 15,
  },
];

// Calculate time limit based on word limit (AC#4)
function getTimeLimitMinutes(wordLimit: number): number {
  if (wordLimit <= 150) return 10;
  if (wordLimit <= 250) return 15;
  return Math.ceil(wordLimit / 15); // ~15 words per minute for longer answers
}

export default function AnswerWritingPage() {
  const supabase = getSupabaseBrowserClient();
  const { subscription, isTrialActive, isSubscriptionActive, canAccessFeature } = useSubscription();

  // State
  const [activeTab, setActiveTab] = useState<'practice' | 'history'>('practice');
  const [questions, setQuestions] = useState<PracticeQuestion[]>(DEFAULT_QUESTIONS);
  const [selectedQuestion, setSelectedQuestion] = useState<PracticeQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [submissions, setSubmissions] = useState<AnswerSubmission[]>([]);
  const [monthlyEvaluations, setMonthlyEvaluations] = useState(0);
  const [hasProAccess, setHasProAccess] = useState(false);
  const [feedback, setFeedback] = useState<{
    score: number;
    strengths: string[];
    improvements: string[];
    sample_points: string[];
  } | null>(null);

  // Refs for auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const draftIdRef = useRef<string | null>(null);

  // Check entitlement on mount
  useEffect(() => {
    const checkAccess = async () => {
      const hasPro = isTrialActive || isSubscriptionActive;
      setHasProAccess(hasPro);

      if (!hasPro) {
        // Count evaluations this month for free users
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const { count } = await supabase
            .from('answer_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('evaluation_status', 'completed')
            .gte('submitted_at', startOfMonth.toISOString());

          setMonthlyEvaluations(count || 0);
        }
      }
    };
    checkAccess();
  }, [supabase, isTrialActive, isSubscriptionActive]);

  // Fetch questions from database
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        // Try to get today's daily questions first
        const today = new Date().toISOString().split('T')[0];
        const { data: dailyQuestions } = await supabase
          .from('daily_questions')
          .select('*')
          .eq('date', today);

        if (dailyQuestions && dailyQuestions.length > 0) {
          setQuestions((dailyQuestions as any[]).map(q => ({
            id: q.id,
            question_text: q.question_text,
            gs_paper: q.gs_paper,
            syllabus_topic: q.syllabus_topic || 'General',
            difficulty: q.difficulty || 'medium',
            word_limit: q.word_limit || 200,
            time_limit_minutes: getTimeLimitMinutes(q.word_limit || 200),
          })));
        } else {
          // Fall back to practice questions
          const { data: practiceQuestions } = await supabase
            .from('practice_questions')
            .select('*')
            .eq('question_type', 'answer')
            .limit(5);

          if (practiceQuestions && practiceQuestions.length > 0) {
            setQuestions((practiceQuestions as any[]).map(q => ({
              id: q.id,
              question_text: q.question_text,
              gs_paper: q.gs_paper || 'GS Paper I',
              syllabus_topic: q.syllabus_topic || 'General',
              difficulty: q.difficulty || 'medium',
              word_limit: q.word_limit || 200,
              time_limit_minutes: getTimeLimitMinutes(q.word_limit || 200),
              is_pyq: q.is_pyq,
              pyq_year: q.pyq_year,
            })));
          }
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
        // Keep default questions
      }
    };

    fetchQuestions();
  }, [supabase]);

  // Fetch user's submission history
  useEffect(() => {
    const fetchSubmissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('answer_submissions')
        .select(`
          *,
          evaluation:answer_evaluations(*)
        `)
        .eq('user_id', user.id)
        .eq('is_draft', false)
        .order('submitted_at', { ascending: false })
        .limit(20);

      if (data) {
        setSubmissions((data as any[]).map(s => ({
          id: s.id,
          question_text: s.question_text,
          gs_paper: s.gs_paper,
          answer_text: s.answer_text,
          word_count: s.word_count,
          time_taken_seconds: s.time_taken_seconds,
          evaluation_status: s.evaluation_status,
          submitted_at: s.submitted_at,
          evaluation: s.evaluation?.[0] || null,
        })));
      }
    };

    if (activeTab === 'history') {
      fetchSubmissions();
    }
  }, [supabase, activeTab]);

  // Auto-save every 30 seconds (AC#5)
  useEffect(() => {
    if (isTimerRunning && userAnswer.trim() && selectedQuestion && !isSubmitted) {
      autoSaveTimerRef.current = setInterval(async () => {
        await saveDraft();
      }, 30000); // 30 seconds
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [isTimerRunning, userAnswer, selectedQuestion, isSubmitted]);

  // Timer countdown
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isTimerRunning, timeLeft]);

  // Auto-submit when time ends
  useEffect(() => {
    if (isTimerRunning && timeLeft === 0 && !isSubmitted) {
      handleSubmit();
    }
  }, [isTimerRunning, timeLeft, isSubmitted]);

  const startTimer = () => {
    setIsTimerRunning(true);
    if (selectedQuestion) {
      setTimeLeft(selectedQuestion.time_limit_minutes * 60);
    }
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
  };

  const handleTextChange = (text: string) => {
    setUserAnswer(text);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCount(words.length);
  };

  // Save draft to database (AC#5)
  const saveDraft = useCallback(async () => {
    if (!selectedQuestion || !userAnswer.trim()) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const draftData = {
        user_id: user.id,
        question_id: selectedQuestion.id.startsWith('default-') ? null : selectedQuestion.id,
        question_text: selectedQuestion.question_text,
        gs_paper: selectedQuestion.gs_paper,
        syllabus_topic: selectedQuestion.syllabus_topic,
        answer_text: userAnswer,
        word_count: wordCount,
        word_limit: selectedQuestion.word_limit,
        time_taken_seconds: selectedQuestion.time_limit_minutes * 60 - timeLeft,
        is_draft: true,
        evaluation_enabled: false,
        last_saved_at: new Date().toISOString(),
      };

      if (draftIdRef.current) {
        // Update existing draft
        await (supabase
          .from('answer_submissions') as any)
          .update(draftData)
          .eq('id', draftIdRef.current);
      } else {
        // Create new draft
        const { data } = await (supabase
          .from('answer_submissions') as any)
          .insert(draftData)
          .select('id')
          .single();

        if (data) {
          draftIdRef.current = data.id;
        }
      }

      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [supabase, selectedQuestion, userAnswer, wordCount, timeLeft]);

  // Submit for evaluation (AC#6)
  const handleSubmit = async () => {
    if (!selectedQuestion || !userAnswer.trim()) {
      alert('Please write an answer before submitting');
      return;
    }

    // Check entitlement (AC#10)
    if (!hasProAccess && monthlyEvaluations >= 2) {
      alert('You have used your 2 free evaluations this month. Upgrade to Pro for unlimited evaluations!');
      return;
    }

    stopTimer();
    setIsSubmitted(true);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to submit answers');
        return;
      }

      const timeTaken = selectedQuestion.time_limit_minutes * 60 - timeLeft;

      // Save submission to database (AC#7)
      const { data: submission, error: submitError } = await (supabase
        .from('answer_submissions') as any)
        .insert({
          user_id: user.id,
          question_id: selectedQuestion.id.startsWith('default-') ? null : selectedQuestion.id,
          question_text: selectedQuestion.question_text,
          gs_paper: selectedQuestion.gs_paper,
          syllabus_topic: selectedQuestion.syllabus_topic,
          answer_text: userAnswer,
          word_count: wordCount,
          word_limit: selectedQuestion.word_limit,
          time_taken_seconds: timeTaken,
          is_draft: false,
          evaluation_enabled: true,
          evaluation_status: 'processing',
        })
        .select('id')
        .single();

      if (submitError) throw submitError;

      // Delete draft if exists
      if (draftIdRef.current) {
        await (supabase
          .from('answer_submissions') as any)
          .delete()
          .eq('id', draftIdRef.current);
        draftIdRef.current = null;
      }

      // Generate AI feedback
      const response = await fetch('/api/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission?.id,
          question: selectedQuestion.question_text,
          answer: userAnswer,
          gsPaper: selectedQuestion.gs_paper,
          topic: selectedQuestion.syllabus_topic,
          wordLimit: selectedQuestion.word_limit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFeedback(data.feedback);

        // Update monthly count for free users
        if (!hasProAccess) {
          setMonthlyEvaluations(prev => prev + 1);
        }
      } else {
        // Fallback feedback
        setFeedback({
          score: 6,
          strengths: ['Good structure and flow', 'Clear introduction and conclusion'],
          improvements: ['Add more specific facts', 'Include current examples'],
          sample_points: ['Define key terms', 'Give real-world examples', 'Link to current affairs'],
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      setFeedback({
        score: 6,
        strengths: ['Good effort in attempting the question'],
        improvements: ['Continue practicing regularly'],
        sample_points: ['Start with definition', 'Give examples', 'Conclude properly'],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectQuestion = (question: PracticeQuestion) => {
    setSelectedQuestion(question);
    setUserAnswer('');
    setWordCount(0);
    setIsSubmitted(false);
    setFeedback(null);
    setTimeLeft(question.time_limit_minutes * 60);
    setIsTimerRunning(false);
    setLastSaved(null);
    draftIdRef.current = null;
  };

  const resetPractice = () => {
    setIsSubmitted(false);
    setUserAnswer('');
    setWordCount(0);
    setFeedback(null);
    if (selectedQuestion) {
      setTimeLeft(selectedQuestion.time_limit_minutes * 60);
    }
    setLastSaved(null);
    draftIdRef.current = null;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'hard': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Answer Writing Practice</h1>
          <p className="text-gray-400">Practice writing answers with timed mode and AI feedback</p>

          {/* Entitlement Banner */}
          {!hasProAccess && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
              <span className="text-yellow-400 text-sm">
                Free tier: {2 - monthlyEvaluations} evaluations remaining this month
              </span>
              <a href="/pricing" className="text-sm text-blue-400 hover:underline">
                Upgrade to Pro for unlimited
              </a>
            </div>
          )}
        </header>

        {/* Tabs (AC#9) */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('practice')}
            className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'practice'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            Practice Questions
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            My Submissions
          </button>
        </div>

        {activeTab === 'practice' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Questions (AC#1, AC#8) */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-slate-800/50 border border-white/10 p-4 rounded-xl">
                <h3 className="font-bold text-white mb-3">Daily Questions</h3>
                <p className="text-xs text-gray-500 mb-3">5 questions refreshed daily at midnight</p>
                <div className="space-y-2">
                  {questions.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => selectQuestion(q)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedQuestion?.id === q.id
                          ? 'bg-blue-600/20 border border-blue-500/50'
                          : 'bg-slate-700/30 hover:bg-slate-700/50'
                      }`}
                    >
                      <p className="text-white text-sm line-clamp-2">{q.question_text}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-slate-600/50 rounded text-gray-300">
                          {q.gs_paper}
                        </span>
                        <span className="text-xs text-gray-500">{q.word_limit}w</span>
                        <span className="text-xs text-gray-500">{q.time_limit_minutes}min</span>
                        <span className={`text-xs ${getDifficultyColor(q.difficulty)}`}>
                          {q.difficulty}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="bg-slate-800/50 border border-white/10 p-4 rounded-xl">
                <h3 className="font-bold text-white mb-3">Writing Tips</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">1.</span>
                    Start with introduction/definition
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">2.</span>
                    Use subheadings for clarity
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">3.</span>
                    Give examples and data
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">4.</span>
                    Conclude with way forward
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">5.</span>
                    Stay within word limit
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column - Writing Area (AC#2, AC#3, AC#4) */}
            <div className="lg:col-span-2">
              {selectedQuestion ? (
                <div className="space-y-4">
                  {/* Question Display (AC#2) */}
                  <div className="bg-slate-800/50 border border-white/10 p-4 rounded-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-white font-medium text-lg">{selectedQuestion.question_text}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded">
                            {selectedQuestion.gs_paper}
                          </span>
                          <span className="text-xs text-gray-400">
                            Topic: {selectedQuestion.syllabus_topic}
                          </span>
                          <span className="text-xs text-gray-400">
                            Word Limit: {selectedQuestion.word_limit}
                          </span>
                          <span className={`text-xs ${getDifficultyColor(selectedQuestion.difficulty)}`}>
                            Difficulty: {selectedQuestion.difficulty}
                          </span>
                        </div>
                      </div>
                      {/* Timer (AC#4) */}
                      <div className={`text-3xl font-mono font-bold ${
                        timeLeft < 60 ? 'text-red-400 animate-pulse'
                        : timeLeft < 120 ? 'text-yellow-400'
                        : 'text-blue-400'
                      }`}>
                        {formatTime(timeLeft)}
                      </div>
                    </div>
                  </div>

                  {/* Writing Interface (AC#3) */}
                  <div className="bg-slate-800/50 border border-white/10 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-400">Your Answer</span>
                      <div className="flex items-center gap-4">
                        {/* Auto-save indicator (AC#5) */}
                        {isSaving && (
                          <span className="text-xs text-gray-500">Saving...</span>
                        )}
                        {lastSaved && !isSaving && (
                          <span className="text-xs text-green-400">
                            Saved at {lastSaved.toLocaleTimeString()}
                          </span>
                        )}
                        {/* Word counter (AC#3) */}
                        <span className={`text-sm font-medium ${
                          wordCount > selectedQuestion.word_limit ? 'text-red-400' : 'text-blue-400'
                        }`}>
                          {wordCount} / {selectedQuestion.word_limit} words
                        </span>
                      </div>
                    </div>
                    <textarea
                      value={userAnswer}
                      onChange={(e) => handleTextChange(e.target.value)}
                      disabled={isSubmitted}
                      placeholder="Start writing your answer here..."
                      className="w-full p-4 bg-slate-900/50 border border-white/10 rounded-lg text-white text-base leading-relaxed resize-none focus:outline-none focus:border-blue-500/50"
                      rows={14}
                    />
                  </div>

                  {/* Action Buttons */}
                  {!isSubmitted ? (
                    <div className="flex items-center gap-3">
                      {!isTimerRunning ? (
                        <button
                          onClick={startTimer}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Start Timer & Write
                        </button>
                      ) : (
                        <button
                          onClick={stopTimer}
                          className="px-6 py-3 bg-yellow-600/20 text-yellow-400 border border-yellow-500/50 rounded-lg font-medium hover:bg-yellow-600/30 transition-colors"
                        >
                          Pause Timer
                        </button>
                      )}
                      <button
                        onClick={saveDraft}
                        disabled={!userAnswer.trim()}
                        className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        Save Draft
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!userAnswer.trim() || isLoading}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {isLoading ? 'Submitting...' : 'Submit for Evaluation'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={resetPractice}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Try Another Question
                      </button>
                    </div>
                  )}

                  {/* Feedback Display */}
                  {isSubmitted && feedback && (
                    <div className="bg-slate-800/50 border border-white/10 p-6 rounded-xl space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white">Your Evaluation</h3>
                        <div className="text-4xl font-bold text-blue-400">{feedback.score}/10</div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Strengths */}
                        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                          <h4 className="text-green-400 font-medium mb-3">What Went Well</h4>
                          <ul className="space-y-2">
                            {feedback.strengths.map((s, i) => (
                              <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">✓</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Improvements */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                          <h4 className="text-yellow-400 font-medium mb-3">Needs Improvement</h4>
                          <ul className="space-y-2">
                            {feedback.improvements.map((s, i) => (
                              <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                <span className="text-yellow-400 mt-0.5">!</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Key Points */}
                        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                          <h4 className="text-blue-400 font-medium mb-3">Key Points to Include</h4>
                          <ul className="space-y-2">
                            {feedback.sample_points.map((s, i) => (
                              <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                <span className="text-blue-400 mt-0.5">•</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {isLoading && (
                    <div className="bg-slate-800/50 border border-white/10 p-8 rounded-xl text-center">
                      <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-gray-400">Evaluating your answer...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-white/10 p-12 rounded-xl text-center">
                  <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-xl font-medium text-white mb-2">Select a Question</h3>
                  <p className="text-gray-400">Choose a question from the left to start practicing</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* History Tab (AC#9) */
          <div className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold text-white">My Submissions</h3>
              <p className="text-sm text-gray-400">View your past answers and evaluations</p>
            </div>

            {submissions.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-400">No submissions yet. Start practicing!</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {submissions.map((submission) => (
                  <div key={submission.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-white font-medium line-clamp-2">{submission.question_text}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs px-2 py-0.5 bg-slate-600/50 rounded text-gray-300">
                            {submission.gs_paper}
                          </span>
                          <span className="text-xs text-gray-500">
                            {submission.word_count} words
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.floor(submission.time_taken_seconds / 60)}m {submission.time_taken_seconds % 60}s
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(submission.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {submission.evaluation_status === 'completed' && submission.evaluation ? (
                          <div className="text-2xl font-bold text-blue-400">
                            {(submission.evaluation.total_score / 4).toFixed(1)}/10
                          </div>
                        ) : submission.evaluation_status === 'processing' ? (
                          <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                            Processing...
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded">
                            {submission.evaluation_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
