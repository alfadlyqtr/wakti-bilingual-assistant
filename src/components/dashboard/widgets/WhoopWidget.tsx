import React, { useEffect, useState } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { startWhoopAuth, isWhoopConnected, fetchCompactMetrics } from "@/services/whoopService";
import { useNavigate } from "react-router-dom";

export const WhoopWidget: React.FC = () => {
  const { language } = useTheme();
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<any>(null);
  const navigate = useNavigate();

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
    const redirect = `${window.location.origin}/fitness/callback`;
    await startWhoopAuth(redirect);
  };

  if (loading) {
    return (
      <div className="p-4">
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'WHOOP' : 'WHOOP'}</CardTitle>
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
          {language === 'ar' ? 'قم بتوصيل حساب WHOOP لعرض النوم، الاستشفاء، والإجهاد اليومي.' : 'Connect your WHOOP account to view sleep, recovery, and daily strain.'}
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

  return (
    <div className="p-4">
      <CardHeader>
        <CardTitle>{language === 'ar' ? 'ملخص WHOOP' : 'WHOOP Summary'}</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-muted-foreground">{language === 'ar' ? 'النوم (آخر ليلة)' : 'Sleep (last night)'} </div>
          <div className="text-lg font-semibold">{sleep ? `${Math.round((sleep.duration_sec ?? 0)/3600)}h` : '--'}</div>
          <div className="text-xs">{sleep?.performance_pct ? `${Math.round(sleep.performance_pct)}%` : ''}</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الاستشفاء' : 'Recovery'}</div>
          <div className="text-lg font-semibold">{recovery?.score != null ? Math.round(recovery.score) : '--'}%</div>
          <div className="text-[11px] text-muted-foreground">HRV {recovery?.hrv_ms ?? '--'} • RHR {recovery?.rhr_bpm ?? '--'}</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الإجهاد اليومي' : 'Day Strain'}</div>
          <div className="text-lg font-semibold">{cycle?.day_strain != null ? Math.round(cycle.day_strain) : '--'}</div>
          <div className="text-[11px] text-muted-foreground">Avg HR {cycle?.avg_hr_bpm ?? '--'}</div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <Button variant="secondary" className="w-full" onClick={() => navigate('/fitness')}>
          {language === 'ar' ? 'فتح الصحة واللياقة' : 'Open Fitness & Health'}
        </Button>
      </div>
    </div>
  );
};
