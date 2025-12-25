'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';

interface EssayTopic {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  sample_thesis?: string;
  example_points?: string[];
}

const ESSAY_CATEGORIES = [
  { id: 'all', label: 'All Topics' },
  { id: 'philosophical', label: 'Philosophical' },
  { id: 'social', label: 'Social Issues' },
  { id: 'political', label: 'Political' },
  { id: 'economic', label: 'Economic' },
  { id: 'environmental', label: 'Environmental' },
  { id: 'scientific', label: 'Scientific' },
  { id: 'literary', label: 'Literary' },
];

// Sample essay topics
const SAMPLE_TOPICS: EssayTopic[] = [
  {
    id: '1',
    title: 'Education without values is as useless as a flower without fragrance',
    category: 'philosophical',
    keywords: ['education', 'values', 'morality', 'character', 'nation building'],
    sample_thesis: 'True education transforms not just the mind but also the heart, making character development as important as intellectual growth.',
    example_points: [
      'A surgeon with technical skills but no empathy can harm patients',
      'History shows educated nations that lacked moral compass caused great harm',
      'Ancient Gurukul system emphasized character building alongside knowledge',
    ],
  },
  {
    id: '2',
    title: 'Technology is best when it brings people together',
    category: 'social',
    keywords: ['technology', 'social media', 'connection', 'digital age', 'isolation'],
    sample_thesis: 'While technology has the potential to connect billions, its true value lies in how we use it to foster genuine human connections.',
    example_points: [
      'Social media helped families stay connected during COVID lockdowns',
      'But also led to increased loneliness in some studies',
      'Need balance between digital and physical interactions',
    ],
  },
  {
    id: '3',
    title: 'Democracy dies in darkness',
    category: 'political',
    keywords: ['democracy', 'transparency', 'media freedom', 'accountability'],
    sample_thesis: 'A free press and transparent institutions are the twin pillars upon which democratic governance stands.',
    example_points: [
      'Watergate investigation showed importance of investigative journalism',
      'In India, RTI empowered citizens to demand accountability',
      'Media censorship leads to uninformed electorate',
    ],
  },
];

export default function EssayPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customTopic, setCustomTopic] = useState('');
  const [generatedEssay, setGeneratedEssay] = useState<{
    title: string;
    introduction: string;
    body: string[];
    conclusion: string;
    tips: string[];
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedEssays, setSavedEssays] = useState<any[]>([]);

  // Filter topics
  const filteredTopics = selectedCategory === 'all'
    ? SAMPLE_TOPICS
    : SAMPLE_TOPICS.filter(t => t.category === selectedCategory);

  const handleGenerateEssay = async (topic: string) => {
    setIsGenerating(true);

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
              content: 'You are an expert UPSC essay teacher. Write in SIMPLE 10th class English. Help students write clear, well-structured essays.',
            },
            {
              role: 'user',
              content: `Write a complete essay on: "${topic}"

Write in SIMPLE 10th class English.

Format your response exactly like this:

# ESSAY_TITLE: [topic]

## INTRODUCTION
[2-3 simple paragraphs introducing the topic. Use simple words and short sentences.]

## MAIN BODY

### Point 1
[Simple explanation with example]

### Point 2
[Simple explanation with example]

### Point 3
[Simple explanation with example]

## CONCLUSION
[2-3 simple paragraphs summing up the main points]

## TIPS FOR MARKS
- Tip 1 (simple)
- Tip 2 (simple)
- Tip 3 (simple)

Remember: Write in simple English that a 10th class student can understand.`,
            },
          ],
          max_tokens: 4000,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse the response
        const lines = content.split('\n');
        let currentSection = '';
        const essay: any = {
          title: topic,
          introduction: '',
          body: [],
          conclusion: '',
          tips: [],
        };

        for (const line of lines) {
          if (line.startsWith('## INTRODUCTION')) {
            currentSection = 'introduction';
          } else if (line.startsWith('## MAIN BODY') || line.startsWith('### Point')) {
            currentSection = 'body';
          } else if (line.startsWith('## CONCLUSION')) {
            currentSection = 'conclusion';
          } else if (line.startsWith('## TIPS')) {
            currentSection = 'tips';
          } else if (line.startsWith('##') || line.startsWith('#')) {
            currentSection = '';
          } else {
            if (currentSection === 'introduction') {
              essay.introduction += line + '\n';
            } else if (currentSection === 'body' && line.trim()) {
              if (line.startsWith('###')) {
                essay.body.push(line.replace('###', '').trim());
              } else {
                const lastPoint = essay.body[essay.body.length - 1];
                if (lastPoint && !lastPoint.includes(':')) {
                  essay.body[essay.body.length - 1] = lastPoint + ' ' + line.trim();
                }
              }
            } else if (currentSection === 'conclusion') {
              essay.conclusion += line + '\n';
            } else if (currentSection === 'tips' && line.trim().startsWith('-')) {
              essay.tips.push(line.replace('-', '').trim());
            }
          }
        }

        setGeneratedEssay(essay);
      }
    } catch (error) {
      console.error('Failed to generate essay:', error);
      alert('Failed to generate essay. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveEssay = async () => {
    if (!generatedEssay) return;

    const { error } = await supabase.from('user_essays').insert({
      title: generatedEssay.title,
      content: JSON.stringify(generatedEssay),
      category: 'general',
    });

    if (!error) {
      alert('Essay saved!');
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Essay Writing Practice</h1>
          <p className="text-gray-400">Learn to write clear, structured essays in simple language</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Topics */}
          <div className="lg:col-span-1 space-y-4">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {ESSAY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-neon-blue text-black'
                      : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Sample Topics */}
            <div className="neon-glass p-4 rounded-xl">
              <h3 className="font-bold text-white mb-3">Practice Topics</h3>
              <div className="space-y-2">
                {filteredTopics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => handleGenerateEssay(topic.title)}
                    disabled={isGenerating}
                    className="w-full text-left p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors disabled:opacity-50"
                  >
                    <p className="text-white text-sm">{topic.title}</p>
                    <span className="text-xs text-gray-500 capitalize">{topic.category}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Topic */}
            <div className="neon-glass p-4 rounded-xl">
              <h3 className="font-bold text-white mb-3">Write on Your Topic</h3>
              <textarea
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Enter your essay topic..."
                className="w-full p-3 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm mb-3"
                rows={3}
              />
              <button
                onClick={() => handleGenerateEssay(customTopic)}
                disabled={isGenerating || !customTopic.trim()}
                className="w-full btn-primary disabled:opacity-50"
              >
                Generate Essay
              </button>
            </div>
          </div>

          {/* Right Column - Essay Output */}
          <div className="lg:col-span-2">
            {isGenerating ? (
              <div className="neon-glass p-12 rounded-xl text-center">
                <div className="animate-spin w-10 h-10 border-2 border-neon-blue border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Writing your essay...</p>
                <p className="text-gray-500 text-sm mt-2">Using simple 10th class English</p>
              </div>
            ) : generatedEssay ? (
              <div className="neon-glass p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">{generatedEssay.title}</h2>
                  <button
                    onClick={saveEssay}
                    className="px-4 py-2 bg-neon-blue/20 text-neon-blue rounded-lg text-sm hover:bg-neon-blue/30 transition-colors"
                  >
                    Save Essay
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Introduction */}
                  <div>
                    <h3 className="text-neon-blue font-medium mb-2">Introduction</h3>
                    <p className="text-gray-300 whitespace-pre-line">{generatedEssay.introduction}</p>
                  </div>

                  {/* Body */}
                  <div>
                    <h3 className="text-neon-blue font-medium mb-2">Main Body</h3>
                    {generatedEssay.body.map((point, index) => (
                      <div key={index} className="mb-3 pl-4 border-l-2 border-neon-blue/30">
                        <p className="text-gray-300">{point}</p>
                      </div>
                    ))}
                  </div>

                  {/* Conclusion */}
                  <div>
                    <h3 className="text-neon-blue font-medium mb-2">Conclusion</h3>
                    <p className="text-gray-300 whitespace-pre-line">{generatedEssay.conclusion}</p>
                  </div>

                  {/* Tips */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h3 className="text-neon-blue font-medium mb-2">Tips for Good Marks</h3>
                    <ul className="space-y-1">
                      {generatedEssay.tips.map((tip, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-blue mt-1.5"></span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="neon-glass p-12 rounded-xl text-center">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">Start Writing</h3>
                <p className="text-gray-400">Select a topic or enter your own to generate a sample essay</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
