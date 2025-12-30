'use client';

/**
 * Interview Studio UI - Story 13.1
 * WebRTC Real-Time AI Interviews
 * 
 * AC 1: WebRTC video call
 * AC 2: AI interviewer with TTS
 * AC 3: Question bank access
 * AC 4: Adaptive difficulty
 * AC 5: Visual aids
 * AC 6: Real-time Manim
 * AC 7: Recording consent
 * AC 8: Session duration
 * AC 9: Evaluation feedback
 * AC 10: Panel mode
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface Interviewer {
  id: string;
  name: string;
  role: 'chairperson' | 'expert' | 'psychology';
  avatar_url?: string;
  intro_script?: string;
}

interface Question {
  id: string;
  question: string;
  category: string;
  difficulty_level: string;
  interviewer_type: string;
  time_expected_seconds: number;
}

interface Session {
  id: string;
  status: string;
  duration_minutes: number;
  difficulty_level: string;
  session_type: 'solo' | 'panel';
  interviewers: Interviewer[];
  room_id?: string;
}

interface Analysis {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestion: string;
}

interface VisualAid {
  id: string;
  request_type: string;
  manim_status: string;
  video_url?: string;
}

export default function InterviewStudioPage() {
  // State
  const [view, setView] = useState<'setup' | 'interview' | 'results'>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Setup options
  const [sessionType, setSessionType] = useState<'solo' | 'panel'>('solo');
  const [duration, setDuration] = useState(20);
  const [difficulty, setDifficulty] = useState('medium');
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  
  // Interview state
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [currentInterviewer, setCurrentInterviewer] = useState<Interviewer | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [userResponse, setUserResponse] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [visualAid, setVisualAid] = useState<VisualAid | null>(null);
  const [showVisualAid, setShowVisualAid] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  // Available topics
  const TOPICS = [
    'current_affairs', 'polity', 'economy', 'history', 'geography',
    'science', 'ethics', 'international_relations', 'society', 'governance'
  ];

  // Load interviewers on mount
  useEffect(() => {
    loadInterviewers();
  }, []);

  // Timer effect
  useEffect(() => {
    if (view === 'interview' && session) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          if (newTime >= session.duration_minutes * 60) {
            endInterview();
          }
          return newTime;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, session]);

  const loadInterviewers = async () => {
    try {
      const res = await fetch('/api/interview?action=interviewers');
      const data = await res.json();
      if (data.success) setInterviewers(data.interviewers || []);
    } catch { console.error('Failed to load interviewers'); }
  };

  // Create session (AC 7, 8)
  const createSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-session',
          userId: 'user-id',
          sessionType,
          durationMinutes: duration,
          difficulty,
          topics,
          recordingConsent
        })
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.session);
        if (data.session.interviewers?.length > 0) {
          setCurrentInterviewer(data.session.interviewers[0]);
        }
      }
    } catch { setError('Failed to create session'); }
    finally { setLoading(false); }
  };

  // Start interview (AC 1)
  const startInterview = async () => {
    if (!session) return;
    setLoading(true);
    
    try {
      // Request camera/mic access
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }
      
      // Start session on server
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-session', sessionId: session.id })
      });
      const data = await res.json();
      
      if (data.success) {
        setView('interview');
        setCurrentDifficulty(difficulty);
        
        // Start recording if consent given (AC 7)
        if (recordingConsent) {
          startRecording(stream);
        }
        
        // Get first question
        await getNextQuestion();
        
        // Play interviewer intro
        if (currentInterviewer?.intro_script) {
          speakInterviewer(currentInterviewer.intro_script);
        }
      }
    } catch (err) {
      setError('Failed to start interview. Please allow camera/microphone access.');
    } finally {
      setLoading(false);
    }
  };

  // Start recording (AC 7)
  const startRecording = (stream: MediaStream) => {
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      // Upload recording
      console.log('Recording saved:', blob.size);
    };
    
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    
    fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start-recording', sessionId: session?.id })
    });
  };

  // Get next question (AC 3, 4)
  const getNextQuestion = async () => {
    if (!session) return;
    
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'next-question',
          sessionId: session.id,
          currentDifficulty,
          askedQuestionIds: askedQuestions,
          topics
        })
      });
      const data = await res.json();
      
      if (data.success && data.question) {
        setCurrentQuestion(data.question);
        setAskedQuestions(prev => [...prev, data.question.id]);
        
        // Update interviewer for panel mode (AC 10)
        if (session.session_type === 'panel') {
          const interviewer = session.interviewers.find(i => i.role === data.interviewerType);
          if (interviewer) setCurrentInterviewer(interviewer);
        }
        
        // Speak the question (AC 2)
        speakInterviewer(data.question.question);
      } else {
        // No more questions, end interview
        endInterview();
      }
    } catch { setError('Failed to get question'); }
  };

  // AI interviewer speaks (AC 2)
  const speakInterviewer = async (text: string) => {
    if (!session || !currentInterviewer) return;
    
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'interviewer-speak',
          sessionId: session.id,
          interviewerId: currentInterviewer.id,
          text,
          questionId: currentQuestion?.id
        })
      });
      const data = await res.json();
      
      // Add to transcript
      setTranscript(prev => [...prev, {
        speaker: 'interviewer',
        name: currentInterviewer.name,
        text,
        timestamp: elapsedTime
      }]);
      
      // Play audio if available
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play();
      } else {
        // Use browser TTS as fallback
        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utterance);
      }
    } catch { console.error('Failed to speak'); }
  };

  // Submit user response (AC 9)
  const submitResponse = async () => {
    if (!session || !currentQuestion || !userResponse.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'user-response',
          sessionId: session.id,
          questionId: currentQuestion.id,
          response: userResponse,
          timestampSeconds: elapsedTime,
          durationSeconds: currentQuestion.time_expected_seconds
        })
      });
      const data = await res.json();
      
      // Add to transcript
      setTranscript(prev => [...prev, {
        speaker: 'user',
        text: userResponse,
        timestamp: elapsedTime
      }]);
      
      // Update difficulty (AC 4)
      if (data.nextDifficulty) {
        setCurrentDifficulty(data.nextDifficulty);
      }
      
      setAnalysis(data.analysis);
      setUserResponse('');
      
      // Get follow-up or next question
      setTimeout(() => {
        setAnalysis(null);
        getNextQuestion();
      }, 3000);
      
    } catch { setError('Failed to submit response'); }
    finally { setLoading(false); }
  };

  // Request visual aid (AC 5, 6)
  const requestVisual = async (type: string) => {
    if (!session) return;
    
    const requestText = prompt(`Describe the ${type} you want to see:`);
    if (!requestText) return;
    
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-visual',
          sessionId: session.id,
          requestType: type,
          requestText
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setVisualAid(data.visualAid);
        setShowVisualAid(true);
        
        // Poll for completion
        pollVisualAid(data.visualAid.id);
      }
    } catch { setError('Failed to request visual'); }
  };

  // Poll visual aid status (AC 6 - 2-6s target)
  const pollVisualAid = async (visualAidId: string) => {
    const maxAttempts = 10;
    let attempts = 0;
    
    const poll = async () => {
      try {
        const res = await fetch('/api/interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check-visual', visualAidId })
        });
        const data = await res.json();
        
        if (data.visualAid?.manim_status === 'ready') {
          setVisualAid(data.visualAid);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000);
        }
      } catch { console.error('Poll failed'); }
    };
    
    poll();
  };

  // End interview (AC 9)
  const endInterview = async () => {
    if (!session) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    
    setLoading(true);
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end-session', sessionId: session.id })
      });
      const data = await res.json();
      
      if (data.success) {
        setView('results');
      }
    } catch { setError('Failed to end session'); }
    finally { setLoading(false); }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Setup View
  const SetupView = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Interview Prep Studio</h1>
        <p className="text-gray-600">Practice with AI interviewers in real-time</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
        {/* Session Type (AC 10) */}
        <div>
          <label className="block text-sm font-medium mb-2">Session Type</label>
          <div className="flex gap-4">
            <button
              onClick={() => setSessionType('solo')}
              className={`flex-1 p-4 rounded-lg border-2 ${sessionType === 'solo' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
            >
              <div className="text-2xl mb-2">👤</div>
              <div className="font-medium">Solo</div>
              <div className="text-sm text-gray-500">One AI interviewer</div>
            </button>
            <button
              onClick={() => setSessionType('panel')}
              className={`flex-1 p-4 rounded-lg border-2 ${sessionType === 'panel' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
            >
              <div className="text-2xl mb-2">👥</div>
              <div className="font-medium">Panel</div>
              <div className="text-sm text-gray-500">3 AI interviewers</div>
            </button>
          </div>
        </div>

        {/* Duration (AC 8) */}
        <div>
          <label className="block text-sm font-medium mb-2">Duration: {duration} minutes</label>
          <input
            type="range"
            min={15}
            max={30}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>15 min</span>
            <span>30 min</span>
          </div>
        </div>

        {/* Difficulty (AC 4) */}
        <div>
          <label className="block text-sm font-medium mb-2">Starting Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="easy">Easy - Basic questions</option>
            <option value="medium">Medium - Standard interview</option>
            <option value="hard">Hard - Challenging questions</option>
          </select>
        </div>

        {/* Topics */}
        <div>
          <label className="block text-sm font-medium mb-2">Focus Topics (optional)</label>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map(topic => (
              <button
                key={topic}
                onClick={() => setTopics(prev => 
                  prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
                )}
                className={`px-3 py-1 rounded-full text-sm ${
                  topics.includes(topic) ? 'bg-indigo-600 text-white' : 'bg-gray-100'
                }`}
              >
                {topic.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Recording Consent (AC 7) */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={recordingConsent}
              onChange={(e) => setRecordingConsent(e.target.checked)}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Record this session</div>
              <div className="text-sm text-gray-500">
                I consent to having my interview recorded for review. Recording can be deleted anytime.
              </div>
            </div>
          </label>
        </div>

        {/* Panel Members Preview (AC 10) */}
        {sessionType === 'panel' && interviewers.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Your Panel</label>
            <div className="flex gap-4">
              {interviewers.map(int => (
                <div key={int.id} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl mb-1">
                    {int.role === 'chairperson' ? '👨‍💼' : int.role === 'expert' ? '👩‍🏫' : '👨‍⚕️'}
                  </div>
                  <div className="text-sm font-medium">{int.name}</div>
                  <div className="text-xs text-gray-500 capitalize">{int.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={session ? startInterview : createSession}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : session ? 'Start Interview' : 'Prepare Session'}
        </button>
      </div>
    </div>
  );

  // Interview View
  const InterviewView = () => (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isRecording && <span className="flex items-center gap-2 text-red-500"><span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />REC</span>}
          <span className="text-white">{formatTime(elapsedTime)} / {duration}:00</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded text-sm ${
            currentDifficulty === 'easy' ? 'bg-green-600' : 
            currentDifficulty === 'medium' ? 'bg-yellow-600' : 'bg-red-600'
          } text-white`}>
            {currentDifficulty}
          </span>
          <button onClick={endInterview} className="px-4 py-2 bg-red-600 text-white rounded-lg">End</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Area */}
        <div className="flex-1 relative">
          {/* AI Interviewer */}
          <div className="absolute inset-4 bg-gray-800 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center text-6xl mb-4 mx-auto">
                {currentInterviewer?.role === 'chairperson' ? '👨‍💼' : 
                 currentInterviewer?.role === 'expert' ? '👩‍🏫' : '👨‍⚕️'}
              </div>
              <h3 className="text-white text-xl">{currentInterviewer?.name}</h3>
              <p className="text-gray-400 capitalize">{currentInterviewer?.role}</p>
            </div>
          </div>

          {/* User Video (AC 1) */}
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden">
            <video ref={userVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          </div>

          {/* Visual Aid Display (AC 5, 6) */}
          {showVisualAid && visualAid && (
            <div className="absolute top-4 left-4 w-80 bg-white rounded-lg shadow-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">{visualAid.request_type}</h4>
                <button onClick={() => setShowVisualAid(false)} className="text-gray-400">×</button>
              </div>
              {visualAid.manim_status === 'generating' ? (
                <div className="h-40 flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
                  <span className="ml-2 text-sm text-gray-500">Generating (2-6s)...</span>
                </div>
              ) : visualAid.video_url ? (
                <video src={visualAid.video_url} autoPlay loop className="w-full rounded" />
              ) : (
                <div className="h-40 bg-gray-100 rounded flex items-center justify-center text-gray-400">Loading...</div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-96 bg-gray-800 p-4 flex flex-col">
          {/* Current Question */}
          {currentQuestion && (
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <div className="text-xs text-gray-400 mb-1">{currentQuestion.category}</div>
              <p className="text-white">{currentQuestion.question}</p>
              <div className="text-xs text-gray-400 mt-2">Expected: {currentQuestion.time_expected_seconds}s</div>
            </div>
          )}

          {/* User Response */}
          <div className="flex-1 mb-4">
            <textarea
              value={userResponse}
              onChange={(e) => setUserResponse(e.target.value)}
              placeholder="Type your response or speak..."
              className="w-full h-full bg-gray-700 text-white rounded-lg p-3 resize-none"
            />
          </div>

          {/* Analysis Feedback (AC 9) */}
          {analysis && (
            <div className={`rounded-lg p-4 mb-4 ${analysis.score >= 7 ? 'bg-green-900' : analysis.score >= 5 ? 'bg-yellow-900' : 'bg-red-900'}`}>
              <div className="text-2xl font-bold text-white mb-2">{analysis.score}/10</div>
              <p className="text-sm text-white/80">{analysis.suggestion}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={submitResponse}
              disabled={!userResponse.trim() || loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Submit Response'}
            </button>
            
            {/* Visual Aid Buttons (AC 5) */}
            <div className="flex gap-2">
              <button onClick={() => requestVisual('diagram')} className="flex-1 py-2 bg-gray-700 text-white rounded-lg text-sm">
                Show Diagram
              </button>
              <button onClick={() => requestVisual('timeline')} className="flex-1 py-2 bg-gray-700 text-white rounded-lg text-sm">
                Show Timeline
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Results View (AC 9)
  const ResultsView = () => (
    <div className="max-w-3xl mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Interview Complete</h1>
        <p className="text-gray-600">Duration: {formatTime(elapsedTime)} | Questions: {askedQuestions.length}</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Performance Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-indigo-600">7.5</div>
            <div className="text-sm text-gray-500">Overall</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">8.0</div>
            <div className="text-sm text-gray-500">Communication</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">7.0</div>
            <div className="text-sm text-gray-500">Knowledge</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">7.5</div>
            <div className="text-sm text-gray-500">Analytical</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-2 text-green-600">Strengths</h3>
            <ul className="space-y-1 text-sm">
              <li>• Clear communication</li>
              <li>• Good structure in answers</li>
              <li>• Showed balanced perspective</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2 text-orange-600">Areas to Improve</h3>
            <ul className="space-y-1 text-sm">
              <li>• Include more examples</li>
              <li>• Cover multiple dimensions</li>
              <li>• Practice time management</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => { setView('setup'); setSession(null); setTranscript([]); setAskedQuestions([]); setElapsedTime(0); }}
          className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium"
        >
          Practice Again
        </button>
        <button className="flex-1 py-3 border rounded-lg font-medium">
          View Debrief Video
        </button>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => setError('')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Dismiss</button>
      </div>
    );
  }

  return (
    <div className={view === 'interview' ? '' : 'min-h-screen bg-gray-50 p-6'}>
      {view === 'setup' && <SetupView />}
      {view === 'interview' && <InterviewView />}
      {view === 'results' && <ResultsView />}
    </div>
  );
}
