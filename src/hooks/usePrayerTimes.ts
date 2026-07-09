import { useState, useEffect, useRef, useMemo } from "react";
import { getNativeLocation } from "@/integrations/natively/locationBridge";

type AdhanModule = typeof import("adhan");

let adhanModulePromise: Promise<AdhanModule> | null = null;

async function loadAdhanModule(): Promise<AdhanModule | null> {
  try {
    if (!adhanModulePromise) {
      adhanModulePromise = import("adhan");
    }
    return await adhanModulePromise;
  } catch (error) {
    console.warn("usePrayerTimes: Failed to load adhan module", error);
    adhanModulePromise = null;
    return null;
  }
}

export interface NextPrayer {
  name: string;
  nameAr: string;
  time: Date;
  minutesLeft: number;
}

export interface DailyPrayer {
  key: "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
  name: string;
  nameAr: string;
  time: Date;
}

export interface PrayerWindow {
  previous: DailyPrayer | null;
  next: DailyPrayer | null;
}

export interface PrayerLocation {
  city?: string;
  country?: string;
}

const PRAYER_NAMES_EN: Record<string, string> = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

const PRAYER_NAMES_AR: Record<string, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};

const ARABIC_TWO_DIGIT_FORMATTER = new Intl.NumberFormat("ar-SA-u-nu-arab", {
  minimumIntegerDigits: 2,
  useGrouping: false,
});

function getPrayerTimes(adhanLib: AdhanModule, lat: number, lng: number, date: Date) {
  const coords = new adhanLib.Coordinates(lat, lng);
  const params = adhanLib.CalculationMethod.UmmAlQura();
  params.madhab = adhanLib.Madhab.Shafi;
  return new adhanLib.PrayerTimes(coords, date, params);
}

function buildDailyPrayers(prayerTimes: {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}): DailyPrayer[] {
  return [
    { key: "fajr", name: PRAYER_NAMES_EN.fajr, nameAr: PRAYER_NAMES_AR.fajr, time: prayerTimes.fajr },
    { key: "sunrise", name: PRAYER_NAMES_EN.sunrise, nameAr: PRAYER_NAMES_AR.sunrise, time: prayerTimes.sunrise },
    { key: "dhuhr", name: PRAYER_NAMES_EN.dhuhr, nameAr: PRAYER_NAMES_AR.dhuhr, time: prayerTimes.dhuhr },
    { key: "asr", name: PRAYER_NAMES_EN.asr, nameAr: PRAYER_NAMES_AR.asr, time: prayerTimes.asr },
    { key: "maghrib", name: PRAYER_NAMES_EN.maghrib, nameAr: PRAYER_NAMES_AR.maghrib, time: prayerTimes.maghrib },
    { key: "isha", name: PRAYER_NAMES_EN.isha, nameAr: PRAYER_NAMES_AR.isha, time: prayerTimes.isha },
  ];
}

async function getNextPrayer(lat: number, lng: number): Promise<NextPrayer | null> {
  const adhanLib = await loadAdhanModule();
  if (!adhanLib) return null;

  const now = new Date();
  const pt = getPrayerTimes(adhanLib, lat, lng, now);

  const candidates = buildDailyPrayers(pt).filter((c) => c.key !== "sunrise");

  for (const c of candidates) {
    if (c.time > now) {
      return {
        name: c.name,
        nameAr: c.nameAr,
        time: c.time,
        minutesLeft: Math.round((c.time.getTime() - now.getTime()) / 60000),
      };
    }
  }

  // All prayers passed today — next is tomorrow's Fajr
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ptTomorrow = getPrayerTimes(adhanLib, lat, lng, tomorrow);
  const minutesLeft = Math.round((ptTomorrow.fajr.getTime() - now.getTime()) / 60000);
  return {
    name: PRAYER_NAMES_EN["fajr"],
    nameAr: PRAYER_NAMES_AR["fajr"],
    time: ptTomorrow.fajr,
    minutesLeft,
  };
}

async function getDailyPrayers(lat: number, lng: number): Promise<DailyPrayer[] | null> {
  const adhanLib = await loadAdhanModule();
  if (!adhanLib) return null;
  const now = new Date();
  const pt = getPrayerTimes(adhanLib, lat, lng, now);
  return buildDailyPrayers(pt);
}

async function getTomorrowFajr(lat: number, lng: number): Promise<Date | null> {
  const adhanLib = await loadAdhanModule();
  if (!adhanLib) return null;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const pt = getPrayerTimes(adhanLib, lat, lng, tomorrow);
  return pt.fajr;
}

export function formatCountdown(minutesLeft: number, isAr: boolean): string {
  if (minutesLeft <= 0) return isAr ? "الآن" : "Now";
  const h = Math.floor(minutesLeft / 60);
  const m = minutesLeft % 60;
  if (isAr) {
    if (h > 0 && m > 0) return `بعد ${h}س ${m}د`;
    if (h > 0) return `بعد ${h} ساعة`;
    return `بعد ${m} دقيقة`;
  }
  if (h > 0 && m > 0) return `in ${h}h ${m}m`;
  if (h > 0) return `in ${h}h`;
  return `in ${m}m`;
}

export function formatLiveCountdown(secondsLeft: number, isAr: boolean): string {
  if (secondsLeft <= 0) return isAr ? "الآن" : "Now";
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  if (isAr) {
    const value = `${ARABIC_TWO_DIGIT_FORMATTER.format(h)}:${ARABIC_TWO_DIGIT_FORMATTER.format(m)}:${ARABIC_TWO_DIGIT_FORMATTER.format(s)}`;
    return `بعد ${value}`;
  }

  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `in ${value}`;
}

export function formatPrayerTime(time: Date, isAr: boolean): string {
  try {
    return new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(time);
  } catch {
    return time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

export function usePrayerTimes() {
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null);
  const [loading, setLoading] = useState(true);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    if (!coordsRef.current) return;
    const result = await getNextPrayer(coordsRef.current.lat, coordsRef.current.lng);
    setNextPrayer(result);
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        const loc = await getNativeLocation({ timeoutMs: 8000 });
        if (!cancelled && loc) {
          coordsRef.current = { lat: loc.latitude, lng: loc.longitude };
          const result = await getNextPrayer(loc.latitude, loc.longitude);
          setNextPrayer(result);
        }
      } catch {
        // location unavailable — leave nextPrayer null
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    // Refresh countdown every 60 seconds
    intervalRef.current = setInterval(() => {
      void refresh();
    }, 60000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { nextPrayer, loading };
}

export function useDailyPrayerTimes() {
  const [dailyPrayers, setDailyPrayers] = useState<DailyPrayer[] | null>(null);
  const [tomorrowFajr, setTomorrowFajr] = useState<Date | null>(null);
  const [location, setLocation] = useState<PrayerLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        const loc = await getNativeLocation({ timeoutMs: 8000 });
        if (!cancelled && loc) {
          setLocation({ city: loc.city, country: loc.country });
          const [result, fajr] = await Promise.all([
            getDailyPrayers(loc.latitude, loc.longitude),
            getTomorrowFajr(loc.latitude, loc.longitude),
          ]);
          setDailyPrayers(result);
          setTomorrowFajr(fajr);
        }
      } catch {
        // location unavailable — leave dailyPrayers null
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const window = useMemo<PrayerWindow | null>(() => {
    if (!dailyPrayers) return null;
    const prayers = dailyPrayers.filter((p) => p.key !== "sunrise");
    const previous = [...prayers].reverse().find((p) => p.time <= now) ?? null;
    let next = prayers.find((p) => p.time > now) ?? null;
    if (!next && tomorrowFajr) {
      next = { key: "fajr", name: PRAYER_NAMES_EN.fajr, nameAr: PRAYER_NAMES_AR.fajr, time: tomorrowFajr };
    }
    return { previous, next };
  }, [dailyPrayers, now, tomorrowFajr]);

  return { dailyPrayers, window, loading, now, location };
}
