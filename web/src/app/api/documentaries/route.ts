/**
 * Story 10.4: Documentary Library - CDN Delivery & Chapter Navigation
 * API Route: /api/documentaries
 * 
 * Handles:
 * - AC 1: Documentary library with filters
 * - AC 4: Progress tracking and resume
 * - AC 5: Download requests (Pro users)
 * - AC 6: Offline cache management
 * - AC 7: CDN URL generation (Cloudflare)
 * - AC 8: Quality options
 * - AC 9: Transcript download
 * - AC 10: Related content recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://cdn.example.com';

// AC 8: Quality options
const QUALITY_OPTIONS = ['1080p', '720p', '480p'] as const;
type QualityOption = typeof QUALITY_OPTIONS[number];

// AC 6: Max offline cache size
const MAX_OFFLINE_CACHE_MB = 500;

// Types
interface LibraryFilters {
  subject?: string;
  min_duration?: number;
  max_duration?: number;
  topic?: string;
  limit?: number;
  offset?: number;
}

// GET: Fetch documentary library or single documentary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('id');
    const action = searchParams.get('action');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get single documentary with chapters (AC 2, 3)
    if (docId && !action) {
      return await getDocumentaryWithChapters(docId, user?.id);
    }
    
    // Get resume position (AC 4)
    if (docId && action === 'resume') {
      if (!user) {
        return NextResponse.json({ has_progress: false, position: 0 });
      }
      return await getResumePosition(docId, user.id);
    }
    
    // Get related documentaries (AC 10)
    if (docId && action === 'related') {
      return await getRelatedDocumentaries(docId);
    }
    
    // Get library with filters (AC 1)
    const filters: LibraryFilters = {
      subject: searchParams.get('subject') || undefined,
      min_duration: searchParams.get('min_duration') ? parseInt(searchParams.get('min_duration')!) : undefined,
      max_duration: searchParams.get('max_duration') ? parseInt(searchParams.get('max_duration')!) : undefined,
      topic: searchParams.get('topic') || undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    };
    
    return await getDocumentaryLibrary(filters, user?.id);
    
  } catch (error: any) {
    console.error('GET documentaries error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Update progress, request download, manage cache
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action, ...params } = body;
    
    switch (action) {
      case 'update_progress': // AC 4
        return await updateWatchProgress(user.id, params);
      case 'request_download': // AC 5
        return await requestDownload(user.id, params);
      case 'cache_offline': // AC 6
        return await cacheForOffline(user.id, params);
      case 'get_cdn_url': // AC 7
        return await getCDNUrl(params.documentary_id, params.quality);
      case 'get_transcript': // AC 9
        return await getTranscriptUrl(params.documentary_id);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('POST documentaries error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// AC 1: Get documentary library with filters
async function getDocumentaryLibrary(filters: LibraryFilters, userId?: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data, error } = await supabase.rpc('get_documentary_library', {
    p_user_id: userId || null,
    p_subject: filters.subject || null,
    p_min_duration: filters.min_duration || null,
    p_max_duration: filters.max_duration || null,
    p_topic: filters.topic || null,
    p_limit: filters.limit || 20,
    p_offset: filters.offset || 0
  });
  
  if (error) throw error;
  
  // Get available subjects for filter dropdown
  const { data: subjects } = await supabase
    .from('documentary_scripts')
    .select('subject')
    .eq('is_published', true)
    .not('subject', 'is', null);
  
  const uniqueSubjects = [...new Set((subjects || []).map(s => s.subject))];
  
  return NextResponse.json({
    success: true,
    documentaries: data || [],
    filters: {
      subjects: uniqueSubjects,
      durations: [
        { label: 'Under 30 min', min: 0, max: 30 },
        { label: '30-60 min', min: 30, max: 60 },
        { label: '1-2 hours', min: 60, max: 120 },
        { label: 'Over 2 hours', min: 120, max: null }
      ],
      quality_options: QUALITY_OPTIONS // AC 8
    }
  });
}

// AC 2, 3: Get documentary with chapters
async function getDocumentaryWithChapters(docId: string, userId?: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data, error } = await supabase.rpc('get_documentary_with_chapters', {
    p_documentary_id: docId,
    p_user_id: userId || null
  });
  
  if (error) throw error;
  
  if (!data || data.error) {
    return NextResponse.json({ error: 'Documentary not found' }, { status: 404 });
  }
  
  // Add CDN URLs for each quality (AC 7, 8)
  const qualityUrls = QUALITY_OPTIONS.map(q => ({
    quality: q,
    url: generateCDNUrl(docId, q)
  }));
  
  return NextResponse.json({
    success: true,
    ...data,
    quality_options: qualityUrls
  });
}

// AC 4: Get resume position
async function getResumePosition(docId: string, userId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data, error } = await supabase.rpc('get_resume_position', {
    p_user_id: userId,
    p_documentary_id: docId
  });
  
  if (error) throw error;
  
  return NextResponse.json({ success: true, ...data });
}

// AC 4: Update watch progress
async function updateWatchProgress(userId: string, params: any) {
  const { documentary_id, chapter_id, position_seconds, quality, speed } = params;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data, error } = await supabase.rpc('update_watch_progress', {
    p_user_id: userId,
    p_documentary_id: documentary_id,
    p_chapter_id: chapter_id || null,
    p_position_seconds: position_seconds || 0,
    p_quality: quality || '720p',
    p_speed: speed || 1.0
  });
  
  if (error) throw error;
  
  return NextResponse.json({ success: true, ...data });
}

// AC 5: Request download (Pro users only)
async function requestDownload(userId: string, params: any) {
  const { documentary_id, chapter_id, quality } = params;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Check if user is Pro
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();
  
  const isPro = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'premium';
  
  const { data, error } = await supabase.rpc('request_documentary_download', {
    p_user_id: userId,
    p_documentary_id: documentary_id,
    p_chapter_id: chapter_id || null,
    p_quality: quality || '720p',
    p_is_pro: isPro
  });
  
  if (error) throw error;
  
  if (!data.success) {
    return NextResponse.json(data, { status: 403 });
  }
  
  // Generate download URL
  const downloadUrl = generateDownloadUrl(documentary_id, chapter_id, quality);
  
  return NextResponse.json({
    success: true,
    download_id: data.download_id,
    download_url: downloadUrl,
    expires_in: '24 hours'
  });
}

// AC 6: Cache for offline viewing
async function cacheForOffline(userId: string, params: any) {
  const { documentary_id, quality, chapters } = params;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Estimate cache size
  const estimatedSize = estimateCacheSize(quality, chapters?.length || 10);
  
  if (estimatedSize > MAX_OFFLINE_CACHE_MB) {
    return NextResponse.json({
      success: false,
      error: `Cache size ${estimatedSize}MB exceeds limit of ${MAX_OFFLINE_CACHE_MB}MB`,
      suggestion: 'Try caching fewer chapters or lower quality'
    }, { status: 400 });
  }
  
  // Create or update cache entry
  const { error } = await supabase
    .from('documentary_offline_cache')
    .upsert({
      user_id: userId,
      documentary_id,
      quality,
      cached_chapters: chapters || [],
      cache_size_mb: estimatedSize,
      cache_status: 'caching',
      cached_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,documentary_id'
    });
  
  if (error) throw error;
  
  // Return cache manifest for PWA
  return NextResponse.json({
    success: true,
    cache_manifest: {
      documentary_id,
      quality,
      estimated_size_mb: estimatedSize,
      urls_to_cache: generateCacheManifest(documentary_id, quality, chapters)
    }
  });
}

// AC 7: Generate CDN URL
async function getCDNUrl(documentaryId: string, quality: QualityOption = '720p') {
  const url = generateCDNUrl(documentaryId, quality);
  
  return NextResponse.json({
    success: true,
    url,
    quality,
    cdn_provider: 'cloudflare'
  });
}

// AC 9: Get transcript URL
async function getTranscriptUrl(documentaryId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data, error } = await supabase
    .from('documentary_scripts')
    .select('transcript_pdf_url, topic')
    .eq('id', documentaryId)
    .single();
  
  if (error || !data) {
    return NextResponse.json({ error: 'Documentary not found' }, { status: 404 });
  }
  
  if (!data.transcript_pdf_url) {
    // Generate transcript URL if not exists
    const transcriptUrl = `${CDN_BASE_URL}/transcripts/${documentaryId}.pdf`;
    
    return NextResponse.json({
      success: true,
      transcript_url: transcriptUrl,
      title: `${data.topic} - Transcript`,
      status: 'generating'
    });
  }
  
  return NextResponse.json({
    success: true,
    transcript_url: data.transcript_pdf_url,
    title: `${data.topic} - Transcript`,
    status: 'ready'
  });
}

// AC 10: Get related documentaries
async function getRelatedDocumentaries(docId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data, error } = await supabase.rpc('get_related_documentaries', {
    p_documentary_id: docId,
    p_limit: 5
  });
  
  if (error) throw error;
  
  return NextResponse.json({
    success: true,
    related: data || []
  });
}

// Helper: Generate CDN URL (AC 7)
function generateCDNUrl(documentaryId: string, quality: QualityOption): string {
  // In production, this would use Cloudflare CDN with signed URLs
  return `${CDN_BASE_URL}/videos/${documentaryId}/${quality}/stream.m3u8`;
}

// Helper: Generate download URL
function generateDownloadUrl(documentaryId: string, chapterId?: string, quality?: string): string {
  const target = chapterId ? `chapters/${chapterId}` : 'full';
  return `${CDN_BASE_URL}/downloads/${documentaryId}/${target}/${quality || '720p'}.mp4`;
}

// Helper: Estimate cache size (AC 6)
function estimateCacheSize(quality: QualityOption, chapterCount: number): number {
  const mbPerMinute: Record<QualityOption, number> = {
    '1080p': 5,  // ~5MB per minute at 1080p
    '720p': 2.5, // ~2.5MB per minute at 720p
    '480p': 1.2  // ~1.2MB per minute at 480p
  };
  
  const avgChapterMinutes = 15;
  return Math.round(mbPerMinute[quality] * avgChapterMinutes * chapterCount);
}

// Helper: Generate cache manifest for PWA (AC 6)
function generateCacheManifest(documentaryId: string, quality: QualityOption, chapters?: string[]): string[] {
  const urls = [
    generateCDNUrl(documentaryId, quality),
    `${CDN_BASE_URL}/thumbnails/${documentaryId}/poster.jpg`
  ];
  
  if (chapters && chapters.length > 0) {
    chapters.forEach(chapterId => {
      urls.push(`${CDN_BASE_URL}/videos/${documentaryId}/chapters/${chapterId}/${quality}.mp4`);
    });
  }
  
  return urls;
}
