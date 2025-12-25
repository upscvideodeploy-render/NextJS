/**
 * Utility functions for UPSC PrepX-AI
 */

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isServer(): boolean {
  return typeof window === 'undefined';
}

export function isClient(): boolean {
  return typeof window !== 'undefined';
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// UPSC-related constants
export const UPSC_CONSTANTS = {
  PAPERS: ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'CSAT'],
  MARKS: {
    GS1: 250,
    GS2: 250,
    GS3: 250,
    GS4: 250,
    Essay: 250,
    CSAT: 200,
  },
  TIME: {
    GS1: 120,
    GS2: 120,
    GS3: 120,
    GS4: 120,
    Essay: 120,
    CSAT: 120,
  },
} as const;

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export function getConfidenceLabel(score: number): 'high' | 'moderate' | 'low' {
  if (score > 0.75) return 'high';
  if (score > 0.60) return 'moderate';
  return 'low';
}

export function getConfidenceColor(label: 'high' | 'moderate' | 'low'): string {
  switch (label) {
    case 'high': return 'text-green-400 bg-green-400/10 border-green-400/30';
    case 'moderate': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    case 'low': return 'text-red-400 bg-red-400/10 border-red-400/30';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  }
}

export function calculateDaysRemaining(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
