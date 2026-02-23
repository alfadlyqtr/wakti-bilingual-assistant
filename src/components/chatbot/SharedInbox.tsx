import { useState, useEffect, useRef } from 'react';
import {
  Search, Bot, MessageCircle, User, Mail, Phone,
  Clock, CheckCheck, Circle, Send, RefreshCw,
  ChevronRight, Inbox, Filter, MoreVertical,
  UserCheck, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatbotBot, ChatbotConversation, ChatbotMessage, ChatbotService } from '@/services/chatbotService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  bots: ChatbotBot[];
  isRTL: boolean;
}

type StatusFilter = 'all' | 'ai_handling' | 'human_takeover' | 'resolved';

const STATUS_META: Record<string, { label: string; labelAr: string; color: string; icon: React.ReactNode }> = {
  ai_handling:    { label: 'AI Handling',    labelAr: 'يعالجه الذكاء',  color: '#0ea5e9', icon: <Bot className="h-3 w-3" /> },
  human_takeover: { label: 'Human Takeover', labelAr: 'تدخل بشري',      color: '#f59e0b', icon: <UserCheck className="h-3 w-3" /> },
  resolved:       { label: 'Resolved',       labelAr: 'محلول',           color: '#22c55e', icon: <CheckCircle2 className="h-3 w-3" /> },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyConversations({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[#060541]/8 dark:bg-white/8 flex items-center justify-center mb-4">
        <MessageCircle className="h-8 w-8 text-[#060541]/40 dark:text-white/30" />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">
        {isRTL ? 'لا توجد محادثات بعد' : 'No conversations yet'}
      </p>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        {isRTL ? 'ستظهر محادثات زوارك هنا بمجرد بدء التفاعل' : 'Visitor conversations will appear here once they start chatting'}
      </p>
    </div>
  );
}

// ─── No Selection ─────────────────────────────────────────────────────────────
function NoChatSelected({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#060541]/8 to-[#0ea5e9]/8 dark:from-white/5 dark:to-[#0ea5e9]/10 flex items-center justify-center mb-5">
        <Inbox className="h-10 w-10 text-[#060541]/30 dark:text-white/20" />
      </div>
      <p className="text-base font-bold text-foreground mb-1">
        {isRTL ? 'اختر محادثة' : 'Select a conversation'}
      </p>
      <p className="text-xs text-muted-foreground max-w-[220px]">
        {isRTL ? 'اختر محادثة من القائمة لعرض الرسائل' : 'Pick a conversation from the list to view messages'}
      </p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SharedInbox({ bots, isRTL }: Props) {
  const [selectedBotId, setSelectedBotId] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<ChatbotConversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedConv, setSelectedConv] = useState<ChatbotConversation | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations for selected bot(s)
  useEffect(() => {
    loadConversations();
  }, [selectedBotId, bots]);

  const loadConversations = async () => {
    if (bots.length === 0) return;
    setLoadingConvs(true);
    try {
      const botIds = selectedBotId === 'all' ? bots.map(b => b.id) : [selectedBotId];
      const all = await Promise.all(botIds.map(id => ChatbotService.listConversations(id)));
      const merged = all.flat().sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
      setConversations(merged);
    } catch {
      // silently fail — no conversations yet is normal
    } finally {
      setLoadingConvs(false);
    }
  };

  // Load messages when conversation selected
  useEffect(() => {
    if (!selectedConv) return;
    loadMessages(selectedConv.id);
  }, [selectedConv]);

  const loadMessages = async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const msgs = await ChatbotService.getMessages(convId);
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // Filter conversations
  const filtered = conversations.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.visitor_name?.toLowerCase().includes(q) ||
        c.visitor_email?.toLowerCase().includes(q) ||
        c.visitor_phone?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getBotForConv = (conv: ChatbotConversation) => bots.find(b => b.id === conv.bot_id);

  const statusCounts = {
    all: conversations.length,
    ai_handling: conversations.filter(c => c.status === 'ai_handling').length,
    human_takeover: conversations.filter(c => c.status === 'human_takeover').length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* ── COL 1: Bot Filter Sidebar ── */}
      <div className="w-[64px] shrink-0 flex flex-col items-center py-3 gap-2 border-r border-border/40 bg-muted/20">
        {/* All bots */}
        <button
          onClick={() => setSelectedBotId('all')}
          title="All Bots"
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
            selectedBotId === 'all'
              ? "bg-[#060541] dark:bg-white text-white dark:text-[#060541] shadow-md"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <Inbox className="h-4 w-4" />
        </button>

        <div className="w-6 h-px bg-border/50 my-1" />

        {/* Individual bots */}
        {bots.map(bot => (
          <button
            key={bot.id}
            onClick={() => setSelectedBotId(bot.id)}
            title={bot.name}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all duration-200 relative",
              selectedBotId === bot.id
                ? "ring-2 ring-[#060541] dark:ring-white shadow-md scale-105"
                : "bg-muted/60 hover:bg-muted"
            )}
            style={{ background: selectedBotId === bot.id ? (bot.primary_color || '#060541') + '20' : undefined }}
          >
            <Bot className="h-4 w-4" style={{ color: bot.primary_color || '#060541' }} />
            {/* Active dot */}
            {bot.is_active && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-background" />
            )}
          </button>
        ))}
      </div>

      {/* ── COL 2: Conversation List ── */}
      <div className="w-[280px] shrink-0 flex flex-col border-r border-border/40 overflow-hidden">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-foreground">
              {isRTL ? 'المحادثات' : 'Conversations'}
              {conversations.length > 0 && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#060541]/10 dark:bg-white/10 text-[#060541] dark:text-white">
                  {conversations.length}
                </span>
              )}
            </h2>
            <button
              onClick={loadConversations}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", loadingConvs && "animate-spin")} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isRTL ? 'بحث...' : 'Search visitors...'}
              className="w-full pl-8 pr-3 py-2 text-xs bg-muted/50 rounded-xl border border-border/30 focus:outline-none focus:border-[#060541]/30 dark:focus:border-white/20"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {(['all', 'ai_handling', 'human_takeover', 'resolved'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 whitespace-nowrap",
                  statusFilter === s
                    ? "bg-[#060541] dark:bg-white text-white dark:text-[#060541]"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {s === 'all'
                  ? `${isRTL ? 'الكل' : 'All'} (${statusCounts.all})`
                  : s === 'ai_handling'
                    ? `🤖 ${statusCounts.ai_handling}`
                    : s === 'human_takeover'
                      ? `👤 ${statusCounts.human_takeover}`
                      : `✅ ${statusCounts.resolved}`}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyConversations isRTL={isRTL} />
          ) : (
            filtered.map(conv => {
              const bot = getBotForConv(conv);
              const meta = STATUS_META[conv.status];
              const isSelected = selectedConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-3 text-left border-b border-border/20 transition-all duration-150",
                    isSelected
                      ? "bg-[#060541]/5 dark:bg-white/5 border-l-2 border-l-[#060541] dark:border-l-white"
                      : "hover:bg-muted/40"
                  )}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 text-white"
                    style={{ background: bot?.primary_color || '#060541' }}>
                    {conv.visitor_name ? conv.visitor_name[0].toUpperCase() : '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-foreground truncate">
                        {conv.visitor_name || (isRTL ? 'زائر مجهول' : 'Unknown Visitor')}
                      </p>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {timeAgo(conv.last_message_at)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {conv.visitor_email || conv.visitor_phone || bot?.name || '—'}
                    </p>
                    {/* Status badge */}
                    <div className="flex items-center gap-1 mt-1">
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: meta?.color + '18', color: meta?.color }}
                      >
                        {meta?.icon}
                        {isRTL ? meta?.labelAr : meta?.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── COL 3: Chat View ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedConv ? (
          <NoChatSelected isRTL={isRTL} />
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-background shrink-0">
              {(() => {
                const bot = getBotForConv(selectedConv);
                const meta = STATUS_META[selectedConv.status];
                return (
                  <>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: bot?.primary_color || '#060541' }}>
                      {selectedConv.visitor_name ? selectedConv.visitor_name[0].toUpperCase() : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {selectedConv.visitor_name || (isRTL ? 'زائر مجهول' : 'Unknown Visitor')}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{bot?.name}</span>
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: meta?.color + '18', color: meta?.color }}
                        >
                          {meta?.icon}
                          {isRTL ? meta?.labelAr : meta?.label}
                        </span>
                      </div>
                    </div>
                    <button className="p-2 rounded-xl hover:bg-muted transition-colors">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد رسائل' : 'No messages in this conversation'}</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isVisitor = msg.sender_type === 'visitor';
                  const isAI = msg.sender_type === 'ai';
                  const bot = getBotForConv(selectedConv);
                  return (
                    <div key={msg.id} className={cn("flex gap-2", isVisitor ? "justify-end" : "justify-start")}>
                      {!isVisitor && (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs shrink-0 mt-0.5"
                          style={{ background: bot?.primary_color || '#060541' }}>
                          {isAI ? '🤖' : '👤'}
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                        isVisitor
                          ? "bg-[#060541] dark:bg-white text-white dark:text-[#060541] rounded-br-sm"
                          : "bg-white dark:bg-white/8 border border-border/40 text-foreground rounded-bl-sm"
                      )}>
                        <p>{msg.content}</p>
                        <p className={cn(
                          "text-[9px] mt-1",
                          isVisitor ? "text-white/60 dark:text-[#060541]/50 text-right" : "text-muted-foreground"
                        )}>
                          {timeAgo(msg.created_at)}
                          {isAI && <span className="ml-1 opacity-70">· AI</span>}
                          {msg.sender_type === 'human' && <span className="ml-1 opacity-70">· Agent</span>}
                        </p>
                      </div>
                      {isVisitor && (
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold text-foreground">
                          {selectedConv.visitor_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply bar */}
            <div className="px-4 py-3 border-t border-border/30 bg-background shrink-0">
              <div className="flex items-center gap-2 p-2 rounded-xl border border-border/50 bg-muted/30 focus-within:border-[#060541]/40 dark:focus-within:border-white/20 transition-colors">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (replyText.trim()) {
                        toast.info(isRTL ? 'الرد البشري قريباً' : 'Human reply coming soon');
                        setReplyText('');
                      }
                    }
                  }}
                  placeholder={isRTL ? 'اكتب رداً...' : 'Type a reply...'}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => {
                    if (replyText.trim()) {
                      toast.info(isRTL ? 'الرد البشري قريباً' : 'Human reply coming soon');
                      setReplyText('');
                    }
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#060541] dark:bg-white text-white dark:text-[#060541] hover:opacity-80 transition-opacity shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                {isRTL ? 'وضع القراءة فقط — الرد البشري قيد التطوير' : 'Read-only mode — Human reply in development'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── COL 4: Visitor Info Panel ── */}
      {selectedConv && (
        <div className="w-[220px] shrink-0 border-l border-border/40 overflow-y-auto bg-muted/10">
          <div className="p-4 space-y-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {isRTL ? 'معلومات الزائر' : 'Visitor Info'}
            </p>

            {/* Avatar + name */}
            <div className="flex flex-col items-center text-center gap-2">
              {(() => {
                const bot = getBotForConv(selectedConv);
                return (
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                    style={{ background: bot?.primary_color || '#060541' }}>
                    {selectedConv.visitor_name?.[0]?.toUpperCase() || '?'}
                  </div>
                );
              })()}
              <p className="text-sm font-bold text-foreground">
                {selectedConv.visitor_name || (isRTL ? 'مجهول' : 'Unknown')}
              </p>
            </div>

            {/* Info rows */}
            <div className="space-y-2">
              {selectedConv.visitor_email && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border/30">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-foreground truncate">{selectedConv.visitor_email}</p>
                </div>
              )}
              {selectedConv.visitor_phone && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border/30">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-foreground">{selectedConv.visitor_phone}</p>
                </div>
              )}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border/30">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-[11px] text-foreground">{timeAgo(selectedConv.started_at)}</p>
              </div>
            </div>

            {/* Bot info */}
            {(() => {
              const bot = getBotForConv(selectedConv);
              if (!bot) return null;
              return (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    {isRTL ? 'البوت' : 'Bot'}
                  </p>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border/30">
                    <Bot className="h-3.5 w-3.5 shrink-0" style={{ color: bot.primary_color || '#060541' }} />
                    <p className="text-[11px] font-semibold text-foreground truncate">{bot.name}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 capitalize">{bot.platform} · {bot.purpose || 'general'}</p>
                </div>
              );
            })()}

            {/* Status */}
            {(() => {
              const meta = STATUS_META[selectedConv.status];
              return (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    {isRTL ? 'الحالة' : 'Status'}
                  </p>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: meta?.color + '18', color: meta?.color }}
                  >
                    {meta?.icon}
                    {isRTL ? meta?.labelAr : meta?.label}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
