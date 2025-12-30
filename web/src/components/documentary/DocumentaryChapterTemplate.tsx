/**
 * Story 10.2 AC 2: DocumentaryChapterTemplate
 * Template configuration for rendering documentary chapters
 */

'use client';

import { useState } from 'react';

// AC 2: Template structure
export interface ChapterTemplateConfig {
  // Title card (5s)
  title_card: {
    title: string;
    subtitle: string;
    duration: number;
    font: string;
    color: string;
    background: string;
  };
  // Intro animation
  intro_animation: {
    duration: number;
    accent_color: string;
  };
  // Main content
  content: {
    narration: string;
    visual_markers: VisualMarker[];
    audio_url?: string;
  };
  // Summary overlay (30s before end)
  summary_overlay: {
    duration: number;
    position: 'end';
    key_points?: string[];
  };
  // Transition to next chapter
  transition: {
    type: 'fade' | 'slide' | 'dissolve' | 'wipe';
    duration: number;
  };
  // Background music (AC 3)
  music: {
    track: string;
    volume: number;
    loop: boolean;
  };
}

export interface VisualMarker {
  type: 'DIAGRAM' | 'TIMELINE' | 'MAP' | 'INTERVIEW_CLIP' | 'CHART' | 'IMAGE';
  description: string;
  position: number;
  duration_seconds?: number;
}

interface Props {
  chapterNumber: number;
  title: string;
  config: Partial<ChapterTemplateConfig>;
  onConfigChange?: (config: Partial<ChapterTemplateConfig>) => void;
  isPreview?: boolean;
}

// Default values
export const DEFAULT_TEMPLATE_CONFIG: ChapterTemplateConfig = {
  title_card: {
    title: 'Chapter 1',
    subtitle: 'Introduction',
    duration: 5,
    font: 'Roboto',
    color: '#FFFFFF',
    background: '#1a1a2e'
  },
  intro_animation: {
    duration: 3,
    accent_color: '#4ECDC4'
  },
  content: {
    narration: '',
    visual_markers: []
  },
  summary_overlay: {
    duration: 30,
    position: 'end'
  },
  transition: {
    type: 'fade',
    duration: 2
  },
  music: {
    track: 'ambient_education',
    volume: 0.15,
    loop: true
  }
};

// Music track options (AC 3)
export const MUSIC_TRACKS = [
  { id: 'ambient_education', name: 'Ambient Education', description: 'Calm, focused atmosphere' },
  { id: 'documentary_cinematic', name: 'Documentary Cinematic', description: 'Epic, dramatic feel' },
  { id: 'inspiring_journey', name: 'Inspiring Journey', description: 'Uplifting and motivational' },
  { id: 'calm_focus', name: 'Calm Focus', description: 'Minimal, distraction-free' },
];

// Transition options
export const TRANSITION_TYPES = [
  { id: 'fade', name: 'Fade', description: 'Smooth fade to next chapter' },
  { id: 'slide', name: 'Slide', description: 'Slide transition' },
  { id: 'dissolve', name: 'Dissolve', description: 'Cross dissolve' },
  { id: 'wipe', name: 'Wipe', description: 'Wipe effect' },
];

export function DocumentaryChapterTemplate({
  chapterNumber,
  title,
  config,
  onConfigChange,
  isPreview = false
}: Props) {
  const [activeSection, setActiveSection] = useState<string>('title');

  const mergedConfig = { ...DEFAULT_TEMPLATE_CONFIG, ...config };

  const updateConfig = (section: string, value: any) => {
    if (onConfigChange) {
      onConfigChange({
        ...config,
        [section]: { ...mergedConfig[section as keyof ChapterTemplateConfig], ...value }
      });
    }
  };

  if (isPreview) {
    // Preview mode - show visual representation
    return (
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        {/* Title Card Preview */}
        <div 
          className="p-8 text-center"
          style={{ backgroundColor: mergedConfig.title_card.background }}
        >
          <div 
            className="text-3xl font-bold mb-2"
            style={{ 
              color: mergedConfig.title_card.color,
              fontFamily: mergedConfig.title_card.font
            }}
          >
            Chapter {chapterNumber}
          </div>
          <div 
            className="text-xl"
            style={{ color: mergedConfig.intro_animation.accent_color }}
          >
            {title}
          </div>
          <div className="mt-4 text-xs text-gray-400">
            {mergedConfig.title_card.duration}s title card
          </div>
        </div>

        {/* Timeline visualization */}
        <div className="p-4 bg-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="px-2 py-1 bg-blue-900 rounded">Title: {mergedConfig.title_card.duration}s</span>
            <span className="px-2 py-1 bg-purple-900 rounded">Intro: {mergedConfig.intro_animation.duration}s</span>
            <span className="px-2 py-1 bg-green-900 rounded flex-1 text-center">Main Content</span>
            <span className="px-2 py-1 bg-orange-900 rounded">Summary: {mergedConfig.summary_overlay.duration}s</span>
            <span className="px-2 py-1 bg-gray-700 rounded">
              {mergedConfig.transition.type}: {mergedConfig.transition.duration}s
            </span>
          </div>
        </div>

        {/* Music indicator */}
        <div className="px-4 py-2 bg-gray-850 text-xs text-gray-400 flex items-center gap-2">
          <span>🎵</span>
          <span>{MUSIC_TRACKS.find(t => t.id === mergedConfig.music.track)?.name}</span>
          <span className="text-gray-500">• Volume: {Math.round(mergedConfig.music.volume * 100)}%</span>
        </div>
      </div>
    );
  }

  // Editor mode
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">
        Chapter {chapterNumber} Template Settings
      </h3>

      {/* Section tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        {['title', 'animation', 'music', 'transition'].map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-3 py-1 rounded text-sm capitalize ${
              activeSection === section
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {section}
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSection === 'title' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Duration (seconds)</label>
            <input
              type="number"
              value={mergedConfig.title_card.duration}
              onChange={(e) => updateConfig('title_card', { duration: parseInt(e.target.value) })}
              className="w-20 px-3 py-1 border rounded"
              min={1}
              max={10}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Text Color</label>
              <input
                type="color"
                value={mergedConfig.title_card.color}
                onChange={(e) => updateConfig('title_card', { color: e.target.value })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Background</label>
              <input
                type="color"
                value={mergedConfig.title_card.background}
                onChange={(e) => updateConfig('title_card', { background: e.target.value })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {activeSection === 'animation' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Intro Duration (seconds)</label>
            <input
              type="number"
              value={mergedConfig.intro_animation.duration}
              onChange={(e) => updateConfig('intro_animation', { duration: parseInt(e.target.value) })}
              className="w-20 px-3 py-1 border rounded"
              min={1}
              max={10}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Accent Color</label>
            <input
              type="color"
              value={mergedConfig.intro_animation.accent_color}
              onChange={(e) => updateConfig('intro_animation', { accent_color: e.target.value })}
              className="w-full h-8 rounded cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Summary Overlay Duration</label>
            <input
              type="number"
              value={mergedConfig.summary_overlay.duration}
              onChange={(e) => updateConfig('summary_overlay', { duration: parseInt(e.target.value) })}
              className="w-20 px-3 py-1 border rounded"
              min={10}
              max={60}
            />
            <span className="text-xs text-gray-500 ml-2">seconds before chapter end</span>
          </div>
        </div>
      )}

      {activeSection === 'music' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Background Track</label>
            <select
              value={mergedConfig.music.track}
              onChange={(e) => updateConfig('music', { track: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            >
              {MUSIC_TRACKS.map(track => (
                <option key={track.id} value={track.id}>
                  {track.name} - {track.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Volume: {Math.round(mergedConfig.music.volume * 100)}%
            </label>
            <input
              type="range"
              value={mergedConfig.music.volume}
              onChange={(e) => updateConfig('music', { volume: parseFloat(e.target.value) })}
              className="w-full"
              min={0}
              max={0.5}
              step={0.05}
            />
          </div>
        </div>
      )}

      {activeSection === 'transition' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Transition Type</label>
            <select
              value={mergedConfig.transition.type}
              onChange={(e) => updateConfig('transition', { type: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            >
              {TRANSITION_TYPES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} - {t.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Duration (seconds)</label>
            <input
              type="number"
              value={mergedConfig.transition.duration}
              onChange={(e) => updateConfig('transition', { duration: parseFloat(e.target.value) })}
              className="w-20 px-3 py-1 border rounded"
              min={0.5}
              max={5}
              step={0.5}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentaryChapterTemplate;
