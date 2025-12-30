/**
 * Ethics Roleplay API - Story 12.1
 * 
 * Implements all 10 ACs:
 * AC 1: Scenario types (governance, social, professional, environmental)
 * AC 2: Branching logic with choice paths
 * AC 3: 3+ levels deep scenarios
 * AC 4: Ethical frameworks evaluation
 * AC 5: Score calculation based on reasoning
 * AC 6: Feedback for each choice
 * AC 7: Video feedback via Revideo
 * AC 8: Progress tracking over time
 * AC 9: Admin interface for scenarios
 * AC 10: 50+ scenario library
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const a4fApiKey = process.env.A4F_API_KEY!;
const a4fBaseUrl = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const vpsRevideoUrl = process.env.VPS_REVIDEO_URL || 'http://localhost:4000';

// AC 1: Scenario types
const SCENARIO_TYPES = [
  'governance', 'social', 'professional', 'environmental',
  'personal', 'legal', 'administrative', 'crisis'
] as const;

// AC 4: Ethical frameworks
const ETHICAL_FRAMEWORKS = {
  utilitarian: {
    name: 'Utilitarian',
    description: 'Greatest good for greatest number',
    principles: ['Maximize overall welfare', 'Consider consequences', 'Aggregate happiness']
  },
  deontological: {
    name: 'Deontological',
    description: 'Duty-based ethics',
    principles: ['Follow rules and duties', 'Act from moral obligation', 'Respect for persons']
  },
  virtue: {
    name: 'Virtue Ethics',
    description: 'Character-based ethics',
    principles: ['Develop good character', 'Practice virtues', 'Strive for excellence']
  },
  justice: {
    name: 'Justice/Fairness',
    description: 'Fair treatment and rights',
    principles: ['Equal treatment', 'Protect rights', 'Fair distribution']
  }
} as const;

// AC 3: Required depth
const MIN_DEPTH = 3;

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    // Get published scenarios (AC 10)
    if (action === 'list') {
      const scenarioType = searchParams.get('type');
      const difficulty = searchParams.get('difficulty');
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');

      const { data, error } = await supabase.rpc('get_published_scenarios', {
        p_scenario_type: scenarioType,
        p_difficulty: difficulty,
        p_limit: limit,
        p_offset: offset
      });

      if (error) throw error;
      return NextResponse.json({ success: true, ...data });
    }

    // Get single scenario with root node
    if (action === 'scenario') {
      const scenarioId = searchParams.get('id');
      if (!scenarioId) {
        return NextResponse.json({ error: 'Scenario ID required' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('get_ethics_scenario', {
        p_scenario_id: scenarioId
      });

      if (error) throw error;
      return NextResponse.json({ success: true, ...data });
    }

    // Get node with choices (AC 2)
    if (action === 'node') {
      const nodeId = searchParams.get('id');
      if (!nodeId) {
        return NextResponse.json({ error: 'Node ID required' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('get_scenario_node', {
        p_node_id: nodeId
      });

      if (error) throw error;
      return NextResponse.json({ success: true, ...data });
    }

    // Get user progress (AC 8)
    if (action === 'progress') {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('get_ethics_progress', {
        p_user_id: userId
      });

      if (error) throw error;
      return NextResponse.json({ success: true, ...data });
    }

    // Get session details
    if (action === 'session') {
      const sessionId = searchParams.get('id');
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
      }

      const { data: session, error } = await supabase
        .from('ethics_sessions')
        .select(`
          *,
          scenario:ethics_scenarios(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, session });
    }

    // Get ethical frameworks info (AC 4)
    if (action === 'frameworks') {
      return NextResponse.json({
        success: true,
        frameworks: ETHICAL_FRAMEWORKS,
        scenarioTypes: SCENARIO_TYPES
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Ethics roleplay GET error:', error);
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

    // Start new session (AC 5)
    if (action === 'start-session') {
      const { userId, scenarioId } = body;

      const { data: sessionId, error } = await supabase.rpc('start_ethics_session', {
        p_user_id: userId,
        p_scenario_id: scenarioId
      });

      if (error) throw error;

      // Get initial node
      const { data: scenario } = await supabase.rpc('get_ethics_scenario', {
        p_scenario_id: scenarioId
      });

      return NextResponse.json({
        success: true,
        sessionId,
        scenario
      });
    }

    // Make choice (AC 2, 5, 6)
    if (action === 'make-choice') {
      const { sessionId, choiceId } = body;

      // Get choice details for feedback
      const { data: choice, error: choiceError } = await supabase
        .from('scenario_choices')
        .select('*')
        .eq('id', choiceId)
        .single();

      if (choiceError) throw choiceError;

      // Make the choice
      const { data: result, error } = await supabase.rpc('make_ethics_choice', {
        p_session_id: sessionId,
        p_choice_id: choiceId
      });

      if (error) throw error;

      // If not ending, get next node
      let nextNode = null;
      if (!result.is_ending && result.next_node_id) {
        const { data } = await supabase.rpc('get_scenario_node', {
          p_node_id: result.next_node_id
        });
        nextNode = data;
      }

      // AC 6: Build detailed feedback
      const feedback = await generateChoiceFeedback(choice);

      return NextResponse.json({
        success: true,
        result: {
          ...result,
          detailed_feedback: feedback
        },
        nextNode
      });
    }

    // Generate AI feedback for choice (AC 6)
    if (action === 'generate-feedback') {
      const { choiceId, context } = body;

      const feedback = await generateAIFeedback(choiceId, context);
      return NextResponse.json({ success: true, feedback });
    }

    // Request video feedback (AC 7)
    if (action === 'request-video-feedback') {
      const { sessionId, scenarioId, pathType = 'best' } = body;

      // Get session path
      const { data: session, error: sessionError } = await supabase
        .from('ethics_sessions')
        .select('path_taken, choices_made')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Check if video already exists
      const { data: existingVideo } = await supabase
        .from('ethics_feedback_videos')
        .select('*')
        .eq('scenario_id', scenarioId)
        .eq('path_type', pathType)
        .eq('video_status', 'completed')
        .single();

      if (existingVideo) {
        return NextResponse.json({
          success: true,
          video: existingVideo,
          source: 'cached'
        });
      }

      // Request video generation
      const videoResult = await requestVideoGeneration(
        scenarioId,
        session.path_taken,
        pathType
      );

      return NextResponse.json({
        success: true,
        video: videoResult,
        source: 'generating'
      });
    }

    // Get session result with analysis (AC 5, 8)
    if (action === 'get-result') {
      const { sessionId } = body;

      const { data: session, error } = await supabase
        .from('ethics_sessions')
        .select(`
          *,
          scenario:ethics_scenarios(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      // Generate analysis
      const analysis = analyzeSessionResult(session);

      return NextResponse.json({
        success: true,
        session,
        analysis
      });
    }

    // ========================================
    // ADMIN ACTIONS (AC 9)
    // ========================================

    // Admin: Create scenario
    if (action === 'admin-create-scenario') {
      const { adminId, title, description, scenarioType, difficulty } = body;

      const { data: scenarioId, error } = await supabase.rpc('admin_create_scenario', {
        p_admin_id: adminId,
        p_title: title,
        p_description: description,
        p_scenario_type: scenarioType,
        p_difficulty: difficulty || 'medium'
      });

      if (error) throw error;
      return NextResponse.json({ success: true, scenarioId });
    }

    // Admin: Add node to scenario
    if (action === 'admin-add-node') {
      const { scenarioId, nodeType, level, title, narrative, endingType } = body;

      // AC 3: Validate depth
      if (nodeType === 'ending' && level < MIN_DEPTH) {
        return NextResponse.json({
          error: `Endings must be at level ${MIN_DEPTH} or deeper`,
          minDepth: MIN_DEPTH
        }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('scenario_nodes')
        .insert({
          scenario_id: scenarioId,
          node_type: nodeType,
          level,
          title,
          narrative,
          ending_type: endingType
        })
        .select()
        .single();

      if (error) throw error;

      // Update scenario node count
      await supabase.rpc('admin_update_scenario_stats', { p_scenario_id: scenarioId });

      return NextResponse.json({ success: true, node: data });
    }

    // Admin: Add choice to node
    if (action === 'admin-add-choice') {
      const {
        nodeId,
        choiceText,
        choiceLabel,
        nextNodeId,
        frameworkScores,
        ethicalScore,
        immediateFeedback,
        detailedExplanation
      } = body;

      const { data, error } = await supabase
        .from('scenario_choices')
        .insert({
          node_id: nodeId,
          choice_text: choiceText,
          choice_label: choiceLabel,
          next_node_id: nextNodeId,
          framework_scores: frameworkScores || {},
          ethical_score: ethicalScore || 0,
          immediate_feedback: immediateFeedback,
          detailed_explanation: detailedExplanation
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, choice: data });
    }

    // Admin: Publish scenario
    if (action === 'admin-publish') {
      const { scenarioId, reviewerId } = body;

      // Validate scenario has minimum depth (AC 3)
      const validation = await validateScenarioDepth(supabase, scenarioId);
      if (!validation.valid) {
        return NextResponse.json({
          error: validation.error,
          details: validation.details
        }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('ethics_scenarios')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          reviewed_by: reviewerId
        })
        .eq('id', scenarioId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, scenario: data });
    }

    // Admin: AI-assisted scenario generation
    if (action === 'admin-generate-scenario') {
      const { adminId, topic, scenarioType, difficulty, frameworkFocus } = body;

      const scenario = await generateAIScenario(
        topic,
        scenarioType,
        difficulty,
        frameworkFocus
      );

      // Save to database
      const { data: scenarioData, error } = await supabase
        .from('ethics_scenarios')
        .insert({
          ...scenario.metadata,
          created_by: adminId,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      // Insert nodes and choices
      for (const node of scenario.nodes) {
        const { data: nodeData } = await supabase
          .from('scenario_nodes')
          .insert({
            scenario_id: scenarioData.id,
            ...node
          })
          .select()
          .single();

        // Insert choices for this node
        if (node.choices) {
          for (const choice of node.choices) {
            await supabase
              .from('scenario_choices')
              .insert({
                node_id: nodeData.id,
                ...choice
              });
          }
        }
      }

      return NextResponse.json({
        success: true,
        scenarioId: scenarioData.id,
        scenario: scenarioData
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Ethics roleplay POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

// AC 6: Generate detailed feedback for choice
async function generateChoiceFeedback(choice: any): Promise<any> {
  const frameworks = choice.framework_scores || {};
  
  const frameworkAnalysis: any = {};
  for (const [key, score] of Object.entries(frameworks)) {
    const framework = ETHICAL_FRAMEWORKS[key as keyof typeof ETHICAL_FRAMEWORKS];
    if (framework) {
      frameworkAnalysis[key] = {
        name: framework.name,
        score: score,
        alignment: getAlignmentLevel(score as number),
        explanation: generateFrameworkExplanation(key, score as number, choice.choice_text)
      };
    }
  }

  return {
    immediate: choice.immediate_feedback,
    detailed: choice.detailed_explanation,
    ethical_analysis: choice.ethical_analysis,
    framework_breakdown: frameworkAnalysis,
    overall_ethical_score: choice.ethical_score,
    score_interpretation: interpretScore(choice.ethical_score)
  };
}

function getAlignmentLevel(score: number): string {
  if (score >= 8) return 'Strongly aligned';
  if (score >= 5) return 'Moderately aligned';
  if (score >= 3) return 'Partially aligned';
  if (score >= 0) return 'Neutral';
  return 'Misaligned';
}

function generateFrameworkExplanation(framework: string, score: number, choice: string): string {
  const explanations: Record<string, Record<string, string>> = {
    utilitarian: {
      high: 'This choice maximizes overall welfare and considers the greatest good for the greatest number.',
      medium: 'This choice has mixed consequences - some benefit but potential downsides exist.',
      low: 'This choice may not optimize for collective welfare and could harm overall outcomes.'
    },
    deontological: {
      high: 'This choice adheres to moral duties and respects fundamental ethical rules.',
      medium: 'This choice partially follows duty-based principles but may compromise in some areas.',
      low: 'This choice may violate core moral duties or ethical obligations.'
    },
    virtue: {
      high: 'This choice demonstrates virtuous character traits like courage, honesty, and integrity.',
      medium: 'This choice shows some virtue but may lack in other character aspects.',
      low: 'This choice may not reflect the highest standards of character and virtue.'
    },
    justice: {
      high: 'This choice promotes fairness, equal treatment, and protects rights.',
      medium: 'This choice attempts fairness but may have some equity concerns.',
      low: 'This choice may create unfair outcomes or violate principles of justice.'
    }
  };

  const level = score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low';
  return explanations[framework]?.[level] || 'Analysis pending.';
}

function interpretScore(score: number): string {
  if (score >= 8) return 'Exemplary ethical choice';
  if (score >= 5) return 'Good ethical reasoning';
  if (score >= 2) return 'Acceptable but could be improved';
  if (score >= 0) return 'Neutral ethical stance';
  if (score >= -3) return 'Ethically questionable';
  return 'Significant ethical concerns';
}

// AC 5, 8: Analyze session result
function analyzeSessionResult(session: any): any {
  const frameworkScores = session.framework_scores || {};
  const maxScore = session.max_possible_score || 1;
  const percentage = session.final_score_percentage || 50;

  // Determine dominant framework
  let dominantFramework = 'mixed';
  let maxFrameworkScore = 0;
  for (const [key, value] of Object.entries(frameworkScores)) {
    if ((value as number) > maxFrameworkScore) {
      maxFrameworkScore = value as number;
      dominantFramework = key;
    }
  }

  return {
    overall_performance: getPerformanceLevel(percentage),
    percentage_score: percentage,
    dominant_framework: dominantFramework,
    framework_breakdown: frameworkScores,
    ending_quality: getEndingQuality(session.ending_reached),
    time_analysis: analyzeTime(session.time_spent_seconds),
    improvement_suggestions: generateImprovementSuggestions(session),
    strengths: identifyStrengths(session),
    areas_for_growth: identifyGrowthAreas(session)
  };
}

function getPerformanceLevel(percentage: number): string {
  if (percentage >= 90) return 'Outstanding';
  if (percentage >= 75) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 45) return 'Developing';
  return 'Needs Improvement';
}

function getEndingQuality(ending: string): string {
  const quality: Record<string, string> = {
    best: 'Achieved the optimal outcome',
    good: 'Achieved a positive outcome',
    neutral: 'Achieved a neutral outcome',
    bad: 'Resulted in negative consequences',
    worst: 'Resulted in the worst possible outcome'
  };
  return quality[ending] || 'Outcome not classified';
}

function analyzeTime(seconds: number): any {
  const minutes = Math.floor(seconds / 60);
  return {
    total_seconds: seconds,
    total_minutes: minutes,
    pace: minutes < 3 ? 'Quick decision-maker' : 
          minutes < 7 ? 'Thoughtful deliberator' : 'Deep analyzer'
  };
}

function generateImprovementSuggestions(session: any): string[] {
  const suggestions: string[] = [];
  const frameworkScores = session.framework_scores || {};

  // Check weak frameworks
  for (const [framework, score] of Object.entries(frameworkScores)) {
    if ((score as number) < 20) {
      const fw = ETHICAL_FRAMEWORKS[framework as keyof typeof ETHICAL_FRAMEWORKS];
      if (fw) {
        suggestions.push(`Consider the ${fw.name} perspective: ${fw.description}`);
      }
    }
  }

  if (session.ending_reached === 'bad' || session.ending_reached === 'worst') {
    suggestions.push('Review the consequences of each choice before deciding');
    suggestions.push('Consider multiple stakeholders when making decisions');
  }

  if (suggestions.length === 0) {
    suggestions.push('Continue practicing to reinforce ethical reasoning skills');
  }

  return suggestions;
}

function identifyStrengths(session: any): string[] {
  const strengths: string[] = [];
  const frameworkScores = session.framework_scores || {};

  for (const [framework, score] of Object.entries(frameworkScores)) {
    if ((score as number) >= 30) {
      const fw = ETHICAL_FRAMEWORKS[framework as keyof typeof ETHICAL_FRAMEWORKS];
      if (fw) {
        strengths.push(`Strong ${fw.name} reasoning`);
      }
    }
  }

  if (session.ending_reached === 'best') {
    strengths.push('Excellent decision-making leading to optimal outcome');
  }

  return strengths.length > 0 ? strengths : ['Willingness to engage with ethical dilemmas'];
}

function identifyGrowthAreas(session: any): string[] {
  const areas: string[] = [];
  const frameworkScores = session.framework_scores || {};

  const lowestFramework = Object.entries(frameworkScores)
    .sort(([, a], [, b]) => (a as number) - (b as number))[0];

  if (lowestFramework) {
    const fw = ETHICAL_FRAMEWORKS[lowestFramework[0] as keyof typeof ETHICAL_FRAMEWORKS];
    if (fw) {
      areas.push(`Developing ${fw.name} perspective`);
    }
  }

  return areas;
}

// AC 3: Validate scenario has minimum depth
async function validateScenarioDepth(supabase: any, scenarioId: string): Promise<any> {
  const { data: nodes } = await supabase
    .from('scenario_nodes')
    .select('level, node_type')
    .eq('scenario_id', scenarioId);

  if (!nodes || nodes.length === 0) {
    return { valid: false, error: 'Scenario has no nodes' };
  }

  const endings = nodes.filter((n: any) => n.node_type === 'ending');
  if (endings.length === 0) {
    return { valid: false, error: 'Scenario has no endings' };
  }

  const shallowEndings = endings.filter((n: any) => n.level < MIN_DEPTH);
  if (shallowEndings.length > 0) {
    return {
      valid: false,
      error: `Some endings are at level ${shallowEndings[0].level}, minimum is ${MIN_DEPTH}`,
      details: { minRequired: MIN_DEPTH, found: shallowEndings.length }
    };
  }

  return { valid: true };
}

// AC 7: Request video generation via VPS Revideo
async function requestVideoGeneration(
  scenarioId: string,
  pathNodes: string[],
  pathType: string
): Promise<any> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Create video record
  const { data: video, error } = await supabase
    .from('ethics_feedback_videos')
    .insert({
      scenario_id: scenarioId,
      path_type: pathType,
      path_nodes: pathNodes,
      video_status: 'generating'
    })
    .select()
    .single();

  if (error) throw error;

  // Get nodes for narration script
  const { data: nodeData } = await supabase
    .from('scenario_nodes')
    .select('*')
    .in('id', pathNodes)
    .order('level');
  
  const nodesForScript: any[] = nodeData ?? [];

  // Generate narration script
  const script = await generateNarrationScript(nodesForScript, pathType);

  // Request Revideo generation
  try {
    const response = await fetch(`${vpsRevideoUrl}/api/render/ethics-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: video.id,
        scenarioId,
        pathNodes,
        pathType,
        script,
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/revideo`
      })
    });

    if (response.ok) {
      const result = await response.json();
      return { ...video, render_job_id: result.jobId };
    }
  } catch (err) {
    console.error('Revideo request failed:', err);
  }

  return video;
}

// Generate narration script for video feedback
async function generateNarrationScript(nodes: any[], pathType: string): Promise<string> {
  const nodeDescriptions = nodes.map((n: any, i: number) => 
    `Step ${i + 1}: ${n.title}\n${n.narrative}`
  ).join('\n\n');

  const prompt = `Generate a 2-minute narration script for an ethics case study video.
Path type: ${pathType}
The scenario progresses through these stages:

${nodeDescriptions}

Create an engaging narration that:
1. Explains each decision point
2. Analyzes the ethical implications
3. References relevant ethical frameworks
4. Provides actionable insights for UPSC ethics paper preparation`;

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
      return result.choices[0].message.content;
    }
  } catch (err) {
    console.error('Script generation error:', err);
  }

  return 'Narration script generation pending.';
}

// AC 6: Generate AI-enhanced feedback
async function generateAIFeedback(choiceId: string, context: any): Promise<any> {
  const prompt = `Analyze this ethical choice from a UPSC GS4 perspective:

Choice: ${context.choiceText}
Scenario: ${context.scenarioDescription}
Previous choices: ${context.previousChoices?.join(', ') || 'None'}

Provide:
1. Ethical analysis using multiple frameworks
2. Potential consequences of this choice
3. What this reveals about decision-making style
4. How to answer similar scenarios in UPSC mains
5. Relevant thinkers/concepts to cite`;

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
      return {
        analysis: result.choices[0].message.content,
        generated: true
      };
    }
  } catch (err) {
    console.error('AI feedback error:', err);
  }

  return { analysis: 'Detailed analysis pending.', generated: false };
}

// Admin: AI-assisted scenario generation
async function generateAIScenario(
  topic: string,
  scenarioType: string,
  difficulty: string,
  frameworkFocus: string
): Promise<any> {
  const prompt = `Create a detailed ethics roleplay scenario for UPSC GS4 preparation.

Topic: ${topic}
Type: ${scenarioType}
Difficulty: ${difficulty}
Primary Framework: ${frameworkFocus}

Generate a complete scenario with:
1. Title and description
2. Root situation (initial context)
3. At least 3 decision points with 3-4 choices each
4. Minimum 3 levels deep
5. Multiple endings (best, good, neutral, bad)
6. Ethical framework scores for each choice
7. Feedback for each choice

Return as JSON with this structure:
{
  "metadata": { title, description, scenario_type, difficulty, primary_framework, tags },
  "nodes": [
    { node_type, level, title, narrative, ending_type?, choices: [
      { choice_text, choice_label, framework_scores, ethical_score, immediate_feedback }
    ]}
  ]
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
        max_tokens: 4000
      })
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0].message.content;
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error('Scenario generation error:', err);
  }

  // Return template if AI fails
  return {
    metadata: {
      title: topic,
      description: `An ethical dilemma about ${topic}`,
      scenario_type: scenarioType,
      difficulty,
      primary_framework: frameworkFocus,
      tags: [topic, scenarioType]
    },
    nodes: []
  };
}
