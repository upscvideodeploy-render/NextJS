/**
 * API Route: /api/voice
 * Story 16.1: AI Voice Teacher - TTS Customization
 * 
 * Endpoints:
 * GET: voices, preferences, styles, clones, preview, popular
 * POST: save-preferences, generate, clone, preview-style
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Initialize Supabase client
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Get user from session
async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    // Try to get from cookie
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    if (!accessToken) return null;
    
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    return user;
  }
  
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// Check user subscription tier
async function getUserTier(userId: string): Promise<string> {
  const supabase = getSupabaseClient();
  
  const { data } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  return data?.tier || 'free';
}

// =====================================================
// GET Handlers
// =====================================================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'voices';
  
  try {
    const user = await getUser(request);
    const supabase = getSupabaseClient();
    
    switch (action) {
      // Get all available voices (AC 1)
      case 'voices': {
        const gender = searchParams.get('gender');
        const accent = searchParams.get('accent');
        const style = searchParams.get('style');
        const tier = user ? await getUserTier(user.id) : 'free';
        
        let query = supabase
          .from('voice_options')
          .select('*')
          .eq('is_active', true)
          .order('display_order');
        
        if (gender) query = query.eq('gender', gender);
        if (accent) query = query.eq('accent', accent);
        if (style) query = query.eq('style', style);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Mark which voices user has access to (AC 7)
        const voices = data?.map(voice => ({
          ...voice,
          has_access: !voice.is_premium || 
            (tier === 'pro' && voice.required_tier !== 'annual') ||
            tier === 'annual'
        }));
        
        return NextResponse.json({
          success: true,
          voices,
          user_tier: tier,
          filters: {
            genders: ['male', 'female', 'neutral'],
            accents: ['indian_english', 'american', 'british', 'australian'],
            styles: ['professor', 'mentor', 'peer', 'narrator', 'enthusiastic']
          }
        });
      }
      
      // Get user's current preferences (AC 4)
      case 'preferences': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { data, error } = await supabase.rpc('get_user_voice_settings', {
          p_user_id: user.id
        });
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          preferences: data
        });
      }
      
      // Get style presets (AC 3)
      case 'styles': {
        const { data, error } = await supabase
          .from('voice_style_presets')
          .select('*')
          .order('display_order');
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          styles: data,
          descriptions: {
            professor: 'Formal, detailed explanations with academic precision',
            mentor: 'Warm, encouraging guidance with motivational elements',
            peer: 'Casual, relatable explanations like a friend'
          }
        });
      }
      
      // Get user's voice clones (AC 8)
      case 'clones': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { data, error } = await supabase
          .from('voice_clones')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          clones: data || [],
          clone_limit: 3, // Max clones per user
          requirements: {
            min_duration_seconds: 60,
            max_file_size_mb: 50,
            supported_formats: ['mp3', 'wav', 'm4a', 'ogg']
          }
        });
      }
      
      // Preview voice sample (AC 5)
      case 'preview': {
        const voiceId = searchParams.get('voice_id');
        if (!voiceId) {
          return NextResponse.json({ error: 'Voice ID required' }, { status: 400 });
        }
        
        const { data: voice, error } = await supabase
          .from('voice_options')
          .select('*')
          .eq('id', voiceId)
          .single();
        
        if (error) throw error;
        
        // Check access for premium voices (AC 7)
        if (voice.is_premium && user) {
          const tier = await getUserTier(user.id);
          if (tier === 'free' || (voice.required_tier === 'annual' && tier !== 'annual')) {
            return NextResponse.json({
              success: true,
              voice,
              preview_available: false,
              upgrade_required: true,
              required_tier: voice.required_tier
            });
          }
        }
        
        return NextResponse.json({
          success: true,
          voice,
          preview_available: true,
          sample_url: voice.sample_audio_url,
          sample_text: 'Welcome to your personalized UPSC learning journey. I\'ll be your guide as we explore the fascinating world of Indian polity and governance.'
        });
      }
      
      // Get popular voices
      case 'popular': {
        const { data, error } = await supabase.rpc('get_popular_voices', {
          p_limit: 5
        });
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          popular_voices: data || []
        });
      }
      
      // Get TTS providers
      case 'providers': {
        const { data, error } = await supabase
          .from('tts_providers')
          .select('id, name, slug, is_premium, features')
          .eq('is_active', true);
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          providers: data
        });
      }
      
      // Speed options (AC 2)
      case 'speed-options': {
        return NextResponse.json({
          success: true,
          speeds: [
            { value: 0.75, label: '0.75x (Slow)', description: 'For complex topics' },
            { value: 0.9, label: '0.9x', description: 'Slightly slower' },
            { value: 1.0, label: '1.0x (Normal)', description: 'Default speed' },
            { value: 1.1, label: '1.1x', description: 'Slightly faster' },
            { value: 1.25, label: '1.25x (Fast)', description: 'For review' },
            { value: 1.5, label: '1.5x (Very Fast)', description: 'Quick revision' }
          ],
          default: 1.0,
          min: 0.75,
          max: 1.5,
          step: 0.05
        });
      }
      
      // Accessibility options (AC 10)
      case 'accessibility': {
        return NextResponse.json({
          success: true,
          options: {
            enhanced_clarity: {
              label: 'Enhanced Clarity',
              description: 'Clearer pronunciation for better understanding',
              default: false
            },
            bass_boost: {
              label: 'Bass Boost',
              description: 'Deeper voice for hearing comfort',
              default: false
            },
            noise_reduction: {
              label: 'Noise Reduction',
              description: 'Reduce background noise in generated audio',
              default: true
            },
            auto_captions: {
              label: 'Auto Captions',
              description: 'Generate captions for all voice content',
              default: true
            },
            sign_language_overlay: {
              label: 'Sign Language Overlay',
              description: 'Add sign language interpretation (when available)',
              default: false
            }
          }
        });
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Voice API GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST Handlers
// =====================================================
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;
  
  try {
    const user = await getUser(request);
    const supabase = getSupabaseClient();
    
    switch (action) {
      // Save voice preferences (AC 4)
      case 'save-preferences': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { voice_id, speed, style, pitch_adjustment, accessibility, apply_globally } = body;
        
        // Verify voice access for premium voices (AC 7)
        if (voice_id) {
          const { data: voice } = await supabase
            .from('voice_options')
            .select('is_premium, required_tier')
            .eq('id', voice_id)
            .single();
          
          if (voice?.is_premium) {
            const tier = await getUserTier(user.id);
            if (tier === 'free' || (voice.required_tier === 'annual' && tier !== 'annual')) {
              return NextResponse.json({
                error: 'Premium voice requires subscription upgrade',
                required_tier: voice.required_tier
              }, { status: 403 });
            }
          }
        }
        
        const { data, error } = await supabase.rpc('save_voice_preferences', {
          p_user_id: user.id,
          p_voice_id: voice_id,
          p_speed: speed || 1.0,
          p_style: style || 'mentor',
          p_pitch: pitch_adjustment || 0,
          p_accessibility: accessibility,
          p_apply_globally: apply_globally !== false
        });
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          preferences: data,
          message: 'Voice preferences saved'
        });
      }
      
      // Generate TTS audio (AC 9 - Integration)
      case 'generate': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { text, voice_id, context_type, context_id } = body;
        
        if (!text || text.length === 0) {
          return NextResponse.json({ error: 'Text required' }, { status: 400 });
        }
        
        if (text.length > 5000) {
          return NextResponse.json({ error: 'Text too long (max 5000 chars)' }, { status: 400 });
        }
        
        // Get user's voice settings
        const settings = await supabase.rpc('get_user_voice_settings', {
          p_user_id: user.id
        });
        
        const voiceSettings = settings.data;
        const selectedVoice = voice_id || voiceSettings?.voice?.id;
        
        // Log the generation request
        const { data: logId } = await supabase.rpc('log_tts_generation', {
          p_user_id: user.id,
          p_voice_id: selectedVoice,
          p_text: text,
          p_context_type: context_type || 'other',
          p_context_id: context_id
        });
        
        // Call TTS provider (using A4F or configured provider)
        try {
          const ttsResponse = await fetch(process.env.A4F_TTS_URL || 'https://api.a4f.co/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.A4F_API_KEY}`
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: text,
              voice: voiceSettings?.voice?.voice_id || 'alloy',
              speed: voiceSettings?.speed || 1.0
            })
          });
          
          if (!ttsResponse.ok) {
            throw new Error('TTS generation failed');
          }
          
          // For actual implementation, this would return the audio URL
          const audioBuffer = await ttsResponse.arrayBuffer();
          const audioBase64 = Buffer.from(audioBuffer).toString('base64');
          
          // Update log with success
          await supabase
            .from('tts_generation_log')
            .update({
              status: 'ready',
              audio_url: `data:audio/mp3;base64,${audioBase64.substring(0, 100)}...`, // Truncated for demo
              characters_billed: text.length
            })
            .eq('id', logId);
          
          // Increment voice usage
          if (selectedVoice) {
            await supabase.rpc('increment_voice_usage', { p_voice_id: selectedVoice });
          }
          
          return NextResponse.json({
            success: true,
            audio_base64: audioBase64,
            duration_seconds: Math.ceil(text.length / 15), // Estimate
            log_id: logId
          });
        } catch (ttsError) {
          // Update log with failure
          await supabase
            .from('tts_generation_log')
            .update({
              status: 'failed',
              error_message: ttsError instanceof Error ? ttsError.message : 'Unknown error'
            })
            .eq('id', logId);
          
          throw ttsError;
        }
      }
      
      // Start voice cloning (AC 8)
      case 'clone': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        // Check tier (cloning is premium feature)
        const tier = await getUserTier(user.id);
        if (tier === 'free') {
          return NextResponse.json({
            error: 'Voice cloning requires Pro subscription',
            required_tier: 'pro'
          }, { status: 403 });
        }
        
        const { name, audio_url, duration_seconds, consent } = body;
        
        if (!consent) {
          return NextResponse.json({
            error: 'Consent required for voice cloning'
          }, { status: 400 });
        }
        
        if (duration_seconds < 60) {
          return NextResponse.json({
            error: 'Minimum 60 seconds of audio required for voice cloning'
          }, { status: 400 });
        }
        
        // Check clone limit
        const { data: existingClones } = await supabase
          .from('voice_clones')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true);
        
        if (existingClones && existingClones.length >= 3) {
          return NextResponse.json({
            error: 'Maximum 3 voice clones allowed. Delete an existing clone to create a new one.'
          }, { status: 400 });
        }
        
        // Get default provider for cloning
        const { data: provider } = await supabase
          .from('tts_providers')
          .select('id')
          .eq('slug', 'elevenlabs')
          .single();
        
        // Create clone record
        const { data: clone, error } = await supabase
          .from('voice_clones')
          .insert({
            user_id: user.id,
            name: name || 'My Voice',
            source_audio_url: audio_url,
            source_duration_seconds: duration_seconds,
            status: 'processing',
            provider_id: provider?.id,
            consent_given: true,
            consent_timestamp: new Date().toISOString(),
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // In production, this would trigger async voice cloning job
        // For demo, we'll simulate processing completion
        setTimeout(async () => {
          await supabase
            .from('voice_clones')
            .update({
              status: 'ready',
              processing_progress: 100,
              provider_voice_id: `clone_${clone.id.substring(0, 8)}`
            })
            .eq('id', clone.id);
        }, 5000);
        
        return NextResponse.json({
          success: true,
          clone,
          message: 'Voice cloning started. This typically takes 2-5 minutes.',
          estimated_time_seconds: 300
        });
      }
      
      // Preview style (AC 5)
      case 'preview-style': {
        const { style, text } = body;
        
        // Get style preset
        const { data: preset } = await supabase
          .from('voice_style_presets')
          .select('*')
          .eq('style_type', style)
          .single();
        
        if (!preset) {
          return NextResponse.json({ error: 'Style not found' }, { status: 404 });
        }
        
        // Generate preview with style
        const sampleText = text || 'The Indian Constitution was adopted on November 26, 1949 and came into effect on January 26, 1950, making India a sovereign democratic republic.';
        
        return NextResponse.json({
          success: true,
          style: preset,
          preview_text: sampleText,
          styled_prompt: `${preset.prompt_prefix} ${sampleText}`,
          ssml_config: preset.ssml_config
        });
      }
      
      // Delete voice clone
      case 'delete-clone': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { clone_id } = body;
        
        const { error } = await supabase
          .from('voice_clones')
          .update({ is_active: false })
          .eq('id', clone_id)
          .eq('user_id', user.id);
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          message: 'Voice clone deleted'
        });
      }
      
      // Rate a voice
      case 'rate-voice': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { voice_id, rating } = body;
        
        if (rating < 1 || rating > 5) {
          return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
        }
        
        // Update average rating
        const { data: voice } = await supabase
          .from('voice_options')
          .select('avg_rating, use_count')
          .eq('id', voice_id)
          .single();
        
        const newRating = voice?.avg_rating
          ? ((voice.avg_rating * voice.use_count) + rating) / (voice.use_count + 1)
          : rating;
        
        await supabase
          .from('voice_options')
          .update({ avg_rating: newRating.toFixed(2) })
          .eq('id', voice_id);
        
        return NextResponse.json({ success: true, new_rating: newRating });
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Voice API POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
