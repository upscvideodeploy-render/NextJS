/**
 * Story 9.8: Bookmark Detail Page with Related Content
 * AC 6: Shows "Related Content" section with cards
 * AC 7: Smart suggestions
 * AC 8: Cross-topic discovery
 * AC 9: PYQ connection
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Bookmark {
  id: string;
  title: string;
  content_type: string;
  snippet?: string;
  tags: string[];
  context: Record<string, unknown>;
  bookmarked_at: string;
}

interface RelatedContent {
  link_id: string;
  content_type: string;
  content_id: string;
  link_type: string;
  relevance_score: number;
  metadata: Record<string, unknown>;
  title?: string;
  snippet?: string;
}

interface CrossSubjectLink {
  subject1: string;
  subject2: string;
  connection_topic: string;
  related_content_id: string;
  related_content_type: string;
}

interface Suggestion {
  content_type: string;
  content_id: string;
  title: string;
  reason: string;
  confidence: number;
}

interface PYQAppearance {
  pyq_id: string;
  year: number;
  paper: string;
  question_preview: string;
  relevance_score: number;
}

const LINK_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  related_topic: { label: 'Related Topics', icon: '📚', color: 'bg-blue-100 text-blue-700' },
  related_pyq: { label: 'Related PYQs', icon: '📋', color: 'bg-yellow-100 text-yellow-700' },
  related_video: { label: 'Related Videos', icon: '🎥', color: 'bg-purple-100 text-purple-700' },
  also_bookmarked: { label: 'Also Bookmarked', icon: '🔖', color: 'bg-green-100 text-green-700' },
  cross_subject: { label: 'Cross-Subject', icon: '🔗', color: 'bg-orange-100 text-orange-700' },
  similar_concept: { label: 'Similar Concepts', icon: '💡', color: 'bg-pink-100 text-pink-700' }
};

const CONTENT_TYPE_PATHS: Record<string, string> = {
  note: '/notes',
  video: '/videos',
  question: '/practice',
  topic: '/topics',
  mindmap: '/mindmap',
  pyq: '/pyq'
};

export default function BookmarkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookmarkId = params.id as string;

  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [relatedContent, setRelatedContent] = useState<RelatedContent[]>([]);
  const [crossSubjectLinks, setCrossSubjectLinks] = useState<CrossSubjectLink[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pyqAppearances, setPyqAppearances] = useState<PYQAppearance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [linkingResult, setLinkingResult] = useState<{ success: boolean; count: number } | null>(null);

  // Fetch bookmark and related content
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch bookmark details
        const bookmarkRes = await fetch(`/api/bookmarks?id=${bookmarkId}`);
        const bookmarkData = await bookmarkRes.json();
        
        if (bookmarkData.bookmarks?.length) {
          setBookmark(bookmarkData.bookmarks[0]);
        }

        // Fetch related content
        const linksRes = await fetch(`/api/bookmarks/links?bookmark_id=${bookmarkId}`);
        const linksData = await linksRes.json();

        setRelatedContent(linksData.related_content || []);
        setCrossSubjectLinks(linksData.cross_subject_links || []);
        setSuggestions(linksData.suggestions || []);

        // AC 9: Fetch PYQ appearances if we have a title
        if (bookmarkData.bookmarks?.[0]?.title) {
          const pyqRes = await fetch('/api/bookmarks/links', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concept: bookmarkData.bookmarks[0].title })
          });
          const pyqData = await pyqRes.json();
          setPyqAppearances(pyqData.pyq_appearances || []);
        }

      } catch (error) {
        console.error('Failed to fetch bookmark data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (bookmarkId) {
      fetchData();
    }
  }, [bookmarkId]);

  // Trigger auto-linking
  const triggerLinking = async () => {
    setIsLinking(true);
    try {
      const res = await fetch('/api/bookmarks/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmark_id: bookmarkId })
      });
      const data = await res.json();
      setLinkingResult({ success: data.success, count: data.links_created });

      // Refresh related content
      const linksRes = await fetch(`/api/bookmarks/links?bookmark_id=${bookmarkId}`);
      const linksData = await linksRes.json();
      setRelatedContent(linksData.related_content || []);
      setCrossSubjectLinks(linksData.cross_subject_links || []);

    } catch (error) {
      console.error('Failed to trigger linking:', error);
      setLinkingResult({ success: false, count: 0 });
    } finally {
      setIsLinking(false);
    }
  };

  // Group related content by type
  const groupedContent = relatedContent.reduce((acc, item) => {
    const type = item.link_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, RelatedContent[]>);

  // Get content link
  const getContentLink = (type: string, id: string) => {
    const basePath = CONTENT_TYPE_PATHS[type] || '/bookmarks';
    return `${basePath}/${id}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bookmark) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-gray-500">Bookmark not found</p>
          <Link href="/bookmarks" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Bookmarks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Bookmark Details</h1>
        </div>

        {/* Bookmark Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🔖</span>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">{bookmark.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {bookmark.content_type} • Bookmarked {new Date(bookmark.bookmarked_at).toLocaleDateString()}
              </p>
              {bookmark.snippet && (
                <p className="text-gray-600 mt-3">{bookmark.snippet}</p>
              )}
              {bookmark.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {bookmark.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Refresh Links Button */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
            <button
              onClick={triggerLinking}
              disabled={isLinking}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLinking ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Finding Links...
                </>
              ) : (
                <>
                  🔍 Find Related Content
                </>
              )}
            </button>
            {linkingResult && (
              <span className={`text-sm ${linkingResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {linkingResult.success 
                  ? `Found ${linkingResult.count} related items!` 
                  : 'Failed to find links'}
              </span>
            )}
          </div>
        </div>

        {/* AC 7: Smart Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              💡 You might also like
            </h3>
            <div className="flex flex-wrap gap-3">
              {suggestions.map((suggestion, idx) => (
                <Link
                  key={idx}
                  href={getContentLink(suggestion.content_type, suggestion.content_id)}
                  className="px-4 py-2 bg-white rounded-lg border border-blue-200 hover:border-blue-400 transition-colors"
                >
                  <span className="font-medium text-gray-900">{suggestion.title}</span>
                  <span className="text-xs text-gray-500 block">{suggestion.reason}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AC 8: Cross-Subject Connections */}
        {crossSubjectLinks.length > 0 && (
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              🔗 Cross-Subject Connections
            </h3>
            <div className="space-y-3">
              {crossSubjectLinks.map((link, idx) => (
                <Link
                  key={idx}
                  href={getContentLink(link.related_content_type, link.related_content_id)}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-200 hover:border-orange-400 transition-colors"
                >
                  <span className="font-medium text-orange-700">{link.subject1}</span>
                  <span className="text-gray-400">↔</span>
                  <span className="font-medium text-orange-700">{link.subject2}</span>
                  <span className="text-gray-500 text-sm ml-auto">{link.connection_topic}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AC 9: PYQ Appearances */}
        {pyqAppearances.length > 0 && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              📋 This concept appeared in UPSC exams
            </h3>
            <div className="space-y-3">
              {pyqAppearances.map((pyq, idx) => (
                <Link
                  key={idx}
                  href={`/pyq/${pyq.pyq_id}`}
                  className="block p-3 bg-white rounded-lg border border-yellow-200 hover:border-yellow-400 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-sm font-medium">
                      {pyq.year}
                    </span>
                    <span className="text-gray-600 text-sm">{pyq.paper}</span>
                  </div>
                  <p className="text-gray-700 text-sm">{pyq.question_preview}...</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AC 6: Related Content by Type */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 p-4">Related Content</h3>
            
            {/* Type Tabs */}
            {Object.keys(groupedContent).length > 0 && (
              <div className="flex overflow-x-auto px-4 pb-2 gap-2">
                <button
                  onClick={() => setActiveTab(null)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                    activeTab === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  All ({relatedContent.length})
                </button>
                {Object.entries(groupedContent).map(([type, items]) => {
                  const config = LINK_TYPE_CONFIG[type] || { label: type, icon: '📄', color: 'bg-gray-100' };
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveTab(type)}
                      className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex items-center gap-1 ${
                        activeTab === type ? config.color : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {config.icon} {config.label} ({items.length})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Content Cards */}
          <div className="p-4">
            {relatedContent.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No related content found yet.</p>
                <button
                  onClick={triggerLinking}
                  className="text-blue-600 hover:underline mt-2"
                >
                  Click to discover connections
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(activeTab ? groupedContent[activeTab] || [] : relatedContent).map((item) => {
                  const config = LINK_TYPE_CONFIG[item.link_type] || { label: item.link_type, icon: '📄', color: 'bg-gray-100' };
                  return (
                    <Link
                      key={item.link_id}
                      href={getContentLink(item.content_type, item.content_id)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs ${config.color}`}>
                          {config.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {item.title || 'Related Item'}
                          </h4>
                          {item.snippet && (
                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                              {item.snippet}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-400">{item.content_type}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                              {Math.round(item.relevance_score * 100)}% match
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
