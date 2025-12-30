// Story 9.2: Assistant Teaching Style Customization API
// AC 1-10: Preferences management, presets, and preview mode

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const PRIMARY_MODEL = process.env.A4F_PRIMARY_MODEL || 'provider-3/llama-4-scout';

// AC 2: Teaching styles
const TEACHING_STYLES = {
  concise: 'Give brief, to-the-point explanations with key facts only. Use bullet points.',
  detailed: 'Provide comprehensive explanations covering all aspects with full context.',
  example_heavy: 'Use lots of real-world examples, stories, and analogies to explain concepts.',
  socratic: 'Ask guiding questions to help the student discover answers themselves. Be inquiry-based.',
};

// AC 3: Tones
const TONES = {
  formal: 'Be professional and academic in your responses.',
  friendly: 'Be warm, approachable, and conversational.',
  motivational: 'Be encouraging, positive, and inspiring. Celebrate progress.',
  strict: 'Be direct and demanding like a serious mentor. Push for excellence.',
};

// AC 4: Depth levels
const DEPTH_LEVELS: Record<number, string> = {
  1: 'Explain like I am a complete beginner with no prior knowledge (ELI5).',
  2: 'Explain for someone starting their UPSC preparation with basic understanding.',
  3: 'Explain for an intermediate UPSC aspirant with foundational knowledge.',
  4: 'Explain at an advanced level for serious aspirants with solid preparation.',
  5: 'Explain at postgraduate/expert level with academic depth and nuance.',
};

// AC 5: Languages
const LANGUAGES: Record<string, string> = {
  english: 'Respond in English.',
  hindi: 'Respond in Hindi (Devanagari script).',
  hinglish: 'Respond in Hinglish (mix of Hindi and English, as commonly spoken).',
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'get_preferences':
        return await getPreferences(user.id, supabase);
      case 'save_preferences':
        return await savePreferences(user.id, body, supabase);
      case 'apply_preset':
        return await applyPreset(user.id, body.preset_id, supabase);
      case 'reset_preferences':
        return await resetPreferences(user.id, supabase);
      case 'get_presets':
        return await getPresets(supabase);
      case 'preview':
        return await previewStyle(body, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Story 9.2] Preferences API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// AC 1, 6: Get user preferences
async function getPreferences(userId: string, supabase: any) {
  try {
    const { data } = await supabase.rpc('get_assistant_preferences', { p_user_id: userId });
    const prefs = data?.[0] || {
      teaching_style: 'detailed',
      tone: 'friendly',
      depth_level: 3,
      language: 'english',
      active_preset: null,
      use_examples: true,
      include_mnemonics: true,
      suggest_practice: true,
    };

    return NextResponse.json({
      preferences: prefs,
      options: {
        teaching_styles: [
          { id: 'concise', name: 'Concise', description: 'Brief, to-the-point explanations' },
          { id: 'detailed', name: 'Detailed', description: 'Comprehensive with full context' },
          { id: 'example_heavy', name: 'Example-Heavy', description: 'Lots of real-world examples' },
          { id: 'socratic', name: 'Socratic', description: 'Question-driven, discovery-based' },
        ],
        tones: [
          { id: 'formal', name: 'Formal', description: 'Professional and academic' },
          { id: 'friendly', name: 'Friendly', description: 'Warm and conversational' },
          { id: 'motivational', name: 'Motivational', description: 'Encouraging and inspiring' },
          { id: 'strict', name: 'Strict', description: 'Direct and demanding' },
        ],
        languages: [
          { id: 'english', name: 'English' },
          { id: 'hindi', name: 'Hindi' },
          { id: 'hinglish', name: 'Hinglish' },
        ],
      },
    });
  } catch (e) {
    // Fallback if RPC doesn't exist
    const { data } = await supabase
      .from('assistant_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return NextResponse.json({
      preferences: data || {
        teaching_style: 'detailed',
        tone: 'friendly',
        depth_level: 3,
        language: 'english',
      },
    });
  }
}

// AC 1, 6: Save preferences
async function savePreferences(userId: string, body: any, supabase: any) {
  const { teaching_style, tone, depth_level, language, use_examples, include_mnemonics, suggest_practice } = body;

  // Validate inputs
  if (teaching_style && !['concise', 'detailed', 'example_heavy', 'socratic'].includes(teaching_style)) {
    return NextResponse.json({ error: 'Invalid teaching style' }, { status: 400 });
  }
  if (tone && !['formal', 'friendly', 'motivational', 'strict'].includes(tone)) {
    return NextResponse.json({ error: 'Invalid tone' }, { status: 400 });
  }
  if (depth_level && (depth_level < 1 || depth_level > 5)) {
    return NextResponse.json({ error: 'Depth level must be 1-5' }, { status: 400 });
  }
  if (language && !['english', 'hindi', 'hinglish'].includes(language)) {
    return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
  }

  try {
    await supabase.rpc('save_assistant_preferences', {
      p_user_id: userId,
      p_teaching_style: teaching_style,
      p_tone: tone,
      p_depth_level: depth_level,
      p_language: language,
      p_active_preset: null, // Clear preset when customizing
      p_use_examples: use_examples,
      p_include_mnemonics: include_mnemonics,
      p_suggest_practice: suggest_practice,
    });

    return NextResponse.json({ success: true, message: 'Preferences saved' });
  } catch (e) {
    // Fallback with direct insert/update
    await supabase.from('assistant_preferences').upsert({
      user_id: userId,
      teaching_style: teaching_style || 'detailed',
      tone: tone || 'friendly',
      depth_level: depth_level || 3,
      language: language || 'english',
      active_preset: null,
      use_examples: use_examples ?? true,
      include_mnemonics: include_mnemonics ?? true,
      suggest_practice: suggest_practice ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, message: 'Preferences saved' });
  }
}

// AC 9: Apply preset
async function applyPreset(userId: string, presetId: string, supabase: any) {
  if (!presetId) {
    return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
  }

  try {
    const { data } = await supabase.rpc('apply_assistant_preset', {
      p_user_id: userId,
      p_preset_id: presetId,
    });

    if (data === false) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Preset "${presetId}" applied` });
  } catch (e) {
    // Fallback: get preset and apply manually
    const { data: preset } = await supabase
      .from('assistant_presets')
      .select('*')
      .eq('id', presetId)
      .single();

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    await supabase.from('assistant_preferences').upsert({
      user_id: userId,
      teaching_style: preset.teaching_style,
      tone: preset.tone,
      depth_level: preset.depth_level,
      language: preset.language || 'english',
      active_preset: presetId,
      use_examples: preset.use_examples,
      include_mnemonics: preset.include_mnemonics,
      suggest_practice: preset.suggest_practice,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, message: `Preset "${preset.name}" applied` });
  }
}

// AC 10: Reset to defaults
async function resetPreferences(userId: string, supabase: any) {
  try {
    await supabase.rpc('reset_assistant_preferences', { p_user_id: userId });
    return NextResponse.json({ success: true, message: 'Preferences reset to defaults' });
  } catch (e) {
    await supabase.from('assistant_preferences').upsert({
      user_id: userId,
      teaching_style: 'detailed',
      tone: 'friendly',
      depth_level: 3,
      language: 'english',
      active_preset: null,
      use_examples: true,
      include_mnemonics: true,
      suggest_practice: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, message: 'Preferences reset to defaults' });
  }
}

// AC 9: Get all presets
async function getPresets(supabase: any) {
  try {
    const { data } = await supabase.rpc('get_all_presets');
    return NextResponse.json({ presets: data || [] });
  } catch (e) {
    const { data } = await supabase
      .from('assistant_presets')
      .select('*')
      .order('name');

    return NextResponse.json({
      presets: data || [
        { id: 'beginner_friendly', name: 'Beginner Friendly', description: 'Simple explanations with lots of examples', icon: '🌱' },
        { id: 'advanced_scholar', name: 'Advanced Scholar', description: 'In-depth academic explanations', icon: '🎓' },
        { id: 'quick_revision', name: 'Quick Revision', description: 'Concise bullet points for fast review', icon: '⚡' },
        { id: 'motivational_coach', name: 'Motivational Coach', description: 'Encouraging and goal-oriented', icon: '💪' },
      ],
    });
  }
}

// AC 8: Preview mode - test style with sample question
async function previewStyle(body: any, supabase: any) {
  const { teaching_style, tone, depth_level, language, sample_question } = body;
  const question = sample_question || 'What is the significance of the Preamble to the Indian Constitution?';

  // Build preview prompt
  const stylePrompt = TEACHING_STYLES[teaching_style as keyof typeof TEACHING_STYLES] || TEACHING_STYLES.detailed;
  const tonePrompt = TONES[tone as keyof typeof TONES] || TONES.friendly;
  const depthPrompt = DEPTH_LEVELS[depth_level as number] || DEPTH_LEVELS[3];
  const langPrompt = LANGUAGES[language as string] || LANGUAGES.english;

  const systemPrompt = `You are a UPSC teaching assistant. 

STYLE INSTRUCTIONS:
- ${stylePrompt}
- ${tonePrompt}
- ${depthPrompt}
- ${langPrompt}

Keep your response brief (150-200 words) for this preview. This is a preview of your teaching style.`;

  if (!A4F_API_KEY) {
    // Return mock preview if no API key
    return NextResponse.json({
      preview: generateMockPreview(teaching_style, tone, depth_level, question),
      style_applied: { teaching_style, tone, depth_level, language },
    });
  }

  try {
    const response = await fetch(`${A4F_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${A4F_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API failed');
    }

    const data = await response.json();
    const preview = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      preview,
      style_applied: { teaching_style, tone, depth_level, language },
      sample_question: question,
    });
  } catch (e) {
    return NextResponse.json({
      preview: generateMockPreview(teaching_style, tone, depth_level, question),
      style_applied: { teaching_style, tone, depth_level, language },
      source: 'mock',
    });
  }
}

function generateMockPreview(style: string, tone: string, depth: number, question: string): string {
  const styleIntros: Record<string, string> = {
    concise: '**Key Points:**\n• The Preamble declares India as a Sovereign, Socialist, Secular, Democratic Republic\n• Contains ideals of Justice, Liberty, Equality, and Fraternity\n• Amended once in 1976 (42nd Amendment)',
    detailed: 'The Preamble to the Indian Constitution serves as an introduction and guiding light for the entire document. Adopted on November 26, 1949, it encapsulates the fundamental values and philosophy that our nation aspires to achieve...',
    example_heavy: "Think of the Preamble like a company's mission statement - it tells everyone what India stands for! Just like how Google's 'Don't be evil' guides their decisions, our Preamble guides our laws...",
    socratic: "Before we discuss the Preamble's significance, let me ask you: What do you think defines a nation's identity? What values would you want in your ideal country's founding document?",
  };

  const toneAdditions: Record<string, string> = {
    formal: '\n\nThis constitutional provision has been the subject of extensive judicial interpretation.',
    friendly: '\n\nPretty fascinating, right? The founders really thought this through!',
    motivational: '\n\nRemember, understanding this deeply will give you an edge in both Prelims and Mains! You\'ve got this!',
    strict: '\n\nMake sure you memorize these key terms. There\'s no shortcut to success.',
  };

  return (styleIntros[style] || styleIntros.detailed) + (toneAdditions[tone] || '');
}

// GET: Quick preferences check
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data } = await supabase
      .from('assistant_preferences')
      .select('teaching_style, tone, depth_level, language, active_preset')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      preferences: data || {
        teaching_style: 'detailed',
        tone: 'friendly',
        depth_level: 3,
        language: 'english',
        active_preset: null,
      },
    });
  } catch (error) {
    console.error('[Story 9.2] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export helper for assistant API to build prompts
export function buildPreferencePrompt(prefs: any): string {
  const style = TEACHING_STYLES[prefs.teaching_style as keyof typeof TEACHING_STYLES] || TEACHING_STYLES.detailed;
  const tone = TONES[prefs.tone as keyof typeof TONES] || TONES.friendly;
  const depth = DEPTH_LEVELS[prefs.depth_level as number] || DEPTH_LEVELS[3];
  const lang = LANGUAGES[prefs.language as string] || LANGUAGES.english;

  let prompt = `TEACHING STYLE PREFERENCES:
- ${style}
- ${tone}
- ${depth}
- ${lang}`;

  if (prefs.use_examples) {
    prompt += '\n- Include relevant examples and analogies.';
  }
  if (prefs.include_mnemonics) {
    prompt += '\n- Use mnemonics or memory aids when helpful.';
  }
  if (prefs.suggest_practice) {
    prompt += '\n- Suggest practice questions or exercises at the end.';
  }

  return prompt;
}
