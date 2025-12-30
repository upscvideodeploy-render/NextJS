/**
 * Referral Program Page
 * Story 5.10 - Referral Program - User Acquisition
 *
 * AC#1: /referral with unique referral code
 * AC#2: Referral link generation
 * AC#3: Tracking when referred user signs up
 * AC#4: Reward system (1 month free)
 * AC#5: Referral dashboard
 * AC#6: Leaderboard
 * AC#7: Social share buttons
 * AC#8: Terms (max 10 referrals/month)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserProfile {
  referral_code: string;
  full_name: string;
}

interface Referral {
  id: string;
  referred_id: string;
  status: 'pending' | 'signed_up' | 'subscribed' | 'rewarded';
  reward_value: number | null;
  created_at: string;
  referred_user?: {
    email: string;
  };
}

interface LeaderboardEntry {
  user_id: string;
  referral_count: number;
  full_name: string;
}

export default function ReferralPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralLink = profile?.referral_code
    ? `${window.location.origin}/auth/signup?ref=${profile.referral_code}`
    : '';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Fetch profile with referral code
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('referral_code, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch referrals
    const { data: referralData } = await supabase
      .from('referrals')
      .select('*, referred_user:users!referred_id(email)')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    if (referralData) {
      setReferrals(referralData);
    }

    // Fetch leaderboard (top 10)
    const { data: leaderboardData } = await supabase
      .from('referrals')
      .select('referrer_id, user_profiles!inner(full_name)')
      .eq('status', 'rewarded');

    // Process leaderboard
    if (leaderboardData) {
      const counts: Record<string, { count: number; name: string }> = {};
      leaderboardData.forEach((r: any) => {
        if (!counts[r.referrer_id]) {
          counts[r.referrer_id] = { count: 0, name: r.user_profiles?.full_name || 'Anonymous' };
        }
        counts[r.referrer_id].count++;
      });

      const sorted = Object.entries(counts)
        .map(([id, data]) => ({
          user_id: id,
          referral_count: data.count,
          full_name: data.name,
        }))
        .sort((a, b) => b.referral_count - a.referral_count)
        .slice(0, 10);

      setLeaderboard(sorted);
    }

    setIsLoading(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const text = `Join me on UPSC PrepX-AI and get a 7-day free trial! Use my referral link: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareOnTwitter = () => {
    const text = `Preparing for UPSC? Check out @UPSCPrepXAI - the best AI-powered prep platform! Use my referral link:`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`,
      '_blank'
    );
  };

  const shareByEmail = () => {
    const subject = 'Join me on UPSC PrepX-AI';
    const body = `Hi,\n\nI've been using UPSC PrepX-AI for my UPSC preparation and it's been amazing! The AI-powered features really help in understanding complex topics.\n\nUse my referral link to get started with a 7-day free trial:\n${referralLink}\n\nBest of luck with your preparation!`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getStats = () => {
    const totalReferred = referrals.length;
    const subscribed = referrals.filter(r => r.status === 'subscribed' || r.status === 'rewarded').length;
    const rewardsEarned = referrals.filter(r => r.status === 'rewarded').reduce((acc, r) => acc + (r.reward_value || 0), 0);

    return { totalReferred, subscribed, rewardsEarned };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gray-950 text-white py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-2">Refer & Earn</h1>
        <p className="text-gray-400 mb-8">
          Invite friends and earn 1 month free for each friend who subscribes!
        </p>

        {/* Referral Code Card (AC#1, AC#2) */}
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/30 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Your Referral Link</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm"
            />
            <button
              onClick={copyToClipboard}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <p className="text-sm text-gray-300 mb-4">
            Your referral code: <span className="font-mono font-bold text-purple-400">{profile?.referral_code}</span>
          </p>

          {/* Social Share Buttons (AC#7) */}
          <div className="flex gap-3">
            <button
              onClick={shareOnWhatsApp}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
            >
              <span>WhatsApp</span>
            </button>
            <button
              onClick={shareOnTwitter}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors"
            >
              <span>Twitter</span>
            </button>
            <button
              onClick={shareByEmail}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
            >
              <span>Email</span>
            </button>
          </div>
        </div>

        {/* Stats Cards (AC#5) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Friends Referred</p>
            <p className="text-3xl font-bold">{stats.totalReferred}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Friends Subscribed</p>
            <p className="text-3xl font-bold text-green-400">{stats.subscribed}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Free Days Earned</p>
            <p className="text-3xl font-bold text-purple-400">{stats.rewardsEarned}</p>
          </div>
        </div>

        {/* Referral History */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Referrals</h2>
          {referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between border-b border-gray-800 pb-3"
                >
                  <div>
                    <p className="font-semibold">
                      {referral.referred_user?.email || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-400">
                      Joined {new Date(referral.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    referral.status === 'rewarded' ? 'bg-green-500/20 text-green-400' :
                    referral.status === 'subscribed' ? 'bg-blue-500/20 text-blue-400' :
                    referral.status === 'signed_up' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {referral.status === 'rewarded' ? '🎁 Reward Earned' :
                     referral.status === 'subscribed' ? 'Subscribed' :
                     referral.status === 'signed_up' ? 'Signed Up' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              No referrals yet. Share your link to start earning!
            </p>
          )}
        </div>

        {/* Leaderboard (AC#6) */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Top Referrers</h2>
          {leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.user_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-400 text-black' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-gray-700 text-white'
                    }`}>
                      {index + 1}
                    </span>
                    <span>{entry.full_name}</span>
                  </div>
                  <span className="text-purple-400 font-semibold">
                    {entry.referral_count} referrals
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">
              Be the first on the leaderboard!
            </p>
          )}
        </div>

        {/* Terms (AC#8) */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Maximum 10 referral rewards per month.{' '}
            <a href="/terms#referral" className="text-purple-400 hover:text-purple-300">
              View full terms
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
