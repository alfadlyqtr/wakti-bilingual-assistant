import { useNavigate } from "react-router-dom";
import { ArrowLeft, CloudMoon, MapPin, Moon, Sun, SunDim, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { formatCountdown, formatPrayerTime, useDailyPrayerTimes, type DailyPrayer } from "@/hooks/usePrayerTimes";

export default function DeenPrayerTimes() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const isDark = theme === "dark";
  const { dailyPrayers, window, loading, now } = useDailyPrayerTimes();

  const bg = isDark ? "#0c0f14" : "#fcfefd";
  const textPrimary = isDark ? "#f2f2f2" : "#060541";
  const textSecondary = isDark ? "#858384" : "#606062";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.09)";
  const accent = isDark ? "hsl(210,100%,65%)" : "hsl(243,84%,30%)";
  const pillBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(6,5,65,0.12)";
  const nextPillBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.07)";
  const nextPillBorder = isDark ? "rgba(255,255,255,0.22)" : "rgba(6,5,65,0.22)";
  const bottomSafe = "calc(env(safe-area-inset-bottom) + 80px)";

  const prayerIcon: Record<DailyPrayer["key"], LucideIcon> = {
    fajr: Moon,
    sunrise: Sunrise,
    dhuhr: Sun,
    asr: SunDim,
    maghrib: Sunset,
    isha: CloudMoon,
  };

  const nextPrayer = window?.next ?? null;
  const NextPrayerIcon = nextPrayer ? prayerIcon[nextPrayer.key] : null;

  const minutesLeft = nextPrayer ? Math.max(0, Math.round((nextPrayer.time.getTime() - now.getTime()) / 60000)) : 0;
  const progress =
    window?.previous && nextPrayer
      ? Math.min(100, Math.max(0, ((now.getTime() - window.previous.time.getTime()) / (nextPrayer.time.getTime() - window.previous.time.getTime())) * 100))
      : 0;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: bg, paddingBottom: bottomSafe }}
      dir={isAr ? "rtl" : "ltr"}
    >
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
            {isAr ? "مواقيت الصلاة" : "Prayer Times"}
          </h1>
          <p className="text-[11px]" style={{ color: textSecondary }}>
            {isAr ? "حسب موقعك الحالي" : "Based on your current location"}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-sm" style={{ color: textSecondary }}>
              {isAr ? "جارٍ تحميل مواقيت الصلاة…" : "Loading prayer times..."}
            </p>
          </div>
        ) : !dailyPrayers ? (
          <div
            className="rounded-2xl px-4 py-4 flex items-start gap-2"
            style={{ background: isDark ? "rgba(251,191,36,0.12)" : "rgba(254,243,199,0.9)", border: `1px solid ${isDark ? "rgba(251,191,36,0.38)" : "rgba(217,119,6,0.36)"}` }}
          >
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: isDark ? "#fbbf24" : "#92400e" }} />
            <p className="text-[12px] leading-relaxed font-medium" style={{ color: isDark ? "#fbbf24" : "#92400e" }}>
              {isAr
                ? "تعذّر تحديد الموقع. فعّل إذن الموقع لعرض مواقيت الصلاة بدقة."
                : "Location is unavailable. Please enable location permission to show accurate prayer times."}
            </p>
          </div>
        ) : (
          <>
            {nextPrayer && (
              <div
                className="rounded-2xl p-5 mb-4"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {NextPrayerIcon && <NextPrayerIcon className="w-3.5 h-3.5 shrink-0" style={{ color: textSecondary }} />}
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>
                        {isAr ? "الصلاة القادمة" : "Next Prayer"}
                      </p>
                    </div>
                    <h2 className="text-[24px] font-bold" style={{ color: textPrimary }}>
                      {isAr ? nextPrayer.nameAr : nextPrayer.name}
                    </h2>
                  </div>
                  <div className="text-end">
                    <p className="text-[22px] font-bold tabular-nums" style={{ color: accent }}>
                      {formatPrayerTime(nextPrayer.time, isAr)}
                    </p>
                    <p className="text-[12px] font-medium" style={{ color: textSecondary }}>
                      {formatCountdown(minutesLeft, isAr)}
                    </p>
                  </div>
                </div>

                <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%`, background: accent }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              {dailyPrayers.map((prayer) => {
              const isNext = nextPrayer?.key === prayer.key;
              const PrayerIcon = prayerIcon[prayer.key];

              return (
                <div
                  key={prayer.key}
                  className={`rounded-2xl px-4 py-3.5 flex items-center justify-between ${isAr ? "flex-row-reverse" : "flex-row"}`}
                  style={{
                    background: isNext ? nextPillBg : "transparent",
                    border: `1px solid ${isNext ? nextPillBorder : pillBorder}`,
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PrayerIcon className="w-4 h-4 shrink-0" style={{ color: isNext ? accent : textSecondary }} />
                    <p className="text-[15px] font-semibold" style={{ color: textPrimary }}>
                      {isAr ? prayer.nameAr : prayer.name}
                    </p>
                    {isNext && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          color: accent,
                          background: isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.08)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(6,5,65,0.14)"}`,
                        }}
                      >
                        {isAr ? "التالي" : "Next"}
                      </span>
                    )}
                  </div>

                  <p className="text-[15px] font-medium tabular-nums" style={{ color: isNext ? accent : textSecondary }}>
                    {formatPrayerTime(prayer.time, isAr)}
                  </p>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
