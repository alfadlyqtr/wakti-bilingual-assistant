// ============================================================================
// WAKTI AI CODER — GitHub Import Edge Function
// Imports files from a public GitHub repository into a Wakti project.
//
// Limits:
//   - Public repos only (no token required for import)
//   - Max 75 files (browser Sandpack safety limit)
//   - Only imports web-relevant file extensions
//
// Outcomes:
//   - "direct"     → ready to preview as-is
//   - "converted"  → Vite-like repo, auto-normalized for Sandpack
//   - "reference"  → Next.js / full-stack, files stored as reference only
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".json",
  ".svg", ".md", ".txt", ".env.example",
]);

const MAX_FILES = 75;
const MAX_FILE_SIZE_BYTES = 150_000;

// ── Files that are ALWAYS useless or dangerous in Sandpack ──────────────────
// These are never fetched regardless of outcome.
const ALWAYS_SKIP_FILES = new Set([
  // Build/runtime tooling — not executable in Sandpack
  "vite.config.ts", "vite.config.js", "vite.config.mjs",
  "tsconfig.json", "tsconfig.node.json", "tsconfig.app.json",
  "postcss.config.js", "postcss.config.cjs", "postcss.config.mjs",
  "next.config.js", "next.config.ts", "next.config.mjs",
  "nuxt.config.ts", "nuxt.config.js",
  "astro.config.mjs", "astro.config.ts",
  "svelte.config.js", "remix.config.js",
  ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.ts",
  ".prettierrc", ".prettierrc.json", ".prettierrc.js",
  "babel.config.js", "babel.config.json", "jest.config.js", "jest.config.ts",
  "vitest.config.ts", "vitest.config.js",
  "playwright.config.ts", "cypress.config.ts",
  "vercel.json", "netlify.toml", "railway.json", ".vercelignore",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
  ".gitignore", ".gitattributes", ".editorconfig",
  "check-prod.js", "check-prod.ts",
]);

// ── Filename patterns that are always poison for Sandpack ───────────────────
// Even if not in the exact name set above, skip files matching these patterns.
const ALWAYS_SKIP_PATTERNS: RegExp[] = [
  /\.test\.(ts|tsx|js|jsx)$/i,       // test files
  /\.spec\.(ts|tsx|js|jsx)$/i,       // spec files
  /\.stories\.(ts|tsx|js|jsx)$/i,   // storybook
  /\.d\.ts$/i,                       // TypeScript declarations
  /^\./,                             // dotfiles (.env, .env.local, etc.)
  /\/__tests__\//,                   // test directories
  /\/e2e\//,                         // e2e test directories
  /\/scripts\//,                     // build scripts
  /\/uploads\//,                     // uploads folder
  /\/migrations\//,                  // DB migrations
  /\/supabase\/functions\//,         // edge functions (server-side only)
];

// ── npm packages that CANNOT run in Sandpack's browser sandbox ──────────────
// Any file that imports these will crash Sandpack. For rebuild mode we strip
// them; for direct/converted mode we replace the import with a safe stub.
const SANDBOX_POISON_IMPORTS = [
  // Markdown / unified ecosystem (uses Node fs/stream internally)
  "react-markdown", "unified", "vfile", "rehype", "remark",
  "mdast", "hast", "micromark", "@mdx-js",
  // Server-side / Node-only
  "@supabase/supabase-js", "@supabase/ssr",
  "express", "fastify", "koa", "hapi", "nestjs",
  "node-fetch", "axios", // axios works but imports node internals on some builds
  "fs-extra", "fs", "path", "os", "stream", "crypto",
  "chokidar", "esbuild", "rollup", "webpack",
  "sharp", "canvas", "jsdom",
  "nodemailer", "sendgrid", "twilio",
  "prisma", "typeorm", "sequelize", "mongoose",
  "@tanstack/react-query", // can work but often configured with server queryClient
  "react-router-dom/server",
];

// ── For REBUILD: the only files worth fetching for design extraction ─────────
// We want: styles, routing structure, page layouts, reusable components.
// We skip: data-fetching pages, server integrations, markdown renderers.
const REBUILD_VALUABLE_PATTERNS: RegExp[] = [
  /src\/index\.css$/i,
  /src\/App\.(tsx|jsx|ts|js)$/i,
  /src\/main\.(tsx|jsx|ts|js)$/i,
  /tailwind\.config\.(js|ts|cjs|mjs)$/i,
  /src\/pages\/[^/]+\.(tsx|jsx)$/i,           // page files (top-level only)
  /src\/components\/[^/]+\.(tsx|jsx|css)$/i,   // top-level components
  /src\/components\/[^/]+\/[^/]+\.(tsx|jsx|css)$/i, // one level deep
  /src\/styles\/.*\.css$/i,
  /src\/assets\/.*\.css$/i,
];

type CompatibilityOutcome = "direct" | "converted" | "reference" | "rebuild";

interface AnalysisResult {
  outcome: CompatibilityOutcome;
  framework: string;
  reasons: string[];
}

// ── Analyzer ────────────────────────────────────────────────────────────────
function analyzeRepo(
  filePaths: string[],
  fileContents: Map<string, string>
): AnalysisResult {
  const paths = filePaths.map((p) => p.toLowerCase());
  const reasons: string[] = [];

  // Next.js detection — reference only
  const isNext =
    paths.some((p) => p.endsWith("next.config.js") || p.endsWith("next.config.ts") || p.endsWith("next.config.mjs")) ||
    paths.some((p) => p.includes("/pages/api/") || p.includes("/app/api/")) ||
    Array.from(fileContents.values()).some(
      (c) => c.includes("getServerSideProps") || c.includes("getStaticProps") || c.includes("\"next\"") || c.includes("'next'")
    );

  if (isNext) {
    reasons.push("Next.js detected (server rendering / API routes)");
    return { outcome: "reference", framework: "Next.js", reasons };
  }

  // Vite detection — may need conversion
  const isVite =
    paths.some((p) => p.endsWith("vite.config.ts") || p.endsWith("vite.config.js")) ||
    Array.from(fileContents.values()).some((c) => c.includes("import.meta.env") || c.includes("from 'vite'") || c.includes('from "vite"'));

  const hasAliases = Array.from(fileContents.values()).some(
    (c) => /from ['"]@\//.test(c) || /import\(['"]@\//.test(c)
  );

  const needsConversion = isVite || hasAliases;

  if (needsConversion) {
    if (isVite) reasons.push("Vite project detected");
    if (hasAliases) reasons.push("Path aliases (@/) detected");
    return { outcome: "converted", framework: isVite ? "Vite" : "React", reasons };
  }

  // Static HTML
  const isStatic =
    paths.some((p) => p.endsWith("index.html")) &&
    !paths.some((p) => p.endsWith(".tsx") || p.endsWith(".jsx"));

  if (isStatic) {
    return { outcome: "direct", framework: "Static HTML", reasons: ["Plain HTML/CSS/JS"] };
  }

  // Check for packages that cannot run in Sandpack's browser sandbox
  // These use Node.js internals (fs, stream, process) and will always fail
  const SANDBOX_INCOMPATIBLE_PACKAGES = [
    "vfile", "unified", "rehype", "remark", "mdast", "hast",
    "react-markdown", "react-router-dom/server", "express", "fastify",
    "node-fetch", "fs-extra", "chokidar", "esbuild", "rollup",
    "@supabase/supabase-js", // needs real env vars
  ];

  // Check package.json for incompatible deps
  const packageJsonContent = Array.from(fileContents.entries())
    .find(([p]) => p.endsWith("package.json") && !p.includes("node_modules"))?.[1] || "";

  const hasIncompatiblePackage = SANDBOX_INCOMPATIBLE_PACKAGES.some(
    (pkg) => packageJsonContent.includes(`"${pkg}"`)
  );

  if (hasIncompatiblePackage) {
    const detected = SANDBOX_INCOMPATIBLE_PACKAGES.filter((pkg) =>
      packageJsonContent.includes(`"${pkg}"`)
    );
    reasons.push(`Uses packages not supported in browser preview: ${detected.slice(0, 3).join(", ")}`);
    return { outcome: "rebuild", framework: isVite ? "Vite" : "React", reasons };
  }

  // Default: treat as plain React/JS
  return { outcome: "direct", framework: "React", reasons: ["Standard React app"] };
}

// ── Converter ────────────────────────────────────────────────────────────────

function resolveRelativeImport(importPath: string, fromFilePath: string): string {
  if (!importPath.startsWith("./") && !importPath.startsWith("../")) return importPath;
  const fromDir = fromFilePath.replace(/^\//, "").split("/").slice(0, -1).join("/");
  const parts = (fromDir + "/" + importPath).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return "/" + resolved.join("/");
}

function convertForSandpack(content: string, filePath: string): string {
  let out = content;

  // 1. Vite env replacements
  out = out.replace(/import\.meta\.env\.VITE_[A-Z0-9_]+/g, '""');
  out = out.replace(/import\.meta\.env\.MODE/g, '"development"');
  out = out.replace(/import\.meta\.env\.DEV/g, "true");
  out = out.replace(/import\.meta\.env\.PROD/g, "false");
  out = out.replace(/import\.meta\.env(?!\.\w)/g, "{}");
  out = out.replace(/import\.meta\.url/g, '""');

  // 2. Rewrite @/ aliases to absolute paths (e.g. @/components/foo → /src/components/foo)
  out = out.replace(/from (['\"])@\//g, 'from $1/src/');
  out = out.replace(/import\((['\"])@\//g, 'import($1/src/');

  // 3. Rewrite relative imports to absolute paths so Sandpack resolves them correctly
  // regardless of the nesting level of the importing file.
  out = out.replace(/(?:from|import)\s+(['"])(\.\.?\/[^'"]+)\1/g, (match, quote, relPath) => {
    const abs = resolveRelativeImport(relPath, filePath);
    return match.replace(quote + relPath + quote, quote + abs + quote);
  });

  return out;
}

// ── URL parser ───────────────────────────────────────────────────────────────
function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } | null {
  try {
    const clean = url.trim().replace(/\.git$/, "");
    const match = clean.match(
      /github\.com[/:]([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?(?:\/.*)?$/
    );
    if (!match) return null;
    return { owner: match[1], repo: match[2], branch: match[3] || "main" };
  } catch {
    return null;
  }
}

function isAllowedFile(path: string): boolean {
  const lower = path.toLowerCase();
  // Skip generated/binary/vendor directories
  if (
    lower.includes("node_modules/") ||
    lower.includes(".git/") ||
    lower.includes("/dist/") ||
    lower.includes("/build/") ||
    lower.includes("/.next/") ||
    lower.includes("/out/") ||
    lower.includes("/.nuxt/") ||
    lower.includes("/coverage/")
  ) return false;

  // Skip exact filename blocklist
  const filename = path.split("/").pop() || "";
  if (ALWAYS_SKIP_FILES.has(filename)) return false;

  // Skip pattern blocklist
  for (const pattern of ALWAYS_SKIP_PATTERNS) {
    if (pattern.test(path)) return false;
  }

  // Must have an allowed extension
  const ext = "." + lower.split(".").pop();
  return ALLOWED_EXTENSIONS.has(ext);
}

// For rebuild outcome: only fetch files that have design/layout value
function isRebuildValuableFile(path: string): boolean {
  for (const pattern of REBUILD_VALUABLE_PATTERNS) {
    if (pattern.test(path)) return true;
  }
  return false;
}

// Returns true if the file content contains any import from a poison package.
// If it does, the ENTIRE file must be dropped — stripping the line is not enough
// because the rest of the file will reference the now-undefined variable.
function fileContainsPoisonImport(content: string): boolean {
  for (const pkg of SANDBOX_POISON_IMPORTS) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\n)\\s*import\\s[^\\n]*from\\s*['"]${escaped}[^'"]*['"]`, "m");
    if (re.test(content)) return true;
  }
  // Also check for direct supabase/client imports (project-local client file)
  if (/from\s+['"][^'"]*integrations\/supabase\/client['"]/.test(content)) return true;
  if (/from\s+['"][^'"]*supabase\/client['"]/.test(content)) return true;
  return false;
}

// Given the set of dropped file normalizedPaths, clean App.tsx / main.tsx / router files
// by removing: import lines that reference a dropped file, and JSX <DroppedComponent ... />
function cleanRouterFile(content: string, droppedPaths: Set<string>, _filePath: string): string {
  let out = content;
  for (const dropped of droppedPaths) {
    // Extract the basename without extension to identify the component name
    const basename = dropped.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
    if (!basename) continue;

    // Remove static import lines for this file (matches various quote styles)
    // e.g. import WaktiBlog from "/src/pages/WaktiBlog";
    // e.g. import WaktiBlog from "./pages/WaktiBlog";
    const importRe = new RegExp(
      `^[^\\n]*import[^\\n]*['"][^'"]*\\/${basename}(?:\\.[^'"]*)?['"][^\\n]*\\n?`,
      "gm"
    );
    out = out.replace(importRe, "");

    // Remove JSX self-closing and open tags for this component
    // e.g. <WaktiBlog />, <WaktiBlog>, element={<WaktiBlog />}
    const jsxRe = new RegExp(`<${basename}[\\s/>][^>]*\\/?>`, "g");
    out = out.replace(jsxRe, "<></>");

    // Remove Route elements that use this component
    // e.g. <Route path="..." element={<WaktiBlog />} />
    const routeRe = new RegExp(
      `<Route[^>]*element=\\{<${basename}[^>]*>\\}[^>]*\\/>`,
      "g"
    );
    out = out.replace(routeRe, "");
  }
  return out;
}

// Strip or stub out imports of Sandpack-incompatible packages from file content
function sanitizeImports(content: string): string {
  let out = content;
  for (const pkg of SANDBOX_POISON_IMPORTS) {
    // Remove entire import lines for this package
    // Handles: import X from 'pkg', import { X } from 'pkg', import 'pkg'
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const importLineRegex = new RegExp(
      `^[^\\S\\n]*import\\s[^\\n]*from\\s*['"](${escaped}[^'"]*)['"](\\s*;)?[^\\n]*$`,
      "gm"
    );
    out = out.replace(importLineRegex, `// [Wakti: removed incompatible import '${pkg}']`);
    // Also remove: import('pkg') dynamic imports
    const dynamicRegex = new RegExp(`import\\(['"](${escaped}[^'"]*)['"](\\s*)\\)`, "g");
    out = out.replace(dynamicRegex, `Promise.resolve({})`);
  }
  // Strip import.meta usage
  out = out.replace(/import\.meta\.env\.VITE_[A-Z0-9_]+/g, '""');
  out = out.replace(/import\.meta\.env\.MODE/g, '"development"');
  out = out.replace(/import\.meta\.env\.DEV/g, "true");
  out = out.replace(/import\.meta\.env\.PROD/g, "false");
  out = out.replace(/import\.meta\.env(?!\.\w)/g, "{}");
  out = out.replace(/import\.meta\.url/g, '""');
  out = out.replace(/import\.meta(?!\.\w)/g, "{}");
  // Strip process.env
  out = out.replace(/process\.env\.[A-Z0-9_]+/g, '""');
  out = out.replace(/process\.env/g, "{}");
  return out;
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { repoUrl, projectId, githubPat } = await req.json();
    if (!repoUrl || !projectId) {
      return new Response(
        JSON.stringify({ error: "Missing repoUrl or projectId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // deno-lint-ignore no-explicit-any
    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Invalid GitHub URL. Use: https://github.com/owner/repo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { owner, repo } = parsed;
    let { branch } = parsed;

    console.log(`[github-import] Importing ${owner}/${repo} @ ${branch} → project ${projectId} (PAT: ${githubPat ? 'yes' : 'no'})`);

    // Build GitHub headers — include PAT if provided to bypass rate limits
    const ghHeaders: Record<string, string> = {
      "User-Agent": "Wakti-AI-Coder",
      "Accept": "application/vnd.github.v3+json",
    };
    if (githubPat) ghHeaders["Authorization"] = `token ${githubPat}`;

    const rawHeaders: Record<string, string> = { "User-Agent": "Wakti-AI-Coder" };
    if (githubPat) rawHeaders["Authorization"] = `token ${githubPat}`;

    // Fetch tree, fallback main → master
    const fetchTree = async (b: string) => {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${b}?recursive=1`,
        { headers: ghHeaders }
      );
      return res;
    };

    let treeRes = await fetchTree(branch);
    if (!treeRes.ok && treeRes.status === 404 && branch === "main") {
      treeRes = await fetchTree("master");
      if (!treeRes.ok) {
        return new Response(
          JSON.stringify({ error: `Repository not found or is private: ${owner}/${repo}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      branch = "master";
    } else if (!treeRes.ok) {
      const errBody = await treeRes.text();
      return new Response(
        JSON.stringify({ error: `GitHub API error: ${treeRes.status} — ${errBody}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const treeData: { tree: Array<{ type: string; path: string; url: string; size?: number }> } = await treeRes.json();

    // First pass: get all allowed files
    const allFiles = (treeData.tree || []).filter(
      (item: { type: string; path: string }) => item.type === "blob" && isAllowedFile(item.path)
    );

    if (allFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No importable web files found in this repository." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (allFiles.length > MAX_FILES) {
      return new Response(
        JSON.stringify({
          error: `Repository has ${allFiles.length} files. Wakti AI is optimized for lightweight web apps (max ${MAX_FILES} files).`,
          fileCount: allFiles.length,
          limit: MAX_FILES,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For rebuild outcome we do a quick package.json pre-fetch to confirm,
    // then restrict fetching to only design-valuable files.
    // For direct/converted we fetch everything allowed (up to MAX_FILES).
    // We do this BEFORE full fetch to avoid wasting time on poison files.
    let filesToFetch = allFiles;

    // Quick pre-analysis: fetch package.json first to determine outcome early
    const pkgJsonFile = allFiles.find((f) => f.path === "package.json" || f.path.endsWith("/package.json") && !f.path.includes("node_modules"));
    let quickOutcome: CompatibilityOutcome | null = null;
    if (pkgJsonFile) {
      try {
        const pkgRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${pkgJsonFile.path}`, { headers: rawHeaders });
        if (pkgRes.ok) {
          const pkgContent = await pkgRes.text();
          const hasPoison = SANDBOX_POISON_IMPORTS.some((pkg) => pkgContent.includes(`"${pkg}"`));
          const isViteProject = pkgContent.includes('"vite"');
          const isNextProject = pkgContent.includes('"next"');
          if (isNextProject) quickOutcome = "reference";
          else if (hasPoison) quickOutcome = "rebuild";
          else if (isViteProject) quickOutcome = "converted";
        }
      } catch { /* ignore, full analysis will run later */ }
    }

    // If this is a rebuild, only fetch design-valuable files — skip poison
    if (quickOutcome === "rebuild") {
      filesToFetch = allFiles.filter((f) => isRebuildValuableFile(f.path));
      // Always include package.json for analysis
      if (pkgJsonFile && !filesToFetch.find((f) => f.path === pkgJsonFile.path)) {
        filesToFetch.push(pkgJsonFile);
      }
      console.log(`[github-import] Rebuild mode: filtered to ${filesToFetch.length} design-valuable files (from ${allFiles.length} total)`);
    }

    // Fetch file contents
    const rawContents = new Map<string, string>();
    const skipped: string[] = [];
    const chunks: typeof filesToFetch[] = [];
    for (let i = 0; i < filesToFetch.length; i += 10) chunks.push(filesToFetch.slice(i, i + 10));

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (file) => {
          try {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
            const res = await fetch(rawUrl, { headers: rawHeaders });
            if (!res.ok) { skipped.push(file.path); return; }
            const content = await res.text();
            if (content.length > MAX_FILE_SIZE_BYTES) { skipped.push(file.path); return; }
            rawContents.set(file.path, content);
          } catch {
            skipped.push(file.path);
          }
        })
      );
    }

    if (rawContents.size === 0) {
      return new Response(
        JSON.stringify({ error: "Could not fetch any file content from the repository." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Analyze repo compatibility
    const analysis = analyzeRepo(Array.from(rawContents.keys()), rawContents);
    console.log(`[github-import] Outcome: ${analysis.outcome} (${analysis.framework}) — ${analysis.reasons.join(", ")}`);

    // Build final file list with conversion if needed
    const filesToInsert: Array<{ project_id: string; path: string; content: string }> = [];

    // First pass: process each file, track which ones were DROPPED due to poison imports
    const processedFiles = new Map<string, string>(); // normalizedPath → processed content
    const droppedPaths = new Set<string>();            // normalizedPaths that were dropped

    for (const [filePath, rawContent] of rawContents.entries()) {
      const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;

      // Drop files that contain poison imports entirely — stripping the import line
      // is not sufficient because the rest of the file references the undefined variable.
      // Exception: rebuild mode files are kept as design reference (imports already stripped).
      if (analysis.outcome !== "rebuild" && fileContainsPoisonImport(rawContent)) {
        droppedPaths.add(normalizedPath);
        skipped.push(filePath + " [poison-dropped]");
        console.log(`[github-import] Dropping poison file: ${normalizedPath}`);
        continue;
      }

      let content = rawContent;

      if (analysis.outcome === "converted") {
        content = convertForSandpack(content, normalizedPath);
        content = sanitizeImports(content);
      } else if (analysis.outcome === "rebuild") {
        content = sanitizeImports(content);
      } else {
        content = content.replace(/import\.meta\.env\.VITE_[A-Z0-9_]+/g, '""');
        content = content.replace(/import\.meta\.env(?!\.\w)/g, "{}");
        content = content.replace(/process\.env\.[A-Z0-9_]+/g, '""');
      }

      processedFiles.set(normalizedPath, content);
    }

    // Second pass: clean router/App/main files by removing references to dropped files
    const ROUTER_FILES = new Set(["/src/App.tsx", "/src/App.jsx", "/src/App.js", "/src/main.tsx", "/src/main.jsx", "/src/main.js", "/App.tsx", "/App.jsx"]);
    for (const [normalizedPath, content] of processedFiles.entries()) {
      const isRouterFile = ROUTER_FILES.has(normalizedPath) || normalizedPath.toLowerCase().includes("router");
      const finalContent = (droppedPaths.size > 0 && isRouterFile)
        ? cleanRouterFile(content, droppedPaths, normalizedPath)
        : content;
      filesToInsert.push({
        project_id: projectId,
        path: normalizedPath,
        content: finalContent,
      });
    }

    if (droppedPaths.size > 0) {
      console.log(`[github-import] Dropped ${droppedPaths.size} poison files:`, Array.from(droppedPaths));
    }

    // Save to DB
    // deno-lint-ignore no-explicit-any
    await (supabase as any).from("project_files").delete().eq("project_id", projectId);

    // deno-lint-ignore no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("project_files")
      .insert(filesToInsert);

    if (insertError) {
      console.error("[github-import] DB insert error:", insertError.message);
      return new Response(
        JSON.stringify({ error: `Failed to save files: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update project metadata
    // deno-lint-ignore no-explicit-any
    await (supabase as any)
      .from("projects")
      .update({
        name: `${owner}/${repo}`,
        description: `Imported from github.com/${owner}/${repo} (${branch})`,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    console.log(`[github-import] ✅ ${filesToInsert.length} files | outcome: ${analysis.outcome} | skipped: ${skipped.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileCount: filesToInsert.length,
        skipped: skipped.length,
        repo: `${owner}/${repo}`,
        branch,
        outcome: analysis.outcome,
        framework: analysis.framework,
        reasons: analysis.reasons,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[github-import] Fatal:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
