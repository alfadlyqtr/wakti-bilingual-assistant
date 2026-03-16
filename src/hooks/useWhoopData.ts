import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useWhoopData() {
  const { user } = useAuth();
  const [data, setData] = useState<{
    recovery: number | null;
    hrv: number | null;
    rhr: number | null;
    sleepPerformance: number | null;
    strain: number | null;
    connected: boolean;
    lastUpdated: Date | null;
  }>({
    recovery: null,
    hrv: null,
    rhr: null,
    sleepPerformance: null,
    strain: null,
    connected: false,
    lastUpdated: null,
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const { data: cache } = await supabase
          .from("user_whoop_metrics_cache")
          .select("metrics, status, updated_at")
          .eq("user_id", user.id)
          .single();

        if (!cache) return;

        const m = cache.metrics as any;
        const st = cache.status as any;
        const connected: boolean = st?.connected ?? false;

        // Recovery score — from metrics.recovery (may be null) or sleep performance as proxy
        const recoveryScore: number | null =
          m?.recovery?.score ?? m?.recovery?.recovery_score ?? null;

        // Sleep performance percentage
        const sleepPerf: number | null =
          m?.sleep?.performance_pct ??
          m?.sleep?.data?.score?.sleep_performance_percentage ??
          null;

        // Strain from latest cycle
        const strain: number | null =
          m?.cycle?.day_strain ?? m?.cycle?.data?.score?.strain ?? null;

        // HRV from recovery or body max heart rate as fallback
        const hrv: number | null = m?.recovery?.hrv_ms ?? null;

        // RHR
        const rhr: number | null = m?.recovery?.rhr_bpm ?? null;

        setData({
          recovery: recoveryScore ?? (sleepPerf !== null ? sleepPerf : null),
          hrv,
          rhr,
          sleepPerformance: sleepPerf,
          strain,
          connected,
          lastUpdated: cache.updated_at ? new Date(cache.updated_at) : null,
        });
      } catch (error) {
        console.error("Error fetching WHOOP data:", error);
      }
    };

    fetchData();
  }, [user]);

  return data;
}
