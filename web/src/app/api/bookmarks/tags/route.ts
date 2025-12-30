/**
 * Story 9.10 AC 7: Tags API
 * Get all tags, rename, merge, delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// GET: List all tags with counts
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

    const { data: tags, error } = await supabase.rpc('get_user_tags', {
      p_user_id: user.id
    });

    if (error) throw error;

    return NextResponse.json({
      tags: tags || [],
      total: tags?.length || 0
    });

  } catch (error) {
    console.error('Get tags error:', error);
    return NextResponse.json(
      { error: 'Failed to get tags' },
      { status: 500 }
    );
  }
}

// PUT: Rename or merge tags
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

    const body = await request.json();

    if (body.action === 'rename') {
      const { data: count, error } = await supabase.rpc('rename_tag', {
        p_user_id: user.id,
        p_old_tag: body.old_tag,
        p_new_tag: body.new_tag
      });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        affected: count || 0,
        message: `Renamed "${body.old_tag}" to "${body.new_tag}"`
      });
    }

    if (body.action === 'merge') {
      const { data: count, error } = await supabase.rpc('merge_tags', {
        p_user_id: user.id,
        p_source_tags: body.source_tags,
        p_target_tag: body.target_tag
      });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        affected: count || 0,
        message: `Merged tags into "${body.target_tag}"`
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Tag operation error:', error);
    return NextResponse.json(
      { error: 'Failed to process tag operation' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a tag
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

    const body = await request.json();

    if (!body.tag) {
      return NextResponse.json({ error: 'Tag required' }, { status: 400 });
    }

    const { data: count, error } = await supabase.rpc('delete_tag', {
      p_user_id: user.id,
      p_tag: body.tag
    });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      affected: count || 0,
      message: `Deleted tag "${body.tag}"`
    });

  } catch (error) {
    console.error('Delete tag error:', error);
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
}
