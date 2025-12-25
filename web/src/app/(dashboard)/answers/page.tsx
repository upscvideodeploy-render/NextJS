'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';

interface PracticeQuestion {
  id: string;
  paper: string;
  year: number;
  question: string;
  topic?: string;
  word_limit: number;
  time_limit: number;
}

const PRACTICE_QUESTIONS: PracticeQuestion[] = [
  {
    id: '1',
    paper: 'GS1',
    year: 2024,
    question: 'Discuss the major geological formations of India and their economic significance.',
    topic: 'Geography',
    word_limit: 200,
    time_limit: 7,
  },
  {
    id: '2',
    paper: 'GS2',
    year: 2024,
    question: 'Evaluate the functioning of the Indian federal system with special reference to Centre-State relations.',
    topic: 'Polity',
    word_limit: 200,
    time_limit: 7,
  },
  {
    id: '3',
    paper: 'GS3',
    year: 2024,
    question: 'Analyze the challenges facing the agricultural sector in India and suggest measures to address them.',
    topic: 'Economy',
    word_limit: 200,
    time_limit: 7,
  },
  {
    id: '4',
    paper: 'GS4',
    year: 2024,
    question: 'What do you understand by emotional intelligence? Discuss its role in effective administration.',
    topic: 'Ethics',
    word_limit: 200,
    time_limit: 7,
  },
];

export default function AnswerWritingPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [selectedQuestion, setSelectedQuestion] = useState<PracticeQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{
    score: number;
    strengths: string[];
    improvements: string[];
    sample_points: string[];
  } | null>(null);

  const startTimer = () => {
    setIsTimerRunning(true);
    setTimeLeft(selectedQuestion ? selectedQuestion.time_limit * 60 : 420);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
  };

  // Timer countdown
  if (isTimerRunning && timeLeft > 0) {
    setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);
  }

  // Auto submit when time ends
  if (isTimerRunning && timeLeft === 0) {
    stopTimer();
    handleSubmit();
  }

  const handleTextChange = (text: string) => {
    setUserAnswer(text);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCount(words.length);
  };

  const handleSubmit = async () => {
    if (!selectedQuestion || !userAnswer.trim()) {
      alert('Please write an answer before submitting');
      return;
    }

    stopTimer();
    setIsSubmitted(true);

    // Generate feedback using AI in simple language
    try {
      const response = await fetch('https://api.a4f.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.A4F_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'provider-3/llama-4-scout',
          messages: [
            {
              role: 'system',
              content: 'You are a UPSC examiner who gives feedback in SIMPLE 10th class English. Be encouraging but honest. Help students improve.',
            },
            {
              role: 'user',
              content: `Evaluate this answer for UPSC ${selectedQuestion.paper} ${selectedQuestion.year}.

Question: ${selectedQuestion.question}

Student's Answer:
"${userAnswer.substring(0, 1000)}"

Give feedback in this format (all in SIMPLE English):

SCORE: [1-10]

WHAT WENT WELL:
- Point 1 (simple)
- Point 2 (simple)

NEEDS IMPROVEMENT:
- Point 1 (simple)
- Point 2 (simple)

KEY POINTS TO COVER:
- Point 1 (simple)
- Point 2 (simple)
- Point 3 (simple)

Remember: Use simple 10th class English. Be encouraging!`,
            },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse feedback
        const strengths: string[] = [];
        const improvements: string[] = [];
        const samplePoints: string[] = [];
        let score = 5;

        const lines = content.split('\n');
        for (const line of lines) {
          if (line.startsWith('SCORE:')) {
            const num = line.replace(/[^0-9]/g, '');
            score = parseInt(num) || 5;
          } else if (line.startsWith('WHAT WENT WELL') || line.includes('well')) {
            // Collect next few lines
          } else if (line.startsWith('-')) {
            const text = line.replace('-', '').trim();
            if (content.indexOf('NEEDS') > content.indexOf(line) && content.indexOf(line) < content.indexOf('KEY')) {
              if (!improvements.length || content.indexOf('NEEDS') < content.indexOf(text)) {
                improvements.push(text);
              }
            } else if (content.indexOf('KEY POINTS') < content.indexOf(text)) {
              samplePoints.push(text);
            } else if (strengths.length < 3) {
              strengths.push(text);
            }
          }
        }

        // Fallback if parsing fails
        if (strengths.length === 0) {
          strengths.push('Good effort in attempting the question');
          strengths.push('Clear handwriting and structure');
        }
        if (improvements.length === 0) {
          improvements.push('Add more specific examples');
          improvements.push('Include more facts and data');
        }
        if (samplePoints.length === 0) {
          samplePoints.push('Start with definition');
          samplePoints.push('Give examples');
          samplePoints.push('Conclude properly');
        }

        setFeedback({ score, strengths, improvements, sample_points: samplePoints });
      }
    } catch (error) {
      // Fallback feedback
      setFeedback({
        score: 6,
        strengths: ['Good structure and flow', 'Clear introduction and conclusion'],
        improvements: ['Add more specific facts', 'Include current examples'],
        sample_points: ['Define key terms', 'Give real-world examples', 'Link to current affairs'],
      });
    }
  };

  const saveAnswer = async () => {
    if (!selectedQuestion) return;

    const { error } = await supabase.from('user_answers').insert({
      question_id: selectedQuestion.id,
      question_text: selectedQuestion.question,
      user_answer: userAnswer,
      word_count: wordCount,
      time_taken: selectedQuestion.time_limit * 60 - timeLeft,
      score: feedback?.score || null,
    });

    if (!error) {
      alert('Answer saved!');
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Answer Writing Practice</h1>
          <p className="text-gray-400">Practice writing answers with time management and feedback</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Questions */}
          <div className="lg:col-span-1 space-y-4">
            <div className="neon-glass p-4 rounded-xl">
              <h3 className="font-bold text-white mb-3">Practice Questions</h3>
              <div className="space-y-2">
                {PRACTICE_QUESTIONS.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setSelectedQuestion(q);
                      setUserAnswer('');
                      setWordCount(0);
                      setIsSubmitted(false);
                      setFeedback(null);
                      setTimeLeft(q.time_limit * 60);
                      setIsTimerRunning(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedQuestion?.id === q.id
                        ? 'bg-neon-blue/20 border border-neon-blue/50'
                        : 'bg-slate-800/30 hover:bg-slate-800/50'
                    }`}
                  >
                    <p className="text-white text-sm">{q.question.substring(0, 50)}...</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{q.paper} {q.year}</span>
                      <span className="text-xs text-gray-500">|</span>
                      <span className="text-xs text-gray-500">{q.word_limit} words</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Tips */}
            <div className="neon-glass p-4 rounded-xl">
              <h3 className="font-bold text-white mb-3">Answer Writing Tips</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-neon-blue mt-1">•</span>
                  Start with definition or introduction
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-blue mt-1">•</span>
                  Use subheadings for clarity
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-blue mt-1">•</span>
                  Give examples and facts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-blue mt-1">•</span>
                  Conclude properly
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-blue mt-1">•</span>
                  Keep within word limit
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column - Writing Area */}
          <div className="lg:col-span-2">
            {selectedQuestion ? (
              <div className="space-y-4">
                {/* Question Display & Timer */}
                <div className="neon-glass p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{selectedQuestion.question}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">{selectedQuestion.paper} {selectedQuestion.year}</span>
                      <span className="text-xs text-gray-500">{selectedQuestion.word_limit} words</span>
                      <span className="text-xs text-gray-500">{selectedQuestion.topic}</span>
                    </div>
                  </div>
                  <div className={`text-2xl font-mono ${
                    timeLeft < 60 ? 'text-red-400' : timeLeft < 120 ? 'text-yellow-400' : 'text-neon-blue'
                  }`}>
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </div>
                </div>

                {/* Answer Input */}
                <div className="neon-glass p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Your Answer</span>
                    <span className={`text-sm ${wordCount > selectedQuestion.word_limit ? 'text-red-400' : 'text-neon-blue'}`}>
                      {wordCount} / {selectedQuestion.word_limit} words
                    </span>
                  </div>
                  <textarea
                    value={userAnswer}
                    onChange={(e) => handleTextChange(e.target.value)}
                    disabled={isSubmitted}
                    placeholder="Start writing your answer here..."
                    className="w-full p-4 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm"
                    rows={12}
                  />
                </div>

                {/* Action Buttons */}
                {!isSubmitted ? (
                  <div className="flex gap-3">
                    {!isTimerRunning ? (
                      <button onClick={startTimer} className="btn-primary">
                        Start Timer & Write
                      </button>
                    ) : (
                      <button onClick={stopTimer} className="btn-primary bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                        Stop Timer
                      </button>
                    )}
                    <button
                      onClick={handleSubmit}
                      disabled={!userAnswer.trim()}
                      className="btn-primary disabled:opacity-50"
                    >
                      Submit Answer
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={saveAnswer} className="btn-primary">
                      Save Answer
                    </button>
                    <button
                      onClick={() => {
                        setIsSubmitted(false);
                        setUserAnswer('');
                        setWordCount(0);
                        setFeedback(null);
                        setTimeLeft(selectedQuestion.time_limit * 60);
                      }}
                      className="px-6 py-3 bg-slate-800 rounded-lg text-gray-300 hover:bg-slate-700"
                    >
                      Try Another Question
                    </button>
                  </div>
                )}

                {/* Feedback */}
                {isSubmitted && feedback && (
                  <div className="neon-glass p-6 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">Your Score</h3>
                      <div className="text-4xl font-bold text-neon-blue">{feedback.score}/10</div>
                    </div>

                    {/* Strengths */}
                    <div>
                      <h4 className="text-green-400 font-medium mb-2">What Went Well</h4>
                      <ul className="space-y-1">
                        {feedback.strengths.map((s, i) => (
                          <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5"></span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Improvements */}
                    <div>
                      <h4 className="text-yellow-400 font-medium mb-2">Needs Improvement</h4>
                      <ul className="space-y-1">
                        {feedback.improvements.map((s, i) => (
                          <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5"></span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Key Points */}
                    <div>
                      <h4 className="text-neon-blue font-medium mb-2">Key Points to Include</h4>
                      <ul className="space-y-1">
                        {feedback.sample_points.map((s, i) => (
                          <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1.5"></span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="neon-glass p-12 rounded-xl text-center">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">Select a Question</h3>
                <p className="text-gray-400">Choose a question from the left to start practicing</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
