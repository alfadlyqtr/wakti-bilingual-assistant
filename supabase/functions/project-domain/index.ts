import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Domain helpers ──────────────────────────────────────────────────────────

const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function validateDomain(domain: string): string | null {
  const d = domain.toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!DOMAIN_RE.test(d)) return null;
  if (d.endsWith(".wakti.ai")) return null; // cannot override wakti.ai subdomains
  return d;
}

/** An apex domain has no subdomain (e.g. example.com vs www.example.com) */
function isApexDomain(domain: string): boolean {
  return domain.split(".").length === 2;
}

function dnsInstructions(domain: string) {
  if (isApexDomain(domain)) {
    return {
      type: "A",
      host: "@",
      value: "76.76.21.21",
      note: "Some registrars also support ALIAS/ANAME instead of A for apex domains.",
    };
  }
  const parts = domain.split(".");
  const subdomain = parts.slice(0, -2).join(".");
  return {
    type: "CNAME",
    host: subdomain,
    value: "cname.vercel-dns.com",
    note: "DNS changes can take up to 48 hours to propagate.",
  };
}

// ─── Vercel helpers ──────────────────────────────────────────────────────────

async function resolveTeamId(token: string): Promise<string | null> {
  const envTeamId = (Deno.env.get("VERCEL_TEAM_ID") || "").trim();
  if (envTeamId.startsWith("team_")) return envTeamId;

  const resp = await fetch("https://api.vercel.com/v2/teams?limit=1", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!resp.ok) return null;
  const data = (await resp.json().catch(() => null)) as any;
  return data?.teams?.[0]?.id ?? null;
}

async function assignAlias(params: {
  token: string;
  teamId: string | null;
  deploymentId: string;
  alias: string;
}): Promise<void> {
  const qs = params.teamId ? `?teamId=${encodeURIComponent(params.teamId)}` : "";
  const endpoint = `https://api.vercel.com/v2/deployments/${params.deploymentId}/aliases${qs}`;

  const MAX = 8;
  for (let i = 1; i <= MAX; i++) {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ alias: params.alias }),
    });
    const data = (await resp.json().catch(() => null)) as any;
    if (resp.ok) return;
    const code = data?.error?.code ?? "";
    if (code === "deployment_not_ready" && i < MAX) {
      await new Promise(r => setTimeout(r, 2000 * i));
      continue;
    }
    throw new Error(`VERCEL_ALIAS_FAILED_${resp.status}: ${code || data?.error?.message || "unknown"}`);
  }
}

async function checkDomainConfig(params: {
  token: string;
  teamId: string | null;
  domain: string;
}): Promise<{ configured: boolean; reason?: string }> {
  const qs = params.teamId ? `?teamId=${encodeURIComponent(params.teamId)}` : "";
  const resp = await fetch(`https://api.vercel.com/v6/domains/${params.domain}/config${qs}`, {
    headers: { Authorization: `Bearer ${params.token}`, Accept: "application/json" },
  });
  if (!resp.ok) return { configured: false, reason: `Vercel config check returned ${resp.status}` };
  const data = (await resp.json().catch(() => null)) as any;
  const misconfigured = data?.misconfigured ?? true;
  return { configured: !misconfigured, reason: misconfigured ? "DNS not yet pointing to Vercel" : undefined };
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonResp({ ok: false, error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return jsonResp({ ok: false, error: "Unauthorized" }, 401);

    const VERCEL_TOKEN = (Deno.env.get("VERCEL_TOKEN") || "").trim();
    if (!VERCEL_TOKEN) return jsonResp({ ok: false, error: "Server misconfigured" }, 500);

    const body = await req.json() as {
      action: "add" | "remove" | "status";
      projectId: string;
      domain?: string;
    };

    const { action, projectId } = body;
    if (!action || !projectId) return jsonResp({ ok: false, error: "action and projectId required" }, 400);

    // Load the project — verify ownership
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, user_id, deployment_id, subdomain, custom_domain")
      .eq("id", projectId)
      .single();

    if (projErr || !project) return jsonResp({ ok: false, error: "Project not found" }, 404);
    if ((project as any).user_id !== user.id) return jsonResp({ ok: false, error: "Forbidden" }, 403);

    const teamId = await resolveTeamId(VERCEL_TOKEN);

    // ── STATUS ──────────────────────────────────────────────────────────────
    if (action === "status") {
      const domain = (project as any).custom_domain as string | null;
      if (!domain) return jsonResp({ ok: true, hasDomain: false });
      const { configured, reason } = await checkDomainConfig({ token: VERCEL_TOKEN, teamId, domain });
      return jsonResp({ ok: true, hasDomain: true, domain, configured, reason });
    }

    // ── REMOVE ──────────────────────────────────────────────────────────────
    if (action === "remove") {
      await supabase.from("projects").update({ custom_domain: null }).eq("id", projectId);
      return jsonResp({ ok: true });
    }

    // ── ADD ─────────────────────────────────────────────────────────────────
    if (action === "add") {
      const rawDomain = body.domain ?? "";
      const domain = validateDomain(rawDomain);
      if (!domain) return jsonResp({ ok: false, error: "Invalid domain. Enter a domain like mysite.com or www.mysite.com (not a wakti.ai subdomain)." }, 400);

      const deploymentId = (project as any).deployment_id as string | null;
      if (!deploymentId) {
        return jsonResp({ ok: false, error: "Publish your project first before adding a custom domain." }, 400);
      }

      // Check domain not already used by another project
      const { data: conflict } = await supabase
        .from("projects")
        .select("id")
        .eq("custom_domain", domain)
        .neq("id", projectId)
        .maybeSingle();
      if (conflict) return jsonResp({ ok: false, error: "This domain is already connected to another project." }, 409);

      // Assign the custom domain as a Vercel alias on the current deployment
      await assignAlias({ token: VERCEL_TOKEN, teamId, deploymentId, alias: domain });

      // Persist in DB
      await supabase.from("projects").update({ custom_domain: domain }).eq("id", projectId);

      // Check DNS status (best effort — might not be ready yet)
      const { configured } = await checkDomainConfig({ token: VERCEL_TOKEN, teamId, domain }).catch(() => ({ configured: false }));

      return jsonResp({
        ok: true,
        domain,
        configured,
        dns: dnsInstructions(domain),
      });
    }

    return jsonResp({ ok: false, error: "Unknown action" }, 400);
  } catch (err: unknown) {
    console.error("[project-domain] Error:", err);
    return jsonResp({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
  }
});
