'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TrialCountdownBannerProps {
  trialExpiresAt: string;
  onUpgrade?: () => void;
}

export function TrialCountdownBanner({ trialExpiresAt, onUpgrade }: TrialCountdownBannerProps) {
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    const calculateDaysRemaining = () => {
      const expiry = new Date(trialExpiresAt);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      setDaysRemaining(Math.max(0, days));
    };

    calculateDaysRemaining();
    const interval = setInterval(calculateDaysRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [trialExpiresAt]);

  if (daysRemaining === 0) return null;

  return (
    <div className={`p-4 rounded-xl border mb-6 ${
      daysRemaining <= 2
        ? 'bg-red-500/10 border-red-500/30'
        : daysRemaining <= 5
        ? 'bg-yellow-500/10 border-yellow-500/30'
        : 'bg-neon-blue/10 border-neon-blue/30'
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            daysRemaining <= 2
              ? 'bg-red-500/20'
              : daysRemaining <= 5
              ? 'bg-yellow-500/20'
              : 'bg-neon-blue/20'
          }`}>
            <svg className={`w-5 h-5 ${
              daysRemaining <= 2 ? 'text-red-400' : daysRemaining <= 5 ? 'text-yellow-400' : 'text-neon-blue'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className={`font-medium ${
              daysRemaining <= 2 ? 'text-red-400' : daysRemaining <= 5 ? 'text-yellow-400' : 'text-neon-blue'
            }`}>
              {daysRemaining === 1 ? '1 day left' : `${daysRemaining} days left`} in your free trial
            </p>
            <p className="text-sm text-gray-400">
              Upgrade to Pro to keep all features
            </p>
          </div>
        </div>
        <Link
          href="/pricing"
          onClick={onUpgrade}
          className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
            daysRemaining <= 2
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'btn-primary'
          }`}
        >
          {daysRemaining <= 2 ? 'Upgrade Now' : 'Upgrade to Pro'}
        </Link>
      </div>
    </div>
  );
}

export function UpgradePrompt({ featureName }: { featureName: string }) {
  return (
    <div className="neon-glass p-8 rounded-2xl text-center">
      <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-neon-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Upgrade to Pro</h3>
      <p className="text-gray-400 mb-6">
        {featureName} is available to Pro subscribers. Start your 7-day free trial to access this feature.
      </p>
      <Link href="/pricing" className="btn-primary inline-block">
        Start Free Trial
      </Link>
    </div>
  );
}
