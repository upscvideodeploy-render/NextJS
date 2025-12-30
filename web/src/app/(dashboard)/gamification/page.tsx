'use client';

/**
 * Gamification Dashboard UI - Story 14.1
 * 
 * AC 1: XP system display
 * AC 2: Badges display with categories
 * AC 3: Streaks visualization
 * AC 5: Progress bar / level progression
 * AC 6: Milestones with confetti celebration
 * AC 7: No competitive leaderboards (self-only)
 * AC 8: Self-comparison "You vs Last Month"
 * AC 9: Analytics dashboard
 * AC 10: Opt-out toggle
 */

import { useState, useEffect, useCallback } from 'react';

interface UserXP {
  total: number;
  lifetime: number;
  toNextLevel: number;
}

interface Level {
  current: number;
  name: string;
  title: string;
  progressPercentage: number;
  xpInLevel: number;
  xpNeededForLevel: number;
}

interface Streak {
  current: number;
  longest: number;
  lastActivityDate: string | null;
}

interface Badge {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string;
  category: string;
  rarity: string;
  earned: boolean;
  earnedAt: string | null;
}

interface Milestone {
  id: string;
  milestone_type: string;
  milestone_value: number;
  data: any;
  celebrated: boolean;
  created_at: string;
}

interface Comparison {
  current: Record<string, number>;
  previous: Record<string, number>;
  change: Record<string, number>;
  improvements: Record<string, { value: number; percentage: number; direction: string }>;
}

interface Settings {
  enabled: boolean;
  show_xp: boolean;
  show_badges: boolean;
  show_streaks: boolean;
  show_3d_rooms: boolean;
  daily_goal_minutes: number;
}

export default function GamificationPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'badges' | 'analytics' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [xp, setXP] = useState<UserXP | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebratingMilestone, setCelebratingMilestone] = useState<Milestone | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch dashboard data
      const dashRes = await fetch('/api/gamification?action=dashboard', { headers });
      const dashData = await dashRes.json();

      if (!dashData.enabled) {
        setSettings({ ...settings!, enabled: false });
        setLoading(false);
        return;
      }

      setXP(dashData.xp);
      setLevel(dashData.level);
      setStreak(dashData.streak);
      setSettings(dashData.settings);

      // Check for uncelebrated milestones
      if (dashData.uncelebratedMilestones?.length > 0) {
        setCelebratingMilestone(dashData.uncelebratedMilestones[0]);
        setShowConfetti(true);
      }

      // Fetch badges
      const badgesRes = await fetch('/api/gamification?action=badges', { headers });
      const badgesData = await badgesRes.json();
      setBadges(badgesData.all || []);

      // Fetch comparison
      const compRes = await fetch('/api/gamification?action=comparison', { headers });
      const compData = await compRes.json();
      setComparison(compData);

      // Fetch milestones
      const mileRes = await fetch('/api/gamification?action=milestones', { headers });
      const mileData = await mileRes.json();
      setMilestones(mileData.milestones || []);

    } catch (error) {
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const celebrateMilestone = async (milestone: Milestone) => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      await fetch('/api/gamification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'celebrate_milestone',
          milestone_id: milestone.id
        })
      });
      setCelebratingMilestone(null);
      setShowConfetti(false);
    } catch (error) {
      console.error('Failed to celebrate milestone:', error);
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      await fetch('/api/gamification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update_settings',
          ...updates
        })
      });
      setSettings(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading your achievements...</div>
      </div>
    );
  }

  if (!settings?.enabled) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Gamification Disabled</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You have opted out of the gamification features. Enable them to track your progress with XP, badges, and streaks.
          </p>
          <button
            onClick={() => updateSettings({ enabled: true })}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Enable Gamification
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Confetti Effect for Milestone Celebration (AC 6) */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 100 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)]
              }}
            />
          ))}
        </div>
      )}

      {/* Milestone Celebration Modal */}
      {celebratingMilestone && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md text-center animate-bounce-in">
            <div className="text-6xl mb-4">
              {celebratingMilestone.milestone_type === 'level_up' ? '🎉' : '🏆'}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {celebratingMilestone.milestone_type === 'level_up' 
                ? `Level Up! You're now Level ${celebratingMilestone.data?.new_level}!`
                : celebratingMilestone.milestone_type === 'badge_earned'
                  ? `Badge Earned: ${celebratingMilestone.data?.badge_name}!`
                  : 'Milestone Achieved!'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Keep up the great work on your UPSC preparation journey!
            </p>
            <button
              onClick={() => celebrateMilestone(celebratingMilestone)}
              className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg font-bold hover:from-yellow-500 hover:to-orange-600"
            >
              Celebrate! 🎊
            </button>
          </div>
        </div>
      )}

      {/* Header with Level and XP */}
      <header className="p-6 bg-black/20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {level?.current || 1}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{level?.title || 'UPSC Aspirant'}</h1>
              <p className="text-indigo-200">{level?.name || 'Aspirant'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-yellow-400">{xp?.total?.toLocaleString() || 0} XP</p>
            <p className="text-indigo-200">{xp?.toNextLevel?.toLocaleString() || 100} XP to next level</p>
          </div>
        </div>

        {/* Progress Bar (AC 5) */}
        <div className="max-w-6xl mx-auto mt-4">
          <div className="h-4 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 transition-all duration-500"
              style={{ width: `${level?.progressPercentage || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-indigo-200 mt-1">
            <span>Level {level?.current || 1}</span>
            <span>{level?.progressPercentage || 0}%</span>
            <span>Level {(level?.current || 1) + 1}</span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="max-w-6xl mx-auto px-6 mt-6">
        <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
          {['dashboard', 'badges', 'analytics', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-2 px-4 rounded-lg transition-all ${
                activeTab === tab
                  ? 'bg-white text-indigo-900 font-bold'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Content */}
      <main className="max-w-6xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <DashboardTab
            xp={xp}
            level={level}
            streak={streak}
            badges={badges}
            comparison={comparison}
            settings={settings}
          />
        )}
        {activeTab === 'badges' && <BadgesTab badges={badges} />}
        {activeTab === 'analytics' && <AnalyticsTab comparison={comparison} milestones={milestones} />}
        {activeTab === 'settings' && <SettingsTab settings={settings} updateSettings={updateSettings} />}
      </main>

      <style jsx>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          width: 10px;
          height: 10px;
          animation: confetti 3s ease-out forwards;
        }
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Dashboard Tab
// ============================================================================

function DashboardTab({ xp, level, streak, badges, comparison, settings }: any) {
  const earnedBadges = badges?.filter((b: Badge) => b.earned) || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Streak Card (AC 3) */}
      {settings?.show_streaks && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Streak</h2>
            <span className="text-4xl">🔥</span>
          </div>
          <p className="text-5xl font-bold text-orange-400">{streak?.current || 0}</p>
          <p className="text-indigo-200">day streak</p>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-sm text-indigo-200">
              Longest streak: <span className="text-white font-bold">{streak?.longest || 0} days</span>
            </p>
          </div>
        </div>
      )}

      {/* XP Breakdown (AC 1) */}
      {settings?.show_xp && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">XP Sources</h2>
          <div className="space-y-3">
            {[
              { icon: '📹', name: 'Videos', xp: 10 },
              { icon: '📝', name: 'Quizzes', xp: 20 },
              { icon: '❓', name: 'Doubts', xp: 15 },
              { icon: '📓', name: 'Notes', xp: 25 },
              { icon: '🔥', name: 'Streak Bonus', xp: 50 }
            ].map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="text-indigo-200">
                  {item.icon} {item.name}
                </span>
                <span className="text-yellow-400 font-bold">+{item.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Badges (AC 2) */}
      {settings?.show_badges && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Recent Badges</h2>
          <div className="grid grid-cols-3 gap-3">
            {earnedBadges.slice(0, 6).map((badge: Badge) => (
              <div
                key={badge.id}
                className={`aspect-square rounded-lg flex items-center justify-center text-2xl ${
                  badge.rarity === 'legendary' ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                  badge.rarity === 'epic' ? 'bg-gradient-to-br from-purple-400 to-pink-500' :
                  badge.rarity === 'rare' ? 'bg-gradient-to-br from-blue-400 to-indigo-500' :
                  'bg-white/20'
                }`}
                title={badge.name}
              >
                {badge.icon_url || '🏆'}
              </div>
            ))}
            {earnedBadges.length === 0 && (
              <div className="col-span-3 text-center text-indigo-200 py-4">
                No badges earned yet. Keep learning!
              </div>
            )}
          </div>
          <p className="text-center text-sm text-indigo-200 mt-4">
            {earnedBadges.length} of {badges.length} badges earned
          </p>
        </div>
      )}

      {/* Self Comparison (AC 8) */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:col-span-2 lg:col-span-3">
        <h2 className="text-lg font-bold text-white mb-4">You vs Last Month</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {comparison?.improvements && Object.entries(comparison.improvements).map(([key, value]: [string, any]) => (
            <div key={key} className="text-center">
              <p className="text-indigo-200 capitalize">{key.replace('_', ' ')}</p>
              <p className={`text-2xl font-bold ${
                value.direction === 'up' ? 'text-green-400' :
                value.direction === 'down' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {value.direction === 'up' ? '↑' : value.direction === 'down' ? '↓' : '–'}
                {Math.abs(value.percentage)}%
              </p>
              <p className="text-sm text-indigo-300">
                {value.direction === 'up' ? '+' : ''}{value.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Badges Tab (AC 2)
// ============================================================================

function BadgesTab({ badges }: { badges: Badge[] }) {
  const categories = ['milestone', 'streak', 'achievement', 'explorer'];
  const categoryNames: Record<string, string> = {
    milestone: 'Milestones',
    streak: 'Streak Masters',
    achievement: 'Achievements',
    explorer: 'Explorers'
  };

  return (
    <div className="space-y-8">
      {categories.map(category => {
        const categoryBadges = badges.filter(b => b.category === category);
        return (
          <div key={category}>
            <h2 className="text-xl font-bold text-white mb-4">{categoryNames[category]}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {categoryBadges.map(badge => (
                <div
                  key={badge.id}
                  className={`relative p-4 rounded-xl text-center transition-all ${
                    badge.earned
                      ? 'bg-white/20 hover:bg-white/30'
                      : 'bg-black/20 opacity-50'
                  }`}
                >
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl ${
                    badge.rarity === 'legendary' ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                    badge.rarity === 'epic' ? 'bg-gradient-to-br from-purple-400 to-pink-500' :
                    badge.rarity === 'rare' ? 'bg-gradient-to-br from-blue-400 to-indigo-500' :
                    'bg-white/20'
                  }`}>
                    {badge.earned ? (badge.icon_url || '🏆') : '🔒'}
                  </div>
                  <h3 className="text-white font-bold mt-2">{badge.name}</h3>
                  <p className="text-xs text-indigo-200 mt-1">{badge.description}</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs mt-2 ${
                    badge.rarity === 'legendary' ? 'bg-yellow-500/30 text-yellow-300' :
                    badge.rarity === 'epic' ? 'bg-purple-500/30 text-purple-300' :
                    badge.rarity === 'rare' ? 'bg-blue-500/30 text-blue-300' :
                    'bg-gray-500/30 text-gray-300'
                  }`}>
                    {badge.rarity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Analytics Tab (AC 9)
// ============================================================================

function AnalyticsTab({ comparison, milestones }: { comparison: Comparison | null; milestones: Milestone[] }) {
  return (
    <div className="space-y-6">
      {/* Monthly Comparison */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Monthly Progress</h2>
        {comparison && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <StatCard 
              label="Total XP" 
              current={comparison.current.xp} 
              previous={comparison.previous.xp}
            />
            <StatCard 
              label="Study Time (min)" 
              current={comparison.current.study_minutes} 
              previous={comparison.previous.study_minutes}
            />
            <StatCard 
              label="Videos Watched" 
              current={comparison.current.videos} 
              previous={comparison.previous.videos}
            />
            <StatCard 
              label="Quizzes Completed" 
              current={comparison.current.quizzes} 
              previous={comparison.previous.quizzes}
            />
            <StatCard 
              label="Notes Generated" 
              current={comparison.current.notes} 
              previous={comparison.previous.notes}
            />
            <StatCard 
              label="Streak Days" 
              current={comparison.current.streak_days} 
              previous={comparison.previous.streak_days}
            />
          </div>
        )}
      </div>

      {/* Recent Milestones */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Milestones</h2>
        <div className="space-y-3">
          {milestones.slice(0, 10).map(milestone => (
            <div key={milestone.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
              <span className="text-2xl">
                {milestone.milestone_type === 'level_up' ? '⬆️' :
                 milestone.milestone_type === 'badge_earned' ? '🏆' :
                 milestone.milestone_type === 'streak_milestone' ? '🔥' : '⭐'}
              </span>
              <div className="flex-1">
                <p className="text-white font-medium">
                  {milestone.milestone_type === 'level_up' 
                    ? `Reached Level ${milestone.data?.new_level}`
                    : milestone.milestone_type === 'badge_earned'
                      ? `Earned: ${milestone.data?.badge_name}`
                      : `Milestone: ${milestone.milestone_value}`}
                </p>
                <p className="text-xs text-indigo-200">
                  {new Date(milestone.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
          {milestones.length === 0 && (
            <p className="text-center text-indigo-200 py-4">No milestones yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, current, previous }: { label: string; current: number; previous: number }) {
  const diff = current - previous;
  const percentage = previous === 0 ? (current > 0 ? 100 : 0) : Math.round((diff / previous) * 100);
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="text-center p-4 bg-white/5 rounded-lg">
      <p className="text-indigo-200 text-sm">{label}</p>
      <p className="text-2xl font-bold text-white">{current.toLocaleString()}</p>
      <p className={`text-sm ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400'}`}>
        {isUp ? '↑' : isDown ? '↓' : '–'} {Math.abs(percentage)}%
        <span className="text-indigo-300 ml-1">vs last month</span>
      </p>
    </div>
  );
}

// ============================================================================
// Settings Tab (AC 10)
// ============================================================================

function SettingsTab({ settings, updateSettings }: { settings: Settings | null; updateSettings: (updates: Partial<Settings>) => void }) {
  if (!settings) return null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">Gamification Settings</h2>

        <div className="space-y-6">
          {/* Master Toggle */}
          <ToggleSetting
            label="Enable Gamification"
            description="Turn all gamification features on or off"
            checked={settings.enabled}
            onChange={(checked) => updateSettings({ enabled: checked })}
          />

          <hr className="border-white/10" />

          {/* Individual Toggles */}
          <ToggleSetting
            label="Show XP"
            description="Display experience points and level progress"
            checked={settings.show_xp}
            onChange={(checked) => updateSettings({ show_xp: checked })}
          />

          <ToggleSetting
            label="Show Badges"
            description="Display earned badges and achievements"
            checked={settings.show_badges}
            onChange={(checked) => updateSettings({ show_badges: checked })}
          />

          <ToggleSetting
            label="Show Streaks"
            description="Track and display daily study streaks"
            checked={settings.show_streaks}
            onChange={(checked) => updateSettings({ show_streaks: checked })}
          />

          <ToggleSetting
            label="Show 3D Subject Rooms"
            description="Enable 3D visualization of subjects"
            checked={settings.show_3d_rooms}
            onChange={(checked) => updateSettings({ show_3d_rooms: checked })}
          />

          <hr className="border-white/10" />

          {/* Daily Goal */}
          <div>
            <label className="text-white font-medium">Daily Study Goal (minutes)</label>
            <p className="text-sm text-indigo-200 mb-2">Minimum study time to maintain streak</p>
            <input
              type="range"
              min="15"
              max="120"
              step="15"
              value={settings.daily_goal_minutes}
              onChange={(e) => updateSettings({ daily_goal_minutes: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-indigo-200">
              <span>15 min</span>
              <span className="text-yellow-400 font-bold">{settings.daily_goal_minutes} minutes</span>
              <span>120 min</span>
            </div>
          </div>
        </div>
      </div>

      {/* No Leaderboards Notice (AC 7) */}
      <div className="mt-6 bg-indigo-500/20 rounded-xl p-4 text-center">
        <p className="text-indigo-200">
          🎯 Focus on your own progress! We don't have competitive leaderboards - 
          compare yourself only to your past self.
        </p>
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white font-medium">{label}</p>
        <p className="text-sm text-indigo-200">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-14 h-8 rounded-full transition-colors ${
          checked ? 'bg-green-500' : 'bg-gray-600'
        }`}
      >
        <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}
