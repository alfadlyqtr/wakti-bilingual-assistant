// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Globe, Instagram, Search, Send, Clock,
  ChevronRight, Filter, RefreshCw, Inbox, MessageSquare, User,
  Check, CheckCheck, Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const MOCK_CONVERSATIONS = [
  {
    id: '1',
    visitorName: 'Ahmed Al-Mansouri',
    lastMessage: 'What are your business hours?',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 1000),
    unread: 2,
    platform: 'website',
    botName: 'Support Bot',
    status: 'open',
    messages: [
      { id: '1', role: 'user', text: 'Hello, is anyone there?', time: new Date(Date.now() - 10 * 60 * 1000) },
      { id: '2', role: 'bot', text: 'Hi! How can I help you today?', time: new Date(Date.now() - 9 * 60 * 1000) },
      { id: '3', role: 'user', text: 'What are your business hours?', time: new Date(Date.now() - 2 * 60 * 1000) },
    ],
  },
  {
    id: '2',
    visitorName: 'Sarah Johnson',
    lastMessage: 'I want to place an order',
    lastMessageTime: new Date(Date.now() - 15 * 60 * 1000),
    unread: 0,
    platform: 'website',
    botName: 'Sales Bot',
    status: 'open',
    messages: [
      { id: '1', role: 'user', text: 'Hi, I want to place an order', time: new Date(Date.now() - 20 * 60 * 1000) },
      { id: '2', role: 'bot', text: 'Sure! What would you like to order?', time: new Date(Date.now() - 19 * 60 * 1000) },
      { id: '3', role: 'user', text: 'I want to place an order', time: new Date(Date.now() - 15 * 60 * 1000) },
    ],
  },
  {
    id: '3',
    visitorName: 'Mohammed Khalid',
    lastMessage: 'شكراً جزيلاً على المساعدة',
    lastMessageTime: new Date(Date.now() - 45 * 60 * 1000),
    unread: 0,
    platform: 'website',
    botName: 'Support Bot',
    status: 'resolved',
    messages: [
      { id: '1', role: 'user', text: 'هل يمكنكم مساعدتي؟', time: new Date(Date.now() - 60 * 60 * 1000) },
      { id: '2', role: 'bot', text: 'بالتأكيد! كيف يمكنني مساعدتك؟', time: new Date(Date.now() - 59 * 60 * 1000) },
      { id: '3', role: 'user', text: 'شكراً جزيلاً على المساعدة', time: new Date(Date.now() - 45 * 60 * 1000) },
    ],
  },
];

function formatTime(date: Date) {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

interface Props {
  bots: any[];
  isRTL: boolean;
}

export default function SharedInboxUI({ bots, isRTL }: Props) {
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === selectedConv);

  const filteredConvs = conversations.filter(c => {
    const matchesSearch = c.visitorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConv, conversations]);

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedConv) return;
    setSending(true);
    const newMsg = {
      id: Date.now().toString(),
      role: 'agent',
      text: replyText.trim(),
      time: new Date(),
    };
    setConversations(prev => prev.map(c =>
      c.id === selectedConv
        ? { ...c, messages: [...c.messages, newMsg], lastMessage: replyText.trim(), lastMessageTime: new Date() }
        : c
    ));
    setReplyText('');
    setSending(false);
  };

  const hasNoBots = bots.length === 0;

  if (hasNoBots) {
    return (
      <div className="flex flex-col items-center py-16 text-center px-4">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-[#060541]/8 dark:bg-white/8 mb-5">
          <Inbox className="h-8 w-8 text-[#060541] dark:text-white/70" />
        </div>
        <h2 className="text-lg font-semibold mb-1">{isRTL ? 'صندوق الوارد الموحد' : 'Shared Inbox'}</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          {isRTL ? 'أنشئ بوتاً أولاً لتبدأ باستقبال المحادثات هنا' : 'Create a bot first to start receiving conversations here'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="text-base font-bold text-foreground">{isRTL ? 'صندوق الوارد' : 'Shared Inbox'}</h2>
          <p className="text-xs text-muted-foreground">{filteredConvs.length} {isRTL ? 'محادثة' : 'conversations'}</p>
        </div>
        <button
          title="Refresh"
          className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors active:scale-95"
          onClick={() => setConversations(MOCK_CONVERSATIONS)}
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'ابحث...' : 'Search conversations...'}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/40 border border-border/40 rounded-xl focus:outline-none focus:border-[#060541]/30 dark:focus:border-white/30"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'open', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors",
                filter === f
                  ? "bg-[#060541] dark:bg-white text-white dark:text-[#060541]"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              {f === 'all' ? (isRTL ? 'الكل' : 'All') : f === 'open' ? (isRTL ? 'مفتوح' : 'Open') : (isRTL ? 'محلول' : 'Resolved')}
            </button>
          ))}
        </div>
      </div>

      {/* Main panel — split view on md+, list on mobile */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* Conversation list */}
        <div className={cn(
          "flex flex-col gap-2 overflow-y-auto",
          selectedConv ? "hidden md:flex md:w-64 lg:w-72 shrink-0" : "flex-1"
        )}>
          {filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد محادثات' : 'No conversations yet'}</p>
            </div>
          ) : (
            filteredConvs.map(conv => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedConv(conv.id);
                  setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
                }}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition-all active:scale-[0.98]",
                  selectedConv === conv.id
                    ? "border-[#060541]/30 dark:border-white/20 bg-[#060541]/5 dark:bg-white/8"
                    : "border-border/40 bg-white dark:bg-card hover:border-border hover:bg-muted/20"
                )}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {conv.visitorName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-sm text-foreground truncate">{conv.visitorName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{formatTime(conv.lastMessageTime)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      conv.status === 'open' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
                    )}>
                      {conv.status === 'open' ? (isRTL ? 'مفتوح' : 'Open') : (isRTL ? 'محلول' : 'Resolved')}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">{conv.botName}</span>
                    {conv.unread > 0 && (
                      <span className="ml-auto shrink-0 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Chat panel */}
        {selectedConv && activeConv && (
          <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border/40 bg-white dark:bg-card overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/20 shrink-0">
              <button
                title="Back"
                onClick={() => setSelectedConv(null)}
                className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4 rotate-180 text-muted-foreground" />
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {activeConv.visitorName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{activeConv.visitorName}</p>
                <p className="text-[10px] text-muted-foreground">{activeConv.botName} · {activeConv.platform}</p>
              </div>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0",
                activeConv.status === 'open' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
              )}>
                {activeConv.status === 'open' ? (isRTL ? 'مفتوح' : 'Open') : (isRTL ? 'محلول' : 'Resolved')}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {activeConv.messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-start" : "justify-end"
                  )}
                >
                  <div className={cn(
                    "max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user'
                      ? "bg-muted/60 text-foreground rounded-tl-sm"
                      : msg.role === 'bot'
                        ? "bg-[#060541] dark:bg-blue-600 text-white rounded-tr-sm"
                        : "bg-emerald-500 text-white rounded-tr-sm"
                  )}>
                    {msg.role !== 'user' && (
                      <p className="text-[9px] font-semibold opacity-70 mb-0.5">
                        {msg.role === 'bot' ? 'Bot' : isRTL ? 'أنت' : 'You'}
                      </p>
                    )}
                    <p>{msg.text}</p>
                    <p className={cn(
                      "text-[9px] mt-1 opacity-60",
                      msg.role === 'user' ? "text-left" : "text-right"
                    )}>
                      {formatTime(msg.time)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply bar */}
            <div className="flex items-center gap-2 p-3 border-t border-border/40 bg-background shrink-0">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                placeholder={isRTL ? 'اكتب ردك...' : 'Type your reply...'}
                className="flex-1 px-3 py-2 text-sm bg-muted/40 border border-border/40 rounded-xl focus:outline-none focus:border-[#060541]/30 dark:focus:border-white/30"
              />
              <button
                title="Send"
                onClick={handleSendReply}
                disabled={!replyText.trim() || sending}
                className="p-2.5 rounded-xl bg-[#060541] dark:bg-white text-white dark:text-[#060541] hover:opacity-90 disabled:opacity-40 transition-all active:scale-95 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* No conv selected on md+ */}
        {!selectedConv && filteredConvs.length > 0 && (
          <div className="hidden md:flex flex-1 items-center justify-center text-center">
            <div>
              <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{isRTL ? 'اختر محادثة' : 'Select a conversation'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
