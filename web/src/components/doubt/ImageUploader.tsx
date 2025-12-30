'use client';

import { useState } from 'react';

interface ImageUploaderProps {
  onFileSelect: (file: File | null) => void;
  onTextExtracted: (text: string) => void;
}

export default function ImageUploader({ onFileSelect, onTextExtracted }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG, JPG, or PDF file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setError(null);
    onFileSelect(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
      extractText(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const extractText = async (base64: string) => {
    setIsExtracting(true);
    try {
      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await response.json();
      if (response.ok) {
        onTextExtracted(data.text);
      } else {
        setError('Failed to extract text from image');
      }
    } catch (err) {
      setError('OCR service unavailable');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Upload an image of your question
      </label>

      {!preview ? (
        <div className="border-2 border-dashed border-white/10 rounded-lg p-12 text-center hover:border-neon-blue/50 transition-colors cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,application/pdf"
            onChange={handleFileChange}
            className="hidden"
            id="image-upload"
          />
          <label htmlFor="image-upload" className="cursor-pointer">
            <div className="mb-4 text-4xl">📷</div>
            <p className="text-gray-300 mb-2">Click to upload or drag and drop</p>
            <p className="text-gray-500 text-sm">PNG, JPG, PDF (max 10MB)</p>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-96 object-contain rounded-lg border border-white/10"
            />
            <button
              onClick={() => {
                setPreview(null);
                onFileSelect(null);
                onTextExtracted('');
              }}
              className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white"
            >
              ✕ Remove
            </button>
          </div>
          {isExtracting && (
            <div className="text-center text-gray-400">
              <span className="animate-spin inline-block mr-2">⏳</span>
              Extracting text from image...
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
