/**
 * Revenue Data Export API
 * Story 5.8 - AC#10: Export transaction data as CSV
 *
 * GET /api/admin/revenue/export?start_date=2025-01-01&end_date=2025-12-31
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get date range from query params
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('payment_transactions')
      .select(`
        *,
        user:users(email),
        plan:plans(name, slug)
      `)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Export fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Generate CSV
    const csvHeaders = [
      'Transaction ID',
      'Date',
      'User Email',
      'Plan',
      'Amount (₹)',
      'Discount (₹)',
      'Final Amount (₹)',
      'Coupon Code',
      'Payment Method',
      'Status',
      'Razorpay Payment ID',
    ];

    const csvRows = transactions?.map((txn: any) => {
      const user = Array.isArray(txn.user) ? txn.user[0] : txn.user;
      const plan = Array.isArray(txn.plan) ? txn.plan[0] : txn.plan;

      return [
        txn.id,
        new Date(txn.created_at).toLocaleDateString(),
        user?.email || 'N/A',
        plan?.name || 'N/A',
        (txn.amount_inr / 100).toFixed(2),
        (txn.discount_amount / 100).toFixed(2),
        (txn.final_amount / 100).toFixed(2),
        txn.coupon_code || '',
        txn.payment_method || '',
        txn.status,
        txn.razorpay_payment_id || '',
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    }) || [];

    const csv = [csvHeaders.join(','), ...csvRows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="revenue-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
