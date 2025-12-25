'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';

interface PYQ {
  id: string;
  question: string;
  paper: string;
  year: number;
  topic?: string;
  answer?: string;
  key_points?: string[];
  approach?: string;
}

interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const PAPERS = [
  { id: 'all', label: 'All Papers' },
  { id: 'GS1', label: 'GS Paper I' },
  { id: 'GS2', label: 'GS Paper II' },
  { id: 'GS3', label: 'GS Paper III' },
  { id: 'GS4', label: 'GS Paper IV' },
  { id: 'CSAT', label: 'CSAT' },
];

export default function PracticePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [pyqs, setPyqs] = useState<PYQ[]>([]);
  const [selectedPaper, setSelectedPaper] = useState('all');
  const [selectedYear, setSelectedYear] = useState(2024);
  const [selectedQuestion, setSelectedQuestion] = useState<PYQ | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Demo practice questions
  const practiceQuestions: PracticeQuestion[] = [
    {
      id: '1',
      question: 'Which article of the Indian Constitution deals with the Right to Equality?',
      options: ['Article 12', 'Article 14', 'Article 19', 'Article 21'],
      correct_answer: 1,
      explanation: 'Article 14 to Article 18 deal with Right to Equality. Article 14 specifically deals with equality before law.',
      topic: 'Polity',
      difficulty: 'easy',
    },
    {
      id: '2',
      question: 'The춘，是中国四大名著之一。其作者是谁？',
      options: ['施耐庵', '罗贯中', '吴承恩', '曹雪芹'],
      correct_answer: 2,
      explanation: '《西游记》的作者是吴承恩。这是一部关于唐僧师徒四人取经的神话小说。',
      topic: 'Literature',
      difficulty: 'hard',
    },
    {
      id: '3',
      question: 'What is the main function of the Reserve Bank of India?',
      options: ['Issue currency', 'Print government bonds', 'Manage foreign exchange', 'All of the above'],
      correct_answer: 3,
      explanation: 'RBI performs all these functions: issuing currency, managing government bonds, and regulating foreign exchange.',
      topic: 'Economy',
      difficulty: 'medium',
    },
  ];

  // Fetch PYQs
  useEffect(() => {
    const fetchPyqs = async () => {
      setIsLoading(true);
      let query = supabase
        .from('pyq_solutions')
        .select('*')
        .order('year', { ascending: false });

      if (selectedPaper !== 'all') {
        query = query.eq('paper', selectedPaper);
      }

      const { data, error } = await query.limit(20);

      if (!error && data) {
        setPyqs(data as PYQ[]);
      }
      setIsLoading(false);
    };

    fetchPyqs();
  }, [selectedPaper, selectedYear]);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const handleAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setShowExplanation(true);

    if (answerIndex === practiceQuestions[currentQuestion].correct_answer) {
      setScore({ ...score, correct: score.correct + 1 });
    }
    setScore({ ...score, total: score.total + 1 });
  };

  const nextQuestion = () => {
    if (currentQuestion < practiceQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Practice Questions</h1>
          <p className="text-gray-400">Test your knowledge with previous year questions and practice sets</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Practice Section */}
            <div className="neon-glass p-6 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4">Quick Practice</h2>
              <p className="text-gray-400 mb-4">Test yourself with multiple choice questions</p>

              {/* Question */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    practiceQuestions[currentQuestion].difficulty === 'easy'
                      ? 'bg-green-500/20 text-green-400'
                      : practiceQuestions[currentQuestion].difficulty === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {practiceQuestions[currentQuestion].difficulty.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">{practiceQuestions[currentQuestion].topic}</span>
                </div>

                <p className="text-white text-lg mb-4">{practiceQuestions[currentQuestion].question}</p>

                {/* Options */}
                <div className="space-y-2">
                  {practiceQuestions[currentQuestion].options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => !showExplanation && handleAnswer(index)}
                      disabled={showExplanation}
                      className={`w-full p-4 text-left rounded-lg transition-all ${
                        showExplanation
                          ? index === practiceQuestions[currentQuestion].correct_answer
                            ? 'bg-green-500/20 border border-green-500/50'
                            : selectedAnswer === index
                            ? 'bg-red-500/20 border border-red-500/50'
                            : 'bg-slate-800/50'
                          : selectedAnswer === index
                          ? 'bg-neon-blue/20 border border-neon-blue/50'
                          : 'bg-slate-800/50 hover:bg-slate-700'
                      }`}
                    >
                      <span className="inline-block w-6 h-6 rounded-full bg-slate-700 text-gray-300 text-sm flex items-center justify-center mr-3">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option}
                      {showExplanation && index === practiceQuestions[currentQuestion].correct_answer && (
                        <svg className="inline-block w-5 h-5 text-green-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Explanation */}
              {showExplanation && (
                <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                  <h4 className="text-neon-blue font-medium mb-2">Explanation</h4>
                  <p className="text-gray-300 text-sm">{practiceQuestions[currentQuestion].explanation}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={prevQuestion}
                  disabled={currentQuestion === 0}
                  className="px-4 py-2 bg-slate-800 rounded-lg text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                >
                  Previous
                </button>
                <span className="text-gray-400 text-sm">
                  {currentQuestion + 1} / {practiceQuestions.length}
                </span>
                <button
                  onClick={nextQuestion}
                  disabled={currentQuestion === practiceQuestions.length - 1}
                  className="px-4 py-2 bg-slate-800 rounded-lg text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                >
                  Next
                </button>
              </div>

              {/* Score */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-gray-400 text-sm">
                  Score: <span className="text-neon-blue font-bold">{score.correct}</span> / {score.total}
                </p>
              </div>
            </div>

            {/* PYQ Section */}
            <div className="neon-glass p-6 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4">Previous Year Questions</h2>

              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-4">
                <select
                  value={selectedPaper}
                  onChange={(e) => setSelectedPaper(e.target.value)}
                  className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                >
                  {PAPERS.map((paper) => (
                    <option key={paper.id} value={paper.id}>{paper.label}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                >
                  {[2024, 2023, 2022, 2021, 2020].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* PYQ List */}
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading questions...</p>
                </div>
              ) : pyqs.length > 0 ? (
                <div className="space-y-3">
                  {pyqs.slice(0, 5).map((pyq) => (
                    <div
                      key={pyq.id}
                      onClick={() => setSelectedQuestion(pyq)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedQuestion?.id === pyq.id
                          ? 'bg-neon-blue/20 border border-neon-blue/50'
                          : 'bg-slate-800/30 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-slate-700 text-gray-300 text-xs rounded">
                          {pyq.paper} {pyq.year}
                        </span>
                        {pyq.topic && (
                          <span className="px-2 py-0.5 bg-neon-blue/20 text-neon-blue text-xs rounded">
                            {pyq.topic}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm line-clamp-2">{pyq.question}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">
                  No questions found. Try different filters or generate solutions.
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {selectedQuestion ? (
              <div className="neon-glass p-6 rounded-xl sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white">{selectedQuestion.paper} {selectedQuestion.year}</h3>
                  <button
                    onClick={() => setSelectedQuestion(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-white mb-4">{selectedQuestion.question}</p>

                {selectedQuestion.answer && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Answer</h4>
                      <div className="text-gray-300 whitespace-pre-line">{selectedQuestion.answer}</div>
                    </div>

                    {selectedQuestion.key_points && selectedQuestion.key_points.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Key Points</h4>
                        <ul className="space-y-1">
                          {selectedQuestion.key_points.map((point, index) => (
                            <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1.5"></span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button className="w-full btn-primary mt-4">
                      Get Detailed Solution
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="neon-glass p-6 rounded-xl">
                <h3 className="font-bold text-white mb-3">Generate Solutions</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Get detailed solutions with answer approach for any UPSC question
                </p>
                <button className="w-full btn-primary">
                  Ask a Question
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
