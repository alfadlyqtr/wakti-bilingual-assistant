import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cleanup-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Never touch anything newer than this — protects in-flight generations/uploads.
const MIN_AGE_DAYS = 7;
const PAGE_SIZE = 1000;
const DELETE_BATCH = 100;

interface StorageEntry {
  id: string | null; // null = folder
  name: string;
  created_at?: string;
}

async function listAllObjects(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
  out: string[],
  cutoffIso: string,
): Promise<void> {
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix || undefined, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data as StorageEntry[]) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        // folder → recurse
        await listAllObjects(supabase, bucket, fullPath, out, cutoffIso);
      } else if ((entry.created_at ?? "") < cutoffIso) {
        out.push(fullPath);
      }
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
}

function pathAfterBucket(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  } catch {
    return url.slice(idx + marker.length).split("?")[0];
  }
}

async function sweepBucket(
  supabase: SupabaseClient,
  bucket: string,
  referencedPaths: Set<string>,
  cutoffIso: string,
): Promise<{ scanned: number; deleted: number }> {
  const candidates: string[] = [];
  await listAllObjects(supabase, bucket, "", candidates, cutoffIso);

  const orphans = candidates.filter((path) => !referencedPaths.has(path));
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += DELETE_BATCH) {
    const batch = orphans.slice(i, i + DELETE_BATCH);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.error(`[cleanup-music-orphans] delete batch failed in ${bucket}:`, error.message);
    } else {
      deleted += batch.length;
    }
  }
  console.log(`[cleanup-music-orphans] ${bucket}: scanned=${candidates.length} orphans=${orphans.length} deleted=${deleted}`);
  return { scanned: candidates.length, deleted };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Optional shared-secret guard (enforced only when CLEANUP_SECRET is configured)
    const expectedSecret = Deno.env.get("CLEANUP_SECRET") ?? "";
    if (expectedSecret) {
      const provided = req.headers.get("x-cleanup-secret") ?? "";
      if (provided !== expectedSecret) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - MIN_AGE_DAYS);
    const cutoffIso = cutoff.toISOString();

    // ── Collect referenced paths from the DB ──
    const { data: trackRows } = await supabase
      .from("user_music_tracks")
      .select("storage_path, cover_url");
    const { data: voiceRows } = await supabase
      .from("user_music_voices")
      .select("source_storage_path, verify_storage_path");
    const { data: posterRows } = await supabase
      .from("user_music_posters")
      .select("video_url");

    const musicRefs = new Set<string>();
    for (const row of trackRows ?? []) {
      if (row.storage_path) musicRefs.add(row.storage_path);
    }
    for (const row of voiceRows ?? []) {
      if (row.source_storage_path) musicRefs.add(row.source_storage_path);
      if (row.verify_storage_path) musicRefs.add(row.verify_storage_path);
    }

    const coverRefs = new Set<string>();
    for (const row of trackRows ?? []) {
      const p = pathAfterBucket(row.cover_url, "music-covers");
      if (p) coverRefs.add(p);
    }

    const posterRefs = new Set<string>();
    for (const row of posterRows ?? []) {
      const p = pathAfterBucket(row.video_url, "posters");
      if (p) posterRefs.add(p);
    }

    const results: Record<string, unknown> = { cutoff: cutoffIso };
    results.music = await sweepBucket(supabase, "music", musicRefs, cutoffIso);
    results["music-covers"] = await sweepBucket(supabase, "music-covers", coverRefs, cutoffIso);
    results.posters = await sweepBucket(supabase, "posters", posterRefs, cutoffIso);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cleanup-music-orphans] Error:", (error as Error).message);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
