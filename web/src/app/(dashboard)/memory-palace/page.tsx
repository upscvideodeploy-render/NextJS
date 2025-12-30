'use client';

/**
 * Story 11.2: Memory Palace - Facts to Animated Rooms
 * UI Page: /memory-palace
 * 
 * Features:
 * - AC 1: Input facts list
 * - AC 2: Theme selection
 * - AC 3: Room/station visualization
 * - AC 5: Animation walkthrough
 * - AC 8: Spaced repetition reviews
 * - AC 9: Customization
 * - AC 10: Export/download
 */

import React, { useState, useEffect } from 'react';

// Types
interface Station {
  id: string;
  station_number: number;
  room_name: string;
  fact_text: string;
  visual_type: string;
  visual_description: string;
  visual_config: any;
  entrance_duration_seconds: number;
  station_duration_seconds: number;
  transition_duration_seconds: number;
  sort_order: number;
}

interface Palace {
  id: string;
  title: string;
  palace_theme: string;
  facts_count: number;
  room_count: number;
  animation_status: string;
  video_url?: string;
  thumbnail_url?: string;
  estimated_duration_seconds: number;
  actual_duration_seconds?: number;
  export_status: string;
  export_url?: string;
  mastery_level: number;
  next_review_at?: string;
  is_favorite: boolean;
  created_at: string;
}

interface Review {
  id: string;
  palace_id: string;
  title: string;
  palace_theme: string;
  facts_count: number;
  scheduled_at: string;
  review_number: number;
}

interface Template {
  id: string;
  theme_name: string;
  display_name: string;
  description: string;
  preview_image_url?: string;
  is_premium: boolean;
}

// Theme icons
const THEME_ICONS: Record<string, string> = {
  library: '📚',
  museum: '🏛️',
  courtroom: '⚖️',
  classroom: '🎓',
  temple: '🛕',
  garden: '🌳',
  castle: '🏰',
  market: '🏪',
  custom: '✨'
};

// Mastery level colors
const MASTERY_COLORS = [
  'bg-gray-200',
  'bg-red-300',
  'bg-orange-300',
  'bg-yellow-300',
  'bg-green-300',
  'bg-emerald-400'
];

export default function MemoryPalacePage() {
  // View state
  const [view, setView] = useState<'list' | 'create' | 'palace' | 'review'>('list');
  
  // List state
  const [palaces, setPalaces] = useState<Palace[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [themeFilter, setThemeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Create state (AC 1, 2)
  const [title, setTitle] = useState('');
  const [factsInput, setFactsInput] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('library');
  const [topic, setTopic] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Palace detail state
  const [activePalace, setActivePalace] = useState<Palace | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [activeStation, setActiveStation] = useState<number>(0);
  
  // Review state (AC 8)
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [recallScores, setRecallScores] = useState<number[]>([]);
  const [reviewStartTime, setReviewStartTime] = useState<number>(0);

  useEffect(() => {
    fetchPalaces();
    fetchReviews();
    fetchTemplates();
  }, [themeFilter]);

  const fetchPalaces = async () => {
    try {
      const params = new URLSearchParams();
      if (themeFilter) params.set('theme', themeFilter);
      
      const res = await fetch(`/api/memory-palace?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setPalaces(data.palaces || []);
      }
    } catch (error) {
      console.error('Failed to fetch palaces:', error);
    }
    setLoading(false);
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/memory-palace?action=reviews');
      const data = await res.json();
      
      if (data.success) {
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/memory-palace?action=templates');
      const data = await res.json();
      
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  // AC 1: Create palace from facts
  const handleCreate = async () => {
    const facts = factsInput
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);
    
    if (facts.length < 3) {
      alert('Please enter at least 3 facts (one per line)');
      return;
    }
    
    setCreating(true);
    try {
      const res = await fetch('/api/memory-palace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: title || 'Memory Palace',
          facts,
          theme: selectedTheme,
          topic
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Load the created palace
        await loadPalace(data.palace_id);
        setView('palace');
        
        // Reset form
        setTitle('');
        setFactsInput('');
        setTopic('');
      }
    } catch (error) {
      console.error('Failed to create palace:', error);
    }
    setCreating(false);
  };

  // Load single palace
  const loadPalace = async (palaceId: string) => {
    try {
      const res = await fetch(`/api/memory-palace?id=${palaceId}`);
      const data = await res.json();
      
      if (data.palace) {
        setActivePalace(data.palace);
        setStations(data.stations || []);
        setActiveStation(0);
      }
    } catch (error) {
      console.error('Failed to load palace:', error);
    }
  };

  // AC 5: Generate animation
  const handleGenerateAnimation = async () => {
    if (!activePalace) return;
    
    try {
      const res = await fetch('/api/memory-palace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_animation',
          palace_id: activePalace.id
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setActivePalace(prev => prev ? { ...prev, animation_status: 'generating' } : null);
        pollAnimationStatus(activePalace.id);
      }
    } catch (error) {
      console.error('Failed to generate animation:', error);
    }
  };

  // Poll animation status
  const pollAnimationStatus = async (palaceId: string) => {
    const checkStatus = async () => {
      const res = await fetch(`/api/memory-palace?id=${palaceId}`);
      const data = await res.json();
      
      if (data.palace?.animation_status === 'completed') {
        setActivePalace(prev => prev ? {
          ...prev,
          animation_status: 'completed',
          video_url: data.palace.video_url,
          thumbnail_url: data.palace.thumbnail_url
        } : null);
        return true;
      } else if (data.palace?.animation_status === 'failed') {
        setActivePalace(prev => prev ? { ...prev, animation_status: 'failed' } : null);
        return true;
      }
      return false;
    };
    
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000));
      if (await checkStatus()) break;
    }
  };

  // AC 10: Export/download
  const handleExport = async () => {
    if (!activePalace) return;
    
    try {
      const res = await fetch('/api/memory-palace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          palace_id: activePalace.id
        })
      });
      
      const data = await res.json();
      if (data.success && data.export_url) {
        window.open(data.export_url, '_blank');
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // AC 9: Rearrange stations
  const handleMoveStation = async (fromIndex: number, toIndex: number) => {
    if (!activePalace) return;
    
    const newStations = [...stations];
    const [moved] = newStations.splice(fromIndex, 1);
    newStations.splice(toIndex, 0, moved);
    setStations(newStations);
    
    try {
      await fetch('/api/memory-palace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rearrange',
          palace_id: activePalace.id,
          station_order: newStations.map(s => s.id)
        })
      });
    } catch (error) {
      console.error('Rearrange failed:', error);
    }
  };

  // AC 8: Start review
  const startReview = (review: Review) => {
    setActiveReview(review);
    setRecallScores(new Array(review.facts_count).fill(0));
    setReviewStartTime(Date.now());
    loadPalace(review.palace_id);
    setView('review');
  };

  // AC 8: Complete review
  const completeReview = async () => {
    if (!activeReview) return;
    
    const avgScore = Math.round(recallScores.reduce((a, b) => a + b, 0) / recallScores.length);
    const stationsRecalled = recallScores.filter(s => s >= 3).length;
    const timeSpent = Math.round((Date.now() - reviewStartTime) / 1000);
    
    try {
      const res = await fetch('/api/memory-palace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_review',
          review_id: activeReview.id,
          recall_score: avgScore,
          stations_recalled: stationsRecalled,
          time_spent: timeSpent
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert(`Review complete! Next review in ${data.interval_days} days`);
        setView('list');
        fetchReviews();
        fetchPalaces();
      }
    } catch (error) {
      console.error('Complete review failed:', error);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (palaceId: string) => {
    try {
      const res = await fetch('/api/memory-palace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_favorite',
          palace_id: palaceId
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setPalaces(palaces.map(p => 
          p.id === palaceId ? { ...p, is_favorite: data.is_favorite } : p
        ));
      }
    } catch (error) {
      console.error('Toggle favorite failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Memory Palace</h1>
              <p className="text-purple-200 mt-2">
                Transform facts into memorable visual journeys
              </p>
            </div>
            <div className="flex gap-3">
              {view !== 'list' && (
                <button
                  onClick={() => { setView('list'); setActivePalace(null); }}
                  className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30"
                >
                  ← Back to List
                </button>
              )}
              {view === 'list' && (
                <button
                  onClick={() => setView('create')}
                  className="px-4 py-2 bg-white text-purple-700 rounded-lg hover:bg-purple-50"
                >
                  + Create Palace
                </button>
              )}
            </div>
          </div>
          
          {/* Due Reviews Alert (AC 8) */}
          {reviews.length > 0 && view === 'list' && (
            <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
              <span className="text-yellow-200">🔔 {reviews.length} review{reviews.length > 1 ? 's' : ''} due!</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* List View */}
        {view === 'list' && (
          <div className="space-y-6">
            {/* Due Reviews Section (AC 8) */}
            {reviews.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-yellow-800 mb-4">
                  📅 Due for Review
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reviews.map(review => (
                    <button
                      key={review.id}
                      onClick={() => startReview(review)}
                      className="text-left p-4 bg-white border-2 border-yellow-300 rounded-lg hover:border-yellow-500 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{THEME_ICONS[review.palace_theme]}</span>
                        <span className="font-medium text-gray-800">{review.title}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Review #{review.review_number} • {review.facts_count} facts
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        Scheduled: {new Date(review.scheduled_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Theme Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setThemeFilter('')}
                className={`px-4 py-2 rounded-full text-sm ${
                  !themeFilter ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                All Themes
              </button>
              {Object.entries(THEME_ICONS).map(([theme, icon]) => (
                <button
                  key={theme}
                  onClick={() => setThemeFilter(theme)}
                  className={`px-4 py-2 rounded-full text-sm ${
                    themeFilter === theme ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {icon} {theme}
                </button>
              ))}
            </div>
            
            {/* Palaces Grid */}
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : palaces.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No memory palaces yet</p>
                <button
                  onClick={() => setView('create')}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg"
                >
                  Create Your First Palace
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {palaces.map(palace => (
                  <div
                    key={palace.id}
                    className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Thumbnail */}
                    <div 
                      className="h-40 bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center cursor-pointer"
                      onClick={() => { loadPalace(palace.id); setView('palace'); }}
                    >
                      {palace.thumbnail_url ? (
                        <img src={palace.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-6xl">{THEME_ICONS[palace.palace_theme]}</span>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <h3 
                          className="font-semibold text-gray-800 cursor-pointer hover:text-purple-600"
                          onClick={() => { loadPalace(palace.id); setView('palace'); }}
                        >
                          {palace.title}
                        </h3>
                        <button
                          onClick={() => toggleFavorite(palace.id)}
                          className="text-lg"
                        >
                          {palace.is_favorite ? '⭐' : '☆'}
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <span>{palace.facts_count} facts</span>
                        <span>•</span>
                        <span>{palace.room_count} rooms</span>
                        <span>•</span>
                        <span className={
                          palace.animation_status === 'completed' ? 'text-green-600' :
                          palace.animation_status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                        }>
                          {palace.animation_status}
                        </span>
                      </div>
                      
                      {/* Mastery Level */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Mastery:</span>
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4, 5].map(level => (
                            <div
                              key={level}
                              className={`w-4 h-2 rounded-sm ${
                                level <= palace.mastery_level 
                                  ? MASTERY_COLORS[palace.mastery_level] 
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Next Review */}
                      {palace.next_review_at && (
                        <p className="text-xs text-gray-400 mt-2">
                          Next review: {new Date(palace.next_review_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create View (AC 1, 2) */}
        {view === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Create Memory Palace</h2>
              
              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Palace Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Constitutional Articles"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              {/* Topic */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Topic (optional)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Polity, History, Geography"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              
              {/* Theme Selection (AC 2) */}
              <div className="mb-6">
                <label className="block text-sm text-gray-600 mb-2">Palace Theme</label>
                <div className="grid grid-cols-4 gap-3">
                  {templates.map(template => (
                    <button
                      key={template.theme_name}
                      onClick={() => setSelectedTheme(template.theme_name)}
                      disabled={template.is_premium}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${
                        selectedTheme === template.theme_name
                          ? 'border-purple-500 bg-purple-50'
                          : template.is_premium
                          ? 'border-gray-200 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <span className="text-3xl block mb-1">
                        {THEME_ICONS[template.theme_name]}
                      </span>
                      <span className="text-sm text-gray-700">{template.display_name}</span>
                      {template.is_premium && (
                        <span className="text-xs text-amber-600 block mt-1">Pro</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Facts Input (AC 1) */}
              <div className="mb-6">
                <label className="block text-sm text-gray-600 mb-2">
                  Facts to Memorize (one per line)
                </label>
                <textarea
                  value={factsInput}
                  onChange={(e) => setFactsInput(e.target.value)}
                  placeholder={`Article 14 - Right to Equality\nArticle 19 - Freedom of Speech\nArticle 21 - Right to Life\n...`}
                  className="w-full h-48 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter at least 3 facts. Each fact will become a station in your palace.
                </p>
              </div>
              
              {/* Create Button */}
              <button
                onClick={handleCreate}
                disabled={creating || factsInput.split('\n').filter(f => f.trim()).length < 3}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {creating ? '🔄 Creating Palace...' : '✨ Create Memory Palace'}
              </button>
            </div>
          </div>
        )}

        {/* Palace Detail View (AC 3, 5, 9, 10) */}
        {view === 'palace' && activePalace && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Palace Header */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{THEME_ICONS[activePalace.palace_theme]}</span>
                      <h2 className="text-2xl font-bold text-gray-800">{activePalace.title}</h2>
                    </div>
                    <p className="text-gray-500">
                      {activePalace.facts_count} facts • {activePalace.room_count} rooms • 
                      ~{Math.round(activePalace.estimated_duration_seconds / 60)}min
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleFavorite(activePalace.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-xl"
                    >
                      {activePalace.is_favorite ? '⭐' : '☆'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Video Player (AC 5) */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {activePalace.animation_status === 'completed' && activePalace.video_url ? (
                  <div>
                    <video
                      src={activePalace.video_url}
                      controls
                      className="w-full aspect-video"
                      poster={activePalace.thumbnail_url}
                    />
                    <div className="p-4 flex justify-end">
                      <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        📥 Download Video
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-900 flex items-center justify-center text-white">
                    {activePalace.animation_status === 'generating' || activePalace.animation_status === 'rendering' ? (
                      <div className="text-center">
                        <div className="text-4xl mb-3 animate-pulse">🏰</div>
                        <p>Building your palace...</p>
                        <p className="text-sm text-gray-400 mt-1">This may take 1-2 minutes</p>
                      </div>
                    ) : activePalace.animation_status === 'failed' ? (
                      <div className="text-center text-red-400">
                        <div className="text-4xl mb-3">❌</div>
                        <p>Animation generation failed</p>
                        <button
                          onClick={handleGenerateAnimation}
                          className="mt-4 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-6xl mb-4">{THEME_ICONS[activePalace.palace_theme]}</div>
                        <p className="mb-4">Animation not yet generated</p>
                        <button
                          onClick={handleGenerateAnimation}
                          className="px-6 py-3 bg-purple-600 rounded-lg hover:bg-purple-700"
                        >
                          🎬 Generate Animation
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stations List (AC 3, 9) */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Palace Stations ({stations.length})
                </h3>
                <div className="space-y-3">
                  {stations.map((station, index) => (
                    <div
                      key={station.id}
                      onClick={() => setActiveStation(index)}
                      className={`p-4 rounded-lg cursor-pointer transition-all flex items-start gap-4 ${
                        activeStation === index 
                          ? 'bg-purple-50 border-2 border-purple-500' 
                          : 'bg-gray-50 border-2 border-transparent hover:border-purple-200'
                      }`}
                    >
                      {/* Reorder Controls (AC 9) */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveStation(index, index - 1); }}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {station.station_number}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveStation(index, index + 1); }}
                          disabled={index === stations.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                      
                      {/* Station Content */}
                      <div className="flex-1">
                        <p className="text-sm text-purple-600 mb-1">{station.room_name}</p>
                        <p className="font-medium text-gray-800">{station.fact_text}</p>
                        {station.visual_description && (
                          <p className="text-sm text-gray-500 mt-2 italic">
                            🎨 {station.visual_description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2 text-xs text-gray-400">
                          <span>Entrance: {station.entrance_duration_seconds}s</span>
                          <span>•</span>
                          <span>Station: {station.station_duration_seconds}s</span>
                          <span>•</span>
                          <span>Transition: {station.transition_duration_seconds}s</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Mastery Progress */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Mastery Progress</h3>
                <div className="text-center">
                  <div className="text-5xl font-bold text-purple-600 mb-2">
                    {activePalace.mastery_level}/5
                  </div>
                  <div className="flex justify-center gap-2 mb-4">
                    {[0, 1, 2, 3, 4, 5].map(level => (
                      <div
                        key={level}
                        className={`w-6 h-3 rounded ${
                          level <= activePalace.mastery_level 
                            ? MASTERY_COLORS[activePalace.mastery_level] 
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  {activePalace.next_review_at && (
                    <p className="text-sm text-gray-500">
                      Next review: {new Date(activePalace.next_review_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Memory Tips */}
              <div className="bg-purple-50 rounded-xl p-6">
                <h3 className="font-semibold text-purple-800 mb-3">💡 Memory Tips</h3>
                <ul className="text-sm text-purple-700 space-y-2">
                  <li>• Walk through your palace in order</li>
                  <li>• Make visuals bizarre and exaggerated</li>
                  <li>• Engage multiple senses</li>
                  <li>• Review at spaced intervals: 1, 3, 7, 14 days</li>
                  <li>• Practice recalling without looking</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Review View (AC 8) */}
        {view === 'review' && activeReview && activePalace && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                📝 Review: {activePalace.title}
              </h2>
              <p className="text-gray-500 mb-6">
                Review #{activeReview.review_number} • Rate your recall for each station
              </p>
              
              {/* Stations to Review */}
              <div className="space-y-4">
                {stations.map((station, index) => (
                  <div key={station.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-4">
                      <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {station.station_number}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-purple-600 mb-1">{station.room_name}</p>
                        <p className="font-medium text-gray-800 mb-3">{station.fact_text}</p>
                        
                        {/* Recall Score */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Recall:</span>
                          {[1, 2, 3, 4, 5].map(score => (
                            <button
                              key={score}
                              onClick={() => {
                                const newScores = [...recallScores];
                                newScores[index] = score;
                                setRecallScores(newScores);
                              }}
                              className={`w-8 h-8 rounded-full border-2 text-sm font-medium transition-all ${
                                recallScores[index] === score
                                  ? 'bg-purple-600 border-purple-600 text-white'
                                  : 'border-gray-300 hover:border-purple-400'
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                          <span className="text-xs text-gray-400 ml-2">
                            {recallScores[index] >= 4 ? '✓ Good' : recallScores[index] >= 2 ? '~ Partial' : recallScores[index] >= 1 ? '✗ Forgot' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Complete Review */}
              <button
                onClick={completeReview}
                disabled={recallScores.some(s => s === 0)}
                className="w-full mt-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                ✅ Complete Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
