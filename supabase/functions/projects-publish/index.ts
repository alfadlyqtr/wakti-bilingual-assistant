import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function escapeHtmlRuntime(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeInlineScriptRuntime(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

function escapeInlineStyleRuntime(source: string): string {
  return source.replace(/<\/style/gi, "<\\/style");
}

const BUNDLED_APP_MARKER = "// ========== BUNDLED APP WITH SHIMS ==========";
const RUNTIME_EXECUTE_BUNDLE_MARKER = "function executeBundledApp()";

function buildPublishedRuntimeHtml(params: {
  projectName: string;
  bundledJs: string;
  bundledCss: string;
}): string {
  const safeTitle = escapeHtmlRuntime(params.projectName || "Wakti Preview");
  const safeJs = escapeInlineScriptRuntime(params.bundledJs || "");
  const safeCss = escapeInlineStyleRuntime(params.bundledCss || "");
  const encodedBundledJs = JSON.stringify(safeJs);
  const reactUrls = JSON.stringify([
    "https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js",
    "https://unpkg.com/react@18/umd/react.production.min.js",
  ]);
  const reactDomUrls = JSON.stringify([
    "https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js",
    "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  ]);
  const reactIsUrls = JSON.stringify([
    "https://cdn.jsdelivr.net/npm/react-is@18/umd/react-is.production.min.js",
    "https://unpkg.com/react-is/umd/react-is.production.min.js",
  ]);
  const framerMotionUrls = JSON.stringify([
    "https://cdn.jsdelivr.net/npm/framer-motion@6.5.1/dist/framer-motion.js",
    "https://unpkg.com/framer-motion@6.5.1/dist/framer-motion.js",
  ]);
  const lucideUrls = JSON.stringify([
    "https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js",
    "https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js",
  ]);
  const rechartsUrls = JSON.stringify([
    "https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.min.js",
    "https://unpkg.com/recharts/umd/Recharts.min.js",
  ]);
  const tailwindUrls = JSON.stringify([
    "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
    "https://cdn.tailwindcss.com",
  ]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&family=Oswald:wght@400;500;600;700&family=Cairo:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            inter: ['Inter', 'sans-serif'],
            tajawal: ['Tajawal', 'sans-serif'],
            oswald: ['Oswald', 'sans-serif'],
            cairo: ['Cairo', 'sans-serif'],
            playfair: ['Playfair Display', 'serif'],
            roboto: ['Roboto', 'sans-serif'],
            poppins: ['Poppins', 'sans-serif'],
          },
          colors: {
            gray: {
              50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
              500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712',
            },
            zinc: {
              50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
              500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b',
            },
            slate: {
              50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
              500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
            },
            purple: {
              50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
              500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
            },
            pink: {
              50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6',
              500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724',
            },
            rose: {
              50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
              500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519',
            },
            amber: {
              50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
              500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
            },
          },
        },
      },
    };
  </script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; min-height: 100vh; font-family: 'Inter', 'Tajawal', system-ui, sans-serif; }
    #root { min-height: 100vh; }
    .bg-clip-text { -webkit-background-clip: text; background-clip: text; }
    .text-transparent { color: transparent; }
    ${safeCss}
  </style>
</head>
<body>
  <div id="root">
    <div id="wakti-boot-status" style="padding:40px;text-align:center;font-family:Inter,system-ui,sans-serif;">
      <div style="font-size:24px;margin-bottom:16px;">⏳</div>
      <div style="color:#666;">Loading app...</div>
    </div>
  </div>
  <script>
    window.__waktiBootLog = [];
    function waktiRunnerNotify(type, payload) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ source: 'wakti-preview-runner', type, payload }, '*');
        }
      } catch {}
    }
    function waktiLog(msg) {
      window.__waktiBootLog.push('[' + new Date().toISOString() + '] ' + msg);
      console.log('[Wakti Boot]', msg);
    }
    window.onerror = function(msg, url, line, col, error) {
      waktiLog('UNCAUGHT ERROR: ' + msg + ' at ' + url + ':' + line);
      waktiRunnerNotify('error', { message: String(msg || 'Unknown runtime error'), stack: error && error.stack ? error.stack : '' });
      var bootDiv = document.getElementById('wakti-boot-status');
      if (bootDiv) {
        bootDiv.innerHTML = '<div style="color:#f87171;font-size:18px;margin-bottom:16px;">❌ Error</div>' +
          '<pre style="background:#1e1e1e;padding:16px;border-radius:8px;text-align:left;overflow:auto;max-width:100%;font-size:12px;color:#f87171;">' +
          msg + '\n' + ((error && error.stack) || '') + '</pre>' +
          '<div style="color:#9ca3af;margin-top:16px;font-size:12px;">Check console for details</div>';
      }
      return false;
    };
    window.onunhandledrejection = function(e) {
      var message = e && e.reason && e.reason.message ? e.reason.message : (e && e.reason ? String(e.reason) : 'Unknown promise error');
      waktiLog('UNHANDLED PROMISE: ' + message);
      waktiRunnerNotify('error', { message: message });
    };
    waktiLog('Script block starting');
    waktiLog('React available: ' + (typeof React !== 'undefined'));
    waktiLog('ReactDOM available: ' + (typeof ReactDOM !== 'undefined'));
    function syncRuntimeGlobals(motionLabel) {
      var runtimeMotion = window.FramerMotion || window.Motion;
      waktiLog(motionLabel + ': ' + (!!runtimeMotion));
      if (runtimeMotion) {
        window.FramerMotion = runtimeMotion;
        window.motion = runtimeMotion.motion;
        window.AnimatePresence = runtimeMotion.AnimatePresence;
        window.useAnimation = runtimeMotion.useAnimation;
        window.useInView = runtimeMotion.useInView;
        window.useScroll = runtimeMotion.useScroll;
        window.useTransform = runtimeMotion.useTransform;
        window.useMotionValue = runtimeMotion.useMotionValue;
      }
      if (typeof window.lucide !== 'undefined' && window.lucide) {
        window.__lucideIcons = window.lucide;
      }
      return runtimeMotion;
    }
    syncRuntimeGlobals('Framer Motion available');
    if (typeof window.Recharts !== 'undefined' && window.Recharts) {
      waktiLog('Recharts available: true');
    } else {
      waktiLog('Recharts available: false');
    }

    function setBootError(message, details) {
      var bootDiv = document.getElementById('wakti-boot-status');
      if (!bootDiv) {
        return;
      }
      bootDiv.innerHTML = '<div style="color:#f87171;font-size:18px;margin-bottom:16px;">❌ Error</div>' +
        '<pre style="background:#1e1e1e;padding:16px;border-radius:8px;text-align:left;overflow:auto;max-width:100%;font-size:12px;color:#f87171;white-space:pre-wrap;">' +
        String(message || 'Unknown runtime error') + (details ? '\n\n' + details : '') + '</pre>' +
        '<div style="color:#9ca3af;margin-top:16px;font-size:12px;">The published app could not start.</div>';
    }

    function loadScriptWithTimeout(url, timeoutMs) {
      return new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        var settled = false;
        var timeout = window.setTimeout(function() {
          if (settled) {
            return;
          }
          settled = true;
          script.remove();
          reject(new Error('Timed out loading ' + url));
        }, timeoutMs);

        script.src = url;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = function() {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timeout);
          resolve(url);
        };
        script.onerror = function() {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timeout);
          script.remove();
          reject(new Error('Failed to load ' + url));
        };

        document.head.appendChild(script);
      });
    }

    async function loadFirstAvailable(label, urls, required) {
      var errors = [];
      for (var i = 0; i < urls.length; i += 1) {
        var url = urls[i];
        try {
          waktiLog('Loading ' + label + ' from ' + url);
          await loadScriptWithTimeout(url, 6000);
          waktiLog('Loaded ' + label + ' from ' + url);
          return url;
        } catch (error) {
          var message = error && error.message ? error.message : String(error);
          errors.push(message);
          waktiLog('Failed ' + label + ' from ' + url + ': ' + message);
        }
      }

      if (required) {
        throw new Error(label + ' failed to load. ' + errors.join(' | '));
      }

      return null;
    }

    async function ensureRuntimeDependencies() {
      await loadFirstAvailable('React', ${reactUrls}, true);
      await loadFirstAvailable('ReactDOM', ${reactDomUrls}, true);
      await loadFirstAvailable('ReactIs', ${reactIsUrls}, false);
      await loadFirstAvailable('Framer Motion', ${framerMotionUrls}, false);
      await loadFirstAvailable('Lucide', ${lucideUrls}, false);
      await loadFirstAvailable('Recharts', ${rechartsUrls}, false);
      await loadFirstAvailable('Tailwind Browser Runtime', ${tailwindUrls}, false);
    }

    function executeBundledApp() {
      var source = ${encodedBundledJs};
      if (!source) {
        throw new Error('Bundled app source is empty');
      }

      var script = document.createElement('script');
      script.text = source;
      document.body.appendChild(script);
      script.remove();
      waktiLog('Bundled code executed');
    }
  </script>
  <script>
    function renderApp(retries) {
      retries = retries || 0;
      try {
        if (typeof window.App === 'undefined' || window.App === null) {
          if (retries < 120) {
            setTimeout(function() { renderApp(retries + 1); }, 100);
            return;
          }
          throw new Error('App component not found after ' + retries + ' attempts. window.App = ' + typeof window.App + '. Boot log: ' + window.__waktiBootLog.join(' | '));
        }
        var rootElement = document.getElementById('root');
        var root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(window.App));
        waktiLog('App rendered successfully');
        waktiRunnerNotify('ready', { ok: true });
      } catch (err) {
        var message = err && err.message ? err.message : String(err);
        waktiLog('RENDER ERROR: ' + message);
        console.error('[Wakti] Render error:', err);
        waktiRunnerNotify('error', { message: message, stack: err && err.stack ? err.stack : '' });
        document.getElementById('root').innerHTML = '<div style="padding:40px;text-align:center;color:#f87171;font-family:Inter,sans-serif;"><h2>Error loading app</h2><pre style="background:#1e1e1e;padding:20px;border-radius:8px;text-align:left;overflow:auto;max-width:100%;font-size:12px;">' + message + '</pre><details style="margin-top:20px;text-align:left;"><summary style="cursor:pointer;color:#9ca3af;">Boot Log</summary><pre style="background:#1e1e1e;padding:12px;border-radius:4px;font-size:10px;margin-top:8px;">' + (window.__waktiBootLog || []).join('\n') + '</pre></details></div>';
      }
    }

    async function bootPublishedApp() {
      try {
        await ensureRuntimeDependencies();

        syncRuntimeGlobals('Framer Motion available after load');

        executeBundledApp();
        renderApp(0);
      } catch (error) {
        var message = error && error.message ? error.message : String(error);
        waktiLog('BOOT ERROR: ' + message);
        setBootError(message, (window.__waktiBootLog || []).join('\n'));
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { bootPublishedApp(); });
    } else {
      bootPublishedApp();
    }
  </script>
</body>
</html>`;
}

function tryParseJsStringLiteral(literal: string): string | null {
  const trimmed = (literal || "").trim();
  if (!trimmed.startsWith("\"") || !trimmed.endsWith("\"")) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as string;
  } catch (error) {
    console.warn("[projects-publish] Failed to parse bundled runtime source literal:", error);
    return null;
  }
}

function extractBundledSourceFromRuntimeSource(source: string): string | null {
  const match = source.match(/function executeBundledApp\(\)\s*{\s*var source = ([\s\S]*?);\s*if \(!source\)/);
  if (!match?.[1]) {
    return null;
  }

  return tryParseJsStringLiteral(match[1]);
}

function unwrapNestedBundledSource(source: string): string {
  let current = source;

  for (let depth = 0; depth < 5; depth += 1) {
    const nestedSource = extractBundledSourceFromRuntimeSource(current);
    if (!nestedSource) {
      return current;
    }

    console.warn(`[projects-publish] Detected nested runtime wrapper at depth ${depth + 1}, unwrapping`);
    current = nestedSource;
  }

  return current;
}

function upgradeLegacyPublishedHtml(html: string, fallbackProjectName: string): string {
  const looksLikeRuntimeHtml = html.includes("Loading app...") && html.includes(RUNTIME_EXECUTE_BUNDLE_MARKER);
  if (!looksLikeRuntimeHtml && !html.includes(BUNDLED_APP_MARKER)) {
    return html;
  }

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
  const scriptMatches = Array.from(html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/gi));
  const runtimeBundledSource = extractBundledSourceFromRuntimeSource(html);
  const bundledScript = unwrapNestedBundledSource(
    runtimeBundledSource ||
      scriptMatches
        .map((match) => match[1] || "")
        .find((script) => script.includes(BUNDLED_APP_MARKER)) ||
      "",
  );

  if (!bundledScript) {
    return html;
  }

  if (!bundledScript.includes(BUNDLED_APP_MARKER)) {
    console.warn("[projects-publish] Unable to isolate bundled app source from runtime HTML; leaving content unchanged");
    return html;
  }

  return buildPublishedRuntimeHtml({
    projectName: (titleMatch?.[1] || fallbackProjectName || "Wakti Project").trim(),
    bundledJs: bundledScript,
    bundledCss: styleMatch?.[1] || "",
  });
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
  qsArr.push("skipAutoDetectionConfirmation=1");  // Skip framework auto-detection
  const qs = qsArr.length > 0 ? `?${qsArr.join("&")}` : "";
  const endpoint = `https://api.vercel.com/v13/deployments${qs}`;

  // Build payload with proper static file settings
  const payload: Record<string, unknown> = {
    name: params.name,
    files: uploadedFiles,
    target: "production",  // Deploy as production (public, not protected preview)
    // CRITICAL: Attach to existing project so all sites go to wakti-user-sites
    ...(params.projectId ? { project: params.projectId } : {}),
    projectSettings: {
      framework: null,        // No framework - pure static
      buildCommand: null,     // null = explicitly skip (NOT empty string which means "use default")
      outputDirectory: null,  // null = serve from root
      installCommand: null,   // null = skip npm install
    },
  };

  console.log("[projects-publish] Creating deployment:", {
    name: params.name,
    attachingToProject: params.projectId || "none (will create new)",
    teamId: params.teamId,
    fileCount: uploadedFiles.length,
    totalSize: uploadedFiles.reduce((acc, f) => acc + f.size, 0),
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

// Sleep helper for retry backoff
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 2000; // Start with 2 seconds

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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

    if (resp.ok) {
      console.log("[projects-publish] Alias assigned:", params.alias);
      return;
    }

    const errorCode = data?.error?.code || "";
    const errorMessage = data?.error?.message || "Unknown error";

    // If deployment not ready, wait and retry
    if (errorCode === "deployment_not_ready") {
      const delayMs = BASE_DELAY_MS * attempt; // Linear backoff: 2s, 4s, 6s...
      console.log(`[projects-publish] Alias attempt ${attempt}/${MAX_RETRIES} failed: deployment_not_ready, retrying in ${delayMs}ms`);
      
      if (attempt < MAX_RETRIES) {
        await sleep(delayMs);
        continue;
      }
    }

    // For any other error or max retries exhausted, throw
    console.error("[projects-publish] assignVercelAlias failed:", resp.status, data);
    throw new Error(`VERCEL_ALIAS_FAILED_${resp.status}: ${errorCode || errorMessage}`);
  }
}

const CODE_VERSION = "2026-06-21-V7";

serve(async (req) => {
  console.log(`[projects-publish] CODE_VERSION=${CODE_VERSION}`);
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
      const rawContent = (rec.content ?? rec.data ?? "").toString();
      assertSafePath(path);
      if (!rawContent) continue; // skip empty files (e.g. no-CSS projects)
      const content = path === "index.html"
        ? upgradeLegacyPublishedHtml(rawContent, projectNameRaw || "Wakti Project")
        : rawContent;
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

    // ── Server-side subdomain availability check ──────────────────────
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if another project already owns this subdomain (case-insensitive)
    // Also load custom_domain so we can re-assign it after redeploy
    const { data: existing, error: checkErr } = await supabaseAdmin
      .from("projects")
      .select("id,user_id,custom_domain")
      .ilike("subdomain", projectSlug)
      .maybeSingle();

    // Load current project's custom_domain for re-assignment
    const { data: currentProject } = projectId
      ? await supabaseAdmin.from("projects").select("custom_domain").eq("id", projectId).single()
      : { data: null };
    const existingCustomDomain = (currentProject as any)?.custom_domain as string | null ?? null;

    if (checkErr) {
      console.error("[projects-publish] subdomain check error:", checkErr);
    }

    if (existing && existing.id !== projectId) {
      console.log("[projects-publish] Subdomain taken:", projectSlug, "by project", existing.id);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "This subdomain is already taken",
          code: "SUBDOMAIN_TAKEN",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ── End subdomain check ────────────────────────────────────────────

    const teamId = await resolveTeamId(VERCEL_TOKEN);
    const VERCEL_PROJECT_ID = (Deno.env.get("VERCEL_PROJECT_ID") || "").trim();

    const name = `wakti-${projectSlug}`;

    // Deploy to Vercel
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

    // Re-assign custom domain if the project already has one
    if (existingCustomDomain) {
      try {
        await assignVercelAlias({
          token: VERCEL_TOKEN,
          teamId,
          deploymentId: result.id,
          alias: existingCustomDomain,
        });
        console.log("[projects-publish] Custom domain re-assigned:", existingCustomDomain);
      } catch (domainErr) {
        // Non-fatal — subdomain alias already succeeded, log and continue
        console.warn("[projects-publish] Custom domain re-assign failed (non-fatal):", domainErr);
      }
    }

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
