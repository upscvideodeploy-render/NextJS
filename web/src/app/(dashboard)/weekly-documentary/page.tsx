'use client';

/**
 * Story 10.3: Weekly Documentary - Current Affairs Analysis
 * UI Page: /weekly-documentary
 * 
 * Features:
 * - AC 1: Trigger generation (admin)
 * - AC 8: View latest weekly documentary
 * - AC 9: Browse archive by year/week
 * - AC 10: View and share social clips
 */

import React, { useState, useEffect } from 'react';

// Types
interface WeeklyDocumentary {
  id: string;
  title: string;
  week_number: number;
  year: number;
  week_start_date: string;
  week_end_date: string;
  video_url: string | null;
  video_duration_seconds: number | null;
  thumbnail_url: string | null;
  view_count: number;
  published_at: string | null;
  top_topics_count: number;
  render_status: string;
  top_topics: any[];
  script_content: any;
  social_clips: any[];
  manim_scenes: any[];
}

interface Segment {
  id: string;
  segment_type: string;
  segment_order: number;
  title: string;
  narration: string;
  duration_seconds: number;
  expert_name?: string;
  expert_title?: string;
}

// Segment type colors and icons
const SEGMENT_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  week_overview: { color: 'bg-blue-500', icon: '📋', label: 'Week Overview' },
  top_story: { color: 'bg-purple-500', icon: '⭐', label: 'Top Story' },
  economy: { color: 'bg-green-500', icon: '💰', label: 'Economy' },
  polity: { color: 'bg-red-500', icon: '🏛️', label: 'Polity' },
  ir: { color: 'bg-yellow-500', icon: '🌐', label: 'International Relations' },
  environment: { color: 'bg-teal-500', icon: '🌿', label: 'Environment' },
  science_tech: { color: 'bg-indigo-500', icon: '🔬', label: 'Science & Tech' },
  expert_interview: { color: 'bg-pink-500', icon: '👤', label: 'Expert View' },
  quiz_preview: { color: 'bg-orange-500', icon: '❓', label: 'Quiz Preview' }
};

export default function WeeklyDocumentaryPage() {
  const [archive, setArchive] = useState<WeeklyDocumentary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<WeeklyDocumentary | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showClips, setShowClips] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false); // Would be from auth context
  const [generating, setGenerating] = useState(false);

  // Available years for filter
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  useEffect(() => {
    fetchArchive();
  }, [selectedYear]);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.set('year', selectedYear.toString());
      params.set('limit', '24');

      const res = await fetch(`/api/weekly-documentary?${params}`);
      const data = await res.json();

      if (data.success && data.archive) {
        setArchive(data.archive);
        // Auto-select the latest documentary
        if (data.archive.length > 0 && !selectedDoc) {
          fetchDocumentary(data.archive[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch archive:', error);
    }
    setLoading(false);
  };

  const fetchDocumentary = async (docId: string) => {
    try {
      const res = await fetch(`/api/weekly-documentary?id=${docId}`);
      const data = await res.json();

      if (data.success && data.data) {
        setSelectedDoc(data.data.documentary);
        setSegments(data.data.segments || []);
        setActiveSegment(null);
      }
    } catch (error) {
      console.error('Failed to fetch documentary:', error);
    }
  };

  // AC 1: Trigger generation (admin only)
  const triggerGeneration = async () => {
    if (!isAdmin) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/weekly-documentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger' })
      });
      const data = await res.json();
      if (data.success) {
        alert('Weekly documentary generation started!');
        fetchArchive();
      }
    } catch (error) {
      console.error('Generation failed:', error);
    }
    setGenerating(false);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Weekly Current Affairs Documentary</h1>
          <p className="text-purple-200 mt-2">
            Comprehensive weekly analysis of UPSC-relevant current affairs
          </p>
          
          {/* Admin Controls (AC 1) */}
          {isAdmin && (
            <button
              onClick={triggerGeneration}
              disabled={generating}
              className="mt-4 px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 disabled:opacity-50"
            >
              {generating ? 'Generating...' : '+ Generate This Week\'s Documentary'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Archive Sidebar (AC 9) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-4">Weekly Archive</h2>
              
              {/* Year Filter */}
              <div className="mb-4">
                <select
                  value={selectedYear || ''}
                  onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="">All Years</option>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Archive List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-4 text-gray-500">Loading...</div>
                ) : archive.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No documentaries found</div>
                ) : (
                  archive.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => fetchDocumentary(doc.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedDoc?.id === doc.id
                          ? 'bg-purple-100 border-2 border-purple-500'
                          : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-800">
                        Week {doc.week_number}, {doc.year}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(doc.week_start_date)} - {formatDate(doc.week_end_date)}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>👁️ {doc.view_count}</span>
                        <span>⏱️ {formatDuration(doc.video_duration_seconds)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {selectedDoc ? (
              <>
                {/* Video Player (AC 8) */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="aspect-video bg-gray-900 relative">
                    {selectedDoc.video_url ? (
                      <video
                        src={selectedDoc.video_url}
                        controls
                        className="w-full h-full"
                        poster={selectedDoc.thumbnail_url || undefined}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <div className="text-6xl mb-4">🎬</div>
                          <p>Video processing...</p>
                          <p className="text-sm mt-2">Status: {selectedDoc.render_status}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <h2 className="text-2xl font-bold text-gray-800">{selectedDoc.title}</h2>
                    <div className="flex items-center gap-4 mt-2 text-gray-500">
                      <span>📅 {formatDate(selectedDoc.week_start_date)} - {formatDate(selectedDoc.week_end_date)}</span>
                      <span>⏱️ {formatDuration(selectedDoc.video_duration_seconds)}</span>
                      <span>👁️ {selectedDoc.view_count} views</span>
                    </div>
                  </div>
                </div>

                {/* Segments List (AC 4) */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Documentary Segments</h3>
                  <div className="space-y-3">
                    {segments.map((segment, index) => {
                      const style = SEGMENT_STYLES[segment.segment_type] || SEGMENT_STYLES.top_story;
                      return (
                        <div
                          key={segment.id || index}
                          className={`border rounded-lg overflow-hidden transition-all ${
                            activeSegment === segment.id ? 'border-purple-500 shadow-md' : 'border-gray-200'
                          }`}
                        >
                          <button
                            onClick={() => setActiveSegment(activeSegment === segment.id ? null : segment.id)}
                            className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50"
                          >
                            <div className={`w-10 h-10 ${style.color} rounded-lg flex items-center justify-center text-white text-xl`}>
                              {style.icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                                  {style.label}
                                </span>
                                {segment.expert_name && (
                                  <span className="text-xs text-pink-600">
                                    {segment.expert_name}
                                  </span>
                                )}
                              </div>
                              <div className="font-medium text-gray-800 mt-1">{segment.title}</div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDuration(segment.duration_seconds)}
                            </div>
                            <span className="text-gray-400">
                              {activeSegment === segment.id ? '▼' : '▶'}
                            </span>
                          </button>
                          
                          {activeSegment === segment.id && (
                            <div className="px-4 pb-4 border-t bg-gray-50">
                              <p className="text-gray-600 text-sm mt-3 whitespace-pre-line">
                                {segment.narration}
                              </p>
                              {segment.expert_title && (
                                <p className="text-xs text-gray-500 mt-2 italic">
                                  — {segment.expert_name}, {segment.expert_title}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Topics (AC 3) */}
                {selectedDoc.top_topics && selectedDoc.top_topics.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      Top Topics This Week ({selectedDoc.top_topics.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedDoc.top_topics.map((topic: any, index: number) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                        >
                          {topic.topic || topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Clips (AC 10) */}
                {selectedDoc.social_clips && selectedDoc.social_clips.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">Social Media Clips</h3>
                      <button
                        onClick={() => setShowClips(!showClips)}
                        className="text-purple-600 text-sm hover:underline"
                      >
                        {showClips ? 'Hide' : 'Show All'}
                      </button>
                    </div>
                    
                    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${showClips ? '' : 'hidden md:grid'}`}>
                      {selectedDoc.social_clips.slice(0, showClips ? undefined : 3).map((clip: any, index: number) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">
                              {clip.platform === 'youtube_shorts' ? '📺' : 
                               clip.platform === 'instagram_reels' ? '📸' : '🐦'}
                            </span>
                            <span className="text-sm font-medium capitalize">
                              {clip.platform?.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{clip.title}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-gray-500">
                              {clip.duration_seconds}s
                            </span>
                            {clip.url ? (
                              <a
                                href={clip.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 text-sm hover:underline"
                              >
                                Watch →
                              </a>
                            ) : (
                              <span className="text-xs text-yellow-600">
                                {clip.status || 'Pending'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                      <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                        Share All Clips
                      </button>
                      <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        Download for Sharing
                      </button>
                    </div>
                  </div>
                )}

                {/* Manim Visuals (AC 5) */}
                {selectedDoc.manim_scenes && selectedDoc.manim_scenes.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Data Visualizations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedDoc.manim_scenes.map((scene: any, index: number) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">
                              {scene.scene_type === 'data_chart' ? '📊' :
                               scene.scene_type === 'timeline' ? '📅' :
                               scene.scene_type === 'comparison' ? '⚖️' :
                               scene.scene_type === 'map' ? '🗺️' : '📈'}
                            </span>
                            <span className="font-medium">{scene.title}</span>
                          </div>
                          <p className="text-sm text-gray-500 capitalize">
                            {scene.scene_type?.replace('_', ' ')} • {scene.duration_seconds}s
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="text-6xl mb-4">📺</div>
                <h2 className="text-xl font-semibold text-gray-800">No Documentary Selected</h2>
                <p className="text-gray-500 mt-2">
                  Select a weekly documentary from the archive to view
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Info (AC 1, 8) */}
      <div className="bg-gray-100 border-t py-6 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-600 text-sm">
          <p>
            📅 New documentaries are generated every <strong>Sunday at 8 PM IST</strong> (AC 1)
          </p>
          <p className="mt-1">
            🕗 Available for viewing by <strong>Monday 8 AM IST</strong> (AC 8)
          </p>
        </div>
      </div>
    </div>
  );
}
