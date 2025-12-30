import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/admin/ads-settings - Fetch all ads configuration
export async function GET() {
  try {
    const [configResult, placementsResult, providersResult, revenueResult] = await Promise.all([
      supabase.from('ads_config').select('*').single(),
      supabase.from('ad_placements').select('*').order('placement_id'),
      supabase.from('ad_providers').select('*').order('provider_id'),
      supabase.from('ad_revenue').select('*').order('date', { ascending: false }).limit(30)
    ]);

    return NextResponse.json({
      success: true,
      config: configResult.data || { global_enabled: true, hide_for_pro: true, ad_free_trial_days: 3, min_screens_between_ads: 5 },
      placements: placementsResult.data || [],
      providers: providersResult.data || [],
      revenue: revenueResult.data || []
    });
  } catch (error) {
    console.error('Failed to fetch ads settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ads settings' },
      { status: 500 }
    );
  }
}

// POST /api/admin/ads-settings - Update ads configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config, placements, providers } = body;

    // Update global config
    if (config) {
      const { error } = await supabase
        .from('ads_config')
        .upsert({
          id: config.id || undefined,
          global_enabled: config.globalEnabled ?? config.global_enabled ?? true,
          hide_for_pro: config.hideForPro ?? config.hide_for_pro ?? true,
          ad_free_trial_days: config.adFreeTrialDays ?? config.ad_free_trial_days ?? 3,
          min_screens_between_ads: config.minScreensBetweenAds ?? config.min_screens_between_ads ?? 5,
          updated_at: new Date().toISOString()
        });

      if (error) console.error('Error updating ads config:', error);
    }

    // Update placements
    if (placements && Array.isArray(placements)) {
      for (const placement of placements) {
        const { error } = await supabase
          .from('ad_placements')
          .upsert({
            placement_id: placement.placement_id || placement.id,
            name: placement.name,
            location: placement.location,
            ad_type: placement.adType || placement.ad_type,
            enabled: placement.enabled ?? false,
            frequency: placement.frequency ?? 1,
            updated_at: new Date().toISOString()
          }, { onConflict: 'placement_id' });

        if (error) console.error('Error updating placement:', placement.placement_id, error);
      }
    }

    // Update providers
    if (providers && Array.isArray(providers)) {
      for (const provider of providers) {
        const { error } = await supabase
          .from('ad_providers')
          .upsert({
            provider_id: provider.provider_id || provider.id,
            name: provider.name,
            publisher_id: provider.publisherId || provider.publisher_id || '',
            app_id: provider.appId || provider.app_id || '',
            enabled: provider.enabled ?? false,
            updated_at: new Date().toISOString()
          }, { onConflict: 'provider_id' });

        if (error) console.error('Error updating ad provider:', provider.provider_id, error);
      }
    }

    return NextResponse.json({ success: true, message: 'Ads settings saved successfully' });
  } catch (error) {
    console.error('Failed to save ads settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save ads settings' },
      { status: 500 }
    );
  }
}
