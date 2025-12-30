'use client';

/**
 * Voice Settings Page
 * Story 16.1: AI Voice Teacher - TTS Customization
 * 
 * Features:
 * - Voice selection (AC 1)
 * - Speed control (AC 2)
 * - Style presets (AC 3)
 * - Save preferences (AC 4)
 * - Preview before saving (AC 5)
 * - Premium voices (AC 7)
 * - Voice cloning (AC 8)
 * - Accessibility options (AC 10)
 */

import React, { useState, useEffect, useRef } from 'react';

// =====================================================
// Types
// =====================================================
interface Voice {
  id: string;
  voice_id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  style: string;
  is_premium: boolean;
  is_celebrity: boolean;
  celebrity_name: string | null;
  required_tier: string;
  sample_audio_url: string;
  has_access: boolean;
  avg_rating: number;
  use_count: number;
}

interface StylePreset {
  id: string;
  name: string;
  slug: string;
  description: string;
  style_type: string;
  icon: string;
  ssml_config: Record<string, string>;
}

interface VoiceClone {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  processing_progress: number;
  sample_audio_url: string;
  created_at: string;
}

interface Preferences {
  voice: Voice | null;
  clone: VoiceClone | null;
  style: StylePreset | null;
  speed: number;
  pitch_adjustment: number;
  accessibility: Record<string, boolean>;
  apply_to: {
    videos: boolean;
    assistant: boolean;
    practice: boolean;
    globally: boolean;
  };
  is_default: boolean;
}

// =====================================================
// Main Component
// =====================================================
export default function VoiceSettingsPage() {
  // State
  const [voices, setVoices] = useState<Voice[]>([]);
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [clones, setClones] = useState<VoiceClone[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [userTier, setUserTier] = useState<string>('free');
  
  // Selection state
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('mentor');
  const [speed, setSpeed] = useState(1.0);
  const [pitchAdjustment, setPitchAdjustment] = useState(0);
  const [accessibilitySettings, setAccessibilitySettings] = useState({
    enhanced_clarity: false,
    bass_boost: false,
    noise_reduction: true,
    auto_captions: true,
    sign_language_overlay: false
  });
  const [applyGlobally, setApplyGlobally] = useState(true);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'style' | 'advanced' | 'cloning'>('voice');
  const [filters, setFilters] = useState({ gender: '', accent: '' });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // Audio ref
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // =====================================================
  // Data Loading
  // =====================================================
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const [voicesRes, stylesRes, prefsRes, clonesRes] = await Promise.all([
        fetch('/api/voice?action=voices'),
        fetch('/api/voice?action=styles'),
        fetch('/api/voice?action=preferences'),
        fetch('/api/voice?action=clones')
      ]);
      
      const voicesData = await voicesRes.json();
      const stylesData = await stylesRes.json();
      const prefsData = await prefsRes.json();
      const clonesData = await clonesRes.json();
      
      setVoices(voicesData.voices || []);
      setStyles(stylesData.styles || []);
      setClones(clonesData.clones || []);
      setUserTier(voicesData.user_tier || 'free');
      
      if (prefsData.preferences) {
        setPreferences(prefsData.preferences);
        setSelectedVoice(prefsData.preferences.voice);
        setSelectedStyle(prefsData.preferences.style?.style_type || 'mentor');
        setSpeed(prefsData.preferences.speed || 1.0);
        setPitchAdjustment(prefsData.preferences.pitch_adjustment || 0);
        if (prefsData.preferences.accessibility) {
          setAccessibilitySettings(prefsData.preferences.accessibility);
        }
        setApplyGlobally(prefsData.preferences.apply_to?.globally !== false);
      }
    } catch (error) {
      console.error('Failed to load voice settings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // =====================================================
  // Actions
  // =====================================================
  const handleVoiceSelect = (voice: Voice) => {
    if (!voice.has_access) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedVoice(voice);
  };
  
  const handlePreview = async (voice: Voice) => {
    if (audioRef.current) {
      if (previewPlaying) {
        audioRef.current.pause();
        setPreviewPlaying(false);
        return;
      }
      
      // In production, this would fetch actual sample audio
      // For demo, we'll use a placeholder
      try {
        const res = await fetch(`/api/voice?action=preview&voice_id=${voice.id}`);
        const data = await res.json();
        
        if (data.sample_url) {
          audioRef.current.src = data.sample_url;
          audioRef.current.playbackRate = speed;
          audioRef.current.play();
          setPreviewPlaying(true);
        } else {
          // Demo: show preview available
          alert(`Preview: "${voice.name}" - ${voice.description}\n\nSample text: "${data.sample_text}"`);
        }
      } catch (error) {
        console.error('Preview failed:', error);
      }
    }
  };
  
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-preferences',
          voice_id: selectedVoice?.id,
          speed,
          style: selectedStyle,
          pitch_adjustment: pitchAdjustment,
          accessibility: accessibilitySettings,
          apply_globally: applyGlobally
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSaveMessage('Settings saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else if (data.error) {
        setSaveMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setSaveMessage('Failed to save settings');
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };
  
  const handleStartCloning = async (audioFile: File) => {
    // Create FormData and upload
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    // For demo, we'll simulate the upload
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clone',
          name: 'My Custom Voice',
          audio_url: 'https://storage.example.com/voice-sample.mp3',
          duration_seconds: 90,
          consent: true
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setClones([data.clone, ...clones]);
        setShowCloneModal(false);
        alert('Voice cloning started! It will be ready in 2-5 minutes.');
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Cloning failed:', error);
    }
  };
  
  // Filter voices
  const filteredVoices = voices.filter(v => {
    if (filters.gender && v.gender !== filters.gender) return false;
    if (filters.accent && v.accent !== filters.accent) return false;
    return true;
  });
  
  // =====================================================
  // Render
  // =====================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hidden audio element for previews */}
      <audio
        ref={audioRef}
        onEnded={() => setPreviewPlaying(false)}
        className="hidden"
      />
      
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">🎤 Voice Settings</h1>
          <p className="text-gray-600 mt-1">
            Customize your AI teacher&apos;s voice, speed, and teaching style
          </p>
        </div>
      </header>
      
      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="flex gap-4">
            {[
              { id: 'voice', label: '🔊 Voice Selection', icon: '🔊' },
              { id: 'style', label: '🎭 Teaching Style', icon: '🎭' },
              { id: 'advanced', label: '⚙️ Advanced', icon: '⚙️' },
              { id: 'cloning', label: '🧬 Voice Cloning', icon: '🧬' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Voice Selection Tab (AC 1) */}
        {activeTab === 'voice' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
              <select
                value={filters.gender}
                onChange={e => setFilters({ ...filters, gender: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="neutral">Neutral</option>
              </select>
              
              <select
                value={filters.accent}
                onChange={e => setFilters({ ...filters, accent: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Accents</option>
                <option value="indian_english">Indian English</option>
                <option value="american">American</option>
                <option value="british">British</option>
                <option value="australian">Australian</option>
              </select>
              
              <div className="ml-auto text-sm text-gray-500">
                Your tier: <span className="font-semibold capitalize">{userTier}</span>
              </div>
            </div>
            
            {/* Voice Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVoices.map(voice => (
                <div
                  key={voice.id}
                  onClick={() => handleVoiceSelect(voice)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedVoice?.id === voice.id
                      ? 'border-purple-500 bg-purple-50'
                      : voice.has_access
                        ? 'border-gray-200 hover:border-purple-300 bg-white'
                        : 'border-gray-200 bg-gray-100 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{voice.name}</h3>
                        {voice.is_premium && (
                          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                            👑 {voice.required_tier.toUpperCase()}
                          </span>
                        )}
                        {voice.is_celebrity && (
                          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                            ⭐ Celebrity
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{voice.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="capitalize">{voice.gender}</span>
                        <span>•</span>
                        <span className="capitalize">{voice.accent.replace('_', ' ')}</span>
                        <span>•</span>
                        <span className="capitalize">{voice.style}</span>
                        {voice.avg_rating && (
                          <>
                            <span>•</span>
                            <span>⭐ {voice.avg_rating.toFixed(1)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Preview button (AC 5) */}
                    <button
                      onClick={e => { e.stopPropagation(); handlePreview(voice); }}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Preview voice"
                    >
                      {previewPlaying && selectedVoice?.id === voice.id ? '⏹️' : '▶️'}
                    </button>
                  </div>
                  
                  {!voice.has_access && (
                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      🔒 Requires {voice.required_tier} subscription
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Teaching Style Tab (AC 3) */}
        {activeTab === 'style' && (
          <div className="space-y-6">
            {/* Style Presets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {styles.map(style => (
                <div
                  key={style.id}
                  onClick={() => setSelectedStyle(style.style_type)}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all text-center ${
                    selectedStyle === style.style_type
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  <span className="text-4xl">{style.icon}</span>
                  <h3 className="font-semibold text-gray-900 mt-3">{style.name}</h3>
                  <p className="text-sm text-gray-600 mt-2">{style.description}</p>
                </div>
              ))}
            </div>
            
            {/* Speed Control (AC 2) */}
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-semibold text-gray-900 mb-4">🎚️ Playback Speed</h3>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 w-12">0.75x</span>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={speed}
                  onChange={e => setSpeed(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <span className="text-sm text-gray-500 w-12">1.5x</span>
              </div>
              <div className="text-center mt-2">
                <span className="text-2xl font-bold text-purple-600">{speed.toFixed(2)}x</span>
                <p className="text-sm text-gray-500">
                  {speed < 0.9 ? 'Slower for complex topics' :
                   speed > 1.2 ? 'Fast for quick revision' : 'Normal speed'}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Advanced Tab (AC 10 - Accessibility) */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            {/* Pitch Adjustment */}
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-semibold text-gray-900 mb-4">🎵 Pitch Adjustment</h3>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">Lower</span>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={pitchAdjustment}
                  onChange={e => setPitchAdjustment(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <span className="text-sm text-gray-500">Higher</span>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                {pitchAdjustment === 0 ? 'Default pitch' : `${pitchAdjustment > 0 ? '+' : ''}${pitchAdjustment}%`}
              </p>
            </div>
            
            {/* Accessibility Options (AC 10) */}
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-semibold text-gray-900 mb-4">♿ Accessibility Options</h3>
              <div className="space-y-4">
                {Object.entries({
                  enhanced_clarity: { label: 'Enhanced Clarity', desc: 'Clearer pronunciation for better understanding' },
                  bass_boost: { label: 'Bass Boost', desc: 'Deeper voice for hearing comfort' },
                  noise_reduction: { label: 'Noise Reduction', desc: 'Reduce background noise in audio' },
                  auto_captions: { label: 'Auto Captions', desc: 'Generate captions for all voice content' },
                  sign_language_overlay: { label: 'Sign Language Overlay', desc: 'Add sign language interpretation (when available)' }
                }).map(([key, { label, desc }]) => (
                  <label key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <div>
                      <span className="font-medium text-gray-900">{label}</span>
                      <p className="text-sm text-gray-500">{desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={accessibilitySettings[key as keyof typeof accessibilitySettings] || false}
                      onChange={e => setAccessibilitySettings({
                        ...accessibilitySettings,
                        [key]: e.target.checked
                      })}
                      className="w-5 h-5 accent-purple-500"
                    />
                  </label>
                ))}
              </div>
            </div>
            
            {/* Application Scope (AC 6, 9) */}
            <div className="bg-white rounded-xl p-6 border">
              <h3 className="font-semibold text-gray-900 mb-4">📍 Apply Voice To</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyGlobally}
                  onChange={e => setApplyGlobally(e.target.checked)}
                  className="w-5 h-5 accent-purple-500"
                />
                <span>Apply to all content (videos, assistant, practice)</span>
              </label>
              <p className="text-sm text-gray-500 mt-2">
                When enabled, your voice settings will be used consistently across all TTS-generated content.
              </p>
            </div>
          </div>
        )}
        
        {/* Voice Cloning Tab (AC 8) */}
        {activeTab === 'cloning' && (
          <div className="space-y-6">
            {/* Pro Feature Notice */}
            {userTier === 'free' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <span className="text-4xl">👑</span>
                <h3 className="font-semibold text-amber-900 mt-2">Pro Feature</h3>
                <p className="text-amber-700 mt-1">Voice cloning requires a Pro or Annual subscription</p>
                <button className="mt-4 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-6 py-2 rounded-lg">
                  Upgrade to Pro
                </button>
              </div>
            )}
            
            {/* Existing Clones */}
            {clones.length > 0 && (
              <div className="bg-white rounded-xl p-6 border">
                <h3 className="font-semibold text-gray-900 mb-4">🧬 Your Voice Clones</h3>
                <div className="space-y-3">
                  {clones.map(clone => (
                    <div key={clone.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium">{clone.name}</h4>
                        <p className="text-sm text-gray-500">
                          {clone.status === 'ready' ? '✅ Ready to use' :
                           clone.status === 'processing' ? `⏳ Processing... ${clone.processing_progress}%` :
                           clone.status === 'failed' ? '❌ Failed' : '⏳ Pending'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {clone.status === 'ready' && (
                          <button
                            onClick={() => setSelectedVoice({ ...clone, has_access: true } as unknown as Voice)}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm"
                          >
                            Use
                          </button>
                        )}
                        <button className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm">
                          ▶️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Create New Clone */}
            {userTier !== 'free' && clones.length < 3 && (
              <div className="bg-white rounded-xl p-6 border">
                <h3 className="font-semibold text-gray-900 mb-4">➕ Create Voice Clone</h3>
                <div className="text-center py-8 border-2 border-dashed rounded-xl">
                  <span className="text-4xl">🎙️</span>
                  <p className="mt-2 text-gray-600">Upload 1+ minute of clear speech</p>
                  <p className="text-sm text-gray-500 mt-1">MP3, WAV, M4A, OGG (max 50MB)</p>
                  <button
                    onClick={() => setShowCloneModal(true)}
                    className="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2 rounded-lg"
                  >
                    Upload Audio
                  </button>
                </div>
                <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-800">
                    ⚠️ <strong>Consent Required:</strong> You may only clone your own voice or voices you have explicit permission to use.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Save Button */}
        <div className="mt-8 flex items-center justify-between bg-white rounded-xl p-6 border sticky bottom-4">
          <div>
            {selectedVoice && (
              <p className="text-gray-600">
                Selected: <strong>{selectedVoice.name}</strong> • 
                Style: <strong className="capitalize">{selectedStyle}</strong> • 
                Speed: <strong>{speed}x</strong>
              </p>
            )}
            {saveMessage && (
              <p className={`text-sm mt-1 ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMessage}
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-300 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : '💾 Save Preferences'}
          </button>
        </div>
      </main>
      
      {/* Upgrade Modal (AC 7) */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
            <span className="text-5xl">👑</span>
            <h2 className="text-xl font-bold mt-4">Premium Voice</h2>
            <p className="text-gray-600 mt-2">
              This voice requires a Pro or Annual subscription to unlock.
            </p>
            <div className="mt-6 space-y-3">
              <button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-lg">
                Upgrade to Pro
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Clone Modal (AC 8) */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">🧬 Voice Cloning</h2>
              <button onClick={() => setShowCloneModal(false)} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clone Name</label>
                <input
                  type="text"
                  placeholder="My Custom Voice"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audio File</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleStartCloning(e.target.files[0]);
                    }
                  }}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 60 seconds of clear speech</p>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" className="mt-1" required />
                  <span className="text-sm text-amber-800">
                    I confirm that I have the right to clone this voice and consent to its use for TTS generation.
                  </span>
                </label>
              </div>
              
              <button
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-lg"
              >
                Start Cloning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
