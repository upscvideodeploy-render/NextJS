/**
 * useSubscription Hook
 * Story 5.1 - RevenueCat Integration
 *
 * Provides subscription state and entitlement checking for the frontend.
 */

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type SubscriptionStatus = 'trial' | 'active' | 'canceled' | 'expired' | 'paused' | 'none';
export type PlanSlug = 'monthly' | 'quarterly' | 'half-yearly' | 'annual' | 'free';

export interface Subscription {
  id: string;
  userId: string;
  planId: string | null;
  planSlug: PlanSlug;
  status: SubscriptionStatus;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  subscriptionStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  autoRenew: boolean;
  canceledAt: string | null;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  priceInr: number;
  durationDays: number;
  features: Record<string, any>;
}

export interface SubscriptionState {
  subscription: Subscription | null;
  plan: Plan | null;
  isLoading: boolean;
  error: string | null;
  isTrialActive: boolean;
  isSubscriptionActive: boolean;
  daysRemaining: number;
  canAccessFeature: (featureSlug: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

// Plan configurations
export const PLANS: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly Pro',
    slug: 'monthly',
    priceInr: 599,
    durationDays: 30,
    features: {
      videos: 'unlimited',
      notes: 'unlimited',
      search: 'unlimited',
      doubt_videos: 'unlimited',
      ai_tutor: true,
      test_series: true,
      pyq_database: true,
    },
  },
  {
    id: 'quarterly',
    name: 'Quarterly Pro',
    slug: 'quarterly',
    priceInr: 1499,
    durationDays: 90,
    features: {
      videos: 'unlimited',
      notes: 'unlimited',
      search: 'unlimited',
      doubt_videos: 'unlimited',
      ai_tutor: true,
      test_series: true,
      pyq_database: true,
      discount: '17%',
    },
  },
  {
    id: 'half-yearly',
    name: 'Half-Yearly Pro',
    slug: 'half-yearly',
    priceInr: 2699,
    durationDays: 180,
    features: {
      videos: 'unlimited',
      notes: 'unlimited',
      search: 'unlimited',
      doubt_videos: 'unlimited',
      ai_tutor: true,
      test_series: true,
      pyq_database: true,
      discount: '25%',
    },
  },
  {
    id: 'annual',
    name: 'Annual Pro',
    slug: 'annual',
    priceInr: 4999,
    durationDays: 365,
    features: {
      videos: 'unlimited',
      notes: 'unlimited',
      search: 'unlimited',
      doubt_videos: 'unlimited',
      ai_tutor: true,
      test_series: true,
      pyq_database: true,
      discount: '30%',
      priority_support: true,
    },
  },
];

export function useSubscription(): SubscriptionState {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  const fetchSubscription = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        setPlan(null);
        setIsLoading(false);
        return;
      }

      // Fetch subscription with plan
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plans:plan_id (
            id,
            name,
            slug,
            price_inr,
            duration_days,
            features
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      if (subData) {
        const subscription = subData as any;
        const planData = subscription.plans;

        setSubscription({
          id: subscription.id,
          userId: subscription.user_id,
          planId: subscription.plan_id,
          planSlug: planData?.slug || 'free',
          status: subscription.status as SubscriptionStatus,
          trialStartedAt: subscription.trial_started_at,
          trialExpiresAt: subscription.trial_expires_at,
          subscriptionStartedAt: subscription.subscription_started_at,
          subscriptionExpiresAt: subscription.subscription_expires_at,
          autoRenew: subscription.auto_renew,
          canceledAt: subscription.canceled_at,
        });

        if (planData) {
          setPlan({
            id: planData.id,
            name: planData.name,
            slug: planData.slug,
            priceInr: planData.price_inr,
            durationDays: planData.duration_days,
            features: planData.features,
          });
        }
      } else {
        setSubscription(null);
        setPlan(null);
      }
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message || 'Failed to fetch subscription');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSubscription();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, [fetchSubscription, supabase.auth]);

  // Check if trial is active
  const isTrialActive = Boolean(
    subscription?.status === 'trial' &&
    subscription.trialExpiresAt &&
    new Date(subscription.trialExpiresAt) > new Date()
  );

  // Check if subscription is active
  const isSubscriptionActive = Boolean(
    subscription?.status === 'active' &&
    subscription.subscriptionExpiresAt &&
    new Date(subscription.subscriptionExpiresAt) > new Date()
  );

  // Calculate days remaining
  const getDaysRemaining = (): number => {
    if (!subscription) return 0;

    const expiryDate = subscription.status === 'trial'
      ? subscription.trialExpiresAt
      : subscription.subscriptionExpiresAt;

    if (!expiryDate) return 0;

    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry.getTime() - now.getTime();

    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Check feature access
  const canAccessFeature = useCallback(async (featureSlug: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return false;

      // Use the RPC function for accurate checking
      const { data, error } = await (supabase.rpc as any)('check_feature_access', {
        p_user_id: user.id,
        p_feature_slug: featureSlug,
      });

      if (error) {
        console.error('Error checking feature access:', error);
        return false;
      }

      return data?.[0]?.allowed ?? false;
    } catch (err) {
      console.error('Error checking feature access:', err);
      return false;
    }
  }, [supabase]);

  return {
    subscription,
    plan,
    isLoading,
    error,
    isTrialActive,
    isSubscriptionActive,
    daysRemaining: getDaysRemaining(),
    canAccessFeature,
    refresh: fetchSubscription,
  };
}

// Helper function to format price
export function formatPrice(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Helper function to get plan by ID
export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId || p.slug === planId);
}

// Helper function to calculate savings
export function calculateSavings(plan: Plan): number {
  const monthlyRate = 599; // Base monthly price
  const monthlyEquivalent = (plan.priceInr / plan.durationDays) * 30;
  return Math.round(((monthlyRate - monthlyEquivalent) / monthlyRate) * 100);
}
