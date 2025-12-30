// Story 8.5 AC 7: Bookmark API for PYQ questions
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

    const { question_id, notes, tags } = await req.json();

    if (!question_id) {
      return NextResponse.json({ error: 'question_id required' }, { status: 400 });
    }

    // Check if bookmark already exists
    const { data: existing } = await supabase
      .from('pyq_bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('question_id', question_id)
      .single();

    if (existing) {
      // Update existing bookmark
      const { data, error } = await supabase
        .from('pyq_bookmarks')
        .update({ notes, tags, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ bookmark: data, action: 'updated' });
    }

    // Create new bookmark
    const { data, error } = await supabase
      .from('pyq_bookmarks')
      .insert({ user_id: user.id, question_id, notes, tags })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ bookmark: data, action: 'created' }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const question_id = searchParams.get('question_id');

    if (!question_id) {
      return NextResponse.json({ error: 'question_id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('pyq_bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('question_id', question_id);

    if (error) throw error;
    return NextResponse.json({ message: 'Bookmark removed' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const question_id = searchParams.get('question_id');

    if (question_id) {
      // Get specific bookmark
      const { data, error } = await supabase
        .from('pyq_bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .eq('question_id', question_id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return NextResponse.json({ bookmark: data || null });
    }

    // Get all bookmarks for user
    const { data, error } = await supabase
      .from('pyq_bookmarks')
      .select('*, pyq_questions(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ bookmarks: data });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
