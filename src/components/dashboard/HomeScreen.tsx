// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { emitEvent, onEvent } from "@/utils/eventBus";
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
  MessageCircle,
  Mail,
  HelpCircle,
  Settings,
} from "lucide-react";
import { WaktiIcon } from "@/components/icons/WaktiIcon";
import { getQuoteForDisplay, getQuoteText, getQuoteAuthor } from "@/utils/quoteService";
import { getTodayHealthSummary, getSleepAnalysis, isHealthKitSDKAvailable } from "@/integrations/natively/healthkitBridge";
import { useOptimizedTRData } from "@/hooks/useOptimizedTRData";
import { useOptimizedMaw3dEvents } from "@/hooks/useOptimizedMaw3dEvents";
import { useWhoopData } from "@/hooks/useWhoopData";
import { useJournalData } from "@/hooks/useJournalData";
import { useUserProfile } from "@/hooks/useUserProfile";
import { SavedImagesPicker } from "@/components/dashboard/SavedImagesPicker";
import { toast } from "sonner";
import { getScopedStorageItem, migrateLegacyScopedStorage, removeScopedStorageItem, setActiveScopedUserId, setScopedStorageItem } from "@/utils/userScopedStorage";

// ─── App definitions ──────────────────────────────────────────────────────────
 const ALL_APPS = [
  { id: "calendar",  nameEn: "Calendar",  nameAr: "التقويم",   path: "/calendar",           icon: Calendar,        gradient: "from-sky-400 to-sky-600",         glow: "#38bdf8" },
  { id: "journal",   nameEn: "Journal",   nameAr: "المذكرات",  path: "/journal",            icon: NotebookPen,     gradient: "from-pink-500 to-rose-600",       glow: "#ec4899" },
  { id: "maw3d",     nameEn: "Maw3d",     nameAr: "مواعيد",   path: "/maw3d",              icon: CalendarClock,   gradient: "from-purple-500 to-purple-700",   glow: "#a855f7" },
  { id: "tr",        nameEn: "T & R",     nameAr: "م & ت",    path: "/tr",                 icon: ListTodo,        gradient: "from-green-500 to-emerald-600",   glow: "#22c55e" },
  { id: "wakti-ai",  nameEn: "WAKTI AI",  nameAr: "WAKTI AI", path: "/wakti-ai",           icon: Sparkles,        gradient: "from-orange-500 to-amber-400",    glow: "#f97316" },
  { id: "studio",    nameEn: "Studio",    nameAr: "الاستوديو", path: "/music",              icon: Aperture,        gradient: "from-fuchsia-500 to-violet-600",  glow: "#d946ef" },
  { id: "vitality",  nameEn: "Vitality",  nameAr: "الحيوية",  path: "/fitness",            icon: null,            gradient: "from-rose-500 to-red-600",        glow: "#f43f5e", isWaktiIcon: true },
  { id: "warranty",  nameEn: "My Files",  nameAr: "ملفاتي",   path: "/my-warranty",        icon: FolderOpen,      gradient: "from-emerald-400 to-emerald-600", glow: "#10b981" },
  { id: "projects",  nameEn: "Projects",  nameAr: "مشاريع",   path: "/projects",           icon: Code2,           gradient: "from-indigo-500 to-indigo-700",   glow: "#6366f1" },
  { id: "text",      nameEn: "Text",      nameAr: "نص",       path: "/tools/text",         icon: PenTool,         gradient: "from-violet-500 to-violet-700",   glow: "#8b5cf6" },
  { id: "email",     nameEn: "Email",     nameAr: "البريد",    path: "/tools/email",        icon: Mail,            gradient: "from-[#E9CEB0] to-[#060541]",     glow: "#E9CEB0" },
  { id: "voice",     nameEn: "Voice",     nameAr: "صوت",      path: "/tools/voice-studio", icon: Mic,             gradient: "from-pink-400 to-pink-600",       glow: "#f472b6" },
  { id: "game",      nameEn: "Game",      nameAr: "لعبة",     path: "/tools/game",         icon: Gamepad2,        gradient: "from-red-500 to-red-700",         glow: "#ef4444" },
  { id: "social",    nameEn: "Social",    nameAr: "التواصل",  path: "/social",             icon: MessageCircle,   gradient: "from-cyan-500 to-blue-600",       glow: "#38bdf8" },
  { id: "account",   nameEn: "Account",   nameAr: "حسابي",    path: "/account",            icon: Users,           gradient: "from-slate-500 to-slate-700",     glow: "#94a3b8", isAvatarIcon: true },
  { id: "settings",  nameEn: "Settings",  nameAr: "الإعدادات", path: "/settings",           icon: Settings,        gradient: "from-blue-400 to-indigo-600",     glow: "#60a5fa" },
  { id: "help",      nameEn: "Help",      nameAr: "المساعدة",  path: "/help",               icon: HelpCircle,      gradient: "from-green-400 to-emerald-600",   glow: "#34d399" },
  { id: "deen",      nameEn: "Deen",      nameAr: "دين",      path: "/deen",               icon: BookOpen,        gradient: "from-sky-500 to-indigo-600",      glow: "#38bdf8" },
];

const DEFAULT_ORDER = ALL_APPS.map(a => a.id);
const DEFAULT_DOCK  = ["wakti-ai", "calendar", "tr", "maw3d", "journal"];
const MAX_DOCK_MOBILE  = 3;
const MAX_DOCK_DESKTOP = 3;
const FIRST_PAGE_MAX_ICONS = 12;
const ICONS_PER_OVERFLOW_PAGE = 24;
const PAGE_BREAK_ID = '__page_break__';
// ── Per-user localStorage key helpers ─────────────────────────────────────────
// Keys are scoped to the logged-in user so different accounts on the same browser
// never bleed their homescreen data into each other.
const DEFAULT_BG_DARK  = "/wakti-image-1773608945903.jpg"; // default dark mode wallpaper
const DEFAULT_BG_LIGHT = "/wakti-image-1774727385038.jpg"; // default light mode wallpaper
const DEFAULT_BG = DEFAULT_BG_DARK; // fallback constant (used outside component)
const LS_ACTIVE_USER = "homescreen_active_uid"; // meta key tracking who is cached
const lsKey = (uid: string, base: string) => `${base}__${uid}`;
const LS_ORDER_BASE        = "homescreen_icon_order_v2";
const LS_DOCK_BASE         = "homescreen_dock_v2";
const LS_QUOTE_BASE        = "homescreen_show_quote";
const LS_BG_BASE           = "homescreen_bg";
const LS_BG_POS_Y_BASE     = "homescreen_bg_pos_y";
const LS_HEADER_COLOR_BASE = "homescreen_header_color";
const LS_UNIFIED_BASE      = "homescreen_unified_grid_v6";
const LS_LAYOUT_BASE       = "homescreen_layout_v1";
const LS_WIDGETS_BASE      = "homescreen_widgets_v1";
const LS_WIDGET_SIZES_BASE = "homescreen_widget_sizes_v1";
const LS_HSBG_BASE         = "homescreen_bg_style_v1";
const LS_HSBG_ACTIVE_BASE  = "homescreen_bg_style_active";
const LS_BG_CHOICE_BASE    = "homescreen_bg_choice_v1";
const LS_DOCK_COLOR_BASE   = "homescreen_dock_color";
const LS_SNAPSHOT_BASE     = "homescreen_snapshot_v1";

// Read the currently-cached user ID (set on login) so useState initialisers can
// immediately read the correct user-scoped key before useEffect fires.
const _cachedUid = () => localStorage.getItem(LS_ACTIVE_USER) || "";
const LS_ORDER_KEY        = () => lsKey(_cachedUid(), LS_ORDER_BASE);
const LS_DOCK_KEY         = () => lsKey(_cachedUid(), LS_DOCK_BASE);
const LS_QUOTE_KEY        = () => lsKey(_cachedUid(), LS_QUOTE_BASE);
const LS_BG_KEY           = () => lsKey(_cachedUid(), LS_BG_BASE);
const LS_BG_POS_Y_KEY     = () => lsKey(_cachedUid(), LS_BG_POS_Y_BASE);
const LS_HEADER_COLOR_KEY = () => lsKey(_cachedUid(), LS_HEADER_COLOR_BASE);
const LS_UNIFIED_KEY      = () => lsKey(_cachedUid(), LS_UNIFIED_BASE);
const LS_LAYOUT_KEY       = () => lsKey(_cachedUid(), LS_LAYOUT_BASE);
const LS_WIDGETS_KEY      = () => lsKey(_cachedUid(), LS_WIDGETS_BASE);
const LS_WIDGET_SIZES_KEY = () => lsKey(_cachedUid(), LS_WIDGET_SIZES_BASE);
const LS_HSBG_KEY         = () => lsKey(_cachedUid(), LS_HSBG_BASE);
const LS_BG_CHOICE_KEY    = () => lsKey(_cachedUid(), LS_BG_CHOICE_BASE);
const LS_SNAPSHOT_KEY     = () => lsKey(_cachedUid(), LS_SNAPSHOT_BASE);

// Widget IDs used in the unified grid
const WIDGET_IDS = ['showTRWidget','showCalendarWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget'] as const;
type WidgetId = typeof WIDGET_IDS[number];
const MAX_WIDGETS = 4;
const GRID_COLS = 4;
const GRID_ROWS = 6;
const MAX_PAGES = 2;
const EDGE_PAGE_SWITCH_THRESHOLD = 60;
const EDGE_PAGE_SWITCH_DELAY = 500;
type BgChoice = 'default' | 'wallpaper' | 'style';
const isBgChoiceValue = (value: unknown): value is BgChoice => value === 'default' || value === 'wallpaper' || value === 'style';
const isDefaultBgAsset = (value?: string | null) => !value || value === DEFAULT_BG_DARK || value === DEFAULT_BG_LIGHT;
const DEFAULT_HS_WIDGETS = { showNavWidget: false, showCalendarWidget: true, showTRWidget: true, showMaw3dWidget: false, showVitalityWidget: false, showJournalWidget: false, showQuoteWidget: false };
const normalizeHexColor = (hex: string) => {
  const trimmed = hex.trim().replace('#', '');
  if (!trimmed) return null;
  const normalized = trimmed.length === 3
    ? trimmed.split('').map((char) => `${char}${char}`).join('')
    : trimmed.padEnd(6, '0').slice(0, 6);
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : null;
};
const hexToRgb = (hex: string) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};
const rgbaFromHex = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};
const getHexLuminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const normalize = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
  };
  const r = normalize(rgb.r);
  const g = normalize(rgb.g);
  const b = normalize(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

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

const ICONS_ONLY_TEMPLATE_AREAS = `
  "i1 i2 i3 i4"
  "i5 i6 i7 i8"
  "i9 i10 i11 i12"
  "i13 i14 i15 i16"
  "i17 i18 i19 i20"
  "i21 i22 i23 i24"
`;

function buildIconsOnlyPage(items: string[]) {
  const effectiveItems = Array.from({ length: ICONS_PER_OVERFLOW_PAGE }, (_, index) => items[index] || `empty-i::${index + 1}`);
  const gridPositions = new Map<string, string>();
  effectiveItems.forEach((id, index) => {
    gridPositions.set(id, `i${index + 1}`);
  });
  return {
    effectiveItems,
    realItems: effectiveItems.filter(id => !id.startsWith('empty-')),
    gridTemplateAreas: ICONS_ONLY_TEMPLATE_AREAS,
    gridPositions,
  };
}

function isAppleMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function isLargeSurfaceMobileDevice() {
  if (typeof window !== 'undefined') {
    const narrowViewport = window.innerWidth <= 820;
    const coarsePointer = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    const touchCapable = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    if (narrowViewport && (coarsePointer || touchCapable)) return true;
  }
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
}

// Calculate explicit grid positions ("parking spots") for each item as area strings
// Handles widget::, app::, and empty:: items
function calcGridPositions(items: string[]) {
  const positions = new Map<string, string>();
  let wIndex = 1;
  let iIndex = 1;
  
  for (const id of items) {
    if (id.startsWith('widget::') || id.startsWith('empty-w::')) {
      if (wIndex <= MAX_WIDGETS) {
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

function splitUnifiedPages(items: string[]) {
  const pages: string[][] = [[]];
  for (const id of items) {
    if (id === PAGE_BREAK_ID) {
      if (pages[pages.length - 1].length > 0) pages.push([]);
      continue;
    }
    pages[pages.length - 1].push(id);
  }
  return pages.filter((page, index) => page.length > 0 || index === 0);
}

function flattenUnifiedPages(pages: string[][]) {
  const normalized = pages
    .map(page => page.filter(Boolean))
    .filter((page, index) => page.length > 0 || index === 0);
  return normalized.flatMap((page, index) => index === 0 ? page : [PAGE_BREAK_ID, ...page]);
}

type HomescreenLayoutItem = {
  id: string;
  page: number;
  col: number;
  row: number;
  w: number;
  h: number;
};

type HomescreenPageData = {
  index: number;
  items: HomescreenLayoutItem[];
  effectiveItems: string[];
  gridPositions: Map<string, string>;
  itemMap: Map<string, HomescreenLayoutItem>;
};

type HomescreenSnapshot = {
  dockIds: string[];
  iconOrder: string[];
  showQuote: boolean;
  bgImage: string;
  bgPositionY: number;
  headerColor: string;
  bgChoice: BgChoice;
  hsBgActive: boolean;
  hsBg: { mode: 'solid'|'gradient'; color1: string; color2: string; color3: string; angle: number; glow: boolean };
  dockColor: string;
  bgGradLeft: string;
  bgGradRight: string;
  hsWidgets: Record<string, boolean>;
  hsWidgetSizes: Record<string, 'big' | 'small'>;
  unifiedGrid: string[];
  homescreenLayout: HomescreenLayoutItem[];
};

function createDefaultHomescreenSnapshot(themeMode: string): HomescreenSnapshot {
  const dockIds = sanitizeDock(DEFAULT_DOCK, MAX_DOCK_DESKTOP);
  const iconOrder = sanitizeOrder(DEFAULT_ORDER);
  const hsWidgets = { ...DEFAULT_HS_WIDGETS };
  const hsWidgetSizes: Record<string, 'big' | 'small'> = {};
  const unifiedGrid = buildDefaultUnifiedGrid(hsWidgets, dockIds);
  const homescreenLayout = normalizeHomescreenLayout(
    buildLayoutFromLegacy(unifiedGrid, hsWidgets, hsWidgetSizes, dockIds),
    hsWidgets,
    hsWidgetSizes,
    dockIds,
  );
  return {
    dockIds,
    iconOrder,
    showQuote: true,
    bgImage: themeMode === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK,
    bgPositionY: 50,
    headerColor: '',
    bgChoice: 'default',
    hsBgActive: false,
    hsBg: { mode: 'solid', color1: '', color2: '', color3: '', angle: 180, glow: false },
    dockColor: '',
    bgGradLeft: '',
    bgGradRight: '',
    hsWidgets,
    hsWidgetSizes,
    unifiedGrid,
    homescreenLayout,
  };
}

function getItemFootprint(id: string, widgetSizes: Record<string, 'big' | 'small'> = {}) {
  if (id.startsWith('widget::')) {
    const key = id.replace('widget::', '');
    return widgetSizes[key] === 'small' ? { w: 2, h: 2 } : { w: 4, h: 2 };
  }
  return { w: 1, h: 1 };
}

function clampLayoutItem(item: HomescreenLayoutItem, widgetSizes: Record<string, 'big' | 'small'> = {}): HomescreenLayoutItem {
  const span = getItemFootprint(item.id, widgetSizes);
  return {
    id: item.id,
    page: Math.max(0, Math.min(MAX_PAGES - 1, Number.isFinite(item.page) ? item.page : 0)),
    col: Math.max(0, Math.min(GRID_COLS - span.w, Number.isFinite(item.col) ? item.col : 0)),
    row: Math.max(0, Math.min(GRID_ROWS - span.h, Number.isFinite(item.row) ? item.row : 0)),
    w: span.w,
    h: span.h,
  };
}

function layoutItemsOverlap(a: HomescreenLayoutItem, b: HomescreenLayoutItem) {
  if (a.page !== b.page) return false;
  return a.col < b.col + b.w && a.col + a.w > b.col && a.row < b.row + b.h && a.row + a.h > b.row;
}

function canPlaceLayoutItem(
  layout: HomescreenLayoutItem[],
  candidate: HomescreenLayoutItem,
  widgetSizes: Record<string, 'big' | 'small'> = {},
  ignoreIds: string[] = []
) {
  const next = clampLayoutItem(candidate, widgetSizes);
  if (next.col + next.w > GRID_COLS || next.row + next.h > GRID_ROWS) return false;
  for (const raw of layout) {
    if (!raw || raw.id === next.id || ignoreIds.includes(raw.id)) continue;
    const existing = clampLayoutItem(raw, widgetSizes);
    if (layoutItemsOverlap(next, existing)) return false;
  }
  return true;
}

function findFirstOpenPosition(
  layout: HomescreenLayoutItem[],
  id: string,
  page: number,
  widgetSizes: Record<string, 'big' | 'small'> = {}
) {
  const span = getItemFootprint(id, widgetSizes);
  for (let row = 0; row <= GRID_ROWS - span.h; row++) {
    for (let col = 0; col <= GRID_COLS - span.w; col++) {
      const candidate = { id, page, col, row, w: span.w, h: span.h };
      if (canPlaceLayoutItem(layout, candidate, widgetSizes, [id])) return candidate;
    }
  }
  return null;
}

function findAllOpenPositions(
  layout: HomescreenLayoutItem[],
  id: string,
  page: number,
  widgetSizes: Record<string, 'big' | 'small'> = {}
) {
  const span = getItemFootprint(id, widgetSizes);
  const positions: HomescreenLayoutItem[] = [];
  for (let row = 0; row <= GRID_ROWS - span.h; row++) {
    for (let col = 0; col <= GRID_COLS - span.w; col++) {
      const candidate = { id, page, col, row, w: span.w, h: span.h };
      if (canPlaceLayoutItem(layout, candidate, widgetSizes, [id])) {
        positions.push(candidate);
      }
    }
  }
  return positions;
}

function canSwapLayoutItems(
  layout: HomescreenLayoutItem[],
  activeItem: HomescreenLayoutItem,
  targetItem: HomescreenLayoutItem,
  widgetSizes: Record<string, 'big' | 'small'> = {}
) {
  const activeIsWidget = activeItem.id.startsWith('widget::');
  const targetIsWidget = targetItem.id.startsWith('widget::');
  const activeIsApp = activeItem.id.startsWith('app::');
  const targetIsApp = targetItem.id.startsWith('app::');
  if (!((activeIsWidget && targetIsWidget) || (activeIsApp && targetIsApp))) return false;
  const layoutWithoutBoth = layout.filter(item => item.id !== activeItem.id && item.id !== targetItem.id);
  const activeAtTarget = clampLayoutItem({
    ...activeItem,
    page: targetItem.page,
    row: targetItem.row,
    col: targetItem.col,
  }, widgetSizes);
  const targetAtActive = clampLayoutItem({
    ...targetItem,
    page: activeItem.page,
    row: activeItem.row,
    col: activeItem.col,
  }, widgetSizes);
  if (!canPlaceLayoutItem(layoutWithoutBoth, activeAtTarget, widgetSizes, [activeItem.id, targetItem.id])) return false;
  if (!canPlaceLayoutItem(layoutWithoutBoth, targetAtActive, widgetSizes, [activeItem.id, targetItem.id])) return false;
  return true;
}

function findValidSwapTargets(
  layout: HomescreenLayoutItem[],
  activeItem: HomescreenLayoutItem,
  widgetSizes: Record<string, 'big' | 'small'> = {}
) {
  return layout
    .filter(item => item.page === activeItem.page && item.id !== activeItem.id)
    .filter(item => canSwapLayoutItems(layout, activeItem, item, widgetSizes));
}

function getBulkPlacementPriority(
  itemOrId: HomescreenLayoutItem | string,
  widgetSizes: Record<string, 'big' | 'small'> = {}
) {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  if (id.startsWith('widget::')) {
    const widgetKey = id.replace('widget::', '') as WidgetId;
    return widgetSizes[widgetKey] === 'big' ? 0 : 1;
  }
  return 2;
}

function autoPackLayoutItems(
  layout: HomescreenLayoutItem[],
  itemIds: string[],
  targetPage: number,
  widgetSizes: Record<string, 'big' | 'small'> = {}
) {
  const selectedSet = new Set(itemIds);
  const selectedItems = layout.filter(item => selectedSet.has(item.id));
  if (selectedItems.length !== itemIds.length) return null;
  const orderedItems = [...selectedItems].sort((a, b) => {
    return getBulkPlacementPriority(a, widgetSizes) - getBulkPlacementPriority(b, widgetSizes)
      || a.page - b.page
      || a.row - b.row
      || a.col - b.col;
  });
  const layoutWithoutSelected = layout.filter(item => !selectedSet.has(item.id));
  const workingLayout = [...layoutWithoutSelected];
  const placedItems: HomescreenLayoutItem[] = [];
  for (const item of orderedItems) {
    const nextSpot = findFirstOpenPosition(workingLayout, item.id, targetPage, widgetSizes);
    if (!nextSpot) return null;
    workingLayout.push(nextSpot);
    placedItems.push(nextSpot);
  }
  return {
    selectedItems,
    placedItems,
    nextLayout: [...layoutWithoutSelected, ...placedItems],
  };
}

function extractLegacyPages(sourceGrid: string[], enabledWidgets: Set<string>, dockSet: Set<string>) {
  const seen = new Set<string>();
  const pages: string[][] = [[]];
  for (const id of sourceGrid) {
    if (id === PAGE_BREAK_ID) {
      if (pages[pages.length - 1].length > 0 && pages.length < MAX_PAGES) pages.push([]);
      continue;
    }
    if (seen.has(id)) continue;
    if (id.startsWith('widget::')) {
      if (!enabledWidgets.has(id)) continue;
    } else if (id.startsWith('app::')) {
      const appId = id.replace('app::', '');
      if (!VALID_IDS.has(appId) || dockSet.has(appId)) continue;
    } else {
      continue;
    }
    seen.add(id);
    pages[pages.length - 1].push(id);
  }
  return pages;
}

function buildLayoutFromLegacy(
  sourceGrid: string[],
  hsWidgets: Record<string, boolean>,
  widgetSizes: Record<string, 'big' | 'small'> = {},
  dockIds: string[] = []
) {
  const enabledWidgets = new Set(WIDGET_IDS.filter(k => hsWidgets[k]).map(k => `widget::${k}`));
  const dockSet = new Set(dockIds);
  const pages = extractLegacyPages(sourceGrid.length > 0 ? sourceGrid : buildDefaultUnifiedGrid(hsWidgets, dockIds), enabledWidgets, dockSet);
  const layout: HomescreenLayoutItem[] = [];
  const seen = new Set<string>();
  const placeItem = (id: string, preferredPages: number[]) => {
    if (seen.has(id)) return;
    for (const page of preferredPages) {
      const spot = findFirstOpenPosition(layout, id, page, widgetSizes);
      if (spot) {
        layout.push(spot);
        seen.add(id);
        return;
      }
    }
  };
  pages.slice(0, MAX_PAGES).forEach((page, pageIndex) => {
    page.forEach(id => placeItem(id, [pageIndex, pageIndex === 0 ? 1 : 0]));
  });
  for (const widgetId of Array.from(enabledWidgets)) {
    if (!seen.has(widgetId)) placeItem(widgetId, [0, 1]);
  }
  for (const appId of DEFAULT_ORDER) {
    const id = `app::${appId}`;
    if (!dockSet.has(appId) && !seen.has(id)) placeItem(id, [0, 1]);
  }
  return layout;
}

function normalizeHomescreenLayout(
  rawLayout: HomescreenLayoutItem[],
  hsWidgets: Record<string, boolean>,
  widgetSizes: Record<string, 'big' | 'small'> = {},
  dockIds: string[] = []
) {
  const enabledWidgets = new Set(WIDGET_IDS.filter(k => hsWidgets[k]).map(k => `widget::${k}`));
  const dockSet = new Set(dockIds);
  const layout: HomescreenLayoutItem[] = [];
  const seen = new Set<string>();
  const input = Array.isArray(rawLayout) ? rawLayout : [];
  for (const item of input) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) continue;
    if (item.id.startsWith('widget::')) {
      if (!enabledWidgets.has(item.id)) continue;
    } else if (item.id.startsWith('app::')) {
      const appId = item.id.replace('app::', '');
      if (!VALID_IDS.has(appId) || dockSet.has(appId)) continue;
    } else {
      continue;
    }
    const candidate = clampLayoutItem(item, widgetSizes);
    const placed = canPlaceLayoutItem(layout, candidate, widgetSizes, [candidate.id])
      ? candidate
      : findFirstOpenPosition(layout, candidate.id, candidate.page, widgetSizes)
        || findFirstOpenPosition(layout, candidate.id, 0, widgetSizes)
        || findFirstOpenPosition(layout, candidate.id, 1, widgetSizes);
    if (!placed) continue;
    layout.push(placed);
    seen.add(candidate.id);
  }
  for (const widgetId of Array.from(enabledWidgets)) {
    if (seen.has(widgetId)) continue;
    const spot = findFirstOpenPosition(layout, widgetId, 0, widgetSizes) || findFirstOpenPosition(layout, widgetId, 1, widgetSizes);
    if (!spot) continue;
    layout.push(spot);
    seen.add(widgetId);
  }
  for (const appId of DEFAULT_ORDER) {
    const id = `app::${appId}`;
    if (dockSet.has(appId) || seen.has(id)) continue;
    const spot = findFirstOpenPosition(layout, id, 0, widgetSizes) || findFirstOpenPosition(layout, id, 1, widgetSizes);
    if (!spot) continue;
    layout.push(spot);
    seen.add(id);
  }
  return layout;
}

function layoutToUnifiedGrid(layout: HomescreenLayoutItem[]) {
  const pages = Array.from({ length: MAX_PAGES }, () => [] as HomescreenLayoutItem[]);
  for (const item of layout) {
    pages[Math.max(0, Math.min(MAX_PAGES - 1, item.page))].push(item);
  }
  return flattenUnifiedPages(
    pages
      .map(page => page.sort((a, b) => a.row - b.row || a.col - b.col).map(item => item.id))
      .filter((page, index) => page.length > 0 || index === 0)
  );
}

function buildPageDataFromLayout(layout: HomescreenLayoutItem[], pageIndex: number): HomescreenPageData {
  const items = layout
    .filter(item => item.page === pageIndex)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const effectiveItems: string[] = [];
  const gridPositions = new Map<string, string>();
  const itemMap = new Map<string, HomescreenLayoutItem>();
  const occupancy = Array.from({ length: GRID_ROWS }, () => Array<string | null>(GRID_COLS).fill(null));
  for (const item of items) {
    itemMap.set(item.id, item);
    effectiveItems.push(item.id);
    gridPositions.set(item.id, `${item.row + 1} / ${item.col + 1} / span ${item.h} / span ${item.w}`);
    for (let row = item.row; row < item.row + item.h; row++) {
      for (let col = item.col; col < item.col + item.w; col++) {
        occupancy[row][col] = item.id;
      }
    }
  }
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (occupancy[row][col]) continue;
      const emptyId = `empty::${pageIndex}:${row}:${col}`;
      effectiveItems.push(emptyId);
      gridPositions.set(emptyId, `${row + 1} / ${col + 1} / span 1 / span 1`);
    }
  }
  return { index: pageIndex, items, effectiveItems, gridPositions, itemMap };
}

function buildHomescreenPage(pageItems: string[], widgetSizes: Record<string, 'big' | 'small'> = {}) {
  // ─── Grid: 4 cols × 6 rows always (3 slots × 2 rows each) ───────────────
  //
  // Items processed IN ORDER — no forced grouping. Free placement.
  //
  // Slot assignment based on item type AND widget size preference:
  //   widget 'big'   → BIG   (full row: 4 cols × 2 rows)
  //   widget 'small' + next is small widget → PAIR (each 2 cols × 2 rows)
  //   widget 'small' + next are apps → MIXED (widget left 2 cols + 4 icons right 2 cols)
  //   widget 'small' alone → BIG (fallback)
  //   consecutive apps → ICONS (up to 8, 4 cols × 2 rows)
  //
  // Max 3 slots per page. Anything beyond overflows.
  // ─────────────────────────────────────────────────────────────────────────

  type Slot =
    | { kind: 'BIG';   w: string }
    | { kind: 'HALF';  w: string }           // small widget alone — left 2 cols, right 2 cols empty
    | { kind: 'PAIR';  w1: string; w2: string }
    | { kind: 'MIXED'; w: string; icons: string[] }
    | { kind: 'ICONS'; icons: string[] };

  const real = pageItems.filter(id => id.startsWith('widget::') || id.startsWith('app::'));
  const slots: Slot[] = [];
  const overflowItems: string[] = [];

  let i = 0;
  while (i < real.length) {
    if (slots.length >= 3) {
      overflowItems.push(...real.slice(i));
      break;
    }
    const id = real[i];
    if (id.startsWith('widget::')) {
      const wKey = id.replace('widget::', '');
      const size = widgetSizes[wKey] ?? 'big';
      if (size === 'small') {
        // Look ahead: find the NEXT widget anywhere after i (skip over icons)
        let partnerIdx = -1;
        for (let k = i + 1; k < real.length; k++) {
          if (real[k].startsWith('widget::')) {
            const pSize = widgetSizes[real[k].replace('widget::','')] ?? 'big';
            if (pSize === 'small') partnerIdx = k;
            break; // stop at first widget found regardless
          }
        }

        if (partnerIdx !== -1) {
          // PAIR: collect icons between i and partnerIdx into a separate ICONS slot
          const betweenIcons = real.slice(i + 1, partnerIdx).filter(x => x.startsWith('app::'));
          slots.push({ kind: 'PAIR', w1: id, w2: real[partnerIdx] });
          // The icons between them go into the next available slot
          if (betweenIcons.length > 0 && slots.length < 3) {
            slots.push({ kind: 'ICONS', icons: betweenIcons });
          }
          i = partnerIdx + 1;
        } else {
          // No small partner found — check if icons follow for MIXED
          const nextId = i + 1 < real.length ? real[i + 1] : null;
          if (nextId && nextId.startsWith('app::')) {
            const mixedIcons: string[] = [];
            let j = i + 1;
            while (j < real.length && real[j].startsWith('app::') && mixedIcons.length < 4) {
              mixedIcons.push(real[j++]);
            }
            slots.push({ kind: 'MIXED', w: id, icons: mixedIcons });
            i = j;
          } else {
            // Alone — render as HALF (2 cols widget + 2 cols empty)
            slots.push({ kind: 'HALF', w: id });
            i += 1;
          }
        }
      } else {
        // big → always full row
        slots.push({ kind: 'BIG', w: id });
        i += 1;
      }
    } else {
      // Collect consecutive apps into one ICONS slot (up to 8)
      const icons: string[] = [];
      while (i < real.length && real[i].startsWith('app::') && icons.length < 8) {
        icons.push(real[i++]);
      }
      slots.push({ kind: 'ICONS', icons });
    }
  }

  // savedItems preserves input order (no re-sort)
  const savedItems = real.slice(0, real.length - overflowItems.length);

  // Build grid
  const effectiveItems: string[] = [];
  const gridPositions            = new Map<string, string>();
  const gridRows: string[]       = [];
  let wIdx = 1, iIdx = 1, emptyIIdx = 1;

  for (const slot of slots) {
    if (slot.kind === 'BIG') {
      const n = `w${wIdx++}`;
      gridPositions.set(slot.w, n);
      effectiveItems.push(slot.w);
      gridRows.push(`${n} ${n} ${n} ${n}`);
      gridRows.push(`${n} ${n} ${n} ${n}`);

    } else if (slot.kind === 'HALF') {
      // Small widget: left 2 cols × 2 rows; right 2 cols = 4 empty icon slots
      const wn = `w${wIdx++}`;
      gridPositions.set(slot.w, wn);
      effectiveItems.push(slot.w);
      const ids = [0,1,2,3].map(() => `empty-i::${emptyIIdx++}`);
      const ns  = ids.map(() => `i${iIdx++}`);
      ids.forEach((id, k) => { gridPositions.set(id, ns[k]); effectiveItems.push(id); });
      gridRows.push(`${wn} ${wn} ${ns[0]} ${ns[1]}`);
      gridRows.push(`${wn} ${wn} ${ns[2]} ${ns[3]}`);

    } else if (slot.kind === 'PAIR') {
      const n1 = `w${wIdx++}`, n2 = `w${wIdx++}`;
      gridPositions.set(slot.w1, n1);
      gridPositions.set(slot.w2, n2);
      effectiveItems.push(slot.w1, slot.w2);
      gridRows.push(`${n1} ${n1} ${n2} ${n2}`);
      gridRows.push(`${n1} ${n1} ${n2} ${n2}`);

    } else if (slot.kind === 'MIXED') {
      // Small widget (left 2 cols) + 4 icons (right 2 cols)
      const wn = `w${wIdx++}`;
      gridPositions.set(slot.w, wn);
      effectiveItems.push(slot.w);
      const iNames: string[] = [];
      for (let k = 0; k < 4; k++) {
        const id = slot.icons[k] ?? `empty-i::${emptyIIdx++}`;
        const name = `i${iIdx++}`;
        gridPositions.set(id, name);
        effectiveItems.push(id);
        iNames.push(name);
      }
      gridRows.push(`${wn} ${wn} ${iNames[0]} ${iNames[1]}`);
      gridRows.push(`${wn} ${wn} ${iNames[2]} ${iNames[3]}`);

    } else {
      const names: string[] = [];
      for (let k = 0; k < 8; k++) {
        const id   = slot.icons[k] ?? `empty-i::${emptyIIdx++}`;
        const name = `i${iIdx++}`;
        gridPositions.set(id, name);
        effectiveItems.push(id);
        names.push(name);
      }
      gridRows.push(`${names[0]} ${names[1]} ${names[2]} ${names[3]}`);
      gridRows.push(`${names[4]} ${names[5]} ${names[6]} ${names[7]}`);
    }
  }

  // Pad to exactly 6 rows
  while (gridRows.length < 6) {
    const names: string[] = [];
    for (let k = 0; k < 8; k++) {
      const id = `empty-i::${emptyIIdx++}`, name = `i${iIdx++}`;
      gridPositions.set(id, name);
      effectiveItems.push(id);
      names.push(name);
    }
    gridRows.push(`${names[0]} ${names[1]} ${names[2]} ${names[3]}`);
    gridRows.push(`${names[4]} ${names[5]} ${names[6]} ${names[7]}`);
  }

  const gridTemplateAreas = gridRows.slice(0, 6).map(r => `"${r}"`).join('\n');

  return { savedItems, overflowItems, effectiveItems,
    realItems: effectiveItems.filter(id => !id.startsWith('empty-')),
    gridTemplateAreas, gridPositions };
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

function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('wallpaper_image_load_failed'));
    };
    img.src = objectUrl;
  });
}

async function prepareWallpaperUpload(file: File) {
  const fallbackExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const fallbackType = file.type || 'image/jpeg';
  if (!fallbackType.startsWith('image/')) {
    return { body: file, ext: fallbackExt, contentType: fallbackType };
  }
  try {
    const img = await loadBlobImage(file);
    const srcWidth = img.naturalWidth || img.width;
    const srcHeight = img.naturalHeight || img.height;
    if (!srcWidth || !srcHeight) {
      return { body: file, ext: fallbackExt, contentType: fallbackType };
    }
    const maxDimension = 2048;
    const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      return { body: file, ext: fallbackExt, contentType: fallbackType };
    }
    context.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) {
      return { body: file, ext: fallbackExt, contentType: fallbackType };
    }
    return { body: blob, ext: 'jpg', contentType: 'image/jpeg' };
  } catch {
    return { body: file, ext: fallbackExt, contentType: fallbackType };
  }
}

// ─── Liquid-glass icon shell ───────────────────────────────────────────────────
// The shimmer highlight on the top edge + soft inner glow gives real iOS 26 "liquid glass"
function LiquidIcon({ app, size = 64, editMode, glowEnabled = false, avatarUrl, badgeCount = 0, variant = "dock" }: {
  app: typeof ALL_APPS[0];
  size?: number;
  editMode: boolean;
  glowEnabled?: boolean;
  avatarUrl?: string;
  badgeCount?: number;
  variant?: "grid" | "dock";
}) {
  const px = `${size}px`;
  const isGridVariant = variant === "grid";
  const isDockVariant = variant === "dock";
  const shellRadius = isGridVariant ? '27%' : '30%';
  const iconScale = app.isAvatarIcon ? 1 : isGridVariant ? (isAppleMobileDevice() ? 0.42 : 0.46) : (isAppleMobileDevice() ? 0.44 : 0.48);
  const isAppleMobile = isAppleMobileDevice();
  const iconInset = app.isAvatarIcon ? '0%' : isGridVariant ? (isAppleMobile ? '10%' : '8%') : (isAppleMobile ? '12%' : '10%');
  const mixHexWithWhite = (hex: string, whiteRatio = 0.82) => {
    const normalized = hex.replace('#', '');
    const safe = normalized.length === 3
      ? normalized.split('').map((char) => `${char}${char}`).join('')
      : normalized.padEnd(6, 'f').slice(0, 6);
    const toChannel = (start: number) => Number.parseInt(safe.slice(start, start + 2), 16);
    const mixChannel = (value: number) => Math.round(value * (1 - whiteRatio) + 255 * whiteRatio);
    return `rgb(${mixChannel(toChannel(0))}, ${mixChannel(toChannel(2))}, ${mixChannel(toChannel(4))})`;
  };
  const iconWhiteRatio = isAppleMobile
    ? isGridVariant ? 0.18 : 0.22
    : isGridVariant ? 0.18 : 0.22;
  const iconTint = mixHexWithWhite(app.glow, iconWhiteRatio);
  const iconFilter = isGridVariant
    ? `drop-shadow(0 1px 2px rgba(255,255,255,${isAppleMobile ? '0.014' : '0.015'})) drop-shadow(0 4px 8px rgba(0,0,0,${isAppleMobile ? '0.2' : '0.24'})) drop-shadow(0 0 ${isAppleMobile ? '6px' : '7px'} ${app.glow}${isAppleMobile ? '18' : '18'})`
    : `drop-shadow(0 1px 2px rgba(255,255,255,${isAppleMobile ? '0.01' : '0.012'})) drop-shadow(0 3px 7px rgba(0,0,0,${isAppleMobile ? '0.18' : '0.22'})) drop-shadow(0 0 ${isAppleMobile ? '5px' : '6px'} ${app.glow}${isAppleMobile ? '14' : '14'})`;
  const glassShadow = glowEnabled
    ? isGridVariant
      ? `0 24px 46px -18px rgba(4,10,24,${isAppleMobile ? '0.42' : '0.76'}), 0 10px 22px rgba(0,0,0,${isAppleMobile ? '0.14' : '0.32'}), 0 0 ${isAppleMobile ? '16px' : '18px'} ${app.glow}${isAppleMobile ? '24' : '28'}, inset 0 1.5px 0 rgba(255,255,255,${isAppleMobile ? '0.16' : '0.18'}), inset 0 -16px 24px rgba(255,255,255,${isAppleMobile ? '0.018' : '0.025'})`
      : `0 10px 24px -16px rgba(4,10,24,${isAppleMobile ? '0.28' : '0.54'}), 0 4px 12px rgba(0,0,0,${isAppleMobile ? '0.08' : '0.16'}), 0 0 ${isAppleMobile ? '8px' : '10px'} ${app.glow}${isAppleMobile ? '14' : '16'}, inset 0 1px 0 rgba(255,255,255,${isAppleMobile ? '0.14' : '0.16'}), inset 0 -14px 22px rgba(255,255,255,${isAppleMobile ? '0.016' : '0.02'})`
    : isGridVariant
      ? `0 22px 42px -18px rgba(4,10,24,${isAppleMobile ? '0.38' : '0.7'}), 0 8px 20px rgba(0,0,0,${isAppleMobile ? '0.12' : '0.28'}), 0 0 ${isAppleMobile ? '10px' : '12px'} ${app.glow}${isAppleMobile ? '12' : '16'}, inset 0 1px 0 rgba(255,255,255,${isAppleMobile ? '0.14' : '0.16'}), inset 0 -16px 22px rgba(255,255,255,${isAppleMobile ? '0.016' : '0.025'})`
      : `0 8px 18px -14px rgba(4,10,24,${isAppleMobile ? '0.22' : '0.44'}), 0 3px 10px rgba(0,0,0,${isAppleMobile ? '0.06' : '0.14'}), 0 0 ${isAppleMobile ? '5px' : '6px'} ${app.glow}${isAppleMobile ? '0e' : '0e'}, inset 0 1px 0 rgba(255,255,255,${isAppleMobile ? '0.12' : '0.14'}), inset 0 -12px 18px rgba(255,255,255,${isAppleMobile ? '0.014' : '0.02'})`;
  const shellFill = isGridVariant
    ? `linear-gradient(180deg, rgba(255,255,255,${isAppleMobile ? '0.125' : '0.15'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.04' : '0.055'}) 18%, rgba(255,255,255,${isAppleMobile ? '0.012' : '0.02'}) 100%), linear-gradient(135deg, ${app.glow}${isAppleMobile ? '0c' : '16'} 0%, rgba(255,255,255,${isAppleMobile ? '0.018' : '0.02'}) 58%, rgba(255,255,255,${isAppleMobile ? '0.005' : '0.006'}) 100%), rgba(255,255,255,${isAppleMobile ? '0.014' : '0.035'})`
    : `linear-gradient(180deg, rgba(255,255,255,${isAppleMobile ? '0.15' : '0.18'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.05' : '0.07'}) 24%, rgba(255,255,255,${isAppleMobile ? '0.016' : '0.025'}) 100%), radial-gradient(circle at 32% 14%, rgba(255,255,255,${isAppleMobile ? '0.075' : '0.1'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.018' : '0.025'}) 34%, transparent 62%), linear-gradient(135deg, ${app.glow}${isAppleMobile ? '0f' : '10'} 0%, rgba(255,255,255,${isAppleMobile ? '0.016' : '0.02'}) 56%, rgba(255,255,255,${isAppleMobile ? '0.006' : '0.008'}) 100%), rgba(255,255,255,${isAppleMobile ? '0.018' : '0.045'})`;
  return (
    <div
      className={`relative flex-shrink-0 ${editMode ? "animate-wiggle" : ""}`}
      style={{ width: px, height: px }}
    >
      {/* Main gradient body with iOS-style frosted glass */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: shellRadius,
          background: shellFill,
          backdropFilter: isGridVariant ? `blur(${isAppleMobile ? '28px' : '30px'}) saturate(${isAppleMobile ? '180%' : '190%'})` : `blur(${isAppleMobile ? '28px' : '30px'}) saturate(${isAppleMobile ? '170%' : '170%'})`,
          WebkitBackdropFilter: isGridVariant ? `blur(${isAppleMobile ? '28px' : '30px'}) saturate(${isAppleMobile ? '180%' : '190%'})` : `blur(${isAppleMobile ? '28px' : '30px'}) saturate(${isAppleMobile ? '170%' : '170%'})`,
          boxShadow: glassShadow,
          border: isGridVariant ? `1px solid rgba(255,255,255,${isAppleMobile ? '0.12' : '0.16'})` : `1px solid rgba(255,255,255,${isAppleMobile ? '0.13' : '0.18'})`,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          borderRadius: shellRadius,
          background: isGridVariant
            ? `linear-gradient(165deg, rgba(255,255,255,${isAppleMobile ? '0.2' : '0.24'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.06' : '0.08'}) 16%, rgba(255,255,255,${isAppleMobile ? '0.02' : '0.03'}) 34%, rgba(255,255,255,${isAppleMobile ? '0.008' : '0.01'}) 52%, transparent 70%)`
            : `linear-gradient(160deg, rgba(255,255,255,${isAppleMobile ? '0.22' : '0.28'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.06' : '0.09'}) 20%, rgba(255,255,255,${isAppleMobile ? '0.02' : '0.03'}) 44%, transparent 74%)`,
          mixBlendMode: 'screen',
        }}
      />
      {isDockVariant && (
        <div
          className="absolute pointer-events-none"
          style={{
            inset: '8% 10% 50% 10%',
            borderRadius: '999px',
            background: `linear-gradient(180deg, rgba(255,255,255,${isAppleMobile ? '0.1' : '0.14'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.02' : '0.03'}) 100%)`,
            filter: 'blur(4px)',
            opacity: isAppleMobile ? 0.38 : 0.36,
          }}
        />
      )}
      {isDockVariant && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: '16%',
            right: '16%',
            bottom: '8%',
            height: '24%',
            borderRadius: '999px',
            background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${isAppleMobile ? '0.055' : '0.08'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.012' : '0.02'}) 54%, transparent 100%)`,
            filter: 'blur(10px)',
            opacity: isAppleMobile ? 0.32 : 0.34,
          }}
        />
      )}

      {isGridVariant && (
        <div
          className="absolute pointer-events-none"
          style={{
            inset: '7% 11% 52% 11%',
            borderRadius: '999px',
            background: `linear-gradient(180deg, rgba(255,255,255,${isAppleMobile ? '0.11' : '0.16'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.025' : '0.04'}) 100%)`,
            filter: 'blur(3px)',
            opacity: isAppleMobile ? 0.42 : 0.44,
          }}
        />
      )}
      {isGridVariant && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: '12%',
            right: '12%',
            bottom: '10%',
            height: '22%',
            borderRadius: '999px',
            background: `linear-gradient(90deg, rgba(255,255,255,${isAppleMobile ? '0.045' : '0.06'}) 0%, rgba(255,255,255,${isAppleMobile ? '0.012' : '0.018'}) 35%, rgba(255,255,255,${isAppleMobile ? '0.035' : '0.05'}) 100%)`,
            filter: 'blur(10px)',
            opacity: isAppleMobile ? 0.32 : 0.34,
          }}
        />
      )}

      <div className="absolute inset-0 flex items-center justify-center"
        style={{ borderRadius: shellRadius, overflow: app.isAvatarIcon ? 'hidden' : 'visible' }}>
        {app.isAvatarIcon && avatarUrl
          ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" style={{ transform: isGridVariant ? 'scale(1.03)' : undefined }} />
          : app.isWaktiIcon
            ? <div className="absolute flex items-center justify-center" style={{ inset: iconInset, overflow: 'visible' }}><WaktiIcon style={{ width: size * iconScale, height: size * iconScale, color: iconTint, filter: iconFilter, opacity: 1 }} /></div>
            : app.icon && <div className="absolute flex items-center justify-center" style={{ inset: iconInset, overflow: 'visible' }}><app.icon style={{ width: size * iconScale, height: size * iconScale, color: iconTint, filter: iconFilter, opacity: 1 }} strokeWidth={1.8} /></div>
        }
      </div>
      {/* Notification badge */}
      {!editMode && badgeCount > 0 && (
        <div className="absolute -top-1 -right-1 z-20 min-w-[18px] h-[18px] rounded-full bg-red-500 border-2 border-white flex items-center justify-center shadow-lg">
          <span className="text-white font-bold leading-none" style={{ fontSize: 10 }}>{badgeCount > 99 ? '99+' : badgeCount}</span>
        </div>
      )}
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
function GridIcon({ app, language, editMode, onTap, isDark, glowEnabled = false, avatarUrl, badgeCount = 0 }: {
  app: typeof ALL_APPS[0];
  language: string;
  editMode: boolean;
  onTap: () => void;
  isDark: boolean;
  glowEnabled?: boolean;
  avatarUrl?: string;
  badgeCount?: number;
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
      <LiquidIcon app={app} size={64} editMode={editMode} glowEnabled={glowEnabled} avatarUrl={avatarUrl} badgeCount={badgeCount} variant="grid" />
      <span
        className="text-[11px] font-bold text-center leading-tight text-white px-2 py-0.5 rounded-md"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 100%)',
          backdropFilter: 'blur(18px) saturate(175%)',
          WebkitBackdropFilter: 'blur(18px) saturate(175%)',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.24)',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          maxWidth: 76,
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
function DockIcon({ app, editMode, onTap, glowEnabled = false, avatarUrl, badgeCount = 0, dockColor }: {
  app: typeof ALL_APPS[0];
  editMode: boolean;
  onTap: () => void;
  glowEnabled?: boolean;
  avatarUrl?: string;
  badgeCount?: number;
  dockColor?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `dock::${app.id}`,
    data: { type: "dock", appId: app.id },
  });
  const dockTint = dockColor || '';
  const hasDockTint = !!dockTint;
  const dockTintIsDark = hasDockTint ? getHexLuminance(dockTint) < 0.32 : true;
  const embeddedTopFill = hasDockTint
    ? `linear-gradient(180deg, ${rgbaFromHex(dockTint, dockTintIsDark ? 0.18 : 0.09)} 0%, rgba(255,255,255,0.015) 100%)`
    : 'linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.025) 100%)';
  const embeddedBottomFill = hasDockTint
    ? `radial-gradient(circle at 50% 50%, ${rgbaFromHex(dockTint, dockTintIsDark ? 0.14 : 0.08)} 0%, rgba(255,255,255,0.025) 58%, transparent 100%)`
    : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.025) 60%, transparent 100%)';

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
      className="relative flex items-center justify-center w-[72px] h-[72px] select-none cursor-pointer"
      onClick={editMode ? undefined : onTap}
    >
      <div
        className="absolute inset-x-[8%] top-[10%] bottom-[12%] pointer-events-none"
        style={{
          borderRadius: '30%',
          background: embeddedTopFill,
          filter: 'blur(12px)',
          opacity: hasDockTint && dockTintIsDark ? 0.68 : 0.8,
        }}
      />
      <div
        className="absolute left-[18%] right-[18%] bottom-[10%] h-[24%] pointer-events-none"
        style={{
          borderRadius: '999px',
          background: embeddedBottomFill,
          filter: 'blur(10px)',
          opacity: hasDockTint && dockTintIsDark ? 0.72 : 0.88,
        }}
      />
      <LiquidIcon app={app} size={56} editMode={editMode} glowEnabled={glowEnabled} avatarUrl={avatarUrl} badgeCount={badgeCount} variant="dock" />
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
              <p className="text-[9px] font-semibold mt-0.5" style={{ color: maw3dAccent }}>
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
            <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-white" strokeWidth={2} fill="rgba(255,255,255,0.4)" />
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
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.4)' }}>
              <BookOpen className="w-3 h-3 text-white" strokeWidth={2.5} />
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
    () => (getScopedStorageItem('vitality_widget_tab', undefined, 'vitality_widget_tab') as 'whoop' | 'healthkit') || 'whoop'
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
  const bgHealth   = 'linear-gradient(145deg,rgba(10,60,40,0.97) 0%,rgba(15,90,60,0.97) 50%,rgba(20,110,70,0.97) 100%)';
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
          onClick={(e) => { e.stopPropagation(); setActiveTab(t => { const next = t === 'whoop' ? 'healthkit' : 'whoop'; setScopedStorageItem('vitality_widget_tab', next); return next; }); }}
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
          <span className="text-[7px] font-black" style={{ color: taskAccent }}>{total}</span>
          <span className="text-[20px] font-black leading-none tabular-nums" style={{ color: taskAccent }}>{total}</span>
        </div>
        <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
          <span className="text-[7px] font-bold" style={{ color: taskAccent }}>{language === 'ar' ? 'مكتمل' : 'Done'}</span>
          <span className="text-[20px] font-black leading-none tabular-nums" style={{ color: taskAccent }}>{completedToday}</span>
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
          <span className="text-[7px] text-white/85 uppercase font-bold">
            {language === 'ar' ? 'معلّق' : 'pending'}
          </span>
          <span className="text-[7px] font-bold" style={{ color: taskAccent }}>{activeTab === 'tasks' ? pct : 0}%</span>
          <span className="text-[7px] text-white/85 uppercase font-bold">
            {language === 'ar' ? 'مكتمل' : 'done'}
          </span>
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
            ? (language === 'ar' ? 'لا أحداث' : 'No upcoming events')
            : `${upcomingCount} ${language === 'ar' ? 'حدث قادم' : upcomingCount === 1 ? 'upcoming event' : 'upcoming events'}`}
        </p>
      </div>
    </div>
  );
}

// ─── Widget content renderer (no drag logic, just visuals) ────────────────────
function WidgetContent({ wKey, editMode, language, theme, hasBg, statCardBase, statLblColor, pendingTasks, completedToday, upcomingCount, navigate, quoteText, quoteAuthor, whoopData, journalData, reminders, maw3dEvents, attendingCounts, onExpandQuote, bulkSelectionActive = false, isBulkSelected = false, onBulkSelectToggle }: {
  wKey: WidgetId; editMode: boolean; language: string; theme: string;
  hasBg: boolean; statCardBase: string; statLblColor: string;
  pendingTasks: number; completedToday: number; upcomingCount: number;
  navigate: (p: string) => void;
  quoteText?: string; quoteAuthor?: string;
  whoopData?: any;
  journalData?: any;
  reminders?: any[];
  maw3dEvents?: any[];
  attendingCounts?: Record<string, number>;
  onExpandQuote?: () => void;
  bulkSelectionActive?: boolean;
  isBulkSelected?: boolean;
  onBulkSelectToggle?: () => void;
}) {
  const isDark = theme === 'dark';
  const now = new Date();
  const dayNum = now.getDate();
  const dayLong = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' });
  const monthShort = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' });
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
  const subColor    = statLblColor;
  const recovery = whoopData?.recovery ?? null;
  const strain   = whoopData?.strain ?? null;
  const recColor = recovery ? (recovery >= 67 ? '#22c55e' : recovery >= 34 ? '#f59e0b' : '#ef4444') : '#ef4444';
  const isMobileGlass = isLargeSurfaceMobileDevice();
  const isAppleLargeSurface = isMobileGlass && isAppleMobileDevice();

  const shell = (bg: string, glow: string, onClick: () => void, children: React.ReactNode) => (
    <div
      onClick={editMode || bulkSelectionActive ? undefined : onClick}
      className="rounded-3xl overflow-hidden w-full h-full cursor-pointer active:scale-95 transition-all select-none relative"
      style={{
        background: hasBg
          ? isAppleLargeSurface
            ? 'linear-gradient(180deg, rgba(8,12,20,0.16) 0%, rgba(8,12,20,0.09) 100%), linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)'
            : isMobileGlass
            ? 'linear-gradient(180deg, rgba(8,12,20,0.24) 0%, rgba(8,12,20,0.16) 100%), linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 100%)'
          : isAppleLargeSurface
            ? 'linear-gradient(180deg, rgba(8,12,20,0.11) 0%, rgba(8,12,20,0.06) 100%), linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
            : isMobileGlass
            ? 'linear-gradient(180deg, rgba(8,12,20,0.18) 0%, rgba(8,12,20,0.11) 100%), linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.1) 100%)',
        backdropFilter: hasBg
          ? `blur(${isAppleLargeSurface ? '24px' : isMobileGlass ? '22px' : '30px'}) saturate(${isAppleLargeSurface ? '145%' : isMobileGlass ? '138%' : '170%'})`
          : `blur(${isAppleLargeSurface ? '22px' : isMobileGlass ? '20px' : '24px'}) saturate(${isAppleLargeSurface ? '138%' : isMobileGlass ? '130%' : '155%'})`,
        WebkitBackdropFilter: hasBg
          ? `blur(${isAppleLargeSurface ? '24px' : isMobileGlass ? '22px' : '30px'}) saturate(${isAppleLargeSurface ? '145%' : isMobileGlass ? '138%' : '170%'})`
          : `blur(${isAppleLargeSurface ? '22px' : isMobileGlass ? '20px' : '24px'}) saturate(${isAppleLargeSurface ? '138%' : isMobileGlass ? '130%' : '155%'})`,
        boxShadow: hasBg
          ? isAppleLargeSurface
            ? `0 14px 28px rgba(0,0,0,0.16), 0 5px 14px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -14px 22px rgba(255,255,255,0.018)`
            : isMobileGlass
            ? `0 18px 42px rgba(0,0,0,0.26), 0 8px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -18px 28px rgba(255,255,255,0.016)`
            : `0 18px 42px rgba(0,0,0,0.26), 0 8px 20px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -18px 28px rgba(255,255,255,0.04)`
          : isAppleLargeSurface
            ? `0 12px 24px rgba(0,0,0,0.14), 0 0 12px ${glow}12, inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -14px 22px rgba(255,255,255,0.016)`
            : isMobileGlass
            ? `0 16px 38px rgba(0,0,0,0.24), 0 0 14px ${glow}14, inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -16px 24px rgba(255,255,255,0.016)`
            : `0 16px 38px rgba(0,0,0,0.22), 0 0 20px ${glow}14, inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -16px 24px rgba(255,255,255,0.04)`,
        border: hasBg
          ? `1px solid rgba(255,255,255,${isAppleLargeSurface ? '0.11' : isMobileGlass ? '0.1' : '0.24'})`
          : `1px solid rgba(255,255,255,${isAppleLargeSurface ? '0.1' : isMobileGlass ? '0.1' : '0.18'})`,
      }}
    >
      {hasBg && <div className="absolute inset-0" style={{ background: `rgba(10,14,24,${isAppleLargeSurface ? '0.08' : isMobileGlass ? '0.16' : '0.14'})` }} />}
      <div className="absolute inset-0" style={{ background: bg, opacity: hasBg ? (isAppleLargeSurface ? 0.13 : isMobileGlass ? 0.12 : 0.16) : (isAppleLargeSurface ? 0.15 : isMobileGlass ? 0.14 : 0.22), mixBlendMode: 'screen', filter: `saturate(${isAppleLargeSurface ? '0.9' : isMobileGlass ? '0.82' : '0.9'})` }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(180deg, rgba(255,255,255,${isAppleLargeSurface ? '0.12' : isMobileGlass ? '0.11' : '0.32'}) 0%, rgba(255,255,255,${isAppleLargeSurface ? '0.04' : isMobileGlass ? '0.038' : '0.1'}) 22%, rgba(255,255,255,${isAppleLargeSurface ? '0.012' : isMobileGlass ? '0.012' : '0.03'}) 56%, transparent 100%)` }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 15% 10%, rgba(255,255,255,${isAppleLargeSurface ? '0.095' : isMobileGlass ? '0.08' : '0.24'}) 0%, transparent 30%), radial-gradient(circle at 85% 92%, rgba(255,255,255,${isAppleLargeSurface ? '0.04' : isMobileGlass ? '0.034' : '0.12'}) 0%, transparent 26%)` }} />
      <div className="relative z-10 w-full h-full">{children}</div>
      {bulkSelectionActive && (
        <button
          type="button"
          aria-label={isBulkSelected ? (language === 'ar' ? 'إلغاء تحديد هذا العنصر' : 'Deselect this item') : (language === 'ar' ? 'تحديد هذا العنصر' : 'Select this item')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onBulkSelectToggle?.();
          }}
          className="absolute inset-0 z-20"
          style={{
            border: 'none',
            background: isBulkSelected ? 'rgba(34,197,94,0.12)' : 'rgba(15,23,42,0.02)',
          }}
        />
      )}
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

  if (wKey === 'showVitalityWidget') {
    return <VitalityWidget shell={shell} language={language} navigate={navigate} whoopData={whoopData} />;
  }

  if (wKey === 'showJournalWidget') {
    return <JournalWidget shell={shell} navigate={navigate} language={language} journalData={journalData} />;
  }

  if (wKey === 'showQuoteWidget') return shell(
    'linear-gradient(145deg,rgba(15,23,42,0.97) 0%,rgba(22,32,56,0.97) 40%,rgba(30,41,70,0.97) 100%)',
    '#6366f1',
    () => { if (onExpandQuote) onExpandQuote(); },
    <div className="p-2.5 flex flex-col h-full justify-between" key={`${quoteText}-${quoteAuthor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.4)' }}>
            <span className="text-[12px] leading-none">💬</span>
          </div>
          <span className="text-[10px] font-black text-white/60 uppercase tracking-wide">{language === 'ar' ? 'اقتباس' : 'Quote'}</span>
        </div>
        <div className="flex gap-0.5">
          {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full" style={{ background: `rgba(99,102,241,${0.3 + i * 0.25})` }} />)}
        </div>
      </div>
      <div className="relative flex-1 flex flex-col justify-center">
        <span className="absolute top-0 left-0 text-[40px] font-serif leading-none select-none" style={{ color: 'rgba(99,102,241,0.22)', lineHeight: 1 }}>
          "
        </span>
        <p
          className="text-[12px] italic leading-snug text-white/90 line-clamp-3 px-3 pt-2"
          style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          {quoteText || '...'}
        </p>
      </div>
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
  onExpandQuote?: () => void;
  onLongPress?: () => void;
  bulkSelectionActive?: boolean;
  isBulkSelected?: boolean;
  onBulkSelectToggle?: () => void;
}
function UnifiedWidgetCell({ id, wKey, editMode, language, theme, hasBg, statCardBase, statLblColor, pendingTasks, completedToday, upcomingCount, navigate, gridArea, quoteText, quoteAuthor, whoopData, journalData, reminders, maw3dEvents, attendingCounts, onExpandQuote, onLongPress, bulkSelectionActive = false, isBulkSelected = false, onBulkSelectToggle }: UnifiedWidgetCellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id, data: { type: 'unified' }, disabled: !editMode,
  });
  const lpTimer = useRef<number | null>(null);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (editMode) return;
    const t = e.touches[0];
    lpStart.current = { x: t.clientX, y: t.clientY };
    lpTimer.current = window.setTimeout(() => { lpTimer.current = null; onLongPress?.(); }, 600);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!lpStart.current || !lpTimer.current) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - lpStart.current.x) > 8 || Math.abs(t.clientY - lpStart.current.y) > 8) {
      clearTimeout(lpTimer.current); lpTimer.current = null;
    }
  };
  const handleTouchEnd = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } lpStart.current = null; };
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
        outline: isOver ? '3px solid rgba(99,102,241,0.9)' : isBulkSelected ? '3px solid rgba(34,197,94,0.95)' : undefined,
        borderRadius: isOver || isBulkSelected ? '18px' : undefined,
        boxShadow: isOver
          ? '0 0 0 4px rgba(99,102,241,0.35), 0 0 20px rgba(99,102,241,0.5)'
          : isBulkSelected
            ? '0 0 0 4px rgba(34,197,94,0.22), 0 0 22px rgba(34,197,94,0.32)'
            : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...attributes}
      {...listeners}
    >
      <WidgetContent
        wKey={wKey} editMode={editMode} language={language} theme={theme}
        hasBg={hasBg} statCardBase={statCardBase} statLblColor={statLblColor}
        pendingTasks={pendingTasks} completedToday={completedToday}
        upcomingCount={upcomingCount} navigate={navigate}
        quoteText={quoteText} quoteAuthor={quoteAuthor}
        whoopData={whoopData}
        journalData={journalData}
        reminders={reminders}
        maw3dEvents={maw3dEvents}
        attendingCounts={attendingCounts}
        onExpandQuote={onExpandQuote}
        bulkSelectionActive={bulkSelectionActive}
        isBulkSelected={isBulkSelected}
        onBulkSelectToggle={onBulkSelectToggle}
      />
      {isBulkSelected && (
        <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-green-500 border border-white/70 shadow-[0_8px_18px_rgba(34,197,94,0.45)] flex items-center justify-center pointer-events-none">
          <Check className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      {editMode && (
        <div className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-black/70 border border-white/30 flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-white/80" />
        </div>
      )}
    </div>
  );
}

interface UnifiedAppCellProps {
  id: string; app: typeof ALL_APPS[0]; editMode: boolean;
  language: string; isDark: boolean; glowEnabled: boolean;
  navigate: (p: string) => void;
  gridArea: string;
  compact?: boolean;
  avatarUrl?: string;
  badgeCount?: number;
  onLongPress?: () => void;
  bulkSelectionActive?: boolean;
  isBulkSelected?: boolean;
  onBulkSelectToggle?: () => void;
}
function UnifiedAppCell({ id, app, editMode, language, isDark, glowEnabled, navigate, gridArea, compact = false, avatarUrl, badgeCount = 0, onLongPress, bulkSelectionActive = false, isBulkSelected = false, onBulkSelectToggle }: UnifiedAppCellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id, data: { type: 'unified' }, disabled: !editMode,
  });
  const name = language === 'ar' ? app.nameAr : app.nameEn;
  const iconSize = compact ? 56 : 60;
  const lpTimer = useRef<number | null>(null);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (editMode) return;
    const t = e.touches[0];
    lpStart.current = { x: t.clientX, y: t.clientY };
    lpTimer.current = window.setTimeout(() => { lpTimer.current = null; onLongPress?.(); }, 600);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!lpStart.current || !lpTimer.current) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - lpStart.current.x) > 8 || Math.abs(t.clientY - lpStart.current.y) > 8) {
      clearTimeout(lpTimer.current); lpTimer.current = null;
    }
  };
  const handleTouchEnd = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } lpStart.current = null; };
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center ${compact ? 'justify-start pt-0.5' : 'justify-start pt-1.5'} gap-0.5 select-none cursor-pointer relative`}
      style={{
        gridArea,
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: isDragging ? transition : undefined,
        opacity: isDragging ? 0.25 : 1,
        touchAction: 'none',
        zIndex: isDragging ? 50 : 'auto',
        outline: isOver ? '2px solid rgba(99,102,241,0.9)' : isBulkSelected ? '2px solid rgba(34,197,94,0.95)' : undefined,
        borderRadius: isOver || isBulkSelected ? '18px' : undefined,
        boxShadow: isOver
          ? '0 0 0 3px rgba(99,102,241,0.35), 0 0 14px rgba(99,102,241,0.4)'
          : isBulkSelected
            ? '0 0 0 3px rgba(34,197,94,0.22), 0 0 18px rgba(34,197,94,0.3)'
            : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...attributes}
      {...listeners}
      onClick={editMode ? undefined : (event) => {
        if (bulkSelectionActive) {
          event.preventDefault();
          event.stopPropagation();
          onBulkSelectToggle?.();
          return;
        }
        navigate(app.path);
      }}
    >
      {isBulkSelected && (
        <div className="absolute top-0 right-2 z-20 w-6 h-6 rounded-full bg-green-500 border border-white/70 shadow-[0_8px_18px_rgba(34,197,94,0.45)] flex items-center justify-center pointer-events-none">
          <Check className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <LiquidIcon app={app} size={iconSize} editMode={editMode} glowEnabled={glowEnabled} avatarUrl={avatarUrl} badgeCount={badgeCount} />
      <span
        className={`font-bold text-center leading-tight text-white px-2 rounded-md ${compact ? 'text-[10px] mt-0.5 py-0' : 'text-[11px] mt-1 py-0.5'}`}
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.14) 100%)', backdropFilter: 'blur(18px) saturate(175%)', WebkitBackdropFilter: 'blur(18px) saturate(175%)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 12px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22)', textShadow: '0 1px 3px rgba(0,0,0,0.8)', maxWidth: compact ? 64 : 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
      >
        {name}
      </span>
    </div>
  );
}

function EmptySlotCell({ id, gridArea, isWidget, editMode }: { id: string; gridArea: string; isWidget: boolean; editMode: boolean }) {
  const { setNodeRef, isOver } = useSortable({ id, data: { type: 'unified' }, disabled: !editMode });
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

function QuoteOverlay({ quoteText, quoteAuthor, language, onClose, exiting }: { quoteText: string; quoteAuthor: string; language: string; onClose: () => void; exiting: boolean; }) {
  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center px-8 transition-opacity duration-300 ${exiting ? 'opacity-0' : 'opacity-100'}`} onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />
      <div className="relative max-w-md text-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <p className="text-[clamp(19px,5.2vw,27px)] italic font-light leading-[1.72] text-white/95">{quoteText}</p>
        {quoteAuthor && <p className="mt-4 text-sm text-white/60">— {quoteAuthor}</p>}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
interface HomeScreenProps { displayName: string }

export function HomeScreen({ displayName }: HomeScreenProps) {
  const { language, theme } = useTheme();
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const { profile } = useUserProfile();
  const LS_AVATAR_CACHE = user?.id ? `wakti_avatar_${user.id}` : null;
  const defaultHomescreenState = useMemo(() => createDefaultHomescreenSnapshot(theme), [theme]);
  const getLocalHomescreenState = (explicitUid?: string | null) => {
    const read = (base: string) => getScopedStorageItem(base, explicitUid ?? user?.id ?? null);
    const readJson = <T,>(base: string): T | null => {
      try {
        const raw = read(base);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    };
    const rawSnapshot = readJson<Partial<HomescreenSnapshot>>(LS_SNAPSHOT_BASE);
    if (rawSnapshot && typeof rawSnapshot === 'object') {
      const nextDockIds = Array.isArray(rawSnapshot.dockIds)
        ? sanitizeDock(rawSnapshot.dockIds, MAX_DOCK_DESKTOP)
        : defaultHomescreenState.dockIds;
      const nextIconOrder = Array.isArray(rawSnapshot.iconOrder)
        ? sanitizeOrder(rawSnapshot.iconOrder)
        : defaultHomescreenState.iconOrder;
      const nextWidgets = rawSnapshot.hsWidgets && typeof rawSnapshot.hsWidgets === 'object'
        ? { ...DEFAULT_HS_WIDGETS, ...rawSnapshot.hsWidgets }
        : { ...defaultHomescreenState.hsWidgets };
      const nextWidgetSizes = rawSnapshot.hsWidgetSizes && typeof rawSnapshot.hsWidgetSizes === 'object'
        ? rawSnapshot.hsWidgetSizes
        : { ...defaultHomescreenState.hsWidgetSizes };
      const nextUnifiedGrid = Array.isArray(rawSnapshot.unifiedGrid) && rawSnapshot.unifiedGrid.length > 0
        ? rawSnapshot.unifiedGrid
        : buildDefaultUnifiedGrid(nextWidgets, nextDockIds);
      const nextLayout = normalizeHomescreenLayout(
        Array.isArray(rawSnapshot.homescreenLayout) && rawSnapshot.homescreenLayout.length > 0
          ? rawSnapshot.homescreenLayout
          : buildLayoutFromLegacy(nextUnifiedGrid, nextWidgets, nextWidgetSizes, nextDockIds),
        nextWidgets,
        nextWidgetSizes,
        nextDockIds,
      );
      const nextBgChoice: BgChoice = isBgChoiceValue(rawSnapshot.bgChoice)
        ? rawSnapshot.bgChoice
        : defaultHomescreenState.bgChoice;
      const nextBgImage = nextBgChoice === 'wallpaper' && typeof rawSnapshot.bgImage === 'string' && rawSnapshot.bgImage && !isDefaultBgAsset(rawSnapshot.bgImage)
        ? rawSnapshot.bgImage
        : nextBgChoice === 'style'
          ? ''
          : (theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK);
      return {
        dockIds: nextDockIds,
        iconOrder: nextIconOrder,
        showQuote: typeof rawSnapshot.showQuote === 'boolean' ? rawSnapshot.showQuote : defaultHomescreenState.showQuote,
        bgImage: nextBgImage,
        bgPositionY: nextBgChoice === 'wallpaper' && typeof rawSnapshot.bgPositionY === 'number'
          ? Math.max(0, Math.min(100, rawSnapshot.bgPositionY))
          : 50,
        headerColor: typeof rawSnapshot.headerColor === 'string' ? rawSnapshot.headerColor : defaultHomescreenState.headerColor,
        bgChoice: nextBgChoice,
        hsBgActive: nextBgChoice === 'style',
        hsBg: rawSnapshot.hsBg && typeof rawSnapshot.hsBg === 'object'
          ? {
              mode: rawSnapshot.hsBg.mode || 'solid',
              color1: rawSnapshot.hsBg.color1 || '',
              color2: rawSnapshot.hsBg.color2 || '',
              color3: rawSnapshot.hsBg.color3 || '',
              angle: typeof rawSnapshot.hsBg.angle === 'number' ? rawSnapshot.hsBg.angle : 180,
              glow: typeof rawSnapshot.hsBg.glow === 'boolean' ? rawSnapshot.hsBg.glow : false,
            }
          : defaultHomescreenState.hsBg,
        dockColor: typeof rawSnapshot.dockColor === 'string' ? rawSnapshot.dockColor : defaultHomescreenState.dockColor,
        bgGradLeft: typeof rawSnapshot.bgGradLeft === 'string' ? rawSnapshot.bgGradLeft : defaultHomescreenState.bgGradLeft,
        bgGradRight: typeof rawSnapshot.bgGradRight === 'string' ? rawSnapshot.bgGradRight : defaultHomescreenState.bgGradRight,
        hsWidgets: nextWidgets,
        hsWidgetSizes: nextWidgetSizes,
        unifiedGrid: layoutToUnifiedGrid(nextLayout),
        homescreenLayout: nextLayout,
      };
    }

    const rawDock = readJson<string[]>(LS_DOCK_BASE);
    const rawOrder = readJson<string[]>(LS_ORDER_BASE);
    const rawBgPosition = read(LS_BG_POS_Y_BASE);
    const parsedBgPosition = rawBgPosition ? parseInt(rawBgPosition, 10) : 50;
    const savedBg = read(LS_BG_BASE);
    const savedChoice = read(LS_BG_CHOICE_BASE) as BgChoice | null;
    const savedTheme = localStorage.getItem('wakti-theme') || localStorage.getItem('theme') || 'dark';
    const resolvedTheme = theme || savedTheme;
    const rawHsBg = readJson<{ mode: 'solid'|'gradient'; color1: string; color2: string; color3: string; angle: number; glow: boolean }>(LS_HSBG_BASE);
    const rawWidgets = readJson<Record<string, boolean>>(LS_WIDGETS_BASE);
    const rawWidgetSizes = readJson<Record<string, 'big' | 'small'>>(LS_WIDGET_SIZES_BASE);
    const rawUnifiedGrid = readJson<string[]>(LS_UNIFIED_BASE);
    const rawLayout = readJson<HomescreenLayoutItem[]>(LS_LAYOUT_BASE);

    const resolvedBgChoice: BgChoice = isBgChoiceValue(savedChoice)
      ? savedChoice
      : savedBg && !isDefaultBgAsset(savedBg)
        ? 'wallpaper'
        : 'default';
    const resolvedBgPosition = resolvedBgChoice === 'wallpaper' && Number.isFinite(parsedBgPosition)
      ? Math.max(0, Math.min(100, parsedBgPosition))
      : 50;
    const resolvedBgImage = resolvedBgChoice === 'wallpaper' && savedBg && !isDefaultBgAsset(savedBg)
      ? savedBg
      : (resolvedTheme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK);
    const nextDockIds = Array.isArray(rawDock) ? sanitizeDock(rawDock, MAX_DOCK_DESKTOP) : defaultHomescreenState.dockIds;
    const nextWidgets = rawWidgets && typeof rawWidgets === 'object' ? { ...DEFAULT_HS_WIDGETS, ...rawWidgets } : { ...defaultHomescreenState.hsWidgets };
    const nextWidgetSizes = rawWidgetSizes && typeof rawWidgetSizes === 'object' ? rawWidgetSizes : {};
    const nextUnifiedGrid = Array.isArray(rawUnifiedGrid) && rawUnifiedGrid.length > 0 ? rawUnifiedGrid : buildDefaultUnifiedGrid(nextWidgets, nextDockIds);
    const nextLayout = normalizeHomescreenLayout(
      Array.isArray(rawLayout) && rawLayout.length > 0
        ? rawLayout
        : buildLayoutFromLegacy(nextUnifiedGrid, nextWidgets, nextWidgetSizes, nextDockIds),
      nextWidgets,
      nextWidgetSizes,
      nextDockIds,
    );

    return {
      dockIds: nextDockIds,
      iconOrder: sanitizeOrder(Array.isArray(rawOrder) ? rawOrder : defaultHomescreenState.iconOrder),
      showQuote: read(LS_QUOTE_BASE) !== 'false',
      bgImage: resolvedBgChoice === 'style' ? '' : resolvedBgImage,
      bgPositionY: resolvedBgPosition,
      headerColor: read(LS_HEADER_COLOR_BASE) || '',
      bgChoice: resolvedBgChoice,
      hsBgActive: savedChoice === 'style'
        ? true
        : savedChoice === 'default' || savedChoice === 'wallpaper'
          ? false
          : read(LS_HSBG_ACTIVE_BASE) === 'true',
      hsBg: rawHsBg && typeof rawHsBg === 'object'
        ? {
            mode: rawHsBg.mode || 'solid',
            color1: rawHsBg.color1 || '#1a1a2e',
            color2: rawHsBg.color2 || '#4a4a8a',
            color3: rawHsBg.color3 || '',
            angle: typeof rawHsBg.angle === 'number' ? rawHsBg.angle : 180,
            glow: typeof rawHsBg.glow === 'boolean' ? rawHsBg.glow : false,
          }
        : { mode: 'solid', color1: '', color2: '', color3: '', angle: 180, glow: false },
      dockColor: read(LS_DOCK_COLOR_BASE) || '',
      bgGradLeft: read('hs_grad_left') || '',
      bgGradRight: read('hs_grad_right') || '',
      hsWidgets: nextWidgets,
      hsWidgetSizes: nextWidgetSizes,
      unifiedGrid: layoutToUnifiedGrid(nextLayout),
      homescreenLayout: nextLayout,
    };
  };
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    if (!user?.id) return '';
    return localStorage.getItem(`wakti_avatar_${user.id}`) || '';
  });
  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
      if (LS_AVATAR_CACHE) localStorage.setItem(LS_AVATAR_CACHE, profile.avatar_url);
    }
  }, [profile?.avatar_url]);
  const [connectBadge, setConnectBadge] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    const fetchBadge = async () => {
      try {
        const [{ count: msgs }, { count: reqs }] = await Promise.all([
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('is_read', false),
          supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('contact_id', user.id).eq('status', 'pending'),
        ]);
        setConnectBadge((msgs || 0) + (reqs || 0));
      } catch {}
    };
    fetchBadge();
    const channel = supabase.channel(`hs-connect-badge-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, fetchBadge)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `contact_id=eq.${user.id}` }, fetchBadge)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);
  const [editMode,        setEditMode]        = useState(false);
  const [dockIds,         setDockIds]         = useState<string[]>(() => {
    return defaultHomescreenState.dockIds;
  });
  const [iconOrder,       setIconOrder]       = useState<string[]>(() => {
    return defaultHomescreenState.iconOrder;
  });
  const [showQuote,       setShowQuote]       = useState<boolean>(() => defaultHomescreenState.showQuote);
  const [bgImage,         setBgImage]         = useState<string>(() => {
    return defaultHomescreenState.bgImage;
  });
  const [bgPositionY,     setBgPositionY]     = useState<number>(() => {
    return defaultHomescreenState.bgPositionY;
  });
  const [headerColor,     setHeaderColor]     = useState<string>(() => defaultHomescreenState.headerColor);
  const [bgChoice,        setBgChoice]        = useState<BgChoice>(() => {
    return defaultHomescreenState.bgChoice;
  });

  const [hsBgActive, setHsBgActive] = useState<boolean>(() => {
    return defaultHomescreenState.hsBgActive;
  });
  const [hsBg, setHsBg] = useState<{ mode: 'solid'|'gradient'; color1: string; color2: string; color3: string; angle: number; glow: boolean }>(() => {
    return defaultHomescreenState.hsBg;
  });
  const [quote,           setQuote]           = useState<any>(null);
  const [quoteExpanded,   setQuoteExpanded]   = useState(false);
  const [quoteExiting,    setQuoteExiting]    = useState(false);
  const [greeting,        setGreeting]        = useState(() => {
    const h = new Date().getHours();
    if (language === "ar") return h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور";
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  });
  const [activeId,        setActiveId]        = useState<string | null>(null);
  const [dockPickerOpen,  setDockPickerOpen]  = useState(false);
  const [dockColor,       setDockColor]       = useState<string>(() => defaultHomescreenState.dockColor);
  const [bgPanelOpen,     setBgPanelOpen]     = useState(false);
  const [bgGradPicker,    setBgGradPicker]    = useState(false);
  const [bgGradLeft,      setBgGradLeft]      = useState<string>(() => defaultHomescreenState.bgGradLeft);
  const [bgGradRight,     setBgGradRight]     = useState<string>(() => defaultHomescreenState.bgGradRight);
  const [currentPage,     setCurrentPage]     = useState(0);
  const [dragPages,       setDragPages]       = useState<string[][] | null>(null);
  const [contextMenu,     setContextMenu]     = useState<{ itemId: string } | null>(null);
  const [samePageMoveState, setSamePageMoveState] = useState<{ itemId: string; viewport: { top: number; left: number; width: number; height: number } | null } | null>(null);
  const [samePageSwapState, setSamePageSwapState] = useState<{ itemId: string; viewport: { top: number; left: number; width: number; height: number } | null } | null>(null);
  const [bulkMoveSelection, setBulkMoveSelection] = useState<{ anchorItemId: string; selectedIds: string[] } | null>(null);
  const [savedImagesOpen, setSavedImagesOpen] = useState(false);
  const [saveState,       setSaveState]       = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const bgInputRef    = useRef<HTMLInputElement>(null);
  const pageViewportRef = useRef<HTMLDivElement | null>(null);
  const _pendingDock  = useRef<string[]>([]);
  const _effectiveRef = useRef<string[]>([]);
  const _pageDragStateRef = useRef<{ currentPageData: any; savedPages: string[][] }>({ currentPageData: null, savedPages: [[]] });
  const saveStateTimerRef = useRef<number | null>(null);
  const lastSaveErrorAtRef = useRef(0);
  const pageTouchStartXRef = useRef<number | null>(null);
  const dragItemIdRef = useRef<string | null>(null);
  const dragPageIndexRef = useRef<number | null>(null);
  const dragPageSwitchTimerRef = useRef<number | null>(null);
  const pendingPageSwitchTargetRef = useRef<number | null>(null);

  const { tasks, reminders }  = useOptimizedTRData();
  const { events: maw3dEvents, attendingCounts } = useOptimizedMaw3dEvents();
  const whoopData = useWhoopData();
  const journalData = useJournalData();
  const pendingTasks  = tasks.filter(t => !t.completed).length;
  const upcomingCount = maw3dEvents.filter(e => {
    try { return new Date(e.event_date) >= new Date(new Date().toDateString()); } catch { return false; }
  }).length;

  const [hsWidgets, setHsWidgets] = useState(() => {
    return defaultHomescreenState.hsWidgets;
  });
  const [hsWidgetSizes, setHsWidgetSizes] = useState<Record<string, 'big' | 'small'>>(() => {
    return defaultHomescreenState.hsWidgetSizes;
  });

  const [unifiedGrid, setUnifiedGrid] = useState<string[]>(() => {
    return defaultHomescreenState.unifiedGrid;
  });
  const [homescreenLayout, setHomescreenLayout] = useState<HomescreenLayoutItem[]>(() => {
    return defaultHomescreenState.homescreenLayout;
  });
  const homescreenDirtyRef = useRef(false);
  const [homescreenReady, setHomescreenReady] = useState(false);
  const [homescreenBootstrapSource, setHomescreenBootstrapSource] = useState<'loading' | 'remote' | 'cache' | 'default'>('loading');

  useEffect(() => {
    const h = new Date().getHours();
    if (language === "ar") setGreeting(h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور");
    else                   setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, [language]);

  useEffect(() => {
    if (!user?.id) return;
    setActiveScopedUserId(user.id);
    migrateLegacyScopedStorage('vitality_widget_tab', user.id, 'vitality_widget_tab');
    homescreenDirtyRef.current = false;
    setDragPages(null);
    setSamePageMoveState(null);
    setSamePageSwapState(null);
    setBulkMoveSelection(null);
    setCurrentPage(0);
  }, [user?.id]);

  useEffect(() => { setQuote(getQuoteForDisplay()); }, []);
  useEffect(() => { if (user?.id) localStorage.setItem(LS_ORDER_KEY(), JSON.stringify(iconOrder)); }, [iconOrder, user?.id]);
  useEffect(() => { if (user?.id) localStorage.setItem(LS_DOCK_KEY(), JSON.stringify(dockIds)); }, [dockIds, user?.id]);

  const clearSaveStateTimer = useCallback(() => {
    if (saveStateTimerRef.current !== null) {
      window.clearTimeout(saveStateTimerRef.current);
      saveStateTimerRef.current = null;
    }
  }, []);

  const settleSaveState = useCallback((nextState: 'saved' | 'error') => {
    clearSaveStateTimer();
    setSaveState(nextState);
    saveStateTimerRef.current = window.setTimeout(() => {
      setSaveState('idle');
      saveStateTimerRef.current = null;
    }, nextState === 'saved' ? 1200 : 2200);
  }, [clearSaveStateTimer]);

  const clearDragPageSwitchTimer = useCallback(() => {
    if (dragPageSwitchTimerRef.current !== null) {
      window.clearTimeout(dragPageSwitchTimerRef.current);
      dragPageSwitchTimerRef.current = null;
    }
    pendingPageSwitchTargetRef.current = null;
  }, []);

  const moveUnifiedItemToPage = useCallback((pagesInput: string[][], itemId: string, targetPageIndex: number) => {
    const nextPages = pagesInput.map(page => page.filter(id => id !== itemId));
    while (nextPages.length <= targetPageIndex) nextPages.push([]);
    const targetPage = nextPages[targetPageIndex] ? [...nextPages[targetPageIndex]] : [];
    nextPages[targetPageIndex] = [itemId, ...targetPage.filter(id => id !== itemId)];
    return nextPages.map((page, index, arr) => {
      if (index === 0) return page;
      if (page.length > 0) return page;
      const hasItemsAhead = arr.slice(index + 1).some(candidate => candidate.length > 0);
      return hasItemsAhead ? page : [];
    });
  }, []);

  const reportSaveError = useCallback(() => {
    settleSaveState('error');
    const now = Date.now();
    if (now - lastSaveErrorAtRef.current < 2500) return;
    lastSaveErrorAtRef.current = now;
    toast.error(language === 'ar' ? 'تعذر حفظ إعدادات الشاشة الرئيسية' : 'Could not save home screen changes');
  }, [language, settleSaveState]);

  useEffect(() => {
    return () => clearSaveStateTimer();
  }, [clearSaveStateTimer]);

  useEffect(() => {
    return () => clearDragPageSwitchTimer();
  }, [clearDragPageSwitchTimer]);
 
  const setBgChoiceState = useCallback((nextChoice: BgChoice) => {
    setBgChoice(nextChoice);
    setHsBgActive(nextChoice === 'style');
    if (user?.id) setScopedStorageItem(LS_BG_CHOICE_BASE, nextChoice, user.id);
    if (user?.id) setScopedStorageItem(LS_HSBG_ACTIVE_BASE, String(nextChoice === 'style'), user.id);
  }, [user?.id]);

  const syncToSupabase = useCallback(async (homescreenPatch: Record<string, any> = {}, rootPatch: Record<string, any> = {}) => {
    if (!user) return false;
    clearSaveStateTimer();
    setSaveState('saving');
    try {
      const { data, error } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
      if (error) throw error;
      const cur = (data?.settings as any) || {};
      const nextSettings = {
        ...cur,
        ...rootPatch,
        homescreen: {
          ...(cur.homescreen || {}),
          ...homescreenPatch,
        },
      };
      const { error: updateError } = await supabase.from("profiles").update({ settings: nextSettings }).eq("id", user.id);
      if (updateError) throw updateError;
      homescreenDirtyRef.current = false;
      settleSaveState('saved');
      return true;
    } catch (error) {
      console.error('HomeScreen save failed:', error);
      reportSaveError();
      return false;
    }
  }, [clearSaveStateTimer, reportSaveError, settleSaveState, user]);

  const clampHsWidgets = (raw: Record<string, boolean>) => {
    const result = { ...raw, showNavWidget: false } as typeof hsWidgets;
    const VISIBLE: (keyof typeof hsWidgets)[] = ['showCalendarWidget','showTRWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget'];
    let count = 0;
    for (const k of VISIBLE) {
      if (result[k]) { if (count < MAX_WIDGETS) count++; else result[k] = false; }
    }
    return result;
  };
 
  function applyHomescreenSnapshot(snapshot: HomescreenSnapshot) {
    const nextLayout = normalizeHomescreenLayout(
      snapshot.homescreenLayout?.length
        ? snapshot.homescreenLayout
        : buildLayoutFromLegacy(snapshot.unifiedGrid, snapshot.hsWidgets, snapshot.hsWidgetSizes, snapshot.dockIds),
      snapshot.hsWidgets,
      snapshot.hsWidgetSizes,
      snapshot.dockIds,
    );
    const nextUnified = layoutToUnifiedGrid(nextLayout);
    setDockIds(snapshot.dockIds);
    setIconOrder(snapshot.iconOrder);
    setShowQuote(snapshot.showQuote);
    setBgImage(snapshot.bgChoice === 'style' ? '' : snapshot.bgImage);
    setBgPositionY(snapshot.bgPositionY);
    setHeaderColor(snapshot.headerColor);
    setBgChoice(snapshot.bgChoice);
    setHsBgActive(snapshot.hsBgActive);
    setHsBg(snapshot.hsBg);
    setDockColor(snapshot.dockColor);
    setBgGradLeft(snapshot.bgGradLeft);
    setBgGradRight(snapshot.bgGradRight);
    setHsWidgets(snapshot.hsWidgets);
    setHsWidgetSizes(snapshot.hsWidgetSizes);
    setUnifiedGrid(nextUnified);
    setHomescreenLayout(nextLayout);
    setCurrentPage(0);
  }
 
  function buildHomescreenSnapshotFromSettings(settings: any, fallbackSnapshot?: HomescreenSnapshot | null) {
    const s = settings || {};
    const hs = s?.homescreen || {};
    const VALID_WIDGET_KEYS = new Set(['showCalendarWidget','showTRWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget','showNavWidget']);
    const strippedWidgets: Record<string, boolean> = {};
    const rawWidgets = hs?.homescreenWidgets || s?.homescreenWidgets;
    if (rawWidgets && typeof rawWidgets === 'object') {
      for (const [k, v] of Object.entries(rawWidgets)) {
        if (VALID_WIDGET_KEYS.has(k)) strippedWidgets[k] = !!v;
      }
    }
    const nextWidgets = clampHsWidgets({ ...DEFAULT_HS_WIDGETS, ...strippedWidgets });
    const nextSizes = hs?.homescreenWidgetSizes && typeof hs.homescreenWidgetSizes === 'object'
      ? hs.homescreenWidgetSizes as Record<string, 'big' | 'small'>
      : (fallbackSnapshot?.hsWidgetSizes || {});
    const nextDockIds = Array.isArray(hs?.dockIds)
      ? sanitizeDock(hs.dockIds, MAX_DOCK_DESKTOP)
      : (fallbackSnapshot?.dockIds || sanitizeDock(DEFAULT_DOCK, MAX_DOCK_DESKTOP));
    const nextIconOrder = Array.isArray(hs?.iconOrder)
      ? sanitizeOrder(hs.iconOrder)
      : (fallbackSnapshot?.iconOrder || sanitizeOrder(DEFAULT_ORDER));
    const remoteUnifiedGrid = Array.isArray(hs?.unifiedGrid)
      ? hs.unifiedGrid as string[]
      : (fallbackSnapshot?.unifiedGrid || buildDefaultUnifiedGrid(nextWidgets, nextDockIds));
    const remoteLayout = Array.isArray(hs?.homescreenLayout)
      ? hs.homescreenLayout as HomescreenLayoutItem[]
      : (fallbackSnapshot?.homescreenLayout || []);
    const nextLayout = normalizeHomescreenLayout(
      remoteLayout.length > 0 ? remoteLayout : buildLayoutFromLegacy(remoteUnifiedGrid, nextWidgets, nextSizes, nextDockIds),
      nextWidgets,
      nextSizes,
      nextDockIds,
    );
    const nextUnified = layoutToUnifiedGrid(nextLayout);
    const nextBgChoice: BgChoice = isBgChoiceValue(hs?.bgChoice)
      ? hs.bgChoice
      : (typeof hs?.bgImage === 'string' && hs.bgImage && !isDefaultBgAsset(hs.bgImage)
          ? 'wallpaper'
          : s?.homescreenBg
            ? 'style'
            : 'default');
    const nextWallpaper = typeof hs?.bgImage === 'string' && hs.bgImage && !isDefaultBgAsset(hs.bgImage) ? hs.bgImage : '';
    const nextHsBg = s?.homescreenBg
      ? {
          mode: s.homescreenBg.mode === 'gradient' ? 'gradient' as 'solid'|'gradient' : 'solid' as 'solid'|'gradient',
          color1: s.homescreenBg.color1 || '',
          color2: s.homescreenBg.color2 || '',
          color3: s.homescreenBg.color3 || '',
          angle: typeof s.homescreenBg.angle === 'number' ? s.homescreenBg.angle : 180,
          glow: typeof s.homescreenBg.glow === 'boolean' ? s.homescreenBg.glow : false,
        }
      : { mode: 'solid', color1: '', color2: '', color3: '', angle: 180, glow: false };
    return {
      dockIds: nextDockIds,
      iconOrder: nextIconOrder,
      showQuote: typeof hs?.showQuote === 'boolean' ? hs.showQuote : true,
      bgImage: nextBgChoice === 'wallpaper' && nextWallpaper
        ? nextWallpaper
        : nextBgChoice === 'style'
          ? ''
          : (theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK),
      bgPositionY: nextBgChoice === 'wallpaper' && typeof hs?.bgPositionY === 'number'
        ? Math.max(0, Math.min(100, hs.bgPositionY))
        : 50,
      headerColor: typeof hs?.headerColor === 'string' ? hs.headerColor : '',
      bgChoice: nextBgChoice,
      hsBgActive: nextBgChoice === 'style',
      hsBg: nextHsBg,
      dockColor: typeof hs?.dockColor === 'string' ? hs.dockColor : '',
      bgGradLeft: fallbackSnapshot?.bgGradLeft || '',
      bgGradRight: fallbackSnapshot?.bgGradRight || '',
      hsWidgets: nextWidgets,
      hsWidgetSizes: nextSizes,
      unifiedGrid: nextUnified,
      homescreenLayout: nextLayout,
    } as HomescreenSnapshot;
  }

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fallbackSnapshot = getLocalHomescreenState(user.id);
    setHomescreenReady(false);
    setHomescreenBootstrapSource('loading');
    setActiveScopedUserId(user.id);
    migrateLegacyScopedStorage('vitality_widget_tab', user.id, 'vitality_widget_tab');
    setDragPages(null);
    setSamePageMoveState(null);
    setSamePageSwapState(null);
    setBulkMoveSelection(null);
    setCurrentPage(0);
    const finishBootstrap = (snapshot: HomescreenSnapshot, source: 'remote' | 'cache' | 'default') => {
      if (cancelled) return;
      applyHomescreenSnapshot(snapshot);
      homescreenDirtyRef.current = false;
      setHomescreenBootstrapSource(source);
      setHomescreenReady(true);
    };
    const runBootstrap = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', user.id)
          .single();
        if (cancelled) return;
        if (error) {
          if (error.code === 'PGRST116') {
            finishBootstrap(defaultHomescreenState, 'default');
            return;
          }
          throw error;
        }
        finishBootstrap(buildHomescreenSnapshotFromSettings(data?.settings, fallbackSnapshot), 'remote');
      } catch (error) {
        console.error('Homescreen bootstrap failed:', error);
        if (fallbackSnapshot) {
          finishBootstrap(fallbackSnapshot, 'cache');
          return;
        }
        finishBootstrap(defaultHomescreenState, 'default');
      }
    };
    void runBootstrap();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const persistSavedPages = useCallback((nextPages: string[][], nextPageIndex?: number) => {
    const flat = flattenUnifiedPages(nextPages);
    const normalizedLayout = normalizeHomescreenLayout(
      buildLayoutFromLegacy(flat, hsWidgets, hsWidgetSizes, dockIds),
      hsWidgets,
      hsWidgetSizes,
      dockIds,
    );
    const normalizedFlat = layoutToUnifiedGrid(normalizedLayout);
    clearDragPageSwitchTimer();
    setDragPages(null);
    setHomescreenLayout(normalizedLayout);
    setUnifiedGrid(normalizedFlat);
    localStorage.setItem(LS_LAYOUT_KEY(), JSON.stringify(normalizedLayout));
    localStorage.setItem(LS_UNIFIED_KEY(), JSON.stringify(normalizedFlat));
    void syncToSupabase({ homescreenLayout: normalizedLayout, unifiedGrid: normalizedFlat, homescreenWidgetSizes: hsWidgetSizes, homescreenWidgets: hsWidgets });
    const nextLength = splitUnifiedPages(normalizedFlat).length;
    const maxPageIndex = Math.max(0, nextLength - 1);
    if (typeof nextPageIndex === 'number') {
      setCurrentPage(Math.max(0, Math.min(nextPageIndex, maxPageIndex)));
      return;
    }
    setCurrentPage(prev => Math.min(prev, maxPageIndex));
  }, [clearDragPageSwitchTimer, dockIds, hsWidgetSizes, hsWidgets, syncToSupabase]);

  const persistLayout = useCallback((
    nextLayoutInput: HomescreenLayoutItem[],
    nextPageIndex?: number,
    nextWidgetsOverride?: Record<string, boolean>,
    nextSizesOverride?: Record<string, 'big' | 'small'>
  ) => {
    const nextWidgets = nextWidgetsOverride || hsWidgets;
    const nextSizes = nextSizesOverride || hsWidgetSizes;
    const normalized = normalizeHomescreenLayout(nextLayoutInput, nextWidgets, nextSizes, dockIds);
    const flat = layoutToUnifiedGrid(normalized);
    homescreenDirtyRef.current = true;
    clearDragPageSwitchTimer();
    setDragPages(null);
    setSamePageMoveState(null);
    setSamePageSwapState(null);
    setBulkMoveSelection(null);
    setHomescreenLayout(normalized);
    setUnifiedGrid(flat);
    localStorage.setItem(LS_LAYOUT_KEY(), JSON.stringify(normalized));
    localStorage.setItem(LS_UNIFIED_KEY(), JSON.stringify(flat));
    void syncToSupabase({ homescreenLayout: normalized, unifiedGrid: flat, homescreenWidgetSizes: nextSizes, homescreenWidgets: nextWidgets });
    if (typeof nextPageIndex === 'number') {
      setCurrentPage(Math.max(0, Math.min(nextPageIndex, MAX_PAGES - 1)));
      return;
    }
    const layoutPages = new Set(normalized.map(item => item.page));
    const maxPageIndex = layoutPages.size > 0 ? Math.max(...Array.from(layoutPages)) : 0;
    setCurrentPage(prev => Math.min(prev, maxPageIndex));
  }, [clearDragPageSwitchTimer, dockIds, hsWidgetSizes, hsWidgets, syncToSupabase]);

  useEffect(() => {
    if (!homescreenReady || !user?.id || !profile) return;
    const s = (profile.settings as any) || {};
    const hs = s?.homescreen || {};
    const VALID_WIDGET_KEYS = new Set(['showCalendarWidget','showTRWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget','showNavWidget']);
    const rawWidgets = hs?.homescreenWidgets || s?.homescreenWidgets;
    const hasRemoteWidgets = !!rawWidgets && typeof rawWidgets === 'object';
    const strippedWidgets: Record<string, boolean> = {};
    if (rawWidgets) {
      for (const [k, v] of Object.entries(rawWidgets)) {
        if (VALID_WIDGET_KEYS.has(k)) strippedWidgets[k] = !!v;
      }
    }
    const fromSupabase = clampHsWidgets({ ...DEFAULT_HS_WIDGETS, ...strippedWidgets });
    const remoteWidgetSizes = hs?.homescreenWidgetSizes && typeof hs.homescreenWidgetSizes === 'object'
      ? hs.homescreenWidgetSizes as Record<string, 'big' | 'small'>
      : null;
    const remoteUnifiedGrid = Array.isArray(hs?.unifiedGrid)
      ? hs.unifiedGrid as string[]
      : [];
    const remoteLayout = Array.isArray(hs?.homescreenLayout)
      ? hs.homescreenLayout as HomescreenLayoutItem[]
      : [];
    const hasRemoteWidgetSizes = !!remoteWidgetSizes;
    const hasRemoteLayoutState = remoteLayout.length > 0 || remoteUnifiedGrid.length > 0;
    const hasRemoteBgState = typeof hs?.bgImage === 'string'
      || typeof hs?.bgPositionY === 'number'
      || isBgChoiceValue(hs?.bgChoice)
      || !!s?.homescreenBg;
    const hasRemoteHomescreenState = hasRemoteWidgets
      || hasRemoteWidgetSizes
      || hasRemoteLayoutState
      || Array.isArray(hs?.dockIds)
      || Array.isArray(hs?.iconOrder)
      || typeof hs?.showQuote === 'boolean'
      || typeof hs?.headerColor === 'string'
      || typeof hs?.dockColor === 'string'
      || hasRemoteBgState;
    if (!homescreenDirtyRef.current && hasRemoteHomescreenState) {
      const remoteDockIds = Array.isArray(hs?.dockIds)
        ? sanitizeDock(hs.dockIds, MAX_DOCK_DESKTOP)
        : sanitizeDock(DEFAULT_DOCK, MAX_DOCK_DESKTOP);
      const remoteIconOrder = Array.isArray(hs?.iconOrder)
        ? sanitizeOrder(hs.iconOrder)
        : sanitizeOrder(DEFAULT_ORDER);
      const nextWidgets = hasRemoteWidgets ? fromSupabase : { ...DEFAULT_HS_WIDGETS };
      const nextSizes = remoteWidgetSizes || {};
      const nextLayout = normalizeHomescreenLayout(
        remoteLayout.length > 0 ? remoteLayout : buildLayoutFromLegacy(remoteUnifiedGrid, nextWidgets, nextSizes, remoteDockIds),
        nextWidgets,
        nextSizes,
        remoteDockIds,
      );
      const nextUnified = layoutToUnifiedGrid(nextLayout);
      const nextShowQuote = typeof hs?.showQuote === 'boolean' ? hs.showQuote : true;
      const nextHeaderColor = typeof hs?.headerColor === 'string' ? hs.headerColor : '';
      const nextDockColor = typeof hs?.dockColor === 'string' ? hs.dockColor : '';

      setHsWidgets(prev => JSON.stringify(prev) === JSON.stringify(nextWidgets) ? prev : nextWidgets);
      setScopedStorageItem(LS_WIDGETS_BASE, JSON.stringify(nextWidgets), user.id);
      setHsWidgetSizes(prev => JSON.stringify(prev) === JSON.stringify(nextSizes) ? prev : nextSizes);
      if (Object.keys(nextSizes).length > 0) setScopedStorageItem(LS_WIDGET_SIZES_BASE, JSON.stringify(nextSizes), user.id);
      else removeScopedStorageItem(LS_WIDGET_SIZES_BASE, user.id);
      setDockIds(prev => JSON.stringify(prev) === JSON.stringify(remoteDockIds) ? prev : remoteDockIds);
      setScopedStorageItem(LS_DOCK_BASE, JSON.stringify(remoteDockIds), user.id);
      setIconOrder(prev => JSON.stringify(prev) === JSON.stringify(remoteIconOrder) ? prev : remoteIconOrder);
      setScopedStorageItem(LS_ORDER_BASE, JSON.stringify(remoteIconOrder), user.id);
      setShowQuote(prev => prev === nextShowQuote ? prev : nextShowQuote);
      setScopedStorageItem(LS_QUOTE_BASE, String(nextShowQuote), user.id);
      setHomescreenLayout(nextLayout);
      setUnifiedGrid(nextUnified);
      setScopedStorageItem(LS_LAYOUT_BASE, JSON.stringify(nextLayout), user.id);
      setScopedStorageItem(LS_UNIFIED_BASE, JSON.stringify(nextUnified), user.id);
      setHeaderColor(prev => prev === nextHeaderColor ? prev : nextHeaderColor);
      if (nextHeaderColor) setScopedStorageItem(LS_HEADER_COLOR_BASE, nextHeaderColor, user.id);
      else removeScopedStorageItem(LS_HEADER_COLOR_BASE, user.id);
      setDockColor(prev => prev === nextDockColor ? prev : nextDockColor);
      if (nextDockColor) setScopedStorageItem(LS_DOCK_COLOR_BASE, nextDockColor, user.id);
      else removeScopedStorageItem(LS_DOCK_COLOR_BASE, user.id);
    }

    const allowLocalBgFallback = homescreenBootstrapSource === 'cache' && !hasRemoteBgState;
    const localBgImage = allowLocalBgFallback ? getScopedStorageItem(LS_BG_BASE, user.id) : null;
    const localBgChoice = allowLocalBgFallback ? getScopedStorageItem(LS_BG_CHOICE_BASE, user.id) : null;
    const localBgPositionRaw = allowLocalBgFallback ? getScopedStorageItem(LS_BG_POS_Y_BASE, user.id) : null;
    const parsedLocalBgPosition = localBgPositionRaw === null ? NaN : Number(localBgPositionRaw);
    const localBgPosition = Number.isFinite(parsedLocalBgPosition) ? Math.max(0, Math.min(100, parsedLocalBgPosition)) : 50;
    const localChoice = isBgChoiceValue(localBgChoice) ? localBgChoice : null;
    const localWallpaper = allowLocalBgFallback && typeof localBgImage === 'string' && !!localBgImage && !isDefaultBgAsset(localBgImage) ? localBgImage : '';
    const remoteWallpaper = typeof hs.bgImage === 'string' && !!hs.bgImage && !isDefaultBgAsset(hs.bgImage) ? hs.bgImage : '';
    const remoteChoice = isBgChoiceValue(hs.bgChoice) ? hs.bgChoice : null;
    const inferredChoice: BgChoice = remoteChoice
      ?? (remoteWallpaper ? 'wallpaper' : s?.homescreenBg ? 'style' : allowLocalBgFallback ? (localChoice ?? (localWallpaper ? 'wallpaper' : 'default')) : 'default');
    const resolvedChoice: BgChoice = inferredChoice === 'wallpaper' && !(remoteWallpaper || (allowLocalBgFallback && localWallpaper))
      ? 'default'
      : inferredChoice;

    setBgChoiceState(resolvedChoice);

    const remoteBg = s?.homescreenBg
      ? {
          mode: s.homescreenBg.mode === 'gradient' ? 'gradient' as 'solid'|'gradient'
          : 'solid' as 'solid'|'gradient',
          color1: s.homescreenBg.color1 || '',
          color2: s.homescreenBg.color2 || '',
          color3: s.homescreenBg.color3 || '',
          angle: typeof s.homescreenBg.angle === 'number' ? s.homescreenBg.angle : 180,
          glow: typeof s.homescreenBg.glow === 'boolean' ? s.homescreenBg.glow : false,
        }
      : { mode: 'solid', color1: '', color2: '', color3: '', angle: 180, glow: false };
    const remoteBgJson = JSON.stringify(remoteBg);
    setHsBg(prev => JSON.stringify(prev) === remoteBgJson ? prev : remoteBg);
    if (s?.homescreenBg) localStorage.setItem(LS_HSBG_KEY(), remoteBgJson);
    else removeScopedStorageItem(LS_HSBG_BASE, user.id);

    const nextBgPosition = resolvedChoice === 'wallpaper'
      ? (typeof hs.bgPositionY === 'number'
          ? Math.max(0, Math.min(100, hs.bgPositionY))
          : allowLocalBgFallback && localChoice === 'wallpaper'
            ? localBgPosition
            : 50)
      : 50;
    setBgPositionY(prev => prev === nextBgPosition ? prev : nextBgPosition);
    setScopedStorageItem(LS_BG_POS_Y_BASE, String(nextBgPosition), user.id);

    if (resolvedChoice === 'wallpaper') {
      const resolvedBgImage = remoteWallpaper || (allowLocalBgFallback && localChoice === 'wallpaper' ? localWallpaper : '');
      if (resolvedBgImage) {
        setBgImage(prev => prev === resolvedBgImage ? prev : resolvedBgImage);
        setScopedStorageItem(LS_BG_BASE, resolvedBgImage, user.id);
      }
    } else {
      const nextDefaultBg = theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK;
      setBgImage(prev => prev === nextDefaultBg ? prev : nextDefaultBg);
      removeScopedStorageItem(LS_BG_BASE, user.id);
    }
  }, [homescreenBootstrapSource, homescreenReady, profile, setBgChoiceState, theme, user?.id]);
 
  useEffect(() => {
    if (!homescreenReady || !user?.id) return;
    setScopedStorageItem(LS_SNAPSHOT_BASE, JSON.stringify({
      dockIds,
      iconOrder,
      showQuote,
      bgImage: bgChoice === 'style' ? '' : bgImage,
      bgPositionY,
      headerColor,
      bgChoice,
      hsBgActive,
      hsBg,
      dockColor,
      bgGradLeft,
      bgGradRight,
      hsWidgets,
      hsWidgetSizes,
      unifiedGrid,
      homescreenLayout,
    } as HomescreenSnapshot), user.id);
  }, [bgChoice, bgGradLeft, bgGradRight, bgImage, bgPositionY, dockColor, dockIds, headerColor, homescreenLayout, homescreenReady, hsBg, hsBgActive, hsWidgetSizes, hsWidgets, iconOrder, showQuote, unifiedGrid, user?.id]);

  // Live update from Settings page widget toggle events
  useEffect(() => {
    const handler = (detail: any) => {
      const nextDetail = detail || {};
      if (nextDetail.mode !== 'homescreen') return;
      setHsWidgets(prev => {
        const next = clampHsWidgets({ ...prev, ...nextDetail });
        homescreenDirtyRef.current = true;
        localStorage.setItem(LS_WIDGETS_KEY(), JSON.stringify(next));
        const nextLayout = normalizeHomescreenLayout(homescreenLayout, next, hsWidgetSizes, dockIds);
        persistLayout(nextLayout, currentPage, next, hsWidgetSizes);
        return next;
      });
    };
    return onEvent('widgetSettingsChanged', handler);
  }, [currentPage, dockIds, homescreenLayout, hsWidgetSizes, persistLayout]);

  // Live update from Settings page background style changes
  useEffect(() => {
    const handler = (d: any) => {
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
      setBgChoiceState('style');
      setBgImage('');
      removeScopedStorageItem(LS_BG_BASE, user?.id);
      removeScopedStorageItem(LS_BG_POS_Y_BASE, user?.id);
    };
    return onEvent('homescreenBgChanged', handler);
  }, [setBgChoiceState, user?.id]);

  useEffect(() => {
    if (bgChoice !== 'default') return;
    const next = theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK;
    setBgImage(prev => prev === next ? prev : next);
  }, [bgChoice, theme]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: editMode ? 180 : 750, tolerance: 6 } }),
  );

  // ── Unified drag handler ──
  const handleDragStart = useCallback((e: any) => {
    clearDragPageSwitchTimer();
    setActiveId(e.active.id);
    if (e.active.data.current?.type === 'unified') {
      dragItemIdRef.current = e.active.id as string;
      dragPageIndexRef.current = _pageDragStateRef.current.currentPageData?.index ?? currentPage;
    } else {
      dragItemIdRef.current = null;
      dragPageIndexRef.current = null;
    }
  }, [clearDragPageSwitchTimer, currentPage]);
  const handleDragEnd   = useCallback((e: any) => {
    clearDragPageSwitchTimer();
    setActiveId(null);
    const { active, over } = e;

    const { currentPageData } = _pageDragStateRef.current;

    const activeType  = active.data.current?.type as "unified" | "dock";
    const overType    = over.data.current?.type   as "unified" | "dock" | undefined;

    if (activeType === "unified" && (!over || active.id === over.id)) {
      dragItemIdRef.current = null;
      dragPageIndexRef.current = null;
      setDragPages(null);
      return;
    }

    dragItemIdRef.current = null;
    dragPageIndexRef.current = null;

    if (!over || active.id === over.id) {
      setDragPages(null);
      return;
    }

    if (activeType === "unified" && (overType === "unified" || !overType)) {
      const overId = over.id as string;
      const activeIdStr = active.id as string;
      if (!currentPageData) return;
      const activeItem = homescreenLayout.find(item => item.id === activeIdStr);
      if (!activeItem) {
        setDragPages(null);
        return;
      }
      let targetPage = activeItem.page;
      let targetRow = activeItem.row;
      let targetCol = activeItem.col;
      if (overId.startsWith('empty::')) {
        const parts = overId.replace('empty::', '').split(':').map(Number);
        if (parts.length === 3) {
          targetPage = Math.max(0, Math.min(MAX_PAGES - 1, parts[0] || 0));
          targetRow = Math.max(0, Math.min(GRID_ROWS - 1, parts[1] || 0));
          targetCol = Math.max(0, Math.min(GRID_COLS - 1, parts[2] || 0));
        }
      } else {
        const targetItem = homescreenLayout.find(item => item.id === overId);
        if (targetItem) {
          targetPage = targetItem.page;
          targetRow = targetItem.row;
          targetCol = targetItem.col;
        }
      }
      const candidate = clampLayoutItem({ ...activeItem, page: targetPage, row: targetRow, col: targetCol }, hsWidgetSizes);
      const layoutWithoutActive = homescreenLayout.filter(item => item.id !== activeIdStr);
      if (!canPlaceLayoutItem(layoutWithoutActive, candidate, hsWidgetSizes, [activeIdStr])) {
        setDragPages(null);
        return;
      }
      persistLayout([...layoutWithoutActive, candidate], candidate.page);
      setDragPages(null);
      return;
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
    setDragPages(null);
  }, [clearDragPageSwitchTimer, currentPage, dragPages, homescreenLayout, hsWidgetSizes, persistLayout, syncToSupabase]);

  const handleDragCancel = useCallback(() => {
    clearDragPageSwitchTimer();
    dragItemIdRef.current = null;
    dragPageIndexRef.current = null;
    setActiveId(null);
    setDragPages(null);
  }, [clearDragPageSwitchTimer]);

  // ── BG ──
  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    try {
      const prepared = await prepareWallpaperUpload(file);
      const path = `homescreen/${user.id}/wallpapers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${prepared.ext}`;
      const { error: uploadError } = await supabase.storage.from('images').upload(path, prepared.body, { contentType: prepared.contentType || undefined, upsert: true, cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('images').getPublicUrl(path);
      const url = publicData?.publicUrl;
      if (!url) throw new Error('wallpaper_public_url_missing');
      setBgImage(url);
      setBgPositionY(50);
      setBgChoiceState('wallpaper');
      setScopedStorageItem(LS_BG_BASE, url, user.id);
      setScopedStorageItem(LS_BG_POS_Y_BASE, '50', user.id);
      await syncToSupabase({ bgChoice: 'wallpaper', bgImage: url, bgPositionY: 50 });
    } catch (error) {
      console.error('Wallpaper upload failed:', error);
      reportSaveError();
    } finally {
      e.target.value = '';
    }
  };
  const removeBg = () => {
    setBgImage(theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK);
    setBgPositionY(50);
    setBgChoiceState('default');
    removeScopedStorageItem(LS_BG_BASE, user?.id);
    removeScopedStorageItem(LS_BG_POS_Y_BASE, user?.id);
    void syncToSupabase({ bgChoice: 'default', bgImage: '', bgPositionY: 50 });
  };
  const saveBgPositionY = (value: number) => {
    if (bgChoice !== 'wallpaper') return;
    const next = Math.max(0, Math.min(100, value));
    setBgPositionY(next);
    if (user?.id) setScopedStorageItem(LS_BG_POS_Y_BASE, String(next), user.id);
    void syncToSupabase({ bgPositionY: next });
  };
  const saveBgStyle = () => {
    const patch = { mode: hsBg.mode, color1: hsBg.color1, color2: hsBg.color2, color3: hsBg.color3, angle: hsBg.angle, glow: hsBg.glow };
    localStorage.setItem(LS_HSBG_KEY(), JSON.stringify(patch));
    setBgChoiceState('style');
    setBgImage('');
    setBgPositionY(50);
    removeScopedStorageItem(LS_BG_BASE, user?.id);
    removeScopedStorageItem(LS_BG_POS_Y_BASE, user?.id);
    void syncToSupabase({ bgChoice: 'style', bgImage: '', bgPositionY: 50 }, { homescreenBg: patch });
    emitEvent('homescreenBgChanged', patch);
    setBgPanelOpen(false);
  };
  const saveHeaderColor = (color: string) => {
    setHeaderColor(color);
    localStorage.setItem(LS_HEADER_COLOR_KEY(), color);
    void syncToSupabase({ headerColor: color });
  };
  const removeHeaderColor = () => {
    setHeaderColor("");
    localStorage.removeItem(LS_HEADER_COLOR_KEY());
    void syncToSupabase({ headerColor: "" });
  };
  const toggleQuote = () => {
    const next = !showQuote;
    setShowQuote(next);
    localStorage.setItem(LS_QUOTE_KEY(), String(next));
    void syncToSupabase({ showQuote: next });
  };

  const toggleHsWidget = (key: keyof typeof hsWidgets) => {
    setHsWidgets(prev => {
      const VISIBLE: (keyof typeof hsWidgets)[] = ['showCalendarWidget','showTRWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget'];
      const activeCount = VISIBLE.filter(k => prev[k]).length;
      const isOn = prev[key];
      if (!isOn && activeCount >= MAX_WIDGETS) return prev;
      const next = { ...prev, [key]: !isOn };
      homescreenDirtyRef.current = true;
      localStorage.setItem(LS_WIDGETS_KEY(), JSON.stringify(next));
      const nextLayout = normalizeHomescreenLayout(homescreenLayout, next, hsWidgetSizes, dockIds);
      persistLayout(nextLayout, !isOn ? 0 : currentPage, next, hsWidgetSizes);
      return next;
    });
  };

  const isMobileCallback = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxDockCallback = isMobileCallback ? MAX_DOCK_MOBILE : MAX_DOCK_DESKTOP;

  const toggleDockIcon = useCallback((id: string) => {
    setDockIds(prevDock => {
      let nextDock: string[];
      const nextPages = (_pageDragStateRef.current.savedPages || [[]]).map(page => [...page]);
      const pageIndex = Math.max(0, Math.min(currentPage, Math.max(0, nextPages.length - 1)));
      if (prevDock.includes(id)) {
        nextDock = prevDock.filter(x => x !== id);
        const appKey = `app::${id}`;
        if (!nextPages[pageIndex]) nextPages[pageIndex] = [];
        if (!nextPages.some(page => page.includes(appKey))) {
          nextPages[pageIndex].push(appKey);
        }
        persistSavedPages(nextPages, pageIndex);
        void syncToSupabase({ dockIds: nextDock, unifiedGrid: flattenUnifiedPages(nextPages) });
      } else {
        if (prevDock.length < maxDockCallback) {
          nextDock = [...prevDock, id];
        } else {
          const evicted = prevDock[prevDock.length - 1];
          nextDock = [...prevDock.slice(0, maxDockCallback - 1), id];
          const evictedKey = `app::${evicted}`;
          if (!nextPages[pageIndex]) nextPages[pageIndex] = [];
          if (!nextPages.some(page => page.includes(evictedKey))) {
            nextPages[pageIndex].push(evictedKey);
          }
        }
        const appKey = `app::${id}`;
        const updatedPages = nextPages.map(page => page.filter(x => x !== appKey));
        persistSavedPages(updatedPages, pageIndex);
        void syncToSupabase({ dockIds: nextDock, unifiedGrid: flattenUnifiedPages(updatedPages) });
      }
      localStorage.setItem(LS_DOCK_KEY(), JSON.stringify(nextDock));
      _pendingDock.current = nextDock;
      if (prevDock.includes(id)) setCurrentPage(0);
      return nextDock;
    });
  }, [currentPage, persistSavedPages, syncToSupabase]);

  // ── Derived lists — bulletproof dedup & dynamic grid generation ──
  // Cap dockSet to the actual rendered slots so overflow apps (e.g. Maw3d on mobile)
  // appear in the main grid instead of being hidden in both dock and grid.
  const _isMobileGrid = typeof window !== 'undefined' && window.innerWidth < 768;
  const _maxDockGrid  = _isMobileGrid ? MAX_DOCK_MOBILE : MAX_DOCK_DESKTOP;
  const dockSet = new Set(dockIds.slice(0, _maxDockGrid));
  const enabledWidgetIds = new Set(WIDGET_IDS.filter(k => hsWidgets[k]).map(k => `widget::${k}`));

  const { pages, savedPages } = React.useMemo(() => {
    const normalizedLayout = normalizeHomescreenLayout(homescreenLayout, hsWidgets, hsWidgetSizes, dockIds);
    const builtPages = Array.from({ length: MAX_PAGES }, (_, index) => buildPageDataFromLayout(normalizedLayout, index));
    const lastIndex = Math.max(0, ...builtPages.map(page => page.items.length > 0 ? page.index : 0));
    const visiblePages = builtPages.slice(0, lastIndex + 1);
    const nextSavedPages = visiblePages.map(page => page.items.map(item => item.id));
    return {
      pages: visiblePages.length > 0 ? visiblePages : [buildPageDataFromLayout(normalizedLayout, 0)],
      savedPages: nextSavedPages.length > 0 ? nextSavedPages : [[]],
    };
  }, [dockIds, homescreenLayout, hsWidgetSizes, hsWidgets]);

  const safeCurrentPage = Math.min(currentPage, Math.max(0, pages.length - 1));
  const currentPageData = pages[safeCurrentPage] || pages[0];
  const pageCount = pages.length;

  const samePageMoveOptions = useMemo(() => {
    if (!samePageMoveState) return null;
    const activeItem = homescreenLayout.find(item => item.id === samePageMoveState.itemId);
    if (!activeItem) return null;
    const layoutWithoutActive = homescreenLayout.filter(item => item.id !== samePageMoveState.itemId);
    const positions = findAllOpenPositions(layoutWithoutActive, samePageMoveState.itemId, activeItem.page, hsWidgetSizes)
      .filter(position => !(position.page === activeItem.page && position.row === activeItem.row && position.col === activeItem.col));
    return { activeItem, layoutWithoutActive, positions };
  }, [homescreenLayout, hsWidgetSizes, samePageMoveState]);

  const samePageSwapOptions = useMemo(() => {
    if (!samePageSwapState) return null;
    const activeItem = homescreenLayout.find(item => item.id === samePageSwapState.itemId);
    if (!activeItem) return null;
    const targets = findValidSwapTargets(homescreenLayout, activeItem, hsWidgetSizes);
    return { activeItem, targets };
  }, [homescreenLayout, hsWidgetSizes, samePageSwapState]);

  const bulkMoveOptions = useMemo(() => {
    if (!bulkMoveSelection) return null;
    const selectedSet = new Set(bulkMoveSelection.selectedIds);
    const selectedItems = homescreenLayout.filter(item => selectedSet.has(item.id));
    const anchorItem = homescreenLayout.find(item => item.id === bulkMoveSelection.anchorItemId) || selectedItems[0] || null;
    if (!anchorItem || selectedItems.length !== bulkMoveSelection.selectedIds.length) return null;
    return {
      anchorItem,
      selectedIds: bulkMoveSelection.selectedIds,
      selectedItems,
      selectedSet,
    };
  }, [bulkMoveSelection, homescreenLayout]);
  const bulkSelectionCount = bulkMoveOptions?.selectedIds.length || 0;
  const bulkMoveOtherPage = safeCurrentPage === 0 ? 1 : 0;

  const clearBulkMoveSelection = useCallback(() => {
    setBulkMoveSelection(null);
  }, []);

  const startBulkMoveSelection = useCallback((itemId: string) => {
    setSamePageMoveState(null);
    setSamePageSwapState(null);
    setContextMenu(null);
    setBulkMoveSelection({ anchorItemId: itemId, selectedIds: [itemId] });
  }, []);

  const toggleBulkMoveSelection = useCallback((itemId: string) => {
    setBulkMoveSelection(prev => {
      if (!prev) return prev;
      const anchorItem = homescreenLayout.find(item => item.id === prev.anchorItemId);
      const nextItem = homescreenLayout.find(item => item.id === itemId);
      if (!anchorItem || !nextItem || nextItem.page !== anchorItem.page) return prev;
      const exists = prev.selectedIds.includes(itemId);
      const nextSelectedIds = exists
        ? prev.selectedIds.filter(id => id !== itemId)
        : [...prev.selectedIds, itemId];
      if (nextSelectedIds.length === 0) return null;
      return {
        anchorItemId: nextSelectedIds.includes(prev.anchorItemId) ? prev.anchorItemId : nextSelectedIds[0],
        selectedIds: nextSelectedIds,
      };
    });
  }, [homescreenLayout]);

  const autoPackBulkMoveSelection = useCallback((targetPage: number) => {
    if (!bulkMoveSelection) return;
    const packed = autoPackLayoutItems(homescreenLayout, bulkMoveSelection.selectedIds, targetPage, hsWidgetSizes);
    if (!packed) {
      toast.error(language === 'ar' ? 'لا توجد مساحة كافية لكل العناصر المحددة' : 'Not enough space for all selected items');
      return;
    }
    persistLayout(packed.nextLayout, targetPage);
  }, [bulkMoveSelection, homescreenLayout, hsWidgetSizes, language, persistLayout]);

  useEffect(() => {
    if (bulkMoveSelection && !bulkMoveOptions) {
      setBulkMoveSelection(null);
    }
  }, [bulkMoveOptions, bulkMoveSelection]);

  _effectiveRef.current = currentPageData?.effectiveItems || [];
  _pageDragStateRef.current = { currentPageData, savedPages };

  // Automatic page-switching during drag is DISABLED — it caused instant jumps
  // for full-width widgets. Use the arrow buttons on widgets to move between pages.
  const handleDragMove = useCallback((_event: any) => {
    clearDragPageSwitchTimer();
  }, [clearDragPageSwitchTimer]);

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, Math.max(0, pages.length - 1)));
  }, [pages.length]);

  useEffect(() => {
    if (editMode) setBulkMoveSelection(null);
  }, [editMode]);

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
  const isDraggingLayout = activeId !== null;
  const showLayoutGuides = editMode || isDraggingLayout;

  const handlePageTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (editMode) return;
    pageTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  }, [editMode]);

  const handlePageTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (editMode) return;
    const startX = pageTouchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    pageTouchStartXRef.current = null;
    if (startX == null || endX == null) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 42) return;
    if (deltaX < 0 && safeCurrentPage < pageCount - 1) {
      setCurrentPage(safeCurrentPage + 1);
    }
    if (deltaX > 0 && safeCurrentPage > 0) {
      setCurrentPage(safeCurrentPage - 1);
    }
  }, [editMode, pageCount, safeCurrentPage]);

  const quoteText   = useMemo(() => quote ? getQuoteText(quote, language) : "", [quote, language]);
  const quoteAuthor = useMemo(() => quote ? getQuoteAuthor(quote) : "", [quote]);

  // ── Theme-aware surface colors ──
  const isDark = theme === "dark";
  const defaultBg = isDark ? DEFAULT_BG_DARK : DEFAULT_BG_LIGHT;
  const hasUserImage = bgChoice === 'wallpaper' && !!bgImage;
  const isDefaultBgImage = bgChoice === 'default' || bgImage === defaultBg || bgImage === DEFAULT_BG_DARK || bgImage === DEFAULT_BG_LIGHT;
  const hasBg  = !!bgImage && bgChoice !== 'style';
  const hasCustomBg = bgChoice === 'style';
  const hasAnyBg = hasBg || hasCustomBg;
  const wallpaperTranslateY = `${(bgPositionY - 50) * 1.2}%`;
  const isAppleMobile = isAppleMobileDevice();
  const isMobileGlass = isLargeSurfaceMobileDevice();
  const isAppleLargeSurface = isMobileGlass && isAppleMobile;
  const effectiveDockColor = dockColor || (isDark ? '#0c0f14' : '#060541');
  const dockTintIsDark = dockColor ? getHexLuminance(effectiveDockColor) < 0.32 : isDark;
  const dockTrayBackground = dockColor
    ? `linear-gradient(180deg, ${rgbaFromHex(effectiveDockColor, dockTintIsDark ? 0.42 : 0.92)} 0%, ${rgbaFromHex(effectiveDockColor, dockTintIsDark ? 0.3 : 0.84)} 100%)`
    : `linear-gradient(180deg, rgba(255,255,255,${isAppleLargeSurface ? 0.18 : isMobileGlass ? 0.26 : isAppleMobile ? 0.42 : 0.66}) 0%, rgba(255,255,255,${isAppleLargeSurface ? 0.08 : isMobileGlass ? 0.12 : isAppleMobile ? 0.2 : 0.34}) 24%, rgba(255,255,255,${isAppleLargeSurface ? 0.024 : isMobileGlass ? 0.04 : isAppleMobile ? 0.08 : 0.16}) 100%), radial-gradient(circle at 50% -12%, rgba(255,255,255,${isAppleLargeSurface ? 0.11 : isMobileGlass ? 0.14 : isAppleMobile ? 0.24 : 0.42}) 0%, transparent 46%), linear-gradient(135deg, rgba(255,255,255,${isAppleLargeSurface ? 0.05 : isMobileGlass ? 0.07 : isAppleMobile ? 0.12 : 0.22}) 0%, rgba(255,255,255,${isAppleLargeSurface ? 0.016 : isMobileGlass ? 0.02 : isAppleMobile ? 0.04 : 0.08}) 46%, rgba(255,255,255,${isAppleLargeSurface ? 0.03 : isMobileGlass ? 0.04 : isAppleMobile ? 0.08 : 0.14}) 100%)`;
  const dockTrayBorder = dockColor
    ? `1px solid rgba(255,255,255,${isAppleLargeSurface ? (dockTintIsDark ? 0.08 : 0.13) : isMobileGlass ? (dockTintIsDark ? 0.12 : 0.18) : isAppleMobile ? (dockTintIsDark ? 0.2 : 0.3) : (dockTintIsDark ? 0.28 : 0.42)})`
    : `1px solid rgba(255,255,255,${isAppleLargeSurface ? 0.15 : isMobileGlass ? 0.16 : isAppleMobile ? 0.28 : 0.42})`;
  const dockTrayOutline = dockColor
    ? `1px solid rgba(255,255,255,${isAppleLargeSurface ? (dockTintIsDark ? 0.02 : 0.04) : isMobileGlass ? (dockTintIsDark ? 0.03 : 0.06) : isAppleMobile ? (dockTintIsDark ? 0.06 : 0.1) : (dockTintIsDark ? 0.1 : 0.16)})`
    : `1px solid rgba(255,255,255,${isAppleLargeSurface ? 0.04 : isMobileGlass ? 0.04 : isAppleMobile ? 0.08 : 0.12})`;
  const dockTrayShadow = dockColor
    ? `0 18px 36px rgba(0,0,0,${isAppleLargeSurface ? '0.34' : isMobileGlass ? '0.42' : '0.26'}), inset 0 1px 0 rgba(255,255,255,${isAppleLargeSurface ? '0.05' : isMobileGlass ? '0.08' : '0.16'})`
    : isAppleLargeSurface
      ? '0 14px 24px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.08)'
      : isMobileGlass
      ? '0 18px 38px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
      : `0 22px 48px rgba(0,0,0,${isAppleMobile ? '0.3' : '0.24'}), inset 0 1px 0 rgba(255,255,255,${isAppleMobile ? '0.12' : '0.18'})`;
  const dockTopSheen = dockColor
    ? `linear-gradient(180deg, rgba(255,255,255,${isAppleLargeSurface ? (dockTintIsDark ? 0.05 : 0.12) : isMobileGlass ? (dockTintIsDark ? 0.08 : 0.18) : dockTintIsDark ? 0.12 : 0.24}) 0%, rgba(255,255,255,${isAppleLargeSurface ? (dockTintIsDark ? 0.012 : 0.035) : isMobileGlass ? (dockTintIsDark ? 0.02 : 0.06) : dockTintIsDark ? 0.04 : 0.12}) 42%, transparent 100%)`
    : `linear-gradient(180deg, rgba(255,255,255,${isAppleLargeSurface ? 0.1 : isMobileGlass ? 0.08 : isAppleMobile ? 0.18 : 0.26}) 0%, rgba(255,255,255,${isAppleLargeSurface ? 0.03 : isMobileGlass ? 0.02 : isAppleMobile ? 0.06 : 0.12}) 42%, transparent 100%)`;
  const dockBottomTint = dockColor
    ? `linear-gradient(180deg, transparent 38%, rgba(0,0,0,${isAppleLargeSurface ? (dockTintIsDark ? 0.12 : 0.06) : isMobileGlass ? (dockTintIsDark ? 0.16 : 0.08) : dockTintIsDark ? 0.24 : 0.12}) 100%)`
    : `linear-gradient(180deg, transparent 38%, rgba(0,0,0,${isAppleLargeSurface ? 0.05 : isMobileGlass ? 0.12 : isAppleMobile ? 0.14 : 0.1}) 100%)`;

  const headColor = headerColor || (hasAnyBg ? "#ffffff" : isDark ? "#f2f2f2" : "#060541");
  const subColor  = headerColor ? `${headerColor}b3` : (hasAnyBg ? "rgba(255,255,255,0.72)" : isDark ? "rgba(242,242,242,0.55)" : "rgba(6,5,65,0.55)");

  // Stat card surface — frosted glass with dark tint so white text is always readable
  const statCardBase = hasAnyBg
    ? isAppleLargeSurface
      ? "bg-black/18 backdrop-blur-xl border border-white/[0.1] shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
      : isMobileGlass
      ? "bg-black/34 backdrop-blur-xl border border-white/[0.1] shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
      : "bg-black/30 backdrop-blur-xl border border-white/20 shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
    : isDark
      ? isAppleLargeSurface
        ? "bg-black/[0.1] backdrop-blur-xl border border-white/[0.085] shadow-[0_10px_24px_rgba(0,0,0,0.1)]"
        : isMobileGlass
        ? "bg-black/[0.18] backdrop-blur-xl border border-white/[0.085] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
        : "bg-white/[0.06] backdrop-blur-xl border border-white/10"
      : "bg-white backdrop-blur-xl border border-[#060541]/10 shadow-[0_2px_12px_rgba(6,5,65,0.08)]";

  const statNumBase = hasAnyBg || isDark ? "" : "!text-[#060541]";
  const statLblColor = hasAnyBg ? "rgba(255,255,255,0.65)" : isDark ? "rgba(242,242,242,0.5)" : "rgba(6,5,65,0.55)";

  // Dock glass
  const dockGlass = hasAnyBg
    ? isMobileGlass
      ? "bg-black/55 backdrop-blur-xl border border-white/[0.08] shadow-[0_12px_30px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)]"
      : "bg-black/40 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.15)]"
    : isDark
      ? isMobileGlass
        ? "bg-black/[0.34] backdrop-blur-xl border border-white/[0.06] shadow-[0_12px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]"
        : "bg-white/[0.08] backdrop-blur-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]"
      : "bg-[#060541]/90 backdrop-blur-2xl border border-[#060541]/20 shadow-[0_8px_32px_rgba(6,5,65,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]";

  // Quote glass
  const quoteGlass = hasAnyBg
    ? isMobileGlass
      ? "bg-black/48 backdrop-blur-lg border border-white/[0.08]"
      : "bg-black/30 backdrop-blur-xl border border-white/15"
    : isDark
      ? isMobileGlass
        ? "bg-black/[0.3] backdrop-blur-lg border border-white/[0.06]"
        : "bg-white/[0.06] backdrop-blur-xl border border-white/10"
      : "bg-[#060541]/[0.06] backdrop-blur-xl border border-[#060541]/10 shadow-sm";
  const quoteTextColor   = hasAnyBg || isDark ? "rgba(255,255,255,0.9)" : "#060541";
  const quoteAuthorColor = hasAnyBg || isDark ? "rgba(255,255,255,0.45)" : "rgba(6,5,65,0.5)";

  // Edit bar glass
  const editBarGlass = "bg-black/40 backdrop-blur-xl border-b border-white/10";

  // Custom background from Settings (solid/gradient) — only active when user explicitly saved
  const hasWallpaperImage = !!bgImage && bgChoice !== 'style';
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
 
  if (!homescreenReady) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-[linear-gradient(135deg,#0c0f14_0%,#11151d_45%,#0c0f14_100%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,96,98,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(133,131,132,0.14),transparent_32%)]" />
        <div className="relative z-10 flex h-full min-h-screen flex-col px-4 pt-4 pb-8">
          <div className="mb-4 flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
              <div className="h-3 w-48 animate-pulse rounded-full bg-white/5" />
            </div>
          </div>
          <div className="mb-4 h-12 w-48 animate-pulse rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl" />
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="h-40 animate-pulse rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl" />
            <div className="h-40 animate-pulse rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl" />
          </div>
          <div className="grid flex-1 grid-cols-4 gap-x-3 gap-y-5 px-2 pt-2">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 animate-pulse rounded-[22px] border border-white/10 bg-white/5 backdrop-blur-xl" />
                <div className="h-3 w-14 animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
          </div>
          <div className="mt-6 h-24 animate-pulse rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl" />
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <>
      <style>{`
        @keyframes hs-edit-sheet-in {
          0% { opacity: 0; transform: translateY(-18px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hs-edit-backdrop-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
      {/* Root — fills parent via flex, dock always at very bottom */}
      <div
        className={`relative overflow-hidden overscroll-none hs-root flex flex-col ${pageBg}`}
        style={{
          ...(hasCustomBg ? {
            background: customBgStyle,
          } : {}),
        }}
      >
          {hasWallpaperImage && (
            <>
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${bgImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: `center ${bgPositionY}%`,
                  backgroundRepeat: 'no-repeat',
                  filter: 'blur(22px)',
                  transform: 'scale(1.14)',
                  opacity: isDefaultBgImage ? 0.92 : 0.98,
                }}
              />
              <div
                className="absolute inset-0 z-0"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.24) 30%, rgba(0,0,0,0.32) 100%)',
                }}
              />
              <div
                className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
              >
                <img
                  src={bgImage}
                  alt=""
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 w-full h-full object-contain select-none"
                  draggable={false}
                  style={{
                    transform: `translate(-50%, calc(-50% + ${wallpaperTranslateY}))`,
                  }}
                />
              </div>
            </>
          )}
          {editMode && (
            <div
              className="absolute inset-0 pointer-events-none z-30"
              style={{
                background: 'rgba(3,8,20,0.38)',
                backdropFilter: 'blur(18px) saturate(120%)',
                WebkitBackdropFilter: 'blur(18px) saturate(120%)',
                animation: 'hs-edit-backdrop-in 0.22s ease forwards',
              }}
            />
          )}
          {/* 1px BG image blur overlay — only when a BG image is active */}
          {(hasBg || hasCustomBg) && (
            <div className="absolute inset-0 pointer-events-none z-0" style={{ backdropFilter: 'blur(0.5px)', WebkitBackdropFilter: 'blur(0.5px)' }} />
          )}
          <div className="flex-none flex items-center justify-between px-4 pt-3 pb-1 relative z-40">
            <div className="px-5 py-1.5 rounded-xl bg-black/25 backdrop-blur-md border border-white/10">
              <p
                className="text-[17px] font-semibold leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[82vw]"
                style={{ color: headColor, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
              >
                {displayName ? `${greeting}, ${displayName}` : greeting}
              </p>
            </div>
          </div>

          {/* ── Unified iPhone-style grid: 3 big rows × 2 big cols = 6 rows × 4 cols ── */}
          <div
            ref={pageViewportRef}
            className="flex-1 min-h-0 px-3 overflow-hidden relative"
            style={{ opacity: editMode ? 0.6 : 1, transition: 'opacity 0.2s ease', touchAction: 'none', overscrollBehavior: 'none', paddingBottom: isAppleLargeSurface ? 26 : 8 }}
            onTouchStart={handlePageTouchStart}
            onTouchEnd={handlePageTouchEnd}
          >
            
            {showLayoutGuides && currentPageData && (
              <div className="absolute inset-0 px-3 pt-2 grid gap-x-1 gap-y-2 pointer-events-none" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', zIndex: 0 }}>
                {currentPageData.effectiveItems.map(itemId => {
                  const gp = currentPageData.gridPositions.get(itemId);
                  if (!gp) return null;
                  if (itemId.startsWith('widget::')) {
                    return <div key={`vis-${itemId}`} style={{ gridArea: gp }} className="border-[3px] border-dashed border-white/50 rounded-3xl" />;
                  } else if (itemId.startsWith('empty::') || itemId.startsWith('app::')) {
                    return <div key={`vis-${itemId}`} style={{ gridArea: gp }} className="border-2 border-dashed border-red-500/50 rounded-2xl" />;
                  }
                  return null;
                })}
              </div>
            )}

            <SortableContext items={currentPageData?.effectiveItems || []} strategy={rectSortingStrategy}>
              <div className={`grid gap-x-1 ${isAppleLargeSurface ? 'gap-y-1' : 'gap-y-2'} relative z-10 h-full`} style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', alignContent: 'start', paddingTop: 8, touchAction: 'none' }}>
                {(() => {
                  return (currentPageData?.effectiveItems || []).map(itemId => {
                    const gp = currentPageData?.gridPositions.get(itemId);
                    if (!gp) return null;
                    const moveItemToPage = (direction: -1 | 1) => {
                      const nextIndex = safeCurrentPage + direction;
                      if (nextIndex < 0 || nextIndex >= MAX_PAGES) return;
                      const activeItem = homescreenLayout.find(item => item.id === itemId);
                      if (!activeItem) return;
                      const layoutWithoutActive = homescreenLayout.filter(item => item.id !== itemId);
                      const nextSpot = findFirstOpenPosition(layoutWithoutActive, itemId, nextIndex, hsWidgetSizes);
                      if (!nextSpot) return;
                      persistLayout([...layoutWithoutActive, nextSpot], nextIndex);
                    };

                    if (itemId.startsWith('empty::')) {
                      return (
                        <EmptySlotCell
                          key={itemId}
                          id={itemId}
                          gridArea={gp}
                          isWidget={false}
                          editMode={showLayoutGuides}
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
                          hasBg={hasAnyBg}
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
                          maw3dEvents={maw3dEvents}
                          attendingCounts={attendingCounts}
                          onExpandQuote={() => { setQuoteExpanded(true); setQuoteExiting(false); }}
                          onLongPress={bulkMoveOptions ? undefined : () => setContextMenu({ itemId: itemId })}
                          bulkSelectionActive={!!bulkMoveOptions}
                          isBulkSelected={bulkMoveOptions?.selectedSet.has(itemId) || false}
                          onBulkSelectToggle={bulkMoveOptions ? () => toggleBulkMoveSelection(itemId) : undefined}
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
                        isDark={isDark || hasAnyBg}
                        glowEnabled={hsBg.glow}
                        navigate={navigate}
                        gridArea={gp}
                        compact={isAppleLargeSurface}
                        avatarUrl={avatarUrl}
                        badgeCount={app.id === 'social' ? connectBadge : 0}
                        onLongPress={bulkMoveOptions ? undefined : () => setContextMenu({ itemId: itemId })}
                        bulkSelectionActive={!!bulkMoveOptions}
                        isBulkSelected={bulkMoveOptions?.selectedSet.has(itemId) || false}
                        onBulkSelectToggle={bulkMoveOptions ? () => toggleBulkMoveSelection(itemId) : undefined}
                      />
                    );
                  });
                })()}
              </div>
            </SortableContext>
          </div>

          {pageCount > 1 && (
            <div className="flex-none pb-1 flex items-center justify-center gap-2 relative z-20">
              {Array.from({ length: pageCount }).map((_, index) => (
                <button
                  key={`bottom-page-pill-${index}`}
                  type="button"
                  aria-label={`Go to page ${index + 1}`}
                  onClick={() => setCurrentPage(index)}
                  className="rounded-full transition-all"
                  style={{
                    minWidth: safeCurrentPage === index ? 28 : 12,
                    width: safeCurrentPage === index ? 28 : 12,
                    height: 12,
                    background: safeCurrentPage === index ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                />
              ))}
            </div>
          )}

          {/* ── DOCK — always at very bottom ── */}
          <div className="mt-auto flex-none mx-2 md:mx-4 lg:mx-6 pt-1 hs-dock-bottom">
            <div
              className="relative flex items-center justify-around w-full rounded-[2.75rem] px-5 overflow-visible"
              style={{
                background: dockTrayBackground,
                backdropFilter: `blur(${isAppleLargeSurface ? '22px' : isMobileGlass ? '24px' : isAppleMobile ? '30px' : '38px'}) saturate(${isAppleLargeSurface ? '126%' : isMobileGlass ? '125%' : isAppleMobile ? '145%' : '170%'})`,
                WebkitBackdropFilter: `blur(${isAppleLargeSurface ? '22px' : isMobileGlass ? '24px' : isAppleMobile ? '30px' : '38px'}) saturate(${isAppleLargeSurface ? '126%' : isMobileGlass ? '125%' : isAppleMobile ? '145%' : '170%'})`,
                border: dockTrayBorder,
                outline: dockTrayOutline,
                boxShadow: dockTrayShadow,
                paddingTop: isAppleLargeSurface ? '14px' : '12px',
                paddingBottom: isAppleLargeSurface ? '16px' : '12px',
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{
                  borderRadius: 'inherit',
                  background: dockTopSheen,
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{
                  borderRadius: 'inherit',
                  background: dockBottomTint,
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{
                  borderRadius: 'inherit',
                  background: 'radial-gradient(circle at 12% 18%, rgba(255,255,255,0.34) 0%, transparent 28%), radial-gradient(circle at 88% 18%, rgba(255,255,255,0.28) 0%, transparent 26%), radial-gradient(circle at 50% 115%, rgba(255,255,255,0.18) 0%, transparent 34%)',
                }}
              />
              <SortableContext items={dockApps.map(a => `dock::${a.id}`)} strategy={horizontalListSortingStrategy}>
                <div className="relative z-10 flex w-full items-center justify-around gap-1.5">
                  {dockApps.map(app => (
                    <DockIcon key={app.id} app={app} editMode={editMode} onTap={() => navigate(app.path)} glowEnabled={hsBg.glow} avatarUrl={avatarUrl} badgeCount={app.id === 'social' ? connectBadge : 0} dockColor={dockColor} />
                  ))}
                  {Array.from({ length: Math.max(0, maxDock - dockApps.length) }).map((_, i) => (
                    <div key={`slot-${i}`} className="w-[72px] h-[72px] rounded-[30%] border border-dashed border-white/20 bg-white/[0.04]" />
                  ))}
                </div>
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
                  <input type="color" title="Dock background color" value={dockColor || (isDark ? '#0c0f14' : '#060541')} onChange={e => { setDockColor(e.target.value); localStorage.setItem(lsKey(_cachedUid(), LS_DOCK_COLOR_BASE), e.target.value); void syncToSupabase({ dockColor: e.target.value }); }}
                    className="w-7 h-7 rounded-lg cursor-pointer border border-border/30 p-0.5 bg-transparent" />
                  <div className="w-7 h-7 rounded-lg border border-white/20 shadow-inner"
                    style={{
                      background: dockColor
                        ? `linear-gradient(180deg, rgba(255,255,255,${dockTintIsDark ? 0.24 : 0.42}) 0%, rgba(255,255,255,${dockTintIsDark ? 0.08 : 0.16}) 100%), linear-gradient(135deg, ${rgbaFromHex(effectiveDockColor, dockTintIsDark ? 0.82 : 0.38)} 0%, ${rgbaFromHex(effectiveDockColor, dockTintIsDark ? 0.64 : 0.24)} 100%)`
                        : 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)'
                    }}
                  />
                  {dockColor && (
                    <button onClick={() => { setDockColor(''); localStorage.removeItem(lsKey(_cachedUid(), LS_DOCK_COLOR_BASE)); void syncToSupabase({ dockColor: '' }); }}
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

          <input ref={bgInputRef} id={bgInputId} type="file" accept="image/*" title={language === 'ar' ? 'رفع خلفية الشاشة الرئيسية' : 'Upload Home Screen wallpaper'} aria-label={language === 'ar' ? 'رفع خلفية الشاشة الرئيسية' : 'Upload Home Screen wallpaper'} className="hidden" onChange={handleBgChange} />

          {/* Saved Images Picker Modal */}
          {savedImagesOpen && (
            <SavedImagesPicker
              onSelect={(imageUrl) => {
                setBgImage(imageUrl);
                setBgPositionY(50);
                setBgChoiceState('wallpaper');
                setScopedStorageItem(LS_BG_BASE, imageUrl, user.id);
                setScopedStorageItem(LS_BG_POS_Y_BASE, '50', user.id);
                void syncToSupabase({ bgChoice: 'wallpaper', bgImage: imageUrl, bgPositionY: 50 });
                setSavedImagesOpen(false);
              }}
              onClose={() => setSavedImagesOpen(false)}
            />
          )}

        {/* ── Long-press Context Menu (Move to Page) ── */}
        {contextMenu && (() => {
          const cmItemId = contextMenu.itemId;
          const currentItem = homescreenLayout.find(item => item.id === cmItemId);
          const samePageOptions = currentItem
            ? findAllOpenPositions(homescreenLayout.filter(item => item.id !== cmItemId), cmItemId, currentItem.page, hsWidgetSizes)
                .filter(position => !(position.page === currentItem.page && position.row === currentItem.row && position.col === currentItem.col))
            : [];
          const samePageSwapTargets = currentItem ? findValidSwapTargets(homescreenLayout, currentItem, hsWidgetSizes) : [];
          const doMove = (direction: -1 | 1) => {
            const nextIndex = safeCurrentPage + direction;
            if (nextIndex < 0 || nextIndex >= MAX_PAGES) { setContextMenu(null); return; }
            const activeItem = homescreenLayout.find(item => item.id === cmItemId);
            if (!activeItem) { setContextMenu(null); return; }
            const layoutWithoutActive = homescreenLayout.filter(item => item.id !== cmItemId);
            const nextSpot = findFirstOpenPosition(layoutWithoutActive, cmItemId, nextIndex, hsWidgetSizes);
            if (!nextSpot) { setContextMenu(null); return; }
            persistLayout([...layoutWithoutActive, nextSpot], nextIndex);
            setContextMenu(null);
          };
          const isWidget = cmItemId.startsWith('widget::');
          const wKey = isWidget ? cmItemId.replace('widget::','') : '';
          const matchedApp = !isWidget ? ALL_APPS.find(a => `app::${a.id}` === cmItemId) : null;
          const itemLabel = isWidget
            ? (language === 'ar' ? (wKey === 'showTRWidget' ? 'ودجت المهام' : wKey === 'showCalendarWidget' ? 'ودجت التقويم' : wKey === 'showMaw3dWidget' ? 'ودجت المواعيد' : wKey === 'showVitalityWidget' ? 'ودجت الصحة' : wKey === 'showJournalWidget' ? 'ودجت اليوميات' : 'ودجت') : (wKey === 'showTRWidget' ? 'Tasks Widget' : wKey === 'showCalendarWidget' ? 'Calendar Widget' : wKey === 'showMaw3dWidget' ? 'Events Widget' : wKey === 'showVitalityWidget' ? 'Vitality Widget' : wKey === 'showJournalWidget' ? 'Journal Widget' : 'Widget'))
            : (language === 'ar' ? matchedApp?.nameAr : matchedApp?.nameEn) || 'Item';
          return (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
              onClick={() => setContextMenu(null)}
            >
              <div
                style={{ background: 'rgba(28,28,30,0.97)', borderRadius: '18px', minWidth: '220px', padding: '6px 0', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: '12px 18px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{itemLabel}</span>
                </div>
                {samePageOptions.length > 0 && (
                  <button
                    onClick={() => {
                      const rect = pageViewportRef.current?.getBoundingClientRect() || null;
                      setSamePageMoveState({
                        itemId: cmItemId,
                        viewport: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
                      });
                      setContextMenu(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px 18px', background: 'none', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {language === 'ar' ? 'نقل في نفس الصفحة' : 'Move on this page'}
                  </button>
                )}
                {samePageSwapTargets.length > 0 && (
                  <button
                    onClick={() => {
                      const rect = pageViewportRef.current?.getBoundingClientRect() || null;
                      setSamePageSwapState({
                        itemId: cmItemId,
                        viewport: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
                      });
                      setContextMenu(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px 18px', background: 'none', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {language === 'ar' ? 'تبديل في نفس الصفحة' : 'Swap on this page'}
                  </button>
                )}
                <button
                  onClick={() => startBulkMoveSelection(cmItemId)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px 18px', background: 'none', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {language === 'ar' ? 'تحديد المزيد من العناصر' : 'Select more items'}
                </button>
                {safeCurrentPage > 0 && (
                  <button
                    onClick={() => doMove(-1)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px 18px', background: 'none', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    ← {language === 'ar' ? 'نقل إلى الصفحة 1' : 'Move to Page 1'}
                  </button>
                )}
                {safeCurrentPage < 1 && (
                  <button
                    onClick={() => doMove(1)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px 18px', background: 'none', border: 'none', color: '#fff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {language === 'ar' ? 'نقل إلى الصفحة 2' : 'Move to Page 2'} →
                  </button>
                )}
                <button
                  onClick={() => setContextMenu(null)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '14px 18px', background: 'none', border: 'none', color: '#ff453a', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          );
        })()}

        {bulkMoveOptions && (
          <div className="fixed inset-x-0 bottom-5 z-[9997] flex justify-center px-4 pointer-events-none">
            <div
              className="w-full max-w-sm rounded-[28px] border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.45)] px-4 py-4 pointer-events-auto"
              style={{ background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' }}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {language === 'ar'
                      ? `تم تحديد ${bulkMoveOptions.selectedIds.length} عنصر`
                      : `${bulkMoveOptions.selectedIds.length} item${bulkMoveOptions.selectedIds.length === 1 ? '' : 's'} selected`}
                  </p>
                  <p className="text-[11px] text-white/60">
                    {language === 'ar' ? 'اضغط على عناصر أخرى لإضافتها أو إزالتها' : 'Tap more items to add or remove them'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearBulkMoveSelection}
                  className="w-8 h-8 rounded-full border border-white/15 bg-white/5 text-white/70 flex items-center justify-center"
                  aria-label={language === 'ar' ? 'إلغاء التحديد المتعدد' : 'Cancel multi selection'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {bulkSelectionCount > 1 ? (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => autoPackBulkMoveSelection(bulkMoveOtherPage)}
                    className="rounded-2xl px-3 py-3 text-sm font-semibold text-white border border-white/12 bg-white/8"
                  >
                    {language === 'ar'
                      ? `نقل المحدد إلى الصفحة ${bulkMoveOtherPage + 1}`
                      : `Move selected to Page ${bulkMoveOtherPage + 1}`}
                  </button>
                  <button
                    type="button"
                    onClick={clearBulkMoveSelection}
                    className="rounded-2xl px-3 py-3 text-sm font-semibold text-red-300 border border-red-400/20 bg-red-500/10"
                  >
                    {language === 'ar' ? 'إلغاء التحديد' : 'Cancel selection'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => autoPackBulkMoveSelection(0)}
                    className="rounded-2xl px-3 py-3 text-sm font-semibold text-white border border-white/12 bg-white/8"
                  >
                    {language === 'ar' ? 'نقل المحدد إلى الصفحة 1' : 'Move selected to Page 1'}
                  </button>
                  <button
                    type="button"
                    onClick={() => autoPackBulkMoveSelection(1)}
                    className="rounded-2xl px-3 py-3 text-sm font-semibold text-white border border-white/12 bg-white/8"
                  >
                    {language === 'ar' ? 'نقل المحدد إلى الصفحة 2' : 'Move selected to Page 2'}
                  </button>
                  <button
                    type="button"
                    onClick={() => autoPackBulkMoveSelection(safeCurrentPage)}
                    className="rounded-2xl px-3 py-3 text-sm font-semibold text-white border border-blue-400/30 bg-blue-500/18"
                  >
                    {language === 'ar' ? 'ضع المحدد في هذه الصفحة' : 'Place selected on this page'}
                  </button>
                  <button
                    type="button"
                    onClick={clearBulkMoveSelection}
                    className="rounded-2xl px-3 py-3 text-sm font-semibold text-red-300 border border-red-400/20 bg-red-500/10"
                  >
                    {language === 'ar' ? 'إلغاء التحديد' : 'Cancel selection'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {samePageMoveState && samePageMoveOptions?.activeItem && samePageMoveState.viewport && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            onClick={() => setSamePageMoveState(null)}
          >
            <div
              style={{
                position: 'fixed',
                top: samePageMoveState.viewport.top,
                left: samePageMoveState.viewport.left,
                width: samePageMoveState.viewport.width,
                height: samePageMoveState.viewport.height,
                pointerEvents: 'none',
              }}
            >
              <div
                className="grid gap-x-1 gap-y-2 h-full"
                style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', paddingTop: 8 }}
              >
                {samePageMoveOptions.positions.map(position => {
                  const gridArea = `${position.row + 1} / ${position.col + 1} / span ${position.h} / span ${position.w}`;
                  return (
                    <button
                      key={`same-page-grid-${position.page}-${position.row}-${position.col}`}
                      title={language === 'ar' ? `ضع العنصر في الصف ${position.row + 1} العمود ${position.col + 1}` : `Place item at row ${position.row + 1}, column ${position.col + 1}`}
                      aria-label={language === 'ar' ? `ضع العنصر في الصف ${position.row + 1} العمود ${position.col + 1}` : `Place item at row ${position.row + 1}, column ${position.col + 1}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        persistLayout([...samePageMoveOptions.layoutWithoutActive, position], position.page);
                      }}
                      style={{
                        gridArea,
                        pointerEvents: 'auto',
                        borderRadius: position.w > 1 || position.h > 1 ? '22px' : '18px',
                        border: '2px solid rgba(255,255,255,0.92)',
                        background: 'rgba(59,130,246,0.3)',
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 10px 24px rgba(37,99,235,0.24)',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {samePageSwapState && samePageSwapOptions?.activeItem && samePageSwapState.viewport && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            onClick={() => setSamePageSwapState(null)}
          >
            <div
              style={{
                position: 'fixed',
                top: samePageSwapState.viewport.top,
                left: samePageSwapState.viewport.left,
                width: samePageSwapState.viewport.width,
                height: samePageSwapState.viewport.height,
                pointerEvents: 'none',
              }}
            >
              <div
                className="grid gap-x-1 gap-y-2 h-full"
                style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', paddingTop: 8 }}
              >
                {samePageSwapOptions.targets.map(target => {
                  const gridArea = `${target.row + 1} / ${target.col + 1} / span ${target.h} / span ${target.w}`;
                  return (
                    <button
                      key={`same-page-swap-${target.id}`}
                      title={language === 'ar' ? 'بدّل مع هذا العنصر' : 'Swap with this item'}
                      aria-label={language === 'ar' ? 'بدّل مع هذا العنصر' : 'Swap with this item'}
                      onClick={(event) => {
                        event.stopPropagation();
                        const activeItem = samePageSwapOptions.activeItem;
                        const layoutWithoutBoth = homescreenLayout.filter(item => item.id !== activeItem.id && item.id !== target.id);
                        const nextActive = clampLayoutItem({ ...activeItem, page: target.page, row: target.row, col: target.col }, hsWidgetSizes);
                        const nextTarget = clampLayoutItem({ ...target, page: activeItem.page, row: activeItem.row, col: activeItem.col }, hsWidgetSizes);
                        persistLayout([...layoutWithoutBoth, nextActive, nextTarget], activeItem.page);
                      }}
                      style={{
                        gridArea,
                        pointerEvents: 'auto',
                        borderRadius: target.w > 1 || target.h > 1 ? '22px' : '18px',
                        border: '2px solid rgba(255,255,255,0.92)',
                        background: 'rgba(168,85,247,0.32)',
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 10px 24px rgba(168,85,247,0.26)',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Quote Expand Overlay ── */}
        {quoteExpanded && (
          <QuoteOverlay
            quoteText={quoteText || ''}
            quoteAuthor={quoteAuthor || ''}
            language={language}
            onClose={() => {
              setQuoteExiting(true);
              setTimeout(() => { setQuoteExpanded(false); setQuoteExiting(false); }, 420);
            }}
            exiting={quoteExiting}
          />
        )}
      </>
    </DndContext>
  );
}
