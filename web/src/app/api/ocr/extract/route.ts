import { NextRequest, NextResponse } from 'next/server';

// A4F Vision API for OCR
const A4F_API_URL = 'https://api.a4f.co/v1';
const A4F_API_KEY = 'ddc-a4f-12e06ff0184f41de8d3de7be4cd2e831';
const VISION_MODEL = 'provider-3/gemini-2.5-flash';

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Call A4F Vision API for OCR
    const response = await fetch(`${A4F_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${A4F_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this image. Return only the extracted text, no explanations.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('A4F Vision API error:', error);
      return NextResponse.json(
        { error: 'OCR extraction failed' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const extractedText = data.choices[0]?.message?.content || '';

    return NextResponse.json({ text: extractedText });
  } catch (error: any) {
    console.error('OCR extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract text' },
      { status: 500 }
    );
  }
}
