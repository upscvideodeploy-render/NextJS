import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { doubt_text, input_type, style, video_length, voice_preference } = body;

    // Validation
    if (!doubt_text || doubt_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Doubt text is required' },
        { status: 400 }
      );
    }

    if (doubt_text.length > 2000) {
      return NextResponse.json(
        { error: 'Doubt text must be less than 2000 characters' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role for job creation
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from session (for authenticated requests)
    const authHeader = request.headers.get('authorization');
    let userId = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;

        // Check entitlements (Story 1.9)
        const { data: accessCheck, error: accessError } = await supabase.rpc(
          'check_feature_access',
          {
            p_user_id: userId,
            p_feature_slug: 'doubt_videos',
          }
        );

        if (accessError || !accessCheck || accessCheck.length === 0) {
          return NextResponse.json(
            { error: 'Failed to check entitlements' },
            { status: 500 }
          );
        }

        const access = accessCheck[0];

        if (!access.allowed) {
          return NextResponse.json(
            {
              error: 'Daily doubt limit reached',
              reason: access.reason,
              usage_count: access.usage_count,
              limit_value: access.limit_value,
              upgrade_required: true,
            },
            { status: 403 }
          );
        }

        // Increment usage count
        await supabase.rpc('increment_entitlement_usage', {
          p_user_id: userId,
          p_feature_slug: 'doubt_videos',
        });
      }
    }

    // Create job in queue
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        job_type: 'doubt',
        priority: 'high',
        status: 'queued',
        user_id: userId,
        payload: {
          question: doubt_text,
          input_type: input_type || 'text',
          style: style || 'detailed',
          length: video_length || 60,
          voice: voice_preference || 'default',
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create doubt video job' },
        { status: 500 }
      );
    }

    // Get queue position
    const { data: stats } = await supabase.rpc('get_queue_stats');
    const queuePosition = (stats?.total_queued || 0) + 1;

    // Estimate wait time (rough calculation)
    const estimatedMinutes = Math.ceil(queuePosition * 3); // ~3 min per video average

    return NextResponse.json({
      job_id: job.id,
      queue_position: queuePosition,
      estimated_time_minutes: estimatedMinutes,
      status: 'queued',
    });
  } catch (error: any) {
    console.error('Doubt creation error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
