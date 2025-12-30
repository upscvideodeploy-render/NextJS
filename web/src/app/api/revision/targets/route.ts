import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: targets } = await (supabase as any)
    .from('revision_targets')
    .select('*, topic_progress(*)')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('weakness_score', { ascending: false });

  return NextResponse.json({ targets: targets || [] });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { target_id, status } = await req.json();

  const { data } = await (supabase as any)
    .from('revision_targets')
    .update({ 
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null
    })
    .eq('id', target_id)
    .eq('user_id', user.id)
    .select()
    .single();

  return NextResponse.json({ target: data });
}
