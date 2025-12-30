// Story 9.4: Mindmap Auto-generation API
// AC 1-10: Generate mindmaps from various input sources using AI

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const A4F_BASE_URL = process.env.A4F_BASE_URL || 'https://api.a4f.co/v1';
const A4F_API_KEY = process.env.A4F_API_KEY || '';
const PRIMARY_MODEL = process.env.A4F_PRIMARY_MODEL || 'provider-3/llama-4-scout';

// AC 5: Node structure interface
interface MindmapNode {
  id: string;
  label: string;
  level: number;
  parent_id: string | null;
  children: string[];
  metadata?: {
    description?: string;
    examples?: string[];
    importance?: 'high' | 'medium' | 'low';
  };
}

interface MindmapStructure {
  nodes: MindmapNode[];
  edges: { source: string; target: string; label?: string }[];
}

// AC 6: Relationship interface
interface CrossTopicLink {
  from_node: string;
  to_node: string;
  relationship_type: string;
  description: string;
}

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
      case 'generate':
        return await generateMindmap(user.id, body, supabase, startTime);
      case 'list':
        return await listMindmaps(user.id, body, supabase);
      case 'get':
        return await getMindmap(user.id, body.mindmap_id, supabase);
      case 'delete':
        return await deleteMindmap(user.id, body.mindmap_id, supabase);
      case 'update':
        return await updateMindmap(user.id, body, supabase);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Story 9.4] Mindmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// AC 1-6, 9-10: Generate mindmap from input
async function generateMindmap(userId: string, body: any, supabase: any, startTime: number) {
  const { source_type, text, url, title } = body;

  // AC 1: Validate input source
  if (!source_type || !['text', 'pdf', 'docx', 'url', 'notes'].includes(source_type)) {
    return NextResponse.json({ error: 'Invalid source_type. Must be: text, pdf, docx, url, or notes' }, { status: 400 });
  }

  let inputText = text;

  // AC 1: Handle URL input
  if (source_type === 'url' && url) {
    try {
      const response = await fetch(url);
      inputText = await response.text();
      // Extract text content from HTML
      inputText = inputText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      inputText = inputText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      inputText = inputText.replace(/<[^>]+>/g, ' ');
      inputText = inputText.replace(/\s+/g, ' ').trim();
    } catch (e) {
      return NextResponse.json({ error: 'Failed to fetch URL content' }, { status: 400 });
    }
  }

  if (!inputText || inputText.length < 50) {
    return NextResponse.json({ error: 'Input text too short. Minimum 50 characters required.' }, { status: 400 });
  }

  // Truncate if too long (max ~8000 words for processing)
  if (inputText.length > 40000) {
    inputText = inputText.substring(0, 40000);
  }

  // AC 3, 4: Generate mindmap using AI
  const mindmapData = await generateWithAI(inputText);
  
  if (!mindmapData) {
    return NextResponse.json({ error: 'Failed to generate mindmap' }, { status: 500 });
  }

  // AC 8: Validate structure
  const validationResult = validateMindmapStructure(mindmapData.structure);
  
  // AC 9: Calculate processing time
  const generationTime = Date.now() - startTime;

  // AC 10: Calculate quality score
  const qualityScore = calculateQualityScore(mindmapData, inputText);

  // Save to database
  try {
    const { data } = await supabase.rpc('save_mindmap', {
      p_user_id: userId,
      p_title: title || mindmapData.suggestedTitle || 'Untitled Mindmap',
      p_source_type: source_type,
      p_structure: mindmapData.structure,
      p_source_text_length: inputText.length,
      p_source_url: source_type === 'url' ? url : null,
      p_generation_time_ms: generationTime,
      p_key_concepts: mindmapData.keyConcepts,
      p_relationships: mindmapData.relationships,
    });

    return NextResponse.json({
      success: true,
      mindmap_id: data,
      structure: mindmapData.structure,
      relationships: mindmapData.relationships,
      key_concepts: mindmapData.keyConcepts,
      validation: validationResult,
      quality_score: qualityScore,
      generation_time_ms: generationTime,
      suggested_title: mindmapData.suggestedTitle,
    });
  } catch (e) {
    // Fallback direct insert
    const { data, error } = await supabase.from('mindmaps').insert({
      user_id: userId,
      title: title || mindmapData.suggestedTitle || 'Untitled Mindmap',
      source_type,
      source_url: source_type === 'url' ? url : null,
      source_text_length: inputText.length,
      structure_json: mindmapData.structure,
      relationships: mindmapData.relationships,
      key_concepts: mindmapData.keyConcepts,
      is_valid: validationResult.isValid,
      validation_errors: validationResult.errors,
      max_depth: validationResult.maxDepth,
      node_count: validationResult.nodeCount,
      generation_time_ms: generationTime,
      quality_score: qualityScore,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      mindmap_id: data?.id,
      structure: mindmapData.structure,
      relationships: mindmapData.relationships,
      quality_score: qualityScore,
      generation_time_ms: generationTime,
    });
  }
}

// AC 3, 4: AI-powered mindmap generation
async function generateWithAI(text: string): Promise<{
  structure: MindmapStructure;
  keyConcepts: string[];
  relationships: CrossTopicLink[];
  suggestedTitle: string;
} | null> {
  
  // AC 4: Specific prompt for mindmap generation
  const systemPrompt = `You are an expert at creating hierarchical mindmaps for UPSC study content. 
Analyze the given text and create a comprehensive mindmap structure.

Your response MUST be valid JSON in this exact format:
{
  "suggestedTitle": "Main Topic Name",
  "keyConcepts": ["concept1", "concept2", ...],
  "structure": {
    "nodes": [
      {"id": "node_1", "label": "Main Topic", "level": 0, "parent_id": null, "children": ["node_2", "node_3"], "metadata": {"importance": "high"}},
      {"id": "node_2", "label": "Subtopic 1", "level": 1, "parent_id": "node_1", "children": ["node_4"], "metadata": {"importance": "medium"}},
      ...
    ],
    "edges": [
      {"source": "node_1", "target": "node_2"},
      ...
    ]
  },
  "relationships": [
    {"from_node": "node_2", "to_node": "node_5", "relationship_type": "related_to", "description": "Both connect to governance"}
  ]
}

Rules:
1. Create 3-5 main subtopics (level 1 nodes)
2. Each subtopic should have 2-4 supporting points (level 2 nodes)
3. Maximum depth is 4 levels
4. Identify cross-topic relationships where concepts link across different branches
5. Mark important nodes with "importance": "high"
6. Include examples in metadata where relevant
7. Keep labels concise (max 50 characters)`;

  const userPrompt = `Analyze this text and create a hierarchical mindmap structure:

${text.substring(0, 15000)}`;

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.error('[Story 9.4] AI API error:', response.status);
      return generateFallbackMindmap(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return generateFallbackMindmap(text);
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return generateFallbackMindmap(text);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      structure: parsed.structure || { nodes: [], edges: [] },
      keyConcepts: parsed.keyConcepts || [],
      relationships: parsed.relationships || [],
      suggestedTitle: parsed.suggestedTitle || 'Generated Mindmap',
    };
  } catch (e) {
    console.error('[Story 9.4] AI generation failed:', e);
    return generateFallbackMindmap(text);
  }
}

// Fallback mindmap generation without AI
function generateFallbackMindmap(text: string): {
  structure: MindmapStructure;
  keyConcepts: string[];
  relationships: CrossTopicLink[];
  suggestedTitle: string;
} {
  // Extract key terms from text
  const words = text.toLowerCase().split(/\W+/);
  const wordFreq: Record<string, number> = {};
  
  words.forEach(word => {
    if (word.length > 4) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  const mainTopic = topWords[0] || 'Topic';
  
  const nodes: MindmapNode[] = [
    {
      id: 'node_1',
      label: mainTopic.charAt(0).toUpperCase() + mainTopic.slice(1),
      level: 0,
      parent_id: null,
      children: ['node_2', 'node_3', 'node_4'],
      metadata: { importance: 'high' },
    },
  ];

  const edges: { source: string; target: string }[] = [];
  
  // Create subtopics from top words
  topWords.slice(1, 4).forEach((word, i) => {
    const nodeId = `node_${i + 2}`;
    nodes.push({
      id: nodeId,
      label: word.charAt(0).toUpperCase() + word.slice(1),
      level: 1,
      parent_id: 'node_1',
      children: [],
      metadata: { importance: 'medium' },
    });
    edges.push({ source: 'node_1', target: nodeId });
  });

  return {
    structure: { nodes, edges },
    keyConcepts: topWords,
    relationships: [],
    suggestedTitle: `Mindmap: ${mainTopic.charAt(0).toUpperCase() + mainTopic.slice(1)}`,
  };
}

// AC 8: Validate mindmap structure
function validateMindmapStructure(structure: MindmapStructure): {
  isValid: boolean;
  maxDepth: number;
  nodeCount: number;
  errors: string[];
} {
  const errors: string[] = [];
  const nodes = structure.nodes || [];
  const nodeIds = new Set(nodes.map(n => n.id));
  let maxDepth = 0;
  let orphanCount = 0;

  nodes.forEach(node => {
    if (node.level > maxDepth) maxDepth = node.level;
    
    // Check for orphan nodes
    if (node.parent_id && !nodeIds.has(node.parent_id)) {
      orphanCount++;
    }
  });

  // AC 8: Validate depth < 5
  if (maxDepth >= 5) {
    errors.push(`Mindmap exceeds recommended depth (${maxDepth} levels, max 4)`);
  }

  // Check for orphans
  if (orphanCount > 0) {
    errors.push(`Found ${orphanCount} orphan node(s) with invalid parent references`);
  }

  // Check for empty mindmap
  if (nodes.length === 0) {
    errors.push('Mindmap has no nodes');
  }

  return {
    isValid: errors.length === 0,
    maxDepth,
    nodeCount: nodes.length,
    errors,
  };
}

// AC 10: Calculate quality score
function calculateQualityScore(mindmapData: any, inputText: string): number {
  const nodes = mindmapData.structure?.nodes || [];
  const keyConcepts = mindmapData.keyConcepts || [];
  
  // Scoring factors
  let score = 0.5; // Base score

  // Node count contribution (more nodes = better coverage, up to a point)
  if (nodes.length >= 3) score += 0.1;
  if (nodes.length >= 7) score += 0.1;
  if (nodes.length >= 12) score += 0.1;

  // Key concepts coverage
  const textLower = inputText.toLowerCase();
  const coveredConcepts = keyConcepts.filter((c: string) => 
    textLower.includes(c.toLowerCase())
  ).length;
  const coverage = keyConcepts.length > 0 ? coveredConcepts / keyConcepts.length : 0;
  score += coverage * 0.2;

  // Relationships bonus
  if (mindmapData.relationships?.length > 0) {
    score += 0.1;
  }

  return Math.min(1.0, Math.round(score * 100) / 100);
}

// List user's mindmaps
async function listMindmaps(userId: string, body: any, supabase: any) {
  const limit = body.limit || 20;

  try {
    const { data } = await supabase.rpc('get_user_mindmaps', { 
      p_user_id: userId, 
      p_limit: limit 
    });
    return NextResponse.json({ mindmaps: data || [] });
  } catch (e) {
    const { data } = await supabase
      .from('mindmaps')
      .select('id, title, source_type, node_count, quality_score, is_valid, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return NextResponse.json({ mindmaps: data || [] });
  }
}

// Get single mindmap
async function getMindmap(userId: string, mindmapId: string, supabase: any) {
  if (!mindmapId) {
    return NextResponse.json({ error: 'Missing mindmap_id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('mindmaps')
    .select('*')
    .eq('id', mindmapId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Mindmap not found' }, { status: 404 });
  }

  // Check access
  if (data.user_id !== userId && !data.is_public) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  return NextResponse.json({ mindmap: data });
}

// Delete mindmap
async function deleteMindmap(userId: string, mindmapId: string, supabase: any) {
  if (!mindmapId) {
    return NextResponse.json({ error: 'Missing mindmap_id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('mindmaps')
    .delete()
    .eq('id', mindmapId)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete mindmap' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// Update mindmap
async function updateMindmap(userId: string, body: any, supabase: any) {
  const { mindmap_id, title, structure, is_public } = body;

  if (!mindmap_id) {
    return NextResponse.json({ error: 'Missing mindmap_id' }, { status: 400 });
  }

  const updates: any = { updated_at: new Date().toISOString() };
  if (title) updates.title = title;
  if (is_public !== undefined) updates.is_public = is_public;
  if (structure) {
    updates.structure_json = structure;
    const validation = validateMindmapStructure(structure);
    updates.is_valid = validation.isValid;
    updates.max_depth = validation.maxDepth;
    updates.node_count = validation.nodeCount;
  }

  const { error } = await supabase
    .from('mindmaps')
    .update(updates)
    .eq('id', mindmap_id)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update mindmap' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET: List mindmaps
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

    return await listMindmaps(user.id, {}, supabase);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
