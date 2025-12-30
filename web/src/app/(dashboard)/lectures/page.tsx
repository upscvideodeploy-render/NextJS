'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { VideoPlayer } from '@/components/VideoPlayer';

interface Lecture {
  id: string;
  title: string;
  topic: string;
  subject: string;
  duration_minutes: number;
  instructor: string;
  thumbnail_url?: string;
  video_url?: string;
  description: string;
  transcript?: string;
}

const SAMPLE_LECTURES: Lecture[] = [
  {
    id: '1',
    title: 'Indian Constitution - Making and Evolution',
    topic: 'Polity',
    subject: 'GS Paper II',
    duration_minutes: 45,
    instructor: 'Dr. Raj Vikram',
    description: 'Learn how the Indian Constitution was made and how it has evolved over 70+ years.',
    transcript: 'Introduction: The Indian Constitution is the longest written constitution in the world...',
  },
  {
    id: '2',
    title: 'Modern Indian History - From 1707 to 1947',
    topic: 'History',
    subject: 'GS Paper I',
    duration_minutes: 60,
    instructor: 'Prof. Anjali Sharma',
    description: 'Complete coverage of modern Indian history from the fall of Mughals to independence.',
    transcript: 'Chapter 1: The decline of Mughal Empire began in the early 18th century...',
  },
  {
    id: '3',
    title: 'Indian Economy - Current Challenges',
    topic: 'Economy',
    subject: 'GS Paper III',
    duration_minutes: 50,
    instructor: 'Dr. Amit Kumar',
    description: 'Understanding major economic challenges facing India today.',
    transcript: 'India is one of the fastest growing economies in the world...',
  },
  {
    id: '4',
    title: 'Environment and Ecology - Key Concepts',
    topic: 'Environment',
    subject: 'GS Paper III',
    duration_minutes: 40,
    instructor: 'Dr. Priya Singh',
    description: 'Important concepts in environment and ecology for UPSC.',
    transcript: 'Biodiversity refers to the variety of life on Earth...',
  },
  {
    id: '5',
    title: 'Ethics in Administration',
    topic: 'Ethics',
    subject: 'GS Paper IV',
    duration_minutes: 35,
    instructor: 'Prof. Sanjay Mehta',
    description: 'Understanding ethical dimensions of public administration.',
    transcript: 'Public administration is a noble profession...',
  },
];

const SUBJECTS = [
  'All Subjects',
  'GS Paper I',
  'GS Paper II',
  'GS Paper III',
  'GS Paper IV',
  'CSAT',
  'Essay',
];

const TOPICS = [
  'All Topics',
  'Polity',
  'History',
  'Economy',
  'Environment',
  'Geography',
  'Science & Tech',
  'International Relations',
  'Ethics',
];

export default function LecturesPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedTopic, setSelectedTopic] = useState('All Topics');
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [watchProgress, setWatchProgress] = useState<Record<string, number>>({});
  const [savedLectures, setSavedLectures] = useState<string[]>([]);

  // Filter lectures
  const filteredLectures = SAMPLE_LECTURES.filter((lecture) => {
    const subjectMatch = selectedSubject === 'All Subjects' || lecture.subject === selectedSubject;
    const topicMatch = selectedTopic === 'All Topics' || lecture.topic === selectedTopic;
    return subjectMatch && topicMatch;
  });

  const handleSaveLecture = (lectureId: string) => {
    if (savedLectures.includes(lectureId)) {
      setSavedLectures(savedLectures.filter(id => id !== lectureId));
    } else {
      setSavedLectures([...savedLectures, lectureId]);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Lectures & Documentaries</h1>
          <p className="text-gray-400">Watch educational videos to strengthen your preparation</p>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
          >
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>

          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white"
          >
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>

          <div className="flex-1"></div>

          <button
            onClick={() => setSelectedLecture(null)}
            className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-gray-300 hover:bg-slate-700"
          >
            View All Lectures
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Lecture List */}
          <div className="lg:col-span-2 space-y-4">
            {filteredLectures.length > 0 ? (
              filteredLectures.map((lecture) => (
                <div
                  key={lecture.id}
                  onClick={() => {
                    setSelectedLecture(lecture);
                    setShowTranscript(false);
                  }}
                  className={`neon-glass p-4 rounded-xl cursor-pointer transition-all ${
                    selectedLecture?.id === lecture.id
                      ? 'border-neon-blue/50'
                      : 'hover:border-white/20'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-32 h-20 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-neon-blue/20 text-neon-blue text-xs rounded">
                          {lecture.subject}
                        </span>
                        <span className="text-xs text-gray-500">{lecture.topic}</span>
                      </div>
                      <h3 className="text-white font-medium mb-1">{lecture.title}</h3>
                      <p className="text-gray-400 text-sm mb-2 line-clamp-2">{lecture.description}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{lecture.instructor}</span>
                        <span>•</span>
                        <span>{formatDuration(lecture.duration_minutes)}</span>
                        {watchProgress[lecture.id] > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-neon-blue">
                              {Math.round((watchProgress[lecture.id] / (lecture.duration_minutes * 60)) * 100)}% watched
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveLecture(lecture.id);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        savedLectures.includes(lecture.id)
                          ? 'text-neon-blue bg-neon-blue/20'
                          : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      <svg className="w-5 h-5" fill={savedLectures.includes(lecture.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-medium text-white mb-2">No Lectures Found</h3>
                <p className="text-gray-400">Try changing your filters</p>
              </div>
            )}
          </div>

          {/* Right Column - Player/Detail */}
          <div className="lg:col-span-1">
            {selectedLecture ? (
              <div className="space-y-4">
                {/* Video Player Placeholder */}
                <div className="neon-glass p-4 rounded-xl">
                  <VideoPlayer
                    src={selectedLecture.video_url || ''}
                    title={selectedLecture.title}
                    onComplete={() => {
                      setWatchProgress({
                        ...watchProgress,
                        [selectedLecture.id]: selectedLecture.duration_minutes * 60,
                      });
                    }}
                  />
                </div>

                {/* Lecture Info */}
                <div className="neon-glass p-4 rounded-xl">
                  <h2 className="text-lg font-bold text-white mb-2">{selectedLecture.title}</h2>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-400">{selectedLecture.instructor}</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-sm text-gray-400">{formatDuration(selectedLecture.duration_minutes)}</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-4">{selectedLecture.description}</p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="flex-1 px-4 py-2 bg-slate-800 rounded-lg text-gray-300 hover:bg-slate-700 text-sm"
                    >
                      {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
                    </button>
                    <button
                      onClick={() => handleSaveLecture(selectedLecture.id)}
                      className="px-4 py-2 bg-slate-800 rounded-lg text-gray-300 hover:bg-slate-700 text-sm"
                    >
                      <svg className="w-5 h-5" fill={savedLectures.includes(selectedLecture.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Transcript */}
                {showTranscript && selectedLecture.transcript && (
                  <div className="neon-glass p-4 rounded-xl max-h-64 overflow-y-auto">
                    <h3 className="font-bold text-white mb-2">Transcript</h3>
                    <p className="text-gray-300 text-sm whitespace-pre-line">
                      {selectedLecture.transcript}
                    </p>
                  </div>
                )}

                {/* Related Lectures */}
                <div className="neon-glass p-4 rounded-xl">
                  <h3 className="font-bold text-white mb-3">Related Lectures</h3>
                  <div className="space-y-2">
                    {SAMPLE_LECTURES
                      .filter((l) => l.id !== selectedLecture.id && l.topic === selectedLecture.topic)
                      .slice(0, 3)
                      .map((lecture) => (
                        <button
                          key={lecture.id}
                          onClick={() => {
                            setSelectedLecture(lecture);
                            setShowTranscript(false);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                        >
                          <p className="text-white text-sm">{lecture.title}</p>
                          <span className="text-xs text-gray-500">{formatDuration(lecture.duration_minutes)}</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="neon-glass p-6 rounded-xl">
                <h3 className="font-bold text-white mb-3">Select a Lecture</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Click on any lecture from the list to start watching
                </p>

                {/* Learning Tips */}
                <div className="space-y-3">
                  <h4 className="text-neon-blue font-medium">Learning Tips</h4>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-neon-blue mt-1">•</span>
                      Take notes while watching
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-neon-blue mt-1">•</span>
                      Pause and reflect on key points
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-neon-blue mt-1">•</span>
                      Review the transcript afterward
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-neon-blue mt-1">•</span>
                      Save lectures for quick revision
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
