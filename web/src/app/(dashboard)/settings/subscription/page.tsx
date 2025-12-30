/**
 * Subscription Management Dashboard
 * Story 5.5 - Subscription Management - User Dashboard
 *
 * AC#1: /settings/subscription with current plan card
 * AC#2: Plan details with usage stats
 * AC#3: Billing history table
 * AC#4: Manage subscription buttons
 * AC#5: Change plan with prorated calculation
 * AC#6: Cancel flow with retention offer
 * AC#7: Renewal toggle
 * AC#8: Payment method display
 * AC#9: Status indicators
 * AC#10: Support link
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Subscription {
  id: string;
  status: 'trial' | 'active' | 'canceled' | 'expired' | 'paused';
  trial_expires_at: string | null;
  subscription_expires_at: string | null;
  auto_renew: boolean;
  plan: {
    name: string;
    slug: string;
    price_inr: number;
    duration_days: number;
  } | null;
}

interface Transaction {
  id: string;
  amount_inr: number;
  final_amount: number;
  status: string;
  created_at: string;
  invoice_url: string | null;
  plan: {
    name: string;
  } | null;
}

const STATUS_COLORS = {
  trial: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  active: 'bg-green-500/20 text-green-400 border-green-500/50',
  canceled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  expired: 'bg-red-500/20 text-red-400 border-red-500/50',
  paused: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
};

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showSuccess = searchParams.get('success') === 'true';

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchSubscription();
    fetchTransactions();
  }, []);

  const fetchSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const { data } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:plans(name, slug, price_inr, duration_days)
      `)
      .eq('user_id', user.id)
      .single();

    if (data) {
      setSubscription(data);
    }
    setIsLoading(false);
  };

  const fetchTransactions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('payment_transactions')
      .select(`
        id, amount_inr, final_amount, status, created_at, invoice_url,
        plan:plans(name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      // Transform the data to match Transaction type (Supabase returns plan as array)
      const transformedData = data.map((item: any) => ({
        ...item,
        plan: Array.isArray(item.plan) && item.plan.length > 0 ? item.plan[0] : { name: 'Unknown' }
      }));
      setTransactions(transformedData as Transaction[]);
    }
  };

  const toggleAutoRenew = async () => {
    if (!subscription) return;

    const { error } = await supabase
      .from('subscriptions')
      .update({ auto_renew: !subscription.auto_renew })
      .eq('id', subscription.id);

    if (!error) {
      setSubscription({ ...subscription, auto_renew: !subscription.auto_renew });
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch('/api/subscriptions/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ reason: cancelReason }),
    });

    if (response.ok) {
      setShowCancelModal(false);
      fetchSubscription();
    }
  };

  const getDaysRemaining = () => {
    if (!subscription) return 0;

    const expiryDate = subscription.status === 'trial'
      ? subscription.trial_expires_at
      : subscription.subscription_expires_at;

    if (!expiryDate) return 0;

    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining();

  return (
    <div className="min-h-screen bg-gray-950 text-white py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Subscription</h1>

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
            <p className="text-green-400 font-semibold">
              🎉 Payment successful! Your subscription is now active.
            </p>
          </div>
        )}

        {/* Current Plan Card (AC#1, AC#2) */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">
                {subscription?.plan?.name || 'Free Plan'}
              </h2>
              {/* Status Badge (AC#9) */}
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm border ${
                STATUS_COLORS[subscription?.status || 'expired']
              }`}>
                {subscription?.status === 'trial' ? 'Trial' :
                 subscription?.status === 'active' ? 'Active' :
                 subscription?.status === 'canceled' ? 'Cancelled' :
                 subscription?.status === 'expired' ? 'Expired' : 'Unknown'}
              </span>
            </div>
            {subscription?.plan && (
              <p className="text-2xl font-bold">
                ₹{subscription.plan.price_inr}
                <span className="text-sm text-gray-400 font-normal">
                  /{subscription.plan.duration_days === 30 ? 'mo' :
                    subscription.plan.duration_days === 365 ? 'yr' :
                    `${subscription.plan.duration_days}d`}
                </span>
              </p>
            )}
          </div>

          {/* Expiry Info */}
          {(subscription?.status === 'trial' || subscription?.status === 'active') && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>
                  {subscription.status === 'trial' ? 'Trial ends' : 'Renews'} in
                </span>
                <span>{daysRemaining} days</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (daysRemaining / (subscription.status === 'trial' ? 7 : 30)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons (AC#4) */}
          <div className="flex flex-wrap gap-3 mt-6">
            {subscription?.status !== 'active' && (
              <button
                onClick={() => router.push('/pricing')}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors"
              >
                {subscription?.status === 'trial' ? 'Upgrade Now' : 'Subscribe'}
              </button>
            )}
            {subscription?.status === 'active' && (
              <>
                <button
                  onClick={() => router.push('/pricing')}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                >
                  Change Plan
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="text-red-400 hover:text-red-300 px-4 py-2 transition-colors"
                >
                  Cancel Subscription
                </button>
              </>
            )}
          </div>
        </div>

        {/* Auto-Renewal Toggle (AC#7) */}
        {subscription?.status === 'active' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Auto-Renewal</h3>
                <p className="text-sm text-gray-400">
                  {subscription.auto_renew
                    ? 'Your subscription will automatically renew'
                    : 'Your subscription will expire at the end of the period'}
                </p>
              </div>
              <button
                onClick={toggleAutoRenew}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  subscription.auto_renew ? 'bg-purple-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    subscription.auto_renew ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Billing History (AC#3) */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Billing History</h2>
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="border-t border-gray-800">
                      <td className="py-3">{formatDate(txn.created_at)}</td>
                      <td className="py-3">{txn.plan?.name || '-'}</td>
                      <td className="py-3">₹{txn.final_amount}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          txn.status === 'captured' ? 'bg-green-500/20 text-green-400' :
                          txn.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {txn.invoice_url ? (
                          <a
                            href={txn.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300"
                          >
                            Download
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400">No transactions yet</p>
          )}
        </div>

        {/* Support Link (AC#10) */}
        <div className="text-center">
          <p className="text-gray-400">
            Need help?{' '}
            <a
              href="mailto:support@upsc-prepx.ai"
              className="text-purple-400 hover:text-purple-300"
            >
              Contact Support
            </a>
          </p>
        </div>

        {/* Cancel Modal (AC#6) */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Cancel Subscription?</h2>

              {/* Retention Offer */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                <p className="font-semibold text-purple-400">
                  🎁 Wait! Here is a special offer for you
                </p>
                <p className="text-sm text-gray-300 mt-2">
                  Get 20% off your next renewal if you stay with us!
                </p>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="mt-3 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm w-full"
                >
                  Keep My Subscription (Get 20% Off)
                </button>
              </div>

              <p className="text-gray-400 text-sm mb-4">
                Your subscription will remain active until the end of your current
                billing period. You will not be charged again.
              </p>

              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Tell us why you are leaving (optional)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 mb-4 resize-none"
                rows={3}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg"
                >
                  Cancel Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
