/**
 * API Route: /api/pyqs/ocr
 * Story 8.2: OCR Text Extraction from PYQ PDFs
 * 
 * Extracts questions from uploaded PYQ PDF papers using:
 * - PDF text extraction (pdf-parse)
 * - AI-powered question parsing (A4F API)
 * - Automatic categorization and structuring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// A4F API Configuration
const A4F_API_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const A4F_PRIMARY_LLM = process.env.A4F_PRIMARY_LLM || 'provider-3/llama-4-scout';

interface ExtractedQuestion {
  question_number: number;
  question_text: string;
  question_type: 'MCQ' | 'Descriptive';
  options?: string[];
  correct_answer?: string;
  marks?: number;
  word_limit?: number;
  subject?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Extract questions using AI
async function extractQuestionsWithAI(text: string, paperType: string): Promise<ExtractedQuestion[]> {
  const isPrelimsMode = paperType === 'Prelims';
  
  const prompt = isPrelimsMode
    ? `Extract MCQ questions from this UPSC Prelims paper text. For each question, provide:
- question_number (integer)
- question_text (full question)
- question_type: "MCQ"
- options: array of 4 options (a, b, c, d)
- correct_answer: if visible
- subject: History/Geography/Polity/Economy/Science/Environment/Current Affairs
- difficulty: easy/medium/hard

Return as JSON array. Text:

${text.substring(0, 8000)}`
    : `Extract descriptive questions from this UPSC Mains paper text. For each question, provide:
- question_number (integer)
- question_text (full question)
- question_type: "Descriptive"
- marks (integer)
- word_limit (if specified)
- subject (based on paper type)
- difficulty: easy/medium/hard

Return as JSON array. Text:

${text.substring(0, 8000)}`;

  try {
    const response = await fetch(`${A4F_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${A4F_API_KEY}`,
      },
      body: JSON.stringify({
        model: A4F_PRIMARY_LLM,
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert UPSC question extractor. Parse the given text and extract structured questions. Return only valid JSON array.' 
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI extraction failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('AI extraction error:', error);
    return [];
  }
}

// POST: Process OCR for a paper
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paper_id, process_all } = body;

    const supabase = getSupabaseClient();

    // Get papers to process
    let papersToProcess: { id: string; file_url: string; paper_type: string }[] = [];

    if (process_all) {
      const { data } = await supabase
        .from('pyq_papers')
        .select('id, file_url, paper_type')
        .eq('status', 'pending')
        .limit(10);
      papersToProcess = data || [];
    } else if (paper_id) {
      const { data } = await supabase
        .from('pyq_papers')
        .select('id, file_url, paper_type')
        .eq('id', paper_id)
        .single();
      if (data) papersToProcess = [data];
    } else {
      return NextResponse.json({ error: 'paper_id or process_all required' }, { status: 400 });
    }

    if (papersToProcess.length === 0) {
      return NextResponse.json({ success: true, message: 'No papers to process' });
    }

    const results = [];

    for (const paper of papersToProcess) {
      try {
        // Update status to processing
        await supabase
          .from('pyq_papers')
          .update({ status: 'processing', progress: 10 })
          .eq('id', paper.id);

        // Fetch PDF
        const pdfResponse = await fetch(paper.file_url);
        if (!pdfResponse.ok) {
          throw new Error('Failed to fetch PDF');
        }

        // Update progress
        await supabase
          .from('pyq_papers')
          .update({ progress: 30 })
          .eq('id', paper.id);

        // Extract text using pdf-parse
        let pdfText = '';
        try {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          // Dynamic import for pdf-parse
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(Buffer.from(pdfBuffer));
          pdfText = pdfData.text;
        } catch (parseError) {
          console.error('PDF parsing error:', parseError);
          // Fallback: Use AI to describe the content
          pdfText = `[PDF Content from ${paper.file_url}]`;
        }

        // Update progress
        await supabase
          .from('pyq_papers')
          .update({ progress: 50 })
          .eq('id', paper.id);

        // Extract questions using AI
        const questions = await extractQuestionsWithAI(pdfText, paper.paper_type);

        // Update progress
        await supabase
          .from('pyq_papers')
          .update({ progress: 70 })
          .eq('id', paper.id);

        // Insert extracted questions
        if (questions.length > 0) {
          const questionRecords = questions.map(q => ({
            paper_id: paper.id,
            question_number: q.question_number,
            question_text: q.question_text,
            question_type: q.question_type,
            options_json: q.options ? { options: q.options } : null,
            correct_answer: q.correct_answer,
            marks: q.marks,
            word_limit: q.word_limit,
            subject: q.subject,
            topic: q.topic,
            difficulty: q.difficulty || 'medium',
          }));

          const { error: insertError } = await supabase
            .from('pyq_questions')
            .insert(questionRecords);

          if (insertError) {
            console.error('Question insert error:', insertError);
          }
        }

        // Mark as completed
        await supabase
          .from('pyq_papers')
          .update({ status: 'completed', progress: 100 })
          .eq('id', paper.id);

        results.push({
          paper_id: paper.id,
          status: 'completed',
          questions_extracted: questions.length
        });

      } catch (paperError) {
        console.error(`Error processing paper ${paper.id}:`, paperError);
        
        await supabase
          .from('pyq_papers')
          .update({ status: 'failed', progress: 0 })
          .eq('id', paper.id);

        results.push({
          paper_id: paper.id,
          status: 'failed',
          error: paperError instanceof Error ? paperError.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'OCR processing failed' },
      { status: 500 }
    );
  }
}

// GET: Check OCR status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get('paper_id');

  const supabase = getSupabaseClient();

  if (paperId) {
    const { data: paper } = await supabase
      .from('pyq_papers')
      .select('id, status, progress')
      .eq('id', paperId)
      .single();

    const { data: questions } = await supabase
      .from('pyq_questions')
      .select('id')
      .eq('paper_id', paperId);

    return NextResponse.json({
      success: true,
      paper_id: paperId,
      status: paper?.status,
      progress: paper?.progress,
      question_count: questions?.length || 0
    });
  }

  // Get overall stats
  const { data: stats } = await supabase
    .from('pyq_papers')
    .select('status');

  const summary = {
    pending: stats?.filter(p => p.status === 'pending').length || 0,
    processing: stats?.filter(p => p.status === 'processing').length || 0,
    completed: stats?.filter(p => p.status === 'completed').length || 0,
    failed: stats?.filter(p => p.status === 'failed').length || 0,
  };

  return NextResponse.json({ success: true, summary });
}
