'use client';

/**
 * Story 10.4: Documentary Library - CDN Delivery & Chapter Navigation
 * Custom Video Player Component
 * 
 * Features:
 * - AC 2: Chapter markers, seeking, speed control (0.5x-2x)
 * - AC 3: Chapter navigation sidebar
 * - AC 4: Resume from last position
 * - AC 8: Quality selection (1080p, 720p, 480p)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

// Types
export interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  duration_minutes: number;
  start_time: number; // in seconds
  end_time: number;
  thumbnail?: string;
}

export interface QualityOption {
  quality: string;
  url: string;
}

export interface PlayerProgress {
  has_progress: boolean;
  position: number;
  chapter_id?: string;
  completion?: number;
  quality?: string;
  speed?: number;
}

interface DocumentaryPlayerProps {
  documentaryId: string;
  title: string;
  cdnUrl: string;
  chapters: Chapter[];
  qualityOptions: QualityOption[];
  initialProgress?: PlayerProgress;
  onProgressUpdate?: (position: number, chapterId?: string) => void;
  onComplete?: () => void;
}

// AC 2: Speed options
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function DocumentaryPlayer({
  documentaryId,
  title,
  cdnUrl,
  chapters,
  qualityOptions,
  initialProgress,
  onProgressUpdate,
  onComplete
}: DocumentaryPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // AC 2: Speed control
  const [playbackSpeed, setPlaybackSpeed] = useState(initialProgress?.speed || 1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  // AC 8: Quality selection
  const [currentQuality, setCurrentQuality] = useState(initialProgress?.quality || '720p');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  
  // AC 3: Chapter navigation
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [showChapterList, setShowChapterList] = useState(true);
  
  // Progress tracking (AC 4)
  const lastSaveRef = useRef(0);

  // Initialize player (AC 4: Resume)
  useEffect(() => {
    if (videoRef.current && initialProgress?.has_progress && initialProgress.position > 0) {
      videoRef.current.currentTime = initialProgress.position;
    }
  }, [initialProgress]);

  // Update current chapter based on time
  useEffect(() => {
    const chapter = chapters.find(
      ch => currentTime >= ch.start_time && currentTime < (ch.end_time || Infinity)
    );
    if (chapter && chapter.id !== currentChapter?.id) {
      setCurrentChapter(chapter);
    }
  }, [currentTime, chapters, currentChapter?.id]);

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    
    // Update buffered
    if (videoRef.current.buffered.length > 0) {
      setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }
    
    // Save progress every 5 seconds (AC 4)
    if (time - lastSaveRef.current >= 5 && onProgressUpdate) {
      lastSaveRef.current = time;
      onProgressUpdate(time, currentChapter?.id);
    }
  }, [onProgressUpdate, currentChapter?.id]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (onComplete) {
      onComplete();
    }
  };

  // Playback controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    videoRef.current.currentTime = newTime;
  };

  // AC 3: Jump to chapter
  const jumpToChapter = (chapter: Chapter) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = chapter.start_time;
    setCurrentChapter(chapter);
    if (!isPlaying) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // AC 2: Change speed
  const changeSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
    setShowSpeedMenu(false);
  };

  // AC 8: Change quality
  const changeQuality = (quality: string) => {
    const qualityOption = qualityOptions.find(q => q.quality === quality);
    if (qualityOption && videoRef.current) {
      const currentTimeBeforeSwitch = videoRef.current.currentTime;
      videoRef.current.src = qualityOption.url;
      videoRef.current.currentTime = currentTimeBeforeSwitch;
      if (isPlaying) {
        videoRef.current.play();
      }
      setCurrentQuality(quality);
    }
    setShowQualityMenu(false);
  };

  // Volume controls
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Time formatting
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate chapter markers positions
  const getChapterMarkerPosition = (chapter: Chapter) => {
    return duration > 0 ? (chapter.start_time / duration) * 100 : 0;
  };

  return (
    <div className="flex gap-4">
      {/* Main Player */}
      <div 
        className="flex-1 relative bg-black rounded-lg overflow-hidden"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={qualityOptions.find(q => q.quality === currentQuality)?.url || cdnUrl}
          className="w-full aspect-video"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Controls Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Title */}
          <div className="absolute top-4 left-4 right-4">
            <h2 className="text-white font-semibold text-lg truncate">{title}</h2>
            {currentChapter && (
              <p className="text-gray-300 text-sm">
                Chapter {currentChapter.chapter_number}: {currentChapter.title}
              </p>
            )}
          </div>

          {/* Center Play Button */}
          <button
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            {isPlaying ? (
              <span className="text-white text-3xl">⏸</span>
            ) : (
              <span className="text-white text-3xl ml-1">▶</span>
            )}
          </button>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Progress Bar (AC 2: seeking) */}
            <div 
              ref={progressRef}
              className="relative h-2 bg-gray-600 rounded-full cursor-pointer mb-3 group"
              onClick={handleSeek}
            >
              {/* Buffered */}
              <div 
                className="absolute h-full bg-gray-400 rounded-full"
                style={{ width: `${(buffered / duration) * 100}%` }}
              />
              
              {/* Progress */}
              <div 
                className="absolute h-full bg-blue-500 rounded-full"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              
              {/* Chapter Markers (AC 2) */}
              {chapters.map(chapter => (
                <div
                  key={chapter.id}
                  className="absolute top-0 w-0.5 h-full bg-white/60 group-hover:bg-white"
                  style={{ left: `${getChapterMarkerPosition(chapter)}%` }}
                  title={`Chapter ${chapter.chapter_number}: ${chapter.title}`}
                />
              ))}
              
              {/* Scrubber */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }}
              />
            </div>

            <div className="flex items-center justify-between">
              {/* Left Controls */}
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-white hover:text-blue-400">
                  {isPlaying ? '⏸' : '▶️'}
                </button>
                
                {/* Volume */}
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="text-white hover:text-blue-400">
                    {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer"
                  />
                </div>
                
                {/* Time */}
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-4">
                {/* Speed Control (AC 2) */}
                <div className="relative">
                  <button 
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="text-white hover:text-blue-400 text-sm"
                  >
                    {playbackSpeed}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-8 right-0 bg-gray-800 rounded-lg py-1 shadow-xl">
                      {SPEED_OPTIONS.map(speed => (
                        <button
                          key={speed}
                          onClick={() => changeSpeed(speed)}
                          className={`block w-full px-4 py-1 text-sm text-left hover:bg-gray-700 ${
                            playbackSpeed === speed ? 'text-blue-400' : 'text-white'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quality Control (AC 8) */}
                <div className="relative">
                  <button 
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="text-white hover:text-blue-400 text-sm"
                  >
                    {currentQuality}
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-8 right-0 bg-gray-800 rounded-lg py-1 shadow-xl">
                      {qualityOptions.map(({ quality }) => (
                        <button
                          key={quality}
                          onClick={() => changeQuality(quality)}
                          className={`block w-full px-4 py-1 text-sm text-left hover:bg-gray-700 ${
                            currentQuality === quality ? 'text-blue-400' : 'text-white'
                          }`}
                        >
                          {quality}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chapter List Toggle */}
                <button 
                  onClick={() => setShowChapterList(!showChapterList)}
                  className="text-white hover:text-blue-400"
                >
                  📑
                </button>

                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="text-white hover:text-blue-400">
                  {isFullscreen ? '⛶' : '⛶'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter Navigation Sidebar (AC 3) */}
      {showChapterList && (
        <div className="w-80 bg-gray-900 rounded-lg p-4 max-h-[600px] overflow-y-auto">
          <h3 className="text-white font-semibold mb-4">Chapters</h3>
          <div className="space-y-2">
            {chapters.map(chapter => (
              <button
                key={chapter.id}
                onClick={() => jumpToChapter(chapter)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  currentChapter?.id === chapter.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {chapter.thumbnail ? (
                    <img 
                      src={chapter.thumbnail} 
                      alt="" 
                      className="w-16 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-10 bg-gray-700 rounded flex items-center justify-center text-xs">
                      {chapter.chapter_number}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{chapter.title}</p>
                    <p className="text-xs text-gray-400">
                      {formatTime(chapter.start_time)} • {chapter.duration_minutes} min
                    </p>
                  </div>
                  {currentChapter?.id === chapter.id && (
                    <span className="text-blue-300">▶</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
