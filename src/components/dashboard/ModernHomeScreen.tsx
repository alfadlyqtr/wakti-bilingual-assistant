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
  Check,
  CheckSquare,
  Code2,
  ListTodo,
  FolderOpen,
  Gamepad2,
  Heart,
  HelpCircle,
  Loader2,
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
  Trash2,
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
import { onEvent } from "@/utils/eventBus";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { WaktiIcon } from "@/components/icons/WaktiIcon";
import { PlusMenu } from "@/components/wakti-ai-v2/PlusMenu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EnhancedFrontendMemory } from "@/services/EnhancedFrontendMemory";
import { SavedConversationsService, normalizeConversationTitle, type ConversationListItem } from "@/services/SavedConversationsService";

// --- Types -------------------------------------------------------------------

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

type ModernWidgetKey = "showCalendarWidget" | "showTRWidget" | "showMaw3dWidget" | "showVitalityWidget" | "showJournalWidget" | "showQuoteWidget";
type ModernWidgetSettings = Record<ModernWidgetKey, boolean>;

const DEFAULT_MODERN_WIDGET_ORDER: ModernWidgetKey[] = [
  "showCalendarWidget",
  "showTRWidget",
  "showMaw3dWidget",
  "showVitalityWidget",
  "showJournalWidget",
  "showQuoteWidget",
];

const DEFAULT_MODERN_WIDGET_SETTINGS: ModernWidgetSettings = {
  showCalendarWidget: true,
  showTRWidget: true,
  showMaw3dWidget: true,
  showVitalityWidget: true,
  showJournalWidget: true,
  showQuoteWidget: true,
};

function sanitizeModernWidgetOrder(raw: unknown): ModernWidgetKey[] {
  if (!Array.isArray(raw)) return DEFAULT_MODERN_WIDGET_ORDER;

  const validKeys = new Set<ModernWidgetKey>(DEFAULT_MODERN_WIDGET_ORDER);
  const normalized = raw.filter((value): value is ModernWidgetKey => typeof value === "string" && validKeys.has(value as ModernWidgetKey));

  return [
    ...normalized,
    ...DEFAULT_MODERN_WIDGET_ORDER.filter((key) => !normalized.includes(key)),
  ];
}

// --- App lists ---------------------------------------------------------------

const CREATION_APPS: AppItem[] = [
  { id: "projects", nameEn: "Code", nameAr: "???????", path: "/projects", icon: Code2, accent: "#60a5fa", glow: "rgba(96,165,250,0.26)" },
  { id: "studio", nameEn: "Studio", nameAr: "?????????", path: "/music", icon: Aperture, accent: "#34d399", glow: "rgba(52,211,153,0.24)" },
  { id: "text", nameEn: "Text", nameAr: "????", path: "/tools/text", icon: PenTool, accent: "#f59e0b", glow: "rgba(245,158,11,0.24)" },
  { id: "voice", nameEn: "Voice", nameAr: "?????", path: "/tools/voice-studio", icon: Mic, accent: "#22d3ee", glow: "rgba(34,211,238,0.24)" },
  { id: "maw3d", nameEn: "Maw3d", nameAr: "??????", path: "/maw3d", icon: CalendarClock, accent: "#fb923c", glow: "rgba(251,146,60,0.24)" },
];

const SYSTEM_APPS: AppItem[] = [
  { id: "settings", nameEn: "Settings", nameAr: "?????????", path: "/settings", icon: Settings, accent: "#60a5fa", glow: "rgba(96,165,250,0.24)" },
  { id: "help", nameEn: "Help", nameAr: "????????", path: "/help", icon: HelpCircle, accent: "#4ade80", glow: "rgba(74,222,128,0.24)" },
];

const PRODUCTIVITY_APPS: AppItem[] = [
  { id: "my-files", nameEn: "My Files", nameAr: "??????", path: "/my-warranty", icon: FolderOpen, accent: "#10b981", glow: "rgba(16,185,129,0.24)" },
  { id: "journal", nameEn: "Journal", nameAr: "???????", path: "/journal", icon: NotebookPen, accent: "#f59e0b", glow: "rgba(245,158,11,0.24)" },
  { id: "calendar", nameEn: "Calendar", nameAr: "???????", path: "/calendar", icon: Calendar, accent: "#38bdf8", glow: "rgba(56,189,248,0.24)" },
  { id: "tasks", nameEn: "Tasks", nameAr: "??????", path: "/tr", icon: ListTodo, accent: "#22c55e", glow: "rgba(34,197,94,0.24)" },
  { id: "email", nameEn: "Email", nameAr: "??????", path: "/tools/email", icon: Mail, accent: "#fbbf24", glow: "rgba(251,191,36,0.24)" },
  { id: "social", nameEn: "Social", nameAr: "??????", path: "/social", icon: MessageCircle, accent: "#22d3ee", glow: "rgba(34,211,238,0.24)" },
  { id: "vitality", nameEn: "Health", nameAr: "?????", path: "/fitness", icon: Activity, accent: "#84cc16", glow: "rgba(132,204,22,0.24)" },
  { id: "games", nameEn: "Games", nameAr: "???????", path: "/tools/game", icon: Gamepad2, accent: "#f97316", glow: "rgba(249,115,22,0.24)" },
  { id: "deen", nameEn: "Deen", nameAr: "???", path: "/deen", icon: BookOpen, accent: "#818cf8", glow: "rgba(129,140,248,0.24)" },
];

type AppCircleProps = {
  app: AppItem;
  language: "en" | "ar";
  onClick: () => void;
  size?: "regular" | "small" | "large" | "compact";
  avatarUrl?: string;
  overrideIcon?: React.ElementType;
  overrideAccent?: string;
  overrideGlow?: string;
  useWaktiLogo?: boolean;
  scale?: number;
};

const MODERN_SCALE_BASE_WIDTH = 390;
const MODERN_SCALE_BASE_HEIGHT = 720;

function getStableModernViewport() {
  if (typeof window === "undefined") {
    return { width: MODERN_SCALE_BASE_WIDTH, height: MODERN_SCALE_BASE_HEIGHT };
  }

  const viewportWidth = window.innerWidth || MODERN_SCALE_BASE_WIDTH;
  const viewportHeight = window.innerHeight || MODERN_SCALE_BASE_HEIGHT;

  if (viewportWidth >= 768) {
    return { width: viewportWidth, height: viewportHeight };
  }

  const screenWidth = window.screen?.width || viewportWidth;
  const screenHeight = window.screen?.height || viewportHeight;

  return {
    width: Math.min(screenWidth, screenHeight),
    height: Math.max(screenWidth, screenHeight),
  };
}

// --- AppCircle ----------------------------------------------------------------

function AppCircle({ app, language, onClick, size = "regular", avatarUrl, overrideIcon, overrideAccent, overrideGlow, useWaktiLogo, scale = 1 }: AppCircleProps) {
  const Icon = overrideIcon ?? app.icon;
  const accent = overrideAccent ?? app.accent;
  const glow = overrideGlow ?? app.glow;
  const resolvedScale = size === "compact" || size === "large" ? scale : 1;
  const bubblePx = (size === "compact" ? 48 : size === "small" ? 56 : size === "large" ? 80 : 64) * resolvedScale;
  const iconPx = (size === "compact" ? 18 : size === "small" ? 20 : size === "large" ? 32 : 24) * resolvedScale;
  const labelPx = (size === "compact" ? 10 : 11.5) * resolvedScale;
  const gapPx = (size === "compact" ? 4 : 6) * resolvedScale;
  const isAccount = app.id === "account";

  return (
    <button type="button" onClick={onClick} className="group flex min-w-0 select-none flex-col items-center" style={{ gap: `${gapPx}px` }}>
      <span
        className="relative flex items-center justify-center rounded-full border transition-all duration-200 overflow-hidden border-white/40 group-hover:scale-105"
        style={{
          width: `${bubblePx}px`,
          height: `${bubblePx}px`,
          background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.1) 48%, rgba(10,20,40,0.1) 100%), linear-gradient(135deg, ${accent}22 0%, ${accent}42 100%)`,
          borderColor: `${accent}66`,
          boxShadow: `0 7px 16px ${glow}, inset 0 1px 0 rgba(255,255,255,0.52)`,
        }}
      >
        {isAccount && avatarUrl
          ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          : useWaktiLogo
            ? <WaktiIcon style={{ color: accent, width: `${iconPx}px`, height: `${iconPx}px` }} />
            : Icon ? <Icon style={{ color: accent, width: `${iconPx}px`, height: `${iconPx}px` }} /> : null
        }
      </span>
      <span className={cn("text-center font-semibold leading-tight text-foreground/90 select-none", size === "compact" ? "whitespace-nowrap" : "line-clamp-2")} style={{ fontSize: `${labelPx}px` }}>
        {language === "ar" ? app.nameAr : app.nameEn}
      </span>
    </button>
  );
}

// --- Shell renderer (glass card identical to HomeScreen widgets) --------------

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

// --- Helpers (exact copies from HomeScreen.tsx) -------------------------------

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
  if (h > 0) return language === 'ar' ? `${h}? ${pad(m)}?` : `${h}h ${pad(m)}m`;
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

// --- Inline widget components (exact copies from HomeScreen.tsx) --------------

const MOOD_EMOJI = ['', '??', '??', '??', '??', '??'];
const MOOD_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#8b5cf6'];
const MOOD_LABEL_EN = ['', 'Awful', 'Bad', 'Meh', 'Good', 'Amazing'];
const MOOD_LABEL_AR = ['', '??? ????', '???', '????', '???', '????'];

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
            {activeTab === 'tasks' ? (language === 'ar' ? '??????' : 'Tasks') : (language === 'ar' ? '???????' : 'Alerts')}
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
          <span className="text-[7px] font-bold" style={{ color: taskAccent }}>{language === 'ar' ? '?????' : 'Done'}</span>
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
                      {overdue && <span className="text-[7px] font-black text-red-400 uppercase">{language === 'ar' ? '?????' : 'LATE'}</span>}
                      <span className={`text-[9px] font-black tabular-nums ${overdue ? 'text-red-300' : 'text-white'}`}>{countdown}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[9px] text-white/80 uppercase">{language === 'ar' ? '?? ???????' : 'No reminders'}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-[7px] text-white/85 uppercase font-bold">{language === 'ar' ? '?????' : 'pending'}</span>
          <span className="text-[7px] font-bold" style={{ color: taskAccent }}>{activeTab === 'tasks' ? pct : 0}%</span>
          <span className="text-[7px] text-white/85 uppercase font-bold">{language === 'ar' ? '?????' : 'done'}</span>
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
            {language === 'ar' ? '???????' : 'Journal'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/30 border border-orange-400/40">
            <span className="text-[8px]">??</span>
            <span className="text-[8px] font-black text-orange-300 tabular-nums">{currentStreak}</span>
          </div>
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-400/30">
            <span className="text-[8px]">??</span>
            <span className="text-[8px] font-black text-yellow-300 tabular-nums">{bestStreak}</span>
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-white/10 px-2 py-1.5 flex items-start gap-1.5">
        <span className="text-[18px] leading-none flex-shrink-0 mt-0.5">{mood ? MOOD_EMOJI[mood] : '??'}</span>
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
                <span className="text-[7px] text-white/80">{language === 'ar' ? '?? ???????' : 'No note'}</span>
              )}
            </>
          ) : (
            <span className="text-[8px] text-white/85">{language === 'ar' ? '?? ???? ????? ???' : 'No entry yet today'}</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[7px] text-white/85 uppercase font-bold">{language === 'ar' ? '??????' : 'Mood'}</span>
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
          {language === 'ar' ? '?????' : 'Today'}
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
            ? (language === 'ar' ? '?? ?????' : 'No upcoming events')
            : `${upcomingCount} ${language === 'ar' ? '??? ????' : upcomingCount === 1 ? 'upcoming event' : 'upcoming events'}`}
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
      if (isToday) return language === 'ar' ? '?????' : 'Today';
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
            {language === 'ar' ? '??????' : 'Maw3d'}
          </span>
        </div>
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-purple-400/30" style={{ background: 'rgba(124,58,237,0.25)' }}>
          <span className="text-[9px] font-black text-purple-200 tabular-nums">{active.length}</span>
          <span className="text-[7px] text-purple-200 uppercase">{language === 'ar' ? ' ???' : ' event'}{active.length !== 1 ? 's' : ''}</span>
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
                    <span className="text-[6px] text-white/80">{language === 'ar' ? ' ???' : ' going'}</span>
                  </div>
                </div>
                {isToday && <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[9px] text-white/80 uppercase">{language === 'ar' ? '?? ?????? ?????' : 'No upcoming events'}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[7px] text-white/85 uppercase font-bold">
          {language === 'ar' ? '?????? ??????' : 'Total attending'}
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
                    <span className="text-[9px] font-black text-white/90 uppercase">{language === 'ar' ? '???????' : 'REC'}</span>
                  </div>
                  {sleepHours != null && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-white/85">{language === 'ar' ? '???' : 'Sleep'}</span>
                      <span className="text-[10px] text-white font-bold">{sleepHours}h</span>
                      {sleepPerf != null && <span className="text-[8px] text-white/80">Ã‚Â· {Math.round(sleepPerf)}%</span>}
                    </div>
                  )}
                </div>
              </div>
              {strain != null && (
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[8px] text-white/85 font-bold uppercase">{language === 'ar' ? '?????' : 'Strain'}</span>
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
                    <span className="text-[8px] text-white/90 uppercase">{language === 'ar' ? '?.???' : 'AvgHR'}</span>
                    <span className="text-[11px] text-white font-black">{Math.round(avgHr)}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-end flex-1">
              <p className="text-[13px] font-black text-white">WHOOP</p>
              <p className="text-[9px] text-white/90">{language === 'ar' ? '??? ????' : 'Not connected'}</p>
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
              <p className="text-[12px] font-black text-white leading-none">{language === 'ar' ? '??? ????' : 'Apple Health'}</p>
              <p className="text-[8px] text-white/85 mt-0.5">{language === 'ar' ? '?????? ?????' : "Today's data"}</p>
            </div>
          </div>
          {hkLoading ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-[9px] text-white/85">{language === 'ar' ? '??? ???????...' : 'Loading...'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-white/10 rounded-lg p-1.5">
                <p className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? '?????' : 'Steps'}</p>
                <p className="text-[12px] font-black text-white leading-tight">{hkData?.steps ? hkData.steps.toLocaleString() : '--'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-1.5">
                <p className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? '???' : 'Avg HR'}</p>
                <p className="text-[12px] font-black text-white leading-tight">{hkData?.avgHr != null ? hkData.avgHr : '--'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-1.5">
                <p className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? '???' : 'Sleep'}</p>
                <p className="text-[12px] font-black text-white leading-tight">{hkData?.sleepHours != null ? `${hkData.sleepHours}h` : '--'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-1.5">
                <p className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? '??? ????' : 'RHR'}</p>
                <p className="text-[12px] font-black text-white leading-tight">{hkData?.rhr != null ? hkData.rhr : '--'}</p>
              </div>
            </div>
          )}
          <div
            onClick={(e) => { e.stopPropagation(); navigate('/fitness'); }}
            className="flex items-center justify-center gap-1 bg-white/10 border border-white/20 rounded-lg py-1 active:scale-95 transition-all cursor-pointer"
          >
            <span className="text-[9px] text-white/90 font-semibold">{language === 'ar' ? '??? ??????? ?' : 'Open Vitality ?'}</span>
          </div>
        </div>
      )}
    </div>
  ) as React.ReactElement;
}

// --- Quote Widget Inline -----------------------------------------------------

function QuoteOverlay({ quoteText, quoteAuthor, language, onClose, exiting }: { quoteText: string; quoteAuthor: string; language: string; onClose: () => void; exiting: boolean; }) {
  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center px-8 transition-opacity duration-300 ${exiting ? 'opacity-0' : 'opacity-100'}`} onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />
      <div className="relative max-w-md text-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <p className="text-[clamp(19px,5.2vw,27px)] italic font-light leading-[1.72] text-white/95">{quoteText}</p>
        {quoteAuthor ? <p className="mt-4 text-sm text-white/60">Ã¢â‚¬â€ {quoteAuthor}</p> : null}
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200/80">{language === 'ar' ? '?????? ?????' : "Today's Quote"}</span>
      </div>
      <p className="text-[13px] font-semibold text-white leading-snug line-clamp-5 italic">&#8220;{text}&#8221;</p>
      {author ? <p className="text-[10px] text-indigo-200/70 font-medium">&mdash; {author}</p> : null}
    </div>
  ) as React.ReactElement;
}

// --- Homescreen Chat Bar ------------------------------------------------------

type ModeKey = "chat" | "search" | "study";
const MODES: { key: ModeKey; labelEn: string; labelAr: string; pill: string; Icon: React.ElementType }[] = [
  { key: "chat",   labelEn: "Chat",   labelAr: "?????", pill: "bg-blue-600",   Icon: Bot },
  { key: "search", labelEn: "Search", labelAr: "???",   pill: "bg-green-600",  Icon: SearchIcon },
  { key: "study",  labelEn: "Study",  labelAr: "?????", pill: "bg-purple-600", Icon: BookOpen },
];

type WaktiAiNavigationState = {
  pendingMessage?: string;
  pendingTrigger?: "chat" | "search";
  pendingChatSubmode?: "chat" | "study";
  pendingSearchSubmode?: "web" | "youtube";
  pendingPayloadId?: string;
  selectedConversationRowId?: string;
  openConversations?: boolean;
  openExtraTab?: "conversations";
};

type HomescreenWaktiDraft = {
  text: string;
  mode: ModeKey;
  searchSubmode: "web" | "youtube";
};

type HomescreenSelectedConversation = {
  rowId: string;
  conversationId: string;
  title: string;
  messageCount: number;
  lastMessageAt: string | null;
  isActive: boolean;
};

const HOMESCREEN_SELECTED_CONVERSATION_KEY = "wakti_homescreen_selected_conversation";

function loadHomescreenSelectedConversation(): HomescreenSelectedConversation | null {
  try {
    const raw = localStorage.getItem(HOMESCREEN_SELECTED_CONVERSATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.rowId !== "string" || !parsed.rowId.trim()) return null;
    return {
      rowId: parsed.rowId,
      conversationId: typeof parsed.conversationId === "string" && parsed.conversationId.trim() ? parsed.conversationId : parsed.rowId,
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "Conversation",
      messageCount: typeof parsed.messageCount === "number" ? parsed.messageCount : 0,
      lastMessageAt: typeof parsed.lastMessageAt === "string" ? parsed.lastMessageAt : null,
      isActive: parsed.isActive === true,
    };
  } catch {
    return null;
  }
}

function persistHomescreenSelectedConversation(conversation: HomescreenSelectedConversation | null) {
  try {
    if (conversation) {
      localStorage.setItem(HOMESCREEN_SELECTED_CONVERSATION_KEY, JSON.stringify(conversation));
    } else {
      localStorage.removeItem(HOMESCREEN_SELECTED_CONVERSATION_KEY);
    }
  } catch { /* ignore */ }
}

function buildHomescreenWaktiNavigationState(
  draft: HomescreenWaktiDraft,
  overrides?: Partial<Pick<WaktiAiNavigationState, "openConversations" | "openExtraTab" | "selectedConversationRowId">>
): WaktiAiNavigationState {
  const trimmedText = draft.text.trim();
  const pendingMessage = (draft.mode === "search" && draft.searchSubmode === "youtube" && trimmedText)
    ? `yt: ${trimmedText}`
    : (trimmedText || undefined);

  return {
    pendingMessage,
    pendingTrigger: draft.mode === "study" ? "chat" : draft.mode === "search" ? "search" : "chat",
    pendingChatSubmode: draft.mode === "study" ? "study" : "chat",
    pendingSearchSubmode: draft.searchSubmode,
    pendingPayloadId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides,
  };
}

function persistHomescreenWaktiNavigationState(state: WaktiAiNavigationState) {
  try {
    if (state.pendingMessage) {
      localStorage.setItem("wakti_pending_message", state.pendingMessage);
    } else {
      localStorage.removeItem("wakti_pending_message");
    }

    if (state.pendingTrigger) {
      localStorage.setItem("wakti_active_trigger", state.pendingTrigger);
    }

    if (state.pendingChatSubmode === "study") {
      localStorage.setItem("wakti_chat_submode", "study");
    } else {
      localStorage.removeItem("wakti_chat_submode");
    }

    if (state.pendingSearchSubmode) {
      localStorage.setItem("wakti_search_submode", state.pendingSearchSubmode);
    }

    if (state.pendingPayloadId) {
      localStorage.setItem("wakti_pending_payload_id", state.pendingPayloadId);
    }

    if (state.selectedConversationRowId) {
      localStorage.setItem("wakti_selected_conversation_row_id", state.selectedConversationRowId);
    } else {
      localStorage.removeItem("wakti_selected_conversation_row_id");
    }

    if (state.openConversations) {
      localStorage.setItem("wakti_open_conversations", "1");
    } else {
      localStorage.removeItem("wakti_open_conversations");
    }

    if (state.openExtraTab) {
      localStorage.setItem("wakti_open_extra_tab", state.openExtraTab);
    } else {
      localStorage.removeItem("wakti_open_extra_tab");
    }
  } catch { /* ignore */ }
}
function HomescreenChatBar({
  language, isDark, cardShell, navigate, triggerOpenModePicker, onDraftChange, selectedConversationRowId,
}: { language: "en" | "ar"; isDark: boolean; cardShell: string; navigate: (p: string, options?: { state?: WaktiAiNavigationState }) => void; triggerOpenModePicker?: number; onDraftChange?: (draft: HomescreenWaktiDraft) => void; selectedConversationRowId?: string }) {
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

  // Modes circle pressed ? toggle mode pills inside input
  useEffect(() => {
    if (triggerOpenModePicker && triggerOpenModePicker > 0) {
      setShowModePicker(v => !v);
      inputRef.current?.focus();
    }
  }, [triggerOpenModePicker]);

  useEffect(() => {
    onDraftChange?.({ text, mode, searchSubmode });
  }, [text, mode, searchSubmode, onDraftChange]);

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
    const nextState = buildHomescreenWaktiNavigationState(
      { text, mode, searchSubmode },
      selectedConversationRowId ? { selectedConversationRowId } : undefined,
    );
    persistHomescreenWaktiNavigationState(nextState);
    navigate("/wakti-ai", { state: nextState });
    setText("");
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
        ? (language === "ar" ? "Ø§Ø¨Ø­Ø« Ø¹Ù„Ù‰ ÙŠÙˆØªÙŠÙˆØ¨..." : "Search YouTube: title, topic, or channel...")
        : (language === "ar" ? "Ø§Ø¨Ø­Ø« ÙÙŠ Ø§Ù„ÙˆÙŠØ¨..." : "Search the web: news, sports, topics..."))
    : (language === "ar" ? "Ø§ÙƒØªØ¨ Ø±Ø³Ø§Ù„ØªÙƒ Ù„ÙˆÙƒØªÙŠ AI..." : "Type a message for WAKTI AI...");

  const showPlus = mode !== "search";

  return (
    <div className={cn("grid gap-2", showPlus ? "grid-cols-[minmax(0,1fr)_48px]" : "grid-cols-1")}>
      {/* Input card */}
      <div className={cn("relative flex flex-col rounded-2xl border overflow-hidden transition-all", cardShell, modeBorder)}>

        {/* Mode pills Ã¢â‚¬â€ shown when Modes circle is tapped */}
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

        {/* Search sub-mode pills: Web / YouTube Ã¢â‚¬â€ shown when Search is active */}
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
              {language === "ar" ? "?????" : "Web"}
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
            title={language === "ar" ? "?????" : "Send"}
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

      {/* + button Ã¢â‚¬â€ same PlusMenu as WAKTI AI chat, hidden in search mode */}
      {showPlus && (
        <div className="flex items-center justify-center">
          <PlusMenu onCamera={() => {}} onUpload={() => {}} />
        </div>
      )}
    </div>
  );
}

// --- Main component -----------------------------------------------------------

export function ModernHomeScreen({ displayName: _displayName }: ModernHomeScreenProps) {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const { profile } = useUserProfile();
  const [quote] = useState(() => getQuoteForDisplay());
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [quoteExiting, setQuoteExiting] = useState(false);
  const [modernWidgetSettings, setModernWidgetSettings] = useState<ModernWidgetSettings>(DEFAULT_MODERN_WIDGET_SETTINGS);
  const [modernWidgetOrder, setModernWidgetOrder] = useState<ModernWidgetKey[]>(DEFAULT_MODERN_WIDGET_ORDER);
  const [stableViewport] = useState(() => getStableModernViewport());

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
    id: "account", nameEn: "Account", nameAr: "Ø§Ù„Ø­Ø³Ø§Ø¨", path: "/account",
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
    id: "modes", nameEn: "Modes", nameAr: "Ø§Ù„Ø£ÙˆØ¶Ø§Ø¹", path: "/settings",
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
  const isDesktopLike = stableViewport.width >= 768;
  const layoutScale = isDesktopLike
    ? 1
    : Math.max(0.78, Math.min(1, stableViewport.width / MODERN_SCALE_BASE_WIDTH, stableViewport.height / MODERN_SCALE_BASE_HEIGHT));
  const scalePx = (value: number, min = 0) => Math.max(min, Number((value * layoutScale).toFixed(2)));
  const rootPaddingX = isDesktopLike ? 16 : scalePx(12, 9);
  const rootPaddingTop = scalePx(12, 9);
  const containerGap = isDesktopLike ? 16 : scalePx(12, 8);
  const topRowGap = scalePx(isDesktopLike ? 16 : 12, 8);
  const topRowLeadWidth = scalePx(isDesktopLike ? 116 : 102, 84);
  const modesButtonGap = scalePx(4, 3);
  const modeControlsGap = scalePx(8, 6);
  const modeControlsTopMargin = scalePx(12, 8);
  const greetingFontSize = scalePx(15, 12);
  const modeBubbleHeight = scalePx(48, 38);
  const modeBubbleRadius = scalePx(16, 12);
  const modeIconSize = scalePx(20, 16);
  const modeLabelSize = scalePx(10, 8.5);
  const widgetsRadius = scalePx(32, 24);
  const widgetsPaddingX = scalePx(12, 9);
  const widgetsPaddingTop = scalePx(8, 6);
  const widgetsPaddingBottom = scalePx(6, 4);
  const widgetCardHeight = scalePx(208, 170);
  const middleRowGap = scalePx(10, 7);
  const systemRailWidth = scalePx(108, 88);
  const sectionRadius = scalePx(32, 24);
  const creationRadius = scalePx(35.2, 26);
  const sectionPaddingX = scalePx(10, 7.5);
  const sectionPaddingY = scalePx(10, 7.5);
  const systemPaddingX = scalePx(8, 6);
  const systemPaddingTop = scalePx(6, 4.5);
  const productivityTitleMargin = scalePx(10, 7);
  const productivityTitleSize = scalePx(language === "ar" ? 27.52 : 24.8, language === "ar" ? 21 : 19);
  const productivityGridGap = scalePx(8, 5.5);
  const systemTitleSize = scalePx(21.12, 16.5);
  const systemTitleMargin = scalePx(8, 5.5);
  const systemGap = scalePx(12, 8);
  const systemVerticalFontSize = scalePx(13, 10.5);
  const systemVerticalLetterSpacing = scalePx(6.76, 5.1);
  const systemRightPadding = scalePx(16, 12);
  const convosButtonMarginTop = scalePx(12, 8);
  const convosButtonHeight = scalePx(32, 26);
  const convosButtonRadius = scalePx(12, 10);
  const convosButtonFontSize = scalePx(12, 10);
  const convosButtonIconSize = scalePx(13, 11);
  const homescreenBarOffset = scalePx(6, 4);
  const creationTranslateY = scalePx(12, 8);
  const creationPaddingTop = scalePx(4, 3);
  const creationPaddingBottom = scalePx(0, 0);
  const creationTitleMargin = scalePx(4, 3);
  const creationTitleSize = scalePx(language === "ar" ? 24.8 : 19.2, language === "ar" ? 19 : 15);
  const creationGridGap = scalePx(6, 4.5);

  const [homescreenWaktiDraft, setHomescreenWaktiDraft] = useState<HomescreenWaktiDraft>(() => {
    try {
      const savedMode = localStorage.getItem("wakti_active_trigger");
      const savedSearchSubmode = localStorage.getItem("wakti_search_submode");
      return {
        text: "",
        mode: savedMode === "search" || savedMode === "study" ? savedMode as ModeKey : "chat",
        searchSubmode: savedSearchSubmode === "youtube" ? "youtube" : "web",
      };
    } catch {
      return { text: "", mode: "chat", searchSubmode: "web" };
    }
  });
  const [showHomescreenConversations, setShowHomescreenConversations] = useState(false);
  const [homescreenConversations, setHomescreenConversations] = useState<ConversationListItem[]>([]);
  const [homescreenConversationsLoading, setHomescreenConversationsLoading] = useState(false);
  const [homescreenConversationsError, setHomescreenConversationsError] = useState<string | null>(null);
  const [selectedHomescreenConversation, setSelectedHomescreenConversation] = useState<HomescreenSelectedConversation | null>(() => loadHomescreenSelectedConversation());

  const openWaktiAiFromHomescreen = (draft: HomescreenWaktiDraft) => {
    const nextState = buildHomescreenWaktiNavigationState(
      draft,
      selectedHomescreenConversation?.rowId ? { selectedConversationRowId: selectedHomescreenConversation.rowId } : undefined,
    );
    persistHomescreenWaktiNavigationState(nextState);
    navigate("/wakti-ai", { state: nextState });
  };

  const loadHomescreenConversations = async () => {
    setHomescreenConversationsLoading(true);
    setHomescreenConversationsError(null);
    try {
      const list = await SavedConversationsService.listConversations();
      setHomescreenConversations(list);
    } catch {
      setHomescreenConversations([]);
      setHomescreenConversationsError(language === "ar" ? "ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª." : "Couldn't load conversations.");
    } finally {
      setHomescreenConversationsLoading(false);
    }
  };

  const openHomescreenConversationsPopup = () => {
    setShowHomescreenConversations(true);
    void loadHomescreenConversations();
  };

  const handleStartHomescreenNewChat = () => {
    setSelectedHomescreenConversation(null);
    persistHomescreenSelectedConversation(null);
    localStorage.removeItem("wakti_selected_conversation_row_id");
    EnhancedFrontendMemory.clearActiveConversation();
    setHomescreenConversationsError(null);
    setShowHomescreenConversations(false);
  };

  const handleSelectHomescreenConversation = async (conversation: ConversationListItem) => {
    setHomescreenConversationsError(null);
    try {
      const full = await SavedConversationsService.loadConversation(conversation.id);
      if (!full) return;

      const messages = Array.isArray(full.messages)
        ? full.messages.map((message: any) => ({
            ...message,
            timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
          }))
        : [];
      const conversationId = full.conversation_id || conversation.conversation_id || conversation.id;
      const { conversationId: activeConversationId } = EnhancedFrontendMemory.loadActiveConversation();

      if (activeConversationId && activeConversationId !== conversationId) {
        SavedConversationsService.deactivateConversation(activeConversationId).catch(() => {});
      }

      if (messages.length > 0) {
        await SavedConversationsService.upsertActiveConversation(messages, conversationId);
        EnhancedFrontendMemory.saveActiveConversation(messages, conversationId);
      }

      const nextSelectedConversation: HomescreenSelectedConversation = {
        rowId: conversation.id,
        conversationId,
        title: normalizeConversationTitle(full.title || conversation.title, language === "ar" ? "Ù…Ø­Ø§Ø¯Ø«Ø©" : "Conversation"),
        messageCount: typeof full.message_count === "number" ? full.message_count : (conversation.message_count ?? messages.length),
        lastMessageAt: full.last_message_at || conversation.last_message_at || null,
        isActive: true,
      };

      setSelectedHomescreenConversation(nextSelectedConversation);
      persistHomescreenSelectedConversation(nextSelectedConversation);
      setHomescreenConversations((prev) => prev.map((item) => ({
        ...item,
        is_active: item.id === conversation.id,
      })));
      setShowHomescreenConversations(false);
    } catch {
      setHomescreenConversationsError(language === "ar" ? "ØªØ¹Ø°Ø± ÙØªØ­ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø©." : "Couldn't open the conversation.");
    }
  };

  const handleDeleteHomescreenConversation = async (conversation: ConversationListItem) => {
    setHomescreenConversationsError(null);
    try {
      await SavedConversationsService.deleteConversation(conversation.id);
      const canonicalId = conversation.conversation_id || conversation.id;
      EnhancedFrontendMemory.deleteArchivedConversation(canonicalId);
      if (
        selectedHomescreenConversation
        && (selectedHomescreenConversation.rowId === conversation.id || selectedHomescreenConversation.conversationId === canonicalId)
      ) {
        setSelectedHomescreenConversation(null);
        persistHomescreenSelectedConversation(null);
        localStorage.removeItem("wakti_selected_conversation_row_id");
        EnhancedFrontendMemory.clearActiveConversation();
      }
      setHomescreenConversations((prev) => prev.filter((item) => ((item.conversation_id || item.id) !== canonicalId)));
      void loadHomescreenConversations();
    } catch {
      setHomescreenConversationsError(language === "ar" ? "ØªØ¹Ø°Ø± Ø­Ø°Ù Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø©." : "Couldn't delete the conversation.");
    }
  };

  useEffect(() => {
    const settings = (profile?.settings as any)?.dashboardWidgets ?? (profile?.settings as any)?.widgets ?? {};

    setModernWidgetSettings({
      showCalendarWidget: settings.showCalendarWidget !== false,
      showTRWidget: (settings.showTRWidget !== false) || settings.showTasksWidget === true,
      showMaw3dWidget: settings.showMaw3dWidget !== false,
      showVitalityWidget: settings.showVitalityWidget !== false,
      showJournalWidget: settings.showJournalWidget !== false,
      showQuoteWidget: settings.showQuoteWidget !== false,
    });

    setModernWidgetOrder(sanitizeModernWidgetOrder(settings.order));
  }, [profile?.settings]);

  useEffect(() => {
    return onEvent("widgetSettingsChanged", (prefs) => {
      if ((prefs as any)?.mode === "homescreen") return;

      setModernWidgetSettings({
        showCalendarWidget: (prefs as any)?.showCalendarWidget !== false,
        showTRWidget: ((prefs as any)?.showTRWidget !== false) || (prefs as any)?.showTasksWidget === true,
        showMaw3dWidget: (prefs as any)?.showMaw3dWidget !== false,
        showVitalityWidget: (prefs as any)?.showVitalityWidget !== false,
        showJournalWidget: (prefs as any)?.showJournalWidget !== false,
        showQuoteWidget: (prefs as any)?.showQuoteWidget !== false,
      });

      if (Array.isArray((prefs as any)?.order)) {
        setModernWidgetOrder(sanitizeModernWidgetOrder((prefs as any).order));
      }
    });
  }, []);

  const modernWidgetCards: Record<ModernWidgetKey, React.ReactNode> = {
    showCalendarWidget: <CalendarWidgetInline shell={shell} navigate={navigate} language={language} upcomingCount={upcomingCount} />,
    showTRWidget: (
      <TRWidgetInline shell={shell} navigate={navigate} language={language}
        pendingTasks={pendingTasks} completedToday={completedToday} total={total} pct={pct}
        taskAccent={taskAccent} taskIconBg={taskIconBg} reminders={reminders ?? []} />
    ),
    showMaw3dWidget: <Maw3dWidgetInline shell={shell} navigate={navigate} language={language} events={maw3dEvents ?? []} attendingCounts={attendingCounts ?? {}} />,
    showVitalityWidget: <VitalityWidgetInline shell={shell} navigate={navigate} language={language} whoopData={whoopData} />,
    showJournalWidget: <JournalWidgetInline shell={shell} navigate={navigate} language={language} journalData={journalData} />,
    showQuoteWidget: <QuoteWidgetInline shell={shell} language={language} quote={quote} onExpand={() => { setQuoteExpanded(true); setQuoteExiting(false); }} />,
  };

  const visibleModernWidgetOrder = modernWidgetOrder.filter((key) => modernWidgetSettings[key] !== false);

  return (
    <div
      dir="ltr"
      className={cn(
        "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden px-3 pb-0 pt-3 md:px-4 md:pb-0",
        isDark
          ? "bg-[radial-gradient(circle_at_top,#17233a_0%,#0c0f14_55%,#090b10_100%)]"
          : "bg-[radial-gradient(circle_at_top,#f4f8ff_0%,#fcfefd_52%,#eef3ff_100%)]"
      )}
      style={{ paddingLeft: `${rootPaddingX}px`, paddingRight: `${rootPaddingX}px`, paddingTop: `${rootPaddingTop}px` }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-1 flex-col" style={{ gap: `${containerGap}px` }}>
        {/* Top row: Account + Modes/AI controls | Widgets carousel */}
        <div className="grid items-start" style={{ gridTemplateColumns: `${topRowLeadWidth}px minmax(0, 1fr)`, gap: `${topRowGap}px` }}>
          <div className="pt-1" style={{ paddingTop: `${scalePx(4, 3)}px` }}>
            <p className={cn(
              "select-none text-center text-[15px] font-bold leading-tight tracking-tight",
              isDark
                ? "bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent"
                : "bg-gradient-to-r from-[#060541] via-indigo-600 to-purple-600 bg-clip-text text-transparent"
            )} style={{ fontSize: `${greetingFontSize}px` }}>
              {(() => {
                const h = new Date().getHours();
                if (language === "ar") return h < 12 ? "ØµØ¨Ø§Ø­ Ø§Ù„Ø®ÙŠØ±" : h < 17 ? "Ù…Ø³Ø§Ø¡ Ø§Ù„Ø®ÙŠØ±" : "Ù…Ø³Ø§Ø¡ Ø§Ù„Ù†ÙˆØ±";
                return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
              })()}
            </p>
            <div className="flex justify-center">
              <AppCircle app={ACCOUNT_APP} language={language} onClick={() => navigate(ACCOUNT_APP.path)} avatarUrl={avatarUrl} size="large" scale={layoutScale} />
            </div>

            {/* Modes + WAKTI AI side by side Ã¢â‚¬â€ pushed down */}
            <div className="grid grid-cols-2" style={{ gap: `${modeControlsGap}px`, marginTop: `${modeControlsTopMargin}px` }}>
              {/* Modes button Ã¢â‚¬â€ sliders icon */}
              <button
                type="button"
                onClick={() => setModePickerTrigger(v => v + 1)}
                className="group flex flex-col items-center active:scale-95 transition-all"
                style={{ gap: `${modesButtonGap}px` }}
              >
                <span
                  className="flex w-full items-center justify-center transition-all"
                  style={{
                    height: `${modeBubbleHeight}px`,
                    borderRadius: `${modeBubbleRadius}px`,
                    background: `linear-gradient(135deg, ${modeAccentMap[activeModeKey]}33 0%, ${modeAccentMap[activeModeKey]}55 100%)`,
                    boxShadow: `0 4px 14px ${modeGlowMap[activeModeKey]}`,
                    border: `1.5px solid ${modeAccentMap[activeModeKey]}60`,
                  }}
                >
                  <SlidersHorizontal
                    style={{ color: modeAccentMap[activeModeKey], width: `${modeIconSize}px`, height: `${modeIconSize}px` }}
                  />
                </span>
                <span className="select-none font-semibold text-foreground/70" style={{ fontSize: `${modeLabelSize}px` }}>
                  {language === "ar" ? "Ø§Ù„Ø£ÙˆØ¶Ø§Ø¹" : "Modes"}
                </span>
              </button>

              {/* WAKTI AI button Ã¢â‚¬â€ sparkles in orange circle */}
              <button
                type="button"
                onClick={() => openWaktiAiFromHomescreen(homescreenWaktiDraft)}
                className="group flex flex-col items-center active:scale-95 transition-all"
                style={{ gap: `${modesButtonGap}px` }}
              >
                <span
                  className="flex items-center justify-center rounded-full transition-all"
                  style={{
                    width: `${modeBubbleHeight}px`,
                    height: `${modeBubbleHeight}px`,
                    background: "linear-gradient(135deg, #c2440a 0%, #f97316 60%, #fb923c 100%)",
                    boxShadow: "0 4px 16px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
                    border: "1.5px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <Sparkles className="text-white" style={{ width: `${modeIconSize}px`, height: `${modeIconSize}px` }} />
                </span>
                <span className="select-none whitespace-nowrap font-semibold leading-none text-foreground/70" style={{ fontSize: `${modeLabelSize}px` }}>
                  WAKTI AI
                </span>
              </button>
            </div>

            <div className="flex justify-center" style={{ marginTop: `${convosButtonMarginTop}px` }}>
              <button
                type="button"
                onClick={openHomescreenConversationsPopup}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-1.5 border px-3 shadow-sm transition-all active:scale-95",
                  isDark
                    ? "border-white/15 bg-white/8 text-white/88 hover:bg-white/12"
                    : "border-[#060541]/12 bg-white/85 text-[#060541] hover:bg-white"
                )}
                style={{
                  minHeight: `${convosButtonHeight}px`,
                  borderRadius: `${convosButtonRadius}px`,
                  fontSize: `${convosButtonFontSize}px`,
                }}
              >
                <MessageCircle style={{ width: `${convosButtonIconSize}px`, height: `${convosButtonIconSize}px` }} />
                <span className="font-semibold">{language === "ar" ? "Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª" : "Convos"}</span>
              </button>
            </div>
          </div>

          <section className={cn("self-start border-[1.5px]", cardShell)} style={{ ...widgetsSectionStyle, borderRadius: `${widgetsRadius}px`, paddingLeft: `${widgetsPaddingX}px`, paddingRight: `${widgetsPaddingX}px`, paddingTop: `${widgetsPaddingTop}px`, paddingBottom: `${widgetsPaddingBottom}px` }}>
            <Carousel opts={{ align: "start", direction: "ltr" }} className="w-full" dir="ltr">
              <CarouselContent className="sm:-ml-2">
                {visibleModernWidgetOrder.map((key) => (
                  <CarouselItem key={key} className="basis-full sm:basis-[88%] sm:pl-2 lg:basis-full">
                    <div style={{ height: `${widgetCardHeight}px` }}>
                      {modernWidgetCards[key]}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </section>
        </div>

        {/* WAKTI AI chat bar Ã¢â‚¬â€ functional */}
        <div style={{ marginTop: `${homescreenBarOffset}px` }}>
          <HomescreenChatBar
            language={language}
            isDark={isDark}
            cardShell={cardShell}
            navigate={navigate}
            triggerOpenModePicker={modePickerTrigger}
            onDraftChange={setHomescreenWaktiDraft}
            selectedConversationRowId={selectedHomescreenConversation?.rowId}
          />
        </div>

        {/* Productivity + System */}
        <div className="grid" style={{ gridTemplateColumns: `minmax(0, 1fr) ${systemRailWidth}px`, gap: `${middleRowGap}px` }}>
          <section className={cn("border-[1.5px]", cardShell)} style={{ ...productivitySectionStyle, borderRadius: `${sectionRadius}px`, paddingLeft: `${sectionPaddingX}px`, paddingRight: `${sectionPaddingX}px`, paddingTop: `${sectionPaddingY}px`, paddingBottom: `${sectionPaddingY}px` }}>
            <h3 className={cn(productivityTitleClass, "select-none")} style={{ marginBottom: `${productivityTitleMargin}px`, fontSize: `${productivityTitleSize}px` }}>
              {language === "ar" ? "Ø§Ù„Ø¥Ù†ØªØ§Ø¬ÙŠØ©" : "Productivity"}
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: `${productivityGridGap}px` }}>
              {PRODUCTIVITY_APPS.map((app) => (
                <AppCircle key={app.id} app={app} language={language} onClick={() => navigate(app.path)} size="compact" scale={layoutScale} />
              ))}
            </div>
          </section>
          <aside className={cn("relative border-[1.5px]", cardShell)} style={{ ...systemSectionStyle, borderRadius: `${sectionRadius}px`, paddingLeft: `${systemPaddingX}px`, paddingRight: `${systemPaddingX}px`, paddingTop: `${systemPaddingTop}px`, paddingBottom: `${systemPaddingTop}px` }}>
            {language === "ar" ? (
              <>
                <h3 className="select-none whitespace-nowrap text-center font-black leading-none tracking-tight text-foreground" style={{ marginBottom: `${systemTitleMargin}px`, fontSize: `${systemTitleSize}px` }}>
                  Ø§Ù„Ù†Ø¸Ø§Ù…
                </h3>
                <div className="flex flex-1 flex-col items-center justify-center" style={{ gap: `${systemGap}px` }}>
                  {SYSTEM_APPS.map((app) => (
                    <AppCircle key={app.id} app={app} language={language} onClick={() => navigate(app.path)} size="compact" scale={layoutScale} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-y-1.5 right-1 flex items-center justify-center">
                  <span className="select-none font-extrabold leading-none text-foreground/85 [text-orientation:upright] [writing-mode:vertical-rl]" style={{ fontSize: `${systemVerticalFontSize}px`, letterSpacing: `${systemVerticalLetterSpacing}px` }}>
                    SYSTEM
                  </span>
                </div>
                <div className="flex h-full flex-col items-center justify-center" style={{ gap: `${systemGap}px`, paddingRight: `${systemRightPadding}px` }}>
                  {SYSTEM_APPS.map((app) => (
                    <AppCircle key={app.id} app={app} language={language} onClick={() => navigate(app.path)} size="compact" scale={layoutScale} />
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>

        {/* Creation & Generation */}
        <section className={cn("mt-auto border-[1.5px]", cardShell)} style={{ ...creationSectionStyle, borderRadius: `${creationRadius}px`, paddingLeft: `${sectionPaddingX}px`, paddingRight: `${sectionPaddingX}px`, paddingTop: `${creationPaddingTop}px`, paddingBottom: `${creationPaddingBottom}px`, transform: `translateY(-${creationTranslateY}px)` }}>
          <h3 className={cn(creationTitleClass, "select-none")} style={{ marginBottom: `${creationTitleMargin}px`, fontSize: `${creationTitleSize}px` }}>
            {language === "ar" ? "Ø§Ù„Ø¥Ù†Ø´Ø§Ø¡ ÙˆØ§Ù„Ø¥Ù†ØªØ§Ø¬" : "Creation & Generation"}
          </h3>
          <div className="grid grid-cols-5 md:gap-2" style={{ gap: `${creationGridGap}px` }}>
            {CREATION_APPS.map((app) => (
              <AppCircle key={app.id} app={app} language={language} onClick={() => navigate(app.path)} size="compact" scale={layoutScale} />
            ))}
          </div>
        </section>

        <Dialog open={showHomescreenConversations} onOpenChange={setShowHomescreenConversations}>
          <DialogContent
            title={language === "ar" ? "Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª" : "Conversations"}
            description={language === "ar" ? "Ø§Ø®ØªØ± Ù…Ø­Ø§Ø¯Ø«Ø© Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù…Ù† Ø§Ù„Ø´Ø§Ø´Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©." : "Choose a conversation to continue from the home screen."}
            className={cn(
              "max-w-[370px] overflow-hidden rounded-[28px] border p-0 shadow-[0_16px_42px_rgba(0,0,0,0.28)]",
              isDark
                ? "border-white/10 bg-[#141925] text-white"
                : "border-[#060541]/10 bg-white text-[#060541]"
            )}
          >
            <div className={cn("border-b px-4 py-3.5", isDark ? "border-white/10 bg-white/[0.02]" : "border-[#060541]/10 bg-[#060541]/[0.015]") }>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-none">{language === "ar" ? "Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª" : "Convos"}</p>
                  <p className={cn("mt-1.5 text-sm", isDark ? "text-white/60" : "text-[#060541]/55")}>
                    {language === "ar" ? "Ø§Ø®ØªØ± Ù…Ø­Ø§Ø¯Ø«Ø© Ø£Ùˆ Ø§Ø¨Ø¯Ø£ Ù…Ù† Ø¬Ø¯ÙŠØ¯." : "Choose one or start fresh."}
                  </p>
                </div>
              </div>
            </div>

            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2 p-3">
                <button
                  type="button"
                  onClick={handleStartHomescreenNewChat}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                    isDark
                      ? "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
                      : "border-[#060541]/10 bg-[#060541]/[0.02] hover:bg-[#060541]/[0.05]",
                    !selectedHomescreenConversation && (isDark ? "border-blue-400/45 bg-blue-500/10" : "border-blue-300 bg-blue-50")
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-base font-semibold", isDark ? "text-white/95" : "text-[#060541]")}>
                        {language === "ar" ? "Ù…Ø­Ø§Ø¯Ø«Ø© Ø¬Ø¯ÙŠØ¯Ø©" : "New Chat"}
                      </p>
                      <p className={cn("mt-1 text-sm", isDark ? "text-white/60" : "text-[#060541]/60")}>
                        {language === "ar" ? "Ø§Ø¨Ø¯Ø£ Ø¨Ø¯ÙˆÙ† Ø§Ø®ØªÙŠØ§Ø± Ù…Ø­Ø§Ø¯Ø«Ø© Ø³Ø§Ø¨Ù‚Ø©" : "Start without selecting an old conversation"}
                      </p>
                    </div>
                    {!selectedHomescreenConversation ? (
                      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", isDark ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600")}>
                        <Check className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", isDark ? "border-white/10 text-white/70" : "border-[#060541]/10 text-[#060541]/65")}>
                        <Plus className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </button>

                {homescreenConversationsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{language === "ar" ? "Ø¬Ø§Ø±Ù Ø§Ù„ØªØ­Ù…ÙŠÙ„..." : "Loading..."}</span>
                  </div>
                ) : homescreenConversationsError ? (
                  <div className={cn("rounded-2xl border px-3 py-4 text-sm", isDark ? "border-red-400/20 bg-red-500/10 text-red-100" : "border-red-200 bg-red-50 text-red-600")}>
                    {homescreenConversationsError}
                  </div>
                ) : homescreenConversations.length === 0 ? (
                  <div className={cn("rounded-2xl border px-3 py-6 text-center text-sm", isDark ? "border-white/10 bg-white/5 text-white/70" : "border-[#060541]/10 bg-[#060541]/[0.03] text-[#060541]/70")}>
                    {language === "ar" ? "Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø­Ø§Ø¯Ø«Ø§Øª Ù…Ø­ÙÙˆØ¸Ø© Ø¨Ø¹Ø¯." : "No saved conversations yet."}
                  </div>
                ) : (
                  homescreenConversations.map((conversation) => {
                    const isSelected = selectedHomescreenConversation?.rowId === conversation.id;
                    return (
                      <div
                        key={conversation.id}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition-all duration-200",
                          isDark
                            ? "border-white/10 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]"
                            : "border-[#060541]/10 bg-[#060541]/[0.025] hover:bg-[#060541]/[0.05]",
                          isSelected && (isDark ? "border-blue-400/45 bg-blue-500/10" : "border-blue-300 bg-blue-50")
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => { void handleSelectHomescreenConversation(conversation); }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-base font-semibold", isDark ? "text-white/95" : "text-[#060541]")}>
                              {conversation.title}
                            </p>
                            <p className={cn("mt-1 text-sm", isDark ? "text-white/60" : "text-[#060541]/60")}>
                              {conversation.message_count ?? 0} {language === "ar" ? "Ø±Ø³Ø§Ù„Ø©" : "msgs"}
                            </p>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          {isSelected ? (
                            <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", isDark ? "bg-blue-400/15 text-blue-300" : "bg-blue-100 text-blue-600")}>
                              <Check className="h-4 w-4" />
                            </div>
                          ) : conversation.is_active ? (
                            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold", isDark ? "bg-white/10 text-white/70" : "bg-[#060541]/6 text-[#060541]/70")}>
                              {language === "ar" ? "Ø§Ù„Ø­Ø§Ù„ÙŠØ©" : "Current"}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => { void handleDeleteHomescreenConversation(conversation); }}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full border transition-all active:scale-95",
                              isDark
                                ? "border-white/10 bg-white/[0.03] text-white/75 hover:bg-red-500/12 hover:text-red-200"
                                : "border-[#060541]/10 bg-white text-[#060541]/60 hover:bg-red-50 hover:text-red-600"
                            )}
                            aria-label={language === "ar" ? "Ø­Ø°Ù Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø©" : "Delete conversation"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

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

