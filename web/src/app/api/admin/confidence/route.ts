import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { data: config } = await (supabase as any)
    .from('confidence_algorithm_config')
    .select('*')
    .eq('is_active', true)
    .single();

  const { data: topics } = await (supabase as any)
    .from('topic_progress')
    .select('*');

  let updated = 0;

  for (const topic of topics || []) {
    const quizScore = topic.questions_attempted > 0 
      ? (topic.questions_correct / topic.questions_attempted) * 100 
      : 0;
    const timeScore = Math.min(100, (topic.time_spent_minutes / 60) * 10);
    const videoScore = topic.videos_watched * 10;
    const answerScore = topic.completion_percentage;

    const confidence = Math.round(
      quizScore * config.quiz_weight +
      timeScore * config.time_weight +
      videoScore * config.video_weight +
      answerScore * config.answer_weight
    );

    await (supabase as any)
      .from('topic_progress')
      .update({ confidence_score: Math.min(100, confidence) })
      .eq('id', topic.id);

    updated++;
  }

  return NextResponse.json({ updated, total: topics?.length || 0 });
}
