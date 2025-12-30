'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Story 9.5: Mindmap Interactive Visualization
// AC 1-10: Full interactive graph with zoom, pan, colors, deep linking

interface MindmapNode {
  id: string;
  label: string;
  level: number;
  parent_id: string | null;
  children: string[];
  metadata?: {
    description?: string;
    importance?: 'high' | 'medium' | 'low';
    subject?: string;
    linked_notes?: string[];
    linked_videos?: string[];
    linked_pyqs?: string[];
  };
}

interface PositionedNode extends MindmapNode {
  x: number;
  y: number;
  width: number;
  height: number;
  expanded: boolean;
}

interface Edge {
  source: string;
  target: string;
  type?: 'parent-child' | 'cross-link';
}

interface Mindmap {
  id: string;
  title: string;
  structure_json: { nodes: MindmapNode[]; edges: Edge[] };
  relationships: any[];
}

// AC 4: Subject color coding
const SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  polity: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
  history: { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
  geography: { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },
  economy: { bg: '#FEF3C7', border: '#EAB308', text: '#A16207' },
  science: { bg: '#F3E8FF', border: '#A855F7', text: '#7E22CE' },
  environment: { bg: '#ECFDF5', border: '#10B981', text: '#047857' },
  ethics: { bg: '#FDF2F8', border: '#EC4899', text: '#BE185D' },
  current: { bg: '#F1F5F9', border: '#64748B', text: '#334155' },
  default: { bg: '#F9FAFB', border: '#6B7280', text: '#374151' },
};

export default function MindmapViewer({ mindmapId }: { mindmapId: string }) {
  const [mindmap, setMindmap] = useState<Mindmap | null>(null);
  const [nodes, setNodes] = useState<PositionedNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  
  // AC 5: Zoom and pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // AC 2: Node interaction
  const [selectedNode, setSelectedNode] = useState<PositionedNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<PositionedNode | null>(null);
  
  // AC 8: Full screen mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadMindmap();
  }, [mindmapId]);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  };

  const loadMindmap = async () => {
    setLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'get', mindmap_id: mindmapId }),
      });

      if (res.ok) {
        const data = await res.json();
        setMindmap(data.mindmap);
        layoutNodes(data.mindmap.structure_json.nodes, data.mindmap.structure_json.edges || []);
      }
    } catch (e) {
      console.error('Failed to load mindmap:', e);
    } finally {
      setLoading(false);
    }
  };

  // Layout algorithm - radial tree layout
  const layoutNodes = (rawNodes: MindmapNode[], rawEdges: Edge[]) => {
    if (!rawNodes.length) return;

    const centerX = 600;
    const centerY = 400;
    const levelRadius = 200;

    // Find root node
    const root = rawNodes.find(n => n.level === 0 || !n.parent_id);
    if (!root) return;

    const positioned: PositionedNode[] = [];
    const nodeMap = new Map<string, MindmapNode>();
    rawNodes.forEach(n => nodeMap.set(n.id, n));

    // BFS to position nodes
    const queue: { node: MindmapNode; angle: number; angleSpan: number }[] = [
      { node: root, angle: 0, angleSpan: 2 * Math.PI }
    ];

    // Position root
    positioned.push({
      ...root,
      x: centerX,
      y: centerY,
      width: 120,
      height: 60,
      expanded: true,
    });

    while (queue.length > 0) {
      const { node: current, angle, angleSpan } = queue.shift()!;
      
      // Get children
      const children = rawNodes.filter(n => n.parent_id === current.id);
      if (children.length === 0) continue;

      const angleStep = angleSpan / children.length;
      const startAngle = angle - angleSpan / 2 + angleStep / 2;
      const radius = levelRadius * (current.level + 1);

      children.forEach((child, i) => {
        const childAngle = startAngle + i * angleStep;
        const x = centerX + Math.cos(childAngle) * radius;
        const y = centerY + Math.sin(childAngle) * radius;

        // AC 3: Node sizes by level
        const size = child.level === 0 ? { w: 120, h: 60 } :
                     child.level === 1 ? { w: 100, h: 50 } :
                     { w: 80, h: 40 };

        positioned.push({
          ...child,
          x,
          y,
          width: size.w,
          height: size.h,
          expanded: child.level < 2,
        });

        queue.push({ node: child, angle: childAngle, angleSpan: angleStep * 1.5 });
      });
    }

    setNodes(positioned);
    setEdges(rawEdges.length > 0 ? rawEdges : generateEdges(positioned));
  };

  // Generate edges from parent-child relationships
  const generateEdges = (positioned: PositionedNode[]): Edge[] => {
    return positioned
      .filter(n => n.parent_id)
      .map(n => ({
        source: n.parent_id!,
        target: n.id,
        type: 'parent-child' as const,
      }));
  };

  // AC 2: Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, expanded: !n.expanded } : n
    ));
  };

  // AC 5: Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.min(Math.max(s * delta, 0.2), 3));
  }, []);

  // AC 5: Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.button === 0 && !target.closest('.mindmap-node')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // AC 8: Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Get node color based on subject
  const getNodeColor = (node: PositionedNode) => {
    const subject = node.metadata?.subject?.toLowerCase() || 'default';
    return SUBJECT_COLORS[subject] || SUBJECT_COLORS.default;
  };

  // AC 6: Check if node has deep links
  const hasDeepLinks = (node: PositionedNode) => {
    return (node.metadata?.linked_notes?.length || 0) > 0 ||
           (node.metadata?.linked_videos?.length || 0) > 0 ||
           (node.metadata?.linked_pyqs?.length || 0) > 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50' : 'h-[700px]'
      }`}
    >
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => setScale(s => Math.min(s * 1.2, 3))}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50"
          title="Zoom In"
        >
          🔍+
        </button>
        <button
          onClick={() => setScale(s => Math.max(s * 0.8, 0.2))}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50"
          title="Zoom Out"
        >
          🔍-
        </button>
        <button
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50"
          title="Reset View"
        >
          ⟲
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? '⤓' : '⤢'}
        </button>
      </div>

      {/* AC 9: Minimap */}
      <div className="absolute bottom-4 right-4 z-20 w-40 h-28 bg-white rounded-lg shadow border overflow-hidden">
        <div className="text-xs text-gray-500 text-center py-1 border-b">Minimap</div>
        <div className="relative w-full h-20 bg-gray-50">
          {nodes.slice(0, 20).map(node => (
            <div
              key={node.id}
              className="absolute w-1 h-1 rounded-full"
              style={{
                left: `${(node.x / 1200) * 100}%`,
                top: `${(node.y / 800) * 100}%`,
                backgroundColor: getNodeColor(node).border,
              }}
            />
          ))}
          {/* Viewport indicator */}
          <div
            className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-30"
            style={{
              left: `${(-offset.x / 1200 / scale) * 100}%`,
              top: `${(-offset.y / 800 / scale) * 100}%`,
              width: `${(1 / scale) * 100}%`,
              height: `${(1 / scale) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          className="w-full h-full"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Draw edges */}
          {edges.map((edge, i) => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (!source || !target) return null;

            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={edge.type === 'cross-link' ? '#9CA3AF' : '#D1D5DB'}
                strokeWidth={edge.type === 'cross-link' ? 1 : 2}
                strokeDasharray={edge.type === 'cross-link' ? '5,5' : undefined}
              />
            );
          })}

          {/* Draw nodes */}
          {nodes.map(node => {
            const colors = getNodeColor(node);
            const isVisible = node.level === 0 || 
              nodes.find(n => n.id === node.parent_id)?.expanded;

            if (!isVisible) return null;

            return (
              <g key={node.id} className="mindmap-node">
                {/* Node shape */}
                <rect
                  x={node.x - node.width / 2}
                  y={node.y - node.height / 2}
                  width={node.width}
                  height={node.height}
                  rx={node.level === 0 ? node.height / 2 : 8}
                  fill={colors.bg}
                  stroke={selectedNode?.id === node.id ? '#3B82F6' : colors.border}
                  strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => { setSelectedNode(node); toggleNode(node.id); }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                />

                {/* Node label */}
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={colors.text}
                  fontSize={node.level === 0 ? 14 : node.level === 1 ? 12 : 10}
                  fontWeight={node.level < 2 ? 600 : 400}
                  className="pointer-events-none select-none"
                >
                  {node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label}
                </text>

                {/* AC 6: Deep link indicators */}
                {hasDeepLinks(node) && (
                  <g transform={`translate(${node.x + node.width/2 - 10}, ${node.y - node.height/2 - 5})`}>
                    {node.metadata?.linked_notes?.length && (
                      <circle cx="0" cy="0" r="5" fill="#3B82F6" />
                    )}
                    {node.metadata?.linked_videos?.length && (
                      <circle cx="12" cy="0" r="5" fill="#EF4444" />
                    )}
                    {node.metadata?.linked_pyqs?.length && (
                      <circle cx="24" cy="0" r="5" fill="#10B981" />
                    )}
                  </g>
                )}

                {/* Expand/collapse indicator */}
                {node.children?.length > 0 && (
                  <text
                    x={node.x + node.width/2 - 10}
                    y={node.y + node.height/2 - 5}
                    fontSize="10"
                    fill={colors.text}
                    className="pointer-events-none"
                  >
                    {node.expanded ? '−' : '+'}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* AC 7: Hover tooltip */}
      {hoveredNode && hoveredNode.metadata?.description && (
        <div
          className="absolute z-30 max-w-xs p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none"
          style={{
            left: (hoveredNode.x * scale + offset.x) + 100,
            top: (hoveredNode.y * scale + offset.y) - 20,
          }}
        >
          <div className="font-medium mb-1">{hoveredNode.label}</div>
          <div className="text-gray-300 text-xs">{hoveredNode.metadata.description}</div>
        </div>
      )}

      {/* Node detail panel */}
      {selectedNode && (
        <div className="absolute top-4 left-4 z-20 w-72 bg-white rounded-xl shadow-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">{selectedNode.label}</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {selectedNode.metadata?.description && (
            <p className="text-sm text-gray-600 mb-3">{selectedNode.metadata.description}</p>
          )}

          {selectedNode.metadata?.importance && (
            <div className={`inline-block px-2 py-1 rounded text-xs mb-3 ${
              selectedNode.metadata.importance === 'high' ? 'bg-red-100 text-red-700' :
              selectedNode.metadata.importance === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {selectedNode.metadata.importance} importance
            </div>
          )}

          {/* AC 6: Deep links section */}
          {hasDeepLinks(selectedNode) && (
            <div className="border-t pt-3 mt-3">
              <div className="text-sm font-medium mb-2">Related Content</div>
              {selectedNode.metadata?.linked_notes?.map((note, i) => (
                <a key={i} href={`/notes/${note}`} className="block text-blue-600 hover:underline text-sm py-1">
                  📝 {note}
                </a>
              ))}
              {selectedNode.metadata?.linked_videos?.map((video, i) => (
                <a key={i} href={`/videos/${video}`} className="block text-red-600 hover:underline text-sm py-1">
                  🎥 {video}
                </a>
              ))}
              {selectedNode.metadata?.linked_pyqs?.map((pyq, i) => (
                <a key={i} href={`/pyqs/${pyq}`} className="block text-green-600 hover:underline text-sm py-1">
                  📋 {pyq}
                </a>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-400 mt-3">
            Level {selectedNode.level} • {selectedNode.children?.length || 0} children
          </div>
        </div>
      )}

      {/* Color legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-white rounded-lg shadow p-3">
        <div className="text-xs font-medium mb-2">Subject Colors</div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {Object.entries(SUBJECT_COLORS).slice(0, 6).map(([key, colors]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.border }} />
              <span className="capitalize">{key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
