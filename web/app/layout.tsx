import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UPSC PrepX-AI | AI-Powered UPSC Preparation',
  description: 'Enterprise AI-powered UPSC exam preparation platform with video generation, adaptive learning, and comprehensive study materials.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
        {children}
      </body>
    </html>
  );
}
