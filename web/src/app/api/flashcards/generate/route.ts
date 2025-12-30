import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { topic_id } = await req.json();

  const { data: topic } = await (supabase as any)
    .from('topic_progress')
    .select('*')
    .eq('id', topic_id)
    .single();

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  const flashcards = await generateFlashcards(topic);

  const today = new Date().toISOString().split('T')[0];
  const cards = flashcards.map((card: any) => ({
    user_id: user.id,
    topic_id: topic.id,
    question: card.question,
    answer: card.answer,
    difficulty: card.difficulty || 'medium',
    tags: card.tags || [],
    next_review_date: today
  }));

  const { data: inserted } = await (supabase as any)
    .from('flashcards')
    .insert(cards)
    .select();

  return NextResponse.json({ flashcards: inserted || [] });
}

async function generateFlashcards(topic: any) {
  const prompt = `Create 5 flashcard Q&A pairs for "${topic.topic}" in ${topic.subject}. 
Format as JSON array: [{"question": "...", "answer": "...", "difficulty": "easy|medium|hard", "tags": ["tag1"]}]
Focus on facts, definitions, dates, key concepts for UPSC.`;

  const response = await fetch('https://api.a4f.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ddc-a4f-12e06ff0184f41de8d3de7be4cd2e831`
    },
    body: JSON.stringify({
      model: 'provider-3/llama-4-scout',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000
    })
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}
