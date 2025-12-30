import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { question_id, question_text, answer_text, word_count, time_taken_seconds } = await req.json();

  const { data: submission } = await (supabase as any).from('answer_submissions').insert({
    user_id: user.id, question_id, question_text, answer_text, word_count, time_taken_seconds,
    status: 'submitted', submitted_at: new Date().toISOString()
  }).select().single();

  fetch('/api/answers/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submission_id: submission.id })
  }).catch(() => {});

  return NextResponse.json({ submission });
}
