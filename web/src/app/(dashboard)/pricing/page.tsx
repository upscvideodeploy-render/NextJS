'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSubscription, PLANS, formatPrice, calculateSavings } from '@/hooks/useSubscription';

interface PricingPageProps {
  onPlanSelect?: (planId: string) => void;
}

export default function PricingPage({ onPlanSelect }: PricingPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const supabase = getSupabaseBrowserClient();
  const { subscription, isTrialActive, isSubscriptionActive, daysRemaining } = useSubscription();

  // Features list for display
  const PRO_FEATURES = [
    'Unlimited AI-generated notes',
    'Unlimited video explanations',
    'Daily current affairs videos',
    'Doubt-to-video converter',
    'PYQ video explanations',
    'AI essay trainer',
    'Answer writing practice',
    'Full RAG search access',
    'Test series & mock tests',
    'Priority support',
  ];

  const handlePlanSelect = async (planId: string) => {
    setSelectedPlan(planId);
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to login
        window.location.href = '/login?redirect=/pricing';
        return;
      }

      // Call checkout session creation
      // TODO: Integrate with Razorpay (Story 5.2) for actual payment
      const { data, error } = await supabase.functions.invoke('create_checkout_session', {
        body: {
          planId,
          userId: user.id,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/pricing?payment=cancelled`,
        },
      });

      if (error) {
        console.error('Checkout error:', error);
        // For now, show a message that payment integration is coming soon
        alert('Payment integration coming soon! Your 7-day free trial gives you full access.');
        return;
      }

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (onPlanSelect) {
        onPlanSelect(planId);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter plans based on billing cycle preference
  const displayPlans = billingCycle === 'annual'
    ? PLANS.filter(p => p.slug === 'annual')
    : PLANS;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Current Subscription Status */}
        {(isTrialActive || isSubscriptionActive) && (
          <div className="mb-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-green-400 font-medium">
                    {isTrialActive ? 'Free Trial Active' : 'Pro Subscription Active'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {daysRemaining} days remaining
                  </p>
                </div>
              </div>
              {isTrialActive && (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                  Full Pro Access
                </span>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Choose Your Plan</h1>
          <p className="text-gray-400 text-lg mb-8">
            Unlock unlimited access to AI-powered UPSC preparation
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center bg-slate-800/50 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Plans
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === 'annual'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Annual Only
              <span className="ml-2 text-xs text-green-400">Save 30%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className={`grid gap-6 ${
          displayPlans.length === 1
            ? 'grid-cols-1 max-w-md mx-auto'
            : displayPlans.length === 2
            ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
        }`}>
          {displayPlans.map((plan) => {
            const savings = calculateSavings(plan);
            const isPopular = plan.slug === 'quarterly';
            const isSelected = selectedPlan === plan.id;
            const isLoadingPlan = isProcessing && selectedPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 transition-all bg-slate-800/50 border ${
                  isPopular
                    ? 'border-blue-500 border-2'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Savings Badge */}
                {savings > 0 && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      Save {savings}%
                    </span>
                  </div>
                )}

                {/* Plan Name */}
                <div className="text-center mb-6 pt-2">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">
                      {formatPrice(plan.priceInr)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">
                    for {plan.durationDays} days
                  </p>
                  {plan.durationDays > 30 && (
                    <p className="text-blue-400 text-xs mt-1">
                      {formatPrice(Math.round(plan.priceInr / (plan.durationDays / 30)))}/month
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {PRO_FEATURES.slice(0, 6).map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                  {PRO_FEATURES.length > 6 && (
                    <li className="text-center">
                      <span className="text-blue-400 text-sm">
                        + {PRO_FEATURES.length - 6} more features
                      </span>
                    </li>
                  )}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={isLoadingPlan || isSubscriptionActive}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    isPopular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  } ${(isLoadingPlan || isSubscriptionActive) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoadingPlan ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </span>
                  ) : isSubscriptionActive ? (
                    'Current Plan'
                  ) : (
                    'Get Started'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trial Notice */}
        {!isTrialActive && !isSubscriptionActive && (
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl">
              <svg
                className="w-8 h-8 text-blue-400"
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
              <div className="text-left">
                <p className="text-white font-medium text-lg">Start with 7-Day Free Trial</p>
                <p className="text-gray-400 text-sm">
                  Full Pro access, no credit card required. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* All Features Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Everything Included in Pro
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRO_FEATURES.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-slate-800/30 rounded-lg">
                <svg
                  className="w-5 h-5 text-green-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: 'What happens after my free trial?',
                a: 'After 7 days, you will be downgraded to the free tier with limited features. You can upgrade to Pro anytime to continue with full access.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes, you can cancel your subscription at any time. Your access continues until the end of your billing period.',
              },
              {
                q: 'Is there a refund policy?',
                a: 'We offer a 7-day money-back guarantee. If you are not satisfied, contact support for a full refund.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit/debit cards, UPI, net banking, and digital wallets via Razorpay.',
              },
              {
                q: 'Can I switch plans?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Pro-rated adjustments will be made automatically.',
              },
              {
                q: 'Do you offer student discounts?',
                a: 'Yes! Contact support with your valid student ID to get an additional 20% discount on annual plans.',
              },
            ].map((faq, index) => (
              <div key={index} className="p-6 bg-slate-800/30 rounded-xl">
                <h3 className="text-white font-medium mb-2">{faq.q}</h3>
                <p className="text-gray-400 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-16 text-center">
          <div className="flex flex-wrap justify-center gap-8 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Secure Payments
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              7-Day Money Back
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              Cancel Anytime
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
