/**
 * Story 9.8: Bookmark Auto-linking API
 * AC 1-4: RAG semantic search for related content
 * AC 10: Background processing within 5 seconds
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Types
interface BookmarkLink {
  content_type: string;
  content_id: string;
  link_type: 'related_topic' | 'related_pyq' | 'related_video' | 'also_bookmarked' | 'cross_subject' | 'similar_concept';
  relevance_score: number;
  metadata?: Record<string, unknown>;
}

interface RelatedContent {
  link_id: string;
  content_type: string;
  content_id: string;
  link_type: string;
  relevance_score: number;
  metadata: Record<string, unknown>;
  title?: string;
  snippet?: string;
}

// AC 4: Similarity threshold
const SIMILARITY_THRESHOLD = 0.7;

// VPS RAG endpoint
const VPS_RAG_URL = process.env.VPS_RAG_URL || 'http://localhost:8000';

// AC 1, 4: Find related content using RAG semantic search
async function findRelatedContent(
  title: string,
  snippet: string,
  contentType: string,
  supabase: any
): Promise<BookmarkLink[]> {
  const links: BookmarkLink[] = [];
  const searchQuery = `${title} ${snippet || ''}`.trim();

  try {
    // AC 1: Call RAG semantic search
    const ragResponse = await fetch(`${VPS_RAG_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        limit: 15,
        threshold: SIMILARITY_THRESHOLD,
        include_types: ['note', 'video', 'topic', 'pyq', 'question']
      }),
      signal: AbortSignal.timeout(4000) // AC 10: Within 5 seconds total
    });

    if (ragResponse.ok) {
      const ragData = await ragResponse.json();
      
      for (const result of (ragData.results || [])) {
        // Skip self-references
        if (result.content_type === contentType && result.content_id === result.id) {
          continue;
        }

        // AC 2: Determine link type based on content type
        let linkType: BookmarkLink['link_type'] = 'similar_concept';
        if (result.content_type === 'pyq') {
          linkType = 'related_pyq';
        } else if (result.content_type === 'video') {
          linkType = 'related_video';
        } else if (result.content_type === 'topic') {
          linkType = 'related_topic';
        }

        // AC 8: Cross-subject detection
        const metadata: Record<string, unknown> = {};
        if (result.subject && result.source_subject && result.subject !== result.source_subject) {
          linkType = 'cross_subject';
          metadata.source_subject = result.source_subject;
          metadata.target_subject = result.subject;
          metadata.topic = result.topic || title;
        }

        // AC 9: PYQ year tracking
        if (result.content_type === 'pyq' && result.year) {
          metadata.year = result.year;
          metadata.paper = result.paper;
        }

        links.push({
          content_type: result.content_type,
          content_id: result.id,
          link_type: linkType,
          relevance_score: Math.min(result.similarity || 0.75, 1.0),
          metadata
        });
      }
    }
  } catch (error) {
    console.error('RAG search error:', error);
    // Fallback to text-based search
    await findTextBasedRelations(title, contentType, links, supabase);
  }

  // AC 2: Find "Also Bookmarked" by others
  await findAlsoBookmarked(title, contentType, links, supabase);

  return links;
}

// Fallback: Text-based relation finding
async function findTextBasedRelations(
  title: string,
  contentType: string,
  links: BookmarkLink[],
  supabase: any
): Promise<void> {
  // Search notes
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title')
    .ilike('title', `%${title}%`)
    .limit(5);

  for (const note of (notes || [])) {
    links.push({
      content_type: 'note',
      content_id: note.id,
      link_type: 'similar_concept',
      relevance_score: 0.6
    });
  }

  // Search topics
  const { data: topics } = await supabase
    .from('syllabus_topics')
    .select('id, title')
    .ilike('title', `%${title}%`)
    .limit(5);

  for (const topic of (topics || [])) {
    links.push({
      content_type: 'topic',
      content_id: topic.id,
      link_type: 'related_topic',
      relevance_score: 0.65
    });
  }
}

// AC 2: Find content also bookmarked by others
async function findAlsoBookmarked(
  title: string,
  contentType: string,
  links: BookmarkLink[],
  supabase: any
): Promise<void> {
  // Find other users who bookmarked similar content
  const { data: similar } = await supabase
    .from('bookmarks')
    .select('content_type, content_id, title')
    .neq('content_type', contentType)
    .ilike('title', `%${title.split(' ')[0]}%`)
    .limit(5);

  for (const item of (similar || [])) {
    links.push({
      content_type: item.content_type,
      content_id: item.content_id,
      link_type: 'also_bookmarked',
      relevance_score: 0.55
    });
  }
}

// AC 3: Process linking for a bookmark (Edge Function alternative)
async function processBookmarkLinking(
  bookmarkId: string,
  title: string,
  snippet: string,
  contentType: string,
  supabase: any
): Promise<{ success: boolean; linksCreated: number }> {
  try {
    // Find related content
    const links = await findRelatedContent(title, snippet, contentType, supabase);

    if (links.length === 0) {
      // Mark as complete even with no links
      await supabase
        .from('bookmark_link_queue')
        .update({ status: 'complete', processed_at: new Date().toISOString() })
        .eq('bookmark_id', bookmarkId);
      
      return { success: true, linksCreated: 0 };
    }

    // AC 5: Save links using RPC
    const { data: count, error } = await supabase.rpc('save_bookmark_links', {
      p_bookmark_id: bookmarkId,
      p_links: links
    });

    if (error) throw error;

    return { success: true, linksCreated: count || links.length };
  } catch (error) {
    console.error('Link processing error:', error);
    
    // Mark as failed
    await supabase
      .from('bookmark_link_queue')
      .update({ 
        status: 'failed', 
        error_message: String(error),
        processed_at: new Date().toISOString()
      })
      .eq('bookmark_id', bookmarkId);

    return { success: false, linksCreated: 0 };
  }
}

// GET: Get related content for a bookmark
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
    const bookmarkId = searchParams.get('bookmark_id');
    const linkType = searchParams.get('type');

    if (!bookmarkId) {
      return NextResponse.json({ error: 'Bookmark ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: bookmark, error: bookmarkError } = await supabase
      .from('bookmarks')
      .select('id, user_id, title, content_type')
      .eq('id', bookmarkId)
      .single();

    if (bookmarkError || !bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    if (bookmark.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // AC 6: Get related content
    const { data: links, error } = await supabase.rpc('get_bookmark_related_content', {
      p_bookmark_id: bookmarkId,
      p_link_type: linkType || null
    });

    if (error) throw error;

    // Enrich with content details
    const enrichedLinks: RelatedContent[] = [];
    for (const link of (links || [])) {
      let title = '';
      let snippet = '';

      // Fetch content details based on type
      if (link.content_type === 'note') {
        const { data } = await supabase
          .from('notes')
          .select('title, content')
          .eq('id', link.content_id)
          .single();
        title = data?.title || 'Note';
        snippet = data?.content?.substring(0, 100) || '';
      } else if (link.content_type === 'topic') {
        const { data } = await supabase
          .from('syllabus_topics')
          .select('title, description')
          .eq('id', link.content_id)
          .single();
        title = data?.title || 'Topic';
        snippet = data?.description?.substring(0, 100) || '';
      }

      enrichedLinks.push({
        ...link,
        title,
        snippet
      });
    }

    // AC 8: Get cross-subject connections
    const { data: crossSubject } = await supabase.rpc('find_cross_subject_links', {
      p_bookmark_id: bookmarkId
    });

    // AC 7: Get suggestions
    const { data: suggestions } = await supabase.rpc('get_bookmark_suggestions', {
      p_user_id: user.id,
      p_limit: 5
    });

    return NextResponse.json({
      bookmark: {
        id: bookmark.id,
        title: bookmark.title,
        content_type: bookmark.content_type
      },
      related_content: enrichedLinks,
      cross_subject_links: crossSubject || [],
      suggestions: suggestions || [],
      total: enrichedLinks.length
    });

  } catch (error) {
    console.error('Get related content error:', error);
    return NextResponse.json(
      { error: 'Failed to get related content' },
      { status: 500 }
    );
  }
}

// POST: Trigger linking for a bookmark (AC 10: Non-blocking)
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

    const { bookmark_id } = await request.json();

    if (!bookmark_id) {
      return NextResponse.json({ error: 'Bookmark ID required' }, { status: 400 });
    }

    // Verify ownership and get details
    const { data: bookmark } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('id', bookmark_id)
      .eq('user_id', user.id)
      .single();

    if (!bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    // AC 10: Process in background (non-blocking response)
    // In production, this would be a Supabase Edge Function or queue worker
    const startTime = Date.now();
    
    const result = await processBookmarkLinking(
      bookmark_id,
      bookmark.title,
      bookmark.snippet || '',
      bookmark.content_type,
      supabase
    );

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: result.success,
      links_created: result.linksCreated,
      processing_time_ms: processingTime,
      within_threshold: processingTime < 5000 // AC 10
    });

  } catch (error) {
    console.error('Trigger linking error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger linking' },
      { status: 500 }
    );
  }
}

// PUT: Process pending queue (for cron/worker)
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get pending jobs
    const { data: jobs, error } = await supabase.rpc('get_pending_link_jobs', {
      p_limit: 10
    });

    if (error) throw error;

    const results = [];
    for (const job of (jobs || [])) {
      const result = await processBookmarkLinking(
        job.bookmark_id,
        job.title || 'Bookmark',
        job.snippet || '',
        job.content_type || 'note',
        supabase
      );
      results.push({ bookmark_id: job.bookmark_id, ...result });
    }

    return NextResponse.json({
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('Process queue error:', error);
    return NextResponse.json(
      { error: 'Failed to process queue' },
      { status: 500 }
    );
  }
}

// AC 9: Get PYQ appearances
export async function PATCH(request: NextRequest) {
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

    const { concept } = await request.json();

    if (!concept) {
      return NextResponse.json({ error: 'Concept required' }, { status: 400 });
    }

    // AC 9: Find PYQ appearances
    const { data: pyqs, error } = await supabase.rpc('find_pyq_appearances', {
      p_concept: concept,
      p_limit: 10
    });

    if (error) throw error;

    return NextResponse.json({
      concept,
      pyq_appearances: pyqs || [],
      total_appearances: pyqs?.length || 0
    });

  } catch (error) {
    console.error('Find PYQ appearances error:', error);
    return NextResponse.json(
      { error: 'Failed to find PYQ appearances' },
      { status: 500 }
    );
  }
}
