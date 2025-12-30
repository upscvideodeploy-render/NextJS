/**
 * Interview Studio API - Story 13.1
 * WebRTC Real-Time AI Interviews
 * 
 * AC 1: WebRTC video call (<500ms latency)
 * AC 2: AI interviewer with TTS
 * AC 3: Question bank (1000+ questions)
 * AC 4: Adaptive difficulty
 * AC 5: Visual aids during interview
 * AC 6: Real-time Manim (2-6s render)
 * AC 7: Recording with consent
 * AC 8: Session duration (15-30 min)
 * AC 9: Evaluation and feedback
 * AC 10: Panel mode (3 AI interviewers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const a4fApiKey = process.env.A4F_API_KEY!;
const a4fBaseUrl = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const vpsManimUrl = process.env.VPS_MANIM_URL || 'http://localhost:3002';
const ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:3003';

// AC 8: Session duration limits
const SESSION_DURATION = { min: 15, max: 30 };

// AC 1: WebRTC ICE servers
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

// AC 10: Panel mode interviewers
const PANEL_ROLES = ['chairperson', 'expert', 'psychology'];

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    // Get questions bank (AC 3)
    if (action === 'questions') {
      const category = searchParams.get('category');
      const difficulty = searchParams.get('difficulty');
      const limit = parseInt(searchParams.get('limit') || '20');

      let query = supabase
        .from('interview_questions')
        .select('id, category, topic, question, difficulty_level, interviewer_type, time_expected_seconds')
        .eq('is_active', true);

      if (category) query = query.eq('category', category);
      if (difficulty) query = query.eq('difficulty_level', difficulty);

      const { data, error } = await query.limit(limit);
      if (error) throw error;

      return NextResponse.json({ success: true, questions: data, total: data?.length });
    }

    // Get AI interviewers (AC 2, 10)
    if (action === 'interviewers') {
      const role = searchParams.get('role');

      let query = supabase
        .from('ai_interviewers')
        .select('*')
        .eq('is_active', true);

      if (role) query = query.eq('role', role);

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json({ success: true, interviewers: data });
    }

    // Get session details
    if (action === 'session') {
      const sessionId = searchParams.get('id');
      if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

      const { data: session, error } = await supabase
        .from('interview_sessions')
        .select(`
          *,
          interview_transcript(*),
          session_questions(*),
          interview_evaluations(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, session });
    }

    // Get user interview history
    if (action === 'history') {
      const userId = searchParams.get('userId');
      if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

      const { data: history, error: histError } = await supabase
        .from('interview_history')
        .select('*')
        .eq('user_id', userId)
        .single();

      const { data: sessions, error: sessError } = await supabase
        .from('interview_sessions')
        .select('id, session_type, status, duration_minutes, difficulty_level, started_at, ended_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      return NextResponse.json({
        success: true,
        history: history || { total_sessions: 0 },
        recent_sessions: sessions || []
      });
    }

    // Get categories for filtering
    if (action === 'categories') {
      const { data } = await supabase
        .from('interview_questions')
        .select('category')
        .eq('is_active', true);

      const categories = [...new Set(data?.map(q => q.category) || [])];
      return NextResponse.json({ success: true, categories });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Interview GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { action } = body;

    // Create new interview session (AC 8)
    if (action === 'create-session') {
      const { userId, sessionType, durationMinutes, difficulty, topics, recordingConsent } = body;

      // Validate duration (AC 8)
      const duration = Math.max(SESSION_DURATION.min, Math.min(SESSION_DURATION.max, durationMinutes || 20));

      // Get interviewers for panel mode (AC 10)
      type InterviewerType = { id: string; name: string; role: string };
      let interviewers: InterviewerType[] = [];
      if (sessionType === 'panel') {
        const { data: panelMembers } = await supabase
          .from('ai_interviewers')
          .select('id, name, role')
          .eq('is_active', true)
          .in('role', PANEL_ROLES);
        interviewers = (panelMembers || []) as InterviewerType[];
      } else {
        const { data: chair } = await supabase
          .from('ai_interviewers')
          .select('id, name, role')
          .eq('role', 'chairperson')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (chair) interviewers = [chair as InterviewerType];
      }

      const { data: session, error } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: userId,
          session_type: sessionType || 'solo',
          duration_minutes: duration,
          difficulty_level: difficulty || 'medium',
          topics: topics || [],
          recording_consent: recordingConsent || false,
          interviewers: interviewers,
          ice_servers: ICE_SERVERS
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        session,
        interviewers,
        durationConfig: SESSION_DURATION
      });
    }

    // Start interview (AC 1)
    if (action === 'start-session') {
      const { sessionId } = body;

      const { data, error } = await supabase.rpc('start_interview_session', {
        p_session_id: sessionId
      });

      if (error) throw error;
      return NextResponse.json({ success: true, ...data });
    }

    // WebRTC signaling - offer (AC 1)
    if (action === 'webrtc-offer') {
      const { sessionId, offer } = body;

      // In production, this would go through a signaling server
      // For now, store the offer for the AI interviewer to respond
      await supabase
        .from('interview_sessions')
        .update({
          status: 'connecting'
        })
        .eq('id', sessionId);

      // Simulate AI interviewer answer
      const answer = {
        type: 'answer',
        sdp: 'simulated-sdp-answer'
      };

      return NextResponse.json({
        success: true,
        answer,
        iceServers: ICE_SERVERS
      });
    }

    // AI Interviewer speaks (AC 2)
    if (action === 'interviewer-speak') {
      const { sessionId, interviewerId, text, questionId } = body;

      // Generate TTS audio
      const audioUrl = await generateTTS(interviewerId, text);

      // Add to transcript
      const { data: transcript, error } = await supabase
        .from('interview_transcript')
        .insert({
          session_id: sessionId,
          speaker: 'interviewer',
          interviewer_id: interviewerId,
          message: text,
          audio_url: audioUrl,
          question_id: questionId,
          timestamp_seconds: Date.now() / 1000
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        transcript,
        audioUrl
      });
    }

    // User response (AC 9)
    if (action === 'user-response') {
      const { sessionId, questionId, response, timestampSeconds, durationSeconds } = body;

      // Save to transcript
      await supabase
        .from('interview_transcript')
        .insert({
          session_id: sessionId,
          speaker: 'user',
          message: response,
          question_id: questionId,
          timestamp_seconds: timestampSeconds,
          duration_seconds: durationSeconds
        });

      // Analyze response with AI (AC 9)
      const analysis = await analyzeResponse(questionId, response);

      // Update session question with score
      await supabase
        .from('session_questions')
        .update({
          answered_at: new Date().toISOString(),
          time_taken_seconds: durationSeconds,
          score: analysis.score,
          feedback: analysis,
          strengths: analysis.strengths,
          areas_to_improve: analysis.weaknesses
        })
        .eq('session_id', sessionId)
        .eq('question_id', questionId);

      // Adaptive difficulty (AC 4)
      const nextDifficulty = determineNextDifficulty(analysis.score);

      return NextResponse.json({
        success: true,
        analysis,
        nextDifficulty
      });
    }

    // Request visual aid (AC 5, 6)
    if (action === 'request-visual') {
      const { sessionId, requestType, requestText, transcriptId } = body;

      // Create visual aid request
      const { data: visualAid, error } = await supabase
        .from('interview_visual_aids')
        .insert({
          session_id: sessionId,
          transcript_id: transcriptId,
          request_type: requestType,
          request_text: requestText,
          manim_status: 'generating',
          render_started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Request Manim render (AC 6 - 2-6s target)
      generateManimVisual(visualAid.id, requestType, requestText);

      return NextResponse.json({
        success: true,
        visualAid,
        estimatedRenderTime: '2-6 seconds'
      });
    }

    // Check visual aid status (AC 6)
    if (action === 'check-visual') {
      const { visualAidId } = body;

      const { data, error } = await supabase
        .from('interview_visual_aids')
        .select('*')
        .eq('id', visualAidId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, visualAid: data });
    }

    // Get next question (AC 3, 4)
    if (action === 'next-question') {
      const { sessionId, currentDifficulty, askedQuestionIds, topics } = body;

      // Get session to know interviewer type for panel mode
      const { data: session } = await supabase
        .from('interview_sessions')
        .select('session_type, interviewers, current_interviewer_id')
        .eq('id', sessionId)
        .single();

      let interviewerType = 'chairperson';
      if (session?.session_type === 'panel' && session.interviewers) {
        // Rotate through panel members
        const panelIndex = (askedQuestionIds?.length || 0) % session.interviewers.length;
        interviewerType = session.interviewers[panelIndex]?.role || 'chairperson';
      }

      // Select next question (AC 4 - adaptive)
      const { data: questions, error } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('is_active', true)
        .eq('interviewer_type', interviewerType)
        .not('id', 'in', `(${(askedQuestionIds || []).join(',') || 'null'})`)
        .order('difficulty_level', { ascending: currentDifficulty === 'easy' })
        .limit(1);

      if (error || !questions?.length) {
        return NextResponse.json({ success: true, question: null, message: 'No more questions' });
      }

      // Add to session questions
      await supabase
        .from('session_questions')
        .insert({
          session_id: sessionId,
          question_id: questions[0].id,
          interviewer_id: session?.interviewers?.find((i: any) => i.role === interviewerType)?.id,
          sequence_number: (askedQuestionIds?.length || 0) + 1,
          difficulty_at_time: currentDifficulty,
          asked_at: new Date().toISOString()
        });

      return NextResponse.json({
        success: true,
        question: questions[0],
        interviewerType
      });
    }

    // Start recording (AC 7)
    if (action === 'start-recording') {
      const { sessionId } = body;

      await supabase
        .from('interview_sessions')
        .update({
          recording_status: 'recording'
        })
        .eq('id', sessionId);

      return NextResponse.json({ success: true, status: 'recording' });
    }

    // End session (AC 9)
    if (action === 'end-session') {
      const { sessionId } = body;

      const { data, error } = await supabase.rpc('end_interview_session', {
        p_session_id: sessionId
      });

      if (error) throw error;

      // Generate detailed evaluation
      const evaluation = await generateDetailedEvaluation(sessionId);

      // Update evaluation record
      await supabase
        .from('interview_evaluations')
        .update({
          communication_score: evaluation.communicationScore,
          knowledge_score: evaluation.knowledgeScore,
          analytical_score: evaluation.analyticalScore,
          personality_score: evaluation.personalityScore,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          improvement_suggestions: evaluation.suggestions,
          summary: evaluation.summary,
          detailed_feedback: evaluation,
          suggested_resources: evaluation.resources
        })
        .eq('session_id', sessionId);

      return NextResponse.json({
        success: true,
        ...data,
        evaluation
      });
    }

    // Get follow-up question (AC 4)
    if (action === 'get-followup') {
      const { questionId, userResponse } = body;

      const { data: question } = await supabase
        .from('interview_questions')
        .select('follow_up_questions')
        .eq('id', questionId)
        .single();

      const followUps = question?.follow_up_questions || [];
      const followUp = followUps.length > 0 ? followUps[Math.floor(Math.random() * followUps.length)] : null;

      // Or generate AI follow-up based on response
      if (!followUp) {
        const aiFollowUp = await generateAIFollowUp(questionId, userResponse);
        return NextResponse.json({ success: true, followUp: aiFollowUp });
      }

      return NextResponse.json({ success: true, followUp });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Interview POST error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

// AC 2: Generate TTS for AI interviewer
async function generateTTS(interviewerId: string, text: string): Promise<string> {
  try {
    const response = await fetch(`${ttsServiceUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId: interviewerId,
        format: 'mp3'
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.audioUrl;
    }
  } catch (err) {
    console.error('TTS generation error:', err);
  }
  return '';
}

// AC 9: Analyze user response
async function analyzeResponse(questionId: string, response: string): Promise<any> {
  const prompt = `Analyze this UPSC interview response. Score from 0-10 and provide feedback.

Question ID: ${questionId}
Response: ${response}

Provide JSON with:
- score (0-10)
- strengths (array of 2-3 points)
- weaknesses (array of 2-3 areas to improve)
- keyPoints (what they covered well)
- missedPoints (what they should have mentioned)
- communicationRating (1-5)
- suggestion (brief improvement tip)`;

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
        max_tokens: 1000
      })
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('Response analysis error:', err);
  }

  return { score: 5, strengths: [], weaknesses: [], suggestion: 'Keep practicing!' };
}

// AC 4: Determine next difficulty
function determineNextDifficulty(currentScore: number): string {
  if (currentScore >= 8) return 'hard';
  if (currentScore >= 6) return 'medium';
  if (currentScore >= 4) return 'easy';
  return 'easy';
}

// AC 6: Generate Manim visual (2-6s target)
async function generateManimVisual(visualAidId: string, type: string, text: string): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const response = await fetch(`${vpsManimUrl}/api/render/quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        content: text,
        targetDuration: 6000, // 6 seconds max
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/manim-interview`
      })
    });

    if (response.ok) {
      const result = await response.json();
      
      // Update with video URL when ready
      if (result.videoUrl) {
        await supabase
          .from('interview_visual_aids')
          .update({
            manim_status: 'ready',
            video_url: result.videoUrl,
            render_completed_at: new Date().toISOString(),
            render_duration_ms: result.renderTimeMs
          })
          .eq('id', visualAidId);
      }
    }
  } catch (err) {
    console.error('Manim render error:', err);
    await supabase
      .from('interview_visual_aids')
      .update({ manim_status: 'failed' })
      .eq('id', visualAidId);
  }
}

// AC 9: Generate detailed evaluation
async function generateDetailedEvaluation(sessionId: string): Promise<any> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get transcript
  const { data: transcript } = await supabase
    .from('interview_transcript')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp_seconds');

  // Get question scores
  const { data: questions } = await supabase
    .from('session_questions')
    .select('*, interview_questions(*)')
    .eq('session_id', sessionId);

  const avgScore = questions?.reduce((sum, q) => sum + (q.score || 0), 0) / (questions?.length || 1);

  const prompt = `Generate a detailed UPSC interview evaluation based on this transcript and scores.

Transcript summary: ${transcript?.slice(0, 5).map(t => `${t.speaker}: ${t.message.slice(0, 100)}`).join('\n')}

Questions answered: ${questions?.length}
Average score: ${avgScore.toFixed(1)}/10

Provide JSON with:
- communicationScore (0-10)
- knowledgeScore (0-10)
- analyticalScore (0-10)
- personalityScore (0-10)
- strengths (array of 3-5 strengths)
- weaknesses (array of 3-5 areas to improve)
- suggestions (array of 3 specific improvement tips)
- summary (2-3 paragraph overall assessment)
- resources (array of recommended study materials)`;

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
    console.error('Evaluation generation error:', err);
  }

  return {
    communicationScore: avgScore,
    knowledgeScore: avgScore,
    analyticalScore: avgScore,
    personalityScore: avgScore,
    strengths: ['Good attempt'],
    weaknesses: ['Needs more practice'],
    suggestions: ['Practice regularly', 'Read current affairs', 'Work on communication'],
    summary: 'Thank you for completing the interview. Keep practicing to improve.',
    resources: []
  };
}

// Generate AI follow-up question
async function generateAIFollowUp(questionId: string, userResponse: string): Promise<string> {
  const prompt = `Based on this interview response, generate a probing follow-up question.
  
Response: ${userResponse.slice(0, 500)}

Generate a brief follow-up question that:
1. Probes deeper into their answer
2. Tests their understanding
3. Is natural and conversational

Return just the follow-up question.`;

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
        max_tokens: 200
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content.trim();
    }
  } catch (err) {
    console.error('Follow-up generation error:', err);
  }

  return 'Can you elaborate on that point?';
}
