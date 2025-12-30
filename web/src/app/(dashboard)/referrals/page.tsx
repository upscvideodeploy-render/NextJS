/**
 * User Referral Dashboard Page
 * Story 5.10 - Referral Program - User Acquisition
 *
 * AC#1: Referral page with unique referral code
 * AC#5: Referral dashboard with stats
 * AC#7: Social share buttons for WhatsApp, Twitter, Email
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReferralData {
  referral_code: string | null;
  referral_link: string;
  stats: {
    total_referrals: number;
    signed_up_count: number;
    subscribed_count: number;
    rewarded_count: number;
    pending_count: number;
  };
  rewards: {
    monthly_count: number;
    max_per_month: number;
    can_earn_more: boolean;
    remaining_this_month: number;
  };
  referrals: ReferralItem[];
}

interface ReferralItem {
  id: string;
  status: string;
  created_at: string;
  reward_type: string | null;
  reward_applied_at: string | null;
  referred_user: {
    id: string;
    email: string;
  } | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  signed_up: { label: 'Signed Up', color: 'bg-blue-100 text-blue-800' },
  subscribed: { label: 'Subscribed', color: 'bg-purple-100 text-purple-800' },
  rewarded: { label: 'Rewarded', color: 'bg-green-100 text-green-800' },
};

export default function ReferralsPage() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const response = await fetch('/api/referrals/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReferralData(data);
      }
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (referralData?.referral_link) {
      await navigator.clipboard.writeText(referralData.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareViaWhatsApp = () => {
    const text = `Join UPSC PrepX-AI - AI-powered UPSC exam preparation platform! Use my referral link to get started: ${referralData?.referral_link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaTwitter = () => {
    const text = `Just started preparing for UPSC with UPSC PrepX-AI! Use my referral link to get started: ${referralData?.referral_link}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = 'Invitation to UPSC PrepX-AI';
    const body = `Hi!\n\nI've been using UPSC PrepX-Ai for UPSC exam preparation and thought you might like it too. Use my referral link to get started:\n\n${referralData?.referral_link}\n\nBest regards`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Refer & Earn</h1>
        <p className="text-gray-600 mt-2">
          Invite friends and earn 1 month of free Pro access for every friend who subscribes!
        </p>
      </div>

      {/* Referral Code Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-medium mb-4">Your Referral Code</h2>
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur px-6 py-3 rounded-lg text-2xl font-mono tracking-wider">
                {referralData?.referral_code || 'LOADING...'}
              </div>
              <button
                onClick={copyToClipboard}
                className="bg-white text-blue-600 px-4 py-3 rounded-lg font-medium hover:bg-blue-50 transition"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4">Your Referral Link</h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralData?.referral_link || ''}
                readOnly
                className="flex-1 bg-white/20 backdrop-blur px-4 py-3 rounded-lg text-white/90"
              />
              <button
                onClick={copyToClipboard}
                className="bg-white/20 backdrop-blur px-4 py-3 rounded-lg hover:bg-white/30 transition"
              >
                {copied ? '✓' : ''}
              </button>
            </div>
          </div>
        </div>

        {/* Share Buttons (AC#7) */}
        <div className="mt-6 pt-6 border-t border-white/20">
          <h3 className="text-sm font-medium mb-4">Share via</h3>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={shareViaWhatsApp}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 px-5 py-2.5 rounded-lg font-medium transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.09-.198.05-.371-.025-.52-.075-.149-.075-.749-.268-1.425-.553-.676-.285-1.126-.63-1.556-1.037-.075-.065-.39-.404-.93-1.097-.015-.02-.025-.048-.025-.075 0-.027.005-.053.02-.075.198-.226.415-.47.647-.735.07-.087.144-.172.198-.27.005-.015.015-.04.015-.06 0-.02-.015-.04-.035-.055-.197-.13-.414-.295-.652-.49-.238-.195-.485-.403-.735-.615-.26-.218-.52-.445-.78-.675-.248-.21-.505-.42-.765-.615-.26-.195-.52-.395-.765-.585-.255-.195-.51-.39-.765-.57-.26-.188-.52-.375-.78-.553-.26-.178-.52-.353-.78-.513-.26-.16-.52-.32-.78-.463-.26-.143-.52-.28-.78-.4-.26-.12-.52-.233-.78-.33-.26-.098-.52-.185-.78-.258-.26-.073-.52-.138-.78-.193-.26-.055-.52-.1-.78-.135-.26-.035-.52-.06-.78-.075-.26-.015-.52-.018-.78-.008-.26.01-.52.038-.78.083-.26.045-.52.103-.78.173-.26.07-.52.15-.78.24-.26.09-.52.188-.78.293-.26.105-.52.215-.78.325-.26.11-.52.223-.78.338-.26.115-.52.23-.78.345-.26.115-.52.233-.78.353-.26.12-.52.248-.78.375-.26.128-.52.263-.78.403-.26.14-.52.285-.78.433-.26.148-.52.303-.78.46-.26.158-.52.32-.78.488-.26.168-.52.338-.78.518-.26.18-.52.36-.78.553-.26.193-.52.383-.78.585-.26.203-.52.405-.78.623-.26.218-.52.428-.78.665-.26.238-.52.455-.78.71-.26.255-.52.483-.78.755-.26.273-.52.51-.78.8-.26.29-.52.538-.78.848-.26.31-.52.565-.78.895-.26.33-.52.593-.78.94-.26.348-.52.62-.78.985-.26.365-.52.648-.78 1.03-.26.383-.52.675-.78 1.075-.26.4-.52.703-.78 1.12-.26.418-.52.73-.78 1.165-.26.435-.52.758-.78 1.208-.26.453-.52.785-.78 1.25-.26.47-.52.813-.78 1.293-.26.48-.52.84-.78 1.335-.26.495-.52.868-.78 1.375-.26.508-.52.895-.78 1.413-.26.52-.52.923-.78 1.45-.26.538-.52.95-.78 1.485-.26.555-.52.975-.78 1.518-.26.57-.52 1-.78 1.05z"/>
              </svg>
              WhatsApp
            </button>

            <button
              onClick={shareViaTwitter}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 px-5 py-2.5 rounded-lg font-medium transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              Twitter
            </button>

            <button
              onClick={shareViaEmail}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 px-5 py-2.5 rounded-lg font-medium transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid (AC#5) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-gray-900">
            {referralData?.stats.total_referrals || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Total Referrals</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-blue-600">
            {referralData?.stats.signed_up_count || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Signed Up</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-purple-600">
            {referralData?.stats.subscribed_count || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Subscribed</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-green-600">
            {referralData?.stats.rewarded_count || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Rewards Earned</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 col-span-2 md:col-span-1">
          <div className="text-3xl font-bold text-orange-600">
            {referralData?.stats.pending_count || 0}
          </div>
          <div className="text-sm text-gray-600 mt-1">Pending</div>
        </div>
      </div>

      {/* Monthly Reward Limit (AC#8) */}
      {referralData?.rewards && (
        <div className={`bg-white rounded-xl p-6 shadow-sm border mb-8 ${
          !referralData.rewards.can_earn_more ? 'border-orange-300 bg-orange-50' : 'border-gray-100'
        }`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Monthly Rewards</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              referralData.rewards.can_earn_more ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
            }`}>
              {referralData.rewards.can_earn_more ? 'Active' : 'Limit Reached'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${(referralData.rewards.monthly_count / referralData.rewards.max_per_month) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {referralData.rewards.monthly_count} / {referralData.rewards.max_per_month}
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-2">
            {referralData.rewards.can_earn_more
              ? `You can earn ${referralData.rewards.remaining_this_month} more reward(s) this month.`
              : `You've reached the monthly limit. Rewards will resume next month.`
            }
          </p>
        </div>
      )}

      {/* Referrals List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold">Your Referrals</h3>
        </div>

        {referralData?.referrals && referralData.referrals.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {referralData.referrals.map((referral) => {
              const statusInfo = statusLabels[referral.status] || statusLabels.pending;
              return (
                <div key={referral.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {referral.referred_user?.email || 'Hidden'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(referral.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    {referral.reward_applied_at && (
                      <div className="text-sm text-green-600 font-medium">
                        +1 month free
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-600">No referrals yet. Share your link to start earning!</p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">How it works</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
              1
            </div>
            <div>
              <div className="font-medium">Share your link</div>
              <div className="text-sm text-gray-600">Send your referral link to friends</div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
              2
            </div>
            <div>
              <div className="font-medium">They sign up</div>
              <div className="text-sm text-gray-600">Friend creates an account using your link</div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
              3
            </div>
            <div>
              <div className="font-medium">You get rewarded</div>
              <div className="text-sm text-gray-600">When they subscribe, you get 1 month free!</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
