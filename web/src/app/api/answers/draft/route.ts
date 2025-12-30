import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { question_id, draft_text, word_count } = await req.json();

  await (supabase as any).from('submission_drafts').upsert({
    user_id: user.id, question_id, draft_text, word_count, last_saved_at: new Date().toISOString()
  });

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const questionId = searchParams.get('question_id');

  const { data: draft } = await (supabase as any).from('submission_drafts').select('*').eq('user_id', user.id).eq('question_id', questionId).single();
  return NextResponse.json({ draft });
}
