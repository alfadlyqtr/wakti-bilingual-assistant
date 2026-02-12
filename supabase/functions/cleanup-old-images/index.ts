import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Folders to clean up in wakti-ai-v2 bucket (legacy)
const CLEANUP_FOLDERS = [
  "text2image/",
  "image2image/",
  "background-removal/",
];

// Max age in days before deletion
const MAX_AGE_DAYS_LEGACY = 7;
const MAX_AGE_DAYS_GENERATED = 20;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let totalDeleted = 0;
    const errors: string[] = [];

    // ─── Part 1: Clean legacy wakti-ai-v2 bucket (7 days) ───
    const legacyCutoff = new Date();
    legacyCutoff.setDate(legacyCutoff.getDate() - MAX_AGE_DAYS_LEGACY);

    for (const folder of CLEANUP_FOLDERS) {
      try {
        const { data: files, error: listError } = await supabase.storage
          .from("wakti-ai-v2")
          .list(folder.replace("/", ""), {
            limit: 1000,
            sortBy: { column: "created_at", order: "asc" },
          });

        if (listError) {
          errors.push(`List error for ${folder}: ${listError.message}`);
          continue;
        }

        if (!files || files.length === 0) continue;

        const oldFiles = files.filter((file) => {
          if (!file.created_at) return false;
          return new Date(file.created_at) < legacyCutoff;
        });

        if (oldFiles.length === 0) continue;

        const filePaths = oldFiles.map((file) => `${folder.replace("/", "")}/${file.name}`);
        const { error: deleteError } = await supabase.storage
          .from("wakti-ai-v2")
          .remove(filePaths);

        if (deleteError) {
          errors.push(`Delete error for ${folder}: ${deleteError.message}`);
        } else {
          totalDeleted += oldFiles.length;
          console.log(`[legacy] Deleted ${oldFiles.length} files from ${folder}`);
        }
      } catch (err) {
        errors.push(`Error processing ${folder}: ${(err as Error).message}`);
      }
    }

    // ─── Part 2: Clean generated-images bucket + DB rows (20 days) ───
    const generatedCutoff = new Date();
    generatedCutoff.setDate(generatedCutoff.getDate() - MAX_AGE_DAYS_GENERATED);
    let generatedDeleted = 0;

    try {
      // Fetch old DB rows that have storage paths
      const { data: oldRows, error: fetchErr } = await supabase
        .from("user_generated_images")
        .select("id, image_url, meta")
        .lt("created_at", generatedCutoff.toISOString());

      if (fetchErr) {
        errors.push(`DB fetch error: ${fetchErr.message}`);
      } else if (oldRows && oldRows.length > 0) {
        // Collect storage paths to delete
        const storagePaths: string[] = [];
        for (const row of oldRows) {
          // Try meta.storage_path first, then extract from URL
          const metaPath = (row.meta as any)?.storage_path;
          if (metaPath) {
            storagePaths.push(metaPath);
          } else if (row.image_url?.includes("/generated-images/")) {
            const pathPart = row.image_url.split("/generated-images/")[1];
            if (pathPart) storagePaths.push(decodeURIComponent(pathPart));
          }
        }

        // Delete storage files in batches of 100
        for (let i = 0; i < storagePaths.length; i += 100) {
          const batch = storagePaths.slice(i, i + 100);
          const { error: rmErr } = await supabase.storage
            .from("generated-images")
            .remove(batch);
          if (rmErr) {
            errors.push(`Storage remove error: ${rmErr.message}`);
          }
        }

        // Delete DB rows
        const ids = oldRows.map((r) => r.id);
        const { error: delErr } = await supabase
          .from("user_generated_images")
          .delete()
          .in("id", ids);

        if (delErr) {
          errors.push(`DB delete error: ${delErr.message}`);
        } else {
          generatedDeleted = oldRows.length;
          totalDeleted += generatedDeleted;
          console.log(`[generated] Deleted ${generatedDeleted} images (DB + storage)`);
        }
      }
    } catch (err) {
      errors.push(`Generated cleanup error: ${(err as Error).message}`);
    }

    const result = {
      success: true,
      deleted: totalDeleted,
      generatedDeleted,
      legacyCutoff: legacyCutoff.toISOString(),
      generatedCutoff: generatedCutoff.toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Cleanup complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = (err as Error)?.message || String(err);
    console.error("Cleanup error:", message);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
