import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const REALX_VERIFY_URL = Deno.env.get("REALX_WAKTI_VERIFY_URL") || "https://me-central1-reelx-backend.cloudfunctions.net/verifyWaktiStudent";
const REALX_API_KEY = Deno.env.get("REALX_WAKTI_API_KEY") || "";
const REALX_PORTAL_URL = Deno.env.get("REALX_WAKTI_PORTAL_URL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RateLimitEntry = { count: number; resetAt: number };
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 25;
const rateLimit = new Map<string, RateLimitEntry>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request) {
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
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  rateLimit.set(key, existing);
  return { ok: true };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function maskEmail(email: string) {
  const normalized = normalizeEmail(email);
  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain) return "[invalid-email]";

  if (localPart.length <= 2) {
    return `${localPart[0] ?? ""}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizePortalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.warn("[verify-student-realx] Invalid request method", {
      requestId,
      method: req.method,
    });
    return json({ status: "integration_unavailable", portalUrl: sanitizePortalUrl(REALX_PORTAL_URL) }, 405);
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    console.warn("[verify-student-realx] Rate limit exceeded", {
      requestId,
      ip,
      retryAfterSeconds: rl.retryAfterSeconds,
    });
    return new Response(JSON.stringify({
      status: "integration_unavailable",
      portalUrl: sanitizePortalUrl(REALX_PORTAL_URL),
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(rl.retryAfterSeconds),
      },
    });
  }

  let maskedEmail = "[unknown-email]";

  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(String(body?.email || ""));
    const portalUrl = sanitizePortalUrl(REALX_PORTAL_URL);
    maskedEmail = maskEmail(email);

    console.info("[verify-student-realx] Verification request received", {
      requestId,
      email: maskedEmail,
      hasVerifyUrl: Boolean(REALX_VERIFY_URL),
      hasApiKey: Boolean(REALX_API_KEY),
    });

    if (!email || !isValidEmail(email)) {
      console.warn("[verify-student-realx] Invalid email payload", {
        requestId,
        email: maskedEmail,
      });
      return json({ status: "invalid_email", portalUrl }, 400);
    }

    if (!REALX_VERIFY_URL || !REALX_API_KEY) {
      console.error("[verify-student-realx] Missing realX configuration", {
        requestId,
        email: maskedEmail,
        hasVerifyUrl: Boolean(REALX_VERIFY_URL),
        hasApiKey: Boolean(REALX_API_KEY),
      });
      return json({ status: "integration_unavailable", portalUrl });
    }

    console.info("[verify-student-realx] Calling realX endpoint", {
      requestId,
      email: maskedEmail,
      verifyUrl: REALX_VERIFY_URL,
    });

    const response = await fetch(REALX_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wakti-api-key": REALX_API_KEY,
      },
      body: JSON.stringify({ email }),
    });

    console.info("[verify-student-realx] realX endpoint responded", {
      requestId,
      email: maskedEmail,
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[verify-student-realx] realX verification failed", {
        requestId,
        email: maskedEmail,
        status: response.status,
        body: errorText,
      });
      return json({ status: "integration_unavailable", portalUrl });
    }

    const payload = await response.json().catch(() => null);
    const isStudent = payload?.isStudent === true;

    console.info("[verify-student-realx] Verification completed", {
      requestId,
      email: maskedEmail,
      outcome: isStudent ? "verified" : "not_verified",
    });

    return json({
      status: isStudent ? "verified" : "not_verified",
      portalUrl,
    });
  } catch (error) {
    console.error("[verify-student-realx] Unexpected error", {
      requestId,
      email: maskedEmail,
      error,
    });
    return json({
      status: "integration_unavailable",
      portalUrl: sanitizePortalUrl(REALX_PORTAL_URL),
    });
  }
});
