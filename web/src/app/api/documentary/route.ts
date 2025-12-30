/**
 * Story 10.1: Documentary Script Generator - Long-Form Content
 * AC 1-10: Generate 3-hour documentary-style lecture scripts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const PRIMARY_MODEL = process.env.A4F_PRIMARY_MODEL || 'provider-3/llama-4-scout';
const VPS_RAG_URL = process.env.VPS_RAG_URL || 'http://89.117.60.144:8101';

// AC 3: Target 2-3 hours = 15000-20000 words
const DEFAULT_DURATION_MINUTES = 180;
const WORDS_PER_MINUTE = 100;
const DEFAULT_CHAPTER_COUNT = 9;

// AC 4: Script structure
interface ScriptStructure {
  introduction: {
    narration: string;
    visual_markers: VisualMarker[];
    duration_minutes: number;
    learning_objectives: string[];
  };
  chapters: ChapterContent[];
  conclusion: {
    narration: string;
    visual_markers: VisualMarker[];
    duration_minutes: number;
    key_takeaways: string[];
    exam_relevance: string;
    next_steps: string[];
  };
}

// AC 6: Visual markers
interface VisualMarker {
  type: 'DIAGRAM' | 'TIMELINE' | 'MAP' | 'INTERVIEW_CLIP' | 'CHART' | 'IMAGE';
  description: string;
  position: number; // character position in narration
  suggested_duration_seconds?: number;
}

// AC 8: Voice segments
interface VoiceSegment {
  voice: 'narrator' | 'expert';
  text: string;
  start_pos: number;
  end_pos: number;
}

interface ChapterContent {
  chapter_number: number;
  title: string;
  narration: string;
  visual_markers: VisualMarker[];
  voice_segments: VoiceSegment[];
  word_count: number;
  duration_minutes: number;
}

// AC 5: RAG source
interface RAGSource {
  chunk_id: string;
  source: string;
  content: string;
  relevance_score: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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
      case 'generate':
        return await generateDocumentaryScript(user.id, body, supabase, startTime);
      case 'get_script':
        return await getScript(body.script_id, supabase);
      case 'list_scripts':
        return await listScripts(user.id, body, supabase);
      case 'review':
        return await reviewScript(body, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Story 10.1] Documentary API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// AC 1, 2, 3, 4, 5, 6, 7, 8, 9: Generate documentary script
async function generateDocumentaryScript(
  userId: string,
  body: any,
  supabase: any,
  startTime: number
) {
  const { 
    topic, 
    topic_category,
    target_duration = DEFAULT_DURATION_MINUTES,
    voice_style = 'documentary'
  } = body;

  // AC 2: Validate topic input
  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    return NextResponse.json({ 
      error: 'Topic is required (minimum 3 characters)' 
    }, { status: 400 });
  }

  try {
    // Step 1: Create script record
    const { data: scriptId, error: createError } = await supabase.rpc(
      'create_documentary_script',
      {
        p_user_id: userId,
        p_topic: topic.trim(),
        p_topic_category: topic_category || null,
        p_target_duration: target_duration,
        p_voice_style: voice_style
      }
    );

    if (createError) throw createError;

    // AC 5: Retrieve 10-20 relevant knowledge chunks via RAG
    const ragSources = await fetchRAGSources(topic, topic_category);
    
    if (ragSources.length < 3) {
      // Update script with warning
      await supabase
        .from('documentary_scripts')
        .update({ 
          status: 'failed',
          error_message: 'Insufficient source material. Need at least 3 relevant knowledge chunks.'
        })
        .eq('id', scriptId);
        
      return NextResponse.json({
        error: 'Insufficient source material',
        message: 'Not enough relevant content found for this topic. Try a more specific topic.',
        script_id: scriptId,
        sources_found: ragSources.length
      }, { status: 400 });
    }

    // Step 2: Generate script structure using AI
    const script = await generateScriptWithAI(
      topic,
      topic_category,
      ragSources,
      target_duration,
      voice_style
    );

    // Step 3: Save chapters to database
    for (const chapter of script.chapters) {
      await supabase.rpc('add_documentary_chapter', {
        p_script_id: scriptId,
        p_chapter_number: chapter.chapter_number,
        p_title: chapter.title,
        p_narration: chapter.narration,
        p_visual_markers: chapter.visual_markers,
        p_voice_segments: chapter.voice_segments
      });
    }

    // Step 4: Finalize script with intro, conclusion, sources
    await supabase.rpc('finalize_documentary_script', {
      p_script_id: scriptId,
      p_introduction: script.introduction,
      p_conclusion: script.conclusion,
      p_rag_sources: ragSources.map(s => ({
        chunk_id: s.chunk_id,
        source: s.source,
        relevance_score: s.relevance_score
      }))
    });

    // AC 10: Quality check
    const qualityResult = await runQualityCheck(script, topic, supabase);
    
    await supabase.rpc('review_documentary_script', {
      p_script_id: scriptId,
      p_quality_score: qualityResult.score,
      p_quality_feedback: qualityResult.feedback
    });

    const generationTime = Math.round((Date.now() - startTime) / 1000);

    // Update generation metadata
    await supabase
      .from('documentary_scripts')
      .update({
        generation_model: PRIMARY_MODEL,
        generation_time_seconds: generationTime
      })
      .eq('id', scriptId);

    return NextResponse.json({
      success: true,
      script_id: scriptId,
      topic,
      chapter_count: script.chapters.length,
      total_word_count: script.chapters.reduce((sum, c) => sum + c.word_count, 0),
      estimated_duration_minutes: script.chapters.reduce((sum, c) => sum + c.duration_minutes, 0) + 15, // +intro+conclusion
      quality_score: qualityResult.score,
      sources_used: ragSources.length,
      generation_time_seconds: generationTime
    });

  } catch (error: any) {
    console.error('[Documentary] Generation error:', error);
    return NextResponse.json({
      error: 'Generation failed',
      message: error.message || 'An error occurred during script generation'
    }, { status: 500 });
  }
}

// AC 5: Fetch RAG sources (10-20 chunks)
async function fetchRAGSources(topic: string, category?: string): Promise<RAGSource[]> {
  try {
    const queryParts = [topic];
    if (category) queryParts.push(category);
    
    const response = await fetch(`${VPS_RAG_URL}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: queryParts.join(' '),
        top_k: 20, // AC 5: 10-20 chunks
        filters: category ? { category } : undefined
      })
    });

    if (!response.ok) {
      console.warn('[RAG] Retrieval failed:', response.status);
      return [];
    }

    const data = await response.json();
    const chunks = data.chunks || data.results || [];
    
    return chunks.slice(0, 20).map((chunk: any, index: number) => ({
      chunk_id: chunk.id || `chunk_${index}`,
      source: chunk.source || chunk.metadata?.source || 'Unknown',
      content: chunk.content || chunk.text || '',
      relevance_score: chunk.score || chunk.similarity || 0.8
    }));
  } catch (error) {
    console.error('[RAG] Error fetching sources:', error);
    return [];
  }
}

// AC 3, 4, 6, 7, 8: Generate full script with AI
async function generateScriptWithAI(
  topic: string,
  category: string | undefined,
  ragSources: RAGSource[],
  targetDuration: number,
  voiceStyle: string
): Promise<ScriptStructure> {
  const targetWords = targetDuration * WORDS_PER_MINUTE;
  const chapterCount = DEFAULT_CHAPTER_COUNT;
  const wordsPerChapter = Math.floor((targetWords - 3000) / chapterCount); // Reserve 3000 for intro/conclusion

  // Prepare context from RAG sources
  const sourceContext = ragSources
    .map((s, i) => `[Source ${i + 1}: ${s.source}]\n${s.content}`)
    .join('\n\n');

  // AC 7: Documentary narration style prompt
  const styleInstructions = voiceStyle === 'documentary' 
    ? 'Use a documentary narration style with dramatic pauses, descriptive language, and engaging storytelling. Include moments for visual emphasis marked with [PAUSE].'
    : voiceStyle === 'academic'
    ? 'Use an academic, educational tone with clear explanations and structured arguments.'
    : 'Use a conversational, accessible tone that makes complex topics easy to understand.';

  // Generate introduction
  const introPrompt = `You are creating a ${targetDuration}-minute documentary lecture about "${topic}"${category ? ` (Category: ${category})` : ''}.

${styleInstructions}

Generate the INTRODUCTION (approximately 1000 words, 10 minutes) that includes:
1. An engaging hook that captures attention
2. Topic overview and historical context
3. Why this topic matters for UPSC aspirants
4. Clear learning objectives (4-5 points)
5. Brief preview of what will be covered

Use visual markers like [DIAGRAM: description], [TIMELINE: description], [MAP: description] where appropriate.

Source material for context:
${sourceContext.substring(0, 8000)}

Output as JSON:
{
  "narration": "full narration text with [VISUAL] markers",
  "learning_objectives": ["objective 1", "objective 2", ...],
  "visual_markers": [{"type": "DIAGRAM", "description": "...", "position": 0}]
}`;

  const introResponse = await callAI(introPrompt);
  let introduction;
  try {
    introduction = JSON.parse(extractJSON(introResponse));
  } catch {
    introduction = {
      narration: introResponse,
      learning_objectives: ['Understand the key concepts', 'Analyze historical significance'],
      visual_markers: []
    };
  }
  introduction.duration_minutes = 10;

  // Generate chapters
  const chapters: ChapterContent[] = [];
  
  const chapterPlanPrompt = `Create a ${chapterCount}-chapter outline for a documentary about "${topic}".
Each chapter should cover a distinct sub-topic or chronological period.
Output as JSON array: [{"number": 1, "title": "...", "focus": "..."}]`;
  
  const chapterPlanResponse = await callAI(chapterPlanPrompt);
  let chapterPlan;
  try {
    chapterPlan = JSON.parse(extractJSON(chapterPlanResponse));
  } catch {
    chapterPlan = Array.from({ length: chapterCount }, (_, i) => ({
      number: i + 1,
      title: `Chapter ${i + 1}: Key Aspect ${i + 1}`,
      focus: `Exploration of aspect ${i + 1}`
    }));
  }

  // Generate each chapter
  for (let i = 0; i < Math.min(chapterPlan.length, chapterCount); i++) {
    const chapter = chapterPlan[i];
    
    const chapterPrompt = `You are writing Chapter ${chapter.number}: "${chapter.title}" for a documentary about "${topic}".

${styleInstructions}

Write approximately ${wordsPerChapter} words (${Math.round(wordsPerChapter / 100)} minutes of narration).

Focus: ${chapter.focus}

Requirements:
1. Detailed, engaging narration suitable for documentary
2. Include visual markers: [DIAGRAM: description], [TIMELINE: description], [MAP: description], [INTERVIEW_CLIP: description]
3. AC 8: Occasionally switch between [NARRATOR] and [EXPERT] voice perspectives
4. Include specific facts, dates, names, and UPSC-relevant details
5. End with a transition to the next chapter

Source material:
${sourceContext.substring(i * 2000, (i + 1) * 2000 + 2000)}

Output as JSON:
{
  "narration": "full chapter narration with markers",
  "visual_markers": [{"type": "DIAGRAM", "description": "...", "position": 0}],
  "voice_segments": [{"voice": "narrator", "text": "...", "start_pos": 0, "end_pos": 100}]
}`;

    const chapterResponse = await callAI(chapterPrompt);
    let chapterData;
    try {
      chapterData = JSON.parse(extractJSON(chapterResponse));
    } catch {
      chapterData = {
        narration: chapterResponse,
        visual_markers: [],
        voice_segments: [{ voice: 'narrator', text: chapterResponse, start_pos: 0, end_pos: chapterResponse.length }]
      };
    }

    const wordCount = chapterData.narration.split(/\s+/).filter(Boolean).length;
    
    chapters.push({
      chapter_number: i + 1,
      title: chapter.title,
      narration: chapterData.narration,
      visual_markers: chapterData.visual_markers || [],
      voice_segments: chapterData.voice_segments || [],
      word_count: wordCount,
      duration_minutes: Math.ceil(wordCount / WORDS_PER_MINUTE)
    });
  }

  // Generate conclusion
  const conclusionPrompt = `Write the CONCLUSION (approximately 500 words, 5 minutes) for the documentary about "${topic}".

${styleInstructions}

Include:
1. Recap of key takeaways (5-7 bullet points)
2. UPSC exam relevance and how to approach this topic
3. Suggested next steps for deeper study
4. Inspiring closing statement

Output as JSON:
{
  "narration": "full conclusion narration",
  "key_takeaways": ["takeaway 1", ...],
  "exam_relevance": "...",
  "next_steps": ["step 1", ...],
  "visual_markers": []
}`;

  const conclusionResponse = await callAI(conclusionPrompt);
  let conclusion;
  try {
    conclusion = JSON.parse(extractJSON(conclusionResponse));
  } catch {
    conclusion = {
      narration: conclusionResponse,
      key_takeaways: ['Review the main concepts', 'Practice with PYQs'],
      exam_relevance: 'This topic is frequently asked in UPSC Mains.',
      next_steps: ['Study related topics', 'Attempt practice questions'],
      visual_markers: []
    };
  }
  conclusion.duration_minutes = 5;

  return { introduction, chapters, conclusion };
}

// AC 10: Quality check using LLM
async function runQualityCheck(
  script: ScriptStructure,
  topic: string,
  supabase: any
): Promise<{ score: number; feedback: any }> {
  const sampleContent = [
    script.introduction.narration.substring(0, 500),
    ...script.chapters.slice(0, 3).map(c => c.narration.substring(0, 300)),
    script.conclusion.narration.substring(0, 300)
  ].join('\n\n---\n\n');

  const qualityPrompt = `Review this documentary script about "${topic}" for quality.

Sample content:
${sampleContent}

Rate on a scale of 0-100 and provide feedback on:
1. Coherence: Does the content flow logically?
2. Flow: Is the narration engaging and well-paced?
3. UPSC Relevance: Is the content appropriate for UPSC preparation?
4. Accuracy: Are facts and information presented accurately?
5. Visual Integration: Are visual markers used effectively?

Output as JSON:
{
  "overall_score": 85,
  "coherence": {"score": 90, "comment": "..."},
  "flow": {"score": 85, "comment": "..."},
  "upsc_relevance": {"score": 88, "comment": "..."},
  "accuracy": {"score": 82, "comment": "..."},
  "visual_integration": {"score": 80, "comment": "..."},
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

  try {
    const response = await callAI(qualityPrompt);
    const result = JSON.parse(extractJSON(response));
    
    return {
      score: (result.overall_score || 75) / 100,
      feedback: {
        coherence: result.coherence,
        flow: result.flow,
        upsc_relevance: result.upsc_relevance,
        accuracy: result.accuracy,
        visual_integration: result.visual_integration,
        suggestions: result.suggestions || []
      }
    };
  } catch (error) {
    console.warn('[Quality Check] Error:', error);
    return {
      score: 0.75,
      feedback: {
        coherence: { score: 75, comment: 'Auto-generated assessment' },
        suggestions: ['Manual review recommended']
      }
    };
  }
}

// Helper: Call A4F API
async function callAI(prompt: string): Promise<string> {
  const response = await fetch(`${A4F_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${A4F_API_KEY}`
    },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert documentary script writer specializing in educational content for UPSC exam preparation. Output valid JSON when requested.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Helper: Extract JSON from response
function extractJSON(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  return text;
}

// Get single script with chapters
async function getScript(scriptId: string, supabase: any) {
  if (!scriptId) {
    return NextResponse.json({ error: 'Script ID required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_documentary_script', {
    p_script_id: scriptId
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  }

  return NextResponse.json(data[0]);
}

// List user's scripts
async function listScripts(userId: string, body: any, supabase: any) {
  const { status, limit = 20 } = body;

  const { data, error } = await supabase.rpc('get_user_documentary_scripts', {
    p_user_id: userId,
    p_status: status || null,
    p_limit: limit
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scripts: data || [] });
}

// Manual review/update script quality
async function reviewScript(body: any, supabase: any) {
  const { script_id, quality_score, feedback } = body;

  if (!script_id) {
    return NextResponse.json({ error: 'Script ID required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('review_documentary_script', {
    p_script_id: script_id,
    p_quality_score: quality_score,
    p_quality_feedback: feedback
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET handler for fetching scripts
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get('id');
    const status = searchParams.get('status');

    if (scriptId) {
      return await getScript(scriptId, supabase);
    }

    return await listScripts(user.id, { status }, supabase);
  } catch (error) {
    console.error('[Documentary GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
