'use client';

/**
 * Case Law Explainer UI - Story 12.3
 * AC 1: Content types (SC cases, amendments, committees)
 * AC 2: Timeline visualization
 * AC 3: Manim animations config
 * AC 5: Video player (5-10 min)
 * AC 6: Quiz with 3-5 MCQs
 * AC 7: Related content links
 * AC 8: Search by name, year, subject
 * AC 9: PDF download
 * AC 10: Admin content addition
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface CaseLaw {
  id: string;
  title: string;
  content_type: string;
  year: number;
  citation: string;
  summary: string;
  background?: string;
  facts?: string;
  issues?: string[];
  held?: string;
  ratio_decidendi?: string;
  impact?: string;
  video_url?: string;
  video_status?: string;
  script_status?: string;
  timeline_events?: TimelineEvent[];
  animation_config?: any;
  related_articles?: string[];
  subject_area?: string[];
  keywords?: string[];
}

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  type: 'milestone' | 'amendment' | 'judgment' | 'event';
}

interface Quiz {
  id: string;
  total_questions: number;
  time_limit: number;
  questions: { id: string; question: string; options: string[] }[];
}

interface QuizResult {
  score: number;
  passed: boolean;
  correct_answers: number[];
  explanations: string[];
}

const CONTENT_TYPES: Record<string, { label: string; icon: string }> = {
  supreme_court_case: { label: 'Supreme Court Case', icon: '⚖️' },
  constitutional_amendment: { label: 'Constitutional Amendment', icon: '📜' },
  committee_report: { label: 'Committee Report', icon: '📋' },
  high_court_case: { label: 'High Court Case', icon: '🏛️' },
  tribunal_decision: { label: 'Tribunal Decision', icon: '🔨' },
  ordinance: { label: 'Ordinance', icon: '📝' },
  act: { label: 'Act', icon: '📖' }
};

export default function CaseLawPage() {
  const [view, setView] = useState<'list' | 'detail' | 'admin'>('list');
  const [cases, setCases] = useState<CaseLaw[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseLaw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizTime, setQuizTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAdmin] = useState(true);
  const [adminForm, setAdminForm] = useState({
    title: '', content_type: 'supreme_court_case', year: new Date().getFullYear(),
    citation: '', summary: '', background: '', facts: '', issues: '', held: '',
    impact: '', subject_area: '', keywords: ''
  });

  useEffect(() => { loadCases(); loadSubjects(); }, [filterType, filterYear, filterSubject]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'search' });
      if (searchQuery) params.set('q', searchQuery);
      if (filterType) params.set('type', filterType);
      if (filterYear) params.set('year', filterYear);
      if (filterSubject) params.set('subject', filterSubject);
      const res = await fetch(`/api/case-law?${params}`);
      const data = await res.json();
      if (data.success) setCases(data.cases || []);
    } catch { setError('Failed to load cases'); }
    finally { setLoading(false); }
  };

  const loadSubjects = async () => {
    try {
      const res = await fetch('/api/case-law?action=subjects');
      const data = await res.json();
      if (data.success) setSubjects(data.subjects || []);
    } catch { console.error('Failed to load subjects'); }
  };

  const loadCaseDetail = async (caseId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/case-law?action=detail&id=${caseId}`);
      const data = await res.json();
      if (data.success) { setSelectedCase(data.case_law); setView('detail'); loadQuiz(caseId); }
    } catch { setError('Failed to load case'); }
    finally { setLoading(false); }
  };

  const loadQuiz = async (caseId: string) => {
    try {
      const res = await fetch(`/api/case-law?action=quiz&caseId=${caseId}`);
      const data = await res.json();
      if (data.success && data.quiz) setQuiz(data.quiz);
    } catch { console.error('Failed to load quiz'); }
  };

  const submitQuiz = async () => {
    if (!quiz || !selectedCase) return;
    try {
      const res = await fetch('/api/case-law', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit-quiz', userId: 'user-id', quizId: quiz.id, answers: quizAnswers, timeTaken: quizTime })
      });
      const data = await res.json();
      if (data.success) { setQuizResult(data.result); setQuizStarted(false); }
    } catch { setError('Failed to submit quiz'); }
  };

  const generateScript = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch('/api/case-law', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-script', caseId: selectedCase.id })
      });
      const data = await res.json();
      if (data.success) setSelectedCase(prev => prev ? { ...prev, script_status: 'completed' } : null);
    } catch { setError('Failed to generate script'); }
  };

  const generateVideo = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch('/api/case-law', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-video', caseId: selectedCase.id })
      });
      const data = await res.json();
      if (data.success) setSelectedCase(prev => prev ? { ...prev, video_status: 'generating' } : null);
    } catch { setError('Failed to generate video'); }
  };

  const downloadPDF = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch('/api/case-law', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-pdf', caseId: selectedCase.id })
      });
      const data = await res.json();
      if (data.success) {
        await fetch('/api/case-law', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'track-progress', userId: 'user-id', caseId: selectedCase.id, downloaded: true })
        });
        alert('PDF generation started.');
      }
    } catch { setError('Failed to generate PDF'); }
  };

  const createCase = async () => {
    try {
      const res = await fetch('/api/case-law', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin-create', adminId: 'admin-id',
          data: { ...adminForm,
            issues: adminForm.issues.split(',').map(s => s.trim()).filter(Boolean),
            subject_area: adminForm.subject_area.split(',').map(s => s.trim()).filter(Boolean),
            keywords: adminForm.keywords.split(',').map(s => s.trim()).filter(Boolean)
          }
        })
      });
      const data = await res.json();
      if (data.success) { alert('Case created!'); setView('list'); loadCases(); }
    } catch { setError('Failed to create case'); }
  };

  const handleSearch = useCallback(() => { loadCases(); }, [searchQuery, filterType, filterYear, filterSubject]);

  // Timeline Component (AC 2)
  const TimelineVisualization = ({ events }: { events: TimelineEvent[] }) => {
    if (!events?.length) return null;
    const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const getColor = (type: string) => {
      switch (type) { case 'milestone': return 'bg-blue-500'; case 'amendment': return 'bg-purple-500';
        case 'judgment': return 'bg-green-500'; default: return 'bg-orange-500'; }
    };
    return (
      <div className="relative mt-6">
        <h3 className="text-lg font-semibold mb-4">Timeline</h3>
        <div className="absolute left-4 top-12 bottom-4 w-0.5 bg-gray-300" />
        <div className="space-y-6 pl-10">
          {sorted.map((event, i) => (
            <div key={i} className="relative">
              <div className={`absolute -left-8 w-4 h-4 rounded-full ${getColor(event.type)} ring-4 ring-white`} />
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-500">{event.date}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getColor(event.type)} text-white`}>{event.type}</span>
                </div>
                <h4 className="font-medium">{event.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Quiz Section (AC 6)
  const QuizSection = () => {
    if (!quiz) return null;
    if (quizResult) return (
      <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
        <h3 className="text-lg font-semibold mb-4">Quiz Results</h3>
        <div className={`text-center p-4 rounded-lg ${quizResult.passed ? 'bg-green-100' : 'bg-red-100'}`}>
          <p className="text-3xl font-bold">{quizResult.score}%</p>
          <p className="text-sm mt-1">{quizResult.passed ? 'Passed!' : 'Keep practicing!'}</p>
        </div>
        <button onClick={() => { setQuizResult(null); setQuizAnswers({}); }}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">Retake Quiz</button>
      </div>
    );
    if (!quizStarted) return (
      <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
        <h3 className="text-lg font-semibold mb-2">Test Your Understanding</h3>
        <p className="text-gray-600 mb-4">{quiz.total_questions} questions</p>
        <button onClick={() => setQuizStarted(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Start Quiz</button>
      </div>
    );
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
        <h3 className="text-lg font-semibold mb-4">Quiz</h3>
        <div className="space-y-6">
          {quiz.questions.map((q, idx) => (
            <div key={q.id} className="border rounded-lg p-4">
              <p className="font-medium mb-3">{idx + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, optIdx) => (
                  <label key={optIdx} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${quizAnswers[q.id] === optIdx ? 'bg-indigo-50' : ''}`}>
                    <input type="radio" name={q.id} checked={quizAnswers[q.id] === optIdx}
                      onChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: optIdx }))} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-6">
          <button onClick={submitQuiz} disabled={Object.keys(quizAnswers).length < quiz.questions.length}
            className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">Submit</button>
          <button onClick={() => { setQuizStarted(false); setQuizAnswers({}); }} className="px-4 py-2 border rounded-lg">Cancel</button>
        </div>
      </div>
    );
  };

  // Admin Form (AC 10)
  const AdminForm = () => (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Add New Case/Amendment</h2>
        <button onClick={() => setView('list')} className="text-gray-600">Back</button>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input type="text" value={adminForm.title} onChange={(e) => setAdminForm(prev => ({ ...prev, title: e.target.value }))}
            className="px-3 py-2 border rounded-lg" placeholder="Title" />
          <select value={adminForm.content_type} onChange={(e) => setAdminForm(prev => ({ ...prev, content_type: e.target.value }))}
            className="px-3 py-2 border rounded-lg">
            {Object.entries(CONTENT_TYPES).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input type="number" value={adminForm.year} onChange={(e) => setAdminForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
            className="px-3 py-2 border rounded-lg" placeholder="Year" />
          <input type="text" value={adminForm.citation} onChange={(e) => setAdminForm(prev => ({ ...prev, citation: e.target.value }))}
            className="px-3 py-2 border rounded-lg" placeholder="Citation" />
        </div>
        <textarea value={adminForm.summary} onChange={(e) => setAdminForm(prev => ({ ...prev, summary: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg h-24" placeholder="Summary" />
        <textarea value={adminForm.background} onChange={(e) => setAdminForm(prev => ({ ...prev, background: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Background" />
        <textarea value={adminForm.facts} onChange={(e) => setAdminForm(prev => ({ ...prev, facts: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Facts" />
        <input type="text" value={adminForm.issues} onChange={(e) => setAdminForm(prev => ({ ...prev, issues: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg" placeholder="Issues (comma-separated)" />
        <textarea value={adminForm.held} onChange={(e) => setAdminForm(prev => ({ ...prev, held: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Held/Decision" />
        <textarea value={adminForm.impact} onChange={(e) => setAdminForm(prev => ({ ...prev, impact: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg h-20" placeholder="Impact" />
        <div className="grid grid-cols-2 gap-4">
          <input type="text" value={adminForm.subject_area} onChange={(e) => setAdminForm(prev => ({ ...prev, subject_area: e.target.value }))}
            className="px-3 py-2 border rounded-lg" placeholder="Subject Areas (comma-separated)" />
          <input type="text" value={adminForm.keywords} onChange={(e) => setAdminForm(prev => ({ ...prev, keywords: e.target.value }))}
            className="px-3 py-2 border rounded-lg" placeholder="Keywords (comma-separated)" />
        </div>
        <div className="flex gap-4 pt-4">
          <button onClick={createCase} disabled={!adminForm.title || !adminForm.summary}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">Create</button>
          <button onClick={() => setView('list')} className="px-6 py-2 border rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );

  // Detail View
  const CaseDetailView = () => {
    if (!selectedCase) return null;
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <button onClick={() => { setView('list'); setSelectedCase(null); }} className="text-sm text-gray-600 mb-2">Back</button>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{CONTENT_TYPES[selectedCase.content_type]?.icon}</span>
              <div>
                <h1 className="text-2xl font-bold">{selectedCase.title}</h1>
                <p className="text-gray-600">{CONTENT_TYPES[selectedCase.content_type]?.label} - {selectedCase.year}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadPDF} className="px-4 py-2 border rounded-lg">PDF</button>
            <button className="px-4 py-2 border rounded-lg">Bookmark</button>
          </div>
        </div>
        {selectedCase.video_url ? (
          <div className="bg-black rounded-lg overflow-hidden mb-6">
            <video ref={videoRef} src={selectedCase.video_url} controls className="w-full" style={{ maxHeight: '400px' }} />
          </div>
        ) : (
          <div className="bg-gray-100 rounded-lg p-8 mb-6 text-center">
            {selectedCase.video_status === 'generating' ? (
              <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
            ) : (
              <div className="flex gap-3 justify-center">
                {selectedCase.script_status !== 'completed' && (
                  <button onClick={generateScript} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Generate Script</button>
                )}
                <button onClick={generateVideo} disabled={selectedCase.script_status !== 'completed'}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">Generate Video</button>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-3">Summary</h3>
              <p className="text-gray-700">{selectedCase.summary}</p>
            </div>
            {selectedCase.background && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold mb-3">Background</h3>
                <p className="text-gray-700">{selectedCase.background}</p>
              </div>
            )}
            {selectedCase.held && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold mb-3">Decision</h3>
                <p className="text-gray-700">{selectedCase.held}</p>
              </div>
            )}
            {selectedCase.impact && (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold mb-3">Impact</h3>
                <p className="text-gray-700">{selectedCase.impact}</p>
              </div>
            )}
            <TimelineVisualization events={selectedCase.timeline_events || []} />
            <QuizSection />
          </div>
          <div className="space-y-6">
            {selectedCase.related_articles && selectedCase.related_articles.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-sm font-semibold mb-3">Related Articles</h3>
                <div className="space-y-2">
                  {selectedCase.related_articles?.map((art, i) => (
                    <div key={i} className="p-2 bg-gray-50 rounded text-sm">{art}</div>
                  ))}
                </div>
              </div>
            )}
            {selectedCase.keywords && selectedCase.keywords.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-sm font-semibold mb-3">Keywords</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedCase.keywords?.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // List View
  const CaseListView = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Case Law Explainer</h1>
          <p className="text-gray-600">Interactive legal timelines for UPSC</p>
        </div>
        {isAdmin && <button onClick={() => setView('admin')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">+ Add</button>}
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search cases..." className="md:col-span-2 px-4 py-2 border rounded-lg" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All Types</option>
            {Object.entries(CONTENT_TYPES).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}
          </select>
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All Subjects</option>
            {subjects.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div className="flex gap-4 mt-3">
          <input type="number" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
            placeholder="Year" className="w-24 px-3 py-2 border rounded-lg" />
          <button onClick={handleSearch} className="px-6 py-2 bg-indigo-600 text-white rounded-lg">Search</button>
          <button onClick={() => { setSearchQuery(''); setFilterType(''); setFilterYear(''); setFilterSubject(''); }}
            className="px-4 py-2 border rounded-lg">Clear</button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No cases found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map(c => (
            <div key={c.id} onClick={() => loadCaseDetail(c.id)}
              className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md cursor-pointer">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{CONTENT_TYPES[c.content_type]?.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold line-clamp-2">{c.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{CONTENT_TYPES[c.content_type]?.label} - {c.year}</p>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.summary}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={() => setError('')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Dismiss</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {view === 'list' && <CaseListView />}
      {view === 'detail' && <CaseDetailView />}
      {view === 'admin' && <AdminForm />}
    </div>
  );
}
