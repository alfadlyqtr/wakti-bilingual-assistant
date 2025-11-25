import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🚀 Starting webm to mp3 migration...");

    // Get all tasjeel records with webm recordings
    const { data: records, error: fetchError } = await supabase
      .from('tasjeel_records')
      .select('id, original_recording_path')
      .like('original_recording_path', '%.webm');

    if (fetchError) {
      console.error("Error fetching records:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch records", details: fetchError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ message: "No webm recordings found to migrate", total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Found ${records.length} webm recordings to convert`);

    const results = {
      total: records.length,
      converted: 0,
      failed: 0,
      errors: [] as Array<{ id: string; path: string; error: string }>,
    };

    // Process each record
    for (const record of records) {
      try {
        console.log(`🔄 Converting record ${record.id}: ${record.original_recording_path}`);

        // Extract the storage path from the full URL
        const url = new URL(record.original_recording_path);
        const pathMatch = url.pathname.match(/\/object\/public\/tasjeel_recordings\/(.+)/);
        
        if (!pathMatch) {
          throw new Error("Could not extract storage path from URL");
        }

        const storagePath = pathMatch[1];

        // Call the convert-webm-to-mp3 function
        const convertResponse = await fetch(`${supabaseUrl}/functions/v1/convert-webm-to-mp3`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recordingPath: storagePath }),
        });

        if (!convertResponse.ok) {
          const errorData = await convertResponse.json();
          throw new Error(errorData.error || "Conversion failed");
        }

        const convertData = await convertResponse.json();
        
        // Update the database record with the mp3 URL
        const { error: updateError } = await supabase
          .from('tasjeel_records')
          .update({ original_recording_path: convertData.mp3Url })
          .eq('id', record.id);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log(`✅ Converted and updated record ${record.id}`);
        results.converted++;

      } catch (error) {
        console.error(`❌ Failed to convert record ${record.id}:`, error);
        results.failed++;
        results.errors.push({
          id: record.id,
          path: record.original_recording_path,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Add a small delay to avoid overwhelming the conversion service
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("✅ Migration complete:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Migration completed",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
