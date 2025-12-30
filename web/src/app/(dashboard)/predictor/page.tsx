'use client';

/**
 * Topic Difficulty Predictor UI - Story 14.2
 * 
 * AC 1: Prediction model display
 * AC 2: Difficulty scoring 1-10
 * AC 3: Weightage prediction
 * AC 4: Confidence score
 * AC 5: Difficulty heatmap
 * AC 6: Time recommendation
 * AC 7: Trend analysis
 * AC 8: Alerts for trending
 * AC 9: Export PDF
 * AC 10: Weekly updates indicator
 */

import { useState, useEffect, useCallback } from 'react';

interface Topic {
  id: string;
  name: string;
  subject: string;
  paper: string;
}

interface Prediction {
  difficulty_score: number;
  weightage_prediction: number;
  confidence_score: number;
  time_recommendation_hours: number;
  trend_direction: string;
  is_trending: boolean;
}

interface TrendingTopic {
  topic_id: string;
  topic_name: string;
  subject: string;
  difficulty_score: number;
  trend_direction: string;
  alert_message: string;
}

interface SubjectSummary {
  subject: string;
  topicCount: number;
  avgDifficulty: number;
  risingCount: number;
  totalStudyHours: number;
}

const SUBJECTS = [
  { code: 'polity', name: 'Indian Polity', color: '#EF4444', icon: '🏛️' },
  { code: 'history', name: 'History', color: '#F59E0B', icon: '📜' },
  { code: 'geography', name: 'Geography', color: '#10B981', icon: '🌍' },
  { code: 'economics', name: 'Economics', color: '#3B82F6', icon: '📊' },
  { code: 'science', name: 'Science & Tech', color: '#8B5CF6', icon: '🔬' },
  { code: 'environment', name: 'Environment', color: '#22C55E', icon: '🌱' },
  { code: 'ethics', name: 'Ethics', color: '#6366F1', icon: '⚖️' }
];

export default function PredictorPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'heatmap' | 'trends' | 'recommendations'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [subjectSummary, setSubjectSummary] = useState<SubjectSummary[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, any[]>>({});
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch('/api/predictor?action=dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSubjectSummary(data.subjectSummary || []);
      setTrendingTopics(data.trending || []);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHeatmap = async (subject: string | null) => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const url = subject 
        ? `/api/predictor?action=heatmap&subject=${subject}`
        : '/api/predictor?action=heatmap';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setHeatmapData(data.heatmapData || {});
    } catch (error) {
      console.error('Failed to fetch heatmap:', error);
    }
  };

  const fetchTopicDetail = async (topicId: string) => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`/api/predictor?action=topic&id=${topicId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSelectedTopic(data);
    } catch (error) {
      console.error('Failed to fetch topic:', error);
    }
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch('/api/predictor', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate_report',
          reportType: selectedSubject ? 'subject' : 'full',
          subject: selectedSubject
        })
      });
      const data = await res.json();
      
      // Create downloadable JSON (in production, would be PDF)
      const blob = new Blob([JSON.stringify(data.content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `upsc-prediction-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (activeTab === 'heatmap') {
      fetchHeatmap(selectedSubject);
    }
  }, [activeTab, selectedSubject]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading predictions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Topic Difficulty Predictor
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                AI-powered predictions based on PYQ analysis (2010-2024)
              </p>
            </div>
            <button
              onClick={exportReport}
              disabled={exporting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {exporting ? 'Generating...' : '📥 Export Report'}
            </button>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-4 mt-6">
            {['dashboard', 'heatmap', 'trends', 'recommendations'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <DashboardTab 
            subjectSummary={subjectSummary} 
            trendingTopics={trendingTopics}
            onTopicClick={fetchTopicDetail}
          />
        )}
        {activeTab === 'heatmap' && (
          <HeatmapTab 
            data={heatmapData}
            selectedSubject={selectedSubject}
            onSubjectChange={setSelectedSubject}
            onTopicClick={fetchTopicDetail}
          />
        )}
        {activeTab === 'trends' && <TrendsTab />}
        {activeTab === 'recommendations' && <RecommendationsTab />}
      </main>

      {/* Topic Detail Modal */}
      {selectedTopic && (
        <TopicDetailModal 
          topic={selectedTopic} 
          onClose={() => setSelectedTopic(null)} 
        />
      )}
    </div>
  );
}

// ============================================================================
// Dashboard Tab
// ============================================================================

function DashboardTab({ subjectSummary, trendingTopics, onTopicClick }: {
  subjectSummary: SubjectSummary[];
  trendingTopics: TrendingTopic[];
  onTopicClick: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Subject Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {subjectSummary.map(summary => {
          const subject = SUBJECTS.find(s => s.code === summary.subject);
          return (
            <div 
              key={summary.subject}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{subject?.icon}</span>
                <h3 className="font-bold text-gray-900 dark:text-white">{subject?.name}</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Avg Difficulty</span>
                  <span className="font-bold" style={{ color: getDifficultyColor(summary.avgDifficulty) }}>
                    {summary.avgDifficulty}/10
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Topics</span>
                  <span className="font-bold text-gray-900 dark:text-white">{summary.topicCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Rising Topics</span>
                  <span className="font-bold text-green-600">{summary.risingCount} ↑</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Study Time</span>
                  <span className="font-bold text-indigo-600">{Math.round(summary.totalStudyHours)}h</span>
                </div>
              </div>
              {/* Mini difficulty bar */}
              <div className="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all"
                  style={{ 
                    width: `${summary.avgDifficulty * 10}%`,
                    backgroundColor: getDifficultyColor(summary.avgDifficulty)
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Trending Topics Alert (AC 8) */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔥</span>
          <h2 className="text-xl font-bold">Trending Topics</h2>
          <span className="ml-auto text-sm opacity-80">Prioritize these!</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {trendingTopics.slice(0, 6).map(topic => (
            <button
              key={topic.topic_id}
              onClick={() => onTopicClick(topic.topic_id)}
              className="bg-white/20 backdrop-blur rounded-lg p-4 text-left hover:bg-white/30 transition-colors"
            >
              <p className="font-bold">{topic.topic_name}</p>
              <p className="text-sm opacity-80">
                {topic.subject} • Difficulty: {topic.difficulty_score}/10
              </p>
              {topic.alert_message && (
                <p className="text-xs mt-1 opacity-70">{topic.alert_message}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Heatmap Tab (AC 5)
// ============================================================================

function HeatmapTab({ data, selectedSubject, onSubjectChange, onTopicClick }: {
  data: Record<string, any[]>;
  selectedSubject: string | null;
  onSubjectChange: (subject: string | null) => void;
  onTopicClick: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Subject Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onSubjectChange(null)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            !selectedSubject
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          All Subjects
        </button>
        {SUBJECTS.map(subject => (
          <button
            key={subject.code}
            onClick={() => onSubjectChange(subject.code)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedSubject === subject.code
                ? 'text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
            style={selectedSubject === subject.code ? { backgroundColor: subject.color } : {}}
          >
            {subject.icon} {subject.name}
          </button>
        ))}
      </div>

      {/* Heatmap Grid */}
      {Object.entries(data).map(([subject, topics]) => {
        const subjectInfo = SUBJECTS.find(s => s.code === subject);
        return (
          <div key={subject} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>{subjectInfo?.icon}</span>
              {subjectInfo?.name}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {topics.map((topic: any) => (
                <button
                  key={topic.id}
                  onClick={() => onTopicClick(topic.id)}
                  className="relative p-3 rounded-lg text-white text-sm font-medium hover:scale-105 transition-transform"
                  style={{ 
                    backgroundColor: getDifficultyColor(topic.difficulty),
                    minHeight: '60px'
                  }}
                  title={`${topic.name}: Difficulty ${topic.difficulty}/10`}
                >
                  <span className="line-clamp-2">{topic.name}</span>
                  <span className="absolute bottom-1 right-2 text-xs opacity-75">
                    {topic.difficulty.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-gray-500">Easy</span>
        <div className="flex">
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <div 
              key={n} 
              className="w-8 h-6" 
              style={{ backgroundColor: getDifficultyColor(n) }}
            />
          ))}
        </div>
        <span className="text-sm text-gray-500">Hard</span>
      </div>
    </div>
  );
}

// ============================================================================
// Trends Tab (AC 7)
// ============================================================================

function TrendsTab() {
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrends() {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const res = await fetch('/api/predictor?action=trends', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setTrends(data);
      } catch (error) {
        console.error('Failed to fetch trends:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTrends();
  }, []);

  if (loading) return <div className="text-center py-8">Loading trends...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-6">
          <p className="text-3xl font-bold text-green-600">{trends?.summary?.rising || 0}</p>
          <p className="text-green-700 dark:text-green-400">Rising Topics ↑</p>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6">
          <p className="text-3xl font-bold text-gray-600 dark:text-gray-300">{trends?.summary?.stable || 0}</p>
          <p className="text-gray-500">Stable Topics →</p>
        </div>
        <div className="bg-red-100 dark:bg-red-900/30 rounded-xl p-6">
          <p className="text-3xl font-bold text-red-600">{trends?.summary?.declining || 0}</p>
          <p className="text-red-700 dark:text-red-400">Declining Topics ↓</p>
        </div>
        <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-xl p-6">
          <p className="text-3xl font-bold text-indigo-600">{trends?.summary?.overallTrendPercent || 0}%</p>
          <p className="text-indigo-700 dark:text-indigo-400">Overall Change</p>
        </div>
      </div>

      {/* Rising Topics */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-green-500">↑</span> Rising Topics (Focus Here)
        </h3>
        <div className="space-y-2">
          {trends?.risingTopics?.map((topic: any) => (
            <div key={topic.topicId} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{topic.topicName}</p>
                <p className="text-sm text-gray-500">{topic.subject}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">Difficulty: {topic.difficulty}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Declining Topics */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-red-500">↓</span> Declining Topics (Lower Priority)
        </h3>
        <div className="space-y-2">
          {trends?.decliningTopics?.map((topic: any) => (
            <div key={topic.topicId} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{topic.topicName}</p>
                <p className="text-sm text-gray-500">{topic.subject}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-red-600">Difficulty: {topic.difficulty}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Recommendations Tab (AC 6)
// ============================================================================

function RecommendationsTab() {
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const res = await fetch('/api/predictor?action=recommendations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setRecommendations(data);
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchRecommendations();
  }, []);

  if (loading) return <div className="text-center py-8">Loading recommendations...</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-xl font-bold mb-2">Your Personalized Study Plan</h2>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-3xl font-bold">{recommendations?.totalTopics || 0}</p>
            <p className="text-indigo-200">Topics</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{recommendations?.totalStudyHours || 0}h</p>
            <p className="text-indigo-200">Total Study Time</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{recommendations?.averageHoursPerTopic || 0}h</p>
            <p className="text-indigo-200">Per Topic</p>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">
          Topic-wise Recommendations
        </h3>
        <div className="space-y-3">
          {recommendations?.recommendations?.map((rec: any, index: number) => (
            <div 
              key={rec.topicId} 
              className={`flex items-center gap-4 p-4 rounded-lg border-l-4 ${
                rec.priority === 'HIGH' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                rec.priority === 'MEDIUM' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                'border-gray-300 bg-gray-50 dark:bg-gray-700/50'
              }`}
            >
              <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">
                {(index + 1).toString().padStart(2, '0')}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 dark:text-white">{rec.topicName}</p>
                  {rec.isTrending && <span className="text-orange-500">🔥</span>}
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    rec.priority === 'HIGH' ? 'bg-red-500 text-white' :
                    rec.priority === 'MEDIUM' ? 'bg-yellow-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {rec.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{rec.subject}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-indigo-600">{rec.adjustedHours}h</p>
                <p className="text-xs text-gray-500">
                  Difficulty: {rec.difficulty}/10
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Topic Detail Modal
// ============================================================================

function TopicDetailModal({ topic, onClose }: { topic: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {topic.topic?.name}
              </h2>
              <p className="text-gray-500">{topic.topic?.subject} • {topic.topic?.paper}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              ✕
            </button>
          </div>

          {/* Prediction Stats */}
          {topic.prediction && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard 
                label="Difficulty" 
                value={`${topic.prediction.difficulty_score}/10`}
                color={getDifficultyColor(topic.prediction.difficulty_score)}
              />
              <StatCard 
                label="Weightage" 
                value={`${topic.prediction.weightage_prediction}%`}
              />
              <StatCard 
                label="Confidence" 
                value={`${(topic.prediction.confidence_score * 100).toFixed(0)}%`}
              />
              <StatCard 
                label="Study Time" 
                value={`${topic.prediction.time_recommendation_hours}h`}
              />
            </div>
          )}

          {/* Trend Indicator */}
          {topic.prediction && (
            <div className={`p-4 rounded-lg mb-6 ${
              topic.prediction.trend_direction === 'rising' ? 'bg-green-100 dark:bg-green-900/30' :
              topic.prediction.trend_direction === 'declining' ? 'bg-red-100 dark:bg-red-900/30' :
              'bg-gray-100 dark:bg-gray-700'
            }`}>
              <p className="font-medium">
                {topic.prediction.trend_direction === 'rising' && '📈 Trending Up - Prioritize this topic!'}
                {topic.prediction.trend_direction === 'declining' && '📉 Trending Down - Lower priority'}
                {topic.prediction.trend_direction === 'stable' && '➡️ Stable - Consistent importance'}
              </p>
            </div>
          )}

          {/* PYQ History Chart */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">PYQ History</h3>
            <div className="flex items-end gap-1 h-32 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              {topic.pyqHistory?.slice().reverse().map((year: any) => (
                <div key={year.year} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-indigo-500 rounded-t"
                    style={{ height: `${year.questions * 10}px` }}
                  />
                  <span className="text-xs text-gray-500 mt-1">{year.year.toString().slice(-2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          {topic.recommendation && (
            <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2">
                Study Recommendation
              </h3>
              <p className="text-indigo-700 dark:text-indigo-300 mb-2">
                Allocate <span className="font-bold">{topic.recommendation.studyHours} hours</span> for this topic.
                Priority: <span className="font-bold">{topic.recommendation.priority}</span>
              </p>
              <p className="text-sm text-indigo-600 dark:text-indigo-400">
                Suggested Resources: {topic.recommendation.suggestedResources?.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: color || 'inherit' }}>
        {value}
      </p>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function getDifficultyColor(difficulty: number): string {
  const colors = [
    '#22C55E', // 1 - Green
    '#4ADE80', // 2
    '#86EFAC', // 3
    '#FDE047', // 4 - Yellow
    '#FACC15', // 5
    '#F59E0B', // 6 - Orange
    '#FB923C', // 7
    '#F97316', // 8
    '#EF4444', // 9 - Red
    '#DC2626', // 10
  ];
  const index = Math.max(0, Math.min(9, Math.floor(difficulty) - 1));
  return colors[index];
}
