'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Story 9.1: AI Teaching Assistant - Chat Interface
// Story 9.3: Motivational Check-ins Display
// AC 1-10: Full chat UI with message history, context awareness, and follow-ups

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  follow_ups?: string[];
  created_at?: string;
}

interface Session {
  session_id: string;
  first_message: string;
  created_at: string;
}

interface UsageStats {
  messages_today: number;
  daily_limit: number;
  remaining: number;
  is_pro: boolean;
}

// Story 9.3: Check-in interface
interface Checkin {
  id: string;
  checkin_type: string;
  message: string;
  sent_at: string;
  video_url?: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Story 9.3: Check-ins state
  const [pendingCheckins, setPendingCheckins] = useState<Checkin[]>([]);
  const [respondingToCheckin, setRespondingToCheckin] = useState<string | null>(null);
  const [checkinResponse, setCheckinResponse] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  };

  const initializeChat = async () => {
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      setError('Please log in to use the assistant');
      return;
    }

    // Get usage stats
    try {
      const res = await fetch('/api/assistant', {
        headers: { Authorization: authHeader },
      });
      if (res.ok) {
        const data = await res.json();
        setUsage(data.usage);
      }
    } catch (e) {
      console.error('Failed to get usage:', e);
    }

    // Get past sessions
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'get_sessions' }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error('Failed to get sessions:', e);
    }

    // Story 9.3: Get pending check-ins
    try {
      const res = await fetch('/api/assistant/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'get_pending' }),
      });
      if (res.ok) {
        const data = await res.json();
        setPendingCheckins(data.checkins || []);
      }
    } catch (e) {
      console.error('Failed to get check-ins:', e);
    }

    // Start new session
    startNewSession();
  };

  const startNewSession = () => {
    setSessionId(crypto.randomUUID());
    setMessages([{
      role: 'assistant',
      content: `👋 Hello! I'm your UPSC Guru - your personal AI teaching assistant.

I can help you with:
• 📚 Explaining complex UPSC topics
• ✍️ Answer writing guidance
• 🎯 Practice questions and feedback
• 📊 Study strategy and planning
• 💡 Doubt resolution

What would you like to learn about today?`,
      follow_ups: [
        'Explain the difference between Fundamental Rights and DPSPs',
        'How should I prepare for Indian Economy?',
        'What are important current affairs topics this month?',
      ],
    }]);
    setError(null);
  };

  const loadSession = async (session: Session) => {
    setSessionId(session.session_id);
    setLoading(true);
    setError(null);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'get_history', session_id: session.session_id }),
      });

      if (res.ok) {
        const data = await res.json();
        const loadedMessages: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          role: 'user',
          content: m.message_text,
          created_at: m.created_at,
        })).flatMap((m: any, i: number) => {
          const response = data.messages[i];
          if (response?.response_text) {
            return [
              m,
              {
                id: response.id + '_response',
                role: 'assistant' as const,
                content: response.response_text,
                sources: response.sources_used?.map((s: any) => s.source).filter(Boolean),
                follow_ups: response.follow_up_suggestions,
                created_at: response.created_at,
              },
            ];
          }
          return [m];
        });
        setMessages(loadedMessages);
      }
    } catch (e) {
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    // AC 10: Check rate limit
    if (usage && usage.remaining <= 0 && !usage.is_pro) {
      setError(`Daily limit reached (${usage.daily_limit} messages). Upgrade to Pro for unlimited access.`);
      return;
    }

    setInput('');
    setError(null);
    setLoading(true);

    // Add user message immediately
    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          action: 'send_message',
          message: text,
          session_id: sessionId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to get response');
      }

      const data = await res.json();

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        follow_ups: data.follow_ups,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Update usage
      if (data.usage) {
        setUsage({
          messages_today: data.usage.messages_today,
          daily_limit: data.usage.daily_limit,
          remaining: data.usage.remaining,
          is_pro: usage?.is_pro || false,
        });
      }

      // Update session ID if new
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to send message');
      // Remove user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFollowUp = (question: string) => {
    sendMessage(question);
  };

  // Story 9.3: Handle check-in response
  const respondToCheckin = async (checkinId: string) => {
    if (!checkinResponse.trim()) return;
    
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/assistant/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ 
          action: 'respond', 
          checkin_id: checkinId,
          response: checkinResponse 
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        // Add follow-up to chat
        if (data.follow_up) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.follow_up,
          }]);
        }
        // Remove from pending
        setPendingCheckins(prev => prev.filter(c => c.id !== checkinId));
        setRespondingToCheckin(null);
        setCheckinResponse('');
      }
    } catch (e) {
      console.error('Failed to respond to check-in:', e);
    }
  };

  // Story 9.3: Dismiss check-in
  const dismissCheckin = async (checkinId: string) => {
    try {
      const authHeader = await getAuthHeader();
      await fetch('/api/assistant/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ action: 'mark_read', checkin_id: checkinId }),
      });
      setPendingCheckins(prev => prev.filter(c => c.id !== checkinId));
    } catch (e) {
      console.error('Failed to dismiss check-in:', e);
    }
  };

  if (error === 'Please log in to use the assistant') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
          <p className="text-gray-600">Please log in to use the AI Teaching Assistant</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Session History */}
      {showSidebar && (
        <div className="w-72 bg-white border-r flex flex-col">
          <div className="p-4 border-b">
            <button
              onClick={startNewSession}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              <span>+</span> New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Recent Conversations
              </h3>
              {sessions.length > 0 ? (
                <div className="space-y-1">
                  {sessions.map((s) => (
                    <button
                      key={s.session_id}
                      onClick={() => loadSession(s)}
                      className={`w-full text-left p-3 rounded-lg hover:bg-gray-100 transition ${
                        sessionId === s.session_id ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <div className="text-sm font-medium truncate">
                        {s.first_message || 'New conversation'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No conversations yet
                </p>
              )}
            </div>
          </div>

          {/* Usage Stats */}
          {usage && (
            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Messages today:</span>
                <span className={`font-medium ${usage.remaining < 10 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {usage.messages_today}/{usage.daily_limit}
                </span>
              </div>
              {!usage.is_pro && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${usage.remaining < 10 ? 'bg-orange-500' : 'bg-blue-500'}`}
                      style={{ width: `${(usage.messages_today / usage.daily_limit) * 100}%` }}
                    />
                  </div>
                  {usage.remaining < 10 && (
                    <p className="text-xs text-orange-600 mt-1">
                      {usage.remaining} messages remaining
                    </p>
                  )}
                </div>
              )}
              {usage.is_pro && (
                <div className="mt-1 text-xs text-blue-600 font-medium">✨ Pro - Unlimited</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                🎓 UPSC Guru
              </h1>
              <p className="text-sm text-gray-500">Your AI Teaching Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              Online
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Story 9.3: Pending Check-ins Banner */}
          {pendingCheckins.length > 0 && (
            <div className="mb-4 space-y-3">
              {pendingCheckins.map(checkin => (
                <div 
                  key={checkin.id} 
                  className={`p-4 rounded-xl border-2 shadow-sm ${
                    checkin.checkin_type === 'milestone' ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300' :
                    checkin.checkin_type === 'streak' ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300' :
                    checkin.checkin_type === 'struggle' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300' :
                    'bg-gradient-to-r from-green-50 to-teal-50 border-green-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">
                          {checkin.checkin_type === 'milestone' ? '🏆' :
                           checkin.checkin_type === 'streak' ? '🔥' :
                           checkin.checkin_type === 'struggle' ? '💙' : '✨'}
                        </span>
                        <span className="font-semibold capitalize">
                          {checkin.checkin_type === 'milestone' ? 'Milestone Achieved!' :
                           checkin.checkin_type === 'streak' ? 'Streak Update!' :
                           checkin.checkin_type === 'struggle' ? 'We Miss You!' : 'Daily Check-in'}
                        </span>
                      </div>
                      <p className="text-gray-700">{checkin.message}</p>
                      
                      {/* Video for milestones (AC 8) */}
                      {checkin.video_url && (
                        <div className="mt-3">
                          <video 
                            src={checkin.video_url} 
                            controls 
                            className="rounded-lg max-w-sm"
                          />
                        </div>
                      )}
                      
                      {/* Response area (AC 7) */}
                      {respondingToCheckin === checkin.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={checkinResponse}
                            onChange={(e) => setCheckinResponse(e.target.value)}
                            placeholder="Share how you're feeling..."
                            className="w-full p-3 border rounded-lg text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => respondToCheckin(checkin.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                            >
                              Send Response
                            </button>
                            <button
                              onClick={() => { setRespondingToCheckin(null); setCheckinResponse(''); }}
                              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => setRespondingToCheckin(checkin.id)}
                            className="px-4 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
                          >
                            💬 Reply
                          </button>
                          <button
                            onClick={() => dismissCheckin(checkin.id)}
                            className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => dismissCheckin(checkin.id)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-5 py-4 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border shadow-sm'
                }`}
              >
                {/* Message Content */}
                <div className={`whitespace-pre-wrap ${msg.role === 'user' ? '' : 'prose prose-sm max-w-none'}`}>
                  {msg.content}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      📚 Sources: {msg.sources.slice(0, 3).join(', ')}
                    </div>
                  </div>
                )}

                {/* Follow-up Suggestions */}
                {msg.role === 'assistant' && msg.follow_ups && msg.follow_ups.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">💡 You might want to ask:</div>
                    <div className="space-y-2">
                      {msg.follow_ups.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleFollowUp(q)}
                          className="block w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition text-blue-600"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border shadow-sm rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about UPSC preparation..."
                className="flex-1 resize-none border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
