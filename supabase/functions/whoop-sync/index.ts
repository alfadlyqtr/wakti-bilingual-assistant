import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const BASE = "https://api.prod.whoop.com/developer/v2";
const SLEEP_URL = `${BASE}/activity/sleep`;
const WORKOUT_URL = `${BASE}/activity/workout`;
const CYCLE_URL = `${BASE}/cycle`;
const RECOVERY_URL = `${BASE}/recovery`;
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function refreshToken(refresh_token: string, client_id: string, client_secret: string) {
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refresh_token);
  body.set("client_id", client_id);
  body.set("client_secret", client_secret);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`refresh failed ${res.status}`);
  return res.json();
}

async function fetchCollection(url: string, accessToken: string, params: Record<string, string>) {
  const records: any[] = [];
  let nextToken: string | undefined = undefined;
  const headers = { Authorization: `Bearer ${accessToken}` };

  do {
    const u = new URL(url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    if (nextToken) u.searchParams.set("next_token", nextToken);
    // Log each page request with safe token prefix and parameters
    console.log("whoop-sync: requesting", {
      url: u.toString(),
      hasToken: !!accessToken,
      tokenPrefix: accessToken.substring(0, 12),
      nextToken,
    });
    const res = await fetch(u.toString(), { headers });
    if (!res.ok) {
      const t = await res.text();
      console.warn("WHOOP fetch non-200", url, res.status, t);
      break;
    }
    const json = await res.json();
    if (Array.isArray(json.records)) records.push(...json.records);
    nextToken = json.next_token || json.nextToken || undefined;
  } while (nextToken);

  return records;
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const whoopClientId = Deno.env.get("WHOOP_CLIENT_ID");
    const whoopClientSecret = Deno.env.get("WHOOP_CLIENT_SECRET");

    if (!whoopClientId || !whoopClientSecret) {
      return new Response(JSON.stringify({ error: "missing_whoop_credentials" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Accept user token from multiple sources
    let userAuthHeader =
      req.headers.get("x-supabase-authorization") ||
      req.headers.get("Authorization") ||
      "";

    // Admin client for RLS-bypassing writes and bulk reads
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
      global: SUPABASE_SERVICE_ROLE_KEY ? {} : { headers: { Authorization: userAuthHeader } },
    });

    const body = await req.json().catch(() => ({} as any));
    const bodyToken: string | undefined = (body as any)?.user_token;
    if (bodyToken && bodyToken.length > 0) {
      userAuthHeader = `Bearer ${bodyToken}`;
    }
    const bareToken = userAuthHeader.startsWith("Bearer ") ? userAuthHeader.substring(7) : userAuthHeader;
    const isUserMode = !!bareToken && !SUPABASE_SERVICE_ROLE_KEY;
    const mode = (body?.mode as string) || (isUserMode ? "user" : "bulk");
    const startParam = body?.start as string | undefined;
    const endParam = body?.end as string | undefined;

    let users: { user_id: string; access_token: string; refresh_token: string; expires_at: string; last_synced_at: string | null }[] = [];

    if (mode === "user") {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: {} } });
      const { data: userData } = await userClient.auth.getUser(bareToken);
      const uid = userData?.user?.id;
      if (!uid) {
        console.warn("whoop-sync: no uid from auth.getUser()", {
          hasAuthHeader: !!userAuthHeader,
          authHeaderPrefix: userAuthHeader?.substring(0, 20),
        });
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: tokenRow, error: tokenErr } = await admin
        .from("user_whoop_tokens")
        .select("user_id, access_token, refresh_token, expires_at, last_synced_at")
        .eq("user_id", uid)
        .maybeSingle();
      if (tokenErr || !tokenRow) return new Response(JSON.stringify({ error: "no_tokens" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      users = [tokenRow as any];
    } else {
      // bulk mode: iterate all users with tokens
      const { data: rows, error: rowsErr } = await admin
        .from("user_whoop_tokens")
        .select("user_id, access_token, refresh_token, expires_at, last_synced_at");
      if (rowsErr) {
        console.error("whoop-sync list users err", rowsErr);
        return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      users = rows || [];
    }

    let totalCycles = 0, totalSleeps = 0, totalWorkouts = 0, totalRecoveries = 0;
    for (const u of users) {
      try {
        let accessToken = u.access_token;
        let refreshToken = u.refresh_token;
        const exp = new Date(u.expires_at).getTime();
        const now = Date.now();
        // Log current token state
        console.log("whoop-sync: token state", {
          userId: u.user_id,
          accessTokenLength: accessToken?.length,
          accessTokenPrefix: accessToken?.substring(0, 20),
          expiresAt: u.expires_at,
          lastSyncedAt: u.last_synced_at,
        });
        if (isNaN(exp) || exp <= now + 60000) {
          // refresh
          console.log("whoop-sync: refreshing token", {
            userId: u.user_id,
            reason: isNaN(exp) ? "invalid_exp" : "expiring",
            expiresAt: u.expires_at,
          });
          const rt = await refreshTokenFn(refreshToken, whoopClientId, whoopClientSecret);
          accessToken = rt.access_token;
          refreshToken = rt.refresh_token || refreshToken;
          const expires_at = new Date(Date.now() + (rt.expires_in || 3600) * 1000).toISOString();
          await admin.from("user_whoop_tokens").update({ access_token: accessToken, refresh_token: refreshToken, expires_at }).eq("user_id", u.user_id);
          console.log("whoop-sync: refresh complete", {
            userId: u.user_id,
            newAccessTokenLength: accessToken?.length,
            newAccessTokenPrefix: accessToken?.substring(0, 20),
            newExpiresAt: expires_at,
          });
        }

        const start = startParam || (u.last_synced_at ? new Date(new Date(u.last_synced_at).getTime() - 7 * 86400000).toISOString() : isoDaysAgo(180));
        const end = endParam || new Date().toISOString();
        const commonParams = { start, end } as Record<string, string>;
        console.log("whoop-sync: fetch ranges", {
          userId: u.user_id,
          start,
          end,
          endpoints: {
            cycles: CYCLE_URL,
            sleep: SLEEP_URL,
            workout: WORKOUT_URL,
            recovery: RECOVERY_URL,
          },
        });

        const [cycles, sleeps, workouts, recoveries] = await Promise.all([
          fetchCollection(CYCLE_URL, accessToken, { ...commonParams }),
          fetchCollection(SLEEP_URL, accessToken, { ...commonParams }),
          fetchCollection(WORKOUT_URL, accessToken, { ...commonParams }),
          fetchCollection(RECOVERY_URL, accessToken, { ...commonParams }),
        ]);
        totalCycles += cycles.length;
        totalSleeps += sleeps.length;
        totalWorkouts += workouts.length;
        totalRecoveries += recoveries.length;

        // Upserts using admin client (bypass RLS)
        // Helper to safely extract optional fields
        const toDate = (v: any) => (v ? new Date(v).toISOString() : null);
        const asNumber = (v: any) => (typeof v === "number" ? v : null);

        if (cycles.length) {
          const rows = cycles.map((item: any) => ({
            id: item.id,
            user_id: u.user_id,
            start: toDate(item.start),
            end: toDate(item.end),
            day_strain: asNumber(item.score?.strain ?? item.day_strain),
            avg_hr_bpm: asNumber(item.score?.average_heart_rate ?? item.avg_hr ?? item.avg_hr_bpm),
            training_load: asNumber(item.training_load ?? item.score?.training_load),
            data: item,
          }));
          const { error: errCycles } = await admin.from("whoop_cycles").upsert(rows, { onConflict: "id" });
          if (errCycles) console.error("whoop-sync upsert cycles error", errCycles);
        }

        if (sleeps.length) {
          const rows = sleeps.map((item: any) => ({
            id: item.id,
            user_id: u.user_id,
            start: toDate(item.start),
            end: toDate(item.end),
            duration_sec: asNumber(item.duration ?? item.duration_sec ?? item.score?.stage_summary?.total_in_bed_milli ? Math.round(item.score.stage_summary.total_in_bed_milli / 1000) : null),
            performance_pct: asNumber(item.score?.sleep_performance_percentage ?? item.performance_pct),
            // Additional sleep metrics
            respiratory_rate: asNumber(item.score?.respiratory_rate),
            sleep_consistency_pct: asNumber(item.score?.sleep_consistency_percentage),
            sleep_efficiency_pct: asNumber(item.score?.sleep_efficiency_percentage),
            disturbance_count: asNumber(item.score?.stage_summary?.disturbance_count),
            sleep_cycle_count: asNumber(item.score?.stage_summary?.sleep_cycle_count),
            // Sleep stages in milliseconds
            total_light_sleep_ms: asNumber(item.score?.stage_summary?.total_light_sleep_time_milli),
            total_deep_sleep_ms: asNumber(item.score?.stage_summary?.total_slow_wave_sleep_time_milli),
            total_rem_sleep_ms: asNumber(item.score?.stage_summary?.total_rem_sleep_time_milli),
            total_awake_ms: asNumber(item.score?.stage_summary?.total_awake_time_milli),
            // Sleep debt tracking
            baseline_sleep_need_ms: asNumber(item.score?.sleep_needed?.baseline_milli),
            sleep_debt_ms: asNumber(item.score?.sleep_needed?.need_from_sleep_debt_milli),
            strain_sleep_need_ms: asNumber(item.score?.sleep_needed?.need_from_recent_strain_milli),
            nap_sleep_adjustment_ms: asNumber(item.score?.sleep_needed?.need_from_recent_nap_milli),
            data: item,
          }));
          const { error: errSleep } = await admin.from("whoop_sleep").upsert(rows, { onConflict: "id" });
          if (errSleep) console.error("whoop-sync upsert sleep error", errSleep);
        }

        if (workouts.length) {
          const rows = workouts.map((item: any) => ({
            id: item.id,
            user_id: u.user_id,
            start: toDate(item.start),
            end: toDate(item.end),
            sport_name: item.sport_name ?? null,
            strain: asNumber(item.score?.strain ?? item.strain),
            avg_hr_bpm: asNumber(item.score?.average_heart_rate ?? item.avg_hr_bpm),
            // Additional workout metrics
            max_hr_bpm: asNumber(item.score?.max_heart_rate),
            kilojoule: asNumber(item.score?.kilojoule),
            percent_recorded: asNumber(item.score?.percent_recorded),
            distance_meter: asNumber(item.score?.distance_meter),
            altitude_gain_meter: asNumber(item.score?.altitude_gain_meter),
            altitude_change_meter: asNumber(item.score?.altitude_change_meter),
            // Heart rate zones in milliseconds
            zone_zero_ms: asNumber(item.score?.zone_durations?.zone_zero_milli),
            zone_one_ms: asNumber(item.score?.zone_durations?.zone_one_milli),
            zone_two_ms: asNumber(item.score?.zone_durations?.zone_two_milli),
            zone_three_ms: asNumber(item.score?.zone_durations?.zone_three_milli),
            zone_four_ms: asNumber(item.score?.zone_durations?.zone_four_milli),
            zone_five_ms: asNumber(item.score?.zone_durations?.zone_five_milli),
            sport_id: asNumber(item.sport_id),
            data: item,
          }));
          const { error: errWork } = await admin.from("whoop_workouts").upsert(rows, { onConflict: "id" });
          if (errWork) console.error("whoop-sync upsert workouts error", errWork);
        }

        if (recoveries.length) {
          const rows = recoveries.map((item: any) => ({
            sleep_id: item.sleep_id, // v2 UUID
            cycle_id: typeof item.cycle_id === 'number' ? item.cycle_id : (item.cycle_id ? Number(item.cycle_id) : null),
            user_id: u.user_id,
            date: null,
            score: asNumber(item.score?.recovery_score ?? item.recovery_score ?? item.score),
            hrv_ms: asNumber(item.score?.hrv_rmssd_milli ?? item.hrv_rmssd_milli ?? item.heart_rate_variability_rmssd_milli),
            rhr_bpm: asNumber(item.score?.resting_heart_rate ?? item.resting_heart_rate ?? item.rhr_bpm ?? item.rhr),
            // Additional recovery metrics (WHOOP 4.0)
            spo2_percentage: asNumber(item.score?.spo2_percentage),
            skin_temp_celsius: asNumber(item.score?.skin_temp_celsius),
            user_calibrating: item.score?.user_calibrating ?? false,
            data: item,
          }));
          const { error: errRec } = await admin.from("whoop_recovery").upsert(rows, { onConflict: "sleep_id" });
          if (errRec) console.error("whoop-sync upsert recovery error", errRec);
        }

        await admin.from("user_whoop_tokens").update({ last_synced_at: new Date().toISOString() }).eq("user_id", u.user_id);
      } catch (userErr) {
        console.error("whoop-sync user error", u.user_id, userErr);
      }
    }

    return new Response(JSON.stringify({ success: true, users: users.length, counts: { cycles: totalCycles, sleeps: totalSleeps, workouts: totalWorkouts, recoveries: totalRecoveries } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("whoop-sync error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  async function refreshTokenFn(rt: string, cid: string, cs: string) {
    try {
      return await refreshToken(rt, cid, cs);
    } catch (e) {
      console.error("whoop-refresh error", e);
      throw e;
    }
  }
});
