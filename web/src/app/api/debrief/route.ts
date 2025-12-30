/**
 * Interview Debrief API - Story 13.2
 * Video Debrief Generation
 * 
 * AC 1: Triggered after interview ends
 * AC 2: LLM analysis of transcript
 * AC 3: Video structure (summary, highlights, improvements)
 * AC 4: Manim visualizations
 * AC 5: Duration 5-8 minutes
 * AC 6: Render time <5 minutes
 * AC 7: Notification "debrief ready"
 * AC 8: Archive to history
 * AC 9: Share with mentor
 * AC 10: Compare with previous scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const a4fApiKey = process.env.A4F_API_KEY!;
const a4fBaseUrl = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const vpsManimUrl = process.env.VPS_MANIM_URL || 'http://localhost:3002';
const vpsRevideoUrl = process.env.VPS_REVIDEO_URL || 'http://localhost:3004';

// AC 5: Duration targets
const DEBRIEF_DURATION = { min: 300, max: 480 }; // 5-8 minutes

// AC 6: Render time target
const MAX_RENDER_TIME = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    // Get debrief by session
    if (action === 'by-session') {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

      const { data, error } = await supabase
        .from('interview_debriefs')
        .select(`
          *,
          debrief_sections(*),
          mentor_feedback(*)
        `)
        .eq('session_id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return NextResponse.json({ success: true, debrief: data });
    }

    // Get debrief by ID
    if (action === 'detail') {
      const debriefId = searchParams.get('id');
      if (!debriefId) return NextResponse.json({ error: 'Debrief ID required' }, { status: 400 });

      const { data, error } = await supabase
        .from('interview_debriefs')
        .select(`
          *,
          debrief_sections(*, ORDER BY sequence_number),
          mentor_feedback(*),
          interview_comparisons(*)
        `)
        .eq('id', debriefId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, debrief: data });
    }

    // Get shared debrief by token (AC 9)
    if (action === 'shared') {
      const token = searchParams.get('token');
      if (!token) return NextResponse.json({ error: 'Share token required' }, { status: 400 });

      const { data, error } = await supabase
        .from('interview_debriefs')
        .select(`
          id, session_id, video_url, thumbnail_url, status,
          transcript_analysis, strengths_identified, weaknesses_identified,
          debrief_sections(*)
        `)
        .eq('share_token', token)
        .eq('share_enabled', true)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, debrief: data });
    }

    // Get user's debrief history (AC 8)
    if (action === 'history') {
      const userId = searchParams.get('userId');
      if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

      const { data, error } = await supabase
        .from('interview_debriefs')
        .select('id, session_id, status, video_url, thumbnail_url, created_at, score_improvement')
        .eq('user_id', userId)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return NextResponse.json({ success: true, debriefs: data });
    }

    // Get comparison data (AC 10)
    if (action === 'comparison') {
      const debriefId = searchParams.get('debriefId');
      if (!debriefId) return NextResponse.json({ error: 'Debrief ID required' }, { status: 400 });

      const { data: debrief } = await supabase
        .from('interview_debriefs')
        .select('session_id, previous_session_id, score_improvement, comparison_insights')
        .eq('id', debriefId)
        .single();

      if (!debrief?.previous_session_id) {
        return NextResponse.json({ success: true, comparison: null, message: 'No previous session to compare' });
      }

      const { data: comparison } = await supabase
        .from('interview_comparisons')
        .select('*')
        .eq('current_session_id', debrief.session_id)
        .single();

      return NextResponse.json({ success: true, comparison, debrief });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Debrief GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { action } = body;

    // Generate debrief (AC 1, 2, 3)
    if (action === 'generate') {
      const { sessionId } = body;

      // Get or create debrief record
      let { data: debrief } = await supabase
        .from('interview_debriefs')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (!debrief) {
        const { data: session } = await supabase
          .from('interview_sessions')
          .select('user_id')
          .eq('id', sessionId)
          .single();

        const { data: newDebrief, error } = await supabase
          .from('interview_debriefs')
          .insert({
            session_id: sessionId,
            user_id: session?.user_id,
            status: 'analyzing'
          })
          .select()
          .single();

        if (error) throw error;
        debrief = newDebrief;
      }

      // Update status
      await supabase
        .from('interview_debriefs')
        .update({ status: 'analyzing' })
        .eq('id', debrief.id);

      // Get transcript
      const { data: transcript } = await supabase
        .from('interview_transcript')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp_seconds');

      // Get evaluation
      const { data: evaluation } = await supabase
        .from('interview_evaluations')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      // LLM Analysis (AC 2)
      const transcriptData: any[] = transcript ?? [];
      const analysis = await analyzeTranscript(transcriptData, evaluation);

      // Update with analysis
      await supabase
        .from('interview_debriefs')
        .update({
          status: 'scripting',
          transcript_analysis: analysis,
          strengths_identified: analysis.strengths,
          weaknesses_identified: analysis.weaknesses,
          best_answers: analysis.bestAnswers,
          improvement_areas: analysis.improvementAreas
        })
        .eq('id', debrief.id);

      // Generate script (AC 3)
      const script = await generateDebriefScript(analysis, evaluation);

      // Create sections
      await createDebriefSections(debrief.id, script.sections);

      // Update with script
      await supabase
        .from('interview_debriefs')
        .update({
          status: 'rendering',
          script,
          render_started_at: new Date().toISOString()
        })
        .eq('id', debrief.id);

      // Trigger video render (AC 4, 5, 6)
      renderDebriefVideo(debrief.id, script);

      // Generate comparison if previous session exists (AC 10)
      if (debrief.previous_session_id) {
        await supabase.rpc('generate_interview_comparison', { p_debrief_id: debrief.id });
      }

      return NextResponse.json({
        success: true,
        debriefId: debrief.id,
        status: 'rendering',
        message: 'Debrief generation started'
      });
    }

    // Check render status
    if (action === 'check-status') {
      const { debriefId } = body;

      const { data, error } = await supabase
        .from('interview_debriefs')
        .select('id, status, video_url, render_started_at, render_completed_at')
        .eq('id', debriefId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, ...data });
    }

    // Mark as ready and send notification (AC 7)
    if (action === 'mark-ready') {
      const { debriefId, videoUrl, thumbnailUrl, actualDuration } = body;

      await supabase
        .from('interview_debriefs')
        .update({
          status: 'ready',
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          actual_duration_seconds: actualDuration,
          render_completed_at: new Date().toISOString(),
          render_duration_seconds: Math.floor((Date.now() - new Date(body.renderStartedAt).getTime()) / 1000)
        })
        .eq('id', debriefId);

      // Queue notification (AC 7)
      await supabase.rpc('queue_debrief_notification', {
        p_debrief_id: debriefId,
        p_notification_type: 'debrief_ready'
      });

      return NextResponse.json({ success: true, status: 'ready' });
    }

    // Create share link (AC 9)
    if (action === 'create-share') {
      const { debriefId } = body;

      const shareToken = await supabase.rpc('create_debrief_share_token', {
        p_debrief_id: debriefId
      });

      const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/debrief/shared/${shareToken.data}`;

      return NextResponse.json({
        success: true,
        shareToken: shareToken.data,
        shareUrl
      });
    }

    // Share with mentor (AC 9)
    if (action === 'share-with-mentor') {
      const { debriefId, mentorEmail } = body;

      // Get share token or create one
      const { data: debrief } = await supabase
        .from('interview_debriefs')
        .select('share_token, shared_with')
        .eq('id', debriefId)
        .single();

      let shareToken = debrief?.share_token;
      if (!shareToken) {
        const result = await supabase.rpc('create_debrief_share_token', {
          p_debrief_id: debriefId
        });
        shareToken = result.data;
      }

      // Add mentor to shared list
      const sharedWith = debrief?.shared_with || [];
      if (!sharedWith.includes(mentorEmail)) {
        await supabase
          .from('interview_debriefs')
          .update({
            shared_with: [...sharedWith, mentorEmail]
          })
          .eq('id', debriefId);
      }

      // Queue notification
      await supabase.rpc('queue_debrief_notification', {
        p_debrief_id: debriefId,
        p_notification_type: 'mentor_shared'
      });

      return NextResponse.json({
        success: true,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/debrief/shared/${shareToken}`
      });
    }

    // Add mentor feedback (AC 9)
    if (action === 'add-feedback') {
      const { debriefId, mentorId, mentorEmail, rating, comments, detailedFeedback, suggestions, focusAreas } = body;

      const { data, error } = await supabase
        .from('mentor_feedback')
        .insert({
          debrief_id: debriefId,
          mentor_id: mentorId,
          mentor_email: mentorEmail,
          overall_rating: rating,
          comments,
          detailed_feedback: detailedFeedback,
          suggested_resources: suggestions,
          focus_areas: focusAreas
        })
        .select()
        .single();

      if (error) throw error;

      // Notify user
      await supabase.rpc('queue_debrief_notification', {
        p_debrief_id: debriefId,
        p_notification_type: 'mentor_feedback'
      });

      return NextResponse.json({ success: true, feedback: data });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Debrief POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

// AC 2: Analyze transcript with LLM
async function analyzeTranscript(transcript: any[], evaluation: any): Promise<any> {
  const transcriptText = transcript?.map(t => `${t.speaker}: ${t.message}`).join('\n').slice(0, 5000);

  const prompt = `Analyze this UPSC interview transcript and evaluation for a debrief video.

Transcript:
${transcriptText}

Evaluation scores:
- Overall: ${evaluation?.overall_score || 'N/A'}
- Communication: ${evaluation?.communication_score || 'N/A'}
- Knowledge: ${evaluation?.knowledge_score || 'N/A'}
- Analytical: ${evaluation?.analytical_score || 'N/A'}

Provide JSON with:
- summary: 2-3 sentence overall performance summary
- strengths: array of 3-5 specific strengths demonstrated
- weaknesses: array of 3-5 areas needing improvement
- bestAnswers: array of {question, response, score, whyGood} for top 2-3 answers
- improvementAreas: array of {area, currentLevel, suggestion, resources}
- keyInsights: array of 3 most important takeaways
- recommendedTopics: array of topics to study more`;

  try {
    const res = await fetch(`${a4fBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${a4fApiKey}`
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('Transcript analysis error:', err);
  }

  return {
    summary: 'Interview completed. Review pending.',
    strengths: ['Good effort'],
    weaknesses: ['Needs improvement'],
    bestAnswers: [],
    improvementAreas: [],
    keyInsights: ['Keep practicing'],
    recommendedTopics: []
  };
}

// AC 3: Generate debrief script
async function generateDebriefScript(analysis: any, evaluation: any): Promise<any> {
  const sections = [
    {
      type: 'intro',
      sequence: 1,
      title: 'Welcome',
      duration: 30,
      narration: `Welcome to your interview debrief. Let's review your performance and identify areas for growth.`,
      visual: 'title_card'
    },
    {
      type: 'summary',
      sequence: 2,
      title: 'Performance Summary',
      duration: 90,
      narration: analysis.summary || 'Let\'s look at your overall performance.',
      visual: 'confidence_meter',
      visualConfig: {
        overallScore: evaluation?.overall_score || 0,
        communicationScore: evaluation?.communication_score || 0,
        knowledgeScore: evaluation?.knowledge_score || 0,
        analyticalScore: evaluation?.analytical_score || 0
      }
    },
    {
      type: 'best_answer',
      sequence: 3,
      title: 'Your Best Moments',
      duration: 120,
      narration: `Here are the highlights from your interview where you performed exceptionally well.`,
      visual: 'highlight_reel',
      visualConfig: {
        highlights: analysis.bestAnswers || []
      }
    },
    {
      type: 'improvement',
      sequence: 4,
      title: 'Areas for Growth',
      duration: 120,
      narration: `Let's discuss areas where focused practice can make a significant difference.`,
      visual: 'improvement_chart',
      visualConfig: {
        areas: analysis.improvementAreas || []
      }
    },
    {
      type: 'resources',
      sequence: 5,
      title: 'Recommended Resources',
      duration: 60,
      narration: `Here are some resources to help you improve in the identified areas.`,
      visual: 'resource_list',
      visualConfig: {
        topics: analysis.recommendedTopics || []
      }
    },
    {
      type: 'closing',
      sequence: 6,
      title: 'Keep Going!',
      duration: 30,
      narration: `Remember, every practice session brings you closer to success. Keep up the great work!`,
      visual: 'motivation_card'
    }
  ];

  const totalDuration = sections.reduce((sum, s) => sum + s.duration, 0);

  return {
    sections,
    totalDuration,
    targetDuration: DEBRIEF_DURATION,
    analysis
  };
}

// Create debrief sections in DB
async function createDebriefSections(debriefId: string, sections: any[]): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const sectionRecords = sections.map(s => ({
    debrief_id: debriefId,
    section_type: s.type,
    sequence_number: s.sequence,
    title: s.title,
    narration_text: s.narration,
    visual_type: s.visual,
    visual_config: s.visualConfig,
    duration_seconds: s.duration
  }));

  await supabase.from('debrief_sections').insert(sectionRecords);
}

// AC 4, 5, 6: Render video with Manim/Revideo
async function renderDebriefVideo(debriefId: string, script: any): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Request render from VPS
    const response = await fetch(`${vpsRevideoUrl}/api/render/debrief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        debriefId,
        script,
        targetDuration: DEBRIEF_DURATION,
        maxRenderTime: MAX_RENDER_TIME,
        visualizations: {
          confidenceMeter: true,
          topicScoresChart: true,
          comparisonGraph: true,
          timeline: true
        },
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/debrief-render`
      })
    });

    if (!response.ok) {
      console.error('Render request failed');
      await supabase
        .from('interview_debriefs')
        .update({ status: 'failed' })
        .eq('id', debriefId);
    }
  } catch (err) {
    console.error('Render error:', err);
    await supabase
      .from('interview_debriefs')
      .update({ status: 'failed' })
      .eq('id', debriefId);
  }
}
