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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: KieCallbackPayload & Record<string, unknown> = await req.json();
    console.log("[webhook-visual-ads] Received callback:", JSON.stringify(body));

    const nestedData = asRecord(body.data);
    const taskId = [body.taskId, body.task_id, nestedData?.taskId, nestedData?.task_id, body.id]
      .find((value) => typeof value === "string" && value.length > 0) as string | undefined;
    const stateValue = [body.state, body.status, nestedData?.state, nestedData?.status]
      .find((value) => typeof value === "string" && value.length > 0);
    const normalizedState = String(stateValue || "").toLowerCase();
    const rawResult = body.resultJson ?? body.result_json ?? nestedData?.resultJson ?? nestedData?.result_json ?? body.result ?? nestedData?.result ?? null;
    const failMsg = body.failMsg ?? body.fail_msg ?? body.error ?? body.message ?? nestedData?.failMsg ?? nestedData?.fail_msg ?? nestedData?.error ?? nestedData?.message ?? null;

    if (!taskId) {
      return new Response(JSON.stringify({ error: "Missing taskId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let statusToSave = "IN_PROGRESS";
    let resultUrls: string[] = [];
    let errorMsg = typeof failMsg === "string" ? failMsg : null;

    if (["success", "completed", "succeeded"].includes(normalizedState)) {
      statusToSave = "COMPLETED";
      try {
        const parsed = typeof rawResult === "string"
          ? JSON.parse(rawResult)
          : rawResult;
        const parsedRecord = asRecord(parsed);
        const directUrls = parsedRecord?.resultUrls ?? parsedRecord?.result_urls ?? parsedRecord?.urls ?? parsedRecord?.generated;
        if (Array.isArray(directUrls)) {
          resultUrls = directUrls.filter((value): value is string => typeof value === "string" && value.length > 0);
        }
        const video = asRecord(parsedRecord?.video);
        if (!resultUrls.length && typeof video?.url === "string") {
          resultUrls = [video.url];
        }
      } catch (e) {
        console.error("[webhook-visual-ads] Failed to parse result payload:", e);
        statusToSave = "FAILED";
        errorMsg = "Failed to parse generation result";
      }
    } else if (["fail", "failed", "error"].includes(normalizedState)) {
      statusToSave = "FAILED";
    }

    console.log(`[webhook-visual-ads] Task ${taskId} finished with state ${normalizedState || "unknown"}. URLs:`, resultUrls);

    const updatePayload: Record<string, unknown> = {
      status: statusToSave,
      updated_at: new Date().toISOString(),
    };
    if (resultUrls.length) updatePayload.result_urls = resultUrls;
    if (errorMsg) updatePayload.error_msg = errorMsg;

    const { error: updateErr } = await supabase
      .from("visual_ads_jobs")
      .update(updatePayload)
      .eq("task_id", taskId);

    if (updateErr) {
      console.error("[webhook-visual-ads] Failed to update job row:", updateErr.message);
    } else {
      console.log("[webhook-visual-ads] Job row updated for taskId:", taskId);
    }

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
