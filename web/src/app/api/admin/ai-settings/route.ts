import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/admin/ai-settings - Fetch all AI providers and models
export async function GET() {
  try {
    const [providersResult, modelsResult] = await Promise.all([
      supabase.from('ai_providers').select('*').order('display_order'),
      supabase.from('ai_models').select('*')
    ]);

    if (providersResult.error) throw providersResult.error;
    if (modelsResult.error) throw modelsResult.error;

    return NextResponse.json({
      success: true,
      providers: providersResult.data,
      models: modelsResult.data
    });
  } catch (error) {
    console.error('Failed to fetch AI settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI settings' },
      { status: 500 }
    );
  }
}

// POST /api/admin/ai-settings - Update AI providers and models
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providers, models } = body;

    // Update providers
    if (providers && Array.isArray(providers)) {
      for (const provider of providers) {
        const { error } = await supabase
          .from('ai_providers')
          .upsert({
            provider_id: provider.provider_id || provider.id,
            name: provider.name,
            base_url: provider.baseUrl || provider.base_url || '',
            api_key_encrypted: provider.apiKey || provider.api_key_encrypted,
            auth_type: provider.authType || provider.auth_type || 'bearer',
            custom_headers: provider.customHeaders ? JSON.parse(provider.customHeaders) : provider.custom_headers,
            is_active: provider.isActive ?? provider.is_active ?? false,
            is_custom: provider.isCustom ?? provider.is_custom ?? false,
            description: provider.description,
            updated_at: new Date().toISOString()
          }, { onConflict: 'provider_id' });

        if (error) {
          console.error('Error updating provider:', provider.provider_id, error);
        }
      }
    }

    // Update models
    if (models && Array.isArray(models)) {
      for (const model of models) {
        const { error } = await supabase
          .from('ai_models')
          .upsert({
            model_id: model.model_id || model.id,
            name: model.name,
            model_type: model.type || model.model_type,
            provider_id: model.providerId || model.provider_id,
            model_name: model.modelId || model.model_name,
            is_primary: model.isPrimary ?? model.is_primary ?? false,
            is_fallback: model.isFallback ?? model.is_fallback ?? false,
            config: model.config || {},
            updated_at: new Date().toISOString()
          }, { onConflict: 'model_id' });

        if (error) {
          console.error('Error updating model:', model.model_id, error);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'AI settings saved successfully' });
  } catch (error) {
    console.error('Failed to save AI settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save AI settings' },
      { status: 500 }
    );
  }
}
