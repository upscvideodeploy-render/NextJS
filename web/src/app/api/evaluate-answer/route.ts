/**
 * Answer Evaluation API Endpoint
 * Story 7.2 - Answer AI Evaluation Engine
 *
 * Calls the Supabase Edge Function for answer evaluation with:
 * - 30-second timeout handling (AC#10)
 * - RAG-based content verification (AC#3)
 * - Rubric-based scoring (AC#1)
 * - Processing time tracking
 */

import { NextRequest, NextResponse } from 'next/server';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const MAX_TIMEOUT_MS = 30000; // 30 seconds (AC#10)

interface EvaluationRequest {
  submissionId: string;
  question: string;
  answer: string;
  gsPaper?: string;
  topic?: string;
  wordLimit?: number;
}

interface EvaluationResponse {
  success: boolean;
  evaluation?: {
    id: string;
    submission_id: string;
    content_score: number;
    structure_score: number;
    language_score: number;
    examples_score: number;
    total_score: number;
    weighted_percentage: number;
    feedback_json: {
      content: string[];
      structure: string[];
      language: string[];
      examples: string[];
      suggestions: string[];
      key_points_missed: string[];
    };
    processing_time_seconds: number;
  };
  processing_time_seconds?: number;
  error?: string;
}

/**
 * Call the Supabase Edge Function with timeout handling
 */
async function callEdgeFunction(payload: {
  submission_id: string;
  question_text: string;
  answer_text: string;
  syllabus_topic?: string;
  gs_paper?: string;
  word_limit?: number;
}): Promise<EvaluationResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/evaluate_answer_pipe`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Evaluation timeout: exceeded 30 seconds');
    }
    throw error;
  }
}

/**
 * Transform Edge Function response to frontend-friendly format
 */
function transformResponse(edgeFnResponse: EvaluationResponse): {
  success: boolean;
  feedback: {
    score: number;
    strengths: string[];
    improvements: string[];
    sample_points: string[];
  };
  rubric: {
    content_score: number;
    structure_score: number;
    language_score: number;
    examples_score: number;
  };
  processing_time_seconds: number;
  weighted_percentage: number;
} {
  const evaluation = edgeFnResponse.evaluation;

  if (!evaluation) {
    return {
      success: false,
      feedback: {
        score: 6,
        strengths: ['Good effort in attempting the question'],
        improvements: ['Keep practicing regularly'],
        sample_points: ['Define key terms', 'Give examples', 'Conclude properly'],
      },
      rubric: {
        content_score: 6,
        structure_score: 6,
        language_score: 6,
        examples_score: 6,
      },
      processing_time_seconds: edgeFnResponse.processing_time_seconds || 0,
      weighted_percentage: 60,
    };
  }

  const feedbackJson = evaluation.feedback_json || {
    content: [],
    structure: [],
    language: [],
    examples: [],
    suggestions: [],
    key_points_missed: [],
  };

  return {
    success: true,
    feedback: {
      score: evaluation.total_score / 4, // Convert 0-40 to 0-10
      strengths: (feedbackJson.content || []).filter(Boolean).length > 0
        ? feedbackJson.content.filter(Boolean)
        : ['Good coverage of topic'],
      improvements: (feedbackJson.suggestions || []).filter(Boolean).length > 0
        ? feedbackJson.suggestions.filter(Boolean)
        : ['Add more examples'],
      sample_points: (feedbackJson.key_points_missed || []).filter(Boolean).length > 0
        ? feedbackJson.key_points_missed.filter(Boolean)
        : ['Include relevant data'],
    },
    rubric: {
      content_score: evaluation.content_score,
      structure_score: evaluation.structure_score,
      language_score: evaluation.language_score,
      examples_score: evaluation.examples_score,
    },
    processing_time_seconds: evaluation.processing_time_seconds || edgeFnResponse.processing_time_seconds || 0,
    weighted_percentage: evaluation.weighted_percentage || 60,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: EvaluationRequest = await request.json();
    const { submissionId, question, answer, gsPaper, topic, wordLimit } = body;

    // Validate required fields
    if (!submissionId || !question || !answer) {
      return NextResponse.json(
        { error: 'Missing required fields: submissionId, question, answer' },
        { status: 400 }
      );
    }

    // Call the Supabase Edge Function with timeout handling (AC#10)
    const edgeFnResponse = await callEdgeFunction({
      submission_id: submissionId,
      question_text: question,
      answer_text: answer,
      syllabus_topic: topic,
      gs_paper: gsPaper,
      word_limit: wordLimit,
    });

    // Transform response to frontend-friendly format
    const transformedResponse = transformResponse(edgeFnResponse);

    return NextResponse.json(transformedResponse);

  } catch (error: unknown) {
    const processingTime = (Date.now() - startTime) / 1000;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Evaluation error:', errorMessage);

    // Return graceful fallback with error info
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        processing_time_seconds: processingTime,
        feedback: {
          score: 6,
          strengths: ['Good effort in attempting the question'],
          improvements: ['Keep practicing regularly'],
          sample_points: ['Define key terms', 'Give examples', 'Conclude properly'],
        },
        rubric: {
          content_score: 6,
          structure_score: 6,
          language_score: 6,
          examples_score: 6,
        },
        weighted_percentage: 60,
      },
      { status: errorMessage.includes('timeout') ? 408 : 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/evaluate-answer',
    description: 'Answer evaluation API for UPSC answer writing practice',
  });
}
