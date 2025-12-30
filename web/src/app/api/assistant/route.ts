// Story 9.1: AI Teaching Assistant - Conversation Engine API
// AC 1-10: Chat with context awareness, RAG integration, and rate limiting

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const PRIMARY_MODEL = process.env.A4F_PRIMARY_MODEL || 'provider-3/llama-4-scout';
const VPS_RAG_URL = process.env.VPS_RAG_URL || 'http://89.117.60.144:8101';

// AC 10: Rate limits
const FREE_DAILY_LIMIT = 50;
const PRO_DAILY_LIMIT = 9999; // Effectively unlimited

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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
      case 'send_message':
        return await handleSendMessage(user.id, body, supabase, startTime);
      case 'get_history':
        return await getConversationHistory(user.id, body, supabase);
      case 'new_session':
        return await startNewSession(user.id, supabase);
      case 'get_sessions':
        return await getSessions(user.id, supabase);
      case 'get_usage':
        return await getUsageStats(user.id, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Story 9.1] Assistant API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// AC 1, 4, 5, 6, 7, 8: Handle message with AI response
async function handleSendMessage(
  userId: string,
  body: any,
  supabase: any,
  startTime: number
) {
  const { message, session_id } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // AC 10: Check rate limit
  const isPro = await checkUserIsPro(userId, supabase);
  const usageCheck = await checkRateLimit(userId, isPro, supabase);
  
  if (!usageCheck.allowed) {
    return NextResponse.json({
      error: 'Daily limit reached',
      message: `You've used all ${usageCheck.limit} messages today. ${isPro ? '' : 'Upgrade to Pro for unlimited access.'}`,
      usage: usageCheck,
    }, { status: 429 });
  }

  // Generate or use existing session ID
  const sessionId = session_id || crypto.randomUUID();

  // AC 2, 3: Get conversation context and user learning context
  // Story 9.2: Also get user preferences
  const [conversationContext, learningContext, userPreferences] = await Promise.all([
    getConversationContextFromDB(userId, sessionId, supabase),
    getUserLearningContext(userId, supabase),
    getUserPreferences(userId, supabase),
  ]);

  // AC 6: Try RAG search for factual grounding
  let ragResults: any[] = [];
  let ragSources: string[] = [];
  try {
    const ragData = await searchRAG(message);
    ragResults = ragData.chunks || [];
    ragSources = ragData.sources || [];
  } catch (e) {
    console.warn('[Story 9.1] RAG search failed, continuing without:', e);
  }

  // AC 5: Build AI prompt with user context + Story 9.2 preferences
  const systemPrompt = buildSystemPrompt(learningContext, ragResults, userPreferences);
  const messages = buildConversationMessages(conversationContext, message, systemPrompt);

  // Generate AI response
  let responseText = '';
  let followUpSuggestions: string[] = [];
  let confidence = 0.5;

  if (!A4F_API_KEY) {
    // Fallback if no API key
    responseText = generateFallbackResponse(message, learningContext);
    followUpSuggestions = generateDefaultFollowUps(message);
  } else {
    try {
      const aiResponse = await callAI(messages);
      responseText = aiResponse.content || '';
      
      // AC 8: Extract follow-up suggestions
      followUpSuggestions = extractFollowUps(responseText) || generateDefaultFollowUps(message);
      
      // Clean response (remove follow-up section if extracted)
      responseText = cleanResponse(responseText);
      confidence = ragResults.length > 0 ? 0.85 : 0.7;
    } catch (e) {
      console.error('[Story 9.1] AI call failed:', e);
      responseText = generateFallbackResponse(message, learningContext);
      followUpSuggestions = generateDefaultFollowUps(message);
    }
  }

  // AC 7: Add source citations if RAG was used
  if (ragSources.length > 0) {
    responseText += `\n\n📚 *Sources: ${ragSources.slice(0, 3).join(', ')}*`;
  }

  // Save conversation to database
  const responseTime = Date.now() - startTime;
  await saveConversation(
    userId,
    sessionId,
    message,
    responseText,
    { weak_topics: learningContext.weak_topics, recent: learningContext.recent_topics },
    followUpSuggestions,
    ragResults.map(r => ({ id: r.id, source: r.metadata?.source })),
    confidence,
    responseTime,
    supabase
  );

  // Increment usage count
  await incrementUsage(userId, supabase);

  return NextResponse.json({
    response: responseText,
    session_id: sessionId,
    follow_ups: followUpSuggestions,
    sources: ragSources,
    confidence,
    response_time_ms: responseTime,
    usage: {
      messages_today: usageCheck.count + 1,
      daily_limit: usageCheck.limit,
      remaining: usageCheck.limit - usageCheck.count - 1,
    },
  });
}

// Story 9.2: Teaching style definitions for prompt building
const TEACHING_STYLES: Record<string, string> = {
  concise: 'Give brief, to-the-point explanations with key facts only. Use bullet points.',
  detailed: 'Provide comprehensive explanations covering all aspects with full context.',
  example_heavy: 'Use lots of real-world examples, stories, and analogies to explain concepts.',
  socratic: 'Ask guiding questions to help the student discover answers themselves.',
};

const TONES: Record<string, string> = {
  formal: 'Be professional and academic in your responses.',
  friendly: 'Be warm, approachable, and conversational.',
  motivational: 'Be encouraging, positive, and inspiring. Celebrate progress.',
  strict: 'Be direct and demanding like a serious mentor. Push for excellence.',
};

const DEPTH_LEVELS: Record<number, string> = {
  1: 'Explain like I am a complete beginner (ELI5).',
  2: 'Explain for someone starting UPSC preparation.',
  3: 'Explain for an intermediate UPSC aspirant.',
  4: 'Explain at an advanced level for serious aspirants.',
  5: 'Explain at postgraduate/expert level with academic depth.',
};

const LANGUAGES: Record<string, string> = {
  english: 'Respond in English.',
  hindi: 'Respond in Hindi (Devanagari script).',
  hinglish: 'Respond in Hinglish (mix of Hindi and English).',
};

// AC 5: Build system prompt with user context + Story 9.2: preferences
function buildSystemPrompt(context: any, ragResults: any[], preferences?: any): string {
  const userName = context.user_name || 'Student';
  const weakTopics = context.weak_topics || [];
  const strongTopics = context.strong_topics || [];
  const recentTopics = context.recent_topics || [];
  const stats = context.study_stats || {};

  // Story 9.2: Apply user preferences
  const prefs = preferences || {};
  const stylePrompt = TEACHING_STYLES[prefs.teaching_style] || TEACHING_STYLES.detailed;
  const tonePrompt = TONES[prefs.tone] || TONES.friendly;
  const depthPrompt = DEPTH_LEVELS[prefs.depth_level] || DEPTH_LEVELS[3];
  const langPrompt = LANGUAGES[prefs.language] || LANGUAGES.english;

  let prompt = `You are an expert UPSC mentor and teaching assistant. Your name is "UPSC Guru".

USER CONTEXT:
- Name: ${userName}
- Preparing for: UPSC Civil Services Examination
${weakTopics.length > 0 ? `- Weak areas needing attention: ${JSON.stringify(weakTopics)}` : ''}
${strongTopics.length > 0 ? `- Strong areas: ${JSON.stringify(strongTopics)}` : ''}
${recentTopics.length > 0 ? `- Recently studied: ${JSON.stringify(recentTopics)}` : ''}
${stats.accuracy ? `- Current accuracy: ${stats.accuracy}%` : ''}

TEACHING STYLE PREFERENCES:
- ${stylePrompt}
- ${tonePrompt}
- ${depthPrompt}
- ${langPrompt}
${prefs.use_examples !== false ? '- Include relevant examples and analogies.' : ''}
${prefs.include_mnemonics ? '- Use mnemonics or memory aids when helpful.' : ''}
${prefs.suggest_practice !== false ? '- Suggest practice questions at the end.' : ''}

YOUR ROLE:
1. Answer questions clearly and accurately, citing UPSC-relevant sources when possible
2. Explain complex concepts matching the user's preferred style and depth
3. Relate answers to UPSC exam context (Prelims MCQs, Mains answers, Essay topics)
4. Match the requested tone throughout your response
5. If asked about weak topics, provide extra detail and practice suggestions
6. If unsure, admit limitations and suggest reliable sources

RESPONSE GUIDELINES:
- Match the teaching style and depth level requested
- Use the appropriate tone throughout
- End with 2-3 follow-up questions (format as "**You might also want to ask:**")`;

  // Add RAG context if available
  if (ragResults.length > 0) {
    prompt += `\n\nRELEVANT KNOWLEDGE BASE CONTENT:
${ragResults.slice(0, 3).map((r, i) => `[${i + 1}] ${r.content.substring(0, 500)}...`).join('\n\n')}

Use this information to ground your response in accurate facts.`;
  }

  return prompt;
}

// Build conversation messages for AI
function buildConversationMessages(history: any[], currentMessage: string, systemPrompt: string) {
  const messages: any[] = [{ role: 'system', content: systemPrompt }];

  // Add recent conversation history (last 6 turns)
  for (const turn of history.slice(-6)) {
    messages.push({ role: 'user', content: turn.message_text });
    if (turn.response_text) {
      messages.push({ role: 'assistant', content: turn.response_text });
    }
  }

  // Add current message
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

// Call A4F AI API
async function callAI(messages: any[]) {
  const response = await fetch(`${A4F_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${A4F_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  };
}

// AC 6: Search RAG for relevant content
async function searchRAG(query: string) {
  try {
    const response = await fetch(`${VPS_RAG_URL}/documents/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: 5 }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { chunks: [], sources: [] };
    }

    const results = await response.json();
    const chunks = Array.isArray(results) ? results : [];
    const sources = [...new Set(chunks.map((c: any) => c.metadata?.source).filter(Boolean))];

    return { chunks, sources };
  } catch (e) {
    console.warn('[Story 9.1] RAG unavailable:', e);
    return { chunks: [], sources: [] };
  }
}

// Extract follow-up suggestions from response
function extractFollowUps(response: string): string[] {
  const followUpPattern = /\*\*You might also want to ask:\*\*\n?([\s\S]*?)(?=\n\n|$)/i;
  const match = response.match(followUpPattern);
  
  if (match) {
    return match[1]
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 10 && line.endsWith('?'))
      .slice(0, 3);
  }
  
  return [];
}

// Clean response by removing follow-up section
function cleanResponse(response: string): string {
  return response.replace(/\*\*You might also want to ask:\*\*[\s\S]*$/i, '').trim();
}

// Generate default follow-ups based on message
function generateDefaultFollowUps(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('polity') || lowerMessage.includes('constitution')) {
    return [
      'What are the key amendments to the Constitution?',
      'How does the federal structure work in India?',
      'What are important Polity MCQs for Prelims?',
    ];
  }
  
  if (lowerMessage.includes('history') || lowerMessage.includes('freedom struggle')) {
    return [
      'What were the major phases of the freedom struggle?',
      'Who were the important moderate and extremist leaders?',
      'What are important History topics for UPSC?',
    ];
  }
  
  if (lowerMessage.includes('geography') || lowerMessage.includes('climate')) {
    return [
      'What are the major climate types in India?',
      'How should I prepare Geography for UPSC?',
      'What are important map-based questions?',
    ];
  }
  
  return [
    'How should I approach this topic for Mains?',
    'What are the most important MCQs from this area?',
    'Can you suggest a study plan for this topic?',
  ];
}

// Fallback response when AI is unavailable
function generateFallbackResponse(message: string, context: any): string {
  const userName = context.user_name || 'there';
  
  return `Hello ${userName}! I understand you're asking about: "${message.substring(0, 100)}..."

While I'm currently unable to provide a detailed AI-powered response, here's what I suggest:

1. **Check your study materials** - Review the relevant NCERT chapters and standard reference books
2. **Practice questions** - Attempt PYQs related to this topic
3. **Make notes** - Create concise notes highlighting key points

${context.weak_topics?.length > 0 ? `\n💡 Remember, you've been working on improving: ${context.weak_topics.slice(0, 2).map((t: any) => t.topic).join(', ')}` : ''}

I'll be fully operational again soon. Keep up your preparation!

**You might also want to ask:**
- How should I structure my answer for this in Mains?
- What are the most important points to remember?
- Can you suggest practice questions on this topic?`;
}

// Database helper functions
async function getConversationContextFromDB(userId: string, sessionId: string, supabase: any) {
  const { data } = await supabase
    .from('assistant_conversations')
    .select('message_text, response_text, created_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(10);
  
  return data || [];
}

async function getUserLearningContext(userId: string, supabase: any) {
  try {
    const { data } = await supabase.rpc('get_user_learning_context', { p_user_id: userId });
    return data?.[0] || { user_name: 'Student', weak_topics: [], strong_topics: [], recent_topics: [], study_stats: {} };
  } catch (e) {
    // Fallback if RPC doesn't exist yet
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    
    return {
      user_name: profile?.full_name || 'Student',
      weak_topics: [],
      strong_topics: [],
      recent_topics: [],
      study_stats: {},
    };
  }
}

async function checkUserIsPro(userId: string, supabase: any): Promise<boolean> {
  const { data } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  
  return data?.tier === 'pro' || data?.tier === 'premium';
}

// Story 9.2: Get user teaching preferences
async function getUserPreferences(userId: string, supabase: any) {
  try {
    const { data } = await supabase.rpc('get_assistant_preferences', { p_user_id: userId });
    return data?.[0] || {
      teaching_style: 'detailed',
      tone: 'friendly',
      depth_level: 3,
      language: 'english',
      use_examples: true,
      include_mnemonics: true,
      suggest_practice: true,
    };
  } catch (e) {
    // Fallback if RPC doesn't exist
    const { data } = await supabase
      .from('assistant_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data || {
      teaching_style: 'detailed',
      tone: 'friendly',
      depth_level: 3,
      language: 'english',
      use_examples: true,
      include_mnemonics: true,
      suggest_practice: true,
    };
  }
}

async function checkRateLimit(userId: string, isPro: boolean, supabase: any) {
  const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  
  const { data } = await supabase
    .from('assistant_usage')
    .select('message_count')
    .eq('user_id', userId)
    .eq('usage_date', new Date().toISOString().split('T')[0])
    .single();
  
  const count = data?.message_count || 0;
  
  return {
    allowed: count < limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
  };
}

async function incrementUsage(userId: string, supabase: any) {
  const today = new Date().toISOString().split('T')[0];
  
  // Try to update existing record, or insert new one
  const { error } = await supabase
    .from('assistant_usage')
    .upsert({
      user_id: userId,
      usage_date: today,
      message_count: 1,
    }, {
      onConflict: 'user_id,usage_date',
    });
  
  if (error) {
    // If upsert failed, try incrementing
    await supabase.rpc('increment_assistant_usage', { p_user_id: userId });
  }
}

async function saveConversation(
  userId: string,
  sessionId: string,
  message: string,
  response: string,
  context: any,
  followUps: string[],
  sources: any[],
  confidence: number,
  responseTime: number,
  supabase: any
) {
  await supabase.from('assistant_conversations').insert({
    user_id: userId,
    session_id: sessionId,
    message_text: message,
    response_text: response,
    context_json: context,
    follow_up_suggestions: followUps,
    sources_used: sources,
    confidence_score: confidence,
    response_time_ms: responseTime,
  });
}

// AC 1: Get conversation history
async function getConversationHistory(userId: string, body: any, supabase: any) {
  const { session_id, limit = 50 } = body;
  
  let query = supabase
    .from('assistant_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit);
  
  if (session_id) {
    query = query.eq('session_id', session_id);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
  
  return NextResponse.json({ messages: data || [] });
}

// Start new conversation session
async function startNewSession(userId: string, supabase: any) {
  const sessionId = crypto.randomUUID();
  
  return NextResponse.json({
    session_id: sessionId,
    message: 'New session started',
  });
}

// Get all user sessions
async function getSessions(userId: string, supabase: any) {
  const { data } = await supabase
    .from('assistant_conversations')
    .select('session_id, created_at, message_text')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  // Group by session and get first message of each
  const sessionsMap = new Map();
  for (const msg of data || []) {
    if (!sessionsMap.has(msg.session_id)) {
      sessionsMap.set(msg.session_id, {
        session_id: msg.session_id,
        first_message: msg.message_text.substring(0, 100),
        created_at: msg.created_at,
      });
    }
  }
  
  return NextResponse.json({
    sessions: Array.from(sessionsMap.values()).slice(0, 20),
  });
}

// Get usage statistics
async function getUsageStats(userId: string, supabase: any) {
  const isPro = await checkUserIsPro(userId, supabase);
  const usage = await checkRateLimit(userId, isPro, supabase);
  
  // Get total conversations
  const { count: totalMessages } = await supabase
    .from('assistant_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  return NextResponse.json({
    today: usage.count,
    daily_limit: usage.limit,
    remaining: usage.remaining,
    is_pro: isPro,
    total_messages: totalMessages || 0,
  });
}

// GET endpoint for quick status check
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

    const isPro = await checkUserIsPro(user.id, supabase);
    const usage = await checkRateLimit(user.id, isPro, supabase);

    return NextResponse.json({
      status: 'ready',
      user_id: user.id,
      usage: {
        messages_today: usage.count,
        daily_limit: usage.limit,
        remaining: usage.remaining,
        is_pro: isPro,
      },
    });
  } catch (error) {
    console.error('[Story 9.1] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
