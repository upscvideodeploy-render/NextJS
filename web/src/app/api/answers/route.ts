import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Story 7.1 - Daily questions & submission
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];
  const { data: questions } = await (supabase as any).from('daily_questions').select('*').eq('date', today);
  return NextResponse.json({ questions: questions || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  
  // Story 7.1 - Submit answer
  if (body.action === 'submit') {
    const { data: submission } = await (supabase as any).from('answer_submissions').insert({
      user_id: user.id, question_id: body.question_id, question_text: body.question_text,
      answer_text: body.answer_text, word_count: body.word_count, time_taken_seconds: body.time_taken_seconds,
      status: 'submitted', submitted_at: new Date().toISOString()
    }).select().single();
    
    // Story 7.2 - Evaluate answer
    const evaluation = await evaluateAnswer(submission, body.question_text);
    await (supabase as any).from('answer_evaluations').insert(evaluation);
    
    return NextResponse.json({ submission, evaluation });
  }
  
  // Story 7.5 - Submit essay
  if (body.action === 'submit_essay') {
    const { data: essay } = await (supabase as any).from('essay_submissions').insert({
      user_id: user.id, title: body.title, content: body.content, word_count: body.word_count
    }).select().single();
    return NextResponse.json({ essay });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// Story 7.2 - AI Evaluation Engine
async function evaluateAnswer(submission: any, question: string) {
  const prompt = `Evaluate this UPSC Mains answer. Question: "${question}". Answer: "${submission.answer_text}".
Provide scores (0-10) for: Content, Structure, Language, Examples. Return JSON: {"content":X,"structure":X,"language":X,"examples":X,"feedback":"..."}`;

  const res = await fetch('https://api.a4f.co/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ddc-a4f-12e06ff0184f41de8d3de7be4cd2e831' },
    body: JSON.stringify({ model: 'provider-3/llama-4-scout', messages: [{ role: 'user', content: prompt }], max_tokens: 1000 })
  });

  const data = await res.json();
  const scores = JSON.parse(data.choices[0].message.content);
  const total = scores.content + scores.structure + scores.language + scores.examples;

  return {
    submission_id: submission.id,
    content_score: scores.content,
    structure_score: scores.structure,
    language_score: scores.language,
    examples_score: scores.examples,
    total_score: total,
    feedback_json: scores
  };
}
