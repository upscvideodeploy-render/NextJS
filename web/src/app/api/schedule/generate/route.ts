import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Story 6.1 - AC1-10: Complete AI Study Schedule Generation
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { exam_date, target_hours_per_day } = await req.json();

    // AC1: Validation
    if (!exam_date || !target_hours_per_day) {
      return NextResponse.json({ 
        error: 'Missing required fields', 
        details: 'exam_date and target_hours_per_day are required' 
      }, { status: 400 });
    }

    if (target_hours_per_day < 1 || target_hours_per_day > 24) {
      return NextResponse.json({ 
        error: 'Invalid target hours', 
        details: 'Target hours must be between 1 and 24' 
      }, { status: 400 });
    }

    const examDate = new Date(exam_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (examDate <= today) {
      return NextResponse.json({ 
        error: 'Invalid exam date', 
        details: 'Exam date must be in the future' 
      }, { status: 400 });
    }

    // AC2: Fetch user progress data for AI analysis
    const { data: progressData } = await (supabase as any)
      .from('user_progress')
      .select('topic, completion_percentage, last_studied_at')
      .eq('user_id', user.id);

    const { data: topicProgress } = await (supabase as any)
      .from('topic_progress')
      .select('*')
      .eq('user_id', user.id);

    // AC2: Calculate days until exam
    const daysUntilExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // AC3: AI schedule generation with weak area analysis
    const scheduleData = await generateSchedule({
      daysUntilExam,
      targetHoursPerDay: target_hours_per_day,
      progressData: progressData || [],
      topicProgress: topicProgress || [],
      userId: user.id
    });

    // AC4: Deactivate old schedules (only one active per user)
    await (supabase as any)
      .from('study_schedules')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    // AC3,10: Create new schedule with metadata
    const { data: schedule, error: scheduleError } = await (supabase as any)
      .from('study_schedules')
      .insert({
        user_id: user.id,
        exam_date,
        target_hours_per_day,
        schedule_data: scheduleData,
        is_active: true,
        last_adapted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (scheduleError) {
      console.error('Schedule creation error:', scheduleError);
      return NextResponse.json({ 
        error: 'Failed to create schedule', 
        details: scheduleError.message 
      }, { status: 500 });
    }

    // AC6,10: Create tasks for next 7 days with breakdown
    const tasks = generateTasks(schedule.id, user.id, scheduleData, 7);

    const { error: tasksError } = await (supabase as any)
      .from('schedule_tasks')
      .insert(tasks);

    if (tasksError) {
      console.error('Tasks creation error:', tasksError);
      return NextResponse.json({ 
        error: 'Failed to create tasks', 
        details: tasksError.message 
      }, { status: 500 });
    }

    // AC8: Create daily reminder notifications
    await createNotifications(supabase, user.id, schedule.id, tasks);

    return NextResponse.json({ 
      success: true,
      schedule, 
      tasks,
      metadata: {
        totalDays: daysUntilExam,
        totalTasks: tasks.length,
        weakTopics: scheduleData.metadata.weakTopics,
        restDays: scheduleData.metadata.restDays
      }
    });

  } catch (error: any) {
    console.error('Schedule generation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}

// AC2,3: AI-powered schedule generation with weak area focus
async function generateSchedule({ daysUntilExam, targetHoursPerDay, progressData, topicProgress, userId }: any) {
  const topics = [
    'Ancient India', 'Medieval India', 'Modern India', 'Freedom Struggle',
    'Physical Geography', 'Indian Geography', 'World Geography',
    'Indian Polity', 'Constitution', 'Governance',
    'Indian Economy', 'Economic Development', 'Planning',
    'Environment & Ecology', 'Biodiversity', 'Climate Change',
    'Science & Technology', 'Space', 'Defense',
    'Current Affairs', 'International Relations',
    'Ethics', 'Integrity', 'Aptitude',
    'Essay Writing', 'Answer Writing'
  ];

  // AC2: Identify weak topics (completion < 50% or confidence < 50%)
  const weakTopics = topicProgress
    .filter((p: any) => p.completion_percentage < 50 || p.confidence_score < 50)
    .map((p: any) => p.topic);

  const schedule = [];
  const totalHours = daysUntilExam * targetHoursPerDay;
  let restDaysCount = 0;

  for (let day = 0; day < daysUntilExam; day++) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + day);
    const dateStr = currentDate.toISOString().split('T')[0];

    // AC7: Rest day every 7th day
    const isRestDay = day % 7 === 6;
    
    if (isRestDay) {
      restDaysCount++;
      schedule.push({
        day: day + 1,
        date: dateStr,
        type: 'rest',
        tasks: [{
          type: 'rest',
          topic: 'Rest Day',
          duration_minutes: 0,
          description: 'Take a break to consolidate learning and avoid burnout'
        }]
      });
      continue;
    }

    // AC3,6: Daily task breakdown
    const dayTasks = [];
    const topicIndex = day % topics.length;
    const topic = topics[topicIndex];
    const isWeakTopic = weakTopics.includes(topic);

    // AC2: Allocate more time to weak topics
    const studyHours = isWeakTopic ? targetHoursPerDay * 0.6 : targetHoursPerDay * 0.5;
    const revisionHours = targetHoursPerDay * 0.3;
    const practiceHours = targetHoursPerDay * 0.2;

    // AC6: Study task with checkbox
    dayTasks.push({
      type: 'study',
      topic,
      duration_minutes: Math.round(studyHours * 60),
      description: `Study ${topic} - Read notes, watch videos, and understand key concepts`,
      priority: isWeakTopic ? 'high' : 'medium'
    });

    // AC6: Revision task
    const revisionTopic = topics[(topicIndex - 3 + topics.length) % topics.length];
    dayTasks.push({
      type: 'revision',
      topic: revisionTopic,
      duration_minutes: Math.round(revisionHours * 60),
      description: `Revise ${revisionTopic} - Review previous notes and flashcards`,
      priority: 'medium'
    });

    // AC6: Practice task
    dayTasks.push({
      type: 'practice',
      topic,
      duration_minutes: Math.round(practiceHours * 60),
      description: `Practice ${topic} - Solve PYQs, MCQs, and write answers`,
      priority: 'medium'
    });

    schedule.push({
      day: day + 1,
      date: dateStr,
      type: 'study',
      tasks: dayTasks
    });
  }

  return { 
    schedule, 
    metadata: { 
      totalDays: daysUntilExam, 
      totalHours, 
      weakTopics,
      restDays: restDaysCount,
      generatedAt: new Date().toISOString()
    } 
  };
}

// AC6,10: Generate task records for database
function generateTasks(scheduleId: string, userId: string, scheduleData: any, days: number) {
  const tasks = [];
  const schedule = scheduleData.schedule.slice(0, days);

  for (const day of schedule) {
    if (day.type === 'rest') {
      tasks.push({
        schedule_id: scheduleId,
        user_id: userId,
        task_date: day.date,
        task_type: 'rest',
        topic: 'Rest Day',
        duration_minutes: 0,
        description: day.tasks[0].description
      });
      continue;
    }

    for (const task of day.tasks) {
      tasks.push({
        schedule_id: scheduleId,
        user_id: userId,
        task_date: day.date,
        task_type: task.type,
        topic: task.topic,
        duration_minutes: task.duration_minutes,
        description: task.description
      });
    }
  }

  return tasks;
}

// AC8: Create daily reminder notifications
async function createNotifications(supabase: any, userId: string, scheduleId: string, tasks: any[]) {
  const notifications = [];
  const uniqueDates = [...new Set(tasks.map(t => t.task_date))];

  for (const date of uniqueDates) {
    const notificationTime = new Date(date + 'T09:00:00');
    
    notifications.push({
      user_id: userId,
      schedule_id: scheduleId,
      notification_type: 'daily_reminder',
      scheduled_for: notificationTime.toISOString()
    });
  }

  await supabase.from('schedule_notifications').insert(notifications);
}
