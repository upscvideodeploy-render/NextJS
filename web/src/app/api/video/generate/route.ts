/**
 * API Route: /api/video/generate
 * Stories 3.3-3.4, 4.3, 7.3: Video Generation with Manim/Revideo
 * 
 * Integrates with VPS services:
 * - Manim Renderer (port 5000): Mathematical animations
 * - Revideo Renderer (port 5001): Video composition
 * - Video Orchestrator (port 8103): End-to-end video generation
 * 
 * Video Types:
 * - daily_news: Daily current affairs video
 * - doubt_explainer: Answer to user question
 * - notes_summary: Topic summary video
 * - documentary: Weekly documentary (longer form)
 * - pyq_explanation: PYQ explanation video
 * - topic_short: 60-second topic explainer
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

// VPS Service URLs
const VPS_ORCHESTRATOR_URL = process.env.VPS_ORCHESTRATOR_URL || 'http://89.117.60.144:8103';
const VPS_MANIM_URL = process.env.VPS_MANIM_URL || 'http://89.117.60.144:5000';
const VPS_REVIDEO_URL = process.env.VPS_REVIDEO_URL || 'http://89.117.60.144:5001';

// A4F API for script generation
const A4F_API_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const A4F_PRIMARY_LLM = process.env.A4F_PRIMARY_LLM || 'provider-3/llama-4-scout';

type VideoType = 'daily_news' | 'doubt_explainer' | 'notes_summary' | 'documentary' | 'pyq_explanation' | 'topic_short';

interface VideoRequest {
  type: VideoType;
  content: string; // The topic, question, or script content
  userId?: string;
  priority?: 'low' | 'medium' | 'high';
  options?: {
    duration?: number; // Target duration in seconds
    style?: 'formal' | 'conversational' | 'educational';
    voice?: string;
    includeManim?: boolean;
    syllabusNodeId?: string;
  };
}

interface VideoJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  estimatedCompletionSeconds?: number;
}

// Generate script for video using AI
async function generateScript(type: VideoType, content: string, duration: number): Promise<string> {
  const wordCount = Math.floor(duration * 2.5); // ~150 words per minute
  
  const prompts: Record<VideoType, string> = {
    daily_news: `Write a ${wordCount}-word news anchor script for a daily UPSC current affairs video about: ${content}. Include key facts, UPSC relevance, and conclusion.`,
    doubt_explainer: `Write a ${wordCount}-word educational script explaining this UPSC doubt: "${content}". Make it clear, simple, and include examples.`,
    notes_summary: `Write a ${wordCount}-word video script summarizing this topic for UPSC preparation: ${content}. Cover key points and UPSC relevance.`,
    documentary: `Write a ${wordCount}-word documentary-style script about: ${content}. Include historical context, key events, and significance for UPSC.`,
    pyq_explanation: `Write a ${wordCount}-word script explaining this Previous Year Question and its model answer: ${content}. Include approach and key points.`,
    topic_short: `Write a concise 150-word script for a 60-second explainer video about: ${content}. Get straight to the key facts.`,
  };

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
          { role: 'system', content: 'You are an expert UPSC content writer. Write clear, engaging scripts for educational videos.' },
          { role: 'user', content: prompts[type] },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Script generation failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || content;
  } catch (error) {
    console.error('Script generation error:', error);
    return content; // Fallback to original content
  }
}

// Generate Manim scene specifications
async function generateManimSpecs(script: string, type: VideoType): Promise<object[]> {
  const maxScenes = type === 'topic_short' ? 1 : type === 'doubt_explainer' ? 2 : 4;

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
          { 
            role: 'system', 
            content: `You are a Manim scene designer. Generate JSON scene specifications for educational animations. Return only valid JSON array.` 
          },
          { 
            role: 'user', 
            content: `Generate up to ${maxScenes} Manim scene specifications for this educational script:

"${script.substring(0, 500)}"

Return a JSON array where each scene has:
- scene_type: "text" | "diagram" | "timeline" | "chart" | "map"
- title: string
- content: object (specific to scene_type)
- duration: number (5-15 seconds)
- animation: "Write" | "FadeIn" | "Create"

Example:
[{"scene_type": "text", "title": "Key Point", "content": {"text": "Main idea"}, "duration": 5, "animation": "Write"}]` 
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('Manim spec generation error:', error);
    return [];
  }
}

// Submit job to Video Orchestrator
async function submitToOrchestrator(
  jobId: string,
  type: VideoType,
  script: string,
  manimSpecs: object[],
  options: VideoRequest['options']
): Promise<VideoJob> {
  try {
    const response = await fetch(`${VPS_ORCHESTRATOR_URL}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: jobId,
        job_type: type,
        script,
        manim_scenes: manimSpecs,
        style: options?.style || 'educational',
        duration: options?.duration || 60,
        voice: options?.voice || 'default',
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/video/webhook`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Orchestrator error: ${error}`);
    }

    const result = await response.json();
    return {
      id: jobId,
      status: 'queued',
      progress: 0,
      estimatedCompletionSeconds: result.estimated_time || 120,
    };
  } catch (error) {
    console.error('Orchestrator submission error:', error);
    
    // Fallback: Create job in database queue for background processing
    return {
      id: jobId,
      status: 'queued',
      progress: 0,
      estimatedCompletionSeconds: 180,
    };
  }
}

// POST: Create video generation job
export async function POST(request: NextRequest) {
  try {
    const body: VideoRequest = await request.json();
    const { type, content, userId, priority = 'medium', options = {} } = body;

    if (!type || !content) {
      return NextResponse.json(
        { error: 'type and content are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const duration = options.duration || (type === 'topic_short' ? 60 : type === 'documentary' ? 300 : 120);

    // Step 1: Generate script
    console.log(`Generating script for ${type} video...`);
    const script = await generateScript(type, content, duration);

    // Step 2: Generate Manim scene specs (if enabled)
    let manimSpecs: object[] = [];
    if (options.includeManim !== false) {
      console.log('Generating Manim scene specifications...');
      manimSpecs = await generateManimSpecs(script, type);
    }

    // Step 3: Create job record in database
    const { data: job, error: dbError } = await supabase
      .from('jobs')
      .insert({
        user_id: userId,
        job_type: type,
        status: 'queued',
        priority,
        payload: {
          content,
          script,
          manim_scenes: manimSpecs,
          options,
        },
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const jobId = job.id;

    // Step 4: Submit to Video Orchestrator
    console.log(`Submitting job ${jobId} to Video Orchestrator...`);
    const videoJob = await submitToOrchestrator(jobId, type, script, manimSpecs, options);

    return NextResponse.json({
      success: true,
      job: videoJob,
      script: script.substring(0, 200) + '...',
      manimScenes: manimSpecs.length,
    });

  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Video generation failed',
      },
      { status: 500 }
    );
  }
}

// GET: Check video job status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const userId = searchParams.get('userId');

  const supabase = getSupabaseClient();

  if (jobId) {
    // Get specific job status
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Also check orchestrator status
    try {
      const orchestratorResponse = await fetch(`${VPS_ORCHESTRATOR_URL}/status/${jobId}`);
      if (orchestratorResponse.ok) {
        const orchestratorStatus = await orchestratorResponse.json();
        return NextResponse.json({
          success: true,
          job: {
            id: job.id,
            type: job.job_type,
            status: job.status,
            progress: orchestratorStatus.progress || 0,
            videoUrl: job.result?.video_url || orchestratorStatus.output_url,
            thumbnailUrl: job.result?.thumbnail_url,
            error: job.error,
            createdAt: job.created_at,
            completedAt: job.completed_at,
          },
        });
      }
    } catch {
      // Orchestrator unavailable, return DB status only
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        type: job.job_type,
        status: job.status,
        videoUrl: job.result?.video_url,
        thumbnailUrl: job.result?.thumbnail_url,
        error: job.error,
        createdAt: job.created_at,
        completedAt: job.completed_at,
      },
    });
  }

  if (userId) {
    // Get user's jobs
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, job_type, status, created_at, completed_at, result')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      jobs: jobs?.map(j => ({
        id: j.id,
        type: j.job_type,
        status: j.status,
        videoUrl: j.result?.video_url,
        createdAt: j.created_at,
        completedAt: j.completed_at,
      })),
    });
  }

  // Get queue stats
  const { data: stats } = await supabase.rpc('get_queue_stats');
  return NextResponse.json({ success: true, stats });
}
