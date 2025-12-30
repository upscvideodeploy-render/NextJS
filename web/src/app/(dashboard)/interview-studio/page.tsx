'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Question {
  id: string;
  number: number;
  question: string;
  category: string;
  follow_up: string[];
  ideal_points: string[];
  sample_answer?: string;
  evaluation?: any;
  user_response?: string;
}

interface Session {
  session_id: string;
  session_type: string;
  difficulty: string;
  total_questions: number;
  current_question: Question;
}

export default function InterviewStudioPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [response, setResponse] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [sessionMode, setSessionMode] = useState<'setup' | 'interview' | 'summary'>('setup');
  const [sessionConfig, setSessionConfig] = useState({
    session_type: 'general' as const,
    difficulty: 'medium' as const,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startNewSession = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('interview_studio_pipe', {
        body: sessionConfig,
      });

      if (data?.success) {
        setSession({
          session_id: data.data.session_id,
          session_type: data.data.session_type,
          difficulty: data.data.difficulty,
          total_questions: data.data.total_questions,
          current_question: data.data.current_question,
        });
        setQuestions(data.data.questions || []);
        setCurrentIndex(0);
        setResponse('');
        setEvaluation(null);
        setSessionMode('interview');
      }
    } catch (err) {
      console.error('Error starting session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Convert to text (in real implementation, use STT)
      setTimeout(() => {
        // Placeholder - would use speech-to-text
        setResponse('Transcribed response would appear here...');
      }, 1000);
    }
  };

  const handleSubmitResponse = async () => {
    if (!response.trim()) return;

    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('interview_studio_pipe', {
        body: {
          current_question_index: currentIndex,
          user_response: response,
          response_duration_seconds: recordingTime,
        },
      });

      if (data?.success) {
        setEvaluation(data.data.evaluation);

        // Add evaluation to current question
        setQuestions((prev) => {
          const updated = [...prev];
          if (updated[currentIndex]) {
            updated[currentIndex] = {
              ...updated[currentIndex],
              evaluation: data.data.evaluation,
              user_response: response,
            };
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Error evaluating response:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setResponse('');
      setEvaluation(null);
      setRecordingTime(0);
    } else {
      setSessionMode('summary');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  if (sessionMode === 'setup') {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Interview Studio</h1>
            <p className="text-gray-400">Practice UPSC personality tests with AI-powered mock interviews</p>
          </div>

          <div className="neon-glass rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-6">Session Configuration</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-gray-300 mb-3">Interview Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'general', label: 'General Interview', desc: 'Broad questions across topics' },
                    { value: 'daf_based', label: 'DAF Based', desc: 'Based on your background' },
                    { value: 'current_affairs', label: 'Current Affairs', desc: 'Focus on recent events' },
                    { value: 'optional_subject', label: 'Optional Subject', desc: 'Deep dive into optional' },
                    { value: 'mock_full', label: 'Full Mock', desc: 'Complete interview simulation', },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSessionConfig((c) => ({ ...c, session_type: type.value as any }))}
                      className={`p-4 rounded-xl text-left transition-all ${
                        sessionConfig.session_type === type.value
                          ? 'bg-neon-blue/20 border-2 border-neon-blue'
                          : 'bg-slate-800/50 border-2 border-transparent hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-white">{type.label}</div>
                      <div className="text-sm text-gray-400">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-3">Difficulty Level</label>
                <div className="flex gap-3">
                  {[
                    { value: 'easy', label: 'Easy', desc: 'Warm-up questions' },
                    { value: 'medium', label: 'Medium', desc: 'Standard difficulty' },
                    { value: 'hard', label: 'Hard', desc: 'Challenging questions' },
                    { value: 'actual', label: 'Actual Level', desc: 'UPSC board level' },
                  ].map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setSessionConfig((c) => ({ ...c, difficulty: level.value as any }))}
                      className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                        sessionConfig.difficulty === level.value
                          ? 'bg-neon-blue text-white'
                          : 'bg-slate-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startNewSession}
                disabled={loading}
                className="w-full py-4 bg-neon-blue text-white rounded-xl font-medium hover:bg-neon-blue/80 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Start Interview
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-8 neon-glass rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Tips for Success</h3>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-start gap-3">
                <span className="text-neon-blue">1.</span>
                Be authentic - interviewers can detect rehearsed answers
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-blue">2.</span>
                Use specific examples from your experience
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-blue">3.</span>
                Stay calm - pause and think before answering
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-blue">4.</span>
                Maintain eye contact and confident body language
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (sessionMode === 'interview' && currentQuestion) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Question {currentIndex + 1} of {questions.length}</span>
              <span className="text-gray-400">{Math.round(progress)}% complete</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-neon-blue transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="neon-glass rounded-2xl p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-neon-blue/20 text-neon-blue rounded-full text-sm">
                {currentQuestion.category.replace('_', ' ')}
              </span>
              {evaluation && (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                  Evaluated
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-white mb-6">{currentQuestion.question}</h2>

            {currentQuestion.follow_up && currentQuestion.follow_up.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-2">Potential follow-ups:</p>
                <ul className="space-y-1">
                  {currentQuestion.follow_up.map((fq, i) => (
                    <li key={i} className="text-gray-300 text-sm">• {fq}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Response Area */}
          {!evaluation ? (
            <div className="neon-glass rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Your Response</h3>
                <div className="flex items-center gap-4">
                  <span className="text-gray-400 text-sm">{formatTime(recordingTime)}</span>
                  <button
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                      isRecording
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-neon-blue text-white'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </button>
                </div>
              </div>

              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your response here, or use voice recording..."
                className="w-full h-40 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
              />

              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSubmitResponse}
                  disabled={loading || !response.trim()}
                  className="px-6 py-3 bg-neon-blue text-white rounded-xl font-medium hover:bg-neon-blue/80 disabled:opacity-50"
                >
                  {loading ? 'Evaluating...' : 'Submit Response'}
                </button>
              </div>
            </div>
          ) : (
            /* Evaluation Results */
            <div className="neon-glass rounded-2xl p-6 mb-6">
              <h3 className="text-white font-medium mb-4">AI Evaluation</h3>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-white mb-1">
                    {evaluation.content_score}%
                  </div>
                  <div className="text-gray-400 text-sm">Content</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-white mb-1">
                    {evaluation.communication_score}%
                  </div>
                  <div className="text-gray-400 text-sm">Communication</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-white mb-1">
                    {evaluation.personality_score}%
                  </div>
                  <div className="text-gray-400 text-sm">Personality</div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-white font-medium mb-2">Feedback</h4>
                <p className="text-gray-300">{evaluation.feedback}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-green-400 font-medium mb-2">Key Points</h4>
                  <ul className="space-y-1">
                    {evaluation.key_points?.map((kp: string, i: number) => (
                      <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-yellow-400 font-medium mb-2">Areas to Improve</h4>
                  <ul className="space-y-1">
                    {evaluation.improvement_suggestions?.map((imp: string, i: number) => (
                      <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                        <span className="text-yellow-400">→</span>
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={handleNextQuestion}
                  className="px-6 py-3 bg-neon-blue text-white rounded-xl font-medium hover:bg-neon-blue/80"
                >
                  {currentIndex < questions.length - 1 ? 'Next Question →' : 'View Summary →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (sessionMode === 'summary') {
    const avgContent = questions.reduce((sum, q) => sum + (q.evaluation?.rubric_scores?.content || 0), 0) / questions.length;
    const avgCommunication = questions.reduce((sum, q) => sum + (q.evaluation?.rubric_scores?.communication || 0), 0) / questions.length;
    const avgPersonality = questions.reduce((sum, q) => sum + (q.evaluation?.rubric_scores?.personality || 0), 0) / questions.length;
    const overallScore = (avgContent * 0.4) + (avgCommunication * 0.3) + (avgPersonality * 0.3);

    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div className="neon-glass rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🎓</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Interview Complete!</h1>
              <p className="text-gray-400">Here's how you performed</p>
            </div>

            {/* Overall Score */}
            <div className="bg-slate-800/50 rounded-2xl p-6 mb-6 text-center">
              <div className="text-6xl font-bold text-white mb-2">{Math.round(overallScore)}%</div>
              <div className="text-gray-400">Overall Score</div>
              <div className="flex justify-center gap-4 mt-4">
                <span className={`px-3 py-1 rounded-full text-sm ${
                  overallScore >= 80 ? 'bg-green-500/20 text-green-400' :
                  overallScore >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : 'Needs Practice'}
                </span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">{Math.round(avgContent)}%</div>
                <div className="text-gray-400 text-sm">Content Knowledge</div>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">{Math.round(avgCommunication)}%</div>
                <div className="text-gray-400 text-sm">Communication</div>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">{Math.round(avgPersonality)}%</div>
                <div className="text-gray-400 text-sm">Personality</div>
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <h3 className="text-green-400 font-medium mb-2">Strengths</h3>
                <ul className="space-y-1">
                  {['Clear articulation', 'Relevant examples'].map((s, i) => (
                    <li key={i} className="text-gray-300 text-sm">• {s}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                <h3 className="text-yellow-400 font-medium mb-2">Focus Areas</h3>
                <ul className="space-y-1">
                  {['More current affairs reading', 'Practice situational questions'].map((s, i) => (
                    <li key={i} className="text-gray-300 text-sm">• {s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => setSessionMode('setup')}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700"
              >
                New Session
              </button>
              <button className="flex-1 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80">
                Download Report
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
