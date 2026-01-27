import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

 type VercelTeam = {
   id?: string;
   slug?: string;
 };

 type VercelTeamsResponse = {
   teams?: VercelTeam[];
 };

 type HardDeleteRequestBody = {
   projectId?: string;
 };

const allowedOrigins = [
  "https://wakti.qa",
  "https://www.wakti.qa",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const getCorsHeaders = (origin: string | null) => {
  const isLocalDev =
    origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"));

  const isAllowed =
    isLocalDev ||
    (origin &&
      (allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
        origin.includes("lovable.dev") ||
        origin.includes("lovable.app") ||
        origin.includes("lovableproject.com")));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
};

function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.split(".").length !== 3) return null;
    const payloadB64 = token.split(".")[1];
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    return payload.sub || null;
  } catch {
    return null;
  }
}

async function resolveTeamId(token: string): Promise<string | null> {
  const envTeamId = (Deno.env.get("VERCEL_TEAM_ID") || "").trim();
  if (envTeamId.startsWith("team_")) return envTeamId;

  const envTeamSlug = (Deno.env.get("VERCEL_TEAM_SLUG") || "").trim();
  const teamSlug = envTeamSlug || envTeamId;
  if (!teamSlug) return null;

  const resp = await fetch("https://api.vercel.com/v2/teams", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    console.error("[projects-hard-delete] resolveTeamId failed:", resp.status, txt);
    return null;
  }

  const data = (await resp.json().catch(() => null)) as VercelTeamsResponse | null;
  const teams = Array.isArray(data?.teams) ? data!.teams! : [];
  const found = teams.find((t) => t && (t.slug === teamSlug || t.id === teamSlug));
  const id = found?.id;
  return typeof id === "string" ? id : null;
}

async function deleteVercelAlias(params: { token: string; teamId: string | null; alias: string }) {
  const qsArr: string[] = [];
  if (params.teamId) qsArr.push(`teamId=${encodeURIComponent(params.teamId)}`);
  const qs = qsArr.length > 0 ? `?${qsArr.join("&")}` : "";
  const endpoint = `https://api.vercel.com/v2/aliases/${encodeURIComponent(params.alias)}${qs}`;

  const resp = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok && resp.status !== 404) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`VERCEL_ALIAS_DELETE_FAILED_${resp.status}: ${txt}`);
  }
}

async function deleteVercelDeployment(params: { token: string; teamId: string | null; deploymentId: string }) {
  const qsArr: string[] = [];
  if (params.teamId) qsArr.push(`teamId=${encodeURIComponent(params.teamId)}`);
  const qs = qsArr.length > 0 ? `?${qsArr.join("&")}` : "";
  const endpoint = `https://api.vercel.com/v13/deployments/${encodeURIComponent(params.deploymentId)}${qs}`;

  const resp = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok && resp.status !== 404) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`VERCEL_DEPLOYMENT_DELETE_FAILED_${resp.status}: ${txt}`);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = (await req.json().catch(() => ({}))) as HardDeleteRequestBody;
    const projectId = typeof body.projectId === "string" ? body.projectId : "";

    if (!projectId) {
      return new Response(JSON.stringify({ ok: false, error: "Missing projectId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projectErr } = await supabaseAdmin
      .from("projects")
      .select("id,user_id,subdomain,published_url,deployment_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr) throw projectErr;
    if (!project) {
      return new Response(JSON.stringify({ ok: false, error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (project.user_id !== userId) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Disable published URL (Vercel alias + deployment)
    const VERCEL_TOKEN = (Deno.env.get("VERCEL_TOKEN") || "").trim();
    const alias = project.subdomain ? `${project.subdomain}.wakti.ai` : null;

    let aliasDeleted = false;
    let deploymentDeleted = false;

    if (VERCEL_TOKEN) {
      const teamId = await resolveTeamId(VERCEL_TOKEN);

      if (alias) {
        try {
          await deleteVercelAlias({ token: VERCEL_TOKEN, teamId, alias });
          aliasDeleted = true;
        } catch (e) {
          console.error("[projects-hard-delete] Failed to delete alias:", alias, e);
        }
      }

      if (project.deployment_id) {
        try {
          await deleteVercelDeployment({ token: VERCEL_TOKEN, teamId, deploymentId: project.deployment_id });
          deploymentDeleted = true;
        } catch (e) {
          console.error("[projects-hard-delete] Failed to delete deployment:", project.deployment_id, e);
        }
      }
    }

    // 2) Delete storage objects tracked in project_uploads (covers project-uploads + project-assets)
    const { data: uploads, error: uploadsErr } = await supabaseAdmin
      .from("project_uploads")
      .select("bucket_id,storage_path")
      .eq("project_id", projectId);

    if (uploadsErr) throw uploadsErr;

    const byBucket = new Map<string, string[]>();
    for (const u of uploads || []) {
      const bucketId = typeof (u as { bucket_id?: unknown }).bucket_id === "string"
        ? (u as { bucket_id: string }).bucket_id
        : "project-uploads";
      const storagePath = (u as { storage_path?: unknown }).storage_path;
      if (typeof storagePath !== "string" || !storagePath) continue;
      if (!byBucket.has(bucketId)) byBucket.set(bucketId, []);
      byBucket.get(bucketId)!.push(storagePath);
    }

    let deletedStorageObjects = 0;

    for (const [bucketId, paths] of byBucket.entries()) {
      for (const part of chunk(paths, 100)) {
        const { error: removeErr } = await supabaseAdmin.storage.from(bucketId).remove(part);
        if (removeErr) {
          console.error("[projects-hard-delete] storage remove error:", bucketId, removeErr);
        } else {
          deletedStorageObjects += part.length;
        }
      }
    }

    // Extra safety: best-effort delete of any leftover project-uploads folder
    try {
      const projectUploadsPrefix = `${userId}/${projectId}`;
      const { data: topLevel } = await supabaseAdmin.storage.from("project-uploads").list(projectUploadsPrefix);
      if (topLevel && topLevel.length > 0) {
        const toRemove = topLevel.map((f: { name: string }) => `${projectUploadsPrefix}/${f.name}`);
        await supabaseAdmin.storage.from("project-uploads").remove(toRemove);
      }
    } catch (e) {
      console.error("[projects-hard-delete] fallback project-uploads cleanup failed:", e);
    }

    // 3) Delete project row (DB cascades everything)
    const { error: deleteErr } = await supabaseAdmin.from("projects").delete().eq("id", projectId);
    if (deleteErr) throw deleteErr;

    return new Response(
      JSON.stringify({
        ok: true,
        alias,
        aliasDeleted,
        deploymentId: project.deployment_id || null,
        deploymentDeleted,
        deletedStorageObjects,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
