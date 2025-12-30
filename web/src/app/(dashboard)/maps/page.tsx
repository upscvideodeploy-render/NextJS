'use client';

/**
 * Story 11.3: Interactive Map Atlas - 3D Geography Visualization
 * UI Page: /maps
 * 
 * Features:
 * - AC 1: Map types with zoom levels
 * - AC 2: Data layer controls
 * - AC 3: 3D terrain visualization
 * - AC 4: Time slider for historical maps
 * - AC 5: Interactive elements (click, draw, highlight)
 * - AC 6: Video tours
 * - AC 7: Export
 * - AC 8: Quizzes
 * - AC 9: Offline mode
 * - AC 10: Performance optimized
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Types
interface Region {
  id: string;
  region_code: string;
  region_name: string;
  map_type: string;
  centroid_lat: number;
  centroid_lng: number;
  population?: number;
  capital?: string;
  facts?: any[];
}

interface Layer {
  id: string;
  type: string;
  name: string;
  geojson: any;
  style: any;
}

interface Quiz {
  id: string;
  quiz_type: string;
  title: string;
  difficulty: string;
  attempt_count: number;
  avg_score?: number;
}

interface Tour {
  id: string;
  title: string;
  waypoints: any[];
  video_status: string;
  video_url?: string;
  is_public: boolean;
}

// Layer icons
const LAYER_ICONS: Record<string, string> = {
  political: '🗺️',
  physical: '🏔️',
  rivers: '🌊',
  mountains: '⛰️',
  climate: '🌡️',
  districts: '📍',
  roads: '🛣️',
  railways: '🚂',
  airports: '✈️',
  ports: '🚢',
  agro_climatic: '🌾',
  soil_types: '🪨',
  minerals: '💎',
  industries: '🏭'
};

// Historical years
const HISTORICAL_YEARS = [1947, 1956, 2024];

export default function InteractiveMapsPage() {
  // View state
  const [view, setView] = useState<'map' | 'quiz' | 'tours'>('map');
  
  // Map state (AC 1)
  const [mapType, setMapType] = useState('india');
  const [zoom, setZoom] = useState(5);
  const [center, setCenter] = useState({ lat: 20.5937, lng: 78.9629 });
  
  // Layer state (AC 2)
  const [availableLayers, setAvailableLayers] = useState<string[]>([]);
  const [activeLayers, setActiveLayers] = useState<string[]>(['political']);
  const [loadedLayers, setLoadedLayers] = useState<Layer[]>([]);
  
  // Region state
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [regionDetails, setRegionDetails] = useState<any>(null);
  
  // Historical state (AC 4)
  const [year, setYear] = useState(2024);
  const [historicalData, setHistoricalData] = useState<any>(null);
  
  // Interactive state (AC 5)
  const [drawMode, setDrawMode] = useState<'none' | 'path' | 'zone' | 'annotation'>('none');
  const [customPaths, setCustomPaths] = useState<any[]>([]);
  const [highlightedZones, setHighlightedZones] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);
  
  // Quiz state (AC 8)
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<any[]>([]);
  const [quizStartTime, setQuizStartTime] = useState(0);
  
  // Tour state (AC 6)
  const [tours, setTours] = useState<Tour[]>([]);
  const [tourWaypoints, setTourWaypoints] = useState<any[]>([]);
  const [creatingTour, setCreatingTour] = useState(false);
  
  // Offline state (AC 9)
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [cachedRegions, setCachedRegions] = useState<string[]>([]);
  
  // Loading state
  const [loading, setLoading] = useState(true);

  // Canvas ref for map rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    loadLayers();
  }, [activeLayers, zoom]);

  useEffect(() => {
    if (year !== 2024) {
      loadHistoricalMap();
    } else {
      setHistoricalData(null);
    }
  }, [year]);

  const initializeMap = async () => {
    try {
      const res = await fetch('/api/interactive-maps');
      const data = await res.json();
      
      if (data.success) {
        setAvailableLayers(data.layer_types || []);
        setCenter(data.default_center);
        setZoom(data.default_zoom);
      }
      
      // Load quizzes
      await fetchQuizzes();
      
      // Load tours
      await fetchTours();
      
      // Load session
      await loadSession();
      
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }
    setLoading(false);
  };

  const loadLayers = async () => {
    if (activeLayers.length === 0) return;
    
    try {
      const res = await fetch(
        `/api/interactive-maps?action=layers&layers=${activeLayers.join(',')}&zoom=${zoom}&simplified=true`
      );
      const data = await res.json();
      
      if (data.success) {
        setLoadedLayers(data.layers || []);
      }
    } catch (error) {
      console.error('Failed to load layers:', error);
    }
  };

  const loadHistoricalMap = async () => {
    try {
      const res = await fetch(`/api/interactive-maps?action=historical&year=${year}`);
      const data = await res.json();
      
      if (data.success) {
        setHistoricalData(data.historical_map);
      }
    } catch (error) {
      console.error('Failed to load historical map:', error);
    }
  };

  const loadSession = async () => {
    try {
      const res = await fetch('/api/interactive-maps?action=session');
      const data = await res.json();
      
      if (data.success && data.session) {
        const session = data.session;
        setMapType(session.current_map_type || 'india');
        setZoom(session.zoom_level || 5);
        setCenter({ lat: session.center_lat, lng: session.center_lng });
        setActiveLayers(session.active_layers || ['political']);
        setYear(session.historical_year || 2024);
        setCustomPaths(session.custom_paths || []);
        setHighlightedZones(session.highlighted_zones || []);
        setAnnotations(session.annotations || []);
        setOfflineEnabled(session.offline_enabled || false);
        setCachedRegions(session.cached_regions || []);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  // Save session (AC 5)
  const saveSession = async () => {
    try {
      await fetch('/api/interactive-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_session',
          map_type: mapType,
          zoom,
          lat: center.lat,
          lng: center.lng,
          layers: activeLayers,
          year,
          paths: customPaths,
          zones: highlightedZones,
          annotations
        })
      });
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  // Toggle layer (AC 2)
  const toggleLayer = (layer: string) => {
    setActiveLayers(prev => 
      prev.includes(layer)
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    );
  };

  // Click region (AC 5)
  const handleRegionClick = async (regionCode: string) => {
    try {
      const res = await fetch(`/api/interactive-maps?action=region&region_code=${regionCode}&map_type=${mapType}`);
      const data = await res.json();
      
      if (data.success && data.region) {
        setSelectedRegion(data.region);
        setRegionDetails(data);
      }
    } catch (error) {
      console.error('Failed to load region:', error);
    }
  };

  // Export (AC 7)
  const handleExport = async (exportType: 'image' | 'video') => {
    try {
      const res = await fetch('/api/interactive-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          export_type: exportType,
          format: exportType === 'image' ? 'png' : 'mp4',
          map_config: {
            map_type: mapType,
            zoom,
            center,
            layers: activeLayers,
            year
          }
        })
      });
      
      const data = await res.json();
      if (data.success && data.file_url) {
        window.open(data.file_url, '_blank');
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Quiz functions (AC 8)
  const fetchQuizzes = async () => {
    try {
      const res = await fetch('/api/interactive-maps?action=quizzes');
      const data = await res.json();
      if (data.success) {
        setQuizzes(data.quizzes || []);
      }
    } catch (error) {
      console.error('Failed to fetch quizzes:', error);
    }
  };

  const startQuiz = async (quizId: string) => {
    try {
      const res = await fetch('/api/interactive-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_quiz',
          quiz_id: quizId
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setActiveQuiz(data.quiz);
        setQuizAnswers([]);
        setQuizStartTime(Date.now());
        setView('quiz');
      }
    } catch (error) {
      console.error('Failed to start quiz:', error);
    }
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    
    const timeTaken = Math.round((Date.now() - quizStartTime) / 1000);
    
    try {
      const res = await fetch('/api/interactive-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_quiz',
          quiz_id: activeQuiz.id,
          answers: quizAnswers,
          time_taken: timeTaken
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert(`Quiz completed! Score: ${data.score}/${data.max_score} (${data.percentage.toFixed(1)}%)`);
        setActiveQuiz(null);
        setView('map');
        fetchQuizzes();
      }
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    }
  };

  // Tour functions (AC 6)
  const fetchTours = async () => {
    try {
      const res = await fetch('/api/interactive-maps?action=tours');
      const data = await res.json();
      if (data.success) {
        setTours(data.tours || []);
      }
    } catch (error) {
      console.error('Failed to fetch tours:', error);
    }
  };

  const createTour = async () => {
    if (tourWaypoints.length < 2) {
      alert('Add at least 2 waypoints');
      return;
    }
    
    try {
      const res = await fetch('/api/interactive-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tour',
          title: `Map Tour - ${new Date().toLocaleDateString()}`,
          waypoints: tourWaypoints
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setTourWaypoints([]);
        setCreatingTour(false);
        fetchTours();
        alert('Tour created! You can now generate a video.');
      }
    } catch (error) {
      console.error('Failed to create tour:', error);
    }
  };

  const generateTourVideo = async (tourId: string) => {
    try {
      const res = await fetch('/api/interactive-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_tour_video',
          tour_id: tourId
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Video generation started!');
        fetchTours();
      }
    } catch (error) {
      console.error('Failed to generate video:', error);
    }
  };

  // Offline functions (AC 9)
  const requestOfflineCache = async () => {
    if (!selectedRegion) return;
    
    try {
      const res = await fetch('/api/interactive-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_offline',
          region_id: selectedRegion.id
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Offline cache requested. Maps will be available offline soon.');
        loadSession();
      }
    } catch (error) {
      console.error('Failed to request offline cache:', error);
    }
  };

  // Draw functions (AC 5)
  const addWaypoint = () => {
    const waypoint = {
      lat: center.lat,
      lng: center.lng,
      zoom,
      name: `Stop ${tourWaypoints.length + 1}`,
      description: '',
      duration_seconds: 5
    };
    setTourWaypoints([...tourWaypoints, waypoint]);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Interactive Map Atlas</h1>
              <p className="text-emerald-200 mt-1">
                Explore 3D maps with historical data layers
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setView('map')}
                className={`px-4 py-2 rounded-lg ${view === 'map' ? 'bg-white text-emerald-700' : 'bg-white/20'}`}
              >
                🗺️ Map
              </button>
              <button
                onClick={() => setView('quiz')}
                className={`px-4 py-2 rounded-lg ${view === 'quiz' ? 'bg-white text-emerald-700' : 'bg-white/20'}`}
              >
                📝 Quizzes
              </button>
              <button
                onClick={() => setView('tours')}
                className={`px-4 py-2 rounded-lg ${view === 'tours' ? 'bg-white text-emerald-700' : 'bg-white/20'}`}
              >
                🎬 Tours
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {view === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Controls */}
            <div className="space-y-6">
              {/* Map Type (AC 1) */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">Map Type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['world', 'india', 'state', 'district'].map(type => (
                    <button
                      key={type}
                      onClick={() => setMapType(type)}
                      className={`px-3 py-2 rounded-lg text-sm capitalize ${
                        mapType === type 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slider (AC 4) */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">Historical View</h3>
                <input
                  type="range"
                  min={HISTORICAL_YEARS[0]}
                  max={HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1]}
                  step={1}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-400 mt-2">
                  {HISTORICAL_YEARS.map(y => (
                    <button
                      key={y}
                      onClick={() => setYear(y)}
                      className={y === year ? 'text-emerald-400' : ''}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                {historicalData && (
                  <div className="mt-3 p-2 bg-gray-700 rounded text-sm text-gray-300">
                    <p className="font-medium text-white">{historicalData.era_name}</p>
                    <p className="text-xs mt-1">{historicalData.description}</p>
                  </div>
                )}
              </div>

              {/* Layers (AC 2) */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">Data Layers</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableLayers.map(layer => (
                    <label
                      key={layer}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={activeLayers.includes(layer)}
                        onChange={() => toggleLayer(layer)}
                        className="rounded text-emerald-500"
                      />
                      <span className="text-lg">{LAYER_ICONS[layer] || '📍'}</span>
                      <span className="text-gray-300 capitalize text-sm">
                        {layer.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Draw Tools (AC 5) */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">Draw Tools</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDrawMode(drawMode === 'path' ? 'none' : 'path')}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      drawMode === 'path' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    ✏️ Path
                  </button>
                  <button
                    onClick={() => setDrawMode(drawMode === 'zone' ? 'none' : 'zone')}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      drawMode === 'zone' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    🔲 Zone
                  </button>
                  <button
                    onClick={() => setDrawMode(drawMode === 'annotation' ? 'none' : 'annotation')}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      drawMode === 'annotation' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    📝 Note
                  </button>
                  <button
                    onClick={saveSession}
                    className="px-3 py-2 rounded-lg text-sm bg-green-600 text-white"
                  >
                    💾 Save
                  </button>
                </div>
              </div>

              {/* Export (AC 7) */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">Export</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('image')}
                    className="flex-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                  >
                    📷 Image
                  </button>
                  <button
                    onClick={() => handleExport('video')}
                    className="flex-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                  >
                    🎬 Video
                  </button>
                </div>
              </div>

              {/* Offline (AC 9) */}
              {selectedRegion && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="font-semibold text-white mb-3">Offline Maps</h3>
                  <button
                    onClick={requestOfflineCache}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                  >
                    📥 Cache {selectedRegion.region_name}
                  </button>
                  {cachedRegions.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Cached: {cachedRegions.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Map Area (AC 3) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Map Canvas */}
              <div className="bg-gray-800 rounded-xl overflow-hidden aspect-video relative">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                />
                
                {/* Map placeholder - In production, use React Three Fiber or Mapbox */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900 to-emerald-900">
                  <div className="text-center text-white">
                    <div className="text-6xl mb-4">🗺️</div>
                    <p className="text-xl font-semibold">Interactive Map View</p>
                    <p className="text-gray-400 mt-2">
                      {mapType.toUpperCase()} • Zoom: {zoom} • Year: {year}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {activeLayers.map(layer => (
                        <span key={layer} className="px-2 py-1 bg-white/10 rounded text-xs">
                          {LAYER_ICONS[layer]} {layer}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Zoom Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={() => setZoom(Math.min(15, zoom + 1))}
                    className="w-10 h-10 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setZoom(Math.max(1, zoom - 1))}
                    className="w-10 h-10 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700"
                  >
                    −
                  </button>
                </div>
              </div>

              {/* Tour Creator */}
              {creatingTour && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">Creating Tour</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={addWaypoint}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                      >
                        + Add Stop
                      </button>
                      <button
                        onClick={createTour}
                        disabled={tourWaypoints.length < 2}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setCreatingTour(false); setTourWaypoints([]); }}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {tourWaypoints.map((wp, i) => (
                      <div key={i} className="flex-shrink-0 px-3 py-2 bg-gray-700 rounded-lg text-sm text-gray-300">
                        {wp.name}: ({wp.lat.toFixed(2)}, {wp.lng.toFixed(2)})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar - Details */}
            <div className="space-y-6">
              {/* Region Details (AC 5) */}
              {selectedRegion ? (
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="font-semibold text-white text-lg mb-2">
                    {selectedRegion.region_name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">{selectedRegion.region_code}</p>
                  
                  {regionDetails?.region && (
                    <div className="space-y-2 text-sm">
                      {regionDetails.region.capital && (
                        <div className="flex justify-between text-gray-300">
                          <span>Capital:</span>
                          <span>{regionDetails.region.capital}</span>
                        </div>
                      )}
                      {regionDetails.region.population && (
                        <div className="flex justify-between text-gray-300">
                          <span>Population:</span>
                          <span>{(regionDetails.region.population / 1000000).toFixed(1)}M</span>
                        </div>
                      )}
                      {regionDetails.region.area_sq_km && (
                        <div className="flex justify-between text-gray-300">
                          <span>Area:</span>
                          <span>{regionDetails.region.area_sq_km.toLocaleString()} km²</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {regionDetails?.children?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-gray-400 text-sm mb-2">Sub-regions:</p>
                      <div className="flex flex-wrap gap-1">
                        {regionDetails.children.slice(0, 10).map((child: any) => (
                          <button
                            key={child.id}
                            onClick={() => handleRegionClick(child.code)}
                            className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
                          >
                            {child.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 text-center">
                    Click on a region to see details
                  </p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setCreatingTour(true)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    🎬 Create Video Tour
                  </button>
                  <button
                    onClick={() => setView('quiz')}
                    className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                  >
                    📝 Take a Quiz
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quiz View (AC 8) */}
        {view === 'quiz' && (
          <div className="max-w-3xl mx-auto">
            {activeQuiz ? (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">{activeQuiz.title}</h2>
                <p className="text-gray-400 mb-6">
                  {activeQuiz.quiz_type} • {activeQuiz.difficulty} • {activeQuiz.time_limit_seconds}s limit
                </p>
                
                <div className="space-y-6">
                  {activeQuiz.questions.map((q: any, index: number) => (
                    <div key={q.id} className="p-4 bg-gray-700 rounded-lg">
                      <p className="text-white font-medium mb-3">
                        {index + 1}. {q.question}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((option: string) => (
                          <button
                            key={option}
                            onClick={() => {
                              const answer = { question_id: q.id, selected: option };
                              setQuizAnswers(prev => {
                                const existing = prev.findIndex(a => a.question_id === q.id);
                                if (existing >= 0) {
                                  const updated = [...prev];
                                  updated[existing] = answer;
                                  return updated;
                                }
                                return [...prev, answer];
                              });
                            }}
                            className={`px-3 py-2 rounded-lg text-sm ${
                              quizAnswers.find(a => a.question_id === q.id)?.selected === option
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={submitQuiz}
                  disabled={quizAnswers.length !== activeQuiz.questions.length}
                  className="w-full mt-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  Submit Quiz
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">Map Quizzes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quizzes.map(quiz => (
                    <button
                      key={quiz.id}
                      onClick={() => startQuiz(quiz.id)}
                      className="text-left p-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
                    >
                      <h3 className="font-semibold text-white mb-1">{quiz.title}</h3>
                      <p className="text-sm text-gray-400 capitalize mb-2">
                        {quiz.quiz_type.replace('_', ' ')} • {quiz.difficulty}
                      </p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>{quiz.attempt_count} attempts</span>
                        {quiz.avg_score && <span>Avg: {quiz.avg_score.toFixed(0)}%</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tours View (AC 6) */}
        {view === 'tours' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Video Tours</h2>
              <button
                onClick={() => { setView('map'); setCreatingTour(true); }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
              >
                + Create Tour
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {tours.map(tour => (
                <div key={tour.id} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{tour.title}</h3>
                      <p className="text-sm text-gray-400">
                        {tour.waypoints.length} stops • {tour.is_public ? 'Public' : 'Private'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {tour.video_status === 'completed' && tour.video_url ? (
                        <a
                          href={tour.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                        >
                          ▶️ Watch
                        </a>
                      ) : tour.video_status === 'generating' ? (
                        <span className="px-3 py-1 bg-yellow-600 text-white rounded text-sm">
                          ⏳ Generating...
                        </span>
                      ) : (
                        <button
                          onClick={() => generateTourVideo(tour.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                        >
                          🎬 Generate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {tours.length === 0 && (
                <p className="text-gray-400 text-center py-8">
                  No tours yet. Create your first video tour!
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
