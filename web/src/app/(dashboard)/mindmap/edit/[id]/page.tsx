'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Story 9.6: Mindmap Editing Page
// AC 1-10: Full editing with sharing and export

interface MindmapNode {
  id: string;
  label: string;
  level: number;
  parent_id: string | null;
  children: string[];
  x?: number;
  y?: number;
  metadata?: { color?: string; notes?: string };
}

interface Mindmap {
  id: string;
  title: string;
  structure_json: { nodes: MindmapNode[]; edges: any[] };
  is_public: boolean;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#6B7280',
];

export default function MindmapEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [mindmap, setMindmap] = useState<Mindmap | null>(null);
  const [nodes, setNodes] = useState<MindmapNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<MindmapNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  
  // AC 1: Edit mode
  const [editMode, setEditMode] = useState(true);
  
  // AC 8: Sharing
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  
  // AC 7: Versions
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  
  // AC 2: Node editing
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  };

  useEffect(() => {
    loadMindmap();
  }, [id]);

  const loadMindmap = async () => {
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
        setMindmap(data.mindmap);
        setNodes(data.mindmap.structure_json?.nodes || []);
      }
    } catch (e) {
      console.error('Failed to load mindmap:', e);
    } finally {
      setLoading(false);
    }
  };

  // AC 6: Save mindmap
  const saveMindmap = async () => {
    setSaving(true);
    try {
      const authHeader = await getAuthHeader();
      const structure = { nodes, edges: mindmap?.structure_json?.edges || [] };
      
      const res = await fetch('/api/mindmap/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'save', mindmap_id: id, structure }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLastSaved(new Date(data.saved_at).toLocaleTimeString());
      }
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  // AC 2: Add child node
  const addChildNode = async () => {
    if (!selectedNode) return;
    
    const authHeader = await getAuthHeader();
    const res = await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ 
        action: 'add_node', 
        mindmap_id: id, 
        parent_id: selectedNode.id,
        label: 'New Node',
      }),
    });
    
    if (res.ok) {
      const data = await res.json();
      setNodes(prev => [...prev, data.node]);
      // Update parent's children
      setNodes(prev => prev.map(n => 
        n.id === selectedNode.id 
          ? { ...n, children: [...(n.children || []), data.node.id] }
          : n
      ));
    }
  };

  // AC 2: Delete node
  const deleteNode = async () => {
    if (!selectedNode) return;
    if (!confirm('Delete this node and all children?')) return;
    
    const authHeader = await getAuthHeader();
    const res = await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ action: 'delete_node', mindmap_id: id, node_id: selectedNode.id }),
    });
    
    if (res.ok) {
      const data = await res.json();
      setNodes(prev => prev.filter(n => !data.removed.includes(n.id)));
      setSelectedNode(null);
    }
  };

  // AC 2: Rename node
  const startRename = (node: MindmapNode) => {
    setEditingLabel(node.id);
    setNewLabel(node.label);
  };

  const finishRename = async () => {
    if (!editingLabel || !newLabel.trim()) {
      setEditingLabel(null);
      return;
    }
    
    const authHeader = await getAuthHeader();
    await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ 
        action: 'rename_node', 
        mindmap_id: id, 
        node_id: editingLabel,
        label: newLabel,
      }),
    });
    
    setNodes(prev => prev.map(n => 
      n.id === editingLabel ? { ...n, label: newLabel } : n
    ));
    setEditingLabel(null);
  };

  // AC 2: Change color
  const changeColor = async (color: string) => {
    if (!selectedNode) return;
    
    const authHeader = await getAuthHeader();
    await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ 
        action: 'change_color', 
        mindmap_id: id, 
        node_id: selectedNode.id,
        color,
      }),
    });
    
    setNodes(prev => prev.map(n => 
      n.id === selectedNode.id 
        ? { ...n, metadata: { ...n.metadata, color } }
        : n
    ));
  };

  // AC 4: Auto-layout
  const autoLayout = async () => {
    const authHeader = await getAuthHeader();
    const res = await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ action: 'auto_layout', mindmap_id: id }),
    });
    
    if (res.ok) {
      const data = await res.json();
      setNodes(data.structure.nodes);
    }
  };

  // AC 7: Save version
  const saveVersion = async () => {
    const summary = prompt('Enter change summary (optional):');
    
    const authHeader = await getAuthHeader();
    const res = await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ 
        action: 'save_version', 
        mindmap_id: id,
        change_summary: summary || 'Manual save',
      }),
    });
    
    if (res.ok) {
      alert('Version saved!');
      loadVersions();
    }
  };

  // AC 7: Load versions
  const loadVersions = async () => {
    const authHeader = await getAuthHeader();
    const res = await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ action: 'get_versions', mindmap_id: id }),
    });
    
    if (res.ok) {
      const data = await res.json();
      setVersions(data.versions || []);
    }
  };

  // AC 7: Revert version
  const revertVersion = async (versionNumber: number) => {
    if (!confirm(`Revert to version ${versionNumber}?`)) return;
    
    const authHeader = await getAuthHeader();
    await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ 
        action: 'revert_version', 
        mindmap_id: id,
        version_number: versionNumber,
      }),
    });
    
    loadMindmap();
  };

  // AC 8: Create share link
  const createShare = async (permission: string) => {
    const authHeader = await getAuthHeader();
    const res = await fetch('/api/mindmap/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ 
        action: 'create_share', 
        mindmap_id: id,
        permission,
      }),
    });
    
    if (res.ok) {
      const data = await res.json();
      setShareUrl(data.share_url);
    }
  };

  // AC 10: Export
  const exportMindmap = async (format: string) => {
    if (format === 'json') {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/mindmap/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'export', mindmap_id: id, format: 'json' }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${mindmap?.title || 'mindmap'}.json`;
        a.click();
      }
    } else if (format === 'png') {
      // Use browser screenshot
      alert('Use Ctrl+Shift+S or browser screenshot for PNG export');
    }
  };

  // Render tree
  const renderTree = useCallback((parentId: string | null = null, depth = 0) => {
    const children = nodes.filter(n => n.parent_id === parentId);
    if (!children.length) return null;

    return (
      <ul className={depth > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}>
        {children.map(node => (
          <li key={node.id} className="py-2">
            <div
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                selectedNode?.id === node.id 
                  ? 'bg-blue-100 border-2 border-blue-500' 
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => setSelectedNode(node)}
              onDoubleClick={() => editMode && startRename(node)}
            >
              <span
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: node.metadata?.color || COLORS[depth % COLORS.length] }}
              />
              
              {editingLabel === node.id ? (
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => e.key === 'Enter' && finishRename()}
                  className="flex-1 px-2 py-1 border rounded"
                  autoFocus
                />
              ) : (
                <span className="flex-1">{node.label}</span>
              )}
              
              {node.metadata?.notes && <span title={node.metadata.notes}>📝</span>}
            </div>
            {renderTree(node.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }, [nodes, selectedNode, editingLabel, newLabel, editMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <a href="/mindmap" className="text-gray-500 hover:text-gray-700">
              ← Back
            </a>
            <h1 className="text-xl font-bold">{mindmap?.title}</h1>
            {lastSaved && (
              <span className="text-sm text-green-600">✓ Saved {lastSaved}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* AC 1: Edit mode toggle */}
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-4 py-2 rounded-lg ${
                editMode ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              {editMode ? '✏️ Editing' : '👁️ View Only'}
            </button>
            
            {/* AC 6: Save */}
            <button
              onClick={saveMindmap}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Save'}
            </button>
            
            {/* AC 8: Share */}
            <button
              onClick={() => setShowShareModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              🔗 Share
            </button>
            
            {/* AC 7: Versions */}
            <button
              onClick={() => { setShowVersions(true); loadVersions(); }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              📜 History
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Node operations */}
        {editMode && (
          <div className="lg:col-span-1 bg-white rounded-xl shadow p-4">
            <h2 className="font-bold mb-4">Edit Tools</h2>
            
            {/* AC 2: Node operations */}
            <div className="space-y-3">
              <button
                onClick={addChildNode}
                disabled={!selectedNode}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
              >
                ➕ Add Child
              </button>
              <button
                onClick={deleteNode}
                disabled={!selectedNode}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg disabled:opacity-50"
              >
                🗑️ Delete
              </button>
              <button
                onClick={() => selectedNode && startRename(selectedNode)}
                disabled={!selectedNode}
                className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg disabled:opacity-50"
              >
                ✏️ Rename
              </button>
              
              {/* AC 4: Auto layout */}
              <button
                onClick={autoLayout}
                className="w-full px-4 py-2 bg-indigo-500 text-white rounded-lg"
              >
                🔄 Re-arrange
              </button>
              
              {/* AC 7: Save version */}
              <button
                onClick={saveVersion}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg"
              >
                📸 Save Version
              </button>
            </div>

            {/* AC 2: Color picker */}
            {selectedNode && (
              <div className="mt-6">
                <h3 className="font-medium mb-2">Node Color</h3>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => changeColor(color)}
                      className="w-8 h-8 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* AC 10: Export */}
            <div className="mt-6 border-t pt-4">
              <h3 className="font-medium mb-2">Export</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => exportMindmap('json')}
                  className="px-3 py-1 bg-gray-200 rounded text-sm"
                >
                  JSON
                </button>
                <button
                  onClick={() => exportMindmap('png')}
                  className="px-3 py-1 bg-gray-200 rounded text-sm"
                >
                  PNG
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content - Tree view */}
        <div className={`${editMode ? 'lg:col-span-3' : 'lg:col-span-4'} bg-white rounded-xl shadow p-6`}>
          <div className="mb-4 text-sm text-gray-500">
            {editMode ? 'Click to select, double-click to rename' : 'View mode'}
          </div>
          
          <div className="border rounded-lg p-4 bg-gray-50 min-h-[500px] overflow-auto">
            {renderTree()}
          </div>
        </div>
      </div>

      {/* AC 8: Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Share Mindmap</h2>
            
            <div className="space-y-3 mb-4">
              <button
                onClick={() => createShare('view')}
                className="w-full p-3 border rounded-lg text-left hover:bg-gray-50"
              >
                <div className="font-medium">👁️ View Only</div>
                <div className="text-sm text-gray-500">Others can view but not edit</div>
              </button>
              <button
                onClick={() => createShare('edit')}
                className="w-full p-3 border rounded-lg text-left hover:bg-gray-50"
              >
                <div className="font-medium">✏️ Can Edit</div>
                <div className="text-sm text-gray-500">Others can make changes</div>
              </button>
            </div>

            {shareUrl && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-green-700 mb-2">Share link created!</div>
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="w-full p-2 border rounded text-sm"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="mt-2 text-sm text-blue-600"
                >
                  📋 Copy to clipboard
                </button>
              </div>
            )}

            <button
              onClick={() => { setShowShareModal(false); setShareUrl(''); }}
              className="w-full py-2 bg-gray-200 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* AC 7: Version History Modal */}
      {showVersions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-h-[80vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">Version History</h2>
            
            {versions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No versions saved yet</p>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.version_number} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">Version {v.version_number}</div>
                        <div className="text-sm text-gray-500">{v.change_summary}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(v.created_at).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => revertVersion(v.version_number)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                      >
                        Revert
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowVersions(false)}
              className="w-full py-2 bg-gray-200 rounded-lg mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
