'use client';

import React, { useState } from 'react';
import { useLanguage, Language } from '@/contexts/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage, toggleLanguage, isHindi } = useLanguage();
  const [showDropdown, setShowDropdown] = useState(false);

  const languages: { id: Language; label: string; nativeName: string; flag: string }[] = [
    { id: 'en', label: 'English', nativeName: 'English', flag: '🇺🇸' },
    { id: 'hi', label: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
  ];

  const currentLang = languages.find(l => l.id === language) || languages[0];

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 hover:bg-slate-700/50 transition-colors"
        aria-label="Switch Language"
        title="Switch Language / भाषा बदलें"
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="text-sm text-white hidden sm:inline">{currentLang.nativeName}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
            <div className="py-1">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => {
                    setLanguage(lang.id);
                    setShowDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/50 transition-colors ${
                    language === lang.id ? 'bg-neon-blue/10 border-l-2 border-neon-blue' : ''
                  }`}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <div className="flex flex-col">
                    <span className="text-sm text-white font-medium">{lang.nativeName}</span>
                    <span className="text-xs text-gray-500">{lang.label}</span>
                  </div>
                  {language === lang.id && (
                    <svg className="w-4 h-4 text-neon-blue ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Footer with quick toggle */}
            <div className="border-t border-white/10 p-3 bg-slate-900/50">
              <button
                onClick={() => {
                  toggleLanguage();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neon-blue/20 text-neon-blue text-sm rounded-lg hover:bg-neon-blue/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {isHindi ? 'Switch to English' : 'अंग्रेज़ी में बदलें'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Compact toggle for navbar (just the flag and indicator)
export function LanguageToggleCompact() {
  const { language, toggleLanguage, isHindi } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/30 border border-white/5 hover:bg-slate-700/50 transition-colors group"
      title={isHindi ? 'Switch to English' : 'हिंदी में बदलें'}
    >
      <span className="text-base">{isHindi ? '🇺🇸' : '🇮🇳'}</span>
      <span className={`text-xs font-medium transition-colors ${isHindi ? 'text-gray-400' : 'text-neon-blue'}`}>
        {isHindi ? 'EN' : 'HI'}
      </span>
      {/* Animated arrow */}
      <svg
        className={`w-3 h-3 text-gray-500 group-hover:text-white transition-transform`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    </button>
  );
}
