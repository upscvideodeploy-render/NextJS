'use client';

import { useState, useEffect } from 'react';

export default function ProgressPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await fetch('/api/progress/dashboard');
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const { overview, paperProgress, weakAreas, strongAreas, heatmapData } = data;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Progress Dashboard</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Overall Completion</div>
          <div className="text-3xl font-bold text-blue-600">{overview.avgCompletion}%</div>
          <div className="text-xs text-gray-500">{overview.completedTopics}/{overview.totalTopics} topics</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Avg Confidence</div>
          <div className="text-3xl font-bold text-green-600">{overview.avgConfidence}%</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Study Hours</div>
          <div className="text-3xl font-bold text-purple-600">{overview.totalStudyHours}h</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Active Topics</div>
          <div className="text-3xl font-bold text-orange-600">{overview.totalTopics}</div>
        </div>
      </div>

      {/* Paper-wise Progress */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Paper-wise Progress</h2>
        <div className="space-y-3">
          {Object.entries(paperProgress).map(([paper, stats]: [string, any]) => (
            <div key={paper}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{paper}</span>
                <span>{Math.round((stats.completed / stats.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Weak Areas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-red-600">Weak Areas (Bottom 10)</h2>
          <div className="space-y-2">
            {weakAreas.map((topic: any) => (
              <div key={topic.id} className="flex justify-between items-center p-2 border-l-4 border-red-500 bg-red-50">
                <div>
                  <div className="font-medium text-sm">{topic.topic}</div>
                  <div className="text-xs text-gray-600">{topic.subject} - {topic.paper}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-red-600">{topic.confidence_score}%</div>
                  <div className="text-xs text-gray-500">{topic.completion_percentage}% done</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strong Areas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-green-600">Strong Areas (Top 10)</h2>
          <div className="space-y-2">
            {strongAreas.map((topic: any) => (
              <div key={topic.id} className="flex justify-between items-center p-2 border-l-4 border-green-500 bg-green-50">
                <div>
                  <div className="font-medium text-sm">{topic.topic}</div>
                  <div className="text-xs text-gray-600">{topic.subject} - {topic.paper}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">{topic.confidence_score}%</div>
                  <div className="text-xs text-gray-500">{topic.completion_percentage}% done</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Calendar */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Activity Heatmap</h2>
        <div className="grid grid-cols-7 gap-2">
          {Object.entries(heatmapData).slice(-49).map(([date, minutes]: [string, any]) => {
            const intensity = Math.min(Math.floor(minutes / 30), 4);
            const colors = ['bg-gray-100', 'bg-green-200', 'bg-green-400', 'bg-green-600', 'bg-green-800'];
            return (
              <div
                key={date}
                className={`h-10 rounded ${colors[intensity]} flex items-center justify-center text-xs`}
                title={`${date}: ${minutes} min`}
              >
                {new Date(date).getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Export as PDF
        </button>
      </div>
    </div>
  );
}
