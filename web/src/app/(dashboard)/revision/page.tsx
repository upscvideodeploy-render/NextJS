'use client';

import { useState, useEffect } from 'react';

export default function RevisionPage() {
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    const res = await fetch('/api/revision/targets');
    const data = await res.json();
    setTargets(data.targets || []);
    setLoading(false);
  };

  const detectWeakness = async () => {
    setLoading(true);
    await fetch('/api/revision/detect', { method: 'POST' });
    fetchTargets();
  };

  const startRevision = async (targetId: string) => {
    await fetch('/api/revision/targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId, status: 'in_progress' })
    });
    fetchTargets();
  };

  const completeRevision = async (targetId: string) => {
    await fetch('/api/revision/targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId, status: 'completed' })
    });
    fetchTargets();
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Weekly Revision Targets</h1>
        <button
          onClick={detectWeakness}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Detect Weak Topics
        </button>
      </div>

      {targets.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <p className="text-gray-600">No revision targets yet. Click "Detect Weak Topics" to analyze your progress.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {targets.map((target, idx) => (
            <div key={target.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl font-bold text-red-600">#{idx + 1}</span>
                    <h3 className="text-xl font-semibold">{target.topic_progress.topic}</h3>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {target.topic_progress.subject} - {target.topic_progress.paper}
                  </div>
                  <div className="flex space-x-4 text-sm">
                    <div>
                      <span className="text-gray-600">Weakness Score:</span>
                      <span className="ml-2 font-bold text-red-600">{Math.round(target.weakness_score)}/100</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Confidence:</span>
                      <span className="ml-2 font-bold">{target.topic_progress.confidence_score}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Completion:</span>
                      <span className="ml-2 font-bold">{target.topic_progress.completion_percentage}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  {target.status === 'pending' && (
                    <button
                      onClick={() => startRevision(target.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Start Revision
                    </button>
                  )}
                  {target.status === 'in_progress' && (
                    <button
                      onClick={() => completeRevision(target.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
