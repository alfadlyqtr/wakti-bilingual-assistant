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
    lastUpdated: Date | null;
  }>({
    recovery: null,
    hrv: null,
    rhr: null,
    sleepPerformance: null,
    strain: null,
    lastUpdated: null,
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch latest recovery
        const { data: recoveryData } = await supabase
          .from("whoop_recovery")
          .select("score, hrv_ms, rhr_bpm, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Fetch latest cycle/strain (if available, assume table is whoop_cycles based on typical schema)
        // Adjust table name if needed based on previous schema check which showed whoop_cycles exists
        const { data: cycleData } = await supabase
          .from("whoop_cycles")
          .select("day_strain, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        setData({
          recovery: recoveryData?.score ?? null,
          hrv: recoveryData?.hrv_ms ?? null,
          rhr: recoveryData?.rhr_bpm ?? null,
          sleepPerformance: null, // Add sleep fetch if table exists
          strain: cycleData?.day_strain ?? null,
          lastUpdated: recoveryData?.created_at ? new Date(recoveryData.created_at) : null,
        });
      } catch (error) {
        console.error("Error fetching WHOOP data:", error);
      }
    };

    fetchData();
  }, [user]);

  return data;
}
