/**
 * Story 9.9: Spaced Repetition Review API
 * AC 1: SM-2 algorithm for optimal scheduling
 * AC 7: Review action with Easy/Medium/Hard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Types
interface ReviewResponse {
  bookmark_id: string;
  response: 'easy' | 'medium' | 'hard' | 'again';
  review_time_seconds?: number;
}

interface DueBookmark {
  id: string;
  title: string;
  snippet: string;
  content_type: string;
  content_id: string;
  review_count: number;
  ease_factor: number;
  interval_days: number;
  next_review_date: string;
}

interface ReviewStreak {
  current_streak: number;
  longest_streak: number;
  last_review_date: string;
  total_reviews: number;
}

// GET: Get due bookmarks and streak
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Cookie: (await cookies()).toString() }
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // AC 5: Get due count for notification
    if (action === 'count') {
      const { data: count } = await supabase.rpc('count_due_bookmarks', {
        p_user_id: user.id
      });

      return NextResponse.json({ 
        count: count || 0,
        message: count > 0 ? `${count} bookmarks are due for review today!` : null
      });
    }

    // AC 10: Get streak info
    if (action === 'streak') {
      const { data: streak } = await supabase
        .from('review_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return NextResponse.json({
        streak: streak || {
          current_streak: 0,
          longest_streak: 0,
          total_reviews: 0
        }
      });
    }

    // AC 4, 6: Get due bookmarks for review
    const { data: dueBookmarks, error } = await supabase.rpc('get_due_bookmarks', {
      p_user_id: user.id,
      p_limit: 50
    });

    if (error) throw error;

    // Get streak
    const { data: streak } = await supabase
      .from('review_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      bookmarks: dueBookmarks || [],
      total_due: dueBookmarks?.length || 0,
      streak: streak || { current_streak: 0, longest_streak: 0, total_reviews: 0 }
    });

  } catch (error) {
    console.error('Get due bookmarks error:', error);
    return NextResponse.json(
      { error: 'Failed to get due bookmarks' },
      { status: 500 }
    );
  }
}

// POST: Submit a review (AC 7, 8, 9)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Cookie: (await cookies()).toString() }
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ReviewResponse = await request.json();

    // Validate response
    const validResponses = ['easy', 'medium', 'hard', 'again'];
    if (!validResponses.includes(body.response)) {
      return NextResponse.json(
        { error: 'Invalid response. Use: easy, medium, hard, or again' },
        { status: 400 }
      );
    }

    // AC 7, 8, 9: Process the review using SM-2 algorithm
    const { data: result, error } = await supabase.rpc('process_bookmark_review', {
      p_user_id: user.id,
      p_bookmark_id: body.bookmark_id,
      p_response: body.response,
      p_review_time_seconds: body.review_time_seconds || null
    });

    if (error) throw error;

    const reviewResult = result?.[0];

    if (!reviewResult?.success) {
      return NextResponse.json(
        { error: 'Bookmark not found or access denied' },
        { status: 404 }
      );
    }

    // Get updated streak
    const { data: streak } = await supabase
      .from('review_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // AC 8, 9: Response-specific messaging
    let message = '';
    if (body.response === 'easy') {
      message = `Great! Next review in ${reviewResult.new_interval} days.`;
    } else if (body.response === 'hard') {
      message = `No problem! You'll see this again soon.`;
    } else if (body.response === 'again') {
      message = `This will come back tomorrow for more practice.`;
    } else {
      message = `Next review in ${reviewResult.new_interval} days.`;
    }

    return NextResponse.json({
      success: true,
      new_interval_days: reviewResult.new_interval,
      next_review_date: reviewResult.next_review,
      message,
      streak: streak || { current_streak: 0 }
    });

  } catch (error) {
    console.error('Submit review error:', error);
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}

// PUT: Batch review or initialize bookmarks
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Cookie: (await cookies()).toString() }
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, bookmark_ids } = await request.json();

    // Initialize bookmarks for review
    if (action === 'initialize') {
      for (const id of (bookmark_ids || [])) {
        await supabase.rpc('initialize_bookmark_review', { p_bookmark_id: id });
      }
      return NextResponse.json({ 
        success: true, 
        initialized: bookmark_ids?.length || 0 
      });
    }

    // Skip today's reviews (snooze)
    if (action === 'snooze') {
      const { error } = await supabase
        .from('bookmarks')
        .update({ next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
        .eq('user_id', user.id)
        .lte('next_review_date', new Date().toISOString());

      if (error) throw error;

      return NextResponse.json({ 
        success: true, 
        message: 'Reviews snoozed until tomorrow' 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Batch review error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch action' },
      { status: 500 }
    );
  }
}

// DELETE: Clear review history (for testing)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Cookie: (await cookies()).toString() }
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookmarkId = searchParams.get('bookmark_id');

    if (bookmarkId) {
      // Reset single bookmark
      await supabase
        .from('bookmarks')
        .update({
          next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          review_count: 0,
          ease_factor: 2.5,
          interval_days: 1
        })
        .eq('id', bookmarkId)
        .eq('user_id', user.id);

      return NextResponse.json({ success: true, message: 'Bookmark review reset' });
    }

    return NextResponse.json({ error: 'Bookmark ID required' }, { status: 400 });

  } catch (error) {
    console.error('Reset review error:', error);
    return NextResponse.json(
      { error: 'Failed to reset review' },
      { status: 500 }
    );
  }
}
