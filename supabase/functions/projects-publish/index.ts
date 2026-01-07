import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

type PublishFile = {
  path: string;
  content: string;
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

function slugify(input: string): string {
  const s = (input || "").toString().trim().toLowerCase();
  const cleaned = s
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "wakti-project";
}

function assertSafePath(path: string): void {
  const p = (path || "").trim();
  if (!p) throw new Error("BAD_REQUEST_EMPTY_PATH");
  if (p.startsWith("/") || p.startsWith("\\")) throw new Error("BAD_REQUEST_ABSOLUTE_PATH");
  if (p.includes("..")) throw new Error("BAD_REQUEST_PATH_TRAVERSAL");
  if (p.includes("\\")) throw new Error("BAD_REQUEST_WINDOWS_SEP");
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
    console.error("[projects-publish] resolveTeamId failed:", resp.status, txt);
    return null;
  }

  const data = (await resp.json().catch(() => null)) as any;
  const teams = Array.isArray(data?.teams) ? data.teams : [];
  const found = teams.find((t: any) => t && (t.slug === teamSlug || t.id === teamSlug));
  const id = found?.id;
  return typeof id === "string" ? id : null;
}

async function vercelDeploy(params: {
  token: string;
  teamId: string | null;
  projectId: string | null;
  name: string;
  files: PublishFile[];
  target?: "production" | "preview";
}): Promise<{ url: string; id?: string }>
{
  const qsArr = [];
  if (params.teamId) qsArr.push(`teamId=${encodeURIComponent(params.teamId)}`);
  const qs = qsArr.length > 0 ? `?${qsArr.join("&")}` : "";
  const endpoint = `https://api.vercel.com/v13/deployments${qs}`;

  const payload = {
    name: params.name,
    project: params.projectId || undefined,
    public: true,
    files: params.files.map((f) => ({ file: f.path, data: f.content })),
    projectSettings: {
      framework: null,
    },
    target: params.target || "production",
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await resp.json().catch(() => null)) as any;

  if (!resp.ok) {
    console.error("[projects-publish] vercelDeploy failed:", resp.status, data);
    throw new Error(`VERCEL_DEPLOY_FAILED_${resp.status}`);
  }

  const url = data?.url;
  if (typeof url !== "string" || !url) {
    throw new Error("VERCEL_DEPLOY_MISSING_URL");
  }

  return { url, id: typeof data?.id === "string" ? data.id : undefined };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const VERCEL_TOKEN = (Deno.env.get("VERCEL_TOKEN") || "").trim();
  if (!VERCEL_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured", code: "MISSING_VERCEL_TOKEN" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const projectNameRaw = typeof body.projectName === "string" ? body.projectName : "";
    const projectSlugRaw = typeof body.projectSlug === "string" ? body.projectSlug : "";
    const projectSlug = slugify(projectSlugRaw || projectNameRaw);

    const files = Array.isArray(body.files) ? (body.files as unknown[]) : [];
    const publishFiles: PublishFile[] = [];

    for (const f of files) {
      if (!f || typeof f !== "object") continue;
      const rec = f as Record<string, unknown>;
      const path = (rec.path ?? rec.file ?? "").toString();
      const content = (rec.content ?? rec.data ?? "").toString();
      assertSafePath(path);
      if (!content) throw new Error("BAD_REQUEST_EMPTY_FILE_CONTENT");
      publishFiles.push({ path, content });
    }

    if (publishFiles.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Missing files",
          code: "BAD_REQUEST_MISSING_FILES",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const teamId = await resolveTeamId(VERCEL_TOKEN);
    const VERCEL_PROJECT_ID = (Deno.env.get("VERCEL_PROJECT_ID") || "").trim();

    const name = `wakti-${projectSlug}`;

    const result = await vercelDeploy({
      token: VERCEL_TOKEN,
      teamId,
      projectId: VERCEL_PROJECT_ID || null,
      name,
      files: publishFiles,
      target: "production",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        url: `https://${result.url}`,
        deploymentId: result.id || null,
        name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
