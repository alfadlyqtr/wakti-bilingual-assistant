import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // ── KIE callback (no auth needed) ──
    const reqUrl = new URL(req.url);
    if (reqUrl.searchParams.get("cb") === "1") {
      console.log("[poster] KIE callback received");
      try {
        const cbBody = await req.json();
        console.log("[poster] callback payload:", JSON.stringify(cbBody).slice(0, 500));
        const taskId = cbBody?.data?.taskId;
        const videoUrl = cbBody?.data?.response?.videoUrl;
        if (taskId && videoUrl) {
          await db.from("user_music_posters").update({ status: "completed", video_url: videoUrl }).eq("kie_poster_task_id", taskId);
        }
      } catch (e) {
        console.error("[poster] callback parse error:", e);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Auth failed");

    // ═══════════════════════════════════════════════════════════════════════
    // POST — Send to KIE mp4/generate
    // ═══════════════════════════════════════════════════════════════════════
    if (req.method === "POST") {
      const body = await req.json();
      const trackId = String(body.trackId ?? "").trim();
      const taskId = String(body.taskId ?? "").trim();
      const audioId = String(body.audioId ?? "").trim();
      const author = String(body.author ?? "Wakti User").trim().slice(0, 50);

      console.log("[poster] POST trackId:", trackId, "taskId:", taskId, "audioId:", audioId, "author:", author);

      if (!trackId || !taskId || !audioId) {
        throw new Error("trackId, taskId, and audioId are all required");
      }

      // Check existing poster
      const { data: existing } = await db
        .from("user_music_posters")
        .select("id, status, video_url, created_at, kie_poster_task_id")
        .eq("track_id", trackId).eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (existing?.status === "completed") {
        return json({ posterId: existing.id, status: "completed", videoUrl: existing.video_url });
      }
      if (existing?.status === "generating") {
        const age = Date.now() - new Date(existing.created_at).getTime();
        if (age < 5 * 60 * 1000) {
          return json({ posterId: existing.id, status: "generating", taskId: existing.kie_poster_task_id });
        }
        // Stale — delete it and retry
        await db.from("user_music_posters").delete().eq("id", existing.id);
      }

      // ── Call KIE exactly per docs ──
      const callBackUrl = `${SUPABASE_URL}/functions/v1/music-poster?cb=1`;
      const kieBody = { taskId, audioId, callBackUrl, author, domainName: "wakti.ai" };
      console.log("[poster] → KIE /mp4/generate:", JSON.stringify(kieBody));

      const kieResp = await fetch("https://api.kie.ai/api/v1/mp4/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${KIE_API_KEY}` },
        body: JSON.stringify(kieBody),
      });

      const kieText = await kieResp.text();
      console.log("[poster] ← KIE response status:", kieResp.status, "body:", kieText.slice(0, 500));

      let kieData: Record<string, unknown> = {};
      try { kieData = JSON.parse(kieText); } catch { throw new Error("KIE returned invalid JSON"); }

      if ((kieData as any).code !== 200) {
        const msg = String((kieData as any).msg ?? "");
        if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("mp4 record")) {
          console.log("[poster] KIE says already exists — querying record-info by audioId");
          // If we have a DB row, return it
          if (existing) return json({ posterId: existing.id, status: existing.status, taskId: existing.kie_poster_task_id });
          // No DB row — find the KIE task by querying record-info with audioId
          let kiePosterTaskId: string | null = null;
          let videoUrl: string | null = null;
          let successFlag = "PENDING";
          try {
            const infoResp = await fetch(`https://api.kie.ai/api/v1/mp4/record-info?audioId=${encodeURIComponent(audioId)}`, {
              headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
            });
            if (infoResp.ok) {
              const infoData = await infoResp.json();
              console.log("[poster] record-info by audioId:", JSON.stringify(infoData).slice(0, 500));
              kiePosterTaskId = infoData.data?.taskId ?? null;
              videoUrl = infoData.data?.response?.videoUrl ?? null;
              successFlag = String(infoData.data?.successFlag ?? "PENDING").toUpperCase();
            }
          } catch (e) {
            console.error("[poster] record-info lookup error:", e);
          }
          const status = (successFlag === "SUCCESS" && videoUrl) ? "completed" : "generating";
          const { data: stubRow, error: stubErr } = await db
            .from("user_music_posters")
            .insert({ user_id: user.id, track_id: trackId, kie_task_id: taskId, kie_audio_id: audioId, kie_poster_task_id: kiePosterTaskId, author, status, video_url: videoUrl })
            .select("id").single();
          if (stubErr) throw stubErr;
          return json({ posterId: stubRow.id, status, taskId: kiePosterTaskId, videoUrl });
        }
        throw new Error(`Generation failed: ${msg || "Unknown error"}`);
      }

      // Success — save to DB
      const kiePosterTaskId = (kieData as any).data?.taskId ?? null;
      console.log("[poster] KIE success, poster taskId:", kiePosterTaskId);

      const { data: row, error: insertErr } = await db
        .from("user_music_posters")
        .insert({ user_id: user.id, track_id: trackId, kie_task_id: taskId, kie_audio_id: audioId, kie_poster_task_id: kiePosterTaskId, author, status: "generating", video_url: null })
        .select("id").single();
      if (insertErr) throw insertErr;

      return json({ posterId: row.id, status: "generating", taskId: kiePosterTaskId });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET — List, poll, or proxy video
    // ═══════════════════════════════════════════════════════════════════════
    if (req.method === "GET") {
      // Proxy video bytes (bypasses CORS for download/share)
      if (reqUrl.searchParams.get("proxy") === "1") {
        const posterId = reqUrl.searchParams.get("posterId");
        if (!posterId) throw new Error("posterId required");
        const { data: row } = await db.from("user_music_posters").select("video_url").eq("id", posterId).eq("user_id", user.id).maybeSingle();
        if (!row?.video_url) throw new Error("Video not found");
        const videoResp = await fetch(row.video_url);
        if (!videoResp.ok) throw new Error("Could not fetch video");
        const videoBlob = await videoResp.arrayBuffer();
        return new Response(videoBlob, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="wakti-poster-${posterId}.mp4"`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // List all posters
      if (reqUrl.searchParams.get("list") === "1") {
        const { data, error } = await db
          .from("user_music_posters")
          .select("id, track_id, author, status, video_url, created_at, kie_poster_task_id")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
        if (error) throw error;
        return json({ posters: data ?? [] });
      }

      // Poll single poster
      const posterId = reqUrl.searchParams.get("posterId");
      if (!posterId) throw new Error("posterId required");

      const { data: row } = await db.from("user_music_posters").select("*").eq("id", posterId).eq("user_id", user.id).maybeSingle();
      if (!row) throw new Error("Not found");
      if (row.status === "completed") return json({ status: "completed", videoUrl: row.video_url });
      if (row.status === "failed") return json({ status: "failed", error: row.error_message });

      // Poll KIE
      const tid = reqUrl.searchParams.get("taskId") || row.kie_poster_task_id;
      if (!tid) return json({ status: "generating" });

      try {
        const resp = await fetch(`https://api.kie.ai/api/v1/mp4/record-info?taskId=${tid}`, {
          headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
        });
        if (!resp.ok) return json({ status: "generating" });
        const d = await resp.json();
        console.log("[poster] poll response:", JSON.stringify(d).slice(0, 400));

        const flag = String(d.data?.successFlag ?? "").toUpperCase();
        const videoUrl = d.data?.response?.videoUrl ?? null;

        if (flag === "SUCCESS" && videoUrl) {
          await db.from("user_music_posters").update({ status: "completed", video_url: videoUrl }).eq("id", posterId);
          return json({ status: "completed", videoUrl });
        }
        if (flag === "CREATE_TASK_FAILED" || flag === "GENERATE_MP4_FAILED") {
          const errMsg = d.data?.errorMessage || "Generation failed";
          await db.from("user_music_posters").update({ status: "failed", error_message: errMsg }).eq("id", posterId);
          return json({ status: "failed", error: errMsg });
        }
      } catch (e) {
        console.error("[poster] poll error:", e);
      }
      return json({ status: "generating" });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error("[poster] ERROR:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  });
}
