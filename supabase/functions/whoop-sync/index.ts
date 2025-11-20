import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const BASE = "https://api.prod.whoop.com/developer/v2";
const SLEEP_URL = `${BASE}/activity/sleep`;
const WORKOUT_URL = `${BASE}/activity/workout`;
const CYCLE_URL = `${BASE}/cycle`;
const RECOVERY_URL = `${BASE}/recovery`;
const USER_PROFILE_URL = `${BASE}/user/profile/basic`;
const USER_BODY_URL = `${BASE}/user/measurement/body`;
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
  const seenIds = new Set<string>(); // Deduplicate by id or sleep_id
  let nextToken: string | undefined = undefined;
  const headers = { Authorization: `Bearer ${accessToken}` };

  do {
    const u = new URL(url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    if (nextToken) u.searchParams.set("next_token", nextToken);
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
      if (res.status === 401) {
        const err: any = new Error(`401 Unauthorized for ${url}`);
        err.status = 401;
        throw err;
      }
      break;
    }
    const json = await res.json();
    if (Array.isArray(json.records)) {
      // Deduplicate records by id or sleep_id
      for (const record of json.records) {
        const recordId = record.id || record.sleep_id;
        if (recordId && !seenIds.has(recordId)) {
          seenIds.add(recordId);
          records.push(record);
        }
      }
    }
    nextToken = json.next_token || json.nextToken || undefined;
  } while (nextToken);

  console.log(`whoop-sync: fetchCollection complete - ${records.length} unique records (${seenIds.size} unique IDs)`);
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
    let reconnectNeeded = false;
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

        // Helper to refresh and persist once
        const refreshAndPersist = async () => {
          const rt = await refreshTokenFn(refreshToken, whoopClientId, whoopClientSecret);
          accessToken = rt.access_token;
          refreshToken = rt.refresh_token || refreshToken;
          const expires_at = new Date(Date.now() + (rt.expires_in || 3600) * 1000).toISOString();
          await admin.from("user_whoop_tokens").update({ access_token: accessToken, refresh_token: refreshToken, expires_at }).eq("user_id", u.user_id);
          console.log("whoop-sync: token refreshed after 401", { userId: u.user_id, newPrefix: accessToken?.substring(0, 20) });
        };

        // Wrapper to retry once on 401
        const withRetry401 = async <T>(runner: () => Promise<T>): Promise<T> => {
          try { return await runner(); } catch (e: any) {
            if (e?.status === 401 || String(e?.message || e).includes('401')) {
              console.warn('whoop-sync: got 401, attempting refresh-and-retry');
              try {
                await refreshAndPersist();
                return await runner();
              } catch (e2: any) {
                if (e2?.status === 401 || String(e2?.message || e2).includes('401')) {
                  reconnectNeeded = true;
                }
                throw e2;
              }
            }
            throw e;
          }
        };

        // Always fetch last 6 months to support time range filtering in UI
        const start = startParam || isoDaysAgo(180);
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

        const [cycles, sleeps, workouts, recoveries, userProfile, userBody] = await Promise.all([
          withRetry401(() => fetchCollection(CYCLE_URL, accessToken, { ...commonParams })),
          withRetry401(() => fetchCollection(SLEEP_URL, accessToken, { ...commonParams })),
          withRetry401(() => fetchCollection(WORKOUT_URL, accessToken, { ...commonParams })),
          withRetry401(() => fetchCollection(RECOVERY_URL, accessToken, { ...commonParams })),
          // Fetch user profile and body measurements (no date params needed)
          withRetry401(async () => {
            const r = await fetch(USER_PROFILE_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
            console.log('USER_PROFILE_URL response status:', r.status);
            if (r.status === 401) { const err: any = new Error('401 profile'); err.status = 401; throw err; }
            if (!r.ok) return null; return await r.json();
          }),
          withRetry401(async () => {
            const r = await fetch(USER_BODY_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
            console.log('USER_BODY_URL response status:', r.status);
            if (r.status === 401) { const err: any = new Error('401 body'); err.status = 401; throw err; }
            if (!r.ok) return null; return await r.json();
          }),
        ]);
        totalCycles += cycles.length;
        totalSleeps += sleeps.length;
        totalWorkouts += workouts.length;
        totalRecoveries += recoveries.length;
        
        console.log('Fetched data counts:', { cycles: cycles.length, sleeps: sleeps.length, workouts: workouts.length, recoveries: recoveries.length });
        console.log('User data:', { hasProfile: !!userProfile, hasBody: !!userBody });

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
          console.log(`whoop-sync: Upserting ${rows.length} cycles for user ${u.user_id}`);
          const { error: errCycles, count } = await admin.from("whoop_cycles").upsert(rows, { onConflict: "id", count: 'exact' });
          if (errCycles) {
            console.error("whoop-sync upsert cycles error", errCycles);
          } else {
            console.log(`whoop-sync: Successfully upserted ${count} cycles`);
          }
        }

        if (sleeps.length) {
          // Deduplicate by conflict key (id)
          const uniqMap = new Map<string, any>();
          for (const item of sleeps) {
            const key = String(item.id ?? "");
            if (!key) continue;
            if (!uniqMap.has(key)) uniqMap.set(key, item);
          }
          const uniqSleeps = Array.from(uniqMap.values());

          const rows = uniqSleeps.map((item: any) => ({
            id: item.id,
            user_id: u.user_id,
            start: toDate(item.start),
            end: toDate(item.end),
            duration_sec: asNumber(item.duration ?? item.duration_sec ?? (item.score?.stage_summary?.total_in_bed_milli ? Math.round(item.score.stage_summary.total_in_bed_milli / 1000) : null)),
            performance_pct: asNumber(item.score?.sleep_performance_percentage ?? item.performance_pct),
            data: item,
          }));
          console.log(`whoop-sync: Upserting ${rows.length} sleeps (${new Set(rows.map(r => r.id)).size} unique IDs, from ${sleeps.length} raw) for user ${u.user_id}`);
          
          // Batch process to handle large datasets
          const batchSize = 50;
          let successCount = 0;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            try {
              const { error: errSleep, count } = await admin.from("whoop_sleep").upsert(batch, { onConflict: "id", count: 'exact' });
              if (errSleep) {
                console.error(`whoop-sync batch ${i}-${i+batchSize} sleep error:`, errSleep);
              } else {
                successCount += (count || 0);
              }
            } catch (batchErr) {
              console.error(`whoop-sync batch ${i}-${i+batchSize} exception:`, batchErr);
            }
          }
          console.log(`whoop-sync: Successfully upserted ${successCount}/${rows.length} sleep records`);
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
          console.log(`whoop-sync: Upserting ${rows.length} workouts for user ${u.user_id}`);
          
          const batchSize = 50;
          let successCount = 0;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            try {
              const { error: errWork, count } = await admin.from("whoop_workouts").upsert(batch, { onConflict: "id", count: 'exact' });
              if (errWork) {
                console.error(`whoop-sync batch ${i}-${i+batchSize} workouts error:`, errWork);
              } else {
                successCount += (count || 0);
              }
            } catch (batchErr) {
              console.error(`whoop-sync batch ${i}-${i+batchSize} exception:`, batchErr);
            }
          }
          console.log(`whoop-sync: Successfully upserted ${successCount}/${rows.length} workout records`);
        }

        if (recoveries.length) {
          // Deduplicate strictly by conflict key (sleep_id)
          const uniqRecMap = new Map<string, any>();
          for (const item of recoveries) {
            const key = String(item.sleep_id ?? item.sleepId ?? item.sleepID ?? "");
            if (!key) continue;
            if (!uniqRecMap.has(key)) uniqRecMap.set(key, item);
          }
          const uniqRecoveries = Array.from(uniqRecMap.values());

          const rows = uniqRecoveries.map((item: any) => ({
            sleep_id: item.sleep_id,
            cycle_id: typeof item.cycle_id === 'number' ? item.cycle_id : (item.cycle_id ? Number(item.cycle_id) : null),
            user_id: u.user_id,
            date: null,
            score: asNumber(item.score?.recovery_score ?? item.recovery_score ?? item.score),
            hrv_ms: asNumber(item.score?.hrv_rmssd_milli ?? item.hrv_rmssd_milli ?? item.heart_rate_variability_rmssd_milli),
            rhr_bpm: asNumber(item.score?.resting_heart_rate ?? item.resting_heart_rate ?? item.rhr_bpm ?? item.rhr),
            data: item,
          }));
          console.log(`whoop-sync: Upserting ${rows.length} recoveries (${new Set(rows.map(r => r.sleep_id)).size} unique sleep_ids, from ${recoveries.length} raw) for user ${u.user_id}`);
          
          const batchSize = 50;
          let successCount = 0;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            try {
              const { error: errRec, count } = await admin.from("whoop_recovery").upsert(batch, { onConflict: "sleep_id", count: 'exact' });
              if (errRec) {
                console.error(`whoop-sync batch ${i}-${i+batchSize} recovery error:`, errRec);
              } else {
                successCount += (count || 0);
              }
            } catch (batchErr) {
              console.error(`whoop-sync batch ${i}-${i+batchSize} exception:`, batchErr);
            }
          }
          console.log(`whoop-sync: Successfully upserted ${successCount}/${rows.length} recovery records`);
        }

        // Store user profile data
        if (userProfile) {
          const profileData = {
            user_id: u.user_id,
            whoop_user_id: userProfile.user_id,
            email: userProfile.email,
            first_name: userProfile.first_name,
            last_name: userProfile.last_name,
            data: userProfile,
          };
          const { error: errProfile } = await admin.from("whoop_user_profiles").upsert([profileData], { onConflict: "user_id" });
          if (errProfile) console.error("whoop-sync upsert profile error", errProfile);
        }

        // Store user body measurements
        if (userBody) {
          const bodyData = {
            user_id: u.user_id,
            height_meter: asNumber(userBody.height_meter),
            weight_kilogram: asNumber(userBody.weight_kilogram),
            max_heart_rate: asNumber(userBody.max_heart_rate),
            data: userBody,
          };
          const { error: errBody } = await admin.from("whoop_user_body").upsert([bodyData], { onConflict: "user_id" });
          if (errBody) console.error("whoop-sync upsert body error", errBody);
        }

        await admin.from("user_whoop_tokens").update({ last_synced_at: new Date().toISOString() }).eq("user_id", u.user_id);
      } catch (userErr) {
        console.error("whoop-sync user error", u.user_id, userErr);
      }
    }

    return new Response(JSON.stringify({ success: true, users: users.length, counts: { cycles: totalCycles, sleeps: totalSleeps, workouts: totalWorkouts, recoveries: totalRecoveries }, reconnectNeeded }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
