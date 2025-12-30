// Story 9.3: AI Teaching Assistant - Motivational Check-ins API
// AC 1-10: Daily check-ins, milestones, struggle detection, responses

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const PRIMARY_MODEL = process.env.A4F_PRIMARY_MODEL || 'provider-3/llama-4-scout';

// AC 2: Message templates based on activity
const MESSAGE_TEMPLATES = {
  very_active: [
    "Incredible work this week! You've answered {questions} questions across {topics} topics. Your dedication is inspiring! 🌟",
    "You're on fire! {questions} questions completed. Keep this momentum going!",
  ],
  active: [
    "Great progress this week! {questions} questions answered. You're building strong foundations.",
    "Nice work! You've covered {topics} topics. Consistency is key, and you're nailing it!",
  ],
  moderate: [
    "Good effort this week! Every question counts towards your UPSC goal. Keep going!",
    "You're making progress! Even small steps lead to big achievements.",
  ],
  low: [
    "Hey there! Just a gentle reminder - every day of preparation counts. Ready for a quick session?",
    "Haven't seen much activity lately. How about tackling just 5 questions today?",
  ],
  inactive_short: [
    "It's been {days} days since we last practiced together. Everything okay? Let's get back on track!",
    "Missing you! A quick 10-question session can help maintain your momentum.",
  ],
  inactive_long: [
    "Hey, it's been {days} days! UPSC preparation is a marathon - let's restart together. No judgment, just support! 💪",
    "Long time no see! Remember, it's never too late to restart. Ready to pick up where you left off?",
  ],
  improving: [
    "Your accuracy is improving! Keep up the great work - you're clearly understanding the concepts better.",
  ],
  streak: [
    "Amazing! You're on a {streak}-day streak! This consistency will pay off on exam day! 🔥",
  ],
  milestone: [
    "🎉 MILESTONE ACHIEVED: {milestone}! This is a significant achievement. Celebrate this moment!",
  ],
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'get_pending':
        return await getPendingCheckins(user.id, supabase);
      case 'generate':
        return await generateCheckin(user.id, supabase);
      case 'respond':
        return await respondToCheckin(user.id, body, supabase);
      case 'mark_read':
        return await markAsRead(user.id, body.checkin_id, supabase);
      case 'get_settings':
        return await getCheckinSettings(user.id, supabase);
      case 'save_settings':
        return await saveCheckinSettings(user.id, body, supabase);
      case 'get_history':
        return await getCheckinHistory(user.id, body, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Story 9.3] Checkin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// AC 1: Get pending check-ins
async function getPendingCheckins(userId: string, supabase: any) {
  try {
    const { data } = await supabase.rpc('get_pending_checkins', { p_user_id: userId });
    return NextResponse.json({ checkins: data || [] });
  } catch (e) {
    const { data } = await supabase
      .from('assistant_checkins')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('sent_at', { ascending: false })
      .limit(5);

    return NextResponse.json({ checkins: data || [] });
  }
}

// AC 1-4: Generate personalized check-in
async function generateCheckin(userId: string, supabase: any) {
  // Check if check-ins are enabled
  const settings = await getCheckinSettingsData(userId, supabase);
  if (!settings.checkin_enabled) {
    return NextResponse.json({ message: 'Check-ins disabled', generated: false });
  }

  // AC 2, 4: Analyze user activity
  let activity;
  try {
    const { data } = await supabase.rpc('analyze_user_activity', { p_user_id: userId });
    activity = data?.[0];
  } catch (e) {
    activity = await analyzeActivityFallback(userId, supabase);
  }

  if (!activity) {
    activity = { activity_type: 'low', days_since_last_activity: 0, topics_this_week: 0, questions_this_week: 0, current_streak: 0, accuracy_trend: 'stable', milestones: [] };
  }

  // AC 3: Check for milestones first
  let checkinType = 'daily';
  let message = '';

  const milestones = activity.milestones || [];
  if (Array.isArray(milestones) && milestones.length > 0) {
    checkinType = 'milestone';
    const milestone = milestones[0];
    message = MESSAGE_TEMPLATES.milestone[0].replace('{milestone}', milestone.label || 'Achievement Unlocked');
  } else if (activity.current_streak >= 7) {
    checkinType = 'streak';
    message = MESSAGE_TEMPLATES.streak[0].replace('{streak}', activity.current_streak.toString());
  } else if (activity.activity_type === 'inactive_long' || activity.activity_type === 'inactive_short') {
    checkinType = 'struggle';
    const templates = MESSAGE_TEMPLATES[activity.activity_type as keyof typeof MESSAGE_TEMPLATES] || MESSAGE_TEMPLATES.low;
    message = templates[Math.floor(Math.random() * templates.length)]
      .replace('{days}', activity.days_since_last_activity?.toString() || '3');
  } else {
    const templates = MESSAGE_TEMPLATES[activity.activity_type as keyof typeof MESSAGE_TEMPLATES] || MESSAGE_TEMPLATES.moderate;
    message = templates[Math.floor(Math.random() * templates.length)]
      .replace('{questions}', activity.questions_this_week?.toString() || '0')
      .replace('{topics}', activity.topics_this_week?.toString() || '0');
  }

  // Polish message with AI if available
  if (A4F_API_KEY && message) {
    try {
      const polishedMessage = await polishMessageWithAI(message, activity);
      if (polishedMessage) message = polishedMessage;
    } catch (e) {
      console.warn('[Story 9.3] AI polish failed, using template');
    }
  }

  // Save check-in to database
  try {
    const { data } = await supabase.rpc('create_checkin', {
      p_user_id: userId,
      p_checkin_type: checkinType,
      p_message: message,
      p_metadata: {
        activity_type: activity.activity_type,
        questions_this_week: activity.questions_this_week,
        topics_this_week: activity.topics_this_week,
        streak: activity.current_streak,
        trend: activity.accuracy_trend,
      },
    });

    return NextResponse.json({
      generated: true,
      checkin_id: data,
      type: checkinType,
      message,
      activity,
    });
  } catch (e) {
    // Fallback insert
    const { data, error } = await supabase.from('assistant_checkins').insert({
      user_id: userId,
      checkin_type: checkinType,
      message,
      metadata: { activity_type: activity.activity_type },
    }).select().single();

    if (error) throw error;

    return NextResponse.json({
      generated: true,
      checkin_id: data?.id,
      type: checkinType,
      message,
    });
  }
}

// AC 7: Respond to check-in
async function respondToCheckin(userId: string, body: any, supabase: any) {
  const { checkin_id, response } = body;

  if (!checkin_id || !response) {
    return NextResponse.json({ error: 'Missing checkin_id or response' }, { status: 400 });
  }

  try {
    await supabase.rpc('respond_to_checkin', {
      p_checkin_id: checkin_id,
      p_user_id: userId,
      p_response: response,
    });
  } catch (e) {
    await supabase.from('assistant_checkins')
      .update({ user_response: response, response_at: new Date().toISOString(), is_read: true })
      .eq('id', checkin_id)
      .eq('user_id', userId);
  }

  // Generate follow-up message
  let followUp = "Thanks for responding! I appreciate you sharing. Let me know if you need any help with your studies today.";
  
  if (A4F_API_KEY) {
    try {
      const aiResponse = await generateFollowUp(response);
      if (aiResponse) followUp = aiResponse;
    } catch (e) {
      console.warn('[Story 9.3] Follow-up generation failed');
    }
  }

  return NextResponse.json({
    success: true,
    follow_up: followUp,
  });
}

// Mark check-in as read
async function markAsRead(userId: string, checkinId: string, supabase: any) {
  if (!checkinId) {
    return NextResponse.json({ error: 'Missing checkin_id' }, { status: 400 });
  }

  try {
    await supabase.rpc('mark_checkin_read', { p_checkin_id: checkinId, p_user_id: userId });
  } catch (e) {
    await supabase.from('assistant_checkins')
      .update({ is_read: true })
      .eq('id', checkinId)
      .eq('user_id', userId);
  }

  return NextResponse.json({ success: true });
}

// AC 9: Get check-in settings
async function getCheckinSettings(userId: string, supabase: any) {
  const settings = await getCheckinSettingsData(userId, supabase);
  return NextResponse.json({ settings });
}

async function getCheckinSettingsData(userId: string, supabase: any) {
  try {
    const { data } = await supabase.rpc('get_checkin_settings', { p_user_id: userId });
    return data?.[0] || {
      checkin_enabled: true,
      preferred_checkin_time: '09:00',
      timezone: 'Asia/Kolkata',
      notification_channel: 'push',
    };
  } catch (e) {
    const { data } = await supabase
      .from('assistant_preferences')
      .select('checkin_enabled, preferred_checkin_time, timezone, notification_channel')
      .eq('user_id', userId)
      .single();

    return data || {
      checkin_enabled: true,
      preferred_checkin_time: '09:00',
      timezone: 'Asia/Kolkata',
      notification_channel: 'push',
    };
  }
}

// AC 9: Save check-in settings
async function saveCheckinSettings(userId: string, body: any, supabase: any) {
  const { checkin_enabled, preferred_checkin_time, timezone, notification_channel } = body;

  await supabase.from('assistant_preferences').upsert({
    user_id: userId,
    checkin_enabled: checkin_enabled ?? true,
    preferred_checkin_time: preferred_checkin_time || '09:00',
    timezone: timezone || 'Asia/Kolkata',
    notification_channel: notification_channel || 'push',
  }, { onConflict: 'user_id' });

  return NextResponse.json({ success: true, message: 'Check-in settings saved' });
}

// Get check-in history
async function getCheckinHistory(userId: string, body: any, supabase: any) {
  const { limit = 20 } = body;

  const { data } = await supabase
    .from('assistant_checkins')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  return NextResponse.json({ history: data || [] });
}

// Fallback activity analysis
async function analyzeActivityFallback(userId: string, supabase: any) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: attempts } = await supabase
    .from('question_attempts')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', weekAgo);

  const questionsThisWeek = attempts?.length || 0;
  const topics = new Set(attempts?.map((a: any) => a.topic || 'General')).size;
  
  let activityType = 'low';
  if (questionsThisWeek >= 50) activityType = 'very_active';
  else if (questionsThisWeek >= 20) activityType = 'active';
  else if (questionsThisWeek >= 5) activityType = 'moderate';

  return {
    activity_type: activityType,
    days_since_last_activity: 0,
    topics_this_week: topics,
    questions_this_week: questionsThisWeek,
    current_streak: 0,
    accuracy_trend: 'stable',
    milestones: [],
  };
}

// Polish message with AI
async function polishMessageWithAI(message: string, activity: any): Promise<string | null> {
  const response = await fetch(`${A4F_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${A4F_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a supportive UPSC mentor. Rewrite this motivational message to be more personal and encouraging. Keep it under 100 words. Add 1-2 relevant emojis. Context: user's activity level is "${activity.activity_type}", accuracy trend is "${activity.accuracy_trend}".`,
        },
        { role: 'user', content: message },
      ],
      temperature: 0.8,
      max_tokens: 150,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

// Generate follow-up response
async function generateFollowUp(userResponse: string): Promise<string | null> {
  const response = await fetch(`${A4F_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${A4F_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a supportive UPSC mentor. The student responded to your check-in message. Write a brief, warm follow-up (1-2 sentences) that acknowledges their response and offers encouragement.',
        },
        { role: 'user', content: `Student's response: "${userResponse}"` },
      ],
      temperature: 0.7,
      max_tokens: 100,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

// GET: Quick pending check-ins count
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count } = await supabase
      .from('assistant_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({ pending_count: count || 0 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
