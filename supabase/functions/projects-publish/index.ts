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

// Compute SHA-1 hash of content for Vercel file upload
async function computeSha1(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Upload a file to Vercel and get its SHA
async function uploadFileToVercel(params: {
  token: string;
  teamId: string | null;
  content: string;
  sha: string;
}): Promise<void> {
  const qsArr = [];
  if (params.teamId) qsArr.push(`teamId=${encodeURIComponent(params.teamId)}`);
  const qs = qsArr.length > 0 ? `?${qsArr.join("&")}` : "";
  const endpoint = `https://api.vercel.com/v2/files${qs}`;

  console.log("[projects-publish] Uploading file with SHA:", params.sha.substring(0, 12) + "...");

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/octet-stream",
      "x-vercel-digest": params.sha,
    },
    body: params.content,
  });

  if (!resp.ok && resp.status !== 409) {
    // 409 means file already exists, which is fine
    const text = await resp.text().catch(() => "");
    console.error("[projects-publish] uploadFileToVercel failed:", resp.status, text);
    throw new Error(`VERCEL_UPLOAD_FAILED_${resp.status}: ${text}`);
  }

  console.log("[projects-publish] File uploaded successfully");
}

async function vercelDeploy(params: {
  token: string;
  teamId: string | null;
  projectId: string | null;
  name: string;
  files: PublishFile[];
}): Promise<{ url: string; id: string }>
{
  // Step 1: Upload each file and compute SHA
  const uploadedFiles: { file: string; sha: string; size: number }[] = [];
  
  for (const f of params.files) {
    const sha = await computeSha1(f.content);
    const size = new TextEncoder().encode(f.content).length;
    
    await uploadFileToVercel({
      token: params.token,
      teamId: params.teamId,
      content: f.content,
      sha,
    });
    
    uploadedFiles.push({ file: f.path, sha, size });
  }

  // Step 2: Create deployment referencing uploaded files
  const qsArr = [];
  if (params.teamId) qsArr.push(`teamId=${encodeURIComponent(params.teamId)}`);
  const qs = qsArr.length > 0 ? `?${qsArr.join("&")}` : "";
  const endpoint = `https://api.vercel.com/v13/deployments${qs}`;

  // Build payload with uploaded file references (no target = Vercel decides)
  const payload: Record<string, unknown> = {
    name: params.name,
    files: uploadedFiles,
    projectSettings: {
      framework: null,
    },
  };

  // Only add project if we have a valid project ID
  if (params.projectId) {
    payload.project = params.projectId;
  }

  console.log("[projects-publish] Creating deployment:", {
    name: params.name,
    projectId: params.projectId,
    teamId: params.teamId,
    fileCount: uploadedFiles.length,
  });

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
    console.error("[projects-publish] vercelDeploy failed:", resp.status, JSON.stringify(data));
    throw new Error(`VERCEL_DEPLOY_FAILED_${resp.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }

  const url = data?.url;
  const id = data?.id;
  if (typeof url !== "string" || !url) {
    throw new Error("VERCEL_DEPLOY_MISSING_URL");
  }
  if (typeof id !== "string" || !id) {
    throw new Error("VERCEL_DEPLOY_MISSING_ID");
  }

  console.log("[projects-publish] Deployment created:", { url, id });
  return { url, id };
}

async function assignVercelAlias(params: {
  token: string;
  teamId: string | null;
  deploymentId: string;
  alias: string;
}): Promise<void> {
  const qsArr = [];
  if (params.teamId) qsArr.push(`teamId=${encodeURIComponent(params.teamId)}`);
  const qs = qsArr.length > 0 ? `?${qsArr.join("&")}` : "";
  const endpoint = `https://api.vercel.com/v2/deployments/${params.deploymentId}/aliases${qs}`;

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

  if (!resp.ok) {
    console.error("[projects-publish] assignVercelAlias failed:", resp.status, data);
    throw new Error(`VERCEL_ALIAS_FAILED_${resp.status}: ${data?.error?.message || "Unknown error"}`);
  }

  console.log("[projects-publish] Alias assigned:", params.alias);
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

    // Deploy to Vercel (no target specified - Vercel will assign automatically)
    const result = await vercelDeploy({
      token: VERCEL_TOKEN,
      teamId,
      projectId: VERCEL_PROJECT_ID || null,
      name,
      files: publishFiles,
    });

    // Assign the subdomain alias (e.g., myproject.wakti.ai)
    const subdomainAlias = `${projectSlug}.wakti.ai`;
    await assignVercelAlias({
      token: VERCEL_TOKEN,
      teamId,
      deploymentId: result.id,
      alias: subdomainAlias,
    });

    const finalUrl = `https://${subdomainAlias}`;
    console.log("[projects-publish] Published successfully:", finalUrl);

    return new Response(
      JSON.stringify({
        ok: true,
        url: finalUrl,
        deploymentId: result.id,
        vercelUrl: `https://${result.url}`,
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
