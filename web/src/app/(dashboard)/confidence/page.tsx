'use client';

import { useState, useEffect } from 'react';

export default function ConfidencePage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('confidence');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    const res = await fetch('/api/progress/dashboard');
    const data = await res.json();
    setTopics(data.weakAreas.concat(data.strongAreas) || []);
    setLoading(false);
  };

  const getColor = (score: number) => {
    if (score <= 40) return 'text-red-600 bg-red-100';
    if (score <= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getAction = (score: number) => {
    if (score <= 40) return 'Start Learning';
    if (score <= 70) return 'Practice More';
    return 'Maintain';
  };

  const filteredTopics = topics
    .filter(t => filter === 'all' || t.subject === filter)
    .sort((a, b) => {
      if (sort === 'confidence') return a.confidence_score - b.confidence_score;
      if (sort === 'name') return a.topic.localeCompare(b.topic);
      return 0;
    });

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Confidence Meter</h1>

      <div className="flex space-x-4 mb-8">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="all">All Subjects</option>
          <option value="History">History</option>
          <option value="Geography">Geography</option>
          <option value="Polity">Polity</option>
          <option value="Economy">Economy</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="confidence">Sort by Confidence</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTopics.map((topic) => (
          <div key={topic.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold">{topic.topic}</h3>
                <p className="text-sm text-gray-600">{topic.subject} - {topic.paper}</p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getColor(topic.confidence_score)}`}>
                <span className="text-xl font-bold">{topic.confidence_score}%</span>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className={`h-2 rounded-full ${topic.confidence_score <= 40 ? 'bg-red-600' : topic.confidence_score <= 70 ? 'bg-yellow-600' : 'bg-green-600'}`}
                style={{ width: `${topic.confidence_score}%` }}
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{topic.completion_percentage}% complete</span>
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                {getAction(topic.confidence_score)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
