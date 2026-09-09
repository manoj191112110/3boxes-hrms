'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FiSend, FiMessageSquare, FiPlus, FiClock,
  FiCalendar, FiDollarSign, FiFileText, FiHelpCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

const aiAssistantTips = [
  { title: 'Be Specific in Queries', description: 'Ask detailed questions like "What is the maternity leave policy for employees with 2+ years?" instead of vague queries for better results.' },
  { title: 'Use for Data Analysis', description: 'Leverage AI to analyze attendance trends, leave patterns, and payroll data across your organization.' },
  { title: 'Ask About Policies', description: 'Query any company policy instantly — from dress code to travel reimbursement — without searching through manuals.' },
  { title: 'Generate Templates', description: 'Ask the AI to create offer letters, performance review templates, or email drafts for common HR scenarios.' },
  { title: 'Explore Insights', description: 'Use the assistant to discover workforce trends, identify attrition risks, and get proactive recommendations.' },
];

const aiAssistantWorkflowSteps = [
  { step: 1, title: 'Open AI Assistant', description: 'Navigate to the AI Assistant module from the sidebar' },
  { step: 2, title: 'Ask a Question', description: 'Type your HR-related query in natural language' },
  { step: 3, title: 'Review AI Response', description: 'Read the AI-generated answer and supporting details' },
  { step: 4, title: 'Refine Your Query', description: 'Follow up with more specific questions if needed' },
  { step: 5, title: 'Apply Suggestion', description: 'Take action based on the AI recommendation' },
  { step: 6, title: 'Provide Feedback', description: 'Rate the response to help improve AI accuracy' },
];

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string; timestamp: Date;
}

interface ChatSession {
  id: string; title: string; createdAt: Date; messages: ChatMessage[];
}

const quickActions = [
  { label: 'Check Leave Balance', icon: <FiCalendar className="w-4 h-4" />, prompt: 'What is my current leave balance? How many days do I have remaining?' },
  { label: 'Attendance Query', icon: <FiClock className="w-4 h-4" />, prompt: 'Can you help me check my attendance record for this month?' },
  { label: 'Payslip Help', icon: <FiDollarSign className="w-4 h-4" />, prompt: 'How can I download my payslip? What are the deductions on my salary?' },
  { label: 'Policy Query', icon: <FiFileText className="w-4 h-4" />, prompt: 'What is the company leave policy? How many sick leaves am I entitled to?' },
];

export default function AIAssistantPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    // Create initial session
    const initialId = `session-${Date.now()}`;
    setSessions([{ id: initialId, title: 'New Chat', createdAt: new Date(), messages: [{ id: `msg-${Date.now()}`, role: 'assistant', content: 'Hello! I\'m your 3Boxes AI HRMS assistant. I can help you with leave management, attendance, payroll, policies, recruitment, and more. How can I help you today?', timestamp: new Date() }] }]);
    setActiveSessionId(initialId);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const createNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = { id: newId, title: 'New Chat', createdAt: new Date(), messages: [{ id: `msg-${Date.now()}`, role: 'assistant', content: 'Hello! How can I assist you today?', timestamp: new Date() }] };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newId);
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const sessionId = activeSessionId || `session-${Date.now()}`;
    if (!activeSessionId) setActiveSessionId(sessionId);

    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: text, timestamp: new Date() };

    setSessions((prev) => {
      const existing = prev.find((s) => s.id === sessionId);
      if (existing) {
        return prev.map((s) => s.id === sessionId ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length <= 1 ? text.slice(0, 30) : s.title } : s);
      }
      return [{ id: sessionId, title: text.slice(0, 30), createdAt: new Date(), messages: [userMsg] }, ...prev];
    });

    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: text, sessionId, context: 'hrms_assistant' }),
      });

      if (!res.ok) throw new Error('Failed');

      const data = await res.json();
      const assistantMsg: ChatMessage = { id: `msg-${Date.now() + 1}`, role: 'assistant', content: data.reply, timestamp: new Date() };

      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s));
    } catch {
      const errorMsg: ChatMessage = { id: `msg-${Date.now() + 1}`, role: 'assistant', content: 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.', timestamp: new Date() };
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
      toast.error('Failed to get response');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Module Tips & Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ModuleTips moduleKey="ai_assistant" title="AI Assistant Tips" tips={aiAssistantTips} userRole={user?.role} />
        <ModuleWorkflow moduleKey="ai_assistant" title="How to Use AI Assistant" steps={aiAssistantWorkflowSteps} accentColor="violet" userRole={user?.role} />
      </div>

      <div className="flex h-[calc(100vh-300px)] gap-4">
      {/* Sidebar - Chat History */}
      <div className="hidden md:flex flex-col w-64 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200">
          <button onClick={createNewChat} className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2">
            <FiPlus className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => setActiveSessionId(s.id)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${s.id === activeSessionId ? 'bg-green-50 text-green-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <div className="flex items-center gap-2"><FiMessageSquare className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{s.title}</span></div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white">
            <FiHelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">3Boxes AI Assistant</h2>
            <p className="text-xs text-slate-500">HRMS Help & Support</p>
          </div>
          <div className="ml-auto md:hidden">
            <button onClick={createNewChat} className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100"><FiPlus className="w-3.5 h-3.5 inline" /> New</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeSession?.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-green-600 text-white rounded-2xl rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-md'} px-4 py-3`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-green-200' : 'text-slate-400'}`}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Actions */}
        {activeSession && activeSession.messages.length <= 2 && (
          <div className="px-4 py-2 border-t border-slate-100">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {quickActions.map((qa) => (
                <button key={qa.label} onClick={() => sendMessage(qa.prompt)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 whitespace-nowrap transition-colors">
                  {qa.icon} {qa.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-200">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask me anything about HR..."
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              disabled={isLoading}
            />
            <button onClick={() => sendMessage()} disabled={isLoading || !input.trim()} className="px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
              <FiSend className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
