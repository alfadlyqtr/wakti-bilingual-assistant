import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const COLLECTIONS = ["bukhari", "muslim", "abudawud", "tirmidhi", "ibnmajah", "nasai"] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authData.user) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const importQuran = body?.import_quran !== false;
    const importHadith = body?.import_hadith !== false;

    if (importQuran) {
      const { error } = await supabase.rpc("import_deen_quran_sources");
      if (error) throw error;
    }

    if (importHadith) {
      for (const collectionId of COLLECTIONS) {
        const { error } = await supabase.rpc("import_deen_hadith_collection", {
          target_collection_id: collectionId,
        });
        if (error) throw error;
      }
    }

    const [{ count: quranCount }, { count: hadithCount }, { count: collectionCount }] = await Promise.all([
      supabase.from("deen_quran_verses").select("id", { count: "exact", head: true }),
      supabase.from("deen_hadith_entries").select("id", { count: "exact", head: true }),
      supabase.from("deen_hadith_collections").select("collection_id", { count: "exact", head: true }),
    ]);

    return json({
      success: true,
      quran_count: quranCount ?? 0,
      hadith_count: hadithCount ?? 0,
      collection_count: collectionCount ?? 0,
    });
  } catch (error) {
    console.error("[deen-import-sources]", error);
    return json({ error: "internal_error" }, 500);
  }
});
