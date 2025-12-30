import { NextRequest, NextResponse } from 'next/server';

// A4F Whisper API for Speech-to-Text
const A4F_API_URL = 'https://api.a4f.co/v1';
const A4F_API_KEY = 'ddc-a4f-12e06ff0184f41de8d3de7be4cd2e831';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Create FormData for A4F API
    const a4fFormData = new FormData();
    a4fFormData.append('file', audioFile);
    a4fFormData.append('model', 'provider-5/whisper-1');

    // Call A4F Whisper API
    const response = await fetch(`${A4F_API_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A4F_API_KEY}`,
      },
      body: a4fFormData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('A4F Whisper API error:', error);
      return NextResponse.json(
        { error: 'Transcription failed' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const transcribedText = data.text || '';

    return NextResponse.json({ text: transcribedText });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
