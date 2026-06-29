import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Search, Play, Pause, Bookmark, BookmarkCheck, BookOpen, MessageCircle, RotateCcw, ChevronRight, ChevronDown, X, Volume2, Clock, Check, ListMusic, Settings2, ListVideo, SkipBack, SkipForward, RotateCw, Eye, EyeOff, ArrowLeftRight } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { bgAudio } from "@/utils/bgAudio";
import { emitEvent } from "@/utils/eventBus";

const EDITIONS = { arabic: "quran-uthmani", english: "en.sahih", tafsirEn: "en.ibn-kathir", tafsirAr: "ar.muyassar" };
const APP_DEFAULT_RECITER_ID = "maher_al_mueaqly";
const RECITER_STORAGE_KEY = "deen_selected_reciter_mp3q";
const READER_RECITER_STORAGE_KEY = "deen_selected_reader_reciter";
const ARABIC_TEXT_TOGGLE_KEY = "deen_show_arabic_text";
const READER_AUDIO_RECITERS = [
  { id: "ar.abdurrahmaansudais", label: "Sudais", labelAr: "السديس" },
  { id: "ar.ahmedajamy", label: "Ahmed Ajamy", labelAr: "أحمد العجمي" },
  { id: "ar.alafasy", label: "Alafasy", labelAr: "العفاسي" },
  { id: "ar.mahermuaiqly", label: "Maher Muaiqly", labelAr: "ماهر المعيقلي" },
  { id: "ar.saoodshuraym", label: "Saood Shuraym", labelAr: "سعود الشريم" },
];
const DEFAULT_READER_AUDIO_RECITER = "ar.mahermuaiqly";
const QURAN_PROGRESS_STORAGE_KEY = "deen_quran_last_progress";
const QURAN_BOOKMARKS_STORAGE_KEY = "deen_quran_bookmarks";
const QURAN_BOOKMARKS_ORDER_KEY = "deen_quran_bookmarks_order";
const QURAN_BOOKMARKS_COLOR_KEY = "deen_quran_bookmarks_color";
const MAX_BOOKMARKS = 5;
const QURAN_BOOKMARKS_LAST_SYNC_KEY = "deen_quran_bookmarks_last_sync";
const BOOKMARKS_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MP3QURAN_API_EN = "https://www.mp3quran.net/api/v3/reciters?language=eng";
const MP3QURAN_API_AR = "https://www.mp3quran.net/api/v3/reciters?language=ar";
const FALLBACK_RECITERS: ReciterOption[] = [
  { id: "maher_al_mueaqly", labelEn: "Maher Al Muaiqly", labelAr: "ماهر المعيقلي", server: "https://server8.mp3quran.net/mhm/", surahList: new Set(Array.from({length:114},(_,i)=>i+1)) },
  { id: "mishari_rashed_alafasy", labelEn: "Mishary Alafasy", labelAr: "مشاري العفاسي", server: "https://server8.mp3quran.net/afs/", surahList: new Set(Array.from({length:114},(_,i)=>i+1)) },
  { id: "abdurrahman_as-sudais", labelEn: "Abdul Rahman Al-Sudais", labelAr: "عبدالرحمن السديس", server: "https://server11.mp3quran.net/sds/", surahList: new Set(Array.from({length:114},(_,i)=>i+1)) },
];

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  audio?: string;
}

interface SurahFull {
  number: number;
  name: string;
  englishName: string;
  ayahs: Ayah[];
}

interface LastProgress {
  surah_number: number;
  ayah_number: number;
}

interface ReciterOption {
  id: string;
  labelEn: string;
  labelAr: string;
  server: string;
  surahList: Set<number>;
}

interface StoredQuranBookmarks {
  [surahNumber: string]: number[];
}

interface EditionItem {
  identifier: string;
  englishName?: string;
  name?: string;
  language?: string;
  format?: string;
  type?: string;
}

interface Mp3QuranReciter {
  id: number;
  name: string;
  moshaf: Array<{
    id: number;
    name: string;
    server: string;
    surah_total: number;
    surah_list: string;
  }>;
}

interface LocalHafsScriptRow {
  sora?: number;
  aya_no?: number;
  aya_text?: string;
}

async function fetchFromProxy(path: string, edition?: string) {
  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deen-quran-proxy`);
  url.searchParams.set("path", path);
  if (edition) url.searchParams.set("edition", edition);
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token ?? "";
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function readStoredProgress(): LastProgress | null {
  try {
    const raw = localStorage.getItem(QURAN_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.surah_number === "number" && typeof parsed?.ayah_number === "number") {
      return { surah_number: parsed.surah_number, ayah_number: parsed.ayah_number };
    }
  } catch {}
  return null;
}

function writeStoredProgress(progress: LastProgress) {
  try {
    localStorage.setItem(QURAN_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

function getUserScopedKey(base: string, uid?: string | null) {
  return uid ? `${base}:${uid}` : `${base}:guest`;
}

function readStoredBookmarks(uid?: string | null): StoredQuranBookmarks {
  try {
    const raw = localStorage.getItem(getUserScopedKey(QURAN_BOOKMARKS_STORAGE_KEY, uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredBookmarks(bookmarks: StoredQuranBookmarks, uid?: string | null) {
  try {
    localStorage.setItem(getUserScopedKey(QURAN_BOOKMARKS_STORAGE_KEY, uid), JSON.stringify(bookmarks));
  } catch {}
}

function readBookmarksOrder(uid?: string | null): string[] {
  try {
    const raw = localStorage.getItem(getUserScopedKey(QURAN_BOOKMARKS_ORDER_KEY, uid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeBookmarksOrder(order: string[], uid?: string | null) {
  try {
    localStorage.setItem(getUserScopedKey(QURAN_BOOKMARKS_ORDER_KEY, uid), JSON.stringify(order.slice(0, MAX_BOOKMARKS)));
  } catch {}
}

function readBookmarkColors(uid?: string | null): Record<string, string> {
  try {
    const raw = localStorage.getItem(getUserScopedKey(QURAN_BOOKMARKS_COLOR_KEY, uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeBookmarkColors(map: Record<string, string>, uid?: string | null) {
  try {
    localStorage.setItem(getUserScopedKey(QURAN_BOOKMARKS_COLOR_KEY, uid), JSON.stringify(map));
  } catch {}
}

function readLastSyncAt(uid?: string | null): number {
  try {
    const raw = localStorage.getItem(getUserScopedKey(QURAN_BOOKMARKS_LAST_SYNC_KEY, uid));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

function writeLastSyncAt(ms: number, uid?: string | null) {
  try { localStorage.setItem(getUserScopedKey(QURAN_BOOKMARKS_LAST_SYNC_KEY, uid), String(ms)); } catch {}
}

function getAllBookmarks(surahs: Surah[], uid?: string | null): { surah: Surah; ayah: number; color: string }[] {
  const stored = readStoredBookmarks(uid);
  const order = readBookmarksOrder(uid);
  const colors = readBookmarkColors(uid);
  const byKey = new Set(order);
  // Build from order first for stable, cross-device sequence; fall back to enumerating stored
  const result: { surah: Surah; ayah: number; color: string }[] = [];
  const pushKey = (key: string) => {
    const [sStr, aStr] = key.split(":");
    const sNum = parseInt(sStr, 10);
    const aNum = parseInt(aStr, 10);
    const surah = surahs.find((s) => s.number === sNum);
    if (surah && Number.isFinite(aNum)) result.push({ surah, ayah: aNum, color: colors[key] || BOOKMARK_COLORS[0].id });
  };
  for (const key of order) pushKey(key);
  for (const [surahKey, ayahs] of Object.entries(stored)) {
    const sNum = parseInt(surahKey, 10);
    if (!Array.isArray(ayahs)) continue;
    for (const aNum of ayahs) {
      const key = `${sNum}:${aNum}`;
      if (!byKey.has(key)) pushKey(key);
    }
  }
  return result.slice(0, MAX_BOOKMARKS);
}

// Five fixed bookmark colors (WAKTI accent palette): blue / green / orange / purple / pink
const BOOKMARK_COLORS = [
  { id: "blue",   bg: "hsla(210,100%,65%,0.16)", text: "hsl(210,90%,55%)", dot: "hsl(210,100%,60%)" },
  { id: "green",  bg: "hsla(142,76%,55%,0.16)",  text: "hsl(142,70%,42%)", dot: "hsl(142,76%,48%)" },
  { id: "orange", bg: "hsla(25,95%,60%,0.16)",   text: "hsl(25,90%,50%)",  dot: "hsl(25,95%,55%)" },
  { id: "purple", bg: "hsla(280,70%,65%,0.16)",  text: "hsl(280,60%,50%)", dot: "hsl(280,70%,60%)" },
  { id: "pink",   bg: "hsla(320,75%,70%,0.16)",  text: "hsl(320,65%,55%)", dot: "hsl(320,75%,65%)" },
];
const BOOKMARK_COLOR_IDS = BOOKMARK_COLORS.map((c) => c.id);

function getBookmarkColor(colorId?: string | null) {
  return BOOKMARK_COLORS.find((c) => c.id === colorId) || BOOKMARK_COLORS[0];
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function buildMp3QuranUrl(server: string, surahNumber: number): string {
  return `${server}${String(surahNumber).padStart(3, "0")}.mp3`;
}

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/['’`]/g, "")
    .replace(/\b(al|ash|ad|ar|as|at|az|an)\b/g, " ")
    .replace(/[\s\-_]+/g, " ")
    .trim();
}

function getSurahSearchTerms(surah: Surah): string[] {
  const english = surah.englishName;
  return [
    surah.name,
    english,
    english.replace(/^al[-\s]+/i, ""),
    english.replace(/^surah[-\s]+/i, ""),
    english.replace(/^surat[-\s]+/i, ""),
    `${surah.number}`,
  ];
}

function getRevelationLabel(revelationType: string, isAr: boolean): string {
  if (!isAr) return revelationType;
  const normalized = revelationType.toLowerCase();
  if (normalized.includes("meccan") || normalized.includes("makki") || normalized.includes("maccan")) return "مكية";
  if (normalized.includes("medinan") || normalized.includes("madani")) return "مدنية";
  return revelationType;
}

export default function DeenQuran() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const isDark = theme === "dark";

  const bg = isDark ? "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 50%, #0c0f14 100%)" : "linear-gradient(135deg, #fcfefd 0%, hsl(200 25% 95%) 50%, #fcfefd 100%)";
  const headerBg = isDark ? "rgba(12,15,20,0.95)" : "rgba(252,254,253,0.95)";
  const cardBg = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(6,5,65,0.12)";
  const cardShadow = isDark ? "none" : "0 2px 10px rgba(6,5,65,0.07), 0 1px 3px rgba(6,5,65,0.05)";
  const textPrimary = isDark ? "#f2f2f2" : "#060541";
  const textSecondary = isDark ? "#858384" : "#606062";
  const textMuted = isDark ? "#606062" : "#858384";

  const DEEN_BG_KEY = "deen_bg_active";
  const DEEN_BG_SURAH_KEY = "deen_bg_surah";

  const [screen, setScreen] = useState<"home" | "read-list" | "reader" | "listen-list" | "listen-reciters" | "listen-player">(() => {
    try { return sessionStorage.getItem(DEEN_BG_KEY) === "1" ? "listen-player" : "home"; } catch { return "home"; }
  });
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reciterSearch, setReciterSearch] = useState("");
  const [activeSurah, setActiveSurah] = useState<SurahFull | null>(null);
  const [activeTrans, setActiveTrans] = useState<Ayah[]>([]);
  const [localHafsByAyah, setLocalHafsByAyah] = useState<Record<string, string>>({});
  const [loadingReader, setLoadingReader] = useState(false);
  const [listenSurahMeta, setListenSurahMeta] = useState<Surah | null>(null);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [selectedAyahTrans, setSelectedAyahTrans] = useState<Ayah | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [explLoading, setExplLoading] = useState(false);
  const [bookmarkedAyahs, setBookmarkedAyahs] = useState<Set<number>>(new Set());
  const [lastProgress, setLastProgress] = useState<LastProgress | null>(null);
  const [pendingBookmarkAyah, setPendingBookmarkAyah] = useState<Ayah | null>(null);
  const [readerPage, setReaderPage] = useState(0);
  const AYAHS_PER_PAGE = 4;
  const [pageBreaks, setPageBreaks] = useState<number[]>([0]);
  const [isSurahPlaying, setIsSurahPlaying] = useState(false);
  const [currentPlaybackAyahIndex, setCurrentPlaybackAyahIndex] = useState(-1);
  const [readerPlayAllEnabled, setReaderPlayAllEnabled] = useState(false);
  const [readerReciterOpen, setReaderReciterOpen] = useState(false);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [bookmarksDropdownOpen, setBookmarksDropdownOpen] = useState(false);
  const bookmarksDropdownRef = useRef<HTMLDivElement | null>(null);
  const readerBookmarkBtnRef = useRef<HTMLButtonElement | null>(null);
  const [readerDropdownPos, setReaderDropdownPos] = useState<{ top: number; right?: number; left?: number } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bookmarksRefreshing, setBookmarksRefreshing] = useState(false);
  const [colorPickerKey, setColorPickerKey] = useState<string | null>(null);
  const [, setColorTick] = useState(0);
  const [readerAudioReciter, setReaderAudioReciter] = useState<string>(() => {
    try {
      return localStorage.getItem(READER_RECITER_STORAGE_KEY) || DEFAULT_READER_AUDIO_RECITER;
    } catch {
      return DEFAULT_READER_AUDIO_RECITER;
    }
  });
  const [showArabicText, setShowArabicText] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(ARABIC_TEXT_TOGGLE_KEY);
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });

  const setIsSurahPlayingSync = (v: boolean) => { isSurahPlayingRef.current = v; setIsSurahPlaying(v); };
  const setCurrentPlaybackAyahIndexSync = (v: number) => { currentPlaybackAyahIndexRef.current = v; setCurrentPlaybackAyahIndex(v); };
  const setReaderPlayAllEnabledSync = (v: boolean) => { readerPlayAllEnabledRef.current = v; setReaderPlayAllEnabled(v); };
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [loopSurah, setLoopSurah] = useState(false);
  const [autoNextSurah, setAutoNextSurah] = useState(true);
  const [backgroundPlaybackEnabled, setBackgroundPlaybackEnabled] = useState(() => {
    try { return sessionStorage.getItem(DEEN_BG_KEY) === "1"; } catch { return false; }
  });
  const [reciters, setReciters] = useState<ReciterOption[]>(FALLBACK_RECITERS);
  const [recitersLoading, setRecitersLoading] = useState(false);
  const [previewReciterId, setPreviewReciterId] = useState<string | null>(null);
  const [selectedReciter, setSelectedReciter] = useState(() => {
    try {
      return localStorage.getItem(RECITER_STORAGE_KEY) || APP_DEFAULT_RECITER_ID;
    } catch {
      return APP_DEFAULT_RECITER_ID;
    }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const surahPlaybackCancelledRef = useRef(false);
  const surahAudioCacheRef = useRef<Record<string, string[]>>({});
  const playbackSessionRef = useRef(0);
  const readerTopRef = useRef<HTMLDivElement | null>(null);
  const chipRowRef = useRef<HTMLDivElement | null>(null);
  const ayahItemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const readerPlayAllEnabledRef = useRef(false);
  const isSurahPlayingRef = useRef(false);
  const currentPlaybackAyahIndexRef = useRef(-1);
  const preserveScrollYRef = useRef<number | null>(null);
  const suppressPlaybackScrollOnceRef = useRef(false);
  const chipRowTopBeforeRef = useRef<number | null>(null);

  // Close bookmarks dropdown on outside click
  useEffect(() => {
    if (!bookmarksDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (bookmarksDropdownRef.current && !bookmarksDropdownRef.current.contains(e.target as Node)) {
        setBookmarksDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bookmarksDropdownOpen]);

  // Recalculate fixed dropdown position on resize/orientation change
  useEffect(() => {
    if (!bookmarksDropdownOpen || !readerBookmarkBtnRef.current) return;
    const updatePos = () => {
      const rect = readerBookmarkBtnRef.current!.getBoundingClientRect();
      setReaderDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        ...(isAr
          ? { left: Math.max(8, rect.left + window.scrollX) }
          : { right: Math.max(8, window.innerWidth - rect.right - window.scrollX) }),
      });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    return () => window.removeEventListener("resize", updatePos);
  }, [bookmarksDropdownOpen]);

  // Auto-close dropdown on any scroll inside the app main scroll container
  useEffect(() => {
    if (!bookmarksDropdownOpen) return;
    const container = document.querySelector('.app-main-scroll');
    if (!container) return;
    const handler = () => setBookmarksDropdownOpen(false);
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, [bookmarksDropdownOpen]);

  // On-demand sync: when the dropdown opens, fetch server bookmarks if TTL expired
  useEffect(() => {
    if (!bookmarksDropdownOpen) return;
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id || null;
      if (!uid) return; // guests stay local-only
      const last = readLastSyncAt(uid);
      const now = Date.now();
      const isStale = now - last > BOOKMARKS_TTL_MS || last === 0; // force fetch on first open
      if (!isStale) return;
      try {
        setBookmarksRefreshing(true);
        const { data, error } = await (supabase as any)
          .from("deen_quran_bookmarks")
          .select("surah_number, ayah_number, color")
          .eq("user_id", uid);
        if (error || !Array.isArray(data) || cancelled) return;
        const map: StoredQuranBookmarks = {};
        const order: string[] = [];
        const colorsMap: Record<string, string> = {};
        for (const row of data) {
          const s = Number(row?.surah_number);
          const a = Number(row?.ayah_number);
          if (!Number.isFinite(s) || !Number.isFinite(a)) continue;
          map[String(s)] = Array.from(new Set([...(map[String(s)] || []), a])).sort((x, y) => x - y);
          const k = `${s}:${a}`;
          if (!order.includes(k)) order.unshift(k);
          if (row?.color) colorsMap[k] = row.color;
        }
        writeStoredBookmarks(map, uid);
        writeBookmarksOrder(order.slice(0, MAX_BOOKMARKS), uid);
        writeBookmarkColors(colorsMap, uid);
        writeLastSyncAt(now, uid);
      } catch {}
      finally {
        if (!cancelled) setBookmarksRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookmarksDropdownOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(RECITER_STORAGE_KEY, selectedReciter);
    } catch {}
  }, [selectedReciter]);

  useEffect(() => {
    try {
      localStorage.setItem(READER_RECITER_STORAGE_KEY, readerAudioReciter);
    } catch {}
  }, [readerAudioReciter]);

  useEffect(() => {
    try {
      localStorage.setItem(ARABIC_TEXT_TOGGLE_KEY, showArabicText ? "1" : "0");
    } catch {}
  }, [showArabicText]);

  useEffect(() => {
    let cancelled = false;

    const loadLocalHafsScript = async () => {
      try {
        const res = await fetch("/quran/data/hafsData_v18.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = (await res.json()) as LocalHafsScriptRow[];

        const byAyah: Record<string, string> = {};
        for (const row of rows) {
          const surah = Number(row?.sora);
          const ayah = Number(row?.aya_no);
          const rawText = typeof row?.aya_text === "string" ? row.aya_text : "";
          const cleanedText = rawText
            .replace(/\u00A0/g, " ")
            .replace(/\s*[٠-٩]+$/u, "")
            .trim();
          if (surah > 0 && ayah > 0 && cleanedText) {
            byAyah[`${surah}:${ayah}`] = cleanedText;
          }
        }

        if (!cancelled && Object.keys(byAyah).length > 0) {
          setLocalHafsByAyah(byAyah);
        }
      } catch {
      }
    };

    loadLocalHafsScript();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (screen !== "reader" || currentPlaybackAyahIndex < 0) return;
    if (suppressPlaybackScrollOnceRef.current) {
      suppressPlaybackScrollOnceRef.current = false;
      return;
    }
    const activeAyahEl = ayahItemRefs.current[currentPlaybackAyahIndex];
    if (!activeAyahEl) return;
    const timer = window.setTimeout(() => {
      activeAyahEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [screen, currentPlaybackAyahIndex, readerPage]);

  // Restore position after a chip-triggered page change (no storage, one-shot)
  useLayoutEffect(() => {
    // Prefer relative correction using the chip row's visual offset (handles Safari/WebKit reflows)
    const beforeTop = chipRowTopBeforeRef.current;
    const container = chipRowRef.current;
    if (beforeTop != null && container) {
      // Run after layout has settled
      requestAnimationFrame(() => {
        const afterTop = container.getBoundingClientRect().top;
        const delta = afterTop - beforeTop;
        if (delta !== 0) window.scrollBy(0, delta);
        chipRowTopBeforeRef.current = null;
        preserveScrollYRef.current = null; // cancel absolute fallback
      });
      return;
    }

    // Fallback: absolute pixel restore
    const y = preserveScrollYRef.current;
    if (y != null) {
      window.scrollTo(0, y);
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
        preserveScrollYRef.current = null;
      });
    }
  }, [readerPage]);

  // Horizontally center the active page chip within its scroll container only (no page scroll)
  useEffect(() => {
    const container = chipRowRef.current;
    const chip = container?.children[readerPage] as HTMLElement | undefined;
    if (!container || !chip) return;
    const chipLeft = chip.offsetLeft;
    const chipWidth = chip.offsetWidth;
    const containerWidth = container.clientWidth;
    const targetLeft = Math.max(0, chipLeft - containerWidth / 2 + chipWidth / 2);
    container.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, [readerPage]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncTime = () => setAudioCurrentTime(audio.currentTime || 0);
    const syncDuration = () => setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : 0);

    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);

    return () => {
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
    };
  }, []);

  useEffect(() => {
    const loadReciters = async () => {
      setRecitersLoading(true);
      try {
        const [resEn, resAr] = await Promise.all([
          fetch(MP3QURAN_API_EN),
          fetch(MP3QURAN_API_AR),
        ]);
        if (!resEn.ok) throw new Error(`HTTP ${resEn.status}`);
        if (!resAr.ok) throw new Error(`HTTP ${resAr.status}`);
        const dataEn = await resEn.json() as { reciters: Mp3QuranReciter[] };
        const dataAr = await resAr.json() as { reciters: Mp3QuranReciter[] };
        const arabicNameById = new Map(
          (dataAr.reciters ?? []).map((reciter) => [String(reciter.id), reciter.name])
        );
        const mapped: ReciterOption[] = [];
        for (const reciter of (dataEn.reciters ?? [])) {
          const moshaf = reciter.moshaf?.find((m) => m.surah_total >= 50) ?? reciter.moshaf?.[0];
          if (!moshaf?.server) continue;
          const surahNums = moshaf.surah_list
            .split(",")
            .map((n) => parseInt(n.trim(), 10))
            .filter((n) => !isNaN(n));
          mapped.push({
            id: String(reciter.id),
            labelEn: reciter.name,
            labelAr: arabicNameById.get(String(reciter.id)) || reciter.name,
            server: moshaf.server,
            surahList: new Set(surahNums),
          });
        }
        const sorted = mapped.sort((a, b) => a.labelEn.localeCompare(b.labelEn));
        if (sorted.length > 0) {
          setReciters(sorted);
          const exists = sorted.some((item) => item.id === selectedReciter);
          if (!exists) {
            const appDefault = sorted.find((item) => item.id === APP_DEFAULT_RECITER_ID);
            setSelectedReciter(appDefault?.id || sorted[0].id);
          }
        }
      } catch {
        setReciters(FALLBACK_RECITERS);
      } finally {
        setRecitersLoading(false);
      }
    };

    loadReciters();
  }, []);

  // On mount: if bg session was active, reload the surah so listen-player renders correctly
  useEffect(() => {
    if (!backgroundPlaybackEnabled) return;
    const savedSurahNum = (() => { try { return parseInt(sessionStorage.getItem(DEEN_BG_SURAH_KEY) || "", 10) || null; } catch { return null; } })();
    if (!savedSurahNum) return;
    // Load surah list first so we have meta, then load the full surah data
    fetchFromProxy("surah").then((d) => {
      const allSurahs: Surah[] = d?.data ?? [];
      setSurahs(allSurahs);
      const meta = allSurahs.find((s) => s.number === savedSurahNum);
      if (meta) setListenSurahMeta(meta);
      return fetchFromProxy(`surah/${savedSurahNum}`, EDITIONS.arabic);
    }).then((d) => {
      if (d?.data) setActiveSurah(d.data);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount: if bg session was active, reconnect React UI to already-playing bgAudio singleton
  useEffect(() => {
    if (!backgroundPlaybackEnabled) return;
    const bgEl = bgAudio.audio;
    if (!bgEl) return;
    // Point audioRef at the module-level element so controls work
    audioRef.current = bgEl;
    const sync = () => {
      setAudioCurrentTime(bgEl.currentTime);
      setAudioDuration(bgEl.duration || 0);
      setPlaying(!bgEl.paused);
      setIsSurahPlayingSync(!bgEl.paused);
    };
    sync();
    bgEl.addEventListener("timeupdate", sync);
    bgEl.addEventListener("play", sync);
    bgEl.addEventListener("pause", sync);
    bgEl.addEventListener("loadedmetadata", sync);
    return () => {
      bgEl.removeEventListener("timeupdate", sync);
      bgEl.removeEventListener("play", sync);
      bgEl.removeEventListener("pause", sync);
      bgEl.removeEventListener("loadedmetadata", sync);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundPlaybackEnabled]);

  useEffect(() => {
    const localProgress = readStoredProgress();
    if (localProgress) setLastProgress(localProgress);

    fetchFromProxy("surah")
      .then((d) => setSurahs(d?.data ?? []))
      .catch(() => toast.error(isAr ? "تعذر تحميل السور" : "Failed to load surahs"))
      .finally(() => setLoading(false));

    supabase.auth.getSession().then(({ data: sessionData }) => {
      const uid = sessionData.session?.user?.id;
      if (!uid) return;
      setCurrentUserId(uid);
      (supabase as any)
        .from("deen_reading_progress")
        .select("surah_number, ayah_number")
        .eq("user_id", uid)
        .eq("type", "quran")
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) {
            const progress = { surah_number: data.surah_number, ayah_number: data.ayah_number };
            setLastProgress(progress);
            writeStoredProgress(progress);
          }
        });

      // Sync bookmarks from server into user-scoped cache, order, and colors (cap for display)
      (supabase as any)
        .from("deen_quran_bookmarks")
        .select("surah_number, ayah_number, color")
        .eq("user_id", uid)
        .then(({ data }: any) => {
          if (!Array.isArray(data)) return;
          const map: StoredQuranBookmarks = {};
          const order: string[] = [];
          const colorsMap: Record<string, string> = {};
          for (const row of data) {
            const s = Number(row?.surah_number);
            const a = Number(row?.ayah_number);
            if (!Number.isFinite(s) || !Number.isFinite(a)) continue;
            map[String(s)] = Array.from(new Set([...(map[String(s)] || []), a])).sort((x, y) => x - y);
            const k = `${s}:${a}`;
            if (!order.includes(k)) order.unshift(k);
            if (row?.color) colorsMap[k] = row.color;
          }
          writeStoredBookmarks(map, uid);
          writeBookmarksOrder(order.slice(0, MAX_BOOKMARKS), uid);
          writeBookmarkColors(colorsMap, uid);
        });
    });
  }, []);

  // Load existing bookmarks when entering a surah
  const loadBookmarks = useCallback(async (surahNumber: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id || null;
    const storedBookmarks = readStoredBookmarks(uid);
    const localAyahs = Array.isArray(storedBookmarks[String(surahNumber)]) ? storedBookmarks[String(surahNumber)] : [];
    if (localAyahs.length > 0) {
      setBookmarkedAyahs(new Set(localAyahs));
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return;
      const { data } = await (supabase as any)
        .from("deen_quran_bookmarks")
        .select("ayah_number")
        .eq("user_id", uid)
        .eq("surah_number", surahNumber);

      if (data) {
        const dbAyahs = data.map((b: any) => b.ayah_number);
        const merged = Array.from(new Set([...localAyahs, ...dbAyahs])).sort((a, b) => a - b);
        setBookmarkedAyahs(new Set(merged));
        writeStoredBookmarks({
          ...storedBookmarks,
          [String(surahNumber)]: merged,
        }, uid);
      }
    } catch {}
  }, []);

  // Save reading progress immediately so it does not disappear when leaving quickly
  const saveProgress = useCallback(async (surahNumber: number, ayahNumber: number) => {
    const progress = { surah_number: surahNumber, ayah_number: ayahNumber };
    setLastProgress(progress);
    writeStoredProgress(progress);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return;
      await (supabase as any)
        .from("deen_reading_progress")
        .upsert(
          { user_id: uid, type: "quran", surah_number: surahNumber, ayah_number: ayahNumber, last_read_at: new Date().toISOString() },
          { onConflict: "user_id,type" }
        );
    } catch {}
  }, []);

  const openSurah = async (surah: Surah, resumeAyah?: number) => {
    setLoadingReader(true);
    setScreen("reader");
    setBookmarkedAyahs(new Set());
    setReaderPage(0);
    setPagePickerOpen(false);
    try {
      const [arabicRes, transRes] = await Promise.all([
        fetchFromProxy(`surah/${surah.number}`, EDITIONS.arabic),
        fetchFromProxy(`surah/${surah.number}`, EDITIONS.english),
      ]);
      const arabicData: SurahFull | null = arabicRes?.data ?? null;
      const transAyahs: Ayah[] = transRes?.data?.ayahs ?? [];
      setActiveSurah(arabicData);
      setActiveTrans(transAyahs);
      const sourceLength = (arabicData?.ayahs ?? []).length;
      const breaks = Array.from({ length: Math.ceil(sourceLength / AYAHS_PER_PAGE) }, (_, i) => i * AYAHS_PER_PAGE);
      setPageBreaks(breaks);
      await loadBookmarks(surah.number);
      if (typeof resumeAyah === "number" && resumeAyah > 0) {
        saveProgress(surah.number, resumeAyah);
        if (arabicData?.ayahs) {
          const targetIndex = arabicData.ayahs.findIndex((ayah) => ayah.numberInSurah === resumeAyah);
          if (targetIndex >= 0) {
            const targetPage = breaks.findIndex((start, pageIndex) => {
              const end = breaks[pageIndex + 1] ?? arabicData.ayahs.length;
              return targetIndex >= start && targetIndex < end;
            });
            if (targetPage >= 0) setReaderPage(targetPage);
            setCurrentPlaybackAyahIndexSync(targetIndex);
            window.setTimeout(() => {
              ayahItemRefs.current[targetIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 220);
          }
        }
      } else {
        saveProgress(surah.number, 1);
      }
    } catch {
      toast.error(isAr ? "تعذر تحميل السورة" : "Failed to load surah");
    } finally {
      setLoadingReader(false);
    }
  };

  const openListeningSurah = async (surah: Surah, autoPlay = false) => {
    const bgIsOwned = backgroundPlaybackEnabled && bgAudio.audio === audioRef.current;
    surahPlaybackCancelledRef.current = true;
    playbackSessionRef.current += 1;
    setPlaying(false);
    setIsSurahPlayingSync(false);
    setCurrentPlaybackAyahIndexSync(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    if (audioRef.current && !bgIsOwned) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    const shouldShowFullLoader = screen !== "listen-player" || !activeSurah;
    if (shouldShowFullLoader) {
      setLoadingReader(true);
    }
    setListenSurahMeta(surah);
    setScreen("listen-player");
    try {
      const arabicRes = await fetchFromProxy(`surah/${surah.number}`, EDITIONS.arabic);
      const loadedSurah = arabicRes?.data ?? null;
      setActiveSurah(loadedSurah);
      setActiveTrans([]);
      if (autoPlay && loadedSurah) {
        setTimeout(() => {
          playFullSurahAudio(loadedSurah, surah);
        }, 0);
      }
    } catch {
      toast.error(isAr ? "تعذر تحميل السورة" : "Failed to load surah");
      setScreen("listen-list");
    } finally {
      if (shouldShowFullLoader) {
        setLoadingReader(false);
      }
    }
  };

  // Continue reading: find the surah object and open it
  const continueReading = () => {
    if (!lastProgress || surahs.length === 0) return;
    const surah = surahs.find((s) => s.number === lastProgress.surah_number);
    if (surah) openSurah(surah, lastProgress.ayah_number);
  };

  const toggleBackgroundPlayback = useCallback(() => {
    setBackgroundPlaybackEnabled((prev) => {
      const next = !prev;
      if (next) {
        const el = audioRef.current;
        const currentSrc = el?.currentSrc || el?.src || "";
        const currentTime = el?.currentTime ?? 0;
        const wasPlaying = el ? !el.paused : false;
        if (currentSrc) {
          // playFrom creates its own module-level Audio element — survives React unmount
          bgAudio.playFrom(currentSrc, currentTime, !wasPlaying);
          // Silence the React-owned element so both don't play at once
          if (el) { el.pause(); el.src = ""; }
          // Point audioRef at bgAudio's own element so Deen controls keep working
          audioRef.current = bgAudio.audio!;
        }
        try { sessionStorage.setItem(DEEN_BG_KEY, "1"); } catch {}
      } else {
        try { sessionStorage.removeItem(DEEN_BG_KEY); sessionStorage.removeItem(DEEN_BG_SURAH_KEY); } catch {}
        emitEvent("wakti-bg-music-pause");
        bgAudio.stop();
      }
      return next;
    });
  }, []);

  const playAyahAudio = async (ayah: Ayah) => {
    try {
      surahPlaybackCancelledRef.current = true;
      setIsSurahPlayingSync(false);
      saveProgress(activeSurah?.number ?? ayah.number, ayah.numberInSurah);
      const ayahIndex = activeSurah?.ayahs.findIndex((item) => item.numberInSurah === ayah.numberInSurah) ?? -1;

      // Fetch per-ayah audio URL from alquran.cloud via proxy
      // English mode → en.walk (Ibrahim Walk English recitation), Arabic → selected reader reciter
      const audioEdition = isAr ? readerAudioReciter : "en.walk";
      const audioData = await fetchFromProxy(`ayah/${ayah.number}`, audioEdition);
      const audioUrl: string = audioData?.data?.audio ?? "";
      if (!audioUrl) {
        toast.error(isAr ? "الصوت غير متاح" : "Audio unavailable");
        return false;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
        setPlaying(true);
        if (ayahIndex >= 0) setCurrentPlaybackAyahIndexSync(ayahIndex);
        audioRef.current.onended = () => {
          setPlaying(false);
          setCurrentPlaybackAyahIndexSync(-1);
        };
        return true;
      }
      return false;
    } catch {
      toast.error(isAr ? "الصوت غير متاح" : "Audio unavailable");
      return false;
    }
  };

  const stopPlayback = (triggeredByUser = false) => {
    const stoppedAtIndex = currentPlaybackAyahIndexRef.current;
    const wasPlayAll = readerPlayAllEnabledRef.current && isSurahPlayingRef.current;
    surahPlaybackCancelledRef.current = true;
    playbackSessionRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    if (backgroundPlaybackEnabled && bgAudio.audio === audioRef.current) {
      emitEvent("wakti-bg-music-pause");
    }
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setPlaying(false);
    setIsSurahPlayingSync(false);
    setCurrentPlaybackAyahIndexSync(-1);
    if (triggeredByUser && wasPlayAll && stoppedAtIndex >= 0 && activeSurah) {
      const stoppedAyah = activeSurah.ayahs[stoppedAtIndex] ?? null;
      if (stoppedAyah) setPendingBookmarkAyah(stoppedAyah);
    }
  };

  const getSurahAudioQueue = useCallback(async (surah: SurahFull, reciterId: string) => {
    const cacheKey = `${surah.number}:${reciterId}`;
    if (surahAudioCacheRef.current[cacheKey]?.length) {
      return surahAudioCacheRef.current[cacheKey];
    }

    // Single API call — fetch the entire surah with the audio edition
    // alquran.cloud returns all ayahs with their audio URLs in one response
    const audioRes = await fetchFromProxy(`surah/${surah.number}`, reciterId);
    const audioAyahs: { audio?: string }[] = audioRes?.data?.ayahs ?? [];
    const audioUrls = audioAyahs.map((a) => a.audio ?? "");

    surahAudioCacheRef.current[cacheKey] = audioUrls;
    return audioUrls;
  }, []);

  const playAudioUrl = useCallback(async (audioUrl: string) => {
    if (!audioRef.current || !audioUrl) return;

    await new Promise<void>((resolve, reject) => {
      if (!audioRef.current) {
        resolve();
        return;
      }

      const audio = audioRef.current;
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      audio.pause();
      audio.src = audioUrl;
      audio.load();

      audio.onended = () => {
        cleanup();
        resolve();
      };

      audio.onerror = () => {
        cleanup();
        resolve(); // skip broken URL, advance to next ayah
      };

      audio.play().then(() => {
        setPlaying(true);
      }).catch(() => {
        cleanup();
        resolve(); // skip if autoplay blocked; already unlocked at gesture time
      });
    });
  }, []);

  const playFullSurahAudio = (surahOverride?: SurahFull, surahMetaOverride?: Surah) => {
    const targetSurah = surahOverride ?? activeSurah;
    if (!targetSurah || !audioRef.current) return;

    const currentMeta = surahMetaOverride || listenSurahMeta || surahs.find((s) => s.number === targetSurah.number);
    const audio = audioRef.current;
    const sessionId = playbackSessionRef.current + 1;
    playbackSessionRef.current = sessionId;
    surahPlaybackCancelledRef.current = false;
    setIsSurahPlayingSync(true);
    setPlaying(true);
    setCurrentPlaybackAyahIndexSync(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    saveProgress(targetSurah.number, 1);

    const reciterOption = reciters.find((r) => r.id === selectedReciter) ?? reciters[0] ?? FALLBACK_RECITERS[0];
    const surahAvailable = reciterOption.surahList.has(targetSurah.number);

    if (!surahAvailable) {
      void playSurahSequentially(0, targetSurah, currentMeta ?? undefined, reciterOption.id);
      return;
    }

    const surahUrl = buildMp3QuranUrl(reciterOption.server, targetSurah.number);

    // Persist surah for session restore
    try { sessionStorage.setItem(DEEN_BG_SURAH_KEY, String(targetSurah.number)); } catch {}

    // When background is active, play on the module-level singleton so it survives navigation
    if (backgroundPlaybackEnabled) {
      bgAudio.play(surahUrl);
      const bgEl = bgAudio.audio!;
      audioRef.current = bgEl;
      const syncBg = () => {
        setAudioCurrentTime(bgEl.currentTime);
        setAudioDuration(bgEl.duration || 0);
      };
      bgEl.addEventListener("timeupdate", syncBg);
      bgEl.addEventListener("loadedmetadata", syncBg);
      bgEl.onended = () => {
        bgEl.removeEventListener("timeupdate", syncBg);
        bgEl.removeEventListener("loadedmetadata", syncBg);
        setPlaying(false);
        setIsSurahPlayingSync(false);
        if (loopSurah) { playFullSurahAudio(targetSurah, currentMeta ?? undefined); return; }
        if (autoNextSurah && currentMeta) {
          const idx = surahs.findIndex((s) => s.number === currentMeta.number);
          const next = idx >= 0 ? surahs[idx + 1] : undefined;
          if (next) { void openListeningSurah(next, true); }
        }
      };
      return;
    }

    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
    };

    const startPlayback = () => {
      if (playbackSessionRef.current !== sessionId) return;

      const cleanup2 = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      audio.pause();
      audio.currentTime = 0;
      audio.src = surahUrl;
      audio.load();

      audio.onended = () => {
        cleanup2();
        if (playbackSessionRef.current !== sessionId) return;
        setPlaying(false);
        setIsSurahPlayingSync(false);
        setAudioCurrentTime(audio.duration || 0);
        if (loopSurah) {
          playFullSurahAudio(targetSurah, currentMeta ?? undefined);
          return;
        }
        if (autoNextSurah && currentMeta) {
          const currentIndex = surahs.findIndex((s) => s.number === currentMeta.number);
          const nextSurah = currentIndex >= 0 ? surahs[currentIndex + 1] : undefined;
          if (nextSurah) void openListeningSurah(nextSurah, true);
        }
      };

      audio.onerror = () => {
        cleanup2();
        if (playbackSessionRef.current !== sessionId) return;
        void playSurahSequentially(0, targetSurah, currentMeta ?? undefined, reciterOption.id);
      };

      audio.play().then(() => setPlaying(true)).catch(() => {
        cleanup2();
        void playSurahSequentially(0, targetSurah, currentMeta ?? undefined, reciterOption.id);
      });

    };

    startPlayback();
  };

  const playSurahSequentially = async (startIndex = 0, surahOverride?: SurahFull, surahMetaOverride?: Surah, listenReciterId?: string) => {
    const targetSurah = surahOverride ?? activeSurah;
    if (!targetSurah || !audioRef.current) return;
    const sessionId = playbackSessionRef.current + 1;
    playbackSessionRef.current = sessionId;
    surahPlaybackCancelledRef.current = false;
    setIsSurahPlayingSync(true);
    setPlaying(true);
    setCurrentPlaybackAyahIndexSync(startIndex);

    // Pre-fetch ALL ayah audio URLs in a single API call before the loop.
    // This eliminates N sequential proxy round-trips (one per ayah) and replaces
    // them with 1 upfront call — same pattern used by the listen-player path.
    let audioQueue: string[] | null = null;
    try {
      const edition = listenReciterId ?? (isAr ? readerAudioReciter : "en.walk");
      audioQueue = await getSurahAudioQueue(targetSurah, edition);
    } catch {
      audioQueue = null;
    }

    try {
      for (let index = startIndex; index < targetSurah.ayahs.length; index += 1) {
        const ayah = targetSurah.ayahs[index];
        if (surahPlaybackCancelledRef.current || playbackSessionRef.current !== sessionId) break;

        const nextReaderPage = pageBreaks.findIndex((start, pageIndex) => {
          const end = pageBreaks[pageIndex + 1] ?? targetSurah.ayahs.length;
          return index >= start && index < end;
        });
        if (nextReaderPage >= 0) {
          setReaderPage((prev) => {
            if (prev === nextReaderPage) return prev;
            setTimeout(() => readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            return nextReaderPage;
          });
        }

        setCurrentPlaybackAyahIndexSync(index);
        saveProgress(targetSurah.number, ayah.numberInSurah);

        let audioUrl: string;
        if (audioQueue) {
          // Use pre-fetched queue (1 API call for the whole surah)
          audioUrl = audioQueue[index] ?? "";
        } else {
          // Fallback: per-ayah fetch if pre-fetch failed
          const audioEdition = isAr ? readerAudioReciter : "en.walk";
          const audioData = await fetchFromProxy(`ayah/${ayah.number}`, audioEdition);
          if (surahPlaybackCancelledRef.current || playbackSessionRef.current !== sessionId) break;
          audioUrl = audioData?.data?.audio ?? "";
        }
        if (!audioUrl) continue;

        await playAudioUrl(audioUrl);
      }

      const completedNaturally = !surahPlaybackCancelledRef.current && playbackSessionRef.current === sessionId;
      if (completedNaturally && screen === "listen-player") {
        const currentMeta = surahMetaOverride || listenSurahMeta || surahs.find((s) => s.number === targetSurah.number);
        if (loopSurah) {
          void playSurahSequentially(0, targetSurah, currentMeta ?? undefined, listenReciterId);
          return;
        }
        if (autoNextSurah && currentMeta) {
          const currentIndex = surahs.findIndex((s) => s.number === currentMeta.number);
          const nextSurah = currentIndex >= 0 ? surahs[currentIndex + 1] : undefined;
          if (nextSurah) {
            void openListeningSurah(nextSurah, true);
            return;
          }
        }
      }
    } catch {
      toast.error(isAr ? "تعذر تشغيل السورة كاملة" : "Unable to play full surah");
    } finally {
      if (playbackSessionRef.current === sessionId) {
        setPlaying(false);
        setIsSurahPlayingSync(false);
        surahPlaybackCancelledRef.current = false;
      }
    }
  };

  const seekAudio = (nextTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(nextTime, audioRef.current.duration || 0));
    setAudioCurrentTime(audioRef.current.currentTime || 0);
  };

  const skipAudioBy = (seconds: number) => {
    if (!audioRef.current) return;
    seekAudio((audioRef.current.currentTime || 0) + seconds);
  };

  const playPreviousListeningSurah = () => {
    const currentNumber = listenSurahMeta?.number || activeSurah?.number;
    if (!currentNumber) return;
    const currentIndex = surahs.findIndex((s) => s.number === currentNumber);
    const previousSurah = currentIndex > 0 ? surahs[currentIndex - 1] : undefined;
    if (previousSurah) void openListeningSurah(previousSurah, true);
  };

  const playNextListeningSurah = () => {
    const currentNumber = listenSurahMeta?.number || activeSurah?.number;
    if (!currentNumber) return;
    const currentIndex = surahs.findIndex((s) => s.number === currentNumber);
    const nextSurah = currentIndex >= 0 ? surahs[currentIndex + 1] : undefined;
    if (nextSurah) void openListeningSurah(nextSurah, true);
  };

  const toggleSurahPlayback = () => {
    if (isSurahPlaying) {
      stopPlayback();
      return;
    }
    if (screen === "listen-player") {
      playFullSurahAudio();
      return;
    }
    void playSurahSequentially();
  };

  const toggleReaderPlayAllMode = () => {
    const next = !readerPlayAllEnabledRef.current;
    setReaderPlayAllEnabledSync(next);
    if (!next && isSurahPlayingRef.current) {
      stopPlayback(true);
    }
  };

  const toggleReaderAyahPlayback = async (ayah: Ayah, globalIdx: number) => {
    if (playing && currentPlaybackAyahIndex === globalIdx) {
      stopPlayback(true);
      return;
    }

    if (readerPlayAllEnabled && activeSurah) {
      surahPlaybackCancelledRef.current = false;
      void playSurahSequentially(globalIdx, activeSurah, surahs.find((s) => s.number === activeSurah.number));
      return;
    }

    const started = await playAyahAudio(ayah);
    if (started && activeSurah) saveProgress(activeSurah.number, ayah.numberInSurah);
  };

  const handleBackNavigation = () => {
    const keepBackgroundAlive = backgroundPlaybackEnabled && bgAudio.audio === audioRef.current;
    if (screen === "reader") {
      stopPlayback();
      setScreen("read-list");
      return;
    }
    if (screen === "listen-reciters") {
      setScreen("listen-list");
      return;
    }
    if (screen === "listen-player") {
      if (!keepBackgroundAlive) stopPlayback();
      setScreen("listen-list");
      return;
    }
    if (screen === "read-list" || screen === "listen-list") {
      if (!keepBackgroundAlive) stopPlayback();
      setScreen("home");
      return;
    }
    navigate("/deen");
  };

  const playReciterPreview = async (reciterId: string) => {
    try {
      if (previewAudioRef.current && previewReciterId === reciterId) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
        setPreviewReciterId(null);
        return;
      }

      const audioData = await fetchFromProxy("ayah/1", reciterId);
      const audioUrl = audioData?.data?.audio;
      if (!audioUrl || !previewAudioRef.current) return;

      previewAudioRef.current.pause();
      previewAudioRef.current.src = audioUrl;
      await previewAudioRef.current.play();
      setPreviewReciterId(reciterId);
      previewAudioRef.current.onended = () => setPreviewReciterId(null);
    } catch {
      toast.error(isAr ? "تعذر تشغيل العينة" : "Preview unavailable");
      setPreviewReciterId(null);
    }
  };

  const tafsirCacheRef = useRef<Record<string, string>>({});

  const explainAyah = async (ayah: Ayah) => {
    if (!activeSurah) return;
    const cacheKey = `${ayah.number}:${isAr ? "ar" : "en"}`;
    if (tafsirCacheRef.current[cacheKey]) {
      setExplanation(tafsirCacheRef.current[cacheKey]);
      return;
    }
    setExplLoading(true);
    try {
      const edition = isAr ? "ar-tafsir-muyassar" : "en-tafisr-ibn-kathir";
      const proxyUrl = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deen-quran-proxy`);
      proxyUrl.searchParams.set("source", "tafsir");
      proxyUrl.searchParams.set("path", `${edition}/${activeSurah.number}/${ayah.numberInSurah}.json`);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token ?? "";
      const res = await fetch(proxyUrl.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const text: string = json?.ayah?.text ?? json?.text ?? "";
      if (!text) throw new Error("empty");
      tafsirCacheRef.current[cacheKey] = text;
      setExplanation(text);
    } catch {
      setExplanation(isAr ? "التفسير غير متاح لهذه الآية." : "Tafsir not available for this verse.");
    } finally {
      setExplLoading(false);
    }
  };

  const isBismillahAyah = (ayah: Ayah) =>
    ayah.numberInSurah === 1 && ayah.text.includes("بِسْم") && ayah.text.includes("رَّح");

  const getArabicDisplayText = (ayah: Ayah, surahNum?: number): string => {
    const num = surahNum ?? activeSurah?.number;
    if (!num) return ayah.text.replace(/\u06DD+[\s\d٠-٩]*/g, "").trim();
    const text = localHafsByAyah[`${num}:${ayah.numberInSurah}`] ?? ayah.text;
    return text.replace(/\u06DD+[\s\d٠-٩]*/g, "").trim();
  };

  const stripBismillahPrefix = (ayah: Ayah, surahNum?: number): string => {
    const num = surahNum ?? activeSurah?.number;
    const sourceText = getArabicDisplayText(ayah, num);
    if (num && num !== 1 && num !== 9 && ayah.numberInSurah === 1) {
      // Only strip if the text actually contains a Bismillah prefix
      if (!sourceText.includes("بِسْم")) return sourceText;
      const words = sourceText.split(/\s+/);
      if (words.length > 4) return words.slice(4).join(" ");
    }
    return sourceText;
  };

  const cleanExplanation = (value: string) => {
    const cleaned = value.replace(/\*\*/g, "").trim();
    // Take only the first 5 sentences — tafsir can be very long
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? [];
    if (sentences.length >= 5) return (sentences[0] + sentences[1] + sentences[2] + sentences[3] + sentences[4]).trim();
    if (sentences.length === 4) return (sentences[0] + sentences[1] + sentences[2] + sentences[3]).trim();
    if (sentences.length === 2) return (sentences[0] + sentences[1]).trim();
    if (sentences.length === 1) return sentences[0].trim();
    // Fallback: hard-cap at 320 chars
    return cleaned.length > 320 ? cleaned.slice(0, 320).trimEnd() + "…" : cleaned;
  };

  const handleExplain = () => {
    if (!selectedAyah) return;
    explainAyah(selectedAyah);
  };

  const openAyahExplanationPopup = (ayah: Ayah, trans: Ayah | null = null) => {
    setSelectedAyah(ayah);
    setSelectedAyahTrans(trans);
    setShowExplanation(true);
    setExplanation("");
    handleExplainForAyah(ayah);
    if (activeSurah) saveProgress(activeSurah.number, ayah.numberInSurah);
  };

  const openAyahSheet = (ayah: Ayah, trans: Ayah | null = null) => {
    setSelectedAyah(ayah);
    setSelectedAyahTrans(trans);
    setShowActionSheet(true);
    setShowExplanation(false);
    setExplanation("");
    handleExplainForAyah(ayah);
    if (activeSurah) saveProgress(activeSurah.number, ayah.numberInSurah);
  };

  const handleExplainForAyah = (ayah: Ayah) => {
    explainAyah(ayah);
  };

  // Each of the 5 fixed colors is always selectable. Mark which are already
  // used by another bookmark (picking it will move that color here).
  const getPickerColors = (ayahKey: string) => {
    const colors = readBookmarkColors(currentUserId);
    const usedByOthers = new Set<string>();
    for (const [key, c] of Object.entries(colors)) {
      if (key !== ayahKey) usedByOthers.add(c);
    }
    return BOOKMARK_COLORS.map((c) => ({ ...c, inUse: usedByOthers.has(c.id) }));
  };

  // Remove whichever OTHER bookmark currently holds `colorId` (color is unique).
  // Mutates the passed-in colorsMap; caller is responsible for writing it.
  const releaseColorFromOthers = async (colorId: string, keepKey: string, uid: string | null, colorsMap: Record<string, string>) => {
    for (const [key, c] of Object.entries({ ...colorsMap })) {
      if (c !== colorId || key === keepKey) continue;
      const [sStr, aStr] = key.split(":");
      const sNum = parseInt(sStr, 10);
      const aNum = parseInt(aStr, 10);
      if (!Number.isFinite(sNum) || !Number.isFinite(aNum)) continue;
      const map = readStoredBookmarks(uid);
      map[String(sNum)] = (map[String(sNum)] || []).filter((n) => n !== aNum);
      if ((map[String(sNum)] || []).length === 0) delete map[String(sNum)];
      writeStoredBookmarks(map, uid);
      writeBookmarksOrder(readBookmarksOrder(uid).filter((x) => x !== key), uid);
      delete colorsMap[key];
      if (activeSurah && sNum === activeSurah.number) {
        setBookmarkedAyahs((prev) => { const s = new Set(prev); s.delete(aNum); return s; });
      }
      if (uid) {
        try {
          await (supabase as any)
            .from("deen_quran_bookmarks")
            .delete()
            .eq("user_id", uid)
            .eq("surah_number", sNum)
            .eq("ayah_number", aNum);
        } catch {}
      }
    }
  };

  const addBookmarkWithColor = async (ayah: Ayah, colorId: string) => {
    if (!activeSurah) return;
    const uid = currentUserId;
    const surahKey = String(activeSurah.number);
    const colorsMap = readBookmarkColors(uid);
    const k = `${activeSurah.number}:${ayah.numberInSurah}`;

    // Steal the color from any other bookmark that currently holds it
    await releaseColorFromOthers(colorId, k, uid, colorsMap);

    // Order: make this the newest (cap is naturally enforced by 5 unique colors)
    const order = [k, ...readBookmarksOrder(uid).filter((x) => x !== k)].slice(0, MAX_BOOKMARKS);
    writeBookmarksOrder(order, uid);

    // Assign chosen color
    colorsMap[k] = colorId;
    writeBookmarkColors(colorsMap, uid);

    // Update stored bookmarks (recompute fresh in case a release touched this surah)
    const freshStored = readStoredBookmarks(uid);
    const freshCurrent = Array.isArray(freshStored[surahKey]) ? freshStored[surahKey] : [];
    writeStoredBookmarks({
      ...freshStored,
      [surahKey]: Array.from(new Set([...freshCurrent, ayah.numberInSurah])).sort((a, b) => a - b),
    }, uid);

    setBookmarkedAyahs((prev) => new Set(prev).add(ayah.numberInSurah));
    setColorTick((t) => t + 1);

    if (uid) {
      try {
        await (supabase as any).from("deen_quran_bookmarks").upsert({
          user_id: uid,
          surah_number: activeSurah.number,
          ayah_number: ayah.numberInSurah,
          color: colorId,
        });
      } catch {}
    }
    toast.success(isAr ? "تم الحفظ ✓" : "Bookmarked ✓");
  };

  const recolorBookmark = async (ayah: Ayah, colorId: string) => {
    if (!activeSurah) return;
    const uid = currentUserId;
    const k = `${activeSurah.number}:${ayah.numberInSurah}`;
    const colorsMap = readBookmarkColors(uid);

    // Steal the color from any other bookmark that currently holds it
    await releaseColorFromOthers(colorId, k, uid, colorsMap);

    colorsMap[k] = colorId;
    writeBookmarkColors(colorsMap, uid);
    setColorTick((t) => t + 1);
    if (uid) {
      try {
        await (supabase as any)
          .from("deen_quran_bookmarks")
          .update({ color: colorId })
          .eq("user_id", uid)
          .eq("surah_number", activeSurah.number)
          .eq("ayah_number", ayah.numberInSurah);
      } catch {}
    }
  };

  const removeBookmark = async (ayah: Ayah, fromSheet = false) => {
    if (!activeSurah) return;
    const uid = currentUserId;
    const surahKey = String(activeSurah.number);
    const storedBookmarks = readStoredBookmarks(uid);
    const currentStored = Array.isArray(storedBookmarks[surahKey]) ? storedBookmarks[surahKey] : [];
    const k = `${activeSurah.number}:${ayah.numberInSurah}`;

    setBookmarkedAyahs((prev) => { const s = new Set(prev); s.delete(ayah.numberInSurah); return s; });
    writeStoredBookmarks({
      ...storedBookmarks,
      [surahKey]: currentStored.filter((n) => n !== ayah.numberInSurah),
    }, uid);
    writeBookmarksOrder(readBookmarksOrder(uid).filter((x) => x !== k), uid);
    const colorsMap = readBookmarkColors(uid);
    delete colorsMap[k];
    writeBookmarkColors(colorsMap, uid);
    setColorTick((t) => t + 1);

    if (uid) {
      try {
        await (supabase as any)
          .from("deen_quran_bookmarks")
          .delete()
          .eq("user_id", uid)
          .eq("surah_number", activeSurah.number)
          .eq("ayah_number", ayah.numberInSurah);
      } catch {}
    }
    toast.success(isAr ? "تم إزالة الحفظ" : "Bookmark removed");
    if (fromSheet) setShowActionSheet(false);
  };

  const setPrimaryBookmarkAyah = async (ayah: Ayah) => {
    if (!activeSurah) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id || null;
    const surahKey = String(activeSurah.number);
    const storedBookmarks = readStoredBookmarks(uid);
    const colorsMap = readBookmarkColors(uid);
    setBookmarkedAyahs(new Set([ayah.numberInSurah]));
    writeStoredBookmarks({
      ...storedBookmarks,
      [surahKey]: [ayah.numberInSurah],
    }, uid);

    // Update FIFO order: make this the newest, remove any previous occurrence for the same surah/ayah
    const k = `${activeSurah.number}:${ayah.numberInSurah}`;
    // Pick the first available color not used by other bookmarks (keeps colors unique)
    const usedByOthers = new Set(Object.entries(colorsMap).filter(([key]) => key !== k).map(([, c]) => c));
    const chosenColor = colorsMap[k] || BOOKMARK_COLOR_IDS.find((id) => !usedByOthers.has(id)) || BOOKMARK_COLOR_IDS[0];
    let order = [k, ...readBookmarksOrder(uid).filter((x) => x !== k)];
    if (order.length > MAX_BOOKMARKS) {
      const removed = order.slice(MAX_BOOKMARKS);
      order = order.slice(0, MAX_BOOKMARKS);
      for (const rem of removed) {
        const [sStr, aStr] = rem.split(":");
        const sNum = parseInt(sStr, 10);
        const aNum = parseInt(aStr, 10);
        if (Number.isFinite(sNum) && Number.isFinite(aNum)) {
          const map = readStoredBookmarks(uid);
          map[String(sNum)] = (map[String(sNum)] || []).filter((n) => n !== aNum);
          if ((map[String(sNum)] || []).length === 0) delete map[String(sNum)];
          writeStoredBookmarks(map, uid);
          delete colorsMap[rem];
          if (uid) {
            try {
              await (supabase as any)
                .from("deen_quran_bookmarks")
                .delete()
                .eq("user_id", uid)
                .eq("surah_number", sNum)
                .eq("ayah_number", aNum);
            } catch {}
          }
        }
      }
    }
    writeBookmarksOrder(order, uid);
    colorsMap[k] = chosenColor;
    writeBookmarkColors(colorsMap, uid);
    setColorTick((t) => t + 1);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uidDb = sessionData.session?.user?.id;
      if (!uidDb) throw new Error("no-user");
      await (supabase as any)
        .from("deen_quran_bookmarks")
        .delete()
        .eq("user_id", uidDb)
        .eq("surah_number", activeSurah.number);
      await (supabase as any).from("deen_quran_bookmarks").upsert({
        user_id: uidDb,
        surah_number: activeSurah.number,
        ayah_number: ayah.numberInSurah,
        color: chosenColor,
      });
    } catch {}

    toast.success(isAr ? `تم حفظ الآية ${ayah.numberInSurah} كموضعك الجديد ✓` : `Saved ayah ${ayah.numberInSurah} as your new bookmark ✓`);
  };

  const normalizedSearch = normalizeSearchValue(search);
  const filtered = surahs.filter((s) => {
    if (!normalizedSearch) return true;
    return getSurahSearchTerms(s).some((term) => normalizeSearchValue(term).includes(normalizedSearch));
  });
  const filteredReciters = reciters.filter((reciter) => {
    const query = normalizeSearchValue(reciterSearch);
    if (!query) return true;
    return [reciter.labelEn, reciter.labelAr]
      .some((value) => normalizeSearchValue(value).includes(query));
  });

  // Find last-read surah name for the continue banner
  const lastSurah = lastProgress ? surahs.find((s) => s.number === lastProgress.surah_number) : null;
  const activeReciter = reciters.find((reciter) => reciter.id === selectedReciter) || reciters[0] || FALLBACK_RECITERS[0];
  const appDefaultReciter = reciters.find((reciter) => reciter.id === APP_DEFAULT_RECITER_ID) || FALLBACK_RECITERS[0];
  const activeReciterSupportsFullSurah = (activeReciter?.surahList?.size ?? 0) > 0;
  const currentTitle = screen === "reader" && activeSurah
    ? (isAr ? "القرآن الكريم" : "Quran")
    : screen === "listen-reciters"
      ? (isAr ? "القراء" : "Reciters")
    : screen === "listen-player" && (listenSurahMeta || activeSurah)
      ? (isAr ? (listenSurahMeta?.name || activeSurah?.name || "") : (listenSurahMeta?.englishName || activeSurah?.englishName || ""))
      : isAr ? "القرآن الكريم" : "Quran";
  const currentSubtitle = screen === "reader" && activeSurah
    ? undefined
    : screen === "listen-reciters"
      ? (isAr ? `${filteredReciters.length} من ${reciters.length} قارئ` : `${filteredReciters.length} of ${reciters.length} reciters`)
    : screen === "listen-player"
      ? (isAr ? "استمع للسورة كاملة بدون انقطاع" : "Listen to the full surah without interruptions")
      : undefined;
  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: bg }}
      dir={isAr ? "rtl" : "ltr"}
    >
      <audio ref={audioRef} />
      <audio ref={previewAudioRef} />

      {/* Header */}
      {screen !== "listen-player" && screen !== "reader" && (
        <div className="fixed z-20 px-4 pt-4 pb-3" style={{ background: headerBg, backdropFilter: "blur(16px)", borderBottom: `1px solid ${cardBorder}`, top: "var(--app-header-h, 64px)", left: 0, right: 0 }}>
          <div className="flex items-center gap-3" style={{ direction: "ltr" }}>
            <button
                onClick={handleBackNavigation}
                className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                style={{
                  background: isDark ? "rgba(255,255,255,0.07)" : "rgba(6,5,65,0.07)",
                  border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(6,5,65,0.18)",
                  boxShadow: isDark ? "none" : "0 2px 8px rgba(6,5,65,0.1)",
                }}
                title={isAr ? "رجوع" : "Back"}
              >
                <ArrowLeft className="w-4 h-4" style={{ color: textPrimary }} />
              </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold truncate" style={{ color: textPrimary }}>{currentTitle}</h1>
              {currentSubtitle && (
                <p className="text-[10px]" style={{ color: textSecondary }}>{currentSubtitle}</p>
              )}
            </div>
            {playing && (
              <button
                onClick={() => stopPlayback(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                style={{ background: "hsla(210,100%,65%,0.15)", border: "1px solid hsla(210,100%,65%,0.3)" }}
                title={isAr ? "إيقاف" : "Pause"}
              >
                <Pause className="w-4 h-4 text-sky-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {screen !== "listen-player" && screen !== "reader" && (
        <div className="h-16" aria-hidden="true" />
      )}

      {screen === "home" && (
        <div className="px-4 pt-4 flex flex-col gap-4">
          {/* Hero greeting */}
          <div
            className="rounded-3xl px-5 py-6 text-center"
            style={{
              background: isDark
                ? "linear-gradient(135deg, hsl(235 25% 9%) 0%, hsl(250 25% 11%) 100%)"
                : "linear-gradient(135deg, #060541 0%, hsl(260 70% 25%) 100%)",
              boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(6,5,65,0.25)",
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{
                background: "linear-gradient(135deg, hsla(210,100%,65%,0.25) 0%, hsla(280,70%,65%,0.2) 100%)",
                border: "1px solid hsla(210,100%,65%,0.3)",
                boxShadow: "0 0 24px hsla(210,100%,65%,0.3)",
              }}
            >
              <BookOpen className="w-6 h-6 text-sky-300" />
            </div>
            <p className="text-xl font-bold text-white leading-snug">
              {isAr ? "كيف تريد استخدام القرآن اليوم؟" : "How would you like to use the Quran today?"}
            </p>
            <p className="text-sm text-white/60 mt-2 leading-relaxed">
              {isAr
                ? "اختر ما يناسبك — للقراءة والفهم، أو للاستماع بشكل متواصل."
                : "Choose what suits you — reading with full control, or continuous listening."}
            </p>
          </div>

          {/* Read card */}
          <button
            onClick={() => setScreen("read-list")}
            className="w-full rounded-3xl p-5 active:scale-[0.98] transition-all"
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(255,255,255,0.03) 100%)"
                : "linear-gradient(135deg, #ffffff 0%, rgba(245,240,255,0.9) 100%)",
              border: isDark ? "1px solid rgba(167,139,250,0.22)" : "1px solid rgba(139,92,246,0.3)",
              boxShadow: isDark ? "0 4px 20px rgba(167,139,250,0.1)" : "0 4px 20px rgba(139,92,246,0.12), 0 1px 4px rgba(6,5,65,0.08)",
              textAlign: isAr ? "right" : "left",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, hsla(280,70%,65%,0.22) 0%, hsla(260,70%,60%,0.18) 100%)",
                  border: "1px solid hsla(280,70%,65%,0.3)",
                  boxShadow: "0 0 18px hsla(280,70%,65%,0.2)",
                }}
              >
                <BookOpen className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold" style={{ color: textPrimary }}>{isAr ? "اقرأ القرآن" : "Read Quran"}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: textSecondary }}>{isAr ? "تصفح السور، أكمل من آخر موضع، واحفظ الآيات." : "Browse surahs, continue where you left off, bookmark ayahs."}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-violet-400 flex-shrink-0" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
            </div>
          </button>

          {/* Listen card */}
          <button
            onClick={() => setScreen("listen-list")}
            className="w-full rounded-3xl p-5 active:scale-[0.98] transition-all"
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(255,255,255,0.03) 100%)"
                : "linear-gradient(135deg, #ffffff 0%, rgba(235,248,255,0.9) 100%)",
              border: isDark ? "1px solid rgba(56,189,248,0.22)" : "1px solid rgba(56,189,248,0.35)",
              boxShadow: isDark ? "0 4px 20px rgba(56,189,248,0.1)" : "0 4px 20px rgba(56,189,248,0.14), 0 1px 4px rgba(6,5,65,0.08)",
              textAlign: isAr ? "right" : "left",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, hsla(210,100%,65%,0.22) 0%, hsla(190,80%,60%,0.18) 100%)",
                  border: "1px solid hsla(210,100%,65%,0.3)",
                  boxShadow: "0 0 18px hsla(210,100%,65%,0.2)",
                }}
              >
                <Volume2 className="w-5 h-5 text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold" style={{ color: textPrimary }}>{isAr ? "استمع للقرآن" : "Listen to Quran"}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: textSecondary }}>{isAr ? "اختر السورة والقارئ وتشغيل متواصل بدون توقف." : "Pick a surah and reciter, then play non-stop."}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-sky-400 flex-shrink-0" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
            </div>
          </button>
        </div>
      )}

      {/* Surah List View */}
      {(screen === "read-list" || screen === "listen-list") && (
        <div className="px-4 pt-2">
          {screen === "listen-list" && (
            <div className="pb-3">
              <div
                className="rounded-2xl p-3 mb-3"
                style={{
                  background: isDark ? cardBg : "linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)",
                  border: `1px solid ${isDark ? cardBorder : "rgba(6,5,65,0.14)"}`,
                  boxShadow: cardShadow,
                }}
              >
                <p className="text-sm font-bold" style={{ color: textPrimary }}>{isAr ? "استمع بسهولة" : "Simple listening"}</p>
                <p className="text-[11px] mt-1" style={{ color: textSecondary }}>{isAr ? "اختر قارئك ثم اختر السورة، وبعدها سيبدأ التشغيل الكامل في شاشة واحدة بسيطة." : "Choose your reciter, then choose your surah, and playback will start in one simple listening screen."}</p>
              </div>

              <button
                onClick={() => setScreen("listen-reciters")}
                className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-95 transition-all"
                style={{
                  background: isDark
                    ? "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(125,211,252,0.05) 100%)"
                    : "#ffffff",
                  border: isDark ? "1px solid rgba(125,211,252,0.14)" : "1px solid rgba(56,189,248,0.3)",
                  boxShadow: isDark ? "0 4px 24px rgba(56,189,248,0.08)" : "0 3px 12px rgba(56,189,248,0.12), 0 1px 4px rgba(6,5,65,0.06)",
                }}
                title={isAr ? "اختر القارئ" : "Choose reciter"}
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, hsla(210,100%,65%,0.18) 0%, hsla(280,70%,65%,0.12) 100%)",
                    border: "1px solid hsla(210,100%,65%,0.18)",
                    boxShadow: "0 0 18px hsla(210,100%,65%,0.12)",
                  }}
                >
                  <ListMusic className="w-4 h-4 text-sky-400" />
                </div>
                <div className="flex-1 min-w-0" style={{ textAlign: isAr ? "right" : "left" }}>
                  <p className="text-sm font-bold" style={{ color: textPrimary }}>{isAr ? "القراء" : "Reciters"}</p>
                  <p className="text-[11px] truncate" style={{ color: textSecondary }}>
                    {recitersLoading
                      ? (isAr ? "جار تحميل القراء..." : "Loading reciters...")
                      : `${isAr ? activeReciter?.labelAr : activeReciter?.labelEn} • ${isAr ? "افتراضيك الحالي" : "Your current default"}`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: textMuted, transform: isAr ? "rotate(180deg)" : undefined }} />
              </button>
            </div>
          )}

          {/* Continue reading banner */}
          {screen === "read-list" && lastSurah && (
            <button
              onClick={continueReading}
              className="w-full flex items-center gap-4 rounded-2xl px-5 py-4 mb-4 active:scale-[0.98] transition-all"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, hsla(210,100%,65%,0.14) 0%, hsla(260,60%,60%,0.10) 50%, hsla(210,100%,65%,0.06) 100%)"
                  : "linear-gradient(135deg, hsla(210,100%,65%,0.10) 0%, hsla(260,60%,60%,0.07) 50%, hsla(210,100%,65%,0.04) 100%)",
                border: isDark ? "1px solid hsla(210,100%,65%,0.22)" : "1px solid hsla(210,100%,65%,0.18)",
                boxShadow: isDark
                  ? "0 4px 24px hsla(210,100%,65%,0.12), 0 2px 8px hsla(210,100%,65%,0.06), inset 0 1px 0 hsla(210,100%,65%,0.08)"
                  : "0 4px 24px hsla(210,100%,65%,0.10), 0 2px 8px hsla(210,100%,65%,0.05), inset 0 1px 0 hsla(210,100%,65%,0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: isDark ? "hsla(210,100%,65%,0.18)" : "hsla(210,100%,65%,0.14)",
                  border: isDark ? "1px solid hsla(210,100%,65%,0.35)" : "1px solid hsla(210,100%,65%,0.28)",
                  boxShadow: isDark ? "0 0 16px hsla(210,100%,65%,0.25)" : "0 0 12px hsla(210,100%,65%,0.18)",
                }}
              >
                <BookOpen className="w-5 h-5" style={{ color: isDark ? "hsl(210,100%,75%)" : "hsl(210,100%,55%)" }} />
              </div>
              <div className="flex-1" style={{ textAlign: isAr ? "right" : "left" }}>
                <p className="text-[13px] font-semibold" style={{ color: isDark ? "hsl(210,100%,75%)" : "hsl(210,100%,50%)" }}>
                  {isAr ? "متابعة القراءة" : "Continue Reading"}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: isDark ? "#858384" : "#606062", overflow: "hidden", overflowWrap: "break-word" }}>
                  {isAr ? lastSurah.name : lastSurah.englishName} —{" "}
                  {isAr ? "آية" : "Ayah"} {lastProgress!.ayah_number}
                </p>
              </div>
              <ChevronRight
                className="w-5 h-5 flex-shrink-0"
                style={{
                  color: isDark ? "hsla(210,100%,75%,0.7)" : "hsla(210,100%,50%,0.6)",
                  transform: isAr ? "rotate(180deg)" : undefined,
                }}
              />
            </button>
          )}

          {/* Bookmarks Dropdown */}
          {screen === "read-list" && (() => {
            const allBookmarks = getAllBookmarks(surahs, currentUserId);
            if (allBookmarks.length === 0) return null;
            return (
              <div className="mb-4 relative" ref={bookmarksDropdownRef}>
                <button
                  onClick={() => setBookmarksDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between rounded-2xl px-4 py-2 active:scale-[0.98] transition-all"
                  style={{
                    background: isDark
                      ? "linear-gradient(135deg, hsla(35,65%,45%,0.14) 0%, hsla(25,95%,55%,0.10) 50%, hsla(35,65%,45%,0.06) 100%)"
                      : "linear-gradient(135deg, hsla(35,65%,42%,0.10) 0%, hsla(25,95%,50%,0.07) 50%, hsla(35,65%,42%,0.04) 100%)",
                    border: isDark ? "1px solid hsla(35,65%,55%,0.22)" : "1px solid hsla(35,65%,42%,0.18)",
                    boxShadow: isDark
                      ? "0 4px 24px hsla(25,95%,55%,0.12), 0 2px 8px hsla(25,95%,55%,0.06), inset 0 1px 0 hsla(35,65%,55%,0.08)"
                      : "0 4px 24px hsla(25,95%,50%,0.10), 0 2px 8px hsla(25,95%,50%,0.05), inset 0 1px 0 hsla(35,65%,42%,0.06)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDark ? "hsla(35,65%,55%,0.18)" : "hsla(35,65%,42%,0.14)",
                        border: isDark ? "1px solid hsla(35,65%,55%,0.35)" : "1px solid hsla(35,65%,42%,0.28)",
                        boxShadow: isDark ? "0 0 16px hsla(25,95%,55%,0.25)" : "0 0 12px hsla(25,95%,50%,0.18)",
                      }}
                    >
                      <Bookmark className="w-4 h-4" style={{ color: isDark ? "hsl(35,65%,65%)" : "hsl(35,65%,42%)" }} />
                    </div>
                    <span className="text-[13px] font-semibold" style={{ color: textPrimary }}>
                      {isAr ? "العلامات المرجعية" : "Bookmarks"}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: isDark ? "hsla(25,95%,55%,0.18)" : "hsla(25,95%,50%,0.14)",
                        color: isDark ? "hsl(25,95%,65%)" : "hsl(25,95%,42%)",
                        border: isDark ? "1px solid hsla(25,95%,55%,0.30)" : "1px solid hsla(25,95%,50%,0.25)",
                        boxShadow: isDark ? "0 0 8px hsla(25,95%,55%,0.20)" : "0 0 6px hsla(25,95%,50%,0.15)",
                      }}
                    >
                      {allBookmarks.length}/{MAX_BOOKMARKS}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {bookmarksRefreshing && (
                      <div className="w-3 h-3 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
                    )}
                    {bookmarksDropdownOpen ? (
                      <ChevronDown className="w-4 h-4" style={{ color: isDark ? "hsla(35,65%,55%,0.8)" : "hsla(35,65%,42%,0.7)" }} />
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: isDark ? "hsla(35,65%,55%,0.8)" : "hsla(35,65%,42%,0.7)", transform: isAr ? "rotate(180deg)" : undefined }} />
                    )}
                  </div>
                </button>

                {bookmarksDropdownOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl overflow-hidden"
                    style={{
                      background: isDark
                        ? "linear-gradient(135deg, hsl(25 15% 12%) 0%, hsl(30 12% 11%) 50%, hsl(25 15% 12%) 100%)"
                        : "linear-gradient(135deg, #fffbf5 0%, hsl(45 100% 97%) 50%, #fffbf5 100%)",
                      border: isDark ? "1px solid hsla(25,95%,55%,0.22)" : "1px solid hsla(25,95%,50%,0.20)",
                      boxShadow: isDark
                        ? "0 10px 32px hsla(25,95%,55%,0.15), 0 4px 12px rgba(0,0,0,0.3)"
                        : "0 10px 32px hsla(25,95%,50%,0.12), 0 4px 12px rgba(0,0,0,0.06)",
                    }}
                  >
                    {bookmarksRefreshing && (
                      <div className="px-3 py-2 text-[11px]" style={{ color: textMuted }}>
                        {isAr ? "يتم التحديث…" : "Refreshing…"}
                      </div>
                    )}
                    {allBookmarks.map((b, idx) => (
                      <button
                        key={`${b.surah.number}-${b.ayah}`}
                        onClick={() => { setBookmarksDropdownOpen(false); openSurah(b.surah, b.ayah); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 active:scale-[0.99] transition-all"
                        style={{
                          borderBottom: idx < allBookmarks.length - 1 ? `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(6,5,65,0.06)"}` : "none",
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{
                            background: getBookmarkColor(b.color).bg,
                            color: getBookmarkColor(b.color).text,
                          }}
                        >
                          {b.surah.number}
                        </div>
                        <div className="flex-1 min-w-0" style={{ textAlign: isAr ? "right" : "left" }}>
                          <p className="text-sm font-medium" style={{ color: textPrimary }}>
                            {isAr ? b.surah.name : b.surah.englishName}
                          </p>
                          <p className="text-[10px]" style={{ color: textMuted }}>
                            {isAr ? "آية" : "Ayah"} {b.ayah}
                          </p>
                        </div>
                        <ChevronRight
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: textMuted, transform: isAr ? "rotate(180deg)" : undefined }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Search */}
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4"
            style={{
              background: "transparent",
              border: isDark ? "1px solid hsla(35,65%,55%,0.35)" : "1px solid hsla(35,65%,42%,0.30)",
            }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: isDark ? "hsla(35,65%,55%,0.7)" : "hsla(35,65%,42%,0.6)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث عن سورة..." : "Search surah..."}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#858384]"
              style={{ color: textPrimary }}
              dir={isAr ? "rtl" : "ltr"}
            />
            {search && (
              <button onClick={() => setSearch("")} title={isAr ? "مسح" : "Clear"}>
                <X className="w-4 h-4 text-[#606062]" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-sky-500/40 border-t-sky-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((s) => (
                <button
                  key={s.number}
                  onClick={() => {
                    if (screen === "read-list") {
                      if (lastProgress?.surah_number === s.number) {
                        openSurah(s, lastProgress.ayah_number);
                      } else {
                        openSurah(s);
                      }
                    } else {
                      openListeningSurah(s);
                    }
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-3 active:scale-95 transition-all duration-150"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: isDark ? "hsla(210,100%,65%,0.1)" : "hsla(210,100%,45%,0.08)",
                      border: isDark ? "1px solid hsla(210,100%,65%,0.2)" : "1px solid hsla(210,100%,45%,0.25)",
                      color: isDark ? "#7dd3fc" : "#0057b7",
                    }}
                  >
                    {s.number}
                  </div>
                  <div className="flex-1 min-w-0" style={{ textAlign: isAr ? "right" : "left" }}>
                    <p className="text-sm font-semibold" style={{ color: textPrimary, overflow: "hidden", overflowWrap: "break-word" }}>
                      {isAr ? s.name : s.englishName}
                    </p>
                    <p className="text-[10px]" style={{ color: textMuted }}>
                      {s.numberOfAyahs} {isAr ? "آية" : "verses"} · {getRevelationLabel(s.revelationType, isAr)}
                    </p>
                  </div>
                  {screen === "read-list" && lastProgress?.surah_number === s.number && (
                    <div
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "hsla(210,100%,65%,0.12)", color: "#7dd3fc", border: "1px solid hsla(210,100%,65%,0.2)" }}
                    >
                      {isAr ? "آخر قراءة" : "Last read"}
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: textMuted, transform: isAr ? "rotate(180deg)" : undefined }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {screen === "listen-reciters" && (
        <div className="px-4 pt-2 flex flex-col gap-4">
          <div
            className="rounded-2xl p-4"
            style={{
              background: isDark ? "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(125,211,252,0.04) 100%)" : "linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)",
              border: isDark ? "1px solid rgba(125,211,252,0.14)" : "1px solid rgba(6,5,65,0.12)",
              boxShadow: cardShadow,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "hsla(210,100%,65%,0.12)", border: "1px solid hsla(210,100%,65%,0.18)" }}
              >
                <Settings2 className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex-1 min-w-0" style={{ textAlign: isAr ? "right" : "left" }}>
                <p className="text-sm font-semibold" style={{ color: textPrimary }}>{isAr ? "إعدادات القارئ" : "Reciter Settings"}</p>
                <p className="text-[11px] mt-1" style={{ color: textSecondary }}>
                  {isAr ? "القارئ الافتراضي للتطبيق هو ماهر المعيقلي. اختيارك هنا يُحفظ كإعدادك الافتراضي للاستماع." : "The app default reciter is Maher Al Muaiqly. Your choice here is saved as your personal default for listening."}
                </p>
                <div className="mt-3 flex flex-col gap-1 text-[11px]" style={{ color: textSecondary }}>
                  <p>{isAr ? `الافتراضي للتطبيق: ${appDefaultReciter.labelAr}` : `App default: ${appDefaultReciter.labelEn}`}</p>
                  <p>{isAr ? `إعدادك الحالي: ${activeReciter.labelAr}` : `Your current default: ${activeReciter.labelEn}`}</p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: cardShadow,
            }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: textSecondary }} />
            <input
              value={reciterSearch}
              onChange={(e) => setReciterSearch(e.target.value)}
              placeholder={isAr ? "ابحث عن قارئ..." : "Search reciter..."}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#858384]"
              style={{ color: textPrimary }}
              dir={isAr ? "rtl" : "ltr"}
            />
            {reciterSearch && (
              <button onClick={() => setReciterSearch("")} title={isAr ? "مسح" : "Clear"}>
                <X className="w-4 h-4 text-[#606062]" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 pb-6">
            {filteredReciters.map((reciter) => {
              const selected = reciter.id === selectedReciter;
              return (
                <div
                  key={reciter.id}
                  className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 transition-all"
                  style={
                    selected
                      ? {
                          background: isDark
                            ? "linear-gradient(135deg, hsla(210,100%,65%,0.14) 0%, hsla(280,70%,65%,0.08) 100%)"
                            : "linear-gradient(135deg, #ebf4ff 0%, #e8f0fe 100%)",
                          border: isDark ? "1px solid hsla(210,100%,65%,0.26)" : "1px solid rgba(56,189,248,0.4)",
                          boxShadow: isDark ? "0 0 18px hsla(210,100%,65%,0.10)" : "0 2px 10px rgba(56,189,248,0.15)",
                        }
                      : {
                          background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
                          border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(6,5,65,0.1)",
                          boxShadow: isDark ? "none" : "0 1px 4px rgba(6,5,65,0.05)",
                        }
                  }
                >
                  <button
                    onClick={() => playReciterPreview(reciter.id)}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
                    style={{
                      background: previewReciterId === reciter.id
                        ? "hsla(142,76%,55%,0.14)"
                        : selected
                          ? "hsla(210,100%,65%,0.16)"
                          : isDark ? "rgba(255,255,255,0.05)" : "rgba(6,5,65,0.05)",
                      border: `1px solid ${previewReciterId === reciter.id ? "hsla(142,76%,55%,0.22)" : selected ? "hsla(210,100%,65%,0.22)" : isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.12)"}`,
                    }}
                    title={previewReciterId === reciter.id ? (isAr ? "إيقاف العينة" : "Stop preview") : (isAr ? "سماع عينة" : "Play sample")}
                  >
                    {previewReciterId === reciter.id ? <Pause className="w-4 h-4 text-emerald-400" /> : <Volume2 className={`w-4 h-4 ${selected ? "text-sky-400" : "text-[#858384]"}`} />}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedReciter(reciter.id);
                      if (previewAudioRef.current) {
                        previewAudioRef.current.pause();
                        previewAudioRef.current.currentTime = 0;
                      }
                      setPreviewReciterId(null);
                    }}
                    className="flex-1 min-w-0 flex items-center gap-3 active:scale-[0.99] transition-all"
                  >
                    <div className="flex-1 min-w-0" style={{ textAlign: isAr ? "right" : "left" }}>
                      <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{isAr ? reciter.labelAr : reciter.labelEn}</p>
                      <p className="text-[10px] truncate" style={{ color: textMuted }}>
                        {reciter.surahList.size} {isAr ? "سورة متاحة" : "surahs available"}
                      </p>
                    </div>
                    {selected && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "hsla(210,100%,65%,0.12)", border: "1px solid hsla(210,100%,65%,0.22)" }}>
                          <Check className="w-4 h-4 text-sky-400" />
                        </div>
                        <div className="text-[10px] font-bold px-2 py-1 rounded-full text-sky-400" style={{ background: "hsla(210,100%,65%,0.12)", border: "1px solid hsla(210,100%,65%,0.22)" }}>
                          {isAr ? "افتراضيك" : "Your default"}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Listen Player */}
      {screen === "listen-player" && (
        <div className="px-4 pt-3">
          {loadingReader ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-sky-500/40 border-t-sky-500 rounded-full animate-spin" />
            </div>
          ) : activeSurah ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-stretch gap-3" style={{ direction: "ltr" }}>
                <button
                  onClick={handleBackNavigation}
                  className="w-11 rounded-2xl flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.85)",
                    border: `1px solid ${cardBorder}`,
                    boxShadow: cardShadow,
                  }}
                  title={isAr ? "رجوع" : "Back"}
                >
                  <ArrowLeft className="w-4 h-4" style={{ color: textPrimary }} />
                </button>
                <div
                  className="flex-1 rounded-3xl p-5"
                  style={{
                    background: isDark
                      ? "linear-gradient(135deg, rgba(96,96,98,0.22) 0%, rgba(12,15,20,0.95) 100%)"
                      : "linear-gradient(135deg, rgba(233,206,176,0.36) 0%, rgba(252,254,253,0.98) 100%)",
                    border: isDark ? "1px solid rgba(133,131,132,0.18)" : "1px solid rgba(6,5,65,0.10)",
                    boxShadow: isDark ? "0 6px 24px rgba(0,0,0,0.28)" : "0 8px 22px rgba(6,5,65,0.08)",
                  }}
                >
                  <p className="text-lg font-bold" style={{ color: textPrimary, textAlign: isAr ? "right" : "left", overflow: "hidden", overflowWrap: "break-word" }}>
                    {isAr ? activeSurah.name : activeSurah.englishName}
                  </p>
                  <p className="text-sm mt-1" style={{ color: textSecondary, textAlign: isAr ? "right" : "left" }}>
                    {isAr ? "القارئ" : "Reciter"}: {isAr ? activeReciter?.labelAr : activeReciter?.labelEn}
                  </p>
                </div>
              </div>

              <div
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <button
                  onClick={toggleSurahPlayback}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl active:scale-95 transition-all"
                  style={{
                    background: isSurahPlaying ? "hsla(142,76%,55%,0.12)" : "hsla(0,84%,60%,0.10)",
                    border: `1px solid ${isSurahPlaying ? "hsla(142,76%,55%,0.25)" : "hsla(0,84%,60%,0.22)"}`,
                  }}
                >
                  {isSurahPlaying ? <Pause className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4 text-red-400" />}
                  <span className={`text-sm font-semibold ${isSurahPlaying ? "text-emerald-400" : "text-red-400"}`}>{isAr ? (isSurahPlaying ? "إيقاف السورة" : "تشغيل السورة") : (isSurahPlaying ? "Stop Surah" : "Play Surah")}</span>
                </button>

                <button
                  onClick={() => setScreen("listen-list")}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl active:scale-95 transition-all"
                  style={{ background: "hsla(210,100%,65%,0.08)", border: "1px solid hsla(210,100%,65%,0.18)" }}
                >
                  <ListMusic className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-semibold text-sky-400">{isAr ? "تغيير السورة أو القارئ" : "Change Surah or Reciter"}</span>
                </button>
              </div>

              <div
                className="rounded-2xl p-4 flex flex-col gap-4"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={toggleBackgroundPlayback}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl active:scale-95 transition-all"
                    style={{
                      background: backgroundPlaybackEnabled ? "hsla(142,76%,55%,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${backgroundPlaybackEnabled ? "hsla(142,76%,55%,0.25)" : cardBorder}`,
                    }}
                    title={isAr ? "تفعيل التحكم بالخلفية" : "Enable background controls"}
                  >
                    <Volume2 className={`w-4 h-4 ${backgroundPlaybackEnabled ? "text-emerald-400" : "text-[#858384]"}`} />
                    <span className={`text-xs font-semibold ${backgroundPlaybackEnabled ? "text-emerald-400" : "text-[#858384]"}`}>{isAr ? "الخلفية" : "Background"}</span>
                  </button>
                  <button
                    onClick={() => setLoopSurah((prev) => !prev)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl active:scale-95 transition-all"
                    style={{
                      background: loopSurah ? "hsla(142,76%,55%,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${loopSurah ? "hsla(142,76%,55%,0.25)" : cardBorder}`,
                    }}
                  >
                    <RotateCcw className={`w-4 h-4 ${loopSurah ? "text-emerald-400" : "text-[#858384]"}`} />
                    <span className={`text-xs font-semibold ${loopSurah ? "text-emerald-400" : "text-[#858384]"}`}>{isAr ? "تكرار السورة" : "Loop Surah"}</span>
                  </button>

                  <button
                    onClick={() => setAutoNextSurah((prev) => !prev)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl active:scale-95 transition-all"
                    style={{
                      background: autoNextSurah ? "hsla(142,76%,55%,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${autoNextSurah ? "hsla(142,76%,55%,0.25)" : cardBorder}`,
                    }}
                  >
                    <SkipForward className={`w-4 h-4 ${autoNextSurah ? "text-emerald-400" : "text-[#858384]"}`} />
                    <span className={`text-xs font-semibold ${autoNextSurah ? "text-emerald-400" : "text-[#858384]"}`}>{isAr ? "التالي تلقائياً" : "Auto Next"}</span>
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px]" style={{ color: textSecondary }}>
                      {isAr ? "ملف السورة الكامل" : "Full surah audio"}
                    </p>
                    <p className="text-[11px]" style={{ color: textSecondary }}>
                      {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
                    </p>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={audioDuration || 0}
                    step={0.1}
                    value={Math.min(audioCurrentTime, audioDuration || 0)}
                    onChange={(e) => seekAudio(Number(e.target.value))}
                    className="w-full accent-sky-400"
                    aria-label={isAr ? "شريط تقدم الصوت" : "Audio progress bar"}
                    title={isAr ? "شريط تقدم الصوت" : "Audio progress bar"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2" dir={isAr ? "rtl" : "ltr"}>
                  <button
                    onClick={playNextListeningSurah}
                    className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl active:scale-95 transition-all"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)", border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
                    title={isAr ? "السورة التالية" : "Next surah"}
                  >
                    <SkipForward className="w-4 h-4 flex-shrink-0" style={{ color: textPrimary }} />
                    <span className="text-xs font-semibold" style={{ color: textPrimary }}>
                      {isAr ? "التالي" : "Next surah"}
                    </span>
                  </button>
                  <button
                    onClick={playPreviousListeningSurah}
                    className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl active:scale-95 transition-all"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)", border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
                    title={isAr ? "السورة السابقة" : "Previous surah"}
                  >
                    <SkipBack className="w-4 h-4 flex-shrink-0" style={{ color: textPrimary }} />
                    <span className="text-xs font-semibold" style={{ color: textPrimary }}>
                      {isAr ? "السابق" : "Previous surah"}
                    </span>
                  </button>
                  <button
                    onClick={() => skipAudioBy(10)}
                    className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl active:scale-95 transition-all"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)", border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
                    title={isAr ? "تقديم 10 ثوانٍ" : "Forward 10 seconds"}
                  >
                    <RotateCw className="w-4 h-4 flex-shrink-0" style={{ color: textPrimary }} />
                    <span className="text-xs font-semibold" style={{ color: textPrimary }}>
                      {isAr ? "+10 ثوانٍ" : "+10 sec"}
                    </span>
                  </button>
                  <button
                    onClick={() => skipAudioBy(-10)}
                    className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl active:scale-95 transition-all"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)", border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
                    title={isAr ? "إرجاع 10 ثوانٍ" : "Back 10 seconds"}
                  >
                    <RotateCcw className="w-4 h-4 flex-shrink-0" style={{ color: textPrimary }} />
                    <span className="text-xs font-semibold" style={{ color: textPrimary }}>
                      {isAr ? "-10 ثوانٍ" : "-10 sec"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Reader View — Mushaf style */}
      {screen === "reader" && (
        <div className="pt-2 pb-12 px-3" ref={readerTopRef} style={{ overflowAnchor: "none" }}>
          {loadingReader ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : activeSurah ? (() => {
            const gold      = isDark ? "#c9a84c" : "#8a6a1a";
            const goldGlow  = isDark ? "hsla(45,65%,55%,0.55)" : "hsla(35,65%,42%,0.4)";
            const goldFaint = isDark ? "hsla(45,65%,50%,0.15)" : "hsla(35,55%,42%,0.12)";
            const pageBg    = isDark ? "#0e1018" : "#faf6ed";
            const pageTxt   = isDark ? "#e8dfc8" : "#1a120a";
            const markerTxt = gold;

            // Bookmark control: button + 3-color picker popover. Colors are unique;
            // picking an in-use color (dimmed + swap icon) moves it here, removing the previous holder.
            const renderBookmarkControl = (ayah: Ayah, isBookmarked: boolean) => {
              if (!activeSurah) return null;
              const key = `${activeSurah.number}:${ayah.numberInSurah}`;
              const open = colorPickerKey === key;
              const currentColorId = readBookmarkColors(currentUserId)[key];
              const current = isBookmarked ? getBookmarkColor(currentColorId) : null;
              const picker = getPickerColors(key);
              return (
                <div className="relative">
                  <button
                    onClick={() => setColorPickerKey(open ? null : key)}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
                    style={{
                      border: `1px solid ${isBookmarked && current ? current.dot : goldGlow}`,
                      background: isBookmarked && current ? current.bg : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)"),
                      color: isBookmarked && current ? current.dot : gold,
                      boxShadow: isBookmarked && current ? `0 0 14px ${current.bg}` : (isDark ? `0 0 10px ${goldFaint}` : `0 2px 8px ${goldFaint}`),
                    }}
                    title={isAr ? "حفظ" : "Bookmark"}
                  >
                    {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                  </button>
                  {open && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setColorPickerKey(null)} />
                      <div
                        className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 flex items-center gap-2 px-2.5 py-2 rounded-xl"
                        style={{
                          background: isDark ? "linear-gradient(135deg, hsl(25 15% 12%) 0%, hsl(260 15% 11%) 100%)" : "#ffffff",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(6,5,65,0.12)"}`,
                          boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.12)",
                        }}
                      >
                        {picker.map((c) => {
                          const isCurrent = currentColorId === c.id;
                          const showSwap = c.inUse && !isCurrent;
                          return (
                            <button
                              key={c.id}
                              onClick={() => {
                                setColorPickerKey(null);
                                if (isBookmarked) {
                                  if (currentColorId === c.id) {
                                    void removeBookmark(ayah);
                                  } else {
                                    void recolorBookmark(ayah, c.id);
                                  }
                                } else {
                                  void addBookmarkWithColor(ayah, c.id);
                                }
                              }}
                              className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all"
                              style={{
                                background: c.dot,
                                opacity: showSwap ? 0.55 : 1,
                                border: isCurrent ? `2px solid ${isDark ? "#fff" : "#060541"}` : "2px solid transparent",
                                cursor: "pointer",
                              }}
                              title={showSwap ? (isAr ? "مستخدم — سيُنقل إلى هنا" : "In use — will move here") : c.id}
                            >
                              {isCurrent ? (
                                <Check className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                              ) : showSwap ? (
                                <ArrowLeftRight className="w-3 h-3" style={{ color: "#fff" }} />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            };

            // Helper: Arabic-Indic digits
            const toAI = (n: number) => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]);
            const renderAyahMarker = (n: number) => {
              if (isAr) {
                return (
                  <span
                    className="inline-block"
                    style={{
                      color: gold,
                      fontSize: 24,
                      fontWeight: 700,
                      fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', serif",
                      lineHeight: 1,
                      marginRight: 6,
                    }}
                  >
                    {toAI(n)}
                  </span>
                );
              }
              return (
                <span className="relative inline-flex items-center justify-center" style={{ width: 46, height: 46 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      color: markerTxt,
                      fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', serif",
                      fontSize: 35,
                      lineHeight: 1,
                    }}
                  >
                    {"\u06DD"}
                  </span>
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      color: markerTxt,
                      fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', serif",
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: 1,
                      paddingTop: 1,
                    }}
                  >
                    {n}
                  </span>
                </span>
              );
            };
            const displayAyahNumber = (ayah: Ayah) => ayah.numberInSurah;

            return (
              <>
                <div
                  className="fixed z-40 flex flex-nowrap items-center justify-between gap-2 py-2 mb-4 px-3 overflow-x-auto no-scrollbar"
                  dir={isAr ? "rtl" : "ltr"}
                  style={{
                    background: bg,
                    top: "var(--app-header-h, 64px)",
                    left: 0,
                    right: 0,
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    boxShadow: isDark
                      ? "0 4px 20px hsla(25,95%,55%,0.18), 0 2px 8px hsla(35,65%,45%,0.12)"
                      : "0 4px 20px hsla(35,65%,42%,0.12), 0 2px 8px hsla(35,65%,42%,0.06)",
                  }}
                >
                  <button
                    onClick={handleBackNavigation}
                    className="rounded-xl flex items-center gap-2 px-3 py-2 active:scale-95 transition-all flex-shrink-0"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)",
                      border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(6,5,65,0.10)",
                      boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.22)" : "0 8px 20px rgba(6,5,65,0.06)",
                      backdropFilter: "blur(10px)",
                    }}
                    title={isAr ? "القرآن" : "Quran"}
                  >
                    <ArrowLeft className="w-4 h-4" style={{ color: isDark ? "#f2f2f2" : "#060541", transform: isAr ? "rotate(180deg)" : undefined }} />
                    <span className="text-[12px] font-medium" style={{ color: isDark ? "#f2f2f2" : "#060541" }}>
                      {isAr ? "القرآن" : "Quran"}
                    </span>
                  </button>
                  <button
                    onClick={toggleReaderPlayAllMode}
                    className="rounded-xl flex items-center gap-2 px-3 py-2 active:scale-95 transition-all flex-shrink-0"
                    style={{
                      background: readerPlayAllEnabled
                        ? (isDark ? "hsla(142,76%,55%,0.16)" : "hsla(142,76%,45%,0.14)")
                        : (isDark ? "hsla(210,100%,65%,0.12)" : "hsla(210,100%,65%,0.10)"),
                      border: readerPlayAllEnabled
                        ? (isDark ? "1px solid hsla(142,76%,55%,0.32)" : "1px solid hsla(142,76%,45%,0.28)")
                        : (isDark ? "1px solid hsla(210,100%,65%,0.26)" : "1px solid hsla(210,100%,65%,0.24)"),
                      boxShadow: readerPlayAllEnabled
                        ? (isDark ? "0 8px 24px rgba(34,197,94,0.18)" : "0 8px 20px rgba(34,197,94,0.16)")
                        : (isDark ? "0 8px 24px rgba(0,0,0,0.22)" : "0 8px 20px rgba(59,130,246,0.10)"),
                      backdropFilter: "blur(10px)",
                    }}
                    title={isAr ? (readerPlayAllEnabled ? "تشغيل الكل مفعل" : "تشغيل الكل") : (readerPlayAllEnabled ? "Play all enabled" : "Play all")}
                  >
                    {readerPlayAllEnabled
                      ? <Check className="w-4 h-4" style={{ color: "#22c55e" }} />
                      : <Volume2 className="w-4 h-4" style={{ color: "hsl(210,100%,65%)" }} />}
                    <span className="text-[12px] font-medium" style={{ color: readerPlayAllEnabled ? "#22c55e" : (isDark ? "#dbeafe" : "#1d4ed8") }}>
                      {isAr ? (readerPlayAllEnabled ? "تشغيل الكل مفعل" : "تشغيل الكل") : (readerPlayAllEnabled ? "Play all on" : "Play all")}
                    </span>
                  </button>
                  {isAr && (
                    <button
                      onClick={() => setReaderReciterOpen((v) => !v)}
                      className="rounded-xl flex items-center gap-1.5 px-3 py-2 active:scale-95 transition-all flex-shrink-0"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)",
                        border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(6,5,65,0.10)",
                        boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.22)" : "0 8px 20px rgba(6,5,65,0.06)",
                        backdropFilter: "blur(10px)",
                      }}
                    >
                      <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? "#858384" : "#606062", transform: readerReciterOpen ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
                      <span className="text-[11px] font-medium" style={{ color: isDark ? "#f2f2f2" : "#060541", fontFamily: "'Noto Sans Arabic', sans-serif" }}>
                        {(READER_AUDIO_RECITERS.find((r) => r.id === readerAudioReciter) ?? READER_AUDIO_RECITERS[3]).labelAr}
                      </span>
                    </button>
                  )}
                  {(() => {
                    const allBookmarks = getAllBookmarks(surahs, currentUserId);
                    return (
                      <div className="relative" ref={bookmarksDropdownRef}>
                        <button
                          ref={readerBookmarkBtnRef}
                          onClick={() => {
                            const next = !bookmarksDropdownOpen;
                            setBookmarksDropdownOpen(next);
                            if (next && readerBookmarkBtnRef.current) {
                              const rect = readerBookmarkBtnRef.current.getBoundingClientRect();
                              setReaderDropdownPos({
                                top: rect.bottom + window.scrollY + 4,
                                ...(isAr
                                  ? { left: Math.max(8, rect.left + window.scrollX) }
                                  : { right: Math.max(8, window.innerWidth - rect.right - window.scrollX) }),
                              });
                            }
                          }}
                          className="rounded-xl flex items-center justify-center gap-0.5 min-w-[52px] h-9 active:scale-95 transition-all flex-shrink-0"
                          style={{
                            background: isDark ? "hsla(45,65%,55%,0.10)" : "hsla(35,65%,42%,0.10)",
                            border: isDark ? "1px solid hsla(45,65%,55%,0.24)" : "1px solid hsla(35,65%,42%,0.22)",
                            boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.18)" : "0 8px 20px rgba(138,106,26,0.10)",
                            backdropFilter: "blur(10px)",
                          }}
                          title={isAr ? "العلامات المرجعية" : "Bookmarks"}
                        >
                          <Bookmark className="w-4 h-4" style={{ color: gold }} />
                          <ChevronDown className="w-3 h-3" style={{ color: gold }} />
                          {allBookmarks.length > 0 && (
                            <span
                              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
                              style={{
                                background: isDark ? "hsla(25,95%,60%,0.85)" : "hsla(25,95%,45%,0.85)",
                                color: "#fff",
                                border: `1px solid ${isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)"}`,
                              }}
                            >
                              {allBookmarks.length}
                            </span>
                          )}
                        </button>
                        {bookmarksDropdownOpen && allBookmarks.length > 0 && readerDropdownPos && (
                          <div
                            className="fixed z-50 rounded-xl overflow-hidden"
                            style={{
                              top: readerDropdownPos.top,
                              ...(readerDropdownPos.right !== undefined
                                ? { right: readerDropdownPos.right }
                                : { left: readerDropdownPos.left }),
                              minWidth: 220,
                              background: isDark
                                ? "linear-gradient(135deg, hsl(25 15% 12%) 0%, hsl(260 15% 11%) 100%)"
                                : "linear-gradient(135deg, #ffffff 0%, hsl(45 100% 97%) 100%)",
                              border: `1px solid ${isDark ? "hsla(25,95%,60%,0.22)" : "hsla(25,95%,45%,0.25)"}`,
                              boxShadow: isDark ? "0 10px 28px rgba(0,0,0,0.4)" : cardShadow,
                            }}
                          >
                            {bookmarksRefreshing && (
                              <div className="px-3 py-2 text-[11px]" style={{ color: textMuted }}>
                                {isAr ? "يتم التحديث…" : "Refreshing…"}
                              </div>
                            )}
                            {allBookmarks.map((b, idx) => (
                              <button
                                key={`${b.surah.number}-${b.ayah}`}
                                onClick={() => { setBookmarksDropdownOpen(false); openSurah(b.surah, b.ayah); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 active:scale-[0.99] transition-all"
                                style={{
                                  borderBottom: idx < allBookmarks.length - 1 ? `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(6,5,65,0.06)"}` : "none",
                                }}
                              >
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                  style={{
                                    background: getBookmarkColor(b.color).bg,
                                    color: getBookmarkColor(b.color).text,
                                  }}
                                >
                                  {b.surah.number}
                                </div>
                                <div className="flex-1 min-w-0" style={{ textAlign: isAr ? "right" : "left" }}>
                                  <p className="text-sm font-medium" style={{ color: textPrimary }}>
                                    {isAr ? b.surah.name : b.surah.englishName}
                                  </p>
                                  <p className="text-[10px]" style={{ color: textMuted }}>
                                    {isAr ? "آية" : "Ayah"} {b.ayah}
                                  </p>
                                </div>
                                <ChevronRight
                                  className="w-3.5 h-3.5 flex-shrink-0"
                                  style={{ color: textMuted, transform: isAr ? "rotate(180deg)" : undefined }}
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {!isAr && (
                    <button
                      onClick={() => setShowArabicText((v) => !v)}
                      className="rounded-xl flex items-center gap-2 px-3 py-2 active:scale-95 transition-all flex-shrink-0"
                      style={{
                        background: showArabicText
                          ? (isDark ? "hsla(45,65%,55%,0.14)" : "hsla(35,65%,42%,0.12)")
                          : (isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)"),
                        border: showArabicText
                          ? (isDark ? "1px solid hsla(45,65%,55%,0.35)" : "1px solid hsla(35,65%,42%,0.30)")
                          : (isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(6,5,65,0.10)"),
                        boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.22)" : "0 8px 20px rgba(6,5,65,0.06)",
                        backdropFilter: "blur(10px)",
                      }}
                      title={showArabicText ? "Hide Arabic text" : "Show Arabic text"}
                    >
                      <div className="flex flex-col items-center leading-none">
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: showArabicText ? gold : (isDark ? "#858384" : "#606062") }}
                        >
                          Arabic
                        </span>
                        <span
                          className="text-[9px] font-medium mt-0.5"
                          style={{ color: showArabicText ? gold : (isDark ? "#858384" : "#606062") }}
                        >
                          Transcript
                        </span>
                      </div>
                    </button>
                  )}
                </div>
                <div className="h-14" aria-hidden="true" />

                {/* ── Arabic reader reciter dropdown list ── */}
                {isAr && readerReciterOpen && (
                  <div
                    className="mb-3 rounded-2xl overflow-hidden"
                    dir="rtl"
                    style={{
                      background: isDark ? "#1a1d24" : "#ffffff",
                      border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(6,5,65,0.12)",
                      boxShadow: isDark ? "0 16px 40px rgba(0,0,0,0.6)" : "0 8px 32px rgba(6,5,65,0.14)",
                    }}
                  >
                    {READER_AUDIO_RECITERS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setReaderAudioReciter(r.id); setReaderReciterOpen(false); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-right transition-all active:scale-[0.98]"
                        style={{
                          background: r.id === readerAudioReciter
                            ? (isDark ? "hsla(45,65%,50%,0.15)" : "hsla(35,55%,42%,0.10)")
                            : "transparent",
                          borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(6,5,65,0.06)",
                        }}
                      >
                        <span
                          className="text-[13px] font-medium"
                          style={{
                            fontFamily: "'Noto Sans Arabic', sans-serif",
                            color: r.id === readerAudioReciter
                              ? (isDark ? "#c9a84c" : "#8a6a1a")
                              : (isDark ? "#e8dfc8" : "#1a120a"),
                          }}
                        >
                          {r.labelAr}
                        </span>
                        {r.id === readerAudioReciter && (
                          <Check className="w-4 h-4 flex-shrink-0" style={{ color: isDark ? "#c9a84c" : "#8a6a1a" }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className="relative"
                  style={{
                    background: pageBg,
                    borderRadius: "20px",
                    boxShadow: isDark
                      ? `0 0 0 1px ${goldGlow}, 0 0 0 3px ${goldFaint}, 0 0 0 5px ${goldGlow}, 0 12px 40px rgba(0,0,0,0.6)`
                      : `0 0 0 1px ${goldGlow}, 0 0 0 3px ${goldFaint}, 0 0 0 5px ${goldGlow}, 0 8px 24px rgba(80,50,10,0.18)`,
                  }}
                >
                {/* Corner ornament rosettes */}
                {([
                  { top: 3, left: 3 }, { top: 3, right: 3 },
                  { bottom: 3, left: 3 }, { bottom: 3, right: 3 },
                ] as const).map((pos, i) => (
                  <svg key={i} className="absolute pointer-events-none" style={{ ...pos, width: 32, height: 32, opacity: isDark ? 0.6 : 0.5 }} viewBox="0 0 32 32">
                    {Array.from({ length: 8 }).map((_, p) => {
                      const a = (p * 45 * Math.PI) / 180;
                      return <ellipse key={p} cx={16 + 6 * Math.cos(a)} cy={16 + 6 * Math.sin(a)} rx="4" ry="1.8" transform={`rotate(${p * 45},${16 + 6 * Math.cos(a)},${16 + 6 * Math.sin(a)})`} fill={gold} />;
                    })}
                    <circle cx="16" cy="16" r="3.5" fill={gold} />
                    <circle cx="16" cy="16" r="1.8" fill={pageBg} />
                  </svg>
                ))}

                {/* Page content */}
                <div className="relative px-6 pt-8 pb-8" style={{ zIndex: 1 }}>

                  {/* ── Surah name banner ── */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 h-px" style={{ background: goldGlow }} />
                    <div style={{ width: 8, height: 8, background: gold, transform: "rotate(45deg)", borderRadius: 1 }} />
                    <div className="flex-1 h-px" style={{ background: goldGlow }} />
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-1">
                    <div className="inline-block px-7 py-1.5 rounded-full" style={{ background: goldFaint, border: `1px solid ${goldGlow}`, boxShadow: isDark ? `0 0 16px ${goldFaint}` : "none" }}>
                      <p
                        className="text-[22px] font-bold"
                        dir={isAr ? "rtl" : "ltr"}
                        style={{
                          fontFamily: isAr ? "'Uthmanic Hafs', 'Noto Sans Arabic', serif" : "inherit",
                          color: gold,
                          lineHeight: 1.5,
                          textAlign: "center",
                          overflow: "hidden",
                          overflowWrap: "break-word",
                        }}
                      >
                        {isAr ? activeSurah.name : activeSurah.englishName}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] tracking-[0.2em] uppercase mt-1" style={{ color: isDark ? "hsla(45,50%,60%,0.55)" : "hsla(35,40%,35%,0.6)" }}>
                      {activeSurah.ayahs.length} {isAr ? "آية" : "AYAHS"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 mb-5">
                    <div className="flex-1 h-px" style={{ background: goldGlow }} />
                    <div style={{ width: 8, height: 8, background: gold, transform: "rotate(45deg)", borderRadius: 1 }} />
                    <div className="flex-1 h-px" style={{ background: goldGlow }} />
                  </div>

                  {/* ── Bismillah ── */}
                  {activeSurah.number !== 9 && activeSurah.number !== 1 && readerPage === 0 && (
                    <p className="text-center mb-5" dir={isAr ? "rtl" : "ltr"} style={{
                      fontFamily: isAr ? "'Uthmanic Hafs', 'Noto Sans Arabic', serif" : "inherit",
                      fontSize: "19px", lineHeight: "2",
                      color: gold,
                      textShadow: isDark ? `0 0 18px ${goldFaint}` : "none",
                      overflow: "hidden",
                      overflowWrap: "break-word",
                    }}>
                      {isAr ? "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" : "In the name of Allah, the Most Compassionate, the Most Merciful."}
                    </p>
                  )}

                  {/* ── Arabic mode: per-ayah cards (same layout as English) ── */}
                  {isAr ? (
                    <div className="flex flex-col" dir="rtl">
                      {activeSurah.ayahs.slice(pageBreaks[readerPage], pageBreaks[readerPage + 1]).map((ayah, idx) => {
                        const globalIdx = pageBreaks[readerPage] + idx;
                        const isPlaying = playing && currentPlaybackAyahIndex === globalIdx;
                        const isBookmarked = bookmarkedAyahs.has(ayah.numberInSurah);
                        const trans = activeTrans[globalIdx] ?? null;
                        return (
                          <div
                            key={ayah.numberInSurah}
                            ref={(el) => { ayahItemRefs.current[globalIdx] = el; }}
                            className="w-full flex flex-col gap-3 py-3 rounded-xl transition-all"
                            style={{ borderBottom: `1px solid ${goldFaint}`, background: isPlaying ? (isDark ? "hsla(45,65%,50%,0.10)" : "hsla(38,85%,85%,0.55)") : "transparent", boxShadow: isPlaying ? (isDark ? `0 0 18px hsla(45,65%,50%,0.22)` : `0 0 14px hsla(38,75%,60%,0.22)`) : "none" }}
                          >
                            <button
                              onClick={() => openAyahSheet(ayah, trans)}
                              className="flex-1 text-right active:scale-[0.99] transition-all duration-150"
                            >
                              <p dir="rtl" style={{
                                fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', 'Amiri', serif",
                                fontSize: "21px", lineHeight: "2.2",
                                color: isPlaying ? gold : pageTxt,
                                textShadow: isPlaying && isDark ? `0 0 12px ${goldGlow}` : "none",
                                textDecoration: isBookmarked ? `underline ${goldGlow}` : "none",
                                overflow: "hidden",
                                overflowWrap: "break-word",
                              }}>
                                {stripBismillahPrefix(ayah)}
                                {renderAyahMarker(displayAyahNumber(ayah))}
                              </p>
                            </button>
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => openAyahExplanationPopup(ayah, trans)}
                                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
                                style={{
                                  border: `1px solid ${goldGlow}`,
                                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
                                  color: gold,
                                  boxShadow: isDark ? `0 0 10px ${goldFaint}` : `0 2px 8px ${goldFaint}`,
                                }}
                                title={isAr ? "المعنى" : "Meaning"}
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                              </button>
                              {renderBookmarkControl(ayah, isBookmarked)}
                              <button
                                onClick={() => void toggleReaderAyahPlayback(ayah, globalIdx)}
                                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
                                style={{
                                  border: `1px solid ${goldGlow}`,
                                  background: isPlaying ? goldFaint : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)"),
                                  color: gold,
                                  boxShadow: isPlaying ? `0 0 14px ${goldGlow}` : (isDark ? `0 0 10px ${goldFaint}` : `0 2px 8px ${goldFaint}`),
                                }}
                                title={isAr ? (isPlaying ? "إيقاف مؤقت" : "استمع") : (isPlaying ? "Pause" : "Play")}
                              >
                                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── English mode: each ayah as its own line ── */
                    <div className="flex flex-col" dir="ltr">
                      {activeSurah.ayahs.slice(pageBreaks[readerPage], pageBreaks[readerPage + 1]).map((ayah, idx) => {
                        const globalIdx = pageBreaks[readerPage] + idx;
                        const trans = activeTrans[globalIdx] ?? null;
                        const isPlaying = playing && currentPlaybackAyahIndex === globalIdx;
                        const isBookmarked = bookmarkedAyahs.has(ayah.numberInSurah);
                        return (
                          <div
                            key={ayah.numberInSurah}
                            ref={(el) => { ayahItemRefs.current[globalIdx] = el; }}
                            className="w-full flex flex-col gap-3 py-3 rounded-xl transition-all"
                            style={{ borderBottom: `1px solid ${goldFaint}`, background: isPlaying ? (isDark ? "hsla(45,65%,50%,0.10)" : "hsla(38,85%,85%,0.55)") : "transparent", boxShadow: isPlaying ? (isDark ? `0 0 18px hsla(45,65%,50%,0.22)` : `0 0 14px hsla(38,75%,60%,0.22)`) : "none" }}
                          >
                            <button
                              onClick={() => openAyahSheet(ayah, trans ?? null)}
                              className="flex-1 text-left active:scale-[0.99] transition-all duration-150"
                            >
                              {showArabicText && (
                                <p dir="rtl" style={{
                                  fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', 'Amiri', serif",
                                  fontSize: "21px", lineHeight: "2.2",
                                  color: isPlaying ? gold : pageTxt,
                                  textShadow: isPlaying && isDark ? `0 0 12px ${goldGlow}` : "none",
                                  textDecoration: isBookmarked ? `underline ${goldGlow}` : "none",
                                  textAlign: "right",
                                  marginBottom: "8px",
                                  overflow: "hidden",
                                  overflowWrap: "break-word",
                                }}>
                                  {stripBismillahPrefix(ayah)}
                                  {renderAyahMarker(displayAyahNumber(ayah))}
                                </p>
                              )}
                              {trans && (
                                <p style={{
                                  fontSize: "17px", lineHeight: "1.85",
                                  color: isPlaying ? gold : pageTxt,
                                  textShadow: isPlaying && isDark ? `0 0 10px ${goldFaint}` : "none",
                                  textDecoration: isBookmarked ? `underline ${goldGlow}` : "none",
                                }}>
                                  <span
                                    className="inline-flex items-center justify-center rounded-md mr-2 align-middle"
                                    style={{
                                      minWidth: 24,
                                      height: 20,
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      lineHeight: 1,
                                      color: gold,
                                      background: goldFaint,
                                      border: `1px solid ${goldGlow}`,
                                      padding: "0 6px",
                                    }}
                                  >
                                    {ayah.numberInSurah}
                                  </span>
                                  {trans.text}
                                </p>
                              )}
                            </button>
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => openAyahExplanationPopup(ayah, trans ?? null)}
                                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
                                style={{
                                  border: `1px solid ${goldGlow}`,
                                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
                                  color: gold,
                                  boxShadow: isDark ? `0 0 10px ${goldFaint}` : `0 2px 8px ${goldFaint}`,
                                }}
                                title={isAr ? "المعنى" : "Meaning"}
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                              </button>
                              {renderBookmarkControl(ayah, isBookmarked)}
                              <button
                                onClick={() => void toggleReaderAyahPlayback(ayah, globalIdx)}
                                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
                                style={{
                                  border: `1px solid ${goldGlow}`,
                                  background: isPlaying ? goldFaint : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)"),
                                  color: gold,
                                  boxShadow: isPlaying ? `0 0 14px ${goldGlow}` : (isDark ? `0 0 10px ${goldFaint}` : `0 2px 8px ${goldFaint}`),
                                }}
                                title={isAr ? (isPlaying ? "إيقاف مؤقت" : "استمع") : (isPlaying ? "Pause" : "Play")}
                              >
                                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Pagination controls ── */}
                  {pageBreaks.length > 1 && (() => {
                    const totalPages = pageBreaks.length;
                    const from = pageBreaks[readerPage] + 1;
                    const to = pageBreaks[readerPage + 1] ?? activeSurah.ayahs.length;
                    const isLastPage = readerPage >= totalPages - 1;
                    const nextSurahMeta = activeSurah && surahs.find((s) => s.number === activeSurah.number + 1);
                    // Persist reading position to the first ayah of the target page
                    const savePageProgress = (p: number) => {
                      if (!activeSurah) return;
                      const idx = pageBreaks[p];
                      const firstAyah = typeof idx === "number" ? activeSurah.ayahs[idx] : undefined;
                      if (firstAyah) saveProgress(activeSurah.number, firstAyah.numberInSurah);
                    };
                    const goToPage = (p: number, scroll = true) => {
                      setReaderPage(p);
                      savePageProgress(p);
                      setPagePickerOpen(false);
                      if (scroll) setTimeout(() => readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                    };
                    return (
                      <div className="mt-6 mb-2 space-y-2">
                        {/* Prev / counter / Next row */}
                        <div className="flex items-center justify-between gap-3">
                          <button
                            onClick={() => { setReaderPage(p => p - 1); savePageProgress(readerPage - 1); setTimeout(() => readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                            disabled={readerPage === 0}
                            className="flex-1 py-3 rounded-2xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-30"
                            style={{ background: goldFaint, border: `1px solid ${goldGlow}`, color: gold }}
                          >
                            {isAr ? "→ السابق" : "← Prev"}
                          </button>
                          {/* Page counter */}
                          <button
                            className="text-center px-3 rounded-xl py-1"
                            style={{ background: "transparent" }}
                          >
                            <p className="text-xs font-semibold" style={{ color: gold }}>{from}–{to}</p>
                            <p className="text-[10px]" style={{ color: isDark ? "hsla(45,35%,50%,0.5)" : "hsla(35,30%,35%,0.45)" }}>
                              {isAr ? `صفحة ${readerPage + 1} من ${totalPages}` : `Page ${readerPage + 1} of ${totalPages}`}
                            </p>
                          </button>
                          <button
                            onClick={() => { setReaderPage(p => p + 1); savePageProgress(readerPage + 1); setTimeout(() => readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                            disabled={isLastPage}
                            className="flex-1 py-3 rounded-2xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-30"
                            style={{ background: goldFaint, border: `1px solid ${goldGlow}`, color: gold }}
                          >
                            {isAr ? "التالي ←" : "Next →"}
                          </button>
                        </div>
                        {/* Scrollable circular page number chips */}
                        <div
                          ref={chipRowRef}
                          className="flex items-center gap-2 overflow-x-auto px-1 py-1 no-scrollbar"
                          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        >
                          <style>{".no-scrollbar::-webkit-scrollbar { display: none; }"}</style>
                          {Array.from({ length: totalPages }, (_, i) => (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onFocus={(e) => (e.target as HTMLButtonElement).blur()}
                              key={i}
                              onClick={() => {
                                const container = chipRowRef.current;
                                chipRowTopBeforeRef.current = container ? container.getBoundingClientRect().top : null;
                                preserveScrollYRef.current = window.scrollY;
                                suppressPlaybackScrollOnceRef.current = true;
                                goToPage(i, false);
                              }}
                              className="flex-shrink-0 active:scale-90 transition-all"
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: i === readerPage ? gold : "transparent",
                                color: i === readerPage ? (isDark ? "#0c0f14" : "#fff") : gold,
                                border: `1.5px solid ${i === readerPage ? gold : goldGlow}`,
                                fontSize: 13,
                                fontWeight: 700,
                                lineHeight: 1,
                              }}
                              aria-label={`${isAr ? "صفحة" : "Page"} ${i + 1}`}
                            >
                              {isAr ? toAI(i + 1) : i + 1}
                            </button>
                          ))}
                        </div>
                        {/* Next Surah button — only on last page */}
                        {isLastPage && nextSurahMeta && (
                          <button
                            onClick={() => { setPagePickerOpen(false); saveProgress(nextSurahMeta.number, 1); void openSurah(nextSurahMeta); }}
                            className="w-full py-3 rounded-2xl text-sm font-semibold active:scale-95 transition-all flex items-center justify-center gap-2"
                            style={{
                              background: isDark ? "hsla(45,65%,50%,0.12)" : "hsla(35,55%,42%,0.10)",
                              border: `1px solid ${gold}`,
                              color: gold,
                              boxShadow: isDark ? `0 0 20px hsla(45,65%,50%,0.15)` : "none",
                            }}
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>{isAr ? `التالي: ${nextSurahMeta.name}` : `Next: ${nextSurahMeta.englishName}`}</span>
                            <ChevronDown className="w-4 h-4" style={{ transform: isAr ? "rotate(90deg)" : "rotate(-90deg)" }} />
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          );
        })() : (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
          </div>
        )}

        {showExplanation && selectedAyah && (() => {
          const popupGold = isDark ? "#c9a84c" : "#8a6a1a";
          const popupBorder = isDark ? "hsla(45,65%,55%,0.35)" : "hsla(35,65%,42%,0.28)";
          const popupBg = isDark ? "linear-gradient(180deg, hsl(232 22% 10%) 0%, hsl(228 20% 8%) 100%)" : "linear-gradient(180deg, hsl(42 55% 98%) 0%, hsl(38 45% 96%) 100%)";
          const popupText = isDark ? "#e8dfc8" : "#1a120a";
          const popupSub = isDark ? "hsla(44,30%,70%,0.6)" : "hsla(30,30%,30%,0.55)";
          const popupTrans = activeTrans.find((t) => t.numberInSurah === selectedAyah.numberInSurah) ?? selectedAyahTrans;

          return (
            <div className="fixed inset-0 z-40 flex items-center justify-center px-4" onClick={() => setShowExplanation(false)}>
              <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(4px)" }} />
              <div
                className="relative w-full max-w-md rounded-3xl px-5 py-5"
                style={{ background: popupBg, border: `1px solid ${popupBorder}`, boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: popupGold }}>
                      {isAr ? activeSurah?.name : activeSurah?.englishName}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: popupSub }}>
                      {isAr ? `آية ${selectedAyah.numberInSurah}` : `Verse ${selectedAyah.numberInSurah}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowExplanation(false)}
                    title={isAr ? "إغلاق" : "Close"}
                    aria-label={isAr ? "إغلاق" : "Close"}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all"
                    style={{ border: `1px solid ${popupBorder}`, color: popupGold, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-4">
                  {isAr ? (
                    <p className="text-[18px] leading-[1.95] text-right" dir="rtl" style={{ fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', 'Amiri', serif", color: popupText, overflow: "hidden", overflowWrap: "break-word" }}>
                      {stripBismillahPrefix(selectedAyah, activeSurah?.number)}
                    </p>
                  ) : (
                    <>
                      {showArabicText && (
                        <p className="text-[18px] leading-[1.95] text-right mb-2" dir="rtl" style={{ fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', 'Amiri', serif", color: popupText, overflow: "hidden", overflowWrap: "break-word" }}>
                          {stripBismillahPrefix(selectedAyah, activeSurah?.number)}
                        </p>
                      )}
                      {popupTrans && (
                        <p className="text-[16px] leading-[1.75]" style={{ color: popupText }}>
                          <span
                            className="inline-flex items-center justify-center rounded-md mr-2 align-middle"
                            style={{
                              minWidth: 24,
                              height: 20,
                              fontSize: "10px",
                              fontWeight: 700,
                              lineHeight: 1,
                              color: sheetGold,
                              background: sheetGoldFaint,
                              border: `1px solid ${sheetGoldGlow}`,
                              padding: "0 6px",
                            }}
                          >
                            {selectedAyah.numberInSurah}
                          </span>
                          {popupTrans.text}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-2xl px-4 py-4" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)", border: `1px solid ${popupBorder}` }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: popupGold }}>
                    {isAr ? "المعنى" : "Meaning"}
                  </p>
                  {explLoading ? (
                    <p className="text-sm" style={{ color: popupSub }}>{isAr ? "يتم تجهيز المعنى..." : "Loading meaning..."}</p>
                  ) : (
                    <p className="text-[14px] leading-[1.8] whitespace-pre-wrap" style={{ color: popupText }}>
                      {cleanExplanation(explanation || (isAr ? "التفسير غير متاح لهذه الآية." : "Tafsir not available for this verse."))}
                    </p>
                  )}
                  <p className="text-[11px] mt-3" style={{ color: popupSub }}>
                    {isAr ? "المصدر: تفسير ابن كثير" : "Source: tafsir-ibn-kathir"}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {showActionSheet && selectedAyah && (() => {
          const sheetGold = isDark ? "#e5c07b" : "#a67c2e";
          const sheetGoldGlow = isDark ? "rgba(229,192,123,0.32)" : "rgba(166,124,46,0.28)";
          const sheetGoldFaint = isDark ? "hsla(45,65%,50%,0.12)" : "hsla(35,55%,42%,0.10)";
          const sheetBg = isDark
            ? "linear-gradient(180deg, hsl(232 22% 9%) 0%, hsl(228 20% 7%) 100%)"
            : "linear-gradient(180deg, hsl(42 55% 97%) 0%, hsl(38 45% 95%) 100%)";
          const sheetTxt = isDark ? "#e8dfc8" : "#1a120a";
          const sheetSub = isDark ? "hsla(44,30%,70%,0.55)" : "hsla(30,30%,30%,0.5)";
          const selectedTrans = activeTrans.find((t) => t.numberInSurah === selectedAyah.numberInSurah);

          return (
            <div
              className="fixed inset-0 z-40 flex items-end"
              onClick={() => setShowActionSheet(false)}
            >
              <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }} />
              <div
                className="relative w-full z-50 overflow-hidden"
                style={{
                  borderRadius: "28px 28px 0 0",
                  background: sheetBg,
                  boxShadow: `0 -1px 0 ${sheetGoldGlow}, 0 -3px 0 ${sheetGoldFaint}, 0 -32px 80px rgba(0,0,0,0.5)`,
                  maxHeight: "88vh",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${sheetGoldGlow}, transparent)` }} />

                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-9 h-[3px] rounded-full" style={{ background: sheetGoldGlow }} />
                </div>

                <div className="flex items-center justify-between px-5 pt-2 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold tracking-wide" style={{ color: sheetGold }}>
                      {isAr ? activeSurah?.name : activeSurah?.englishName}
                    </span>
                    <span style={{ color: sheetGoldGlow, fontSize: 10 }}>·</span>
                    <span className="text-[11px]" style={{ color: sheetSub }}>
                      {isAr ? `آية ${selectedAyah.numberInSurah}` : `Verse ${selectedAyah.numberInSurah}`}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowActionSheet(false)}
                    title={isAr ? "إغلاق" : "Close"}
                    aria-label={isAr ? "إغلاق" : "Close"}
                    className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all"
                    style={{ background: sheetGoldFaint, border: `1px solid ${sheetGoldGlow}` }}
                  >
                    <X className="w-3.5 h-3.5" style={{ color: sheetGold }} />
                  </button>
                </div>

                <div className="mx-5 h-px mb-4" style={{ background: `linear-gradient(90deg, transparent, ${sheetGoldGlow}, transparent)` }} />

                <div className="px-5 mb-5">
                  {isAr ? (
                    <p
                      className="text-[20px] leading-[2] text-right"
                      dir="rtl"
                      style={{ fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', 'Amiri', serif", color: sheetTxt, overflow: "hidden", overflowWrap: "break-word" }}
                    >
                      {stripBismillahPrefix(selectedAyah, activeSurah?.number)}
                    </p>
                  ) : (
                    <>
                      {showArabicText && (
                        <p
                          className="text-[20px] leading-[2] text-right mb-2"
                          dir="rtl"
                          style={{ fontFamily: "'Uthmanic Hafs', 'Noto Sans Arabic', 'Amiri', serif", color: sheetTxt, overflow: "hidden", overflowWrap: "break-word" }}
                        >
                          {stripBismillahPrefix(selectedAyah, activeSurah?.number)}
                        </p>
                      )}
                      {selectedTrans ? (
                        <p
                          className="text-[19px] leading-[1.75] font-medium"
                          style={{ color: sheetTxt }}
                        >
                          <span
                            className="inline-flex items-center justify-center rounded-md mr-2 align-middle"
                            style={{
                              minWidth: 24,
                              height: 20,
                              fontSize: "10px",
                              fontWeight: 700,
                              lineHeight: 1,
                              color: sheetGold,
                              background: sheetGoldFaint,
                              border: `1px solid ${sheetGoldGlow}`,
                              padding: "0 6px",
                            }}
                          >
                            {selectedAyah.numberInSurah}
                          </span>
                          {selectedTrans.text}
                        </p>
                      ) : (
                        <p
                          className="text-[17px] leading-[1.75]"
                          style={{ color: sheetSub }}
                        >
                          {activeSurah?.englishName} · Verse {selectedAyah.numberInSurah}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="px-5 pb-4">
                  <p className="text-xs font-semibold mb-2" style={{ color: sheetGold }}>
                    {isAr ? "المعنى" : "Meaning"}
                  </p>
                  {explLoading ? (
                    <div className="rounded-2xl px-4 py-3" style={{ background: sheetGoldFaint, border: `1px solid ${sheetGoldGlow}` }}>
                      <p className="text-xs" style={{ color: sheetSub }}>{isAr ? "يتم تجهيز المعنى..." : "Loading meaning..."}</p>
                    </div>
                  ) : explanation ? (
                    <div
                      className="rounded-2xl px-4 py-4"
                      style={{
                        background: sheetGoldFaint,
                        border: `1px solid ${sheetGoldGlow}`,
                        maxHeight: "220px",
                        overflowY: "auto",
                      }}
                    >
                      <p
                        className="text-[14px] leading-[1.85] whitespace-pre-wrap"
                        style={{ color: isDark ? "#ddd5bc" : "#2a1e0a" }}
                      >
                        {cleanExplanation(explanation)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl px-4 py-3" style={{ background: sheetGoldFaint, border: `1px solid ${sheetGoldGlow}` }}>
                      <p className="text-xs" style={{ color: sheetSub }}>{isAr ? "المعنى غير متاح حالياً" : "Meaning unavailable right now"}</p>
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center px-5 pb-8 pt-2"
                  style={{ borderTop: `1px solid ${sheetGoldFaint}` }}
                >
                  <button
                    onClick={async () => {
                      const started = await playAyahAudio(selectedAyah);
                      if (started) setShowActionSheet(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl active:scale-95 transition-all font-semibold text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${sheetGoldGlow} 0%, hsla(45,70%,50%,0.25) 100%)`,
                      border: `1px solid ${sheetGoldGlow}`,
                      color: sheetGold,
                    }}
                  >
                    <Play className="w-4 h-4" />
                    {isAr ? "استمع" : "Play"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        <AlertDialog open={!!pendingBookmarkAyah} onOpenChange={(open) => { if (!open) setPendingBookmarkAyah(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isAr ? "حفظ الموضع الجديد؟" : "Save new bookmark?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isAr
                  ? `هل تريد حفظ الآية ${pendingBookmarkAyah?.numberInSurah ?? ""} كموضعك الجديد في هذه السورة؟`
                  : `Save ayah ${pendingBookmarkAyah?.numberInSurah ?? ""} as your new bookmark in this surah?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingBookmarkAyah(null)}>
                {isAr ? "ليس الآن" : "Not now"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingBookmarkAyah) void setPrimaryBookmarkAyah(pendingBookmarkAyah);
                  setPendingBookmarkAyah(null);
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isAr ? "نعم، احفظها" : "Yes, save it"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      )}

    </div>
  );
}

function ActionBtn({ icon: Icon, label, glow, onClick }: { icon: React.ElementType; label: string; glow: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 active:scale-95 transition-all duration-150 w-full justify-center"
      style={{ background: glow.replace("0.3", "0.08"), border: `1px solid ${glow}` }}
    >
      <Icon className="w-4 h-4 text-[#f2f2f2]" />
      <span className="text-xs font-semibold text-[#f2f2f2]">{label}</span>
    </button>
  );
}
