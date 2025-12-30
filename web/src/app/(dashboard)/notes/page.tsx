'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Notes {
  id: string;
  title: string;
  topic: string;
  level: 'basic' | 'intermediate' | 'advanced';
  content: string;
  word_count: number;
  reading_time_minutes: number;
  created_at: string;
  metadata?: any;
}

interface NotesDetailModalProps {
  notes: Notes | null;
  isOpen: boolean;
  onClose: () => void;
}

function NotesDetailModal({ notes, isOpen, onClose }: NotesDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !notes) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(notes.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: notes.title,
        text: notes.content.substring(0, 200) + '...',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(notes.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportPDF = async () => {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${notes.title}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
            h1 { color: #333; }
            .meta { color: #666; font-size: 14px; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${notes.title}</h1>
          <div class="meta">
            <p>Topic: ${notes.topic} | Level: ${notes.level}</p>
            <p>Words: ${notes.word_count} | Reading Time: ${notes.reading_time_minutes} min</p>
          </div>
          <hr>
          <div class="content">${notes.content}</div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-2 py-0.5 rounded text-xs border ${
                  notes.level === 'basic'
                    ? 'text-green-400 bg-green-400/10 border-green-400/30'
                    : notes.level === 'intermediate'
                    ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
                    : 'text-purple-400 bg-purple-400/10 border-purple-400/30'
                }`}
              >
                {notes.level}
              </span>
              <span className="text-sm text-gray-400">{notes.topic}</span>
            </div>
            <h2 className="text-xl font-bold text-white">{notes.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Export PDF"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={handleShare}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Share"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title={copied ? 'Copied!' : 'Copy'}
            >
              {copied ? (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-gray-200 leading-relaxed">
              {notes.content}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-800/50 flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {notes.word_count} words
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {notes.reading_time_minutes} min read
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(notes.created_at).toLocaleDateString()}
            </span>
          </div>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

const TOPICS = [
  'Polity',
  'History',
  'Geography',
  'Economy',
  'Environment',
  'Science & Tech',
  'International Relations',
  'Ethics',
];

const LEVELS = [
  { id: 'basic', label: 'Basic', description: 'Fundamental concepts' },
  { id: 'intermediate', label: 'Intermediate', description: 'Detailed analysis' },
  { id: 'advanced', label: 'Advanced', description: 'In-depth exploration' },
];

export default function NotesPage() {
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient(
  );

  const [notes, setNotes] = useState<Notes[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(searchParams.get('topic') || '');
  const [selectedLevel, setSelectedLevel] = useState<'basic' | 'intermediate' | 'advanced'>('basic');
  const [customTopic, setCustomTopic] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<Notes | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Fetch user's notes
  useEffect(() => {
    const fetchNotes = async () => {
      let query = supabase.from('comprehensive_notes').select('*');

      if (selectedTopic) {
        query = query.eq('topic', selectedTopic);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data) {
        setNotes(data as Notes[]);
      }
    };

    fetchNotes();
  }, [selectedTopic, supabase]);

  const handleGenerateNotes = async () => {
    const topic = selectedTopic || customTopic;
    if (!topic) {
      alert('Please select or enter a topic');
      return;
    }

    setIsGenerating(true);
    setShowPaywall(false);

    try {
      const { data, error } = await supabase.functions.invoke('notes_generation_pipe', {
        body: {
          topic,
          level: selectedLevel,
          format: 'mixed',
          include_diagrams: true,
          include_examples: true,
        },
      });

      if (error) {
        if (error.message?.includes('entitlement') || error.message?.includes('paywall')) {
          setShowPaywall(true);
          return;
        }
        throw error;
      }

      // Refresh notes list
      const { data: notesData } = await supabase
        .from('comprehensive_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (notesData) {
        setNotes(notesData as Notes[]);
      }
    } catch (error) {
      console.error('Failed to generate notes:', error);
      alert('Failed to generate notes. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const openNotesDetail = (note: Notes) => {
    setSelectedNotes(note);
    setShowDetail(true);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Comprehensive Notes</h1>
          <p className="text-gray-400">Generate AI-synthesized notes from UPSC syllabus topics</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Generator Section */}
          <div className="lg:col-span-1">
            <div className="neon-glass p-6 rounded-xl sticky top-6">
              <h2 className="text-xl font-bold text-white mb-4">Generate New Notes</h2>

              {/* Topic Selection */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Select Topic</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => {
                    setSelectedTopic(e.target.value);
                    setCustomTopic('');
                  }}
                  className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                >
                  <option value="">Choose a topic...</option>
                  {TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Topic */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Or Enter Custom Topic</label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => {
                    setCustomTopic(e.target.value);
                    setSelectedTopic('');
                  }}
                  placeholder="e.g., Fundamental Rights"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
                />
              </div>

              {/* Level Selection */}
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Level</label>
                <div className="space-y-2">
                  {LEVELS.map((level) => (
                    <label
                      key={level.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedLevel === level.id
                          ? 'bg-neon-blue/20 border border-neon-blue/50'
                          : 'bg-slate-800/30 border border-transparent hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="level"
                        value={level.id}
                        checked={selectedLevel === level.id}
                        onChange={() => setSelectedLevel(level.id as any)}
                        className="w-4 h-4 text-neon-blue"
                      />
                      <div>
                        <p className="text-white font-medium">{level.label}</p>
                        <p className="text-xs text-gray-400">{level.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateNotes}
                disabled={isGenerating}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Generate Notes'
                )}
              </button>

              <p className="mt-4 text-xs text-gray-500 text-center">
                Notes are generated from standard UPSC reference books
              </p>
            </div>
          </div>

          {/* Notes List */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-xl font-bold text-white">Your Notes</h2>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm"
              >
                <option value="">All Topics</option>
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => openNotesDetail(note)}
                    className="neon-glass p-6 rounded-xl hover:border-neon-blue/30 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs border ${
                              note.level === 'basic'
                                ? 'text-green-400 bg-green-400/10 border-green-400/30'
                                : note.level === 'intermediate'
                                ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
                                : 'text-purple-400 bg-purple-400/10 border-purple-400/30'
                            }`}
                          >
                            {note.level}
                          </span>
                          <span className="text-sm text-gray-400">{note.topic}</span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{note.title}</h3>
                        <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                          {note.content.substring(0, 150)}...
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            {note.word_count} words
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {note.reading_time_minutes} min read
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            {new Date(note.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">No notes yet</h3>
                <p className="text-gray-400">
                  Generate your first set of notes using the panel on the left
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Paywall Modal */}
        {showPaywall && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="neon-glass p-8 rounded-2xl max-w-md w-full text-center">
              <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-neon-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Upgrade to Pro</h3>
              <p className="text-gray-400 mb-6">
                Notes generation is available to Pro subscribers. Start your 7-day free trial to
                unlock this feature.
              </p>
              <button
                onClick={() => setShowPaywall(false)}
                className="btn-primary w-full mb-3"
              >
                Start Free Trial
              </button>
              <button
                onClick={() => setShowPaywall(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {/* Notes Detail Modal */}
        <NotesDetailModal
          notes={selectedNotes}
          isOpen={showDetail}
          onClose={() => setShowDetail(false)}
        />
      </div>
    </div>
  );
}
