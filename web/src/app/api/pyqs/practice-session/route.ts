// Story 8.5 AC 8: Practice Session Creation API
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
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

    const { filters, count = 10 } = await req.json();

    // Build query based on filters
    let query = supabase
      .from('pyq_questions')
      .select('id, year, paper_type, subject, topic, text, marks, difficulty');

    if (filters?.yearFrom) {
      query = query.gte('year', filters.yearFrom);
    }
    if (filters?.yearTo) {
      query = query.lte('year', filters.yearTo);
    }
    if (filters?.paperType && filters.paperType !== 'all') {
      query = query.eq('paper_type', filters.paperType);
    }
    if (filters?.subject && filters.subject !== 'all') {
      query = query.eq('subject', filters.subject);
    }
    if (filters?.difficulty && filters.difficulty !== 'all') {
      query = query.eq('difficulty', filters.difficulty);
    }

    // Get random questions matching filters
    const { data: allQuestions, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!allQuestions || allQuestions.length === 0) {
      return NextResponse.json({ 
        error: 'No questions found matching filters' 
      }, { status: 404 });
    }

    // Randomly select questions
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, Math.min(count, allQuestions.length));

    // Create practice session record
    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: user.id,
        session_type: 'pyq_practice',
        session_config: {
          filters,
          question_count: selectedQuestions.length,
        },
        questions: selectedQuestions.map(q => q.id),
        status: 'active',
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    return NextResponse.json({
      session_id: session.id,
      questions: selectedQuestions,
      total_count: selectedQuestions.length,
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
