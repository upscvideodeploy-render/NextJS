/**
 * Topic Difficulty Predictor API - Story 14.2
 * 
 * AC 1: Prediction model (PYQ 2010-2024)
 * AC 2: Difficulty scoring 1-10
 * AC 3: Weightage prediction
 * AC 4: Confidence score
 * AC 5: Difficulty heatmap
 * AC 6: Time recommendation
 * AC 7: Trend analysis
 * AC 8: Alerts for trending topics
 * AC 9: Export PDF report
 * AC 10: Weekly retraining
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const A4F_URL = process.env.A4F_API_URL || 'https://a4f.co/api';
const A4F_KEY = process.env.A4F_API_KEY || '';

// ============================================================================
// GET - Fetch predictions and analytics
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';

    switch (action) {
      case 'dashboard':
        return await getDashboard();
      case 'heatmap':
        return await getHeatmap(searchParams.get('subject'));
      case 'trending':
        return await getTrending();
      case 'topic':
        return await getTopicDetail(searchParams.get('id'));
      case 'trends':
        return await getTrendAnalysis(searchParams.get('subject'));
      case 'recommendations':
        return await getStudyRecommendations(user.id);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Predictor GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Actions
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'generate_report':
        return await generateReport(user.id, body);
      case 'refresh_predictions':
        return await refreshPredictions();
      case 'update_performance':
        return await updateUserPerformance(user.id, body);
      case 'ai_analysis':
        return await getAIAnalysis(body);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Predictor POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DASHBOARD - Overview of all predictions
// ============================================================================

async function getDashboard() {
  // Get all topics with predictions
  const { data: topics } = await supabase
    .from('upsc_topics')
    .select('*')
    .order('subject');

  // Get latest predictions
  const { data: predictions } = await supabase
    .from('topic_predictions')
    .select('*')
    .eq('prediction_date', new Date().toISOString().split('T')[0]);

  // Get trending topics
  const { data: trending } = await supabase.rpc('get_trending_topics', { p_limit: 5 });

  // Subject-wise summary
  const subjects = ['polity', 'history', 'geography', 'economics', 'science', 'environment', 'ethics'];
  const subjectSummary = subjects.map(subject => {
    const subjectTopics = topics?.filter(t => t.subject === subject) || [];
    const subjectPredictions = predictions?.filter(p => 
      subjectTopics.some(t => t.id === p.topic_id)
    ) || [];

    const avgDifficulty = subjectPredictions.length > 0
      ? subjectPredictions.reduce((sum, p) => sum + Number(p.difficulty_score), 0) / subjectPredictions.length
      : 5;

    return {
      subject,
      topicCount: subjectTopics.length,
      avgDifficulty: Math.round(avgDifficulty * 10) / 10,
      risingCount: subjectPredictions.filter(p => p.trend_direction === 'rising').length,
      totalStudyHours: subjectPredictions.reduce((sum, p) => sum + Number(p.time_recommendation_hours || 0), 0)
    };
  });

  return NextResponse.json({
    totalTopics: topics?.length || 0,
    trendingCount: trending?.length || 0,
    subjectSummary,
    trending: trending || [],
    lastUpdated: new Date().toISOString()
  });
}

// ============================================================================
// HEATMAP - Difficulty visualization (AC 5)
// ============================================================================

async function getHeatmap(subject: string | null) {
  const { data, error } = await supabase.rpc('get_difficulty_heatmap', {
    p_subject: subject || null
  });

  if (error) {
    console.error('Heatmap error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by subject for visualization
  const grouped: Record<string, any[]> = {};
  data?.forEach((item: any) => {
    if (!grouped[item.subject]) {
      grouped[item.subject] = [];
    }
    grouped[item.subject].push({
      id: item.topic_id,
      name: item.topic_name,
      paper: item.paper,
      difficulty: item.difficulty_score,
      colorIntensity: item.color_intensity
    });
  });

  return NextResponse.json({
    heatmapData: grouped,
    rawData: data || []
  });
}

// ============================================================================
// TRENDING - Topics with alerts (AC 8)
// ============================================================================

async function getTrending() {
  const { data, error } = await supabase.rpc('get_trending_topics', { p_limit: 20 });

  if (error) {
    console.error('Trending error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    trending: data || []
  });
}

// ============================================================================
// TOPIC DETAIL - Single topic prediction
// ============================================================================

async function getTopicDetail(topicId: string | null) {
  if (!topicId) {
    return NextResponse.json({ error: 'Topic ID required' }, { status: 400 });
  }

  // Get topic info
  const { data: topic } = await supabase
    .from('upsc_topics')
    .select('*')
    .eq('id', topicId)
    .single();

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  // Get prediction
  const { data: prediction } = await supabase
    .from('topic_predictions')
    .select('*')
    .eq('topic_id', topicId)
    .order('prediction_date', { ascending: false })
    .limit(1)
    .single();

  // Get PYQ history
  const { data: pyqHistory } = await supabase
    .from('pyq_history')
    .select('*')
    .eq('topic_id', topicId)
    .order('year', { ascending: false });

  // Calculate trend data
  const trendData = pyqHistory?.map(p => ({
    year: p.year,
    questions: p.question_count,
    difficulty: p.difficulty_observed
  })) || [];

  return NextResponse.json({
    topic,
    prediction: prediction || null,
    pyqHistory: trendData,
    recommendation: {
      studyHours: prediction?.time_recommendation_hours || 5,
      priority: prediction?.is_trending ? 'HIGH' : 
        prediction?.trend_direction === 'rising' ? 'MEDIUM' : 'NORMAL',
      suggestedResources: generateResourceSuggestions(topic.subject)
    }
  });
}

function generateResourceSuggestions(subject: string): string[] {
  const resources: Record<string, string[]> = {
    polity: ['Laxmikanth Indian Polity', 'Previous Year Questions', 'Current Affairs - Governance'],
    history: ['Spectrum Modern India', 'Tamil Nadu Board History', 'Art & Culture by Nitin Singhania'],
    geography: ['NCERT Geography', 'G C Leong Physical Geography', 'Oxford Atlas'],
    economics: ['Ramesh Singh Indian Economy', 'Economic Survey', 'Budget Analysis'],
    science: ['NCERT Science', 'The Hindu Science Section', 'PIB Science Articles'],
    environment: ['Shankar IAS Environment', 'Down to Earth Magazine', 'IPCC Reports'],
    ethics: ['Lexicon Ethics', 'Case Studies Practice', 'Ethics Integrity & Aptitude']
  };
  return resources[subject] || ['UPSC Study Material', 'Previous Year Questions'];
}

// ============================================================================
// TREND ANALYSIS (AC 7)
// ============================================================================

async function getTrendAnalysis(subject: string | null) {
  // Get all predictions with trends
  let query = supabase
    .from('topic_predictions')
    .select(`
      *,
      topic:upsc_topics(*)
    `)
    .eq('prediction_date', new Date().toISOString().split('T')[0]);

  if (subject) {
    // Filter by subject via topic join
    const { data: subjectTopics } = await supabase
      .from('upsc_topics')
      .select('id')
      .eq('subject', subject);
    
    const topicIds = subjectTopics?.map(t => t.id) || [];
    query = query.in('topic_id', topicIds);
  }

  const { data: predictions } = await query;

  // Group by trend direction
  const rising = predictions?.filter(p => p.trend_direction === 'rising') || [];
  const stable = predictions?.filter(p => p.trend_direction === 'stable') || [];
  const declining = predictions?.filter(p => p.trend_direction === 'declining') || [];

  // Calculate 5-year comparison
  const { data: recentPYQ } = await supabase
    .from('pyq_history')
    .select('*')
    .gte('year', 2020);

  const { data: olderPYQ } = await supabase
    .from('pyq_history')
    .select('*')
    .gte('year', 2015)
    .lt('year', 2020);

  const recentTotal = recentPYQ?.reduce((sum, p) => sum + p.question_count, 0) || 0;
  const olderTotal = olderPYQ?.reduce((sum, p) => sum + p.question_count, 0) || 0;
  const overallTrend = olderTotal > 0 ? ((recentTotal - olderTotal) / olderTotal * 100) : 0;

  return NextResponse.json({
    summary: {
      rising: rising.length,
      stable: stable.length,
      declining: declining.length,
      overallTrendPercent: Math.round(overallTrend)
    },
    risingTopics: rising.slice(0, 10).map(p => ({
      topicId: p.topic_id,
      topicName: (p as any).topic?.name,
      subject: (p as any).topic?.subject,
      difficulty: p.difficulty_score,
      change: p.year_over_year_change
    })),
    decliningTopics: declining.slice(0, 10).map(p => ({
      topicId: p.topic_id,
      topicName: (p as any).topic?.name,
      subject: (p as any).topic?.subject,
      difficulty: p.difficulty_score,
      change: p.year_over_year_change
    }))
  });
}

// ============================================================================
// STUDY RECOMMENDATIONS (AC 6)
// ============================================================================

async function getStudyRecommendations(userId: string) {
  // Get user's performance data
  const { data: userPerf } = await supabase
    .from('topic_user_performance')
    .select('*, topic:upsc_topics(*)')
    .eq('user_id', userId);

  // Get all predictions
  const { data: predictions } = await supabase
    .from('topic_predictions')
    .select('*, topic:upsc_topics(*)')
    .eq('prediction_date', new Date().toISOString().split('T')[0])
    .order('time_recommendation_hours', { ascending: false });

  // Calculate personalized recommendations
  const perfMap = new Map(userPerf?.map(p => [p.topic_id, p]) || []);

  const recommendations = predictions?.map(pred => {
    const perf = perfMap.get(pred.topic_id);
    const proficiency = perf?.proficiency_level || 'beginner';
    
    // Adjust time based on user proficiency
    const timeMultiplier = proficiency === 'mastered' ? 0.3 :
                          proficiency === 'advanced' ? 0.5 :
                          proficiency === 'intermediate' ? 0.8 : 1.0;
    
    const adjustedHours = Number(pred.time_recommendation_hours) * timeMultiplier;
    
    return {
      topicId: pred.topic_id,
      topicName: (pred as any).topic?.name,
      subject: (pred as any).topic?.subject,
      difficulty: pred.difficulty_score,
      baseHours: pred.time_recommendation_hours,
      adjustedHours: Math.round(adjustedHours * 10) / 10,
      proficiency,
      priority: pred.is_trending ? 'HIGH' :
               pred.trend_direction === 'rising' ? 'MEDIUM' : 'NORMAL',
      isTrending: pred.is_trending
    };
  }).sort((a, b) => {
    // Sort by priority then hours
    const priorityOrder = { HIGH: 0, MEDIUM: 1, NORMAL: 2 };
    if (priorityOrder[a.priority as keyof typeof priorityOrder] !== priorityOrder[b.priority as keyof typeof priorityOrder]) {
      return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
    }
    return b.adjustedHours - a.adjustedHours;
  });

  // Calculate total study time
  const totalHours = recommendations?.reduce((sum, r) => sum + r.adjustedHours, 0) || 0;

  return NextResponse.json({
    recommendations: recommendations?.slice(0, 20) || [],
    totalTopics: recommendations?.length || 0,
    totalStudyHours: Math.round(totalHours),
    averageHoursPerTopic: recommendations?.length 
      ? Math.round(totalHours / recommendations.length * 10) / 10 
      : 0
  });
}

// ============================================================================
// GENERATE REPORT (AC 9: PDF Export)
// ============================================================================

async function generateReport(userId: string, body: any) {
  const { reportType, subject, paper } = body;

  // Create report record
  const { data: report, error } = await supabase
    .from('prediction_reports')
    .insert({
      user_id: userId,
      report_type: reportType || 'full',
      filter_criteria: { subject, paper },
      status: 'generating'
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate report content
  const { data: predictions } = await supabase
    .from('topic_predictions')
    .select('*, topic:upsc_topics(*)')
    .eq('prediction_date', new Date().toISOString().split('T')[0]);

  let filteredPredictions = predictions || [];
  if (subject) {
    filteredPredictions = filteredPredictions.filter(p => (p as any).topic?.subject === subject);
  }
  if (paper) {
    filteredPredictions = filteredPredictions.filter(p => (p as any).topic?.paper === paper);
  }

  // Generate report content (in production, this would create a PDF)
  const reportContent = {
    title: 'UPSC Topic Difficulty Prediction Report',
    generatedAt: new Date().toISOString(),
    filters: { subject, paper, reportType },
    summary: {
      totalTopics: filteredPredictions.length,
      avgDifficulty: filteredPredictions.reduce((sum, p) => sum + Number(p.difficulty_score), 0) / filteredPredictions.length || 0,
      totalStudyHours: filteredPredictions.reduce((sum, p) => sum + Number(p.time_recommendation_hours || 0), 0),
      trendingTopics: filteredPredictions.filter(p => p.is_trending).length
    },
    predictions: filteredPredictions.map(p => ({
      topic: (p as any).topic?.name,
      subject: (p as any).topic?.subject,
      paper: (p as any).topic?.paper,
      difficulty: p.difficulty_score,
      weightage: p.weightage_prediction,
      confidence: p.confidence_score,
      studyHours: p.time_recommendation_hours,
      trend: p.trend_direction,
      isTrending: p.is_trending
    }))
  };

  // Update report status (in production, would generate PDF URL)
  await supabase
    .from('prediction_reports')
    .update({
      status: 'ready',
      // pdf_url would be set to actual PDF storage URL
    })
    .eq('id', report.id);

  return NextResponse.json({
    reportId: report.id,
    content: reportContent,
    message: 'Report generated successfully'
  });
}

// ============================================================================
// REFRESH PREDICTIONS (AC 10: Weekly retrain)
// ============================================================================

async function refreshPredictions() {
  const { data, error } = await supabase.rpc('generate_all_predictions');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log model training
  await supabase
    .from('prediction_model_history')
    .insert({
      model_version: '1.0',
      training_data_start: '2010-01-01',
      training_data_end: new Date().toISOString().split('T')[0],
      topics_count: data,
      notes: 'Weekly refresh triggered'
    });

  return NextResponse.json({
    success: true,
    topicsUpdated: data,
    message: 'Predictions refreshed successfully'
  });
}

// ============================================================================
// UPDATE USER PERFORMANCE
// ============================================================================

async function updateUserPerformance(userId: string, body: any) {
  const { topic_id, questions_attempted, questions_correct, time_seconds } = body;

  if (!topic_id) {
    return NextResponse.json({ error: 'Topic ID required' }, { status: 400 });
  }

  // Calculate proficiency level
  const accuracy = questions_attempted > 0 ? questions_correct / questions_attempted : 0;
  let proficiency = 'beginner';
  if (accuracy >= 0.9 && questions_attempted >= 20) proficiency = 'mastered';
  else if (accuracy >= 0.75 && questions_attempted >= 10) proficiency = 'advanced';
  else if (accuracy >= 0.5 && questions_attempted >= 5) proficiency = 'intermediate';

  const { data, error } = await supabase
    .from('topic_user_performance')
    .upsert({
      topic_id,
      user_id: userId,
      questions_attempted,
      questions_correct,
      average_time_seconds: time_seconds,
      proficiency_level: proficiency,
      last_attempt_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    }, { onConflict: 'topic_id,user_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    performance: data
  });
}

// ============================================================================
// AI ANALYSIS - Enhanced predictions using LLM
// ============================================================================

async function getAIAnalysis(body: any) {
  const { topic_id, context } = body;

  // Get topic and prediction data
  const { data: topic } = await supabase
    .from('upsc_topics')
    .select('*')
    .eq('id', topic_id)
    .single();

  const { data: prediction } = await supabase
    .from('topic_predictions')
    .select('*')
    .eq('topic_id', topic_id)
    .order('prediction_date', { ascending: false })
    .limit(1)
    .single();

  const { data: pyqHistory } = await supabase
    .from('pyq_history')
    .select('*')
    .eq('topic_id', topic_id)
    .order('year', { ascending: false })
    .limit(10);

  // Generate AI analysis
  const aiPrompt = `
You are a UPSC exam preparation expert. Analyze this topic and provide strategic advice.

Topic: ${topic?.name}
Subject: ${topic?.subject}
Paper: ${topic?.paper}

Historical PYQ Data (last 10 years):
${pyqHistory?.map(p => `${p.year}: ${p.question_count} questions, difficulty ${p.difficulty_observed}`).join('\n')}

Current Prediction:
- Difficulty Score: ${prediction?.difficulty_score}/10
- Weightage: ${prediction?.weightage_prediction}%
- Trend: ${prediction?.trend_direction}
- Recommended Study Hours: ${prediction?.time_recommendation_hours}

Provide:
1. Strategic importance of this topic
2. Key areas to focus on
3. Predicted question types for next exam
4. Study tips and approach
5. Related current affairs to watch

Keep response under 500 words.
`;

  try {
    const aiResponse = await fetch(`${A4F_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${A4F_KEY}`
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: 'You are a UPSC preparation expert.' },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 1000
      })
    });

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || 'Analysis not available';

    return NextResponse.json({
      topic: topic?.name,
      prediction,
      aiAnalysis: analysis
    });
  } catch (error) {
    console.error('AI Analysis error:', error);
    return NextResponse.json({
      topic: topic?.name,
      prediction,
      aiAnalysis: 'AI analysis temporarily unavailable. Please try again later.'
    });
  }
}
