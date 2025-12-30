'use client';

/**
 * Ethics Roleplay Page - Story 12.1
 * 
 * Interactive branching ethical dilemma scenarios with:
 * - Scenario browser (AC 1, 10)
 * - Decision tree navigation (AC 2, 3)
 * - Framework analysis (AC 4)
 * - Score tracking (AC 5)
 * - Feedback display (AC 6)
 * - Video feedback (AC 7)
 * - Progress dashboard (AC 8)
 * - Admin panel link (AC 9)
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Types
interface Scenario {
  id: string;
  title: string;
  description: string;
  scenario_type: string;
  difficulty: string;
  max_depth: number;
  play_count: number;
  avg_score: number | null;
  is_featured: boolean;
  primary_framework: string;
  tags: string[];
}

interface ScenarioNode {
  id: string;
  node_type: 'root' | 'decision' | 'consequence' | 'ending';
  level: number;
  title: string;
  narrative: string;
  ending_type?: 'best' | 'good' | 'neutral' | 'bad' | 'worst';
}

interface Choice {
  id: string;
  choice_text: string;
  choice_label: string;
  has_next: boolean;
  hint_text?: string;
}

interface Session {
  id: string;
  scenario_id: string;
  current_node_id: string;
  path_taken: string[];
  choices_made: string[];
  cumulative_score: number;
  framework_scores: Record<string, number>;
  status: 'in_progress' | 'completed' | 'abandoned';
}

interface Progress {
  scenarios_completed: number;
  scenarios_attempted: number;
  overall_ethics_score: number;
  best_ethics_score: number;
  framework_proficiency: Record<string, number>;
  type_proficiency: Record<string, number>;
  perfect_scores: number;
  best_endings_reached: number;
}

interface Feedback {
  immediate: string;
  detailed: string;
  ethical_analysis: string;
  framework_breakdown: Record<string, any>;
  overall_ethical_score: number;
  score_interpretation: string;
}

// AC 1: Scenario types with icons
const SCENARIO_TYPES = {
  governance: { icon: '🏛️', label: 'Governance', color: 'bg-blue-500' },
  social: { icon: '👥', label: 'Social', color: 'bg-green-500' },
  professional: { icon: '💼', label: 'Professional', color: 'bg-purple-500' },
  environmental: { icon: '🌍', label: 'Environmental', color: 'bg-emerald-500' },
  personal: { icon: '🧠', label: 'Personal', color: 'bg-yellow-500' },
  legal: { icon: '⚖️', label: 'Legal', color: 'bg-red-500' },
  administrative: { icon: '📋', label: 'Administrative', color: 'bg-gray-500' },
  crisis: { icon: '🚨', label: 'Crisis', color: 'bg-orange-500' }
};

// AC 4: Ethical frameworks
const FRAMEWORKS = {
  utilitarian: { name: 'Utilitarian', icon: '⚖️', color: 'text-blue-600' },
  deontological: { name: 'Deontological', icon: '📜', color: 'text-purple-600' },
  virtue: { name: 'Virtue Ethics', icon: '🌟', color: 'text-yellow-600' },
  justice: { name: 'Justice', icon: '🔨', color: 'text-red-600' }
};

// Difficulty badges
const DIFFICULTY = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-800' }
};

export default function EthicsRoleplayPage() {
  const router = useRouter();
  
  // View state
  const [view, setView] = useState<'browse' | 'play' | 'result' | 'progress'>('browse');
  
  // Data state
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [currentNode, setCurrentNode] = useState<ScenarioNode | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [resultAnalysis, setResultAnalysis] = useState<any>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [processingChoice, setProcessingChoice] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // Mock user ID (in production, from auth)
  const userId = 'user-123';

  // Fetch scenarios (AC 10)
  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'list' });
      if (selectedType) params.append('type', selectedType);
      if (selectedDifficulty) params.append('difficulty', selectedDifficulty);
      
      const res = await fetch(`/api/ethics-roleplay?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedDifficulty]);

  // Fetch user progress (AC 8)
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/ethics-roleplay?action=progress&userId=${userId}`);
      const data = await res.json();
      
      if (data.success && data.progress) {
        setProgress(data.progress);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchScenarios();
    fetchProgress();
  }, [fetchScenarios, fetchProgress]);

  // Start scenario session
  const startScenario = async (scenario: Scenario) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ethics-roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-session',
          userId,
          scenarioId: scenario.id
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSession({ 
          id: data.sessionId, 
          scenario_id: scenario.id,
          current_node_id: data.scenario.root_node?.id,
          path_taken: [data.scenario.root_node?.id],
          choices_made: [],
          cumulative_score: 0,
          framework_scores: { utilitarian: 0, deontological: 0, virtue: 0, justice: 0 },
          status: 'in_progress'
        });
        setCurrentScenario(data.scenario.scenario);
        setCurrentNode(data.scenario.root_node);
        setChoices(data.scenario.choices || []);
        setView('play');
        setFeedback(null);
        setShowFeedback(false);
      }
    } catch (error) {
      console.error('Error starting scenario:', error);
    } finally {
      setLoading(false);
    }
  };

  // Make choice (AC 2, 5, 6)
  const makeChoice = async (choiceId: string) => {
    if (!session || processingChoice) return;
    
    setProcessingChoice(true);
    setShowHint(false);
    
    try {
      const res = await fetch('/api/ethics-roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'make-choice',
          sessionId: session.id,
          choiceId
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update session score
        setSession(prev => prev ? {
          ...prev,
          cumulative_score: data.result.new_cumulative_score,
          choices_made: [...prev.choices_made, choiceId],
          status: data.result.is_ending ? 'completed' : 'in_progress'
        } : null);
        
        // Show feedback (AC 6)
        if (data.result.detailed_feedback) {
          setFeedback(data.result.detailed_feedback);
          setShowFeedback(true);
        }
        
        // If ending, show result
        if (data.result.is_ending) {
          await loadResult();
        } else if (data.nextNode) {
          // Move to next node
          setCurrentNode(data.nextNode.node);
          setChoices(data.nextNode.choices || []);
        }
      }
    } catch (error) {
      console.error('Error making choice:', error);
    } finally {
      setProcessingChoice(false);
    }
  };

  // Load session result (AC 5, 8)
  const loadResult = async () => {
    if (!session) return;
    
    try {
      const res = await fetch('/api/ethics-roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-result',
          sessionId: session.id
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResultAnalysis(data.analysis);
        setView('result');
        fetchProgress(); // Refresh progress
      }
    } catch (error) {
      console.error('Error loading result:', error);
    }
  };

  // Request video feedback (AC 7)
  const requestVideoFeedback = async () => {
    if (!session || !currentScenario) return;
    
    try {
      const res = await fetch('/api/ethics-roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-video-feedback',
          sessionId: session.id,
          scenarioId: currentScenario.id,
          pathType: 'best'
        })
      });
      
      const data = await res.json();
      
      if (data.success && data.video?.video_url) {
        setVideoUrl(data.video.video_url);
      }
    } catch (error) {
      console.error('Error requesting video:', error);
    }
  };

  // Continue after feedback
  const continueAfterFeedback = () => {
    setShowFeedback(false);
  };

  // Render scenario browser (AC 1, 10)
  const renderBrowser = () => (
    <div className="space-y-6">
      {/* Header with progress summary */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ethics Roleplay</h1>
          <p className="text-gray-600 mt-1">
            Practice ethical decision-making with branching scenarios
          </p>
        </div>
        
        {progress && (
          <button
            onClick={() => setView('progress')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            View Progress ({progress.scenarios_completed} completed)
          </button>
        )}
      </div>

      {/* Filters (AC 1) */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scenario Type
          </label>
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            {Object.entries(SCENARIO_TYPES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Difficulty
          </label>
          <select
            value={selectedDifficulty || ''}
            onChange={(e) => setSelectedDifficulty(e.target.value || null)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Scenario grid (AC 10) */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No scenarios found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => {
            const typeInfo = SCENARIO_TYPES[scenario.scenario_type as keyof typeof SCENARIO_TYPES];
            const diffInfo = DIFFICULTY[scenario.difficulty as keyof typeof DIFFICULTY];
            
            return (
              <div
                key={scenario.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Type badge */}
                <div className={`h-2 ${typeInfo?.color || 'bg-gray-400'}`} />
                
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{typeInfo?.icon || '📋'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${diffInfo?.color || 'bg-gray-100'}`}>
                        {diffInfo?.label || scenario.difficulty}
                      </span>
                    </div>
                    {scenario.is_featured && (
                      <span className="text-yellow-500">⭐</span>
                    )}
                  </div>
                  
                  {/* Title & description */}
                  <h3 className="font-semibold text-gray-900 mb-2">{scenario.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                    {scenario.description}
                  </p>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span>📊 {scenario.play_count} plays</span>
                    <span>🎯 Depth: {scenario.max_depth}</span>
                    {scenario.avg_score && (
                      <span>⭐ Avg: {scenario.avg_score.toFixed(0)}%</span>
                    )}
                  </div>
                  
                  {/* Primary framework */}
                  {scenario.primary_framework && (
                    <div className="text-xs text-gray-500 mb-4">
                      Primary: {FRAMEWORKS[scenario.primary_framework as keyof typeof FRAMEWORKS]?.name || scenario.primary_framework}
                    </div>
                  )}
                  
                  {/* Start button */}
                  <button
                    onClick={() => startScenario(scenario)}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    Start Scenario
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Render play view (AC 2, 3, 4, 5, 6)
  const renderPlay = () => (
    <div className="max-w-4xl mx-auto">
      {/* Progress bar */}
      {currentNode && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Level {currentNode.level + 1}</span>
            <span>Score: {session?.cumulative_score || 0}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${((currentNode.level + 1) / (currentScenario?.max_depth || 3)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Framework scores (AC 4) */}
      {session && (
        <div className="grid grid-cols-4 gap-2 mb-6">
          {Object.entries(FRAMEWORKS).map(([key, { name, icon, color }]) => (
            <div key={key} className="text-center p-2 bg-gray-50 rounded-lg">
              <span className="text-lg">{icon}</span>
              <p className={`text-xs font-medium ${color}`}>{name}</p>
              <p className="text-sm font-bold">
                {session.framework_scores[key] || 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Scenario content */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        {currentNode ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{currentNode.title}</h2>
            <div className="prose prose-sm max-w-none text-gray-700 mb-6">
              <p>{currentNode.narrative}</p>
            </div>
            
            {/* Ending display */}
            {currentNode.node_type === 'ending' && (
              <div className={`p-4 rounded-lg mb-6 ${
                currentNode.ending_type === 'best' ? 'bg-green-50 border-green-200' :
                currentNode.ending_type === 'good' ? 'bg-blue-50 border-blue-200' :
                currentNode.ending_type === 'neutral' ? 'bg-gray-50 border-gray-200' :
                currentNode.ending_type === 'bad' ? 'bg-orange-50 border-orange-200' :
                'bg-red-50 border-red-200'
              } border-2`}>
                <p className="font-semibold">
                  {currentNode.ending_type === 'best' && '🏆 Best Outcome Achieved!'}
                  {currentNode.ending_type === 'good' && '✅ Good Outcome'}
                  {currentNode.ending_type === 'neutral' && '⚖️ Neutral Outcome'}
                  {currentNode.ending_type === 'bad' && '⚠️ Poor Outcome'}
                  {currentNode.ending_type === 'worst' && '❌ Worst Outcome'}
                </p>
              </div>
            )}
            
            {/* Choices (AC 2) */}
            {choices.length > 0 && !showFeedback && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-700">What do you do?</h3>
                {choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => makeChoice(choice.id)}
                    disabled={processingChoice}
                    className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <span className="font-medium text-indigo-600 mr-2">
                      {choice.choice_label || '○'}
                    </span>
                    {choice.choice_text}
                  </button>
                ))}
                
                {/* Hint button */}
                {choices.some(c => c.hint_text) && (
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {showHint ? 'Hide hint' : '💡 Show hint'}
                  </button>
                )}
                
                {showHint && (
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                    {choices.find(c => c.hint_text)?.hint_text}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        )}
      </div>

      {/* Feedback modal (AC 6) */}
      {showFeedback && feedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold mb-4">Choice Analysis</h3>
            
            {/* Score change */}
            <div className={`text-center p-4 rounded-lg mb-4 ${
              feedback.overall_ethical_score >= 5 ? 'bg-green-50' :
              feedback.overall_ethical_score >= 0 ? 'bg-yellow-50' : 'bg-red-50'
            }`}>
              <p className="text-2xl font-bold">
                {feedback.overall_ethical_score > 0 ? '+' : ''}{feedback.overall_ethical_score}
              </p>
              <p className="text-sm text-gray-600">{feedback.score_interpretation}</p>
            </div>
            
            {/* Immediate feedback */}
            {feedback.immediate && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-1">Immediate Impact</h4>
                <p className="text-gray-600">{feedback.immediate}</p>
              </div>
            )}
            
            {/* Framework breakdown (AC 4) */}
            {feedback.framework_breakdown && Object.keys(feedback.framework_breakdown).length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Framework Analysis</h4>
                <div className="space-y-2">
                  {Object.entries(feedback.framework_breakdown).map(([key, data]: [string, any]) => (
                    <div key={key} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{data.name}</span>
                        <span className={`text-sm ${
                          data.score >= 7 ? 'text-green-600' :
                          data.score >= 4 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {data.alignment}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{data.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Ethical analysis */}
            {feedback.ethical_analysis && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-1">Ethical Analysis</h4>
                <p className="text-gray-600 text-sm">{feedback.ethical_analysis}</p>
              </div>
            )}
            
            <button
              onClick={continueAfterFeedback}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => {
            setView('browse');
            setSession(null);
            setCurrentScenario(null);
            setCurrentNode(null);
          }}
          className="text-gray-600 hover:text-gray-900"
        >
          ← Exit Scenario
        </button>
      </div>
    </div>
  );

  // Render result view (AC 5, 7, 8)
  const renderResult = () => (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6">Scenario Complete</h2>
        
        {resultAnalysis && (
          <>
            {/* Overall performance */}
            <div className={`text-center p-6 rounded-xl mb-6 ${
              resultAnalysis.percentage_score >= 75 ? 'bg-green-50' :
              resultAnalysis.percentage_score >= 50 ? 'bg-yellow-50' : 'bg-red-50'
            }`}>
              <p className="text-4xl font-bold mb-2">
                {resultAnalysis.percentage_score?.toFixed(0)}%
              </p>
              <p className="text-lg font-medium">{resultAnalysis.overall_performance}</p>
              <p className="text-sm text-gray-600 mt-1">{resultAnalysis.ending_quality}</p>
            </div>
            
            {/* Framework breakdown (AC 4) */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Framework Analysis</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(resultAnalysis.framework_breakdown || {}).map(([key, value]) => {
                  const fw = FRAMEWORKS[key as keyof typeof FRAMEWORKS];
                  return (
                    <div key={key} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{fw?.icon}</span>
                        <span className={`font-medium ${fw?.color}`}>{fw?.name}</span>
                      </div>
                      <p className="text-xl font-bold">{value as number}</p>
                    </div>
                  );
                })}
              </div>
              
              <p className="text-sm text-gray-600 mt-2">
                Dominant approach: <span className="font-medium capitalize">
                  {resultAnalysis.dominant_framework}
                </span>
              </p>
            </div>
            
            {/* Strengths */}
            {resultAnalysis.strengths?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2 text-green-700">✓ Strengths</h3>
                <ul className="space-y-1">
                  {resultAnalysis.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Areas for growth */}
            {resultAnalysis.areas_for_growth?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2 text-blue-700">📈 Areas for Growth</h3>
                <ul className="space-y-1">
                  {resultAnalysis.areas_for_growth.map((a: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700">• {a}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Improvement suggestions */}
            {resultAnalysis.improvement_suggestions?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">💡 Suggestions</h3>
                <ul className="space-y-2">
                  {resultAnalysis.improvement_suggestions.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Time analysis */}
            {resultAnalysis.time_analysis && (
              <div className="text-center text-sm text-gray-500 mb-6">
                Time: {resultAnalysis.time_analysis.total_minutes} min • 
                {' '}{resultAnalysis.time_analysis.pace}
              </div>
            )}
          </>
        )}
        
        {/* Video feedback button (AC 7) */}
        <div className="flex flex-col gap-3">
          {!videoUrl ? (
            <button
              onClick={requestVideoFeedback}
              className="py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              🎬 Watch Best Path Video
            </button>
          ) : (
            <video 
              src={videoUrl} 
              controls 
              className="w-full rounded-lg"
            />
          )}
          
          <button
            onClick={() => setView('browse')}
            className="py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Try Another Scenario
          </button>
          
          <button
            onClick={() => setView('progress')}
            className="py-2 text-indigo-600 hover:text-indigo-800"
          >
            View Overall Progress
          </button>
        </div>
      </div>
    </div>
  );

  // Render progress view (AC 8)
  const renderProgress = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Ethics Progress</h1>
        <button
          onClick={() => setView('browse')}
          className="text-indigo-600 hover:text-indigo-800"
        >
          ← Back to Scenarios
        </button>
      </div>
      
      {progress ? (
        <div className="space-y-6">
          {/* Overall stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-3xl font-bold text-indigo-600">
                {progress.scenarios_completed}
              </p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-3xl font-bold text-green-600">
                {progress.overall_ethics_score?.toFixed(0)}%
              </p>
              <p className="text-sm text-gray-600">Overall Score</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-3xl font-bold text-purple-600">
                {progress.best_ethics_score?.toFixed(0)}%
              </p>
              <p className="text-sm text-gray-600">Best Score</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-3xl font-bold text-yellow-600">
                {progress.perfect_scores}
              </p>
              <p className="text-sm text-gray-600">Perfect Scores</p>
            </div>
          </div>
          
          {/* Framework proficiency (AC 4) */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Framework Proficiency</h2>
            <div className="space-y-3">
              {Object.entries(FRAMEWORKS).map(([key, { name, icon, color }]) => {
                const score = progress.framework_proficiency?.[key] || 50;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={color}>
                        {icon} {name}
                      </span>
                      <span>{score}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Type proficiency (AC 1) */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Scenario Type Proficiency</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(SCENARIO_TYPES).slice(0, 4).map(([key, { icon, label }]) => {
                const score = progress.type_proficiency?.[key] || 50;
                return (
                  <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-2xl">{icon}</span>
                    <p className="text-sm font-medium mt-1">{label}</p>
                    <p className="text-lg font-bold text-indigo-600">{score}%</p>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Achievements */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Achievements</h2>
            <div className="flex flex-wrap gap-3">
              {progress.scenarios_completed >= 1 && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  🎯 First Scenario
                </span>
              )}
              {progress.scenarios_completed >= 10 && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  📚 Ethics Scholar
                </span>
              )}
              {progress.perfect_scores >= 1 && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                  ⭐ Perfect Ethics
                </span>
              )}
              {progress.best_endings_reached >= 5 && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  🏆 Optimal Path Finder
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No progress data yet. Complete a scenario to start tracking!</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {view === 'browse' && renderBrowser()}
        {view === 'play' && renderPlay()}
        {view === 'result' && renderResult()}
        {view === 'progress' && renderProgress()}
      </div>
    </div>
  );
}
