'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Question {
  id: string;
  paper: string;
  question_text: string;
  word_limit: number;
  topic: string;
  difficulty: string;
  marks: number;
}

export default function AnswerWritingPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'practice' | 'history'>('practice');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  useEffect(() => {
    fetchQuestions();
    fetchSubmissions();
  }, []);

  // AC4: Timer countdown
  useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && isTimerActive) {
      handleAutoSubmit();
    }
  }, [timeLeft, isTimerActive]);

  // AC5: Auto-save every 30 seconds
  useEffect(() => {
    if (answer && selectedQuestion && isTimerActive) {
      const interval = setInterval(() => {
        saveDraft();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [answer, selectedQuestion, isTimerActive]);

  // AC1,8: Fetch daily questions (5 per day, 1 per GS paper)
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/answers/daily');
      
      if (!res.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  // AC9: Fetch submission history
  const fetchSubmissions = async () => {
    try {
      const res = await fetch('/api/answers/history');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  // AC5: Auto-save draft
  const saveDraft = async () => {
    if (!selectedQuestion || !answer.trim()) return;
    
    try {
      setAutoSaveStatus('saving');
      const wordCount = answer.trim().split(/\s+/).filter(w => w).length;
      
      await fetch('/api/answers/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: selectedQuestion.id,
          draft_text: answer,
          word_count: wordCount
        })
      });
      
      setAutoSaveStatus('saved');
    } catch (err) {
      setAutoSaveStatus('error');
    }
  };

  // AC2,4: Start answer with timer
  const startAnswer = async (question: Question) => {
    setSelectedQuestion(question);
    setError('');
    setSuccessMessage('');
    
    // Load existing draft if any
    try {
      const res = await fetch(`/api/answers/draft?question_id=${question.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.draft) {
          setAnswer(data.draft.draft_text || '');
        }
      }
    } catch (err) {
      console.error('Failed to load draft:', err);
    }
    
    // AC4: Set timer based on word limit (150 words = 10 min, 250 words = 15 min)
    const timeLimit = question.word_limit === 150 ? 600 : question.word_limit === 250 ? 900 : 1200;
    setTimeLeft(timeLimit);
    setIsTimerActive(true);
  };

  // AC6: Submit for evaluation
  const handleSubmit = async () => {
    if (!selectedQuestion || !answer.trim()) {
      setError('Please write an answer before submitting');
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      const wordCount = answer.trim().split(/\s+/).filter(w => w).length;
      const timeTaken = (selectedQuestion.word_limit === 150 ? 600 : 900) - timeLeft;
      
      const res = await fetch('/api/answers/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: selectedQuestion.id,
          question_text: selectedQuestion.question_text,
          answer_text: answer,
          word_count: wordCount,
          time_taken_seconds: timeTaken
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Submission failed');
      }

      const data = await res.json();
      
      setSuccessMessage('Answer submitted successfully! Evaluation in progress...');
      setIsTimerActive(false);
      setSelectedQuestion(null);
      setAnswer('');
      
      // Refresh history
      await fetchSubmissions();
      
      // Redirect to evaluation after 2 seconds
      setTimeout(() => {
        router.push(`/practice/answers/${data.submission.id}`);
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  // AC4: Auto-submit when timer expires
  const handleAutoSubmit = () => {
    setIsTimerActive(false);
    if (answer.trim()) {
      handleSubmit();
    } else {
      setError('Time expired! Please write an answer.');
      setSelectedQuestion(null);
    }
  };

  const wordCount = answer.trim().split(/\s+/).filter(w => w).length;
  const isOverLimit = selectedQuestion && wordCount > selectedQuestion.word_limit;

  // Writing interface
  if (selectedQuestion) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        {/* AC2: Question display with metadata */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {selectedQuestion.paper}
              </span>
              <span className="text-sm text-gray-600">
                {selectedQuestion.word_limit} words | {selectedQuestion.marks} marks
              </span>
              <span className={`px-2 py-1 rounded text-xs ${
                selectedQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                selectedQuestion.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {selectedQuestion.difficulty.toUpperCase()}
              </span>
            </div>
            {/* AC4: Timer display */}
            <div className={`text-2xl font-bold ${
              timeLeft < 120 ? 'text-red-600 animate-pulse' : 'text-blue-600'
            }`}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>
          <p className="text-lg font-medium mb-2">{selectedQuestion.question_text}</p>
          <p className="text-sm text-gray-600">Topic: {selectedQuestion.topic}</p>
        </div>

        {/* AC3: Writing interface with word counter */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-4">
              <span className={`text-sm font-medium ${
                isOverLimit ? 'text-red-600' : wordCount > selectedQuestion.word_limit * 0.9 ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                Word Count: {wordCount}/{selectedQuestion.word_limit}
              </span>
              {/* AC5: Auto-save indicator */}
              <span className="text-xs text-gray-500">
                {autoSaveStatus === 'saving' && '💾 Saving...'}
                {autoSaveStatus === 'saved' && '✓ Draft saved'}
                {autoSaveStatus === 'error' && '⚠ Save failed'}
              </span>
            </div>
            <span className={`text-sm font-medium ${
              isOverLimit ? 'text-red-600' : 'text-green-600'
            }`}>
              {isOverLimit ? '⚠ Over limit!' : '✓ Within limit'}
            </span>
          </div>
          
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full h-96 p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Start writing your answer here..."
            disabled={submitting}
          />
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
              {successMessage}
            </div>
          )}
          
          {/* AC6: Submit button */}
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => {
                setSelectedQuestion(null);
                setAnswer('');
                setIsTimerActive(false);
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={saveDraft}
              className="px-6 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition"
              disabled={submitting}
            >
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !answer.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit for Evaluation'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main interface with tabs
  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Answer Writing Practice</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-8 border-b">
        <button
          onClick={() => setActiveTab('practice')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'practice'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Daily Questions
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          My Submissions ({submissions.length})
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading questions...</p>
        </div>
      ) : activeTab === 'practice' ? (
        // AC1,8: Question selection interface
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {questions.length === 0 ? (
            <div className="col-span-2 text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No questions available for today. Check back tomorrow!</p>
            </div>
          ) : (
            questions.map((q) => (
              <div key={q.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {q.paper}
                  </span>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">{q.word_limit} words</div>
                    <div className="text-sm font-medium text-gray-900">{q.marks} marks</div>
                  </div>
                </div>
                <p className="text-lg mb-4 line-clamp-3">{q.question_text}</p>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-gray-600">{q.topic}</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      q.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                      q.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {q.difficulty}
                    </span>
                  </div>
                  <button
                    onClick={() => startAnswer(q)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Start Writing
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // AC9: Submission history
        <div className="space-y-4">
          {submissions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No submissions yet. Start practicing!</p>
            </div>
          ) : (
            submissions.map((sub) => (
              <div key={sub.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-lg font-medium mb-2">{sub.question_text}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{sub.word_count} words</span>
                      <span>•</span>
                      <span>{new Date(sub.submitted_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className={`px-2 py-1 rounded ${
                        sub.status === 'evaluated' ? 'bg-green-100 text-green-800' :
                        sub.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/practice/answers/${sub.id}`)}
                    className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
