// Story 8.8: Difficulty Tagging & Adaptive System API
// AC 2: AI difficulty prediction, AC 5: Adaptive recommendations, AC 9: Analytics

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const PRIMARY_MODEL = process.env.A4F_PRIMARY_MODEL || 'provider-3/llama-4-scout';

// AC 2: AI Difficulty Prediction
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'predict_difficulty':
        return await predictDifficulty(body, supabase);
      case 'get_recommendation':
        return await getAdaptiveRecommendation(body, supabase);
      case 'record_attempt':
        return await recordAttempt(body, supabase);
      case 'get_analytics':
        return await getAnalytics(body, supabase);
      case 'get_progress':
        return await getProgress(body, supabase);
      case 'get_badges':
        return await getBadges(body, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Story 8.8] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// AC 2: AI-powered difficulty prediction
async function predictDifficulty(
  body: { question_text: string; topic?: string; cross_topic_refs?: string[] },
  supabase: any
) {
  const { question_text, topic, cross_topic_refs } = body;

  if (!question_text) {
    return NextResponse.json({ error: 'question_text is required' }, { status: 400 });
  }

  // First, use database function for basic prediction
  const { data: dbPrediction, error: dbError } = await supabase.rpc('predict_question_difficulty', {
    p_question_text: question_text,
    p_topic: topic || null,
    p_cross_topic_refs: cross_topic_refs || null,
  });

  // Optionally enhance with AI for more accurate prediction
  let aiEnhanced = null;
  if (A4F_API_KEY) {
    try {
      const response = await fetch(`${A4F_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${A4F_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: PRIMARY_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are a UPSC exam difficulty analyzer. Analyze questions and predict their difficulty level.
Consider:
- Question complexity and depth required
- Cross-topic knowledge requirements
- Type of cognitive skills needed (recall vs analysis vs synthesis)
- Typical success rates for similar questions

Return JSON: { "difficulty": "easy|medium|hard", "confidence": 0.0-1.0, "factors": [...] }`
            },
            {
              role: 'user',
              content: `Analyze the difficulty of this UPSC question:

"${question_text}"

Topic: ${topic || 'General'}
Cross-topic references: ${cross_topic_refs?.join(', ') || 'None'}

Provide difficulty assessment in JSON format.`
            }
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (response.ok) {
        const aiResult = await response.json();
        const content = aiResult.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiEnhanced = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('[Story 8.8] AI parse error:', e);
        }
      }
    } catch (e) {
      console.error('[Story 8.8] AI prediction error:', e);
    }
  }

  // Combine predictions
  const finalDifficulty = aiEnhanced?.difficulty || dbPrediction?.[0]?.predicted_difficulty || 'medium';
  const confidence = aiEnhanced?.confidence || dbPrediction?.[0]?.complexity_score || 0.5;

  return NextResponse.json({
    difficulty: finalDifficulty,
    confidence,
    db_analysis: dbPrediction?.[0] || null,
    ai_analysis: aiEnhanced,
    source: aiEnhanced ? 'ai_enhanced' : 'rule_based',
  });
}

// AC 5: Get adaptive recommendation based on last 5 answers
async function getAdaptiveRecommendation(
  body: { user_id: string },
  supabase: any
) {
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_adaptive_recommendation', {
    p_user_id: user_id,
  });

  if (error) {
    console.error('[Story 8.8] Recommendation error:', error);
    return NextResponse.json({ error: 'Failed to get recommendation' }, { status: 500 });
  }

  const recommendation = data?.[0] || {
    recommended_difficulty: 'medium',
    current_streak: 0,
    last_5_correct: 0,
    reason: 'Start practicing to get personalized recommendations!',
    confidence: 0.5,
  };

  return NextResponse.json(recommendation);
}

// Record question attempt
async function recordAttempt(
  body: {
    user_id: string;
    question_id: string;
    question_type: 'pyq' | 'generated';
    is_correct: boolean;
    difficulty: string;
    time_taken_seconds?: number;
  },
  supabase: any
) {
  const { user_id, question_id, question_type, is_correct, difficulty, time_taken_seconds } = body;

  if (!user_id || !question_id || !question_type || is_correct === undefined || !difficulty) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('question_attempts')
    .insert({
      user_id,
      question_id,
      question_type,
      is_correct,
      difficulty_at_attempt: difficulty,
      time_taken_seconds: time_taken_seconds || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Story 8.8] Record attempt error:', error);
    return NextResponse.json({ error: 'Failed to record attempt' }, { status: 500 });
  }

  // Check for new badges (AC 10)
  const { data: newBadges } = await supabase.rpc('check_and_award_badges', {
    p_user_id: user_id,
  });

  // Get updated recommendation
  const { data: recommendation } = await supabase.rpc('get_adaptive_recommendation', {
    p_user_id: user_id,
  });

  return NextResponse.json({
    attempt_id: data.id,
    new_badges: newBadges || [],
    next_recommendation: recommendation?.[0] || null,
  });
}

// AC 9: Get detailed analytics
async function getAnalytics(
  body: { user_id: string; days?: number },
  supabase: any
) {
  const { user_id, days = 30 } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  // Get difficulty analytics
  const { data: difficultyStats, error: statsError } = await supabase.rpc('get_difficulty_analytics', {
    p_user_id: user_id,
    p_days: days,
  });

  if (statsError) {
    console.error('[Story 8.8] Analytics error:', statsError);
  }

  // Get daily trend data
  const { data: dailyAttempts } = await supabase
    .from('question_attempts')
    .select('created_at, is_correct, difficulty_at_attempt, time_taken_seconds')
    .eq('user_id', user_id)
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true });

  // Process daily data
  const dailyData: Record<string, { attempts: number; correct: number; time: number }> = {};
  (dailyAttempts || []).forEach((attempt: any) => {
    const date = new Date(attempt.created_at).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { attempts: 0, correct: 0, time: 0 };
    }
    dailyData[date].attempts++;
    if (attempt.is_correct) dailyData[date].correct++;
    dailyData[date].time += attempt.time_taken_seconds || 0;
  });

  const trend = Object.entries(dailyData).map(([date, data]) => ({
    date,
    accuracy: data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0,
    attempts: data.attempts,
    time_minutes: Math.round(data.time / 60),
  }));

  return NextResponse.json({
    by_difficulty: difficultyStats || [],
    daily_trend: trend,
    summary: {
      total_attempts: (dailyAttempts || []).length,
      total_correct: (dailyAttempts || []).filter((a: any) => a.is_correct).length,
      overall_accuracy: (dailyAttempts || []).length > 0
        ? Math.round(((dailyAttempts || []).filter((a: any) => a.is_correct).length / (dailyAttempts || []).length) * 100)
        : 0,
    },
  });
}

// AC 7: Get progress per difficulty level
async function getProgress(
  body: { user_id: string },
  supabase: any
) {
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_difficulty_progress', {
    p_user_id: user_id,
  });

  if (error) {
    console.error('[Story 8.8] Progress error:', error);
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
  }

  // Ensure all difficulty levels are represented
  const defaultLevels = ['easy', 'medium', 'hard'];
  const progressMap = new Map((data || []).map((d: any) => [d.difficulty, d]));
  
  const fullProgress = defaultLevels.map(level => 
    progressMap.get(level) || {
      difficulty: level,
      comfort_level: 'Not Started',
      accuracy: 0,
      questions_attempted: 0,
      questions_correct: 0,
      badge_progress: [],
    }
  );

  return NextResponse.json(fullProgress);
}

// AC 10: Get user badges
async function getBadges(
  body: { user_id: string },
  supabase: any
) {
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  // Get all badge definitions
  const { data: definitions } = await supabase
    .from('badge_definitions')
    .select('*')
    .order('requirement_count', { ascending: true });

  // Get user's earned badges
  const { data: earned } = await supabase
    .from('difficulty_badges')
    .select('badge_type, earned_at')
    .eq('user_id', user_id);

  const earnedSet = new Set((earned || []).map((b: any) => b.badge_type));
  const earnedMap = new Map((earned || []).map((b: any) => [b.badge_type, b.earned_at]));

  // Get user stats for progress calculation
  const { data: stats } = await supabase
    .from('user_difficulty_stats')
    .select('*')
    .eq('user_id', user_id);

  interface DifficultyStats {
    difficulty_level: string;
    correct_attempts: number;
    total_attempts: number;
    success_rate: number;
  }

  const statsMap = new Map<string, DifficultyStats>(
    (stats || []).map((s: DifficultyStats) => [s.difficulty_level, s])
  );

  const badges = (definitions || []).map((def: any) => {
    let current = 0;
    if (def.difficulty_level) {
      const diffStats = statsMap.get(def.difficulty_level);
      current = diffStats?.correct_attempts || 0;
    }

    return {
      ...def,
      earned: earnedSet.has(def.badge_type),
      earned_at: earnedMap.get(def.badge_type) || null,
      current,
      progress: Math.min(100, Math.round((current / def.requirement_count) * 100)),
    };
  });

  return NextResponse.json({
    earned: badges.filter((b: any) => b.earned),
    in_progress: badges.filter((b: any) => !b.earned && b.progress > 0),
    locked: badges.filter((b: any) => !b.earned && b.progress === 0),
  });
}

// GET: Fetch questions with difficulty filter (AC 8)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const difficulty = searchParams.get('difficulty');
    const question_type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const questions: any[] = [];

    // AC 8: Filter by difficulty
    if (question_type === 'all' || question_type === 'generated') {
      let query = supabase
        .from('generated_questions')
        .select('id, question_text, question_type, difficulty, topic, syllabus_topic_id, success_rate, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit / 2));

      if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
        query = query.eq('difficulty', difficulty);
      }

      const { data: generated } = await query;
      questions.push(...(generated || []).map((q: any) => ({ ...q, source: 'generated' })));
    }

    if (question_type === 'all' || question_type === 'pyq') {
      let query = supabase
        .from('pyq_questions')
        .select('id, question_text, question_type, difficulty, subject, paper, year, success_rate')
        .order('year', { ascending: false })
        .limit(Math.floor(limit / 2));

      if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
        query = query.eq('difficulty', difficulty);
      }

      const { data: pyqs } = await query;
      questions.push(...(pyqs || []).map((q: any) => ({ ...q, source: 'pyq' })));
    }

    // Shuffle questions for variety
    const shuffled = questions.sort(() => Math.random() - 0.5);

    return NextResponse.json({
      questions: shuffled.slice(0, limit),
      filters: { difficulty, question_type },
      total: shuffled.length,
    });
  } catch (error) {
    console.error('[Story 8.8] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
