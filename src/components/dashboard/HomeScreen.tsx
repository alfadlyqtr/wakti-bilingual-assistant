// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  closestCenter,
  MouseSensor,
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
  RotateCcw,
  Heart,
  Navigation,
  CalendarDays,
  Bell,
  Users,
} from "lucide-react";
import { WaktiIcon } from "@/components/icons/WaktiIcon";
import { getQuoteForDisplay, getQuoteText, getQuoteAuthor } from "@/utils/quoteService";
import { getTodayHealthSummary, getSleepAnalysis, isHealthKitSDKAvailable } from "@/integrations/natively/healthkitBridge";
import { useOptimizedTRData } from "@/hooks/useOptimizedTRData";
import { useOptimizedMaw3dEvents } from "@/hooks/useOptimizedMaw3dEvents";
import { useWhoopData } from "@/hooks/useWhoopData";
import { useJournalData } from "@/hooks/useJournalData";
import { SavedImagesPicker } from "@/components/dashboard/SavedImagesPicker";

// ─── App definitions ──────────────────────────────────────────────────────────
const ALL_APPS = [
  { id: "calendar",  nameEn: "Calendar",  nameAr: "التقويم",   path: "/calendar",           icon: Calendar,        gradient: "from-sky-400 to-sky-600",         glow: "#38bdf8" },
  { id: "journal",   nameEn: "Journal",   nameAr: "المذكرات",  path: "/journal",            icon: NotebookPen,     gradient: "from-pink-500 to-rose-600",       glow: "#ec4899" },
  { id: "maw3d",     nameEn: "Maw3d",     nameAr: "مواعيد",   path: "/maw3d",              icon: CalendarClock,   gradient: "from-purple-500 to-purple-700",   glow: "#a855f7" },
  { id: "tr",        nameEn: "T & R",     nameAr: "م & ت",    path: "/tr",                 icon: ListTodo,        gradient: "from-green-500 to-emerald-600",   glow: "#22c55e" },
  { id: "wakti-ai",  nameEn: "WAKTI AI",  nameAr: "WAKTI AI", path: "/wakti-ai",           icon: Sparkles,        gradient: "from-orange-500 to-amber-400",    glow: "#f97316" },
  { id: "studio",    nameEn: "Studio",    nameAr: "الاستوديو", path: "/music",              icon: Aperture,        gradient: "from-fuchsia-500 to-violet-600",  glow: "#d946ef" },
  { id: "vitality",  nameEn: "Vitality",  nameAr: "الحيوية",  path: "/fitness",            icon: null,            gradient: "from-rose-500 to-red-600",        glow: "#f43f5e", isWaktiIcon: true },
  { id: "tasjeel",   nameEn: "Tasjeel",   nameAr: "تسجيل",    path: "/tasjeel",            icon: AudioLines,      gradient: "from-cyan-400 to-cyan-600",       glow: "#06b6d4" },
  { id: "warranty",  nameEn: "My Files",  nameAr: "ملفاتي",   path: "/my-warranty",        icon: FolderOpen,      gradient: "from-emerald-400 to-emerald-600", glow: "#10b981" },
  { id: "projects",  nameEn: "Projects",  nameAr: "مشاريع",   path: "/projects",           icon: Code2,           gradient: "from-indigo-500 to-indigo-700",   glow: "#6366f1" },
  { id: "text",      nameEn: "Text",      nameAr: "نص",       path: "/tools/text",         icon: PenTool,         gradient: "from-violet-500 to-violet-700",   glow: "#8b5cf6" },
  { id: "voice",     nameEn: "Voice",     nameAr: "صوت",      path: "/tools/voice-studio", icon: Mic,             gradient: "from-pink-400 to-pink-600",       glow: "#f472b6" },
  { id: "game",      nameEn: "Game",      nameAr: "لعبة",     path: "/tools/game",         icon: Gamepad2,        gradient: "from-red-500 to-red-700",         glow: "#ef4444" },
];

const DEFAULT_ORDER = ALL_APPS.map(a => a.id);
const DEFAULT_DOCK  = ["wakti-ai", "calendar", "tr", "maw3d", "journal"];
const MAX_DOCK_MOBILE  = 3;
const MAX_DOCK_DESKTOP = 5;
// ── Per-user localStorage key helpers ─────────────────────────────────────────
// Keys are scoped to the logged-in user so different accounts on the same browser
// never bleed their homescreen data into each other.
const DEFAULT_BG = "/wakti-image-1773608945903.jpg"; // default homescreen wallpaper
const LS_ACTIVE_USER = "homescreen_active_uid"; // meta key tracking who is cached
const lsKey = (uid: string, base: string) => `${base}__${uid}`;
const LS_ORDER_BASE        = "homescreen_icon_order_v2";
const LS_DOCK_BASE         = "homescreen_dock_v2";
const LS_QUOTE_BASE        = "homescreen_show_quote";
const LS_BG_BASE           = "homescreen_bg";
const LS_HEADER_COLOR_BASE = "homescreen_header_color";
const LS_UNIFIED_BASE      = "homescreen_unified_grid_v6";
const LS_WIDGETS_BASE      = "homescreen_widgets_v1";
const LS_HSBG_BASE         = "homescreen_bg_style_v1";
const LS_HSBG_ACTIVE_BASE  = "homescreen_bg_style_active";
const LS_DOCK_COLOR_BASE   = "homescreen_dock_color";

// Read the currently-cached user ID (set on login) so useState initialisers can
// immediately read the correct user-scoped key before useEffect fires.
const _cachedUid = () => localStorage.getItem(LS_ACTIVE_USER) || "";
const LS_ORDER_KEY        = () => lsKey(_cachedUid(), LS_ORDER_BASE);
const LS_DOCK_KEY         = () => lsKey(_cachedUid(), LS_DOCK_BASE);
const LS_QUOTE_KEY        = () => lsKey(_cachedUid(), LS_QUOTE_BASE);
const LS_BG_KEY           = () => lsKey(_cachedUid(), LS_BG_BASE);
const LS_HEADER_COLOR_KEY = () => lsKey(_cachedUid(), LS_HEADER_COLOR_BASE);
const LS_UNIFIED_KEY      = () => lsKey(_cachedUid(), LS_UNIFIED_BASE);
const LS_WIDGETS_KEY      = () => lsKey(_cachedUid(), LS_WIDGETS_BASE);
const LS_HSBG_KEY         = () => lsKey(_cachedUid(), LS_HSBG_BASE);

// Widget IDs used in the unified grid
const WIDGET_IDS = ['showTRWidget','showCalendarWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget'] as const;
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

function sanitizeDock(raw: string[], maxSlots = MAX_DOCK_DESKTOP): string[] {
  const seen = new Set<string>();
  return raw.filter(id => VALID_IDS.has(id) && !seen.has(id) && (seen.add(id), true)).slice(0, maxSlots);
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
          opacity: 0.75,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: glowEnabled
            ? `0 0 16px ${app.glow}bb, 0 4px 14px ${app.glow}55, 0 1px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`
            : `0 4px 14px ${app.glow}44, 0 1px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`,
          outline: '0.5px solid rgba(180,190,200,0.28)',
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

  const KEYS = ['showTRWidget','showCalendarWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget'];
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

      {visible.includes('showVitalityWidget') && (
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

// ─── Combined Vitality widget (WHOOP + HealthKit tabs) ────────────────────────
const LS_VITALITY_RECOVERY = 'wakti_vitality_recovery_cache';

function VitalityWidget({ shell, language, navigate, whoopData }: {
  shell: (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => React.ReactNode;
  language: string;
  navigate: (p: string) => void;
  whoopData?: any;
}) {
  const [activeTab, setActiveTab] = useState<'whoop' | 'healthkit'>(
    () => (localStorage.getItem('vitality_widget_tab') as 'whoop' | 'healthkit') || 'whoop'
  );

  // Real HealthKit data state
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
        setHkData({
          steps: summary.steps,
          avgHr: summary.heartRate?.avg ?? null,
          rhr: summary.restingHeartRate,
          sleepHours: sleepHrs,
        });
      } catch { /* ignore */ } finally {
        setHkLoading(false);
      }
    })();
  }, [activeTab]);

  const recovery         = whoopData?.recovery         ?? null;
  const strain           = whoopData?.strain           ?? null;
  const hrv              = whoopData?.hrv              ?? null;
  const rhr              = whoopData?.rhr              ?? null;
  const sleepPerf        = whoopData?.sleepPerformance  ?? null;
  const sleepHours       = whoopData?.sleepHours       ?? null;
  const sleepConsistency = whoopData?.sleepConsistency ?? null;
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

  const bgHealth   = 'linear-gradient(145deg,rgba(10,60,40,0.92) 0%,rgba(15,90,60,0.92) 100%)';
  const bgGradient = activeTab === 'whoop' ? bgWhoop : bgHealth;
  const glowColor  = activeTab === 'whoop' ? recColor : '#22c55e';

  const R = 18; const C = 2 * Math.PI * R;
  const recPct = recovery != null ? Math.min(recovery / 100, 1) : 0;

  return shell(bgGradient, glowColor, () => navigate('/fitness'),
    <div className="p-2.5 flex flex-col h-full gap-1.5">

      {/* Toggle pill */}
      <div className="flex justify-center">
        <button
          title={activeTab === 'whoop' ? 'Switch to HealthKit' : 'Switch to WHOOP'}
          onClick={(e) => { e.stopPropagation(); setActiveTab(t => { const next = t === 'whoop' ? 'healthkit' : 'whoop'; localStorage.setItem('vitality_widget_tab', next); return next; }); }}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 active:scale-95 transition-all"
        >
          <Activity className={`w-3 h-3 ${activeTab === 'whoop' ? 'text-white' : 'text-white/70'}`} strokeWidth={2.5} />
          <div className="w-px h-2.5 bg-white/25" />
          <Heart className={`w-3 h-3 ${activeTab === 'healthkit' ? 'text-white' : 'text-white/70'}`} strokeWidth={2.5} />
        </button>
      </div>

      {/* WHOOP tab */}
      {activeTab === 'whoop' && (
        <div className="flex flex-col flex-1 justify-between">
          {recovery != null ? (
            <>
              {/* Recovery ring + big number */}
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
                    <span className="text-[9px] text-white/90 font-bold uppercase">{language === 'ar' ? 'استشفاء' : 'REC'}</span>
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
              {/* Strain bar */}
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
              {/* HRV / RHR / AvgHR pills */}
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

      {/* HealthKit tab */}
      {activeTab === 'healthkit' && (
        <div className="flex flex-col flex-1 justify-between">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Heart className="w-4 h-4 text-white" strokeWidth={2} fill="rgba(255,255,255,0.4)" />
            </div>
            <div>
              <p className="text-[12px] font-black text-white leading-none">{language === 'ar' ? 'أبل هيلث' : 'Apple Health'}</p>
              <p className="text-[8px] text-white/85 mt-0.5">{language === 'ar' ? 'بيانات اليوم' : 'Today\'s data'}</p>
            </div>
          </div>
          {/* Data grid */}
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
          {/* Open Vitality link */}
          <div
            onClick={(e) => { e.stopPropagation(); navigate('/fitness'); }}
            className="flex items-center justify-center gap-1 bg-white/10 border border-white/20 rounded-lg py-1 active:scale-95 transition-all cursor-pointer"
          >
            <span className="text-[9px] text-white/90 font-semibold">{language === 'ar' ? 'فتح الحيوية →' : 'Open Vitality →'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── T&R Widget (Tasks + Reminders tabs) ──────────────────────────────────────
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
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function parseReminderDate(r: any): number | null {
  try {
    if (!r.due_date) return null;
    const dateStr = r.due_time ? `${r.due_date}T${r.due_time}` : `${r.due_date}T00:00:00`;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch { return null; }
}

function TRWidget({ shell, navigate, language, pendingTasks, completedToday, total, pct, taskAccent, taskIconBg, reminders }: {
  shell: (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => React.ReactNode;
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

  // Sort: overdue first (by how late), then upcoming (by how soon)
  const activeReminders = reminders
    .map(r => ({ ...r, dueMs: parseReminderDate(r) }))
    .filter(r => r.dueMs !== null)
    .sort((a, b) => {
      const aOverdue = a.dueMs! < now;
      const bOverdue = b.dueMs! < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return aOverdue ? (a.dueMs! - b.dueMs!) : (a.dueMs! - b.dueMs!);
    })
    .slice(0, 3);
  const trBg = 'linear-gradient(145deg,rgba(6,60,80,0.97) 0%,rgba(8,90,115,0.97) 50%,rgba(10,110,140,0.97) 100%)';
  const trGlow = '#0ea5e9';
  const Rtr = 16; const Ctr = 2 * Math.PI * Rtr;

  return shell(trBg, trGlow, () => navigate('/tr'),
    <div className="p-2.5 flex flex-col h-full justify-between">
      {/* Toggle pill */}
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

      {/* Header row */}
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

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? 'الكل' : 'Total'}</span>
          <span className="text-[20px] font-black text-white leading-none tabular-nums">{activeTab === 'tasks' ? total : 0}</span>
        </div>
        <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[7px] text-white/90 uppercase font-bold">{language === 'ar' ? 'مكتمل' : 'Done'}</span>
          <span className="text-[20px] font-black leading-none tabular-nums" style={{ color: taskAccent }}>{activeTab === 'tasks' ? completedToday : 0}</span>
        </div>
      </div>

      {/* Mini bar graph */}
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
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {overdue && <span className="text-[7px] font-black text-red-400 uppercase">{language === 'ar' ? 'متأخر' : 'LATE'}</span>}
                      <span className={`text-[9px] font-black tabular-nums ${overdue ? 'text-red-300' : 'text-white'}`}>{countdown}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[8px] text-white/80 uppercase">{language === 'ar' ? 'لا تنبيهات' : 'No reminders'}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-[7px] text-white/85 font-bold">{language === 'ar' ? 'معلّق' : 'pending'}</span>
          <span className="text-[7px] font-bold" style={{ color: taskAccent }}>{activeTab === 'tasks' ? pct : 0}%</span>
          <span className="text-[7px] text-white/85 font-bold">{language === 'ar' ? 'مكتمل' : 'done'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Journal Widget ───────────────────────────────────────────────────────────
const MOOD_EMOJI = ['', '😞', '😕', '😐', '😊', '🤩'];
const MOOD_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#8b5cf6'];
const MOOD_LABEL_EN = ['', 'Awful', 'Bad', 'Meh', 'Good', 'Amazing'];
const MOOD_LABEL_AR = ['', 'سيء جداً', 'سيء', 'عادي', 'جيد', 'رائع'];

function JournalWidget({ shell, navigate, language, journalData }: {
  shell: (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => React.ReactNode;
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

  // Filter history by chart range
  const now = new Date();
  const cutoff = new Date(now);
  if (chartRange === '1m') cutoff.setMonth(now.getMonth() - 1);
  else if (chartRange === '3m') cutoff.setMonth(now.getMonth() - 3);
  else cutoff.setMonth(now.getMonth() - 6);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const filtered = history.filter(e => e.date >= cutoffStr);

  // Mood frequency count for bar chart (moods 1–5)
  const moodCounts = [0, 0, 0, 0, 0, 0]; // index 1–5
  filtered.forEach(e => { if (e.mood >= 1 && e.mood <= 5) moodCounts[e.mood]++; });
  const maxCount = Math.max(...moodCounts.slice(1), 1);

  // Today's note snippet
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
      {/* Header: title + streak badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/20">
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

      {/* Today's entry card */}
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

      {/* Chart range toggle */}
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

      {/* Mini mood bar chart (moods 5 down to 1) */}
      <div className="flex items-end gap-1 h-8">
        {[5,4,3,2,1].map(m => {
          const count = moodCounts[m];
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={m} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
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
  );
}

// ─── Maw3d Widget ─────────────────────────────────────────────────────────────
function Maw3dWidget({ shell, navigate, language, events, attendingCounts }: {
  shell: (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => React.ReactNode;
  navigate: (p: string) => void;
  language: string;
  events: any[];
  attendingCounts: Record<string, number>;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Active events = today or future, sorted soonest first
  const active = events
    .filter(e => { try { return e.event_date >= todayStr; } catch { return false; } })
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 3);

  const next = active[0] ?? null;
  const totalAttending = active.reduce((sum, e) => sum + (attendingCounts[e.id] ?? 0), 0);

  // Background: vibrant blue-purple gradient (event feel)
  const mBg = active.length > 0
    ? 'linear-gradient(145deg,rgba(29,14,80,0.97) 0%,rgba(49,29,120,0.97) 40%,rgba(79,42,160,0.97) 100%)'
    : 'linear-gradient(145deg,rgba(15,10,40,0.97) 0%,rgba(25,18,60,0.97) 100%)';
  const mGlow = active.length > 0 ? '#7c3aed' : '#4b5563';

  // Format event date for display
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.5)' }}>
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

      {/* Active event cards */}
      {active.length > 0 ? (
        <div className="flex flex-col gap-1 flex-1 justify-center my-1">
          {active.map((ev, idx) => {
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
                {/* Date pill */}
                <div className="flex flex-col items-center justify-center rounded-lg px-1.5 py-0.5 flex-shrink-0" style={{ background: 'rgba(124,58,237,0.4)', minWidth: 28 }}>
                  <span className="text-[8px] font-black text-purple-200 leading-tight">{fmtDate(ev.event_date)}</span>
                  {ev.start_time && <span className="text-[6px] text-purple-200 leading-tight tabular-nums">{fmtTime(ev.start_time)}</span>}
                </div>
                {/* Title + RSVP */}
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

      {/* Footer: total RSVP attending */}
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
  );
}

// ─── Calendar Widget (swipeable days strip) ───────────────────────────────────
function CalendarWidget({ shell, navigate, language, upcomingCount }: {
  shell: (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => React.ReactNode;
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
  const selectedDate = days.find(d => d.num === selectedDay) ?? days[1];
  const monthLabel = today.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' });
  const evAccent   = upcomingCount === 0 ? '#fb923c' : upcomingCount <= 3 ? '#f97316' : '#ea580c';

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

      {/* Month + today's big number */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] text-white/90 font-bold uppercase tracking-widest">{monthLabel} {today.getFullYear()}</p>
          <p className="text-3xl font-black text-white leading-none tabular-nums">{today.getDate()}</p>
        </div>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-400/30 text-orange-200 self-start mt-1">
          {language === 'ar' ? 'اليوم' : 'Today'}
        </span>
      </div>

      {/* 2-day strip: yesterday + today */}
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

      {/* Events summary */}
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: evAccent }} />
        <p className="text-[10px] font-semibold text-white/80">
          {upcomingCount === 0
            ? (language === 'ar' ? 'لا أحداث قادمة' : 'No upcoming events')
            : `${upcomingCount} ${language === 'ar' ? 'حدث قادم' : upcomingCount === 1 ? 'upcoming event' : 'upcoming events'}`}
        </p>
      </div>
    </div>
  );
}

// ─── Widget content renderer (no drag logic, just visuals) ────────────────────
function WidgetContent({ wKey, editMode, language, theme, hasBg, statCardBase, pendingTasks, completedToday, upcomingCount, navigate, quoteText, quoteAuthor, whoopData, journalData, reminders, maw3dEvents, attendingCounts }: {
  wKey: WidgetId; editMode: boolean; language: string; theme: string;
  hasBg: boolean; statCardBase: string;
  pendingTasks: number; completedToday: number; upcomingCount: number;
  navigate: (p: string) => void;
  quoteText?: string; quoteAuthor?: string;
  whoopData?: any;
  journalData?: any;
  reminders?: any[];
  maw3dEvents?: any[];
  attendingCounts?: Record<string, number>;
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
  
  // Real WHOOP Data logic
  const recovery = whoopData?.recovery ?? null;
  const strain   = whoopData?.strain ?? null;
  const recColor = recovery ? (recovery >= 67 ? '#22c55e' : recovery >= 34 ? '#f59e0b' : '#ef4444') : '#ef4444';
  
  // Shared widget shell: full-bleed gradient background, rounded corners, glow
  const shell = (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => (
    <div
      onClick={editMode ? undefined : onClick}
      className="rounded-3xl overflow-hidden w-full h-full cursor-pointer active:scale-95 transition-all select-none relative"
      style={{
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: `0 4px 22px ${glow}44, 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)`,
        border: '0.5px solid rgba(180,190,200,0.25)',
      }}
    >
      {/* Background layer — low opacity for see-through liquid glass */}
      <div className="absolute inset-0" style={{ background: bg, opacity: 0.3 }} />
      {/* Frosted glass shimmer overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, transparent 100%)' }} />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );

  if (wKey === 'showTRWidget') {
    return <TRWidget shell={shell} navigate={navigate} language={language} theme={theme} pendingTasks={pendingTasks} completedToday={completedToday} total={total} pct={pct} taskAccent={taskAccent} taskIconBg={taskIconBg} reminders={reminders ?? []} />;
  }

  if (wKey === 'showCalendarWidget') {
    return <CalendarWidget shell={shell} navigate={navigate} language={language} upcomingCount={upcomingCount} />;
  }

  if (wKey === 'showMaw3dWidget') {
    return <Maw3dWidget shell={shell} navigate={navigate} language={language} events={maw3dEvents ?? []} attendingCounts={attendingCounts ?? {}} />;
  }

  if (wKey === '__DEAD_showMaw3dWidget__') return shell(
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
        <p className="text-[15px] font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{language === 'ar' ? 'مواعيد' : 'Maw3d'}</p>
        <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{upcomingCount === 0 ? (language === 'ar' ? 'لا مواعيد 📭' : 'All clear 📭') : upcomingCount <= 2 ? (language === 'ar' ? 'مجدولة ✓' : 'scheduled ✓') : (language === 'ar' ? 'مشغول 🔥' : 'busy 🔥')}</p>
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
        <p className="text-[15px] font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{dayLong}</p>
        <p className="text-[11px] font-semibold mt-0.5 text-white/80" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</p>
      </div>
    </div>
  );

  if (wKey === 'showVitalityWidget') { return <VitalityWidget shell={shell} language={language} navigate={navigate} whoopData={whoopData} />; }

  if (wKey === 'showWhoopWidget_REMOVED') {
    const bgGradient = recovery 
      ? (recovery >= 67 
          ? 'linear-gradient(145deg,rgba(6,78,59,0.7) 0%,rgba(6,95,70,0.7) 40%,rgba(4,120,87,0.7) 100%)' 
          : recovery >= 34 
            ? 'linear-gradient(145deg,rgba(120,53,15,0.7) 0%,rgba(146,64,14,0.7) 40%,rgba(180,83,9,0.7) 100%)' 
            : 'linear-gradient(145deg,rgba(127,29,29,0.7) 0%,rgba(153,27,27,0.7) 40%,rgba(185,28,28,0.7) 100%)')
      : 'rgba(0,0,0,0.7)'; // Default dark background if no data

    return shell(
      bgGradient,
      recColor,
      () => navigate('/fitness'),
      <div className="p-4 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <Activity className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <div className="text-right">
            <span className="text-4xl font-black text-white leading-none tabular-nums" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              {recovery !== null ? `${recovery}%` : '♥'}
            </span>
            {recovery !== null && (
              <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">{language === 'ar' ? 'استشفاء' : 'Recovery'}</p>
            )}
          </div>
        </div>
        {/* Animated EKG-style bar or Strain data */}
        <div>
          {recovery !== null ? (
            <div className="mb-1">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] text-white/70 font-bold uppercase">{language === 'ar' ? 'إجهاد' : 'Strain'}</span>
                <span className="text-[12px] text-white font-bold">{strain !== null ? strain : '--'}</span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white/90 rounded-full" 
                  style={{ width: `${Math.min(((strain || 0) / 21) * 100, 100)}%` }} 
                />
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-0.5 mb-2 h-6">
              {[3,5,2,7,4,8,3,6,2,5,3,4].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${h * 10}%`, background: i === 7 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }} />
              ))}
            </div>
          )}
          <p className="text-[15px] font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>WHOOP</p>
          <p className="text-[11px] font-semibold mt-0.5 text-white/80" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
            {recovery !== null 
              ? (language === 'ar' ? 'تم التحديث' : 'Updated') 
              : (language === 'ar' ? 'الحيوية والنشاط' : 'Vitality & fitness')}
          </p>
        </div>
      </div>
    );
  }

  if (wKey === 'showHealthKitWidget_REMOVED') return shell(
    'linear-gradient(145deg,rgba(22,163,74,0.7) 0%,rgba(34,197,94,0.7) 40%,rgba(74,222,128,0.7) 100%)',
    '#22c55e',
    () => navigate('/fitness'),
    <div className="p-4 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>
          <Heart className="w-6 h-6 text-white" strokeWidth={2.5} fill="white" />
        </div>
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/10">
          <Heart className="w-5 h-5 text-white" strokeWidth={3} />
        </div>
      </div>
      <div>
        <div className="flex gap-1.5 mb-2 items-end h-8">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end gap-1 group">
               <div className="w-full bg-white/40 rounded-t-sm transition-all group-hover:bg-white/60" style={{ height: `${[40,60,30,80,50,90,45][i]}%` }}></div>
               <span className="text-[7px] text-white/60 text-center font-bold">{d}</span>
            </div>
          ))}
        </div>
        <p className="text-[15px] font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{language === 'ar' ? 'صحتي' : 'HealthKit'}</p>
        <p className="text-[11px] font-semibold mt-0.5 text-white/90" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{language === 'ar' ? 'نشاط أبل' : 'Apple Health'}</p>
      </div>
    </div>
  );

  if (wKey === 'showJournalWidget') {
    return <JournalWidget shell={shell} navigate={navigate} language={language} journalData={journalData} />;
  }

  if (wKey === 'showQuoteWidget') return shell(
    'linear-gradient(145deg,rgba(15,23,42,0.97) 0%,rgba(22,32,56,0.97) 40%,rgba(30,41,70,0.97) 100%)',
    '#6366f1',
    () => {},
    <div className="p-2.5 flex flex-col h-full justify-between" key={`${quoteText}-${quoteAuthor}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.4)' }}>
            <span className="text-[12px] leading-none">💬</span>
          </div>
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{language === 'ar' ? 'اقتباس' : 'Quote'}</span>
        </div>
        <div className="flex gap-0.5">
          {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full" style={{ background: `rgba(99,102,241,${0.3 + i * 0.25})` }} />)}
        </div>
      </div>
      {/* Quote body */}
      <div className="relative flex-1 flex flex-col justify-center">
        <span className="absolute top-0 left-0 text-[40px] font-serif leading-none select-none" style={{ color: 'rgba(99,102,241,0.22)', lineHeight: 1 }}>"</span>
        <p
          className="text-[12px] italic leading-snug text-white/90 line-clamp-3 px-3 pt-2"
          style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          {quoteText || '...'}
        </p>
      </div>
      {/* Author pill */}
      <div className="flex justify-end">
        {quoteAuthor && (
          <div className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)' }}>
            <span className="text-[7px] font-bold text-indigo-300">— {quoteAuthor}</span>
          </div>
        )}
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
  whoopData?: any;
  journalData?: any;
  reminders?: any[];
  maw3dEvents?: any[];
  attendingCounts?: Record<string, number>;
}
function UnifiedWidgetCell({ id, wKey, editMode, language, theme, hasBg, statCardBase, statLblColor, pendingTasks, completedToday, upcomingCount, navigate, gridArea, quoteText, quoteAuthor, whoopData, journalData, reminders, maw3dEvents, attendingCounts }: UnifiedWidgetCellProps) {
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
        whoopData={whoopData}
        journalData={journalData}
        reminders={reminders}
        maw3dEvents={maw3dEvents}
        attendingCounts={attendingCounts}
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
      const raw = JSON.parse(localStorage.getItem(LS_DOCK_KEY()) || "null");
      return Array.isArray(raw) ? sanitizeDock(raw) : sanitizeDock(DEFAULT_DOCK);
    } catch { return sanitizeDock(DEFAULT_DOCK); }
  });
  const [iconOrder,       setIconOrder]       = useState<string[]>(() => {
    try {
      const dock = (() => {
        try {
          const raw = JSON.parse(localStorage.getItem(LS_DOCK_KEY()) || "null");
          return Array.isArray(raw) ? sanitizeDock(raw) : DEFAULT_DOCK;
        } catch { return DEFAULT_DOCK; }
      })();
      const raw = JSON.parse(localStorage.getItem(LS_ORDER_KEY()) || "null");
      return sanitizeOrder(Array.isArray(raw) ? raw : DEFAULT_ORDER);
    } catch { return sanitizeOrder(DEFAULT_ORDER); }
  });
  const [showQuote,       setShowQuote]       = useState<boolean>(() => localStorage.getItem(LS_QUOTE_KEY()) !== "false");
  const [bgImage,         setBgImage]         = useState<string>(() => localStorage.getItem(LS_BG_KEY()) || DEFAULT_BG);
  const [headerColor,     setHeaderColor]     = useState<string>(() => localStorage.getItem(LS_HEADER_COLOR_KEY()) || "");

  // Homescreen background style from Settings — cached in localStorage for instant restore
  const [hsBgActive, setHsBgActive] = useState<boolean>(() => localStorage.getItem(lsKey(_cachedUid(), LS_HSBG_ACTIVE_BASE)) === 'true');
  const [hsBg, setHsBg] = useState<{ mode: 'solid'|'gradient'; color1: string; color2: string; color3: string; angle: number; glow: boolean }>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(LS_HSBG_KEY()) || 'null');
      if (cached && typeof cached === 'object') return { mode: cached.mode || 'solid', color1: cached.color1 || '#1a1a2e', color2: cached.color2 || '#4a4a8a', color3: cached.color3 || '', angle: cached.angle ?? 180, glow: typeof cached.glow === 'boolean' ? cached.glow : false };
    } catch {}
    return { mode: 'solid', color1: '#1a1a2e', color2: '#4a4a8a', color3: '', angle: 180, glow: false };
  });
  const [quote,           setQuote]           = useState<any>(null);
  const [greeting,        setGreeting]        = useState(() => {
    const h = new Date().getHours();
    if (language === "ar") return h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور";
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  });
  const [activeId,        setActiveId]        = useState<string | null>(null);
  const [dockPickerOpen,  setDockPickerOpen]  = useState(false);
  const [dockColor,        setDockColor]        = useState<string>(() => { try { return localStorage.getItem(lsKey(_cachedUid(), LS_DOCK_COLOR_BASE)) || ''; } catch { return ''; } });
  const [bgPanelOpen,     setBgPanelOpen]     = useState(false);
  const [bgGradPicker,    setBgGradPicker]    = useState(false);
  const [bgGradLeft,      setBgGradLeft]      = useState<string>(() => { try { return localStorage.getItem(lsKey(_cachedUid(),'hs_grad_left')) || ''; } catch { return ''; } });
  const [bgGradRight,     setBgGradRight]     = useState<string>(() => { try { return localStorage.getItem(lsKey(_cachedUid(),'hs_grad_right')) || ''; } catch { return ''; } });
  const [savedImagesOpen, setSavedImagesOpen] = useState(false);
  const bgInputRef    = useRef<HTMLInputElement>(null);
  const _pendingDock  = useRef<string[]>([]);
  const _effectiveRef = useRef<string[]>([]);
  const _hasLoadedFromSupabase = useRef(false);

  const { tasks, reminders }  = useOptimizedTRData();
  const { events, attendingCounts } = useOptimizedMaw3dEvents();
  const whoopData = useWhoopData();
  const journalData = useJournalData();
  const pendingTasks  = tasks.filter(t => !t.completed).length;
  const upcomingCount = events.filter(e => {
    try { return new Date(e.event_date) >= new Date(new Date().toDateString()); } catch { return false; }
  }).length;

  // Widget visibility for homescreen stats — cached in localStorage for instant restore
  const [hsWidgets, setHsWidgets] = useState(() => {
    const defaults = { showNavWidget: false, showCalendarWidget: true, showTRWidget: true, showMaw3dWidget: false, showVitalityWidget: false, showJournalWidget: false, showQuoteWidget: false };
    try {
      const cached = JSON.parse(localStorage.getItem(LS_WIDGETS_KEY()) || 'null');
      if (cached && typeof cached === 'object') return { ...defaults, ...cached };
    } catch {}
    return defaults;
  });

  // Unified grid: ordered list of "widget::KEY" and "app::ID" items
  const [unifiedGrid, setUnifiedGrid] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_UNIFIED_KEY()) || 'null');
      return Array.isArray(raw) && raw.length > 0 ? raw : [];
    } catch { return []; }
  });

  useEffect(() => {
    const h = new Date().getHours();
    if (language === "ar") setGreeting(h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور");
    else                   setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, [language]);

  // ── Write LS_ACTIVE_USER when user is known so scoped keys resolve correctly ──
  useEffect(() => {
    if (!user?.id) return;
    const prevUid = localStorage.getItem(LS_ACTIVE_USER);
    if (prevUid === user.id) return;
    // Different user — clear ALL old cached keys so they don't bleed through
    if (prevUid) {
      [LS_ORDER_BASE,LS_DOCK_BASE,LS_QUOTE_BASE,LS_BG_BASE,LS_HEADER_COLOR_BASE,LS_UNIFIED_BASE,LS_WIDGETS_BASE,LS_HSBG_BASE]
        .forEach(base => localStorage.removeItem(lsKey(prevUid, base)));
    }
    localStorage.setItem(LS_ACTIVE_USER, user.id);
    _hasLoadedFromSupabase.current = false; // force re-fetch for new user
    // Reset state to defaults so the new user starts clean until Supabase loads
    setDockIds(sanitizeDock(DEFAULT_DOCK));
    setIconOrder(sanitizeOrder(DEFAULT_ORDER));
    setShowQuote(true);
    setBgImage(DEFAULT_BG);
    setHeaderColor("");
    setHsBg({ mode: 'solid', color1: '', color2: '', color3: '', angle: 180, glow: false });
    setHsWidgets({ showNavWidget: false, showCalendarWidget: true, showTRWidget: true, showMaw3dWidget: false, showVitalityWidget: false, showJournalWidget: false, showQuoteWidget: false });
    setUnifiedGrid([]);
  }, [user?.id]);

  useEffect(() => { setQuote(getQuoteForDisplay()); }, []);
  useEffect(() => { if (user?.id) localStorage.setItem(LS_ORDER_KEY(), JSON.stringify(iconOrder)); }, [iconOrder, user?.id]);
  useEffect(() => { if (user?.id) localStorage.setItem(LS_DOCK_KEY(),  JSON.stringify(dockIds));  }, [dockIds, user?.id]);

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
    const VISIBLE: (keyof typeof hsWidgets)[] = ['showCalendarWidget','showTRWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget'];
    let count = 0;
    for (const k of VISIBLE) {
      if (result[k]) { if (count < 3) count++; else result[k] = false; }
    }
    return result;
  };

  useEffect(() => {
    if (!user) return;
    // localStorage is the source of truth — only pull from Supabase if we have NO local data
    const hasLocalWidgets = !!localStorage.getItem(LS_WIDGETS_KEY());
    const hasLocalGrid    = !!localStorage.getItem(LS_UNIFIED_KEY());
    const hasLocalDock    = !!localStorage.getItem(LS_DOCK_KEY());
    if (_hasLoadedFromSupabase.current && (hasLocalWidgets || hasLocalGrid || hasLocalDock)) return;
    _hasLoadedFromSupabase.current = true;
    (async () => {
      try {
        const { data } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
        const s = (data?.settings as any);
        if (s?.homescreenWidgets && !hasLocalWidgets) {
          const clamped = clampHsWidgets({ showNavWidget: false, showCalendarWidget: true, showTRWidget: true, showMaw3dWidget: false, showVitalityWidget: false, showJournalWidget: false, showQuoteWidget: false, ...s.homescreenWidgets });
          // Only update if different
          const clampedJson = JSON.stringify(clamped);
          setHsWidgets(prev => JSON.stringify(prev) === clampedJson ? prev : clamped);
          localStorage.setItem(LS_WIDGETS_KEY(), clampedJson);
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
            const cachedGrid = localStorage.getItem(LS_UNIFIED_KEY());
            if (gridJson !== cachedGrid) {
              setUnifiedGrid(prev => JSON.stringify(prev) === gridJson ? prev : grid);
              localStorage.setItem(LS_UNIFIED_KEY(), gridJson);
            }
          } else if (!localStorage.getItem(LS_UNIFIED_KEY())) {
            const grid = buildDefaultUnifiedGrid(clamped);
            setUnifiedGrid(prev => JSON.stringify(prev) === JSON.stringify(grid) ? prev : grid);
            localStorage.setItem(LS_UNIFIED_KEY(), JSON.stringify(grid));
          }
        }
        if (s?.homescreenBg) {
          const bg = s.homescreenBg;
          const newBg = {
            mode:   bg.mode   === 'gradient' ? 'gradient' : 'solid',
            color1: bg.color1 || '',
            color2: bg.color2 || '',
            color3: bg.color3 || '',
            angle:  typeof bg.angle === 'number' ? bg.angle : 180,
            glow:   typeof bg.glow === 'boolean' ? bg.glow : false,
          };
          const newBgJson = JSON.stringify(newBg);
          setHsBg(prev => JSON.stringify(prev) === newBgJson ? prev : newBg);
          localStorage.setItem(LS_HSBG_KEY(), newBgJson);
        }
        const hs = s?.homescreen;
        if (!hs) return;
        if (Array.isArray(hs.dockIds)) {
          const d = sanitizeDock(hs.dockIds);
          const dJson = JSON.stringify(d);
          const cachedDock = localStorage.getItem(LS_DOCK_KEY());
          if (dJson !== cachedDock) {
            setDockIds(prev => JSON.stringify(prev) === dJson ? prev : d);
            localStorage.setItem(LS_DOCK_KEY(), dJson);
          }
          if (Array.isArray(hs.iconOrder)) {
            const o = sanitizeOrder(hs.iconOrder);
            const oJson = JSON.stringify(o);
            const cachedOrder = localStorage.getItem(LS_ORDER_KEY());
            if (oJson !== cachedOrder) {
              setIconOrder(prev => JSON.stringify(prev) === oJson ? prev : o);
              localStorage.setItem(LS_ORDER_KEY(), oJson);
            }
          }
        } else if (Array.isArray(hs.iconOrder)) {
          const o = sanitizeOrder(hs.iconOrder);
          const oJson = JSON.stringify(o);
          const cachedOrder = localStorage.getItem(LS_ORDER_KEY());
          if (oJson !== cachedOrder) {
            setIconOrder(prev => JSON.stringify(prev) === oJson ? prev : o);
            localStorage.setItem(LS_ORDER_KEY(), oJson);
          }
        }
        if (typeof hs.showQuote === "boolean" && String(hs.showQuote) !== localStorage.getItem(LS_QUOTE_KEY())) { setShowQuote(prev => prev === hs.showQuote ? prev : hs.showQuote); localStorage.setItem(LS_QUOTE_KEY(), String(hs.showQuote)); }
        if (hs.bgImage && hs.bgImage !== localStorage.getItem(LS_BG_KEY())) { setBgImage(prev => prev === hs.bgImage ? prev : hs.bgImage); localStorage.setItem(LS_BG_KEY(), hs.bgImage); }
        if (hs.headerColor && hs.headerColor !== localStorage.getItem(LS_HEADER_COLOR_KEY())) { setHeaderColor(prev => prev === hs.headerColor ? prev : hs.headerColor); localStorage.setItem(LS_HEADER_COLOR_KEY(), hs.headerColor); }
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
        localStorage.setItem(LS_WIDGETS_KEY(), JSON.stringify(next));
        // Sync enabled/disabled widgets into unified grid
        setUnifiedGrid(grid => {
          const enabledWidgets = WIDGET_IDS.filter(k => next[k]).map(k => `widget::${k}`);
          // Remove disabled widget entries
          const withoutDisabled = grid.filter(id => !id.startsWith('widget::') || enabledWidgets.includes(id));
          // Add newly enabled ones at the front if not already present
          const newOnes = enabledWidgets.filter(w => !withoutDisabled.includes(w));
          const updated = [...newOnes, ...withoutDisabled];
          localStorage.setItem(LS_UNIFIED_KEY(), JSON.stringify(updated));
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
      const updated = {
        mode:   d.mode === 'gradient' ? 'gradient' as const : 'solid' as const,
        color1: d.color1 || '',
        color2: d.color2 || '',
        color3: d.color3 || '',
        angle:  typeof d.angle === 'number' ? d.angle : 180,
        glow:   !!d.glow,
      };
      setHsBg(updated);
      localStorage.setItem(LS_HSBG_KEY(), JSON.stringify(updated));
    };
    window.addEventListener('homescreenBgChanged', handler);
    return () => window.removeEventListener('homescreenBgChanged', handler);
  }, []);

  // ── Sensors ──
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
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
      localStorage.setItem(LS_BG_KEY(), url);
      syncToSupabase({ bgImage: url });
    };
    reader.readAsDataURL(file);
  };
  const removeBg = () => { setBgImage(DEFAULT_BG); localStorage.removeItem(LS_BG_KEY()); syncToSupabase({ bgImage: "" }); };
  const saveBgStyle = () => {
    const patch = { mode: hsBg.mode, color1: hsBg.color1, color2: hsBg.color2, color3: hsBg.color3, angle: hsBg.angle, glow: hsBg.glow };
    localStorage.setItem(LS_HSBG_KEY(), JSON.stringify(patch));
    localStorage.setItem(lsKey(_cachedUid(), LS_HSBG_ACTIVE_BASE), 'true');
    setHsBgActive(true);
    // Clear default BG image so custom style shows through
    if (bgImage === DEFAULT_BG) {
      setBgImage('');
      localStorage.removeItem(LS_BG_KEY());
    }
    syncToSupabase({ homescreenBg: patch });
    window.dispatchEvent(new Event('homescreenBgChanged'));
    setBgPanelOpen(false);
  };
  const saveHeaderColor = (color: string) => {
    setHeaderColor(color);
    localStorage.setItem(LS_HEADER_COLOR_KEY(), color);
    syncToSupabase({ headerColor: color });
  };
  const removeHeaderColor = () => {
    setHeaderColor("");
    localStorage.removeItem(LS_HEADER_COLOR_KEY());
    syncToSupabase({ headerColor: "" });
  };
  const toggleQuote = () => {
    const next = !showQuote;
    setShowQuote(next);
    localStorage.setItem(LS_QUOTE_KEY(), String(next));
    syncToSupabase({ showQuote: next });
  };

  const toggleHsWidget = (key: keyof typeof hsWidgets) => {
    setHsWidgets(prev => {
      const VISIBLE: (keyof typeof hsWidgets)[] = ['showCalendarWidget','showTRWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget'];
      const activeCount = VISIBLE.filter(k => prev[k]).length;
      const isOn = prev[key];
      // Enforce max 3 — don't allow enabling if already at 3
      if (!isOn && activeCount >= 3) return prev;
      const next = { ...prev, [key]: !isOn };
      localStorage.setItem(LS_WIDGETS_KEY(), JSON.stringify(next));
      syncToSupabase({ homescreenWidgets: next });
      // Sync unified grid
      setUnifiedGrid(grid => {
        const widgetId = `widget::${key}`;
        if (!isOn) {
          if (grid.includes(widgetId)) return grid;
          const updated = [widgetId, ...grid];
          localStorage.setItem(LS_UNIFIED_KEY(), JSON.stringify(updated));
          return updated;
        } else {
          const updated = grid.filter(id => id !== widgetId);
          localStorage.setItem(LS_UNIFIED_KEY(), JSON.stringify(updated));
          return updated;
        }
      });
      return next;
    });
  };

  const isMobileCallback = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxDockCallback = isMobileCallback ? MAX_DOCK_MOBILE : MAX_DOCK_DESKTOP;

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
        if (prevDock.length < maxDockCallback) {
          nextDock = [...prevDock, id];
        } else {
          const evicted = prevDock[prevDock.length - 1];
          nextDock = [...prevDock.slice(0, maxDockCallback - 1), id];
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

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxDock = isMobile ? MAX_DOCK_MOBILE : MAX_DOCK_DESKTOP;

  const seenDock = new Set<string>();
  const dockApps = dockIds
    .filter(id => VALID_IDS.has(id) && !seenDock.has(id) && (seenDock.add(id), true))
    .map(id => ALL_APPS.find(a => a.id === id))
    .filter(Boolean)
    .slice(0, maxDock) as typeof ALL_APPS;

  const activeApp    = activeId ? (activeId.startsWith('dock::') ? ALL_APPS.find(a => `dock::${a.id}` === activeId) : ALL_APPS.find(a => `app::${a.id}` === activeId)) : null;
  const activeInDock = activeId?.startsWith("dock::");

  const quoteText   = useMemo(() => quote ? getQuoteText(quote, language) : "", [quote, language]);
  const quoteAuthor = useMemo(() => quote ? getQuoteAuthor(quote) : "", [quote]);

  // ── Theme-aware surface colors ──
  const isDark = theme === "dark";
  const hasUserImage = !!bgImage && bgImage !== DEFAULT_BG;
  const hasBg  = hasUserImage || (!!bgImage && !hsBgActive);

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

  // Custom background from Settings (solid/gradient) — only active when user explicitly saved
  const hasCustomBg = hsBgActive && !hasUserImage;
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

  // ── Theme-aware BG gradient: fall back to black (dark) or white (light) if no custom saved value ──
  const gradDefault = isDark ? '#000000' : '#ffffff';
  const effectiveBgGradLeft  = bgGradLeft  || gradDefault;
  const effectiveBgGradRight = bgGradRight || gradDefault;

  // ── BG input id for label linkage ──
  const bgInputId = "hs-bg-input";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <>
      {/* Root — fills parent via flex, dock always at very bottom */}
      <div
        className={`relative overflow-hidden overscroll-none hs-root flex flex-col ${pageBg}`}
        style={{
          ...(hasBg ? {
            backgroundImage: `url(${bgImage}), linear-gradient(to right, ${effectiveBgGradLeft} 0%, ${effectiveBgGradRight} 100%)`,
            backgroundSize: "contain, cover",
            backgroundPosition: "center center, center center",
            backgroundRepeat: "no-repeat, no-repeat",
          } : hasCustomBg ? {
            background: customBgStyle,
          } : {}),
        }}
      >
          {/* 1px BG image blur overlay — only when a BG image is active */}
          {(hasBg || hasCustomBg) && (
            <div className="absolute inset-0 pointer-events-none z-0" style={{ backdropFilter: 'blur(0.5px)', WebkitBackdropFilter: 'blur(0.5px)' }} />
          )}
          <div className="flex-none flex items-center justify-between px-4 pt-3 pb-1">
            <div className="px-3 py-2 rounded-xl bg-black/25 backdrop-blur-md border border-white/10">
              <p className="text-[12px] font-extrabold tracking-wide" style={{ color: subColor, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{greeting}</p>
              <p className="text-[17px] font-semibold leading-tight" style={{ color: headColor, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{displayName}</p>
            </div>
            {!editMode ? (
              <button onClick={() => setEditMode(true)} title="Edit homescreen" className={`p-2 rounded-full backdrop-blur-md border ${isDark ? 'bg-white/15 border-white/20 text-white' : 'bg-[#060541]/15 border-[#060541]/20 text-[#060541]'}`}>
                <Pencil className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => setEditMode(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/80 text-white text-xs font-semibold">
                <Check className="w-3.5 h-3.5" />
                {language === "ar" ? "تم" : "Done"}
              </button>
            )}
          </div>

          {/* ── Edit options bar ── */}
          {editMode && (() => {
            const WIDGET_OPTIONS: { key: keyof typeof hsWidgets; labelEn: string; labelAr: string }[] = [
              { key: 'showTRWidget',       labelEn: 'Tasks',    labelAr: 'المهام'   },
              { key: 'showCalendarWidget', labelEn: 'Calendar', labelAr: 'التقويم' },
              { key: 'showMaw3dWidget',    labelEn: 'Maw3d',    labelAr: 'موعد'    },
              { key: 'showVitalityWidget', labelEn: 'Vitality', labelAr: 'نشاطي'   },
              { key: 'showJournalWidget',  labelEn: 'Journal',  labelAr: 'يومياتي' },
              { key: 'showQuoteWidget',    labelEn: 'Quote',    labelAr: 'اقتباس'  },
            ];
            const activeWidgetCount = WIDGET_OPTIONS.filter(w => hsWidgets[w.key]).length;
            return (
              <div className="flex-none flex flex-col gap-1.5 px-4 pb-2">
                {/* Row 1: Dock / BG / Header color / Restore */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Dock */}
                  <button onClick={() => setDockPickerOpen(true)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md text-[10px] font-semibold border ${isDark ? 'bg-white/15 border-white/20 text-white' : 'bg-[#060541]/15 border-[#060541]/20 text-[#060541]'}`}>
                    <Settings2 className="w-3 h-3" />
                    <span>{language === 'ar' ? 'الدوك' : 'Dock'}</span>
                  </button>
                  {/* BG */}
                  <button onClick={() => setBgPanelOpen(v => !v)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${bgPanelOpen ? 'bg-blue-500/70 border-blue-400/50 text-white' : isDark ? 'bg-white/15 backdrop-blur-md border-white/20 text-white' : 'bg-[#060541]/15 backdrop-blur-md border-[#060541]/20 text-[#060541]'}`}>
                    <ImageIcon className="w-3 h-3" />
                    <span>{language === 'ar' ? 'خلفية' : 'BG'}</span>
                    {bgImage && bgImage !== DEFAULT_BG && <span className="w-1.5 h-1.5 rounded-full bg-blue-300 ml-0.5" />}
                  </button>
                  {/* Remove BG */}
                  {bgImage && bgImage !== DEFAULT_BG && (
                    <button onClick={removeBg}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/60 text-white text-[10px] font-semibold border border-red-400/40">
                      <X className="w-3 h-3" />
                      <span>{language === 'ar' ? 'حذف' : 'Rm BG'}</span>
                    </button>
                  )}
                  {/* Restore Default */}
                  <button
                    title={language === 'ar' ? 'استعادة الإعدادات الافتراضية' : 'Restore defaults'}
                    onClick={() => {
                      const uid = _cachedUid();
                      const DEFAULT_WIDGETS = { showNavWidget: false, showCalendarWidget: true, showTRWidget: true, showMaw3dWidget: false, showVitalityWidget: false, showJournalWidget: false, showQuoteWidget: false };
                      // Reset widgets
                      setHsWidgets(DEFAULT_WIDGETS);
                      localStorage.setItem(LS_WIDGETS_KEY(), JSON.stringify(DEFAULT_WIDGETS));
                      // Reset BG image
                      setBgImage(DEFAULT_BG);
                      localStorage.removeItem(LS_BG_KEY());
                      // Reset header color
                      setHeaderColor('');
                      localStorage.removeItem(LS_HEADER_COLOR_KEY());
                      // Reset BG gradient colors
                      setBgGradLeft('');
                      setBgGradRight('');
                      try { localStorage.removeItem(lsKey(uid,'hs_grad_left')); localStorage.removeItem(lsKey(uid,'hs_grad_right')); } catch {}
                      // Reset custom BG style active flag
                      setHsBgActive(false);
                      try { localStorage.removeItem(lsKey(uid, LS_HSBG_ACTIVE_BASE)); } catch {}
                      // Reset dock color
                      setDockColor('');
                      try { localStorage.removeItem(lsKey(uid, LS_DOCK_COLOR_BASE)); } catch {}
                      // Reset unified grid
                      setUnifiedGrid([]);
                      localStorage.removeItem(LS_UNIFIED_KEY());
                      // Sync
                      syncToSupabase({ bgImage: '', headerColor: '', homescreenWidgets: DEFAULT_WIDGETS });
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-all ${isDark ? 'bg-white/10 border border-white/20 text-white/60 hover:bg-red-500/30 hover:text-white' : 'bg-[#060541]/10 border border-[#060541]/20 text-[#060541]/60 hover:bg-red-500/30 hover:text-[#060541]'}`}>
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>{language === 'ar' ? 'افتراضي' : 'Default'}</span>
                  </button>
                  {/* Header color */}
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md border ${isDark ? 'bg-white/15 border-white/20' : 'bg-[#060541]/15 border-[#060541]/20'}`}>
                    <span className={`text-[10px] font-semibold ${isDark ? 'text-white/70' : 'text-[#060541]/70'}`}>{language === 'ar' ? 'عنوان' : 'Head'}</span>
                    <input type="color" title="Header color" value={headerColor || '#ffffff'} onChange={e => saveHeaderColor(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                    {headerColor && (
                      <button onClick={removeHeaderColor} title={language === 'ar' ? 'إعادة تعيين اللون' : 'Reset color'} className={isDark ? 'text-white/60 hover:text-white' : 'text-[#060541]/60 hover:text-[#060541]'}>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Widget toggles */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-0.5">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-white/50' : 'text-[#060541]/50'}`}>
                      {language === 'ar' ? 'الودجتات' : 'Widgets'}
                    </span>
                    <span className={`text-[9px] font-bold ${activeWidgetCount >= 3 ? 'text-amber-400' : isDark ? 'text-white/40' : 'text-[#060541]/40'}`}>
                      {activeWidgetCount}/3 {language === 'ar' ? 'نشط' : 'active'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {WIDGET_OPTIONS.map(({ key, labelEn, labelAr }) => {
                      const isOn = hsWidgets[key];
                      const isDisabled = !isOn && activeWidgetCount >= 3;
                      return (
                        <button
                          key={key}
                          onClick={() => !isDisabled && toggleHsWidget(key)}
                          className={`flex-1 flex items-center justify-center gap-0.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                            isOn
                              ? 'bg-indigo-500/70 border-indigo-400/50 text-white'
                              : isDisabled
                                ? isDark ? 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed' : 'bg-[#060541]/5 border-[#060541]/10 text-[#060541]/20 cursor-not-allowed'
                                : isDark ? 'bg-white/10 border-white/20 text-white/60' : 'bg-[#060541]/10 border-[#060541]/20 text-[#060541]/60'
                          }`}>
                          {isOn && <Check className="w-2 h-2 flex-shrink-0" />}
                          <span className="truncate">{language === 'ar' ? labelAr : labelEn}</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeWidgetCount >= 3 && (
                    <p className="text-[9px] text-amber-400/80 px-0.5">
                      {language === 'ar' ? '⚠ الحد الأقصى 3 ودجتات. أزل واحدة لإضافة أخرى.' : '⚠ Max 3 widgets. Remove one to add another.'}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── BG Style Panel ── */}
          {editMode && bgPanelOpen && (
            <div className="flex-none mx-3 mb-2 rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/15 p-3 space-y-3 max-h-[50vh] overflow-y-auto">
              {/* Upload photo */}
              <label htmlFor={bgInputId}
                className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl bg-white/10 text-white text-xs font-semibold cursor-pointer">
                <ImageIcon className="w-4 h-4" /> {language === "ar" ? "رفع صورة" : "Upload Photo"}
              </label>

              {/* Pick from Saved Images */}
              <button
                onClick={() => setSavedImagesOpen(true)}
                className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 text-white text-xs font-semibold transition-colors">
                <ImageIcon className="w-4 h-4" /> {language === "ar" ? "اختر من الصور المحفوظة" : "Pick from Saved"}
              </button>

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
          <div className="flex-1 min-h-0 px-3 pb-2 overflow-hidden relative">
            
            {/* Visual Guide exactly matching the user's diagram in edit mode */}
            {editMode && (
              <div className="absolute inset-0 px-3 pt-2 grid gap-x-1 gap-y-2 pointer-events-none" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', gridTemplateAreas: gridTemplateAreas, zIndex: 0 }}>
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
              <div className="grid gap-x-1 gap-y-2 relative z-10 h-full" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', gridTemplateAreas: gridTemplateAreas, alignContent: 'start', paddingTop: 8 }}>
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
                          whoopData={whoopData}
                          journalData={journalData}
                          reminders={reminders}
                          maw3dEvents={events}
                          attendingCounts={attendingCounts}
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
          <div className="mt-auto flex-none mx-2 md:mx-4 lg:mx-6 pt-1 hs-dock-bottom">
            <div
              className="flex items-center justify-around w-full rounded-[2.75rem] py-3 px-5"
              style={{
                background: dockColor
                  ? `linear-gradient(135deg, ${dockColor}ee 0%, ${dockColor}cc 50%, ${dockColor}ee 100%)`
                  : 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 100%), var(--gradient-background)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid transparent',
                backgroundClip: 'padding-box',
                outline: '0.5px solid rgba(180,190,200,0.35)',
                boxShadow: '0 34px 70px -16px rgba(0,0,0,0.4), 0 16px 46px rgba(0,0,0,0.18), 0 0 0 1px rgba(192,200,210,0.45), 0 0 0 2px rgba(255,255,255,0.06)',
              }}
            >
              <SortableContext items={dockApps.map(a => `dock::${a.id}`)} strategy={horizontalListSortingStrategy}>
                {dockApps.map(app => (
                  <DockIcon key={app.id} app={app} editMode={editMode} onTap={() => navigate(app.path)} glowEnabled={hsBg.glow} />
                ))}
                {Array.from({ length: Math.max(0, maxDock - dockApps.length) }).map((_, i) => (
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

        {/* ── Dock picker sheet ── */}
        {dockPickerOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDockPickerOpen(false)} />
            <div className="relative z-10 w-full max-w-lg bg-background rounded-t-3xl p-5 pb-8 shadow-2xl max-h-[70dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">
                  {language === "ar" ? `اختر أيقونات Dock (${maxDock} كحد أقصى)` : `Choose Dock Icons (max ${maxDock})`}
                </h3>
                <span className="text-xs text-muted-foreground">{dockIds.length}/{maxDock}</span>
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
              {/* Dock BG Color */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-border/40 px-3 py-2.5">
                <span className="text-xs font-semibold">{language === 'ar' ? 'لون خلفية الدوك' : 'Dock Background'}</span>
                <div className="flex items-center gap-2">
                  <input type="color" title="Dock background color" value={dockColor || (isDark ? '#0c0f14' : '#060541')} onChange={e => { setDockColor(e.target.value); localStorage.setItem(lsKey(_cachedUid(), LS_DOCK_COLOR_BASE), e.target.value); }}
                    className="w-7 h-7 rounded-lg cursor-pointer border border-border/30 p-0.5 bg-transparent" />
                  {dockColor && (
                    <button onClick={() => { setDockColor(''); localStorage.removeItem(lsKey(_cachedUid(), LS_DOCK_COLOR_BASE)); }}
                      className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 font-semibold">
                      {language === 'ar' ? 'إعادة' : 'Reset'}
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => setDockPickerOpen(false)}
                className="mt-4 w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold">
                {language === "ar" ? "تم" : "Done"}
              </button>
            </div>
          </div>
        )}

        <input ref={bgInputRef} id={bgInputId} type="file" accept="image/*" className="hidden" onChange={handleBgChange} />

        {/* Saved Images Picker Modal */}
        {savedImagesOpen && (
          <SavedImagesPicker
            onSelect={(imageUrl) => {
              setBgImage(imageUrl);
              localStorage.setItem(LS_BG_KEY(), imageUrl);
              syncToSupabase({ bgImage: imageUrl });
            }}
            onClose={() => setSavedImagesOpen(false)}
          />
        )}
      </>
    </DndContext>
  );
}
