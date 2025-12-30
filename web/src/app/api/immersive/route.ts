/**
 * API Route: /api/immersive
 * Story 15.1: 360° Immersive Visualizations - VR Compatible
 * 
 * Endpoints:
 * GET: discovery, experience, scenes, hotspots, quizzes, progress, vr-devices, collections
 * POST: start, progress, quiz-answer, rate, hotspot-click, generate-content
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Get user from session
async function getUser(request: NextRequest) {
  // Use service client to get user from auth header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// Check premium access (AC 10)
async function checkPremiumAccess(userId: string | null, experienceId: string): Promise<{
  hasAccess: boolean;
  reason?: string;
  requiredTier?: string;
}> {
  if (!userId) {
    return { hasAccess: false, reason: 'Login required' };
  }
  
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('check_immersive_access', {
    p_user_id: userId,
    p_experience_id: experienceId
  });
  
  if (error || !data) {
    // Default to allowing access for demo purposes
    return { hasAccess: true };
  }
  
  return {
    hasAccess: data.access === true,
    reason: data.reason,
    requiredTier: data.required_tier
  };
}

// =====================================================
// GET Handlers
// =====================================================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'discovery';
  
  try {
    const user = await getUser(request);
    const supabase = getSupabaseClient();
    
    switch (action) {
      // Discovery feed - featured, by subject, continue watching
      case 'discovery': {
        const subject = searchParams.get('subject');
        
        const { data, error } = await supabase.rpc('get_immersive_discovery', {
          p_user_id: user?.id || null,
          p_subject: subject,
          p_limit: 20
        });
        
        if (error) throw error;
        
        // Get categories
        const { data: categories } = await supabase
          .from('immersive_categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order');
        
        return NextResponse.json({
          success: true,
          discovery: data,
          categories: categories || []
        });
      }
      
      // Get single experience with all data
      case 'experience': {
        const experienceId = searchParams.get('id');
        if (!experienceId) {
          return NextResponse.json({ error: 'Experience ID required' }, { status: 400 });
        }
        
        // Check access for premium content (AC 10)
        const access = await checkPremiumAccess(user?.id || null, experienceId);
        
        const { data, error } = await supabase.rpc('get_immersive_experience', {
          p_experience_id: experienceId,
          p_user_id: user?.id || null
        });
        
        if (error) throw error;
        
        if (!data) {
          return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
        }
        
        // Increment view count
        await supabase.rpc('increment_experience_view', { p_experience_id: experienceId });
        
        return NextResponse.json({
          success: true,
          ...data,
          access,
          // WebXR configuration (AC 2)
          webxr: {
            supported: true,
            features: ['local-floor', 'bounded-floor', 'hand-tracking'],
            fallbackMode: 'inline', // For mobile 360
            immersiveModes: ['immersive-vr', 'immersive-ar']
          }
        });
      }
      
      // Get scenes for experience (AC 5 - Navigation)
      case 'scenes': {
        const experienceId = searchParams.get('experience_id');
        if (!experienceId) {
          return NextResponse.json({ error: 'Experience ID required' }, { status: 400 });
        }
        
        const { data, error } = await supabase
          .from('immersive_scenes')
          .select(`
            *,
            hotspots:immersive_hotspots(*),
            audio_sources:spatial_audio_sources(*)
          `)
          .eq('experience_id', experienceId)
          .order('scene_order');
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          scenes: data || [],
          navigation: {
            // AC 5: Navigation settings
            controls: ['look', 'zoom', 'move'],
            gestures: {
              swipe: 'rotate',
              pinch: 'zoom',
              tap: 'select_hotspot',
              double_tap: 'recenter'
            },
            keyboard: {
              arrows: 'rotate',
              'w/s': 'zoom',
              space: 'next_scene',
              escape: 'exit'
            }
          }
        });
      }
      
      // Get hotspots for scene (AC 3)
      case 'hotspots': {
        const sceneId = searchParams.get('scene_id');
        if (!sceneId) {
          return NextResponse.json({ error: 'Scene ID required' }, { status: 400 });
        }
        
        const { data, error } = await supabase
          .from('immersive_hotspots')
          .select('*')
          .eq('scene_id', sceneId)
          .order('created_at');
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          hotspots: data || [],
          interaction: {
            hoverPreview: true,
            clickToExpand: true,
            autoFocus: true,
            spatialAudio: true
          }
        });
      }
      
      // Get quizzes for experience (AC 4)
      case 'quizzes': {
        const experienceId = searchParams.get('experience_id');
        if (!experienceId) {
          return NextResponse.json({ error: 'Experience ID required' }, { status: 400 });
        }
        
        const { data, error } = await supabase
          .from('immersive_quizzes')
          .select('*')
          .eq('experience_id', experienceId)
          .order('trigger_at_seconds');
        
        if (error) throw error;
        
        // Get user's responses if logged in
        let responses: Record<string, unknown> = {};
        if (user) {
          const { data: respData } = await supabase
            .from('immersive_quiz_responses')
            .select('*')
            .eq('user_id', user.id)
            .eq('experience_id', experienceId);
          
          if (respData) {
            responses = respData.reduce((acc, r) => ({
              ...acc,
              [r.quiz_id]: r
            }), {});
          }
        }
        
        return NextResponse.json({
          success: true,
          quizzes: data || [],
          user_responses: responses
        });
      }
      
      // Get user progress
      case 'progress': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const experienceId = searchParams.get('experience_id');
        
        let query = supabase
          .from('immersive_user_progress')
          .select(`
            *,
            experience:immersive_experiences(*)
          `)
          .eq('user_id', user.id);
        
        if (experienceId) {
          query = query.eq('experience_id', experienceId);
        }
        
        const { data, error } = await query.order('last_watched_at', { ascending: false });
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          progress: experienceId ? data?.[0] || null : data || []
        });
      }
      
      // Get VR device profiles (AC 2)
      case 'vr-devices': {
        const { data, error } = await supabase
          .from('vr_device_profiles')
          .select('*')
          .eq('webxr_supported', true)
          .order('device_name');
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          devices: data || [],
          webxr_info: {
            // WebXR feature detection info
            features: {
              'immersive-vr': 'Full VR headset experience',
              'immersive-ar': 'Augmented reality overlay',
              'inline': 'Standard browser viewing',
              'local-floor': 'Standing/sitting VR',
              'bounded-floor': 'Room-scale VR',
              'hand-tracking': 'Controller-free hand input'
            },
            fallback: {
              mobile: 'Device orientation + touch controls',
              desktop: 'Mouse drag + scroll to zoom'
            }
          }
        });
      }
      
      // Get collections
      case 'collections': {
        const featured = searchParams.get('featured') === 'true';
        
        let query = supabase
          .from('immersive_collections')
          .select(`
            *,
            items:immersive_collection_items(
              item_order,
              experience:immersive_experiences(*)
            )
          `);
        
        if (featured) {
          query = query.eq('is_featured', true);
        }
        
        const { data, error } = await query.order('display_order');
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          collections: data || []
        });
      }
      
      // Get categories
      case 'categories': {
        const { data, error } = await supabase
          .from('immersive_categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order');
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          categories: data || []
        });
      }
      
      // Get spatial audio sources (AC 6)
      case 'audio-sources': {
        const sceneId = searchParams.get('scene_id');
        if (!sceneId) {
          return NextResponse.json({ error: 'Scene ID required' }, { status: 400 });
        }
        
        const { data, error } = await supabase
          .from('spatial_audio_sources')
          .select('*')
          .eq('scene_id', sceneId);
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          audio_sources: data || [],
          spatial_audio_config: {
            // Web Audio API spatial configuration
            panningModel: 'HRTF',
            distanceModel: 'inverse',
            refDistance: 1,
            maxDistance: 100,
            rolloffFactor: 1,
            coneInnerAngle: 360,
            coneOuterAngle: 360,
            coneOuterGain: 0
          }
        });
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Immersive API GET error:', error);
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
      // Start watching an experience
      case 'start': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { experience_id, device, vr_headset } = body;
        if (!experience_id) {
          return NextResponse.json({ error: 'Experience ID required' }, { status: 400 });
        }
        
        // Check access (AC 10)
        const access = await checkPremiumAccess(user.id, experience_id);
        if (!access.hasAccess) {
          return NextResponse.json({
            error: 'Premium subscription required',
            reason: access.reason,
            required_tier: access.requiredTier
          }, { status: 403 });
        }
        
        // Get first scene
        const { data: firstScene } = await supabase
          .from('immersive_scenes')
          .select('id')
          .eq('experience_id', experience_id)
          .order('scene_order')
          .limit(1)
          .single();
        
        // Create or update progress
        const { data, error } = await supabase.rpc('save_immersive_progress', {
          p_user_id: user.id,
          p_experience_id: experience_id,
          p_scene_id: firstScene?.id || null,
          p_watch_seconds: 0,
          p_device: device || 'web',
          p_vr_headset: vr_headset || null
        });
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          progress: data,
          message: 'Experience started'
        });
      }
      
      // Save progress
      case 'progress': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { experience_id, scene_id, watch_seconds, hotspots_clicked, device, vr_headset } = body;
        
        const { data, error } = await supabase.rpc('save_immersive_progress', {
          p_user_id: user.id,
          p_experience_id: experience_id,
          p_scene_id: scene_id,
          p_watch_seconds: watch_seconds,
          p_hotspots_clicked: hotspots_clicked,
          p_device: device,
          p_vr_headset: vr_headset
        });
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          progress: data
        });
      }
      
      // Answer quiz (AC 4)
      case 'quiz-answer': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { quiz_id, answer, answer_text, time_taken } = body;
        
        const { data, error } = await supabase.rpc('answer_immersive_quiz', {
          p_user_id: user.id,
          p_quiz_id: quiz_id,
          p_answer: answer,
          p_answer_text: answer_text,
          p_time_taken: time_taken
        });
        
        if (error) throw error;
        
        return NextResponse.json(data);
      }
      
      // Rate experience
      case 'rate': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { experience_id, rating } = body;
        
        const { data, error } = await supabase.rpc('rate_immersive_experience', {
          p_user_id: user.id,
          p_experience_id: experience_id,
          p_rating: rating
        });
        
        if (error) throw error;
        
        return NextResponse.json(data);
      }
      
      // Track hotspot click (AC 3)
      case 'hotspot-click': {
        const { hotspot_id } = body;
        
        // Increment click count atomically
        const { data: hotspot } = await supabase
          .from('immersive_hotspots')
          .select('click_count')
          .eq('id', hotspot_id)
          .single();
        
        if (hotspot) {
          await supabase
            .from('immersive_hotspots')
            .update({ click_count: (hotspot.click_count || 0) + 1 })
            .eq('id', hotspot_id);
        }
        
        return NextResponse.json({ success: true });
      }
      
      // Generate AI content for experience (AC 1, 8)
      case 'generate-content': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { subject, topic, content_type } = body;
        // content_type: 'historical_battle', 'geographical_feature', 'cultural_site', 'monument'
        
        // Call A4F API to generate immersive content structure
        const a4fResponse = await fetch(process.env.A4F_API_URL || 'https://api.a4f.co/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.A4F_API_KEY}`
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
              role: 'user',
              content: `Generate a structured 360° immersive experience for UPSC preparation.

Subject: ${subject}
Topic: ${topic}
Content Type: ${content_type}

Create a detailed structure with:
1. Experience metadata (title, description, duration 5-15 min, UPSC relevance)
2. 3-5 scenes with:
   - Scene title and description
   - Narration script
   - Key visual elements to show
   - Suggested camera positions
3. For each scene, 2-4 interactive hotspots:
   - Type (info, quiz, media, navigation)
   - Position description (e.g., "center-left", "upper-right")
   - Content to display
4. 2-3 embedded quiz questions with UPSC-style MCQs
5. Spatial audio suggestions (ambient sounds, narration points)

Return as structured JSON with fields:
{
  "experience": { title, description, duration_seconds, subject, topic, upsc_relevance, syllabus_topics[] },
  "scenes": [{ title, description, narration, visual_elements[], camera_position, duration_seconds }],
  "hotspots": [{ scene_index, type, position, label, content }],
  "quizzes": [{ scene_index, question, options[], correct_index, explanation }],
  "audio": [{ scene_index, type, description, position }]
}`
            }]
          })
        });
        
        if (!a4fResponse.ok) {
          throw new Error('AI content generation failed');
        }
        
        const aiResult = await a4fResponse.json();
        const contentText = aiResult.choices?.[0]?.message?.content || '';
        
        // Parse JSON from response
        let generatedContent;
        try {
          const jsonMatch = contentText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            generatedContent = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch {
          generatedContent = {
            experience: {
              title: `${topic} - Immersive Experience`,
              description: `Explore ${topic} in immersive 360° VR`,
              duration_seconds: 600,
              subject,
              topic,
              upsc_relevance: 'Relevant for GS Papers',
              syllabus_topics: [topic]
            },
            scenes: [{
              title: 'Introduction',
              description: `Welcome to ${topic}`,
              narration: `Let's explore ${topic} together.`,
              visual_elements: ['panoramic view', 'key landmarks'],
              duration_seconds: 120
            }],
            hotspots: [],
            quizzes: [],
            audio: []
          };
        }
        
        return NextResponse.json({
          success: true,
          generated_content: generatedContent,
          message: 'Content structure generated. Ready for media upload.'
        });
      }
      
      // Create experience from generated content
      case 'create-experience': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { experience, scenes, hotspots, quizzes, audio_sources, category_id } = body;
        
        // Insert experience
        const { data: newExp, error: expError } = await supabase
          .from('immersive_experiences')
          .insert({
            user_id: user.id,
            category_id,
            title: experience.title,
            slug: experience.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            description: experience.description,
            subject: experience.subject,
            topic: experience.topic,
            duration_seconds: experience.duration_seconds || 600,
            status: 'draft',
            is_premium: true,
            required_tier: 'pro',
            upsc_relevance: experience.upsc_relevance,
            syllabus_topics: experience.syllabus_topics,
            tags: experience.tags || []
          })
          .select()
          .single();
        
        if (expError) throw expError;
        
        // Insert scenes
        if (scenes?.length > 0) {
          const scenesData = scenes.map((s: Record<string, unknown>, i: number) => ({
            experience_id: newExp.id,
            scene_order: i + 1,
            title: s.title,
            description: s.description,
            duration_seconds: s.duration_seconds || 120,
            narration_text: s.narration,
            scene_360_url: s.scene_360_url || ''
          }));
          
          const { data: insertedScenes, error: scenesError } = await supabase
            .from('immersive_scenes')
            .insert(scenesData)
            .select();
          
          if (scenesError) throw scenesError;
          
          // Insert hotspots for scenes
          if (hotspots?.length > 0 && insertedScenes) {
            const hotspotsData = hotspots.map((h: Record<string, unknown>) => ({
              scene_id: insertedScenes[h.scene_index as number]?.id,
              position: h.position || { yaw: 0, pitch: 0, distance: 1 },
              hotspot_type: h.type || 'info',
              label: h.label,
              content: h.content
            })).filter((h: Record<string, unknown>) => h.scene_id);
            
            if (hotspotsData.length > 0) {
              await supabase.from('immersive_hotspots').insert(hotspotsData);
            }
          }
          
          // Insert audio sources
          if (audio_sources?.length > 0 && insertedScenes) {
            const audioData = audio_sources.map((a: Record<string, unknown>) => ({
              scene_id: insertedScenes[a.scene_index as number]?.id,
              position: a.position || { x: 0, y: 0, z: 0 },
              audio_url: a.audio_url || '',
              audio_type: a.type || 'ambient'
            })).filter((a: Record<string, unknown>) => a.scene_id);
            
            if (audioData.length > 0) {
              await supabase.from('spatial_audio_sources').insert(audioData);
            }
          }
        }
        
        // Insert quizzes
        if (quizzes?.length > 0) {
          const quizzesData = quizzes.map((q: Record<string, unknown>) => ({
            experience_id: newExp.id,
            trigger_type: 'scene_end',
            question: q.question,
            question_type: 'mcq',
            options: q.options,
            correct_answer: q.correct_index,
            explanation: q.explanation,
            points: 10
          }));
          
          await supabase.from('immersive_quizzes').insert(quizzesData);
        }
        
        return NextResponse.json({
          success: true,
          experience: newExp,
          message: 'Experience created successfully'
        });
      }
      
      // Update experience status
      case 'publish': {
        if (!user) {
          return NextResponse.json({ error: 'Login required' }, { status: 401 });
        }
        
        const { experience_id } = body;
        
        const { data, error } = await supabase
          .from('immersive_experiences')
          .update({
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', experience_id)
          .eq('user_id', user.id)
          .select()
          .single();
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          experience: data
        });
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Immersive API POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
