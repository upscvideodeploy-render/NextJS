// Story 8.9: Practice Session API
// AC 1-10: Complete practice session management

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { action } = body;

    switch (action) {
      case 'start':
        return await startSession(body, user.id, supabase);
      case 'pause':
        return await pauseSession(body, user.id, supabase);
      case 'resume':
        return await resumeSession(body, user.id, supabase);
      case 'save_progress':
        return await saveProgress(body, user.id, supabase);
      case 'complete':
        return await completeSession(body, user.id, supabase);
      case 'get_paused':
        return await getPausedSessions(user.id, supabase);
      case 'get_history':
        return await getSessionHistory(body, user.id, supabase);
      case 'get_questions':
        return await getSessionQuestions(body, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Story 8.9] Session API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// AC 1, AC 2: Start new practice session with configuration
async function startSession(
  body: {
    session_type: 'pyq_practice' | 'generated_practice' | 'mixed';
    config: {
      topic?: string;
      question_type?: 'mcq' | 'mains_150' | 'mains_250' | 'essay' | 'all';
      difficulty?: 'easy' | 'medium' | 'hard' | 'all';
      count: 10 | 20 | 50;
      source?: 'pyq' | 'generated' | 'both';
    };
  },
  userId: string,
  supabase: any
) {
  const { session_type, config } = body;

  if (!session_type || !config?.count) {
    return NextResponse.json({ error: 'session_type and config.count are required' }, { status: 400 });
  }

  // Fetch questions based on config
  const questionIds: string[] = [];
  const questions: any[] = [];

  // Get from generated questions
  if (session_type === 'generated_practice' || session_type === 'mixed') {
    let query = supabase
      .from('generated_questions')
      .select('id, question_text, question_type, difficulty, options_json, model_answer, topic')
      .eq('is_active', true);

    if (config.topic) query = query.ilike('topic', `%${config.topic}%`);
    if (config.difficulty && config.difficulty !== 'all') query = query.eq('difficulty', config.difficulty);
    if (config.question_type && config.question_type !== 'all') query = query.eq('question_type', config.question_type);

    const limit = session_type === 'mixed' ? Math.floor(config.count / 2) : config.count;
    query = query.limit(limit).order('created_at', { ascending: false });

    const { data: generated } = await query;
    if (generated) {
      questions.push(...generated.map((q: any) => ({
        ...q,
        source: 'generated',
        options: q.options_json?.options || [],
        correct_answer: q.options_json?.correct_answer,
        explanations: q.options_json?.explanations || {},
      })));
      questionIds.push(...generated.map((q: any) => q.id));
    }
  }

  // Get from PYQ questions
  if (session_type === 'pyq_practice' || session_type === 'mixed') {
    let query = supabase
      .from('pyq_questions')
      .select('id, question_text, question_type, difficulty, options, correct_answer, explanation, subject, year');

    if (config.difficulty && config.difficulty !== 'all') query = query.eq('difficulty', config.difficulty);

    const limit = session_type === 'mixed' ? Math.ceil(config.count / 2) : config.count;
    query = query.limit(limit).order('year', { ascending: false });

    const { data: pyqs } = await query;
    if (pyqs) {
      questions.push(...pyqs.map((q: any) => ({
        ...q,
        source: 'pyq',
        topic: q.subject,
      })));
      questionIds.push(...pyqs.map((q: any) => q.id));
    }
  }

  if (questions.length === 0) {
    return NextResponse.json({ 
      error: 'No questions found matching your criteria. Try adjusting filters.',
    }, { status: 404 });
  }

  // Shuffle questions
  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, config.count);
  const shuffledIds = shuffled.map((q: any) => q.id);

  // Create session in database
  const { data: session, error } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: userId,
      session_type,
      session_config: config,
      questions: shuffledIds,
      answers: {},
      question_times: {},
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('[Story 8.9] Failed to create session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  return NextResponse.json({
    session_id: session.id,
    questions: shuffled.map((q: any, idx: number) => ({
      index: idx,
      id: q.id,
      text: q.question_text,
      type: q.question_type === 'mcq' ? 'mcq' : 'mains',
      difficulty: q.difficulty,
      source: q.source,
      topic: q.topic,
      options: q.options,
      // Don't send correct answer for MCQs until answered
    })),
    config,
    total_count: shuffled.length,
  });
}

// AC 8: Pause session
async function pauseSession(
  body: {
    session_id: string;
    current_index: number;
    answers: Record<string, any>;
    question_times: Record<string, number>;
  },
  userId: string,
  supabase: any
) {
  const { session_id, current_index, answers, question_times } = body;

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const { error } = await supabase.rpc('pause_practice_session', {
    p_session_id: session_id,
    p_user_id: userId,
    p_current_index: current_index || 0,
    p_answers: answers || {},
    p_question_times: question_times || {},
  });

  if (error) {
    console.error('[Story 8.9] Pause error:', error);
    return NextResponse.json({ error: 'Failed to pause session' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Session paused' });
}

// AC 8: Resume session
async function resumeSession(
  body: { session_id: string },
  userId: string,
  supabase: any
) {
  const { session_id } = body;

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('resume_practice_session', {
    p_session_id: session_id,
    p_user_id: userId,
  });

  if (error || !data || data.length === 0) {
    console.error('[Story 8.9] Resume error:', error);
    return NextResponse.json({ error: 'Session not found or cannot be resumed' }, { status: 404 });
  }

  const session = data[0];

  // Fetch question details
  const { data: questions } = await supabase
    .from('generated_questions')
    .select('id, question_text, question_type, difficulty, options_json, topic')
    .in('id', session.questions);

  // Also try PYQ
  const { data: pyqQuestions } = await supabase
    .from('pyq_questions')
    .select('id, question_text, question_type, difficulty, options, subject')
    .in('id', session.questions);

  const allQuestions = [
    ...(questions || []).map((q: any) => ({
      id: q.id,
      text: q.question_text,
      type: q.question_type === 'mcq' ? 'mcq' : 'mains',
      difficulty: q.difficulty,
      options: q.options_json?.options || [],
      topic: q.topic,
      source: 'generated',
    })),
    ...(pyqQuestions || []).map((q: any) => ({
      id: q.id,
      text: q.question_text,
      type: q.question_type === 'mcq' ? 'mcq' : 'mains',
      difficulty: q.difficulty,
      options: q.options || [],
      topic: q.subject,
      source: 'pyq',
    })),
  ];

  // Reorder to match session.questions order
  const orderedQuestions = session.questions.map((id: string) =>
    allQuestions.find((q: any) => q.id === id)
  ).filter(Boolean);

  return NextResponse.json({
    session_id,
    questions: orderedQuestions.map((q: any, idx: number) => ({ ...q, index: idx })),
    answers: session.answers,
    question_times: session.question_times,
    current_index: session.current_index,
    elapsed_seconds: session.elapsed_seconds,
    config: session.session_config,
  });
}

// AC 7: Save progress during session
async function saveProgress(
  body: {
    session_id: string;
    current_index: number;
    answers: Record<string, any>;
    question_times: Record<string, number>;
  },
  userId: string,
  supabase: any
) {
  const { session_id, current_index, answers, question_times } = body;

  const { error } = await supabase
    .from('practice_sessions')
    .update({
      current_question_index: current_index,
      answers,
      question_times,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session_id)
    .eq('user_id', userId);

  if (error) {
    console.error('[Story 8.9] Save progress error:', error);
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// AC 9: Complete session with analysis
async function completeSession(
  body: {
    session_id: string;
    answers: Record<string, any>;
    question_times: Record<string, number>;
    total_time: number;
  },
  userId: string,
  supabase: any
) {
  const { session_id, answers, question_times, total_time } = body;

  // Get session to calculate score
  const { data: session } = await supabase
    .from('practice_sessions')
    .select('questions, session_config')
    .eq('id', session_id)
    .eq('user_id', userId)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Fetch correct answers
  const { data: generatedQs } = await supabase
    .from('generated_questions')
    .select('id, question_text, options_json, model_answer, difficulty, topic')
    .in('id', session.questions);

  const { data: pyqQs } = await supabase
    .from('pyq_questions')
    .select('id, question_text, correct_answer, explanation, difficulty, subject')
    .in('id', session.questions);

  const correctAnswers: Record<string, string> = {};
  const questionDetails: Record<string, any> = {};

  (generatedQs || []).forEach((q: any) => {
    correctAnswers[q.id] = q.options_json?.correct_answer || '';
    questionDetails[q.id] = {
      text: q.question_text,
      correct: q.options_json?.correct_answer,
      explanation: q.options_json?.explanations?.[q.options_json?.correct_answer] || q.model_answer,
      difficulty: q.difficulty,
      topic: q.topic,
    };
  });

  (pyqQs || []).forEach((q: any) => {
    correctAnswers[q.id] = q.correct_answer || '';
    questionDetails[q.id] = {
      text: q.question_text,
      correct: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topic: q.subject,
    };
  });

  // Calculate score
  let correct = 0;
  let total = session.questions.length;
  const results: any[] = [];
  const topicPerformance: Record<string, { correct: number; total: number }> = {};
  const difficultyBreakdown: Record<string, { correct: number; total: number }> = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };

  session.questions.forEach((qId: string, idx: number) => {
    const userAnswer = answers[idx.toString()] || answers[qId];
    const correctAnswer = correctAnswers[qId];
    const details = questionDetails[qId];
    const isCorrect = userAnswer === correctAnswer;

    if (isCorrect) correct++;

    // Track by topic
    if (details?.topic) {
      if (!topicPerformance[details.topic]) {
        topicPerformance[details.topic] = { correct: 0, total: 0 };
      }
      topicPerformance[details.topic].total++;
      if (isCorrect) topicPerformance[details.topic].correct++;
    }

    // Track by difficulty
    if (details?.difficulty && difficultyBreakdown[details.difficulty]) {
      difficultyBreakdown[details.difficulty].total++;
      if (isCorrect) difficultyBreakdown[details.difficulty].correct++;
    }

    results.push({
      index: idx,
      question_id: qId,
      question_text: details?.text,
      user_answer: userAnswer,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
      explanation: details?.explanation,
      time_taken: question_times[idx.toString()] || question_times[qId] || 0,
      difficulty: details?.difficulty,
      topic: details?.topic,
    });
  });

  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  // Identify weak/strong topics
  const weakTopics = Object.entries(topicPerformance)
    .filter(([_, stats]) => stats.total >= 2 && (stats.correct / stats.total) < 0.5)
    .map(([topic]) => topic);

  const strongTopics = Object.entries(topicPerformance)
    .filter(([_, stats]) => stats.total >= 2 && (stats.correct / stats.total) >= 0.7)
    .map(([topic]) => topic);

  // Update session
  const { error } = await supabase
    .from('practice_sessions')
    .update({
      status: 'completed',
      answers,
      question_times,
      score: correct,
      accuracy: Math.round(accuracy * 100) / 100,
      time_taken_seconds: total_time,
      weak_topics: weakTopics,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', session_id)
    .eq('user_id', userId);

  if (error) {
    console.error('[Story 8.9] Complete error:', error);
  }

  // Record attempts for Story 8.8 integration
  for (const result of results) {
    try {
      await supabase.from('question_attempts').insert({
        user_id: userId,
        question_id: result.question_id,
        question_type: result.question_id in (generatedQs?.map((q: any) => q.id) || []) ? 'generated' : 'pyq',
        is_correct: result.is_correct,
        time_taken_seconds: result.time_taken,
        difficulty_at_attempt: result.difficulty || 'medium',
      });
    } catch (e) {
      // Continue even if attempt recording fails
    }
  }

  return NextResponse.json({
    session_id,
    score: correct,
    total,
    accuracy: Math.round(accuracy * 100) / 100,
    time_taken: total_time,
    results,
    weak_topics: weakTopics,
    strong_topics: strongTopics,
    difficulty_breakdown: difficultyBreakdown,
    topic_performance: topicPerformance,
  });
}

// AC 8: Get paused sessions
async function getPausedSessions(userId: string, supabase: any) {
  const { data, error } = await supabase.rpc('get_paused_sessions', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[Story 8.9] Get paused error:', error);
    return NextResponse.json({ error: 'Failed to get sessions' }, { status: 500 });
  }

  return NextResponse.json({ sessions: data || [] });
}

// Get session history
async function getSessionHistory(
  body: { limit?: number },
  userId: string,
  supabase: any
) {
  const { data, error } = await supabase.rpc('get_session_history', {
    p_user_id: userId,
    p_limit: body.limit || 20,
  });

  if (error) {
    console.error('[Story 8.9] History error:', error);
    return NextResponse.json({ error: 'Failed to get history' }, { status: 500 });
  }

  return NextResponse.json({ history: data || [] });
}

// Get questions for a session (for review)
async function getSessionQuestions(body: { question_ids: string[] }, supabase: any) {
  const { question_ids } = body;

  if (!question_ids || question_ids.length === 0) {
    return NextResponse.json({ questions: [] });
  }

  const { data: generated } = await supabase
    .from('generated_questions')
    .select('id, question_text, question_type, difficulty, options_json, model_answer')
    .in('id', question_ids);

  const { data: pyqs } = await supabase
    .from('pyq_questions')
    .select('id, question_text, question_type, difficulty, options, correct_answer, explanation')
    .in('id', question_ids);

  const questions = [
    ...(generated || []).map((q: any) => ({
      id: q.id,
      text: q.question_text,
      type: q.question_type === 'mcq' ? 'mcq' : 'mains',
      difficulty: q.difficulty,
      options: q.options_json?.options,
      correct_answer: q.options_json?.correct_answer,
      explanation: q.model_answer,
      source: 'generated',
    })),
    ...(pyqs || []).map((q: any) => ({
      id: q.id,
      text: q.question_text,
      type: q.question_type === 'mcq' ? 'mcq' : 'mains',
      difficulty: q.difficulty,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      source: 'pyq',
    })),
  ];

  return NextResponse.json({ questions });
}

// GET: Get active or specific session
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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (sessionId) {
      // Get specific session
      const { data: session } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      return NextResponse.json({ session });
    }

    // Get active session if exists
    const { data: active } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ session: active });
  } catch (error) {
    console.error('[Story 8.9] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
