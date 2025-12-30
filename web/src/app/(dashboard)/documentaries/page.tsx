'use client';

/**
 * Story 10.4: Documentary Library - CDN Delivery & Chapter Navigation
 * UI Page: /documentaries
 * 
 * Features:
 * - AC 1: Library with filters (subject, duration, topic)
 * - AC 5: Download options (Pro users)
 * - AC 6: Offline caching
 * - AC 9: Transcript download
 * - AC 10: Related content
 */

import React, { useState, useEffect, useCallback } from 'react';
import DocumentaryPlayer from '@/components/documentary/DocumentaryPlayer';

// Types
interface Documentary {
  id: string;
  title: string;
  subject: string;
  description: string;
  duration_minutes: number;
  chapter_count: number;
  cdn_url: string;
  thumbnail_url: string;
  quality_versions: any[];
  transcript_available: boolean;
  published_at: string;
  view_count: number;
  user_progress?: {
    position: number;
    completion: number;
    completed: boolean;
  };
}

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  duration_minutes: number;
  start_time: number;
  end_time: number;
  thumbnail?: string;
}

interface Filters {
  subjects: string[];
  durations: { label: string; min: number; max: number | null }[];
  quality_options: string[];
}

export default function DocumentaryLibraryPage() {
  // Library state
  const [documentaries, setDocumentaries] = useState<Documentary[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>('');
  const [searchTopic, setSearchTopic] = useState('');
  
  // Player state
  const [selectedDoc, setSelectedDoc] = useState<Documentary | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [qualityOptions, setQualityOptions] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [relatedDocs, setRelatedDocs] = useState<Documentary[]>([]);
  
  // User state
  const [isPro, setIsPro] = useState(false); // Would come from auth
  const [downloading, setDownloading] = useState(false);
  const [caching, setCaching] = useState(false);

  // Fetch library on mount and filter change
  useEffect(() => {
    fetchLibrary();
  }, [selectedSubject, selectedDuration, searchTopic]);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSubject) params.set('subject', selectedSubject);
      if (searchTopic) params.set('topic', searchTopic);
      
      // Parse duration filter
      if (selectedDuration && filters) {
        const durationFilter = filters.durations.find(d => d.label === selectedDuration);
        if (durationFilter) {
          if (durationFilter.min) params.set('min_duration', durationFilter.min.toString());
          if (durationFilter.max) params.set('max_duration', durationFilter.max.toString());
        }
      }
      
      const res = await fetch(`/api/documentaries?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setDocumentaries(data.documentaries || []);
        if (data.filters) setFilters(data.filters);
      }
    } catch (error) {
      console.error('Failed to fetch library:', error);
    }
    setLoading(false);
  };

  // Fetch documentary details when selected
  const selectDocumentary = async (doc: Documentary) => {
    setSelectedDoc(doc);
    
    try {
      // Fetch full details with chapters
      const res = await fetch(`/api/documentaries?id=${doc.id}`);
      const data = await res.json();
      
      if (data.success) {
        setChapters(data.chapters || []);
        setQualityOptions(data.quality_options || []);
        setProgress(data.progress);
      }
      
      // Fetch related documentaries (AC 10)
      const relatedRes = await fetch(`/api/documentaries?id=${doc.id}&action=related`);
      const relatedData = await relatedRes.json();
      
      if (relatedData.success) {
        setRelatedDocs(relatedData.related || []);
      }
    } catch (error) {
      console.error('Failed to fetch documentary details:', error);
    }
  };

  // Update progress (AC 4)
  const handleProgressUpdate = useCallback(async (position: number, chapterId?: string) => {
    if (!selectedDoc) return;
    
    try {
      await fetch('/api/documentaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_progress',
          documentary_id: selectedDoc.id,
          chapter_id: chapterId,
          position_seconds: Math.floor(position)
        })
      });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [selectedDoc]);

  // Request download (AC 5)
  const handleDownload = async (chapterId?: string) => {
    if (!selectedDoc || !isPro) {
      alert('Download requires Pro subscription');
      return;
    }
    
    setDownloading(true);
    try {
      const res = await fetch('/api/documentaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_download',
          documentary_id: selectedDoc.id,
          chapter_id: chapterId,
          quality: '720p'
        })
      });
      
      const data = await res.json();
      
      if (data.success && data.download_url) {
        window.open(data.download_url, '_blank');
      } else {
        alert(data.error || 'Download failed');
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
    setDownloading(false);
  };

  // Cache for offline (AC 6)
  const handleCacheOffline = async () => {
    if (!selectedDoc) return;
    
    setCaching(true);
    try {
      const res = await fetch('/api/documentaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cache_offline',
          documentary_id: selectedDoc.id,
          quality: '720p',
          chapters: chapters.map(c => c.id)
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // In production, this would trigger PWA caching
        alert(`Caching ${data.cache_manifest.estimated_size_mb}MB for offline viewing`);
      } else {
        alert(data.error || 'Caching failed');
      }
    } catch (error) {
      console.error('Caching failed:', error);
    }
    setCaching(false);
  };

  // Download transcript (AC 9)
  const handleDownloadTranscript = async () => {
    if (!selectedDoc) return;
    
    try {
      const res = await fetch('/api/documentaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_transcript',
          documentary_id: selectedDoc.id
        })
      });
      
      const data = await res.json();
      
      if (data.success && data.transcript_url) {
        window.open(data.transcript_url, '_blank');
      }
    } catch (error) {
      console.error('Transcript download failed:', error);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Documentary Library</h1>
          <p className="text-indigo-200 mt-2">
            In-depth video lectures for UPSC preparation
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Player View */}
        {selectedDoc ? (
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={() => setSelectedDoc(null)}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
            >
              ← Back to Library
            </button>

            {/* Video Player */}
            <DocumentaryPlayer
              documentaryId={selectedDoc.id}
              title={selectedDoc.title}
              cdnUrl={selectedDoc.cdn_url}
              chapters={chapters}
              qualityOptions={qualityOptions}
              initialProgress={progress}
              onProgressUpdate={handleProgressUpdate}
            />

            {/* Documentary Info & Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedDoc.title}</h2>
                  <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm">
                    <span>{selectedDoc.subject}</span>
                    <span>•</span>
                    <span>{formatDuration(selectedDoc.duration_minutes)}</span>
                    <span>•</span>
                    <span>{selectedDoc.chapter_count} chapters</span>
                    <span>•</span>
                    <span>{selectedDoc.view_count} views</span>
                  </div>
                  <p className="text-gray-600 mt-4">{selectedDoc.description}</p>
                </div>

                {/* Action Buttons (AC 5, 6, 9) */}
                <div className="flex flex-col gap-2">
                  {/* Download (AC 5) */}
                  <button
                    onClick={() => handleDownload()}
                    disabled={downloading || !isPro}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      isPro 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {downloading ? '⏳' : '⬇️'} {isPro ? 'Download' : 'Pro Only'}
                  </button>

                  {/* Cache Offline (AC 6) */}
                  <button
                    onClick={handleCacheOffline}
                    disabled={caching}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                  >
                    {caching ? '⏳' : '📥'} Save Offline
                  </button>

                  {/* Transcript (AC 9) */}
                  {selectedDoc.transcript_available && (
                    <button
                      onClick={handleDownloadTranscript}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                    >
                      📄 Transcript PDF
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Related Documentaries (AC 10) */}
            {relatedDocs.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Related Documentaries</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {relatedDocs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => selectDocumentary(doc)}
                      className="text-left group"
                    >
                      <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden mb-2 group-hover:ring-2 ring-indigo-500">
                        <img 
                          src={doc.thumbnail_url || '/images/doc-placeholder.jpg'} 
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500">{doc.duration_minutes} min</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Library View (AC 1) */
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex flex-wrap gap-4">
                {/* Subject Filter */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-gray-600 mb-1">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="">All Subjects</option>
                    {filters?.subjects.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                {/* Duration Filter */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-gray-600 mb-1">Duration</label>
                  <select
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="">Any Duration</option>
                    {filters?.durations.map(d => (
                      <option key={d.label} value={d.label}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* Topic Search */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-gray-600 mb-1">Topic</label>
                  <input
                    type="text"
                    value={searchTopic}
                    onChange={(e) => setSearchTopic(e.target.value)}
                    placeholder="Search topics..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSelectedSubject('');
                      setSelectedDuration('');
                      setSearchTopic('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Documentary Grid */}
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : documentaries.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h2 className="text-xl font-semibold text-gray-800">No Documentaries Found</h2>
                <p className="text-gray-500 mt-2">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {documentaries.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => selectDocumentary(doc)}
                    className="text-left bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-200">
                      <img 
                        src={doc.thumbnail_url || '/images/doc-placeholder.jpg'} 
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Duration badge */}
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(doc.duration_minutes)}
                      </div>
                      
                      {/* Progress bar (AC 4) */}
                      {doc.user_progress && !doc.user_progress.completed && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-400">
                          <div 
                            className="h-full bg-indigo-500"
                            style={{ width: `${doc.user_progress.completion}%` }}
                          />
                        </div>
                      )}
                      
                      {/* Completed badge */}
                      {doc.user_progress?.completed && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                          ✓ Completed
                        </div>
                      )}
                      
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                        <span className="text-white text-4xl opacity-0 group-hover:opacity-100 transition-opacity">
                          ▶
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-800 line-clamp-2">{doc.title}</h3>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                          {doc.subject || 'General'}
                        </span>
                        <span>{doc.chapter_count} chapters</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>👁 {doc.view_count}</span>
                        {doc.transcript_available && <span>📄 Transcript</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
