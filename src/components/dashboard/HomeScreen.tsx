// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
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
  useDroppable,
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
} from "lucide-react";
import { WaktiIcon } from "@/components/icons/WaktiIcon";
import { getQuoteForDisplay, getQuoteText, getQuoteAuthor } from "@/utils/quoteService";
import { useOptimizedTRData } from "@/hooks/useOptimizedTRData";
import { useOptimizedMaw3dEvents } from "@/hooks/useOptimizedMaw3dEvents";

// ─── App definitions ──────────────────────────────────────────────────────────
const ALL_APPS = [
  { id: "dashboard", nameEn: "Dashboard", nameAr: "الرئيسية",  path: "/dashboard",         icon: LayoutDashboard, gradient: "from-blue-500 to-blue-700",       glow: "#3b82f6" },
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
const DEFAULT_DOCK  = ["wakti-ai", "calendar", "tr"];
const LS_ORDER_KEY  = "homescreen_icon_order_v2"; // v2 — forces clean slate
const LS_DOCK_KEY   = "homescreen_dock_v2";
const LS_QUOTE_KEY  = "homescreen_show_quote";
const LS_BG_KEY     = "homescreen_bg";

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
function LiquidIcon({ app, size = 64, editMode }: {
  app: typeof ALL_APPS[0];
  size?: number;
  editMode: boolean;
}) {
  const px = `${size}px`;
  return (
    <div
      className={`relative flex-shrink-0 ${editMode ? "animate-wiggle" : ""}`}
      style={{ width: px, height: px }}
    >
      {/* Main gradient body */}
      <div
        className={`absolute inset-0 rounded-[23%] bg-gradient-to-br ${app.gradient}`}
        style={{
          boxShadow: `0 4px 16px ${app.glow}55, 0 1px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)`,
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
          <X className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

// ─── Sortable grid icon ────────────────────────────────────────────────────────
function GridIcon({ app, language, editMode, onTap, isDark }: {
  app: typeof ALL_APPS[0];
  language: string;
  editMode: boolean;
  onTap: () => void;
  isDark: boolean;
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
      <LiquidIcon app={app} size={64} editMode={editMode} />
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
function DockIcon({ app, editMode, onTap }: {
  app: typeof ALL_APPS[0];
  editMode: boolean;
  onTap: () => void;
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
      <LiquidIcon app={app} size={58} editMode={editMode} />
    </div>
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
  const [quote,           setQuote]           = useState<any>(null);
  const [greeting,        setGreeting]        = useState("");
  const [activeId,        setActiveId]        = useState<string | null>(null);
  const [dockPickerOpen,  setDockPickerOpen]  = useState(false);
  const bgInputRef    = useRef<HTMLInputElement>(null);
  const _pendingDock  = useRef<string[]>([]);

  const { tasks }  = useOptimizedTRData();
  const { events } = useOptimizedMaw3dEvents();
  const pendingTasks  = tasks.filter(t => !t.completed).length;
  const upcomingCount = events.filter(e => {
    try { return new Date(e.event_date) >= new Date(new Date().toDateString()); } catch { return false; }
  }).length;

  // Widget visibility for homescreen stats — loaded from settings.homescreenWidgets
  const [hsWidgets, setHsWidgets] = useState({
    showNavWidget: true, showCalendarWidget: true, showTRWidget: true,
    showMaw3dWidget: false, showWhoopWidget: false, showJournalWidget: false, showQuoteWidget: false,
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
    const keys = Object.keys(raw) as (keyof typeof hsWidgets)[];
    let count = 0;
    const result = { ...raw } as typeof hsWidgets;
    for (const k of keys) {
      if (result[k]) { if (count < 3) count++; else result[k] = false; }
    }
    return result;
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
        const s = (data?.settings as any);
        if (s?.homescreenWidgets) {
          setHsWidgets(prev => clampHsWidgets({ ...prev, ...s.homescreenWidgets }));
        }
        const hs = s?.homescreen;
        if (!hs) return;
        if (Array.isArray(hs.dockIds)) {
          const d = sanitizeDock(hs.dockIds);
          setDockIds(d);
          localStorage.setItem(LS_DOCK_KEY, JSON.stringify(d));
          if (Array.isArray(hs.iconOrder)) {
            const o = sanitizeOrder(hs.iconOrder);
            setIconOrder(o);
            localStorage.setItem(LS_ORDER_KEY, JSON.stringify(o));
          }
        } else if (Array.isArray(hs.iconOrder)) {
          const o = sanitizeOrder(hs.iconOrder);
          setIconOrder(o);
          localStorage.setItem(LS_ORDER_KEY, JSON.stringify(o));
        }
        if (typeof hs.showQuote === "boolean") { setShowQuote(hs.showQuote); localStorage.setItem(LS_QUOTE_KEY, String(hs.showQuote)); }
        if (hs.bgImage) { setBgImage(hs.bgImage); localStorage.setItem(LS_BG_KEY, hs.bgImage); }
      } catch { /* silent */ }
    })();
  }, [user]);

  // Live update from Settings page widget toggle events
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      if (detail.mode !== 'homescreen') return;
      setHsWidgets(prev => clampHsWidgets({ ...prev, ...detail }));
    };
    window.addEventListener('widgetSettingsChanged', handler);
    return () => window.removeEventListener('widgetSettingsChanged', handler);
  }, []);

  // ── Sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 6 } })
  );

  // ── Unified drag handler (grid ↔ dock swap) ──
  const handleDragStart = (e: any) => setActiveId(e.active.id);
  const handleDragEnd   = useCallback((e: any) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeType  = active.data.current?.type as "grid" | "dock";
    const overType    = over.data.current?.type   as "grid" | "dock" | undefined;
    const activeAppId = active.data.current?.appId as string;
    const overAppId   = over.data.current?.appId   as string;

    if (!activeAppId) return;

    // grid → grid reorder
    if (activeType === "grid" && (overType === "grid" || !overType)) {
      if (!overAppId) return;
      setIconOrder(prev => {
        const next = arrayMove(prev, prev.indexOf(activeAppId), prev.indexOf(overAppId));
        syncToSupabase({ iconOrder: next });
        return next;
      });
      return;
    }

    // dock → dock reorder
    if (activeType === "dock" && overType === "dock") {
      setDockIds(prev => {
        const from = prev.indexOf(activeAppId);
        const to   = prev.indexOf(overAppId);
        if (from === -1 || to === -1) return prev;
        const next = arrayMove(prev, from, to);
        syncToSupabase({ dockIds: next });
        return next;
      });
      return;
    }

    // grid → dock: push into dock, return old dock occupant to grid
    if (activeType === "grid" && overType === "dock") {
      setDockIds(prev => {
        if (prev.includes(activeAppId)) return prev;
        const idx = overAppId ? prev.indexOf(overAppId) : prev.length;
        const next = [...prev];
        const evicted = next.splice(idx, 1, activeAppId)[0];
        // put evicted back into grid order after the active slot
        setIconOrder(order => {
          const newOrder = order.filter(id => id !== activeAppId);
          if (evicted) newOrder.splice(newOrder.indexOf(overAppId) !== -1 ? newOrder.indexOf(overAppId) : newOrder.length, 0, evicted);
          syncToSupabase({ iconOrder: newOrder, dockIds: next });
          return newOrder;
        });
        return next;
      });
      return;
    }

    // dock → grid: remove from dock, insert into grid
    if (activeType === "dock" && overType === "grid") {
      setDockIds(prev => {
        const next = prev.filter(id => id !== activeAppId);
        setIconOrder(order => {
          if (order.includes(activeAppId)) return order;
          const insertAt = overAppId ? order.indexOf(overAppId) : order.length;
          const newOrder = [...order];
          newOrder.splice(insertAt, 0, activeAppId);
          syncToSupabase({ iconOrder: newOrder, dockIds: next });
          return newOrder;
        });
        return next;
      });
      return;
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
  const toggleQuote = () => {
    const next = !showQuote;
    setShowQuote(next);
    localStorage.setItem(LS_QUOTE_KEY, String(next));
    syncToSupabase({ showQuote: next });
  };

  const toggleDockIcon = useCallback((id: string) => {
    setDockIds(prevDock => {
      setIconOrder(prevOrder => {
        let nextDock: string[];
        let nextOrder: string[];

        if (prevDock.includes(id)) {
          // Remove from dock → put back in grid
          nextDock  = prevDock.filter(x => x !== id);
          nextOrder = prevOrder.includes(id) ? prevOrder : [...prevOrder, id];
        } else {
          if (prevDock.length < 3) {
            // Empty slot — just add to dock
            nextDock  = [...prevDock, id];
            nextOrder = prevOrder.filter(x => x !== id);
          } else {
            // Dock full — evict the LAST icon back to grid, put new one in its place
            const evicted = prevDock[prevDock.length - 1];
            nextDock  = [...prevDock.slice(0, 2), id];
            const orderWithoutNew = prevOrder.filter(x => x !== id);
            // Insert evicted at end if not already there
            nextOrder = orderWithoutNew.includes(evicted)
              ? orderWithoutNew
              : [...orderWithoutNew, evicted];
          }
        }

        syncToSupabase({ iconOrder: nextOrder, dockIds: nextDock });
        localStorage.setItem(LS_DOCK_KEY,  JSON.stringify(nextDock));
        localStorage.setItem(LS_ORDER_KEY, JSON.stringify(nextOrder));
        // Return the nextDock to the outer setDockIds via closure
        // We use a ref trick — store it and read outside
        _pendingDock.current = nextDock;
        return nextOrder;
      });
      return _pendingDock.current ?? prevDock;
    });
  }, [syncToSupabase]);

  // ── Derived lists — bulletproof dedup ──
  const dockSet  = new Set(dockIds);
  const seenGrid = new Set<string>();
  const gridApps = iconOrder
    .filter(id => !dockSet.has(id) && VALID_IDS.has(id) && !seenGrid.has(id) && (seenGrid.add(id), true))
    .map(id => ALL_APPS.find(a => a.id === id))
    .filter(Boolean) as typeof ALL_APPS;
  const seenDock = new Set<string>();
  const dockApps = dockIds
    .filter(id => VALID_IDS.has(id) && !seenDock.has(id) && (seenDock.add(id), true))
    .map(id => ALL_APPS.find(a => a.id === id))
    .filter(Boolean) as typeof ALL_APPS;

  const activeApp    = activeId ? ALL_APPS.find(a => `grid::${a.id}` === activeId || `dock::${a.id}` === activeId) : null;
  const activeInDock = activeId?.startsWith("dock::");

  const quoteText   = quote ? getQuoteText(quote, language) : "";
  const quoteAuthor = quote ? getQuoteAuthor(quote) : "";

  // ── Theme-aware surface colors ──
  const isDark = theme === "dark";
  const hasBg  = !!bgImage;

  // Greeting text — always white over BG, theme-sensitive otherwise
  const headColor = hasBg ? "#ffffff" : isDark ? "#f2f2f2" : "#060541";
  const subColor  = hasBg ? "rgba(255,255,255,0.72)" : isDark ? "rgba(242,242,242,0.55)" : "rgba(6,5,65,0.55)";

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

  // Page background — used only when no custom BG
  const pageBg = !hasBg
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

          {/* ── Edit toolbar ── */}
          {editMode && (
            <div className={`flex-none flex items-center justify-between px-3 py-2 ${editBarGlass}`}>
              <button onClick={() => setDockPickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold">
                <Settings2 className="w-3.5 h-3.5" />
                Dock
              </button>
              <div className="flex items-center gap-2">
                <label htmlFor={bgInputId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold cursor-pointer">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {language === "ar" ? "خلفية" : "BG"}
                </label>
                {bgImage && (
                  <button onClick={removeBg} title="Remove BG"
                    className="px-3 py-1.5 rounded-full bg-red-500/70 text-white text-xs font-semibold">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={toggleQuote}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-xs font-semibold ${showQuote ? "bg-purple-500/80" : "bg-white/20"}`}>
                  {language === "ar" ? "اقتباس" : "Quote"}
                  {showQuote && <Check className="w-3 h-3" />}
                </button>
                <button onClick={() => setEditMode(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/80 text-white text-xs font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  {language === "ar" ? "تم" : "Done"}
                </button>
              </div>
            </div>
          )}

          {/* ── Stats — driven by hsWidgets ── */}
          {(() => {
            const ALL_STATS = [
              { key: 'showTRWidget',       labelEn: 'Tasks',   labelAr: 'مهام',    value: pendingTasks,         accent: '#22c55e' },
              { key: 'showCalendarWidget', labelEn: 'Events',  labelAr: 'أحداث',   value: upcomingCount,        accent: '#a855f7' },
              { key: 'showMaw3dWidget',    labelEn: 'Maw3d',   labelAr: 'مواعيد',  value: upcomingCount,        accent: '#f59e0b' },
              { key: 'showNavWidget',      labelEn: 'Today',   labelAr: 'اليوم',   value: new Date().getDate(), accent: '#38bdf8' },
              { key: 'showWhoopWidget',    labelEn: 'WHOOP',   labelAr: 'ووب',     value: 0,                    accent: '#ef4444' },
              { key: 'showJournalWidget',  labelEn: 'Journal', labelAr: 'يوميات',  value: new Date().getDate(), accent: '#8b5cf6' },
            ] as const;
            const visible = ALL_STATS.filter(s => hsWidgets[s.key as keyof typeof hsWidgets]);
            if (visible.length === 0) return null;
            return (
              <div className={`flex-none grid gap-2 px-5 pt-3 mb-3`} style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}>
                {visible.map(s => (
                  <div key={s.key} className={`${statCardBase} rounded-2xl p-3 text-center`}>
                    <div className={`text-xl font-bold ${statNumBase}`} style={{ color: s.accent }}>{s.value}</div>
                    <div className="text-[10px] font-medium mt-0.5" style={{ color: statLblColor }}>
                      {language === 'ar' ? s.labelAr : s.labelEn}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Icon grid — flex-1 fills all remaining space, NO scroll ── */}
          <div className="flex-1 min-h-0 px-5 overflow-hidden">
            <SortableContext items={gridApps.map(a => `grid::${a.id}`)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 h-full" style={{ alignContent: "space-evenly", paddingBottom: 4 }}>
                {gridApps.map(app => (
                  <div key={app.id} className="flex justify-center items-center">
                    <GridIcon app={app} language={language} editMode={editMode} onTap={() => navigate(app.path)} isDark={isDark || hasBg} />
                  </div>
                ))}
              </div>
            </SortableContext>
          </div>

          {/* ── Quote — above dock, only if enabled ── */}
          {showQuote && quote && (
            <div className="flex-none px-5 mb-2">
              <div className={`${quoteGlass} rounded-2xl px-4 py-2.5`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">
                  {language === "ar" ? "اقتباس اليوم" : "Daily Quote"}
                </p>
                <p className="text-[11px] italic leading-snug" style={{ color: quoteTextColor }} dir={language === "ar" ? "rtl" : "ltr"}>
                  "{quoteText}"
                </p>
                <p className="text-[10px] mt-1" style={{ color: quoteAuthorColor }}>— {quoteAuthor}</p>
              </div>
            </div>
          )}

          {/* ── DOCK — always at very bottom ── */}
          <div className="mt-auto flex-none px-4 pt-1 hs-dock-bottom">
            <div className={`flex items-center justify-around ${dockGlass} rounded-[28px] py-3 px-5`}>
              <SortableContext items={dockApps.map(a => `dock::${a.id}`)} strategy={horizontalListSortingStrategy}>
                {dockApps.map(app => (
                  <DockIcon key={app.id} app={app} editMode={editMode} onTap={() => navigate(app.path)} />
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
              <LiquidIcon app={activeApp} size={activeInDock ? 58 : 64} editMode={false} />
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
