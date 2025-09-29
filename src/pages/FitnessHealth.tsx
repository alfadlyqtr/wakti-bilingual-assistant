import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
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
  buildInsightsAggregate
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
  const [hrHistory, setHrHistory] = useState<{ date: string; recovery?: number | null; hrv?: number | null; rhr?: number | null }[]>([]);
  const [sleepHist, setSleepHist] = useState<{ start: string; end: string; hours: number | null }[]>([]);
  const [cycleHist, setCycleHist] = useState<{ start: string; day_strain?: number | null; avg_hr_bpm?: number | null; training_load?: number | null }[]>([]);
  const [workoutsHist, setWorkoutsHist] = useState<{ start: string; strain?: number | null; kcal?: number | null }[]>([]);
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    try { return localStorage.getItem('whoop_autosync') !== '0'; } catch { return true; }
  });
  const [activeTab, setActiveTab] = useState<MainTab>('ai-insights');
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');

  useEffect(() => {
    (async () => {
      const st = await getWhoopStatus();
      setStatus(st);
      setConnected(st.connected);
      if (st.connected) {
        const [m, rec, sl, cyc, wks] = await Promise.all([
          fetchCompactMetrics(),
          fetchRecoveryHistory(7),
          fetchSleepHistory(7),
          fetchCycleHistory(7),
          fetchWorkoutsHistory(14),
        ]);
        setMetrics(m);
        setHrHistory(rec);
        setSleepHist(sl.map((x:any)=>({ start: x.start, end: x.end, hours: x.hours })));
        setCycleHist(cyc);
        setWorkoutsHist(wks.map((w:any)=>({ start: w.start, strain: w.strain ?? null, kcal: w.kcal ?? null })));
        // Auto-sync if older than 1 hour and toggle enabled
        if (st.lastSyncedAt && autoSync) {
          const ageMs = Date.now() - new Date(st.lastSyncedAt).getTime();
          if (ageMs > 3600_000) {
            try {
              setSyncing(true);
              const res = await triggerUserSync();
              toast.success(`Synced: ${res?.counts?.cycles||0} cycles, ${res?.counts?.sleeps||0} sleeps, ${res?.counts?.workouts||0} workouts, ${res?.counts?.recoveries||0} recoveries`);
              const [m2, rec2, sl2, cyc2, wks2] = await Promise.all([fetchCompactMetrics(), fetchRecoveryHistory(7), fetchSleepHistory(7), fetchCycleHistory(7), fetchWorkoutsHistory(14)]);
              setMetrics(m2);
              setHrHistory(rec2);
              setSleepHist(sl2.map((x:any)=>({ start: x.start, end: x.end, hours: x.hours })));
              setCycleHist(cyc2);
              setWorkoutsHist(wks2.map((w:any)=>({ start: w.start, strain: w.strain ?? null, kcal: w.kcal ?? null })));
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
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="text-center px-2">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          {language === 'ar' ? 'الصحة واللياقة' : 'Fitness & Health'}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base px-4">
          {language === 'ar' ? 'تحليل شامل لبياناتك الصحية مع الذكاء الاصطناعي' : 'Comprehensive health data analysis with AI insights'}
        </p>
      </div>

      {/* Top Page Section */}
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
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MainTab)}>
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 bg-white/10 border-white/20 gap-1 p-1">
              <TabsTrigger value="ai-insights" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
                <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'رؤى الذكاء الاصطناعي' : 'AI Insights'}</span>
                <span className="sm:hidden">AI</span>
              </TabsTrigger>
              <TabsTrigger value="sleep" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
                <Moon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'النوم' : 'Sleep'}</span>
                <span className="sm:hidden">{language === 'ar' ? 'نوم' : 'Sleep'}</span>
              </TabsTrigger>
              <TabsTrigger value="recovery" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
                <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'التعافي' : 'Recovery'}</span>
                <span className="sm:hidden">{language === 'ar' ? 'تعافي' : 'Recovery'}</span>
              </TabsTrigger>
              <TabsTrigger value="hrv-rhr" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
                <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">HRV/RHR</span>
                <span className="sm:hidden">HRV</span>
              </TabsTrigger>
              <TabsTrigger value="strain" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
                <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'الإجهاد' : 'Strain'}</span>
                <span className="sm:hidden">{language === 'ar' ? 'إجهاد' : 'Strain'}</span>
              </TabsTrigger>
              <TabsTrigger value="workouts" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
                <Dumbbell className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'التمارين' : 'Workouts'}</span>
                <span className="sm:hidden">{language === 'ar' ? 'تمارين' : 'Workouts'}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai-insights" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <AIInsights timeRange={timeRange} onTimeRangeChange={setTimeRange} />
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
                    deep: Math.round((sleepStages?.deep || 0) / 60000), // Convert ms to minutes
                    rem: Math.round((sleepStages?.rem || 0) / 60000),
                    light: Math.round((sleepStages?.light || 0) / 60000),
                    awake: 0
                  },
                  bedtime: metrics.sleep.start ? new Date(metrics.sleep.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                  waketime: metrics.sleep.end ? new Date(metrics.sleep.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                  efficiency: sleepEfficiency || 0
                } : undefined}
              />
            </TabsContent>

            <TabsContent value="recovery" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <RecoveryTab 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange}
                recoveryData={metrics?.recovery ? {
                  score: metrics.recovery.score || 0,
                  hrv: metrics.recovery.hrv_ms || 0,
                  rhr: metrics.recovery.rhr_bpm || 0
                } : undefined}
              />
            </TabsContent>

            <TabsContent value="hrv-rhr" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <HRVRHRTab 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange}
                currentData={metrics?.recovery ? {
                  hrv: metrics.recovery.hrv_ms || 0,
                  rhr: metrics.recovery.rhr_bpm || 0
                } : undefined}
              />
            </TabsContent>

            <TabsContent value="strain" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <StrainTab 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange}
                strainData={metrics?.cycle ? {
                  dayStrain: metrics.cycle.day_strain || 0,
                  trainingLoad: metrics.cycle.training_load || 0,
                  avgHr: metrics.cycle.avg_hr_bpm || 0,
                  maxHr: metrics.cycle.max_hr_bpm || 0
                } : undefined}
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

