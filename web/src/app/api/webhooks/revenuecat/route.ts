/**
 * RevenueCat Webhook Handler
 * Story 5.1 - RevenueCat Integration
 *
 * Handles subscription events from RevenueCat:
 * - INITIAL_PURCHASE
 * - RENEWAL
 * - CANCELLATION
 * - UNCANCELLATION
 * - EXPIRATION
 * - BILLING_ISSUE
 * - PRODUCT_CHANGE
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Supabase client with service role for webhook processing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// RevenueCat webhook secret for signature verification
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || '';

// Event types from RevenueCat
type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'SUBSCRIBER_ALIAS'
  | 'TRANSFER'
  | 'TEST';

interface RevenueCatEvent {
  api_version: string;
  event: {
    type: RevenueCatEventType;
    id: string;
    app_user_id: string;
    original_app_user_id: string;
    aliases: string[];
    product_id: string;
    entitlement_ids: string[];
    period_type: 'TRIAL' | 'NORMAL' | 'INTRO';
    purchased_at_ms: number;
    expiration_at_ms: number;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
    environment: 'SANDBOX' | 'PRODUCTION';
    is_family_share: boolean;
    country_code: string;
    currency: string;
    price: number;
    price_in_purchased_currency: number;
    subscriber_attributes: Record<string, { value: string; updated_at_ms: number }>;
    transaction_id: string;
    original_transaction_id: string;
    presented_offering_id: string;
    takehome_percentage: number;
    offer_code: string | null;
    tax_percentage: number;
    commission_percentage: number;
  };
}

// Map RevenueCat product IDs to plan slugs
const PRODUCT_TO_PLAN: Record<string, string> = {
  'prepx_monthly': 'monthly',
  'prepx_quarterly': 'quarterly',
  'prepx_half_yearly': 'half-yearly',
  'prepx_annual': 'annual',
  'pro_monthly': 'monthly',
  'pro_quarterly': 'quarterly',
  'pro_half_yearly': 'half-yearly',
  'pro_annual': 'annual',
};

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('REVENUECAT_WEBHOOK_SECRET not set, skipping signature verification');
    return true; // Allow in development
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Get or create user by RevenueCat app_user_id
async function getOrCreateUser(appUserId: string): Promise<string | null> {
  // First, check if this is a Supabase user ID (UUID format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(appUserId)) {
    // It's already a Supabase user ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', appUserId)
      .single();

    return user?.id || null;
  }

  // Otherwise, look up by email or alias
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', appUserId)
    .single();

  return user?.id || null;
}

// Get plan ID from slug
async function getPlanId(planSlug: string): Promise<string | null> {
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('slug', planSlug)
    .single();

  return plan?.id || null;
}

// Update subscription in database
async function updateSubscription(
  userId: string,
  event: RevenueCatEvent['event']
): Promise<void> {
  const planSlug = PRODUCT_TO_PLAN[event.product_id];
  const planId = planSlug ? await getPlanId(planSlug) : null;

  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  const startedAt = event.purchased_at_ms
    ? new Date(event.purchased_at_ms).toISOString()
    : null;

  // Determine subscription status based on event type
  let status: string;
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
      status = event.period_type === 'TRIAL' ? 'trial' : 'active';
      break;
    case 'CANCELLATION':
      status = 'canceled';
      break;
    case 'EXPIRATION':
      status = 'expired';
      break;
    case 'BILLING_ISSUE':
      status = 'paused';
      break;
    default:
      status = 'active';
  }

  // Upsert subscription
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan_id: planId,
      status,
      subscription_started_at: startedAt,
      subscription_expires_at: expiresAt,
      trial_started_at: event.period_type === 'TRIAL' ? startedAt : null,
      trial_expires_at: event.period_type === 'TRIAL' ? expiresAt : null,
      revenuecat_subscription_id: event.original_transaction_id,
      auto_renew: event.type !== 'CANCELLATION',
      canceled_at: event.type === 'CANCELLATION' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Failed to update subscription:', error);
    throw error;
  }

  // Update entitlements based on subscription status
  if (status === 'active' || status === 'trial') {
    await grantProEntitlements(userId);
  } else if (status === 'expired' || status === 'canceled') {
    await revokeProEntitlements(userId);
  }
}

// Grant pro entitlements to user
async function grantProEntitlements(userId: string): Promise<void> {
  const proFeatures = [
    'notes_generation',
    'video_generation',
    'doubt_video',
    'detailed_solutions',
    'unlimited_search',
    'download_pdf',
  ];

  for (const feature of proFeatures) {
    await supabase
      .from('entitlements')
      .upsert({
        user_id: userId,
        feature_slug: feature,
        limit_type: 'unlimited',
        limit_value: null,
        usage_count: 0,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,feature_slug',
      });
  }
}

// Revoke pro entitlements (downgrade to free tier)
async function revokeProEntitlements(userId: string): Promise<void> {
  const proFeatures = [
    'notes_generation',
    'video_generation',
    'doubt_video',
    'detailed_solutions',
    'unlimited_search',
    'download_pdf',
  ];

  for (const feature of proFeatures) {
    await supabase
      .from('entitlements')
      .upsert({
        user_id: userId,
        feature_slug: feature,
        limit_type: 'daily',
        limit_value: 3, // Free tier: 3 per day
        usage_count: 0,
        last_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,feature_slug',
      });
  }
}

// Log webhook event for debugging
async function logWebhookEvent(
  event: RevenueCatEvent,
  status: 'success' | 'error',
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('audit_logs')
      .insert({
        action: `revenuecat_webhook_${event.event.type.toLowerCase()}`,
        resource_type: 'subscription',
        resource_id: null,
        metadata: {
          event_id: event.event.id,
          event_type: event.event.type,
          app_user_id: event.event.app_user_id,
          product_id: event.event.product_id,
          environment: event.event.environment,
          status,
          error: errorMessage,
        },
      });
  } catch (err) {
    console.error('Failed to log webhook event:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-revenuecat-signature') || '';

    // Verify webhook signature
    if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const webhookEvent: RevenueCatEvent = JSON.parse(rawBody);
    const event = webhookEvent.event;

    console.log(`Received RevenueCat webhook: ${event.type}`, {
      app_user_id: event.app_user_id,
      product_id: event.product_id,
      environment: event.environment,
    });

    // Handle test events
    if (event.type === 'TEST') {
      await logWebhookEvent(webhookEvent, 'success');
      return NextResponse.json({ received: true, type: 'test' });
    }

    // Get user ID from app_user_id
    const userId = await getOrCreateUser(event.app_user_id);

    if (!userId) {
      console.error(`User not found for app_user_id: ${event.app_user_id}`);
      await logWebhookEvent(webhookEvent, 'error', 'User not found');

      // Return 200 to acknowledge receipt (don't retry)
      return NextResponse.json({
        received: true,
        warning: 'User not found',
      });
    }

    // Process the event
    await updateSubscription(userId, event);
    await logWebhookEvent(webhookEvent, 'success');

    return NextResponse.json({
      received: true,
      user_id: userId,
      event_type: event.type,
    });

  } catch (error: any) {
    console.error('Webhook processing error:', error);

    return NextResponse.json(
      { error: 'Webhook processing failed', message: error.message },
      { status: 500 }
    );
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/revenuecat',
    supported_events: [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'CANCELLATION',
      'UNCANCELLATION',
      'EXPIRATION',
      'BILLING_ISSUE',
      'PRODUCT_CHANGE',
      'TEST',
    ],
  });
}
