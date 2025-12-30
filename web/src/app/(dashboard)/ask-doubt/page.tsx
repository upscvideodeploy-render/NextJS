'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import TextInput from '@/components/doubt/TextInput';
import ImageUploader from '@/components/doubt/ImageUploader';
import VoiceRecorder from '@/components/doubt/VoiceRecorder';
import StyleSelector from '@/components/doubt/StyleSelector';
import VideoLengthSelector from '@/components/doubt/VideoLengthSelector';
import VoicePreferenceSelector from '@/components/doubt/VoicePreferenceSelector';

type InputType = 'text' | 'image' | 'voice';

export default function AskDoubtPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeInput, setActiveInput] = useState<InputType>('text');
  const [doubtText, setDoubtText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [style, setStyle] = useState<'concise' | 'detailed' | 'example-rich'>('detailed');
  const [videoLength, setVideoLength] = useState<60 | 120 | 180>(60);
  const [voicePreference, setVoicePreference] = useState('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Get final doubt text based on input type
      let finalText = '';
      if (activeInput === 'text') {
        finalText = doubtText;
      } else if (activeInput === 'image') {
        finalText = extractedText;
      } else if (activeInput === 'voice') {
        finalText = transcribedText;
      }

      if (!finalText.trim()) {
        setError('Please enter a doubt or upload an image/voice');
        return;
      }

      // Submit to API
      const response = await fetch('/api/doubts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doubt_text: finalText,
          input_type: activeInput,
          style,
          video_length: videoLength,
          voice_preference: voicePreference,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit doubt');
      }

      // Redirect to job status page
      router.push(`/dashboard/doubts/${data.job_id}`);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-2">Ask a Doubt</h1>
      <p className="text-gray-400 mb-8">
        Get AI-generated video explanations for your UPSC preparation doubts
      </p>

      {/* Input Type Selector */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setActiveInput('text')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeInput === 'text'
              ? 'bg-neon-blue text-white'
              : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
          }`}
        >
          📝 Text
        </button>
        <button
          onClick={() => setActiveInput('image')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeInput === 'image'
              ? 'bg-neon-blue text-white'
              : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
          }`}
        >
          📷 Image
        </button>
        <button
          onClick={() => setActiveInput('voice')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            activeInput === 'voice'
              ? 'bg-neon-blue text-white'
              : 'bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
          }`}
        >
          🎤 Voice
        </button>
      </div>

      {/* Input Components */}
      <div className="mb-8">
        {activeInput === 'text' && (
          <TextInput value={doubtText} onChange={setDoubtText} />
        )}
        {activeInput === 'image' && (
          <ImageUploader
            onFileSelect={setImageFile}
            onTextExtracted={setExtractedText}
          />
        )}
        {activeInput === 'voice' && (
          <VoiceRecorder
            onRecordingComplete={setVoiceBlob}
            onTranscriptionComplete={setTranscribedText}
          />
        )}
      </div>

      {/* Preview Extracted Text */}
      {(extractedText || transcribedText) && (
        <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-white/10">
          <h3 className="text-lg font-semibold mb-4">Extracted Text (Editable)</h3>
          <textarea
            value={activeInput === 'image' ? extractedText : transcribedText}
            onChange={(e) =>
              activeInput === 'image'
                ? setExtractedText(e.target.value)
                : setTranscribedText(e.target.value)
            }
            className="w-full h-32 px-4 py-3 bg-slate-900/50 border border-white/10 rounded-lg text-white resize-none"
          />
        </div>
      )}

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StyleSelector value={style} onChange={setStyle} />
        <VideoLengthSelector value={videoLength} onChange={setVideoLength} />
        <VoicePreferenceSelector value={voicePreference} onChange={setVoicePreference} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-lg py-4"
      >
        {isSubmitting ? (
          <>
            <span className="animate-spin inline-block mr-2">⏳</span>
            Submitting...
          </>
        ) : (
          <>🎬 Generate Video Explanation</>
        )}
      </button>

      {/* Info */}
      <p className="text-center text-gray-500 text-sm mt-4">
        Your doubt will be processed and a video explanation will be generated within 5-10 minutes
      </p>
    </div>
  );
}
