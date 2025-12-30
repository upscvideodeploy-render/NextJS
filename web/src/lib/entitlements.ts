import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface EntitlementCheckResult {
  allowed: boolean;
  reason: string;
  usage_count?: number;
  limit_value?: number;
  upgrade_required?: boolean;
}

export async function checkEntitlement(
  userId: string,
  featureSlug: string
): Promise<EntitlementCheckResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Check subscription status
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError) {
      return {
        allowed: false,
        reason: 'No subscription found',
        upgrade_required: true,
      };
    }

    // 2. Check if trial is active
    if (subscription.status === 'trial') {
      const now = new Date();
      const trialExpires = new Date(subscription.trial_expires_at);

      if (now < trialExpires) {
        return {
          allowed: true,
          reason: 'trial_active',
        };
      } else {
        // Trial expired - downgrade to free tier
        await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', subscription.id);
      }
    }

    // 3. Check if paid subscription is active
    if (subscription.status === 'active') {
      const now = new Date();
      const subExpires = new Date(subscription.subscription_expires_at);

      if (now < subExpires) {
        return {
          allowed: true,
          reason: 'subscription_active',
        };
      } else {
        // Subscription expired
        await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', subscription.id);
      }
    }

    // 4. Free tier - check entitlement limits
    const { data: entitlement, error: entError } = await supabase
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
      .eq('feature_slug', featureSlug)
      .single();

    if (entError || !entitlement) {
      // No entitlement record - create default for free tier
      const freeEntitlement = {
        user_id: userId,
        feature_slug: featureSlug,
        limit_type: 'daily',
        limit_value: 3, // 3 doubts per day for free users
        usage_count: 0,
        last_reset_at: new Date().toISOString(),
      };

      await supabase.from('entitlements').insert(freeEntitlement);

      return {
        allowed: true,
        reason: 'free_tier_within_limit',
        usage_count: 0,
        limit_value: 3,
      };
    }

    // 5. Check if limit reached
    if (entitlement.limit_type === 'unlimited') {
      return {
        allowed: true,
        reason: 'unlimited',
      };
    }

    // Reset daily limits if needed
    if (entitlement.limit_type === 'daily') {
      const lastReset = new Date(entitlement.last_reset_at);
      const now = new Date();
      const daysSinceReset = Math.floor(
        (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceReset >= 1) {
        // Reset daily usage
        await supabase
          .from('entitlements')
          .update({
            usage_count: 0,
            last_reset_at: now.toISOString(),
          })
          .eq('id', entitlement.id);

        return {
          allowed: true,
          reason: 'daily_limit_reset',
          usage_count: 0,
          limit_value: entitlement.limit_value,
        };
      }
    }

    // 6. Check usage against limit
    if (entitlement.usage_count < entitlement.limit_value) {
      return {
        allowed: true,
        reason: 'within_limit',
        usage_count: entitlement.usage_count,
        limit_value: entitlement.limit_value,
      };
    }

    // 7. Limit reached
    return {
      allowed: false,
      reason: 'limit_reached',
      usage_count: entitlement.usage_count,
      limit_value: entitlement.limit_value,
      upgrade_required: true,
    };
  } catch (error) {
    console.error('Entitlement check error:', error);
    return {
      allowed: false,
      reason: 'error',
    };
  }
}

export async function incrementUsage(
  userId: string,
  featureSlug: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await supabase.rpc('increment_entitlement_usage', {
    p_user_id: userId,
    p_feature_slug: featureSlug,
  });
}
