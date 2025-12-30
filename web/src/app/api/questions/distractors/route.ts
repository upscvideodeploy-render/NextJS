// Story 8.7: MCQ Distractor Generation API
// AC 1-10: Generate, validate, shuffle, and manage MCQ distractors

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY;
const PRIMARY_MODEL = 'provider-3/llama-4-scout';

// AC 3: Common mistake categories for UPSC MCQs
const COMMON_MISTAKE_PATTERNS = [
  'confusing_similar_articles', // Constitutional articles
  'wrong_year_event',          // Historical dates
  'incorrect_author',          // Committee/Commission heads
  'partial_definition',        // Incomplete concepts
  'reversed_relationship',     // Cause-effect confusion
  'scope_error',               // Part vs whole
  'geographical_confusion',    // Location mix-ups
  'numerical_error',           // Wrong statistics/numbers
];

// AC 5: Validation patterns for obviously wrong options
const INVALID_PATTERNS = [
  /\d{5,}/,                    // Very long numbers
  /^(None|All|Both|Neither)$/i, // Generic options
  /impossible|never|always/i,   // Absolute statements
];

// Shuffle array using Fisher-Yates algorithm (AC 6)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Generate shuffled option mapping (AC 6)
function createShuffledMapping(options: string[], correctIndex: number): {
  shuffledOptions: string[];
  newCorrectLetter: string;
  mapping: Record<string, string>;
} {
  const indices = [0, 1, 2, 3];
  const shuffledIndices = shuffleArray(indices);
  
  const shuffledOptions = shuffledIndices.map(i => options[i]);
  const newCorrectIndex = shuffledIndices.indexOf(correctIndex);
  const newCorrectLetter = String.fromCharCode(65 + newCorrectIndex);
  
  const mapping: Record<string, string> = {};
  shuffledIndices.forEach((originalIdx, newIdx) => {
    mapping[String.fromCharCode(65 + originalIdx)] = String.fromCharCode(65 + newIdx);
  });
  
  return { shuffledOptions, newCorrectLetter, mapping };
}

// Validate distractor quality (AC 2, AC 5)
function validateDistractor(distractor: string, correctAnswer: string, otherOptions: string[]): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for obviously wrong patterns
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(distractor)) {
      issues.push('Contains obviously wrong pattern');
    }
  }
  
  // Check for duplicates
  if (distractor.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
    issues.push('Matches correct answer');
  }
  
  for (const other of otherOptions) {
    if (distractor.toLowerCase().trim() === other.toLowerCase().trim()) {
      issues.push('Duplicate option');
    }
  }
  
  // Check minimum length
  if (distractor.length < 5) {
    issues.push('Too short');
  }
  
  // Check maximum length
  if (distractor.length > 500) {
    issues.push('Too long');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// POST: Generate distractors for a question (AC 1, AC 4)
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
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

    const { 
      question_text, 
      correct_answer, 
      topic, 
      difficulty,
      question_id,
      question_source = 'generated',
      regenerate_specific  // Optional: regenerate only specific distractor (A/B/C/D)
    } = await req.json();

    if (!question_text || !correct_answer) {
      return NextResponse.json({ 
        error: 'Missing required fields: question_text, correct_answer' 
      }, { status: 400 });
    }

    // AC 3, AC 4: Build AI prompt for distractor generation
    const distractorPrompt = `You are an expert UPSC question setter. Generate 3 plausible but INCORRECT options (distractors) for this MCQ question.

QUESTION: ${question_text}

CORRECT ANSWER: ${correct_answer}

TOPIC: ${topic || 'General UPSC'}
DIFFICULTY: ${difficulty || 'medium'}

REQUIREMENTS:
1. Each distractor must be FACTUALLY INCORRECT but conceptually related
2. Include common misconceptions and exam pattern mistakes
3. Use these distractor types:
   - PARTIAL_TRUTH: Contains some correct elements but wrong overall
   - RELATED_CONCEPT: From same topic but incorrect application
   - COMMON_MISTAKE: Based on typical student errors
   - FACTUAL_ERROR: Wrong facts, dates, names, or numbers

4. For each distractor, explain why it's wrong in 2-3 sentences

IMPORTANT: Return ONLY valid JSON with no additional text.

Format:
{
  "distractors": [
    {
      "text": "Option B text",
      "type": "partial_truth|related_concept|common_mistake|factual_error",
      "explanation": "2-3 sentence explanation of why this is incorrect"
    },
    {
      "text": "Option C text", 
      "type": "...",
      "explanation": "..."
    },
    {
      "text": "Option D text",
      "type": "...", 
      "explanation": "..."
    }
  ]
}`;

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
          { role: 'user', content: distractorPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      console.error('[Story 8.7] A4F API error:', await aiResponse.text());
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    const tokensUsed = aiResult.usage?.total_tokens || 0;

    // Parse AI response
    let distractorData: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        distractorData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[Story 8.7] JSON parse error:', parseError);
      return NextResponse.json({ 
        error: 'Failed to parse generated distractors',
        debug: content.substring(0, 500)
      }, { status: 500 });
    }

    // AC 5: Validate each distractor
    const validatedDistractors: any[] = [];
    const allOptions: string[] = [correct_answer];
    
    for (const distractor of distractorData.distractors || []) {
      const validation = validateDistractor(distractor.text, correct_answer, allOptions);
      
      if (validation.isValid) {
        validatedDistractors.push({
          text: distractor.text,
          type: distractor.type || 'related_concept',
          explanation: distractor.explanation || '',
          is_valid: true
        });
        allOptions.push(distractor.text);
      } else {
        console.warn('[Story 8.7] Invalid distractor:', distractor.text, validation.issues);
      }
    }

    // Ensure we have exactly 3 distractors
    if (validatedDistractors.length < 3) {
      // Regenerate if we don't have enough valid distractors
      return NextResponse.json({ 
        error: 'Could not generate enough valid distractors. Please try again.',
        generated_count: validatedDistractors.length
      }, { status: 500 });
    }

    // Build complete options array
    const allOptionsWithCorrect = [
      { letter: 'A', text: correct_answer, is_correct: true, explanation: 'This is the correct answer.', type: null },
      { letter: 'B', text: validatedDistractors[0].text, is_correct: false, explanation: validatedDistractors[0].explanation, type: validatedDistractors[0].type },
      { letter: 'C', text: validatedDistractors[1].text, is_correct: false, explanation: validatedDistractors[1].explanation, type: validatedDistractors[1].type },
      { letter: 'D', text: validatedDistractors[2].text, is_correct: false, explanation: validatedDistractors[2].explanation, type: validatedDistractors[2].type },
    ];

    // AC 6: Shuffle options
    const shuffled = createShuffledMapping(
      allOptionsWithCorrect.map(o => o.text),
      0 // Correct answer is at index 0
    );

    const shuffledOptionsWithMeta = shuffled.shuffledOptions.map((text, idx) => {
      const original = allOptionsWithCorrect.find(o => o.text === text)!;
      return {
        letter: String.fromCharCode(65 + idx),
        text,
        is_correct: original.is_correct,
        explanation: original.explanation,
        distractor_type: original.type
      };
    });

    // AC 8: Save to database if question_id provided
    if (question_id) {
      // Delete existing options for this question
      await supabase
        .from('question_options')
        .delete()
        .eq('question_id', question_id)
        .eq('question_source', question_source);

      // Insert new options
      const optionsToInsert = shuffledOptionsWithMeta.map(opt => ({
        question_id,
        question_source,
        option_letter: opt.letter,
        option_text: opt.text,
        is_correct: opt.is_correct,
        explanation: opt.explanation,
        distractor_type: opt.distractor_type,
        generation_metadata: {
          model: PRIMARY_MODEL,
          tokens_used: tokensUsed,
          generated_at: new Date().toISOString()
        }
      }));

      const { error: insertError } = await supabase
        .from('question_options')
        .insert(optionsToInsert);

      if (insertError) {
        console.error('[Story 8.7] Database insert error:', insertError);
      }
    }

    return NextResponse.json({
      success: true,
      options: shuffledOptionsWithMeta,
      correct_answer: shuffled.newCorrectLetter,
      metadata: {
        latency_ms: Date.now() - startTime,
        tokens_used: tokensUsed,
        shuffled: true
      }
    });

  } catch (error: any) {
    console.error('[Story 8.7] Distractor generation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Distractor generation failed' 
    }, { status: 500 });
  }
}

// GET: Get shuffled options for a question (AC 6)
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

    const { searchParams } = new URL(req.url);
    const question_id = searchParams.get('question_id');
    const question_source = searchParams.get('source') || 'generated';
    const shuffle = searchParams.get('shuffle') !== 'false';

    if (!question_id) {
      return NextResponse.json({ error: 'question_id required' }, { status: 400 });
    }

    // Fetch options from database
    const { data: options, error } = await supabase
      .from('question_options')
      .select('option_letter, option_text, is_correct, explanation, distractor_type, quality_score')
      .eq('question_id', question_id)
      .eq('question_source', question_source)
      .order('option_letter');

    if (error) {
      console.error('[Story 8.7] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 });
    }

    if (!options || options.length === 0) {
      return NextResponse.json({ error: 'No options found for this question' }, { status: 404 });
    }

    let responseOptions = options.map(o => ({
      letter: o.option_letter,
      text: o.option_text,
      quality_score: o.quality_score
    }));

    let correctLetter = options.find(o => o.is_correct)?.option_letter || 'A';
    let shuffleOrder: string[] | null = null;

    // AC 6: Shuffle if requested
    if (shuffle) {
      const optionTexts = options.map(o => o.option_text);
      const correctIndex = options.findIndex(o => o.is_correct);
      const shuffled = createShuffledMapping(optionTexts, correctIndex);
      
      responseOptions = shuffled.shuffledOptions.map((text, idx) => ({
        letter: String.fromCharCode(65 + idx),
        text,
        quality_score: options.find(o => o.option_text === text)?.quality_score
      }));
      
      correctLetter = shuffled.newCorrectLetter;
      shuffleOrder = shuffled.shuffledOptions.map((_, idx) => String.fromCharCode(65 + idx));
    }

    return NextResponse.json({
      options: responseOptions,
      // Note: Don't send correct_answer to client during practice!
      // Only send it after user submits their answer
      shuffle_order: shuffleOrder,
      question_id,
      question_source
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Record attempt and update quality (AC 9)
export async function PATCH(req: NextRequest) {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      question_id, 
      question_source = 'generated',
      selected_option, 
      time_taken_seconds,
      shuffled_order 
    } = await req.json();

    if (!question_id || !selected_option) {
      return NextResponse.json({ 
        error: 'Missing required fields: question_id, selected_option' 
      }, { status: 400 });
    }

    // Get correct answer
    const { data: correctOption } = await supabase
      .from('question_options')
      .select('option_letter, option_text, explanation')
      .eq('question_id', question_id)
      .eq('question_source', question_source)
      .eq('is_correct', true)
      .single();

    const isCorrect = correctOption?.option_letter === selected_option;

    // Record attempt using RPC
    try {
      await supabase.rpc('record_question_attempt', {
        p_user_id: user.id,
        p_question_id: question_id,
        p_source: question_source,
        p_selected_option: selected_option,
        p_is_correct: isCorrect,
        p_time_taken: time_taken_seconds || null,
        p_shuffled_order: shuffled_order || null
      });
    } catch (rpcErr) {
      console.error('[Story 8.7] Record attempt error:', rpcErr);
    }

    // Get all options with explanations for feedback
    const { data: allOptions } = await supabase
      .from('question_options')
      .select('option_letter, option_text, is_correct, explanation, distractor_type')
      .eq('question_id', question_id)
      .eq('question_source', question_source)
      .order('option_letter');

    return NextResponse.json({
      is_correct: isCorrect,
      correct_answer: correctOption?.option_letter,
      correct_text: correctOption?.option_text,
      explanation: correctOption?.explanation,
      all_options: allOptions?.map(o => ({
        letter: o.option_letter,
        text: o.option_text,
        is_correct: o.is_correct,
        explanation: o.explanation,
        distractor_type: o.distractor_type
      }))
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
