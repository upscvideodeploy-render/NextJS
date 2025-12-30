/**
 * API Route: /api/daily-ca/fetch
 * Story 3.1: Daily News Scraper - Source Integration
 * 
 * Fetches latest current affairs from allowed UPSC domains via crawl4ai VPS service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VPS_CRAWL4AI_URL = process.env.VPS_CRAWL4AI_URL || 'http://89.117.60.144:8105';

// Initialize Supabase
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// News sources configuration
const NEWS_SOURCES = [
  {
    name: 'Drishti IAS',
    domain: 'drishtiias.com',
    url: 'https://www.drishtiias.com/daily-updates/daily-news-analysis',
    type: 'daily_news',
  },
  {
    name: 'Insights on India',
    domain: 'insightsonindia.com',
    url: 'https://www.insightsonindia.com/category/current-affairs/',
    type: 'daily_news',
  },
  {
    name: 'PIB',
    domain: 'pib.gov.in',
    url: 'https://pib.gov.in/AllReleases.aspx',
    type: 'government',
  },
  {
    name: 'The Hindu',
    domain: 'thehindu.com',
    url: 'https://www.thehindu.com/news/national/',
    type: 'editorial',
  },
];

interface CrawlResult {
  source: string;
  url: string;
  title: string;
  content: string;
  success: boolean;
  crawledAt: string;
}

// Crawl a single source
async function crawlSource(source: typeof NEWS_SOURCES[0]): Promise<CrawlResult> {
  try {
    const response = await fetch(`${VPS_CRAWL4AI_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: source.url,
        extract_links: false,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        source: source.name,
        url: source.url,
        title: data.title || source.name,
        content: data.content?.substring(0, 5000) || '',
        success: data.success,
        crawledAt: new Date().toISOString(),
      };
    }

    return {
      source: source.name,
      url: source.url,
      title: source.name,
      content: '',
      success: false,
      crawledAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Failed to crawl ${source.name}:`, error);
    return {
      source: source.name,
      url: source.url,
      title: source.name,
      content: '',
      success: false,
      crawledAt: new Date().toISOString(),
    };
  }
}

// POST: Fetch current affairs from all sources
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sources = NEWS_SOURCES.map(s => s.domain), saveToDb = true } = body;

    // Filter sources based on request
    const selectedSources = NEWS_SOURCES.filter(s => sources.includes(s.domain));

    // Crawl all sources in parallel
    const results = await Promise.all(selectedSources.map(crawlSource));

    // Filter successful results
    const successfulResults = results.filter(r => r.success && r.content);

    // Save to database if requested
    if (saveToDb && successfulResults.length > 0) {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      for (const result of successfulResults) {
        await supabase
          .from('daily_updates')
          .upsert({
            date: today,
            source_name: result.source,
            source_url: result.url,
            title: result.title,
            content: result.content,
            upsc_relevant: true,
            crawled_at: result.crawledAt,
          }, {
            onConflict: 'date,source_url',
          });
      }
    }

    return NextResponse.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      totalSources: selectedSources.length,
      successfulCrawls: successfulResults.length,
      results: results.map(r => ({
        source: r.source,
        success: r.success,
        contentLength: r.content.length,
      })),
      articles: successfulResults.map(r => ({
        source: r.source,
        title: r.title,
        preview: r.content.substring(0, 300) + '...',
        url: r.url,
      })),
    });
  } catch (error) {
    console.error('Daily CA fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}

// GET: Get today's cached current affairs
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('daily_updates')
    .select('*')
    .eq('date', date)
    .eq('upsc_relevant', true)
    .order('crawled_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    date,
    count: data?.length || 0,
    articles: data || [],
  });
}
