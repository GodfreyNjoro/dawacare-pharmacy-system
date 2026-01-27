import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Pill,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Heart,
} from 'lucide-react';
import { Button, Input } from './ui';
import { useAuth } from '../lib/auth-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Format AI response text into beautiful styled content
function FormattedMessage({ content }: { content: string }) {
  const formatText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="space-y-1.5 my-2">
            {listItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushList();
        return;
      }

      // Headers
      if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
        flushList();
        const headerText = trimmed.replace(/^#+\s*/, '');
        elements.push(
          <div key={index} className="flex items-center gap-2 mt-3 mb-2">
            <div className="h-5 w-1 bg-emerald-500 rounded-full" />
            <span className="font-semibold text-emerald-700 text-sm">{headerText}</span>
          </div>
        );
        return;
      }

      // Warning/Disclaimer
      if (trimmed.toLowerCase().includes('disclaimer') || trimmed.toLowerCase().includes('warning') || trimmed.includes('⚠️')) {
        flushList();
        const warningText = trimmed.replace(/^[⚠️\s*]+/, '').replace(/^\*+/, '').replace(/\*+$/, '');
        elements.push(
          <div key={index} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 my-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-amber-700">{warningText}</span>
          </div>
        );
        return;
      }

      // Bullet points
      if (trimmed.match(/^[-*•]\s/)) {
        listItems.push(trimmed.replace(/^[-*•]\s*/, ''));
        return;
      }

      // Numbered lists
      if (trimmed.match(/^\d+\.\s/)) {
        listItems.push(trimmed.replace(/^\d+\.\s*/, ''));
        return;
      }

      // Bold text
      if (trimmed.includes('**')) {
        flushList();
        const parts = trimmed.split(/\*\*(.+?)\*\*/g);
        elements.push(
          <p key={index} className="text-sm my-1.5">
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i} className="text-emerald-700">{part}</strong> : part
            )}
          </p>
        );
        return;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={index} className="text-sm my-1.5 leading-relaxed">{trimmed}</p>
      );
    });

    flushList();
    return elements;
  };

  return <div className="space-y-0.5">{formatText(content)}</div>;
}

export default function AIPharmacistChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'welcome_message',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const apiMessages = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }))
      .concat({ role: 'user', content: userMessage.content });

    try {
      // Call the Electron main process to handle LLM API
      const response = await window.electronAPI.chatWithAI(apiMessages);
      
      if (response.success && response.message) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again or consult a pharmacist directly.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'welcome_message',
        timestamp: new Date(),
      },
    ]);
  };

  const WelcomeMessage = () => (
    <div className="space-y-3">
      <p className="text-sm">
        Hello! I'm <span className="font-semibold text-emerald-600">DawaCare's AI Pharmacist Assistant</span>.
        I'm here to help you with pharmaceutical information.
      </p>
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">I can assist with:</p>
        <div className="grid gap-2">
          {[
            { icon: Pill, text: 'Drug information & dosages', color: 'text-blue-500' },
            { icon: AlertTriangle, text: 'Drug interaction warnings', color: 'text-amber-500' },
            { icon: Info, text: 'Side effects information', color: 'text-purple-500' },
            { icon: CheckCircle2, text: 'Stock availability', color: 'text-emerald-500' },
            { icon: Heart, text: 'General health advice', color: 'text-pink-500' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="text-sm text-gray-700">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-600 mt-3">How can I assist you today?</p>
    </div>
  );

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Only show for authenticated users
  if (!user) return null;

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <Pill className="h-5 w-5" />
          <span className="font-medium">AI Pharmacist</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Pharmacist Assistant</h3>
                <p className="text-xs text-emerald-100">Powered by DawaCare</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex gap-2 max-w-[85%] ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                    }`}
                  >
                    {message.content === 'welcome_message' ? (
                      <WelcomeMessage />
                    ) : message.role === 'assistant' ? (
                      <FormattedMessage content={message.content} />
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about medications, dosages..."
                className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              ⚠️ For informational purposes only. Consult a pharmacist for medical advice.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
