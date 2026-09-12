'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare, Send, Bot, User, Sparkles, Loader2,
  Briefcase, CalendarDays, DollarSign, Users, Clock
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { label: 'Leave Policy', icon: <CalendarDays className="h-3.5 w-3.5" />, prompt: 'What is the company leave policy?' },
  { label: 'Payroll Info', icon: <DollarSign className="h-3.5 w-3.5" />, prompt: 'When is the next payroll date?' },
  { label: 'Benefits', icon: <Users className="h-3.5 w-3.5" />, prompt: 'What benefits am I eligible for?' },
  { label: 'Holidays', icon: <Clock className="h-3.5 w-3.5" />, prompt: 'What are the upcoming company holidays?' },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '0',
    role: 'assistant',
    content: 'Hello! 👋 I\'m your 3Boxes HRMS AI Assistant. I can help you with:\n\n• **Leave & Attendance** queries\n• **Payroll & Compensation** questions\n• **Company Policies** information\n• **Recruitment** process guidance\n• **Benefits** and perks details\n\nHow can I assist you today?',
    timestamp: new Date(),
  },
];

export function AIChatbot() {
  const { userRole, userName, currentCompany } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = `User: ${userName}, Role: ${userRole}, Company: ${currentCompany?.name || 'Unknown'}`;
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content.trim(), context }),
      });

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'I apologize, but I was unable to process your request. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I\'m currently experiencing connectivity issues. Please try again in a moment, or contact your HR department for immediate assistance.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-emerald-600" /> AI Chatbot
          </h1>
          <p className="text-muted-foreground text-sm">Your AI-powered HR assistant</p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          <Sparkles className="h-3 w-3 mr-1" /> Online
        </Badge>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  {msg.role === 'assistant' ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                        <Bot className="h-3 w-3 text-emerald-600" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">3Boxes AI</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-[10px] font-medium text-muted-foreground">{userName || 'You'}</span>
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                        <User className="h-3 w-3 text-green-600" />
                      </div>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-muted rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                    <Bot className="h-3 w-3 text-emerald-600" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">3Boxes AI</span>
                </div>
                <div className="p-3 rounded-lg rounded-tl-none bg-muted">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Quick Actions */}
        <div className="px-4 py-2 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => sendMessage(action.prompt)}
                disabled={isLoading}
              >
                {action.icon}
                <span className="ml-1">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about HR, policies, leaves..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={!input.trim() || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
