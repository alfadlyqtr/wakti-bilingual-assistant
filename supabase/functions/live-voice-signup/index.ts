import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const MODEL = "gpt-realtime-mini-2025-12-15";
const REALTIME_URL = `https://api.openai.com/v1/realtime?model=${MODEL}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RateLimitEntry = { count: number; resetAt: number };
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimit = new Map<string, RateLimitEntry>();

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return "unknown";
}

function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateLimit.get(key);

  if (!existing || now >= existing.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  existing.count += 1;
  rateLimit.set(key, existing);
  return { ok: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(ip);
    if (!rl.ok) {
      return new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retry_after_seconds: rl.retryAfterSeconds,
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfterSeconds),
        },
      });
    }

    const body = await req.json();
    const { sdp_offer } = body ?? {};

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
      return new Response(JSON.stringify({
        error: "Failed to create realtime session",
        details: errorText,
      }), {
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
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
