import { useState, useEffect, useRef } from "react";
import * as adhan from "adhan";
import { getNativeLocation } from "@/integrations/natively/locationBridge";

export interface NextPrayer {
  name: string;
  nameAr: string;
  time: Date;
  minutesLeft: number;
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

function getPrayerTimes(lat: number, lng: number, date: Date): adhan.PrayerTimes {
  const coords = new adhan.Coordinates(lat, lng);
  const params = adhan.CalculationMethod.UmmAlQura();
  params.madhab = adhan.Madhab.Shafi;
  return new adhan.PrayerTimes(coords, date, params);
}

function getNextPrayer(lat: number, lng: number): NextPrayer | null {
  const now = new Date();
  const pt = getPrayerTimes(lat, lng, now);

  const candidates: { key: string; time: Date }[] = [
    { key: "fajr", time: pt.fajr },
    { key: "dhuhr", time: pt.dhuhr },
    { key: "asr", time: pt.asr },
    { key: "maghrib", time: pt.maghrib },
    { key: "isha", time: pt.isha },
  ];

  for (const c of candidates) {
    if (c.time > now) {
      return {
        name: PRAYER_NAMES_EN[c.key],
        nameAr: PRAYER_NAMES_AR[c.key],
        time: c.time,
        minutesLeft: Math.round((c.time.getTime() - now.getTime()) / 60000),
      };
    }
  }

  // All prayers passed today — next is tomorrow's Fajr
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ptTomorrow = getPrayerTimes(lat, lng, tomorrow);
  const minutesLeft = Math.round((ptTomorrow.fajr.getTime() - now.getTime()) / 60000);
  return {
    name: PRAYER_NAMES_EN["fajr"],
    nameAr: PRAYER_NAMES_AR["fajr"],
    time: ptTomorrow.fajr,
    minutesLeft,
  };
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

export function usePrayerTimes() {
  const [nextPrayer, setNextPrayer] = useState<NextPrayer | null>(null);
  const [loading, setLoading] = useState(true);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refresh() {
    if (!coordsRef.current) return;
    const result = getNextPrayer(coordsRef.current.lat, coordsRef.current.lng);
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
          const result = getNextPrayer(loc.latitude, loc.longitude);
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
      refresh();
    }, 60000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { nextPrayer, loading };
}
