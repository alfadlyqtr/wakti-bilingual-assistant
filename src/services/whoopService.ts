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
    body: { mode: "user" },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) {
    console.error('whoop-sync error:', error);
    throw error;
  }
  console.log('WHOOP sync complete:', data);
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

