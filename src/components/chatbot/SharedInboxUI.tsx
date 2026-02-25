// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Search, Send, ChevronRight, RefreshCw, Inbox, MessageSquare, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

function formatTime(date: Date) {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

interface ConvRow {
  id: string;
  bot_id: string;
  botName: string;
  visitorName: string;
  lastMessage: string;
  lastMessageTime: Date;
  platform: string;
  status: string; // ai_handling | human_takeover | resolved
  unread: number;
}

interface MsgRow {
  id: string;
  role: 'user' | 'bot' | 'agent';
  text: string;
  time: Date;
}

interface Props {
  bots: any[];
  isRTL: boolean;
}

export default function SharedInboxUI({ bots, isRTL }: Props) {
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const botMap = Object.fromEntries(bots.map(b => [b.id, b.name]));

  // Map DB status to display status
  const displayStatus = (s: string) => {
    if (s === 'resolved') return 'resolved';
    return 'open'; // ai_handling + human_takeover = open
  };

  const loadConversations = useCallback(async () => {
    if (bots.length === 0) { setLoading(false); return; }
    setLoading(true);
    const botIds = bots.map(b => b.id);
    const { data, error } = await supabase
      .from('chatbot_conversations')
      .select('id, bot_id, visitor_name, visitor_email, status, last_message_at, platform')
      .in('bot_id', botIds)
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      // Fetch last message per conversation
      const convIds = data.map(c => c.id);
      const { data: lastMsgs } = await supabase
        .from('chatbot_messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

      const lastMsgMap: Record<string, string> = {};
      lastMsgs?.forEach(m => {
        if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m.content;
      });

      setConversations(data.map(c => ({
        id: c.id,
        bot_id: c.bot_id,
        botName: botMap[c.bot_id] || 'Bot',
        visitorName: c.visitor_name || c.visitor_email || 'Visitor',
        lastMessage: lastMsgMap[c.id] || '—',
        lastMessageTime: new Date(c.last_message_at || c.started_at),
        platform: c.platform || 'website',
        status: displayStatus(c.status),
        unread: 0,
      })));
    }
    setLoading(false);
  }, [bots]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from('chatbot_messages')
      .select('id, sender_type, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data.map(m => ({
        id: m.id,
        role: m.sender_type === 'visitor' ? 'user' : m.sender_type === 'human' ? 'agent' : 'bot',
        text: m.content,
        time: new Date(m.created_at),
      })));
    }
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    if (selectedConv) loadMessages(selectedConv);
    else setMessages([]);
  }, [selectedConv, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConv = conversations.find(c => c.id === selectedConv);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText('');
    const { data: inserted } = await supabase
      .from('chatbot_messages')
      .insert({ conversation_id: selectedConv, sender_type: 'human', content: text })
      .select()
      .single();
    if (inserted) {
      setMessages(prev => [...prev, { id: inserted.id, role: 'agent', text: inserted.content, time: new Date(inserted.created_at) }]);
      setConversations(prev => prev.map(c =>
        c.id === selectedConv ? { ...c, lastMessage: text, lastMessageTime: new Date() } : c
      ));
    }
    setSending(false);
  };

  const filteredConvs = conversations.filter(c => {
    const matchesSearch = c.visitorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || c.status === filter;
    return matchesSearch && matchesFilter;
  });

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
          onClick={loadConversations}
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
          {loading ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد محادثات بعد' : 'No conversations yet'}</p>
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
            <div className="flex items-center gap-3 px-3 py-3 border-b border-border/40 bg-white dark:bg-card shrink-0 shadow-sm">
              {/* Back button — prominent, always visible on mobile */}
              <button
                title="Back"
                onClick={() => setSelectedConv(null)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-[#060541] dark:bg-white text-white dark:text-[#060541] shadow-md active:scale-90 transition-all shrink-0"
              >
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>

              {/* Visitor avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow">
                {activeConv.visitorName.charAt(0)}
              </div>

              {/* Visitor info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate leading-tight">{activeConv.visitorName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {/* Bot avatar pill */}
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#060541]/8 dark:bg-white/10">
                    <Bot className="h-3 w-3 text-[#060541] dark:text-white/70" />
                    <span className="text-[10px] font-semibold text-[#060541] dark:text-white/70">{activeConv.botName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">· {activeConv.platform}</span>
                </div>
              </div>

              {/* Status badge */}
              <span className={cn(
                "text-[10px] px-2 py-1 rounded-full font-bold shrink-0",
                activeConv.status === 'open'
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {activeConv.status === 'open' ? (isRTL ? 'مفتوح' : 'Open') : (isRTL ? 'محلول' : 'Resolved')}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-muted/10">
              {loadingMsgs ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">{isRTL ? 'لا توجد رسائل' : 'No messages yet'}</p>
                </div>
              ) : null}
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-end gap-2",
                    msg.role === 'user' ? "justify-start" : "justify-end"
                  )}
                >
                  {/* User avatar dot */}
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0 mb-1">
                      {activeConv.visitorName.charAt(0)}
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.role === 'user'
                      ? "bg-white dark:bg-zinc-800 text-foreground rounded-bl-sm border border-border/30"
                      : msg.role === 'bot'
                        ? "bg-[#060541] dark:bg-blue-600 text-white rounded-br-sm"
                        : "bg-emerald-500 text-white rounded-br-sm"
                  )}>
                    {msg.role !== 'user' && (
                      <p className="text-[9px] font-bold opacity-70 mb-1 uppercase tracking-wide">
                        {msg.role === 'bot' ? activeConv.botName : isRTL ? 'أنت' : 'You (Agent)'}
                      </p>
                    )}
                    <p>{msg.text}</p>
                    <p className={cn(
                      "text-[9px] mt-1.5 opacity-50",
                      msg.role === 'user' ? "text-left" : "text-right"
                    )}>
                      {formatTime(msg.time)}
                    </p>
                  </div>
                  {/* Bot/agent avatar dot */}
                  {msg.role !== 'user' && (
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1",
                      msg.role === 'bot' ? "bg-[#060541] dark:bg-blue-600" : "bg-emerald-500"
                    )}>
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                  )}
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
                placeholder={isRTL ? 'اكتب ردك كوكيل...' : 'Reply as agent...'}
                className="flex-1 px-4 py-2.5 text-sm bg-muted/40 border border-border/40 rounded-2xl focus:outline-none focus:border-[#060541]/40 dark:focus:border-white/30"
              />
              <button
                title="Send"
                onClick={handleSendReply}
                disabled={!replyText.trim() || sending}
                className="p-2.5 rounded-xl bg-[#060541] dark:bg-white text-white dark:text-[#060541] hover:opacity-90 disabled:opacity-30 transition-all active:scale-90 shrink-0 shadow-md"
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
