'use client';

interface StyleSelectorProps {
  value: 'concise' | 'detailed' | 'example-rich';
  onChange: (value: 'concise' | 'detailed' | 'example-rich') => void;
}

export default function StyleSelector({ value, onChange }: StyleSelectorProps) {
  const options = [
    { value: 'concise', label: 'Concise', description: 'Quick 60s overview' },
    { value: 'detailed', label: 'Detailed', description: 'In-depth explanation' },
    { value: 'example-rich', label: 'Example-Rich', description: 'With examples & analogies' },
  ] as const;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Explanation Style
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as any)}
        className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg focus:outline-none focus:border-neon-blue text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} - {option.description}
          </option>
        ))}
      </select>
    </div>
  );
}
