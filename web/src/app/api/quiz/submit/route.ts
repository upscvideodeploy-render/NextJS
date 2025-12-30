import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { quiz_id, answers, time_taken } = await req.json();

  const { data: quiz } = await (supabase as any)
    .from('revision_quizzes')
    .select('*')
    .eq('id', quiz_id)
    .single();

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  }

  const questions = quiz.questions_json;
  let score = 0;

  questions.forEach((q: any, idx: number) => {
    if (answers[idx] === q.correct) score++;
  });

  await (supabase as any)
    .from('revision_quizzes')
    .update({
      score,
      time_taken_seconds: time_taken,
      completed_at: new Date().toISOString()
    })
    .eq('id', quiz_id);

  const confidenceBoost = Math.round((score / questions.length) * 20);
  
  await (supabase as any)
    .from('topic_progress')
    .update({
      confidence_score: Math.min(100, quiz.topic_id.confidence_score + confidenceBoost),
      questions_attempted: quiz.topic_id.questions_attempted + questions.length,
      questions_correct: quiz.topic_id.questions_correct + score
    })
    .eq('id', quiz.topic_id);

  return NextResponse.json({ score, total: questions.length, questions });
}
