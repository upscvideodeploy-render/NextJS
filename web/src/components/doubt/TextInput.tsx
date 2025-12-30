'use client';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TextInput({ value, onChange }: TextInputProps) {
  const maxLength = 2000;
  const remaining = maxLength - value.length;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Enter your doubt
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder="e.g., Explain the difference between Article 370 and Article 35A..."
        className="w-full h-48 px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg focus:outline-none focus:border-neon-blue text-white resize-none"
      />
      <div className="flex justify-between mt-2 text-sm">
        <span className="text-gray-500">Type your UPSC related question here</span>
        <span className={remaining < 100 ? 'text-yellow-500' : 'text-gray-500'}>
          {remaining} characters remaining
        </span>
      </div>
    </div>
  );
}
