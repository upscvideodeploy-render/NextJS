import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: submissions } = await (supabase as any).from('answer_submissions').select('*').eq('user_id', user.id).order('submitted_at', { ascending: false }).limit(50);
  return NextResponse.json({ submissions: submissions || [] });
}
