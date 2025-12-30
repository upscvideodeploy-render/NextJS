'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Certificate {
  id: string;
  certificate_number: string;
  title: string;
  description: string;
  recipient_name: string;
  achievement: string;
  details_json: any;
  certificate_url: string;
  verification_code: string;
  issued_at: string;
}

export default function CertificatesPage() {
  const supabase = getSupabaseBrowserClient(
  );

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('certificate_pipe', {
        body: { action: 'list' },
      });

      if (data?.success) {
        setCertificates(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching certificates:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleShare = async (cert: Certificate) => {
    const shareUrl = `${window.location.origin}/verify/${cert.verification_code}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${cert.achievement} Certificate`,
          text: `Check out my ${cert.achievement} certificate from UPSC PrepX!`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      alert('Verification link copied to clipboard!');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getAchievementIcon = (achievement: string) => {
    const icons: Record<string, string> = {
      '7 Day Streak': '🔥',
      '30 Day Challenge': '💪',
      'Course Complete': '🎓',
      'Top Performer': '🏆',
      'Essay Master': '✍️',
      'Quiz Champion': '🧠',
    };
    return icons[achievement] || '🏅';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Certificates</h1>
          <p className="text-gray-400">Your achievements, verified and shareable</p>
        </div>

        {/* View Toggle */}
        <div className="flex justify-end mb-6">
          <div className="flex gap-2 bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-neon-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-neon-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Certificates Grid */}
        {certificates.length === 0 ? (
          <div className="neon-glass rounded-2xl p-12 text-center">
            <div className="text-8xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Certificates Yet</h2>
            <p className="text-gray-400 mb-6">
              Complete challenges and achieve milestones to earn certificates!
            </p>
            <a
              href="/gamification"
              className="inline-block px-6 py-3 bg-neon-blue text-white rounded-xl font-medium hover:bg-neon-blue/80"
            >
              View Achievements
            </a>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="neon-glass rounded-2xl overflow-hidden cursor-pointer group"
                onClick={() => setSelectedCert(cert)}
              >
                {/* Certificate Preview */}
                <div className="aspect-[1.4/1] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 relative">
                  {/* Decorative border */}
                  <div className="absolute inset-2 border-2 border-neon-blue/30 rounded-lg" />
                  <div className="absolute inset-4 border border-neon-blue/20 rounded-lg" />

                  <div className="relative h-full flex flex-col items-center justify-center text-center">
                    <div className="text-4xl mb-2">{getAchievementIcon(cert.achievement)}</div>
                    <h3 className="text-white font-bold text-lg leading-tight mb-2">
                      {cert.achievement}
                    </h3>
                    <p className="text-gray-400 text-sm">{cert.recipient_name}</p>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-neon-blue/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium">View Certificate</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">{formatDate(cert.issued_at)}</span>
                    <span className="text-neon-blue text-sm">{cert.certificate_number}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(cert);
                      }}
                      className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </button>
                    <a
                      href={cert.certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 py-2 bg-neon-blue text-white rounded-lg text-sm hover:bg-neon-blue/80 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="neon-glass rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-neon-blue/50 transition-all"
                onClick={() => setSelectedCert(cert)}
              >
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-neon-blue/20 to-purple-500/20 flex items-center justify-center text-3xl">
                  {getAchievementIcon(cert.achievement)}
                </div>

                <div className="flex-1">
                  <h3 className="text-white font-medium">{cert.achievement}</h3>
                  <p className="text-gray-400 text-sm">{cert.recipient_name}</p>
                </div>

                <div className="text-right">
                  <div className="text-gray-400 text-sm">{formatDate(cert.issued_at)}</div>
                  <div className="text-neon-blue text-xs">{cert.certificate_number}</div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(cert);
                  }}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Certificate Modal */}
        {selectedCert && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="max-w-2xl w-full">
              {/* Certificate Display */}
              <div className="aspect-[1.4/1] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 relative border-4 border-neon-blue/30">
                {/* Corner decorations */}
                <div className="absolute top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-neon-blue/50 rounded-tl-xl" />
                <div className="absolute top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-neon-blue/50 rounded-tr-xl" />
                <div className="absolute bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-neon-blue/50 rounded-bl-xl" />
                <div className="absolute bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-neon-blue/50 rounded-br-xl" />

                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-6xl mb-4">{getAchievementIcon(selectedCert.achievement)}</div>

                  <h2 className="text-neon-blue text-sm uppercase tracking-widest mb-2">
                    Certificate of Achievement
                  </h2>

                  <h1 className="text-3xl font-bold text-white mb-6">
                    {selectedCert.achievement}
                  </h1>

                  <p className="text-gray-400 mb-2">This certifies that</p>
                  <h3 className="text-2xl font-bold text-white mb-6">
                    {selectedCert.recipient_name}
                  </h3>

                  {selectedCert.details_json?.score && (
                    <div className="mb-4">
                      <span className="text-gray-400">Score: </span>
                      <span className="text-neon-blue font-bold">{selectedCert.details_json.score}%</span>
                    </div>
                  )}

                  <div className="text-gray-500 text-sm mt-8">
                    Issued on {formatDate(selectedCert.issued_at)}
                  </div>

                  <div className="mt-4 text-xs text-gray-600 font-mono">
                    {selectedCert.certificate_number}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => setSelectedCert(null)}
                  className="flex-1 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700"
                >
                  Close
                </button>
                <button
                  onClick={() => handleShare(selectedCert)}
                  className="flex-1 py-3 bg-neon-blue text-white rounded-xl hover:bg-neon-blue/80 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share Certificate
                </button>
              </div>

              {/* Verification */}
              <div className="mt-4 p-4 bg-slate-800/50 rounded-xl text-center">
                <p className="text-gray-400 text-sm mb-2">Verify this certificate:</p>
                <a
                  href={`/verify/${selectedCert.verification_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neon-blue text-sm hover:underline"
                >
                  {typeof window !== 'undefined' ? window.location.origin : ''}/verify/{selectedCert.verification_code}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
