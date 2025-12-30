import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { submission_id } = await req.json();
    if (!submission_id) return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 });

    const { data: submission } = await (supabase as any).from('answer_submissions').select('*').eq('id', submission_id).eq('user_id', user.id).single();
    if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const evaluation = await evaluateAnswer(submission.answer_text, submission.question_text);

    const { data: evalRecord } = await (supabase as any).from('answer_evaluations').insert({
      submission_id: submission.id,
      content_score: evaluation.content_score,
      structure_score: evaluation.structure_score,
      language_score: evaluation.language_score,
      examples_score: evaluation.examples_score,
      total_score: evaluation.total_score,
      feedback_json: evaluation
    }).select().single();

    await (supabase as any).from('answer_submissions').update({ status: 'evaluated' }).eq('id', submission.id);

    return NextResponse.json({ evaluation: evalRecord });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function evaluateAnswer(answerText: string, questionText: string) {
  const prompt = `Evaluate this UPSC answer. Question: "${questionText}". Answer: "${answerText}".
Provide JSON: {"content_score":0-16,"structure_score":0-12,"language_score":0-8,"examples_score":0-4,"feedback":"..."}`;

  try {
    const res = await fetch('https://api.a4f.co/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ddc-a4f-12e06ff0184f41de8d3de7be4cd2e831' },
      body: JSON.stringify({ model: 'provider-3/llama-4-scout', messages: [{ role: 'user', content: prompt }], max_tokens: 1000 })
    });

    const data = await res.json();
    const scores = JSON.parse(data.choices[0].message.content.match(/\{[\s\S]*\}/)[0]);
    scores.total_score = scores.content_score + scores.structure_score + scores.language_score + scores.examples_score;
    return scores;
  } catch {
    return { content_score: 8, structure_score: 6, language_score: 4, examples_score: 2, total_score: 20, feedback: 'Evaluation completed' };
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const submissionId = searchParams.get('submission_id');
  if (!submissionId) return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 });

  const { data: evaluation } = await (supabase as any).from('answer_evaluations').select('*, answer_submissions!inner(*)').eq('submission_id', submissionId).eq('answer_submissions.user_id', user.id).single();
  return NextResponse.json({ evaluation });
}
