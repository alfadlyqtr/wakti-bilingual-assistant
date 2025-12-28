import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Folders to clean up (generated images)
const CLEANUP_FOLDERS = [
  "text2image/",
  "image2image/",
  "background-removal/",
];

// Max age in days before deletion
const MAX_AGE_DAYS = 7;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

    let totalDeleted = 0;
    const errors: string[] = [];

    for (const folder of CLEANUP_FOLDERS) {
      try {
        // List files in the folder
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

        if (!files || files.length === 0) {
          continue;
        }

        // Filter files older than cutoff date
        const oldFiles = files.filter((file) => {
          if (!file.created_at) return false;
          const fileDate = new Date(file.created_at);
          return fileDate < cutoffDate;
        });

        if (oldFiles.length === 0) {
          continue;
        }

        // Delete old files
        const filePaths = oldFiles.map((file) => `${folder.replace("/", "")}/${file.name}`);
        
        const { error: deleteError } = await supabase.storage
          .from("wakti-ai-v2")
          .remove(filePaths);

        if (deleteError) {
          errors.push(`Delete error for ${folder}: ${deleteError.message}`);
        } else {
          totalDeleted += oldFiles.length;
          console.log(`Deleted ${oldFiles.length} files from ${folder}`);
        }
      } catch (err) {
        errors.push(`Error processing ${folder}: ${(err as Error).message}`);
      }
    }

    const result = {
      success: true,
      deleted: totalDeleted,
      cutoffDate: cutoffDate.toISOString(),
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
