import React, { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { isWhoopConnected, startWhoopAuth, triggerUserSync, fetchCompactMetrics, disconnectWhoop, getWhoopStatus, fetchRecoveryHistory } from "@/services/whoopService";
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
  const [hrHistory, setHrHistory] = useState<{ date: string; hrv?: number | null; rhr?: number | null }[]>([]);
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    try { return localStorage.getItem('whoop_autosync') !== '0'; } catch { return true; }
  });

  useEffect(() => {
    (async () => {
      const st = await getWhoopStatus();
      setStatus(st);
      setConnected(st.connected);
      if (st.connected) {
        const [m, rec] = await Promise.all([
          fetchCompactMetrics(),
          fetchRecoveryHistory(7)
        ]);
        setMetrics(m);
        setHrHistory(rec);
        // Auto-sync if older than 1 hour and toggle enabled
        if (st.lastSyncedAt && autoSync) {
          const ageMs = Date.now() - new Date(st.lastSyncedAt).getTime();
          if (ageMs > 3600_000) {
            try {
              setSyncing(true);
              const res = await triggerUserSync();
              toast.success(`Synced: ${res?.counts?.cycles||0} cycles, ${res?.counts?.sleeps||0} sleeps, ${res?.counts?.workouts||0} workouts, ${res?.counts?.recoveries||0} recoveries`);
              const [m2, rec2] = await Promise.all([fetchCompactMetrics(), fetchRecoveryHistory(7)]);
              setMetrics(m2);
              setHrHistory(rec2);
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
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ai">AI Insights</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-6 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <SleepCard
                  hours={sleepHours}
                  performancePct={metrics?.sleep?.performance_pct ?? null}
                  stages={sleepStages}
                />
                <RecoveryCard value={metrics?.recovery?.score ?? null} />
                <HRVRHRMini data={hrHistory} />
                <StrainCard value={metrics?.cycle?.day_strain ?? null} />
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

