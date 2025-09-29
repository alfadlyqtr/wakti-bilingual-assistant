import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const BASE = "https://api.prod.whoop.com/developer/v1";
const SLEEP_URL = `${BASE}/activity/sleep`;
const WORKOUT_URL = `${BASE}/activity/workout`;
const CYCLE_URL = `${BASE}/cycle`;
const RECOVERY_URL = `${BASE}/recovery`;
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    if (nextToken) u.searchParams.set("nextToken", nextToken);
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

    const authHeader = req.headers.get("Authorization") || "";
    const isUserMode = authHeader.startsWith("Bearer ") && !SUPABASE_SERVICE_ROLE_KEY; // fallback check

    // Admin client for RLS-bypassing writes and bulk reads
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
      global: SUPABASE_SERVICE_ROLE_KEY ? {} : { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode as string) || (isUserMode ? "user" : "bulk");
    const startParam = body?.start as string | undefined;
    const endParam = body?.end as string | undefined;

    let users: { user_id: string; access_token: string; refresh_token: string; expires_at: string; last_synced_at: string | null }[] = [];

    if (mode === "user") {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await userClient.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    for (const u of users) {
      try {
        let accessToken = u.access_token;
        let refreshToken = u.refresh_token;
        const exp = new Date(u.expires_at).getTime();
        const now = Date.now();
        if (isNaN(exp) || exp <= now + 60000) {
          // refresh
          const rt = await refreshTokenFn(refreshToken, whoopClientId, whoopClientSecret);
          accessToken = rt.access_token;
          refreshToken = rt.refresh_token || refreshToken;
          const expires_at = new Date(Date.now() + (rt.expires_in || 3600) * 1000).toISOString();
          await admin.from("user_whoop_tokens").update({ access_token: accessToken, refresh_token: refreshToken, expires_at }).eq("user_id", u.user_id);
        }

        const start = startParam || (u.last_synced_at ? new Date(new Date(u.last_synced_at).getTime() - 7 * 86400000).toISOString() : isoDaysAgo(30));
        const end = endParam || new Date().toISOString();
        const commonParams = { start, end } as Record<string, string>;

        const [cycles, sleeps, workouts, recoveries] = await Promise.all([
          fetchCollection(CYCLE_URL, accessToken, { ...commonParams }),
          fetchCollection(SLEEP_URL, accessToken, { ...commonParams }),
          fetchCollection(WORKOUT_URL, accessToken, { ...commonParams }),
          fetchCollection(RECOVERY_URL, accessToken, { ...commonParams }),
        ]);

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
          await admin.from("whoop_cycles").upsert(rows, { onConflict: "id" });
        }

        if (sleeps.length) {
          const rows = sleeps.map((item: any) => ({
            id: item.id,
            user_id: u.user_id,
            start: toDate(item.start),
            end: toDate(item.end),
            duration_sec: asNumber(item.duration ?? item.duration_sec ?? item.score?.stage_summary?.total_in_bed_milli ? Math.round(item.score.stage_summary.total_in_bed_milli / 1000) : null),
            performance_pct: asNumber(item.score?.sleep_performance_percentage ?? item.performance_pct),
            data: item,
          }));
          await admin.from("whoop_sleep").upsert(rows, { onConflict: "id" });
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
            data: item,
          }));
          await admin.from("whoop_workouts").upsert(rows, { onConflict: "id" });
        }

        if (recoveries.length) {
          const rows = recoveries.map((item: any) => ({
            id: item.id,
            user_id: u.user_id,
            date: item.sleep_id ? null : (item.date ? item.date : null),
            score: asNumber(item.score?.recovery_score ?? item.score ?? item.recovery_score),
            hrv_ms: asNumber(item.heart_rate_variability_rmssd_milli ?? item.hrv_ms ?? item.hrv),
            rhr_bpm: asNumber(item.resting_heart_rate ?? item.rhr_bpm ?? item.rhr),
            data: item,
          }));
          await admin.from("whoop_recovery").upsert(rows, { onConflict: "id" });
        }

        await admin.from("user_whoop_tokens").update({ last_synced_at: new Date().toISOString() }).eq("user_id", u.user_id);
      } catch (userErr) {
        console.error("whoop-sync user error", u.user_id, userErr);
      }
    }

    return new Response(JSON.stringify({ success: true, users: users.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
