/**
 * Story 9.9: Spaced Repetition Review Interface
 * AC 6: Quiz-like format for reviewing due bookmarks
 * AC 7: Easy/Medium/Hard buttons
 * AC 10: Streak tracking
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DueBookmark {
  id: string;
  title: string;
  snippet: string;
  content_type: string;
  content_id: string;
  review_count: number;
  ease_factor: number;
  interval_days: number;
  next_review_date: string;
}

interface Streak {
  current_streak: number;
  longest_streak: number;
  total_reviews: number;
  last_review_date?: string;
}

interface ReviewResult {
  success: boolean;
  new_interval_days: number;
  next_review_date: string;
  message: string;
  streak: Streak;
}

const CONTENT_TYPE_ICONS: Record<string, string> = {
  note: '📝',
  video: '🎥',
  question: '❓',
  topic: '📚',
  mindmap: '🧠',
  pyq: '📋',
  custom: '🔗'
};

export default function ReviewPage() {
  const [bookmarks, setBookmarks] = useState<DueBookmark[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [streak, setStreak] = useState<Streak>({ current_streak: 0, longest_streak: 0, total_reviews: 0 });
  const [reviewStartTime, setReviewStartTime] = useState<number>(0);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, easy: 0, medium: 0, hard: 0 });
  const [lastResult, setLastResult] = useState<ReviewResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Fetch due bookmarks
  useEffect(() => {
    const fetchDue = async () => {
      try {
        const res = await fetch('/api/bookmarks/review');
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
        setStreak(data.streak || { current_streak: 0, longest_streak: 0, total_reviews: 0 });
        if (data.bookmarks?.length === 0) {
          setIsComplete(true);
        }
      } catch (error) {
        console.error('Failed to fetch due bookmarks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDue();
  }, []);

  // Start timer when showing a card
  useEffect(() => {
    if (!showAnswer && bookmarks.length > 0 && currentIndex < bookmarks.length) {
      setReviewStartTime(Date.now());
    }
  }, [currentIndex, showAnswer, bookmarks.length]);

  const currentBookmark = bookmarks[currentIndex];
  const progress = bookmarks.length > 0 ? ((currentIndex + 1) / bookmarks.length) * 100 : 0;

  // AC 7: Submit review with response
  const submitReview = useCallback(async (response: 'easy' | 'medium' | 'hard' | 'again') => {
    if (!currentBookmark || isReviewing) return;

    setIsReviewing(true);
    const reviewTime = Math.round((Date.now() - reviewStartTime) / 1000);

    try {
      const res = await fetch('/api/bookmarks/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookmark_id: currentBookmark.id,
          response,
          review_time_seconds: reviewTime
        })
      });

      const result: ReviewResult = await res.json();
      
      if (result.success) {
        setLastResult(result);
        setStreak(result.streak);
        
        // Update stats
        setSessionStats(prev => ({
          reviewed: prev.reviewed + 1,
          easy: response === 'easy' ? prev.easy + 1 : prev.easy,
          medium: response === 'medium' ? prev.medium + 1 : prev.medium,
          hard: response === 'hard' || response === 'again' ? prev.hard + 1 : prev.hard
        }));

        // Move to next card
        setTimeout(() => {
          if (currentIndex < bookmarks.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setShowAnswer(false);
            setLastResult(null);
          } else {
            setIsComplete(true);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setIsReviewing(false);
    }
  }, [currentBookmark, isReviewing, reviewStartTime, currentIndex, bookmarks.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isComplete || isReviewing) return;
      
      if (e.code === 'Space' && !showAnswer) {
        e.preventDefault();
        setShowAnswer(true);
      } else if (showAnswer) {
        if (e.key === '1') submitReview('again');
        if (e.key === '2') submitReview('hard');
        if (e.key === '3') submitReview('medium');
        if (e.key === '4') submitReview('easy');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showAnswer, isComplete, isReviewing, submitReview]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-500">Loading your reviews...</p>
        </div>
      </div>
    );
  }

  // Session Complete View
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {bookmarks.length === 0 ? 'No Reviews Due!' : 'Session Complete!'}
          </h1>
          <p className="text-gray-600 mb-6">
            {bookmarks.length === 0 
              ? 'Check back later for new reviews.'
              : `You reviewed ${sessionStats.reviewed} bookmarks.`
            }
          </p>

          {/* Session Stats */}
          {sessionStats.reviewed > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <span className="text-2xl font-bold text-green-600">{sessionStats.easy}</span>
                  <p className="text-xs text-gray-500">Easy</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-yellow-600">{sessionStats.medium}</span>
                  <p className="text-xs text-gray-500">Medium</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-red-600">{sessionStats.hard}</span>
                  <p className="text-xs text-gray-500">Hard</p>
                </div>
              </div>
            </div>
          )}

          {/* AC 10: Streak Display */}
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-3xl">🔥</span>
              <span className="text-3xl font-bold text-orange-600">{streak.current_streak}</span>
            </div>
            <p className="text-sm text-orange-700">
              {streak.current_streak === 0 
                ? 'Start your streak by reviewing tomorrow!'
                : streak.current_streak === 1 
                  ? 'Day streak! Keep it going!'
                  : `Day streak! Best: ${streak.longest_streak} days`
              }
            </p>
            <p className="text-xs text-orange-500 mt-2">
              Total reviews: {streak.total_reviews}
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Link
              href="/bookmarks"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              View Bookmarks
            </Link>
            <Link
              href="/"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Review Interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/bookmarks" className="text-gray-400 hover:text-gray-600">
              ←
            </Link>
            <div>
              <h1 className="font-semibold text-gray-900">Review Session</h1>
              <p className="text-sm text-gray-500">
                {currentIndex + 1} of {bookmarks.length}
              </p>
            </div>
          </div>
          
          {/* AC 10: Streak Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 rounded-full">
            <span>🔥</span>
            <span className="font-bold text-orange-600">{streak.current_streak}</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mt-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* AC 6: Quiz-like Card */}
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Card Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{CONTENT_TYPE_ICONS[currentBookmark.content_type] || '📄'}</span>
              <span className="text-sm font-medium text-gray-600 capitalize">
                {currentBookmark.content_type}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              Review #{currentBookmark.review_count + 1}
            </div>
          </div>

          {/* Card Content */}
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
              {currentBookmark.title}
            </h2>
            
            {/* Question Prompt */}
            {!showAnswer && (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-6">
                  Do you remember this concept?
                </p>
                <button
                  onClick={() => setShowAnswer(true)}
                  className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-lg font-medium"
                >
                  Show Answer
                </button>
                <p className="text-xs text-gray-400 mt-4">
                  Press Space to reveal
                </p>
              </div>
            )}

            {/* Answer Revealed */}
            {showAnswer && (
              <div className="mt-6">
                {currentBookmark.snippet && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-gray-700">{currentBookmark.snippet}</p>
                  </div>
                )}

                <Link
                  href={`/${currentBookmark.content_type}s/${currentBookmark.content_id}`}
                  className="text-sm text-blue-600 hover:underline block text-center mb-6"
                >
                  View full content →
                </Link>

                {/* Result feedback */}
                {lastResult && (
                  <div className="text-center py-4 mb-4 bg-green-50 rounded-lg text-green-700">
                    {lastResult.message}
                  </div>
                )}

                {/* AC 7: Response Buttons */}
                {!lastResult && (
                  <div className="space-y-4">
                    <p className="text-center text-gray-600 mb-4">
                      How well did you remember?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* AC 8: Again - schedules sooner */}
                      <button
                        onClick={() => submitReview('again')}
                        disabled={isReviewing}
                        className="py-4 px-6 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors font-medium disabled:opacity-50"
                      >
                        <span className="block text-lg">😟</span>
                        <span>Again</span>
                        <span className="block text-xs opacity-70">1 day</span>
                      </button>
                      
                      {/* AC 8: Hard - reduces ease factor */}
                      <button
                        onClick={() => submitReview('hard')}
                        disabled={isReviewing}
                        className="py-4 px-6 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 transition-colors font-medium disabled:opacity-50"
                      >
                        <span className="block text-lg">😐</span>
                        <span>Hard</span>
                        <span className="block text-xs opacity-70">~3 days</span>
                      </button>
                      
                      {/* Medium */}
                      <button
                        onClick={() => submitReview('medium')}
                        disabled={isReviewing}
                        className="py-4 px-6 bg-yellow-100 text-yellow-700 rounded-xl hover:bg-yellow-200 transition-colors font-medium disabled:opacity-50"
                      >
                        <span className="block text-lg">🙂</span>
                        <span>Good</span>
                        <span className="block text-xs opacity-70">~7 days</span>
                      </button>
                      
                      {/* AC 9: Easy - increases ease factor */}
                      <button
                        onClick={() => submitReview('easy')}
                        disabled={isReviewing}
                        className="py-4 px-6 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors font-medium disabled:opacity-50"
                      >
                        <span className="block text-lg">😊</span>
                        <span>Easy</span>
                        <span className="block text-xs opacity-70">~14+ days</span>
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-400 text-center mt-4">
                      Keyboard: 1=Again, 2=Hard, 3=Good, 4=Easy
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Skip button */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              if (currentIndex < bookmarks.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setShowAnswer(false);
              } else {
                setIsComplete(true);
              }
            }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Skip this card
          </button>
        </div>
      </div>
    </div>
  );
}
