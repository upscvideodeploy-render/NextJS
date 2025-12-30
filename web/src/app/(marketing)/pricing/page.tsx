/**
 * Pricing Page
 * Story 5.6 - Pricing Page - Plan Comparison & CTA
 *
 * AC#1: /pricing with 4-column comparison table
 * AC#2: Plans with pricing
 * AC#3: Features listed with Free limits vs Pro unlimited
 * AC#4: Highlight Annual with "Most Popular" badge
 * AC#5: CTA buttons
 * AC#9: Mobile-optimized
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_inr: number;
  duration_days: number;
  features: Record<string, unknown>;
}

const PLAN_FEATURES = [
  { key: 'doubt_videos', name: 'AI Doubt Video Generator', free: '3/day', pro: 'Unlimited' },
  { key: 'notes', name: 'Smart Notes Generator', free: '5/day', pro: 'Unlimited' },
  { key: 'search', name: 'Intelligent Knowledge Search', free: '10/day', pro: 'Unlimited' },
  { key: 'daily_ca', name: 'Daily Current Affairs Video', free: '-', pro: '✓' },
  { key: 'test_series', name: 'Test Series & Mock Tests', free: '-', pro: '✓' },
  { key: 'pyq_database', name: 'PYQ Video Explanations', free: '-', pro: '✓' },
  { key: 'essay_trainer', name: 'AI Essay Trainer', free: '-', pro: '✓' },
  { key: 'documentaries', name: '3-Hour Documentary Lectures', free: '-', pro: '✓' },
  { key: 'interview_prep', name: 'Live Interview Prep Studio', free: '-', pro: '✓' },
  { key: 'priority_support', name: 'Priority Support', free: '-', pro: 'Annual Only' },
];

const FAQ_ITEMS = [
  {
    question: 'What happens after my 7-day trial ends?',
    answer: 'After your trial ends, you will be automatically moved to the Free tier. You can continue using basic features with daily limits, or upgrade to Pro for unlimited access.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.',
  },
  {
    question: 'Is there a refund policy?',
    answer: 'We offer a 7-day money-back guarantee if you are not satisfied with our Pro plan. Contact support within 7 days of purchase for a full refund.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit/debit cards, UPI, net banking, and popular wallets through our secure Razorpay gateway.',
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [hasUsedTrial, setHasUsedTrial] = useState(false);

  useEffect(() => {
    fetchPlans();
    checkUser();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price_inr', { ascending: true });

    if (data) {
      setPlans(data);
    }
    setIsLoading(false);
  };

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('trial_started_at')
        .eq('user_id', user.id)
        .single();

      setHasUsedTrial(!!subscription?.trial_started_at);
    }
  };

  const handleSubscribe = (planSlug: string) => {
    if (!user) {
      router.push('/auth/signup?redirect=/pricing');
      return;
    }
    router.push(`/checkout?plan=${planSlug}`);
  };

  const getMonthlyPrice = (plan: Plan) => {
    return Math.round(plan.price_inr / (plan.duration_days / 30));
  };

  const getSavingsPercent = (plan: Plan) => {
    const monthlyPlan = plans.find(p => p.slug === 'monthly');
    if (!monthlyPlan || plan.slug === 'monthly') return 0;

    const monthlyEquivalent = monthlyPlan.price_inr * (plan.duration_days / 30);
    return Math.round((1 - plan.price_inr / monthlyEquivalent) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="pt-20 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Choose Your <span className="text-purple-400">UPSC Success</span> Plan
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto px-4">
          Start with a 7-day free trial. No credit card required.
          Cancel anytime.
        </p>

        {/* Billing Toggle (AC#8) */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <span className={billingPeriod === 'monthly' ? 'text-white' : 'text-gray-500'}>
            Monthly
          </span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
            className="relative w-14 h-7 bg-gray-700 rounded-full transition-colors"
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-purple-500 rounded-full transition-transform ${
                billingPeriod === 'annual' ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={billingPeriod === 'annual' ? 'text-white' : 'text-gray-500'}>
            Annual <span className="text-green-400 text-sm">(Save 30%)</span>
          </span>
        </div>
      </div>

      {/* Pricing Cards (AC#1, AC#2) */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Plan */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-2">Free</h3>
            <div className="mb-4">
              <span className="text-4xl font-bold">₹0</span>
              <span className="text-gray-500">/forever</span>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Basic access with daily limits
            </p>
            <button
              onClick={() => router.push('/auth/signup')}
              className="w-full py-3 px-4 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get Started
            </button>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                3 doubt videos/day
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                5 notes/day
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                10 searches/day
              </li>
            </ul>
          </div>

          {/* Pro Plans */}
          {plans.map((plan) => {
            const isPopular = plan.slug === 'annual';
            const savings = getSavingsPercent(plan);
            const showPlan = billingPeriod === 'annual'
              ? ['annual', 'half-yearly'].includes(plan.slug)
              : ['monthly', 'quarterly'].includes(plan.slug);

            if (!showPlan && plan.slug !== 'annual') return null;

            return (
              <div
                key={plan.id}
                className={`relative bg-gray-900/50 border rounded-2xl p-6 ${
                  isPopular
                    ? 'border-purple-500 ring-2 ring-purple-500/20'
                    : 'border-gray-800'
                }`}
              >
                {/* Popular Badge (AC#4) */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold">₹{plan.price_inr}</span>
                  <span className="text-gray-500">
                    /{plan.duration_days === 30 ? 'mo' : plan.duration_days === 365 ? 'yr' : `${plan.duration_days}d`}
                  </span>
                </div>
                {savings > 0 && (
                  <p className="text-green-400 text-sm mb-4">
                    Save {savings}% (₹{getMonthlyPrice(plan)}/mo)
                  </p>
                )}
                <p className="text-gray-400 text-sm mb-6">
                  Full access to all features
                </p>

                {/* CTA Button (AC#5) */}
                <button
                  onClick={() => handleSubscribe(plan.slug)}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                    isPopular
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {!user
                    ? 'Start 7-Day Trial'
                    : hasUsedTrial
                    ? 'Subscribe Now'
                    : 'Start 7-Day Trial'}
                </button>

                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Unlimited doubt videos
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Unlimited notes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    All premium features
                  </li>
                  {plan.slug === 'annual' && (
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400">★</span>
                      Priority support
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table (AC#3) */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-center mb-8">
            Compare All Features
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-4 px-4 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold">Free</th>
                  <th className="text-center py-4 px-4 font-semibold text-purple-400">Pro</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((feature, index) => (
                  <tr
                    key={feature.key}
                    className={index % 2 === 0 ? 'bg-gray-900/30' : ''}
                  >
                    <td className="py-4 px-4">{feature.name}</td>
                    <td className="text-center py-4 px-4 text-gray-400">
                      {feature.free}
                    </td>
                    <td className="text-center py-4 px-4 text-green-400">
                      {feature.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section (AC#6) */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq, index) => (
              <details
                key={index}
                className="bg-gray-900/50 border border-gray-800 rounded-lg group"
              >
                <summary className="cursor-pointer p-4 font-semibold list-none flex justify-between items-center">
                  {faq.question}
                  <span className="text-gray-500 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <p className="px-4 pb-4 text-gray-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Start Your UPSC Journey?
          </h2>
          <p className="text-gray-400 mb-8">
            Join thousands of aspirants preparing smarter with AI
          </p>
          <button
            onClick={() => router.push('/auth/signup')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors"
          >
            Start Your Free Trial
          </button>
        </div>
      </div>
    </div>
  );
}
