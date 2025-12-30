import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: topics } = await (supabase as any)
    .from('topic_progress')
    .select('*')
    .eq('user_id', user.id);

  if (!topics || topics.length === 0) {
    return NextResponse.json({ targets: [] });
  }

  const scoredTopics = topics.map((topic: any) => {
    const recencyScore = 100 - topic.confidence_score;
    const historicalScore = 100 - topic.completion_percentage;
    const priorityScore = ['GS1', 'GS2', 'GS3', 'GS4'].includes(topic.paper) ? 10 : 5;
    
    const weaknessScore = (recencyScore * 0.6) + (historicalScore * 0.3) + (priorityScore * 0.1);
    
    return { ...topic, weaknessScore };
  });

  const weakestTopics = scoredTopics
    .sort((a: any, b: any) => b.weaknessScore - a.weaknessScore)
    .slice(0, 5);

  const today = new Date().toISOString().split('T')[0];

  await (supabase as any)
    .from('revision_targets')
    .delete()
    .eq('user_id', user.id)
    .eq('status', 'pending');

  const targets = weakestTopics.map((t: any) => ({
    user_id: user.id,
    topic_id: t.id,
    weakness_score: t.weaknessScore,
    identified_date: today,
    status: 'pending'
  }));

  const { data: inserted } = await (supabase as any)
    .from('revision_targets')
    .insert(targets)
    .select();

  return NextResponse.json({ targets: inserted || [] });
}
