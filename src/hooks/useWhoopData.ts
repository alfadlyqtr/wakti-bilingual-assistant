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
    sleepHours: number | null;
    sleepConsistency: number | null;
    strain: number | null;
    avgHr: number | null;
    connected: boolean;
    lastUpdated: Date | null;
  }>({
    recovery: null,
    hrv: null,
    rhr: null,
    sleepPerformance: null,
    sleepHours: null,
    sleepConsistency: null,
    strain: null,
    avgHr: null,
    connected: false,
    lastUpdated: null,
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // SAFE-GUARD: Only query Whoop cache if user has a connected Whoop token.
        // Prevents repeated 406 errors for users who never connected Whoop.
        const { data: tokenRow } = await supabase
          .from("user_whoop_tokens")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!tokenRow) return;

        const { data: cache } = await supabase
          .from("user_whoop_metrics_cache")
          .select("metrics, status, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();

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

        // HRV + RHR from recovery record
        const hrv: number | null = m?.recovery?.hrv_ms ?? null;
        const rhr: number | null = m?.recovery?.rhr_bpm ?? null;

        // Sleep hours from latest sleep record
        const sleepMs: number | null =
          m?.sleep?.data?.score?.stage_summary?.total_in_bed_time_milli ?? null;
        const sleepHours: number | null = sleepMs != null ? Math.round((sleepMs / 3600000) * 10) / 10 : null;

        // Sleep consistency %
        const sleepConsistency: number | null =
          m?.sleep?.data?.score?.sleep_consistency_percentage ?? null;

        // Average HR from latest cycle
        const avgHr: number | null =
          m?.cycle?.avg_hr_bpm ?? m?.cycle?.data?.score?.average_heart_rate ?? null;

        setData({
          recovery: recoveryScore ?? (sleepPerf !== null ? sleepPerf : null),
          hrv,
          rhr,
          sleepPerformance: sleepPerf,
          sleepHours,
          sleepConsistency,
          strain,
          avgHr,
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
