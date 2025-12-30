/**
 * API Route: /api/pyqs/papers
 * Story 8.1: PYQ Papers Management API
 * 
 * GET: List all PYQ papers with filtering
 * DELETE: Delete a paper and its questions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: List PYQ papers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const paperType = searchParams.get('paper_type');
    const status = searchParams.get('status');

    const supabase = getSupabaseClient();

    let query = supabase
      .from('pyq_papers')
      .select(`
        *,
        question_count:pyq_questions(count)
      `)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });

    if (year) {
      query = query.eq('year', parseInt(year));
    }
    if (paperType) {
      query = query.eq('paper_type', paperType);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Transform the data to flatten question_count
    const papers = data?.map(paper => ({
      ...paper,
      question_count: paper.question_count?.[0]?.count || 0
    }));

    return NextResponse.json({
      success: true,
      papers,
      count: papers?.length || 0
    });

  } catch (error) {
    console.error('Papers fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch papers' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a paper
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get('id');

    if (!paperId) {
      return NextResponse.json({ error: 'Paper ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Delete paper (cascade will delete questions)
    const { error } = await supabase
      .from('pyq_papers')
      .delete()
      .eq('id', paperId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Paper delete error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete paper' },
      { status: 500 }
    );
  }
}
