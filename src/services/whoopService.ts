// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

const STATE_KEY = "whoop_oauth_state";
const REDIRECT_URI_KEY = "whoop_redirect_uri";

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

// Convert time range to number of days
export function timeRangeToDays(timeRange: TimeRange): number {
  switch (timeRange) {
    case '1d': return 1;
    case '1w': return 7;
    case '2w': return 14;
    case '1m': return 30;
    case '3m': return 90;
    case '6m': return 180;
    default: return 7;
  }
}

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

export async function pingAiInsights() {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const { data, error } = await supabase.functions.invoke('whoop-ai-insights', {
    body: { ping: true },
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (error) throw error;
  return data;
}

export async function buildInsightsAggregate() {
  // FIX: Force fresh data for AI insights to ensure accuracy
  const [compact, sleep7, rec7, cyc30, w14] = await Promise.all([
    fetchCompactMetrics(true),
    fetchSleepHistory(7, true),
    fetchRecoveryHistory(7, true),
    fetchCycleHistory(30, true),
    fetchWorkoutsHistory(14, true),
  ]);

  const latestSleepHours = (() => {
    const s = compact?.sleep;
    if (!s) return null;
    if (typeof s.duration_sec === 'number') return Math.round((s.duration_sec/360))/10;
    const st = s?.data?.score?.stage_summary;
    if (st) {
      const total = (st.deep_sleep_milli??0)+(st.rem_sleep_milli??0)+(st.light_sleep_milli??0);
      return total ? Math.round((total/360000))/10 : null;
    }
    return null;
  })();

  const latestWorkout = (() => {
    const w = compact?.workout;
    if (!w) return null;
    const start = w.start ? new Date(w.start) : null;
    const end = w.end ? new Date(w.end) : null;
    const durationMin = start && end ? Math.round((end.getTime()-start.getTime())/60000) : null;
    const kcal = w?.data?.score?.kilojoule ? Math.round((w.data.score.kilojoule||0)/4.184) : null;
    return {
      sport: w.sport_name ?? 'workout',
      durationMin,
      strain: w.strain ?? (w?.data?.score?.strain ?? null),
      kcal,
    };
  })();

  const weekly = (() => {
    // reduce cycles into ISO Week buckets
    const byWeek = new Map<string, { load: number; hr: number[] }>();
    for (const c of cyc30) {
      const dt = new Date(c.start);
      const key = `${dt.getFullYear()}-W${weekOfYear(dt)}`;
      const prev = byWeek.get(key) || { load: 0, hr: [] };
      prev.load += (typeof c.training_load === 'number' ? c.training_load : (typeof c.day_strain === 'number' ? c.day_strain : 0));
      if (typeof c.avg_hr_bpm === 'number') prev.hr.push(c.avg_hr_bpm);
      byWeek.set(key, prev);
    }
    const keys = Array.from(byWeek.keys()).sort();
    return keys.map((k) => ({
      label: k,
      load: Math.round(byWeek.get(k)!.load*10)/10,
      avgHr: avg(byWeek.get(k)!.hr) ?? null,
    }));
  })();

  return {
    today: {
      sleepHours: latestSleepHours,
      sleepPerformancePct: compact?.sleep?.performance_pct ?? null,
      recoveryPct: compact?.recovery?.score ?? null,
      hrvMs: compact?.recovery?.hrv_ms ?? null,
      rhrBpm: compact?.recovery?.rhr_bpm ?? null,
      dayStrain: compact?.cycle?.day_strain ?? null,
      latestWorkout,
      // ADD ALL COMPREHENSIVE SLEEP DATA
      sleepConsistencyPct: compact?.sleep?.data?.score?.sleep_consistency_percentage ?? null,
      sleepEfficiencyPct: compact?.sleep?.data?.score?.sleep_efficiency_percentage ?? null,
      respiratoryRate: compact?.sleep?.data?.score?.respiratory_rate ?? null,
      sleepCycleCount: compact?.sleep?.data?.score?.stage_summary?.sleep_cycle_count ?? null,
      disturbanceCount: compact?.sleep?.data?.score?.stage_summary?.disturbance_count ?? null,
      sleepDebtMilli: compact?.sleep?.data?.score?.sleep_needed?.need_from_sleep_debt_milli ?? null,
      // ADD ALL COMPREHENSIVE RECOVERY DATA
      spo2Percentage: compact?.recovery?.data?.score?.spo2_percentage ?? null,
      skinTempCelsius: compact?.recovery?.data?.score?.skin_temp_celsius ?? null,
      userCalibrating: compact?.recovery?.data?.score?.user_calibrating ?? null,
      // ADD ALL COMPREHENSIVE CYCLE DATA
      maxHeartRate: compact?.cycle?.data?.score?.max_heart_rate ?? null,
      kilojoule: compact?.cycle?.data?.score?.kilojoule ?? null,
    },
    last7Days: {
      sleepHours: sleep7.map((s:any)=>s.hours ?? null),
      recoveryPct: rec7.map((r:any)=>r.recovery ?? null),
      hrvMs: rec7.map((r:any)=>r.hrv ?? null),
      rhrBpm: rec7.map((r:any)=>r.rhr ?? null),
      // ADD COMPREHENSIVE HISTORICAL DATA
      sleepConsistency: sleep7.map((s:any)=>s?.data?.score?.sleep_consistency_percentage ?? null),
      sleepEfficiency: sleep7.map((s:any)=>s?.data?.score?.sleep_efficiency_percentage ?? null),
      respiratoryRate: sleep7.map((s:any)=>s?.data?.score?.respiratory_rate ?? null),
      spo2: rec7.map((r:any)=>r?.data?.score?.spo2_percentage ?? null),
      skinTemp: rec7.map((r:any)=>r?.data?.score?.skin_temp_celsius ?? null),
    },
    workouts: w14,
    weekly: { weeks: weekly },
    // COMPREHENSIVE DETAILS - NOW INCLUDES ALL DATA
    details: {
      cycle: compact?.cycle ?? null,  // Full cycle object with ALL fields
      sleep: compact?.sleep ?? null,  // Full sleep object with ALL fields
      recovery: compact?.recovery ?? null,  // Full recovery object with ALL fields
      workout: compact?.workout ?? null,  // Full workout object with ALL fields
    },
    // ADD RAW COMPREHENSIVE DATA FOR AI
    raw: {
      sleep_full: compact?.sleep,
      recovery_full: compact?.recovery,
      cycle_full: compact?.cycle,
      workout_full: compact?.workout,
      sleep_history: sleep7,
      recovery_history: rec7,
      cycle_history: cyc30,
      workout_history: w14,
    },
    // ADD USER PROFILE AND BODY DATA
    user: {
      profile: compact?.profile,
      body: compact?.body,
      first_name: compact?.profile?.first_name || null,
      height_meter: compact?.body?.height_meter || null,
      weight_kilogram: compact?.body?.weight_kilogram || null,
      max_heart_rate: compact?.body?.max_heart_rate || null,
    }
  };
}

export async function generateAiInsights(
  language: 'en'|'ar' = 'en', 
  options?: {
    time_of_day?: string;
    user_timezone?: string;
    data?: any;
  },
  timeoutMs = 30000
) {
  const dataFull = options?.data || await buildInsightsAggregate();
  // Send FULL comprehensive payload to AI - include ALL WHOOP data
  const data = {
    today: dataFull.today,
    last7Days: dataFull.last7Days,
    workouts: (dataFull.workouts || []).slice(-20),
    weekly: dataFull.weekly,
    details: dataFull.details,  // Include comprehensive details
    raw: dataFull.raw,          // Include raw comprehensive data
    user: dataFull.user,        // Include user profile data with first_name
  };
  
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const userEmail = sessionData?.session?.user?.email;
  console.log('Calling Edge Function with payload:', {
    data: Object.keys(data),
    language,
    time_of_day: options?.time_of_day || 'general',
    user_timezone: options?.user_timezone || 'UTC',
    user_email: userEmail
  });

  const req = supabase.functions.invoke('whoop-ai-insights', {
    body: { 
      data, 
      language,
      time_of_day: options?.time_of_day || 'general',
      user_timezone: options?.user_timezone || 'UTC',
      user_email: userEmail
    },
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('ai_timeout')), timeoutMs));
  const { data: resp, error } = await Promise.race([req, timeout]) as any;
  
  console.log('Edge Function response:', { resp, error });
  
  if (error) {
    console.error('Edge Function error:', error);
    throw error;
  }
  return resp;
}

function avg(arr: number[]) { if (!arr || arr.length===0) return null as any; return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length); }
function weekOfYear(d: Date) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7; dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  return Math.ceil((((dt as any)- (yearStart as any)) / 86400000 + 1)/7);
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
  if (state) try { localStorage.setItem(STATE_KEY, state); } catch (_) {}
  console.log('Redirecting to WHOOP authorization...');
  const popup = window.open(authorize_url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.href = authorize_url;
  }
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

export async function fetchCompactMetrics(forceFresh = false) {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  // Fetch ALL available WHOOP data fields - comprehensive extraction
  const [sleepRes, recRes, cycleRes, profileRes, bodyRes] = await Promise.all([
    // SLEEP: Pull ALL sleep fields including score data (latest first)
    supabase.from("whoop_sleep").select("*").eq("user_id", userId).order("start", { ascending: false }).limit(5),
    // RECOVERY: Pull ALL recovery fields including score data (latest first)
    supabase.from("whoop_recovery").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    // CYCLE: Pull ALL cycle fields including score data (latest first)
    supabase.from("whoop_cycles").select("*").eq("user_id", userId).order("start", { ascending: false }).limit(1),
    // USER PROFILE: Pull user profile data
    supabase.from("whoop_user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    // USER BODY: Pull body measurements
    supabase.from("whoop_user_body").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  // Choose main sleep: prefer nap=false if present, else longest duration
  const sleeps = sleepRes.data || [];
  let sleep = null as any;
  const nonNaps = sleeps.filter((s: any) => s?.data?.nap === false);
  if (nonNaps.length > 0) sleep = nonNaps[0];
  else if (sleeps.length > 0) {
    sleep = [...sleeps].sort((a: any, b: any) => {
      const da = (a.duration_sec ?? ((new Date(a.end).getTime()-new Date(a.start).getTime())/1000)) || 0;
      const db = (b.duration_sec ?? ((new Date(b.end).getTime()-new Date(b.start).getTime())/1000)) || 0;
      return db - da;
    })[0];
  }
  const recovery = recRes.data?.[0] || null;
  const cycle = cycleRes.data?.[0] || null;
  const profile = profileRes.data || null;
  const body = bodyRes.data || null;
  // WORKOUT: Pull ALL workout fields including comprehensive score data
  const workoutRes = await supabase.from('whoop_workouts')
    .select('*')
    .eq('user_id', userId)
    .order('start', { ascending: false })
    .limit(1);
  const workout = workoutRes.data?.[0] || null;
  return { sleep, recovery, cycle, workout, profile, body };
}

export async function fetchRecoveryHistory(days = 7, forceFresh = false) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  // FIX: Add time filter for cache busting
  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from('whoop_recovery')
    .select('*')  // Pull ALL recovery fields
    .eq('user_id', userId)
    .gte('created_at', cutoffDate)
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

export async function fetchSleepHistory(days = 7, forceFresh = false) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  // FIX: Add time filter for cache busting
  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from('whoop_sleep')
    .select('*')  // Pull ALL sleep fields
    .eq('user_id', userId)
    .gte('start', cutoffDate)
    .order('start', { ascending: false })
    .limit(days);
  if (error || !data) return [];
  const items = [...data].reverse().map((s: any) => {
    const stage = s?.data?.score?.stage_summary || {};
    const deep = stage.deep_sleep_milli ?? stage.deep_milli ?? 0;
    const rem = stage.rem_sleep_milli ?? stage.rem_milli ?? 0;
    const light = stage.light_sleep_milli ?? stage.light_milli ?? 0;
    const total = (deep + rem + light) || stage.total_in_bed_milli || (s.duration_sec ? s.duration_sec * 1000 : 0);
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

export async function fetchCycleHistory(days = 7, forceFresh = false) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  // FIX: Add time filter for cache busting
  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from('whoop_cycles')
    .select('*')  // Pull ALL cycle fields
    .eq('user_id', userId)
    .gte('start', cutoffDate)
    .order('start', { ascending: false })
    .limit(days);
  if (error || !data) return [];
  return [...data].reverse();
}

export async function fetchWorkoutsHistory(days = 14, forceFresh = false) {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  // FIX: Add time filter for cache busting
  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from('whoop_workouts')
    .select('*')  // Pull ALL workout fields
    .eq('user_id', userId)
    .gte('start', cutoffDate)
    .order('start', { ascending: false })
    .limit(1000);
  if (error || !data) return [];
  const cutoff = Date.now() - days * 86400000;
  return data
    .filter((w: any) => w.start && new Date(w.start).getTime() >= cutoff)
    .map((w: any) => ({
      start: w.start,
      end: w.end,
      sport: w.sport_name || 'Workout',
      strain: w.strain ?? (w?.data?.score?.strain ?? null),
      kcal: w?.data?.score?.kilojoule ? Math.round((w.data.score.kilojoule || 0) / 4.184) : null,
      avg_hr_bpm: w.avg_hr_bpm ?? (w?.data?.score?.average_heart_rate ?? null),
    }))
    .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

// Fetch all historical data for a specific time range
export async function fetchHistoricalData(timeRange: TimeRange, forceFresh = false) {
  // Ensure trends always have multiple points: fetch at least 7 days
  const days = Math.max(7, timeRangeToDays(timeRange));
  
  // FIX: Support forceFresh parameter for cache busting
  const [recovery, sleep, cycles, workouts] = await Promise.all([
    fetchRecoveryHistory(days, forceFresh),
    fetchSleepHistory(days, forceFresh),
    fetchCycleHistory(days, forceFresh),
    fetchWorkoutsHistory(days, forceFresh)
  ]);

  return {
    recovery,
    sleep,
    cycles,
    workouts
  };
}
