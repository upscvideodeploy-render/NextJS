'use client';

import { useState } from 'react';

interface CaseStudy {
  id: string;
  title: string;
  scenario: string;
  stakeholders: string[];
  dilemmas: string[];
  questions: string[];
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: '1',
    title: 'The Honest Officer',
    scenario: 'You are an IAS officer in a district. Your superior asks you to manipulate data for a flagship scheme to show better performance before an important visit by a central minister.',
    stakeholders: ['You (the officer)', 'Superior (DM)', 'Minister', 'Local villagers', 'Media'],
    dilemmas: [
      'Speaking truth may harm your career',
      'Obeying orders means compromising integrity',
      'Villagers may lose benefits if scheme shows poor performance',
    ],
    questions: [
      'What would you do and why?',
      'What are the ethical principles involved?',
      'What could be the long-term consequences?',
    ],
  },
  {
    id: '2',
    title: 'The Bribe Situation',
    scenario: 'You are a customs officer. A businessman offers you a large bribe to overlook certain irregularities in his import documents. Your family is going through financial difficulties.',
    stakeholders: ['You', 'Businessman', 'Family', 'Government', 'Other honest officers'],
    dilemmas: [
      'Family needs vs professional ethics',
      'One-time mistake vs consistent integrity',
      'Fear of being caught vs fear of conscience',
    ],
    questions: [
      'What ethical choice would you make?',
      'How would this decision affect your self-respect?',
      'What alternatives exist?',
    ],
  },
  {
    id: '3',
    title: 'Whistleblower Dilemma',
    scenario: 'You discover that your company is involved in massive financial fraud. Reporting it could expose the fraud but also cost jobs of thousands of innocent employees.',
    stakeholders: ['You', 'Company management', 'Employees', 'Shareholders', 'Regulators'],
    dilemmas: [
      'Public interest vs employee livelihoods',
      'Loyalty to organization vs duty to society',
      'Personal safety vs moral obligation',
    ],
    questions: [
      'Should you report? Why or why not?',
      'What are the possible outcomes?',
      'How would you balance competing duties?',
    ],
  },
];

export default function EthicsPage() {
  const [selectedCase, setSelectedCase] = useState<CaseStudy | null>(null);
  const [userRole, setUserRole] = useState('');
  const [userResponse, setUserResponse] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<{
    principles: string[];
    virtues: string[];
    suggestions: string[];
  } | null>(null);

  const handleStartRoleplay = () => {
    if (!selectedCase || !userRole.trim()) {
      alert('Please select a case and enter your role');
      return;
    }
    setShowAnalysis(false);
    setUserResponse('');
  };

  const handleSubmitResponse = async () => {
    if (!userResponse.trim()) {
      alert('Please share your thoughts');
      return;
    }

    // Generate AI analysis in simple language
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
              content: 'You are an ethics teacher who explains concepts in SIMPLE 10th class English. Be encouraging and help students think clearly about moral dilemmas.',
            },
            {
              role: 'user',
              content: `A student is roleplaying as ${userRole} in this ethics case:

Case: ${selectedCase?.title}
Scenario: ${selectedCase?.scenario}

Their response:
"${userResponse}"

Please analyze their response in SIMPLE 10th class English.

Format:

## What They Said
[Simple summary of their main point]

## Ethical Principles Used
- Principle 1 (simple explanation)
- Principle 2 (simple explanation)

## Good Values Shown
- Virtue 1
- Virtue 2

## Suggestions to Think About
- Suggestion 1 (simple)
- Suggestion 2 (simple)

Keep it encouraging and easy to understand.`,
            },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Simple parsing
        const principles: string[] = [];
        const virtues: string[] = [];
        const suggestions: string[] = [];

        const lines = content.split('\n');
        let section = '';
        for (const line of lines) {
          if (line.includes('Principles')) section = 'principles';
          else if (line.includes('Values') || line.includes('Virtues')) section = 'virtues';
          else if (line.includes('Suggestions')) section = 'suggestions';
          else if (line.startsWith('-') && section) {
            const text = line.replace('-', '').trim();
            if (section === 'principles') principles.push(text);
            else if (section === 'virtues') virtues.push(text);
            else if (section === 'suggestions') suggestions.push(text);
          }
        }

        setAnalysis({ principles, virtues, suggestions });
      }
    } catch (error) {
      // Fallback simple analysis
      setAnalysis({
        principles: ['Integrity - being honest and having strong moral principles'],
        virtues: ['Courage - having the bravery to do what is right'],
        suggestions: ['Think about all stakeholders before making decisions', 'Consider long-term consequences'],
      });
    }

    setShowAnalysis(true);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Ethics Case Study Roleplay</h1>
          <p className="text-gray-400">Practice ethical decision-making through real-life scenarios</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Case Selection */}
          <div className="lg:col-span-1 space-y-4">
            <div className="neon-glass p-4 rounded-xl">
              <h3 className="font-bold text-white mb-3">Choose a Case</h3>
              <div className="space-y-2">
                {CASE_STUDIES.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    onClick={() => setSelectedCase(caseItem)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedCase?.id === caseItem.id
                        ? 'bg-neon-blue/20 border border-neon-blue/50'
                        : 'bg-slate-800/30 hover:bg-slate-800/50'
                    }`}
                  >
                    <p className="text-white text-sm font-medium">{caseItem.title}</p>
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{caseItem.scenario.substring(0, 60)}...</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedCase && (
              <div className="neon-glass p-4 rounded-xl">
                <h3 className="font-bold text-white mb-3">Your Role</h3>
                <input
                  type="text"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  placeholder="e.g., A honest police officer"
                  className="w-full p-3 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm mb-3"
                />
                <button
                  onClick={handleStartRoleplay}
                  disabled={!userRole.trim()}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  Start Roleplay
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Roleplay Area */}
          <div className="lg:col-span-2">
            {selectedCase ? (
              <div className="space-y-4">
                {/* Case Details */}
                <div className="neon-glass p-6 rounded-xl">
                  <h2 className="text-xl font-bold text-white mb-4">{selectedCase.title}</h2>
                  <p className="text-gray-300 mb-4">{selectedCase.scenario}</p>

                  {/* Stakeholders */}
                  <div className="mb-4">
                    <h4 className="text-neon-blue font-medium mb-2">People Involved (Stakeholders)</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCase.stakeholders.map((stakeholder, index) => (
                        <span key={index} className="px-3 py-1 bg-slate-800 text-gray-300 text-sm rounded-full">
                          {stakeholder}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Dilemmas */}
                  <div className="mb-4">
                    <h4 className="text-neon-blue font-medium mb-2">Difficult Choices</h4>
                    <ul className="space-y-1">
                      {selectedCase.dilemmas.map((dilemma, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="text-neon-blue mt-1">?</span>
                          {dilemma}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Questions to Think About */}
                  <div>
                    <h4 className="text-neon-blue font-medium mb-2">Think About</h4>
                    <ul className="space-y-1">
                      {selectedCase.questions.map((question, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-neon-blue/20 text-neon-blue text-xs flex items-center justify-center mt-0.5">
                            {index + 1}
                          </span>
                          {question}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Response Input */}
                <div className="neon-glass p-6 rounded-xl">
                  <h3 className="font-bold text-white mb-3">
                    Your Response (as {userRole || '...'})
                  </h3>
                  <textarea
                    value={userResponse}
                    onChange={(e) => setUserResponse(e.target.value)}
                    placeholder="What would you do? Think about what is right and wrong..."
                    className="w-full p-4 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm mb-4"
                    rows={6}
                  />
                  <button
                    onClick={handleSubmitResponse}
                    disabled={!userResponse.trim()}
                    className="btn-primary disabled:opacity-50"
                  >
                    Submit & Get Feedback
                  </button>
                </div>

                {/* AI Analysis */}
                {showAnalysis && analysis && (
                  <div className="neon-glass p-6 rounded-xl">
                    <h3 className="font-bold text-white mb-4">Feedback on Your Response</h3>

                    {/* Summary */}
                    <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm">
                        Thank you for sharing your thoughts! Here is some feedback to help you think more about this case.
                      </p>
                    </div>

                    {/* Principles */}
                    <div className="mb-4">
                      <h4 className="text-neon-blue font-medium mb-2">Ethical Principles to Consider</h4>
                      <ul className="space-y-2">
                        {analysis.principles.map((item, index) => (
                          <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1.5"></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Virtues */}
                    <div className="mb-4">
                      <h4 className="text-neon-blue font-medium mb-2">Good Values Shown</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysis.virtues.map((item, index) => (
                          <span key={index} className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Suggestions */}
                    <div>
                      <h4 className="text-neon-blue font-medium mb-2">Points to Think About</h4>
                      <ul className="space-y-2">
                        {analysis.suggestions.map((item, index) => (
                          <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">💡</span>
                            {item}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">Choose a Case to Begin</h3>
                <p className="text-gray-400">Select a case study from the left and practice ethical decision-making</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
