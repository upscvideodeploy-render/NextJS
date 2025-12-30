import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: schedule, error: scheduleError } = await (supabase as any)
    .from('study_schedules')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (scheduleError || !schedule) {
    return NextResponse.json({ error: 'No active schedule found' }, { status: 404 });
  }

  const { data: tasks } = await (supabase as any)
    .from('schedule_tasks')
    .select('*')
    .eq('schedule_id', schedule.id)
    .order('task_date', { ascending: true });

  const ical = generateICalendar(tasks || [], user.email || 'user@upscprepx.ai');

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar',
      'Content-Disposition': 'attachment; filename="study-schedule.ics"',
    },
  });
}

function generateICalendar(tasks: any[], userEmail: string) {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UPSC PrepX-AI//Study Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const task of tasks) {
    const startDate = new Date(task.task_date + 'T09:00:00');
    const endDate = new Date(startDate.getTime() + task.duration_minutes * 60 * 1000);
    
    const dtstart = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtend = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    ical.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@upscprepx.ai`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${task.task_type.toUpperCase()}: ${task.topic}`,
      `DESCRIPTION:${task.description || ''}`,
      `STATUS:${task.is_completed ? 'COMPLETED' : 'CONFIRMED'}`,
      'END:VEVENT'
    );
  }

  ical.push('END:VCALENDAR');

  return ical.join('\r\n');
}
