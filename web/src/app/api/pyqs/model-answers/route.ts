/**
 * API Route: /api/pyqs/model-answers
 * Story 8.3: AI-Powered Model Answer Generation
 * 
 * Generates comprehensive model answers for PYQ questions using:
 * - A4F API for answer generation
 * - Key points extraction
 * - UPSC-standard formatting
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

interface Question {
  id: string;
  question_text: string;
  question_type: 'MCQ' | 'Descriptive';
  marks?: number;
  word_limit?: number;
  subject?: string;
  paper_type?: string;
}

interface ModelAnswer {
  answer_text: string;
  key_points: string[];
}

// Generate model answer using AI
async function generateModelAnswer(question: Question): Promise<ModelAnswer> {
  const isMCQ = question.question_type === 'MCQ';
  
  const wordLimit = question.word_limit || (question.marks ? question.marks * 20 : 150);
  
  const prompt = isMCQ
    ? `For this UPSC Prelims MCQ question, provide:
1. The correct answer with brief explanation
2. Why other options are incorrect
3. Key facts to remember

Question: ${question.question_text}

Keep the explanation concise and exam-focused.`
    : `Write a UPSC-standard model answer for this question.

Question: ${question.question_text}
Marks: ${question.marks || 'Not specified'}
Word Limit: ${wordLimit} words

Format your answer as:
1. Brief introduction (1-2 sentences)
2. Main body with subpoints
3. Conclusion with way forward

Also provide 5-7 key points that can be memorized.

Return in this JSON format:
{
  "answer": "Full answer text here...",
  "key_points": ["Point 1", "Point 2", "Point 3", ...]
}`;

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
            content: 'You are an expert UPSC answer writer. Write comprehensive, exam-ready answers that would score high marks. Use proper structure, include facts, and maintain academic tone.' 
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          answer_text: parsed.answer || content,
          key_points: parsed.key_points || []
        };
      }
    } catch {
      // Not JSON, use raw content
    }

    // Extract key points from text
    const keyPoints: string[] = [];
    const bulletMatch = content.match(/[-•]\s*([^\n]+)/g);
    if (bulletMatch) {
      bulletMatch.slice(0, 7).forEach((point: string) => {
        keyPoints.push(point.replace(/^[-•]\s*/, '').trim());
      });
    }

    return {
      answer_text: content,
      key_points: keyPoints
    };

  } catch (error) {
    console.error('Model answer generation error:', error);
    return {
      answer_text: `Error generating answer for: ${question.question_text.substring(0, 100)}...`,
      key_points: []
    };
  }
}

// POST: Generate model answers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paper_id, question_id, generate_all } = body;

    const supabase = getSupabaseClient();

    // Get questions to process
    let questionsToProcess: Question[] = [];

    if (generate_all) {
      // Get all questions without model answers
      const { data } = await supabase
        .from('pyq_questions')
        .select(`
          id,
          question_text,
          question_type,
          marks,
          word_limit,
          subject,
          paper:pyq_papers(paper_type)
        `)
        .not('id', 'in', 
          supabase.from('pyq_model_answers').select('question_id')
        )
        .limit(20);
      
      questionsToProcess = (data || []).map(q => ({
        ...q,
        paper_type: (q.paper as { paper_type?: string })?.paper_type
      })) as Question[];

    } else if (paper_id) {
      // Get questions for specific paper without answers
      const { data } = await supabase
        .from('pyq_questions')
        .select(`
          id,
          question_text,
          question_type,
          marks,
          word_limit,
          subject,
          paper:pyq_papers(paper_type)
        `)
        .eq('paper_id', paper_id)
        .limit(50);

      // Filter out questions that already have answers
      const { data: existingAnswers } = await supabase
        .from('pyq_model_answers')
        .select('question_id')
        .in('question_id', (data || []).map(q => q.id));

      const existingIds = new Set((existingAnswers || []).map(a => a.question_id));
      
      questionsToProcess = (data || [])
        .filter(q => !existingIds.has(q.id))
        .map(q => ({
          ...q,
          paper_type: (q.paper as { paper_type?: string })?.paper_type
        })) as Question[];

    } else if (question_id) {
      const { data } = await supabase
        .from('pyq_questions')
        .select(`
          id,
          question_text,
          question_type,
          marks,
          word_limit,
          subject,
          paper:pyq_papers(paper_type)
        `)
        .eq('id', question_id)
        .single();

      if (data) {
        questionsToProcess = [{
          ...data,
          paper_type: (data.paper as { paper_type?: string })?.paper_type
        }] as Question[];
      }
    } else {
      return NextResponse.json(
        { error: 'paper_id, question_id, or generate_all required' },
        { status: 400 }
      );
    }

    if (questionsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No questions need model answers',
        count: 0
      });
    }

    // Generate answers for each question
    const answers: { question_id: string; answer_text: string; key_points: string[] }[] = [];

    for (const question of questionsToProcess) {
      const modelAnswer = await generateModelAnswer(question);
      answers.push({
        question_id: question.id,
        answer_text: modelAnswer.answer_text,
        key_points: modelAnswer.key_points
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Insert all answers
    const { error: insertError } = await supabase
      .from('pyq_model_answers')
      .insert(answers);

    if (insertError) {
      throw new Error(`Failed to save answers: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
      count: answers.length,
      message: `Generated ${answers.length} model answers`
    });

  } catch (error) {
    console.error('Model answer generation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

// GET: Get model answer for a question
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get('question_id');
  const paperId = searchParams.get('paper_id');

  const supabase = getSupabaseClient();

  if (questionId) {
    const { data: answer, error } = await supabase
      .from('pyq_model_answers')
      .select('*')
      .eq('question_id', questionId)
      .single();

    if (error || !answer) {
      return NextResponse.json({ success: false, error: 'Answer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, answer });
  }

  if (paperId) {
    // Get all answers for questions in this paper
    const { data: questions } = await supabase
      .from('pyq_questions')
      .select('id')
      .eq('paper_id', paperId);

    const questionIds = (questions || []).map(q => q.id);

    const { data: answers } = await supabase
      .from('pyq_model_answers')
      .select('*')
      .in('question_id', questionIds);

    return NextResponse.json({
      success: true,
      answers: answers || [],
      total_questions: questionIds.length,
      answers_available: answers?.length || 0
    });
  }

  // Get stats
  const { data: answerCount } = await supabase
    .from('pyq_model_answers')
    .select('id', { count: 'exact' });

  const { data: questionCount } = await supabase
    .from('pyq_questions')
    .select('id', { count: 'exact' });

  return NextResponse.json({
    success: true,
    stats: {
      total_questions: questionCount?.length || 0,
      model_answers: answerCount?.length || 0,
      coverage: questionCount?.length 
        ? Math.round(((answerCount?.length || 0) / questionCount.length) * 100) 
        : 0
    }
  });
}
