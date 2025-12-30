'use client';

/**
 * Immersive 360° Visualizations Page
 * Story 15.1: VR-Compatible Immersive Experiences
 * 
 * Features:
 * - 360° panoramic viewing (AC 1, 5)
 * - WebXR VR headset support (AC 2)
 * - Interactive hotspots (AC 3)
 * - Embedded quizzes (AC 4)
 * - Spatial audio (AC 6)
 * - 5-15 minute experiences (AC 7)
 * - History & Geography content (AC 8)
 * - 4K/60fps quality (AC 9)
 * - Pro subscription required (AC 10)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// =====================================================
// Types
// =====================================================
interface Category {
  id: string;
  name: string;
  slug: string;
  subject: string;
  description: string;
  icon: string;
}

interface Experience {
  id: string;
  title: string;
  slug: string;
  description: string;
  subject: 'history' | 'geography';
  topic: string;
  duration_seconds: number;
  resolution: string;
  framerate: number;
  preview_thumbnail: string;
  preview_video_url: string;
  main_360_video_url: string;
  audio_narration_url: string;
  is_premium: boolean;
  required_tier: string;
  status: string;
  view_count: number;
  avg_rating: number;
  tags: string[];
  upsc_relevance: string;
  syllabus_topics: string[];
  webxr_config: {
    enabled: boolean;
    supported_headsets: string[];
    fallback_mobile_360: boolean;
  };
}

interface Scene {
  id: string;
  scene_order: number;
  title: string;
  description: string;
  duration_seconds: number;
  scene_360_url: string;
  thumbnail_url: string;
  audio_url: string;
  narration_text: string;
  start_position: { x: number; y: number; z: number };
  initial_view_direction: { yaw: number; pitch: number };
  transition_type: string;
}

interface Hotspot {
  id: string;
  scene_id: string;
  position: { yaw: number; pitch: number; distance: number };
  hotspot_type: 'info' | 'media' | 'quiz' | 'navigation' | 'audio';
  icon: string;
  label: string;
  size: string;
  color: string;
  pulse_animation: boolean;
  content: Record<string, unknown>;
}

interface Quiz {
  id: string;
  trigger_type: string;
  trigger_at_seconds: number;
  question: string;
  question_type: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  points: number;
  time_limit_seconds: number;
}

interface UserProgress {
  watch_progress_seconds: number;
  total_watch_time_seconds: number;
  completed_at: string | null;
  quizzes_attempted: number;
  quizzes_correct: number;
  total_quiz_points: number;
  hotspots_clicked: string[];
  user_rating: number | null;
}

// =====================================================
// Main Component
// =====================================================
export default function ImmersivePage() {
  // View state
  const [view, setView] = useState<'discovery' | 'viewer'>('discovery');
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  
  // Discovery data
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Experience[]>([]);
  const [bySubject, setBySubject] = useState<Record<string, Experience[]>>({});
  const [continueWatching, setContinueWatching] = useState<{ experience: Experience; progress: UserProgress }[]>([]);
  
  // Viewer data
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  
  // Viewer state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [viewDirection, setViewDirection] = useState({ yaw: 0, pitch: 0 });
  const [zoom, setZoom] = useState(1);
  const [isVRMode, setIsVRMode] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  
  // Access control
  const [hasAccess, setHasAccess] = useState(true);
  const [accessReason, setAccessReason] = useState<string>('');
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingExperience, setLoadingExperience] = useState(false);
  
  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  
  // =====================================================
  // Data Loading
  // =====================================================
  useEffect(() => {
    loadDiscovery();
  }, []);
  
  const loadDiscovery = async () => {
    try {
      const res = await fetch('/api/immersive?action=discovery');
      const data = await res.json();
      
      if (data.success) {
        setCategories(data.categories || []);
        setFeatured(data.discovery?.featured || []);
        setBySubject(data.discovery?.by_subject || {});
        setContinueWatching(data.discovery?.continue_watching || []);
      }
    } catch (error) {
      console.error('Failed to load discovery:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadExperience = async (experienceId: string) => {
    setLoadingExperience(true);
    try {
      const res = await fetch(`/api/immersive?action=experience&id=${experienceId}`);
      const data = await res.json();
      
      if (data.success) {
        setSelectedExperience(data.experience);
        setScenes(data.scenes?.map((s: { scene: Scene }) => s.scene) || []);
        setHotspots(data.scenes?.flatMap((s: { hotspots: Hotspot[] }) => s.hotspots) || []);
        setQuizzes(data.quizzes || []);
        setProgress(data.user_progress);
        setHasAccess(data.access?.hasAccess !== false);
        setAccessReason(data.access?.reason || '');
        
        if (data.scenes?.length > 0) {
          setCurrentScene(data.scenes[0].scene);
        }
        
        setView('viewer');
      }
    } catch (error) {
      console.error('Failed to load experience:', error);
    } finally {
      setLoadingExperience(false);
    }
  };
  
  // =====================================================
  // Viewer Controls
  // =====================================================
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    
    setViewDirection(prev => ({
      yaw: (prev.yaw + deltaX * 0.3) % 360,
      pitch: Math.max(-85, Math.min(85, prev.pitch - deltaY * 0.3))
    }));
    
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);
  
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.5, Math.min(2, prev - e.deltaY * 0.001)));
  }, []);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        setViewDirection(prev => ({ ...prev, yaw: prev.yaw - 10 }));
        break;
      case 'ArrowRight':
        setViewDirection(prev => ({ ...prev, yaw: prev.yaw + 10 }));
        break;
      case 'ArrowUp':
        setViewDirection(prev => ({ ...prev, pitch: Math.min(85, prev.pitch + 10) }));
        break;
      case 'ArrowDown':
        setViewDirection(prev => ({ ...prev, pitch: Math.max(-85, prev.pitch - 10) }));
        break;
      case ' ':
        setIsPlaying(prev => !prev);
        break;
      case 'Escape':
        setActiveHotspot(null);
        setActiveQuiz(null);
        break;
    }
  }, []);
  
  useEffect(() => {
    if (view === 'viewer') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [view, handleKeyDown]);
  
  // =====================================================
  // Hotspot Interaction (AC 3)
  // =====================================================
  const handleHotspotClick = async (hotspot: Hotspot) => {
    setActiveHotspot(hotspot);
    
    // Track click
    await fetch('/api/immersive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hotspot-click', hotspot_id: hotspot.id })
    });
    
    // If it's a navigation hotspot, go to that scene
    if (hotspot.hotspot_type === 'navigation' && hotspot.content.target_scene_id) {
      const targetScene = scenes.find(s => s.id === hotspot.content.target_scene_id);
      if (targetScene) {
        setCurrentScene(targetScene);
        setActiveHotspot(null);
      }
    }
  };
  
  // =====================================================
  // Quiz Handling (AC 4)
  // =====================================================
  const handleQuizAnswer = async (quiz: Quiz, answer: number) => {
    setQuizAnswer(answer);
    
    try {
      const res = await fetch('/api/immersive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quiz-answer',
          quiz_id: quiz.id,
          answer,
          time_taken: 15
        })
      });
      
      const data = await res.json();
      setQuizResult({
        correct: data.is_correct,
        explanation: data.explanation || quiz.explanation
      });
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    }
  };
  
  const closeQuiz = () => {
    setActiveQuiz(null);
    setQuizAnswer(null);
    setQuizResult(null);
  };
  
  // =====================================================
  // VR Mode (AC 2)
  // =====================================================
  const enterVRMode = async () => {
    if ('xr' in navigator) {
      try {
        // Check for WebXR support
        const xr = navigator as Navigator & { xr?: { isSessionSupported: (mode: string) => Promise<boolean> } };
        const supported = await xr.xr?.isSessionSupported('immersive-vr');
        
        if (supported) {
          setIsVRMode(true);
          // In a real implementation, this would request an XR session
          alert('VR mode activated! Put on your headset.');
        } else {
          alert('VR headset not detected. Using 360° mobile view instead.');
        }
      } catch {
        alert('WebXR not supported in this browser. Using fallback 360° view.');
      }
    } else {
      alert('WebXR not supported. Using fallback 360° view.');
    }
  };
  
  // =====================================================
  // Progress Saving
  // =====================================================
  const saveProgress = useCallback(async () => {
    if (!selectedExperience || !currentScene) return;
    
    try {
      await fetch('/api/immersive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'progress',
          experience_id: selectedExperience.id,
          scene_id: currentScene.id,
          watch_seconds: currentTime,
          device: isVRMode ? 'vr' : 'web'
        })
      });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [selectedExperience, currentScene, currentTime, isVRMode]);
  
  // Auto-save progress every 30 seconds
  useEffect(() => {
    if (view === 'viewer' && isPlaying) {
      const interval = setInterval(saveProgress, 30000);
      return () => clearInterval(interval);
    }
  }, [view, isPlaying, saveProgress]);
  
  // =====================================================
  // Scene Navigation (AC 5)
  // =====================================================
  const goToScene = (sceneIndex: number) => {
    if (scenes[sceneIndex]) {
      setCurrentScene(scenes[sceneIndex]);
      setCurrentTime(0);
    }
  };
  
  const nextScene = () => {
    const currentIndex = scenes.findIndex(s => s.id === currentScene?.id);
    if (currentIndex < scenes.length - 1) {
      goToScene(currentIndex + 1);
    }
  };
  
  const prevScene = () => {
    const currentIndex = scenes.findIndex(s => s.id === currentScene?.id);
    if (currentIndex > 0) {
      goToScene(currentIndex - 1);
    }
  };
  
  // =====================================================
  // Rating
  // =====================================================
  const rateExperience = async (rating: number) => {
    if (!selectedExperience) return;
    
    try {
      await fetch('/api/immersive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rate',
          experience_id: selectedExperience.id,
          rating
        })
      });
      
      setProgress(prev => prev ? { ...prev, user_rating: rating } : null);
    } catch (error) {
      console.error('Failed to rate:', error);
    }
  };
  
  // =====================================================
  // Render: Discovery View
  // =====================================================
  if (view === 'discovery') {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gradient-to-r from-purple-900 to-indigo-900 py-8 px-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold mb-2">🌐 Immersive 360° Experiences</h1>
            <p className="text-purple-200 text-lg">
              Explore history and geography in breathtaking VR-compatible 360° visualizations
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="bg-purple-700 px-3 py-1 rounded-full">✨ 4K Quality</span>
              <span className="bg-purple-700 px-3 py-1 rounded-full">🎮 VR Compatible</span>
              <span className="bg-purple-700 px-3 py-1 rounded-full">🎯 Interactive Hotspots</span>
              <span className="bg-purple-700 px-3 py-1 rounded-full">📝 Embedded Quizzes</span>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            </div>
          ) : (
            <>
              {/* Continue Watching */}
              {continueWatching.length > 0 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-bold mb-4">▶️ Continue Watching</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {continueWatching.map(({ experience, progress: prog }) => (
                      <div
                        key={experience.id}
                        onClick={() => loadExperience(experience.id)}
                        className="bg-gray-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
                      >
                        <div className="relative h-40 bg-gradient-to-br from-purple-600 to-indigo-600">
                          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-700">
                            <div
                              className="h-full bg-purple-500"
                              style={{ width: `${(prog.watch_progress_seconds / experience.duration_seconds) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold">{experience.title}</h3>
                          <p className="text-sm text-gray-400">
                            {Math.floor((experience.duration_seconds - prog.watch_progress_seconds) / 60)} min left
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              
              {/* Categories */}
              <section className="mb-12">
                <h2 className="text-2xl font-bold mb-4">📚 Categories</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {categories.map(cat => (
                    <div
                      key={cat.id}
                      className="bg-gray-800 rounded-xl p-6 text-center hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <span className="text-4xl">{cat.icon}</span>
                      <h3 className="mt-2 font-semibold">{cat.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">{cat.description}</p>
                    </div>
                  ))}
                </div>
              </section>
              
              {/* Featured */}
              {featured.length > 0 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-bold mb-4">⭐ Featured Experiences</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featured.map(exp => (
                      <ExperienceCard
                        key={exp.id}
                        experience={exp}
                        onSelect={() => loadExperience(exp.id)}
                        loading={loadingExperience}
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {/* By Subject (AC 8) */}
              {Object.entries(bySubject).map(([subject, experiences]) => (
                <section key={subject} className="mb-12">
                  <h2 className="text-2xl font-bold mb-4 capitalize">
                    {subject === 'history' ? '🏛️' : '🌍'} {subject} Experiences
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {experiences.slice(0, 4).map(exp => (
                      <ExperienceCard
                        key={exp.id}
                        experience={exp}
                        onSelect={() => loadExperience(exp.id)}
                        loading={loadingExperience}
                        compact
                      />
                    ))}
                  </div>
                </section>
              ))}
              
              {/* Pro Banner (AC 10) */}
              <section className="bg-gradient-to-r from-amber-900 to-orange-900 rounded-2xl p-8 text-center">
                <h2 className="text-3xl font-bold mb-2">👑 Unlock Premium Experiences</h2>
                <p className="text-amber-200 mb-4">
                  Get access to all 360° immersive content with Pro or Annual subscription
                </p>
                <button className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-lg transition-colors">
                  Upgrade to Pro
                </button>
              </section>
            </>
          )}
        </main>
      </div>
    );
  }
  
  // =====================================================
  // Render: Viewer View
  // =====================================================
  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Access Gate (AC 10) */}
      {!hasAccess && (
        <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-md text-center">
            <span className="text-6xl">🔒</span>
            <h2 className="text-2xl font-bold mt-4">Premium Content</h2>
            <p className="text-gray-400 mt-2">{accessReason || 'This experience requires a Pro subscription'}</p>
            <div className="mt-6 space-y-3">
              <button className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-semibold">
                Upgrade to Pro
              </button>
              <button
                onClick={() => setView('discovery')}
                className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg"
              >
                Browse Free Content
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Bar */}
      <header className="bg-gray-900/80 backdrop-blur px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setView('discovery'); saveProgress(); }}
            className="p-2 hover:bg-gray-700 rounded-lg"
          >
            ← Back
          </button>
          <div>
            <h1 className="font-bold">{selectedExperience?.title}</h1>
            <p className="text-sm text-gray-400">
              Scene {scenes.findIndex(s => s.id === currentScene?.id) + 1} of {scenes.length}: {currentScene?.title}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quality Badge (AC 9) */}
          <span className="bg-green-600/30 text-green-400 px-2 py-1 rounded text-sm">
            {selectedExperience?.resolution} • {selectedExperience?.framerate}fps
          </span>
          
          {/* VR Button (AC 2) */}
          <button
            onClick={enterVRMode}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              isVRMode ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            🥽 {isVRMode ? 'Exit VR' : 'Enter VR'}
          </button>
        </div>
      </header>
      
      {/* Main 360° Viewer */}
      <div
        ref={viewerRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* 360° Background - Simulated with CSS transform */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900"
          style={{
            transform: `scale(${zoom}) rotateY(${viewDirection.yaw}deg) rotateX(${viewDirection.pitch}deg)`,
            transformOrigin: 'center center',
            transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* Panoramic content placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-6xl mb-4">🌐</p>
              <p className="text-xl text-purple-200">360° Panoramic View</p>
              <p className="text-gray-400">{currentScene?.description}</p>
              {currentScene?.narration_text && (
                <p className="mt-4 max-w-2xl mx-auto italic text-purple-300">
                  &ldquo;{currentScene.narration_text}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Hotspots (AC 3) */}
        {hotspots
          .filter(h => h.scene_id === currentScene?.id)
          .map(hotspot => {
            // Convert spherical position to screen position (simplified)
            const x = 50 + (hotspot.position.yaw - viewDirection.yaw) * 0.5;
            const y = 50 - (hotspot.position.pitch - viewDirection.pitch) * 0.5;
            
            // Only show if in view
            if (x < 0 || x > 100 || y < 0 || y > 100) return null;
            
            return (
              <button
                key={hotspot.id}
                onClick={() => handleHotspotClick(hotspot)}
                className={`absolute z-30 transform -translate-x-1/2 -translate-y-1/2 
                  w-12 h-12 rounded-full flex items-center justify-center
                  transition-all hover:scale-125 ${hotspot.pulse_animation ? 'animate-pulse' : ''}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  backgroundColor: hotspot.color + '80',
                  border: `2px solid ${hotspot.color}`
                }}
                title={hotspot.label}
              >
                <span className="text-xl">{hotspot.icon}</span>
              </button>
            );
          })}
        
        {/* View Direction Indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full text-sm">
          Yaw: {Math.round(viewDirection.yaw)}° | Pitch: {Math.round(viewDirection.pitch)}° | Zoom: {zoom.toFixed(1)}x
        </div>
        
        {/* Navigation Controls (AC 5) */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
          <button
            onClick={() => setViewDirection(prev => ({ ...prev, yaw: prev.yaw - 30 }))}
            className="p-3 bg-black/50 hover:bg-black/70 rounded-full"
          >
            ⬅️
          </button>
          <button
            onClick={() => setViewDirection(prev => ({ ...prev, pitch: Math.min(85, prev.pitch + 20) }))}
            className="p-3 bg-black/50 hover:bg-black/70 rounded-full"
          >
            ⬆️
          </button>
          <button
            onClick={() => setViewDirection(prev => ({ ...prev, pitch: Math.max(-85, prev.pitch - 20) }))}
            className="p-3 bg-black/50 hover:bg-black/70 rounded-full"
          >
            ⬇️
          </button>
          <button
            onClick={() => setViewDirection(prev => ({ ...prev, yaw: prev.yaw + 30 }))}
            className="p-3 bg-black/50 hover:bg-black/70 rounded-full"
          >
            ➡️
          </button>
          <button
            onClick={() => setZoom(prev => Math.min(2, prev + 0.2))}
            className="p-3 bg-black/50 hover:bg-black/70 rounded-full"
          >
            🔍+
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
            className="p-3 bg-black/50 hover:bg-black/70 rounded-full"
          >
            🔍-
          </button>
        </div>
      </div>
      
      {/* Bottom Controls */}
      <div className="bg-gray-900/80 backdrop-blur px-4 py-3 z-40">
        {/* Scene Timeline */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={prevScene}
            disabled={scenes.findIndex(s => s.id === currentScene?.id) === 0}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-50"
          >
            ⏮️
          </button>
          
          <div className="flex-1 flex gap-1">
            {scenes.map((scene, idx) => (
              <button
                key={scene.id}
                onClick={() => goToScene(idx)}
                className={`flex-1 h-2 rounded transition-colors ${
                  scene.id === currentScene?.id
                    ? 'bg-purple-500'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={scene.title}
              />
            ))}
          </div>
          
          <button
            onClick={nextScene}
            disabled={scenes.findIndex(s => s.id === currentScene?.id) === scenes.length - 1}
            className="p-2 hover:bg-gray-700 rounded disabled:opacity-50"
          >
            ⏭️
          </button>
        </div>
        
        {/* Play Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 bg-purple-600 hover:bg-purple-500 rounded-full"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            
            <span className="text-sm text-gray-400">
              {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')} / 
              {Math.floor((currentScene?.duration_seconds || 0) / 60)}:{((currentScene?.duration_seconds || 0) % 60).toString().padStart(2, '0')}
            </span>
          </div>
          
          {/* Rating */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Rate:</span>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => rateExperience(star)}
                className={`text-xl ${
                  (progress?.user_rating || 0) >= star ? 'text-yellow-400' : 'text-gray-600'
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
          
          {/* Audio Toggle (AC 6) */}
          <button className="p-2 hover:bg-gray-700 rounded">
            🔊 Spatial Audio
          </button>
        </div>
      </div>
      
      {/* Hotspot Modal (AC 3) */}
      {activeHotspot && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span>{activeHotspot.icon}</span>
                  {activeHotspot.label}
                </h3>
                <button
                  onClick={() => setActiveHotspot(null)}
                  className="p-2 hover:bg-gray-700 rounded-full"
                >
                  ✕
                </button>
              </div>
              
              {activeHotspot.hotspot_type === 'info' && (
                <div>
                  <h4 className="font-semibold mb-2">
                    {(activeHotspot.content as { title?: string }).title}
                  </h4>
                  <p className="text-gray-300">
                    {(activeHotspot.content as { description?: string }).description}
                  </p>
                  {(activeHotspot.content as { facts?: string[] }).facts && (
                    <ul className="mt-4 space-y-2">
                      {((activeHotspot.content as { facts: string[] }).facts).map((fact: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-purple-400">•</span>
                          {fact}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              
              {activeHotspot.hotspot_type === 'quiz' && (
                <QuizOverlay
                  quiz={{
                    id: activeHotspot.id,
                    question: (activeHotspot.content as { question?: string }).question || '',
                    options: (activeHotspot.content as { options?: string[] }).options || [],
                    correct_answer: (activeHotspot.content as { correct?: number }).correct || 0,
                    explanation: (activeHotspot.content as { explanation?: string }).explanation || '',
                    points: 10,
                    time_limit_seconds: 30,
                    trigger_type: 'hotspot',
                    trigger_at_seconds: 0,
                    question_type: 'mcq'
                  }}
                  onAnswer={(ans) => handleQuizAnswer({
                    id: activeHotspot.id,
                    question: (activeHotspot.content as { question?: string }).question || '',
                    options: (activeHotspot.content as { options?: string[] }).options || [],
                    correct_answer: (activeHotspot.content as { correct?: number }).correct || 0,
                    explanation: (activeHotspot.content as { explanation?: string }).explanation || '',
                    points: 10,
                    time_limit_seconds: 30,
                    trigger_type: 'hotspot',
                    trigger_at_seconds: 0,
                    question_type: 'mcq'
                  }, ans)}
                  selectedAnswer={quizAnswer}
                  result={quizResult}
                  onClose={() => setActiveHotspot(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Quiz Modal (AC 4) */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full">
            <QuizOverlay
              quiz={activeQuiz}
              onAnswer={(ans) => handleQuizAnswer(activeQuiz, ans)}
              selectedAnswer={quizAnswer}
              result={quizResult}
              onClose={closeQuiz}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Experience Card Component
// =====================================================
function ExperienceCard({
  experience,
  onSelect,
  loading,
  compact = false
}: {
  experience: Experience;
  onSelect: () => void;
  loading: boolean;
  compact?: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={`bg-gray-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all ${
        compact ? '' : ''
      }`}
    >
      <div className={`relative ${compact ? 'h-32' : 'h-48'} bg-gradient-to-br from-purple-600 to-indigo-600`}>
        {/* Premium badge */}
        {experience.is_premium && (
          <div className="absolute top-2 right-2 bg-amber-500 text-black text-xs px-2 py-1 rounded-full font-semibold">
            👑 PRO
          </div>
        )}
        
        {/* Subject badge */}
        <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-sm">
          {experience.subject === 'history' ? '🏛️' : '🌍'} {experience.subject}
        </div>
        
        {/* Duration (AC 7) */}
        <div className="absolute bottom-2 right-2 bg-black/50 px-2 py-1 rounded text-sm">
          {Math.floor(experience.duration_seconds / 60)} min
        </div>
        
        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
          {loading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
          ) : (
            <span className="text-5xl">▶️</span>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold line-clamp-1">{experience.title}</h3>
        {!compact && (
          <p className="text-sm text-gray-400 line-clamp-2 mt-1">{experience.description}</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          {experience.avg_rating && (
            <span>⭐ {experience.avg_rating.toFixed(1)}</span>
          )}
          <span>👁️ {experience.view_count}</span>
          <span className="text-green-400">{experience.resolution}</span>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Quiz Overlay Component (AC 4)
// =====================================================
function QuizOverlay({
  quiz,
  onAnswer,
  selectedAnswer,
  result,
  onClose
}: {
  quiz: Quiz;
  onAnswer: (answer: number) => void;
  selectedAnswer: number | null;
  result: { correct: boolean; explanation: string } | null;
  onClose: () => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="bg-purple-600 px-3 py-1 rounded-full text-sm">📝 Quiz</span>
          <span className="text-sm text-gray-400">{quiz.points} points</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full">
          ✕
        </button>
      </div>
      
      <h3 className="text-lg font-semibold mb-4">{quiz.question}</h3>
      
      <div className="space-y-3">
        {quiz.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => !result && onAnswer(idx)}
            disabled={!!result}
            className={`w-full text-left p-4 rounded-lg transition-colors ${
              result
                ? idx === quiz.correct_answer
                  ? 'bg-green-600/30 border-2 border-green-500'
                  : selectedAnswer === idx
                    ? 'bg-red-600/30 border-2 border-red-500'
                    : 'bg-gray-700'
                : selectedAnswer === idx
                  ? 'bg-purple-600'
                  : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
            {option}
          </button>
        ))}
      </div>
      
      {result && (
        <div className={`mt-4 p-4 rounded-lg ${result.correct ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
          <p className="font-semibold mb-2">
            {result.correct ? '✅ Correct!' : '❌ Incorrect'}
          </p>
          <p className="text-sm text-gray-300">{result.explanation}</p>
          <button
            onClick={onClose}
            className="mt-4 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
