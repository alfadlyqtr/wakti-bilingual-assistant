import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { filterByTimeRange, getMostRecent } from "@/utils/timeRangeFilter";
import { 
  startWhoopAuth, 
  triggerUserSync, 
  fetchCompactMetrics, 
  disconnectWhoop, 
  getWhoopStatus, 
  fetchRecoveryHistory, 
  fetchSleepHistory, 
  fetchCycleHistory, 
  fetchWorkoutsHistory,
  generateAiInsights,
  buildInsightsAggregate,
  fetchHistoricalData,
  timeRangeToDays
} from "@/services/whoopService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { TopPageSection } from "@/components/fitness/TopPageSection";
import { AIInsights } from "@/components/fitness/tabs/AIInsights";
import { SleepTab } from "@/components/fitness/tabs/SleepTab";
import { RecoveryTab } from "@/components/fitness/tabs/RecoveryTab";
import { HRVRHRTab } from "@/components/fitness/tabs/HRVRHRTab";
import { StrainTab } from "@/components/fitness/tabs/StrainTab";
import { WorkoutsTab } from "@/components/fitness/tabs/WorkoutsTab";
import { WhoopDetails } from "@/components/fitness/WhoopDetails";
import { 
  Activity, 
  Heart, 
  Moon, 
  Zap, 
  Dumbbell, 
  Brain, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Copy,
  Download,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';
type MainTab = 'ai-insights' | 'sleep' | 'recovery' | 'hrv-rhr' | 'strain' | 'workouts';

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
  const [activeTab, setActiveTab] = useState<MainTab>('ai-insights');
  const [timeRange, setTimeRange] = useState<TimeRange>('1d');
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    try { return localStorage.getItem('whoop_autosync') !== '0'; } catch { return true; }
  });
  
  // Store ALL fetched data (6 months)
  const [allHrHistory, setAllHrHistory] = useState<{ date: string; recovery?: number | null; hrv?: number | null; rhr?: number | null }[]>([]);
  const [allSleepHist, setAllSleepHist] = useState<{ start: string; end: string; hours: number | null }[]>([]);
  const [allCycleHist, setAllCycleHist] = useState<{ start: string; day_strain?: number | null; avg_hr_bpm?: number | null; training_load?: number | null }[]>([]);
  const [allWorkoutsHist, setAllWorkoutsHist] = useState<{ start: string; strain?: number | null; kcal?: number | null }[]>([]);
  
  // Filtered data based on time range
  const hrHistory = useMemo(() => {
    const filtered = filterByTimeRange(allHrHistory, timeRange);
    console.log(`[TimeRange Filter] ${timeRange}: HR History - Total: ${allHrHistory.length}, Filtered: ${filtered.length}`);
    return filtered;
  }, [allHrHistory, timeRange]);
  
  const sleepHist = useMemo(() => {
    const filtered = filterByTimeRange(allSleepHist, timeRange);
    console.log(`[TimeRange Filter] ${timeRange}: Sleep History - Total: ${allSleepHist.length}, Filtered: ${filtered.length}`);
    return filtered;
  }, [allSleepHist, timeRange]);
  
  const cycleHist = useMemo(() => {
    const filtered = filterByTimeRange(allCycleHist, timeRange);
    console.log(`[TimeRange Filter] ${timeRange}: Cycle History - Total: ${allCycleHist.length}, Filtered: ${filtered.length}`);
    return filtered;
  }, [allCycleHist, timeRange]);
  
  const workoutsHist = useMemo(() => {
    const filtered = filterByTimeRange(allWorkoutsHist, timeRange);
    console.log(`[TimeRange Filter] ${timeRange}: Workouts History - Total: ${allWorkoutsHist.length}, Filtered: ${filtered.length}`);
    return filtered;
  }, [allWorkoutsHist, timeRange]);

  useEffect(() => {
    (async () => {
      const st = await getWhoopStatus();
      setStatus(st);
      setConnected(st.connected);
      if (st.connected) {
        // FIX: Fetch ALL data (6 months) once, filter locally
        const [m, rec, sl, cyc, wks] = await Promise.all([
          fetchCompactMetrics(true),
          fetchRecoveryHistory(180, true), // 6 months
          fetchSleepHistory(180, true),     // 6 months
          fetchCycleHistory(180, true),     // 6 months
          fetchWorkoutsHistory(180, true),  // 6 months
        ]);
        setMetrics(m);
        setAllHrHistory(rec);
        setAllSleepHist(sl.map((x:any)=>({ start: x.start, end: x.end, hours: x.hours, stages: x.stages })));
        setAllCycleHist(cyc);
        setAllWorkoutsHist(wks.map((w:any)=>({ start: w.start, strain: w.strain ?? null, kcal: w.kcal ?? null })));
        if (st.lastSyncedAt && autoSync) {
          const ageMs = Date.now() - new Date(st.lastSyncedAt).getTime();
          if (ageMs > 3600_000) {
            try {
              setSyncing(true);
              const res = await triggerUserSync();
              toast.success(`Synced: ${res?.counts?.cycles||0} cycles, ${res?.counts?.sleeps||0} sleeps, ${res?.counts?.workouts||0} workouts, ${res?.counts?.recoveries||0} recoveries`);
              
              // FIX: Add 2-second delay to allow database commits to complete
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // FIX: Fetch ALL data (6 months) after sync
              const [m2, rec2, sl2, cyc2, wks2] = await Promise.all([
                fetchCompactMetrics(true), 
                fetchRecoveryHistory(180, true), 
                fetchSleepHistory(180, true), 
                fetchCycleHistory(180, true), 
                fetchWorkoutsHistory(180, true)
              ]);
              setMetrics(m2);
              setAllHrHistory(rec2);
              setAllSleepHist(sl2.map((x:any)=>({ start: x.start, end: x.end, hours: x.hours, stages: x.stages })));
              setAllCycleHist(cyc2);
              setAllWorkoutsHist(wks2.map((w:any)=>({ start: w.start, strain: w.strain ?? null, kcal: w.kcal ?? null })));
              setStatus({ connected: true, lastSyncedAt: new Date().toISOString() });
            } catch (e: any) {
              console.error('auto sync error', e);
              if (e?.message?.includes('refresh failed') || e?.message?.includes('400')) {
                toast.info(
                  language === 'ar' 
                    ? 'يرجى إعادة الاتصال بـ WHOOP لمواصلة المزامنة التلقائية' 
                    : 'Please reconnect to WHOOP to continue auto-sync',
                  { duration: 5000 }
                );
              }
            } finally {
              setSyncing(false);
            }
          }
        }
      }
      setLoading(false);
    })();
  }, [autoSync]);

  // Time range filtering is now done via useMemo - no need to re-fetch data
  // Old approach: Re-fetch data from API on every time range change
  // New approach: Fetch 6 months once, filter locally with useMemo

  const onConnect = async () => {
    try {
      setConnecting(true);
      if (!user) {
        toast.error(language === 'ar' ? 'الرجاء تسجيل الدخول أولاً' : 'Please sign in first');
        try { localStorage.setItem('whoop_pending', '1'); } catch {}
        window.location.href = `/login?redirect=/fitness`;
        return;
      }
      await startWhoopAuth();
    } catch (e) {
      console.error('whoop connect error', e);
      toast.error(language === 'ar' ? 'تعذر بدء الاتصال بـ WHOOP' : 'Failed to start WHOOP connect');
    } finally {
      setConnecting(false);
    }
  };

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
      
      // FIX: Add 2-second delay to allow database commits to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // FIX: Force fresh queries with cache busting and retry logic
      let retryCount = 0;
      let m, rec, sl, cyc, wks;
      
      while (retryCount < 2) {
        [m, rec, sl, cyc, wks] = await Promise.all([
          fetchCompactMetrics(true), 
          fetchRecoveryHistory(timeRangeToDays(timeRange), true),
          fetchSleepHistory(timeRangeToDays(timeRange), true),
          fetchCycleHistory(timeRangeToDays(timeRange), true),
          fetchWorkoutsHistory(timeRangeToDays(timeRange), true)
        ]);
        
        // Validate data freshness - check if we got actual data
        if (m && (m.sleep || m.recovery || m.cycle)) {
          break; // Data looks good
        }
        
        // No data yet, retry after another delay
        retryCount++;
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      setMetrics(m);
      setAllHrHistory(rec);
      setAllSleepHist(sl.map((x:any)=>({ start: x.start, end: x.end, hours: x.hours, stages: x.stages })));
      setAllCycleHist(cyc);
      setAllWorkoutsHist(wks.map((w:any)=>({ start: w.start, strain: w.strain ?? null, kcal: w.kcal ?? null })));
      setStatus({ connected: true, lastSyncedAt: new Date().toISOString() });
      toast.success(`Synced: ${res?.counts?.cycles||0} cycles, ${res?.counts?.sleeps||0} sleeps, ${res?.counts?.workouts||0} workouts, ${res?.counts?.recoveries||0} recoveries`);
    } catch (e: any) {
      console.error('sync error', e);
      if (e?.message?.includes('refresh failed') || e?.message?.includes('400')) {
        toast.error(
          language === 'ar'
            ? 'انتهت صلاحية اتصال WHOOP. يرجى الضغط على "قطع الاتصال" ثم "الاتصال" مرة أخرى.'
            : 'WHOOP connection expired. Please disconnect and reconnect.',
          { duration: 8000 }
        );
      } else {
        toast.error(language === 'ar' ? 'فشلت المزامنة' : 'Sync failed');
      }
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
    const sleep = metrics?.sleep;
    if (!sleep) return null;
    const deep = sleep.total_deep_sleep_ms || sleep.data?.score?.stage_summary?.total_slow_wave_sleep_time_milli || 0;
    const rem = sleep.total_rem_sleep_ms || sleep.data?.score?.stage_summary?.total_rem_sleep_time_milli || 0;
    const light = sleep.total_light_sleep_ms || sleep.data?.score?.stage_summary?.total_light_sleep_time_milli || 0;
    const awake = sleep.total_awake_ms || sleep.data?.score?.stage_summary?.total_awake_time_milli || 0;
    return { deep, rem, light, awake, total: deep + rem + light + awake };
  }, [metrics]);

  const sleepBars = useMemo(() => (
    (sleepHist || []).map((s, i) => ({ name: `D${i+1}`, Hours: s.hours ?? null }))
  ), [sleepHist]);

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
    const sleep = metrics?.sleep;
    if (!sleep) return null as number | null;
    if (typeof sleep.duration_sec === 'number' && sleep.duration_sec > 0) {
      return Math.round((sleep.duration_sec/360))/10;
    }
    const stages = sleepStages;
    if (stages && stages.total > 0) {
      return Math.round((stages.total/360000))/10;
    }
    if (sleep.start && sleep.end) {
      const delta = new Date(sleep.end).getTime() - new Date(sleep.start).getTime();
      if (delta > 0) return Math.round((delta/360000))/10;
    }
    return null;
  }, [metrics, sleepStages]);

  const sleepEfficiency = useMemo(() => {
    const sleep = metrics?.sleep;
    if (!sleep) return null as number | null;
    if (sleep.sleep_efficiency_pct) {
      return Math.round(sleep.sleep_efficiency_pct);
    }
    const stages = sleepStages;
    if (!stages) return null;
    const asleep = stages.deep + stages.rem + stages.light;
    const total = stages.total;
    if (!total || total === 0) return null;
    return Math.round((asleep / total) * 100);
  }, [metrics, sleepStages]);

  const todayStats = useMemo(() => {
    const rec = metrics?.recovery;
    const cyc = metrics?.cycle;
    const w = metrics?.workout;
    const kcal = w?.data?.score?.kilojoule ? Math.round((w.data.score.kilojoule||0)/4.184) : null;
    const wAvgHr = w?.data?.score?.average_heart_rate ?? null;
    
    // Extract from FLAT columns FIRST (database structure), then nested as fallback
    const recoveryScore = rec?.score ?? rec?.data?.score?.recovery_score ?? null;
    const hrvMs = rec?.hrv_ms ?? rec?.data?.score?.hrv_rmssd_milli ?? null;
    const rhrBpm = rec?.rhr_bpm ?? rec?.data?.score?.resting_heart_rate ?? null;
    const dayStrain = cyc?.day_strain ?? cyc?.data?.score?.strain ?? null;
    const trainingLoad = cyc?.training_load ?? cyc?.data?.score?.training_load ?? null;
    const avgHrBpm = cyc?.avg_hr_bpm ?? cyc?.data?.score?.average_heart_rate ?? wAvgHr ?? null;
    
    return {
      recovery: recoveryScore,
      hrv: hrvMs,
      rhr: rhrBpm,
      strain: dayStrain,
      load: trainingLoad,
      avgHr: avgHrBpm,
      kcal,
    };
  }, [metrics]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      <div className="text-center px-2">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          {language === 'ar' ? 'الحيوية' : 'Vitality'}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base px-4">
          {language === 'ar' ? 'تحليل شامل لبياناتك الصحية مع الذكاء الاصطناعي' : 'Comprehensive health data analysis with AI insights'}
        </p>
      </div>

      <TopPageSection
        connected={connected}
        lastSyncedAt={status.lastSyncedAt}
        syncing={syncing}
        onConnect={onConnect}
        onSync={onSync}
        onDisconnect={onDisconnect}
        autoSyncEnabled={autoSync}
        onToggleAutoSync={(v) => {
          setAutoSync(v);
          try { localStorage.setItem('whoop_autosync', v ? '1' : '0'); } catch {}
        }}
        metrics={metrics}
        sleepHours={sleepHours}
      />
            {loading ? (
        <Card className="rounded-2xl p-12 bg-white/5 border-white/10 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-400" />
          <p className="text-muted-foreground">
            {language === 'ar' ? 'جار تحميل البيانات...' : 'Loading health data...'}
          </p>
        </Card>
      ) : connected ? (
        <>
          {/* Mobile Dashboard Widgets - Only show on mobile */}
          <div className="block md:hidden mb-4">
            {metrics && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl p-3 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">
                      {todayStats.recovery || '0'}%
                    </div>
                    <div className="text-xs text-gray-400">
                      {language === 'ar' ? 'التعافي' : 'Recovery'}
                    </div>
                    <div className="text-xs text-green-400 mt-1">
                      HRV: {todayStats.hrv || '0'}ms
                    </div>
                  </div>
                </Card>

                <Card className="rounded-2xl p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-1">
                      {sleepHours?.toFixed(1) || '0'}h
                    </div>
                    <div className="text-xs text-gray-400">
                      {language === 'ar' ? 'النوم' : 'Sleep'}
                    </div>
                    <div className="text-xs text-blue-400 mt-1">
                      {sleepEfficiency || '0'}% {language === 'ar' ? 'كفاءة' : 'Efficiency'}
                    </div>
                  </div>
                </Card>

                <Card className="rounded-2xl p-3 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400 mb-1">
                      {todayStats.strain?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {language === 'ar' ? 'الإجهاد' : 'Strain'}
                    </div>
                    <div className="text-xs text-orange-400 mt-1">
                      {language === 'ar' ? 'منطقة سهلة' : 'Easy Zone'}
                    </div>
                  </div>
                </Card>

                <Card className="rounded-2xl p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400 mb-1">
                      {todayStats.hrv || '0'}
                    </div>
                    <div className="text-xs text-gray-400">
                      HRV (ms)
                    </div>
                    <div className="text-xs text-purple-400 mt-1">
                      RHR: {todayStats.rhr || '0'} bpm
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MainTab)}>
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 bg-transparent gap-x-2 gap-y-3 sm:gap-2 p-2 mb-4 sm:mb-4 rounded-xl">
              <TabsTrigger value="ai-insights" className="flex items-center justify-center gap-1 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:border-purple-300 data-[state=active]:shadow-[0_6px_20px_rgba(147,51,234,0.35)] dark:data-[state=active]:from-purple-700 dark:data-[state=active]:to-blue-700 dark:data-[state=active]:border-purple-400 dark:data-[state=active]:shadow-[0_0_24px_rgba(139,92,246,0.55)] active:scale-95">
                <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'رؤى الذكاء الاصطناعي' : 'AI Insights'}</span>
                <span className="sm:hidden text-center">AI</span>
              </TabsTrigger>
              <TabsTrigger value="sleep" className="flex items-center justify-center gap-1 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-blue-600 data-[state=active]:to-cyan-700 data-[state=active]:text-white data-[state=active]:border-blue-300 data-[state=active]:shadow-[0_6px_20px_rgba(37,99,235,0.35)] dark:data-[state=active]:from-blue-600 dark:data-[state=active]:to-cyan-600 dark:data-[state=active]:border-blue-400 dark:data-[state=active]:shadow-[0_0_24px_rgba(59,130,246,0.55)] active:scale-95">
                <Moon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'النوم' : 'Sleep'}</span>
                <span className="sm:hidden text-center">{language === 'ar' ? 'نوم' : 'Sleep'}</span>
              </TabsTrigger>
              <TabsTrigger value="recovery" className="flex items-center justify-center gap-1 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:border-emerald-300 data-[state=active]:shadow-[0_6px_20px_rgba(16,185,129,0.35)] dark:data-[state=active]:from-emerald-600 dark:data-[state=active]:to-green-600 dark:data-[state=active]:border-emerald-400 dark:data-[state=active]:shadow-[0_0_24px_rgba(16,185,129,0.55)] active:scale-95">
                <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'التعافي' : 'Recovery'}</span>
                <span className="sm:hidden text-center">{language === 'ar' ? 'تعافي' : 'Recovery'}</span>
              </TabsTrigger>
              <TabsTrigger value="hrv-rhr" className="flex items-center justify-center gap-1 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-indigo-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:border-indigo-300 data-[state=active]:shadow-[0_6px_20px_rgba(30,58,138,0.35)] dark:data-[state=active]:from-indigo-600 dark:data-[state=active]:to-blue-700 dark:data-[state=active]:border-indigo-400 dark:data-[state=active]:shadow-[0_0_24px_rgba(79,70,229,0.55)] active:scale-95">
                <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">HRV/RHR</span>
                <span className="sm:hidden text-center">HRV</span>
              </TabsTrigger>
              <TabsTrigger value="strain" className="flex items-center justify-center gap-1 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-700 data-[state=active]:text-white data-[state=active]:border-violet-300 data-[state=active]:shadow-[0_6px_20px_rgba(139,92,246,0.35)] dark:data-[state=active]:from-violet-600 dark:data-[state=active]:to-fuchsia-600 dark:data-[state=active]:border-violet-400 dark:data-[state=active]:shadow-[0_0_24px_rgba(139,92,246,0.55)] active:scale-95">
                <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'الإجهاد' : 'Strain'}</span>
                <span className="sm:hidden text-center">{language === 'ar' ? 'إجهاد' : 'Strain'}</span>
              </TabsTrigger>
              <TabsTrigger value="workouts" className="flex items-center justify-center gap-1 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:border-orange-300 data-[state=active]:shadow-[0_6px_20px_rgba(234,88,12,0.35)] dark:data-[state=active]:from-orange-500 dark:data-[state=active]:to-red-600 dark:data-[state=active]:border-orange-400 dark:data-[state=active]:shadow-[0_0_24px_rgba(234,88,12,0.55)] active:scale-95">
                <Dumbbell className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'التمارين' : 'Workouts'}</span>
                <span className="sm:hidden text-center">{language === 'ar' ? 'تمارين' : 'Workouts'}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai-insights" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <AIInsights timeRange={timeRange} onTimeRangeChange={setTimeRange} metrics={metrics} />
              <WhoopDetails metrics={metrics} />
            </TabsContent>

            <TabsContent value="sleep" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <SleepTab 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange}
                sleepData={metrics?.sleep && sleepHours ? {
                  hours: sleepHours,
                  goalHours: 8,
                  performancePct: metrics.sleep.performance_pct || 0,
                  stages: {
                    deep: Math.round((sleepStages?.deep || 0) / 60000),
                    rem: Math.round((sleepStages?.rem || 0) / 60000),
                    light: Math.round((sleepStages?.light || 0) / 60000),
                    awake: Math.round((sleepStages?.awake || 0) / 60000)
                  },
                  bedtime: metrics.sleep.start ? new Date(metrics.sleep.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                  waketime: metrics.sleep.end ? new Date(metrics.sleep.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                  efficiency: sleepEfficiency || 0,
                  respiratoryRate: metrics.sleep.respiratory_rate || 0,
                  sleepConsistency: metrics.sleep.sleep_consistency_pct || 0,
                  disturbanceCount: metrics.sleep.disturbance_count || 0,
                  sleepCycleCount: metrics.sleep.sleep_cycle_count || 0,
                  sleepDebt: metrics.sleep.sleep_debt_ms ? Math.round(metrics.sleep.sleep_debt_ms / 60000) : 0
                } : undefined}
                weeklyData={sleepHist.map((s: any) => ({
                  date: s.start,
                  hours: typeof s.hours === 'number' ? s.hours : null,
                  deep: s.stages?.deep ? Math.round(s.stages.deep / 60000) : null,
                  rem: s.stages?.rem ? Math.round(s.stages.rem / 60000) : null,
                  light: s.stages?.light ? Math.round(s.stages.light / 60000) : null,
                  awake: s.stages?.awake ? Math.round(s.stages.awake / 60000) : null
                }))}
              />
            </TabsContent>

            <TabsContent value="recovery" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <RecoveryTab 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange}
                recoveryData={metrics?.recovery ? {
                  score: metrics.recovery.score || metrics.recovery.data?.score?.recovery_score || 0,
                  hrv: metrics.recovery.hrv_ms || metrics.recovery.data?.score?.hrv_rmssd_milli || 0,
                  rhr: metrics.recovery.rhr_bpm || metrics.recovery.data?.score?.resting_heart_rate || 0,
                  spo2: metrics.recovery.spo2_percentage || metrics.recovery.data?.score?.spo2_percentage || 0,
                  skinTemp: metrics.recovery.skin_temp_celsius || metrics.recovery.data?.score?.skin_temp_celsius || 0
                } : undefined}
                weeklyData={hrHistory.map((h: any) => ({
                  date: h.date,
                  recovery: typeof h.recovery === 'number' ? h.recovery : null,
                  hrv: typeof h.hrv === 'number' ? h.hrv : null,
                  rhr: typeof h.rhr === 'number' ? h.rhr : null
                }))}
              />
            </TabsContent>

            <TabsContent value="hrv-rhr" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <HRVRHRTab 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange}
                currentData={metrics?.recovery ? {
                  hrv: metrics.recovery.hrv_ms || metrics.recovery.data?.score?.hrv_rmssd_milli || 0,
                  rhr: metrics.recovery.rhr_bpm || metrics.recovery.data?.score?.resting_heart_rate || 0
                } : undefined}
                weeklyData={hrHistory.map((h: any) => ({
                  date: h.date,
                  hrv: typeof h.hrv === 'number' ? h.hrv : null,
                  rhr: typeof h.rhr === 'number' ? h.rhr : null
                }))}
              />
            </TabsContent>

            <TabsContent value="strain" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <StrainTab 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange}
                strainData={metrics?.cycle ? {
                  dayStrain: metrics.cycle.day_strain || metrics.cycle.data?.score?.strain || 0,
                  trainingLoad: metrics.cycle.training_load || metrics.cycle.data?.score?.training_load || 0,
                  avgHr: metrics.cycle.avg_hr_bpm || metrics.cycle.data?.score?.average_heart_rate || 0,
                  maxHr: metrics.cycle.max_hr_bpm || metrics.cycle.data?.score?.max_heart_rate || 0
                } : undefined}
                weeklyData={cycleHist.map((c: any) => ({
                  date: c.start,
                  strain: typeof c.day_strain === 'number' ? c.day_strain : null,
                  avgHr: typeof c.avg_hr_bpm === 'number' ? c.avg_hr_bpm : null,
                  trainingLoad: typeof c.training_load === 'number' ? c.training_load : null
                }))}
              />
            </TabsContent>

            <TabsContent value="workouts" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <WorkoutsTab 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange}
                latestWorkout={metrics?.workout ? {
                  sport: metrics.workout.sport_name || 'Unknown',
                  duration: metrics.workout.start && metrics.workout.end ? 
                    Math.round((new Date(metrics.workout.end).getTime() - new Date(metrics.workout.start).getTime()) / 60000) : 0,
                  strain: metrics.workout.strain || 0,
                  calories: todayStats.kcal || 0,
                  avgHr: metrics.workout.data?.score?.average_heart_rate || 0,
                  maxHr: metrics.workout.data?.score?.max_heart_rate || 0
                } : undefined}
                workoutHistory={workoutsHist.map((w: any) => ({
                  date: w.start,
                  sport: w.sport || 'Workout',
                  duration: w.start && w.end ? Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000) : 0,
                  strain: w.strain || 0,
                  calories: w.kcal || 0,
                  avgHr: w.avg_hr_bpm || 0
                }))}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card className="rounded-2xl p-12 bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20 text-center">
          <WifiOff className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <h3 className="text-lg font-semibold mb-2">
            {language === 'ar' ? 'غير متصل بـ WHOOP' : 'Not Connected to WHOOP'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {language === 'ar' ? 'قم بتوصيل حسابك في WHOOP للوصول إلى التحليل الصحي المتقدم' : 'Connect your WHOOP account to access advanced health analytics'}
          </p>
          <Button onClick={onConnect} disabled={connecting} size="lg" className="bg-emerald-500/20 hover:bg-emerald-500/30">
            <Wifi className="h-4 w-4 mr-2" />
            {connecting 
              ? (language === 'ar' ? 'جار الاتصال...' : 'Connecting...') 
              : (language === 'ar' ? 'اتصال WHOOP' : 'Connect WHOOP')
            }
          </Button>
        </Card>
      )}
    </div>
  );
}