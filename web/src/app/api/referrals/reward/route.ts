/**
 * Referral Reward Processing API
 * Story 5.10 - Referral Program - User Acquisition
 *
 * AC#4: When referred user subscribes, referrer gets 1 month free extension
 * AC#8: Max 10 referrals rewarded per month
 *
 * This API is called internally when a payment webhook confirms subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RewardRequest {
  user_id: string;
}

/**
 * POST /api/referrals/reward
 * Process referral reward when user subscribes
 */
export async function POST(request: NextRequest) {
  try {
    // Verify service role access (internal API)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.includes(process.env.SUPABASE_SERVICE_ROLE_KEY!)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RewardRequest = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Find referral for this user
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_id', user_id)
      .single();

    if (referralError || !referral) {
      return NextResponse.json({
        success: true,
        message: 'No referral found for this user'
      });
    }

    // Check if already rewarded
    if (referral.status === 'rewarded') {
      return NextResponse.json({
        success: true,
        message: 'Referral already rewarded'
      });
    }

    // Check monthly reward limit (AC#8)
    const { data: monthlyRewards } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_id', referral.referrer_id)
      .eq('status', 'rewarded')
      .gte('reward_applied_at', new Date(new Date().setDate(1)).toISOString());

    const maxRewardsPerMonth = 10;
    if (monthlyRewards && monthlyRewards.length >= maxRewardsPerMonth) {
      return NextResponse.json({
        success: false,
        message: 'Monthly reward limit reached',
        limit: maxRewardsPerMonth,
      });
    }

    // Get referrer's current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', referral.referrer_id)
      .single();

    let rewardType = 'free_month';
    let rewardValue = 30; // 30 days

    if (subscription && subscription.status === 'active') {
      // Extend existing subscription by 1 month
      const newExpiry = subscription.subscription_expires_at
        ? new Date(new Date(subscription.subscription_expires_at).getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await supabase
        .from('subscriptions')
        .update({
          subscription_expires_at: newExpiry.toISOString(),
        })
        .eq('user_id', referral.referrer_id);

      rewardType = 'subscription_extension';
      rewardValue = 30;
    } else {
      // Create or extend trial for referrer
      const now = new Date();
      const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (!subscription) {
        // Create new free month subscription
        await supabase
          .from('subscriptions')
          .insert({
            user_id: referral.referrer_id,
            status: 'active',
            subscription_started_at: now.toISOString(),
            subscription_expires_at: expiry.toISOString(),
            auto_renew: false,
          });
      } else if (subscription.status === 'trial' || subscription.status === 'expired') {
        // Reactivate/extend
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            subscription_expires_at: expiry.toISOString(),
            canceled_at: null,
          })
          .eq('user_id', referral.referrer_id);
      }

      rewardType = 'free_month';
      rewardValue = 30;
    }

    // Update referral status
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'rewarded',
        reward_type: rewardType,
        reward_value: rewardValue,
        reward_applied_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    if (updateError) {
      console.error('Update referral error:', updateError);
      return NextResponse.json({ error: 'Failed to update referral' }, { status: 500 });
    }

    // Log reward event (for audit)
    await supabase
      .from('audit_logs')
      .insert({
        user_id: referral.referrer_id,
        action: 'referral_reward_applied',
        resource_type: 'referral',
        resource_id: referral.id,
        metadata: {
          referred_user_id: user_id,
          reward_type: rewardType,
          reward_value: rewardValue,
        },
      });

    return NextResponse.json({
      success: true,
      reward: {
        type: rewardType,
        value: rewardValue,
        applied_at: new Date().toISOString(),
      },
      message: 'Referral reward applied successfully'
    });

  } catch (error) {
    console.error('Referral reward API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
