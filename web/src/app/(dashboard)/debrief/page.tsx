'use client';

/**
 * Interview Debrief UI - Story 13.2
 * 
 * AC 1: Debrief triggered after interview
 * AC 3: Video structure
 * AC 4: Manim visualizations
 * AC 7: Notification display
 * AC 8: Archive/history
 * AC 9: Share with mentor
 * AC 10: Compare with previous
 */

import { useState, useEffect, useRef } from 'react';

interface Debrief {
  id: string;
  session_id: string;
  status: 'pending' | 'analyzing' | 'scripting' | 'rendering' | 'ready' | 'failed';
  created_at: string;
  video_url?: string;
  thumbnail_url?: string;
  actual_duration_seconds?: number;
  transcript_analysis?: any;
  strengths_identified?: string[];
  weaknesses_identified?: string[];
  best_answers?: any[];
  improvement_areas?: any[];
  share_enabled?: boolean;
  share_token?: string;
  previous_session_id?: string;
  score_improvement?: number;
  comparison_insights?: string[];
  mentor_feedback?: any[];
}

interface Comparison {
  current_overall_score: number;
  previous_overall_score: number;
  score_change: number;
  dimension_changes: Record<string, number>;
}

export default function DebriefPage({ params }: { params?: { id?: string } }) {
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [mentorEmail, setMentorEmail] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [debriefHistory, setDebriefHistory] = useState<Debrief[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (params?.id) {
      loadDebrief(params.id);
    } else {
      loadHistory();
    }
  }, [params?.id]);

  const loadDebrief = async (debriefId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/debrief?action=detail&id=${debriefId}`);
      const data = await res.json();
      if (data.success) {
        setDebrief(data.debrief);
        if (data.debrief?.previous_session_id) {
          loadComparison(debriefId);
        }
      }
    } catch { setError('Failed to load debrief'); }
    finally { setLoading(false); }
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/debrief?action=history&userId=user-id');
      const data = await res.json();
      if (data.success) setDebriefHistory(data.debriefs || []);
    } catch { setError('Failed to load history'); }
    finally { setLoading(false); }
  };

  const loadComparison = async (debriefId: string) => {
    try {
      const res = await fetch(`/api/debrief?action=comparison&debriefId=${debriefId}`);
      const data = await res.json();
      if (data.success && data.comparison) {
        setComparison(data.comparison);
      }
    } catch { console.error('Failed to load comparison'); }
  };

  const createShareLink = async () => {
    if (!debrief) return;
    try {
      const res = await fetch('/api/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-share', debriefId: debrief.id })
      });
      const data = await res.json();
      if (data.success) {
        setShareUrl(data.shareUrl);
        setShowShareModal(true);
      }
    } catch { setError('Failed to create share link'); }
  };

  const shareWithMentor = async () => {
    if (!debrief || !mentorEmail) return;
    try {
      const res = await fetch('/api/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share-with-mentor', debriefId: debrief.id, mentorEmail })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Debrief shared with ${mentorEmail}`);
        setMentorEmail('');
        setShowShareModal(false);
      }
    } catch { setError('Failed to share'); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Link copied!');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // History View (AC 8)
  const HistoryView = () => (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Interview Debriefs</h1>
      
      {debriefHistory.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-4">📹</p>
          <p>No debriefs yet. Complete an interview to get your first debrief!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debriefHistory.map(d => (
            <div
              key={d.id}
              onClick={() => loadDebrief(d.id)}
              className="bg-white p-4 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-24 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                  {d.thumbnail_url ? (
                    <img src={d.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">📹</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Interview Debrief</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(d.created_at).toLocaleDateString()}
                  </p>
                  {d.score_improvement !== null && d.score_improvement !== undefined && (
                    <span className={`text-sm ${d.score_improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {d.score_improvement >= 0 ? '▲' : '▼'} {Math.abs(d.score_improvement).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Debrief Detail View
  const DebriefDetailView = () => {
    if (!debrief) return null;

    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => { setDebrief(null); loadHistory(); }} className="text-sm text-gray-600 mb-2">
              ← Back to History
            </button>
            <h1 className="text-2xl font-bold">Interview Debrief</h1>
            <p className="text-gray-600">
              {debrief.actual_duration_seconds && formatDuration(debrief.actual_duration_seconds)} video analysis
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={createShareLink} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Share
            </button>
          </div>
        </div>

        {/* Video Player (AC 3) */}
        {debrief.status === 'ready' && debrief.video_url ? (
          <div className="bg-black rounded-lg overflow-hidden mb-6">
            <video
              ref={videoRef}
              src={debrief.video_url}
              controls
              className="w-full"
              style={{ maxHeight: '450px' }}
            />
          </div>
        ) : debrief.status === 'rendering' ? (
          <div className="bg-gray-100 rounded-lg p-12 mb-6 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Generating your debrief video...</p>
            <p className="text-sm text-gray-400 mt-2">This usually takes less than 5 minutes</p>
          </div>
        ) : (
          <div className="bg-gray-100 rounded-lg p-12 mb-6 text-center">
            <p className="text-gray-600">Debrief {debrief.status}</p>
          </div>
        )}

        {/* Comparison Section (AC 10) */}
        {comparison && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 mb-6 border border-indigo-200">
            <h2 className="text-lg font-semibold mb-4">Progress Since Last Interview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${comparison.score_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {comparison.score_change >= 0 ? '+' : ''}{comparison.score_change.toFixed(1)}
                </div>
                <div className="text-sm text-gray-500">Overall Change</div>
              </div>
              {Object.entries(comparison.dimension_changes || {}).map(([dim, change]) => (
                <div key={dim} className="text-center">
                  <div className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? '+' : ''}{(change as number).toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-500 capitalize">{dim}</div>
                </div>
              ))}
            </div>
            {debrief.comparison_insights && debrief.comparison_insights.length > 0 && (
              <div className="mt-4 pt-4 border-t border-indigo-200">
                <h3 className="text-sm font-medium mb-2">Insights</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  {debrief.comparison_insights.map((insight, i) => (
                    <li key={i}>• {insight}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Analysis Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Strengths */}
          {debrief.strengths_identified && debrief.strengths_identified.length > 0 && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h2 className="text-lg font-semibold text-green-800 mb-3">Strengths</h2>
              <ul className="space-y-2">
                {debrief.strengths_identified.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-green-700">
                    <span className="text-green-500">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas to Improve */}
          {debrief.weaknesses_identified && debrief.weaknesses_identified.length > 0 && (
            <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
              <h2 className="text-lg font-semibold text-orange-800 mb-3">Areas to Improve</h2>
              <ul className="space-y-2">
                {debrief.weaknesses_identified.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-orange-700">
                    <span className="text-orange-500">→</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Best Answers */}
        {debrief.best_answers && debrief.best_answers.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
            <h2 className="text-lg font-semibold mb-4">Best Moments</h2>
            <div className="space-y-4">
              {debrief.best_answers.map((answer, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-800">{answer.question}</p>
                  <p className="text-sm text-gray-600 mt-2">{answer.whyGood || answer.response?.slice(0, 150)}</p>
                  {answer.score && (
                    <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                      Score: {answer.score}/10
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mentor Feedback (AC 9) */}
        {debrief.mentor_feedback && debrief.mentor_feedback.length > 0 && (
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mt-6">
            <h2 className="text-lg font-semibold text-blue-800 mb-4">Mentor Feedback</h2>
            {debrief.mentor_feedback.map((fb: any, i: number) => (
              <div key={i} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600">From: {fb.mentor_email}</span>
                  {fb.overall_rating && (
                    <span className="px-2 py-0.5 bg-blue-100 rounded text-sm">
                      Rating: {fb.overall_rating}/5
                    </span>
                  )}
                </div>
                <p className="text-gray-700">{fb.comments}</p>
                {fb.focus_areas && fb.focus_areas.length > 0 && (
                  <div className="mt-2">
                    <span className="text-sm text-gray-500">Focus on:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {fb.focus_areas.map((area: string, j: number) => (
                        <span key={j} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Share Modal (AC 9)
  const ShareModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Share Debrief</h2>
        
        {shareUrl && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Share Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={() => copyToClipboard(shareUrl)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <label className="block text-sm font-medium mb-1">Share with Mentor</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={mentorEmail}
              onChange={(e) => setMentorEmail(e.target.value)}
              placeholder="mentor@email.com"
              className="flex-1 px-3 py-2 border rounded-lg"
            />
            <button
              onClick={shareWithMentor}
              disabled={!mentorEmail}
              className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Your mentor will receive the link and can provide feedback
          </p>
        </div>

        <button
          onClick={() => setShowShareModal(false)}
          className="w-full mt-4 py-2 border rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => setError('')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {debrief ? <DebriefDetailView /> : <HistoryView />}
      {showShareModal && <ShareModal />}
    </div>
  );
}
