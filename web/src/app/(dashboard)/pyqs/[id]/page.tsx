'use client';

// Story 8.5: PYQ Detail Page with Video Player
// Displays individual PYQ with model answer and video explanation

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import PyqVideoPlayer from '@/components/video/PyqVideoPlayer';

interface PyqQuestion {
  id: string;
  year: number;
  paper_type: string;
  paper_number?: number;
  question_number: number;
  subject: string;
  topic: string;
  text: string;
  marks: number;
  difficulty: string;
  view_count: number;
  created_at: string;
}

interface ModelAnswer {
  id: string;
  question_id: string;
  answer_text: string;
  key_points: string[];
  created_at: string;
}

interface PyqVideo {
  id: string;
  video_url: string;
  status: string;
  duration_seconds?: number;
}

export default function PyqDetailPage() {
  const params = useParams();
  const router = useRouter();
  const questionId = params.id as string;
  
  const [question, setQuestion] = useState<PyqQuestion | null>(null);
  const [modelAnswer, setModelAnswer] = useState<ModelAnswer | null>(null);
  const [video, setVideo] = useState<PyqVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [relatedQuestions, setRelatedQuestions] = useState<PyqQuestion[]>([]);
  
  const supabase = getSupabaseBrowserClient();

  const fetchQuestionDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch question
      const { data: questionData, error: questionError } = await supabase
        .from('pyq_questions')
        .select('*')
        .eq('id', questionId)
        .single() as { data: PyqQuestion | null; error: Error | null };

      if (questionError) throw questionError;
      setQuestion(questionData);

      // Increment view count (silent - non-critical)
      if (questionData) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('pyq_questions')
            .update({ view_count: (questionData.view_count || 0) + 1 })
            .eq('id', questionId);
        } catch {
          // Silent fail for view count
        }
      }

      // Fetch model answer
      const { data: answerData } = await supabase
        .from('pyq_model_answers')
        .select('*')
        .eq('question_id', questionId)
        .single() as { data: ModelAnswer | null; error: Error | null };
      
      if (answerData) setModelAnswer(answerData);

      // Fetch existing video
      const { data: videoData } = await supabase
        .from('pyq_videos')
        .select('*')
        .eq('question_id', questionId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as { data: PyqVideo | null; error: Error | null };
      
      if (videoData) setVideo(videoData);

      // Check bookmark status
      const bookmarkRes = await fetch(`/api/pyqs/bookmark?question_id=${questionId}`);
      if (bookmarkRes.ok) {
        const bookmarkData = await bookmarkRes.json();
        setIsBookmarked(bookmarkData.bookmarks?.length > 0);
      }

      // Fetch related questions by subject
      if (questionData?.subject) {
        const { data: relatedData } = await supabase
          .from('pyq_questions')
          .select('id, year, paper_type, text, subject, difficulty')
          .eq('subject', questionData.subject)
          .neq('id', questionId)
          .limit(5) as { data: PyqQuestion[] | null; error: Error | null };
        
        if (relatedData) setRelatedQuestions(relatedData);
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load question';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [questionId, supabase]);

  useEffect(() => {
    if (questionId) {
      fetchQuestionDetails();
    }
  }, [questionId, fetchQuestionDetails]);

  const toggleBookmark = async () => {
    try {
      if (isBookmarked) {
        await fetch(`/api/pyqs/bookmark?question_id=${questionId}`, { method: 'DELETE' });
        setIsBookmarked(false);
      } else {
        await fetch('/api/pyqs/bookmark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question_id: questionId }),
        });
        setIsBookmarked(true);
      }
    } catch (err) {
      console.error('Bookmark toggle failed:', err);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading question...</p>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">Question Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The question you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/pyqs')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to PYQ Database
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/pyqs')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition"
      >
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to PYQ Database
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Question Card */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {question.year}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                  {question.paper_type}
                </span>
                {question.paper_number && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                    Paper {question.paper_number}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty?.toUpperCase()}
                </span>
              </div>
              
              {/* Bookmark Button */}
              <button
                onClick={toggleBookmark}
                className="p-2 hover:bg-gray-100 rounded-full transition"
                title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
              >
                <svg 
                  className={`w-6 h-6 ${isBookmarked ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`}
                  fill={isBookmarked ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            </div>

            {/* Question metadata */}
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-500">Question {question.question_number}</span>
              <span className="mx-2 text-gray-300">•</span>
              <span className="text-sm text-gray-500">{question.marks} marks</span>
              <span className="mx-2 text-gray-300">•</span>
              <span className="text-sm text-gray-500">{question.view_count} views</span>
            </div>

            {/* Question text */}
            <h1 className="text-xl font-semibold text-gray-900 leading-relaxed mb-4">
              {question.text}
            </h1>

            {/* Subject/Topic tags */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded text-sm">
                {question.subject}
              </span>
              {question.topic && (
                <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded text-sm">
                  {question.topic}
                </span>
              )}
            </div>
          </div>

          {/* Model Answer */}
          {modelAnswer && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Model Answer</h2>
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  {showAnswer ? 'Hide Answer' : 'Show Answer'}
                </button>
              </div>

              {showAnswer && (
                <div className="space-y-4">
                  {/* Key Points */}
                  {modelAnswer.key_points && modelAnswer.key_points.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-medium text-green-800 mb-2">Key Points</h3>
                      <ul className="space-y-1">
                        {modelAnswer.key_points.map((point: string, index: number) => (
                          <li key={index} className="flex items-start text-green-700 text-sm">
                            <span className="mr-2">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Full Answer */}
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {modelAnswer.answer_text}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Player */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <PyqVideoPlayer
              questionId={question.id}
              questionText={question.text}
              questionYear={question.year}
              questionPaper={question.paper_type}
              videoUrl={video?.video_url}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Question Details */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold mb-4">Question Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Year</dt>
                <dd className="font-medium">{question.year}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Paper Type</dt>
                <dd className="font-medium">{question.paper_type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Subject</dt>
                <dd className="font-medium">{question.subject}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Topic</dt>
                <dd className="font-medium">{question.topic || 'General'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Marks</dt>
                <dd className="font-medium">{question.marks}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Difficulty</dt>
                <dd className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty?.toUpperCase()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Related Questions */}
          {relatedQuestions.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold mb-4">Related Questions</h3>
              <div className="space-y-3">
                {relatedQuestions.map((rq) => (
                  <button
                    key={rq.id}
                    onClick={() => router.push(`/pyqs/${rq.id}`)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                        {rq.year}
                      </span>
                      <span className="text-xs text-gray-500">{rq.paper_type}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{rq.text}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Practice CTA */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
            <h3 className="font-semibold mb-2">Practice This Question</h3>
            <p className="text-sm text-gray-600 mb-4">
              Write your answer and get AI-powered feedback
            </p>
            <button
              onClick={() => router.push(`/practice/answers?question_id=${question.id}`)}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition"
            >
              Start Answer Writing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
