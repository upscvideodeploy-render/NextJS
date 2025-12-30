import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const weekNumber = getWeekNumber(now);
  const year = now.getFullYear();

  const { data: dashboard } = await fetch('/api/progress/dashboard').then(r => r.json());

  const stats = {
    topicsCompleted: dashboard.overview.completedTopics,
    avgConfidence: dashboard.overview.avgConfidence,
    studyHours: dashboard.overview.totalStudyHours,
    weakAreas: dashboard.weakAreas.slice(0, 3),
    strongAreas: dashboard.strongAreas.slice(0, 3)
  };

  const script = await generateScript(stats);

  const videoJob = {
    user_id: user.id,
    week_number: weekNumber,
    year,
    video_url: `progress-videos/${user.id}/week_${weekNumber}_${year}.mp4`,
    stats_json: stats,
    status: 'processing'
  };

  const { data: video } = await (supabase as any)
    .from('progress_videos')
    .upsert(videoJob)
    .select()
    .single();

  fetch(process.env.VPS_ORCHESTRATOR_URL + '/generate-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: video.id, script, stats })
  }).catch(() => {});

  return NextResponse.json({ video });
}

function getWeekNumber(date: Date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
}

async function generateScript(stats: any) {
  const prompt = `Create a motivational 2-minute weekly progress summary script for a UPSC aspirant.
Stats: ${stats.topicsCompleted} topics completed, ${stats.avgConfidence}% avg confidence, ${stats.studyHours}h study time.
Weak areas: ${stats.weakAreas.map((a: any) => a.topic).join(', ')}.
Strong areas: ${stats.strongAreas.map((a: any) => a.topic).join(', ')}.
Include encouragement and actionable advice. Mark chart positions with [CHART].`;

  const response = await fetch('https://api.a4f.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ddc-a4f-12e06ff0184f41de8d3de7be4cd2e831`
    },
    body: JSON.stringify({
      model: 'provider-3/llama-4-scout',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
