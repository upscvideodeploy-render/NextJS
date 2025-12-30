/**
 * Story 10.1: Documentary Script Generator - Long-Form Content
 * AC 1-10: UI for generating and viewing documentary scripts
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DocumentaryScript {
  id: string;
  topic: string;
  title: string;
  status: 'generating' | 'pending_visuals' | 'pending_review' | 'approved' | 'published' | 'failed';
  target_duration_minutes: number;
  actual_word_count: number;
  quality_score: number | null;
  chapter_count: number;
  created_at: string;
}

interface ScriptDetail {
  script: {
    id: string;
    topic: string;
    topic_category: string;
    title: string;
    description: string;
    introduction: any;
    conclusion: any;
    rag_sources: any[];
    source_count: number;
    visual_markers: any[];
    voice_style: string;
    status: string;
    quality_score: number;
    quality_feedback: any;
    actual_word_count: number;
    target_duration_minutes: number;
    generation_time_seconds: number;
    created_at: string;
  };
  chapters: {
    id: string;
    chapter_number: number;
    title: string;
    narration: string;
    word_count: number;
    duration_minutes: number;
    visual_markers: any[];
    voice_segments: any[];
  }[];
}

// Topic categories (AC 2)
const TOPIC_CATEGORIES = [
  { value: '', label: 'Select Category (Optional)' },
  { value: 'Modern Indian History', label: 'Modern Indian History' },
  { value: 'Ancient Indian History', label: 'Ancient Indian History' },
  { value: 'Medieval Indian History', label: 'Medieval Indian History' },
  { value: 'World History', label: 'World History' },
  { value: 'Indian Geography', label: 'Indian Geography' },
  { value: 'World Geography', label: 'World Geography' },
  { value: 'Indian Polity', label: 'Indian Polity' },
  { value: 'Governance', label: 'Governance' },
  { value: 'Economy', label: 'Economy' },
  { value: 'Environment', label: 'Environment & Ecology' },
  { value: 'Science & Technology', label: 'Science & Technology' },
  { value: 'Art & Culture', label: 'Art & Culture' },
  { value: 'Ethics', label: 'Ethics & Integrity' },
  { value: 'International Relations', label: 'International Relations' },
  { value: 'Security', label: 'Internal Security' },
];

// Voice styles (AC 7)
const VOICE_STYLES = [
  { value: 'documentary', label: 'Documentary (Netflix-style)', icon: '🎬' },
  { value: 'academic', label: 'Academic (Lecture-style)', icon: '🎓' },
  { value: 'conversational', label: 'Conversational (Friendly)', icon: '💬' },
];

// Duration options (AC 3)
const DURATION_OPTIONS = [
  { value: 120, label: '2 Hours (~12,000 words)' },
  { value: 150, label: '2.5 Hours (~15,000 words)' },
  { value: 180, label: '3 Hours (~18,000 words)' },
];

export default function DocumentaryPage() {
  // State
  const [scripts, setScripts] = useState<DocumentaryScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scripts' | 'view'>('scripts');

  // Form state (AC 2, 3, 7)
  const [formData, setFormData] = useState({
    topic: '',
    topic_category: '',
    target_duration: 180,
    voice_style: 'documentary'
  });

  // Fetch user's scripts
  const fetchScripts = useCallback(async () => {
    try {
      const token = localStorage.getItem('supabase_token') || '';
      const res = await fetch('/api/documentary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setScripts(data.scripts || []);
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  // Fetch script details
  const fetchScriptDetails = async (scriptId: string) => {
    try {
      const token = localStorage.getItem('supabase_token') || '';
      const res = await fetch(`/api/documentary?id=${scriptId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSelectedScript(data);
      setActiveTab('view');
    } catch (err) {
      console.error('Failed to fetch script:', err);
      setError('Failed to load script details');
    }
  };

  // Generate new documentary (AC 1)
  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const token = localStorage.getItem('supabase_token') || '';
      const res = await fetch('/api/documentary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'generate',
          ...formData
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Generation failed');
      }

      // Success - refresh list and show the new script
      setShowGenerateModal(false);
      setFormData({ topic: '', topic_category: '', target_duration: 180, voice_style: 'documentary' });
      await fetchScripts();
      
      if (data.script_id) {
        await fetchScriptDetails(data.script_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate documentary');
    } finally {
      setIsGenerating(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      generating: 'bg-yellow-100 text-yellow-800',
      pending_visuals: 'bg-blue-100 text-blue-800',
      pending_review: 'bg-orange-100 text-orange-800',
      approved: 'bg-green-100 text-green-800',
      published: 'bg-purple-100 text-purple-800',
      failed: 'bg-red-100 text-red-800'
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`;
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto animate-pulse space-y-6">
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                🎬 Documentary Studio
              </h1>
              <p className="text-sm text-gray-500">Generate 3-hour documentary-style lecture scripts</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setActiveTab('scripts')}
                  className={`px-4 py-2 text-sm ${activeTab === 'scripts' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  My Scripts
                </button>
                <button
                  onClick={() => setActiveTab('view')}
                  disabled={!selectedScript}
                  className={`px-4 py-2 text-sm ${activeTab === 'view' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} disabled:opacity-50`}
                >
                  View Script
                </button>
              </div>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                ✨ Generate Documentary
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {activeTab === 'scripts' ? (
          /* Scripts List */
          <div>
            {scripts.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-6xl mb-6 block">🎬</span>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">No Documentary Scripts Yet</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Generate your first documentary-style lecture script. Our AI will create comprehensive
                  3-hour content with chapters, visual markers, and multiple voice perspectives.
                </p>
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  ✨ Generate Your First Documentary
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {scripts.map(script => (
                  <div
                    key={script.id}
                    onClick={() => fetchScriptDetails(script.id)}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={getStatusBadge(script.status)}>{script.status.replace('_', ' ')}</span>
                      {script.quality_score && (
                        <span className="text-sm font-medium text-gray-500">
                          Quality: {Math.round(script.quality_score * 100)}%
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{script.title}</h3>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-1">{script.topic}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>📝 {script.chapter_count} chapters</span>
                      <span>⏱️ {formatDuration(script.target_duration_minutes)}</span>
                      <span>📄 {script.actual_word_count.toLocaleString()} words</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                      Created {new Date(script.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : selectedScript ? (
          /* Script Viewer */
          <div className="space-y-6">
            {/* Script Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={getStatusBadge(selectedScript.script.status)}>
                    {selectedScript.script.status.replace('_', ' ')}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900 mt-2">{selectedScript.script.title}</h2>
                  <p className="text-gray-500">{selectedScript.script.topic}</p>
                </div>
                {selectedScript.script.quality_score && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {Math.round(selectedScript.script.quality_score * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">Quality Score</div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900">{selectedScript.chapters.length}</div>
                  <div className="text-xs text-gray-500">Chapters</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900">
                    {selectedScript.script.actual_word_count.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">Words</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatDuration(selectedScript.script.target_duration_minutes)}
                  </div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900">{selectedScript.script.source_count}</div>
                  <div className="text-xs text-gray-500">Sources</div>
                </div>
              </div>
            </div>

            {/* Introduction */}
            {selectedScript.script.introduction && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  🎬 Introduction
                  <span className="text-sm font-normal text-gray-500">
                    ({selectedScript.script.introduction.duration_minutes || 10} min)
                  </span>
                </h3>
                {selectedScript.script.introduction.learning_objectives && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Learning Objectives</h4>
                    <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                      {selectedScript.script.introduction.learning_objectives.map((obj: string, i: number) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {selectedScript.script.introduction.narration}
                </div>
              </div>
            )}

            {/* Chapters */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Chapters</h3>
              {selectedScript.chapters.map(chapter => (
                <details key={chapter.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <summary className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      Chapter {chapter.chapter_number}: {chapter.title}
                    </span>
                    <span className="text-sm text-gray-500">
                      {chapter.word_count.toLocaleString()} words • {chapter.duration_minutes} min
                    </span>
                  </summary>
                  <div className="p-4 pt-0 border-t border-gray-100">
                    {/* Visual Markers */}
                    {chapter.visual_markers && chapter.visual_markers.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {chapter.visual_markers.map((marker: any, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                          >
                            [{marker.type}] {marker.description?.substring(0, 30)}...
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                      {chapter.narration}
                    </div>
                  </div>
                </details>
              ))}
            </div>

            {/* Conclusion */}
            {selectedScript.script.conclusion && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  🎯 Conclusion
                  <span className="text-sm font-normal text-gray-500">
                    ({selectedScript.script.conclusion.duration_minutes || 5} min)
                  </span>
                </h3>
                {selectedScript.script.conclusion.key_takeaways && (
                  <div className="mb-4 p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Key Takeaways</h4>
                    <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
                      {selectedScript.script.conclusion.key_takeaways.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedScript.script.conclusion.exam_relevance && (
                  <div className="mb-4 p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-medium text-orange-900 mb-2">UPSC Exam Relevance</h4>
                    <p className="text-sm text-orange-800">{selectedScript.script.conclusion.exam_relevance}</p>
                  </div>
                )}
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {selectedScript.script.conclusion.narration}
                </div>
              </div>
            )}

            {/* Quality Feedback (AC 10) */}
            {selectedScript.script.quality_feedback && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Review</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {['coherence', 'flow', 'upsc_relevance'].map(key => {
                    const feedback = selectedScript.script.quality_feedback[key];
                    if (!feedback) return null;
                    return (
                      <div key={key} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 capitalize">{key.replace('_', ' ')}</span>
                          <span className="text-lg font-bold text-blue-600">{feedback.score}%</span>
                        </div>
                        <p className="text-xs text-gray-500">{feedback.comment}</p>
                      </div>
                    );
                  })}
                </div>
                {selectedScript.script.quality_feedback.suggestions && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-2">Suggestions for Improvement</h4>
                    <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                      {selectedScript.script.quality_feedback.suggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            Select a script to view its content
          </div>
        )}
      </div>

      {/* Generate Modal (AC 2, 3, 7) */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Documentary Script</h2>
            
            <div className="space-y-4">
              {/* Topic (AC 2) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Modern Indian History - 1857 to 1947"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a specific topic or chapter for comprehensive coverage
                </p>
              </div>

              {/* Category (AC 2) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.topic_category}
                  onChange={(e) => setFormData({ ...formData, topic_category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {TOPIC_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Duration (AC 3) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, target_duration: opt.value })}
                      className={`p-3 rounded-lg border text-sm ${
                        formData.target_duration === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Style (AC 7) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voice Style
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {VOICE_STYLES.map(style => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, voice_style: style.value })}
                      className={`p-3 rounded-lg border text-sm flex flex-col items-center gap-1 ${
                        formData.voice_style === style.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl">{style.icon}</span>
                      <span>{style.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setError(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !formData.topic.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Generating... (this may take 2-3 minutes)
                  </>
                ) : (
                  <>✨ Generate Documentary</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
