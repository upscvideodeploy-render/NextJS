'use client';

interface VideoLengthSelectorProps {
  value: 60 | 120 | 180;
  onChange: (value: 60 | 120 | 180) => void;
}

export default function VideoLengthSelector({ value, onChange }: VideoLengthSelectorProps) {
  const options = [
    { value: 60, label: '60 seconds', badge: null },
    { value: 120, label: '2 minutes', badge: null },
    { value: 180, label: '3 minutes', badge: 'Pro' },
  ] as const;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Video Length
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as any)}
        className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg focus:outline-none focus:border-neon-blue text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} {option.badge ? `(${option.badge} Only)` : ''}
          </option>
        ))}
      </select>
      {value === 180 && (
        <p className="mt-2 text-xs text-yellow-400">
          ⭐ 3-minute videos require a Pro subscription
        </p>
      )}
    </div>
  );
}
