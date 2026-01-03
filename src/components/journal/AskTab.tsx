import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JournalService } from "@/services/journalService";
import { useNavigate } from "react-router-dom";
import { NotebookPen, Sparkles, SendHorizontal } from "lucide-react";

const STORAGE_KEY = "asktab:last";

export const AskTab: React.FC = () => {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; stats?: any; tips?: string; isOffTopic?: boolean }[]>([]);

  // Restore session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      }
    } catch {}
  }, []);

  // Save session
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }));
    }
  }, [messages]);

  const ask = async () => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    const userMsg = { role: "user" as const, content: trimmed };
    const newMessages = [...messages, userMsg].slice(-10); // Keep last 10
    setMessages(newMessages);
    setQ("");

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      // Pass the conversation history (newMessages) to the service
      const data = await JournalService.ask(trimmed, language as any, tz, newMessages);
      
      const assistantMsg = { 
        role: "assistant" as const, 
        content: data.summary || "",
        stats: data.stats,
        tips: data.tips,
        isOffTopic: data.summary?.toLowerCase().includes("wakti ai") || data.summary?.includes("وقطي AI")
      };
      
      setMessages(prev => [...prev, assistantMsg].slice(-10));
    } catch (err) {
      console.error("Ask failed", err);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };


  return (
    <div className="flex flex-col h-[500px] max-h-[70vh]">
      {/* Responses area - scrollable, takes remaining space */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-1 scrollbar-hide min-h-0">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center text-pink-400 shadow-xl ring-1 ring-pink-500/30">
                <NotebookPen className="h-10 w-10" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg animate-bounce">
                <Sparkles className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                {language === 'ar' ? 'دردش مع يومياتك' : 'Chat with your Journal'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
                {language === 'ar' 
                  ? 'أنا خبير في حياتك. اسألني عن أنماطك، مشاعرك، أو أي ذكرى سجلتها.' 
                  : "I'm an expert on your life. Ask me about your patterns, moods, or any memory you've logged."}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            {/* Message Bubble */}
            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-primary text-primary-foreground rounded-br-none' 
                : 'bg-gradient-to-br from-card to-muted/40 border border-border/50 text-foreground rounded-bl-none'
            }`}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {msg.role === 'assistant' && <span className="inline-block mr-1.5">🤖</span>}
                {msg.content}
              </div>

              {/* Stats/Chips (Assistant Only) */}
              {msg.role === 'assistant' && (msg.stats || msg.isOffTopic) && (
                <div className="mt-2 pt-2 border-t border-border/20 flex flex-wrap gap-1.5">
                  {msg.isOffTopic && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => navigate('/wakti-ai')}
                      className="h-8 px-4 py-0 text-xs rounded-full bg-gradient-vibrant hover:shadow-vibrant-glow text-white border-none shadow-vibrant flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5 fill-white" />
                      <span className="font-bold tracking-wide">
                        {language === 'ar' ? 'دردش مع Wakti AI' : 'Chat with Wakti AI'}
                      </span>
                    </Button>
                  )}
                  
                  {msg.stats && (() => {
                    const stats = msg.stats;
                    const intent = stats.resolved_intent;
                    
                    if (intent === 'top_tags' && Array.isArray(stats.most_common_tags)) {
                      return stats.most_common_tags.slice(0, 3).map((t: any) => (
                        <span key={t.tag} className="px-2 py-0.5 text-[10px] rounded-full border border-primary/30 bg-primary/5 text-primary">
                          {t.tag} ×{t.count}
                        </span>
                      ));
                    }
                    
                    if (stats.top_mood) {
                      return (
                        <span className="px-2 py-0.5 text-[10px] rounded-full border border-primary/30 bg-primary/5 text-primary">
                          {stats.top_mood.icon} {stats.top_mood.name || ''}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Tips (Assistant Only) */}
            {msg.role === 'assistant' && msg.tips && (
              <div className="mt-1 ml-2 text-[11px] text-muted-foreground italic flex items-center gap-1">
                <span className="text-xs">💡</span> {msg.tips}
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="bg-muted/40 border border-border/30 rounded-2xl rounded-bl-none p-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input area - fixed at bottom */}
      <div className="mt-auto pt-2">
        <div className="flex justify-between items-center mb-2 px-1">
          {messages.length > 0 && (
            <button 
              onClick={clearChat}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              <span className="text-xs">🗑️</span> {language === 'ar' ? 'مسح الدردشة' : 'Clear Chat'}
            </button>
          )}
        </div>
        <div className="flex-shrink-0 rounded-2xl border border-border/60 bg-gradient-to-b from-card to-background p-3 shadow-md">
          <div className="flex gap-2">
            <Input 
              className="flex-1 input-enhanced" 
              value={q} 
              onChange={e => setQ(e.target.value)} 
              placeholder={language === 'ar' ? 'دردش مع دفترك...' : 'Chat with your journal...'} 
              onKeyDown={e => { if (e.key === 'Enter') ask(); }} 
            />
            <Button
              onClick={ask}
              disabled={loading || !q.trim()}
              className={`btn-shine rounded-xl h-10 w-10 p-0 shadow-lg transition-all active:scale-90 ${loading ? 'animate-pulse' : ''}`}
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <SendHorizontal className={`h-5 w-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
              )}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
};
