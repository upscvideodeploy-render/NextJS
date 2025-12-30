/**
 * API Route: /api/video/webhook
 * Video Orchestrator Webhook Handler
 * 
 * Receives status updates from the VPS Video Orchestrator service
 * and updates job status in the database.
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

interface WebhookPayload {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  stage?: string;
  output_url?: string;
  thumbnail_url?: string;
  error?: string;
  render_time_seconds?: number;
}

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload = await request.json();
    const { job_id, status, progress, stage, output_url, thumbnail_url, error, render_time_seconds } = payload;

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Build update object
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (progress !== undefined) {
      updateData.progress = progress;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.result = {
        video_url: output_url,
        thumbnail_url,
        render_time_seconds,
      };
    }

    if (status === 'failed') {
      updateData.completed_at = new Date().toISOString();
      updateData.error = error || 'Video generation failed';
    }

    // Update job in database
    const { error: dbError } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', job_id);

    if (dbError) {
      console.error('Database update error:', dbError);
      return NextResponse.json(
        { error: 'Failed to update job status' },
        { status: 500 }
      );
    }

    console.log(`Video job ${job_id} updated: ${status}${stage ? ` (${stage})` : ''}`);

    // If completed, also update related tables (e.g., doubt_videos, topic_shorts)
    if (status === 'completed' && output_url) {
      // Get job details to determine type
      const { data: job } = await supabase
        .from('jobs')
        .select('job_type, payload')
        .eq('id', job_id)
        .single();

      if (job) {
        switch (job.job_type) {
          case 'topic_short':
            // Update topic_shorts table
            if (job.payload?.syllabus_node_id) {
              await supabase
                .from('topic_shorts')
                .update({
                  video_url: output_url,
                  status: 'completed',
                  render_time_seconds,
                })
                .eq('syllabus_node_id', job.payload.syllabus_node_id);
            }
            break;

          case 'doubt_explainer':
            // Update doubt_video_renders table if exists
            await supabase
              .from('doubt_video_renders')
              .update({
                output_url,
                status: 'completed',
                render_time_seconds,
              })
              .eq('job_id', job_id);
            break;

          case 'daily_news':
            // Update daily_video table
            await supabase
              .from('daily_videos')
              .update({
                video_url: output_url,
                thumbnail_url,
                status: 'completed',
              })
              .eq('job_id', job_id);
            break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      job_id,
      status,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed',
      },
      { status: 500 }
    );
  }
}

// GET: Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'video-webhook',
    timestamp: new Date().toISOString(),
  });
}
