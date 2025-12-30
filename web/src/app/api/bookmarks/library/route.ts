/**
 * Story 9.10: Collections & Library API
 * AC 5: Collections CRUD
 * AC 6: Bulk operations
 * AC 8: Statistics
 * AC 9: Export
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Types
interface Collection {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  sort_order: number;
  bookmark_count?: number;
}

interface CreateCollectionRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface BulkOperationRequest {
  action: 'move' | 'add_tags' | 'delete';
  bookmark_ids: string[];
  collection_id?: string;
  tags?: string[];
}

// GET: List collections, stats, or search bookmarks
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

    // AC 8: Get statistics
    if (action === 'stats') {
      const { data, error } = await supabase.rpc('get_bookmark_stats', {
        p_user_id: user.id
      });

      if (error) throw error;
      const stats = data?.[0] || {};

      return NextResponse.json({
        total_bookmarks: stats.total_bookmarks || 0,
        by_type: stats.by_type || {},
        top_tags: stats.top_tags || [],
        current_streak: stats.current_streak || 0,
        longest_streak: stats.longest_streak || 0,
        total_reviews: stats.total_reviews || 0,
        this_week: stats.this_week || 0,
        collections_count: stats.collections_count || 0
      });
    }

    // AC 9: Export bookmarks
    if (action === 'export') {
      const format = searchParams.get('format') || 'json';

      const { data: bookmarks, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('bookmarked_at', { ascending: false });

      if (error) throw error;

      if (format === 'csv') {
        const headers = ['id', 'title', 'content_type', 'snippet', 'tags', 'bookmarked_at'];
        const csv = [
          headers.join(','),
          ...(bookmarks || []).map(b => [
            b.id,
            `"${(b.title || '').replace(/"/g, '""')}"`,
            b.content_type,
            `"${(b.snippet || '').replace(/"/g, '""')}"`,
            `"${(b.tags || []).join(';')}"`,
            b.bookmarked_at
          ].join(','))
        ].join('\n');

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="bookmarks-${new Date().toISOString().split('T')[0]}.csv"`
          }
        });
      }

      return NextResponse.json({
        exported_at: new Date().toISOString(),
        count: bookmarks?.length || 0,
        bookmarks: bookmarks || []
      });
    }

    // AC 2, 3, 4: Advanced search
    if (action === 'search') {
      const query = searchParams.get('q');
      const contentType = searchParams.get('type');
      const collectionId = searchParams.get('collection');
      const tags = searchParams.get('tags')?.split(',').filter(Boolean);
      const dateFrom = searchParams.get('from');
      const dateTo = searchParams.get('to');
      const sortBy = searchParams.get('sort') || 'newest';

      const { data, error } = await supabase.rpc('search_bookmarks', {
        p_user_id: user.id,
        p_query: query || null,
        p_content_type: contentType || null,
        p_collection_id: collectionId || null,
        p_tags: tags?.length ? tags : null,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_sort_by: sortBy,
        p_limit: 100
      });

      if (error) throw error;

      return NextResponse.json({
        bookmarks: data || [],
        total: data?.length || 0,
        filters: { query, contentType, collectionId, tags, dateFrom, dateTo, sortBy }
      });
    }

    // AC 5: List collections
    const { data: collections, error } = await supabase
      .from('bookmark_collections')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Get bookmark counts per collection
    const enrichedCollections: Collection[] = [];
    for (const col of (collections || [])) {
      const { count } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', col.id);

      enrichedCollections.push({
        ...col,
        bookmark_count: count || 0
      });
    }

    return NextResponse.json({
      collections: enrichedCollections
    });

  } catch (error) {
    console.error('Library GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch library data' },
      { status: 500 }
    );
  }
}

// POST: Create collection
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

    const body: CreateCollectionRequest = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    // AC 5: Create collection
    const { data: id, error } = await supabase.rpc('create_collection', {
      p_user_id: user.id,
      p_name: body.name.trim(),
      p_description: body.description || null,
      p_icon: body.icon || '📁',
      p_color: body.color || '#3B82F6'
    });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A collection with this name already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      collection_id: id,
      message: 'Collection created'
    });

  } catch (error) {
    console.error('Create collection error:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}

// PUT: Bulk operations or update collection
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

    // AC 6: Bulk operations
    if (action === 'bulk') {
      const body: BulkOperationRequest = await request.json();

      if (!body.bookmark_ids?.length) {
        return NextResponse.json(
          { error: 'No bookmarks selected' },
          { status: 400 }
        );
      }

      let count = 0;

      switch (body.action) {
        case 'move':
          const { data: moveCount } = await supabase.rpc('bulk_move_to_collection', {
            p_user_id: user.id,
            p_bookmark_ids: body.bookmark_ids,
            p_collection_id: body.collection_id || null
          });
          count = moveCount || 0;
          break;

        case 'add_tags':
          if (!body.tags?.length) {
            return NextResponse.json({ error: 'No tags specified' }, { status: 400 });
          }
          const { data: tagCount } = await supabase.rpc('bulk_add_tags', {
            p_user_id: user.id,
            p_bookmark_ids: body.bookmark_ids,
            p_tags: body.tags
          });
          count = tagCount || 0;
          break;

        case 'delete':
          const { data: deleteCount } = await supabase.rpc('bulk_delete_bookmarks', {
            p_user_id: user.id,
            p_bookmark_ids: body.bookmark_ids
          });
          count = deleteCount || 0;
          break;
      }

      return NextResponse.json({
        success: true,
        affected: count,
        action: body.action
      });
    }

    // Update collection
    const body = await request.json();
    const collectionId = searchParams.get('id');

    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('bookmark_collections')
      .update({
        name: body.name,
        description: body.description,
        icon: body.icon,
        color: body.color,
        updated_at: new Date().toISOString()
      })
      .eq('id', collectionId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Collection updated' });

  } catch (error) {
    console.error('Library PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update' },
      { status: 500 }
    );
  }
}

// DELETE: Delete collection
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
    const collectionId = searchParams.get('id');

    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('bookmark_collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Collection deleted' });

  } catch (error) {
    console.error('Delete collection error:', error);
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }
}
