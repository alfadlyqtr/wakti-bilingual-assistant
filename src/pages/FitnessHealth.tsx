import React, { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { isWhoopConnected, startWhoopAuth, triggerUserSync, fetchCompactMetrics, disconnectWhoop, getWhoopStatus, fetchRecoveryHistory, fetchSleepHistory, fetchCycleHistory } from "@/services/whoopService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { StatusHeader } from "@/components/fitness/StatusHeader";
import { SleepCard } from "@/components/fitness/cards/SleepCard";
import { RecoveryCard } from "@/components/fitness/cards/RecoveryCard";
import { HRVRHRMini } from "@/components/fitness/cards/HRVRHRMini";
import { StrainCard } from "@/components/fitness/cards/StrainCard";
import { WorkoutCard } from "@/components/fitness/cards/WorkoutCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIInsights } from "@/components/fitness/AIInsights";

export default function FitnessHealth() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState<{ connected: boolean; lastSyncedAt: string | null }>({ connected: false, lastSyncedAt: null });
  const [hrHistory, setHrHistory] = useState<{ date: string; recovery?: number | null; hrv?: number | null; rhr?: number | null }[]>([]);
  const [sleepHist, setSleepHist] = useState<{ start: string; end: string; hours: number | null }[]>([]);
  const [cycleHist, setCycleHist] = useState<{ start: string; day_strain?: number | null; avg_hr_bpm?: number | null; training_load?: number | null }[]>([]);
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    try { return localStorage.getItem('whoop_autosync') !== '0'; } catch { return true; }
  });
  const [tab, setTab] = useState<'overview'|'ai'>('overview');

  useEffect(() => {
    (async () => {
      const st = await getWhoopStatus();
      setStatus(st);
      setConnected(st.connected);
      if (st.connected) {
        const [m, rec, sl, cyc] = await Promise.all([
          fetchCompactMetrics(),
          fetchRecoveryHistory(7),
          fetchSleepHistory(7),
          fetchCycleHistory(7),
        ]);
        setMetrics(m);
        setHrHistory(rec);
        setSleepHist(sl.map((x:any)=>({ start: x.start, end: x.end, hours: x.hours })));
        setCycleHist(cyc);
        // Auto-sync if older than 1 hour and toggle enabled
        if (st.lastSyncedAt && autoSync) {
          const ageMs = Date.now() - new Date(st.lastSyncedAt).getTime();
          if (ageMs > 3600_000) {
            try {
              setSyncing(true);
              const res = await triggerUserSync();
              toast.success(`Synced: ${res?.counts?.cycles||0} cycles, ${res?.counts?.sleeps||0} sleeps, ${res?.counts?.workouts||0} workouts, ${res?.counts?.recoveries||0} recoveries`);
              const [m2, rec2, sl2, cyc2] = await Promise.all([fetchCompactMetrics(), fetchRecoveryHistory(7), fetchSleepHistory(7), fetchCycleHistory(7)]);
              setMetrics(m2);
              setHrHistory(rec2);
              setSleepHist(sl2.map((x:any)=>({ start: x.start, end: x.end, hours: x.hours })));
              setCycleHist(cyc2);
              setStatus({ connected: true, lastSyncedAt: new Date().toISOString() });
            } catch (e) {
              console.error('auto sync error', e);
            } finally {
              setSyncing(false);
            }
          }
        }
      }
      setLoading(false);
    })();
  }, [autoSync]);

  const onConnect = async () => {
    try {
      setConnecting(true);
      if (!user) {
        toast.error(language === 'ar' ? 'الرجاء تسجيل الدخول أولاً' : 'Please sign in first');
        // Remember intent and resume after login
        try { localStorage.setItem('whoop_pending', '1'); } catch {}
        window.location.href = `/login?redirect=/fitness`;
        return;
      }
      // New service computes and stores the redirect URI internally
      await startWhoopAuth();
    } catch (e) {
      console.error('whoop connect error', e);
      toast.error(language === 'ar' ? 'تعذر بدء الاتصال بـ WHOOP' : 'Failed to start WHOOP connect');
    } finally {
      setConnecting(false);
    }
  };

  // Auto-resume WHOOP connect after successful login if user initiated it before
  useEffect(() => {
    if (user && !loading) {
      const pending = (() => { try { return localStorage.getItem('whoop_pending') === '1'; } catch { return false; } })();
      if (pending && !connected && !connecting) {
        try { localStorage.removeItem('whoop_pending'); } catch {}
        onConnect();
      }
    }
  }, [user, loading, connected, connecting]);

  const onSync = async () => {
    try {
      setSyncing(true);
      const res = await triggerUserSync();
      const [m, rec] = await Promise.all([fetchCompactMetrics(), fetchRecoveryHistory(7)]);
      setMetrics(m);
      setHrHistory(rec);
      setStatus({ connected: true, lastSyncedAt: new Date().toISOString() });
      toast.success(`Synced: ${res?.counts?.cycles||0} cycles, ${res?.counts?.sleeps||0} sleeps, ${res?.counts?.workouts||0} workouts, ${res?.counts?.recoveries||0} recoveries`);
    } finally {
      setSyncing(false);
    }
  };

  const onDisconnect = async () => {
    try {
      setDisconnecting(true);
      await disconnectWhoop();
      setConnected(false);
      setMetrics(null);
      toast.success(language === 'ar' ? 'تم فصل WHOOP' : 'WHOOP disconnected');
    } catch (e) {
      console.error('whoop disconnect error', e);
      toast.error(language === 'ar' ? 'تعذر فصل WHOOP' : 'Failed to disconnect WHOOP');
    } finally {
      setDisconnecting(false);
    }
  };

  const sleepStages = useMemo(() => {
    const s = metrics?.sleep?.data?.score?.stage_summary || null;
    if (!s) return null;
    return {
      deep: s.deep_sleep_milli ?? s.deep_milli ?? 0,
      rem: s.rem_sleep_milli ?? s.rem_milli ?? 0,
      light: s.light_sleep_milli ?? s.light_milli ?? 0,
      total: (s.deep_sleep_milli ?? 0) + (s.rem_sleep_milli ?? 0) + (s.light_sleep_milli ?? 0),
    };
  }, [metrics]);

  const avgSleep7d = useMemo(() => {
    const vals = (sleepHist || []).map(x=>x.hours).filter((x): x is number => typeof x === 'number');
    if (!vals.length) return null as number | null;
    return Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10;
  }, [sleepHist]);

  const avgRecovery7d = useMemo(() => {
    const vals = (hrHistory || []).map(x=>x.recovery).filter((x): x is number => typeof x === 'number');
    if (!vals.length) return null as number | null;
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  }, [hrHistory]);

  const avgStrain7d = useMemo(() => {
    const vals = (cycleHist || []).map((c:any)=>c.day_strain).filter((x): x is number => typeof x === 'number');
    if (!vals.length) return null as number | null;
    return Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10;
  }, [cycleHist]);

  const sleepHours = useMemo(() => {
    const s = metrics?.sleep;
    if (!s) return null as number | null;
    if (typeof s.duration_sec === 'number' && s.duration_sec > 0) return Math.round((s.duration_sec/360))/10;
    const st = metrics?.sleep?.data?.score?.stage_summary;
    if (st) {
      const total = (st.deep_sleep_milli??0)+(st.rem_sleep_milli??0)+(st.light_sleep_milli??0);
      if (total > 0) return Math.round((total/360000))/10;
    }
    if (s.start && s.end) {
      const delta = new Date(s.end).getTime() - new Date(s.start).getTime();
      if (delta > 0) return Math.round((delta/360000))/10;
    }
    return null;
  }, [metrics]);

  const sleepEfficiency = useMemo(() => {
    const st = metrics?.sleep?.data?.score?.stage_summary;
    if (!st) return null as number | null;
    const asleep = (st.deep_sleep_milli??0)+(st.rem_sleep_milli??0)+(st.light_sleep_milli??0);
    const inBed = st.total_in_bed_milli ?? 0;
    if (!inBed) return null;
    return Math.round((asleep / inBed) * 100);
  }, [metrics]);

  const todayStats = useMemo(() => {
    const rec = metrics?.recovery;
    const cyc = metrics?.cycle;
    const w = metrics?.workout;
    const kcal = w?.data?.score?.kilojoule ? Math.round((w.data.score.kilojoule||0)/4.184) : null;
    const wAvgHr = w?.data?.score?.average_heart_rate ?? null;
    return {
      recovery: rec?.score ?? null,
      hrv: rec?.hrv_ms ?? null,
      rhr: rec?.rhr_bpm ?? null,
      strain: cyc?.day_strain ?? null,
      load: cyc?.training_load ?? null,
      avgHr: cyc?.avg_hr_bpm ?? wAvgHr ?? null,
      kcal,
    };
  }, [metrics]);

  return (
    <PageContainer>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{language === 'ar' ? 'الصحة واللياقة' : 'Fitness & Health'}</h1>
          <p className="text-muted-foreground">{language === 'ar' ? 'اتصل بـ WHOOP للاطلاع على رؤى ذكية.' : 'Connect WHOOP to view smart insights.'}</p>
        </div>

        <StatusHeader
          connected={connected}
          lastSyncedAt={status.lastSyncedAt}
          syncing={syncing}
          onConnect={onConnect}
          onSync={onSync}
          onDisconnect={onDisconnect}
          autoSyncEnabled={autoSync}
          onToggleAutoSync={(v)=>{ setAutoSync(v); try { localStorage.setItem('whoop_autosync', v ? '1' : '0'); } catch {} }}
        />

        {loading ? (
          <div className="text-sm text-muted-foreground">{language === 'ar' ? 'جار التحميل...' : 'Loading...'}</div>
        ) : connected ? (
          <Tabs value={tab} onValueChange={(v)=>{ setTab(v as any); setTimeout(()=>window.dispatchEvent(new Event('resize')), 60); setTimeout(()=>window.dispatchEvent(new Event('resize')), 500); }}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ai">AI Insights</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-6 mt-4">
              {/* Today Stats strip */}
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-[2px] rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Recovery {todayStats.recovery != null ? Math.round(todayStats.recovery) : '--'}%</span>
                <span className="px-2 py-[2px] rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">HRV {todayStats.hrv != null ? Math.round(todayStats.hrv) : '--'} ms</span>
                <span className="px-2 py-[2px] rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20">RHR {todayStats.rhr != null ? Math.round(todayStats.rhr) : '--'} bpm</span>
                <span className="px-2 py-[2px] rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Strain {todayStats.strain != null ? todayStats.strain.toFixed(1) : '--'}</span>
                <span className="px-2 py-[2px] rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Load {todayStats.load != null ? Math.round(todayStats.load*10)/10 : '--'}</span>
                <span className="px-2 py-[2px] rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Avg HR {todayStats.avgHr != null ? Math.round(todayStats.avgHr) : '--'} bpm</span>
                <span className="px-2 py-[2px] rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">Calories {todayStats.kcal != null ? todayStats.kcal : '--'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <SleepCard
                  hours={sleepHours}
                  performancePct={metrics?.sleep?.performance_pct ?? null}
                  stages={sleepStages}
                  bedtime={metrics?.sleep?.start ?? null}
                  waketime={metrics?.sleep?.end ?? null}
                  nap={metrics?.sleep?.data?.nap ?? null}
                  efficiencyPct={sleepEfficiency}
                  avgHours7d={avgSleep7d}
                />
                <RecoveryCard value={metrics?.recovery?.score ?? null} hrvMs={metrics?.recovery?.hrv_ms ?? null} rhrBpm={metrics?.recovery?.rhr_bpm ?? null} avgPct7d={avgRecovery7d} />
                <HRVRHRMini data={hrHistory} />
                <StrainCard value={metrics?.cycle?.day_strain ?? null} trainingLoad={metrics?.cycle?.training_load ?? null} avgHrBpm={metrics?.cycle?.avg_hr_bpm ?? null} avg7d={avgStrain7d} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <WorkoutCard workout={metrics?.workout} />
              </div>
            </TabsContent>
            <TabsContent value="ai" className="mt-4">
              <AIInsights />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="rounded-2xl p-6 border bg-white/5 text-sm text-muted-foreground">
            {language === 'ar' ? 'قم بتوصيل حسابك في WHOOP لبدء المزامنة.' : 'Connect your WHOOP account to start syncing.'}
            <div className="mt-3">
              <Button onClick={onConnect} disabled={connecting}>{connecting ? (language === 'ar' ? 'جار البدء...' : 'Starting...') : (language === 'ar' ? 'اتصال WHOOP' : 'Connect WHOOP')}</Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

