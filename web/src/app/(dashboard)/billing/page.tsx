'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
// TODO: Re-enable when payment integration (Story 5.1, 5.2) is implemented
// import { formatPrice, getPlanById } from '@upsc-prepx-ai/razorpay';

// Temporary helpers until payment integration
const formatPrice = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const getPlanById = (id: string) => ({
  id,
  name: 'Pro Plan',
  price: 599,
  features: [] as string[]
} as any);

interface Subscription {
  id: string;
  status: 'active' | 'trial' | 'expired' | 'cancelled';
  plan_id: string;
  current_period_start: string;
  current_period_end: string;
  trial_expires_at?: string;
  cancel_at_period_end: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  invoice_url?: string;
}

export default function BillingPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      // Fetch subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .single();

      if (subData) {
        setSubscription(subData as Subscription);
      }

      // Fetch invoices (from RevenueCat or local table)
      const { data: invData } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (invData) {
        setInvoices(invData as Invoice[]);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const { error } = await supabase.functions.invoke('cancel_subscription', {
        method: 'POST',
      });

      if (error) {
        throw error;
      }

      // Update local state
      setSubscription((prev) =>
        prev ? { ...prev, cancel_at_period_end: true } : null
      );
      setShowCancelModal(false);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleResumeSubscription = async () => {
    try {
      const { error } = await supabase.functions.invoke('resume_subscription', {
        method: 'POST',
      });

      if (error) {
        throw error;
      }

      // Update local state
      setSubscription((prev) =>
        prev ? { ...prev, cancel_at_period_end: false } : null
      );
    } catch (error) {
      console.error('Error resuming subscription:', error);
      alert('Failed to resume subscription. Please try again.');
    }
  };

  const handleManagePayment = async () => {
    try {
      const { data } = await supabase.functions.invoke('create_portal_session', {
        method: 'POST',
      });

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('Failed to open payment portal. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'trial':
        return 'text-neon-blue bg-neon-blue/10 border-neon-blue/30';
      case 'cancelled':
        return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'expired':
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const plan = subscription ? getPlanById(subscription.plan_id) : null;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Subscription & Billing</h1>

        {/* Current Plan */}
        <div className="neon-glass rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Current Plan</h2>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-white">
                  {plan?.name || 'Free'}
                </span>
                {subscription && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${getStatusColor(
                      subscription.status
                    )}`}
                  >
                    {subscription.status}
                  </span>
                )}
              </div>
            </div>
            {subscription?.status === 'active' && (
              <button className="text-neon-blue hover:text-neon-blue/80 text-sm font-medium">
                Change Plan
              </button>
            )}
          </div>

          {/* Plan Details */}
          {subscription ? (
            <div className="space-y-4">
              {subscription.status === 'trial' && subscription.trial_expires_at && (
                <div className="p-4 bg-neon-blue/10 border border-neon-blue/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <svg
                      className="w-5 h-5 text-neon-blue"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-neon-blue font-medium">
                      Trial Active
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Your {plan?.name} trial ends on{' '}
                    {new Date(subscription.trial_expires_at).toLocaleDateString()}.
                    After that, you&apos;ll be charged{' '}
                    {formatPrice(plan?.priceInr || 0)}/{plan?.duration || 'month'}.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Price</p>
                  <p className="text-white font-medium">
                    {plan ? formatPrice(plan.priceInr) : 'Free'} /{' '}
                    {plan?.duration || 'forever'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Next Billing Date</p>
                  <p className="text-white font-medium">
                    {subscription.status === 'active' ||
                    subscription.status === 'trial'
                      ? new Date(
                          subscription.cancel_at_period_end
                            ? subscription.current_period_end
                            : subscription.current_period_end
                        ).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {subscription.cancel_at_period_end && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-yellow-400 text-sm">
                    Your subscription will end on{' '}
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                    . You&apos;ll continue to have access until then.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                {subscription.status === 'active' &&
                  !subscription.cancel_at_period_end && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel Subscription
                    </button>
                  )}
                {subscription.cancel_at_period_end && (
                  <button
                    onClick={handleResumeSubscription}
                    className="px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
                  >
                    Resume Subscription
                  </button>
                )}
                <button
                  onClick={handleManagePayment}
                  className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Manage Payment Methods
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">
                You&apos;re on the Free plan with limited features.
              </p>
              <a
                href="/dashboard/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
              >
                Upgrade to Pro
              </a>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="neon-glass rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Payment Method</h2>
          {subscription?.status === 'active' ? (
            <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center text-white text-xs font-bold">
                  VISA
                </div>
                <div>
                  <p className="text-white font-medium">**** **** **** 4242</p>
                  <p className="text-gray-400 text-sm">Expires 12/25</p>
                </div>
              </div>
              <button
                onClick={handleManagePayment}
                className="text-neon-blue hover:text-neon-blue/80 text-sm font-medium"
              >
                Update
              </button>
            </div>
          ) : (
            <p className="text-gray-400">
              No payment method on file. Add one when you upgrade.
            </p>
          )}
        </div>

        {/* Billing History */}
        <div className="neon-glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Billing History</h2>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        invoice.status === 'paid'
                          ? 'bg-green-500/20'
                          : invoice.status === 'pending'
                          ? 'bg-yellow-500/20'
                          : 'bg-red-500/20'
                      }`}
                    >
                      <svg
                        className={`w-5 h-5 ${
                          invoice.status === 'paid'
                            ? 'text-green-400'
                            : invoice.status === 'pending'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {formatPrice(invoice.amount / 100)}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {invoice.invoice_url && (
                    <a
                      href={invoice.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-blue hover:text-neon-blue/80 text-sm font-medium"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              No billing history yet.
            </p>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="neon-glass p-8 rounded-2xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Cancel Subscription?
            </h3>
            <p className="text-gray-400 mb-6">
              Your subscription will remain active until{' '}
              {subscription
                ? new Date(subscription.current_period_end).toLocaleDateString()
                : 'the end of your billing period'}
              . You can resume anytime before then.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white hover:bg-slate-700/50 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isCancelling}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isCancelling ? 'Processing...' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
