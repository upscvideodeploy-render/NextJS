'use client';

import { useState, useRef } from 'react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onTranscriptionComplete: (text: string) => void;
}

export default function VoiceRecorder({
  onRecordingComplete,
  onTranscriptionComplete,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onRecordingComplete(blob);
        await transcribeAudio(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/api/stt/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        onTranscriptionComplete(data.text);
      } else {
        console.error('Transcription failed');
      }
    } catch (err) {
      console.error('Transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const resetRecording = () => {
    setAudioUrl(null);
    setRecordingTime(0);
    onRecordingComplete(new Blob());
    onTranscriptionComplete('');
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Record your question (max 60 seconds)
      </label>

      <div className="p-8 bg-slate-800/50 border border-white/10 rounded-lg text-center">
        {!audioUrl ? (
          <>
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto bg-neon-blue/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">{isRecording ? '⏺️' : '🎤'}</span>
              </div>
              {isRecording && (
                <div className="text-2xl font-bold text-neon-blue">
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>

            {!isRecording ? (
              <button
                onClick={startRecording}
                className="btn-primary"
              >
                🎤 Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-medium"
              >
                ⏹️ Stop Recording
              </button>
            )}
          </>
        ) : (
          <>
            <audio src={audioUrl} controls className="w-full mb-4" />
            {isTranscribing ? (
              <div className="text-gray-400">
                <span className="animate-spin inline-block mr-2">⏳</span>
                Transcribing audio...
              </div>
            ) : (
              <div className="flex gap-4 justify-center">
                <button onClick={resetRecording} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
                  🔄 Record Again
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
