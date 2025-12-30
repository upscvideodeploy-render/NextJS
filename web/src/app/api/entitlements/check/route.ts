/**
 * Entitlement Check API
 * Story 5.4 - Entitlement Checks - Feature-Level Enforcement
 *
 * AC#3: checkEntitlement(user_id, feature_slug)
 * AC#4: Returns { allowed, reason, show_paywall, upgrade_cta }
 * AC#6: Server-side enforcement
 * AC#9: Hard blocks - API returns 403 if entitlement fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EntitlementRequest {
  feature_slug: string;
  increment_usage?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        {
          allowed: false,
          reason: 'unauthorized',
          show_paywall: true,
          upgrade_cta: 'Please sign in to continue',
        },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          allowed: false,
          reason: 'unauthorized',
          show_paywall: true,
          upgrade_cta: 'Please sign in to continue',
        },
        { status: 401 }
      );
    }

    const body: EntitlementRequest = await request.json();
    const { feature_slug, increment_usage } = body;

    if (!feature_slug) {
      return NextResponse.json(
        { error: 'feature_slug is required' },
        { status: 400 }
      );
    }

    // Call database function for entitlement check
    const { data: result, error } = await supabase.rpc('check_entitlement', {
      p_user_id: user.id,
      p_feature_slug: feature_slug,
    });

    if (error) {
      console.error('Entitlement check error:', error);
      return NextResponse.json(
        { error: 'Failed to check entitlement' },
        { status: 500 }
      );
    }

    const entitlement = result?.[0];

    if (!entitlement) {
      return NextResponse.json(
        {
          allowed: false,
          reason: 'check_failed',
          show_paywall: true,
          upgrade_cta: 'Please try again',
        },
        { status: 500 }
      );
    }

    // If allowed and increment_usage requested, increment the usage count
    if (entitlement.allowed && increment_usage) {
      await supabase.rpc('increment_entitlement_usage', {
        p_user_id: user.id,
        p_feature_slug: feature_slug,
      });

      // Update usage count in response
      if (entitlement.usage_count !== null) {
        entitlement.usage_count += 1;
      }
    }

    // Return entitlement result (AC#4)
    const response = {
      allowed: entitlement.allowed,
      reason: entitlement.reason,
      show_paywall: entitlement.show_paywall,
      upgrade_cta: entitlement.upgrade_cta,
      usage: entitlement.limit_value ? {
        current: entitlement.usage_count,
        limit: entitlement.limit_value,
        remaining: Math.max(0, entitlement.limit_value - entitlement.usage_count),
      } : null,
      tier: entitlement.tier,
    };

    // Return 403 if not allowed (AC#9)
    if (!entitlement.allowed) {
      return NextResponse.json(response, { status: 403 });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Entitlement check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET for simple entitlement queries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const featureSlug = searchParams.get('feature');

  if (!featureSlug) {
    return NextResponse.json(
      { error: 'feature query parameter is required' },
      { status: 400 }
    );
  }

  // Create a fake POST request
  const modifiedRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ feature_slug: featureSlug }),
  });

  return POST(modifiedRequest);
}
