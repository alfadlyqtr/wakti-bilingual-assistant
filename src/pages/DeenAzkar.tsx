import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, RotateCcw, RefreshCw, Check } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

const ADHKAR_JSON_URL =
  "https://cdn.jsdelivr.net/gh/rn0x/Adhkar-json@main/adhkar.json";

interface AdhkarItem {
  id: number;
  text: string;
  count: number;
  audio?: string;
  filename?: string;
}

interface AdhkarCategory {
  id: number;
  category: string;
  audio?: string;
  filename?: string;
  array: AdhkarItem[];
}

// Category emoji mapping
const CAT_EMOJI: Record<string, string> = {
  "أذكار الصباح والمساء": "🌅",
  "أذكار النوم": "🌙",
  "أذكار الاستيقاظ من النوم": "☀️",
  "دعاء دخول الخلاء": "🚿",
  "دعاء الخروج من الخلاء": "🚿",
  "الذكر قبل الوضوء": "💧",
  "الذكر بعد الفراغ من الوضوء": "💧",
  "الذكر عند الخروج من المنزل": "🚪",
  "الذكر عند دخول المنزل": "🏠",
  "دعاء الذهاب إلى المسجد": "🕌",
  "دعاء دخول المسجد": "🕌",
  "دعاء الخروج من المسجد": "🕌",
  "أذكار الآذان": "📣",
  "دعاء الاستفتاح": "🤲",
  "دعاء الركوع": "🤲",
  "دعاء السجود": "🤲",
  "التشهد": "🤲",
  "الأذكار بعد السلام من الصلاة": "🤲",
  "دعاء صلاة الاستخارة": "⭐",
  "دعاء الهم والحزن": "💙",
  "دعاء الكرب": "💙",
  "دعاء قضاء الدين": "💙",
  "الاستغفار و التوبة": "🕊️",
  "دعاء السفر": "✈️",
  "دعاء الركوب": "🚗",
  "دعاء الطعام": "🍽️",
  "دعاء العطاس": "😊",
  "الدعاء للمتزوج": "💍",
  "دعاء الريح": "🌬️",
  "دعاء الرعد": "⚡",
};

function getCategoryEmoji(name: string): string {
  for (const [key, emoji] of Object.entries(CAT_EMOJI)) {
    if (name.includes(key) || key.includes(name)) return emoji;
  }
  if (name.includes("صلاة") || name.includes("سجود") || name.includes("ركوع")) return "🤲";
  if (name.includes("دعاء")) return "🤲";
  if (name.includes("مسجد")) return "🕌";
  if (name.includes("سفر") || name.includes("ركوب")) return "✈️";
  if (name.includes("نوم") || name.includes("ليل")) return "🌙";
  if (name.includes("صباح") || name.includes("مساء")) return "🌅";
  return "📿";
}

export default function DeenAzkar() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const isDark = theme === "dark";

  const [categories, setCategories] = useState<AdhkarCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AdhkarCategory | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const cacheRef = useRef<AdhkarCategory[] | null>(null);

  const load = useCallback(async () => {
    if (cacheRef.current) {
      setCategories(cacheRef.current);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(ADHKAR_JSON_URL);
      if (!res.ok) throw new Error("fetch failed");
      const data: AdhkarCategory[] = await res.json();
      cacheRef.current = data;
      setCategories(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Colours
  const bg = isDark ? "#0c0f14" : "#fcfefd";
  const textPrimary = isDark ? "#f2f2f2" : "#060541";
  const textSecondary = isDark ? "#858384" : "#606062";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.09)";
  const green = isDark ? "hsl(142,76%,55%)" : "hsl(142,76%,38%)";
  const greenFaint = isDark ? "hsla(142,76%,55%,0.12)" : "hsla(142,76%,38%,0.10)";
  const greenGlow = isDark ? "hsla(142,76%,55%,0.30)" : "hsla(142,76%,38%,0.20)";

  const counterKey = (catId: number, itemId: number) => `${catId}-${itemId}`;

  const tap = (catId: number, item: AdhkarItem) => {
    const key = counterKey(catId, item.id);
    setCounts((prev) => {
      const current = prev[key] ?? 0;
      const next = current + 1;
      if (next >= item.count) {
        setCompleted((c) => new Set(c).add(key));
        return { ...prev, [key]: item.count };
      }
      return { ...prev, [key]: next };
    });
  };

  const reset = (catId: number, itemId: number) => {
    const key = counterKey(catId, itemId);
    setCounts((prev) => ({ ...prev, [key]: 0 }));
    setCompleted((c) => { const s = new Set(c); s.delete(key); return s; });
  };

  const resetAll = (cat: AdhkarCategory) => {
    const updates: Record<string, number> = {};
    cat.array.forEach((item) => { updates[counterKey(cat.id, item.id)] = 0; });
    setCounts((prev) => ({ ...prev, ...updates }));
    setCompleted((c) => {
      const s = new Set(c);
      cat.array.forEach((item) => s.delete(counterKey(cat.id, item.id)));
      return s;
    });
  };

  const allDone = (cat: AdhkarCategory) =>
    cat.array.every((item) => completed.has(counterKey(cat.id, item.id)));

  const bottomSafe = "calc(env(safe-area-inset-bottom) + 80px)";

  // ── Detail view ────────────────────────────────────────────────────
  if (selectedCategory) {
    const cat = selectedCategory;
    const done = allDone(cat);
    return (
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{ background: bg, paddingBottom: bottomSafe }}
        dir="rtl"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={() => setSelectedCategory(null)}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
            aria-label={isAr ? "رجوع" : "Back"}
          >
            <ArrowLeft className="w-4 h-4" style={{ color: textSecondary, transform: "rotate(180deg)" }} />
          </button>
          <h2 className="flex-1 text-center text-[15px] font-bold truncate" style={{ color: textPrimary }}>
            {cat.category}
          </h2>
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

        {/* Adhkar list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {cat.array.map((item) => {
            const key = counterKey(cat.id, item.id);
            const current = counts[key] ?? 0;
            const isDone = completed.has(key);
            const progress = Math.min(current / item.count, 1);

            return (
              <div
                key={item.id}
                className="rounded-2xl p-4"
                style={{
                  background: isDone
                    ? (isDark ? "hsla(142,76%,55%,0.08)" : "hsla(142,76%,38%,0.07)")
                    : cardBg,
                  border: `1px solid ${isDone ? greenGlow : cardBorder}`,
                  transition: "all 0.3s",
                }}
              >
                {/* Text */}
                <p
                  className="text-[17px] leading-[2.1] mb-4"
                  dir="rtl"
                  style={{
                    fontFamily: "'Noto Sans Arabic', 'Amiri', serif",
                    color: isDone ? (isDark ? "hsla(142,76%,75%,0.7)" : "hsla(142,76%,30%,0.6)") : textPrimary,
                    transition: "color 0.3s",
                  }}
                >
                  {item.text}
                </p>

                {/* Progress bar */}
                <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(6,5,65,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress * 100}%`, background: isDone ? green : "hsla(210,100%,65%,0.8)" }}
                  />
                </div>

                {/* Counter row */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => reset(cat.id, item.id)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all"
                    style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(6,5,65,0.05)" }}
                    aria-label={isAr ? "إعادة" : "Reset"}
                    title={isAr ? "إعادة" : "Reset"}
                  >
                    <RefreshCw className="w-3.5 h-3.5" style={{ color: textSecondary }} />
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: textSecondary }}>
                      {isAr ? `${current} / ${item.count}` : `${current}/${item.count}`}
                    </span>
                    {isDone && <Check className="w-3.5 h-3.5" style={{ color: green }} />}
                  </div>

                  <button
                    onClick={() => tap(cat.id, item)}
                    disabled={isDone}
                    className="px-5 py-2 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50"
                    style={{
                      background: isDone ? greenFaint : (isDark ? "hsla(210,100%,65%,0.15)" : "hsla(210,100%,45%,0.12)"),
                      border: `1px solid ${isDone ? greenGlow : (isDark ? "hsla(210,100%,65%,0.30)" : "hsla(210,100%,45%,0.25)")}`,
                      color: isDone ? green : (isDark ? "hsl(210,100%,70%)" : "hsl(210,100%,35%)"),
                    }}
                  >
                    {isDone ? (isAr ? "✓ تم" : "✓ Done") : (isAr ? "تسبيح" : "Count")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
            {isAr ? "من حصن المسلم" : "From Hisn Al-Muslim"}
          </p>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-7 h-7 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          <p className="text-sm" style={{ color: textSecondary }}>{isAr ? "جارٍ التحميل…" : "Loading…"}</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-4xl">😔</p>
          <p className="text-sm" style={{ color: textSecondary }}>
            {isAr ? "تعذّر تحميل الأذكار. تحقّق من اتصالك." : "Could not load adhkar. Check your connection."}
          </p>
          <button
            onClick={load}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-all"
            style={{ background: greenFaint, border: `1px solid ${greenGlow}`, color: green }}
          >
            {isAr ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {categories.map((cat) => {
            const done = allDone(cat);
            const totalItems = cat.array.length;
            const doneItems = cat.array.filter((item) => completed.has(counterKey(cat.id, item.id))).length;
            const emoji = getCategoryEmoji(cat.category);

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-right active:scale-[0.99] transition-all"
                style={{
                  background: done ? (isDark ? "hsla(142,76%,55%,0.08)" : "hsla(142,76%,38%,0.07)") : cardBg,
                  border: `1px solid ${done ? greenGlow : cardBorder}`,
                  boxShadow: isDark ? "none" : "0 2px 8px rgba(6,5,65,0.05)",
                }}
              >
                {/* Emoji */}
                <span className="text-xl shrink-0">{emoji}</span>

                {/* Text */}
                <div className="flex-1 min-w-0 text-right" dir="rtl">
                  <p className="text-[13px] font-semibold truncate" style={{ color: done ? green : textPrimary }}>
                    {cat.category}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
                    {doneItems > 0
                      ? `${doneItems} / ${totalItems} ${isAr ? "مكتمل" : "done"}`
                      : `${totalItems} ${isAr ? "ذكر" : "adhkar"}`}
                  </p>
                </div>

                {/* Right side */}
                {done
                  ? <Check className="w-4 h-4 shrink-0" style={{ color: green }} />
                  : <ChevronRight className="w-4 h-4 shrink-0 opacity-30" style={{ color: textSecondary, transform: isAr ? "rotate(180deg)" : undefined }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
