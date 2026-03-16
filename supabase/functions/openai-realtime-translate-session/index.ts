import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// === TRIAL TOKEN CHECK (inlined) ===
// deno-lint-ignore no-explicit-any
async function checkAndConsumeTrialToken(supabaseClient: any, userId: string, featureKey: string, maxLimit: number): Promise<{ allowed: boolean; isVip?: boolean }> {
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('trial_usage, is_subscribed, payment_method, next_billing_date, admin_gifted, free_access_start_at')
    .eq('id', userId)
    .single();
  if (error || !profile) return { allowed: false };
  if (profile.is_subscribed === true) return { allowed: true, isVip: true };
  if (profile.admin_gifted === true) return { allowed: true, isVip: true };
  const pm = profile.payment_method;
  if (pm && pm !== 'manual' && profile.next_billing_date && new Date(profile.next_billing_date) > new Date()) return { allowed: true, isVip: true };
  if (profile.free_access_start_at == null) return { allowed: true, isVip: false };
  // deno-lint-ignore no-explicit-any
  const usage: Record<string, number> = (profile.trial_usage as any) ?? {};
  const current = typeof usage[featureKey] === 'number' ? usage[featureKey] : 0;
  if (current >= maxLimit) return { allowed: false };
  const { error: updateError } = await supabaseClient.from('profiles').update({ trial_usage: { ...usage, [featureKey]: current + 1 } }).eq('id', userId);
  if (updateError) return { allowed: false };
  return { allowed: true };
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const MODEL = "gpt-4o-realtime-preview-2024-12-17";
const REALTIME_URL = `https://api.openai.com/v1/realtime?model=${MODEL}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trial gate: interpreter — limit 5 for free users
    const trial = await checkAndConsumeTrialToken(supabase, user.id, 'interpreter', 5);
    if (!trial.allowed) {
      return new Response(JSON.stringify({ error: 'TRIAL_LIMIT_REACHED', feature: 'interpreter' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { sdp_offer } = body;

    if (!sdp_offer) {
      return new Response(JSON.stringify({ error: "Missing sdp_offer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiResponse = await fetch(REALTIME_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/sdp",
      },
      body: sdp_offer,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[openai-realtime-translate-session] OpenAI error:", openaiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to create realtime session", details: errorText }), {
        status: openaiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sdpAnswer = await openaiResponse.text();

    return new Response(JSON.stringify({
      success: true,
      sdp_answer: sdpAnswer,
      model: MODEL,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[openai-realtime-translate-session] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
