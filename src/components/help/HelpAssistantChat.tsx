import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2,
  Send,
  Bot,
  User,
  LayoutGrid,
  Sparkles,
  Mic,
  Languages,
  CheckSquare,
  Calendar,
  Users as UsersIcon,
  Settings as SettingsIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

type HelpChatRole = 'user' | 'assistant';

type Chip = {
  label: string;
  route: string;
};

type HelpChatMessage = {
  id: string;
  role: HelpChatRole;
  content: string;
  chips?: Chip[];
};

const HELP_CHAT_STORAGE_KEY = 'wakti-help-assistant-chat-v2';

function getChipIcon(route: string) {
  const r = String(route || '').toLowerCase();

  if (r.startsWith('/dashboard')) return LayoutGrid;
  if (r.startsWith('/wakti-ai') || r.startsWith('/wakti-ai-v2')) return Sparkles;
  if (r.startsWith('/tools/voice-studio') || r.startsWith('/tools/voice')) return Mic;
  if (r.includes('text-translator') || r.includes('voice-translator')) return Languages;
  if (r.startsWith('/tasks-reminders') || r.startsWith('/tr')) return CheckSquare;
  if (r.startsWith('/calendar')) return Calendar;
  if (r.startsWith('/contacts')) return UsersIcon;
  if (r.startsWith('/settings') || r.startsWith('/account')) return SettingsIcon;

  return Sparkles;
}

export function HelpAssistantChat() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const initialWelcomeText = useMemo(
    () =>
      language === 'ar'
        ? 'أنا مساعد WAKTI للمساعدة داخل التطبيق. اسألني عن أي ميزة أو أين تجدها وكيف تستخدمها.'
        : "I'm WAKTI's Help Assistant. Ask me where to find any feature and how to use it.",
    [language]
  );

  const [messages, setMessages] = useState<HelpChatMessage[]>(() => {
    const welcome: HelpChatMessage = { id: 'welcome', role: 'assistant', content: initialWelcomeText };
    try {
      const raw = localStorage.getItem(HELP_CHAT_STORAGE_KEY);
      if (!raw) return [welcome];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [welcome];
      const restored: HelpChatMessage[] = parsed
        .filter((m: any) => m && typeof m === 'object')
        .map((m: any) => ({
          id: String(m.id ?? ''),
          role: (m.role === 'user' ? 'user' : 'assistant') as HelpChatRole,
          content: String(m.content ?? ''),
          chips: Array.isArray(m.chips)
            ? m.chips
                .filter((c: any) => c && typeof c === 'object')
                .map((c: any) => ({ label: String(c.label ?? ''), route: String(c.route ?? '') }))
                .filter((c: Chip) => c.label && c.route)
            : undefined
        }))
        .filter((m: HelpChatMessage) => m.id && m.content);
      return [welcome, ...restored.filter((m) => m.id !== 'welcome')];
    } catch {
      return [welcome];
    }
  });
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    setMessages((prev) => {
      const hasWelcome = prev.some((m) => m.id === 'welcome');
      if (!hasWelcome) return prev;
      const next = prev.map((m) => {
        if (m.id !== 'welcome') return m;
        return {
          ...m,
          content:
            language === 'ar'
              ? 'أنا مساعد WAKTI للمساعدة داخل التطبيق. اسألني عن أي ميزة أو أين تجدها وكيف تستخدمها.'
              : "I'm WAKTI's Help Assistant. Ask me where to find any feature and how to use it."
        };
      });
      return next;
    });
  }, [language]);

  useEffect(() => {
    // Persist chat (excluding the dynamic welcome message content)
    try {
      const toStore = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          chips: Array.isArray(m.chips)
            ? m.chips.map((c) => ({ label: c.label, route: c.route }))
            : undefined
        }));
      localStorage.setItem(HELP_CHAT_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // ignore storage failures
    }
  }, [messages]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: HelpChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text
    };

    setInput('');
    setIsSending(true);
    setMessages((prev) => [...prev, userMsg]);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('help-assistant-chat', {
        body: {
          message: text,
          language,
          history
        }
      });

      if (error) throw error;

      const assistantText = String(data?.reply || '').trim();
      const chips: Chip[] = Array.isArray(data?.chips) ? data.chips : [];
      const assistantMsg: HelpChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content:
          assistantText ||
          (language === 'ar'
            ? 'حدث خطأ. حاول مرة أخرى.'
            : 'Something went wrong. Please try again.'),
        chips
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      const errMsg: HelpChatMessage = {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content:
          language === 'ar'
            ? 'تعذر الاتصال بمساعد المساعدة الآن. حاول مرة أخرى بعد قليل.'
            : "Couldn't reach the Help Assistant right now. Please try again in a moment."
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="text-xl bg-gradient-primary bg-clip-text text-transparent">
          {language === 'ar' ? 'مساعد المساعدة' : 'Help Assistant'}
        </CardTitle>
        <CardDescription>
          {language === 'ar'
            ? 'اسأل عن أي شيء داخل WAKTI فقط (أين تجد الميزة وكيف تستخدمها)'
            : 'Ask only about WAKTI (where to find features and how to use them)'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border bg-background/40 flex flex-col min-h-[70vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
                  {!isUser && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="max-w-[85%]">
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      {m.content}
                    </div>
                    {!isUser && m.chips && m.chips.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {m.chips.map((chip, idx) => (
                          (() => {
                            const Icon = getChipIcon(chip.route);
                            return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => navigate(chip.route)}
                            className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-full bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {chip.label}
                          </button>
                            );
                          })()
                        ))}
                      </div>
                    )}
                  </div>
                  {isUser && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
            {isSending && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted text-foreground rounded-2xl px-4 py-3 text-sm inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{language === 'ar' ? 'جارٍ الكتابة...' : 'Typing...'}</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t p-3">
            <div className="flex items-end gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={language === 'ar' ? 'اسأل عن WAKTI...' : 'Ask about WAKTI...'}
                maxLines={4}
                className="min-h-[44px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) send();
                  }
                }}
                disabled={isSending}
              />
              <Button
                type="button"
                onClick={send}
                disabled={!canSend}
                className="h-11 w-11 p-0 rounded-xl"
                size="icon"
                aria-label={language === 'ar' ? 'إرسال' : 'Send'}
              >
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
