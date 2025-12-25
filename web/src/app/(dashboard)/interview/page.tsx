'use client';

import { useState } from 'react';

interface InterviewQuestion {
  id: string;
  category: string;
  question: string;
  tips: string[];
  example_answer?: string;
}

const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: '1',
    category: 'Introduction',
    question: 'Tell us about yourself.',
    tips: [
      'Keep it short - 2-3 minutes',
      'Focus on education and work',
      'Mention why you want to be an IAS',
      'Connect your background to civil services',
    ],
    example_answer: 'Good morning. I am [name], from [place]. I completed my B.Tech in [branch] from [college]. During college, I developed an interest in public service through [experience]. I cleared UPSC because...',
  },
  {
    id: '2',
    category: 'Current Affairs',
    question: 'What is the significance of G20 summit for India?',
    tips: [
      'Know recent G20 meetings and outcomes',
      'Connect to India\'s global role',
      'Mention specific achievements',
      'Link to economic benefits',
    ],
    example_answer: 'The G20 summit was significant because... India hosted it for the first time... Key outcomes included... This benefits India by...',
  },
  {
    id: '3',
    category: 'Ethics',
    question: 'How would you handle a situation where your superior asks you to do something unethical?',
    tips: [
      'Show commitment to ethics',
      'Suggest diplomatic ways to refuse',
      'Mention legal protections for whistleblowers',
      'Balance loyalty with integrity',
    ],
    example_answer: 'I would first try to understand the situation. If it clearly violates ethics, I would respectfully decline. I would remind my superior about... If pressure continues, I would approach...',
  },
  {
    id: '4',
    category: 'Situational',
    question: 'You are DM of a district where a chemical factory leaks. What steps would you take?',
    tips: [
      'Prioritize life safety first',
      'Coordinate with multiple agencies',
      'Communicate with public',
      'Document everything for accountability',
    ],
    example_answer: 'My immediate priority would be... First, I would... Then, I would... Simultaneously, I would ensure...',
  },
  {
    id: '5',
    category: 'Hobbies',
    question: 'What do you do in your free time? How does it help in administration?',
    tips: [
      'Be genuine about your hobbies',
      'Connect hobby to transferable skills',
      'Show personality beyond studies',
      'Keep answer concise',
    ],
    example_answer: 'I enjoy [hobby]. It helps me by... The skills I develop like [skills] are useful in administration because...',
  },
];

const TOPICS = [
  'All Topics',
  'Introduction',
  'Current Affairs',
  'Ethics',
  'Situational',
  'Hobbies',
  'District Administration',
  'Policy',
];

export default function InterviewPage() {
  const [selectedCategory, setSelectedCategory] = useState('All Topics');
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null);
  const [practiceMode, setPracticeMode] = useState<'read' | 'record' | 'mock'>('read');
  const [showAnswer, setShowAnswer] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Filter questions
  const filteredQuestions = selectedCategory === 'All Topics'
    ? INTERVIEW_QUESTIONS
    : INTERVIEW_QUESTIONS.filter(q => q.category === selectedCategory);

  // Timer for practice
  const startTimer = () => {
    setIsTimerRunning(true);
    setTimer(0);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimer(0);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Interview Preparation Studio</h1>
          <p className="text-gray-400">Practice for your UPSC interview with real questions and tips</p>
        </header>

        {/* Timer Banner */}
        <div className="neon-glass p-4 rounded-xl mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-mono text-neon-blue">
              {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
            </div>
            <span className="text-gray-400 text-sm">Answer Duration</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={startTimer}
              disabled={isTimerRunning}
              className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 disabled:opacity-50"
            >
              Start
            </button>
            <button
              onClick={stopTimer}
              disabled={!isTimerRunning}
              className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 disabled:opacity-50"
            >
              Stop
            </button>
            <button
              onClick={resetTimer}
              className="px-4 py-2 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Questions */}
          <div className="lg:col-span-1">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  onClick={() => {
                    setSelectedCategory(topic);
                    setSelectedQuestion(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    selectedCategory === topic
                      ? 'bg-neon-blue text-black'
                      : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>

            {/* Questions List */}
            <div className="neon-glass p-4 rounded-xl">
              <h3 className="font-bold text-white mb-3">Practice Questions</h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredQuestions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setSelectedQuestion(q);
                      setShowAnswer(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedQuestion?.id === q.id
                        ? 'bg-neon-blue/20 border border-neon-blue/50'
                        : 'bg-slate-800/30 hover:bg-slate-800/50'
                    }`}
                  >
                    <p className="text-white text-sm">{q.question}</p>
                    <span className="text-xs text-gray-500">{q.category}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Practice Area */}
          <div className="lg:col-span-2">
            {selectedQuestion ? (
              <div className="space-y-4">
                {/* Question Display */}
                <div className="neon-glass p-6 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-neon-blue/20 text-neon-blue text-xs rounded">
                      {selectedQuestion.category}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-4">{selectedQuestion.question}</h2>

                  {/* Tips */}
                  <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
                    <h4 className="text-neon-blue font-medium mb-2">How to Answer</h4>
                    <ul className="space-y-1">
                      {selectedQuestion.tips.map((tip, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1.5"></span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Example Answer Toggle */}
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="text-neon-blue hover:underline text-sm"
                  >
                    {showAnswer ? 'Hide Example Answer' : 'Show Example Answer'}
                  </button>
                </div>

                {/* Example Answer */}
                {showAnswer && selectedQuestion.example_answer && (
                  <div className="neon-glass p-6 rounded-xl border border-green-500/30">
                    <h4 className="text-green-400 font-medium mb-3">Sample Answer</h4>
                    <p className="text-gray-300 text-sm whitespace-pre-line">
                      {selectedQuestion.example_answer}
                    </p>
                  </div>
                )}

                {/* Practice Tips */}
                <div className="neon-glass p-6 rounded-xl">
                  <h3 className="font-bold text-white mb-4">Practice Tips</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/30 rounded-lg">
                      <h4 className="text-neon-blue font-medium mb-2">Before Interview</h4>
                      <ul className="text-gray-400 text-sm space-y-1">
                        <li>• Read newspapers daily</li>
                        <li>• Know your DAF thoroughly</li>
                        <li>• Practice with friends</li>
                        <li>• Work on communication</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-slate-800/30 rounded-lg">
                      <h4 className="text-neon-blue font-medium mb-2">During Interview</h4>
                      <ul className="text-gray-400 text-sm space-y-1">
                        <li>• Be confident but humble</li>
                        <li>• Listen carefully to questions</li>
                        <li>• Take a moment before answering</li>
                        <li>• Be honest about what you don't know</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Common Topics to Prepare */}
                <div className="neon-glass p-6 rounded-xl">
                  <h3 className="font-bold text-white mb-4">Important Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Current Affairs',
                      'Your State',
                      'Your Hobby',
                      'Graduation Subject',
                      'Optional Subject',
                      'Current Role',
                      'Ethics Scenarios',
                      'District Administration',
                    ].map((topic, index) => (
                      <span key={index} className="px-3 py-1 bg-slate-800 text-gray-300 text-sm rounded-full">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="neon-glass p-12 rounded-xl text-center">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
