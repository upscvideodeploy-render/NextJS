/**
 * User Refund Request Page
 * Story 5.9 - Refund Processing & Money-Back Guarantee
 *
 * AC#2: User clicks "Request Refund" on subscription page
 * AC#3: Confirmation modal with reason dropdown
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  subscription_started_at: string;
  subscription_expires_at: string | null;
  auto_renew: boolean;
  created_at: string;
  plan?: {
    slug: string;
    name: string;
    price_inr: number;
  } | null;
}

interface EligibilityResult {
  is_eligible: boolean;
  usage_days: number;
  used_refund_this_month: boolean;
  reason: string;
  refund_amount?: number;
  refund_type?: string;
  days_since_purchase?: number;
}

interface SubmissionResult {
  type: 'success' | 'error';
  message: string;
}

export default function RefundRequestPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:plans(slug, name, price_inr)
      `)
      .eq('user_id', session.user.id)
      .single();

    if (!error && subs) {
      setSubscription(subs);
    }
  };

  const checkEligibility = async () => {
    if (!subscription) return;

    const { data: result } = await supabase
      .rpc('check_refund_eligibility', {
        p_user_id: subscription.user_id,
        p_subscription_id: subscription.id,
      });

    if (result && result.length > 0) {
      setEligibility(result[0]);
    } else {
      setEligibility(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      alert('Please provide a reason for the refund.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/refunds/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subscription_id: subscription?.id,
          reason: reason,
        }),
      });

      const data = await response.json();

      if (data.refund) {
        setSubmissionResult({
          type: 'success',
          message: 'Refund request submitted successfully. Admin will review within 48 hours.',
        });
        setShowModal(false);
        setReason('');
        await fetchSubscription();
      } else if (data.error) {
        setSubmissionResult({
          type: 'error',
          message: data.error,
        });
      } else {
        setSubmissionResult({
          type: 'error',
          message: 'Failed to submit refund request.',
        });
      }
    } catch (error: any) {
      console.error('Refund request error:', error);
      setSubmissionResult({
        type: 'error',
        message: 'An error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Request Refund</h1>
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.history) {
              window.history.back();
            }
          }}
          className="text-gray-600 hover:text-gray-800"
        >
          Back to Subscription
        </button>
      </div>

      {/* Subscription Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        {subscription ? (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Your Subscription</h2>
              <div className="flex justify-between items-center">
                <span className={`px-3 py-1 rounded-full text-sm ${
                  subscription.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : subscription.status === 'trial'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </span>
                <span className="text-sm text-gray-600">
                  {subscription.plan && Array.isArray(subscription.plan)
                    ? subscription.plan[0].name
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600">Plan Price</div>
                <div className="text-2xl font-bold">
                  {subscription.plan && Array.isArray(subscription.plan)
                    ? `₹${(subscription.plan[0].price_inr / 100).toFixed(0)}`
                    : 'N/A'}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600">Current Period</div>
                <div className="text-2xl font-bold">
                  {subscription.plan && Array.isArray(subscription.plan)
                    ? subscription.plan[0].name
                    : 'N/A'}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600">Started On</div>
                <div className="text-2xl font-bold">
                  {new Date(subscription.subscription_started_at || subscription.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Request Refund
            </button>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Loading subscription information...
          </div>
        )}
      </div>

      {/* Refund Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Request Refund</h2>

            {eligibility && eligibility.is_eligible && (
              <div className="mb-6 bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">✅ You are eligible for a refund!</h3>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Amount:</strong> ₹{eligibility.refund_amount ? (eligibility.refund_amount / 100).toFixed(0) : 'N/A'}
                  <br />
                  <strong>Refund Type:</strong> {eligibility.refund_type}
                  <br />
                  <strong>Days since purchase:</strong> {eligibility.days_since_purchase}
                </p>
                <p className="text-sm text-gray-600 mt-4">
                  This refund will be processed within 48 hours. Please select a reason below.
                </p>
              </div>
            )}

            {eligibility && !eligibility.is_eligible && (
              <div className="mb-6 bg-red-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">⚠️ You are not eligible for a refund</h3>
                <p className="text-sm text-gray-700 mb-4">{eligibility.reason}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Reason: Your subscription period is outside the 7-day money-back guarantee window.
                  <br />
                  Alternatively, this type of subscription may not be eligible for refunds.
                </p>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 text-white rounded-lg hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Reason for Refund *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Platform didn't meet my expectations, Cancelled due to financial reasons..."
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-32"
                rows={4}
                required
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Refund Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Result */}
      {submissionResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              submissionResult.type === 'success'
                ? 'bg-green-500'
                : 'bg-red-500'
            }`}>
              <span className="text-white text-2xl font-bold">
                {submissionResult.type === 'success' ? '✓' : '✗'}
              </span>
            </div>
            <h3 className="text-xl font-bold mb-4 text-center">
              {submissionResult.type === 'success' ? 'Success' : 'Error'}
            </h3>
            <p className="text-gray-600 mb-4 text-center">{submissionResult.message}</p>
            <button
              onClick={() => {
                setSubmissionResult(null);
                setShowModal(false);
              }}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
