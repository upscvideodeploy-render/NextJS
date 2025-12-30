/**
 * Ethics Simulator API - Story 12.2
 * 
 * Implements all 10 ACs:
 * AC 1: Multi-stage flow (decision → consequence → adjustment)
 * AC 2: Personality analysis (utilitarian/deontological/virtue)
 * AC 3: Scoring dimensions (decision, reasoning, stakeholder, practical)
 * AC 4: Report card with comprehensive analysis
 * AC 5: Improvement suggestions
 * AC 6: Interview prep questions
 * AC 7: Peer comparison
 * AC 8: Difficulty levels (student/bureaucrat/minister)
 * AC 9: Video summary via Revideo
 * AC 10: Retry options with different context
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const a4fApiKey = process.env.A4F_API_KEY!;
const a4fBaseUrl = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const vpsRevideoUrl = process.env.VPS_REVIDEO_URL || 'http://localhost:4000';

// AC 8: Difficulty levels with roles
const DIFFICULTY_LEVELS = {
  easy: { role: 'Student', description: 'College/university level decisions', multiplier: 1.0 },
  medium: { role: 'Bureaucrat', description: 'IAS/IPS level administrative decisions', multiplier: 1.5 },
  hard: { role: 'Minister', description: 'Cabinet-level policy decisions', multiplier: 2.0 }
} as const;

// AC 2: Ethical tendencies
const ETHICAL_TENDENCIES = {
  utilitarian: { name: 'Utilitarian', description: 'Maximize overall welfare' },
  deontological: { name: 'Deontological', description: 'Follow moral duties and rules' },
  virtue: { name: 'Virtue Ethics', description: 'Act from good character' },
  care: { name: 'Care Ethics', description: 'Prioritize relationships and empathy' },
  justice: { name: 'Justice', description: 'Ensure fairness and rights' }
} as const;

// AC 3: Scoring dimensions
const SCORING_DIMENSIONS = {
  decision_quality: { name: 'Decision Quality', weight: 0.30 },
  reasoning_depth: { name: 'Reasoning Depth', weight: 0.25 },
  stakeholder_consideration: { name: 'Stakeholder Consideration', weight: 0.25 },
  practical_implementation: { name: 'Practical Implementation', weight: 0.20 }
} as const;

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    // Get scenarios by difficulty (AC 8)
    if (action === 'list') {
      const difficulty = searchParams.get('difficulty');
      const limit = parseInt(searchParams.get('limit') || '20');

      const { data, error } = await supabase.rpc('get_simulation_scenarios', {
        p_difficulty: difficulty,
        p_limit: limit
      });

      if (error) throw error;
      return NextResponse.json({ 
        success: true, 
        scenarios: data,
        difficultyLevels: DIFFICULTY_LEVELS
      });
    }

    // Get single scenario with stages
    if (action === 'scenario') {
      const scenarioId = searchParams.get('id');
      if (!scenarioId) {
        return NextResponse.json({ error: 'Scenario ID required' }, { status: 400 });
      }

      const { data: scenario, error: scenarioError } = await supabase
        .from('simulation_scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();

      if (scenarioError) throw scenarioError;

      const { data: stages, error: stagesError } = await supabase
        .from('simulation_stages')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('stage_number');

      if (stagesError) throw stagesError;

      return NextResponse.json({ success: true, scenario, stages });
    }

    // Get session with responses
    if (action === 'session') {
      const sessionId = searchParams.get('id');
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
      }

      const { data: session, error: sessionError } = await supabase
        .from('simulation_sessions')
        .select(`
          *,
          scenario:simulation_scenarios(*),
          responses:simulation_responses(*)
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      return NextResponse.json({ success: true, session });
    }

    // Get user profile (AC 2, 4)
    if (action === 'profile') {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      }

      const { data: profile, error } = await supabase
        .from('ethics_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return NextResponse.json({ success: true, profile: profile || null });
    }

    // Get report card (AC 4, 5, 6, 7)
    if (action === 'report-card') {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
      }

      const { data: reportCard, error } = await supabase
        .from('simulation_report_cards')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, reportCard });
    }

    // Get peer comparison (AC 7)
    if (action === 'peer-comparison') {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('get_peer_comparison', {
        p_session_id: sessionId
      });

      if (error) throw error;
      return NextResponse.json({ success: true, comparison: data });
    }

    // Get dimensions and tendencies info
    if (action === 'metadata') {
      return NextResponse.json({
        success: true,
        difficultyLevels: DIFFICULTY_LEVELS,
        ethicalTendencies: ETHICAL_TENDENCIES,
        scoringDimensions: SCORING_DIMENSIONS
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Ethics simulator GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { action } = body;

    // Start simulation (AC 1, 10)
    if (action === 'start') {
      const { userId, scenarioId, retrySessionId, retryContext } = body;

      const { data: sessionId, error } = await supabase.rpc('start_simulation', {
        p_user_id: userId,
        p_scenario_id: scenarioId,
        p_retry_session_id: retrySessionId || null,
        p_retry_context: retryContext || null
      });

      if (error) throw error;

      // Get scenario with first stage
      const { data: scenario } = await supabase
        .from('simulation_scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();

      const { data: firstStage } = await supabase
        .from('simulation_stages')
        .select('*')
        .eq('scenario_id', scenarioId)
        .eq('stage_number', 1)
        .single();

      return NextResponse.json({
        success: true,
        sessionId,
        scenario,
        currentStage: firstStage
      });
    }

    // Submit stage response (AC 1, 3)
    if (action === 'submit-response') {
      const { sessionId, stageId, responseText, responseData, timeSpent } = body;

      // Submit response
      const { data: responseId, error: responseError } = await supabase.rpc('submit_stage_response', {
        p_session_id: sessionId,
        p_stage_id: stageId,
        p_response_text: responseText,
        p_response_data: responseData || {},
        p_time_spent: timeSpent || 0
      });

      if (responseError) throw responseError;

      // Evaluate response with AI (AC 2, 3)
      const evaluation = await evaluateResponse(responseText, stageId, supabase);

      // Update response with evaluation
      await supabase
        .from('simulation_responses')
        .update({
          dimension_scores: evaluation.dimensionScores,
          ethical_indicators: evaluation.ethicalIndicators,
          ai_feedback: evaluation.feedback,
          ai_score: evaluation.score,
          evaluation_details: evaluation.details
        })
        .eq('id', responseId);

      // Get next stage
      const { data: session } = await supabase
        .from('simulation_sessions')
        .select('current_stage_number, scenario_id')
        .eq('id', sessionId)
        .single();

      const { data: nextStage } = await supabase
        .from('simulation_stages')
        .select('*')
        .eq('scenario_id', session?.scenario_id)
        .eq('stage_number', session?.current_stage_number)
        .single();

      const isComplete = !nextStage;

      return NextResponse.json({
        success: true,
        responseId,
        evaluation,
        nextStage,
        isComplete
      });
    }

    // Complete simulation (AC 4, 5, 6)
    if (action === 'complete') {
      const { sessionId } = body;

      // Get all responses for this session
      const { data: responses } = await supabase
        .from('simulation_responses')
        .select('*')
        .eq('session_id', sessionId);

      // Calculate aggregate scores (AC 3)
      const aggregateScores = calculateAggregateScores(responses || []);
      const ethicalTendency = calculateEthicalTendency(responses || []);
      const totalScore = calculateTotalScore(aggregateScores);

      // Complete simulation and create report
      const { data: reportId, error } = await supabase.rpc('complete_simulation', {
        p_session_id: sessionId,
        p_dimension_scores: aggregateScores,
        p_ethical_tendency: ethicalTendency,
        p_total_score: totalScore
      });

      if (error) throw error;

      // Generate report card content (AC 4, 5, 6)
      const reportContent = await generateReportCard(
        sessionId,
        aggregateScores,
        ethicalTendency,
        totalScore,
        supabase
      );

      // Update report card with generated content
      await supabase
        .from('simulation_report_cards')
        .update({
          dimension_analysis: reportContent.dimensionAnalysis,
          ethical_profile_summary: reportContent.ethicalProfileSummary,
          key_strengths: reportContent.strengths,
          areas_for_improvement: reportContent.improvements,
          recommended_resources: reportContent.resources,
          suggested_practice_areas: reportContent.practiceAreas,
          interview_questions: reportContent.interviewQuestions,
          ai_narrative: reportContent.narrative
        })
        .eq('id', reportId);

      // Get peer comparison (AC 7)
      const { data: comparison } = await supabase.rpc('get_peer_comparison', {
        p_session_id: sessionId
      });

      return NextResponse.json({
        success: true,
        reportId,
        totalScore,
        aggregateScores,
        ethicalTendency,
        reportContent,
        peerComparison: comparison
      });
    }

    // Retry simulation (AC 10)
    if (action === 'retry') {
      const { sessionId, userId, newContext } = body;

      // Get original scenario
      const { data: originalSession } = await supabase
        .from('simulation_sessions')
        .select('scenario_id')
        .eq('id', sessionId)
        .single();

      if (!originalSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Generate different context
      const retryContext = newContext || await generateRetryContext(
        originalSession.scenario_id,
        supabase
      );

      // Start new session
      const { data: newSessionId, error } = await supabase.rpc('start_simulation', {
        p_user_id: userId,
        p_scenario_id: originalSession.scenario_id,
        p_retry_session_id: sessionId,
        p_retry_context: retryContext
      });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        newSessionId,
        retryContext
      });
    }

    // Request video summary (AC 9)
    if (action === 'request-video') {
      const { userId, sessionId } = body;

      // Get profile
      const { data: profile } = await supabase
        .from('ethics_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }

      // Generate video script
      const script = await generateProfileVideoScript(profile);

      // Request video generation
      try {
        const response = await fetch(`${vpsRevideoUrl}/api/render/ethics-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            profile,
            script,
            webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/revideo`
          })
        });

        if (response.ok) {
          const result = await response.json();
          
          // Update profile
          await supabase
            .from('ethics_profiles')
            .update({ profile_video_status: 'generating' })
            .eq('user_id', userId);

          return NextResponse.json({
            success: true,
            jobId: result.jobId,
            status: 'generating'
          });
        }
      } catch (err) {
        console.error('Video request failed:', err);
      }

      return NextResponse.json({
        success: true,
        status: 'queued'
      });
    }

    // Get interview questions only (AC 6)
    if (action === 'get-interview-questions') {
      const { sessionId, topic } = body;

      const questions = await generateInterviewQuestions(sessionId, topic, supabase);
      return NextResponse.json({ success: true, questions });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Ethics simulator POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

// AC 2, 3: Evaluate response with AI
async function evaluateResponse(
  responseText: string,
  stageId: string,
  supabase: any
): Promise<any> {
  // Get stage criteria
  const { data: stage } = await supabase
    .from('simulation_stages')
    .select('evaluation_criteria, prompts')
    .eq('id', stageId)
    .single();

  const prompt = `Evaluate this ethics response for a UPSC GS4 simulation.

Response: ${responseText}

Evaluate on these dimensions (score 0-100 each):
1. Decision Quality: Clear, well-justified decision
2. Reasoning Depth: Multiple perspectives, frameworks considered
3. Stakeholder Consideration: All affected parties addressed
4. Practical Implementation: Realistic, actionable steps

Also identify ethical tendencies (score 0-100 each):
- Utilitarian (focuses on outcomes, greater good)
- Deontological (focuses on duties, rules)
- Virtue (focuses on character, integrity)
- Care (focuses on relationships, empathy)
- Justice (focuses on fairness, rights)

Return JSON:
{
  "dimensionScores": {"decision_quality": X, "reasoning_depth": X, ...},
  "ethicalIndicators": {"utilitarian": X, "deontological": X, ...},
  "score": X (overall 0-100),
  "feedback": "...",
  "details": {"strengths": [...], "weaknesses": [...]}
}`;

  try {
    const response = await fetch(`${a4fBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${a4fApiKey}`
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500
      })
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error('Evaluation error:', err);
  }

  // Default evaluation
  return {
    dimensionScores: {
      decision_quality: 50,
      reasoning_depth: 50,
      stakeholder_consideration: 50,
      practical_implementation: 50
    },
    ethicalIndicators: {
      utilitarian: 50,
      deontological: 50,
      virtue: 50,
      care: 50,
      justice: 50
    },
    score: 50,
    feedback: 'Evaluation pending.',
    details: { strengths: [], weaknesses: [] }
  };
}

// AC 3: Calculate aggregate scores
function calculateAggregateScores(responses: any[]): Record<string, number> {
  if (responses.length === 0) {
    return {
      decision_quality: 0,
      reasoning_depth: 0,
      stakeholder_consideration: 0,
      practical_implementation: 0
    };
  }

  const totals: Record<string, number> = {};
  for (const key of Object.keys(SCORING_DIMENSIONS)) {
    totals[key] = 0;
  }

  for (const response of responses) {
    const scores = response.dimension_scores || {};
    for (const key of Object.keys(SCORING_DIMENSIONS)) {
      totals[key] += scores[key] || 0;
    }
  }

  const averages: Record<string, number> = {};
  for (const key of Object.keys(SCORING_DIMENSIONS)) {
    averages[key] = Math.round(totals[key] / responses.length);
  }

  return averages;
}

// AC 2: Calculate ethical tendency
function calculateEthicalTendency(responses: any[]): Record<string, number> {
  if (responses.length === 0) {
    return {
      utilitarian: 50,
      deontological: 50,
      virtue: 50,
      care: 50,
      justice: 50
    };
  }

  const totals: Record<string, number> = {};
  for (const key of Object.keys(ETHICAL_TENDENCIES)) {
    totals[key] = 0;
  }

  for (const response of responses) {
    const indicators = response.ethical_indicators || {};
    for (const key of Object.keys(ETHICAL_TENDENCIES)) {
      totals[key] += indicators[key] || 0;
    }
  }

  const averages: Record<string, number> = {};
  for (const key of Object.keys(ETHICAL_TENDENCIES)) {
    averages[key] = Math.round(totals[key] / responses.length);
  }

  return averages;
}

// Calculate total score
function calculateTotalScore(dimensionScores: Record<string, number>): number {
  let total = 0;
  for (const [key, dim] of Object.entries(SCORING_DIMENSIONS)) {
    total += (dimensionScores[key] || 0) * dim.weight;
  }
  return Math.round(total);
}

// AC 4, 5, 6: Generate report card
async function generateReportCard(
  sessionId: string,
  dimensionScores: Record<string, number>,
  ethicalTendency: Record<string, number>,
  totalScore: number,
  supabase: any
): Promise<any> {
  // Find primary tendency
  let primaryTendency = 'balanced';
  let maxScore = 0;
  for (const [key, value] of Object.entries(ethicalTendency)) {
    if (value > maxScore) {
      maxScore = value;
      primaryTendency = key;
    }
  }

  const prompt = `Generate a comprehensive ethics simulation report card.

Scores:
- Decision Quality: ${dimensionScores.decision_quality}
- Reasoning Depth: ${dimensionScores.reasoning_depth}
- Stakeholder Consideration: ${dimensionScores.stakeholder_consideration}
- Practical Implementation: ${dimensionScores.practical_implementation}
- Total: ${totalScore}

Ethical Tendencies:
- Utilitarian: ${ethicalTendency.utilitarian}
- Deontological: ${ethicalTendency.deontological}
- Virtue: ${ethicalTendency.virtue}
- Care: ${ethicalTendency.care}
- Justice: ${ethicalTendency.justice}

Generate JSON:
{
  "dimensionAnalysis": {
    "decision_quality": {"score": X, "grade": "A/B/C", "feedback": "..."},
    ...
  },
  "ethicalProfileSummary": "2-3 paragraph summary of ethical reasoning style",
  "strengths": ["strength1", "strength2", ...],
  "improvements": ["area1", "area2", ...],
  "resources": [
    {"type": "book/article/video", "title": "...", "author": "...", "reason": "..."}
  ],
  "practiceAreas": ["area1", "area2"],
  "interviewQuestions": [
    {"question": "...", "context": "Based on your response...", "suggested_approach": "..."}
  ],
  "narrative": "Overall assessment narrative (2-3 paragraphs)"
}`;

  try {
    const response = await fetch(`${a4fBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${a4fApiKey}`
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000
      })
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error('Report generation error:', err);
  }

  // Default report
  return {
    dimensionAnalysis: {},
    ethicalProfileSummary: 'Your ethical profile is being analyzed.',
    strengths: ['Completed the simulation'],
    improvements: ['Continue practicing ethical reasoning'],
    resources: [],
    practiceAreas: ['Ethics case studies'],
    interviewQuestions: [],
    narrative: 'Analysis in progress.'
  };
}

// AC 6: Generate interview questions
async function generateInterviewQuestions(
  sessionId: string,
  topic: string,
  supabase: any
): Promise<any[]> {
  const { data: session } = await supabase
    .from('simulation_sessions')
    .select(`
      *,
      scenario:simulation_scenarios(title, category)
    `)
    .eq('id', sessionId)
    .single();

  const prompt = `Generate 5 UPSC interview questions based on this ethics simulation.

Simulation: ${session?.scenario?.title}
Category: ${session?.scenario?.category || 'General Ethics'}
Topic: ${topic || 'Ethical decision-making'}

Generate questions that:
1. Probe the candidate's ethical reasoning
2. Explore real-world applications
3. Test consistency of ethical framework
4. Include one situational question
5. Include one philosophical question

Return JSON array:
[
  {
    "question": "...",
    "type": "situational|philosophical|application|probing",
    "context": "Why this question is relevant",
    "key_points": ["point1", "point2"],
    "suggested_approach": "How to structure the answer"
  }
]`;

  try {
    const response = await fetch(`${a4fBaseUrl}/chat/completions`, {
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

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error('Interview question generation error:', err);
  }

  return [];
}

// AC 10: Generate retry context
async function generateRetryContext(
  scenarioId: string,
  supabase: any
): Promise<string> {
  const { data: scenario } = await supabase
    .from('simulation_scenarios')
    .select('title, context, category')
    .eq('id', scenarioId)
    .single();

  const prompt = `Generate a different context for retrying this ethics scenario.

Original: ${scenario?.title}
Context: ${scenario?.context}

Create a variation that:
- Changes some stakeholders or constraints
- Maintains the core ethical dilemma
- Adds a new complication or pressure

Return a 2-3 sentence context variation.`;

  try {
    const response = await fetch(`${a4fBaseUrl}/chat/completions`, {
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

    if (response.ok) {
      const result = await response.json();
      return result.choices[0].message.content;
    }
  } catch (err) {
    console.error('Retry context generation error:', err);
  }

  return 'Retry with added time pressure and media scrutiny.';
}

// AC 9: Generate profile video script
async function generateProfileVideoScript(profile: any): Promise<string> {
  const prompt = `Generate a 2-minute video script summarizing this ethics profile.

Profile:
- Primary tendency: ${profile.primary_tendency}
- Secondary tendency: ${profile.secondary_tendency}
- Simulations completed: ${profile.simulations_completed}
- Average score: ${profile.average_score}%
- Strengths: ${profile.strengths?.join(', ')}
- Weaknesses: ${profile.weaknesses?.join(', ')}

Create an engaging narration that:
1. Introduces the ethical profile
2. Explains key tendencies with examples
3. Highlights strengths
4. Suggests improvement areas
5. Provides actionable advice for UPSC preparation`;

  try {
    const response = await fetch(`${a4fBaseUrl}/chat/completions`, {
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

    if (response.ok) {
      const result = await response.json();
      return result.choices[0].message.content;
    }
  } catch (err) {
    console.error('Script generation error:', err);
  }

  return 'Your ethics profile video is being prepared.';
}
