'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Story 9.4: Mindmap Auto-generation UI
// AC 1-10: Complete mindmap builder with generation and visualization

interface MindmapNode {
  id: string;
  label: string;
  level: number;
  parent_id: string | null;
  children: string[];
  metadata?: {
    description?: string;
    importance?: 'high' | 'medium' | 'low';
  };
}

interface Mindmap {
  id: string;
  title: string;
  source_type: string;
  structure_json: { nodes: MindmapNode[]; edges: any[] };
  relationships: any[];
  quality_score: number;
  node_count: number;
  is_valid: boolean;
  created_at: string;
}

export default function MindmapPage() {
  const [mindmaps, setMindmaps] = useState<Mindmap[]>([]);
  const [selectedMindmap, setSelectedMindmap] = useState<Mindmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // AC 1: Input states for different sources
  const [sourceType, setSourceType] = useState<'text' | 'url'>('text');
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [title, setTitle] = useState('');
  
  // Generation result
  const [generationResult, setGenerationResult] = useState<any>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadMindmaps();
  }, []);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  };

  const loadMindmaps = async () => {
    setLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/mindmap', {
        headers: { Authorization: authHeader },
      });
      if (res.ok) {
        const data = await res.json();
        setMindmaps(data.mindmaps || []);
      }
    } catch (e) {
      console.error('Failed to load mindmaps:', e);
    } finally {
      setLoading(false);
    }
  };

  // AC 2, 3, 4: Generate mindmap
  const generateMindmap = async () => {
    if (sourceType === 'text' && inputText.length < 50) {
      setError('Please enter at least 50 characters of text');
      return;
    }
    if (sourceType === 'url' && !inputUrl) {
      setError('Please enter a URL');
      return;
    }

    setGenerating(true);
    setError(null);
    setGenerationResult(null);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'generate',
          source_type: sourceType,
          text: sourceType === 'text' ? inputText : undefined,
          url: sourceType === 'url' ? inputUrl : undefined,
          title: title || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate mindmap');
        return;
      }

      setGenerationResult(data);
      loadMindmaps(); // Refresh list
      
      // Clear inputs
      setInputText('');
      setInputUrl('');
      setTitle('');
    } catch (e) {
      setError('Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Load full mindmap
  const loadMindmap = async (id: string) => {
    setLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'get', mindmap_id: id }),
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedMindmap(data.mindmap);
        setGenerationResult(null);
      }
    } catch (e) {
      console.error('Failed to load mindmap:', e);
    } finally {
      setLoading(false);
    }
  };

  // Delete mindmap
  const deleteMindmap = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mindmap?')) return;

    try {
      const authHeader = await getAuthHeader();
      await fetch('/api/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'delete', mindmap_id: id }),
      });
      loadMindmaps();
      if (selectedMindmap?.id === id) {
        setSelectedMindmap(null);
      }
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  // Render mindmap tree
  const renderMindmapTree = useCallback((nodes: MindmapNode[], parentId: string | null = null, depth = 0) => {
    const children = nodes.filter(n => n.parent_id === parentId);
    
    if (children.length === 0) return null;

    return (
      <ul className={`${depth === 0 ? '' : 'ml-6 border-l-2 border-gray-200 pl-4'}`}>
        {children.map(node => (
          <li key={node.id} className="py-2">
            <div className={`flex items-center gap-2 ${
              node.metadata?.importance === 'high' ? 'font-bold text-blue-700' :
              node.metadata?.importance === 'medium' ? 'font-medium text-gray-800' :
              'text-gray-600'
            }`}>
              <span className={`w-3 h-3 rounded-full ${
                node.level === 0 ? 'bg-blue-500' :
                node.level === 1 ? 'bg-green-500' :
                node.level === 2 ? 'bg-yellow-500' :
                'bg-gray-400'
              }`} />
              <span>{node.label}</span>
              {node.metadata?.importance === 'high' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Key</span>
              )}
            </div>
            {node.metadata?.description && (
              <p className="text-sm text-gray-500 ml-5 mt-1">{node.metadata.description}</p>
            )}
            {renderMindmapTree(nodes, node.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🧠 Mindmap Builder
          </h1>
          <p className="text-gray-600 mt-2">
            Auto-generate mindmaps from text, URLs, or uploaded content
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Generation Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold mb-4">Generate New Mindmap</h2>

              {/* AC 1: Source Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Input Source</label>
                <div className="flex gap-2">
                  {[
                    { id: 'text', label: '📝 Text', desc: 'Paste text' },
                    { id: 'url', label: '🔗 URL', desc: 'From webpage' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSourceType(opt.id as any)}
                      className={`flex-1 p-3 border-2 rounded-lg text-center transition ${
                        sourceType === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Mindmap"
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              {/* Text Input */}
              {sourceType === 'text' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Content Text
                    <span className="text-gray-400 font-normal ml-2">
                      ({inputText.length} chars, min 50)
                    </span>
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your notes, book chapter, or any text content here..."
                    rows={10}
                    className="w-full p-3 border rounded-lg font-mono text-sm"
                  />
                </div>
              )}

              {/* URL Input */}
              {sourceType === 'url' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">URL</label>
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={generateMindmap}
                disabled={generating}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Generating...
                  </>
                ) : (
                  <>🚀 Generate Mindmap</>
                )}
              </button>

              {/* AC 9: Processing time display */}
              {generationResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="font-medium text-green-800 mb-2">✅ Mindmap Generated!</div>
                  <div className="text-sm text-green-700 space-y-1">
                    <div>📊 Nodes: {generationResult.structure?.nodes?.length || 0}</div>
                    <div>⏱️ Time: {generationResult.generation_time_ms}ms</div>
                    <div>📈 Quality: {Math.round((generationResult.quality_score || 0) * 100)}%</div>
                  </div>
                </div>
              )}
            </div>

            {/* Saved Mindmaps List */}
            <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
              <h2 className="text-lg font-bold mb-4">Your Mindmaps</h2>
              
              {loading && !mindmaps.length ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : mindmaps.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p>No mindmaps yet</p>
                  <p className="text-sm">Generate your first one above!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {mindmaps.map(mm => (
                    <div
                      key={mm.id}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedMindmap?.id === mm.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => loadMindmap(mm.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">{mm.title}</div>
                        <div className="flex items-center gap-1">
                          {/* Story 9.5: Link to interactive viewer */}
                          <a
                            href={`/mindmap/view/${mm.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-500 hover:text-blue-700 p-1 text-sm"
                            title="Interactive View"
                          >
                            🔍
                          </a>
                          {/* Story 9.6: Link to edit */}
                          <a
                            href={`/mindmap/edit/${mm.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-green-500 hover:text-green-700 p-1 text-sm"
                            title="Edit Mindmap"
                          >
                            ✏️
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMindmap(mm.id); }}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>{mm.source_type}</span>
                        <span>{mm.node_count} nodes</span>
                        <span>{Math.round((mm.quality_score || 0) * 100)}% quality</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Mindmap Visualization */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6 min-h-[600px]">
              {selectedMindmap ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold">{selectedMindmap.title}</h2>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>📊 {selectedMindmap.node_count} nodes</span>
                        <span>📈 {Math.round((selectedMindmap.quality_score || 0) * 100)}% quality</span>
                        <span className={selectedMindmap.is_valid ? 'text-green-600' : 'text-red-600'}>
                          {selectedMindmap.is_valid ? '✓ Valid' : '⚠ Invalid'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedMindmap(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* Mindmap Tree Visualization */}
                  <div className="border rounded-lg p-6 bg-gray-50 overflow-auto max-h-[500px]">
                    {selectedMindmap.structure_json?.nodes?.length > 0 ? (
                      renderMindmapTree(selectedMindmap.structure_json.nodes)
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        No nodes to display
                      </div>
                    )}
                  </div>

                  {/* AC 6: Cross-topic Relationships */}
                  {selectedMindmap.relationships && selectedMindmap.relationships.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-bold mb-3">🔗 Cross-topic Relationships</h3>
                      <div className="space-y-2">
                        {selectedMindmap.relationships.map((rel: any, i: number) => (
                          <div key={i} className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                            <span className="font-medium">{rel.from_node}</span>
                            <span className="mx-2 text-purple-500">→</span>
                            <span className="font-medium">{rel.to_node}</span>
                            <span className="text-gray-500 ml-2">({rel.relationship_type})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : generationResult ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold">{generationResult.suggested_title || 'Generated Mindmap'}</h2>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>📊 {generationResult.structure?.nodes?.length || 0} nodes</span>
                        <span>⏱️ {generationResult.generation_time_ms}ms</span>
                        <span>📈 {Math.round((generationResult.quality_score || 0) * 100)}% quality</span>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-6 bg-gray-50 overflow-auto max-h-[500px]">
                    {generationResult.structure?.nodes?.length > 0 ? (
                      renderMindmapTree(generationResult.structure.nodes)
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        No nodes generated
                      </div>
                    )}
                  </div>

                  {/* Key Concepts */}
                  {generationResult.key_concepts?.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-bold mb-3">🎯 Key Concepts Identified</h3>
                      <div className="flex flex-wrap gap-2">
                        {generationResult.key_concepts.map((concept: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                            {concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 py-20">
                  <div className="text-6xl mb-4">🧠</div>
                  <h3 className="text-xl font-medium mb-2">No Mindmap Selected</h3>
                  <p>Generate a new mindmap or select one from your saved list</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
