import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";

const STATE_KEY = "whoop_oauth_state";

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function isWhoopConnected(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const { data, error } = await supabase
    .from("user_whoop_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function startWhoopAuth(redirectUri: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("whoop-auth-start", {
    body: { redirect_uri: redirectUri },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (error) throw error;
  const { authorize_url, state } = data || {};
  if (state) localStorage.setItem(STATE_KEY, state);
  if (!authorize_url) throw new Error("Missing authorize_url");
  window.location.href = authorize_url;
}

export async function completeWhoopCallback(code: string, state: string | null, redirectUri: string) {
  const saved = localStorage.getItem(STATE_KEY);
  // simple check; we still forward even if missing
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("No auth token");

    // Use supabase.functions.invoke so auth is handled consistently
    const { data, error } = await supabase.functions.invoke('whoop-callback', {
      body: { code, state: state || saved, redirect_uri: redirectUri, user_token: accessToken },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-supabase-authorization': `Bearer ${accessToken}`,
      },
    });
    if (error) {
      // Mirror previous error shape for UI
      throw new Error(`whoop-callback ${error.status ?? 'error'}: ${typeof error.message === 'string' ? error.message : JSON.stringify(error)}`);
    }
    return data;
  } finally {
    localStorage.removeItem(STATE_KEY);
  }
}

export async function triggerUserSync() {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke("whoop-sync", {
    body: { mode: "user" },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (error) throw error;
  return data;
}

export async function fetchCompactMetrics() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const [sleepRes, recRes, cycleRes] = await Promise.all([
    supabase.from("whoop_sleep").select("start,end,duration_sec,performance_pct").eq("user_id", userId).order("start", { ascending: false }).limit(1),
    supabase.from("whoop_recovery").select("date,score,hrv_ms,rhr_bpm").eq("user_id", userId).order("date", { ascending: false }).limit(1),
    supabase.from("whoop_cycles").select("start,day_strain,avg_hr_bpm,training_load").eq("user_id", userId).order("start", { ascending: false }).limit(1),
  ]);

  const sleep = sleepRes.data?.[0] || null;
  const recovery = recRes.data?.[0] || null;
  const cycle = cycleRes.data?.[0] || null;
  return { sleep, recovery, cycle };
}

