import React, { useEffect, useState } from "react";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { isWhoopConnected, startWhoopAuth, triggerUserSync, fetchCompactMetrics, disconnectWhoop } from "@/services/whoopService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function FitnessHealth() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const ok = await isWhoopConnected();
      setConnected(ok);
      if (ok) {
        const m = await fetchCompactMetrics();
        setMetrics(m);
      }
      setLoading(false);
    })();
  }, []);

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
      await triggerUserSync();
      const m = await fetchCompactMetrics();
      setMetrics(m);
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

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{language === 'ar' ? 'الصحة واللياقة' : 'Fitness & Health'}</h1>
          <p className="text-muted-foreground">{language === 'ar' ? 'اتصل بـ WHOOP للاطلاع على النوم، الاستشفاء، والتمارين مع رؤى ذكية.' : 'Connect WHOOP to view sleep, recovery, and workouts with smart insights.'}</p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">{language === 'ar' ? 'جار التحميل...' : 'Loading...'}</div>
        ) : !connected ? (
          <div className="rounded-xl border p-6 bg-white/5">
            <div className="mb-4 text-sm text-muted-foreground">{language === 'ar' ? 'قم بتوصيل حسابك في WHOOP لبدء المزامنة.' : 'Connect your WHOOP account to start syncing.'}</div>
            <Button onClick={onConnect} disabled={connecting}>{connecting ? (language === 'ar' ? 'جار البدء...' : 'Starting...') : (language === 'ar' ? 'اتصال WHOOP' : 'Connect WHOOP')}</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onSync} disabled={syncing}>{syncing ? (language === 'ar' ? 'جاري المزامنة...' : 'Syncing...') : (language === 'ar' ? 'مزامنة الآن' : 'Sync Now')}</Button>
              <Button variant="outline" onClick={onDisconnect} disabled={disconnecting}>{disconnecting ? (language === 'ar' ? 'يجري الفصل...' : 'Disconnecting...') : (language === 'ar' ? 'تسجيل خروج WHOOP' : 'Disconnect WHOOP')}</Button>
            </div>

            {/* Overview (Today) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border p-4 bg-white/5">
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'النوم (آخر ليلة)' : 'Sleep (Last Night)'}</div>
                <div className="text-2xl font-semibold">{metrics?.sleep ? `${Math.round((metrics.sleep.duration_sec ?? 0)/3600)}h` : '--'}</div>
                <div className="text-xs text-muted-foreground">{metrics?.sleep?.performance_pct ? `${Math.round(metrics.sleep.performance_pct)}%` : ''}</div>
              </div>
              <div className="rounded-xl border p-4 bg-white/5">
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الاستشفاء' : 'Recovery'}</div>
                <div className="text-2xl font-semibold">{metrics?.recovery?.score != null ? Math.round(metrics.recovery.score) : '--'}%</div>
                <div className="text-xs text-muted-foreground">HRV {metrics?.recovery?.hrv_ms ?? '--'} • RHR {metrics?.recovery?.rhr_bpm ?? '--'}</div>
              </div>
              <div className="rounded-xl border p-4 bg-white/5">
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الإجهاد اليومي' : 'Day Strain'}</div>
                <div className="text-2xl font-semibold">{metrics?.cycle?.day_strain != null ? Math.round(metrics.cycle.day_strain) : '--'}</div>
                <div className="text-xs text-muted-foreground">Avg HR {metrics?.cycle?.avg_hr_bpm ?? '--'}</div>
              </div>
              <div className="rounded-xl border p-4 bg-white/5">
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'آخر تمرين' : 'Latest Workout'}</div>
                <div className="text-2xl font-semibold">--</div>
                <div className="text-xs text-muted-foreground">--</div>
              </div>
            </div>

            {/* Placeholders for Trends & AI Insights tabs (to be expanded) */}
            <div className="rounded-xl border p-4 bg-white/5">
              <div className="text-sm font-medium mb-2">{language === 'ar' ? 'الاتجاهات' : 'Trends'}</div>
              <div className="text-xs text-muted-foreground">{language === 'ar' ? 'قريباً: الرسوم البيانية اليومية/الأسبوعية/الشهرية.' : 'Coming soon: day/week/month charts.'}</div>
            </div>

            <div className="rounded-xl border p-4 bg-white/5">
              <div className="text-sm font-medium mb-2">AI Insights</div>
              <div className="text-xs text-muted-foreground">{language === 'ar' ? 'قريباً: ملخصات يومية/أسبوعية ونصائح ومحفزات.' : 'Coming soon: daily/weekly summaries, tips, motivations.'}</div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

