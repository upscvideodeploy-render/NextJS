'use client';

/**
 * Ethics Simulator Page - Story 12.2
 * 
 * Multi-stage ethical simulation with:
 * - Scenario browser by difficulty (AC 8)
 * - Multi-stage flow (AC 1)
 * - Personality analysis (AC 2)
 * - Dimension scoring (AC 3)
 * - Report card (AC 4)
 * - Improvement suggestions (AC 5)
 * - Interview questions (AC 6)
 * - Peer comparison (AC 7)
 * - Video summary (AC 9)
 * - Retry option (AC 10)
 */

import { useState, useEffect, useCallback } from 'react';

// Types
interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  role_title: string;
  role_description: string;
  total_stages: number;
  time_limit_minutes: number;
  is_featured: boolean;
  attempts_count: number;
  avg_score: number | null;
}

interface Stage {
  id: string;
  stage_number: number;
  stage_type: 'decision' | 'consequence' | 'adjustment' | 'final';
  title: string;
  narrative: string;
  instructions: string;
  prompts: Array<{
    id: string;
    type: 'essay' | 'choice' | 'ranking';
    question: string;
    min_words?: number;
    options?: string[];
  }>;
  time_limit_minutes: number;
}

interface Session {
  id: string;
  current_stage_number: number;
  status: string;
  dimension_scores: Record<string, number>;
  ethical_tendency: Record<string, number>;
  total_score: number;
}

interface Profile {
  ethical_tendency: Record<string, number>;
  dimension_proficiency: Record<string, number>;
  primary_tendency: string;
  secondary_tendency: string;
  simulations_completed: number;
  average_score: number;
  best_score: number;
  global_percentile: number;
  profile_video_url: string | null;
}

interface ReportCard {
  overall_grade: string;
  percentage_score: number;
  dimension_analysis: Record<string, any>;
  ethical_profile_summary: string;
  key_strengths: string[];
  areas_for_improvement: string[];
  recommended_resources: any[];
  interview_questions: any[];
  ai_narrative: string;
  percentile_rank: number;
}

// AC 8: Difficulty levels
const DIFFICULTY_LEVELS = {
  easy: { label: 'Student', icon: '🎓', color: 'bg-green-500', description: 'College-level decisions' },
  medium: { label: 'Bureaucrat', icon: '🏛️', color: 'bg-yellow-500', description: 'IAS/IPS administrative decisions' },
  hard: { label: 'Minister', icon: '⚖️', color: 'bg-red-500', description: 'Cabinet-level policy decisions' }
};

// AC 2: Ethical tendencies
const ETHICAL_TENDENCIES = {
  utilitarian: { name: 'Utilitarian', icon: '📊', color: 'text-blue-600' },
  deontological: { name: 'Deontological', icon: '📜', color: 'text-purple-600' },
  virtue: { name: 'Virtue Ethics', icon: '🌟', color: 'text-yellow-600' },
  care: { name: 'Care Ethics', icon: '❤️', color: 'text-pink-600' },
  justice: { name: 'Justice', icon: '⚖️', color: 'text-red-600' }
};

// AC 3: Scoring dimensions
const SCORING_DIMENSIONS = {
  decision_quality: { name: 'Decision Quality', icon: '🎯' },
  reasoning_depth: { name: 'Reasoning Depth', icon: '🧠' },
  stakeholder_consideration: { name: 'Stakeholder Consideration', icon: '👥' },
  practical_implementation: { name: 'Practical Implementation', icon: '⚙️' }
};

export default function EthicsSimulatorPage() {
  // View state
  const [view, setView] = useState<'browse' | 'simulate' | 'report' | 'profile'>('browse');
  
  // Data state
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [peerComparison, setPeerComparison] = useState<any>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showInterview, setShowInterview] = useState(false);
  
  // Mock user ID
  const userId = 'user-123';

  // Fetch scenarios
  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'list' });
      if (selectedDifficulty) params.append('difficulty', selectedDifficulty);
      
      const res = await fetch(`/api/ethics-simulator?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDifficulty]);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/ethics-simulator?action=profile&userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchScenarios();
    fetchProfile();
  }, [fetchScenarios, fetchProfile]);

  // Start simulation
  const startSimulation = async (scenario: Scenario) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ethics-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          userId,
          scenarioId: scenario.id
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSession({
          id: data.sessionId,
          current_stage_number: 1,
          status: 'in_progress',
          dimension_scores: { decision_quality: 0, reasoning_depth: 0, stakeholder_consideration: 0, practical_implementation: 0 },
          ethical_tendency: { utilitarian: 0, deontological: 0, virtue: 0, care: 0, justice: 0 },
          total_score: 0
        });
        setCurrentScenario(data.scenario);
        setCurrentStage(data.currentStage);
        setTimeRemaining((data.currentStage?.time_limit_minutes || 10) * 60);
        setView('simulate');
        setResponseText('');
        setEvaluation(null);
      }
    } catch (error) {
      console.error('Error starting simulation:', error);
    } finally {
      setLoading(false);
    }
  };

  // Submit response (AC 1, 3)
  const submitResponse = async () => {
    if (!session || !currentStage || submitting) return;
    if (responseText.trim().length < 50) {
      alert('Please provide a more detailed response (at least 50 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/ethics-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-response',
          sessionId: session.id,
          stageId: currentStage.id,
          responseText,
          timeSpent: (currentStage.time_limit_minutes * 60) - timeRemaining
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setEvaluation(data.evaluation);
        
        if (data.isComplete) {
          // Complete simulation
          await completeSimulation();
        } else {
          // Move to next stage
          setCurrentStage(data.nextStage);
          setResponseText('');
          setTimeRemaining((data.nextStage?.time_limit_minutes || 10) * 60);
          setSession(prev => prev ? {
            ...prev,
            current_stage_number: data.nextStage?.stage_number || prev.current_stage_number + 1
          } : null);
        }
      }
    } catch (error) {
      console.error('Error submitting response:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Complete simulation (AC 4, 5, 6, 7)
  const completeSimulation = async () => {
    if (!session) return;

    try {
      const res = await fetch('/api/ethics-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          sessionId: session.id
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setReportCard({
          overall_grade: getGrade(data.totalScore),
          percentage_score: data.totalScore,
          dimension_analysis: data.reportContent.dimensionAnalysis,
          ethical_profile_summary: data.reportContent.ethicalProfileSummary,
          key_strengths: data.reportContent.strengths,
          areas_for_improvement: data.reportContent.improvements,
          recommended_resources: data.reportContent.resources,
          interview_questions: data.reportContent.interviewQuestions,
          ai_narrative: data.reportContent.narrative,
          percentile_rank: data.peerComparison?.better_than_percent || 50
        });
        setPeerComparison(data.peerComparison);
        setView('report');
        fetchProfile();
      }
    } catch (error) {
      console.error('Error completing simulation:', error);
    }
  };

  // Retry simulation (AC 10)
  const retrySimulation = async () => {
    if (!session || !currentScenario) return;

    try {
      const res = await fetch('/api/ethics-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'retry',
          sessionId: session.id,
          userId
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Restart with new session
        await startSimulation(currentScenario);
      }
    } catch (error) {
      console.error('Error retrying simulation:', error);
    }
  };

  // Request video summary (AC 9)
  const requestVideoSummary = async () => {
    try {
      const res = await fetch('/api/ethics-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-video',
          userId,
          sessionId: session?.id
        })
      });
      
      const data = await res.json();
      alert(data.success ? 'Video generation started! Check back soon.' : 'Video request failed.');
    } catch (error) {
      console.error('Error requesting video:', error);
    }
  };

  const getGrade = (score: number): string => {
    if (score >= 95) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B+';
    if (score >= 65) return 'B';
    if (score >= 55) return 'C+';
    if (score >= 45) return 'C';
    if (score >= 35) return 'D';
    return 'F';
  };

  // Timer effect
  useEffect(() => {
    if (view !== 'simulate' || timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [view, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render browse view (AC 8)
  const renderBrowse = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ethics Simulator</h1>
          <p className="text-gray-600 mt-1">
            Multi-stage ethical simulations with personality analysis
          </p>
        </div>
        
        {profile && (
          <button
            onClick={() => setView('profile')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            View Profile ({profile.simulations_completed} completed)
          </button>
        )}
      </div>

      {/* Difficulty filter (AC 8) */}
      <div className="flex gap-4">
        <button
          onClick={() => setSelectedDifficulty(null)}
          className={`px-4 py-2 rounded-lg ${!selectedDifficulty ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
        >
          All Levels
        </button>
        {Object.entries(DIFFICULTY_LEVELS).map(([key, { label, icon }]) => (
          <button
            key={key}
            onClick={() => setSelectedDifficulty(key)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              selectedDifficulty === key ? 'bg-indigo-600 text-white' : 'bg-gray-100'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Scenario grid */}
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
            const diffInfo = DIFFICULTY_LEVELS[scenario.difficulty_level];
            return (
              <div
                key={scenario.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className={`h-2 ${diffInfo?.color}`} />
                <div className="p-5">
                  {/* Role badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{diffInfo?.icon}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded-full text-sm font-medium">
                      {scenario.role_title}
                    </span>
                    {scenario.is_featured && <span className="text-yellow-500">⭐</span>}
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-2">{scenario.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                    {scenario.description}
                  </p>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span>📊 {scenario.attempts_count} attempts</span>
                    <span>⏱️ {scenario.time_limit_minutes} min</span>
                    <span>📝 {scenario.total_stages} stages</span>
                  </div>
                  
                  <button
                    onClick={() => startSimulation(scenario)}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    Start Simulation
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Render simulate view (AC 1, 3)
  const renderSimulate = () => (
    <div className="max-w-4xl mx-auto">
      {/* Header with timer */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">{currentScenario?.title}</h2>
          <p className="text-gray-600">Stage {session?.current_stage_number} of {currentScenario?.total_stages}</p>
        </div>
        <div className={`text-2xl font-mono ${timeRemaining < 60 ? 'text-red-600' : 'text-gray-700'}`}>
          ⏱️ {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all"
          style={{ width: `${((session?.current_stage_number || 1) / (currentScenario?.total_stages || 1)) * 100}%` }}
        />
      </div>

      {/* Stage content */}
      {currentStage && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentStage.stage_type === 'decision' ? 'bg-blue-100 text-blue-800' :
              currentStage.stage_type === 'consequence' ? 'bg-orange-100 text-orange-800' :
              currentStage.stage_type === 'adjustment' ? 'bg-purple-100 text-purple-800' :
              'bg-green-100 text-green-800'
            }`}>
              {currentStage.stage_type.charAt(0).toUpperCase() + currentStage.stage_type.slice(1)} Stage
            </span>
          </div>

          <h3 className="text-lg font-semibold mb-3">{currentStage.title}</h3>
          <div className="prose prose-sm max-w-none text-gray-700 mb-6">
            <p>{currentStage.narrative}</p>
          </div>

          {currentStage.instructions && (
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-blue-800">{currentStage.instructions}</p>
            </div>
          )}

          {/* Response area */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Your Response
            </label>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Provide your detailed response here..."
              className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {responseText.length} characters
              </span>
              <button
                onClick={submitResponse}
                disabled={submitting || responseText.length < 50}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
              >
                {submitting ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation feedback */}
      {evaluation && (
        <div className="bg-green-50 rounded-xl p-6 mb-6">
          <h4 className="font-semibold mb-3">Stage Feedback</h4>
          <p className="text-sm text-gray-700 mb-4">{evaluation.feedback}</p>
          
          {/* Dimension scores (AC 3) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(SCORING_DIMENSIONS).map(([key, { name, icon }]) => (
              <div key={key} className="text-center p-2 bg-white rounded-lg">
                <span className="text-lg">{icon}</span>
                <p className="text-xs text-gray-600">{name}</p>
                <p className="font-bold text-indigo-600">
                  {evaluation.dimensionScores?.[key] || 0}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exit button */}
      <button
        onClick={() => {
          if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
            setView('browse');
            setSession(null);
          }
        }}
        className="text-gray-600 hover:text-gray-900"
      >
        ← Exit Simulation
      </button>
    </div>
  );

  // Render report view (AC 4, 5, 6, 7)
  const renderReport = () => (
    <div className="max-w-4xl mx-auto">
      {reportCard && (
        <div className="space-y-6">
          {/* Overall result */}
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Simulation Complete!</h2>
            
            <div className={`inline-block px-8 py-4 rounded-2xl mb-4 ${
              reportCard.percentage_score >= 75 ? 'bg-green-100' :
              reportCard.percentage_score >= 50 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              <p className="text-5xl font-bold">{reportCard.overall_grade}</p>
              <p className="text-xl text-gray-600">{reportCard.percentage_score.toFixed(0)}%</p>
            </div>

            {/* Peer comparison (AC 7) */}
            {peerComparison && (
              <p className="text-gray-600">
                You scored better than <span className="font-bold text-indigo-600">
                  {peerComparison.better_than_percent?.toFixed(0)}%
                </span> of participants
              </p>
            )}
          </div>

          {/* Dimension breakdown (AC 3) */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold mb-4">Dimension Analysis</h3>
            <div className="space-y-4">
              {Object.entries(SCORING_DIMENSIONS).map(([key, { name, icon }]) => {
                const analysis = reportCard.dimension_analysis?.[key];
                const score = analysis?.score || 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="flex items-center gap-2">
                        <span>{icon}</span> {name}
                      </span>
                      <span className="font-medium">{score}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    {analysis?.feedback && (
                      <p className="text-sm text-gray-600 mt-1">{analysis.feedback}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ethical profile (AC 2) */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold mb-4">Ethical Profile</h3>
            <p className="text-gray-700 mb-4">{reportCard.ethical_profile_summary}</p>
            
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(ETHICAL_TENDENCIES).map(([key, { name, icon, color }]) => (
                <div key={key} className="text-center p-2 bg-gray-50 rounded-lg">
                  <span className="text-xl">{icon}</span>
                  <p className={`text-xs font-medium ${color}`}>{name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths and improvements (AC 4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold mb-3 text-green-700">✓ Key Strengths</h3>
              <ul className="space-y-2">
                {reportCard.key_strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700">• {s}</li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold mb-3 text-blue-700">📈 Areas for Improvement</h3>
              <ul className="space-y-2">
                {reportCard.areas_for_improvement.map((a, i) => (
                  <li key={i} className="text-sm text-gray-700">• {a}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Resources (AC 5) */}
          {reportCard.recommended_resources.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold mb-4">📚 Recommended Resources</h3>
              <div className="space-y-3">
                {reportCard.recommended_resources.map((r: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-sm text-gray-600">{r.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interview questions (AC 6) */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">🎤 Interview Prep Questions</h3>
              <button
                onClick={() => setShowInterview(!showInterview)}
                className="text-indigo-600 text-sm"
              >
                {showInterview ? 'Hide' : 'Show'} Questions
              </button>
            </div>
            
            {showInterview && (
              <div className="space-y-4">
                {reportCard.interview_questions.map((q: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium mb-2">{q.question}</p>
                    {q.suggested_approach && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Approach:</span> {q.suggested_approach}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions (AC 9, 10) */}
          <div className="flex flex-col gap-3">
            <button
              onClick={requestVideoSummary}
              className="py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              🎬 Generate Video Summary
            </button>
            
            <button
              onClick={retrySimulation}
              className="py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              🔄 Retry with Different Context
            </button>
            
            <button
              onClick={() => setView('browse')}
              className="py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              ← Back to Scenarios
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Render profile view (AC 2, 4)
  const renderProfile = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Ethics Profile</h1>
        <button
          onClick={() => setView('browse')}
          className="text-indigo-600 hover:text-indigo-800"
        >
          ← Back to Simulations
        </button>
      </div>

      {profile ? (
        <div className="space-y-6">
          {/* Stats overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-3xl font-bold text-indigo-600">{profile.simulations_completed}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-3xl font-bold text-green-600">{profile.average_score?.toFixed(0)}%</p>
              <p className="text-sm text-gray-600">Average Score</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-3xl font-bold text-purple-600">{profile.best_score?.toFixed(0)}%</p>
              <p className="text-sm text-gray-600">Best Score</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-3xl font-bold text-yellow-600">Top {(100 - profile.global_percentile)?.toFixed(0)}%</p>
              <p className="text-sm text-gray-600">Global Rank</p>
            </div>
          </div>

          {/* Primary tendency */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Your Ethical Style</h2>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">
                {ETHICAL_TENDENCIES[profile.primary_tendency as keyof typeof ETHICAL_TENDENCIES]?.icon || '🧠'}
              </span>
              <div>
                <p className="text-xl font-bold capitalize">{profile.primary_tendency} Ethics</p>
                <p className="text-gray-600">
                  Secondary: <span className="capitalize">{profile.secondary_tendency}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Dimension proficiency */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Dimension Proficiency</h2>
            <div className="space-y-3">
              {Object.entries(SCORING_DIMENSIONS).map(([key, { name, icon }]) => {
                const score = profile.dimension_proficiency?.[key] || 50;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{icon} {name}</span>
                      <span>{score}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Video profile (AC 9) */}
          {profile.profile_video_url ? (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">🎬 Your Profile Video</h2>
              <video src={profile.profile_video_url} controls className="w-full rounded-lg" />
            </div>
          ) : (
            <button
              onClick={requestVideoSummary}
              className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              🎬 Generate Profile Video
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">Complete a simulation to build your profile!</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {view === 'browse' && renderBrowse()}
        {view === 'simulate' && renderSimulate()}
        {view === 'report' && renderReport()}
        {view === 'profile' && renderProfile()}
      </div>
    </div>
  );
}
