/**
 * API Route: /api/notes/generate
 * Story 2.3: Static+Dynamic Hybrid Notes Generator
 * 
 * Generates comprehensive notes with:
 * 1. STATIC CONTENT: From uploaded PDFs/RAG knowledge base
 * 2. DYNAMIC CONTENT: Latest current affairs from allowed domains via crawl4ai
 * 3. GOVERNMENT SCHEMES: Related schemes from PIB and gov.in sources
 * 
 * This creates end-to-end simplified comprehensive notes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// A4F API Configuration
const A4F_API_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const A4F_PRIMARY_LLM = process.env.A4F_PRIMARY_LLM || 'provider-3/llama-4-scout';
const A4F_EMBEDDING_MODEL = process.env.A4F_EMBEDDING_MODEL || 'provider-5/text-embedding-ada-002';

// VPS RAG Service
const VPS_RAG_URL = process.env.VPS_RAG_URL || 'http://89.117.60.144:8101';
const VPS_NOTES_URL = process.env.VPS_NOTES_URL || 'http://89.117.60.144:8104';
const VPS_CRAWL4AI_URL = process.env.VPS_CRAWL4AI_URL || 'http://89.117.60.144:8105';

// Allowed domains for dynamic content (crawl4ai)
const ALLOWED_DOMAINS = [
  'visionias.in',
  'drishtiias.com',
  'thehindu.com',
  'pib.gov.in',
  'forumias.com',
  'iasgyan.in',
  'pmfias.com',
  'pwonlyias.com',
  'byjus.com',
  'insightsonindia.com',
  'upscpdf.com',
];

interface NotesRequest {
  topic: string;
  subject?: string;
  syllabusNodeId?: string;
  includeCurrentAffairs?: boolean;
  includeSchemes?: boolean;
  detailLevel?: 'summary' | 'detailed' | 'comprehensive';
  userId?: string;
}

interface StaticContent {
  chunks: Array<{
    content: string;
    source: string;
    page?: number;
    relevanceScore: number;
  }>;
  totalChunks: number;
}

interface DynamicContent {
  currentAffairs: Array<{
    title: string;
    content: string;
    source: string;
    date?: string;
    url?: string;
  }>;
  governmentSchemes: Array<{
    name: string;
    description: string;
    source: string;
  }>;
}

interface GeneratedNotes {
  id: string;
  topic: string;
  staticContent: string;
  dynamicContent: string;
  combinedNotes: string;
  sources: string[];
  generatedAt: string;
  wordCount: number;
  readingTimeMinutes: number;
}

// Validate domain is allowed for crawling
function isAllowedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    
    if (hostname.endsWith('.gov.in') || hostname.endsWith('.nic.in')) {
      return true;
    }
    
    return ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Generate embeddings for semantic search
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${A4F_API_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${A4F_API_KEY}`,
    },
    body: JSON.stringify({
      model: A4F_EMBEDDING_MODEL,
      input: text,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Search RAG knowledge base for static content
async function searchStaticContent(topic: string, subject?: string): Promise<StaticContent> {
  const supabase = getSupabaseClient();
  
  try {
    // Try VPS RAG service first
    const ragResponse = await fetch(`${VPS_RAG_URL}/documents/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: topic,
        top_k: 10,
        filters: subject ? { subject } : undefined,
      }),
    });
    
    if (ragResponse.ok) {
      const results = await ragResponse.json();
      return {
        chunks: results.map((r: { content: string; metadata?: { source?: string; page?: number }; score?: number }) => ({
          content: r.content,
          source: r.metadata?.source || 'RAG',
          page: r.metadata?.page,
          relevanceScore: r.score || 0.8,
        })),
        totalChunks: results.length,
      };
    }
  } catch (error) {
    console.warn('VPS RAG service unavailable, falling back to direct DB search');
  }
  
  // Fallback: Direct database search with embeddings
  try {
    const queryEmbedding = await generateEmbedding(topic);
    
    // Vector similarity search
    const { data: chunks, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 10,
    });
    
    if (error) {
      // Fallback to text search if vector search fails
      const { data: textChunks } = await supabase
        .from('knowledge_chunks')
        .select('chunk_text, metadata, source_page')
        .textSearch('chunk_text', topic)
        .limit(10);
      
      return {
        chunks: (textChunks || []).map((c: { chunk_text: string; metadata?: { filename?: string }; source_page?: number }) => ({
          content: c.chunk_text,
          source: c.metadata?.filename || 'Knowledge Base',
          page: c.source_page,
          relevanceScore: 0.6,
        })),
        totalChunks: textChunks?.length || 0,
      };
    }
    
    return {
      chunks: (chunks || []).map((c: { chunk_text: string; metadata?: { filename?: string }; source_page?: number; similarity?: number }) => ({
        content: c.chunk_text,
        source: c.metadata?.filename || 'Knowledge Base',
        page: c.source_page,
        relevanceScore: c.similarity || 0.8,
      })),
      totalChunks: chunks?.length || 0,
    };
    
  } catch (error) {
    console.error('Static content search failed:', error);
    return { chunks: [], totalChunks: 0 };
  }
}

// Fetch dynamic current affairs from allowed domains via crawl4ai VPS service
async function fetchDynamicContent(topic: string): Promise<DynamicContent> {
  const currentAffairs: DynamicContent['currentAffairs'] = [];
  const governmentSchemes: DynamicContent['governmentSchemes'] = [];
  
  // Use crawl4ai VPS service for fetching current affairs
  try {
    // Crawl Drishti IAS for current affairs
    const drishtiResponse = await fetch(`${VPS_CRAWL4AI_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://www.drishtiias.com/?s=${encodeURIComponent(topic)}`,
        extract_links: false,
      }),
    });
    
    if (drishtiResponse.ok) {
      const drishtiData = await drishtiResponse.json();
      if (drishtiData.success && drishtiData.content) {
        currentAffairs.push({
          title: drishtiData.title || `${topic} - Drishti IAS`,
          content: drishtiData.content.substring(0, 1000),
          source: 'drishtiias.com',
          url: `https://www.drishtiias.com/?s=${encodeURIComponent(topic)}`,
        });
      }
    }
    
    // Crawl Insights on India
    const insightsResponse = await fetch(`${VPS_CRAWL4AI_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://www.insightsonindia.com/?s=${encodeURIComponent(topic)}`,
        extract_links: false,
      }),
    });
    
    if (insightsResponse.ok) {
      const insightsData = await insightsResponse.json();
      if (insightsData.success && insightsData.content) {
        currentAffairs.push({
          title: insightsData.title || `${topic} - Insights on India`,
          content: insightsData.content.substring(0, 1000),
          source: 'insightsonindia.com',
          url: `https://www.insightsonindia.com/?s=${encodeURIComponent(topic)}`,
        });
      }
    }
    
    // Crawl PIB for government schemes
    const pibResponse = await fetch(`${VPS_CRAWL4AI_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://pib.gov.in/AllRelease.aspx?search=${encodeURIComponent(topic)}`,
        extract_links: false,
      }),
    });
    
    if (pibResponse.ok) {
      const pibData = await pibResponse.json();
      if (pibData.success && pibData.content) {
        governmentSchemes.push({
          name: pibData.title || `${topic} - PIB`,
          description: pibData.content.substring(0, 800),
          source: 'pib.gov.in',
        });
      }
    }
    
  } catch (error) {
    console.warn('crawl4ai VPS service unavailable, falling back to search:', error);
    
    // Fallback: Use VPS search service
    const VPS_SEARCH_URL = process.env.VPS_SEARCH_URL || 'http://89.117.60.144:8102';
    try {
      const searchResponse = await fetch(`${VPS_SEARCH_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `${topic} UPSC current affairs 2024 2025`,
          max_results: 5,
        }),
      });
      
      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        for (const result of searchResults.results || []) {
          if (isAllowedDomain(result.url)) {
            currentAffairs.push({
              title: result.title,
              content: result.snippet || result.description,
              source: new URL(result.url).hostname,
              url: result.url,
            });
          }
        }
      }
    } catch (searchError) {
      console.warn('Search fallback also failed:', searchError);
    }
  }
  
  return { currentAffairs, governmentSchemes };
}

// Generate comprehensive notes using AI
async function generateNotes(
  topic: string,
  staticContent: StaticContent,
  dynamicContent: DynamicContent,
  detailLevel: string
): Promise<{ staticNotes: string; dynamicNotes: string; combinedNotes: string }> {
  
  // Prepare static content summary
  const staticSummary = staticContent.chunks
    .map(c => c.content)
    .join('\n\n---\n\n')
    .substring(0, 8000);
  
  // Prepare dynamic content summary
  const caContent = dynamicContent.currentAffairs
    .map(ca => `**${ca.title}** (${ca.source})\n${ca.content}`)
    .join('\n\n');
  
  const schemeContent = dynamicContent.governmentSchemes
    .map(s => `**${s.name}**\n${s.description}`)
    .join('\n\n');
  
  const dynamicSummary = `## Latest Current Affairs
${caContent}

## Related Government Schemes
${schemeContent}`;
  
  // Word count targets based on detail level
  const wordTargets = {
    summary: 300,
    detailed: 600,
    comprehensive: 1000,
  };
  const targetWords = wordTargets[detailLevel as keyof typeof wordTargets] || 500;
  
  // Generate AI-powered notes
  const prompt = `You are an expert UPSC educator. Generate comprehensive notes on "${topic}" for UPSC Civil Services preparation.

**STATIC CONTENT (from standard reference books):**
${staticSummary || 'No static content available for this topic.'}

**DYNAMIC CONTENT (latest updates):**
${dynamicSummary || 'No recent updates available.'}

**Instructions:**
1. Create clear, simplified notes in easy-to-understand language
2. Target approximately ${targetWords} words
3. Structure the notes with:
   - Introduction/Overview
   - Key Concepts
   - Important Facts and Figures
   - UPSC Relevance
4. At the end, add a "DYNAMIC UPDATES" section with:
   - Latest Current Affairs relevant to this topic
   - Related Government Schemes
   - Recent developments (2024-2025)
5. Use bullet points for easy revision
6. Highlight UPSC important terms in **bold**
7. Include relevant examples and case studies

Generate the notes now:`;

  try {
    const response = await fetch(`${A4F_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${A4F_API_KEY}`,
      },
      body: JSON.stringify({
        model: A4F_PRIMARY_LLM,
        messages: [
          { role: 'system', content: 'You are an expert UPSC Civil Services exam preparation tutor. Generate clear, comprehensive, and exam-focused notes.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const combinedNotes = data.choices?.[0]?.message?.content || '';
    
    // Split notes into static and dynamic parts
    const dynamicIndex = combinedNotes.indexOf('DYNAMIC UPDATES');
    let staticNotes = combinedNotes;
    let dynamicNotes = '';
    
    if (dynamicIndex > -1) {
      staticNotes = combinedNotes.substring(0, dynamicIndex).trim();
      dynamicNotes = combinedNotes.substring(dynamicIndex).trim();
    }
    
    return { staticNotes, dynamicNotes, combinedNotes };
    
  } catch (error) {
    console.error('AI notes generation failed:', error);
    
    // Fallback: Return structured but non-AI generated notes
    const staticChunkPoints = staticContent.chunks.slice(1, 4).map(c => `- ${c.content.substring(0, 200)}...`).join('\n');
    const staticNotes = staticContent.chunks.length > 0
      ? `# ${topic}

## Overview

${staticContent.chunks[0].content}

## Key Points

${staticChunkPoints}`
      : `# ${topic}\n\nNo static content available. Please upload relevant reference materials.`;
    
    const dynamicNotes = dynamicContent.currentAffairs.length > 0 || dynamicContent.governmentSchemes.length > 0
      ? `## DYNAMIC UPDATES

### Current Affairs
${caContent}

### Government Schemes
${schemeContent}`
      : '## DYNAMIC UPDATES\n\nNo recent updates available.';
    
    return {
      staticNotes,
      dynamicNotes,
      combinedNotes: `${staticNotes}\n\n${dynamicNotes}`,
    };
  }
}

// POST: Generate notes for a topic
export async function POST(request: NextRequest) {
  try {
    const body: NotesRequest = await request.json();
    const {
      topic,
      subject,
      syllabusNodeId,
      includeCurrentAffairs = true,
      includeSchemes = true,
      detailLevel = 'detailed',
      userId,
    } = body;
    
    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    // Step 1: Fetch static content from knowledge base (RAG)
    console.log(`Fetching static content for: ${topic}`);
    const staticContent = await searchStaticContent(topic, subject);
    
    // Step 2: Fetch dynamic content (current affairs, schemes)
    let dynamicContent: DynamicContent = { currentAffairs: [], governmentSchemes: [] };
    if (includeCurrentAffairs || includeSchemes) {
      console.log(`Fetching dynamic content for: ${topic}`);
      dynamicContent = await fetchDynamicContent(topic);
      
      // Filter based on user preferences
      if (!includeCurrentAffairs) {
        dynamicContent.currentAffairs = [];
      }
      if (!includeSchemes) {
        dynamicContent.governmentSchemes = [];
      }
    }
    
    // Step 3: Generate comprehensive notes
    console.log(`Generating notes for: ${topic}`);
    const { staticNotes, dynamicNotes, combinedNotes } = await generateNotes(
      topic,
      staticContent,
      dynamicContent,
      detailLevel
    );
    
    // Calculate metrics
    const wordCount = combinedNotes.split(/\s+/).length;
    const readingTimeMinutes = Math.ceil(wordCount / 200);
    
    // Collect sources
    const sources = [
      ...staticContent.chunks.map(c => c.source),
      ...dynamicContent.currentAffairs.map(ca => ca.source),
      ...dynamicContent.governmentSchemes.map(s => s.source),
    ].filter((v, i, a) => a.indexOf(v) === i); // Unique sources
    
    // Step 4: Store generated notes in database
    const { data: savedNotes, error: saveError } = await supabase
      .from('comprehensive_notes')
      .insert({
        topic,
        syllabus_node_id: syllabusNodeId,
        summary: staticNotes.substring(0, 500),
        detailed_content: staticNotes,
        comprehensive_content: combinedNotes,
        sources,
        key_facts: {
          wordCount,
          readingTimeMinutes,
          staticChunksUsed: staticContent.totalChunks,
          currentAffairsCount: dynamicContent.currentAffairs.length,
          schemesCount: dynamicContent.governmentSchemes.length,
        },
      })
      .select('id')
      .single();
    
    const notesId = savedNotes?.id || `temp-${Date.now()}`;
    
    const result: GeneratedNotes = {
      id: notesId,
      topic,
      staticContent: staticNotes,
      dynamicContent: dynamicNotes,
      combinedNotes,
      sources,
      generatedAt: new Date().toISOString(),
      wordCount,
      readingTimeMinutes,
    };
    
    return NextResponse.json({
      success: true,
      notes: result,
      metadata: {
        staticChunksUsed: staticContent.totalChunks,
        currentAffairsCount: dynamicContent.currentAffairs.length,
        schemesCount: dynamicContent.governmentSchemes.length,
        detailLevel,
      },
    });
    
  } catch (error) {
    console.error('Notes generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Notes generation failed',
      },
      { status: 500 }
    );
  }
}

// GET: Retrieve existing notes
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const notesId = searchParams.get('id');
  
  const supabase = getSupabaseClient();
  
  if (notesId) {
    // Get specific notes by ID
    const { data, error } = await supabase
      .from('comprehensive_notes')
      .select('*')
      .eq('id', notesId)
      .single();
    
    if (error) {
      return NextResponse.json({ error: 'Notes not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, notes: data });
  }
  
  if (topic) {
    // Search for notes by topic
    const { data, error } = await supabase
      .from('comprehensive_notes')
      .select('id, topic, summary, created_at, key_facts')
      .ilike('topic', `%${topic}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, results: data });
  }
  
  // Return recent notes
  const { data, error } = await supabase
    .from('comprehensive_notes')
    .select('id, topic, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, notes: data });
}
