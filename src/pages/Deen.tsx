import { useNavigate } from "react-router-dom";
import { BookOpen, MessageCircle, Brain, ChevronRight, Star, Calendar, Moon } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { useState, useEffect } from "react";
import { usePrayerTimes, formatCountdown } from "@/hooks/usePrayerTimes";

// Accurate Hijri date using browser Intl with islamic-civil calendar
function getHijriDate(date: Date, isAr: boolean): string {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-civil", {
      day: "numeric", month: "numeric", year: "numeric",
    }).formatToParts(date);
    const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? "0", 10);
    const year = get("year");
    const month = get("month") - 1; // 0-indexed
    const day = get("day");
    const monthsAr = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
    const monthsEn = ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
    if (isAr) return `${day} ${monthsAr[month] ?? ""} ${year}هـ`;
    return `${day} ${monthsEn[month] ?? ""} ${year} AH`;
  } catch {
    // Fallback: epoch anchor 1 Muharram 1447 = 27 Jun 2025
    const MS_PER_DAY = 86400000;
    const epoch = Date.UTC(2025, 5, 27); // 27 Jun 2025 = 1 Muharram 1447
    const days = Math.floor((date.getTime() - epoch) / MS_PER_DAY);
    // Tabular Islamic calendar: 30-year cycle, months alternate 30/29 days
    let remaining = days;
    let year = 1447;
    while (remaining >= 354) { remaining -= 354; year++; }
    while (remaining < 0) { remaining += 354; year--; }
    const monthLengths = [30,29,30,29,30,29,30,29,30,29,30,29];
    let month = 0;
    while (month < 12 && remaining >= monthLengths[month]) {
      remaining -= monthLengths[month]; month++;
    }
    const day = remaining + 1;
    const monthsAr = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
    const monthsEn = ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
    if (isAr) return `${day} ${monthsAr[month] ?? ""} ${year}هـ`;
    return `${day} ${monthsEn[month] ?? ""} ${year} AH`;
  }
}

const tabs = [
  { id: "quran", labelEn: "Quran", labelAr: "القرآن", path: "/deen/quran", gradient: "from-sky-500 to-blue-600", glow: "hsla(210,100%,65%,0.5)", icon: BookOpen, descEn: "Read & Listen", descAr: "اقرأ واستمع" },
  { id: "hadith", labelEn: "Hadith", labelAr: "الحديث", path: "/deen/hadith", gradient: "from-emerald-500 to-green-600", glow: "hsla(142,76%,55%,0.5)", icon: Star, descEn: "Browse & Learn", descAr: "تصفّح وتعلّم" },
  { id: "ask", labelEn: "Ask", labelAr: "اسأل", path: "/deen/ask", gradient: "from-purple-500 to-violet-600", glow: "hsla(280,70%,65%,0.5)", icon: MessageCircle, descEn: "Ask Anything", descAr: "اسأل عن أي شيء" },
  { id: "study", labelEn: "Study", labelAr: "حفظ", path: "/deen/study", gradient: "from-amber-500 to-orange-600", glow: "hsla(45,100%,60%,0.5)", icon: Brain, descEn: "Memorize", descAr: "احفظ وخطّط" },
];

export default function Deen() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const isDark = theme === "dark";
  const [hijriDate, setHijriDate] = useState("");
  const { nextPrayer } = usePrayerTimes();

  useEffect(() => {
    setHijriDate(getHijriDate(new Date(), isAr));
  }, [isAr]);

  // Calculate safe area for mobile (bottom nav is ~64px + padding)
  const bottomSafe = "calc(env(safe-area-inset-bottom) + 80px)";

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: isDark ? "#0c0f14" : "#fcfefd",
        paddingBottom: bottomSafe,
      }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Compact Header */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, hsl(210 100% 65%) 0%, hsl(280 70% 65%) 100%)",
              }}
            >
              <BookOpen className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <h1 className="text-lg font-bold" style={{ color: isDark ? "#f2f2f2" : "#060541" }}>
              {isAr ? "الدين" : "Deen"}
            </h1>
          </div>
          {isAr && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
              style={{
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(6,5,65,0.06)",
                color: isDark ? "#858384" : "#606062",
              }}
            >
              <Calendar className="w-3 h-3" />
              <span>{hijriDate}</span>
            </div>
          )}
        </div>

        {/* Next prayer row */}
        {nextPrayer && (
          <div className="mt-2 flex items-center">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(6,5,65,0.05)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.09)" : "rgba(6,5,65,0.09)"}`,
              }}
            >
              <Moon
                className="w-3 h-3 shrink-0"
                style={{ color: isDark ? "hsl(210,100%,65%)" : "hsl(243,84%,30%)" }}
              />
              <span
                className="text-[11px]"
                style={{ color: isDark ? "#858384" : "#606062" }}
              >
                {isAr ? "التالية" : "Next"}
              </span>
              <span
                className="text-[11px]"
                style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(6,5,65,0.2)" }}
              >
                ·
              </span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: isDark ? "#f2f2f2" : "#060541" }}
              >
                {isAr ? nextPrayer.nameAr : nextPrayer.name}
              </span>
              <span
                className="text-[11px]"
                style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(6,5,65,0.2)" }}
              >
                ·
              </span>
              <span
                className="text-[11px] font-medium"
                style={{ color: isDark ? "hsl(210,100%,65%)" : "hsl(243,84%,30%)" }}
              >
                {formatCountdown(nextPrayer.minutesLeft, isAr)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Cards Grid - fills remaining space */}
      <div className="px-5 flex-1 min-h-0">
        <div className="grid grid-cols-2 gap-3 h-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className="group relative overflow-hidden rounded-2xl p-4 text-left active:scale-[0.98] transition-all duration-200 flex flex-col justify-between"
                style={{
                  background: isDark
                    ? "linear-gradient(145deg, rgba(20,25,35,0.9) 0%, rgba(12,15,20,0.95) 100%)"
                    : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(6,5,65,0.08)"}`,
                  boxShadow: isDark
                    ? `0 4px 20px ${tab.glow.replace("0.5", "0.2")}, inset 0 1px 0 rgba(255,255,255,0.05)`
                    : `0 4px 20px ${tab.glow.replace("0.5", "0.15")}`,
                }}
              >
                {/* Gradient glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 30% 20%, ${tab.glow.replace("0.5", "0.25")}, transparent 70%)`,
                  }}
                />

                {/* Top section: Icon + Title */}
                <div>
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center mb-3`}
                    style={{ boxShadow: `0 4px 16px ${tab.glow}` }}
                  >
                    <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <p className="text-lg font-bold mb-1" style={{ color: isDark ? "#f2f2f2" : "#060541" }}>
                    {isAr ? tab.labelAr : tab.labelEn}
                  </p>
                  <p className="text-xs" style={{ color: isDark ? "#858384" : "#606062" }}>
                    {isAr ? tab.descAr : tab.descEn}
                  </p>
                </div>

                {/* Arrow at bottom */}
                <ChevronRight
                  className="self-end w-5 h-5 opacity-30 group-hover:opacity-60 transition-opacity"
                  style={{ color: isDark ? "#858384" : "#606062", transform: isAr ? "rotate(180deg)" : undefined }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="px-5 py-3 shrink-0">
        <div
          className="rounded-xl px-3 py-2.5 flex items-start gap-2"
          style={{
            background: isDark ? "rgba(245,158,11,0.2)" : "rgba(254,243,199,0.9)",
            border: `1px solid ${isDark ? "rgba(251,191,36,0.4)" : "rgba(217,119,6,0.4)"}`,
          }}
        >
          <span className="text-amber-400 text-base">⚠️</span>
          <p className="text-[11px] leading-relaxed font-medium" style={{ color: isDark ? "#fbbf24" : "#92400e" }}>
            {isAr
              ? "هذه الأداة للتعلم والفهم فقط. للفتاوى الشرعية، راجع الأوقاف أو عالم موثوق."
              : "This tool is for learning only. For religious rulings, consult your local Awqaf or scholar."}
          </p>
        </div>
      </div>
    </div>
  );
}

