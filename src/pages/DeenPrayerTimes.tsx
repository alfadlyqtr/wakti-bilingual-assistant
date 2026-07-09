import { useNavigate } from "react-router-dom";
import { ArrowLeft, CloudMoon, MapPin, Moon, Sun, SunDim, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { formatLiveCountdown, formatPrayerTime, useDailyPrayerTimes, type DailyPrayer } from "@/hooks/usePrayerTimes";

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function DeenPrayerTimes() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const isDark = theme === "dark";
  const { dailyPrayers, window, loading, now, location } = useDailyPrayerTimes();

  const bg = isDark ? "#0c0f14" : "#fcfefd";
  const textPrimary = isDark ? "#f2f2f2" : "#060541";
  const textSecondary = isDark ? "#858384" : "#606062";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.09)";
  const accent = isDark ? "hsl(210,70%,52%)" : "hsl(210,60%,34%)";
  const activePillBorder = isDark ? "hsla(210,70%,60%,0.45)" : "hsla(210,60%,44%,0.4)";
  const pillBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(6,5,65,0.12)";
  const nextPillBg = isDark ? "rgba(255,255,255,0.11)" : "rgba(6,5,65,0.09)";
  const nextPillBorder = isDark ? "rgba(255,255,255,0.22)" : "rgba(6,5,65,0.22)";
  const heroCardBg = isDark
    ? "linear-gradient(145deg, hsla(210,70%,52%,0.14) 0%, rgba(11,14,19,0.96) 38%, rgba(8,11,16,0.99) 100%)"
    : "linear-gradient(145deg, hsla(210,60%,34%,0.12) 0%, #ffffff 38%, #f8fbf9 100%)";
  const heroInnerBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.08)";
  const heroProgressTrack = isDark ? "hsla(210,70%,52%,0.12)" : "hsla(210,60%,44%,0.14)";
  const heroProgressFill = isDark ? "hsla(210,70%,52%,0.72)" : "hsla(210,60%,34%,0.62)";
  const heroNameGlow = isDark ? "0 0 14px hsla(210,70%,52%,0.2)" : "0 0 10px hsla(210,60%,34%,0.12)";
  const verseDivider = isDark
    ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)"
    : "linear-gradient(90deg, transparent, rgba(6,5,65,0.2), transparent)";
  const stripBase = isDark ? "rgba(255,255,255,0.16)" : "rgba(6,5,65,0.16)";
  const iconBadgeBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(6,5,65,0.05)";
  const iconBadgeBorder = isDark ? "rgba(255,255,255,0.14)" : "rgba(6,5,65,0.14)";
  const nextIconBadgeBg = isDark ? "hsla(210,70%,52%,0.14)" : "hsla(210,60%,34%,0.09)";
  const nextIconBadgeBorder = isDark ? "hsla(210,70%,52%,0.45)" : "hsla(210,60%,34%,0.28)";
  const bottomSafe = "calc(env(safe-area-inset-bottom) + 80px)";
  const patternStroke = isDark ? "hsla(210,70%,52%,0.06)" : "hsla(210,60%,34%,0.05)";
  const patternDot = isDark ? "hsla(210,70%,52%,0.08)" : "hsla(210,60%,34%,0.06)";
  const patternSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cpath d='M0 0 H60 V60 H0 Z M0 30 L30 0 L60 30 L30 60 Z' fill='none' stroke='${encodeURIComponent(patternStroke)}' stroke-width='0.5'/%3E%3Ccircle cx='30' cy='30' r='2' fill='${encodeURIComponent(patternDot)}'/%3E%3C/svg%3E")`;

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

  const secondsLeft = nextPrayer ? Math.max(0, Math.floor((nextPrayer.time.getTime() - now.getTime()) / 1000)) : 0;
  const progress =
    window?.previous && nextPrayer
      ? Math.min(100, Math.max(0, ((now.getTime() - window.previous.time.getTime()) / (nextPrayer.time.getTime() - window.previous.time.getTime())) * 100))
      : 0;
  const gregorianDate = new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory" : "en-GB-u-ca-gregory", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);
  const hijriDate = new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-islamic" : "en-GB-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const combinedDate = `${gregorianDate} • ${hijriDate}`;
  const hasCity = Boolean(location?.city && location.city.trim().length > 0);
  const hasCountry = Boolean(location?.country && location.country.trim().length > 0);
  const locationText = hasCity && hasCountry
    ? `${location?.city}, ${location?.country}`
    : hasCity
      ? `${location?.city}`
      : hasCountry
        ? `${location?.country}`
        : (isAr ? "حسب موقعك الحالي" : "For your location");

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: bg, backgroundImage: patternSvg, backgroundSize: "60px 60px", paddingBottom: bottomSafe }}
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
            {locationText}
          </p>
        </div>
      </div>

      <div className="prayer-times-scroll px-4 pb-4 flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div
              className="w-7 h-7 border-2 rounded-full animate-spin"
              style={{ borderColor: isDark ? "hsla(210,70%,52%,0.3)" : "hsla(210,60%,34%,0.3)", borderTopColor: accent }}
            />
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
            <p className="text-center text-[12px] mb-2" style={{ color: textPrimary }}>
              {combinedDate}
            </p>

            {nextPrayer && (
              <div
                className="rounded-2xl p-4 mb-3"
                style={{
                  background: heroCardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow: `inset 0 1px 0 ${heroInnerBorder}`,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {NextPrayerIcon && <NextPrayerIcon className="w-3.5 h-3.5 shrink-0" style={{ color: textSecondary }} />}
                      <h2 className="text-[22px] font-bold" style={{ color: textPrimary, textShadow: heroNameGlow }}>
                        {isAr ? nextPrayer.nameAr : nextPrayer.name}
                      </h2>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-[21px] font-bold tabular-nums" style={{ color: accent }}>
                      {formatPrayerTime(nextPrayer.time, isAr)}
                    </p>
                  </div>
                </div>

                <div className="text-center mb-1.5">
                  <p className="text-[11px] font-medium tabular-nums" style={{ color: textSecondary }}>
                    {formatLiveCountdown(secondsLeft, isAr)}
                  </p>
                </div>

                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: heroProgressTrack }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%`, background: heroProgressFill }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              {dailyPrayers.map((prayer) => {
              const isNext = nextPrayer?.key === prayer.key;
              const PrayerIcon = prayerIcon[prayer.key];
              const stripSideStyle = isAr ? { right: 8 } : { left: 8 };
              const shouldUseNextDayFajr =
                prayer.key === "fajr" &&
                nextPrayer?.key === "fajr" &&
                nextPrayer.time.getTime() > prayer.time.getTime();
              const prayerDisplayTime = shouldUseNextDayFajr ? nextPrayer.time : prayer.time;
              const showTomorrowLabel = shouldUseNextDayFajr && isSameCalendarDay(now, prayer.time);

              return (
                <div
                  key={prayer.key}
                  className="relative overflow-hidden rounded-2xl px-4 py-3.5 flex items-center justify-between flex-row"
                  style={{
                    background: isNext ? nextPillBg : "transparent",
                    border: `1px solid ${isNext ? activePillBorder : pillBorder}`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-2 bottom-2 w-[3px] rounded-full"
                    style={{
                      ...stripSideStyle,
                      background: isNext ? accent : stripBase,
                    }}
                  />

                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                      style={{
                        background: isNext ? nextIconBadgeBg : iconBadgeBg,
                        border: `1px solid ${isNext ? nextIconBadgeBorder : iconBadgeBorder}`,
                      }}
                    >
                      <PrayerIcon className="w-3.5 h-3.5" style={{ color: isNext ? accent : textSecondary }} />
                    </div>
                    <p className="text-[15px] font-semibold" style={{ color: textPrimary }}>
                      {isAr ? prayer.nameAr : prayer.name}
                    </p>
                  </div>

                  <div className="text-end">
                    <p className="text-[15px] font-medium tabular-nums" style={{ color: isNext ? accent : textSecondary }}>
                      {formatPrayerTime(prayerDisplayTime, isAr)}
                    </p>
                    {showTomorrowLabel && (
                      <p className="text-[10px] font-medium" style={{ color: textSecondary }}>
                        {isAr ? "غدًا" : "Tomorrow"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            </div>

            <div className="mt-[50px] px-2 pb-1">
              <div className="mx-auto mb-4 h-px w-28" style={{ background: verseDivider }} />
              <p
                className="text-center text-[14px] leading-relaxed"
                dir="rtl"
                style={{
                  color: isDark ? "rgba(133,131,132,0.9)" : "rgba(96,96,98,0.85)",
                  fontFamily: "'Noto Sans Arabic', 'Segoe UI', 'Tahoma', 'Arial', sans-serif",
                }}
              >
                إِنَّ الصَّلَاةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَٰبًا مَّوْقُوتًا
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
