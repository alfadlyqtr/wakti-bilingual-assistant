import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Add missing types for Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
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
    (origin && allowedOrigins.some((allowed) => origin.startsWith(allowed)));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
};

interface ImageAttachment {
  type: string; // e.g., "image/png", "image/jpeg"
  data: string; // base64 encoded
  name?: string;
}

interface RequestBody {
  action?: 'start' | 'status' | 'get_files';
  jobId?: string;
  projectId?: string;
  mode?: 'create' | 'edit' | 'chat';
  prompt?: string;
  currentFiles?: Record<string, string>;
  assets?: string[];
  theme?: string;
  userInstructions?: string;
  images?: ImageAttachment[];
  history?: Array<{ role: string; content: string }>;
}

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

type Database = {
  public: {
    Tables: {
      projects: {
        Row: { id: string; user_id: string };
        Insert: { id?: string; user_id: string };
        Update: { user_id?: string };
        Relationships: [];
      };
      project_files: {
        Row: { id: string; project_id: string; path: string; content: string };
        Insert: { id?: string; project_id: string; path: string; content: string };
        Update: { path?: string; content?: string };
        Relationships: [];
      };
      project_generation_jobs: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          status: JobStatus;
          mode: 'create' | 'edit';
          prompt: string | null;
          result_summary: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          status: JobStatus;
          mode: 'create' | 'edit';
          prompt?: string | null;
          result_summary?: string | null;
          error?: string | null;
        };
        Update: {
          status?: JobStatus;
          result_summary?: string | null;
          error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SupabaseAdminClient = SupabaseClient<Database>;

function normalizeFilePath(path: string): string {
  const p = (path || "").trim();
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

function assertNoHtml(value: string): void {
  const v = (value || "").toLowerCase();
  if (v.includes("<!doctype") || v.includes("<html")) {
    throw new Error("AI_RETURNED_HTML");
  }
}

async function callGPT41MiniMissingFiles(
  missingPaths: string[],
  changedFiles: Record<string, string>,
  existingFiles: Record<string, string>,
  originalUserPrompt: string
): Promise<Record<string, string>> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

  const MAX_FILE_CHARS = 4000;
  const contextFiles: Record<string, string> = {};
  const safeAdd = (p: string) => {
    const key = normalizeFilePath(p);
    const content = changedFiles[key] || existingFiles[key];
    if (typeof content === 'string') contextFiles[key] = content.slice(0, MAX_FILE_CHARS);
  };

  safeAdd('/App.js');
  for (const [p, c] of Object.entries(changedFiles || {})) {
    const relImports = extractRelativeImports(c);
    const hitsMissing = relImports.some((spec) => {
      const candidates = resolveImportCandidates(p, spec);
      return candidates.some((cand) => missingPaths.includes(cand));
    });
    if (hitsMissing) safeAdd(p);
  }

  const filesStr = Object.entries(contextFiles).map(([k, v]) => `FILE: ${k}\n${v}`).join('\n\n');

  const systemPrompt = `You are an expert React code generator.

TASK:
Generate the missing React component files requested.

RULES:
1. Output MUST be valid JSON. No markdown fences.
2. Keys MUST be exact file paths as provided.
3. Only return the missing files - do not return existing files.
4. ONLY use lucide-react for icons. Never use react-icons or heroicons.

OUTPUT FORMAT:
{
  "/components/Example.jsx": "import React from 'react';\\n..."
}`;

  const userMsg = `The project update referenced files that do not exist.

MISSING FILES (return these exact paths):\n${missingPaths.join('\n')}

CONTEXT:\n${filesStr}\n\nORIGINAL REQUEST:\n${originalUserPrompt}`;

  console.log(`[GPT-4.1-mini] Generating ${missingPaths.length} missing files`);

  const response = await withTimeout(fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      max_tokens: 4096,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg }
      ],
    }),
  }), 45000, 'GPT41_MISSING');

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[GPT-4.1-mini missing files] API Error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || "";
  content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) content = content.substring(jsonStart, jsonEnd + 1);
  content = fixUnescapedNewlines(content);

  const parsed = JSON.parse(content);
  const filesObj = (parsed && typeof parsed === 'object') ? (parsed as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filesObj)) {
    if (typeof v !== 'string') continue;
    out[normalizeFilePath(k)] = v;
  }

  return out;
}

function extractJsonObject(text: string): string {
  const cleaned = (text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return cleaned;
  return cleaned.substring(jsonStart, jsonEnd + 1);
}

function coerceFilesMap(raw: unknown): { files: Record<string, string>; summary: string } {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const filesObjCandidate = obj.files;
  const filesObj = (filesObjCandidate && typeof filesObjCandidate === "object") ? (filesObjCandidate as Record<string, unknown>) : obj;
  const summary = typeof obj.summary === "string" ? obj.summary : "";

  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(filesObj)) {
    if (typeof v !== "string") continue;
    const p = normalizeFilePath(k);
    files[p] = v;
  }

  return { files, summary };
}

function getAdminClient(userAuthHeader: string | null): SupabaseAdminClient {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing");
  if (SUPABASE_SERVICE_ROLE_KEY) {
    return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  if (!SUPABASE_ANON_KEY) throw new Error("SUPABASE_ANON_KEY missing");
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: userAuthHeader ? { headers: { Authorization: userAuthHeader } } : {},
  });
}

async function assertProjectOwnership(supabase: SupabaseAdminClient, projectId: string, userId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`DB_PROJECT_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error("PROJECT_NOT_FOUND");
  if (data.user_id !== userId) throw new Error("FORBIDDEN");
}

async function createJob(supabase: SupabaseAdminClient, params: {
  projectId: string;
  userId: string;
  mode: 'create' | 'edit';
  prompt: string;
}): Promise<{ id: string; status: JobStatus }> {
  const { data, error } = await supabase
    .from("project_generation_jobs")
    .insert({
      project_id: params.projectId,
      user_id: params.userId,
      status: "running",
      mode: params.mode,
      prompt: params.prompt,
    })
    .select("id, status")
    .single();

  if (error) throw new Error(`DB_JOB_INSERT_FAILED: ${error.message}`);
  return { id: data.id, status: data.status };
}

async function updateJob(supabase: SupabaseAdminClient, jobId: string, patch: Partial<{ status: JobStatus; error: string | null; result_summary: string | null }>) {
  const { error } = await supabase
    .from("project_generation_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw new Error(`DB_JOB_UPDATE_FAILED: ${error.message}`);
}

async function replaceProjectFiles(supabase: SupabaseAdminClient, projectId: string, files: Record<string, string>) {
  const { error: delErr } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId);
  if (delErr) throw new Error(`DB_FILES_DELETE_FAILED: ${delErr.message}`);

  const rows = Object.entries(files).map(([path, content]) => ({
    project_id: projectId,
    path: normalizeFilePath(path),
    content,
  }));

  if (rows.length === 0) throw new Error("NO_FILES_TO_SAVE");

  const { error: insErr } = await supabase
    .from("project_files")
    .insert(rows);
  if (insErr) throw new Error(`DB_FILES_INSERT_FAILED: ${insErr.message}`);
}

async function upsertProjectFiles(supabase: SupabaseAdminClient, projectId: string, files: Record<string, string>) {
  const rows = Object.entries(files).map(([path, content]) => ({
    project_id: projectId,
    path: normalizeFilePath(path),
    content,
  }));
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("project_files")
    .upsert(rows, { onConflict: "project_id,path" });
  if (error) throw new Error(`DB_FILES_UPSERT_FAILED: ${error.message}`);
}

const THEME_PRESETS: Record<string, string> = {
  'wakti-dark': 'Wakti Dark theme: Deep Navy (#0c0f14), Royal Purple (#060541), Subtle Gray (#858384). Modern font, Glow shadows, Rounded corners, Cards layout. Mood: Elegant.',
  'midnight': 'Midnight theme: Deep Indigo (#1e1b4b), Dark Purple (#312e81), Royal Blue (#4338ca), Indigo (#6366f1). Modern font, Glow shadows, Rounded corners. Mood: Sophisticated.',
  'obsidian': 'Obsidian theme: Slate (#1e293b), Charcoal (#334155), Gray (#475569). Minimal font, No shadow, Subtle radius. Mood: Professional.',
  'brutalist': 'Brutalist theme: Indigo (#6366f1), Purple (#a855f7), Pink (#ec4899), Red (#f43f5e). Bold font, Neon shadows, No radius, Bento layout. Mood: Bold.',
  'wakti-light': 'Wakti Light theme: Off-White (#fcfefd), Deep Purple (#060541), Warm Beige (#e9ceb0). Classic font, Soft shadows, Rounded corners. Mood: Elegant.',
  'glacier': 'Glacier theme: Soft Blue (#60a5fa), Lavender (#a5b4fc), Light Purple (#c4b5fd), Ice (#e0e7ff). Minimal font, Soft shadows, Rounded corners. Mood: Calm.',
  'lavender': 'Lavender theme: Soft Purple (#a78bfa), Lilac (#c4b5fd), Pale Violet (#ddd6fe). Classic font, Soft shadows, Rounded corners. Mood: Elegant.',
  'vibrant': 'Vibrant theme: Blue (#3b82f6), Purple (#8b5cf6), Orange (#f97316), Pink (#ec4899). Bold font, Glow shadows, Rounded corners, Bento layout. Mood: Playful.',
  'neon': 'Neon theme: Cyan (#22d3ee), Lime (#a3e635), Yellow (#facc15), Pink (#f472b6). Bold font, Neon shadows, Pill radius, Bento layout. Mood: Bold/Electric.',
  'sunset': 'Sunset theme: Orange (#f97316), Peach (#fb923c), Soft Coral (#fdba74). Modern font, Glow shadows, Rounded corners. Mood: Playful/Warm.',
  'orchid': 'Orchid theme: Pink (#ec4899), Rose (#f472b6), Blush (#f9a8d4). Playful font, Soft shadows, Pill radius. Mood: Feminine/Playful.',
  'coral': 'Coral theme: Rose Red (#f43f5e), Salmon (#fb7185), Pink (#fda4af). Bold font, Hard shadows, Rounded corners, Bento layout. Mood: Bold.',
  'emerald': 'Emerald theme: Green (#10b981), Mint (#34d399), Seafoam (#6ee7b7). Modern font, Soft shadows, Rounded corners. Mood: Calm.',
  'forest': 'Forest theme: Bright Green (#22c55e), Lime (#4ade80), Pale Green (#86efac). Classic font, Soft shadows, Subtle radius. Mood: Organic.',
  'solar': 'Solar theme: Gold (#eab308), Yellow (#facc15), Lemon (#fde047). Bold font, Glow shadows, Rounded corners, Bento layout. Mood: Optimistic.',
  'ocean': 'Ocean theme: Sky Blue (#0ea5e9), Cyan (#38bdf8), Aqua (#7dd3fc). Modern font, Soft shadows, Rounded corners. Mood: Professional.',
  'harvest': 'Harvest theme: Amber (#f59e0b), Gold (#fbbf24), Warm Cream (#fde68a). Bold font, Hard shadows, Subtle radius, Magazine layout. Mood: Warm.',
  'none': 'Use a sophisticated dark premium theme with deep gradients (slate-950 to indigo-950) and glassmorphism.'
};

const BASE_SYSTEM_PROMPT = `
You are the world's most elite UI/UX designer, Full-Stack Architect, and React Expert. Your goal is to create "Wakti-standard" designs: ultra-premium, high-end, and artistic, while ensuring the application is fully functional, logical, and architecturally sound.

### PART 1: AESTHETICS & DESIGN
1.  **Theme Compliance**: {{THEME_INSTRUCTIONS}}
2.  **Layout**: Use "Bento Box" grids, asymmetrical layouts, and generous whitespace.
3.  **Visual Depth**: Use advanced glassmorphism (backdrop-blur-2xl bg-white/[0.02] border-white/[0.05]), multi-layered shadows, and mesh gradients.
4.  **Micro-interactions**: Every button and card must have hover effects (scale, glow, border-color change). Use Framer Motion. Buttons need "active:scale-95".

### PART 2: ARCHITECTURE
1.  **Frontend-as-Backend**: Create \`/utils/mockData.js\` for data. Use \`useEffect\` with simulated latency for realism.
2.  **In-Memory CRUD**: Make "Add", "Edit", and "Delete" work in React state.
3.  **No External Routing**: Use state-based navigation: \`const [page, setPage] = useState('home');\`.

### PART 3: ALLOWED PACKAGES (CRITICAL)
You may ONLY import from these packages (they are pre-installed):
- react, react-dom
- framer-motion
- lucide-react (for ALL icons)
- date-fns
- recharts
- @tanstack/react-query
- clsx, tailwind-merge

DO NOT use react-icons, heroicons, or any other icon library. ONLY use lucide-react.
Example: import { Mail, Phone, Linkedin, Instagram, ChevronDown, Menu, X } from 'lucide-react';

### PART 4: IMAGE IDS
ONLY use these Unsplash IDs:
- Luxury: 1523170335258-f5ed11844a49, 1515562141207-7a88fb7ce338, 1617038220319-276d3cf663c6
- Tech: 1519389950473-47ba0277781c, 1551288049-bebda4e38f71, 1531297422935-40280f32a347
- Abstract: 1618005182384-a83a8bd57fbe, 1550684848-fac1c5b4e853, 1620121692634-99a437207985

### OUTPUT FORMAT:
Return ONLY a valid JSON object. No markdown fences. No explanation.
Structure:
{
  "/App.js": "...",
  "/components/Navbar.jsx": "...",
  "/utils/mockData.js": "..."
}

CRITICAL RULES:
1. Every opening JSX tag must be closed.
2. All string values must have properly escaped quotes (use \\" for quotes inside strings).
3. NEWLINES MUST BE ESCAPED AS \\n inside JSON strings. NO ACTUAL NEWLINES.
4. Output must be a single parseable JSON object.
5. ONLY use lucide-react for icons. NEVER use react-icons or heroicons.
`;

function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payloadB64 = token.split(".")[1];
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub || null;
  } catch {
    return null;
  }
}

function fixUnescapedNewlines(jsonStr: string): string {
  // Walk through character by character, escaping raw newlines inside JSON strings
  let result = '';
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    // If previous char was backslash, this char is escaped - just add it
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    
    // Backslash starts an escape sequence
    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }
    
    // Toggle string mode on unescaped quotes
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    // If inside a string and we hit a RAW newline (not \n), escape it
    if (inString && char === '\n') {
      result += '\\n';
      continue;
    }
    if (inString && char === '\r') {
      result += '\\r';
      continue;
    }
    if (inString && char === '\t') {
      result += '\\t';
      continue;
    }
    
    result += char;
  }
  
  return result;
}

function _createFailsafeComponent(errorMessage: string): Record<string, string> {
  return {
    "/App.js": `import React from 'react';
import { AlertTriangle } from 'lucide-react';
export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 text-white">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Generation Error</h1>
        <p className="text-gray-400 mb-4">AI response could not be parsed.</p>
        <pre className="text-xs bg-black/50 p-4 rounded text-red-300 overflow-auto text-left whitespace-pre-wrap">${errorMessage.replace(/"/g, '\\"')}</pre>
      </div>
    </div>
  );
}`
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs) as unknown as number;
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
}

function extractRelativeImports(source: string): string[] {
  const imports: string[] = [];
  const s = source || '';

  // import X from './foo'
  const importRe = /import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;
  // import './foo'
  const importSideEffectRe = /import\s+['"]([^'"]+)['"]/g;
  // require('./foo')
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

  const scan = (re: RegExp) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const spec = (m[1] || '').trim();
      if (!spec) continue;
      if (!spec.startsWith('.')) continue;
      imports.push(spec);
    }
  };

  scan(importRe);
  scan(importSideEffectRe);
  scan(requireRe);

  return Array.from(new Set(imports));
}

function dirOf(path: string): string {
  const p = normalizeFilePath(path);
  const idx = p.lastIndexOf('/');
  if (idx <= 0) return '/';
  return p.slice(0, idx);
}

function joinPath(baseDir: string, rel: string): string {
  const base = (baseDir || '/').split('/').filter(Boolean);
  const parts = (rel || '').split('/').filter((x) => x.length > 0);
  const stack = [...base];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return '/' + stack.join('/');
}

function resolveImportCandidates(fromFile: string, spec: string): string[] {
  const fromDir = dirOf(fromFile);
  const base = joinPath(fromDir, spec);
  const hasExt = /\.[a-z0-9]+$/i.test(base);
  const candidates: string[] = [];
  if (hasExt) {
    candidates.push(normalizeFilePath(base));
  } else {
    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
      candidates.push(normalizeFilePath(base + ext));
    }
    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
      candidates.push(normalizeFilePath(base + '/index' + ext));
    }
    candidates.push(normalizeFilePath(base));
  }
  return Array.from(new Set(candidates));
}

function findMissingReferencedFiles(params: {
  changedFiles: Record<string, string>;
  existingFiles: Record<string, string>;
}): string[] {
  const missing = new Set<string>();
  const { changedFiles, existingFiles } = params;

  for (const [filePath, content] of Object.entries(changedFiles || {})) {
    const relImports = extractRelativeImports(content);
    for (const spec of relImports) {
      const candidates = resolveImportCandidates(filePath, spec);
      const exists = candidates.some((p) => typeof changedFiles[p] === 'string' || typeof existingFiles[p] === 'string');
      if (!exists) {
        missing.add(candidates[0]);
      }
    }
  }

  return Array.from(missing);
}

async function callGPT4oMini(systemPrompt: string, userPrompt: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${OPENAI_API_KEY}` 
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt }, 
        { role: "user", content: userPrompt }
      ],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Diff-based editing with Gemini 1.5 Flash (1M context window)
// Returns patches that we apply programmatically - never truncates
interface EditPatch {
  file: string;
  action: "replace" | "insert_after" | "insert_before" | "delete";
  find: string;      // The exact string to find (for replace/insert_after/insert_before/delete)
  content?: string;  // The new content (for replace/insert_after/insert_before)
}

function applyPatches(
  currentFiles: Record<string, string>,
  patches: EditPatch[]
): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const patch of patches) {
    const filePath = normalizeFilePath(patch.file);
    // Get current content (from result if already modified, else from original)
    let content = result[filePath] ?? currentFiles[filePath] ?? "";
    
    if (patch.action === "replace") {
      if (content.includes(patch.find)) {
        content = content.replace(patch.find, patch.content || "");
      } else {
        console.warn(`[applyPatches] Could not find string to replace in ${filePath}`);
      }
    } else if (patch.action === "insert_after") {
      if (content.includes(patch.find)) {
        content = content.replace(patch.find, patch.find + (patch.content || ""));
      } else {
        console.warn(`[applyPatches] Could not find anchor for insert_after in ${filePath}`);
      }
    } else if (patch.action === "insert_before") {
      if (content.includes(patch.find)) {
        content = content.replace(patch.find, (patch.content || "") + patch.find);
      } else {
        console.warn(`[applyPatches] Could not find anchor for insert_before in ${filePath}`);
      }
    } else if (patch.action === "delete") {
      if (content.includes(patch.find)) {
        content = content.replace(patch.find, "");
      } else {
        console.warn(`[applyPatches] Could not find string to delete in ${filePath}`);
      }
    }
    
    result[filePath] = content;
  }
  
  return result;
}

async function callGeminiDiffEdit(
  _systemPrompt: string, 
  userPrompt: string,
  currentFiles: Record<string, string>
): Promise<{ files: Record<string, string>; summary: string }> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  // Smart context: prioritize relevant files, limit total size
  const MAX_FILE_CHARS = 8000;
  const MAX_TOTAL_CHARS = 60000;
  const promptLower = userPrompt.toLowerCase();
  
  const prioritizedFiles: Record<string, string> = {};
  let totalChars = 0;
  
  // Always include App.js first (main file)
  if (currentFiles["/App.js"]) {
    const content = currentFiles["/App.js"].slice(0, MAX_FILE_CHARS);
    prioritizedFiles["/App.js"] = content;
    totalChars += content.length;
  }
  
  // Add files mentioned in the prompt
  for (const [path, content] of Object.entries(currentFiles)) {
    if (path === "/App.js") continue;
    const fileName = path.split('/').pop()?.toLowerCase() || '';
    if (promptLower.includes(fileName) || promptLower.includes(path.toLowerCase())) {
      const truncated = content.slice(0, MAX_FILE_CHARS);
      if (totalChars + truncated.length < MAX_TOTAL_CHARS) {
        prioritizedFiles[path] = truncated;
        totalChars += truncated.length;
      }
    }
  }
  
  // Add component files
  for (const [path, content] of Object.entries(currentFiles)) {
    if (prioritizedFiles[path]) continue;
    if (path.includes('/components/')) {
      const truncated = content.slice(0, MAX_FILE_CHARS);
      if (totalChars + truncated.length < MAX_TOTAL_CHARS) {
        prioritizedFiles[path] = truncated;
        totalChars += truncated.length;
      }
    }
  }
  
  // Add remaining files if space
  for (const [path, content] of Object.entries(currentFiles)) {
    if (prioritizedFiles[path]) continue;
    const truncated = content.slice(0, MAX_FILE_CHARS);
    if (totalChars + truncated.length < MAX_TOTAL_CHARS) {
      prioritizedFiles[path] = truncated;
      totalChars += truncated.length;
    }
  }
  
  const filesStr = Object.entries(prioritizedFiles)
    .map(([path, content]) => `=== FILE: ${path} ===\n${content}`)
    .join('\n\n');
  
  console.log(`[Gemini] Diff edit: ${Object.keys(prioritizedFiles).length}/${Object.keys(currentFiles).length} files, ${totalChars} chars`);

  const systemPrompt = `You are a SURGICAL code editor. You make MINIMAL changes using PATCHES.

CRITICAL: Return ONLY the specific changes needed as JSON patches. DO NOT return full files.

PATCH FORMAT:
{
  "patches": [
    {
      "file": "/App.js",
      "action": "replace",
      "find": "className=\\"text-blue-500\\"",
      "content": "className=\\"text-orange-500 text-xl\\""
    },
    {
      "file": "/App.js",
      "action": "insert_after",
      "find": "</About>",
      "content": "\\n      <NewSection />"
    }
  ],
  "summary": "Changed text color to orange and increased size"
}

ACTIONS:
- "replace": Find exact string and replace with content
- "insert_after": Insert content immediately after the find string
- "insert_before": Insert content immediately before the find string  
- "delete": Remove the find string entirely

RULES:
1. The "find" string must be EXACT - copy it character-for-character from the original
2. Keep patches MINIMAL - only change what's requested
3. For styling changes, only change the specific className or style
4. For adding sections, use insert_after with a nearby anchor
5. NEVER modify code that wasn't mentioned in the request
6. Return valid JSON only - no markdown, no explanation

ONLY use lucide-react for icons. Never use react-icons or heroicons.`;

  const userMessage = `CURRENT CODEBASE:
${filesStr}

USER REQUEST:
${userPrompt}

Return ONLY the JSON patches needed. Be surgical - change only what's requested.`;

  const response = await withTimeout(fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    }
  ), 60000, 'GEMINI_EDIT');

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Gemini] API Error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Clean up response
  content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) content = content.substring(jsonStart, jsonEnd + 1);
  content = fixUnescapedNewlines(content);

  try {
    const parsed = JSON.parse(content);
    const patches: EditPatch[] = parsed.patches || [];
    const summary = parsed.summary || "Changes applied.";
    
    if (patches.length === 0) {
      console.warn("[Gemini] No patches returned");
      return { files: {}, summary: "No changes needed." };
    }
    
    console.log(`[Gemini] Applying ${patches.length} patches`);
    const changedFiles = applyPatches(currentFiles, patches);
    
    return { files: changedFiles, summary };
  } catch (e) {
    console.error("[Gemini] Parse error:", e, "Content:", content.substring(0, 500));
    throw new Error("Gemini returned invalid JSON");
  }
}

async function callClaudeNonStreaming(systemPrompt: string, userPrompt: string, images: ImageAttachment[] | undefined): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

  // Build content array (text + optional images for vision)
  const contentBlocks: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> = [];
  
  // Add images first if present (vision mode)
  if (images && images.length > 0) {
    console.log(`[Claude] Vision mode: ${images.length} image(s) attached`);
    for (const img of images) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.type.replace("image/jpg", "image/jpeg"), // Normalize
          data: img.data.replace(/^data:image\/[^;]+;base64,/, "") // Strip data URI prefix if present
        }
      });
    }
  }
  
  // Add text prompt
  contentBlocks.push({ type: "text", text: userPrompt });

  console.log(`[Claude] Requesting non-streaming response... (${contentBlocks.length} content blocks)`);

  const anthropicResponse = await withTimeout(fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 
      'x-api-key': ANTHROPIC_API_KEY, 
      'anthropic-version': '2023-06-01', 
      'content-type': 'application/json' 
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 16384,
      system: systemPrompt,
      messages: [{ role: "user", content: contentBlocks }],
    }),
  }), 120000, 'CLAUDE_CREATE');

  if (!anthropicResponse.ok) {
    const err = await anthropicResponse.json();
    throw new Error(err.error?.message || "Anthropic API error");
  }

  const data = await anthropicResponse.json();
  let content = data.content?.[0]?.text || "";

  // Clean up response
  content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) content = content.substring(jsonStart, jsonEnd + 1);
  content = fixUnescapedNewlines(content);

  return content;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const userId = getUserIdFromRequest(req);
  if (!userId) return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body: RequestBody = await req.json();
    const action = body.action || 'start';
    const jobId = (body.jobId || '').toString().trim();
    const projectId = (body.projectId || '').toString().trim();

    const userAuthHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const supabase = getAdminClient(userAuthHeader);

    if (action === 'status') {
      if (!jobId) return new Response(JSON.stringify({ ok: false, error: 'Missing jobId' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data, error } = await supabase
        .from('project_generation_jobs')
        .select('id, project_id, status, mode, error, result_summary, created_at, updated_at')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw new Error(`DB_JOB_STATUS_FAILED: ${error.message}`);
      if (!data) return new Response(JSON.stringify({ ok: false, error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, job: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'get_files') {
      if (!projectId) return new Response(JSON.stringify({ ok: false, error: 'Missing projectId' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await assertProjectOwnership(supabase, projectId, userId);
      const { data, error } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      if (error) throw new Error(`DB_FILES_SELECT_FAILED: ${error.message}`);
      const files: Record<string, string> = {};
      for (const row of data || []) {
        files[normalizeFilePath(row.path)] = row.content;
      }
      return new Response(JSON.stringify({ ok: true, files }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default: start (create/edit/chat)
    const mode: 'create' | 'edit' | 'chat' = body.mode === 'edit' || body.mode === 'chat' ? body.mode : 'create';
    const prompt = (body.prompt || '').toString();
    const theme = (body.theme || 'none').toString();
    const assets = Array.isArray(body.assets) ? body.assets : [];
    const userInstructions = (body.userInstructions || '').toString();
    const images = body.images;

    if (mode === 'chat') {
      const currentFiles = body.currentFiles || {};
      const filesStr = Object.entries(currentFiles || {}).map(([k, v]) => `FILE: ${k}\n${v}`).join('\n\n');
      const answer = await callGPT4oMini("You are a Senior React Architect.", `CODEBASE:\n${filesStr}\n\nQUESTION: ${prompt}`);
      return new Response(JSON.stringify({ ok: true, message: answer }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!projectId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing projectId' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!prompt) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing prompt' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await assertProjectOwnership(supabase, projectId, userId);

    const safeMode: 'create' | 'edit' = mode === 'edit' ? 'edit' : 'create';
    const job = await createJob(supabase, { projectId, userId, mode: safeMode, prompt });

    try {
      const selectedThemeDesc = THEME_PRESETS[theme || 'none'] || THEME_PRESETS['none'];
      const finalSystemPrompt = BASE_SYSTEM_PROMPT.replace("{{THEME_INSTRUCTIONS}}", selectedThemeDesc);

      if (safeMode === 'create') {
        let textPrompt = `CREATE NEW PROJECT.\n\nREQUEST: ${prompt}\n\n${userInstructions || ""}`;
        if (assets && assets.length > 0) textPrompt += `\n\nUSE THESE ASSETS: ${assets.join(", ")}`;
        if (images && images.length > 0) {
          textPrompt = `SCREENSHOT-TO-CODE: Analyze the attached screenshot(s) and recreate this UI as a React application.\n\n${textPrompt}`;
        }

        const aiText = await callClaudeNonStreaming(finalSystemPrompt, textPrompt, images);
        assertNoHtml(aiText);

        let content = extractJsonObject(aiText);
        content = fixUnescapedNewlines(content);
        const parsed = JSON.parse(content);
        const { files, summary } = coerceFilesMap(parsed);
        if (!files["/App.js"]) throw new Error("MISSING_APP_JS");
        assertNoHtml(files["/App.js"]);

        await replaceProjectFiles(supabase, projectId, files);
        await updateJob(supabase, job.id, { status: 'succeeded', result_summary: summary || 'Created.', error: null });
        return new Response(JSON.stringify({ ok: true, jobId: job.id, status: 'succeeded' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // EDIT mode
      const { data: existingRows, error: existingErr } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      if (existingErr) throw new Error(`DB_FILES_SELECT_FAILED: ${existingErr.message}`);
      const existingFiles: Record<string, string> = {};
      for (const row of existingRows || []) {
        existingFiles[normalizeFilePath(row.path)] = row.content;
      }

      const userPrompt = `${prompt}\n\n${userInstructions || ""}`;
      const result = await callGeminiDiffEdit(finalSystemPrompt, userPrompt, existingFiles);
      const changedFiles = result.files || {};
      if (changedFiles["/App.js"]) assertNoHtml(changedFiles["/App.js"]);

      const missing = findMissingReferencedFiles({ changedFiles, existingFiles });
      let finalFilesToUpsert: Record<string, string> = { ...changedFiles };

      if (missing.length > 0) {
        console.log(`[Edit validation] Missing referenced files detected: ${missing.join(', ')}`);
        const generatedMissing = await callGPT41MiniMissingFiles(missing, changedFiles, existingFiles, userPrompt);
        finalFilesToUpsert = { ...finalFilesToUpsert, ...generatedMissing };

        const missingAfter = findMissingReferencedFiles({ changedFiles: finalFilesToUpsert, existingFiles });
        if (missingAfter.length > 0) {
          throw new Error(`EDIT_MISSING_FILES: ${missingAfter.join(', ')}`);
        }
      }

      await upsertProjectFiles(supabase, projectId, finalFilesToUpsert);
      await updateJob(supabase, job.id, { status: 'succeeded', result_summary: result.summary || 'Updated.', error: null });
      return new Response(JSON.stringify({ ok: true, jobId: job.id, status: 'succeeded' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (innerErr) {
      const innerMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      try {
        await updateJob(supabase, job.id, { status: 'failed', error: innerMsg, result_summary: null });
      } catch (e) {
        console.error('[projects-generate] Failed to mark job failed:', e);
      }
      return new Response(JSON.stringify({ ok: false, jobId: job.id, error: innerMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Fatal Error]", errMsg);
    return new Response(JSON.stringify({ ok: false, error: errMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
