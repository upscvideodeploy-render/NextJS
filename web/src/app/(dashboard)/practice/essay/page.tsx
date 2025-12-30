'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface EssayTopic {
  topic: string;
  category: string;
  difficulty: string;
  is_ai_generated: boolean;
}

interface EssaySubmission {
  id: string;
  topic: string;
  topic_category: string;
  word_count: number;
  time_taken_seconds: number;
  thesis_score: number;
  argument_score: number;
  evidence_score: number;
  structure_score: number;
  language_score: number;
  total_score: number;
  feedback_json: any;
  submitted_at: string;
}

const WORD_LIMITS = [
  { label: 'Short (1000 words)', value: 1000, time: 60 },
  { label: 'Standard (1250 words)', value: 1250, time: 75 },
  { label: 'Long (1500 words)', value: 1500, time: 90 },
];

const CATEGORIES = [
  { id: 'philosophical', label: 'Philosophical', icon: '🧠' },
  { id: 'social', label: 'Social', icon: '👥' },
  { id: 'economic', label: 'Economic', icon: '📈' },
  { id: 'political', label: 'Political', icon: '🏛️' },
  { id: 'environmental', label: 'Environmental', icon: '🌍' },
  { id: 'international', label: 'International', icon: '🌐' },
  { id: 'ethical', label: 'Ethical', icon: '⚖️' },
  { id: 'scientific', label: 'Scientific', icon: '🔬' },
];

export default function EssayTrainerPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [currentTopic, setCurrentTopic] = useState<EssayTopic | null>(null);
  const [essayText, setEssayText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [selectedWordLimit, setSelectedWordLimit] = useState(1250);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'history'>('write');
  const [submissions, setSubmissions] = useState<EssaySubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<EssaySubmission | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [loading, setLoading] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('essay_trainer_pipe', {
        body: { action: 'list_submissions', limit: 20 },
      });

      if (data?.success) {
        setSubmissions(data.data);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Timer effect
  useEffect(() => {
    if (isTimerRunning && currentTopic) {
      const timeLimit = WORD_LIMITS.find((l) => l.value === selectedWordLimit)?.time || 75;
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev >= timeLimit * 60) {
            setIsTimerRunning(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, currentTopic, selectedWordLimit]);

  const handleGenerateTopic = async (category?: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('essay_trainer_pipe', {
        body: { action: 'generate_topic', category },
      });

      if (data?.success) {
        setCurrentTopic(data.data);
        setEssayText('');
        setWordCount(0);
        setTimer(0);
        setIsTimerRunning(false);
        setShowFeedback(false);
      }
    } catch (err) {
      console.error('Error generating topic:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWordCount = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  };

  const handleSubmit = async () => {
    if (!currentTopic || !essayText.trim()) return;

    setIsSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke('essay_trainer_pipe', {
        body: {
          action: 'submit',
          topic: currentTopic.topic,
          essay_text: essayText,
          time_taken_seconds: timer,
        },
      });

      if (data?.success) {
        fetchSubmissions();
        // Show feedback after a short delay (evaluation takes time)
        setTimeout(() => {
          const submission = submissions.find((s) => s.topic === currentTopic.topic);
          if (submission) {
            setSelectedSubmission(submission);
            setShowFeedback(true);
          }
        }, 3000);
      }
    } catch (err) {
      console.error('Error submitting essay:', err);
    } finally {
      setIsSubmitting(false);
      setIsTimerRunning(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number, max: number = 50) => {
    const percentage = (score / max) * 100;
    if (percentage >= 70) return 'text-green-400';
    if (percentage >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCategoryIcon = (category: string) => {
    return CATEGORIES.find((c) => c.id === category)?.icon || '📝';
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Essay Writing Trainer</h1>
          <p className="text-gray-400">Master UPSC Essay with AI-powered evaluation</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('write')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'write'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Write Essay
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-neon-blue border-b-2 border-neon-blue'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Essays ({submissions.length})
          </button>
        </div>

        {/* Write Tab */}
        {activeTab === 'write' && (
          <div className="space-y-6">
            {!currentTopic ? (
              /* Topic Selection */
              <div className="space-y-6">
                <div className="neon-glass rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-white mb-4">Select a Topic</h2>
                  <p className="text-gray-400 mb-4">Choose a category to generate an essay topic</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleGenerateTopic(cat.id)}
                        disabled={loading}
                        className="p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-colors text-center disabled:opacity-50"
                      >
                        <span className="text-2xl mb-2 block">{cat.icon}</span>
                        <span className="text-white text-sm">{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleGenerateTopic()}
                    disabled={loading}
                    className="w-full py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      '🎲 Random Topic'
                    )}
                  </button>
                </div>

                <div className="neon-glass rounded-xl p-6">
                  <h3 className="text-white font-medium mb-3">Essay Format Guide</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="p-3 bg-slate-800/30 rounded-lg">
                      <p className="text-neon-blue font-medium mb-1">Introduction (150-200 words)</p>
                      <p className="text-gray-400">Hook + Context + Thesis Statement + Roadmap</p>
                    </div>
                    <div className="p-3 bg-slate-800/30 rounded-lg">
                      <p className="text-neon-blue font-medium mb-1">Body (800-1000 words)</p>
                      <p className="text-gray-400">2-3 arguments with examples, counter-arguments, analysis</p>
                    </div>
                    <div className="p-3 bg-slate-800/30 rounded-lg">
                      <p className="text-neon-blue font-medium mb-1">Conclusion (150-200 words)</p>
                      <p className="text-gray-400">Summary + Future outlook + Final thought</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Writing Interface */
              <div className="space-y-4">
                {/* Topic Card */}
                <div className="neon-glass rounded-xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getCategoryIcon(currentTopic.category)}</span>
                        <span className="px-2 py-1 bg-slate-700 text-gray-300 text-xs rounded capitalize">
                          {currentTopic.category}
                        </span>
                        {currentTopic.is_ai_generated && (
                          <span className="px-2 py-1 bg-neon-blue/20 text-neon-blue text-xs rounded">
                            AI Generated
                          </span>
                        )}
                      </div>
                      <p className="text-white text-lg font-medium">{currentTopic.topic}</p>
                    </div>
                    <button
                      onClick={() => { setCurrentTopic(null); setEssayText(''); setWordCount(0); }}
                      className="text-gray-400 hover:text-white"
                    >
                      ✕ New Topic
                    </button>
                  </div>
                </div>

                {/* Word Limit & Timer */}
                <div className="neon-glass rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-sm">Word Limit:</span>
                      <select
                        value={selectedWordLimit}
                        onChange={(e) => setSelectedWordLimit(Number(e.target.value))}
                        className="px-3 py-1 bg-slate-800/50 border border-white/10 rounded text-white text-sm"
                      >
                        {WORD_LIMITS.map((limit) => (
                          <option key={limit.value} value={limit.value}>
                            {limit.value} words ({limit.time} min)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={wordCount > selectedWordLimit ? 'text-red-400' : 'text-gray-400'}>
                        Words: {wordCount} / {selectedWordLimit}
                      </span>
                      <span className={timer >= (WORD_LIMITS.find((l) => l.value === selectedWordLimit)?.time || 75) * 60 ? 'text-red-400' : 'text-gray-400'}>
                        Time: {formatTime(timer)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Editor */}
                <div className="neon-glass rounded-xl p-6">
                  <textarea
                    value={essayText}
                    onChange={(e) => {
                      setEssayText(e.target.value);
                      handleWordCount(e.target.value);
                    }}
                    placeholder={`Write your essay here...

Structure your essay:
1. Introduction - Hook the reader, provide context, state your thesis
2. Body - Present arguments with examples, data, case studies
3. Conclusion - Summarize key points, offer forward-looking perspective

Tip: Use transitions like "However", "Moreover", "Therefore" to improve flow.`}
                    className="w-full h-96 bg-slate-800/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue resize-none"
                  />
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      wordCount >= selectedWordLimit ? 'bg-green-500' : 'bg-neon-blue'
                    }`}
                    style={{ width: `${Math.min((wordCount / selectedWordLimit) * 100, 100)}%` }}
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || wordCount < 500}
                  className="w-full py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Evaluating Essay...
                    </span>
                  ) : (
                    `Submit for Evaluation (${wordCount} words)`
                  )}
                </button>

                {wordCount < 500 && (
                  <p className="text-gray-500 text-sm text-center">
                    Write at least 500 words to submit
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="neon-glass rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-white mb-2">No Essays Yet</h3>
                <p className="text-gray-400">Start writing essays to see your progress</p>
              </div>
            ) : (
              submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="neon-glass rounded-xl p-6 hover:border-neon-blue/30 transition-colors cursor-pointer"
                  onClick={() => { setSelectedSubmission(submission); setShowFeedback(true); }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{getCategoryIcon(submission.topic_category)}</span>
                        <span className="px-2 py-1 bg-slate-700 text-gray-300 text-xs rounded capitalize">
                          {submission.topic_category}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {new Date(submission.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-white mb-2 line-clamp-2">{submission.topic}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{submission.word_count} words</span>
                        <span>{formatTime(submission.time_taken_seconds)}</span>
                      </div>
                    </div>
                    {submission.total_score > 0 && (
                      <div className="text-right">
                        <p className={`text-3xl font-bold ${getScoreColor(submission.total_score, 50)}`}>
                          {Math.round(submission.total_score)}/50
                        </p>
                        <p className="text-gray-400 text-sm">Score</p>
                      </div>
                    )}
                    {submission.total_score === 0 && (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded">
                        Evaluating...
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Feedback Modal */}
        {showFeedback && selectedSubmission && selectedSubmission.total_score > 0 && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="neon-glass p-6 rounded-2xl max-w-3xl w-full my-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Essay Evaluation</h2>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              {/* Topic */}
              <div className="mb-6">
                <p className="text-gray-400 text-sm">Topic</p>
                <p className="text-white font-medium">{selectedSubmission.topic}</p>
              </div>

              {/* Total Score */}
              <div className="p-6 bg-gradient-to-r from-neon-blue/20 to-purple-500/20 rounded-xl text-center mb-6">
                <p className="text-gray-400 text-sm mb-2">Total Score</p>
                <p className={`text-6xl font-bold ${getScoreColor(selectedSubmission.total_score, 50)}`}>
                  {Math.round(selectedSubmission.total_score)}/50
                </p>
              </div>

              {/* Score Breakdown */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                <ScoreBar label="Thesis" score={selectedSubmission.thesis_score} max={10} />
                <ScoreBar label="Arguments" score={selectedSubmission.argument_score} max={10} />
                <ScoreBar label="Evidence" score={selectedSubmission.evidence_score} max={10} />
                <ScoreBar label="Structure" score={selectedSubmission.structure_score} max={10} />
                <ScoreBar label="Language" score={selectedSubmission.language_score} max={10} />
              </div>

              {/* Feedback */}
              {selectedSubmission.feedback_json && (
                <div className="space-y-4">
                  {selectedSubmission.feedback_json.strengths?.length > 0 && (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                      <h4 className="text-green-400 font-medium mb-2">✓ Strengths</h4>
                      <ul className="space-y-1">
                        {selectedSubmission.feedback_json.strengths.map((s: string, i: number) => (
                          <li key={i} className="text-gray-300 text-sm">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedSubmission.feedback_json.improvements?.length > 0 && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <h4 className="text-yellow-400 font-medium mb-2">◈ Areas to Improve</h4>
                      <ul className="space-y-1">
                        {selectedSubmission.feedback_json.improvements.map((s: string, i: number) => (
                          <li key={i} className="text-gray-300 text-sm">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowFeedback(false)}
                className="w-full py-3 mt-6 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Score Bar Component
 */
function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const percentage = (score / max) * 100;
  const color = percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg text-center">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      <div className="flex items-center justify-center mb-1">
        <span className={`text-xl font-bold ${percentage >= 70 ? 'text-green-400' : percentage >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {score}
        </span>
        <span className="text-gray-500 text-xs">/{max}</span>
      </div>
      <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
