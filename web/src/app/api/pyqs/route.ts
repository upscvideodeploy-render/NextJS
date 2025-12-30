import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Story 8.1 - Upload PYQ PDF
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const year = formData.get('year') as string;
  const paperType = formData.get('paper_type') as string;

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const fileName = `${year}/${paperType}/${Date.now()}_${file.name}`;
  const { data: upload } = await supabase.storage.from('pyq-pdfs').upload(fileName, file);

  const { data: paper } = await (supabase as any).from('pyq_papers').insert({
    year: parseInt(year),
    paper_type: paperType,
    file_url: upload?.path,
    uploaded_by: user.id,
    status: 'pending'
  }).select().single();

  // Story 8.2 - Trigger OCR extraction
  fetch('/api/pyqs/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paper_id: paper.id })
  }).catch(() => {});

  return NextResponse.json({ paper });
}

// Story 8.5 - Browse PYQ Database
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject');
  const year = searchParams.get('year');

  let query = (supabase as any).from('pyq_questions').select('*, pyq_papers(year, paper_type)');
  
  if (subject) query = query.eq('subject', subject);
  if (year) query = query.eq('pyq_papers.year', parseInt(year));

  const { data: questions } = await query.limit(50);

  return NextResponse.json({ questions: questions || [] });
}
