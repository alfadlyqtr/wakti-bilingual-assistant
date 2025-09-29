import { supabase } from "@/integrations/supabase/client";

const STATE_KEY = "whoop_oauth_state";
const REDIRECT_URI_KEY = "whoop_redirect_uri";

// Determine redirect URI based on environment
function getRedirectUri(): string {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  const redirectUri = isDev
    ? 'http://localhost:8080/whoop/callback'
    : 'https://www.wakti.qa/whoop/callback';
  console.log('getRedirectUri:', { hostname, isDev, redirectUri });
  return redirectUri;
}

export async function getWhoopStatus(): Promise<{ connected: boolean; lastSyncedAt: string | null; }>{
  const userId = await getCurrentUserId();
  if (!userId) return { connected: false, lastSyncedAt: null };
  const { data, error } = await supabase
    .from('user_whoop_tokens')
    .select('last_synced_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return { connected: false, lastSyncedAt: null };
  return { connected: true, lastSyncedAt: data.last_synced_at };
}

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

export async function startWhoopAuth(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("You must be logged in to connect WHOOP");

  const redirectUri = getRedirectUri();
  localStorage.setItem(REDIRECT_URI_KEY, redirectUri);
  console.log('Starting WHOOP auth:', { redirectUri, hasToken: !!accessToken });

  const { data, error } = await supabase.functions.invoke("whoop-auth-start", {
    body: { redirect_uri: redirectUri },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) {
    console.error('whoop-auth-start error:', error);
    throw error;
  }
  const { authorize_url, state } = data || {};
  if (!authorize_url) throw new Error("Missing authorize_url");
  console.log('Redirecting to WHOOP authorization...');
  window.location.href = authorize_url;
}

export async function completeWhoopCallback(code: string, state: string | null) {
  const savedState = localStorage.getItem(STATE_KEY);
  const savedRedirectUri = localStorage.getItem(REDIRECT_URI_KEY);
  const redirectUri = savedRedirectUri || getRedirectUri();

  console.log('Completing callback:', {
    code: code.substring(0, 10) + '...',
    state,
    savedState,
    redirectUri,
    stateMatch: state === savedState
  });

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("No auth token - please log in again");

    const { data, error } = await supabase.functions.invoke('whoop-callback', {
      body: { code, state: state || savedState, redirect_uri: redirectUri },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-supabase-authorization': `Bearer ${accessToken}`,
      },
    });
    if (error) {
      console.error('whoop-callback error:', error);
      throw new Error(`WHOOP connection failed: ${error.message || JSON.stringify(error)}`);
    }
    console.log('WHOOP connected successfully:', data);
    return data;
  } finally {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(REDIRECT_URI_KEY);
  }
}

export async function triggerUserSync() {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("You must be logged in to sync WHOOP data");
  console.log('Triggering WHOOP sync...');
  const { data, error } = await supabase.functions.invoke("whoop-sync", {
    body: { mode: "user", user_token: accessToken },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-supabase-authorization': `Bearer ${accessToken}`,
    },
  });
  if (error) {
    console.error('whoop-sync error:', error);
    throw error;
  }
  console.log('WHOOP sync complete:', data);
  return data;
}

export async function disconnectWhoop() {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('You must be logged in');
  console.log('Disconnecting WHOOP for user', uid);
  const { error } = await supabase
    .from('user_whoop_tokens')
    .delete()
    .eq('user_id', uid);
  if (error) {
    console.error('disconnectWhoop error:', error);
    throw error;
  }
  return { success: true };
}

export async function fetchCompactMetrics() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const [sleepRes, recRes, cycleRes] = await Promise.all([
    supabase.from("whoop_sleep").select("start,end,duration_sec,performance_pct,data").eq("user_id", userId).order("start", { ascending: false }).limit(1),
    supabase.from("whoop_recovery").select("date,score,hrv_ms,rhr_bpm").eq("user_id", userId).order("date", { ascending: false }).limit(1),
    supabase.from("whoop_cycles").select("start,day_strain,avg_hr_bpm,training_load").eq("user_id", userId).order("start", { ascending: false }).limit(1),
  ]);

  const sleep = sleepRes.data?.[0] || null;
  const recovery = recRes.data?.[0] || null;
  const cycle = cycleRes.data?.[0] || null;
  // latest workout
  const workoutRes = await supabase.from('whoop_workouts')
    .select('id,start,end,sport_name,strain,avg_hr_bpm,data')
    .eq('user_id', userId)
    .order('start', { ascending: false })
    .limit(1);
  const workout = workoutRes.data?.[0] || null;
  return { sleep, recovery, cycle, workout };
}

export async function fetchRecoveryHistory(days = 7) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('whoop_recovery')
    .select('score,hrv_ms,rhr_bpm,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(days);
  if (error || !data) return [];
  const items = [...data].reverse().map((r: any) => ({
    date: r.created_at,
    recovery: r.score,
    hrv: r.hrv_ms,
    rhr: r.rhr_bpm,
  }));
  return items;
}

export async function fetchSleepHistory(days = 7) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('whoop_sleep')
    .select('start,end,duration_sec,data')
    .eq('user_id', userId)
    .order('start', { ascending: false })
    .limit(days);
  if (error || !data) return [];
  const items = [...data].reverse().map((s: any) => {
    const stage = s?.data?.score?.stage_summary || {};
    const deep = stage.deep_sleep_milli ?? stage.deep_milli ?? 0;
    const rem = stage.rem_sleep_milli ?? stage.rem_milli ?? 0;
    const light = stage.light_sleep_milli ?? stage.light_milli ?? 0;
    const total = (deep + rem + light) || (s.duration_sec ? s.duration_sec * 1000 : 0);
    return {
      start: s.start,
      end: s.end,
      hours: s.duration_sec ? Math.round(s.duration_sec / 360) / 10 : Math.round(total / 360000) / 10,
      stages: {
        deep,
        rem,
        light,
        total
      }
    };
  });
  return items;
}

export async function fetchCycleHistory(days = 7) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('whoop_cycles')
    .select('start,day_strain,avg_hr_bpm,training_load')
    .eq('user_id', userId)
    .order('start', { ascending: false })
    .limit(days);
  if (error || !data) return [];
  return [...data].reverse();
}

export async function fetchWorkoutsHistory(days = 14) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('whoop_workouts')
    .select('start,end,strain,avg_hr_bpm,data')
    .eq('user_id', userId)
    .order('start', { ascending: false })
    .limit(1000);
  if (error || !data) return [];
  const cutoff = Date.now() - days * 86400000;
  return data
    .filter((w: any) => w.start && new Date(w.start).getTime() >= cutoff)
    .map((w: any) => ({
      start: w.start,
      end: w.end,
      strain: w.strain ?? (w?.data?.score?.strain ?? null),
      kcal: w?.data?.score?.kilojoule ? Math.round((w.data.score.kilojoule || 0) / 4.184) : null,
      avg_hr_bpm: w.avg_hr_bpm ?? (w?.data?.score?.average_heart_rate ?? null),
    }))
    .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

