'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Story 9.2: Assistant Teaching Style Customization Settings
// Story 9.3: Motivational Check-in Settings
// AC 1-10: Full settings UI with presets and preview

interface Preferences {
  teaching_style: string;
  tone: string;
  depth_level: number;
  language: string;
  active_preset: string | null;
  use_examples: boolean;
  include_mnemonics: boolean;
  suggest_practice: boolean;
}

// Story 9.3: Check-in settings
interface CheckinSettings {
  checkin_enabled: boolean;
  preferred_checkin_time: string;
  timezone: string;
  notification_channel: string;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  icon: string;
  teaching_style?: string;
  tone?: string;
  depth_level?: number;
}

interface Option {
  id: string;
  name: string;
  description?: string;
}

const DEFAULT_PREFERENCES: Preferences = {
  teaching_style: 'detailed',
  tone: 'friendly',
  depth_level: 3,
  language: 'english',
  active_preset: null,
  use_examples: true,
  include_mnemonics: true,
  suggest_practice: true,
};

export default function AssistantSettingsPage() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [options, setOptions] = useState<{
    teaching_styles: Option[];
    tones: Option[];
    languages: Option[];
  }>({ teaching_styles: [], tones: [], languages: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // AC 8: Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResponse, setPreviewResponse] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState('What is the significance of the Preamble to the Indian Constitution?');

  // Story 9.3: Check-in settings state
  const [checkinSettings, setCheckinSettings] = useState<CheckinSettings>({
    checkin_enabled: true,
    preferred_checkin_time: '09:00',
    timezone: 'Asia/Kolkata',
    notification_channel: 'push',
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadPreferences();
  }, []);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  };

  const loadPreferences = async () => {
    try {
      const authHeader = await getAuthHeader();
      
      // Load preferences and options
      const [prefsRes, presetsRes, checkinRes] = await Promise.all([
        fetch('/api/assistant/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ action: 'get_preferences' }),
        }),
        fetch('/api/assistant/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ action: 'get_presets' }),
        }),
        // Story 9.3: Load check-in settings
        fetch('/api/assistant/checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ action: 'get_settings' }),
        }),
      ]);

      if (prefsRes.ok) {
        const data = await prefsRes.json();
        setPreferences(data.preferences || DEFAULT_PREFERENCES);
        setOptions(data.options || { teaching_styles: [], tones: [], languages: [] });
      }

      if (presetsRes.ok) {
        const data = await presetsRes.json();
        setPresets(data.presets || []);
      }

      // Story 9.3: Set check-in settings
      if (checkinRes.ok) {
        const data = await checkinRes.json();
        if (data.settings) {
          setCheckinSettings(data.settings);
        }
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/assistant/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'save_preferences',
          ...preferences,
          active_preset: null, // Clear preset when customizing
        }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' });
        setPreferences(prev => ({ ...prev, active_preset: null }));
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  // AC 9: Apply preset
  const applyPreset = async (presetId: string) => {
    setSaving(true);
    setMessage(null);
    
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/assistant/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'apply_preset', preset_id: presetId }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Preset applied!' });
        loadPreferences(); // Reload to get updated values
      } else {
        throw new Error('Failed to apply preset');
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to apply preset' });
    } finally {
      setSaving(false);
    }
  };

  // AC 10: Reset to defaults
  const resetToDefaults = async () => {
    if (!confirm('Reset all preferences to defaults?')) return;
    
    setSaving(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/assistant/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'reset_preferences' }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Preferences reset to defaults' });
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to reset' });
    } finally {
      setSaving(false);
    }
  };

  // AC 8: Preview mode
  const testPreview = async () => {
    setPreviewLoading(true);
    setShowPreview(true);
    
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/assistant/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'preview',
          ...preferences,
          sample_question: previewQuestion,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewResponse(data.preview);
      }
    } catch (e) {
      setPreviewResponse('Preview failed. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const depthLabels = ['ELI5', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Assistant Settings</h1>
        <p className="text-gray-600 mt-2">Customize how UPSC Guru teaches and responds to you</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* AC 9: Presets */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Quick Presets</h2>
        <p className="text-gray-600 mb-4">Choose a preset to quickly apply a teaching style</p>
        <div className="grid grid-cols-2 gap-4">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              disabled={saving}
              className={`p-4 border-2 rounded-lg text-left transition hover:border-blue-500 ${
                preferences.active_preset === preset.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{preset.icon}</span>
                <div>
                  <div className="font-semibold">{preset.name}</div>
                  <div className="text-sm text-gray-600">{preset.description}</div>
                </div>
              </div>
              {preferences.active_preset === preset.id && (
                <div className="mt-2 text-xs text-blue-600 font-medium">✓ Active</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* AC 2: Teaching Style */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Teaching Approach</h2>
        <div className="grid grid-cols-2 gap-3">
          {(options.teaching_styles.length > 0 ? options.teaching_styles : [
            { id: 'concise', name: 'Concise', description: 'Brief explanations' },
            { id: 'detailed', name: 'Detailed', description: 'Comprehensive coverage' },
            { id: 'example_heavy', name: 'Example-Heavy', description: 'Lots of examples' },
            { id: 'socratic', name: 'Socratic', description: 'Question-driven' },
          ]).map((style) => (
            <button
              key={style.id}
              onClick={() => setPreferences(p => ({ ...p, teaching_style: style.id, active_preset: null }))}
              className={`p-4 border-2 rounded-lg text-left transition ${
                preferences.teaching_style === style.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{style.name}</div>
              {style.description && <div className="text-sm text-gray-600">{style.description}</div>}
            </button>
          ))}
        </div>
      </div>

      {/* AC 3: Tone Control */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Tone</h2>
        <div className="grid grid-cols-4 gap-3">
          {(options.tones.length > 0 ? options.tones : [
            { id: 'formal', name: 'Formal' },
            { id: 'friendly', name: 'Friendly' },
            { id: 'motivational', name: 'Motivational' },
            { id: 'strict', name: 'Strict' },
          ]).map((tone) => (
            <button
              key={tone.id}
              onClick={() => setPreferences(p => ({ ...p, tone: tone.id, active_preset: null }))}
              className={`p-3 border-2 rounded-lg text-center transition ${
                preferences.tone === tone.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {tone.name}
            </button>
          ))}
        </div>
      </div>

      {/* AC 4: Depth Slider */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Explanation Depth</h2>
        <div className="px-4">
          <input
            type="range"
            min="1"
            max="5"
            value={preferences.depth_level}
            onChange={(e) => setPreferences(p => ({ ...p, depth_level: parseInt(e.target.value), active_preset: null }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            {depthLabels.map((label, i) => (
              <span key={i} className={preferences.depth_level === i + 1 ? 'text-blue-600 font-semibold' : ''}>
                {label}
              </span>
            ))}
          </div>
          <div className="text-center mt-4 text-lg font-semibold text-blue-600">
            Level {preferences.depth_level}: {depthLabels[preferences.depth_level - 1]}
          </div>
        </div>
      </div>

      {/* AC 5: Language Preference */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Language</h2>
        <div className="grid grid-cols-3 gap-3">
          {(options.languages.length > 0 ? options.languages : [
            { id: 'english', name: 'English' },
            { id: 'hindi', name: 'Hindi' },
            { id: 'hinglish', name: 'Hinglish' },
          ]).map((lang) => (
            <button
              key={lang.id}
              onClick={() => setPreferences(p => ({ ...p, language: lang.id, active_preset: null }))}
              className={`p-3 border-2 rounded-lg text-center transition ${
                preferences.language === lang.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {/* Additional Options */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Additional Options</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.use_examples}
              onChange={(e) => setPreferences(p => ({ ...p, use_examples: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
            <span>Include examples and analogies</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.include_mnemonics}
              onChange={(e) => setPreferences(p => ({ ...p, include_mnemonics: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
            <span>Use mnemonics and memory aids</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.suggest_practice}
              onChange={(e) => setPreferences(p => ({ ...p, suggest_practice: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
            <span>Suggest practice questions</span>
          </label>
        </div>
      </div>

      {/* Story 9.3: Motivational Check-in Settings (AC 9) */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">📅 Daily Check-ins</h2>
        <p className="text-gray-600 mb-6">Get personalized motivational messages based on your activity</p>
        
        {/* Enable/Disable Check-ins */}
        <label className="flex items-center gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={checkinSettings.checkin_enabled}
            onChange={(e) => setCheckinSettings(s => ({ ...s, checkin_enabled: e.target.checked }))}
            className="w-6 h-6 rounded accent-blue-600"
          />
          <div>
            <span className="font-medium">Enable Daily Check-ins</span>
            <p className="text-sm text-gray-500">Receive motivational messages and progress celebrations</p>
          </div>
        </label>
        
        {checkinSettings.checkin_enabled && (
          <div className="space-y-6 border-t pt-6">
            {/* Preferred Time */}
            <div>
              <label className="block text-sm font-medium mb-2">Preferred Check-in Time</label>
              <input
                type="time"
                value={checkinSettings.preferred_checkin_time}
                onChange={(e) => setCheckinSettings(s => ({ ...s, preferred_checkin_time: e.target.value }))}
                className="w-full max-w-xs p-3 border rounded-lg"
              />
            </div>
            
            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                value={checkinSettings.timezone}
                onChange={(e) => setCheckinSettings(s => ({ ...s, timezone: e.target.value }))}
                className="w-full max-w-xs p-3 border rounded-lg"
              >
                <option value="Asia/Kolkata">India (IST)</option>
                <option value="America/New_York">US Eastern</option>
                <option value="America/Los_Angeles">US Pacific</option>
                <option value="Europe/London">UK (GMT/BST)</option>
                <option value="Asia/Dubai">UAE (GST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Australia/Sydney">Australia Eastern</option>
              </select>
            </div>
            
            {/* Notification Channel */}
            <div>
              <label className="block text-sm font-medium mb-2">Notification Method</label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {[
                  { id: 'push', label: '🔔 Push', desc: 'In-app notifications' },
                  { id: 'email', label: '📧 Email', desc: 'Daily email' },
                  { id: 'both', label: '🔔📧 Both', desc: 'Push + Email' },
                  { id: 'none', label: '🔕 Silent', desc: 'Check manually' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setCheckinSettings(s => ({ ...s, notification_channel: opt.id }))}
                    className={`p-3 border-2 rounded-lg text-left transition ${
                      checkinSettings.notification_channel === opt.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Save Check-in Settings Button */}
            <button
              onClick={async () => {
                try {
                  const authHeader = await getAuthHeader();
                  const res = await fetch('/api/assistant/checkins', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
                    body: JSON.stringify({ action: 'save_settings', ...checkinSettings }),
                  });
                  if (res.ok) {
                    setMessage({ type: 'success', text: 'Check-in settings saved!' });
                    setTimeout(() => setMessage(null), 3000);
                  }
                } catch (e) {
                  setMessage({ type: 'error', text: 'Failed to save check-in settings' });
                }
              }}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Save Check-in Settings
            </button>
          </div>
        )}
      </div>

      {/* AC 8: Preview Mode */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Preview Your Settings</h2>
        <p className="text-gray-600 mb-4">Test how the assistant will respond with your current settings</p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Sample Question:</label>
          <input
            type="text"
            value={previewQuestion}
            onChange={(e) => setPreviewQuestion(e.target.value)}
            className="w-full p-3 border rounded-lg"
            placeholder="Enter a test question..."
          />
        </div>

        <button
          onClick={testPreview}
          disabled={previewLoading}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {previewLoading ? 'Generating Preview...' : '🔍 Test Preview'}
        </button>

        {showPreview && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <div className="text-sm text-gray-500 mb-2">Preview Response:</div>
            {previewLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                <span>Generating...</span>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{previewResponse}</div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={resetToDefaults}
          disabled={saving}
          className="px-6 py-3 text-gray-600 hover:text-gray-800"
        >
          Reset to Defaults
        </button>
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
