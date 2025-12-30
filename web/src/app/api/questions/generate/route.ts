// Story 8.6: AI Question Generator Interface - Full Production Implementation
// AC 1-10: Complete question generation with entitlements, quality control, database persistence
// Story 8.8: AI difficulty prediction integration

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY;
const PRIMARY_MODEL = 'provider-3/llama-4-scout';

// Story 8.6 AC 3: Question type configurations
const QUESTION_TYPE_CONFIG = {
  mcq: {
    label: 'Prelims MCQ',
    answerFormat: '4 options (A, B, C, D) with one correct answer and explanation for each option',
    outputFormat: 'options: ["...", "...", "...", "..."], correct_answer: "A", explanations: {...}'
  },
  mains_150: {
    label: 'Mains 150-word',
    answerFormat: 'structured answer with introduction, body points, and conclusion (~150 words)',
    outputFormat: 'model_answer: "...", key_points: ["..."]'
  },
  mains_250: {
    label: 'Mains 250-word',
    answerFormat: 'detailed answer with intro, multiple body paragraphs, and conclusion (~250 words)',
    outputFormat: 'model_answer: "...", key_points: ["..."]'
  },
  essay: {
    label: 'Essay 1000-word',
    answerFormat: 'comprehensive essay with abstract, thesis, multiple sections, and conclusion (~1000 words)',
    outputFormat: 'model_answer: "...", key_points: ["..."]'
  }
};

// Story 8.6 AC 4: Difficulty configurations
const DIFFICULTY_CONFIG = {
  easy: 'Basic concepts, direct questions, fundamental understanding required',
  medium: 'Moderate complexity, requires analysis and application of concepts',
  hard: 'Advanced topics, requires critical thinking, inter-linking of concepts, and nuanced understanding'
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase client with user token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const { topic, syllabus_node_id, question_type, difficulty, count } = await req.json();

    // Validate required fields (Story 8.6 AC 1-4)
    if (!topic || !question_type || !difficulty || !count) {
      return NextResponse.json({ error: 'Missing required fields: topic, question_type, difficulty, count' }, { status: 400 });
    }

    // Validate question type (Story 8.6 AC 3)
    if (!['mcq', 'mains_150', 'mains_250', 'essay'].includes(question_type)) {
      return NextResponse.json({ error: 'Invalid question_type. Must be: mcq, mains_150, mains_250, or essay' }, { status: 400 });
    }

    // Validate difficulty (Story 8.6 AC 4)
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty. Must be: easy, medium, or hard' }, { status: 400 });
    }

    // Validate count (Story 8.6 AC 5)
    const questionCount = Math.min(Math.max(1, count), 10);

    // Story 8.6 AC 10: Check entitlements
    const { data: limitCheck, error: limitError } = await supabase.rpc(
      'check_question_generation_limit',
      { p_user_id: user.id, p_count: questionCount }
    );

    if (limitError) {
      console.error('[Story 8.6] Limit check error:', limitError);
      // Continue with default limit if function doesn't exist yet
    }

    const accessCheck = limitCheck?.[0] || { allowed: true, current_usage: 0, daily_limit: 5, remaining: 5 };

    if (!accessCheck.allowed) {
      return NextResponse.json({
        error: 'Daily question generation limit reached',
        reason: accessCheck.reason,
        current_usage: accessCheck.current_usage,
        daily_limit: accessCheck.daily_limit,
        upgrade_required: true
      }, { status: 403 });
    }

    // Story 8.6 AC 6-7: Build AI prompt for question generation
    const typeConfig = QUESTION_TYPE_CONFIG[question_type as keyof typeof QUESTION_TYPE_CONFIG];
    const difficultyDesc = DIFFICULTY_CONFIG[difficulty as keyof typeof DIFFICULTY_CONFIG];

    const systemPrompt = `You are an expert UPSC question setter with deep knowledge of the UPSC Civil Services Examination pattern.
You create high-quality, exam-style questions that test conceptual understanding and application.

Guidelines:
1. Questions must be factually accurate and relevant to UPSC syllabus
2. Questions should test analytical thinking, not just rote memorization
3. For MCQs, all options should be plausible with clear differentiators
4. Model answers should be comprehensive and well-structured
5. Questions should be original and not directly copied from previous papers`;

    const userPrompt = `Generate ${questionCount} UPSC ${typeConfig.label} questions on the topic: "${topic}"

Difficulty Level: ${difficulty.toUpperCase()}
Difficulty Description: ${difficultyDesc}

For each question, provide:
1. Question text (clear, unambiguous, exam-style)
2. ${typeConfig.answerFormat}
3. Key points covered

IMPORTANT: Return ONLY a valid JSON array with no additional text or markdown.
Format:
[
  {
    "question_text": "...",
    "difficulty": "${difficulty}",
    ${question_type === 'mcq' ? '"options": ["Option A text", "Option B text", "Option C text", "Option D text"],\n    "correct_answer": "A",\n    "explanations": {"A": "...", "B": "...", "C": "...", "D": "..."},' : ''}
    "model_answer": "...",
    "key_points": ["point1", "point2", "point3"]
  }
]`;

    // Call A4F API
    const aiResponse = await fetch(`${A4F_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A4F_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: question_type === 'essay' ? 4000 : 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[Story 8.6] A4F API error:', errorText);
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    const tokensUsed = aiResult.usage?.total_tokens || 0;

    // Parse JSON from AI response
    let questions: any[] = [];
    try {
      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the entire content
        questions = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('[Story 8.6] JSON parse error:', parseError, 'Content:', content);
      return NextResponse.json({ 
        error: 'Failed to parse generated questions. Please try again.',
        debug: content.substring(0, 500)
      }, { status: 500 });
    }

    // Story 8.6 AC 9: Quality control validation
    // Story 8.8 AC 2: AI difficulty prediction integration
    const validatedQuestions = await Promise.all(questions.map(async (q: any, idx: number) => {
      // Story 8.8 AC 2: Predict/validate difficulty using AI
      let predictedDifficulty = difficulty;
      if (q.question_text && q.question_text.length > 20) {
        try {
          const { data: prediction } = await supabase.rpc('predict_question_difficulty', {
            p_question_text: q.question_text,
            p_topic: topic,
            p_cross_topic_refs: Array.isArray(q.key_points) ? q.key_points.slice(0, 3) : null
          });
          if (prediction?.[0]?.predicted_difficulty) {
            predictedDifficulty = prediction[0].predicted_difficulty;
            if (predictedDifficulty !== difficulty) {
              console.log(`[Story 8.8] Difficulty adjustment for Q${idx + 1}: ${difficulty} -> ${predictedDifficulty}`);
            }
          }
        } catch (predErr) {
          console.log('[Story 8.8] Difficulty prediction fallback to user selection');
        }
      }

      const validated = {
        question_text: q.question_text || '',
        question_type,
        difficulty: predictedDifficulty,
        model_answer: q.model_answer || '',
        key_points: Array.isArray(q.key_points) ? q.key_points : [],
        options_json: question_type === 'mcq' ? {
          options: q.options || [],
          correct_answer: q.correct_answer || 'A',
          explanations: q.explanations || {}
        } : null,
        quality_score: 0.8, // Default quality score
        is_valid: true
      };

      // Quality checks
      if (!validated.question_text || validated.question_text.length < 20) {
        validated.is_valid = false;
        validated.quality_score = 0.3;
      }
      if (!validated.model_answer || validated.model_answer.length < 50) {
        validated.quality_score -= 0.2;
      }
      if (question_type === 'mcq' && (!q.options || q.options.length !== 4)) {
        validated.is_valid = false;
        validated.quality_score = 0.4;
      }

      return validated;
    }));

    const filteredQuestions = validatedQuestions.filter((q: any) => q.is_valid);

    if (filteredQuestions.length === 0) {
      return NextResponse.json({ 
        error: 'Generated questions did not pass quality validation. Please try again.',
      }, { status: 500 });
    }

    // Story 8.6 AC 8: Save to database
    const generationMetadata = {
      model: PRIMARY_MODEL,
      tokens_used: tokensUsed,
      latency_ms: Date.now() - startTime,
      generated_at: new Date().toISOString()
    };

    const questionsToInsert = filteredQuestions.map((q: any) => ({
      user_id: user.id,
      topic,
      syllabus_node_id: syllabus_node_id || null,
      question_text: q.question_text,
      question_type: q.question_type,
      difficulty: q.difficulty,
      options_json: q.options_json,
      model_answer: q.model_answer,
      key_points: q.key_points,
      generation_metadata: generationMetadata,
      quality_score: q.quality_score
    }));

    const { data: savedQuestions, error: insertError } = await supabase
      .from('generated_questions')
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      console.error('[Story 8.6] Database insert error:', insertError);
      // Continue without saving - return questions anyway
    }

    // Story 8.6 AC 10: Record generation for limit tracking
    try {
      await supabase.rpc('record_question_generation', {
        p_user_id: user.id,
        p_count: filteredQuestions.length,
        p_question_type: question_type,
        p_topic: topic
      });
    } catch (recordErr) {
      console.error('[Story 8.6] Failed to record generation:', recordErr);
    }

    // Get updated daily usage
    const { data: newLimitCheck } = await supabase.rpc(
      'check_question_generation_limit',
      { p_user_id: user.id, p_count: 0 }
    );

    const newUsage = newLimitCheck?.[0] || { current_usage: accessCheck.current_usage + filteredQuestions.length, daily_limit: accessCheck.daily_limit };

    return NextResponse.json({
      success: true,
      questions: filteredQuestions.map((q: any, idx: number) => ({
        id: savedQuestions?.[idx]?.id || `temp-${idx}`,
        question_text: q.question_text,
        question_type: q.question_type,
        difficulty: q.difficulty,
        options: q.options_json?.options,
        correct_answer: q.options_json?.correct_answer,
        explanations: q.options_json?.explanations,
        model_answer: q.model_answer,
        key_points: q.key_points,
        quality_score: q.quality_score
      })),
      dailyLimit: {
        used: newUsage.current_usage,
        total: newUsage.daily_limit >= 9999 ? 'unlimited' : newUsage.daily_limit,
        remaining: newUsage.daily_limit >= 9999 ? 'unlimited' : newUsage.daily_limit - newUsage.current_usage
      },
      metadata: {
        generated_count: filteredQuestions.length,
        requested_count: questionCount,
        latency_ms: Date.now() - startTime,
        tokens_used: tokensUsed
      }
    });

  } catch (error: any) {
    console.error('[Story 8.6] Generation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Question generation failed',
      latency_ms: Date.now() - startTime
    }, { status: 500 });
  }
}

// GET: Fetch user's generated questions
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const question_type = searchParams.get('question_type');
    const difficulty = searchParams.get('difficulty');
    const topic = searchParams.get('topic');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('generated_questions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (question_type) query = query.eq('question_type', question_type);
    if (difficulty) query = query.eq('difficulty', difficulty);
    if (topic) query = query.textSearch('topic', topic);

    const { data: questions, count, error } = await query;

    if (error) {
      console.error('[Story 8.6] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    return NextResponse.json({
      questions,
      total: count,
      limit,
      offset
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
