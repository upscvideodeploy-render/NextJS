'use client';

interface VoicePreferenceSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function VoicePreferenceSelector({ value, onChange }: VoicePreferenceSelectorProps) {
  const options = [
    { value: 'default', label: 'Default Voice' },
    { value: 'male', label: 'Male Voice' },
    { value: 'female', label: 'Female Voice' },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Narration Voice
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg focus:outline-none focus:border-neon-blue text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
