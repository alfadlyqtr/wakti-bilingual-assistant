import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const WAKTI_BADGE = `<div id="_wakti_credit" style="text-align:center;padding:8px 0 12px;font-size:11px;color:rgba(120,120,120,0.8);">Made by <a href="https://wakti.qa" target="_blank" rel="noopener noreferrer" style="color:#8b5cf6;text-decoration:none;font-weight:600;">Wakti AI</a></div>`;
const DEFERRED_TAILWIND = `<script>(function(){var lt=function(){var s=document.createElement('script');s.src='https://cdn.tailwindcss.com';s.onload=function(){if(window.tailwind&&window.tailwind.scan)window.tailwind.scan();};document.head.appendChild(s);};typeof requestAnimationFrame!=='undefined'?requestAnimationFrame(function(){requestAnimationFrame(lt);}):setTimeout(lt,50);})();</script>`;

function patchHtml(html: string): string {
  return html
    .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@[^"'\s]*/g, "https://cdn.tailwindcss.com")
    .replace(/<script\s[^>]*src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/g, "")
    .replace("</body>", `${DEFERRED_TAILWIND}\n${WAKTI_BADGE}\n</body>`);
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function vercelDeploy(token: string, teamId: string | null, name: string, files: { path: string; content: string }[]): Promise<{ id: string; url: string }> {
  const filePayload = files.map(f => ({
    file: f.path,
    data: btoa(unescape(encodeURIComponent(f.content))),
    encoding: "base64",
  }));

  const body: Record<string, unknown> = {
    name,
    files: filePayload,
    projectSettings: { framework: null },
    target: "production",
  };
  if (teamId) body.teamId = teamId;

  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel deploy failed: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return { id: data.id ?? data.uid, url: data.url };
}

async function assignVercelAlias(token: string, teamId: string | null, deploymentId: string, alias: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = `https://api.vercel.com/v2/deployments/${deploymentId}/aliases${teamId ? `?teamId=${teamId}` : ""}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ alias }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return;
    if ((data as Record<string, unknown>).error === "deployment_not_ready" && attempt < 5) {
      await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    throw new Error(`Alias assign failed: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VERCEL_TOKEN = (Deno.env.get("VERCEL_TOKEN") || "").trim();

  if (!VERCEL_TOKEN) {
    return new Response(JSON.stringify({ error: "Missing VERCEL_TOKEN" }), { status: 500 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const VERCEL_TEAM_ID = (Deno.env.get("VERCEL_TEAM_ID") || "").trim() || null;

  const { data: projects, error: dbErr } = await supabaseAdmin
    .from("projects")
    .select("id, name, subdomain, published_url, deployment_id")
    .eq("status", "published")
    .not("deployment_id", "is", null)
    .not("published_url", "is", null);

  if (dbErr || !projects) {
    return new Response(JSON.stringify({ error: "DB query failed", detail: dbErr?.message }), { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const project of projects) {
    const baseUrl = (project.published_url as string).replace(/\/$/, "");
    const subdomain = project.subdomain as string;
    const name = `wakti-${subdomain}`;

    try {
      const html = await fetchText(`${baseUrl}/`);
      if (!html) {
        results.push({ id: project.id, subdomain, status: "fetch_failed" });
        continue;
      }

      if (html.includes("_wakti_credit")) {
        results.push({ id: project.id, subdomain, status: "already_has_badge" });
        continue;
      }

      const appJs = await fetchText(`${baseUrl}/app.js`);
      const appCss = await fetchText(`${baseUrl}/app.css`);

      if (!appJs) {
        results.push({ id: project.id, subdomain, status: "app_js_fetch_failed" });
        continue;
      }

      const patchedHtml = patchHtml(html);
      const vercelJson = JSON.stringify({ rewrites: [{ source: "/(.*)", destination: "/index.html" }] }, null, 2);

      const files: { path: string; content: string }[] = [
        { path: "index.html", content: patchedHtml },
        { path: "app.js", content: appJs },
        { path: "vercel.json", content: vercelJson },
      ];
      if (appCss) files.push({ path: "app.css", content: appCss });

      const deployed = await vercelDeploy(VERCEL_TOKEN, VERCEL_TEAM_ID, name, files);
      await assignVercelAlias(VERCEL_TOKEN, VERCEL_TEAM_ID, deployed.id, `${subdomain}.wakti.ai`);

      await supabaseAdmin
        .from("projects")
        .update({ deployment_id: deployed.id })
        .eq("id", project.id);

      results.push({ id: project.id, subdomain, status: "patched", newDeploymentId: deployed.id });
    } catch (e) {
      results.push({ id: project.id, subdomain, status: "error", error: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({ total: projects.length, results }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
