import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Aperture,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Code2,
  ListTodo,
  FolderOpen,
  Gamepad2,
  Heart,
  HelpCircle,
  Mail,
  Mic,
  MoreHorizontal,
  NotebookPen,
  PenTool,
  Send,
  Settings,
  Sparkles,
  MessageCircle,
  Plus,
  Users,
  Bot,
  Search as SearchIcon,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOptimizedTRData } from "@/hooks/useOptimizedTRData";
import { useOptimizedMaw3dEvents } from "@/hooks/useOptimizedMaw3dEvents";
import { useWhoopData } from "@/hooks/useWhoopData";
import { useJournalData } from "@/hooks/useJournalData";
import { getTodayHealthSummary, getSleepAnalysis } from "@/integrations/natively/healthkitBridge";
import { getScopedStorageItem, setScopedStorageItem } from "@/utils/userScopedStorage";
import { getQuoteForDisplay, getQuoteText, getQuoteAuthor } from "@/utils/quoteService";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { WaktiIcon } from "@/components/icons/WaktiIcon";
import { PlusMenu } from "@/components/wakti-ai-v2/PlusMenu";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModernHomeScreenProps {
  displayName: string;
}

type AppItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  path: string;
  icon: LucideIcon;
  accent: string;
  glow: string;
};

// ─── App lists ───────────────────────────────────────────────────────────────

const CREATION_APPS: AppItem[] = [
  { id: "projects", nameEn: "Code", nameAr: "البرمجة", path: "/projects", icon: Code2, accent: "#818cf8", glow: "rgba(129,140,248,0.5)" },
  { id: "studio", nameEn: "Studio", nameAr: "الاستوديو", path: "/music", icon: Aperture, accent: "#d946ef", glow: "rgba(217,70,239,0.5)" },
  { id: "text", nameEn: "Text", nameAr: "النص", path: "/tools/text", icon: PenTool, accent: "#a855f7", glow: "rgba(168,85,247,0.45)" },
  { id: "voice", nameEn: "Voice", nameAr: "الصوت", path: "/tools/voice-studio", icon: Mic, accent: "#f472b6", glow: "rgba(244,114,182,0.45)" },
  { id: "maw3d", nameEn: "Maw3d", nameAr: "مواعيد", path: "/maw3d", icon: CalendarClock, accent: "#c084fc", glow: "rgba(192,132,252,0.45)" },
];

const SYSTEM_APPS: AppItem[] = [
  { id: "settings", nameEn: "Settings", nameAr: "الإعدادات", path: "/settings", icon: Settings, accent: "#60a5fa", glow: "rgba(96,165,250,0.45)" },
  { id: "help", nameEn: "Help", nameAr: "المساعدة", path: "/help", icon: HelpCircle, accent: "#34d399", glow: "rgba(52,211,153,0.45)" },
];

const PRODUCTIVITY_APPS: AppItem[] = [
  { id: "my-files", nameEn: "My Files", nameAr: "ملفاتي", path: "/my-warranty", icon: FolderOpen, accent: "#10b981", glow: "rgba(16,185,129,0.45)" },
  { id: "journal", nameEn: "Journal", nameAr: "اليومية", path: "/journal", icon: NotebookPen, accent: "#ec4899", glow: "rgba(236,72,153,0.45)" },
  { id: "calendar", nameEn: "Calendar", nameAr: "التقويم", path: "/calendar", icon: Calendar, accent: "#38bdf8", glow: "rgba(56,189,248,0.45)" },
  { id: "tasks", nameEn: "Tasks • Reminders", nameAr: "المهام • التذكيرات", path: "/tr", icon: ListTodo, accent: "#22c55e", glow: "rgba(34,197,94,0.45)" },
  { id: "email", nameEn: "Email", nameAr: "البريد", path: "/tools/email", icon: Mail, accent: "#e9ceb0", glow: "rgba(233,206,176,0.5)" },
  { id: "social", nameEn: "Social", nameAr: "سوشيال", path: "/social", icon: MessageCircle, accent: "#38bdf8", glow: "rgba(56,189,248,0.45)" },
  { id: "vitality", nameEn: "Health", nameAr: "الصحة", path: "/fitness", icon: Activity, accent: "#22c55e", glow: "rgba(34,197,94,0.45)" },
  { id: "games", nameEn: "Games", nameAr: "الألعاب", path: "/tools/game", icon: Gamepad2, accent: "#f87171", glow: "rgba(248,113,113,0.45)" },
  { id: "deen", nameEn: "Deen", nameAr: "دين", path: "/deen", icon: BookOpen, accent: "#60a5fa", glow: "rgba(96,165,250,0.45)" },
];

// ─── AppCircle ────────────────────────────────────────────────────────────────

function AppCircle({ app, language, onClick, size = "regular", avatarUrl, overrideIcon, overrideAccent, overrideGlow, useWaktiLogo }: {
  app: AppItem;
  language: "en" | "ar";
  onClick: () => void;
  size?: "regular" | "small" | "large" | "compact";
  avatarUrl?: string;
  overrideIcon?: React.ElementType;
  overrideAccent?: string;
  overrideGlow?: string;
  useWaktiLogo?: boolean;
}) {
  const Icon = overrideIcon ?? app.icon;
  const accent = overrideAccent ?? app.accent;
  const glow = overrideGlow ?? app.glow;
  const iconSize = size === "compact" ? "h-4.5 w-4.5" : size === "small" ? "h-5 w-5" : size === "large" ? "h-8 w-8" : "h-6 w-6";
  const bubbleSize = size === "compact" ? "h-12 w-12" : size === "small" ? "h-14 w-14" : size === "large" ? "h-20 w-20" : "h-16 w-16";
  const labelSize = size === "compact" ? "text-[10px]" : "text-[11.5px]";
  const buttonGap = size === "compact" ? "gap-1" : "gap-1.5";
  const isAccount = app.id === "account";

  return (
    <button type="button" onClick={onClick} className={cn("group flex min-w-0 flex-col items-center", buttonGap)}>
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full border transition-all duration-200 overflow-hidden",
          bubbleSize,
          "border-white/40 group-hover:scale-105"
        )}
        style={{
          background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.2) 52%, rgba(10,20,40,0.1) 100%), linear-gradient(135deg, ${accent}25 0%, ${accent}55 100%)`,
          boxShadow: `0 10px 22px ${glow}, inset 0 1px 0 rgba(255,255,255,0.65)`,
        }}
      >
        {isAccount && avatarUrl
          ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          : useWaktiLogo
            ? <WaktiIcon className={cn(iconSize)} style={{ color: accent }} />
            : Icon ? <Icon className={cn(iconSize)} style={{ color: accent }} /> : null
        }
      </span>
      <span className={cn("text-center font-semibold leading-tight text-foreground/90", size === "compact" ? "whitespace-nowrap" : "line-clamp-2", labelSize)}>
        {language === "ar" ? app.nameAr : app.nameEn}
      </span>
    </button>
  );
}

// ─── Shell renderer (glass card identical to HomeScreen widgets) ──────────────

type ShellFn = (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => React.ReactNode;

function makeShell(isDark: boolean): ShellFn {
  return (bg, glow, onClick, children) => {
    if (isDark) {
      return (
        <div
          onClick={onClick}
          className="rounded-3xl overflow-hidden w-full h-full cursor-pointer active:scale-95 transition-all select-none relative"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.1) 22%, rgba(255,255,255,0.02) 100%), rgba(30,33,42,0.18)',
            backdropFilter: 'blur(64px) saturate(220%)',
            WebkitBackdropFilter: 'blur(64px) saturate(220%)',
            boxShadow: `0 24px 52px rgba(0,0,0,0.4), 0 0 10px ${glow}08, inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -16px 24px rgba(255,255,255,0.014)`,
            border: '1px solid rgba(255,255,255,0.14)',
          }}
        >
          <div className="absolute inset-0" style={{ background: bg, opacity: 0.18, mixBlendMode: 'screen', filter: 'saturate(0.8)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.055) 22%, transparent 60%)' }} />
          <div className="relative z-10 w-full h-full">{children}</div>
        </div>
      );
    }
    // Light mode: use widget's own dark background with clean soft shadow (no 3D blob)
    return (
      <div
        onClick={onClick}
        className="rounded-3xl overflow-hidden w-full h-full cursor-pointer active:scale-95 transition-all select-none relative"
        style={{
          background: bg,
          boxShadow: `0 2px 12px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)`,
          border: 'none',
        }}
      >
        <div className="relative z-10 w-full h-full">{children}</div>
      </div>
    );
  };
}

// ─── Helpers (exact copies from HomeScreen.tsx) ───────────────────────────────

function useLiveClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCountdown(diffMs: number, language: string): string {
  const abs = Math.abs(diffMs);
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return language === 'ar' ? `${h}س ${pad(m)}د` : `${h}h ${pad(m)}m`;
  return `${pad(m)}:${pad(s)}`;
}

function parseReminderDate(r: any): number | null {
  try {
    if (!r.due_date) return null;
    const dateStr = r.due_time ? `${r.due_date}T${r.due_time}` : `${r.due_date}T00:00:00`;
    const ms = new Date(dateStr).getTime();
    return isNaN(ms) ? null : ms;
  } catch { return null; }
}

// ─── Inline widget components (exact copies from HomeScreen.tsx) ──────────────

const MOOD_EMOJI = ['', '😞', '😕', '😐', '😊', '🤩'];
const MOOD_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#8b5cf6'];
const MOOD_LABEL_EN = ['', 'Awful', 'Bad', 'Meh', 'Good', 'Amazing'];
const MOOD_LABEL_AR = ['', 'سيء جداً', 'سيء', 'عادي', 'جيد', 'رائع'];

function TRWidgetInline({ shell, navigate, language, pendingTasks, completedToday, total, pct, taskAccent, taskIconBg, reminders }: {
  shell: ShellFn;
  navigate: (p: string) => void;
  language: string;
  pendingTasks: number;
  completedToday: number;
  total: number;
  pct: number;
  taskAccent: string;
  taskIconBg: string;
  reminders: any[];
}) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'reminders'>('tasks');
  const now = useLiveClock();

  const activeReminders = reminders
    .map(r => ({ ...r, dueMs: parseReminderDate(r) }))
    .filter(r => r.dueMs !== null)
    .sort((a, b) => {
      const aOverdue = a.dueMs! < now;
      const bOverdue = b.dueMs! < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return a.dueMs! - b.dueMs!;
    })
    .slice(0, 3);

  const trBg = 'linear-gradient(145deg,rgba(6,60,80,0.97) 0%,rgba(8,90,115,0.97) 50%,rgba(10,110,140,0.97) 100%)';
  const trGlow = '#0ea5e9';
  const Rtr = 16; const Ctr = 2 * Math.PI * Rtr;

  return shell(trBg, trGlow, () => navigate('/tr'),
    <div className="p-2.5 flex flex-col h-full justify-between">
      <div className="flex justify-center">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveTab(t => t === 'tasks' ? 'reminders' : 'tasks'); }}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 active:scale-95 transition-all"
        >
          <CheckSquare className={`w-3 h-3 ${activeTab === 'tasks' ? 'text-white' : 'text-white/70'}`} strokeWidth={2.5} />
          <div className="w-px h-2.5 bg-white/25" />
          <Bell className={`w-3 h-3 ${activeTab === 'reminders' ? 'text-white' : 'text-white/70'}`} strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: taskIconBg }}>
            {activeTab === 'tasks'
              ? <CheckSquare className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              : <Bell className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
          </div>
          <span className="text-[11px] font-black text-white uppercase tracking-wide">
            {activeTab === 'tasks' ? (language === 'ar' ? 'المهام' : 'Tasks') : (language === 'ar' ? 'تنبيهات' : 'Alerts')}
          </span>
        </div>
        <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90 flex-shrink-0">
          <circle cx="18" cy="18" r={Rtr} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r={Rtr} fill="none" stroke={taskAccent} strokeWidth="3.5"
            strokeDasharray={Ctr} strokeDashoffset={Ctr * (1 - pct / 100)}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[7px] font-black" style={{ color: taskAccent }}>{total}</span>
          <span className="text-[20px] font-black leading-none tabular-nums" style={{ color: taskAccent }}>{total}</span>
        </div>
        <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[7px] font-bold" style={{ color: taskAccent }}>{language === 'ar' ? 'مكتمل' : 'Done'}</span>
          <span className="text-[20px] font-black leading-none tabular-nums" style={{ color: taskAccent }}>{completedToday}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-0.5 h-8">
          {activeTab === 'tasks' ? (
            <>
              {Array.from({ length: Math.min(pendingTasks, 8) }).map((_, i) => (
                <div key={`p${i}`} className="flex-1 rounded-t-sm bg-white/20" style={{ height: `${40 + (i % 3) * 15}%` }} />
              ))}
              {Array.from({ length: Math.min(completedToday, 8) }).map((_, i) => (
                <div key={`d${i}`} className="flex-1 rounded-t-sm transition-all" style={{ height: `${55 + (i % 4) * 11}%`, background: taskAccent }} />
              ))}
              {total === 0 && Array.from({ length: 6 }).map((_, i) => (
                <div key={`e${i}`} className="flex-1 rounded-t-sm bg-white/10" style={{ height: `${30 + i * 8}%` }} />
              ))}
            </>
          ) : activeReminders.length > 0 ? (
            <div className="flex flex-col gap-1 flex-1 justify-center">
              {activeReminders.map(r => {
                const overdue = r.dueMs! < now;
                const diff = r.dueMs! - now;
                const countdown = formatCountdown(diff, language);
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg px-2 py-1" style={{ background: overdue ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)' }}>
                    <span className="text-[8px] font-bold text-white truncate max-w-[55%]">{r.title}</span>
                    <div className="flex items-center gap-0.5">
                      {overdue && <span className="text-[7px] font-black text-red-400 uppercase">{language === 'ar' ? 'متأخر' : 'LATE'}</span>}
                      <span className={`text-[9px] font-black tabular-nums ${overdue ? 'text-red-300' : 'text-white'}`}>{countdown}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[9px] text-white/80 uppercase">{language === 'ar' ? 'لا تنبيهات' : 'No reminders'}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-[7px] text-white/85 uppercase font-bold">{language === 'ar' ? 'معلّق' : 'pending'}</span>
          <span className="text-[7px] font-bold" style={{ color: taskAccent }}>{activeTab === 'tasks' ? pct : 0}%</span>
          <span className="text-[7px] text-white/85 uppercase font-bold">{language === 'ar' ? 'مكتمل' : 'done'}</span>
        </div>
      </div>
    </div>
  ) as React.ReactElement;
}

function JournalWidgetInline({ shell, navigate, language, journalData }: {
  shell: ShellFn;
  navigate: (p: string) => void;
  language: string;
  journalData: any;
}) {
  const [chartRange, setChartRange] = useState<'1m' | '3m' | '6m'>('1m');
  const hasEntry = journalData?.hasEntry;
  const todayEntry = journalData?.todayEntry;
  const currentStreak = journalData?.currentStreak ?? 0;
  const bestStreak = journalData?.bestStreak ?? 0;
  const history: { date: string; mood: number }[] = journalData?.history ?? [];
  const mood = todayEntry?.mood_value ?? null;

  const now = new Date();
  const cutoff = new Date(now);
  if (chartRange === '1m') cutoff.setMonth(now.getMonth() - 1);
  else if (chartRange === '3m') cutoff.setMonth(now.getMonth() - 3);
  else cutoff.setMonth(now.getMonth() - 6);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const filtered = history.filter(e => e.date >= cutoffStr);

  const moodCounts = [0, 0, 0, 0, 0, 0];
  filtered.forEach(e => { if (e.mood >= 1 && e.mood <= 5) moodCounts[e.mood]++; });
  const maxCount = Math.max(...moodCounts.slice(1), 1);

  const noteSnippet = todayEntry?.note || todayEntry?.morning_reflection || todayEntry?.evening_reflection || null;
  const timeStr = todayEntry?.created_at
    ? new Date(todayEntry.created_at).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const jBg = hasEntry
    ? 'linear-gradient(145deg,rgba(136,19,55,0.95) 0%,rgba(190,24,93,0.95) 50%,rgba(219,39,119,0.95) 100%)'
    : 'linear-gradient(145deg,rgba(60,10,30,0.95) 0%,rgba(90,15,45,0.95) 50%,rgba(110,20,55,0.95) 100%)';
  const jGlow = hasEntry ? '#ec4899' : '#9f1239';

  return shell(jBg, jGlow, () => navigate('/journal'),
    <div className="p-2.5 flex flex-col h-full justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.4)' }}>
            <BookOpen className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-wide">
            {language === 'ar' ? 'يومياتي' : 'Journal'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/30 border border-orange-400/40">
            <span className="text-[8px]">🔥</span>
            <span className="text-[8px] font-black text-orange-300 tabular-nums">{currentStreak}</span>
          </div>
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-400/30">
            <span className="text-[8px]">🏆</span>
            <span className="text-[8px] font-black text-yellow-300 tabular-nums">{bestStreak}</span>
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-white/10 px-2 py-1.5 flex items-start gap-1.5">
        <span className="text-[18px] leading-none flex-shrink-0 mt-0.5">{mood ? MOOD_EMOJI[mood] : '✍️'}</span>
        <div className="flex flex-col gap-0 min-w-0 flex-1">
          {hasEntry ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black" style={{ color: mood ? MOOD_COLOR[mood] : '#a78bfa' }}>
                  {mood ? (language === 'ar' ? MOOD_LABEL_AR[mood] : MOOD_LABEL_EN[mood]) : ''}
                </span>
                {timeStr && <span className="text-[7px] text-white/80 tabular-nums">{timeStr}</span>}
              </div>
              {noteSnippet ? (
                <span className="text-[7px] text-white/90 leading-snug line-clamp-2">{noteSnippet}</span>
              ) : (
                <span className="text-[7px] text-white/80">{language === 'ar' ? 'لا ملاحظات' : 'No note'}</span>
              )}
            </>
          ) : (
            <span className="text-[8px] text-white/85">{language === 'ar' ? 'لم تكتب اليوم بعد' : 'No entry yet today'}</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[7px] text-white/85 uppercase font-bold">{language === 'ar' ? 'المزاج' : 'Mood'}</span>
        <div className="flex rounded-full overflow-hidden border border-white/20">
          {(['1m','3m','6m'] as const).map(r => (
            <button
              key={r}
              title={r}
              onClick={(e) => { e.stopPropagation(); setChartRange(r); }}
              className={`px-1.5 py-0.5 text-[7px] font-black uppercase transition-all ${chartRange === r ? 'bg-white/30 text-white' : 'text-white/75'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-1 h-8">
        {[5,4,3,2,1].map(m => {
          const count = moodCounts[m];
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={m} className="flex-1 flex flex-col items-center gap-0">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(pct, count > 0 ? 12 : 4)}%`,
                  background: count > 0 ? MOOD_COLOR[m] : 'rgba(255,255,255,0.1)',
                  opacity: count > 0 ? 0.85 : 0.4,
                }}
              />
              <span className="text-[7px] leading-none">{MOOD_EMOJI[m]}</span>
            </div>
          );
        })}
      </div>
    </div>
  ) as React.ReactElement;
}

function CalendarWidgetInline({ shell, navigate, language, upcomingCount }: {
  shell: ShellFn;
  navigate: (p: string) => void;
  language: string;
  upcomingCount: number;
}) {
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [startX, setStartX] = useState<number | null>(null);

  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const days = [
    { num: yesterday.getDate(), label: yesterday.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' }), isToday: false },
    { num: today.getDate(),     label: today.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' }),     isToday: true  },
    { num: tomorrow.getDate(),  label: tomorrow.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' }),  isToday: false },
  ];
  const monthLabel = today.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' });
  const evAccent   = upcomingCount === 0 ? '#6b7280' : upcomingCount <= 3 ? '#22c55e' : '#f59e0b';

  const handleTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);
  const handleTouchEnd   = (e: React.TouchEvent) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) {
      const idx = days.findIndex(d => d.num === selectedDay);
      if (dx < 0 && idx < days.length - 1) setSelectedDay(days[idx + 1].num);
      else if (dx > 0 && idx > 0) setSelectedDay(days[idx - 1].num);
    }
    setStartX(null);
  };

  return shell(
    'linear-gradient(145deg,rgba(120,40,5,0.97) 0%,rgba(160,55,8,0.97) 50%,rgba(194,65,12,0.97) 100%)',
    '#f97316',
    () => navigate('/calendar'),
    <div className="p-2.5 flex flex-col h-full justify-between"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] text-white/90 font-bold uppercase tracking-widest">{monthLabel} {today.getFullYear()}</p>
          <p className="text-3xl font-black text-white leading-none tabular-nums">{today.getDate()}</p>
        </div>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-400/30 text-orange-200 self-start mt-1">
          {language === 'ar' ? 'اليوم' : 'Today'}
        </span>
      </div>
      <div className="flex gap-2">
        {days.map(d => {
          const isSelected = d.num === selectedDay;
          return (
            <button
              key={d.num}
              onClick={(e) => { e.stopPropagation(); setSelectedDay(d.num); }}
              className={`flex flex-col items-center flex-1 py-2 rounded-2xl transition-all active:scale-95 ${
                isSelected
                  ? 'bg-white/25 border border-white/45 shadow-lg'
                  : 'bg-white/8 border border-white/10'
              }`}
            >
              <span className="text-[8px] font-bold text-white/85 uppercase mb-0.5">{d.label.slice(0,3)}</span>
              <span className={`text-xl font-black tabular-nums leading-none ${isSelected ? 'text-white' : 'text-white/80'}`}>{d.num}</span>
              {d.isToday && upcomingCount > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {Array.from({ length: Math.min(upcomingCount, 3) }).map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full" style={{ background: evAccent }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: evAccent }} />
        <p className="text-[10px] font-semibold text-white/80">
          {upcomingCount === 0
            ? (language === 'ar' ? 'لا أحداث' : 'No upcoming events')
            : `${upcomingCount} ${language === 'ar' ? 'حدث قادم' : upcomingCount === 1 ? 'upcoming event' : 'upcoming events'}`}
        </p>
      </div>
    </div>
  ) as React.ReactElement;
}

function Maw3dWidgetInline({ shell, navigate, language, events, attendingCounts }: {
  shell: ShellFn;
  navigate: (p: string) => void;
  language: string;
  events: any[];
  attendingCounts: Record<string, number>;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const active = events
    .filter(e => { try { return e.event_date >= todayStr; } catch { return false; } })
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 3);

  const totalAttending = active.reduce((sum, e) => sum + (attendingCounts[e.id] ?? 0), 0);

  const mBg = active.length > 0
    ? 'linear-gradient(145deg,rgba(29,14,80,0.97) 0%,rgba(49,29,120,0.97) 40%,rgba(79,42,160,0.97) 100%)'
    : 'linear-gradient(145deg,rgba(15,10,40,0.97) 0%,rgba(25,18,60,0.97) 100%)';
  const mGlow = active.length > 0 ? '#7c3aed' : '#4b5563';

  const fmtDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      const isToday = dateStr === todayStr;
      if (isToday) return language === 'ar' ? 'اليوم' : 'Today';
      return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  const fmtTime = (t?: string) => {
    if (!t) return '';
    try {
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hh = h % 12 || 12;
      return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;
    } catch { return t; }
  };

  return shell(mBg, mGlow, () => navigate('/maw3d'),
    <div className="p-2.5 flex flex-col h-full justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.4)' }}>
            <CalendarDays className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-wide">
            {language === 'ar' ? 'مواعيد' : 'Maw3d'}
          </span>
        </div>
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-purple-400/30" style={{ background: 'rgba(124,58,237,0.25)' }}>
          <span className="text-[9px] font-black text-purple-200 tabular-nums">{active.length}</span>
          <span className="text-[7px] text-purple-200 uppercase">{language === 'ar' ? ' حدث' : ' event'}{active.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {active.length > 0 ? (
        <div className="flex flex-col gap-1 flex-1 justify-center my-1">
          {active.map((ev) => {
            const rsvp = attendingCounts[ev.id] ?? 0;
            const isToday = ev.event_date === todayStr;
            return (
              <div
                key={ev.id}
                className="rounded-xl px-2 py-1.5 flex items-center gap-1.5"
                style={{
                  background: isToday
                    ? 'linear-gradient(90deg,rgba(124,58,237,0.45),rgba(167,139,250,0.25))'
                    : 'rgba(255,255,255,0.08)',
                  border: isToday ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div className="flex flex-col items-center justify-center rounded-lg px-1.5 py-0.5 flex-shrink-0" style={{ background: 'rgba(124,58,237,0.4)', minWidth: 28 }}>
                  <span className="text-[8px] font-black text-purple-200 leading-tight">{fmtDate(ev.event_date)}</span>
                  {ev.start_time && <span className="text-[6px] text-purple-200 leading-tight tabular-nums">{fmtTime(ev.start_time)}</span>}
                </div>
                <div className="flex flex-col min-w-0 flex-1 gap-0">
                  <span className="text-[8px] font-bold text-white leading-tight truncate">{ev.title}</span>
                  <div className="flex items-center gap-0.5">
                    <Users className="w-2 h-2 text-green-400 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-[7px] text-green-300 font-bold tabular-nums">{rsvp}</span>
                    <span className="text-[6px] text-white/80">{language === 'ar' ? ' قبل' : ' going'}</span>
                  </div>
                </div>
                {isToday && <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[9px] text-white/80 uppercase">{language === 'ar' ? 'لا مواعيد قادمة' : 'No upcoming events'}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[7px] text-white/85 uppercase font-bold">
          {language === 'ar' ? 'إجمالي الحضور' : 'Total attending'}
        </span>
        <div className="flex items-center gap-0.5">
          <Users className="w-2.5 h-2.5 text-purple-300" strokeWidth={2.5} />
          <span className="text-[9px] font-black text-purple-200 tabular-nums">{totalAttending}</span>
        </div>
      </div>
    </div>
  ) as React.ReactElement;
}

function VitalityWidgetInline({ shell, navigate, language, whoopData }: {
  shell: ShellFn;
  navigate: (p: string) => void;
  language: string;
  whoopData?: any;
}) {
  const [activeTab, setActiveTab] = useState<'whoop' | 'healthkit'>(
    () => (getScopedStorageItem('vitality_widget_tab', undefined, 'vitality_widget_tab') as 'whoop' | 'healthkit') || 'whoop'
  );
  const [hkData, setHkData] = useState<{ steps: number; avgHr: number | null; rhr: number | null; sleepHours: number | null; } | null>(null);
  const [hkLoading, setHkLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'healthkit') return;
    if (hkData || hkLoading) return;
    setHkLoading(true);
    (async () => {
      try {
        const [summary, sleepArr] = await Promise.all([
          getTodayHealthSummary(),
          getSleepAnalysis(new Date(Date.now() - 86400000), new Date(), 1),
        ]);
        const sleepRecord = sleepArr?.[0];
        const asleepMin = sleepRecord ? ((sleepRecord.asleep ?? 0) + (sleepRecord.asleepRem ?? 0) + (sleepRecord.asleepDeep ?? 0) + (sleepRecord.asleepLight ?? 0)) : null;
        const sleepHrs = asleepMin && asleepMin > 0 ? Math.round((asleepMin / 60) * 10) / 10 : null;
        setHkData({ steps: summary.steps, avgHr: summary.heartRate?.avg ?? null, rhr: summary.restingHeartRate, sleepHours: sleepHrs });
      } catch { /* ignore */ } finally { setHkLoading(false); }
    })();
  }, [activeTab]);

  const recovery         = whoopData?.recovery         ?? null;
  const strain           = whoopData?.strain           ?? null;
  const hrv              = whoopData?.hrv              ?? null;
  const rhr              = whoopData?.rhr              ?? null;
  const sleepPerf        = whoopData?.sleepPerformance  ?? null;
  const sleepHours       = whoopData?.sleepHours       ?? null;
  const avgHr            = whoopData?.avgHr            ?? null;

  const recColor = recovery != null
    ? (recovery >= 67 ? '#22c55e' : recovery >= 34 ? '#f59e0b' : '#ef4444')
    : '#6366f1';

  const bgWhoop = recovery != null
    ? (recovery >= 67
        ? 'linear-gradient(145deg,rgba(4,60,40,0.92) 0%,rgba(4,100,65,0.92) 100%)'
        : recovery >= 34
          ? 'linear-gradient(145deg,rgba(100,40,8,0.92) 0%,rgba(160,70,6,0.92) 100%)'
          : 'linear-gradient(145deg,rgba(110,20,20,0.92) 0%,rgba(170,20,20,0.92) 100%)')
    : 'linear-gradient(145deg,rgba(25,15,50,0.92) 0%,rgba(45,25,80,0.92) 100%)';
  const bgHealth   = 'linear-gradient(145deg,rgba(10,60,40,0.97) 0%,rgba(15,90,60,0.97) 50%,rgba(20,110,70,0.97) 100%)';
  const bgGradient = activeTab === 'whoop' ? bgWhoop : bgHealth;
  const glowColor  = activeTab === 'whoop' ? recColor : '#22c55e';

  const R = 18; const C = 2 * Math.PI * R;
  const recPct = recovery != null ? Math.min(recovery / 100, 1) : 0;

  return shell(bgGradient, glowColor, () => navigate('/fitness'),
    <div className="p-2.5 flex flex-col h-full gap-1.5">
      <div className="flex justify-center">
        <button
          title={activeTab === 'whoop' ? 'Switch to HealthKit' : 'Switch to WHOOP'}
          onClick={(e) => { e.stopPropagation(); setActiveTab(t => { const next = t === 'whoop' ? 'healthkit' : 'whoop'; setScopedStorageItem('vitality_widget_tab', next); return next; }); }}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 active:scale-95 transition-all"
        >
          <Activity className={`w-3 h-3 ${activeTab === 'whoop' ? 'text-white' : 'text-white/70'}`} strokeWidth={2.5} />
          <div className="w-px h-2.5 bg-white/25" />
          <Heart className={`w-3 h-3 ${activeTab === 'healthkit' ? 'text-white' : 'text-white/70'}`} strokeWidth={2.5} />
        </button>
      </div>
      {activeTab === 'whoop' && (
        <div className="flex flex-col flex-1 justify-between">
          {recovery != null ? (
            <>
              <div className="flex items-center gap-2.5">
                <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0 -rotate-90">
                  <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
                  <circle cx="22" cy="22" r={R} fill="none" stroke={recColor} strokeWidth="4"
                    strokeDasharray={C} strokeDashoffset={C * (1 - recPct)}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                </svg>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white tabular-nums leading-none">{Math.round(recovery)}%</span>
                    <span className="text-[9px] font-black text-white/90 uppercase">{language === 'ar' ? 'استشفاء' : 'REC'}</span>
                  </div>
                  {sleepHours != null && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-white/85">{language === 'ar' ? 'نوم' : 'Sleep'}</span>
                      <span className="text-[10px] text-white font-bold">{sleepHours}h</span>
                      {sleepPerf != null && <span className="text-[8px] text-white/80">· {Math.round(sleepPerf)}%</span>}
                    </div>
                  )}
                </div>
              </div>
              {strain != null && (
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[8px] text-white/85 font-bold uppercase">{language === 'ar' ? 'إجهاد' : 'Strain'}</span>
                    <span className="text-[9px] text-white font-bold">{strain.toFixed(1)}<span className="text-white/80">/21</span></span>
                  </div>
                  <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((strain / 21) * 100, 100)}%`, background: recColor }} />
                  </div>
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {hrv != null && (
                  <div className="flex flex-col items-center bg-white/10 rounded-lg px-2 py-0.5">
                    <span className="text-[8px] text-white/90 uppercase">HRV</span>
                    <span className="text-[11px] text-white font-black">{Math.round(hrv)}</span>
                  </div>
                )}
                {rhr != null && (
                  <div className="flex flex-col items-center bg-white/10 rounded-lg px-2 py-0.5">
                    <span className="text-[8px] text-white/90 uppercase">RHR</span>
                    <span className="text-[11px] text-white font-black">{Math.round(rhr)}</span>
                  </div>
                )}
                {avgHr != null && (
                  <div className="flex flex-col items-center bg-white/10 rounded-lg px-2 py-0.5">
                    <span className="text-[8px] text-white/90 uppercase">{language === 'ar' ? 'ن.قلب' : 'AvgHR'}</span>
                    <span className="text-[11px] text-white font-black">{Math.round(avgHr)}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-end flex-1">
              <p className="text-[13px] font-black text-white">WHOOP</p>
              <p className="text-[9px] text-white/90">{language === 'ar' ? 'غير متصل' : 'Not connected'}</p>
            </div>
          )}
        </div>
      )}
      {activeTab === 'healthkit' && (
        <div className="flex flex-col flex-1 justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Heart className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[12px] font-black text-white leading-none">{language === 'ar' ? 'أبل هيلث' : 'Apple Health'}</p>
              <p className="text-[8px] text-white/85 mt-0.5">{language === 'ar' ? 'بيانات اليوم' : "Today's data"}</p>
            </div>
          </div>
          {hkLoading ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-[9px] text-white/85">{language === 'ar' ? 'جار التحميل...' : 'Loading...'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-white/10 rounded-lg p-1.5">
                <p className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? 'خطوات' : 'Steps'}</p>
                <p className="text-[12px] font-black text-white leading-tight">{hkData?.steps ? hkData.steps.toLocaleString() : '--'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-1.5">
                <p className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? 'نبض' : 'Avg HR'}</p>
                <p className="text-[12px] font-black text-white leading-tight">{hkData?.avgHr != null ? hkData.avgHr : '--'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-1.5">
                <p className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? 'نوم' : 'Sleep'}</p>
                <p className="text-[12px] font-black text-white leading-tight">{hkData?.sleepHours != null ? `${hkData.sleepHours}h` : '--'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-1.5">
                <p className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? 'نبض راحة' : 'RHR'}</p>
                <p className="text-[12px] font-black text-white leading-tight">{hkData?.rhr != null ? hkData.rhr : '--'}</p>
              </div>
            </div>
          )}
          <div
            onClick={(e) => { e.stopPropagation(); navigate('/fitness'); }}
            className="flex items-center justify-center gap-1 bg-white/10 border border-white/20 rounded-lg py-1 active:scale-95 transition-all cursor-pointer"
          >
            <span className="text-[9px] text-white/90 font-semibold">{language === 'ar' ? 'فتح الحيوية →' : 'Open Vitality →'}</span>
          </div>
        </div>
      )}
    </div>
  ) as React.ReactElement;
}

// ─── Quote Widget Inline ─────────────────────────────────────────────────────

function QuoteOverlay({ quoteText, quoteAuthor, language, onClose, exiting }: { quoteText: string; quoteAuthor: string; language: string; onClose: () => void; exiting: boolean; }) {
  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center px-8 transition-opacity duration-300 ${exiting ? 'opacity-0' : 'opacity-100'}`} onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />
      <div className="relative max-w-md text-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <p className="text-[clamp(19px,5.2vw,27px)] italic font-light leading-[1.72] text-white/95">{quoteText}</p>
        {quoteAuthor ? <p className="mt-4 text-sm text-white/60">— {quoteAuthor}</p> : null}
      </div>
    </div>
  );
}

function QuoteWidgetInline({ shell, language, quote, onExpand }: { shell: ShellFn; language: string; quote: ReturnType<typeof getQuoteForDisplay>; onExpand: () => void }) {
  const text = getQuoteText(quote, language);
  const author = getQuoteAuthor(quote);
  return shell(
    'linear-gradient(145deg,#312e81 0%,#4338ca 50%,#1e1b4b 100%)',
    '#6366f1',
    onExpand,
    <div className="flex flex-col h-full justify-between p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200/80">{language === 'ar' ? 'اقتباس اليوم' : "Today's Quote"}</span>
      </div>
      <p className="text-[13px] font-semibold text-white leading-snug line-clamp-5 italic">&#8220;{text}&#8221;</p>
      {author ? <p className="text-[10px] text-indigo-200/70 font-medium">&mdash; {author}</p> : null}
    </div>
  ) as React.ReactElement;
}

// ─── Homescreen Chat Bar ──────────────────────────────────────────────────────

type ModeKey = "chat" | "search" | "study";
const MODES: { key: ModeKey; labelEn: string; labelAr: string; pill: string; Icon: React.ElementType }[] = [
  { key: "chat",   labelEn: "Chat",   labelAr: "دردشة", pill: "bg-blue-600",   Icon: Bot },
  { key: "search", labelEn: "Search", labelAr: "بحث",   pill: "bg-green-600",  Icon: SearchIcon },
  { key: "study",  labelEn: "Study",  labelAr: "دراسة", pill: "bg-purple-600", Icon: BookOpen },
];

function HomescreenChatBar({
  language, isDark, cardShell, navigate, triggerOpenModePicker,
}: { language: "en" | "ar"; isDark: boolean; cardShell: string; navigate: (p: string) => void; triggerOpenModePicker?: number }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ModeKey>(() => {
    try {
      const v = localStorage.getItem("wakti_active_trigger");
      return (v === "search" || v === "study") ? v as ModeKey : "chat";
    } catch { return "chat"; }
  });
  const [searchSubmode, setSearchSubmode] = useState<"web" | "youtube">(() => {
    try {
      const v = localStorage.getItem("wakti_search_submode");
      return v === "youtube" ? "youtube" : "web";
    } catch { return "web"; }
  });
  const [showModePicker, setShowModePicker] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist search submode
  useEffect(() => {
    try { localStorage.setItem("wakti_search_submode", searchSubmode); } catch { /* ignore */ }
  }, [searchSubmode]);

  // Modes circle pressed → toggle mode pills inside input
  useEffect(() => {
    if (triggerOpenModePicker && triggerOpenModePicker > 0) {
      setShowModePicker(v => !v);
      inputRef.current?.focus();
    }
  }, [triggerOpenModePicker]);

  const pickMode = (m: ModeKey) => {
    setMode(m);
    setShowModePicker(false);
    try {
      localStorage.setItem("wakti_active_trigger", m);
      window.dispatchEvent(new CustomEvent("wakti-homescreen-mode-changed", { detail: { mode: m } }));
    } catch { /* ignore */ }
    inputRef.current?.focus();
  };

  const sendMessage = () => {
    const msg = text.trim();
    try {
      // YouTube search: prefix with "yt: " exactly like the real WAKTI AI chat
      const finalMsg = (mode === "search" && searchSubmode === "youtube" && msg) ? `yt: ${msg}` : msg;
      if (finalMsg) localStorage.setItem("wakti_pending_message", finalMsg);
      localStorage.setItem("wakti_active_trigger", mode === "study" ? "chat" : mode);
      if (mode === "study") localStorage.setItem("wakti_chat_submode", "study");
      localStorage.setItem("wakti_search_submode", searchSubmode);
    } catch { /* ignore */ }
    navigate("/wakti-ai");
  };

  // Listen for files selected via PlusMenu, store as base64 in sessionStorage, then navigate to WAKTI AI in vision mode
  useEffect(() => {
    const handler = async (evt: Event) => {
      const event = evt as CustomEvent<{ files: FileList | null }>;
      const files = event.detail?.files;
      if (!files || files.length === 0) return;
      try {
        const stored: { name: string; type: string; data: string }[] = [];
        for (let i = 0; i < Math.min(files.length, 4); i++) {
          const file = files[i];
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          stored.push({ name: file.name, type: file.type, data: base64 });
        }
        sessionStorage.setItem("wakti_pending_vision_files", JSON.stringify(stored));
        localStorage.setItem("wakti_active_trigger", "vision");
      } catch { /* ignore */ }
      navigate("/wakti-ai");
    };
    window.addEventListener("wakti-file-selected", handler as EventListener);
    return () => window.removeEventListener("wakti-file-selected", handler as EventListener);
  }, [navigate]);

  const activeMode = MODES.find(m => m.key === mode) ?? MODES[0];
  const isYoutube = mode === "search" && searchSubmode === "youtube";
  const modeBorder = isYoutube ? "border-red-400/40 ring-1 ring-red-400/20"
    : mode === "chat" ? "border-blue-400/40 ring-1 ring-blue-400/20"
    : mode === "search" ? "border-green-400/40 ring-1 ring-green-400/20"
    : "border-purple-400/40 ring-1 ring-purple-400/20";
  const sendBtnClass = isYoutube ? "bg-red-600"
    : text.trim() ? activeMode.pill
    : "";
  const placeholder = mode === "search"
    ? (searchSubmode === "youtube"
        ? (language === "ar" ? "ابحث على يوتيوب..." : "Search YouTube: title, topic, or channel...")
        : (language === "ar" ? "ابحث في الويب..." : "Search the web: news, sports, topics..."))
    : (language === "ar" ? "اكتب رسالتك لوكتي AI..." : "Type a message for WAKTI AI...");

  const showPlus = mode !== "search";

  return (
    <div className={cn("grid gap-2", showPlus ? "grid-cols-[minmax(0,1fr)_48px]" : "grid-cols-1")}>
      {/* Input card */}
      <div className={cn("relative flex flex-col rounded-2xl border overflow-hidden transition-all", cardShell, modeBorder)}>

        {/* Mode pills — shown when Modes circle is tapped */}
        {showModePicker && (
          <div className="flex items-center gap-2 px-3 pt-2 pb-1">
            {MODES.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => pickMode(m.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow transition-all active:scale-95",
                  m.pill,
                  mode === m.key ? "opacity-100" : "opacity-60 hover:opacity-85"
                )}
              >
                <m.Icon className="h-3.5 w-3.5" />
                {language === "ar" ? m.labelAr : m.labelEn}
              </button>
            ))}
          </div>
        )}

        {/* Search sub-mode pills: Web / YouTube — shown when Search is active */}
        {mode === "search" && (
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-0.5">
            <button
              type="button"
              onPointerUp={() => setSearchSubmode("web")}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 h-7 rounded-full text-xs font-medium border transition-colors active:scale-95",
                searchSubmode === "web"
                  ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600/50"
                  : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700/50"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", searchSubmode === "web" ? "bg-green-500" : "bg-gray-400")} />
              {language === "ar" ? "الويب" : "Web"}
            </button>
            <button
              type="button"
              onPointerUp={() => setSearchSubmode("youtube")}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 h-7 rounded-full text-xs font-medium border transition-colors active:scale-95",
                searchSubmode === "youtube"
                  ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-600/50"
                  : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700/50"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", searchSubmode === "youtube" ? "bg-red-500" : "bg-gray-400")} />
              YouTube
            </button>
          </div>
        )}

        {/* Textarea row */}
        <div className="flex items-center">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={placeholder}
            className={cn(
              "flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none leading-snug",
              isDark ? "text-white placeholder:text-white/40" : "text-[#060541] placeholder:text-[#060541]/40"
            )}
          />
          <button
            type="button"
            title={language === "ar" ? "إرسال" : "Send"}
            onClick={sendMessage}
            className={cn(
              "mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all active:scale-95",
              text.trim() || isYoutube
                ? cn(sendBtnClass, "text-white shadow")
                : isDark ? "text-white/30" : "text-black/20"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* + button — same PlusMenu as WAKTI AI chat, hidden in search mode */}
      {showPlus && (
        <div className="flex items-center justify-center">
          <PlusMenu onCamera={() => {}} onUpload={() => {}} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ModernHomeScreen({ displayName: _displayName }: ModernHomeScreenProps) {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const { profile } = useUserProfile();
  const [quote] = useState(() => getQuoteForDisplay());
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [quoteExiting, setQuoteExiting] = useState(false);

  const { tasks, reminders } = useOptimizedTRData();
  const { events: maw3dEvents, attendingCounts } = useOptimizedMaw3dEvents();
  const whoopData = useWhoopData();
  const journalData = useJournalData();

  const pendingTasks    = tasks.filter(t => !t.completed).length;
  const completedToday  = tasks.filter(t => t.completed).length;
  const total           = pendingTasks + completedToday;
  const pct             = total > 0 ? Math.round((completedToday / total) * 100) : 0;
  const taskAccent      = pct >= 70 ? '#22c55e' : pct >= 30 ? '#f59e0b' : pendingTasks === 0 ? '#22c55e' : '#ef4444';
  const taskIconBg      = pct >= 70 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : pct >= 30 ? 'linear-gradient(135deg,#b45309,#f59e0b)' : pendingTasks === 0 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#be123c,#ef4444)';

  const upcomingCount = maw3dEvents.filter(e => {
    try { return new Date(e.event_date) >= new Date(new Date().toDateString()); } catch { return false; }
  }).length;

  const isDark = theme === "dark";
  const avatarUrl = profile?.avatar_url || "";
  const shell = makeShell(isDark);

  const ACCOUNT_APP: AppItem = {
    id: "account", nameEn: "Account", nameAr: "الحساب", path: "/account",
    icon: Users, accent: "#93c5fd", glow: "rgba(147,197,253,0.45)",
  };
  const [modePickerTrigger, setModePickerTrigger] = useState(0);

  // Read active mode from localStorage to drive Modes circle icon+color
  const [activeModeKey, setActiveModeKey] = useState<string>(() => {
    try { return localStorage.getItem("wakti_active_trigger") || "chat"; } catch { return "chat"; }
  });
  // Keep in sync when mode picker changes
  useEffect(() => {
    if (modePickerTrigger > 0) {
      try { setActiveModeKey(localStorage.getItem("wakti_active_trigger") || "chat"); } catch { /* ignore */ }
    }
  }, [modePickerTrigger]);
  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent<{ mode: string }>).detail?.mode;
      if (mode) setActiveModeKey(mode);
    };
    window.addEventListener("wakti-homescreen-mode-changed", handler as EventListener);
    return () => window.removeEventListener("wakti-homescreen-mode-changed", handler as EventListener);
  }, []);
  const activeModeConfig = MODES.find(m => m.key === activeModeKey) ?? MODES[0];
  const modeAccentMap: Record<string, string> = { chat: "#3b82f6", search: "#22c55e", study: "#a855f7" };
  const modeGlowMap: Record<string, string> = { chat: "rgba(59,130,246,0.45)", search: "rgba(34,197,94,0.45)", study: "rgba(168,85,247,0.45)" };

  const MODES_APP: AppItem = {
    id: "modes", nameEn: "Modes", nameAr: "الأوضاع", path: "/settings",
    icon: activeModeConfig.Icon as React.ElementType,
    accent: modeAccentMap[activeModeKey] ?? "#7fa2ff",
    glow: modeGlowMap[activeModeKey] ?? "rgba(127,162,255,0.42)",
  };
  const WAKTI_AI_APP: AppItem = {
    id: "wakti-ai", nameEn: "WAKTI AI", nameAr: "WAKTI AI", path: "/wakti-ai",
    icon: Sparkles, accent: "#f97316", glow: "rgba(249,115,22,0.45)",
  };

  const cardShell = isDark
    ? "border-white/15 bg-[linear-gradient(145deg,rgba(18,23,34,0.88),rgba(11,14,20,0.92))]"
    : "border-[#060541]/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(242,247,255,0.95))]";
  const buildSectionStyle = (accent: string) => ({
    borderColor: isDark ? `${accent}80` : `${accent}4d`,
    boxShadow: isDark
      ? `0 14px 28px rgba(0,0,0,0.22), 0 0 0 1px ${accent}20`
      : `0 10px 24px ${accent}12, 0 0 0 1px ${accent}18`,
  });
  const widgetsSectionStyle = buildSectionStyle("#6366f1");
  const productivitySectionStyle = buildSectionStyle("#22c55e");
  const systemSectionStyle = buildSectionStyle("#38bdf8");
  const creationSectionStyle = buildSectionStyle("#c084fc");
  const sectionTitleClass = cn(
    "text-center font-black leading-none text-foreground",
    language === "ar" ? "text-[1.9rem] tracking-tight" : "text-[1.55rem] tracking-[-0.02em]"
  );
  const productivityTitleClass = cn(
    "text-center font-black leading-none text-foreground",
    language === "ar" ? "text-[1.72rem] tracking-tight" : "text-[1.55rem] tracking-[-0.02em]"
  );
  const creationTitleClass = cn(
    "text-center font-black leading-none text-foreground",
    language === "ar" ? "text-[1.55rem] tracking-tight" : "text-[1.2rem] tracking-[-0.015em]"
  );
  const quoteText = getQuoteText(quote, language);
  const quoteAuthor = getQuoteAuthor(quote);

  return (
    <div
      dir="ltr"
      className={cn(
        "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden px-3 pb-0 pt-3 md:px-4 md:pb-0",
        isDark
          ? "bg-[radial-gradient(circle_at_top,#17233a_0%,#0c0f14_55%,#090b10_100%)]"
          : "bg-[radial-gradient(circle_at_top,#f4f8ff_0%,#fcfefd_52%,#eef3ff_100%)]"
      )}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-1 flex-col gap-3 md:gap-4">
        {/* Top row: Account + Modes/AI controls | Widgets carousel */}
        <div className="grid items-start grid-cols-[102px_minmax(0,1fr)] gap-3 md:grid-cols-[116px_minmax(0,1fr)]">
          <div className="space-y-3 pt-1">
            <p className={cn(
              "text-center text-[15px] font-bold leading-tight tracking-tight",
              isDark
                ? "bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent"
                : "bg-gradient-to-r from-[#060541] via-indigo-600 to-purple-600 bg-clip-text text-transparent"
            )}>
              {(() => {
                const h = new Date().getHours();
                if (language === "ar") return h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور";
                return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
              })()}
            </p>
            <div className="flex justify-center">
              <AppCircle app={ACCOUNT_APP} language={language} onClick={() => navigate(ACCOUNT_APP.path)} avatarUrl={avatarUrl} size="large" />
            </div>

            {/* Modes + WAKTI AI side by side — pushed down */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {/* Modes button — sliders icon */}
              <button
                type="button"
                onClick={() => setModePickerTrigger(v => v + 1)}
                className="group flex flex-col items-center gap-1 active:scale-95 transition-all"
              >
                <span
                  className="flex items-center justify-center rounded-2xl w-full h-12 transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${modeAccentMap[activeModeKey]}33 0%, ${modeAccentMap[activeModeKey]}55 100%)`,
                    boxShadow: `0 4px 14px ${modeGlowMap[activeModeKey]}`,
                    border: `1.5px solid ${modeAccentMap[activeModeKey]}60`,
                  }}
                >
                  <SlidersHorizontal
                    className="h-5 w-5"
                    style={{ color: modeAccentMap[activeModeKey] }}
                  />
                </span>
                <span className="text-[10px] font-semibold text-foreground/70">
                  {language === "ar" ? "الأوضاع" : "Modes"}
                </span>
              </button>

              {/* WAKTI AI button — sparkles in orange circle */}
              <button
                type="button"
                onClick={() => navigate("/wakti-ai")}
                className="group flex flex-col items-center gap-1 active:scale-95 transition-all"
              >
                <span
                  className="flex items-center justify-center rounded-full w-12 h-12 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #c2440a 0%, #f97316 60%, #fb923c 100%)",
                    boxShadow: "0 4px 16px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
                    border: "1.5px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <Sparkles className="h-5 w-5 text-white" />
                </span>
                <span className="whitespace-nowrap text-[10px] font-semibold leading-none text-foreground/70">
                  WAKTI AI
                </span>
              </button>
            </div>
          </div>

          <section className={cn("self-start rounded-[2rem] border-[1.5px] px-3 pt-2 pb-0", cardShell)} style={widgetsSectionStyle}>
            <Carousel opts={{ align: "start", dragFree: true, direction: "ltr" }} className="w-full" dir="ltr">
              <CarouselContent className="sm:-ml-2">
                <CarouselItem className="basis-full sm:basis-[88%] sm:pl-2 lg:basis-[70%]">
                  <div className="h-52">
                    <QuoteWidgetInline shell={shell} language={language} quote={quote} onExpand={() => { setQuoteExpanded(true); setQuoteExiting(false); }} />
                  </div>
                </CarouselItem>
                <CarouselItem className="basis-full sm:basis-[88%] sm:pl-2 lg:basis-[70%]">
                  <div className="h-52">
                    <TRWidgetInline shell={shell} navigate={navigate} language={language}
                      pendingTasks={pendingTasks} completedToday={completedToday} total={total} pct={pct}
                      taskAccent={taskAccent} taskIconBg={taskIconBg} reminders={reminders ?? []} />
                  </div>
                </CarouselItem>
                <CarouselItem className="basis-full sm:basis-[88%] sm:pl-2 lg:basis-[70%]">
                  <div className="h-52">
                    <CalendarWidgetInline shell={shell} navigate={navigate} language={language} upcomingCount={upcomingCount} />
                  </div>
                </CarouselItem>
                <CarouselItem className="basis-full sm:basis-[88%] sm:pl-2 lg:basis-[70%]">
                  <div className="h-52">
                    <Maw3dWidgetInline shell={shell} navigate={navigate} language={language} events={maw3dEvents ?? []} attendingCounts={attendingCounts ?? {}} />
                  </div>
                </CarouselItem>
                <CarouselItem className="basis-full sm:basis-[88%] sm:pl-2 lg:basis-[70%]">
                  <div className="h-52">
                    <JournalWidgetInline shell={shell} navigate={navigate} language={language} journalData={journalData} />
                  </div>
                </CarouselItem>
                <CarouselItem className="basis-full sm:basis-[88%] sm:pl-2 lg:basis-[70%]">
                  <div className="h-52">
                    <VitalityWidgetInline shell={shell} navigate={navigate} language={language} whoopData={whoopData} />
                  </div>
                </CarouselItem>
              </CarouselContent>
            </Carousel>
          </section>
        </div>

        {/* WAKTI AI chat bar — functional */}
        <HomescreenChatBar language={language} isDark={isDark} cardShell={cardShell} navigate={navigate} triggerOpenModePicker={modePickerTrigger} />

        {/* Productivity + System */}
        <div className="grid grid-cols-[minmax(0,1fr)_108px] gap-2.5">
          <section className={cn("rounded-[2rem] border-[1.5px] px-2.5 py-2.5", cardShell)} style={productivitySectionStyle}>
            <h3 className={cn("mb-2.5", productivityTitleClass)}>
              {language === "ar" ? "الإنتاجية" : "Productivity"}
            </h3>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {PRODUCTIVITY_APPS.map((app) => (
                <AppCircle key={app.id} app={app} language={language} onClick={() => navigate(app.path)} size="compact" />
              ))}
            </div>
          </section>
          <aside className={cn("relative rounded-[2rem] border-[1.5px] px-2 py-1.5", cardShell)} style={systemSectionStyle}>
            <div className={cn("absolute inset-y-2.5 flex items-center justify-center", language === "ar" ? "left-1" : "right-1")}>
              <span className={cn("text-foreground/85 font-extrabold", language === "ar" ? "[writing-mode:vertical-lr] text-[1.34rem] tracking-[0.14em]" : "[writing-mode:vertical-rl] text-[13px] tracking-[0.42em]")}>
                {language === "ar" ? "النظام" : "SYSTEM"}
              </span>
            </div>
            <div className={cn("flex h-full flex-col items-center justify-center gap-3", language === "ar" ? "pl-4" : "pr-4")}>
              {SYSTEM_APPS.map((app) => (
                <AppCircle key={app.id} app={app} language={language} onClick={() => navigate(app.path)} size="compact" />
              ))}
            </div>
          </aside>
        </div>

        {/* Creation & Generation */}
        <section className={cn("mt-auto -translate-y-3 rounded-[2.2rem] border-[1.5px] px-2.5 pt-1 pb-0", cardShell)} style={creationSectionStyle}>
          <h3 className={cn("mb-1", creationTitleClass)}>
            {language === "ar" ? "الإبداع والتوليد" : "Creation & Generation"}
          </h3>
          <div className="grid grid-cols-5 gap-1.5 md:gap-2">
            {CREATION_APPS.map((app) => (
              <AppCircle key={app.id} app={app} language={language} onClick={() => navigate(app.path)} size="compact" />
            ))}
          </div>
        </section>

        {quoteExpanded && (
          <QuoteOverlay
            quoteText={quoteText}
            quoteAuthor={quoteAuthor}
            language={language}
            onClose={() => {
              setQuoteExiting(true);
              setTimeout(() => { setQuoteExpanded(false); setQuoteExiting(false); }, 420);
            }}
            exiting={quoteExiting}
          />
        )}
      </div>
    </div>
  );
}
