import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: schedule, error } = await (supabase as any)
    .from('study_schedules')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error) {
    return NextResponse.json({ schedule: null }, { status: 200 });
  }

  const today = new Date().toISOString().split('T')[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: tasks } = await (supabase as any)
    .from('schedule_tasks')
    .select('*')
    .eq('schedule_id', schedule.id)
    .gte('task_date', today)
    .lte('task_date', sevenDaysLater)
    .order('task_date', { ascending: true });

  return NextResponse.json({ schedule, tasks: tasks || [] });
}
