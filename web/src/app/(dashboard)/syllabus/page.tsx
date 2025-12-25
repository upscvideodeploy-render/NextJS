'use client';

import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';

// Lazy load Three.js components to avoid SSR issues
const SyllabusCanvas = lazy(() => import('./SyllabusCanvas'));

interface SyllabusNode {
  id: string;
  code: string;
  name: string;
  paper: string;
  topic: string;
  parent_id: string | null;
  depth: number;
  children?: SyllabusNode[];
}

const PAPERS = [
  { id: 'GS1', name: 'GS Paper I', color: '#00f3ff' },
  { id: 'GS2', name: 'GS Paper II', color: '#bc13fe' },
  { id: 'GS3', name: 'GS Paper III', color: '#00ff9d' },
  { id: 'GS4', name: 'GS Paper IV', color: '#ff00ff' },
  { id: 'CSAT', name: 'CSAT', color: '#ff9500' },
  { id: 'Essay', name: 'Essay', color: '#ff006b' },
];

export default function SyllabusPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [nodes, setNodes] = useState<SyllabusNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SyllabusNode | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('2d');
  const [selectedPapers, setSelectedPapers] = useState<string[]>(PAPERS.map(p => p.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch syllabus nodes
  useEffect(() => {
    const fetchSyllabus = async () => {
      const { data, error } = await supabase
        .from('syllabus_nodes')
        .select('*')
        .order('code');

      if (!error && data) {
        // Build tree structure
        const nodeMap = new Map<string, SyllabusNode>();
        data.forEach((n: any) => {
          nodeMap.set(n.id, { ...n, children: [] });
        });

        const roots: SyllabusNode[] = [];
        data.forEach((n: any) => {
          const node = nodeMap.get(n.id)!;
          if (n.parent_id && nodeMap.has(n.parent_id)) {
            nodeMap.get(n.parent_id)!.children!.push(node);
          } else {
            roots.push(node);
          }
        });

        setNodes(roots);
      }
      setIsLoading(false);
    };

    fetchSyllabus();
  }, []);

  // Filter nodes by selected papers
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesPaper = selectedPapers.includes(node.paper);
      const matchesSearch = !searchQuery ||
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPaper && matchesSearch;
    });
  }, [nodes, selectedPapers, searchQuery]);

  const togglePaper = (paperId: string) => {
    setSelectedPapers(prev =>
      prev.includes(paperId)
        ? prev.filter(p => p !== paperId)
        : [...prev, paperId]
    );
  };

  const handleNodeClick = (node: SyllabusNode) => {
    setSelectedNode(node);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-80 bg-slate-900/80 border-r border-white/10 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Syllabus Navigator</h1>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics..."
            className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-neon-blue"
          />
        </div>

        {/* Paper Filters */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Papers</h3>
          <div className="space-y-2">
            {PAPERS.map(paper => (
              <label key={paper.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPapers.includes(paper.id)}
                  onChange={() => togglePaper(paper.id)}
                  className="w-4 h-4 rounded border-white/20 bg-slate-800/50 text-neon-blue"
                />
                <span className="text-gray-300" style={{ color: paper.color }}>
                  {paper.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">View Mode</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('2d')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === '2d'
                  ? 'bg-neon-blue text-black'
                  : 'bg-slate-800/50 text-gray-300 hover:bg-slate-800'
              }`}
            >
              2D Tree
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                viewMode === '3d'
                  ? 'bg-neon-blue text-black'
                  : 'bg-slate-800/50 text-gray-300 hover:bg-slate-800'
              }`}
            >
              3D View
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-sm text-gray-400">
            {filteredNodes.length} topics found
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative">
        {viewMode === '3d' ? (
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading 3D View...</p>
              </div>
            </div>
          }>
            <SyllabusCanvas nodes={filteredNodes} onNodeClick={handleNodeClick} />
          </Suspense>
        ) : (
          <div className="p-6 overflow-y-auto h-full">
            <div className="space-y-6">
              {PAPERS.filter(p => selectedPapers.includes(p.id)).map(paper => {
                const paperNodes = filteredNodes.filter(n => n.paper === paper.id && n.depth === 0);
                if (paperNodes.length === 0) return null;

                return (
                  <div key={paper.id} className="neon-glass rounded-xl overflow-hidden">
                    <div
                      className="px-6 py-4 border-b border-white/10"
                      style={{ backgroundColor: `${paper.color}20` }}
                    >
                      <h2 className="text-xl font-bold" style={{ color: paper.color }}>
                        {paper.name}
                      </h2>
                    </div>
                    <div className="p-6">
                      <TreeView nodes={paperNodes} onNodeClick={handleNodeClick} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Node Detail Modal */}
        {selectedNode && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="neon-glass rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-sm text-neon-blue">{selectedNode.code}</span>
                  <h3 className="text-xl font-bold text-white mt-1">{selectedNode.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm text-gray-400 mb-1">Topic</h4>
                  <p className="text-white">{selectedNode.topic || 'N/A'}</p>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 btn-primary">
                    Start Learning
                  </button>
                  <button className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-sm text-gray-400 mb-2">Related Content</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button className="p-3 bg-slate-800/50 rounded-lg text-center hover:bg-slate-800 transition-colors">
                      <p className="text-xs text-gray-400">Notes</p>
                    </button>
                    <button className="p-3 bg-slate-800/50 rounded-lg text-center hover:bg-slate-800 transition-colors">
                      <p className="text-xs text-gray-400">Videos</p>
                    </button>
                    <button className="p-3 bg-slate-800/50 rounded-lg text-center hover:bg-slate-800 transition-colors">
                      <p className="text-xs text-gray-400">PYQs</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// 2D Tree View Component
function TreeView({
  nodes,
  onNodeClick,
  level = 0
}: {
  nodes: SyllabusNode[];
  onNodeClick: (node: SyllabusNode) => void;
  level?: number;
}) {
  if (nodes.length === 0) return null;

  return (
    <div className={`space-y-2 ${level > 0 ? 'ml-6 pl-4 border-l border-white/10' : ''}`}>
      {nodes.map(node => (
        <div key={node.id}>
          <button
            onClick={() => onNodeClick(node)}
            className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-3"
          >
            {node.children && node.children.length > 0 && (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            <span className="text-gray-400 text-sm w-16">{node.code}</span>
            <span className="text-white">{node.name}</span>
          </button>
          {node.children && node.children.length > 0 && (
            <TreeView nodes={node.children} onNodeClick={onNodeClick} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
}
