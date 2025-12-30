'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Case {
  id: string;
  title: string;
  scenario: string;
  background: string;
  stakeholders: { name: string; perspective: string }[];
  discussion_questions: string[];
  eval_criteria: { criterion: string; weight: number; description: string }[];
  difficulty: string;
  gs_paper: string;
  tags: string[];
  avg_score?: number;
}

interface Attempt {
  id: string;
  case_id: string;
  is_completed: boolean;
  ai_evaluation: any;
  created_at: string;
  ethics_case_studies: Case;
}

export default function EthicsCasesPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [cases, setCases] = useState<Case[]>([]);
  const [myAttempts, setMyAttempts] = useState<Attempt[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'browse' | 'practice' | 'history'>('browse');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [generatingCase, setGeneratingCase] = useState(false);

  // Form state
  const [analysis, setAnalysis] = useState({
    stakeholder_views: '',
    core_issue: '',
    resolution: '',
    principles_applied: [] as string[],
  });
  const [confidence, setConfidence] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/interview_studio?action=list';
      if (difficultyFilter) url += `&difficulty=${difficultyFilter}`;

      // Use ethics pipe directly
      const { data } = await supabase.functions.invoke('ethics_case_study_pipe', {
        body: { action: 'list', difficulty: difficultyFilter },
      });

      if (data?.success) {
        setCases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, difficultyFilter]);

  const fetchMyAttempts = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('ethics_case_study_pipe', {
        body: { action: 'my_attempts' },
      });

      if (data?.success) {
        setMyAttempts(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching attempts:', err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCases();
    fetchMyAttempts();
  }, [fetchCases, fetchMyAttempts]);

  const handleSelectCase = async (caseItem: Case) => {
    setSelectedCase(caseItem);
    setViewMode('practice');
    setAnalysis({
      stakeholder_views: '',
      core_issue: '',
      resolution: '',
      principles_applied: [],
    });
    setConfidence(50);

    // Start attempt
    try {
      const { data } = await supabase.functions.invoke('ethics_case_study_pipe', {
        body: { action: 'create', case_id: caseItem.id },
      });

      if (data?.success) {
        setCurrentAttempt(data.data);
      }
    } catch (err) {
      console.error('Error starting attempt:', err);
    }
  };

  const handleSubmitAnalysis = async () => {
    if (!currentAttempt || !selectedCase) return;

    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke('ethics_case_study_pipe', {
        body: {
          action: 'submit',
          case_id: selectedCase.id,
          attempt_id: currentAttempt.attempt_id,
          analysis,
          self_assessment: { confidence, time_taken: 0 },
        },
      });

      if (data?.success) {
        setCurrentAttempt({ ...currentAttempt, evaluation: data.data.evaluation });
        fetchMyAttempts();
      }
    } catch (err) {
      console.error('Error submitting analysis:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateCase = async (topic?: string) => {
    setGeneratingCase(true);
    try {
      const { data } = await supabase.functions.invoke('ethics_case_study_pipe', {
        body: { action: 'generate', topic },
      });

      if (data?.success && data.data) {
        setCases((prev) => [data.data, ...prev]);
        handleSelectCase(data.data);
      }
    } catch (err) {
      console.error('Error generating case:', err);
    } finally {
      setGeneratingCase(false);
    }
  };

  const principleOptions = [
    'Integrity', 'Objectivity', 'Impartiality', 'Honesty', 'Leadership',
    'Accountability', 'Transparency', 'Public Service', 'Constitutional Values',
    'Utilitarianism', 'Deontology', 'Virtue Ethics', 'Care Ethics',
  ];

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    hard: 'bg-red-500/20 text-red-400',
  };

  // Browse Mode
  if (viewMode === 'browse') {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Ethics Case Studies</h1>
            <p className="text-gray-400">Practice GS Paper IV ethical dilemmas with AI evaluation</p>
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex gap-2">
              {['', 'easy', 'medium', 'hard'].map((diff) => (
                <button
                  key={diff || 'all'}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    difficultyFilter === diff
                      ? 'bg-neon-blue text-white'
                      : 'bg-slate-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {diff || 'All Levels'}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <button
              onClick={() => handleGenerateCase()}
              disabled={generatingCase}
              className="px-4 py-2 bg-neon-blue text-white rounded-xl text-sm font-medium hover:bg-neon-blue/80 disabled:opacity-50"
            >
              {generatingCase ? 'Generating...' : '+ Generate New Case'}
            </button>

            <button
              onClick={() => setViewMode('history')}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700"
            >
              My Attempts
            </button>
          </div>

          {/* Cases Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="neon-glass rounded-xl p-6 cursor-pointer hover:border-neon-blue/50 transition-all"
                  onClick={() => handleSelectCase(caseItem)}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${difficultyColors[caseItem.difficulty]}`}>
                      {caseItem.difficulty}
                    </span>
                    <span className="px-2 py-1 bg-slate-700 text-gray-400 rounded text-xs">
                      {caseItem.gs_paper}
                    </span>
                  </div>

                  <h3 className="text-white font-medium mb-2">{caseItem.title}</h3>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-4">{caseItem.scenario}</p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {caseItem.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-slate-800 text-gray-500 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">
                      {caseItem.stakeholders?.length || 0} stakeholders
                    </span>
                    {caseItem.avg_score && (
                      <span className="text-gray-400 text-xs">
                        Avg: {Math.round(caseItem.avg_score)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Practice Mode
  if (viewMode === 'practice' && selectedCase) {
    const evalData = currentAttempt?.evaluation;

    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => {
              setViewMode('browse');
              setSelectedCase(null);
              setCurrentAttempt(null);
            }}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back to Cases
          </button>

          {/* Case Scenario */}
          <div className="neon-glass rounded-2xl p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm ${difficultyColors[selectedCase.difficulty]}`}>
                {selectedCase.difficulty}
              </span>
              <span className="text-gray-400 text-sm">{selectedCase.gs_paper}</span>
            </div>

            <h1 className="text-2xl font-bold text-white mb-4">{selectedCase.title}</h1>
            <p className="text-gray-300 mb-6 leading-relaxed">{selectedCase.scenario}</p>

            {selectedCase.background && (
              <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
                <h4 className="text-white font-medium mb-2">Background</h4>
                <p className="text-gray-400 text-sm">{selectedCase.background}</p>
              </div>
            )}

            {/* Stakeholders */}
            <div className="mb-6">
              <h4 className="text-white font-medium mb-3">Stakeholders to Consider</h4>
              <div className="space-y-3">
                {selectedCase.stakeholders?.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-xl">
                    <span className="text-neon-blue font-medium">{s.name}:</span>
                    <span className="text-gray-300">{s.perspective}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Discussion Questions */}
            <div>
              <h4 className="text-white font-medium mb-3">Discussion Questions</h4>
              <ul className="space-y-2">
                {selectedCase.discussion_questions?.map((q, i) => (
                  <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                    <span className="text-neon-blue">{i + 1}.</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Analysis Form */}
          {!evalData ? (
            <div className="neon-glass rounded-2xl p-8">
              <h2 className="text-xl font-bold text-white mb-6">Your Analysis</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-gray-300 mb-2">
                    1. Stakeholder Analysis
                    <span className="text-gray-500 text-sm ml-2">Identify all stakeholders and their perspectives</span>
                  </label>
                  <textarea
                    value={analysis.stakeholder_views}
                    onChange={(e) => setAnalysis((a) => ({ ...a, stakeholder_views: e.target.value }))}
                    placeholder="List the stakeholders and their interests..."
                    className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">
                    2. Core Ethical Issue
                    <span className="text-gray-500 text-sm ml-2">What is the fundamental ethical dilemma?</span>
                  </label>
                  <textarea
                    value={analysis.core_issue}
                    onChange={(e) => setAnalysis((a) => ({ ...a, core_issue: e.target.value }))}
                    placeholder="Identify the core ethical issue..."
                    className="w-full h-24 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">
                    3. Proposed Resolution
                    <span className="text-gray-500 text-sm ml-2">How would you resolve this ethically?</span>
                  </label>
                  <textarea
                    value={analysis.resolution}
                    onChange={(e) => setAnalysis((a) => ({ ...a, resolution: e.target.value }))}
                    placeholder="Describe your approach to resolving this dilemma..."
                    className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">4. Ethical Principles Applied</label>
                  <div className="flex flex-wrap gap-2">
                    {principleOptions.map((principle) => (
                      <button
                        key={principle}
                        onClick={() => {
                          setAnalysis((a) => ({
                            ...a,
                            principles_applied: a.principles_applied.includes(principle)
                              ? a.principles_applied.filter((p) => p !== principle)
                              : [...a.principles_applied, principle],
                          }));
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-all ${
                          analysis.principles_applied.includes(principle)
                            ? 'bg-neon-blue text-white'
                            : 'bg-slate-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {principle}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">
                    Confidence Level: {confidence}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={handleSubmitAnalysis}
                  disabled={submitting || !analysis.resolution}
                  className="w-full py-4 bg-neon-blue text-white rounded-xl font-medium hover:bg-neon-blue/80 disabled:opacity-50"
                >
                  {submitting ? 'Evaluating...' : 'Submit for Evaluation'}
                </button>
              </div>
            </div>
          ) : (
            /* Evaluation Results */
            <div className="neon-glass rounded-2xl p-8">
              <h2 className="text-xl font-bold text-white mb-6">Evaluation Results</h2>

              {/* Score */}
              <div className="text-center mb-8">
                <div className="text-6xl font-bold text-white mb-2">
                  {Math.round(evalData.total_score || 0)}%
                </div>
                <div className="text-gray-400">Overall Score</div>
              </div>

              {/* Rubric Breakdown */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {selectedCase.eval_criteria?.map((criterion, i) => {
                  const scoreKey = criterion.criterion.toLowerCase().replace(/\s+/g, '_');
                  const score = evalData.rubric_scores?.[scoreKey] || 0;

                  return (
                    <div key={i} className="bg-slate-800/30 rounded-xl p-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-300 text-sm">{criterion.criterion}</span>
                        <span className="text-white font-medium">{Math.round(score)}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neon-blue transition-all duration-500"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feedback */}
              <div className="mb-6">
                <h3 className="text-white font-medium mb-2">Overall Feedback</h3>
                <p className="text-gray-300">{evalData.overall_feedback}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <h4 className="text-green-400 font-medium mb-2">Strengths</h4>
                  <ul className="space-y-1">
                    {evalData.strengths?.map((s: string, i: number) => (
                      <li key={i} className="text-gray-300 text-sm">• {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <h4 className="text-yellow-400 font-medium mb-2">Areas for Improvement</h4>
                  <ul className="space-y-1">
                    {evalData.improvements?.map((imp: string, i: number) => (
                      <li key={i} className="text-gray-300 text-sm">• {imp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setViewMode('browse');
                    setSelectedCase(null);
                    setCurrentAttempt(null);
                  }}
                  className="flex-1 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700"
                >
                  Another Case
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className="flex-1 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80"
                >
                  View All Attempts
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // History Mode
  if (viewMode === 'history') {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setViewMode('browse')}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back to Cases
          </button>

          <h1 className="text-2xl font-bold text-white mb-6">My Attempts</h1>

          {myAttempts.length === 0 ? (
            <div className="neon-glass rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-white mb-2">No Attempts Yet</h3>
              <p className="text-gray-400">Start practicing ethics case studies to track your progress</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="neon-glass rounded-xl p-6"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-medium">
                      {attempt.ethics_case_studies?.title || 'Case Study'}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      attempt.is_completed
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {attempt.is_completed ? 'Completed' : 'In Progress'}
                    </span>
                  </div>

                  {attempt.is_completed && attempt.ai_evaluation && (
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-white">
                        {Math.round(attempt.ai_evaluation.total_score || 0)}%
                      </span>
                      <span className="text-gray-400">
                        {new Date(attempt.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
