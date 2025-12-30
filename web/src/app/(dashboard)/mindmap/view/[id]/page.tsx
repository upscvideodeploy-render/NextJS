'use client';

import { use } from 'react';
import MindmapViewer from '@/components/mindmap/MindmapViewer';

// Story 9.5: Mindmap Interactive View Page
// Route: /mindmap/view/[id]

export default function MindmapViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <a
              href="/mindmap"
              className="text-gray-500 hover:text-gray-700 flex items-center gap-2"
            >
              ← Back to Mindmaps
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>🧠 Interactive Mindmap Viewer</span>
          </div>
        </div>
      </header>

      {/* Viewer */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          <MindmapViewer mindmapId={id} />
        </div>
      </main>

      {/* Help text */}
      <footer className="bg-white border-t px-6 py-4 text-center text-sm text-gray-500">
        <p>
          🖱️ <strong>Click</strong> nodes to expand/collapse • 
          <strong>Scroll</strong> to zoom • 
          <strong>Drag</strong> to pan • 
          Press <strong>⤢</strong> for fullscreen
        </p>
      </footer>
    </div>
  );
}
