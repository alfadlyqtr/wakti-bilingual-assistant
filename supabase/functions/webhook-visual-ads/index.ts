// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface KieCallbackPayload {
  taskId: string;
  state: "success" | "fail";
  resultJson?: string; // JSON string: {"resultUrls":["https://..."]}
  failMsg?: string;
  // KIE includes other fields like model, action, code, but we mainly care about state and result
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: KieCallbackPayload = await req.json();
    console.log("[webhook-visual-ads] Received callback:", JSON.stringify(body));

    const { taskId, state, resultJson, failMsg } = body;

    if (!taskId) {
      return new Response(JSON.stringify({ error: "Missing taskId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let statusToSave = "IN_PROGRESS";
    let resultUrls: string[] = [];
    let errorMsg = failMsg || null;

    if (state === "success" && resultJson) {
      statusToSave = "COMPLETED";
      try {
        const parsed = JSON.parse(resultJson);
        resultUrls = parsed.resultUrls || [];
      } catch (e) {
        console.error("[webhook-visual-ads] Failed to parse resultJson:", e);
        statusToSave = "FAILED";
        errorMsg = "Failed to parse generation result";
      }
    } else if (state === "fail") {
      statusToSave = "FAILED";
    }

    // Save the status to a database table so the frontend can poll it
    // We'll use the project_generation_jobs table or similar, assuming it exists
    // For now, we update project_generation_jobs if that's the intended table for tracking background jobs
    
    // NOTE: This assumes a table exists to track these jobs. If not, the frontend will need to use the
    // existing /jobs/recordInfo polling endpoint instead of relying exclusively on the webhook.
    // The prompt specified "For production use, we recommend using the callBackUrl parameter... 
    // Alternatively, use the Get Task Details endpoint to poll task status"
    
    // As a fallback/hybrid approach: we acknowledge the webhook but the frontend will poll `freepik-image2video` with mode="status".
    // KIE's own status endpoint will have the completed state, so frontend polling will work even if this webhook just logs it.
    
    console.log(`[webhook-visual-ads] Task ${taskId} finished with state ${state}. URLs:`, resultUrls);

    // TODO: If you have a specific table for tracking generation jobs (like `project_generation_jobs` or `ai_logs`), update it here.
    // For example:
    // await supabase.from('project_generation_jobs').update({ status: statusToSave, result_data: { urls: resultUrls }, error: errorMsg }).eq('task_id', taskId);

    return new Response(JSON.stringify({ ok: true, received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[webhook-visual-ads] Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/webhook-visual-ads' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
