// Story 8.10: Question Bank Analytics & Insights API
// AC 1-10: Comprehensive analytics with AI insights

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const PRIMARY_MODEL = process.env.A4F_PRIMARY_MODEL || 'provider-3/llama-4-scout';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
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

    const body = await request.json();
    const { action, days = 30 } = body;

    switch (action) {
      case 'get_complete':
        return await getCompleteAnalytics(user.id, days, supabase);
      case 'get_subjects':
        return await getSubjectAnalytics(user.id, days, supabase);
      case 'get_time':
        return await getTimeAnalysis(user.id, days, supabase);
      case 'get_topics':
        return await getTopicAnalysis(user.id, supabase);
      case 'get_pyq':
        return await getPYQCoverage(user.id, supabase);
      case 'get_insights':
        return await getAIInsights(user.id, supabase);
      case 'generate_ai_recommendations':
        return await generateAIRecommendations(user.id, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Story 8.10] Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// AC 1-10: Get complete analytics in one call
async function getCompleteAnalytics(userId: string, days: number, supabase: any) {
  try {
    const { data, error } = await supabase.rpc('get_complete_analytics', {
      p_user_id: userId,
      p_days: days,
    });

    if (error) {
      console.error('[Story 8.10] Complete analytics error:', error);
      // Fallback to individual queries
      return await getAnalyticsFallback(userId, days, supabase);
    }

    const analytics = data?.[0] || {};

    // Generate AI recommendations if we have data
    let aiRecommendations: string[] = [];
    if (analytics.ai_insights) {
      aiRecommendations = (analytics.ai_insights || [])
        .map((i: any) => i.data?.message)
        .filter(Boolean);
    }

    return NextResponse.json({
      overall: analytics.overall_stats || {},
      subjects: analytics.subject_breakdown || [],
      difficulty: analytics.difficulty_breakdown || [],
      time: analytics.time_analysis || {},
      topics: analytics.topic_analysis || {},
      pyq: analytics.pyq_coverage || {},
      trend: analytics.daily_trend || [],
      insights: analytics.ai_insights || [],
      recommendations: aiRecommendations,
    });
  } catch (e) {
    console.error('[Story 8.10] Analytics error:', e);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

// Fallback for when RPC isn't available
async function getAnalyticsFallback(userId: string, days: number, supabase: any) {
  // Get attempts directly
  const { data: attempts } = await supabase
    .from('question_attempts')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

  const total = attempts?.length || 0;
  const correct = attempts?.filter((a: any) => a.is_correct).length || 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgTime = total > 0 
    ? Math.round(attempts.reduce((sum: number, a: any) => sum + (a.time_taken_seconds || 0), 0) / total)
    : 0;

  // Difficulty breakdown
  const difficultyMap: Record<string, { total: number; correct: number }> = {
    easy: { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    hard: { total: 0, correct: 0 },
  };
  attempts?.forEach((a: any) => {
    const diff = a.difficulty_at_attempt || 'medium';
    if (difficultyMap[diff]) {
      difficultyMap[diff].total++;
      if (a.is_correct) difficultyMap[diff].correct++;
    }
  });

  const difficulty = Object.entries(difficultyMap).map(([level, stats]) => ({
    difficulty: level,
    attempts: stats.total,
    correct: stats.correct,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
  }));

  // Time analysis
  const isRushing = avgTime < 60;
  const isTooSlow = avgTime > 180;

  return NextResponse.json({
    overall: { total_attempts: total, correct_attempts: correct, accuracy, avg_time: avgTime },
    subjects: [],
    difficulty,
    time: {
      avg_time: avgTime,
      is_rushing: isRushing,
      is_too_slow: isTooSlow,
      status: isRushing ? 'rushing' : isTooSlow ? 'too_slow' : 'optimal',
      recommendation: isRushing
        ? "You're answering too quickly. Take more time to read carefully."
        : isTooSlow
        ? "You're taking too long. Practice more to improve speed."
        : 'Your timing is good!',
    },
    topics: { weak: [], strong: [] },
    pyq: { total: 0, attempted: 0, percent: 0 },
    trend: [],
    insights: [],
    recommendations: [],
  });
}

// AC 3: Subject-wise breakdown
async function getSubjectAnalytics(userId: string, days: number, supabase: any) {
  const { data, error } = await supabase.rpc('get_subject_analytics', {
    p_user_id: userId,
    p_days: days,
  });

  if (error) {
    console.error('[Story 8.10] Subject analytics error:', error);
    return NextResponse.json({ subjects: [] });
  }

  return NextResponse.json({ subjects: data || [] });
}

// AC 5: Time analysis
async function getTimeAnalysis(userId: string, days: number, supabase: any) {
  const { data, error } = await supabase.rpc('get_time_analysis', {
    p_user_id: userId,
    p_days: days,
  });

  if (error) {
    console.error('[Story 8.10] Time analysis error:', error);
    return NextResponse.json({ time: {} });
  }

  return NextResponse.json({ time: data?.[0] || {} });
}

// AC 7, AC 8: Topic analysis
async function getTopicAnalysis(userId: string, supabase: any) {
  const { data, error } = await supabase.rpc('get_topic_analysis', {
    p_user_id: userId,
    p_min_attempts: 3,
  });

  if (error) {
    console.error('[Story 8.10] Topic analysis error:', error);
    return NextResponse.json({ topics: { weak: [], strong: [] } });
  }

  return NextResponse.json({ topics: data?.[0] || { weak_topics: [], strong_topics: [] } });
}

// AC 9: PYQ coverage
async function getPYQCoverage(userId: string, supabase: any) {
  const { data, error } = await supabase.rpc('get_pyq_coverage', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[Story 8.10] PYQ coverage error:', error);
    return NextResponse.json({ pyq: {} });
  }

  return NextResponse.json({ pyq: data?.[0] || {} });
}

// AC 10: Get AI insights from database
async function getAIInsights(userId: string, supabase: any) {
  const { data, error } = await supabase.rpc('get_ai_insights_data', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[Story 8.10] AI insights error:', error);
    return NextResponse.json({ insights: [] });
  }

  return NextResponse.json({ insights: data || [] });
}

// AC 10: Generate AI-powered personalized recommendations
async function generateAIRecommendations(userId: string, supabase: any) {
  // Get user's analytics data
  const { data: analyticsData } = await supabase.rpc('get_complete_analytics', {
    p_user_id: userId,
    p_days: 30,
  });

  const analytics = analyticsData?.[0] || {};

  // If no A4F API key, use rule-based recommendations
  if (!A4F_API_KEY) {
    const recommendations = generateRuleBasedRecommendations(analytics);
    return NextResponse.json({ recommendations, source: 'rule_based' });
  }

  // Generate AI recommendations
  try {
    const prompt = buildAnalyticsPrompt(analytics);
    
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
            content: `You are a UPSC preparation coach analyzing student performance data. 
Provide 3-5 specific, actionable recommendations based on the analytics. 
Be encouraging but honest. Focus on:
1. Weak areas that need immediate attention
2. Strong areas to maintain or advance
3. Study habits (timing, consistency)
4. PYQ coverage strategy
Keep each recommendation under 50 words. Return as JSON array of strings.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API failed');
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    // Parse AI response
    let recommendations: string[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        // Split by newlines if not JSON
        recommendations = content.split('\n').filter((l: string) => l.trim().length > 10);
      }
    } catch (e) {
      recommendations = generateRuleBasedRecommendations(analytics);
    }

    return NextResponse.json({ recommendations, source: 'ai' });
  } catch (e) {
    console.error('[Story 8.10] AI recommendation error:', e);
    const recommendations = generateRuleBasedRecommendations(analytics);
    return NextResponse.json({ recommendations, source: 'rule_based_fallback' });
  }
}

function buildAnalyticsPrompt(analytics: any): string {
  const overall = analytics.overall_stats || {};
  const subjects = analytics.subject_breakdown || [];
  const time = analytics.time_analysis || {};
  const topics = analytics.topic_analysis || {};
  const pyq = analytics.pyq_coverage || {};

  return `
Student Performance Analytics (Last 30 Days):

OVERALL:
- Total Questions: ${overall.total_attempts || 0}
- Accuracy: ${overall.accuracy || 0}%
- Average Time per Question: ${overall.avg_time || 0} seconds

SUBJECTS (accuracy):
${subjects.map((s: any) => `- ${s.subject}: ${s.accuracy}% (${s.attempts} questions)`).join('\n') || 'No subject data'}

TIME ANALYSIS:
- Status: ${time.status || 'unknown'}
- Is Rushing (<60s): ${time.is_rushing || false}
- Is Too Slow (>3min): ${time.is_too_slow || false}

WEAK TOPICS (<50% accuracy):
${JSON.stringify(topics.weak || [])}

STRONG TOPICS (>80% accuracy):
${JSON.stringify(topics.strong || [])}

PYQ COVERAGE:
- Total PYQs in Bank: ${pyq.total || 0}
- Attempted: ${pyq.attempted || 0} (${pyq.percent || 0}%)

Provide personalized recommendations for this UPSC aspirant.`;
}

function generateRuleBasedRecommendations(analytics: any): string[] {
  const recommendations: string[] = [];
  const overall = analytics.overall_stats || {};
  const time = analytics.time_analysis || {};
  const topics = analytics.topic_analysis || {};
  const pyq = analytics.pyq_coverage || {};
  const subjects = analytics.subject_breakdown || [];

  // Accuracy-based
  if (overall.accuracy < 50) {
    recommendations.push(
      "Your overall accuracy is below 50%. Focus on understanding concepts before attempting more questions. Review the explanations for incorrect answers."
    );
  } else if (overall.accuracy > 80) {
    recommendations.push(
      "Excellent accuracy! Consider moving to harder questions or less familiar topics to push your limits."
    );
  }

  // Time-based
  if (time.is_rushing) {
    recommendations.push(
      "You're answering questions too quickly (avg <60s). Take more time to read questions carefully and consider all options."
    );
  } else if (time.is_too_slow) {
    recommendations.push(
      "You're taking too long per question (avg >3min). Practice with timed sessions to improve speed."
    );
  }

  // Weak topics
  const weakTopics = topics.weak_topics || topics.weak || [];
  if (weakTopics.length > 0) {
    const topic = weakTopics[0]?.topic || weakTopics[0];
    recommendations.push(
      `Focus on ${topic} - it's currently a weak area. Practice 10-20 MCQs on this topic this week.`
    );
  }

  // Strong topics
  const strongTopics = topics.strong_topics || topics.strong || [];
  if (strongTopics.length > 0) {
    const topic = strongTopics[0]?.topic || strongTopics[0];
    recommendations.push(
      `You're doing well in ${topic}! Challenge yourself with harder questions or explore related advanced topics.`
    );
  }

  // PYQ coverage
  if (pyq.percent < 20) {
    recommendations.push(
      "Increase your PYQ practice! Previous year questions are essential for UPSC. Start with the most recent 5 years."
    );
  }

  // Subject diversity
  if (subjects.length < 3) {
    recommendations.push(
      "Diversify your practice across more subjects. UPSC tests knowledge across many areas."
    );
  }

  // Default if no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      "Keep up the consistent practice! Set daily goals and track your progress regularly."
    );
  }

  return recommendations.slice(0, 5);
}

// GET: Quick stats endpoint
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
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

    // Quick stats
    const { data: attempts } = await supabase
      .from('question_attempts')
      .select('is_correct, time_taken_seconds, created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const total = attempts?.length || 0;
    const correct = attempts?.filter((a: any) => a.is_correct).length || 0;

    return NextResponse.json({
      total_attempts: total,
      correct: correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      days_active: new Set(attempts?.map((a: any) => 
        new Date(a.created_at).toDateString()
      )).size,
    });
  } catch (error) {
    console.error('[Story 8.10] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
