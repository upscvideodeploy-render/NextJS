/**
 * Gamification API Route - Story 14.1
 * 
 * AC 1: XP system (video=10, quiz=20, doubt=15, notes=25, streak=50)
 * AC 2: Badges (First Steps, Week Warrior, Quiz Master, Syllabus Explorer, Consistent)
 * AC 3: Streaks (consecutive days with 30 min study)
 * AC 5: Progress bar / level progression
 * AC 6: Milestones with celebration
 * AC 7: No competitive leaderboards
 * AC 8: Self-comparison "You vs Last Month"
 * AC 9: Analytics dashboard
 * AC 10: Opt-out option
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// XP Values (AC 1)
const XP_VALUES = {
  video_watched: 10,
  quiz_completed: 20,
  doubt_asked: 15,
  notes_generated: 25,
  streak_bonus: 50
};

// ============================================================================
// GET - Fetch gamification data
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';

    switch (action) {
      case 'dashboard':
        return await getDashboard(user.id);
      case 'badges':
        return await getBadges(user.id);
      case 'history':
        return await getXPHistory(user.id);
      case 'comparison':
        return await getSelfComparison(user.id);
      case 'rooms':
        return await getSubjectRooms(user.id);
      case 'milestones':
        return await getMilestones(user.id);
      case 'settings':
        return await getSettings(user.id);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Gamification GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Perform gamification actions
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'award_xp':
        return await awardXP(user.id, body);
      case 'update_streak':
        return await updateStreak(user.id, body);
      case 'check_badges':
        return await checkBadges(user.id);
      case 'visit_room':
        return await visitRoom(user.id, body);
      case 'celebrate_milestone':
        return await celebrateMilestone(user.id, body);
      case 'update_settings':
        return await updateSettings(user.id, body);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Gamification POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DASHBOARD (AC 5, AC 9)
// ============================================================================

async function getDashboard(userId: string) {
  // Check if gamification is enabled
  const { data: settings } = await supabase
    .from('gamification_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!settings?.enabled) {
    return NextResponse.json({ 
      enabled: false, 
      message: 'Gamification is disabled' 
    });
  }

  // Get user XP and level
  const { data: userXP } = await supabase
    .from('user_xp')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Get current level info
  const { data: currentLevel } = await supabase
    .from('level_definitions')
    .select('*')
    .eq('level', userXP?.current_level || 1)
    .single();

  const { data: nextLevel } = await supabase
    .from('level_definitions')
    .select('*')
    .eq('level', (userXP?.current_level || 1) + 1)
    .single();

  // Get streak
  const { data: streak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Get recent badges
  const { data: recentBadges } = await supabase
    .from('user_badges')
    .select(`
      *,
      badge:badge_definitions(*)
    `)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })
    .limit(5);

  // Get today's activity
  const today = new Date().toISOString().split('T')[0];
  const { data: todayActivity } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('user_id', userId)
    .eq('activity_date', today)
    .single();

  // Get uncelebrated milestones
  const { data: uncelebrated } = await supabase
    .from('user_milestones')
    .select('*')
    .eq('user_id', userId)
    .eq('celebrated', false)
    .order('created_at', { ascending: false })
    .limit(5);

  // Calculate progress to next level
  const xpForCurrentLevel = currentLevel?.xp_required || 0;
  const xpForNextLevel = nextLevel?.xp_required || (userXP?.total_xp || 0) + 1000;
  const xpInLevel = (userXP?.total_xp || 0) - xpForCurrentLevel;
  const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = Math.min(100, Math.round((xpInLevel / xpNeededForLevel) * 100));

  return NextResponse.json({
    enabled: true,
    xp: {
      total: userXP?.total_xp || 0,
      lifetime: userXP?.lifetime_xp || 0,
      toNextLevel: userXP?.xp_to_next_level || 100
    },
    level: {
      current: userXP?.current_level || 1,
      name: currentLevel?.name || 'Aspirant',
      title: currentLevel?.title || 'UPSC Aspirant',
      progressPercentage,
      xpInLevel,
      xpNeededForLevel
    },
    streak: {
      current: streak?.current_streak || 0,
      longest: streak?.longest_streak || 0,
      lastActivityDate: streak?.last_activity_date
    },
    today: {
      studyMinutes: todayActivity?.study_minutes || 0,
      xpEarned: todayActivity?.xp_earned || 0,
      videosWatched: todayActivity?.videos_watched || 0,
      quizzesCompleted: todayActivity?.quizzes_completed || 0
    },
    recentBadges: recentBadges?.map(b => ({
      id: b.badge?.id,
      name: b.badge?.name,
      slug: b.badge?.slug,
      icon: b.badge?.icon_url,
      rarity: b.badge?.rarity,
      earnedAt: b.earned_at
    })) || [],
    uncelebratedMilestones: uncelebrated || [],
    settings
  });
}

// ============================================================================
// BADGES (AC 2)
// ============================================================================

async function getBadges(userId: string) {
  // Get all badge definitions
  const { data: allBadges } = await supabase
    .from('badge_definitions')
    .select('*')
    .order('display_order');

  // Get user's earned badges
  const { data: earnedBadges } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', userId);

  const earnedIds = new Set(earnedBadges?.map(b => b.badge_id) || []);
  const earnedMap = new Map(earnedBadges?.map(b => [b.badge_id, b.earned_at]) || []);

  const badges = allBadges?.map(badge => ({
    ...badge,
    earned: earnedIds.has(badge.id),
    earnedAt: earnedMap.get(badge.id) || null
  })) || [];

  // Group by category
  const byCategory = {
    milestone: badges.filter(b => b.category === 'milestone'),
    streak: badges.filter(b => b.category === 'streak'),
    achievement: badges.filter(b => b.category === 'achievement'),
    explorer: badges.filter(b => b.category === 'explorer')
  };

  return NextResponse.json({
    all: badges,
    byCategory,
    totalEarned: earnedIds.size,
    totalAvailable: allBadges?.length || 0
  });
}

// ============================================================================
// XP HISTORY (AC 9)
// ============================================================================

async function getXPHistory(userId: string) {
  // Get recent XP transactions
  const { data: transactions } = await supabase
    .from('xp_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  // Get daily totals for past 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: dailyTotals } = await supabase
    .from('daily_activity')
    .select('activity_date, xp_earned, study_minutes')
    .eq('user_id', userId)
    .gte('activity_date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('activity_date');

  // Get monthly stats
  const { data: monthlyStats } = await supabase
    .from('monthly_stats')
    .select('*')
    .eq('user_id', userId)
    .order('month_year', { ascending: false })
    .limit(6);

  return NextResponse.json({
    recentTransactions: transactions || [],
    dailyTotals: dailyTotals || [],
    monthlyStats: monthlyStats || []
  });
}

// ============================================================================
// SELF-COMPARISON (AC 8: "You vs Last Month")
// ============================================================================

async function getSelfComparison(userId: string) {
  const { data, error } = await supabase.rpc('get_self_comparison', {
    p_user_id: userId
  });

  if (error) {
    console.error('Self comparison error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate improvement percentages
  const current = data.current;
  const previous = data.previous;

  const improvements = {
    xp: calculateImprovement(previous.xp, current.xp),
    study_minutes: calculateImprovement(previous.study_minutes, current.study_minutes),
    videos: calculateImprovement(previous.videos, current.videos),
    quizzes: calculateImprovement(previous.quizzes, current.quizzes),
    notes: calculateImprovement(previous.notes, current.notes)
  };

  return NextResponse.json({
    ...data,
    improvements
  });
}

function calculateImprovement(prev: number, curr: number): { value: number; percentage: number; direction: string } {
  const diff = curr - prev;
  const percentage = prev === 0 ? (curr > 0 ? 100 : 0) : Math.round((diff / prev) * 100);
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  return { value: diff, percentage, direction };
}

// ============================================================================
// SUBJECT ROOMS (AC 4)
// ============================================================================

async function getSubjectRooms(userId: string) {
  // Get all rooms
  const { data: rooms } = await supabase
    .from('subject_rooms')
    .select('*')
    .order('display_order');

  // Get user's progress in each room
  const { data: progress } = await supabase
    .from('user_room_progress')
    .select('*')
    .eq('user_id', userId);

  const progressMap = new Map(progress?.map(p => [p.room_id, p]) || []);

  const roomsWithProgress = rooms?.map(room => ({
    ...room,
    progress: progressMap.get(room.id) || {
      visited: false,
      time_spent_minutes: 0,
      completion_percentage: 0
    }
  })) || [];

  // Count visited rooms
  const visitedCount = roomsWithProgress.filter(r => r.progress.visited).length;

  return NextResponse.json({
    rooms: roomsWithProgress,
    visitedCount,
    totalCount: rooms?.length || 0
  });
}

// ============================================================================
// MILESTONES (AC 6)
// ============================================================================

async function getMilestones(userId: string) {
  const { data: milestones } = await supabase
    .from('user_milestones')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    milestones: milestones || []
  });
}

// ============================================================================
// SETTINGS (AC 10)
// ============================================================================

async function getSettings(userId: string) {
  let { data: settings } = await supabase
    .from('gamification_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Create default settings if not exists
  if (!settings) {
    const { data: newSettings } = await supabase
      .from('gamification_settings')
      .insert({ user_id: userId })
      .select()
      .single();
    settings = newSettings;
  }

  return NextResponse.json({ settings });
}

// ============================================================================
// AWARD XP (AC 1)
// ============================================================================

async function awardXP(userId: string, body: any) {
  const { activity_type, source_id, description } = body;

  // Validate activity type
  if (!XP_VALUES[activity_type as keyof typeof XP_VALUES]) {
    return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 });
  }

  const amount = XP_VALUES[activity_type as keyof typeof XP_VALUES];

  // Call database function to award XP
  const { data, error } = await supabase.rpc('award_xp', {
    p_user_id: userId,
    p_amount: amount,
    p_activity_type: activity_type,
    p_source_id: source_id || null,
    p_description: description || null
  });

  if (error) {
    console.error('Award XP error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update specific counters in daily activity
  const updateField = getActivityField(activity_type);
  if (updateField) {
    const today = new Date().toISOString().split('T')[0];
    try {
      await supabase.rpc('increment_daily_activity', {
        p_user_id: userId,
        p_date: today,
        p_field: updateField
      });
    } catch {
      // Fallback: direct upsert if RPC doesn't exist
      await supabase.from('daily_activity')
        .upsert({
          user_id: userId,
          activity_date: today,
          [updateField]: 1
        }, { onConflict: 'user_id,activity_date' });
    }
  }

  // Check for new badges
  const badges = await supabase.rpc('check_and_award_badges', {
    p_user_id: userId
  });

  return NextResponse.json({
    awarded: data,
    amount,
    activity_type,
    newBadges: badges.data || []
  });
}

function getActivityField(activityType: string): string | null {
  const fieldMap: Record<string, string> = {
    video_watched: 'videos_watched',
    quiz_completed: 'quizzes_completed',
    doubt_asked: 'doubts_asked',
    notes_generated: 'notes_generated'
  };
  return fieldMap[activityType] || null;
}

// ============================================================================
// UPDATE STREAK (AC 3)
// ============================================================================

async function updateStreak(userId: string, body: any) {
  const { study_minutes } = body;

  if (typeof study_minutes !== 'number' || study_minutes < 0) {
    return NextResponse.json({ error: 'Invalid study minutes' }, { status: 400 });
  }

  // Call database function
  const { data, error } = await supabase.rpc('update_user_streak', {
    p_user_id: userId,
    p_study_minutes: study_minutes
  });

  if (error) {
    console.error('Update streak error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check for streak-based badges
  await supabase.rpc('check_and_award_badges', { p_user_id: userId });

  return NextResponse.json({
    streak: data
  });
}

// ============================================================================
// CHECK BADGES (AC 2)
// ============================================================================

async function checkBadges(userId: string) {
  const { data, error } = await supabase.rpc('check_and_award_badges', {
    p_user_id: userId
  });

  if (error) {
    console.error('Check badges error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    newBadges: data || []
  });
}

// ============================================================================
// VISIT ROOM (AC 4)
// ============================================================================

async function visitRoom(userId: string, body: any) {
  const { room_id, time_spent_minutes } = body;

  if (!room_id) {
    return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
  }

  // Upsert room progress
  const { data, error } = await supabase
    .from('user_room_progress')
    .upsert({
      user_id: userId,
      room_id,
      visited: true,
      first_visited_at: new Date().toISOString(),
      time_spent_minutes: time_spent_minutes || 0,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,room_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Visit room error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check for explorer badge
  await supabase.rpc('check_and_award_badges', { p_user_id: userId });

  return NextResponse.json({
    progress: data
  });
}

// ============================================================================
// CELEBRATE MILESTONE (AC 6)
// ============================================================================

async function celebrateMilestone(userId: string, body: any) {
  const { milestone_id } = body;

  if (!milestone_id) {
    return NextResponse.json({ error: 'Milestone ID required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_milestones')
    .update({ celebrated: true })
    .eq('id', milestone_id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Celebrate milestone error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    milestone: data
  });
}

// ============================================================================
// UPDATE SETTINGS (AC 10)
// ============================================================================

async function updateSettings(userId: string, body: any) {
  const { enabled, show_xp, show_badges, show_streaks, show_3d_rooms, daily_goal_minutes } = body;

  const updates: any = { updated_at: new Date().toISOString() };
  
  if (typeof enabled === 'boolean') updates.enabled = enabled;
  if (typeof show_xp === 'boolean') updates.show_xp = show_xp;
  if (typeof show_badges === 'boolean') updates.show_badges = show_badges;
  if (typeof show_streaks === 'boolean') updates.show_streaks = show_streaks;
  if (typeof show_3d_rooms === 'boolean') updates.show_3d_rooms = show_3d_rooms;
  if (typeof daily_goal_minutes === 'number') updates.daily_goal_minutes = daily_goal_minutes;

  const { data, error } = await supabase
    .from('gamification_settings')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data
  });
}
