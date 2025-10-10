import React, { useEffect, useState } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon, HeartPulse, Zap, Hand } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { startWhoopAuth, fetchCompactMetrics, getWhoopStatus } from "@/services/whoopService";
import { useNavigate } from "react-router-dom";
import { useWidgetDragHandle } from "@/components/dashboard/WidgetDragHandleContext";

export const WhoopWidget: React.FC = () => {
  const { language } = useTheme();
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const navigate = useNavigate();
  const { registerHandle, listeners, attributes, isDragging } = useWidgetDragHandle();
  const handleBindings = isDragging ? { ...attributes, ...listeners } : {};
  const handlePosition = language === 'ar' ? 'right-2' : 'left-2';
  const handleClass = isDragging
    ? `absolute top-2 z-20 p-2 rounded-lg border border-rose-400/60 bg-rose-500/35 text-white shadow-xl ring-2 ring-rose-400/70 transition-all duration-300 scale-110 ${handlePosition}`
    : `absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 bg-primary/20 border-primary/30 text-primary/70 transition-all duration-300 hover:bg-primary/30 hover:text-white ${handlePosition}`;

  useEffect(() => {
    (async () => {
      const status = await getWhoopStatus();
      setConnected(status.connected);
      setLastSyncedAt(status.lastSyncedAt);
      if (status.connected) {
        // FIX: Use forceFresh to bypass cache in widget
        const m = await fetchCompactMetrics(true);
        setMetrics(m);
      }
      setLoading(false);
    })();
  }, []);

  const onConnect = async () => {
    // startWhoopAuth determines redirect URI internally
    await startWhoopAuth();
  };

  if (loading) {
    return (
      <div className="p-4">
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'الحيوية' : 'Vitality'}</CardTitle>
        </CardHeader>
        <div className="p-4 text-sm text-muted-foreground">{language === 'ar' ? 'جار التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="p-4">
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'اتصل بـ WHOOP' : 'Connect WHOOP'}</CardTitle>
        </CardHeader>
        <div className="p-4 text-sm text-muted-foreground">
          {language === 'ar' ? 'قم بتوصيل حساب WHOOP لعرض النوم، التعافي، والإجهاد اليومي.' : 'Connect your WHOOP account to view sleep, recovery, and daily strain.'}
        </div>
        <div className="px-4 pb-4">
          <Button onClick={onConnect} className="w-full">{language === 'ar' ? 'اتصال WHOOP' : 'Connect WHOOP'}</Button>
        </div>
      </div>
    );
  }

  const sleep = metrics?.sleep;
  const recovery = metrics?.recovery;
  const cycle = metrics?.cycle;

  const formatSyncedAt = (iso: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const locale = language === 'ar' ? 'ar-SA' : 'en-US';
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch {
      return date.toLocaleString(locale);
    }
  };

  const formattedSync = formatSyncedAt(lastSyncedAt);

  // Helper: robust sleep hours like Vitality page (no hooks)
  const computeSleepHours = (sleepObj: any): number | null => {
    if (!sleepObj) return null;
    if (typeof sleepObj.duration_sec === 'number' && sleepObj.duration_sec > 0) {
      return Math.round((sleepObj.duration_sec / 360)) / 10; // one decimal
    }
    const stages = sleepObj.data?.score?.stage_summary;
    const deep = stages?.total_slow_wave_sleep_time_milli || 0;
    const rem = stages?.total_rem_sleep_time_milli || 0;
    const light = stages?.total_light_sleep_time_milli || 0;
    const awake = stages?.total_awake_time_milli || 0;
    const totalMs = deep + rem + light + awake;
    if (totalMs > 0) return Math.round((totalMs / 360000)) / 10;
    if (sleepObj.start && sleepObj.end) {
      const delta = new Date(sleepObj.end).getTime() - new Date(sleepObj.start).getTime();
      if (delta > 0) return Math.round((delta / 360000)) / 10;
    }
    return null;
  };
  const sleepHours = computeSleepHours(sleep);

  return (
    <div className="p-4">
      {/* Gradient container to match other widgets */}
      <div className="relative rounded-3xl border bg-gradient-to-br from-rose-500/10 via-pink-500/10 to-purple-500/10 dark:from-white/5 dark:via-white/5 dark:to-white/5 border-white/10 shadow-2xl overflow-hidden">
        {/* Drag handle to match TRWidget style */}
        <div
          ref={registerHandle}
          {...handleBindings}
          className={`${handleClass} cursor-grab active:cursor-grabbing`}
        >
          <Hand className="h-3 w-3 text-current" />
        </div>
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gradient-to-r from-rose-400 to-pink-400"></span>
            {language === 'ar' ? 'الحيوية' : 'Vitality'}
          </CardTitle>
        </CardHeader>
        {formattedSync && (
          <div className="px-5 pb-1 text-[11px] text-muted-foreground/80 flex items-center justify-between">
            <span>{language === 'ar' ? 'آخر مزامنة' : 'Last synced'}</span>
            <span>{formattedSync}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 p-4">
          <div className="rounded-2xl p-3 border shadow-md bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/15 dark:to-cyan-500/10 border-blue-200/60 dark:border-blue-500/25">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Moon className="h-3.5 w-3.5 text-blue-400" /> {language === 'ar' ? 'النوم (آخر ليلة)' : 'Sleep (last night)'} </div>
          <div className="mt-1 text-xl font-bold text-blue-400">{sleepHours != null ? `${sleepHours.toFixed(1)}h` : '--'}</div>
          <div className="text-[11px] text-blue-400/80">{sleep?.sleep_efficiency_pct ? `${Math.round(sleep.sleep_efficiency_pct)}% ${language === 'ar' ? 'كفاءة' : 'Efficiency'}` : ''}</div>
          </div>
          <div className="rounded-2xl p-3 border shadow-md bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/15 dark:to-green-500/10 border-emerald-200/60 dark:border-emerald-500/25">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><HeartPulse className="h-3.5 w-3.5 text-emerald-400" /> {language === 'ar' ? 'التعافي' : 'Recovery'}</div>
          <div className="mt-1 text-xl font-bold text-emerald-400">{recovery?.score != null ? Math.round(recovery.score) : '--'}%</div>
          <div className="text-[11px] text-emerald-400/80">HRV {recovery?.hrv_ms ?? '--'} • RHR {recovery?.rhr_bpm ?? '--'}</div>
          </div>
          <div className="rounded-2xl p-3 border shadow-md bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-500/15 dark:to-fuchsia-500/10 border-violet-200/60 dark:border-violet-500/25">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Zap className="h-3.5 w-3.5 text-violet-400" /> {language === 'ar' ? 'إجهاد اليوم' : 'Day Strain'}</div>
          <div className="mt-1 text-xl font-bold text-violet-400">{cycle?.day_strain != null ? Math.round(cycle.day_strain) : '--'}</div>
          <div className="text-[11px] text-violet-400/80">Avg HR {cycle?.avg_hr_bpm ?? '--'}</div>
          </div>
        </div>
        <div className="px-4 pb-5">
          <Button variant="secondary" className="w-full rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white border-2 border-rose-200 dark:border-rose-500/40 shadow-[0_6px_18px_rgba(244,63,94,0.35)] hover:from-rose-500 hover:to-pink-600" onClick={() => navigate('/fitness')}>
            {language === 'ar' ? 'فتح الحيوية' : 'Open Vitality'}
          </Button>
        </div>
      </div>
    </div>
  );
};
