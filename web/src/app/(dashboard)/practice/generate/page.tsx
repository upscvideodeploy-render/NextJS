'use client';

// Story 8.6: AI Question Generator Interface (FULL PRODUCTION)
// AC 1-10: Complete question generation with all features

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface GeneratedQuestion {
  id: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  options?: string[];
  correct_answer?: string;
  explanations?: Record<string, string>;
  model_answer: string;
  key_points?: string[];
  quality_score?: number;
}

interface DailyLimit {
  used: number;
  total: number | 'unlimited';
  remaining: number | 'unlimited';
}

interface SyllabusNode {
  id: string;
  name: string;
  parent_id: string | null;
  children?: SyllabusNode[];
}

export default function QuestionGeneratorPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [syllabusNodeId, setSyllabusNodeId] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState('mcq');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState('');
  const [dailyLimit, setDailyLimit] = useState<DailyLimit>({ used: 0, total: 5, remaining: 5 });
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [syllabusNodes, setSyllabusNodes] = useState<SyllabusNode[]>([]);
  const [showSyllabusSelector, setShowSyllabusSelector] = useState(false);
  const [expandedOptions, setExpandedOptions] = useState<Set<number>>(new Set());
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
  const [historyQuestions, setHistoryQuestions] = useState<GeneratedQuestion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const supabase = getSupabaseBrowserClient();

  // Fetch syllabus nodes for AC 2
  useEffect(() => {
    fetchSyllabusNodes();
    fetchDailyUsage();
  }, []);

  const fetchSyllabusNodes = async () => {
    try {
      const { data } = await supabase
        .from('syllabus_nodes')
        .select('id, name, parent_id')
        .order('name');
      
      if (data) {
        // Build tree structure
        const nodes = data as SyllabusNode[];
        const rootNodes = nodes.filter(n => !n.parent_id);
        const buildTree = (parent: SyllabusNode): SyllabusNode => {
          const children = nodes.filter(n => n.parent_id === parent.id);
          return { ...parent, children: children.map(buildTree) };
        };
        setSyllabusNodes(rootNodes.map(buildTree));
      }
    } catch (err) {
      console.error('Failed to fetch syllabus nodes:', err);
    }
  };

  const fetchDailyUsage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/questions/generate?limit=0', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        // Get limit info from a dummy check
        try {
          const { data }: { data: any } = await (supabase as any).rpc('check_question_generation_limit', {
            p_user_id: session.user.id,
            p_count: 0
          });
          
          if (data && data[0]) {
            const limit = data[0];
            setDailyLimit({
              used: limit.current_usage || 0,
              total: limit.daily_limit >= 9999 ? 'unlimited' : limit.daily_limit,
              remaining: limit.daily_limit >= 9999 ? 'unlimited' : limit.daily_limit - limit.current_usage
            });
          }
        } catch (rpcErr) {
          console.warn('RPC not available yet:', rpcErr);
        }
      }
    } catch (err) {
      console.error('Failed to fetch daily usage:', err);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/questions/generate?limit=20', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setHistoryQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic or select from syllabus');
      return;
    }

    // Check remaining limit
    if (dailyLimit.remaining !== 'unlimited' && dailyLimit.remaining < count) {
      setShowUpgradePrompt(true);
      return;
    }

    setGenerating(true);
    setError('');
    setGeneratedQuestions([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to generate questions');
        return;
      }

      const res = await fetch('/api/questions/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          topic, 
          syllabus_node_id: syllabusNodeId,
          question_type: questionType, 
          difficulty, 
          count 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.upgrade_required) {
          setShowUpgradePrompt(true);
          setError(`Daily limit reached (${data.current_usage}/${data.daily_limit}). Upgrade for unlimited questions!`);
        } else {
          throw new Error(data.error || 'Generation failed');
        }
        return;
      }

      setGeneratedQuestions(data.questions || []);
      setDailyLimit({
        used: data.dailyLimit.used,
        total: data.dailyLimit.total,
        remaining: data.dailyLimit.remaining
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleOptionExpand = (idx: number) => {
    setExpandedOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  const startPractice = (question: GeneratedQuestion) => {
    // Navigate to practice session with this question
    sessionStorage.setItem('practice_question', JSON.stringify(question));
    router.push('/practice/session?mode=single');
  };

  const selectSyllabusNode = (node: SyllabusNode) => {
    setTopic(node.name);
    setSyllabusNodeId(node.id);
    setShowSyllabusSelector(false);
  };

  const renderSyllabusTree = (nodes: SyllabusNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id} style={{ marginLeft: depth * 16 }}>
        <button
          onClick={() => selectSyllabusNode(node)}
          className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded text-sm flex items-center space-x-2"
        >
          <span className="text-gray-400">{node.children?.length ? '📁' : '📄'}</span>
          <span>{node.name}</span>
        </button>
        {node.children && renderSyllabusTree(node.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">AI Question Generator</h1>
          <p className="text-gray-600 mt-1">Generate unlimited practice questions on any UPSC topic</p>
        </div>
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>History</span>
        </button>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        {/* Daily Limit Progress */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-700">Daily Generation Limit</span>
            <span className="text-sm font-medium">
              {dailyLimit.total === 'unlimited' ? (
                <span className="text-green-600">✓ Unlimited (Pro)</span>
              ) : (
                <span className="text-blue-600">
                  {dailyLimit.used}/{dailyLimit.total} questions used
                </span>
              )}
            </span>
          </div>
          {dailyLimit.total !== 'unlimited' && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  (dailyLimit.used / (dailyLimit.total as number)) > 0.8 ? 'bg-red-500' :
                  (dailyLimit.used / (dailyLimit.total as number)) > 0.5 ? 'bg-yellow-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, (dailyLimit.used / (dailyLimit.total as number)) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Topic Input - AC 2 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => { setTopic(e.target.value); setSyllabusNodeId(null); }}
              placeholder="e.g., Indian Constitution - Fundamental Rights, Climate Change, Ethics in Governance"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => setShowSyllabusSelector(!showSyllabusSelector)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
              title="Select from Syllabus"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Syllabus</span>
            </button>
          </div>
          {syllabusNodeId && (
            <p className="mt-2 text-sm text-green-600">✓ Linked to syllabus node</p>
          )}
        </div>

        {/* Syllabus Selector Dropdown - AC 2 */}
        {showSyllabusSelector && syllabusNodes.length > 0 && (
          <div className="mb-6 border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-gray-50 p-2">
            <p className="text-sm text-gray-600 px-3 py-2 border-b mb-2">Select from UPSC Syllabus:</p>
            {renderSyllabusTree(syllabusNodes)}
          </div>
        )}

        {/* Configuration Grid - AC 3, 4, 5 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Question Type - AC 3 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="mcq">Prelims MCQ (4 options)</option>
              <option value="mains_150">Mains 150-word</option>
              <option value="mains_250">Mains 250-word</option>
              <option value="essay">Essay 1000-word</option>
            </select>
          </div>

          {/* Difficulty - AC 4 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500"
            >
              <option value="easy">Easy - Fundamentals</option>
              <option value="medium">Medium - Application</option>
              <option value="hard">Hard - Advanced Analysis</option>
            </select>
          </div>

          {/* Count - AC 5 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Questions (1-10)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={count}
              onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start space-x-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !topic.trim()}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
        >
          {generating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Generating Questions...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Generate {count} {questionType === 'mcq' ? 'MCQ' : questionType.replace('_', ' ')} Questions</span>
            </>
          )}
        </button>
      </div>

      {/* Upgrade Prompt Modal - AC 10 */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Daily Limit Reached</h3>
              <p className="text-gray-600 mb-6">
                You&apos;ve used all {dailyLimit.total} free questions for today. 
                Upgrade to Pro for unlimited question generation!
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowUpgradePrompt(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Maybe Later
                </button>
                <button
                  onClick={() => router.push('/pricing')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Your Generated Questions</h2>
          {loadingHistory ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : historyQuestions.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No questions generated yet. Start generating above!</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {historyQuestions.map((q, idx) => (
                <div key={q.id || idx} className="p-4 border rounded-lg hover:bg-gray-50">
                  <p className="font-medium line-clamp-2">{q.question_text}</p>
                  <div className="flex space-x-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">{q.question_type}</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">{q.difficulty}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generated Questions Display */}
      {generatedQuestions.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Generated Questions</h2>
            <span className="text-sm text-gray-600">{generatedQuestions.length} questions generated</span>
          </div>

          {generatedQuestions.map((q, idx) => (
            <div key={q.id || idx} className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Question Header */}
              <div className="p-6 border-b">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      Question {idx + 1}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      q.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                      q.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {q.difficulty.toUpperCase()}
                    </span>
                    {q.quality_score && q.quality_score >= 0.8 && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                        ✓ High Quality
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 capitalize">{q.question_type.replace('_', ' ')}</span>
                </div>
                
                <p className="text-lg font-medium leading-relaxed">{q.question_text}</p>
              </div>

              {/* MCQ Options */}
              {q.options && q.options.length > 0 && (
                <div className="p-6 bg-gray-50">
                  <p className="text-sm font-medium text-gray-600 mb-3">Options:</p>
                  <div className="space-y-2">
                    {q.options.map((opt: string, i: number) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCorrect = q.correct_answer === letter;
                      const isExpanded = expandedOptions.has(idx * 10 + i);
                      
                      return (
                        <div key={i}>
                          <button
                            onClick={() => toggleOptionExpand(idx * 10 + i)}
                            className={`w-full text-left p-4 rounded-lg border transition-all ${
                              isCorrect 
                                ? 'border-green-300 bg-green-50' 
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start">
                              <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                                isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {letter}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isCorrect && (
                                <span className="ml-2 text-green-600">✓ Correct</span>
                              )}
                            </div>
                          </button>
                          {isExpanded && q.explanations && q.explanations[letter] && (
                            <div className="mt-2 ml-11 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                              <strong>Explanation:</strong> {q.explanations[letter]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Model Answer */}
              <div className="p-6 border-t">
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-gray-700">Model Answer</span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {q.model_answer}
                </div>
              </div>

              {/* Key Points */}
              {q.key_points && q.key_points.length > 0 && (
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-t">
                  <p className="font-medium text-gray-700 mb-3">Key Points to Remember:</p>
                  <ul className="space-y-2">
                    {q.key_points.map((point: string, i: number) => (
                      <li key={i} className="flex items-start space-x-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="p-6 border-t bg-gray-50 flex space-x-3">
                <button
                  onClick={() => startPractice(q)}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Practice This Question</span>
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${q.question_text}\n\nAnswer:\n${q.model_answer}`);
                  }}
                  className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-white transition"
                  title="Copy to Clipboard"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          {/* Generate More */}
          <div className="text-center py-6">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Generate More Questions on "{topic}"
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
