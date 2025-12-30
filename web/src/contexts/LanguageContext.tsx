'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type Language = 'en' | 'hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationFunction;
  isHindi: boolean;
}

type TranslationFunction = (key: TranslationKey) => string;

interface TranslationKey {
  en: string;
  hi: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Hindi translations for all UI elements
export const translations: Record<string, TranslationKey> = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'nav.search': { en: 'Search', hi: 'खोजें' },
  'nav.syllabus': { en: 'Syllabus', hi: 'पाठ्यक्रम' },
  'nav.notes': { en: 'Notes', hi: 'नोट्स' },
  'nav.news': { en: 'Daily News', hi: 'दैनिक समाचार' },
  'nav.practice': { en: 'Practice', hi: 'अभ्यास' },
  'nav.videos': { en: 'Videos', hi: 'वीडियो' },
  'nav.essays': { en: 'Essays', hi: 'निबंध' },
  'nav.answers': { en: 'Answers', hi: 'उत्तर' },
  'nav.ethics': { en: 'Ethics', hi: 'नैतिकता' },
  'nav.interview': { en: 'Interview', hi: 'साक्षात्कार' },
  'nav.memory': { en: 'Memory', hi: 'स्मृति' },
  'nav.lectures': { en: 'Lectures', hi: 'व्याख्यान' },
  'nav.community': { en: 'Community', hi: 'समुदाय' },
  'nav.signOut': { en: 'Sign Out', hi: 'साइन आउट' },

  // Common Actions
  'action.save': { en: 'Save', hi: 'सहेजें' },
  'action.cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'action.submit': { en: 'Submit', hi: 'जमा करें' },
  'action.delete': { en: 'Delete', hi: 'हटाएं' },
  'action.edit': { en: 'Edit', hi: 'संपादित करें' },
  'action.download': { en: 'Download', hi: 'डाउनलोड करें' },
  'action.generate': { en: 'Generate', hi: 'बनाएं' },
  'action.share': { en: 'Share', hi: 'साझा करें' },
  'action.back': { en: 'Back', hi: 'वापस' },
  'action.next': { en: 'Next', hi: 'आगे' },
  'action.close': { en: 'Close', hi: 'बंद करें' },
  'action.search': { en: 'Search', hi: 'खोजें' },
  'action.filter': { en: 'Filter', hi: 'फ़िल्टर' },
  'action.clear': { en: 'Clear', hi: 'साफ़ करें' },
  'action.loading': { en: 'Loading...', hi: 'लोड हो रहा है...' },
  'action.retry': { en: 'Retry', hi: 'पुनः प्रयास करें' },

  // Auth
  'auth.signIn': { en: 'Sign In', hi: 'साइन इन करें' },
  'auth.signUp': { en: 'Sign Up', hi: 'साइन अप करें' },
  'auth.email': { en: 'Email', hi: 'ईमेल' },
  'auth.password': { en: 'Password', hi: 'पासवर्ड' },
  'auth.forgotPassword': { en: 'Forgot Password?', hi: 'पासवर्ड भूल गए?' },
  'auth.resetPassword': { en: 'Reset Password', hi: 'पासवर्ड रीसेट करें' },
  'auth.welcome': { en: 'Welcome to UPSC PrepX-AI', hi: 'UPSC PrepX-AI में आपका स्वागत है' },
  'auth.subtitle': { en: 'AI-Powered UPSC Exam Preparation', hi: 'AI-संचालित UPSC परीक्षा तैयारी' },
  'auth.dontHaveAccount': { en: "Don't have an account?", hi: 'क्या आपके पास खाता नहीं है?' },
  'auth.continueGoogle': { en: 'Continue with Google', hi: 'Google से जारी रखें' },
  'auth.createAccount': { en: 'Create your account', hi: 'अपना खाता बनाएं' },
  'auth.fullName': { en: 'Full Name', hi: 'पूरा नाम' },
  'auth.confirmPassword': { en: 'Confirm Password', hi: 'पासवर्ड की पुष्टि करें' },
  'auth.agreeTerms': { en: 'I agree to the Terms of Service and Privacy Policy', hi: 'मैं सेवा की शर्तों और गोपनीयता नीति से सहमत हूं' },
  'auth.createAccountBtn': { en: 'Create Account', hi: 'खाता बनाएं' },
  'auth.alreadyHaveAccount': { en: 'Already have an account?', hi: 'क्या आपके पास पहले से खाता है?' },
  'auth.signInLink': { en: 'Sign in', hi: 'साइन इन करें' },
  'auth.checkEmail': { en: 'Check Your Email', hi: 'अपना ईमेल जांचें' },
  'auth.verificationSent': { en: "We've sent a verification link to your email. Click the link to activate your account and start your 7-day free trial.", hi: 'हमने आपके ईमेल पर एक सत्यापन लिंक भेजा है। अपने खाते को सक्रिय करने और 7-दिन की मुफ्त परीक्षा शुरू करने के लिए लिंक पर क्लिक करें।' },
  'auth.backToLogin': { en: 'Back to Login', hi: 'लॉगिन पर वापस जाएं' },
  'auth.trialBanner': { en: '7-Day Free Trial - Get full Pro access when you sign up', hi: '7-दिन की मुफ्त परीक्षा - साइन अप करने पर पूर्ण प्रो एक्सेस प्राप्त करें' },

  // Dashboard
  'dashboard.title': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'dashboard.welcome': { en: 'Welcome back', hi: 'वापसी पर स्वागत है' },
  'dashboard.progress': { en: 'Your Progress', hi: 'आपकी प्रगति' },
  'dashboard.streak': { en: 'Day Streak', hi: 'दिन की स्ट्रीक' },
  'dashboard.studyHours': { en: 'Study Hours', hi: 'अध्ययन घंटे' },
  'dashboard.topicsCovered': { en: 'Topics Covered', hi: 'कवर किए गए विषय' },
  'dashboard.quizzesTaken': { en: 'Quizzes Taken', hi: 'ली गई क्विज़' },
  'dashboard.continue': { en: 'Continue Learning', hi: 'सीखना जारी रखें' },
  'dashboard.dailyGoal': { en: 'Daily Goal', hi: 'दैनिक लक्ष्य' },
  'dashboard.recentActivity': { en: 'Recent Activity', hi: 'हाल की गतिविधि' },

  // Search
  'search.placeholder': { en: 'Search anything about UPSC...', hi: 'UPSC के बारे में कुछ भी खोजें...' },
  'search.results': { en: 'Search Results', hi: 'खोज परिणाम' },
  'search.noResults': { en: 'No results found', hi: 'कोई परिणाम नहीं मिला' },
  'search.tryDifferent': { en: 'Try a different search term', hi: 'कोई अलग खोज शब्द आज़माएं' },

  // Syllabus
  'syllabus.title': { en: 'Syllabus Navigator', hi: 'पाठ्यक्रम नेविगेटर' },
  'syllabus.gs1': { en: 'GS Paper I', hi: 'जीएस पेपर I' },
  'syllabus.gs2': { en: 'GS Paper II', hi: 'जीएस पेपर II' },
  'syllabus.gs3': { en: 'GS Paper III', hi: 'जीएस पेपर III' },
  'syllabus.gs4': { en: 'GS Paper IV', hi: 'जीएस पेपर IV' },
  'syllabus.csat': { en: 'CSAT', hi: 'सीसैट' },
  'syllabus.essay': { en: 'Essay', hi: 'निबंध' },
  'syllabus.completed': { en: 'Completed', hi: 'पूर्ण' },
  'syllabus.remaining': { en: 'Remaining', hi: 'शेष' },

  // Notes
  'notes.title': { en: 'Study Notes', hi: 'अध्ययन नोट्स' },
  'notes.generate': { en: 'Generate Notes', hi: 'नोट्स बनाएं' },
  'notes.topic': { en: 'Enter topic...', hi: 'विषय दर्ज करें...' },
  'notes.level': { en: 'Level', hi: 'स्तर' },
  'notes.basic': { en: 'Basic', hi: 'बुनियादी' },
  'notes.intermediate': { en: 'Intermediate', hi: 'मध्यम' },
  'notes.advanced': { en: 'Advanced', hi: 'उन्नत' },
  'notes.readingTime': { en: 'Reading Time', hi: 'पढ़ने का समय' },
  'notes.minutes': { en: 'min', hi: 'मिनट' },

  // News
  'news.title': { en: 'Daily News', hi: 'दैनिक समाचार' },
  'news.generateToday': { en: "Generate Today's News", hi: 'आज के समाचार बनाएं' },
  'news.summary': { en: '1-Line Summary', hi: '1-पंक्ति सारांश' },
  'news.keyPoints': { en: 'Key Points', hi: 'मुख्य बिंदु' },
  'news.whyImportant': { en: 'Why This Matters for UPSC', hi: 'UPSC के लिए यह क्यों महत्वपूर्ण है' },
  'news.categories': { en: 'Categories', hi: 'श्रेणियां' },
  'news.politics': { en: 'Politics', hi: 'राजनीति' },
  'news.economy': { en: 'Economy', hi: 'अर्थव्यवस्था' },
  'news.international': { en: 'International', hi: 'अंतर्राष्ट्रीय' },
  'news.science': { en: 'Science & Tech', hi: 'विज्ञान और प्रौद्योगिकी' },
  'news.environment': { en: 'Environment', hi: 'पर्यावरण' },

  // Practice
  'practice.title': { en: 'Practice', hi: 'अभ्यास' },
  'practice.mcqs': { en: 'MCQs', hi: 'बहुविकल्पीय प्रश्न' },
  'practice.pyqs': { en: 'Previous Year Questions', hi: 'पिछले वर्ष के प्रश्न' },
  'practice.correct': { en: 'Correct', hi: 'सही' },
  'practice.incorrect': { en: 'Incorrect', hi: 'गलत' },
  'practice.score': { en: 'Score', hi: 'स्कोर' },
  'practice.timeTaken': { en: 'Time Taken', hi: 'लिया गया समय' },
  'practice.explanation': { en: 'Explanation', hi: 'स्पष्टीकरण' },
  'practice.nextQuestion': { en: 'Next Question', hi: 'अगला प्रश्न' },
  'practice.finishQuiz': { en: 'Finish Quiz', hi: 'क्विज़ समाप्त करें' },
  'practice.paper': { en: 'Paper', hi: 'पेपर' },
  'practice.year': { en: 'Year', hi: 'वर्ष' },

  // Videos
  'videos.title': { en: 'Videos', hi: 'वीडियो' },
  'videos.dailyNews': { en: 'Daily News Videos', hi: 'दैनिक समाचार वीडियो' },
  'videos.myDoubts': { en: 'My Doubt Videos', hi: 'मेरे संदेह वीडियो' },
  'videos.createNew': { en: 'Create New Doubt Video', hi: 'नया संदेह वीडियो बनाएं' },
  'videos.duration': { en: 'Duration', hi: 'अवधि' },
  'videos.seconds': { en: 'seconds', hi: 'सेकंड' },
  'videos.status': { en: 'Status', hi: 'स्थिति' },
  'videos.queued': { en: 'Queued', hi: 'कतार में' },
  'videos.processing': { en: 'Processing', hi: 'प्रोसेसिंग' },
  'videos.completed': { en: 'Completed', hi: 'पूर्ण' },
  'videos.failed': { en: 'Failed', hi: 'विफल' },

  // Essays
  'essay.title': { en: 'Essay Writing', hi: 'निबंध लेखन' },
  'essay.sampleTopics': { en: 'Sample Topics', hi: 'नमूना विषय' },
  'essay.generateEssay': { en: 'Generate Essay', hi: 'निबंध बनाएं' },
  'essay.yourEssay': { en: 'Your Essay', hi: 'आपका निबंध' },
  'essay.structure': { en: 'Essay Structure', hi: 'निबंध संरचना' },
  'essay.introduction': { en: 'Introduction', hi: 'परिचय' },
  'essay.body': { en: 'Body', hi: 'मुख्य भाग' },
  'essay.conclusion': { en: 'Conclusion', hi: 'निष्कर्ष' },
  'essay.wordLimit': { en: 'Word Limit', hi: 'शब्द सीमा' },
  'essay.tips': { en: 'Tips for Good Marks', hi: 'अच्छे अंकों के लिए सुझाव' },

  // Answers
  'answer.title': { en: 'Answer Writing', hi: 'उत्तर लेखन' },
  'answer.writeAnswer': { en: 'Write Your Answer', hi: 'अपना उत्तर लिखें' },
  'answer.wordCount': { en: 'Word Count', hi: 'शब्द गणना' },
  'answer.timeLimit': { en: 'Time Limit', hi: 'समय सीमा' },
  'answer.aiFeedback': { en: 'AI Feedback', hi: 'AI फीडबैक' },
  'answer.score': { en: 'Score', hi: 'स्कोर' },
  'answer.startTimer': { en: 'Start Timer', hi: 'टाइमर शुरू करें' },
  'answer.pauseTimer': { en: 'Pause Timer', hi: 'टाइमर रोकें' },

  // Ethics
  'ethics.title': { en: 'Ethics Case Studies', hi: 'नैतिकता केस स्टडीज़' },
  'ethics.scenario': { en: 'Scenario', hi: 'परिदृश्य' },
  'ethics.stakeholder': { en: 'Stakeholder Analysis', hi: 'हितधारक विश्लेषण' },
  'ethics.yourResponse': { en: 'Your Response', hi: 'आपकी प्रतिक्रिया' },
  'ethics.aiFeedback': { en: 'AI Feedback', hi: 'AI फीडबैक' },
  'ethics.principles': { en: 'Ethical Principles', hi: 'नैतिक सिद्धांत' },
  'ethics.dilemma': { en: 'Ethical Dilemma', hi: 'नैतिक दुविधा' },
  'ethics.role': { en: 'Your Role', hi: 'आपकी भूमिका' },

  // Interview
  'interview.title': { en: 'Interview Preparation', hi: 'साक्षात्कार तैयारी' },
  'interview.questions': { en: 'Common Questions', hi: 'सामान्य प्रश्न' },
  'interview.timer': { en: 'Practice Timer', hi: 'अभ्यास टाइमर' },
  'interview.yourAnswer': { en: 'Your Answer', hi: 'आपका उत्तर' },
  'interview.exampleAnswer': { en: 'Example Answer', hi: 'उदाहरण उत्तर' },
  'interview.tips': { en: 'Preparation Tips', hi: 'तैयारी के सुझाव' },
  'interview.bodyLanguage': { en: 'Body Language', hi: 'शारीरिक भाषा' },
  'interview.confidence': { en: 'Confidence', hi: 'आत्मविश्वास' },
  'interview.clarity': { en: 'Clarity', hi: 'स्पष्टता' },

  // Memory Palace
  'memory.title': { en: 'Memory Palace', hi: 'स्मृति महल' },
  'memory.room': { en: 'Room', hi: 'कमरा' },
  'memory.addMemory': { en: 'Add Memory', hi: 'स्मृति जोड़ें' },
  'memory.fact': { en: 'Fact', hi: 'तथ्य' },
  'memory.visual': { en: 'Visual', hi: 'दृश्य' },
  'memory.constitution': { en: 'Constitution Hall', hi: 'संविधान हॉल' },
  'memory.geography': { en: 'Geography Room', hi: 'भूगोल कमरा' },
  'memory.history': { en: 'History Room', hi: 'इतिहास कमरा' },
  'memory.economy': { en: 'Economy Room', hi: 'अर्थव्यवस्था कमरा' },

  // Lectures
  'lectures.title': { en: 'Lectures & Documentaries', hi: 'व्याख्यान और वृत्तचित्र' },
  'lectures.library': { en: 'Video Library', hi: 'वीडियो लाइब्रेरी' },
  'lectures.transcript': { en: 'Transcript', hi: 'ट्रांसक्रिप्ट' },
  'lectures.progress': { en: 'Watch Progress', hi: 'देखने की प्रगति' },
  'lectures.save': { en: 'Save for Later', hi: 'बाद के लिए सहेजें' },
  'lectures.subject': { en: 'Subject', hi: 'विषय' },
  'lectures.topic': { en: 'Topic', hi: 'विषय' },
  'lectures.duration': { en: 'Duration', hi: 'अवधि' },

  // Community
  'community.title': { en: 'Community Discussion', hi: 'समुदाय चर्चा' },
  'community.newDiscussion': { en: 'New Discussion', hi: 'नई चर्चा' },
  'community.discussion': { en: 'Discussion', hi: 'चर्चा' },
  'community.reply': { en: 'Reply', hi: 'जवाब' },
  'community.upvote': { en: 'Upvote', hi: 'अपवोट' },
  'community.replies': { en: 'Replies', hi: 'जवाब' },
  'community.views': { en: 'Views', hi: 'दृश्य' },
  'community.pinned': { en: 'Pinned', hi: 'पिन किया गया' },
  'community.accepted': { en: 'Accepted Answer', hi: 'स्वीकृत उत्तर' },
  'community.all': { en: 'All', hi: 'सभी' },

  // Trial
  'trial.freeTrial': { en: '7-Day Free Trial', hi: '7-दिन की मुफ्त परीक्षा' },
  'trial.active': { en: 'Active', hi: 'सक्रिय' },
  'trial.daysLeft': { en: 'days left', hi: 'दिन बाकी' },
  'trial.upgrade': { en: 'Upgrade Now', hi: 'अभी अपग्रेड करें' },

  // Errors
  'error.network': { en: 'Network Error', hi: 'नेटवर्क त्रुटि' },
  'error.tryAgain': { en: 'Please try again', hi: 'कृपया पुनः प्रयास करें' },
  'error.somethingWrong': { en: 'Something went wrong', hi: 'कुछ गलत हो गया' },
  'error.offline': { en: 'You are offline', hi: 'आप ऑफलाइन हैं' },

  // Language
  'language.english': { en: 'English', hi: 'अंग्रेज़ी' },
  'language.hindi': { en: 'Hindi', hi: 'हिंदी' },
  'language.switch': { en: 'Switch Language', hi: 'भाषा बदलें' },
  'language.current': { en: 'Current Language', hi: 'वर्तमान भाषा' },

  // Subscription
  'sub.monthly': { en: 'Monthly', hi: 'मासिक' },
  'sub.quarterly': { en: 'Quarterly', hi: 'त्रैमासिक' },
  'sub.halfYearly': { en: 'Half Yearly', hi: 'अर्ध-वार्षिक' },
  'sub.annual': { en: 'Annual', hi: 'वार्षिक' },
  'sub.rupees': { en: '₹', hi: '₹' },
  'sub.perMonth': { en: '/month', hi: '/महीना' },
  'sub.buyNow': { en: 'Buy Now', hi: 'अभी खरीदें' },
  'sub.currentPlan': { en: 'Current Plan', hi: 'वर्तमान योजना' },
  'sub.free': { en: 'Free', hi: 'मुफ्त' },
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize language from localStorage or browser preference
  useEffect(() => {
    const savedLang = localStorage.getItem('prepx-language') as Language | null;
    const browserLang = navigator.language.split('-')[0];

    let initialLang: Language = 'en';

    if (savedLang && (savedLang === 'en' || savedLang === 'hi')) {
      initialLang = savedLang;
    } else if (browserLang === 'hi') {
      initialLang = 'hi';
    }

    setLanguageState(initialLang);
    setIsInitialized(true);
  }, []);

  // Set language with persistence
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('prepx-language', lang);

    // Also sync to Supabase if user is logged in
    try {
      const supabase = getSupabaseBrowserClient(
      );

      // Get current user (async, don't wait)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          (supabase.from('user_profiles') as any).upsert({
            user_id: user.id,
            preferred_language: lang,
            updated_at: new Date().toISOString(),
          }).catch(console.error);
        }
      }).catch(console.error);
    } catch (error) {
      console.error('Failed to sync language preference:', error);
    }
  }, []);

  // Toggle between English and Hindi
  const toggleLanguage = useCallback(() => {
    const newLang = language === 'en' ? 'hi' : 'en';
    setLanguage(newLang);
  }, [language, setLanguage]);

  // Translation function
  const t = useCallback((key: TranslationKey): string => {
    return key[language];
  }, [language]);

  // Helper to get translation by string key
  const getTranslation = useCallback((key: string): string => {
    const translation = translations[key];
    if (translation) {
      return translation[language];
    }
    return key; // Return key if not found
  }, [language]);

  // Extend t function to accept string keys
  const tExtended = useCallback((key: string | TranslationKey): string => {
    if (typeof key === 'string') {
      return getTranslation(key);
    }
    return t(key);
  }, [getTranslation, t]);

  const contextValue: LanguageContextType = {
    language,
    setLanguage,
    toggleLanguage,
    t: tExtended,
    isHindi: language === 'hi',
  };

  if (!isInitialized) {
    // Return children with a loading state or just render
    return (
      <LanguageContext.Provider value={contextValue}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

// Custom hook to use language context
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Helper function to get translation for a key (without hook)
export function getLocalizedText(key: string, language: Language): string {
  const translation = translations[key];
  if (translation) {
    return translation[language];
  }
  return key;
}
