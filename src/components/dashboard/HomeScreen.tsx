// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  CalendarClock,
  Mic,
  Sparkles,
  ListTodo,
  LayoutDashboard,
  PenTool,
  Gamepad2,
  NotebookPen,
  Aperture,
  AudioLines,
  FolderOpen,
  Code2,
  ImageIcon,
  X,
  Check,
  Settings2,
  Pencil,
  GripVertical,
  CheckSquare,
  Clock,
  BookOpen,
  Activity,
  Navigation,
  CalendarDays,
} from "lucide-react";
import { WaktiIcon } from "@/components/icons/WaktiIcon";
import { getQuoteForDisplay, getQuoteText, getQuoteAuthor } from "@/utils/quoteService";
import { useOptimizedTRData } from "@/hooks/useOptimizedTRData";
import { useOptimizedMaw3dEvents } from "@/hooks/useOptimizedMaw3dEvents";

// ─── App definitions ──────────────────────────────────────────────────────────
const ALL_APPS = [
  { id: "calendar",  nameEn: "Calendar",  nameAr: "التقويم",   path: "/calendar",           icon: Calendar,        gradient: "from-sky-400/70 to-sky-600/70",         glow: "#38bdf8" },
  { id: "journal",   nameEn: "Journal",   nameAr: "المذكرات",  path: "/journal",            icon: NotebookPen,     gradient: "from-pink-500/70 to-rose-600/70",       glow: "#ec4899" },
  { id: "maw3d",     nameEn: "Maw3d",     nameAr: "مواعيد",   path: "/maw3d",              icon: CalendarClock,   gradient: "from-purple-500/70 to-purple-700/70",   glow: "#a855f7" },
  { id: "tr",        nameEn: "T & R",     nameAr: "م & ت",    path: "/tr",                 icon: ListTodo,        gradient: "from-green-500/70 to-emerald-600/70",   glow: "#22c55e" },
  { id: "wakti-ai",  nameEn: "WAKTI AI",  nameAr: "WAKTI AI", path: "/wakti-ai",           icon: Sparkles,        gradient: "from-orange-500/70 to-amber-400/70",    glow: "#f97316" },
  { id: "studio",    nameEn: "Studio",    nameAr: "الاستوديو", path: "/music",              icon: Aperture,        gradient: "from-fuchsia-500/70 to-violet-600/70",  glow: "#d946ef" },
  { id: "vitality",  nameEn: "Vitality",  nameAr: "الحيوية",  path: "/fitness",            icon: null,            gradient: "from-rose-500/70 to-red-600/70",        glow: "#f43f5e", isWaktiIcon: true },
  { id: "tasjeel",   nameEn: "Tasjeel",   nameAr: "تسجيل",    path: "/tasjeel",            icon: AudioLines,      gradient: "from-cyan-400/70 to-cyan-600/70",       glow: "#06b6d4" },
  { id: "warranty",  nameEn: "My Files",  nameAr: "ملفاتي",   path: "/my-warranty",        icon: FolderOpen,      gradient: "from-emerald-400/70 to-emerald-600/70", glow: "#10b981" },
  { id: "projects",  nameEn: "Projects",  nameAr: "مشاريع",   path: "/projects",           icon: Code2,           gradient: "from-indigo-500/70 to-indigo-700/70",   glow: "#6366f1" },
  { id: "text",      nameEn: "Text",      nameAr: "نص",       path: "/tools/text",         icon: PenTool,         gradient: "from-violet-500/70 to-violet-700/70",   glow: "#8b5cf6" },
  { id: "voice",     nameEn: "Voice",     nameAr: "صوت",      path: "/tools/voice-studio", icon: Mic,             gradient: "from-pink-400/70 to-pink-600/70",       glow: "#f472b6" },
  { id: "game",      nameEn: "Game",      nameAr: "لعبة",     path: "/tools/game",         icon: Gamepad2,        gradient: "from-red-500/70 to-red-700/70",         glow: "#ef4444" },
];

const DEFAULT_ORDER = ALL_APPS.map(a => a.id);
const DEFAULT_DOCK  = ["wakti-ai", "calendar", "tr"];
const LS_ORDER_KEY  = "homescreen_icon_order_v2"; // v2 — forces clean slate
const LS_DOCK_KEY   = "homescreen_dock_v2";
const LS_QUOTE_KEY  = "homescreen_show_quote";
const LS_BG_KEY     = "homescreen_bg";
const LS_HEADER_COLOR_KEY = "homescreen_header_color";
const LS_UNIFIED_KEY = "homescreen_unified_grid_v6";

// Widget IDs used in the unified grid
const WIDGET_IDS = ['showTRWidget','showCalendarWidget','showMaw3dWidget','showWhoopWidget','showJournalWidget','showQuoteWidget'] as const;
type WidgetId = typeof WIDGET_IDS[number];
const MAX_WIDGETS = 3;

// ── Strict Hardcoded Grid Layout using grid-template-areas ──
// 3 big rows x 2 big cols = 24 cells.
// Widgets are 2x2. Icons are 1x1.
// We map these strictly to 14 DOM elements (3 widgets, 11 icons max).
const GRID_TEMPLATE_AREAS = `
  "w1 w1 i1 i2"
  "w1 w1 i3 i4"
  "i5 i6 w2 w2"
  "i7 i8 w2 w2"
  "w3 w3 i9 i10"
  "w3 w3 i11 i12"
`;

// Calculate explicit grid positions ("parking spots") for each item as area strings
// Handles widget::, app::, and empty:: items
function calcGridPositions(items: string[]) {
  const positions = new Map<string, string>();
  let wIndex = 1;
  let iIndex = 1;
  
  for (const id of items) {
    if (id.startsWith('widget::') || id.startsWith('empty-w::')) {
      if (wIndex <= 3) {
        positions.set(id, `w${wIndex}`);
        wIndex++;
      }
    } else {
      if (iIndex <= 12) {
        positions.set(id, `i${iIndex}`);
        iIndex++;
      }
    }
  }
  return positions;
}

// Build default unified grid: flat list of widgets and apps
function buildDefaultUnifiedGrid(hsWidgets: Record<string, boolean>, dockApps: string[] = DEFAULT_DOCK): string[] {
  const widgets = WIDGET_IDS.filter(k => hsWidgets[k]).map(k => `widget::${k}`).slice(0, MAX_WIDGETS);
  const dockSet = new Set(dockApps);
  const apps = DEFAULT_ORDER.filter(id => !dockSet.has(id)).map(id => `app::${id}`);
  return [...widgets, ...apps];
}

const VALID_IDS = new Set(ALL_APPS.map(a => a.id));

/** Ensure order contains all valid unique app IDs (dock IDs included — filtered at render) */
function sanitizeOrder(raw: string[]): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const id of raw) {
    if (VALID_IDS.has(id) && !seen.has(id)) { seen.add(id); valid.push(id); }
  }
  for (const app of ALL_APPS) {
    if (!seen.has(app.id)) { seen.add(app.id); valid.push(app.id); }
  }
  return valid;
}

function sanitizeDock(raw: string[]): string[] {
  const seen = new Set<string>();
  const valid = raw.filter(id => VALID_IDS.has(id) && !seen.has(id) && (seen.add(id), true)).slice(0, 3);
  // Always pad to exactly 3 slots using defaults
  if (valid.length < 3) {
    for (const def of DEFAULT_DOCK) {
      if (valid.length >= 3) break;
      if (!valid.includes(def)) valid.push(def);
    }
  }
  return valid;
}

// ─── Liquid-glass icon shell ───────────────────────────────────────────────────
// The shimmer highlight on the top edge + soft inner glow gives real iOS 26 "liquid glass"
function LiquidIcon({ app, size = 64, editMode, glowEnabled = false }: {
  app: typeof ALL_APPS[0];
  size?: number;
  editMode: boolean;
  glowEnabled?: boolean;
}) {
  const px = `${size}px`;
  return (
    <div
      className={`relative flex-shrink-0 ${editMode ? "animate-wiggle" : ""}`}
      style={{ width: px, height: px }}
    >
      {/* Main gradient body with iOS-style frosted glass */}
      <div
        className={`absolute inset-0 rounded-[23%] bg-gradient-to-br ${app.gradient}`}
        style={{
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: glowEnabled
            ? `0 0 18px ${app.glow}cc, 0 4px 16px ${app.glow}66, 0 1px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`
            : `0 4px 16px ${app.glow}55, 0 1px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`,
        }}
      />
      {/* Liquid glass highlight */}
      <div
        className="absolute rounded-[23%] pointer-events-none"
        style={{
          inset: 0,
          background: "linear-gradient(145deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)",
        }}
      />
      {/* Icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        {app.isWaktiIcon
          ? <WaktiIcon style={{ width: size * 0.5, height: size * 0.5, color: "#fff" }} />
          : app.icon && <app.icon style={{ width: size * 0.5, height: size * 0.5, color: "#fff" }} strokeWidth={1.8} />
        }
      </div>
      {/* Edit badge */}
      {editMode && (
        <div className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-black/80 border border-white/40 flex items-center justify-center shadow">
          <GripVertical className="w-3 h-3 text-white/80" />
        </div>
      )}
    </div>
  );
}

// ─── Sortable grid icon ────────────────────────────────────────────────────────
function GridIcon({ app, language, editMode, onTap, isDark, glowEnabled = false }: {
  app: typeof ALL_APPS[0];
  language: string;
  editMode: boolean;
  onTap: () => void;
  isDark: boolean;
  glowEnabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `grid::${app.id}`,
    data: { type: "grid", appId: app.id },
  });
  const name = language === "ar" ? app.nameAr : app.nameEn;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
      className="flex flex-col items-center gap-1.5 select-none cursor-pointer"
      onClick={editMode ? undefined : onTap}
    >
      <LiquidIcon app={app} size={64} editMode={editMode} glowEnabled={glowEnabled} />
      <span
        className="text-[11px] font-semibold text-center leading-tight"
        style={{
          color: isDark ? "#fff" : "#060541",
          textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.6)" : "none",
          maxWidth: 72,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
        }}
      >
        {name}
      </span>
    </div>
  );
}

// ─── Sortable dock icon ────────────────────────────────────────────────────────
function DockIcon({ app, editMode, onTap, glowEnabled = false }: {
  app: typeof ALL_APPS[0];
  editMode: boolean;
  onTap: () => void;
  glowEnabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `dock::${app.id}`,
    data: { type: "dock", appId: app.id },
    disabled: !editMode,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        touchAction: "none",
      }}
      {...attributes}
      {...(editMode ? listeners : {})}
      className="flex flex-col items-center select-none cursor-pointer"
      onClick={editMode ? undefined : onTap}
    >
      <LiquidIcon app={app} size={58} editMode={editMode} glowEnabled={glowEnabled} />
    </div>
  );
}

// ─── Stat widget cards (stable — defined outside HomeScreen to prevent flicker) ─
interface StatWidgetsProps {
  hsWidgets: Record<string, boolean>;
  language: string;
  theme: string;
  hasBg: boolean;
  pendingTasks: number;
  completedToday: number;
  upcomingCount: number;
  statCardBase: string;
  statLblColor: string;
  navigate: (path: string) => void;
}

function StatWidgets({ hsWidgets, language, theme, hasBg, pendingTasks, completedToday, upcomingCount, statCardBase, statLblColor, navigate }: StatWidgetsProps) {
  const isDark = theme === 'dark';
  const now = new Date();
  const dayNum     = now.getDate();
  const dayLong    = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' });
  const dayShort   = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' });
  const monthShort = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' });

  const total = pendingTasks + completedToday;
  const pct   = total > 0 ? Math.round((completedToday / total) * 100) : 0;

  // ── Dynamic color helpers ──
  // Tasks: green = great progress (≥70% done), amber = some done (≥30%), red = mostly pending
  const taskAccent = pct >= 70 ? '#22c55e' : pct >= 30 ? '#f59e0b' : pendingTasks === 0 ? '#22c55e' : '#ef4444';
  const taskIconBg = pct >= 70 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : pct >= 30 ? 'linear-gradient(135deg,#b45309,#f59e0b)' : pendingTasks === 0 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#be123c,#ef4444)';
  const taskSubMsg = pendingTasks === 0
    ? (language === 'ar' ? '✅ كل شيء تم!' : '✅ All done!')
    : pct >= 70
      ? (language === 'ar' ? `${pct}% مكتمل 🔥` : `${pct}% done 🔥`)
      : pct >= 30
        ? (language === 'ar' ? `${pct}% مكتمل` : `${pct}% done`)
        : (language === 'ar' ? `${pendingTasks} معلّقة` : `${pendingTasks} pending`);

  // Events/Maw3d: 0 = gray (clear), 1-3 = green (manageable), 4+ = amber (busy)
  const eventsAccent = upcomingCount === 0 ? '#6b7280' : upcomingCount <= 3 ? '#22c55e' : '#f59e0b';
  const eventsSubMsg = upcomingCount === 0
    ? (language === 'ar' ? 'لا أحداث' : 'Clear')
    : upcomingCount <= 3
      ? `+${upcomingCount} ${language === 'ar' ? 'حدث' : upcomingCount === 1 ? 'event' : 'events'}`
      : `+${upcomingCount} ${language === 'ar' ? 'أحداث' : 'events'} 🔥`;

  const maw3dAccent = upcomingCount === 0 ? '#6b7280' : upcomingCount <= 2 ? '#22c55e' : '#f59e0b';
  const maw3dIconBg = upcomingCount === 0 ? 'linear-gradient(135deg,#374151,#6b7280)' : upcomingCount <= 2 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#b45309,#f59e0b)';

  const labelColor  = isDark || hasBg ? '#ffffff' : '#060541';
  const subColor    = statLblColor;
  const base        = `${statCardBase} rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-transform select-none`;

  const KEYS = ['showTRWidget','showCalendarWidget','showMaw3dWidget','showWhoopWidget','showJournalWidget','showQuoteWidget'];
  const visible = KEYS.filter(k => hsWidgets[k]);
  if (visible.length === 0) return null;

  return (
    <div
      className="flex-none grid gap-2 px-5 pt-3 mb-3"
      style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}
    >
      {visible.includes('showTRWidget') && (
        <div className={base} onClick={() => navigate('/tr')}>
          <div className="p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: taskIconBg }}>
                <CheckSquare className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-black tabular-nums" style={{ color: taskAccent }}>{pendingTasks === 0 ? '✓' : pendingTasks}</span>
            </div>
            <div>
              <p className="text-[11px] font-bold leading-none" style={{ color: labelColor }}>{language === 'ar' ? 'المهام' : 'Tasks'}</p>
              <p className="text-[9px] mt-0.5 font-semibold" style={{ color: taskAccent }}>{taskSubMsg}</p>
            </div>
          </div>
        </div>
      )}

      {visible.includes('showCalendarWidget') && (
        <div className={base} onClick={() => navigate('/calendar')}
          style={{ background: hasBg ? 'rgba(168,85,247,0.25)' : isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.4)' }}>
          <div className="flex flex-col">
            <div className="px-2.5 py-1.5" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
              <p className="text-[9px] font-bold text-white uppercase tracking-widest">{monthShort}</p>
            </div>
            <div className="px-2.5 pt-1 pb-2.5">
              <span className="text-xl font-black leading-tight block tabular-nums" style={{ color: '#a855f7' }}>{dayNum}</span>
              <p className="text-[9px] font-medium" style={{ color: subColor }}>{dayShort}</p>
              <p className="text-[9px] font-semibold mt-0.5" style={{ color: eventsAccent }}>{eventsSubMsg}</p>
            </div>
          </div>
        </div>
      )}

      {visible.includes('showMaw3dWidget') && (
        <div className={base} onClick={() => navigate('/maw3d')}>
          <div className="p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: maw3dIconBg }}>
                <Clock className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-black tabular-nums" style={{ color: maw3dAccent }}>{upcomingCount === 0 ? '—' : upcomingCount}</span>
            </div>
            <div>
              <p className="text-[11px] font-bold leading-none" style={{ color: labelColor }}>{language === 'ar' ? 'مواعيد' : 'Maw3d'}</p>
              <p className="text-[9px] mt-0.5 font-semibold" style={{ color: maw3dAccent }}>
                {upcomingCount === 0 ? (language === 'ar' ? 'لا مواعيد' : 'Clear') : upcomingCount <= 2 ? (language === 'ar' ? 'مجدولة ✓' : 'scheduled ✓') : (language === 'ar' ? 'مشغول 🔥' : 'busy 🔥')}
              </p>
            </div>
          </div>
        </div>
      )}

      {visible.includes('showNavWidget') && (
        <div className={base} onClick={() => navigate('/dashboard')}
          style={{ background: hasBg ? 'rgba(56,189,248,0.2)' : isDark ? 'rgba(56,189,248,0.12)' : 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.35)' }}>
          <div className="flex flex-col">
            <div className="px-2.5 py-1.5" style={{ background: 'linear-gradient(135deg,#0369a1,#38bdf8)' }}>
              <p className="text-[9px] font-bold text-white uppercase tracking-widest">{language === 'ar' ? 'اليوم' : 'Today'}</p>
            </div>
            <div className="px-2.5 pt-1 pb-2">
              <span className="text-xl font-black leading-tight block tabular-nums" style={{ color: '#38bdf8' }}>{dayNum}</span>
              <p className="text-[9px] leading-tight" style={{ color: subColor }}>{dayLong}</p>
            </div>
          </div>
        </div>
      )}

      {visible.includes('showWhoopWidget') && (
        <div className={base} onClick={() => navigate('/fitness')}>
          <div className="p-2.5 flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#be123c,#ef4444)' }}>
              <Activity className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] font-bold leading-none" style={{ color: labelColor }}>WHOOP</p>
              <p className="text-[9px] font-semibold mt-0.5" style={{ color: '#ef4444' }}>{language === 'ar' ? 'عرض ←' : 'View →'}</p>
            </div>
          </div>
        </div>
      )}

      {visible.includes('showJournalWidget') && (
        <div className={base} onClick={() => navigate('/journal')}
          style={{ background: hasBg ? 'rgba(139,92,246,0.2)' : isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.35)' }}>
          <div className="p-2.5 flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6d28d9,#8b5cf6)' }}>
              <BookOpen className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[11px] font-bold leading-none" style={{ color: labelColor }}>{language === 'ar' ? 'يومياتي' : 'Journal'}</p>
              <p className="text-[9px] font-semibold mt-0.5" style={{ color: '#8b5cf6' }}>{language === 'ar' ? '✍️ اكتب اليوم' : '✍️ Write today'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Widget content renderer (no drag logic, just visuals) ────────────────────
function WidgetContent({ wKey, editMode, language, theme, hasBg, statCardBase, pendingTasks, completedToday, upcomingCount, navigate, quoteText, quoteAuthor }: {
  wKey: WidgetId; editMode: boolean; language: string; theme: string;
  hasBg: boolean; statCardBase: string;
  pendingTasks: number; completedToday: number; upcomingCount: number;
  navigate: (p: string) => void;
  quoteText?: string; quoteAuthor?: string;
}) {
  const isDark = theme === 'dark';
  const total = pendingTasks + completedToday;
  const pct   = total > 0 ? Math.round((completedToday / total) * 100) : 0;
  const taskAccent  = pct >= 70 ? '#22c55e' : pct >= 30 ? '#f59e0b' : pendingTasks === 0 ? '#22c55e' : '#ef4444';
  const taskIconBg  = pct >= 70 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : pct >= 30 ? 'linear-gradient(135deg,#b45309,#f59e0b)' : pendingTasks === 0 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#be123c,#ef4444)';
  const taskMsg     = pendingTasks === 0 ? (language === 'ar' ? '✅ كل شيء تم!' : '✅ All done!') : pct >= 70 ? (language === 'ar' ? `${pct}% مكتمل 🔥` : `${pct}% done 🔥`) : pct >= 30 ? (language === 'ar' ? `${pct}% مكتمل` : `${pct}% done`) : (language === 'ar' ? `${pendingTasks} معلّقة` : `${pendingTasks} pending`);
  const evAccent    = upcomingCount === 0 ? '#6b7280' : upcomingCount <= 3 ? '#22c55e' : '#f59e0b';
  const evMsg       = upcomingCount === 0 ? (language === 'ar' ? 'لا أحداث' : 'Clear') : upcomingCount <= 3 ? `+${upcomingCount} ${language === 'ar' ? 'حدث' : upcomingCount === 1 ? 'event' : 'events'}` : `+${upcomingCount} ${language === 'ar' ? 'أحداث' : 'events'} 🔥`;
  const maw3dAccent = upcomingCount === 0 ? '#6b7280' : upcomingCount <= 2 ? '#22c55e' : '#f59e0b';
  const maw3dBg     = upcomingCount === 0 ? 'linear-gradient(135deg,#374151,#6b7280)' : upcomingCount <= 2 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#b45309,#f59e0b)';
  const labelColor  = isDark || hasBg ? '#ffffff' : '#060541';
  const now         = new Date();
  const dayNum      = now.getDate();
  const dayShort    = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' });
  const dayLong     = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' });
  const monthShort  = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' });
  // Shared widget shell: full-bleed gradient background, rounded corners, glow
  const shell = (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => (
    <div
      onClick={editMode ? undefined : onClick}
      className="rounded-3xl overflow-hidden w-full h-full cursor-pointer active:scale-95 transition-all select-none relative"
      style={{
        background: bg,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: `0 4px 24px ${glow}55, 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
      }}
    >
      {/* Glass shimmer overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 50%, transparent 100%)' }} />
      {children}
    </div>
  );

  if (wKey === 'showTRWidget') return shell(
    taskAccent === '#22c55e'
      ? 'linear-gradient(145deg,rgba(6,78,59,0.7) 0%,rgba(6,95,70,0.7) 40%,rgba(4,120,87,0.7) 100%)'
      : taskAccent === '#f59e0b'
      ? 'linear-gradient(145deg,rgba(120,53,15,0.7) 0%,rgba(146,64,14,0.7) 40%,rgba(180,83,9,0.7) 100%)'
      : 'linear-gradient(145deg,rgba(127,29,29,0.7) 0%,rgba(153,27,27,0.7) 40%,rgba(185,28,28,0.7) 100%)',
    taskAccent,
    () => navigate('/tr'),
    <div className="p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
          <CheckSquare className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <div className="text-right">
          <span className="text-4xl font-black tabular-nums text-white leading-none" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{pendingTasks === 0 ? '✓' : pendingTasks}</span>
          <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">{language === 'ar' ? 'معلّقة' : 'pending'}</p>
        </div>
      </div>
      {/* Progress bar */}
      <div>
        <div className="w-full h-1.5 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: 'rgba(255,255,255,0.85)' }} />
        </div>
        <p className="text-[15px] font-black text-white leading-tight">{language === 'ar' ? 'المهام' : 'Tasks'}</p>
        <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{taskMsg}</p>
      </div>
    </div>
  );

  if (wKey === 'showCalendarWidget') return shell(
    'linear-gradient(145deg,rgba(59,7,100,0.7) 0%,rgba(88,28,135,0.7) 40%,rgba(126,34,206,0.7) 100%)',
    '#a855f7',
    () => navigate('/calendar'),
    <div className="p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
          <CalendarDays className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{monthShort}</p>
          <span className="text-4xl font-black text-white leading-none tabular-nums">{dayNum}</span>
        </div>
      </div>
      <div>
        <p className="text-[15px] font-black text-white leading-tight">{dayLong}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-2 h-2 rounded-full" style={{ background: evAccent === '#6b7280' ? 'rgba(255,255,255,0.3)' : evAccent }} />
          <p className="text-[11px] font-semibold" style={{ color: evAccent === '#6b7280' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)' }}>{evMsg}</p>
        </div>
      </div>
    </div>
  );

  if (wKey === 'showMaw3dWidget') return shell(
    maw3dAccent === '#22c55e'
      ? 'linear-gradient(145deg,rgba(6,78,59,0.7) 0%,rgba(6,95,70,0.7) 40%,rgba(4,120,87,0.7) 100%)'
      : maw3dAccent === '#f59e0b'
      ? 'linear-gradient(145deg,rgba(120,53,15,0.7) 0%,rgba(146,64,14,0.7) 40%,rgba(180,83,9,0.7) 100%)'
      : 'linear-gradient(145deg,rgba(30,27,75,0.7) 0%,rgba(49,46,129,0.7) 40%,rgba(67,56,202,0.7) 100%)',
    maw3dAccent,
    () => navigate('/maw3d'),
    <div className="p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
          <Clock className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <div className="text-right">
          <span className="text-4xl font-black tabular-nums text-white leading-none">{upcomingCount === 0 ? '0' : upcomingCount}</span>
          <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">{language === 'ar' ? 'مواعيد' : 'events'}</p>
        </div>
      </div>
      {/* Mini event dots */}
      <div>
        <div className="flex gap-1 mb-2">
          {Array.from({ length: Math.min(upcomingCount, 5) }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ background: maw3dAccent === '#6b7280' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)' }} />
          ))}
          {upcomingCount === 0 && <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />}
        </div>
        <p className="text-[15px] font-black text-white leading-tight">{language === 'ar' ? 'مواعيد' : 'Maw3d'}</p>
        <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{upcomingCount === 0 ? (language === 'ar' ? 'لا مواعيد 📭' : 'All clear 📭') : upcomingCount <= 2 ? (language === 'ar' ? 'مجدولة ✓' : 'scheduled ✓') : (language === 'ar' ? 'مشغول 🔥' : 'busy 🔥')}</p>
      </div>
    </div>
  );

  if (wKey === 'showNavWidget') return shell(
    'linear-gradient(145deg,rgba(12,74,110,0.7) 0%,rgba(7,89,133,0.7) 40%,rgba(2,132,199,0.7) 100%)',
    '#38bdf8',
    () => navigate('/dashboard'),
    <div className="p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
          <CalendarDays className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{monthShort}</p>
          <span className="text-4xl font-black text-white leading-none tabular-nums">{dayNum}</span>
        </div>
      </div>
      <div>
        <p className="text-[15px] font-black text-white leading-tight">{dayLong}</p>
        <p className="text-[11px] font-semibold mt-0.5 text-white/60">{language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</p>
      </div>
    </div>
  );

  if (wKey === 'showWhoopWidget') return shell(
    'rgba(0,0,0,0.7)',
    '#ef4444',
    () => navigate('/fitness'),
    <div className="p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
          <Activity className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <span className="text-4xl font-black text-white leading-none">♥</span>
      </div>
      {/* Animated EKG-style bar */}
      <div>
        <div className="flex items-end gap-0.5 mb-2 h-6">
          {[3,5,2,7,4,8,3,6,2,5,3,4].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${h * 10}%`, background: i === 7 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
        <p className="text-[15px] font-black text-white leading-tight">WHOOP</p>
        <p className="text-[11px] font-semibold mt-0.5 text-white/70">{language === 'ar' ? 'الحيوية والنشاط' : 'Vitality & fitness'}</p>
      </div>
    </div>
  );

  if (wKey === 'showJournalWidget') return shell(
    'rgba(0,0,0,0.7)',
    '#8b5cf6',
    () => navigate('/journal'),
    <div className="p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
          <BookOpen className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <span className="text-3xl leading-none">✍️</span>
      </div>
      {/* 7-day streak dots */}
      <div>
        <div className="flex gap-1 mb-2">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className="w-4 h-4 rounded-full" style={{ background: i < new Date().getDay() ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)' }} />
              <span className="text-[7px] text-white/40">{d}</span>
            </div>
          ))}
        </div>
        <p className="text-[15px] font-black text-white leading-tight">{language === 'ar' ? 'يومياتي' : 'Journal'}</p>
        <p className="text-[11px] font-semibold mt-0.5 text-white/70">{language === 'ar' ? 'سجّل يومك' : 'Write today'}</p>
      </div>
    </div>
  );

  if (wKey === 'showQuoteWidget') return shell(
    'linear-gradient(145deg,rgba(15,23,42,0.7) 0%,rgba(30,41,59,0.7) 40%,rgba(51,65,85,0.7) 100%)',
    '#94a3b8',
    () => {},
    <div className="p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
          <span className="text-xl">💬</span>
        </div>
        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest pt-1">{language === 'ar' ? 'اقتباس' : 'Quote'}</span>
      </div>
      <div>
        <p className="text-[11px] italic leading-snug text-white/90 line-clamp-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {quoteText ? `"${quoteText}"` : '...'}
        </p>
        {quoteAuthor && <p className="text-[10px] mt-1 text-white/45 font-medium">— {quoteAuthor}</p>}
      </div>
    </div>
  );

  return null;
}

// ─── Sortable widget cell ────────────────────────────────────────────────────
interface UnifiedWidgetCellProps {
  id: string; wKey: WidgetId; editMode: boolean; language: string; theme: string;
  hasBg: boolean; statCardBase: string; statLblColor: string;
  pendingTasks: number; completedToday: number; upcomingCount: number;
  navigate: (p: string) => void;
  gridArea: string;
  quoteText?: string; quoteAuthor?: string;
}
function UnifiedWidgetCell({ id, wKey, editMode, language, theme, hasBg, statCardBase, statLblColor, pendingTasks, completedToday, upcomingCount, navigate, gridArea, quoteText, quoteAuthor }: UnifiedWidgetCellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id, data: { type: 'unified' },
  });
  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={{
        gridArea,
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: isDragging ? transition : undefined,
        opacity: isDragging ? 0.35 : 1,
        touchAction: 'none',
        zIndex: isDragging ? 50 : 'auto',
      }}
      {...attributes}
      {...listeners}
    >
      <WidgetContent
        wKey={wKey} editMode={editMode} language={language} theme={theme}
        hasBg={hasBg} statCardBase={statCardBase}
        pendingTasks={pendingTasks} completedToday={completedToday}
        upcomingCount={upcomingCount} navigate={navigate}
        quoteText={quoteText} quoteAuthor={quoteAuthor}
      />
      {editMode && (
        <div className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-black/70 border border-white/30 flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-white/80" />
        </div>
      )}
    </div>
  );
}

// ─── Sortable app cell ──────────────────────────────────────────────────────
interface UnifiedAppCellProps {
  id: string; app: typeof ALL_APPS[0]; editMode: boolean;
  language: string; isDark: boolean; glowEnabled: boolean;
  navigate: (p: string) => void;
  gridArea: string;
}
function UnifiedAppCell({ id, app, editMode, language, isDark, glowEnabled, navigate, gridArea }: UnifiedAppCellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id, data: { type: 'unified' },
  });
  const name = language === 'ar' ? app.nameAr : app.nameEn;
  return (
    <div
      ref={setNodeRef}
      className="flex flex-col items-center justify-center gap-0.5 select-none cursor-pointer relative"
      style={{
        gridArea,
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: isDragging ? transition : undefined,
        opacity: isDragging ? 0.25 : 1,
        touchAction: 'none',
        zIndex: isDragging ? 50 : 'auto',
      }}
      {...attributes}
      {...listeners}
      onClick={editMode ? undefined : () => navigate(app.path)}
    >
      <LiquidIcon app={app} size={60} editMode={editMode} glowEnabled={glowEnabled} />
      <span
        className="text-[11px] font-semibold text-center leading-tight mt-1.5"
        style={{ color: isDark ? '#fff' : '#060541', textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.95)' : 'none', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
      >
        {name}
      </span>
    </div>
  );
}

// ─── Empty slot (sortable target in edit mode) ─────────────────────────────
function EmptySlotCell({ id, gridArea, isWidget, editMode }: { id: string; gridArea: string; isWidget: boolean; editMode: boolean }) {
  const { setNodeRef, isOver } = useSortable({ id, data: { type: 'unified' } });
  return (
    <div
      ref={setNodeRef}
      style={{ gridArea }}
      className={`${isWidget ? 'rounded-3xl' : 'rounded-2xl'} transition-colors ${
        isOver ? 'bg-white/20 border-2 border-white/60' : ''
      } ${editMode ? '' : 'pointer-events-none'}`}
    />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
interface HomeScreenProps { displayName: string }

export function HomeScreen({ displayName }: HomeScreenProps) {
  const { language, theme } = useTheme();
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [editMode,        setEditMode]        = useState(false);
  const [dockIds,         setDockIds]         = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_DOCK_KEY) || "null");
      return Array.isArray(raw) ? sanitizeDock(raw) : sanitizeDock(DEFAULT_DOCK);
    } catch { return sanitizeDock(DEFAULT_DOCK); }
  });
  const [iconOrder,       setIconOrder]       = useState<string[]>(() => {
    try {
      const dock = (() => {
        try {
          const raw = JSON.parse(localStorage.getItem(LS_DOCK_KEY) || "null");
          return Array.isArray(raw) ? sanitizeDock(raw) : DEFAULT_DOCK;
        } catch { return DEFAULT_DOCK; }
      })();
      const raw = JSON.parse(localStorage.getItem(LS_ORDER_KEY) || "null");
      return sanitizeOrder(Array.isArray(raw) ? raw : DEFAULT_ORDER);
    } catch { return sanitizeOrder(DEFAULT_ORDER); }
  });
  const [showQuote,       setShowQuote]       = useState<boolean>(() => localStorage.getItem(LS_QUOTE_KEY) !== "false");
  const [bgImage,         setBgImage]         = useState<string>(() => localStorage.getItem(LS_BG_KEY) || "");
  const [headerColor,     setHeaderColor]     = useState<string>(() => localStorage.getItem(LS_HEADER_COLOR_KEY) || "");

  // Homescreen background style from Settings
  const [hsBg, setHsBg] = useState<{ mode: 'solid'|'gradient'; color1: string; color2: string; color3: string; angle: number; glow: boolean }>(
    { mode: 'solid', color1: '', color2: '', color3: '', angle: 180, glow: true }
  );
  const [quote,           setQuote]           = useState<any>(null);
  const [greeting,        setGreeting]        = useState("");
  const [activeId,        setActiveId]        = useState<string | null>(null);
  const [dockPickerOpen,  setDockPickerOpen]  = useState(false);
  const [bgPanelOpen,     setBgPanelOpen]     = useState(false);
  const bgInputRef    = useRef<HTMLInputElement>(null);
  const _pendingDock  = useRef<string[]>([]);
  const _effectiveRef = useRef<string[]>([]);
  const _hasLoadedFromSupabase = useRef(false);

  const { tasks }  = useOptimizedTRData();
  const { events } = useOptimizedMaw3dEvents();
  const pendingTasks  = tasks.filter(t => !t.completed).length;
  const upcomingCount = events.filter(e => {
    try { return new Date(e.event_date) >= new Date(new Date().toDateString()); } catch { return false; }
  }).length;

  // Widget visibility for homescreen stats — loaded from settings.homescreenWidgets
  const [hsWidgets, setHsWidgets] = useState({
    showNavWidget: false, showCalendarWidget: true, showTRWidget: true,
    showMaw3dWidget: false, showWhoopWidget: false, showJournalWidget: false, showQuoteWidget: false,
  });

  // Unified grid: ordered list of "widget::KEY" and "app::ID" items
  const [unifiedGrid, setUnifiedGrid] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_UNIFIED_KEY) || 'null');
      return Array.isArray(raw) && raw.length > 0 ? raw : [];
    } catch { return []; }
  });

  useEffect(() => {
    const h = new Date().getHours();
    if (language === "ar") setGreeting(h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور");
    else                   setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, [language]);

  useEffect(() => { setQuote(getQuoteForDisplay()); }, []);
  useEffect(() => { localStorage.setItem(LS_ORDER_KEY, JSON.stringify(iconOrder)); }, [iconOrder]);
  useEffect(() => { localStorage.setItem(LS_DOCK_KEY,  JSON.stringify(dockIds));  }, [dockIds]);

  const syncToSupabase = useCallback(async (patch: Record<string, any>) => {
    if (!user) return;
    try {
      const { data } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
      const cur = (data?.settings as any) || {};
      await supabase.from("profiles").update({ settings: { ...cur, homescreen: { ...(cur.homescreen || {}), ...patch } } }).eq("id", user.id);
    } catch { /* silent */ }
  }, [user]);

  // Load homescreenWidgets from Supabase and clamp to max 3
  const clampHsWidgets = (raw: Record<string, boolean>) => {
    const result = { ...raw, showNavWidget: false } as typeof hsWidgets;
    const VISIBLE: (keyof typeof hsWidgets)[] = ['showCalendarWidget','showTRWidget','showMaw3dWidget','showWhoopWidget','showJournalWidget','showQuoteWidget'];
    let count = 0;
    for (const k of VISIBLE) {
      if (result[k]) { if (count < 3) count++; else result[k] = false; }
    }
    return result;
  };

  useEffect(() => {
    if (!user) return;
    // Skip if already loaded from Supabase and localStorage has data
    if (_hasLoadedFromSupabase.current && localStorage.getItem(LS_UNIFIED_KEY)) return;
    _hasLoadedFromSupabase.current = true;
    (async () => {
      try {
        const { data } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
        const s = (data?.settings as any);
        if (s?.homescreenWidgets) {
          const clamped = clampHsWidgets({ showNavWidget: false, showCalendarWidget: true, showTRWidget: true, showMaw3dWidget: false, showWhoopWidget: false, showJournalWidget: false, showQuoteWidget: false, ...s.homescreenWidgets });
          setHsWidgets(clamped);
          // Build/restore unified grid
          if (Array.isArray(s?.homescreen?.unifiedGrid) && s.homescreen.unifiedGrid.length > 0) {
            const saved: string[] = s.homescreen.unifiedGrid;
            const enabledWidgets = new Set(WIDGET_IDS.filter(k => clamped[k]).map(k => `widget::${k}`));
            // Keep saved order, filter disabled widgets, invalid apps, but KEEP empties to preserve layout
            const seen = new Set<string>();
            const grid: string[] = [];
            for (const id of saved) {
              if (seen.has(id)) continue;
              seen.add(id);
              if (id.startsWith('widget::')) {
                if (enabledWidgets.has(id)) grid.push(id);
              } else if (id.startsWith('app::')) {
                if (VALID_IDS.has(id.replace('app::',''))) grid.push(id);
              } else if (id.startsWith('empty-w::') || id.startsWith('empty-i::')) {
                grid.push(id);
              }
            }
            // Append any missing enabled widgets at end
            for (const w of enabledWidgets) { if (!seen.has(w)) grid.push(w); }
            // Append any missing apps at end
            for (const appId of DEFAULT_ORDER) {
              const key = `app::${appId}`;
              if (!seen.has(key)) grid.push(key);
            }
            const gridJson = JSON.stringify(grid);
            if (gridJson !== localStorage.getItem(LS_UNIFIED_KEY)) {
              setUnifiedGrid(grid);
              localStorage.setItem(LS_UNIFIED_KEY, gridJson);
            }
          } else if (!localStorage.getItem(LS_UNIFIED_KEY)) {
            const grid = buildDefaultUnifiedGrid(clamped);
            setUnifiedGrid(grid);
            localStorage.setItem(LS_UNIFIED_KEY, JSON.stringify(grid));
          }
        }
        if (s?.homescreenBg) {
          const bg = s.homescreenBg;
          setHsBg({
            mode:   bg.mode   === 'gradient' ? 'gradient' : 'solid',
            color1: bg.color1 || '',
            color2: bg.color2 || '',
            color3: bg.color3 || '',
            angle:  typeof bg.angle === 'number' ? bg.angle : 180,
            glow:   typeof bg.glow === 'boolean' ? bg.glow : false,
          });
        }
        const hs = s?.homescreen;
        if (!hs) return;
        if (Array.isArray(hs.dockIds)) {
          const d = sanitizeDock(hs.dockIds);
          const dJson = JSON.stringify(d);
          if (dJson !== localStorage.getItem(LS_DOCK_KEY)) {
            setDockIds(d);
            localStorage.setItem(LS_DOCK_KEY, dJson);
          }
          if (Array.isArray(hs.iconOrder)) {
            const o = sanitizeOrder(hs.iconOrder);
            const oJson = JSON.stringify(o);
            if (oJson !== localStorage.getItem(LS_ORDER_KEY)) {
              setIconOrder(o);
              localStorage.setItem(LS_ORDER_KEY, oJson);
            }
          }
        } else if (Array.isArray(hs.iconOrder)) {
          const o = sanitizeOrder(hs.iconOrder);
          const oJson = JSON.stringify(o);
          if (oJson !== localStorage.getItem(LS_ORDER_KEY)) {
            setIconOrder(o);
            localStorage.setItem(LS_ORDER_KEY, oJson);
          }
        }
        if (typeof hs.showQuote === "boolean" && String(hs.showQuote) !== localStorage.getItem(LS_QUOTE_KEY)) { setShowQuote(hs.showQuote); localStorage.setItem(LS_QUOTE_KEY, String(hs.showQuote)); }
        if (hs.bgImage && hs.bgImage !== localStorage.getItem(LS_BG_KEY)) { setBgImage(hs.bgImage); localStorage.setItem(LS_BG_KEY, hs.bgImage); }
        if (hs.headerColor && hs.headerColor !== localStorage.getItem(LS_HEADER_COLOR_KEY)) { setHeaderColor(hs.headerColor); localStorage.setItem(LS_HEADER_COLOR_KEY, hs.headerColor); }
      } catch { /* silent */ }
    })();
  }, [user]);

  // Live update from Settings page widget toggle events
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      if (detail.mode !== 'homescreen') return;
      setHsWidgets(prev => {
        const next = clampHsWidgets({ ...prev, ...detail });
        // Sync enabled/disabled widgets into unified grid
        setUnifiedGrid(grid => {
          const enabledWidgets = WIDGET_IDS.filter(k => next[k]).map(k => `widget::${k}`);
          // Remove disabled widget entries
          const withoutDisabled = grid.filter(id => !id.startsWith('widget::') || enabledWidgets.includes(id));
          // Add newly enabled ones at the front if not already present
          const newOnes = enabledWidgets.filter(w => !withoutDisabled.includes(w));
          const updated = [...newOnes, ...withoutDisabled];
          localStorage.setItem(LS_UNIFIED_KEY, JSON.stringify(updated));
          return updated;
        });
        return next;
      });
    };
    window.addEventListener('widgetSettingsChanged', handler);
    return () => window.removeEventListener('widgetSettingsChanged', handler);
  }, []);

  // Live update from Settings page background style changes
  useEffect(() => {
    const handler = (e: any) => {
      const d = e?.detail;
      if (!d) return;
      setHsBg({
        mode:   d.mode === 'gradient' ? 'gradient' : 'solid',
        color1: d.color1 || '',
        color2: d.color2 || '',
        color3: d.color3 || '',
        angle:  typeof d.angle === 'number' ? d.angle : 180,
        glow:   !!d.glow,
      });
    };
    window.addEventListener('homescreenBgChanged', handler);
    return () => window.removeEventListener('homescreenBgChanged', handler);
  }, []);

  // ── Sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 6 } })
  );

  // ── Unified drag handler ──
  const handleDragStart = (e: any) => { setActiveId(e.active.id); setEditMode(true); };
  const handleDragEnd   = useCallback((e: any) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeType  = active.data.current?.type as "unified" | "dock";
    const overType    = over.data.current?.type   as "unified" | "dock" | undefined;

    // ── unified grid reorder (widgets + apps together) ──
    if (activeType === "unified" && (overType === "unified" || !overType)) {
      const overId = over.id as string;
      const activeIdStr = active.id as string;
      const current = _effectiveRef.current; // effectiveUnified (includes empties)
      
      const activeIsWidget = activeIdStr.startsWith('widget::') || activeIdStr.startsWith('empty-w::');
      const overIsWidget = overId.startsWith('widget::') || overId.startsWith('empty-w::');

      if (activeIsWidget === overIsWidget) {
        // Same type: STRICT 1:1 SWAP (trade places)
        const from = current.indexOf(activeIdStr);
        const to = current.indexOf(overId);
        if (from === -1 || to === -1) return;

        const next = [...current];
        next[from] = current[to];
        next[to] = current[from];

        setUnifiedGrid(next);
        localStorage.setItem(LS_UNIFIED_KEY, JSON.stringify(next));
        syncToSupabase({ unifiedGrid: next });
        return;
      } else {
        // Different types: BLOCK SWAP (swap entire section)
        const blocks: { type: 'W' | 'I', items: string[] }[] = [];
        let currentIconBlock: string[] = [];
        
        for (const id of current) {
          if (id.startsWith('widget::') || id.startsWith('empty-w::')) {
            if (currentIconBlock.length > 0) {
              blocks.push({ type: 'I', items: currentIconBlock });
              currentIconBlock = [];
            }
            blocks.push({ type: 'W', items: [id] });
          } else {
            currentIconBlock.push(id);
            if (currentIconBlock.length === 4) {
              blocks.push({ type: 'I', items: currentIconBlock });
              currentIconBlock = [];
            }
          }
        }
        if (currentIconBlock.length > 0) {
          blocks.push({ type: 'I', items: currentIconBlock });
        }

        let activeBlockIndex = -1;
        let overBlockIndex = -1;
        blocks.forEach((b, i) => {
          if (b.items.includes(activeIdStr)) activeBlockIndex = i;
          if (b.items.includes(overId)) overBlockIndex = i;
        });

        if (activeBlockIndex !== -1 && overBlockIndex !== -1) {
          const temp = blocks[activeBlockIndex];
          blocks[activeBlockIndex] = blocks[overBlockIndex];
          blocks[overBlockIndex] = temp;
          
          const nextFlat = blocks.flatMap(b => b.items);
          setUnifiedGrid(nextFlat);
          localStorage.setItem(LS_UNIFIED_KEY, JSON.stringify(nextFlat));
          syncToSupabase({ unifiedGrid: nextFlat });
        }
        return;
      }
    }

    // dock → dock reorder
    if (activeType === "dock" && overType === "dock") {
      const activeAppId = active.id.replace('dock::', '');
      const overAppId   = over.id.replace('dock::', '');
      setDockIds(prev => {
        const from = prev.indexOf(activeAppId);
        const to   = prev.indexOf(overAppId);
        if (from === -1 || to === -1) return prev;
        const next = arrayMove(prev, from, to);
        syncToSupabase({ dockIds: next });
        return next;
      });
    }
  }, [syncToSupabase]);

  // ── BG ──
  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setBgImage(url);
      localStorage.setItem(LS_BG_KEY, url);
      syncToSupabase({ bgImage: url });
    };
    reader.readAsDataURL(file);
  };
  const removeBg = () => { setBgImage(""); localStorage.removeItem(LS_BG_KEY); syncToSupabase({ bgImage: "" }); };
  const saveBgStyle = () => {
    const patch = { mode: hsBg.mode, color1: hsBg.color1, color2: hsBg.color2, color3: hsBg.color3, angle: hsBg.angle, glow: hsBg.glow };
    syncToSupabase({ homescreenBg: patch });
    window.dispatchEvent(new Event('homescreenBgChanged'));
    setBgPanelOpen(false);
  };
  const saveHeaderColor = (color: string) => {
    setHeaderColor(color);
    localStorage.setItem(LS_HEADER_COLOR_KEY, color);
    syncToSupabase({ headerColor: color });
  };
  const removeHeaderColor = () => {
    setHeaderColor("");
    localStorage.removeItem(LS_HEADER_COLOR_KEY);
    syncToSupabase({ headerColor: "" });
  };
  const toggleQuote = () => {
    const next = !showQuote;
    setShowQuote(next);
    localStorage.setItem(LS_QUOTE_KEY, String(next));
    syncToSupabase({ showQuote: next });
  };

  const toggleDockIcon = useCallback((id: string) => {
    setDockIds(prevDock => {
      let nextDock: string[];
      if (prevDock.includes(id)) {
        nextDock = prevDock.filter(x => x !== id);
        // Return the app to the unified grid
        setUnifiedGrid(prev => {
          if (prev.includes(`app::${id}`)) return prev;
          const updated = [...prev, `app::${id}`];
          localStorage.setItem(LS_UNIFIED_KEY, JSON.stringify(updated));
          return updated;
        });
      } else {
        if (prevDock.length < 3) {
          nextDock = [...prevDock, id];
        } else {
          const evicted = prevDock[prevDock.length - 1];
          nextDock = [...prevDock.slice(0, 2), id];
          setUnifiedGrid(prev => {
            if (prev.includes(`app::${evicted}`)) return prev;
            const updated = [...prev, `app::${evicted}`];
            localStorage.setItem(LS_UNIFIED_KEY, JSON.stringify(updated));
            return updated;
          });
        }
        // Remove from unified grid
        setUnifiedGrid(prev => {
          const updated = prev.filter(x => x !== `app::${id}`);
          localStorage.setItem(LS_UNIFIED_KEY, JSON.stringify(updated));
          return updated;
        });
      }
      localStorage.setItem(LS_DOCK_KEY, JSON.stringify(nextDock));
      syncToSupabase({ dockIds: nextDock });
      _pendingDock.current = nextDock;
      return nextDock;
    });
  }, [syncToSupabase]);

  // ── Derived lists — bulletproof dedup & dynamic grid generation ──
  const dockSet = new Set(dockIds);
  const enabledWidgetIds = new Set(WIDGET_IDS.filter(k => hsWidgets[k]).map(k => `widget::${k}`));

  const { effectiveUnified, realItems, gridTemplateAreas, gridPositions } = React.useMemo(() => {
    // 1. Extract valid real items from saved grid
    const widgets: string[] = [];
    const icons: string[] = [];
    const seen = new Set<string>();
    
    const sourceGrid = unifiedGrid.length > 0 ? unifiedGrid : buildDefaultUnifiedGrid(hsWidgets, dockIds);

    for (const id of sourceGrid) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (id.startsWith('widget::')) {
        if (enabledWidgetIds.has(id) && widgets.length < 3) widgets.push(id);
      } else if (id.startsWith('app::')) {
        const appId = id.replace('app::', '');
        if (VALID_IDS.has(appId) && !dockSet.has(appId)) icons.push(id);
      }
    }
    
    // Append missing apps
    for (const appId of DEFAULT_ORDER) {
      const key = `app::${appId}`;
      if (!seen.has(key) && !dockSet.has(appId)) {
        icons.push(key);
        seen.add(key);
      }
    }
    
    // 2. Determine block types based on sourceGrid
    const blockTypes: ('W' | 'I')[] = [];
    let currentIconCount = 0;
    for (const id of sourceGrid) {
      if (id.startsWith('widget::') || id.startsWith('empty-w::')) {
        if (currentIconCount > 0) { // incomplete icon block, force close it
          blockTypes.push('I');
          currentIconCount = 0;
        }
        blockTypes.push('W');
      } else if (id.startsWith('app::') || id.startsWith('empty-i::')) {
        currentIconCount++;
        if (currentIconCount === 4) {
          blockTypes.push('I');
          currentIconCount = 0;
        }
      }
    }
    if (currentIconCount > 0) blockTypes.push('I');
    
    // 3. Force exactly 3 W and 3 I blocks
    const finalTypes: ('W' | 'I')[] = [];
    let wCount = 0, iCount = 0;
    for (const t of blockTypes) {
      if (t === 'W' && wCount < 3) { finalTypes.push('W'); wCount++; }
      if (t === 'I' && iCount < 3) { finalTypes.push('I'); iCount++; }
    }
    // Pad missing types with default iPhone layout (W, I, I, W, W, I)
    const defaultTypes = ['W', 'I', 'I', 'W', 'W', 'I'];
    for (const t of defaultTypes) {
      if (finalTypes.length === 6) break;
      if (t === 'W' && wCount < 3) { finalTypes.push('W'); wCount++; }
      if (t === 'I' && iCount < 3) { finalTypes.push('I'); iCount++; }
    }

    // 4. Fill blocks from queues
    let wIdx = 1, iIdx = 1;
    const finalItems: string[] = [];
    for (const t of finalTypes) {
      if (t === 'W') {
        finalItems.push(widgets.length > 0 ? widgets.shift()! : `empty-w::${wIdx++}`);
      } else {
        for (let i=0; i<4; i++) {
          finalItems.push(icons.length > 0 ? icons.shift()! : `empty-i::${iIdx++}`);
        }
      }
    }
    
    // 5. Generate grid-template-areas dynamically
    const rowStrings = ["", "", "", "", "", ""];
    let gW = 1, gI = 1;
    finalTypes.forEach((t, i) => {
      const rStart = Math.floor(i / 2) * 2;
      const isLeft = i % 2 === 0;
      let topStr = "", botStr = "";
      
      if (t === 'W') {
        const wName = `w${gW++}`;
        topStr = `${wName} ${wName}`;
        botStr = `${wName} ${wName}`;
      } else {
        const i1 = `i${gI++}`, i2 = `i${gI++}`, i3 = `i${gI++}`, i4 = `i${gI++}`;
        topStr = `${i1} ${i2}`;
        botStr = `${i3} ${i4}`;
      }
      
      if (isLeft) {
        rowStrings[rStart] += topStr;
        rowStrings[rStart+1] += botStr;
      } else {
        rowStrings[rStart] += " " + topStr;
        rowStrings[rStart+1] += " " + botStr;
      }
    });
    
    const gridAreas = rowStrings.map(s => `"${s.trim()}"`).join("\n");
    const rItems = finalItems.filter(id => !id.startsWith('empty-'));
    
    // Build gridPositions map: iterate finalItems in order, assign w1/w2.../i1/i2...
    const gpMap = new Map<string, string>();
    let gW2 = 1, gI2 = 1;
    for (const id of finalItems) {
      if (id.startsWith('widget::') || id.startsWith('empty-w::')) {
        gpMap.set(id, `w${gW2++}`);
      } else {
        gpMap.set(id, `i${gI2++}`);
      }
    }
    
    return { effectiveUnified: finalItems, realItems: rItems, gridTemplateAreas: gridAreas, gridPositions: gpMap };
  }, [unifiedGrid, hsWidgets, dockIds]);

  _effectiveRef.current = effectiveUnified; // Use the FULL padded array for drag reference

  const seenDock = new Set<string>();
  const dockApps = dockIds
    .filter(id => VALID_IDS.has(id) && !seenDock.has(id) && (seenDock.add(id), true))
    .map(id => ALL_APPS.find(a => a.id === id))
    .filter(Boolean) as typeof ALL_APPS;

  const activeApp    = activeId ? (activeId.startsWith('dock::') ? ALL_APPS.find(a => `dock::${a.id}` === activeId) : ALL_APPS.find(a => `app::${a.id}` === activeId)) : null;
  const activeInDock = activeId?.startsWith("dock::");

  const quoteText   = quote ? getQuoteText(quote, language) : "";
  const quoteAuthor = quote ? getQuoteAuthor(quote) : "";

  // ── Theme-aware surface colors ──
  const isDark = theme === "dark";
  const hasBg  = !!bgImage;

  // Greeting text — custom header color overrides, then BG/theme defaults
  const headColor = headerColor || (hasBg ? "#ffffff" : isDark ? "#f2f2f2" : "#060541");
  const subColor  = headerColor ? `${headerColor}b3` : (hasBg ? "rgba(255,255,255,0.72)" : isDark ? "rgba(242,242,242,0.55)" : "rgba(6,5,65,0.55)");

  // Stat card surface
  const statCardBase = hasBg
    ? "bg-white/10 backdrop-blur-xl border border-white/25"
    : isDark
      ? "bg-white/[0.06] backdrop-blur-xl border border-white/10"
      : "bg-white backdrop-blur-xl border border-[#060541]/10 shadow-[0_2px_12px_rgba(6,5,65,0.08)]";

  const statNumBase = hasBg || isDark ? "" : "!text-[#060541]";
  const statLblColor = hasBg ? "rgba(255,255,255,0.65)" : isDark ? "rgba(242,242,242,0.5)" : "rgba(6,5,65,0.55)";

  // Dock glass
  const dockGlass = hasBg
    ? "bg-white/15 backdrop-blur-2xl border border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.3)]"
    : isDark
      ? "bg-white/[0.08] backdrop-blur-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]"
      : "bg-[#060541]/90 backdrop-blur-2xl border border-[#060541]/20 shadow-[0_8px_32px_rgba(6,5,65,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]";

  // Quote glass
  const quoteGlass = hasBg
    ? "bg-black/25 backdrop-blur-xl border border-white/15"
    : isDark
      ? "bg-white/[0.06] backdrop-blur-xl border border-white/10"
      : "bg-[#060541]/[0.06] backdrop-blur-xl border border-[#060541]/10 shadow-sm";
  const quoteTextColor   = hasBg || isDark ? "rgba(255,255,255,0.9)" : "#060541";
  const quoteAuthorColor = hasBg || isDark ? "rgba(255,255,255,0.45)" : "rgba(6,5,65,0.5)";

  // Edit bar glass
  const editBarGlass = "bg-black/40 backdrop-blur-xl border-b border-white/10";

  // Custom background from Settings (solid/gradient) — overrides theme default if set
  const hasCustomBg = !hasBg && !!hsBg.color1;
  const customBgStyle = hasCustomBg
    ? hsBg.mode === 'gradient'
      ? hsBg.color3
        ? `linear-gradient(${hsBg.angle}deg, ${hsBg.color1} 0%, ${hsBg.color3} 50%, ${hsBg.color2 || hsBg.color1} 100%)`
        : `linear-gradient(${hsBg.angle}deg, ${hsBg.color1} 0%, ${hsBg.color2 || hsBg.color1} 100%)`
      : hsBg.color1
    : undefined;

  // Page background — used only when no custom BG and no photo BG
  const pageBg = (!hasBg && !hasCustomBg)
    ? isDark
      ? "bg-[#0c0f14]"
      : "bg-gradient-to-b from-[#fcfefd] via-[#f0f0ff] to-[#e8e4f0]"
    : "";

  // ── BG input id for label linkage ──
  const bgInputId = "hs-bg-input";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Root — fills parent via flex, dock always at very bottom */}
      <div
        className={`relative overflow-hidden hs-root flex flex-col ${pageBg}`}
        style={{
          ...(hasBg ? {
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          } : hasCustomBg ? {
            background: customBgStyle,
          } : {}),
        }}
      >
        {/* BG scrim */}
        {hasBg && <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(0,0,0,0.40)" }} />}

        {/* Hidden BG file input — always in DOM */}
        <input ref={bgInputRef} id={bgInputId} type="file" accept="image/*"
          aria-label="Upload background image" className="hidden" onChange={handleBgChange} />

        {/* ── Direct flex column layout ── */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0">

          {/* ── Greeting header + edit icon ── */}
          <div className="flex-none flex items-center justify-between px-4 pt-3 pb-1">
            <div>
              <p className="text-[11px] font-semibold" style={{ color: subColor }}>{greeting}</p>
              <p className="text-[17px] font-black leading-tight" style={{ color: headColor }}>{displayName}</p>
            </div>
            {!editMode ? (
              <button onClick={() => setEditMode(true)} title="Edit homescreen" className="p-2 rounded-full bg-white/15 backdrop-blur-md">
                <Pencil className="w-4 h-4" style={{ color: headColor }} />
              </button>
            ) : (
              <button onClick={() => setEditMode(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/80 text-white text-xs font-semibold">
                <Check className="w-3.5 h-3.5" />
                {language === "ar" ? "تم" : "Done"}
              </button>
            )}
          </div>

          {/* ── Edit options bar ── */}
          {editMode && (
            <div className="flex-none flex items-center gap-2 px-4 pb-2">
              <button onClick={() => setDockPickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px] font-semibold">
                <Settings2 className="w-3 h-3" /> Dock
              </button>
              <button onClick={() => setBgPanelOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11px] font-semibold ${bgPanelOpen ? 'bg-blue-500/70' : 'bg-white/15 backdrop-blur-md'}`}>
                <ImageIcon className="w-3 h-3" />
                {language === "ar" ? "خلفية" : "BG"}
              </button>
              {bgImage && (
                <button onClick={removeBg} title="Remove BG"
                  className="px-2.5 py-1.5 rounded-full bg-red-500/60 text-white text-[11px] font-semibold">
                  <X className="w-3 h-3" />
                </button>
              )}
              <button onClick={toggleQuote}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-[11px] font-semibold ${showQuote ? 'bg-purple-500/70' : 'bg-white/15 backdrop-blur-md'}`}>
                {language === "ar" ? "اقتباس" : "Quote"}
                {showQuote && <Check className="w-2.5 h-2.5" />}
              </button>
              <div className="flex items-center gap-1">
                <input type="color" title="Header color" value={headerColor || '#ffffff'} onChange={e => saveHeaderColor(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-white/30 p-0.5 bg-transparent" />
                {headerColor && (
                  <button onClick={removeHeaderColor} title="Reset header color"
                    className="px-2 py-1.5 rounded-full bg-red-500/60 text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── BG Style Panel ── */}
          {editMode && bgPanelOpen && (
            <div className="flex-none mx-3 mb-2 rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/15 p-3 space-y-3 max-h-[50vh] overflow-y-auto">
              {/* Upload photo */}
              <label htmlFor={bgInputId}
                className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl bg-white/10 text-white text-xs font-semibold cursor-pointer">
                <ImageIcon className="w-4 h-4" /> {language === "ar" ? "رفع صورة" : "Upload Photo"}
              </label>

              {/* Mode toggle */}
              <div className="flex gap-2">
                {(['solid', 'gradient'] as const).map(m => (
                  <button key={m} onClick={() => setHsBg(p => ({ ...p, mode: m }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      hsBg.mode === m ? 'bg-white/20 border-white/40 text-white' : 'border-white/10 text-white/50'
                    }`}>
                    {m === 'solid' ? (language === 'ar' ? 'لون ثابت' : 'Solid') : (language === 'ar' ? 'تدرج' : 'Gradient')}
                  </button>
                ))}
              </div>

              {/* Color 1 */}
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-[11px]">{hsBg.mode === 'gradient' ? 'Color 1' : 'Color'}</span>
                <input type="color" title="Color 1" value={hsBg.color1 || '#1a1a2e'} onChange={e => setHsBg(p => ({ ...p, color1: e.target.value }))}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-white/20 p-0.5 bg-transparent" />
              </div>

              {/* Color 2 — gradient */}
              {hsBg.mode === 'gradient' && (
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-[11px]">Color 2</span>
                  <input type="color" title="Color 2" value={hsBg.color2 || '#4a4a8a'} onChange={e => setHsBg(p => ({ ...p, color2: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-white/20 p-0.5 bg-transparent" />
                </div>
              )}

              {/* Color 3 — gradient optional */}
              {hsBg.mode === 'gradient' && (
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-[11px]">Color 3 <span className="text-white/30">(opt)</span></span>
                  <div className="flex items-center gap-1">
                    {hsBg.color3 && <button onClick={() => setHsBg(p => ({ ...p, color3: '' }))} className="text-[9px] text-red-400 px-1.5 py-0.5 rounded border border-red-400/30">✕</button>}
                    <input type="color" title="Color 3" value={hsBg.color3 || hsBg.color1 || '#1a1a2e'} onChange={e => setHsBg(p => ({ ...p, color3: e.target.value }))}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-white/20 p-0.5 bg-transparent" />
                  </div>
                </div>
              )}

              {/* Angle — gradient */}
              {hsBg.mode === 'gradient' && (
                <div className="space-y-1">
                  <span className="text-white/70 text-[11px]">{language === 'ar' ? 'اتجاه' : 'Direction'}</span>
                  <div className="grid grid-cols-4 gap-1">
                    {[{d:180,i:'↓'},{d:0,i:'↑'},{d:90,i:'→'},{d:270,i:'←'},{d:135,i:'↘'},{d:45,i:'↗'},{d:225,i:'↙'},{d:315,i:'↖'}].map(a => (
                      <button key={a.d} onClick={() => setHsBg(p => ({ ...p, angle: a.d }))}
                        className={`py-1.5 rounded-lg text-sm font-bold border transition-all ${
                          hsBg.angle === a.d ? 'border-white/50 bg-white/15 text-white' : 'border-white/10 text-white/40'
                        }`}>{a.i}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Glow */}
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-[11px]">{language === 'ar' ? 'تأثير إضاءة' : 'Glow ✨'}</span>
                <button title="Toggle glow" onClick={() => setHsBg(p => ({ ...p, glow: !p.glow }))}
                  className={`w-10 h-5 rounded-full transition-all ${hsBg.glow ? 'bg-blue-500' : 'bg-white/15'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${hsBg.glow ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Save */}
              <button onClick={saveBgStyle}
                className="w-full py-2.5 rounded-xl bg-blue-500/80 text-white text-xs font-bold">
                {language === 'ar' ? 'حفظ' : 'Save Style'}
              </button>
            </div>
          )}

          {/* ── Unified iPhone-style grid: 3 big rows × 2 big cols = 6 rows × 4 cols ── */}
          <div className="flex-1 min-h-0 px-3 pb-2 overflow-y-auto overflow-x-hidden relative">
            
            {/* Visual Guide exactly matching the user's diagram in edit mode */}
            {editMode && (
              <div className="absolute inset-0 px-3 pt-2 grid gap-x-1 gap-y-2 pointer-events-none" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(6, 88px)', gridTemplateAreas: gridTemplateAreas, zIndex: 0 }}>
                {/* Visual grid is dynamically rendered based on gridTemplateAreas now to match real positions */}
                {effectiveUnified.map(itemId => {
                  const gp = gridPositions.get(itemId);
                  if (!gp) return null;
                  if (itemId.startsWith('empty-w::') || itemId.startsWith('widget::')) {
                    return <div key={`vis-${itemId}`} style={{ gridArea: gp }} className="border-[3px] border-dashed border-white/50 rounded-3xl" />;
                  } else if (itemId.startsWith('empty-i::') || itemId.startsWith('app::')) {
                    return <div key={`vis-${itemId}`} style={{ gridArea: gp }} className="border-2 border-dashed border-red-500/50 rounded-2xl" />;
                  }
                  return null;
                })}
              </div>
            )}

            <SortableContext items={effectiveUnified} strategy={rectSortingStrategy}>
              <div className="grid gap-x-1 gap-y-2 relative z-10" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(6, 88px)', gridTemplateAreas: gridTemplateAreas, alignContent: 'start', paddingTop: 8 }}>
                {(() => {
                  return effectiveUnified.map(itemId => {
                    const gp = gridPositions.get(itemId);
                    if (!gp) return null;

                    // Empty placeholder slots — droppable targets in edit mode
                    if (itemId.startsWith('empty-w::') || itemId.startsWith('empty-i::')) {
                      return (
                        <EmptySlotCell
                          key={itemId}
                          id={itemId}
                          gridArea={gp}
                          isWidget={itemId.startsWith('empty-w::')}
                          editMode={editMode}
                        />
                      );
                    }
                    
                    if (itemId.startsWith('widget::')) {
                      const wKey = itemId.replace('widget::','') as WidgetId;
                      return (
                        <UnifiedWidgetCell
                          key={itemId}
                          id={itemId}
                          wKey={wKey}
                          editMode={editMode}
                          language={language}
                          theme={theme}
                          hasBg={hasBg || hasCustomBg}
                          statCardBase={statCardBase}
                          statLblColor={statLblColor}
                          pendingTasks={pendingTasks}
                          completedToday={tasks.filter((t: any) => t.completed).length}
                          upcomingCount={upcomingCount}
                          navigate={navigate}
                          gridArea={gp}
                          quoteText={quoteText}
                          quoteAuthor={quoteAuthor}
                        />
                      );
                    }
                    const appId = itemId.replace('app::','');
                    const app = ALL_APPS.find(a => a.id === appId);
                    if (!app) return null;
                    return (
                      <UnifiedAppCell
                        key={itemId}
                        id={itemId}
                        app={app}
                        editMode={editMode}
                        language={language}
                        isDark={isDark || hasBg || hasCustomBg}
                        glowEnabled={hsBg.glow}
                        navigate={navigate}
                        gridArea={gp}
                      />
                    );
                  });
                })()}
              </div>
            </SortableContext>
          </div>

          {/* ── DOCK — always at very bottom ── */}
          <div className="mt-auto flex-none px-4 pt-1 hs-dock-bottom">
            <div className={`flex items-center justify-around ${dockGlass} rounded-[28px] py-3 px-5`}>
              <SortableContext items={dockApps.map(a => `dock::${a.id}`)} strategy={horizontalListSortingStrategy}>
                {dockApps.map(app => (
                  <DockIcon key={app.id} app={app} editMode={editMode} onTap={() => navigate(app.path)} glowEnabled={hsBg.glow} />
                ))}
                {Array.from({ length: Math.max(0, 3 - dockApps.length) }).map((_, i) => (
                  <div key={`slot-${i}`} className="w-14 h-14 rounded-[23%] border-2 border-dashed border-white/25" />
                ))}
              </SortableContext>
            </div>
          </div>

        </div>{/* end flex column */}

        {/* ── Drag Overlay ── */}
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {activeApp && (
            <div style={{ opacity: 0.9, transform: "scale(1.12)" }}>
              <LiquidIcon app={activeApp} size={activeInDock ? 58 : 64} editMode={false} glowEnabled={hsBg.glow} />
            </div>
          )}
        </DragOverlay>
      </div>

      {/* ── Dock picker sheet ── */}
      {dockPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDockPickerOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-background rounded-t-3xl p-5 pb-8 shadow-2xl max-h-[70dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">
                {language === "ar" ? "اختر أيقونات Dock (٣ كحد أقصى)" : "Choose Dock Icons (max 3)"}
              </h3>
              <span className="text-xs text-muted-foreground">{dockIds.length}/3</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {ALL_APPS.map(app => {
                const sel = dockIds.includes(app.id);
                return (
                  <button key={app.id} onClick={() => toggleDockIcon(app.id)}
                    className="flex flex-col items-center gap-1.5">
                    <div className={`transition-all ${sel ? "scale-110 ring-2 ring-blue-500 ring-offset-2 rounded-[23%]" : "opacity-70"}`}>
                      <LiquidIcon app={app} size={52} editMode={false} />
                    </div>
                    <span className="text-[10px] font-medium text-center">{language === "ar" ? app.nameAr : app.nameEn}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setDockPickerOpen(false)}
              className="mt-5 w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold">
              {language === "ar" ? "تم" : "Done"}
            </button>
          </div>
        </div>
      )}
    </DndContext>
  );
}
