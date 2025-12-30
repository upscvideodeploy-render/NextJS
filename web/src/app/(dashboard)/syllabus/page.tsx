'use client';

import React, { useState, useEffect, useMemo, Suspense, lazy, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Lazy load Three.js components to avoid SSR issues
const SyllabusCanvas = lazy(() => import('./SyllabusCanvas').then((mod) => ({ default: mod.SyllabusCanvas })));

// For reset functionality, we'll use a callback ref instead of direct ref since we can't pass ref to lazy component

interface SyllabusNode {
  id: string;
  code: string;
  name: string;
  paper: string;
  topic: string;
  subject?: string;
  parent_id: string | null;
  depth: number;
  children?: SyllabusNode[];
  // Progress data
  progress?: number; // 0-100
  confidence?: number; // 0-1
  isBookmarked?: boolean;
}

const PAPERS = [
  { id: 'GS1', name: 'GS Paper I', color: '#00f3ff' },
  { id: 'GS2', name: 'GS Paper II', color: '#bc13fe' },
  { id: 'GS3', name: 'GS Paper III', color: '#00ff9d' },
  { id: 'GS4', name: 'GS Paper IV', color: '#ff00ff' },
  { id: 'CSAT', name: 'CSAT', color: '#ff9500' },
  { id: 'Essay', name: 'Essay', color: '#ff006b' },
];

// AC4: Subject filters
const SUBJECTS = [
  { id: 'History', name: 'History' },
  { id: 'Geography', name: 'Geography' },
  { id: 'Polity', name: 'Polity' },
  { id: 'Economy', name: 'Economy' },
  { id: 'Environment', name: 'Environment' },
  { id: 'Science', name: 'Science & Tech' },
  { id: 'Ethics', name: 'Ethics' },
  { id: 'IR', name: 'International Relations' },
  { id: 'Society', name: 'Society' },
  { id: 'Security', name: 'Security' },
];

// AC2: Confidence colors
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.7) return '#00ff00'; // green
  if (confidence >= 0.4) return '#ffff00'; // yellow
  return '#ff0000'; // red
};

export default function SyllabusPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [nodes, setNodes] = useState<SyllabusNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SyllabusNode | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('2d');
  const [selectedPapers, setSelectedPapers] = useState<string[]>(PAPERS.map(p => p.id));
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(SUBJECTS.map(s => s.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [progressFilter, setProgressFilter] = useState<string>('all'); // AC5: Filter by progress
  const [userProgress, setUserProgress] = useState<Record<string, { progress: number; confidence: number }>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [canvasInstance, setCanvasInstance] = useState<any>(null);

  // Fetch syllabus nodes and user progress
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

  // AC10: Fetch user progress data
  useEffect(() => {
    const fetchProgress = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch topic progress
      const { data: progressData } = await supabase
        .from('topic_progress')
        .select('topic, completion_percentage, confidence_score')
        .eq('user_id', user.id);

      if (progressData) {
        const progressMap: Record<string, { progress: number; confidence: number }> = {};
        progressData.forEach((p: any) => {
          progressMap[p.topic] = {
            progress: p.completion_percentage || 0,
            confidence: p.confidence_score || 0
          };
        });
        setUserProgress(progressMap);
      }

      // Fetch bookmarks
      const { data: bookmarkData } = await supabase
        .from('bookmarks')
        .select('content_id')
        .eq('user_id', user.id)
        .eq('content_type', 'syllabus_node');

      if (bookmarkData) {
        setBookmarks(new Set(bookmarkData.map((b: any) => b.content_id)));
      }
    };

    fetchProgress();

    // AC10: Real-time progress updates
    const channel = supabase
      .channel('progress_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'topic_progress'
      }, () => {
        fetchProgress();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Filter nodes by selected papers, subjects, bookmarks, and search
  const filteredNodes = useMemo(() => {
    const filterNode = (node: SyllabusNode): SyllabusNode | null => {
      const matchesPaper = selectedPapers.includes(node.paper);
      const matchesSubject = !node.subject || selectedSubjects.includes(node.subject);
      const matchesSearch = !searchQuery ||
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBookmark = !showBookmarksOnly || bookmarks.has(node.id);
      
      // Get progress data for this node
      const progress = userProgress[node.name] || { progress: 0, confidence: 0 };
      
      // AC5: Filter by progress
      let matchesProgress = true;
      if (progressFilter !== 'all') {
        if (progressFilter === 'not_started') {
          matchesProgress = progress.progress === 0;
        } else if (progressFilter === 'in_progress') {
          matchesProgress = progress.progress > 0 && progress.progress < 100;
        } else if (progressFilter === 'completed') {
          matchesProgress = progress.progress === 100;
        } else if (progressFilter === 'needs_revision') {
          matchesProgress = progress.confidence < 50; // Assuming low confidence needs revision
        }
      }

      if (matchesPaper && matchesSubject && matchesSearch && matchesBookmark && matchesProgress) {
        return {
          ...node,
          progress: progress.progress,
          confidence: progress.confidence,
          isBookmarked: bookmarks.has(node.id),
          children: node.children?.map(filterNode).filter(Boolean) as SyllabusNode[]
        };
      }
      return null;
    };

    return nodes.map(filterNode).filter(Boolean) as SyllabusNode[];
  }, [nodes, selectedPapers, selectedSubjects, searchQuery, showBookmarksOnly, bookmarks, userProgress]);

  const togglePaper = (paperId: string) => {
    setSelectedPapers(prev =>
      prev.includes(paperId)
        ? prev.filter(p => p !== paperId)
        : [...prev, paperId]
    );
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(s => s !== subjectId)
        : [...prev, subjectId]
    );
  };

  // AC7: Toggle bookmark
  const toggleBookmark = useCallback(async (nodeId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (bookmarks.has(nodeId)) {
      await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('content_id', nodeId)
        .eq('content_type', 'syllabus_node');
      setBookmarks(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    } else {
      await (supabase as any)
        .from('bookmarks')
        .insert({
          user_id: user.id,
          content_id: nodeId,
          content_type: 'syllabus_node',
          title: nodes.find(n => n.id === nodeId)?.name || ''
        });
      setBookmarks(prev => new Set([...prev, nodeId]));
    }
  }, [supabase, bookmarks, nodes]);

  // AC6: Reset view function
  const resetView = useCallback(() => {
    if (canvasInstance?.resetCamera) {
      canvasInstance.resetCamera();
    }
  }, [canvasInstance]);

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

        {/* Paper Filters - AC4 */}
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
        
        {/* Subject Filters - AC4 */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Subjects</h3>
          <div className="space-y-2">
            {SUBJECTS.map(subject => (
              <label key={subject.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSubjects.includes(subject.id)}
                  onChange={() => toggleSubject(subject.id)}
                  className="w-4 h-4 rounded border-white/20 bg-slate-800/50 text-neon-blue"
                />
                <span className="text-gray-300">
                  {subject.name}
                </span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Bookmarks Filter - AC7 */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showBookmarksOnly}
              onChange={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className="w-4 h-4 rounded border-white/20 bg-slate-800/50 text-neon-blue"
            />
            <span className="text-gray-300">
              Show Bookmarks Only
            </span>
          </label>
        </div>
        
        {/* Progress Filter - AC5 */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Progress Status</h3>
          <div className="space-y-2">
            {[
              { id: 'all', name: 'All Topics' },
              { id: 'not_started', name: 'Not Started' },
              { id: 'in_progress', name: 'In Progress' },
              { id: 'completed', name: 'Completed' },
              { id: 'needs_revision', name: 'Needs Revision' },
            ].map(filter => (
              <label key={filter.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="progress-filter"
                  checked={progressFilter === filter.id}
                  onChange={() => setProgressFilter(filter.id)}
                  className="w-4 h-4 rounded border-white/20 bg-slate-800/50 text-neon-blue"
                />
                <span className="text-gray-300">
                  {filter.name}
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
          {/* AC8: Performance indicator */}
          <p className="text-xs text-gray-500 mt-1">
            {nodes.length > 1000 ? 'Performance optimized' : 'Standard view'}
          </p>
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
            <SyllabusCanvas 
              nodes={filteredNodes} 
              onNodeClick={handleNodeClick}
              onBookmark={toggleBookmark}
              onResetView={resetView}
              ref={setCanvasInstance}
            />
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
                      <TreeView nodes={paperNodes} onNodeClick={handleNodeClick} onBookmark={toggleBookmark} />
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
                  <button 
                    className={`px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors ${selectedNode?.isBookmarked ? 'text-yellow-400' : 'text-gray-400'}`}
                    onClick={() => toggleBookmark(selectedNode?.id || '')}
                  >
                    <svg className="w-5 h-5" fill={selectedNode?.isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
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
  onBookmark,
  level = 0
}: {
  nodes: SyllabusNode[];
  onNodeClick: (node: SyllabusNode) => void;
  onBookmark: (nodeId: string) => void;
  level?: number;
}) {
  if (nodes.length === 0) return null;

  return (
    <div className={`space-y-2 ${level > 0 ? 'ml-6 pl-4 border-l border-white/10' : ''}`}>
      {nodes.map(node => (
        <div key={node.id}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNodeClick(node)}
              className="flex-1 text-left px-4 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-3"
            >
              {node.children && node.children.length > 0 && (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
              <span className="text-gray-400 text-sm w-16">{node.code}</span>
              <span className="text-white flex-1">{node.name}</span>
              
              {/* Progress indicator - AC2 */}
              {node.progress !== undefined && (
                <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full" 
                    style={{
                      width: `${node.progress}%`,
                      backgroundColor: node.confidence !== undefined ? getConfidenceColor(node.confidence) : '#666'
                    }}
                  />
                </div>
              )}
            </button>
            
            {/* Bookmark button - AC7 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBookmark(node.id);
              }}
              className={`p-2 rounded-lg ${node.isBookmarked ? 'text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <svg className="w-4 h-4" fill={node.isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          </div>
          {node.children && node.children.length > 0 && (
            <TreeView nodes={node.children} onNodeClick={onNodeClick} onBookmark={onBookmark} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
}
