import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// One-time cleanup: delete orphaned Vercel aliases for deleted projects
// Usage: POST with body { "subdomain": "abdullah" }

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { subdomain } = await req.json();
    if (!subdomain) {
      return new Response(JSON.stringify({ ok: false, error: "Missing subdomain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VERCEL_TOKEN = (Deno.env.get("VERCEL_TOKEN") || "").trim();
    if (!VERCEL_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "VERCEL_TOKEN not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve team ID
    const envTeamId = (Deno.env.get("VERCEL_TEAM_ID") || "").trim();
    let teamId: string | null = null;
    if (envTeamId.startsWith("team_")) {
      teamId = envTeamId;
    } else {
      const envTeamSlug = (Deno.env.get("VERCEL_TEAM_SLUG") || "").trim();
      const teamSlug = envTeamSlug || envTeamId;
      if (teamSlug) {
        const resp = await fetch("https://api.vercel.com/v2/teams", {
          headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, Accept: "application/json" },
        });
        if (resp.ok) {
          const data = await resp.json();
          const found = (data?.teams || []).find((t: any) => t.slug === teamSlug || t.id === teamSlug);
          teamId = found?.id || null;
        }
      }
    }

    const alias = `${subdomain}.wakti.ai`;
    const results: Record<string, any> = { alias, teamId };

    // 1) Try to get alias info first
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    
    const getResp = await fetch(`https://api.vercel.com/v4/aliases/${encodeURIComponent(alias)}${qs}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, Accept: "application/json" },
    });
    
    if (getResp.ok) {
      const aliasInfo = await getResp.json();
      results.aliasInfo = { uid: aliasInfo.uid, deploymentId: aliasInfo.deploymentId };
      
      // 2) Delete the alias
      const delAliasResp = await fetch(`https://api.vercel.com/v2/aliases/${encodeURIComponent(aliasInfo.uid)}${qs}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, Accept: "application/json" },
      });
      results.aliasDeleted = delAliasResp.ok;
      if (!delAliasResp.ok) {
        results.aliasDeleteError = await delAliasResp.text().catch(() => "");
      }

      // 3) Delete the deployment too
      if (aliasInfo.deploymentId) {
        const delDeployResp = await fetch(
          `https://api.vercel.com/v13/deployments/${encodeURIComponent(aliasInfo.deploymentId)}${qs}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, Accept: "application/json" },
          }
        );
        results.deploymentDeleted = delDeployResp.ok;
        if (!delDeployResp.ok) {
          results.deploymentDeleteError = await delDeployResp.text().catch(() => "");
        }
      }
    } else if (getResp.status === 404) {
      results.aliasNotFound = true;
    } else {
      results.aliasLookupError = await getResp.text().catch(() => "");
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
