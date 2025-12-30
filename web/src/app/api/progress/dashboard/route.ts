import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: topics } = await (supabase as any)
    .from('topic_progress')
    .select('*')
    .eq('user_id', user.id);

  const { data: sessions } = await (supabase as any)
    .from('study_sessions')
    .select('*')
    .eq('user_id', user.id)
    .gte('session_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const totalTopics = topics?.length || 0;
  const completedTopics = topics?.filter((t: any) => t.completion_percentage === 100).length || 0;
  const avgCompletion = totalTopics > 0 
    ? Math.round(topics.reduce((sum: number, t: any) => sum + t.completion_percentage, 0) / totalTopics)
    : 0;
  const avgConfidence = totalTopics > 0
    ? Math.round(topics.reduce((sum: number, t: any) => sum + t.confidence_score, 0) / totalTopics)
    : 0;

  const totalStudyHours = sessions?.reduce((sum: number, s: any) => sum + s.duration_minutes, 0) / 60 || 0;

  const weakAreas = topics
    ?.sort((a: any, b: any) => a.confidence_score - b.confidence_score)
    .slice(0, 10) || [];

  const strongAreas = topics
    ?.sort((a: any, b: any) => b.confidence_score - a.confidence_score)
    .slice(0, 10) || [];

  const paperProgress = topics?.reduce((acc: any, t: any) => {
    if (!acc[t.paper]) acc[t.paper] = { total: 0, completed: 0 };
    acc[t.paper].total++;
    if (t.completion_percentage === 100) acc[t.paper].completed++;
    return acc;
  }, {}) || {};

  const heatmapData = sessions?.reduce((acc: any, s: any) => {
    const date = s.session_date;
    if (!acc[date]) acc[date] = 0;
    acc[date] += s.duration_minutes;
    return acc;
  }, {}) || {};

  return NextResponse.json({
    overview: {
      totalTopics,
      completedTopics,
      avgCompletion,
      avgConfidence,
      totalStudyHours: Math.round(totalStudyHours * 10) / 10,
    },
    paperProgress,
    weakAreas,
    strongAreas,
    heatmapData,
    recentSessions: sessions?.slice(-30) || [],
  });
}
