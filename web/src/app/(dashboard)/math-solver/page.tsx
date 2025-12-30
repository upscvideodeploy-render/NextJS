'use client';

/**
 * Story 11.1: Math Solver - Manim Animation Step-by-Step
 * UI Page: /math-solver
 * 
 * Features:
 * - AC 1: Input methods (typed, image upload)
 * - AC 2: OCR preview and confirmation
 * - AC 4: Step-by-step display
 * - AC 6: Video player
 * - AC 8: Text solution
 * - AC 9: Similar problems
 * - AC 10: History
 */

import React, { useState, useEffect, useRef } from 'react';

// Types
interface SolutionStep {
  step_number: number;
  equation: string;
  explanation: string;
  visual_type: string;
}

interface MathProblem {
  id: string;
  input_type: string;
  problem_statement: string;
  problem_type: string;
  complexity: string;
  animation_status: string;
  video_url?: string;
  thumbnail_url?: string;
  step_count: number;
  final_answer: string;
  text_solution?: string;
  is_favorite: boolean;
  created_at: string;
  solved_at?: string;
}

interface SimilarProblem {
  id: string;
  question_text: string;
  difficulty: string;
  topic: string;
}

// Problem type icons
const TYPE_ICONS: Record<string, string> = {
  arithmetic: '➕',
  algebra: '🔢',
  geometry: '📐',
  data_interpretation: '📊',
  graphs: '📈',
  percentage: '%',
  ratio_proportion: '⚖️',
  time_work: '⏱️',
  time_distance: '🚗',
  profit_loss: '💰'
};

export default function MathSolverPage() {
  // Input state
  const [inputType, setInputType] = useState<'typed' | 'image'>('typed');
  const [equation, setEquation] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string>('');
  const [solving, setSolving] = useState(false);
  
  // Solution state
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [steps, setSteps] = useState<SolutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [similarProblems, setSimilarProblems] = useState<SimilarProblem[]>([]);
  
  // History state
  const [history, setHistory] = useState<MathProblem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
  }, [historyFilter]);

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (historyFilter) params.set('type', historyFilter);
      
      const res = await fetch(`/api/math-solver?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  // AC 1: Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    // Upload and OCR (AC 2)
    setSolving(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      // For demo, we'll use base64
      const base64 = await toBase64(file);
      
      const res = await fetch('/api/math-solver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_image',
          image_data: base64
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setOcrResult(data.extracted_text);
        if (data.needs_confirmation) {
          // Show for user confirmation
        }
      }
    } catch (error) {
      console.error('Image upload failed:', error);
    }
    setSolving(false);
  };

  // AC 1: Solve problem
  const handleSolve = async () => {
    const problemText = inputType === 'typed' ? equation : ocrResult;
    if (!problemText.trim()) return;
    
    setSolving(true);
    try {
      const res = await fetch('/api/math-solver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'solve',
          input_type: inputType,
          equation: problemText
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setProblem({
          id: data.problem_id,
          input_type: inputType,
          problem_statement: problemText,
          problem_type: data.classification.type,
          complexity: data.classification.complexity,
          animation_status: 'generating',
          step_count: data.steps.length,
          final_answer: data.final_answer,
          text_solution: data.text_solution,
          is_favorite: false,
          created_at: new Date().toISOString()
        });
        setSteps(data.steps);
        setCurrentStep(0);
        
        // Fetch similar problems (AC 9)
        fetchSimilarProblems(data.problem_id);
        
        // Poll for animation status
        pollAnimationStatus(data.problem_id);
      }
    } catch (error) {
      console.error('Solve failed:', error);
    }
    setSolving(false);
  };

  // AC 9: Fetch similar problems
  const fetchSimilarProblems = async (problemId: string) => {
    try {
      const res = await fetch('/api/math-solver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_similar',
          problem_id: problemId
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setSimilarProblems(data.similar_problems || []);
      }
    } catch (error) {
      console.error('Failed to fetch similar problems:', error);
    }
  };

  // Poll for animation completion
  const pollAnimationStatus = async (problemId: string) => {
    const checkStatus = async () => {
      const res = await fetch(`/api/math-solver?id=${problemId}`);
      const data = await res.json();
      
      if (data.problem?.animation_status === 'completed') {
        setProblem(prev => prev ? {
          ...prev,
          animation_status: 'completed',
          video_url: data.problem.video_url,
          thumbnail_url: data.problem.thumbnail_url
        } : null);
        return true;
      } else if (data.problem?.animation_status === 'failed') {
        setProblem(prev => prev ? { ...prev, animation_status: 'failed' } : null);
        return true;
      }
      return false;
    };
    
    // Poll every 3 seconds for up to 2 minutes
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000));
      if (await checkStatus()) break;
    }
  };

  // Load problem from history
  const loadProblem = async (problemId: string) => {
    try {
      const res = await fetch(`/api/math-solver?id=${problemId}`);
      const data = await res.json();
      
      if (data.problem) {
        setProblem(data.problem);
        setSteps(data.steps || []);
        setCurrentStep(0);
        setShowHistory(false);
        fetchSimilarProblems(problemId);
      }
    } catch (error) {
      console.error('Failed to load problem:', error);
    }
  };

  // Toggle favorite
  const toggleFavorite = async () => {
    if (!problem) return;
    
    try {
      const res = await fetch('/api/math-solver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_favorite',
          problem_id: problem.id
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setProblem(prev => prev ? { ...prev, is_favorite: data.is_favorite } : null);
      }
    } catch (error) {
      console.error('Toggle favorite failed:', error);
    }
  };

  // Reset to new problem
  const resetSolver = () => {
    setProblem(null);
    setSteps([]);
    setEquation('');
    setImagePreview(null);
    setOcrResult('');
    setSimilarProblems([]);
  };

  // Helper: Convert file to base64
  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Math Solver</h1>
              <p className="text-blue-200 mt-2">
                Animated step-by-step solutions for CSAT & Economy
              </p>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              📜 History
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* History Panel (AC 10) */}
        {showHistory && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Problem History</h2>
              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="">All Types</option>
                {Object.keys(TYPE_ICONS).map(type => (
                  <option key={type} value={type}>
                    {TYPE_ICONS[type]} {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No problems solved yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map(h => (
                  <button
                    key={h.id}
                    onClick={() => loadProblem(h.id)}
                    className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{TYPE_ICONS[h.problem_type] || '🔢'}</span>
                      <span className="text-sm text-gray-500 capitalize">{h.problem_type?.replace('_', ' ')}</span>
                      {h.is_favorite && <span>⭐</span>}
                    </div>
                    <p className="font-medium text-gray-800 line-clamp-2">{h.problem_statement}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{h.step_count} steps</span>
                      <span>•</span>
                      <span className={
                        h.animation_status === 'completed' ? 'text-green-600' :
                        h.animation_status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                      }>
                        {h.animation_status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        {!problem ? (
          /* Input Form (AC 1, 2) */
          <div className="bg-white rounded-xl shadow-sm p-6">
            {/* Input Type Toggle */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setInputType('typed')}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  inputType === 'typed' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ⌨️ Type Equation
              </button>
              <button
                onClick={() => setInputType('image')}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  inputType === 'image' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📷 Upload Image
              </button>
            </div>

            {inputType === 'typed' ? (
              /* Typed Input */
              <div>
                <label className="block text-sm text-gray-600 mb-2">Enter your math problem:</label>
                <textarea
                  value={equation}
                  onChange={(e) => setEquation(e.target.value)}
                  placeholder="e.g., If a train travels 120 km in 2 hours, what is its speed? or 2x + 5 = 15, find x"
                  className="w-full h-32 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ) : (
              /* Image Upload (AC 1, 2) */
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {!imagePreview ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
                  >
                    <span className="text-4xl mb-2">📤</span>
                    <span>Click to upload handwritten or printed problem</span>
                    <span className="text-sm mt-1">Supports JPG, PNG, WEBP</span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <img 
                      src={imagePreview} 
                      alt="Uploaded problem" 
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    {ocrResult && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <label className="block text-sm text-gray-600 mb-2">Extracted text (OCR):</label>
                        <textarea
                          value={ocrResult}
                          onChange={(e) => setOcrResult(e.target.value)}
                          className="w-full h-20 px-3 py-2 border border-gray-200 rounded-lg"
                        />
                        <p className="text-xs text-gray-500 mt-1">Edit if the OCR result is incorrect</p>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setOcrResult('');
                      }}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Remove image
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Solve Button */}
            <button
              onClick={handleSolve}
              disabled={solving || (!equation && !ocrResult)}
              className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {solving ? '🔄 Solving...' : '✨ Solve Step-by-Step'}
            </button>
          </div>
        ) : (
          /* Solution View (AC 4, 6, 8) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Solution */}
            <div className="lg:col-span-2 space-y-6">
              {/* Problem Header */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{TYPE_ICONS[problem.problem_type] || '🔢'}</span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm capitalize">
                        {problem.problem_type?.replace('_', ' ')}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        problem.complexity === 'easy' ? 'bg-green-100 text-green-700' :
                        problem.complexity === 'hard' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {problem.complexity}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">{problem.problem_statement}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleFavorite}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      {problem.is_favorite ? '⭐' : '☆'}
                    </button>
                    <button
                      onClick={resetSolver}
                      className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg text-sm"
                    >
                      New Problem
                    </button>
                  </div>
                </div>
              </div>

              {/* Video Player (AC 6) */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {problem.animation_status === 'completed' && problem.video_url ? (
                  <video
                    src={problem.video_url}
                    controls
                    className="w-full aspect-video"
                    poster={problem.thumbnail_url}
                  />
                ) : (
                  <div className="aspect-video bg-gray-900 flex items-center justify-center text-white">
                    {problem.animation_status === 'generating' || problem.animation_status === 'rendering' ? (
                      <div className="text-center">
                        <div className="text-4xl mb-3 animate-pulse">🎬</div>
                        <p>Generating animation...</p>
                        <p className="text-sm text-gray-400 mt-1">This may take 1-2 minutes</p>
                      </div>
                    ) : problem.animation_status === 'failed' ? (
                      <div className="text-center text-red-400">
                        <div className="text-4xl mb-3">❌</div>
                        <p>Animation generation failed</p>
                      </div>
                    ) : (
                      <div className="text-4xl">🎬</div>
                    )}
                  </div>
                )}
              </div>

              {/* Steps (AC 4) */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Solution Steps ({steps.length})</h3>
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div
                      key={index}
                      onClick={() => setCurrentStep(index)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        currentStep === index 
                          ? 'bg-blue-50 border-2 border-blue-500' 
                          : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          currentStep === index ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {step.step_number}
                        </div>
                        <div className="flex-1">
                          <p className="font-mono text-lg text-gray-800 mb-1">{step.equation}</p>
                          <p className="text-gray-600">{step.explanation}</p>
                          {step.visual_type && step.visual_type !== 'none' && (
                            <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                              Visual: {step.visual_type.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Answer */}
                <div className="mt-6 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                  <p className="text-sm text-green-600 mb-1">Final Answer</p>
                  <p className="text-2xl font-bold text-green-700">{problem.final_answer}</p>
                </div>
              </div>

              {/* Text Solution (AC 8) */}
              {problem.text_solution && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Written Solution</h3>
                  <p className="text-gray-600 whitespace-pre-line">{problem.text_solution}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Similar Problems (AC 9) */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Practice Similar Problems</h3>
                {similarProblems.length === 0 ? (
                  <p className="text-gray-500 text-sm">No similar problems found</p>
                ) : (
                  <div className="space-y-3">
                    {similarProblems.map((sp, index) => (
                      <div key={sp.id} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-800 line-clamp-2">{sp.question_text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span className={`px-2 py-0.5 rounded ${
                            sp.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                            sp.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {sp.difficulty}
                          </span>
                          <span>{sp.topic}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Tips */}
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="font-semibold text-blue-800 mb-3">💡 CSAT Tips</h3>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• Always check units in Time & Distance problems</li>
                  <li>• For percentages, convert to fractions when helpful</li>
                  <li>• Draw diagrams for Geometry problems</li>
                  <li>• Verify your answer by substitution</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
