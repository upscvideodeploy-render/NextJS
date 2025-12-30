import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: prefs } = await (supabase as any)
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id);

  return NextResponse.json({ preferences: prefs || [] });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { notification_type, enabled, preferred_time } = await req.json();

  const { data } = await (supabase as any)
    .from('notification_preferences')
    .upsert({
      user_id: user.id,
      notification_type,
      enabled,
      preferred_time
    })
    .select()
    .single();

  return NextResponse.json({ preference: data });
}
