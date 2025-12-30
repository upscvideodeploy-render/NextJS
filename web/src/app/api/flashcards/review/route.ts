import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  const { data: cards } = await (supabase as any)
    .from('flashcards')
    .select('*')
    .eq('user_id', user.id)
    .lte('next_review_date', today)
    .limit(50);

  return NextResponse.json({ flashcards: cards || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { card_id, rating } = await req.json();

  const { data: card } = await (supabase as any)
    .from('flashcards')
    .select('*')
    .eq('id', card_id)
    .single();

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const { easeFactor, interval } = calculateSM2(card.ease_factor, card.interval_days, rating);

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  const { data: updated } = await (supabase as any)
    .from('flashcards')
    .update({
      ease_factor: easeFactor,
      interval_days: interval,
      next_review_date: nextReviewDate.toISOString().split('T')[0],
      review_count: card.review_count + 1
    })
    .eq('id', card_id)
    .select()
    .single();

  return NextResponse.json({ card: updated });
}

function calculateSM2(ef: number, interval: number, rating: 'easy' | 'medium' | 'hard') {
  const quality = rating === 'easy' ? 5 : rating === 'medium' ? 3 : 1;
  
  let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  let newInterval = 1;
  if (quality >= 3) {
    if (interval === 0) newInterval = 1;
    else if (interval === 1) newInterval = 6;
    else newInterval = Math.round(interval * newEF);
  }

  return { easeFactor: newEF, interval: newInterval };
}
