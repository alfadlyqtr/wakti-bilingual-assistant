import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Search, Play, Pause, Bookmark, BookmarkCheck, BookOpen, MessageCircle, RotateCcw, ChevronRight, ChevronDown, X, Volume2, Clock, Check, ListMusic, Settings2, ListVideo, SkipBack, SkipForward, RotateCw } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { bgAudio } from "@/utils/bgAudio";
import { emitEvent } from "@/utils/eventBus";

const EDITIONS = { arabic: "quran-uthmani", english: "en.sahih", tafsirEn: "en.ibn-kathir", tafsirAr: "ar.muyassar" };
const APP_DEFAULT_RECITER_ID = "maher_al_mueaqly";
const RECITER_STORAGE_KEY = "deen_selected_reciter_mp3q";
const QURAN_PROGRESS_STORAGE_KEY = "deen_quran_last_progress";
const QURAN_BOOKMARKS_STORAGE_KEY = "deen_quran_bookmarks";
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

function readStoredBookmarks(): StoredQuranBookmarks {
  try {
    const raw = localStorage.getItem(QURAN_BOOKMARKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredBookmarks(bookmarks: StoredQuranBookmarks) {
  try {
    localStorage.setItem(QURAN_BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {}
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
  const ayahItemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const readerPlayAllEnabledRef = useRef(false);
  const isSurahPlayingRef = useRef(false);
  const currentPlaybackAyahIndexRef = useRef(-1);
  useEffect(() => {
    try {
      localStorage.setItem(RECITER_STORAGE_KEY, selectedReciter);
    } catch {}
  }, [selectedReciter]);

  useEffect(() => {
    if (screen !== "reader" || currentPlaybackAyahIndex < 0) return;
    const activeAyahEl = ayahItemRefs.current[currentPlaybackAyahIndex];
    if (!activeAyahEl) return;
    const timer = window.setTimeout(() => {
      activeAyahEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [screen, currentPlaybackAyahIndex, readerPage]);

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
    });
  }, []);

  // Load existing bookmarks when entering a surah
  const loadBookmarks = useCallback(async (surahNumber: number) => {
    const storedBookmarks = readStoredBookmarks();
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
        });
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
      }
    } catch {
      toast.error(isAr ? "تعذر تحميل السورة" : "Failed to load surah");
    } finally {
      setLoadingReader(false);
    }
  };

  const currentSurahBookmarkedAyah = bookmarkedAyahs.size > 0
    ? Array.from(bookmarkedAyahs).sort((a, b) => a - b)[0]
    : null;
  const currentSurahSavedAyah = activeSurah && lastProgress?.surah_number === activeSurah.number ? lastProgress.ayah_number : null;
  const currentSurahJumpTargetAyah = currentSurahBookmarkedAyah ?? currentSurahSavedAyah;

  const jumpToSavedAyah = useCallback(() => {
    if (!activeSurah || !currentSurahJumpTargetAyah) return;
    const targetIndex = activeSurah.ayahs.findIndex((ayah) => ayah.numberInSurah === currentSurahJumpTargetAyah);
    if (targetIndex < 0) return;
    const targetPage = pageBreaks.findIndex((start, pageIndex) => {
      const end = pageBreaks[pageIndex + 1] ?? activeSurah.ayahs.length;
      return targetIndex >= start && targetIndex < end;
    });
    if (targetPage >= 0) setReaderPage(targetPage);
    setCurrentPlaybackAyahIndexSync(targetIndex);
    window.setTimeout(() => {
      ayahItemRefs.current[targetIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 220);
  }, [activeSurah, currentSurahJumpTargetAyah, pageBreaks]);

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
      // English mode → en.walk (Ibrahim Walk English recitation), Arabic → ar.alafasy
      const audioEdition = isAr ? "ar.alafasy" : "en.walk";
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

    // If called from listen-player fallback, pre-fetch all ayah URLs for the selected reciter
    // so we don't fall back to the hardcoded ar.alafasy edition
    let listenAudioQueue: string[] | null = null;
    if (listenReciterId) {
      try {
        listenAudioQueue = await getSurahAudioQueue(targetSurah, listenReciterId);
      } catch {
        listenAudioQueue = null;
      }
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
        if (listenAudioQueue) {
          // Listen-player path: use selected reciter's audio URLs
          audioUrl = listenAudioQueue[index] ?? "";
        } else {
          // Reader Play-All path: keep original per-ayah alquran.cloud endpoint
          const audioEdition = isAr ? "ar.alafasy" : "en.walk";
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

  const stripBismillahPrefix = (ayah: Ayah, surahNum?: number): string => {
    // For surahs other than Al-Fatiha (1) and At-Tawbah (9), the quran-uthmani API
    // always prepends the Bismillah (4 words) to the text of ayah 1.
    // Strip unconditionally based on surah number and ayah position.
    const num = surahNum ?? activeSurah?.number;
    if (num && num !== 1 && num !== 9 && ayah.numberInSurah === 1) {
      const words = ayah.text.split(/\s+/);
      if (words.length > 4) return words.slice(4).join(" ");
    }
    return ayah.text;
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

  const bookmarkAyah = async (ayah: Ayah, fromSheet = false) => {
    if (!activeSurah) return;
    const alreadyBookmarked = bookmarkedAyahs.has(ayah.numberInSurah);
    const storedBookmarks = readStoredBookmarks();
    const surahKey = String(activeSurah.number);
    const currentStored = Array.isArray(storedBookmarks[surahKey]) ? storedBookmarks[surahKey] : [];

    if (alreadyBookmarked) {
      setBookmarkedAyahs((prev) => { const s = new Set(prev); s.delete(ayah.numberInSurah); return s; });
      writeStoredBookmarks({
        ...storedBookmarks,
        [surahKey]: currentStored.filter((n) => n !== ayah.numberInSurah),
      });

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        if (!uid) throw new Error("no-user");
        await (supabase as any)
          .from("deen_quran_bookmarks")
          .delete()
          .eq("user_id", uid)
          .eq("surah_number", activeSurah.number)
          .eq("ayah_number", ayah.numberInSurah);
      } catch {}

      toast.success(isAr ? "تم إزالة الحفظ" : "Bookmark removed");
    } else {
      setBookmarkedAyahs((prev) => new Set(prev).add(ayah.numberInSurah));
      writeStoredBookmarks({
        ...storedBookmarks,
        [surahKey]: Array.from(new Set([...currentStored, ayah.numberInSurah])).sort((a, b) => a - b),
      });

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        if (!uid) throw new Error("no-user");
        await (supabase as any).from("deen_quran_bookmarks").upsert({
          user_id: uid,
          surah_number: activeSurah.number,
          ayah_number: ayah.numberInSurah,
        });
      } catch {}

      toast.success(isAr ? "تم الحفظ ✓" : "Bookmarked ✓");
    }
    if (fromSheet) setShowActionSheet(false);
  };

  const setPrimaryBookmarkAyah = async (ayah: Ayah) => {
    if (!activeSurah) return;
    const surahKey = String(activeSurah.number);
    const storedBookmarks = readStoredBookmarks();
    setBookmarkedAyahs(new Set([ayah.numberInSurah]));
    writeStoredBookmarks({
      ...storedBookmarks,
      [surahKey]: [ayah.numberInSurah],
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) throw new Error("no-user");
      await (supabase as any)
        .from("deen_quran_bookmarks")
        .delete()
        .eq("user_id", uid)
        .eq("surah_number", activeSurah.number);
      await (supabase as any).from("deen_quran_bookmarks").upsert({
        user_id: uid,
        surah_number: activeSurah.number,
        ayah_number: ayah.numberInSurah,
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
        <div className="sticky top-0 z-20 px-4 pt-4 pb-3" style={{ background: headerBg, backdropFilter: "blur(16px)", borderBottom: `1px solid ${cardBorder}` }}>
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
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 mb-4 active:scale-95 transition-all"
              style={{
                background: "linear-gradient(135deg, hsla(210,100%,65%,0.12) 0%, hsla(280,70%,65%,0.08) 100%)",
                border: "1px solid hsla(210,100%,65%,0.2)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "hsla(210,100%,65%,0.15)", border: "1px solid hsla(210,100%,65%,0.3)" }}
              >
                <Clock className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex-1 text-left" style={{ textAlign: isAr ? "right" : "left" }}>
                <p className="text-xs font-bold text-sky-400">
                  {isAr ? "متابعة القراءة" : "Continue Reading"}
                </p>
                <p className="text-[11px] text-[#858384]">
                  {isAr ? lastSurah.name : lastSurah.englishName} —{" "}
                  {isAr ? "آية" : "Ayah"} {lastProgress!.ayah_number}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-sky-400/60 flex-shrink-0" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
            </button>
          )}

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: cardShadow,
            }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: textSecondary }} />
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
                  onClick={() => (screen === "read-list" ? openSurah(s) : openListeningSurah(s))}
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
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>
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
                  <p className="text-lg font-bold" style={{ color: textPrimary, textAlign: isAr ? "right" : "left" }}>
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
        <div className="pt-2 pb-12 px-3" ref={readerTopRef}>
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

            // Helper: Arabic-Indic digits
            const toAI = (n: number) => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]);
            const renderAyahMarker = (n: number) => (
              <span className="relative inline-flex items-center justify-center" style={{ width: 46, height: 46 }}>
                <span
                  aria-hidden="true"
                  style={{
                    color: markerTxt,
                    fontFamily: "'Noto Sans Arabic', serif",
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
                    fontFamily: "'Noto Sans Arabic', serif",
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1,
                    paddingTop: 1,
                  }}
                >
                  {isAr ? toAI(n) : n}
                </span>
              </span>
            );
            const displayAyahNumber = (ayah: Ayah) => ayah.numberInSurah;

            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4" dir={isAr ? "rtl" : "ltr"}>
                  <button
                    onClick={handleBackNavigation}
                    className="rounded-xl flex items-center gap-2 px-3 py-2 active:scale-95 transition-all flex-shrink-0"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)",
                      border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(6,5,65,0.10)",
                      boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.22)" : "0 8px 20px rgba(6,5,65,0.06)",
                      backdropFilter: "blur(10px)",
                    }}
                    title={isAr ? "العودة إلى القرآن" : "Back to Quran"}
                  >
                    <ArrowLeft className="w-4 h-4" style={{ color: isDark ? "#f2f2f2" : "#060541", transform: isAr ? "rotate(180deg)" : undefined }} />
                    <span className="text-[12px] font-medium" style={{ color: isDark ? "#f2f2f2" : "#060541" }}>
                      {isAr ? "العودة إلى القرآن" : "Back to Quran"}
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
                  <button
                    onClick={jumpToSavedAyah}
                    disabled={!currentSurahJumpTargetAyah}
                    className="rounded-xl flex items-center gap-1.5 px-2.5 py-2 active:scale-95 transition-all flex-shrink-0 disabled:opacity-40 max-w-full"
                    style={{
                      background: isDark ? "hsla(45,65%,55%,0.10)" : "hsla(35,65%,42%,0.10)",
                      border: isDark ? "1px solid hsla(45,65%,55%,0.24)" : "1px solid hsla(35,65%,42%,0.22)",
                      boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.18)" : "0 8px 20px rgba(138,106,26,0.10)",
                      backdropFilter: "blur(10px)",
                    }}
                    title={isAr ? "اذهب إلى موضعك المحفوظ" : "Go to saved place"}
                  >
                    <RotateCcw className="w-4 h-4" style={{ color: gold }} />
                    <span className="text-[11px] font-medium truncate" style={{ color: gold }}>
                      {isAr ? (currentSurahJumpTargetAyah ? "اذهب إلى موضعك المحفوظ" : "لا يوجد موضع محفوظ") : (currentSurahJumpTargetAyah ? "Go to saved place" : "No saved place")}
                    </span>
                  </button>
                </div>

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
                          fontFamily: isAr ? "'Noto Sans Arabic', serif" : "inherit",
                          color: gold,
                          lineHeight: 1.5,
                          textAlign: "center",
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
                      fontFamily: isAr ? "'Noto Sans Arabic', serif" : "inherit",
                      fontSize: "19px", lineHeight: "2",
                      color: gold,
                      textShadow: isDark ? `0 0 18px ${goldFaint}` : "none",
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
                            className="w-full flex items-start gap-3 py-3 rounded-xl transition-all"
                            style={{ borderBottom: `1px solid ${goldFaint}`, background: isPlaying ? (isDark ? "hsla(45,65%,50%,0.10)" : "hsla(38,85%,85%,0.55)") : "transparent", boxShadow: isPlaying ? (isDark ? `0 0 18px hsla(45,65%,50%,0.22)` : `0 0 14px hsla(38,75%,60%,0.22)`) : "none" }}
                          >
                            <div className="w-12 flex flex-col items-center gap-1 pt-1 shrink-0">
                              <div
                                className="flex items-center justify-center"
                                style={{
                                  width: 40,
                                  height: 40,
                                }}
                              >
                                {renderAyahMarker(displayAyahNumber(ayah))}
                              </div>
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
                              <button
                                onClick={() => bookmarkAyah(ayah)}
                                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
                                style={{
                                  border: `1px solid ${goldGlow}`,
                                  background: isBookmarked ? goldFaint : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)"),
                                  color: gold,
                                  boxShadow: isBookmarked ? `0 0 14px ${goldGlow}` : (isDark ? `0 0 10px ${goldFaint}` : `0 2px 8px ${goldFaint}`),
                                }}
                                title={isAr ? "حفظ" : "Bookmark"}
                              >
                                {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                              </button>
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
                            <button
                              onClick={() => openAyahSheet(ayah, trans)}
                              className="flex-1 text-right active:scale-[0.99] transition-all duration-150"
                            >
                              <p style={{
                                fontFamily: "'Noto Sans Arabic', 'Amiri', serif",
                                fontSize: "21px", lineHeight: "2.2",
                                color: isPlaying ? gold : pageTxt,
                                textShadow: isPlaying && isDark ? `0 0 12px ${goldGlow}` : "none",
                                textDecoration: isBookmarked ? `underline ${goldGlow}` : "none",
                              }}>
                                {stripBismillahPrefix(ayah)}
                              </p>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── English mode: each ayah as its own line ── */
                    <div className="flex flex-col" dir="ltr">
                      {activeSurah.ayahs.slice(pageBreaks[readerPage], pageBreaks[readerPage + 1]).map((ayah, idx) => {
                        const globalIdx = pageBreaks[readerPage] + idx;
                        const trans = activeTrans[globalIdx];
                        if (!trans) return null;
                        const isPlaying = playing && currentPlaybackAyahIndex === globalIdx;
                        const isBookmarked = bookmarkedAyahs.has(ayah.numberInSurah);
                        return (
                          <div
                            key={ayah.numberInSurah}
                            ref={(el) => { ayahItemRefs.current[globalIdx] = el; }}
                            className="w-full flex items-start gap-3 py-3 rounded-xl transition-all"
                            style={{ borderBottom: `1px solid ${goldFaint}`, background: isPlaying ? (isDark ? "hsla(45,65%,50%,0.10)" : "hsla(38,85%,85%,0.55)") : "transparent", boxShadow: isPlaying ? (isDark ? `0 0 18px hsla(45,65%,50%,0.22)` : `0 0 14px hsla(38,75%,60%,0.22)`) : "none" }}
                          >
                            <div className="w-12 flex flex-col items-center gap-1 pt-1 shrink-0">
                              <div
                                className="flex items-center justify-center"
                                style={{
                                  width: 40,
                                  height: 40,
                                }}
                              >
                                {renderAyahMarker(displayAyahNumber(ayah))}
                              </div>
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
                              <button
                                onClick={() => bookmarkAyah(ayah)}
                                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
                                style={{
                                  border: `1px solid ${goldGlow}`,
                                  background: isBookmarked ? goldFaint : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)"),
                                  color: gold,
                                  boxShadow: isBookmarked ? `0 0 14px ${goldGlow}` : (isDark ? `0 0 10px ${goldFaint}` : `0 2px 8px ${goldFaint}`),
                                }}
                                title={isAr ? "حفظ" : "Bookmark"}
                              >
                                {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                              </button>
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
                            <button
                              onClick={() => openAyahSheet(ayah, trans ?? null)}
                              className="flex-1 text-left active:scale-[0.99] transition-all duration-150"
                            >
                              <p style={{
                                fontSize: "17px", lineHeight: "1.85",
                                color: isPlaying ? gold : pageTxt,
                                textShadow: isPlaying && isDark ? `0 0 10px ${goldFaint}` : "none",
                                textDecoration: isBookmarked ? `underline ${goldGlow}` : "none",
                              }}>
                                {trans.text}
                              </p>
                            </button>
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
                    return (
                      <div className="flex items-center justify-between mt-6 mb-2 gap-3">
                        <button
                          onClick={() => { setReaderPage(p => p - 1); setTimeout(() => readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                          disabled={readerPage === 0}
                          className="flex-1 py-3 rounded-2xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-30"
                          style={{ background: goldFaint, border: `1px solid ${goldGlow}`, color: gold }}
                        >
                          {isAr ? "→ السابق" : "← Prev"}
                        </button>
                        <div className="text-center">
                          <p className="text-xs font-semibold" style={{ color: gold }}>{from}–{to}</p>
                          <p className="text-[10px]" style={{ color: isDark ? "hsla(45,35%,50%,0.5)" : "hsla(35,30%,35%,0.45)" }}>
                            {isAr ? `صفحة ${readerPage + 1} من ${totalPages}` : `Page ${readerPage + 1} of ${totalPages}`}
                          </p>
                        </div>
                        <button
                          onClick={() => { setReaderPage(p => p + 1); setTimeout(() => readerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                          disabled={readerPage >= totalPages - 1}
                          className="flex-1 py-3 rounded-2xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-30"
                          style={{ background: goldFaint, border: `1px solid ${goldGlow}`, color: gold }}
                        >
                          {isAr ? "التالي ←" : "Next →"}
                        </button>
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
                    <p className="text-[18px] leading-[1.95] text-right" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', 'Amiri', serif", color: popupText }}>
                      {stripBismillahPrefix(selectedAyah, activeSurah?.number)}
                    </p>
                  ) : popupTrans ? (
                    <p className="text-[16px] leading-[1.75]" style={{ color: popupText }}>
                      {popupTrans.text}
                    </p>
                  ) : null}
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
                      style={{ fontFamily: "'Noto Sans Arabic', 'Amiri', serif", color: sheetTxt }}
                    >
                      {stripBismillahPrefix(selectedAyah, activeSurah?.number)}
                    </p>
                  ) : selectedTrans ? (
                    <p
                      className="text-[19px] leading-[1.75] font-medium"
                      style={{ color: sheetTxt }}
                    >
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
