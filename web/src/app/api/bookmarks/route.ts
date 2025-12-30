/**
 * Story 9.7: Smart Bookmark System API
 * Endpoints for bookmarking all content types
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Types
interface CreateBookmarkRequest {
  content_type: 'note' | 'video' | 'question' | 'topic' | 'mindmap' | 'pyq' | 'custom';
  content_id?: string;
  title: string;
  full_content?: string;
  url?: string;
  tags?: string[];
  context?: {
    video_position?: number;
    scroll_position?: number;
    highlight?: string;
    page?: number;
  };
}

interface UpdateTagsRequest {
  bookmark_id: string;
  tags: string[];
}

// AC 10: Check if bookmarked
export async function HEAD(request: NextRequest) {
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
      return new NextResponse(null, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('content_type');
    const contentId = searchParams.get('content_id');

    if (!contentType || !contentId) {
      return new NextResponse(null, { status: 400 });
    }

    const { data: isBookmarked } = await supabase.rpc('is_bookmarked', {
      p_user_id: user.id,
      p_content_type: contentType,
      p_content_id: contentId
    });

    return new NextResponse(null, { 
      status: isBookmarked ? 200 : 404,
      headers: {
        'X-Bookmarked': String(isBookmarked)
      }
    });

  } catch (error) {
    console.error('Bookmark check error:', error);
    return new NextResponse(null, { status: 500 });
  }
}

// Get bookmarks
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
    const contentType = searchParams.get('type');
    const tag = searchParams.get('tag');
    const countOnly = searchParams.get('count') === 'true';

    // AC 8: Count for badge
    if (countOnly) {
      const { data: count } = await supabase.rpc('get_bookmark_count', {
        p_user_id: user.id
      });
      return NextResponse.json({ count: count || 0 });
    }

    // Search by tag
    if (tag) {
      const { data, error } = await supabase.rpc('search_bookmarks_by_tag', {
        p_user_id: user.id,
        p_tag: tag
      });

      if (error) throw error;
      return NextResponse.json({ bookmarks: data || [] });
    }

    // AC 9: Get by type with optimized query
    const { data, error } = await supabase.rpc('get_bookmarks_by_type', {
      p_user_id: user.id,
      p_content_type: contentType || null,
      p_limit: 100
    });

    if (error) throw error;

    return NextResponse.json({ 
      bookmarks: data || [],
      total: data?.length || 0
    });

  } catch (error) {
    console.error('Get bookmarks error:', error);
    return NextResponse.json(
      { error: 'Failed to get bookmarks' },
      { status: 500 }
    );
  }
}

// AC 2: Create bookmark with one-click
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

    const body: CreateBookmarkRequest = await request.json();

    // Validate content type (AC 5)
    const validTypes = ['note', 'video', 'question', 'topic', 'mindmap', 'pyq', 'custom'];
    if (!validTypes.includes(body.content_type)) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // For custom bookmarks, URL is required
    if (body.content_type === 'custom' && !body.url) {
      return NextResponse.json(
        { error: 'URL required for custom bookmarks' },
        { status: 400 }
      );
    }

    // AC 10: Check if already bookmarked
    if (body.content_id) {
      const { data: exists } = await supabase.rpc('is_bookmarked', {
        p_user_id: user.id,
        p_content_type: body.content_type,
        p_content_id: body.content_id
      });

      if (exists) {
        return NextResponse.json(
          { error: 'Already bookmarked', already_bookmarked: true },
          { status: 409 }
        );
      }
    }

    // AC 2, 4: Create bookmark with auto-snippet
    const { data: bookmarkId, error } = await supabase.rpc('create_bookmark', {
      p_user_id: user.id,
      p_content_type: body.content_type,
      p_content_id: body.content_id || null,
      p_title: body.title,
      p_full_content: body.full_content || null,
      p_url: body.url || null,
      p_tags: body.tags || [],
      p_context: body.context || {}
    });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      bookmark_id: bookmarkId,
      message: 'Bookmarked successfully'
    });

  } catch (error) {
    console.error('Create bookmark error:', error);
    return NextResponse.json(
      { error: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
}

// Toggle bookmark (for one-click action)
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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // AC 6: Update tags
    if (action === 'tags') {
      const body: UpdateTagsRequest = await request.json();
      
      const { data: success, error } = await supabase.rpc('update_bookmark_tags', {
        p_bookmark_id: body.bookmark_id,
        p_user_id: user.id,
        p_tags: body.tags
      });

      if (error) throw error;

      return NextResponse.json({
        success,
        message: success ? 'Tags updated' : 'Bookmark not found'
      });
    }

    // Toggle bookmark
    const body = await request.json();
    
    const { data, error } = await supabase.rpc('toggle_bookmark', {
      p_user_id: user.id,
      p_content_type: body.content_type,
      p_content_id: body.content_id,
      p_title: body.title || 'Bookmark'
    });

    if (error) throw error;

    const result = data?.[0];
    return NextResponse.json({
      action: result?.action || 'unknown',
      bookmark_id: result?.bookmark_id,
      message: result?.action === 'added' ? 'Added to bookmarks' : 'Removed from bookmarks'
    });

  } catch (error) {
    console.error('Toggle bookmark error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle bookmark' },
      { status: 500 }
    );
  }
}

// Delete bookmark
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
    const bookmarkId = searchParams.get('id');

    if (!bookmarkId) {
      return NextResponse.json(
        { error: 'Bookmark ID required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed'
    });

  } catch (error) {
    console.error('Delete bookmark error:', error);
    return NextResponse.json(
      { error: 'Failed to delete bookmark' },
      { status: 500 }
    );
  }
}
