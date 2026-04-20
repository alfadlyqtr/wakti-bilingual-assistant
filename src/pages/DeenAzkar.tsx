import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, RotateCcw, RefreshCw, Check, BookOpen, Info, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

// ── Data source: fitrahive/dua-dhikr (MIT licence) ────────────────────────────
const BASE_RAW = "https://cdn.jsdelivr.net/gh/fitrahive/dua-dhikr@main/data";

interface DhikrItem {
  title: string;
  arabic: string;
  latin: string;
  translation: string;
  notes: string;
  fawaid: string;
  source: string;
}

interface Category {
  slug: string;
  nameEn: string;
  nameAr: string;
  emoji: string;
}

const CATEGORIES: Category[] = [
  { slug: "morning-dhikr",    nameEn: "Morning Dhikr",    nameAr: "أذكار الصباح",      emoji: "☀️" },
  { slug: "evening-dhikr",    nameEn: "Evening Dhikr",    nameAr: "أذكار المساء",      emoji: "🌙" },
  { slug: "daily-dua",        nameEn: "Daily Du'a",       nameAr: "الأدعية اليومية",   emoji: "🤲" },
  { slug: "selected-dua",     nameEn: "Selected Du'a",    nameAr: "أدعية مختارة",      emoji: "⭐" },
  { slug: "dhikr-after-salah",nameEn: "Dhikr After Salah",nameAr: "أذكار بعد الصلاة", emoji: "🤲" },
];

const CATEGORY_AUDIO: Record<string, string> = {
  "morning-dhikr": "/WAKTI AZKAR MORING.mp3",
  "evening-dhikr": "/WAKTI AZKAR NIGHT.mp3",
};

const AUDIO_END_AT = 20 * 60 + 50;

export default function DeenAzkar() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const isDark = theme === "dark";

  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [items, setItems] = useState<DhikrItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [errorItems, setErrorItems] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const cacheRef = useRef<Record<string, DhikrItem[]>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Colours
  const bg = isDark ? "#0c0f14" : "#fcfefd";
  const textPrimary = isDark ? "#f2f2f2" : "#060541";
  const textSecondary = isDark ? "#858384" : "#606062";
  const textMuted = isDark ? "#606062" : "#858384";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.09)";
  const green = isDark ? "hsl(142,76%,55%)" : "hsl(142,76%,38%)";
  const greenFaint = isDark ? "hsla(142,76%,55%,0.12)" : "hsla(142,76%,38%,0.10)";
  const greenGlow = isDark ? "hsla(142,76%,55%,0.30)" : "hsla(142,76%,38%,0.20)";
  const blue = isDark ? "hsl(210,100%,65%)" : "hsl(210,100%,40%)";
  const blueFaint = isDark ? "hsla(210,100%,65%,0.15)" : "hsla(210,100%,40%,0.10)";
  const blueGlow = isDark ? "hsla(210,100%,65%,0.30)" : "hsla(210,100%,40%,0.20)";
  const bottomSafe = "calc(env(safe-area-inset-bottom) + 80px)";

  const counterKey = (slug: string, idx: number) => `${slug}-${idx}`;

  const getTargetCount = (notes?: string) => {
    const match = notes?.match(/(\d+)/);
    return match ? Math.max(1, Number(match[1])) : 1;
  };

  const formatTargetLabel = (target: number) => {
    if (isAr) {
      if (target === 1) return "مرة واحدة";
      if (target === 2) return "مرتان";
      return `${target} مرات`;
    }
    return target === 1 ? "1x" : `${target}x`;
  };

  const formatAudioTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const audioSrc = selectedCat ? CATEGORY_AUDIO[selectedCat.slug] : undefined;

  const toggleAudioPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setIsPlayingAudio(false);
    }
  }, []);

  const seekAudioBy = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxTime = Math.min(audio.duration || AUDIO_END_AT, AUDIO_END_AT);
    const nextTime = Math.min(Math.max(audio.currentTime + delta, 0), maxTime);
    audio.currentTime = nextTime;
    setAudioCurrentTime(nextTime);
  }, []);

  const handleAudioSeek = useCallback((nextValue: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clampedValue = Math.min(nextValue, Math.min(audio.duration || AUDIO_END_AT, AUDIO_END_AT));
    audio.currentTime = clampedValue;
    setAudioCurrentTime(clampedValue);
  }, []);

  const syncAudioDuration = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioDuration(Math.min(audio.duration || 0, AUDIO_END_AT));
    setAudioCurrentTime(Math.min(audio.currentTime || 0, AUDIO_END_AT));
    setIsPlayingAudio(!audio.paused && !audio.ended);
  }, []);

  const syncAudioTime = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const cappedTime = Math.min(audio.currentTime || 0, AUDIO_END_AT);
    if ((audio.currentTime || 0) >= AUDIO_END_AT) {
      audio.currentTime = AUDIO_END_AT;
      audio.pause();
      setIsPlayingAudio(false);
    }
    setAudioCurrentTime(cappedTime);
  }, []);

  const handleAudioPlay = useCallback(() => {
    setIsPlayingAudio(true);
  }, []);

  const handleAudioPause = useCallback(() => {
    const audio = audioRef.current;
    setIsPlayingAudio(Boolean(audio && !audio.paused && !audio.ended));
  }, []);

  const handleAudioEnded = useCallback(() => {
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
  }, [audioSrc]);

  useEffect(() => {
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
  }, [audioSrc]);

  const loadCategory = useCallback(async (cat: Category) => {
    if (cacheRef.current[cat.slug]) {
      setItems(cacheRef.current[cat.slug]);
      return;
    }
    setLoadingItems(true);
    setErrorItems(false);
    try {
      const lang = "en";
      const res = await fetch(`${BASE_RAW}/dua-dhikr/${cat.slug}/${lang}.json`);
      if (!res.ok) throw new Error("fetch failed");
      const data: DhikrItem[] = await res.json();
      cacheRef.current[cat.slug] = data;
      setItems(data);
    } catch {
      setErrorItems(true);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCat) {
      setItems([]);
      setExpandedIndex(null);
      loadCategory(selectedCat);
    }
  }, [selectedCat, loadCategory]);

  const tap = (slug: string, idx: number) => {
    const key = counterKey(slug, idx);
    setCounts((prev) => {
      const item = items[idx];
      const target = getTargetCount(item?.notes);
      const current = prev[key] ?? 0;
      const next = Math.min(current + 1, target);
      setCompleted((c) => {
        const s = new Set(c);
        if (next >= target) {
          s.add(key);
        } else {
          s.delete(key);
        }
        return s;
      });
      return { ...prev, [key]: next };
    });
  };

  const resetItem = (slug: string, idx: number) => {
    const key = counterKey(slug, idx);
    setCounts((prev) => ({ ...prev, [key]: 0 }));
    setCompleted((c) => { const s = new Set(c); s.delete(key); return s; });
  };

  const resetAll = (cat: Category) => {
    const updates: Record<string, number> = {};
    items.forEach((_, idx) => { updates[counterKey(cat.slug, idx)] = 0; });
    setCounts((prev) => ({ ...prev, ...updates }));
    setCompleted((c) => {
      const s = new Set(c);
      items.forEach((_, idx) => s.delete(counterKey(cat.slug, idx)));
      return s;
    });
  };

  const catDoneCount = (cat: Category) =>
    (cacheRef.current[cat.slug] ?? []).filter((_, idx) => completed.has(counterKey(cat.slug, idx))).length;

  const allDone = (cat: Category) => {
    const cached = cacheRef.current[cat.slug];
    return cached && cached.length > 0 && cached.every((_, idx) => completed.has(counterKey(cat.slug, idx)));
  };

  // ── Detail view ───────────────────────────────────────────────────
  if (selectedCat) {
    const cat = selectedCat;
    const done = allDone(cat);
    return (
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{ background: bg, paddingBottom: bottomSafe }}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={() => setSelectedCat(null)}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
            aria-label={isAr ? "رجوع" : "Back"}
          >
            <ArrowLeft className="w-4 h-4" style={{ color: textSecondary, transform: isAr ? "rotate(180deg)" : undefined }} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-[15px] font-bold" style={{ color: textPrimary }}>
              {isAr ? cat.nameAr : cat.nameEn}
            </p>
          </div>
          <button
            onClick={() => resetAll(cat)}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
            aria-label={isAr ? "إعادة تعيين الكل" : "Reset all"}
            title={isAr ? "إعادة تعيين الكل" : "Reset all"}
          >
            <RotateCcw className="w-4 h-4" style={{ color: textSecondary }} />
          </button>
        </div>

        {/* All done banner */}
        {done && (
          <div className="mx-4 mb-3 rounded-2xl px-4 py-3 flex items-center gap-2 shrink-0"
            style={{ background: greenFaint, border: `1px solid ${greenGlow}` }}>
            <Check className="w-4 h-4" style={{ color: green }} />
            <span className="text-sm font-semibold" style={{ color: green }}>
              {isAr ? "أحسنت! اكتملت جميع الأذكار 🌟" : "All adhkar completed! 🌟"}
            </span>
          </div>
        )}

        {/* Body */}
        {loadingItems ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            <p className="text-sm" style={{ color: textSecondary }}>{isAr ? "جارٍ التحميل…" : "Loading…"}</p>
          </div>
        ) : errorItems ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-4xl">😔</p>
            <p className="text-sm" style={{ color: textSecondary }}>
              {isAr ? "تعذّر التحميل. تحقّق من اتصالك." : "Failed to load. Check your connection."}
            </p>
            <button
              onClick={() => loadCategory(cat)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-all"
              style={{ background: greenFaint, border: `1px solid ${greenGlow}`, color: green }}
            >
              {isAr ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {audioSrc && (
              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <audio
                  key={audioSrc}
                  ref={audioRef}
                  src={audioSrc}
                  preload="metadata"
                  onLoadedMetadata={syncAudioDuration}
                  onDurationChange={syncAudioDuration}
                  onTimeUpdate={syncAudioTime}
                  onPlay={handleAudioPlay}
                  onPause={handleAudioPause}
                  onEnded={handleAudioEnded}
                />

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: textPrimary }}>
                      {isAr ? "الاستماع الكامل" : "Full audio"}
                    </p>
                  </div>
                  <span className="text-[11px] tabular-nums shrink-0" style={{ color: textMuted }}>
                    {`${formatAudioTime(audioCurrentTime)} / ${formatAudioTime(audioDuration || AUDIO_END_AT)}`}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={audioDuration || AUDIO_END_AT}
                  step={1}
                  value={Math.min(audioCurrentTime, audioDuration || AUDIO_END_AT)}
                  onChange={(e) => handleAudioSeek(Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer accent-blue-500"
                  aria-label={isAr ? "شريط التقدّم الصوتي" : "Audio progress slider"}
                />

                <div className="flex items-center justify-center gap-2" dir="ltr">
                    <button
                      onClick={() => seekAudioBy(-10)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                      style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(6,5,65,0.05)", border: `1px solid ${cardBorder}` }}
                      aria-label={isAr ? "ترجيع 10 ثوانٍ" : "Rewind 10 seconds"}
                      title={isAr ? "ترجيع 10 ثوانٍ" : "Rewind 10 seconds"}
                    >
                      <SkipBack className="w-4 h-4" style={{ color: textSecondary }} />
                    </button>

                    <button
                      onClick={toggleAudioPlayback}
                      className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                      style={{ background: blueFaint, border: `1px solid ${blueGlow}` }}
                      aria-label={isPlayingAudio ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "تشغيل" : "Play")}
                      title={isPlayingAudio ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "تشغيل" : "Play")}
                    >
                      {isPlayingAudio
                        ? <Pause className="w-4 h-4" style={{ color: blue }} />
                        : <Play className="w-4 h-4 ml-0.5" style={{ color: blue }} />}
                    </button>

                    <button
                      onClick={() => seekAudioBy(10)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                      style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(6,5,65,0.05)", border: `1px solid ${cardBorder}` }}
                      aria-label={isAr ? "تقديم 10 ثوانٍ" : "Forward 10 seconds"}
                      title={isAr ? "تقديم 10 ثوانٍ" : "Forward 10 seconds"}
                    >
                      <SkipForward className="w-4 h-4" style={{ color: textSecondary }} />
                    </button>
                </div>
              </div>
            )}

            {items.map((item, idx) => {
              const key = counterKey(cat.slug, idx);
              const target = getTargetCount(item.notes);
              const current = counts[key] ?? 0;
              const isDone = completed.has(key) || current >= target;
              const isExpanded = expandedIndex === idx;

              return (
                <div
                  key={idx}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: isDone ? (isDark ? "hsla(142,76%,55%,0.07)" : "hsla(142,76%,38%,0.06)") : cardBg,
                    border: `1px solid ${isDone ? greenGlow : cardBorder}`,
                    transition: "all 0.3s",
                  }}
                >
                  {/* Title row */}
                  <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {isAr && (
                        <p className="text-[12px] font-semibold mb-0.5" style={{ color: textMuted }}>
                          {formatTargetLabel(target)}
                        </p>
                      )}
                      {!isAr && (
                        <>
                          <p className="text-[13px] font-bold mb-0.5" style={{ color: isDone ? green : blue }}>
                            {item.title}
                          </p>
                          <p className="text-[11px]" style={{ color: textMuted }}>{formatTargetLabel(target)}</p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDone && <Check className="w-3.5 h-3.5" style={{ color: green }} />}
                      {!isAr && (
                        <button
                          onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-all"
                          style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(6,5,65,0.06)" }}
                          aria-label={isAr ? "تفاصيل" : "Details"}
                        >
                          <Info className="w-3.5 h-3.5" style={{ color: textMuted }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Arabic text — Arabic mode only */}
                  {isAr && (
                    <div className="px-4 pb-3">
                      <p
                        className="text-[18px] leading-[2.2] text-right"
                        dir="rtl"
                        style={{
                          fontFamily: "'Noto Sans Arabic', 'Amiri', serif",
                          color: isDone ? (isDark ? "hsla(142,76%,75%,0.65)" : "hsla(142,76%,30%,0.55)") : textPrimary,
                          transition: "color 0.3s",
                        }}
                      >
                        {item.arabic}
                      </p>
                    </div>
                  )}

                  {/* English translation — English mode only */}
                  {!isAr && item.translation && (
                    <div className="px-4 pb-3">
                      <p className="text-[14px] leading-relaxed" style={{ color: textPrimary }}>
                        {item.translation}
                      </p>
                    </div>
                  )}

                  {/* Expanded: transliteration + fawaid + source */}
                  {!isAr && isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: cardBorder }}>
                      {/* Transliteration */}
                      {item.latin && (
                        <div className="pt-3">
                          <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: textMuted }}>
                            {isAr ? "النطق" : "Transliteration"}
                          </p>
                          <p className="text-[13px] italic leading-relaxed" style={{ color: textSecondary }}>
                            {item.latin}
                          </p>
                        </div>
                      )}

                      {/* Benefits */}
                      {item.fawaid && (
                        <div className="rounded-xl p-3" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(6,5,65,0.03)" }}>
                          <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: textMuted }}>
                            {isAr ? "الفضل" : "Virtue"}
                          </p>
                          <p className="text-[12px] leading-relaxed" style={{ color: textSecondary }}>
                            {item.fawaid}
                          </p>
                        </div>
                      )}

                      {/* Source */}
                      {item.source && (
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-3 h-3 shrink-0" style={{ color: textMuted }} />
                          <p className="text-[11px]" style={{ color: textMuted }}>{item.source}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Counter row */}
                  <div className="px-4 pb-4 flex items-center justify-between gap-3">
                    <button
                      onClick={() => resetItem(cat.slug, idx)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all"
                      style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(6,5,65,0.05)" }}
                      aria-label={isAr ? "إعادة" : "Reset"}
                      title={isAr ? "إعادة" : "Reset"}
                    >
                      <RefreshCw className="w-3.5 h-3.5" style={{ color: textSecondary }} />
                    </button>

                    {/* Count display */}
                    <div
                      className="flex-1 text-center py-1 rounded-xl"
                      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(6,5,65,0.03)" }}
                    >
                      <span className="text-2xl font-bold" style={{ color: isDone ? green : textPrimary }}>
                        {current}
                      </span>
                      <span className="text-xs mx-1" style={{ color: textMuted }}>
                        /
                      </span>
                      <span className="text-base font-semibold" style={{ color: textMuted }}>
                        {target}
                      </span>
                    </div>

                    <button
                      onClick={() => tap(cat.slug, idx)}
                      disabled={isDone}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
                      style={{
                        background: isDone ? greenFaint : blueFaint,
                        border: `1px solid ${isDone ? greenGlow : blueGlow}`,
                        color: isDone ? green : blue,
                      }}
                    >
                      {isAr ? "تسبيح" : "Count"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Category list ─────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: bg, paddingBottom: bottomSafe }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0 flex items-center gap-3">
        <button
          onClick={() => navigate("/deen")}
          className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
          aria-label={isAr ? "رجوع" : "Back"}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: textSecondary, transform: isAr ? "rotate(180deg)" : undefined }} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: textPrimary }}>
            {isAr ? "الأذكار والأدعية" : "Adhkar & Du'a"}
          </h1>
          <p className="text-[11px]" style={{ color: textSecondary }}>
            {isAr ? "من السنة النبوية" : "From the authentic Sunnah"}
          </p>
        </div>
      </div>

      {/* Category cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {CATEGORIES.map((cat) => {
          const done = allDone(cat);
          const cached = cacheRef.current[cat.slug];
          const total = cached?.length ?? null;
          const doneCount = catDoneCount(cat);

          return (
            <button
              key={cat.slug}
              onClick={() => setSelectedCat(cat)}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:scale-[0.99] transition-all"
              style={{
                background: done ? (isDark ? "hsla(142,76%,55%,0.08)" : "hsla(142,76%,38%,0.07)") : cardBg,
                border: `1px solid ${done ? greenGlow : cardBorder}`,
                boxShadow: isDark ? "none" : "0 2px 8px rgba(6,5,65,0.05)",
              }}
            >
              {/* Emoji bubble */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-xl"
                style={{
                  background: done
                    ? greenFaint
                    : (isDark ? "rgba(255,255,255,0.06)" : "rgba(6,5,65,0.06)"),
                  border: `1px solid ${done ? greenGlow : "transparent"}`,
                }}
              >
                {cat.emoji}
              </div>

              {/* Text */}
              <div className={`flex-1 min-w-0 ${isAr ? "text-right" : "text-left"}`} dir={isAr ? "rtl" : "ltr"}>
                <p className="text-[14px] font-bold truncate" style={{ color: done ? green : textPrimary }}>
                  {isAr ? cat.nameAr : cat.nameEn}
                </p>
                {total !== null && (
                  <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>
                    {doneCount > 0
                      ? `${doneCount}/${total} ${isAr ? "مكتمل" : "completed"}`
                      : `${total} ${isAr ? "ذكر" : "adhkar"}`}
                  </p>
                )}
              </div>

              {done
                ? <Check className="w-5 h-5 shrink-0" style={{ color: green }} />
                : <ChevronRight className="w-4 h-4 shrink-0 opacity-30" style={{ color: textSecondary, transform: isAr ? "rotate(180deg)" : undefined }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
