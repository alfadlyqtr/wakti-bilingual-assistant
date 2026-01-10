import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateProjectCSS, formatCSSWarnings, getCSSInheritanceGuidelines, type CSSWarning } from "../_shared/cssValidator.ts";

// ============================================================================
// WAKTI PROJECTS-GENERATE V2 - FULL REWRITE ENGINE
// ============================================================================
// NO PATCHES. NO DIFFS. FULL FILE REWRITES ONLY.
// Model: Gemini 2.5 Pro for both planning and execution
// Modes: plan (propose changes) | execute (write code) | create | chat
// ============================================================================

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
  type: string;
  data: string;
  name?: string;
}

interface RequestBody {
  action?: 'start' | 'status' | 'get_files';
  jobId?: string;
  projectId?: string;
  mode?: 'create' | 'edit' | 'plan' | 'execute' | 'chat';
  prompt?: string;
  currentFiles?: Record<string, string>;
  assets?: string[];
  theme?: string;
  userInstructions?: string;
  images?: ImageAttachment[];
  planToExecute?: string;
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

function assertNoHtml(path: string, value: string): void {
  const normalizedPath = normalizeFilePath(path);
  // Legit HTML files (e.g., /index.html) are expected in many projects.
  if (normalizedPath.toLowerCase().endsWith(".html")) return;

  const v = (value || "").toLowerCase();
  if (v.includes("<!doctype") || v.includes("<html")) {
    throw new Error("AI_RETURNED_HTML");
  }
}

// ============================================================================
// GEMINI 2.5 PRO - FULL REWRITE ENGINE (NO PATCHES)
// ============================================================================

async function callGemini25Pro(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = true
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  // Use Gemini 2.5 Pro (stable) for Edit/Plan/Execute modes
  const model = "gemini-2.5-pro";
  
  console.log(`[Gemini 2.5 Pro] Calling model: ${model}`);

  const response = await withTimeout(
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        }),
      }
    ),
    300000, // 300 seconds (5 minutes) - Note: Supabase gateway may still timeout at ~150s
    'GEMINI_25_PRO'
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini 2.5 Pro] HTTP ${response.status}: ${errorText}`);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  if (jsonMode) {
    text = normalizeGeminiResponseText(text);
  }
  
  return text;
}

// GEMINI 2.0 FLASH - FAST CREATE MODE (avoids gateway timeout)
// ============================================================================
async function callGemini20FlashCreate(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const model = "gemini-2.0-flash";
  
  console.log(`[Gemini 2.0 Flash Create] Calling model: ${model}`);

  const response = await withTimeout(
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 32768,
            responseMimeType: "application/json",
          },
        }),
      }
    ),
    90000, // 90 seconds - well under gateway timeout
    'GEMINI_20_FLASH_CREATE'
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini 2.0 Flash Create] HTTP ${response.status}: ${errorText}`);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  text = normalizeGeminiResponseText(text);
  
  return text;
}

// PLAN MODE: AI proposes changes, returns a structured plan (Lovable-style)
async function callGeminiPlanMode(
  userPrompt: string,
  currentFiles: Record<string, string>
): Promise<string> {
  const fileContext = Object.entries(currentFiles || {})
    .map(([path, content]) => `=== FILE: ${path} ===\n${content}`)
    .join("\n\n");

  const systemPrompt = `You are a code analysis engine. Your ONLY job is to analyze the provided codebase and propose REAL, SPECIFIC changes.

🚨 CRITICAL RULES (MUST FOLLOW):
1. EXTRACT ACTUAL CODE from the provided files - do NOT invent or use placeholders
2. Show REAL line numbers where code currently exists
3. "current" field MUST contain the EXACT code snippet from the file (copy-paste from provided code)
4. "changeTo" field MUST contain the EXACT new code (real modification, not placeholder)
5. Output ONLY valid JSON - no explanations, no markdown, no text before/after
6. Every "current" value MUST exist in the provided files - verify by line number

OUTPUT FORMAT (STRICT JSON):
{
  "title": "Brief description of the change",
  "file": "/path/to/file.js",
  "line": 45,
  "steps": [
    {
      "title": "Description with actual line reference (line 45)",
      "current": "EXACT CODE FROM FILE AT LINE 45",
      "changeTo": "EXACT NEW CODE TO REPLACE IT"
    }
  ],
  "codeChanges": [
    {
      "file": "/path/to/file.js",
      "line": 45,
      "code": "FULL UPDATED CODE BLOCK (multiple lines if needed, with \\n for newlines)"
    }
  ]
}

VERIFICATION CHECKLIST:
✅ "current" field = exact code copy from provided files
✅ Line numbers match actual file positions
✅ "changeTo" is a real modification (not generic placeholder)
✅ Code snippets are complete and valid
✅ No fake examples or placeholder values like "text-[#60a5fa]"

If you cannot find the exact code in the provided files, do NOT make up placeholder values. Return an error instead.`;

  const userMessage = `CODEBASE:
${fileContext}

REQUEST: ${userPrompt}

Return JSON only.`;

  return await callGemini25Pro(systemPrompt, userMessage, true);
}

// EXECUTE MODE: AI writes full file rewrites based on a plan
async function callGeminiExecuteMode(
  planToExecute: string,
  currentFiles: Record<string, string>,
  userInstructions: string = ""
): Promise<{ files: Record<string, string>; summary: string }> {
  const fileContext = Object.entries(currentFiles || {})
    .map(([path, content]) => `=== FILE: ${path} ===\n${content}`)
    .join("\n\n");

  const systemPrompt = GEMINI_EXECUTE_SYSTEM_PROMPT;

  const userMessage = `CURRENT CODEBASE:
${fileContext}

PLAN TO EXECUTE:
${planToExecute}

${userInstructions ? `ADDITIONAL INSTRUCTIONS:\n${userInstructions}\n\n` : ""}
Execute this plan. Return the FULL content of every file that needs to be modified or created.
Return ONLY a valid JSON object with the structure shown in the system prompt.`;

  const text = await callGemini25Pro(systemPrompt, userMessage, true);
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (parseErr) {
    console.error("[Gemini Execute] JSON parse failed, attempting recovery...");
    const recovered = recoverBrokenJson(text);
    if (!recovered) {
      throw parseErr;
    }
    parsed = recovered;
  }
  
  const { files, summary } = coerceFilesMap(parsed);

  for (const [p, c] of Object.entries(files)) {
    if (typeof c !== "string" || c.trim().length === 0) {
      throw new Error(`AI_RETURNED_EMPTY_FILE: ${p}`);
    }
    assertNoHtml(p, c);
  }

  return { files, summary: summary || "Changes applied." };
}

// EDIT MODE (Legacy compatibility): Direct edit without plan step
async function callGeminiFullRewriteEdit(
  userPrompt: string,
  currentFiles: Record<string, string>,
  userInstructions: string = ""
): Promise<{ files: Record<string, string>; summary: string }> {
  const fileContext = Object.entries(currentFiles || {})
    .map(([path, content]) => `=== FILE: ${path} ===\n${content}`)
    .join("\n\n");

  const systemPrompt = GEMINI_EXECUTE_SYSTEM_PROMPT;

  const userMessage = `CURRENT CODEBASE:
${fileContext}

USER REQUEST:
${userPrompt}

${userInstructions ? `ADDITIONAL INSTRUCTIONS:\n${userInstructions}\n\n` : ""}
Implement this request. Return the FULL content of every file that needs to be modified or created.
Return ONLY a valid JSON object with the structure shown in the system prompt.`;

  const text = await callGemini25Pro(systemPrompt, userMessage, true);
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (parseErr) {
    console.error("[Gemini Edit] JSON parse failed, attempting recovery...");
    const recovered = recoverBrokenJson(text);
    if (!recovered) {
      throw parseErr;
    }
    parsed = recovered;
  }
  
  const { files, summary } = coerceFilesMap(parsed);

  for (const [p, c] of Object.entries(files)) {
    if (typeof c !== "string" || c.trim().length === 0) {
      throw new Error(`AI_RETURNED_EMPTY_FILE: ${p}`);
    }
    assertNoHtml(p, c);
  }

  return { files, summary: summary || "Updated." };
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

function normalizeGeminiResponseText(text: string): string {
  let content = (text || "").trim();
  content = extractJsonObject(content);
  content = fixUnescapedNewlines(content);
  return content;
}

/**
 * Attempt to recover a broken JSON object (e.g., unterminated strings).
 * Returns parsed object if recovery succeeds, null otherwise.
 */
function recoverBrokenJson(text: string): Record<string, unknown> | null {
  const json = (text || "").trim();
  
  // Try progressively more aggressive fixes
  const attempts: string[] = [json];
  
  // Attempt 1: Close any unclosed string at the end
  if (!json.endsWith("}")) {
    // Find last valid closing brace position
    let braceCount = 0;
    let lastValidEnd = -1;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < json.length; i++) {
      const c = json[i];
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (!inString) {
        if (c === '{') braceCount++;
        if (c === '}') {
          braceCount--;
          if (braceCount === 0) lastValidEnd = i;
        }
      }
    }
    
    if (lastValidEnd > 0) {
      attempts.push(json.substring(0, lastValidEnd + 1));
    }
  }
  
  // Attempt 2: Truncate at last complete key-value pair and close
  const filesMatch = json.match(/"files"\s*:\s*\{/);
  if (filesMatch) {
    // Find the last complete file entry (ends with ")
    const lastCompleteFile = json.lastIndexOf('"}');
    if (lastCompleteFile > 0) {
      // Check if we need to close the files object and root object
      const truncated = json.substring(0, lastCompleteFile + 2);
      attempts.push(truncated + '}, "summary": "Partial update"}');
      attempts.push(truncated + '}}');
    }
  }
  
  // Attempt 3: Just try to close unclosed braces
  let openBraces = 0;
  let inStr = false;
  let esc = false;
  for (const c of json) {
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (c === '{') openBraces++;
      if (c === '}') openBraces--;
    }
  }
  if (openBraces > 0) {
    // If we're in a string, close it first
    let fixed = json;
    if (inStr) fixed += '"';
    for (let i = 0; i < openBraces; i++) fixed += '}';
    attempts.push(fixed);
  }
  
  // Try each attempt
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === 'object') {
        console.log('[recoverBrokenJson] Recovery succeeded');
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Continue to next attempt
    }
  }
  
  console.error('[recoverBrokenJson] All recovery attempts failed');
  return null;
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
  'wakti-dark': `DARK THEME - MANDATORY COLORS:
- Background: bg-[#0c0f14] or bg-slate-950 (MUST BE DARK)
- Cards: bg-slate-900/50 or bg-white/5 with backdrop-blur
- Text: text-white, text-gray-100, text-amber-400 for accents
- Borders: border-white/10 or border-amber-500/30
- Accents: amber-400, amber-500 for highlights and icons
- NEVER use white/light backgrounds. ALL backgrounds must be dark.`,
  'midnight': `MIDNIGHT DARK THEME - MANDATORY COLORS:
- Background: bg-indigo-950 or bg-[#1e1b4b] (MUST BE DARK)
- Cards: bg-indigo-900/50 with backdrop-blur
- Text: text-white, text-indigo-200
- Accents: indigo-400, purple-400
- NEVER use white/light backgrounds.`,
  'obsidian': `OBSIDIAN DARK THEME - MANDATORY COLORS:
- Background: bg-slate-900 or bg-[#1e293b] (MUST BE DARK)
- Cards: bg-slate-800/50
- Text: text-white, text-slate-300
- NEVER use white/light backgrounds.`,
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
  'none': `DEFAULT DARK THEME - MANDATORY:
- Background: bg-slate-950 or bg-[#0c0f14] (MUST BE DARK)
- Cards: bg-slate-900/50 or bg-white/5 with backdrop-blur-xl
- Text: text-white, text-gray-300
- Borders: border-white/10
- NEVER use white/light backgrounds. This is a DARK theme app.`
};

const BASE_SYSTEM_PROMPT = `
🚨🚨🚨 CRITICAL: YOU ARE A REACT CODE GENERATOR 🚨🚨🚨
You output ONLY React/JSX code. NEVER output HTML documents.
- Your /App.js MUST start with: import React from 'react';
- Your /App.js MUST have: export default function App() { return (...) }
- FORBIDDEN: <!DOCTYPE>, <html>, <head>, <body>, <script> tags
If you return HTML instead of React, the system will REJECT your output.

### MANDATORY FILE STRUCTURE
ALWAYS start with these files based on project complexity:

**SIMPLE (landing page, single page):**
- /App.js (main component with all sections)
- /styles.css (if custom styles needed)

**MEDIUM (multiple sections, modals, CTAs):**
- /App.js (main with state management)
- /components/Modal.jsx (reusable modal)
- /components/Card.jsx (reusable cards)

**COMPLEX (multi-page, dashboard, SaaS):**
- /App.js (router/navigation state)
- /components/Navbar.jsx
- /components/Sidebar.jsx (if dashboard)
- /pages/Home.jsx or /pages/LandingPage.jsx
- /pages/Dashboard.jsx (if dashboard)
- /utils/mockData.js (sample data)

**IF USER ASKS FOR LANGUAGES:**
- /i18n.js (translations setup)

You are an elite React Expert creating premium UI applications.

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
- i18next, react-i18next (for internationalization)

DO NOT use react-icons, heroicons, or any other icon library. ONLY use lucide-react.
Example: import { Mail, Phone, Linkedin, Instagram, ChevronDown, Menu, X } from 'lucide-react';

### PART 4: i18n SETUP (ONLY IF USER ASKS)
DO NOT add i18n/translations unless the user EXPLICITLY asks for:
- Multiple languages
- Arabic support
- Language toggle
- Bilingual
- RTL support

If user does NOT mention any of the above, just use plain English strings directly in the JSX.
NO useTranslation hook unless explicitly requested. Just simple English text.

### PART 5: SMART PROJECT NAMING
Extract a meaningful project name from the user's request and use it in document.title and any header branding.
Examples: "landing page for wife moza" → "MoziLove", "portfolio for photographer" → "PhotoPortfolio"

### PART 6: IMAGE IDS
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
6. ALWAYS include /i18n.js in new projects when user asks for multiple languages.
7. App.js must be a valid React functional component, NOT an HTML document.

### CSS INHERITANCE SAFETY (CRITICAL - ICONS VISIBILITY)
1. NEVER put icons inside text-transparent elements - Icons using currentColor will become INVISIBLE
   - ❌ BAD: <span className="text-transparent bg-clip-text ..."><Heart fill="currentColor" />Title</span>
   - ✅ GOOD: <span className="flex gap-2"><Heart className="text-pink-400" fill="currentColor" /><span className="text-transparent bg-clip-text ...">Title</span></span>
2. Always give icons explicit color classes when parent uses gradients or text-transparent
3. Only TEXT should be inside text-transparent bg-clip-text - separate icons from gradient text spans

### PART 7: BACKEND API (CONTACT FORMS, DATA STORAGE)
When the user asks for forms (contact, quote, newsletter, feedback, waitlist, etc.):

1. BUILD THE FORM UI as normal with React state
2. ON SUBMIT, send data to the WAKTI Backend API:

\`\`\`jsx
const BACKEND_URL = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api";

// Form submission handler
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "{{PROJECT_ID}}", // Auto-injected
        action: "submit",
        formName: "contact", // or "quote", "newsletter", "waitlist", etc.
        data: { name, email, message } // form field values
      })
    });
    if (response.ok) {
      setSuccess(true);
      setName(''); setEmail(''); setMessage(''); // Clear form
    } else {
      throw new Error('Failed to submit');
    }
  } catch (err) {
    setError("Failed to send message. Please try again.");
  } finally {
    setLoading(false);
  }
};
\`\`\`

IMPORTANT FORM REQUIREMENTS:
- Include loading state (disabled button, spinner) while submitting
- Show success message/animation after submission
- Include error handling with user-friendly feedback
- Add form validation before submit (required fields, email format)
- Clear form fields after successful submission
- formName should describe the form purpose: "contact", "quote", "newsletter", "feedback", "waitlist"
`;

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const GEMINI_EXECUTE_SYSTEM_PROMPT = `You are a Senior React Engineer who ACTUALLY IMPLEMENTS what users ask for.

🚨 CRITICAL: DO WHAT THE USER ASKS. If they want colors, add colors. If they want animations, add animations. If they want gradients, add gradients. NO EXCUSES.

### YOUR JOB
1. READ the user's request carefully
2. IMPLEMENT exactly what they asked for - don't be conservative
3. Return FULL FILE REWRITES (no patches, no diffs)

### VISUAL CHANGES (IMPORTANT)
When users ask for visual improvements, ACTUALLY ADD THEM:
- **Gradients**: Use Tailwind gradient classes (bg-gradient-to-r, from-purple-500, to-pink-500, etc.)
- **Animations**: Use framer-motion (motion.div with animate, whileHover, transition props)
- **Floating elements**: Create animated background elements with absolute positioning
- **Shadows**: Use Tailwind shadow classes (shadow-lg, shadow-xl, shadow-2xl)
- **Glow effects**: Use box-shadow with colored shadows (style={{ boxShadow: '0 0 30px rgba(168,85,247,0.5)' }})
- **Colors**: Use the theme colors provided, not black/white

### AVAILABLE PACKAGES
- react, react-dom
- framer-motion (USE THIS for all animations)
- lucide-react (for icons - NEVER use react-icons)
- date-fns, recharts, @tanstack/react-query
- clsx, tailwind-merge
- i18next, react-i18next

### ANIMATION EXAMPLES (USE THESE)
\`\`\`jsx
// Fade in on load
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

// Floating animation
<motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>

// Hover effect
<motion.div whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(168,85,247,0.5)' }}>

// Gradient text
<span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
\`\`\`

### JSON OUTPUT FORMAT
Return ONLY valid JSON:
{
  "files": {
    "/App.js": "import React from 'react';\\nimport { motion } from 'framer-motion';\\n..."
  },
  "summary": "Added gradient background, floating animations, and glow effects"
}

ESCAPING: Newlines=\\n, Quotes=\\", Backslashes=\\\\

ONLY return files that changed. Do NOT return unchanged files.

### CSS INHERITANCE SAFETY (CRITICAL - ICONS VISIBILITY)
1. NEVER put icons inside text-transparent elements - Icons using currentColor will become INVISIBLE
2. Always give icons explicit color classes (e.g., text-pink-400) when parent uses gradients
3. Only TEXT should be inside text-transparent bg-clip-text spans - separate icons from them`;

const _GEMINI_EDIT_FULL_REWRITE_PROMPT = `You are a Senior React Architect and Maintenance Engineer.
Your job is to implement user changes into an existing React codebase running in a Sandpack environment.

### THE CONTEXT
You have received the COMPLETE source code of the project.
You must analyze the architecture, imports, and styling (Tailwind CSS) before making changes.

### YOUR INSTRUCTIONS
1. Analyze: Read the user's request and the current file structure.
2. Execute: Rewrite the ENTIRE content of any file that needs modification.
3. MINIMAL INTERVENTION POLICY (CRITICAL):
   - Only change exactly what the user asked for.
   - Do NOT refactor unrelated code.
   - Do NOT clean up or optimize unless explicitly asked.

### SAFETY RULES
- DO NOT break existing imports.
- DO NOT delete export default function App or main entry points.
- Maintain the existing visual style (Tailwind classes) unless asked to change them.
- Keep the mockData.js pattern for data.

### JSON OUTPUT RULES (CRITICAL - READ CAREFULLY)
1. Return ONLY a valid JSON object. No markdown, no explanation, no HTML.
2. Keys are file paths (e.g., "/App.js", "/components/Header.jsx").
3. Values are the FULL code for that file AS A SINGLE JSON STRING.
4. **ESCAPE ALL SPECIAL CHARACTERS INSIDE STRING VALUES:**
   - Newlines must be \\n (backslash-n)
   - Quotes inside strings must be \\"
   - Backslashes must be \\\\
   - Tabs must be \\t
5. Do NOT return files that did not change.
6. Do NOT return diffs or patches - only full file contents.

### RESPONSE FORMAT (EXACT)
{
  "files": {
    "/App.js": "import React from 'react';\\n\\nexport default function App() {\\n  return <div>Hello</div>;\\n}"
  },
  "summary": "Brief description of changes"
}

ONLY use lucide-react for icons. Never use react-icons or heroicons.`;

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

// REMOVED: Old patch-based editing system
// The new system uses FULL FILE REWRITES only via callGeminiFullRewriteEdit

// Claude 3.7 Sonnet with STREAMING to avoid 504 gateway timeout
async function callClaudeStreaming(systemPrompt: string, userPrompt: string, images: ImageAttachment[] | undefined): Promise<string> {
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
          media_type: img.type.replace("image/jpg", "image/jpeg"),
          data: img.data.replace(/^data:image\/[^;]+;base64,/, "")
        }
      });
    }
  }
  
  contentBlocks.push({ type: "text", text: userPrompt });

  console.log(`[Claude 3.5 Sonnet] Starting STREAMING request... (${contentBlocks.length} content blocks)`);

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 
      'x-api-key': ANTHROPIC_API_KEY, 
      'anthropic-version': '2023-06-01', 
      'content-type': 'application/json' 
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 16384,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: contentBlocks }],
    }),
  });

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text();
    console.error(`[Claude] HTTP ${anthropicResponse.status}: ${errText}`);
    throw new Error(`Claude API error: ${anthropicResponse.status}`);
  }

  // Read streaming response
  const reader = anthropicResponse.body?.getReader();
  if (!reader) throw new Error("No response body from Claude");

  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullContent += event.delta.text;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  console.log(`[Claude 3.7 Sonnet] Streaming complete. Total length: ${fullContent.length}`);

  // Clean up response
  let content = fullContent.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
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

    // ========================================================================
    // MODE HANDLING: create | edit | plan | execute | chat
    // ========================================================================
    const mode = body.mode || 'create';
    const prompt = (body.prompt || '').toString();
    const theme = (body.theme || 'none').toString();
    const assets = Array.isArray(body.assets) ? body.assets : [];
    const userInstructions = (body.userInstructions || '').toString();
    const images = body.images;
    const planToExecute = (body.planToExecute || '').toString();

    // CHAT MODE: Smart Q&A - answers questions OR returns a plan if code changes are needed
    if (mode === 'chat') {
      const currentFiles = body.currentFiles || {};
      const filesStr = Object.entries(currentFiles || {}).map(([k, v]) => `FILE: ${k}\n${v}`).join('\n\n');
      
      // Use Gemini 2.0 Flash for smart chat with intelligent detection
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
      
      // Check if images were provided
      const hasImages = Array.isArray(images) && images.length > 0;
      console.log(`[Chat Mode] Has images: ${hasImages}, count: ${hasImages ? images.length : 0}`);
      
      const chatSystemPrompt = `You are a helpful AI assistant for a React code editor. You help users with their projects.
${hasImages ? '\n🖼️ SCREENSHOT ANALYSIS MODE: The user has attached screenshot(s). Analyze them carefully and implement what you see or what the user asks based on the visual.\n' : ''}
🚨 CRITICAL DETECTION RULES:

IS IT A CODE CHANGE REQUEST? Check for these keywords:
- "fix", "change", "add", "remove", "update", "modify", "make", "create"
- "doesn't work", "not working", "broken", "bug", "error"
- "أصلح", "غير", "أضف", "احذف", "عدل", "اجعل", "لا يعمل", "مشكلة"
- Any request implying the user wants you to DO something to the code
- If user attached a screenshot, they likely want you to recreate or modify based on it

IF YES → Return ONLY JSON (no text before or after)
IF NO (pure question like "what does X do?") → Return markdown

📋 JSON FORMAT FOR CODE CHANGES:
{
  "type": "plan",
  "title": "🔧 Short description of the fix",
  "file": "/App.js",
  "steps": [
    { "title": "Step description", "current": "old code snippet", "changeTo": "new code snippet" }
  ],
  "codeChanges": [
    { "file": "/App.js", "line": 10, "code": "// Full code block to replace" }
  ]
}

📝 MARKDOWN FORMAT FOR QUESTIONS:
Use emojis, **bold**, \`code\`, and bullet points. Be friendly!

⚠️ CRITICAL: For ANY request that implies changing code, return ONLY the JSON object. No explanations. No "Here's the plan". Just raw JSON starting with { and ending with }.

Current project files:
${filesStr}`;

      // Build the content parts - text + optional images/PDFs
      const contentParts: Array<{text?: string; inlineData?: {mimeType: string; data: string}}> = [];
      
      // Track any PDF text to inject into prompt
      let pdfTextContent = '';
      
      // Add images first if provided
      if (hasImages) {
        const imageArray = images as unknown as string[];
        for (const imgData of imageArray) {
          if (typeof imgData !== 'string') continue;
          
          // Check if it's a PDF (marked with [PDF:filename] prefix)
          if (imgData.startsWith('[PDF:')) {
            const endBracket = imgData.indexOf(']');
            if (endBracket > 0) {
              const pdfName = imgData.substring(5, endBracket);
              // For PDFs, we can't send them to vision API, but we note that a PDF was attached
              // The user should describe what's in the PDF or we could use a PDF extraction service
              pdfTextContent += `\n\n📄 USER ATTACHED PDF: "${pdfName}" - Please consider this document was uploaded. If the user mentions "resume", "CV", "document", etc., they're referring to this file.`;
              console.log(`[Chat Mode] PDF attached: ${pdfName}`);
            }
            continue;
          }
          
          // Regular image handling
          if (imgData.startsWith('data:')) {
            const matches = imgData.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              contentParts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2]
                }
              });
            }
          }
        }
        console.log(`[Chat Mode] Added ${contentParts.length} images to request`);
      }
      
      // Add the text prompt (with PDF context if any)
      const fullPrompt = pdfTextContent ? `${prompt}${pdfTextContent}` : prompt;
      contentParts.push({ text: fullPrompt });

      const chatResponse = await withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": GEMINI_API_KEY,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: contentParts }],
              systemInstruction: { parts: [{ text: chatSystemPrompt }] },
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
              },
            }),
          }
        ),
        60000,
        'GEMINI_CHAT'
      );

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error(`[Chat Mode] Gemini error: ${errorText}`);
        throw new Error(`Chat API error: ${chatResponse.status}`);
      }

      const chatData = await chatResponse.json();
      const answer = chatData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // Check if the response contains a plan JSON (may be mixed with text)
      const trimmedAnswer = answer.trim();
      
      // Try to extract JSON plan from response
      let planJson: string | null = null;
      
      // Method 1: Direct JSON (starts with {)
      if (trimmedAnswer.startsWith('{') && trimmedAnswer.includes('"type"') && trimmedAnswer.includes('"plan"')) {
        planJson = trimmedAnswer;
      } else {
        // Method 2: Extract JSON from mixed content
        const jsonMatch = trimmedAnswer.match(/\{[\s\S]*"type"\s*:\s*"plan"[\s\S]*\}/);
        if (jsonMatch) {
          planJson = jsonMatch[0];
        }
      }
      
      if (planJson) {
        // Validate it's actually valid JSON before returning
        try {
          JSON.parse(planJson);
          return new Response(JSON.stringify({ ok: true, plan: planJson, mode: 'plan' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch {
          // Invalid JSON, return as regular message
        }
      }
      
      // Return as regular chat message
      return new Response(JSON.stringify({ ok: true, message: answer }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PLAN MODE: Propose changes without executing (Lovable-style)
    if (mode === 'plan') {
      if (!projectId) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing projectId' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      try {
        await assertProjectOwnership(supabase, projectId, userId);
        
        // Get current files
        const { data: existingRows, error: existingErr } = await supabase
          .from('project_files')
          .select('path, content')
          .eq('project_id', projectId);
        if (existingErr) throw new Error(`DB_FILES_SELECT_FAILED: ${existingErr.message}`);
        const existingFiles: Record<string, string> = {};
        for (const row of existingRows || []) {
          existingFiles[normalizeFilePath(row.path)] = row.content;
        }
        
        console.log(`[Plan Mode] Generating plan for: ${prompt.substring(0, 50)}...`);
        console.log(`[Plan Mode] Files count: ${Object.keys(existingFiles).length}`);
        
        const plan = await callGeminiPlanMode(prompt, existingFiles);
        
        console.log(`[Plan Mode] Plan generated, length: ${plan.length}`);
        
        return new Response(JSON.stringify({ ok: true, plan, mode: 'plan' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (planError: any) {
        console.error(`[Plan Mode] Error: ${planError.message}`);
        return new Response(JSON.stringify({ ok: false, error: planError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // EXECUTE MODE: Execute a previously approved plan (Lovable-style)
    if (mode === 'execute') {
      if (!projectId) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing projectId' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!planToExecute) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing planToExecute' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await assertProjectOwnership(supabase, projectId, userId);
      
      const job = await createJob(supabase, { projectId, userId, mode: 'edit', prompt: planToExecute });
      
      try {
        // Get current files
        const { data: existingRows, error: existingErr } = await supabase
          .from('project_files')
          .select('path, content')
          .eq('project_id', projectId);
        if (existingErr) throw new Error(`DB_FILES_SELECT_FAILED: ${existingErr.message}`);
        const existingFiles: Record<string, string> = {};
        for (const row of existingRows || []) {
          existingFiles[normalizeFilePath(row.path)] = row.content;
        }
        
        console.log(`[Execute Mode] Executing plan...`);
        console.log(`[Execute Mode] Plan to execute: ${planToExecute.substring(0, 200)}...`);
        console.log(`[Execute Mode] Existing files: ${Object.keys(existingFiles).join(', ')}`);
        
        const result = await callGeminiExecuteMode(planToExecute, existingFiles, userInstructions);
        const changedFiles = result.files || {};
        
        console.log(`[Execute Mode] Changed files returned: ${Object.keys(changedFiles).join(', ') || 'NONE'}`);
        console.log(`[Execute Mode] Summary: ${result.summary}`);
        
        if (Object.keys(changedFiles).length === 0) {
          console.error(`[Execute Mode] WARNING: AI returned no changed files!`);
        }
        
        if (changedFiles["/App.js"]) assertNoHtml(changedFiles["/App.js"]);
        
        // Check for missing referenced files
        const missing = findMissingReferencedFiles({ changedFiles, existingFiles });
        let finalFilesToUpsert: Record<string, string> = { ...changedFiles };
        
        if (missing.length > 0) {
          console.log(`[Execute] Missing files detected: ${missing.join(', ')}`);
          const generatedMissing = await callGPT41MiniMissingFiles(missing, changedFiles, existingFiles, planToExecute);
          finalFilesToUpsert = { ...finalFilesToUpsert, ...generatedMissing };
        }
        
        await upsertProjectFiles(supabase, projectId, finalFilesToUpsert);
        await updateJob(supabase, job.id, { status: 'succeeded', result_summary: result.summary || 'Plan executed.', error: null });
        return new Response(JSON.stringify({ ok: true, jobId: job.id, status: 'succeeded' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        
      } catch (innerErr) {
        const innerMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
        await updateJob(supabase, job.id, { status: 'failed', error: innerMsg, result_summary: null });
        return new Response(JSON.stringify({ ok: false, jobId: job.id, error: innerMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // CREATE and EDIT modes require projectId and prompt
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
      // CRITICAL: Force theme instructions to be the most important rule
      const themeEnforcement = `\n\nCRITICAL STYLE RULES (MUST FOLLOW):\n${selectedThemeDesc}\nEnsure ALL components use these exact colors and vibe. DO NOT USE DEFAULT COLORS.`;
      const finalSystemPrompt = BASE_SYSTEM_PROMPT.replace("{{THEME_INSTRUCTIONS}}", themeEnforcement);

      // CREATE MODE: Generate new project from scratch
      if (safeMode === 'create') {
        let textPrompt = `CREATE NEW PROJECT.\n\nREQUEST: ${prompt}\n\n${userInstructions || ""}`;
        if (assets && assets.length > 0) textPrompt += `\n\nUSE THESE ASSETS: ${assets.join(", ")}`;
        if (images && images.length > 0) {
          textPrompt = `SCREENSHOT-TO-CODE: Analyze the attached screenshot(s) and recreate this UI as a React application.\n\n${textPrompt}`;
        }

        // Use Gemini 2.5 Pro for creation
        let aiText = await callGemini25Pro(finalSystemPrompt, textPrompt, true);
        console.log(`[Create Mode] AI Response length: ${aiText.length}`);
        console.log(`[Create Mode] AI Response (first 500 chars): ${aiText.substring(0, 500)}`);

        let content = extractJsonObject(aiText);
        content = fixUnescapedNewlines(content);
        let parsed = JSON.parse(content);
        let { files, summary } = coerceFilesMap(parsed);
        console.log(`[Create Mode] Files keys: ${Object.keys(files).join(', ')}`);

        // If AI returned HTML instead of React, retry with ultra-strict prompt
        if (!files["/App.js"] || files["/App.js"]?.toLowerCase().includes("<!doctype")) {
          console.log(`[Create Mode] AI returned HTML, retrying with strict React prompt...`);
          const strictPrompt = `You are a REACT CODE generator. Return ONLY a JSON object with React files.

CRITICAL: Your response must be a JSON object like this:
{
  "/App.js": "import React from 'react';\\nexport default function App() { return (<div>...</div>); }"
}

DO NOT return HTML. DO NOT use <!DOCTYPE>. DO NOT use <html> tags.
The /App.js file MUST start with: import React from 'react';

USER REQUEST: ${prompt}

Return ONLY the JSON object. No explanation.`;

          aiText = await callGemini25Pro(strictPrompt, "", true);
          console.log(`[Create Mode] Retry response (first 500 chars): ${aiText.substring(0, 500)}`);
          content = extractJsonObject(aiText);
          content = fixUnescapedNewlines(content);
          parsed = JSON.parse(content);
          const retryResult = coerceFilesMap(parsed);
          files = retryResult.files;
          summary = retryResult.summary;
          console.log(`[Create Mode] Retry files keys: ${Object.keys(files).join(', ')}`);
        }

        if (!files["/App.js"]) {
          console.error(`[Create Mode] MISSING /App.js after retry! Available: ${Object.keys(files).join(', ')}`);
          throw new Error("MISSING_APP_JS");
        }
        assertNoHtml(files["/App.js"]);

        // CSS Inheritance Validation - warn about common visual bugs
        const cssWarnings = validateProjectCSS(files);
        if (cssWarnings.length > 0) {
          console.warn(formatCSSWarnings(cssWarnings));
          // Include warnings in the summary so they're visible to developers
          const warningsSummary = cssWarnings.map(w => `⚠️ ${w.file}: ${w.issue}`).join('; ');
          summary = summary ? `${summary} | CSS Warnings: ${warningsSummary}` : `CSS Warnings: ${warningsSummary}`;
        }

        // Inject project ID into backend API calls
        for (const [path, content] of Object.entries(files)) {
          files[path] = content.replace(/\{\{PROJECT_ID\}\}/g, projectId);
        }

        // Check if project uses backend API and auto-enable it
        const usesBackend = Object.values(files).some(content => 
          content.includes('project-backend-api')
        );
        if (usesBackend) {
          console.log(`[Create Mode] Project uses backend API, auto-enabling...`);
          await supabase.from('project_backends').upsert({
            project_id: projectId,
            user_id: userId,
            enabled: true,
            enabled_at: new Date().toISOString(),
            features: { forms: true }
          }, { onConflict: 'project_id' });
        }

        await replaceProjectFiles(supabase, projectId, files);
        await updateJob(supabase, job.id, { status: 'succeeded', result_summary: summary || 'Created.', error: null });
        return new Response(JSON.stringify({ ok: true, jobId: job.id, status: 'succeeded', cssWarnings, usesBackend }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // EDIT MODE: Full file rewrite (NO PATCHES)
      const { data: existingRows, error: existingErr } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      if (existingErr) throw new Error(`DB_FILES_SELECT_FAILED: ${existingErr.message}`);
      const existingFiles: Record<string, string> = {};
      for (const row of existingRows || []) {
        existingFiles[normalizeFilePath(row.path)] = row.content;
      }

      console.log(`[Edit Mode] Full rewrite for: ${prompt.substring(0, 50)}...`);
      console.log(`[Edit Mode] Existing files: ${Object.keys(existingFiles).join(', ')}`);
      const userPrompt = `${prompt}\n\n${userInstructions || ""}`;
      
      // USE FULL REWRITE - NO PATCHES
      const result = await callGeminiFullRewriteEdit(userPrompt, existingFiles, userInstructions);
      const changedFiles = result.files || {};
      
      console.log(`[Edit Mode] Changed files returned: ${Object.keys(changedFiles).join(', ') || 'NONE'}`);
      console.log(`[Edit Mode] Summary: ${result.summary}`);
      
      if (Object.keys(changedFiles).length === 0) {
        console.error(`[Edit Mode] WARNING: AI returned no changed files!`);
      }
      
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

      // CSS Inheritance Validation - warn about common visual bugs
      const allFilesToCheck = { ...existingFiles, ...finalFilesToUpsert };
      const cssWarnings = validateProjectCSS(allFilesToCheck);
      if (cssWarnings.length > 0) {
        console.warn(formatCSSWarnings(cssWarnings));
        // Log errors but don't fail the job - just warn
        const warningsSummary = cssWarnings.filter(w => w.severity === 'error').map(w => `⚠️ ${w.file}: ${w.issue}`).join('; ');
        if (warningsSummary) {
          result.summary = result.summary ? `${result.summary} | CSS Issues: ${warningsSummary}` : `CSS Issues: ${warningsSummary}`;
        }
      }

      // Inject project ID into backend API calls
      for (const [path, content] of Object.entries(finalFilesToUpsert)) {
        finalFilesToUpsert[path] = content.replace(/\{\{PROJECT_ID\}\}/g, projectId);
      }

      // Check if project uses backend API and auto-enable it
      const allFilesContent = { ...existingFiles, ...finalFilesToUpsert };
      const usesBackend = Object.values(allFilesContent).some(content => 
        content.includes('project-backend-api')
      );
      if (usesBackend) {
        console.log(`[Edit Mode] Project uses backend API, auto-enabling...`);
        await supabase.from('project_backends').upsert({
          project_id: projectId,
          user_id: userId,
          enabled: true,
          enabled_at: new Date().toISOString(),
          features: { forms: true }
        }, { onConflict: 'project_id' });
      }

      await upsertProjectFiles(supabase, projectId, finalFilesToUpsert);
      
      // Include the list of changed files in the response
      const changedFilesList = Object.keys(finalFilesToUpsert);
      
      await updateJob(supabase, job.id, { status: 'succeeded', result_summary: result.summary || 'Updated.', error: null });
      return new Response(JSON.stringify({ 
        ok: true, 
        jobId: job.id, 
        status: 'succeeded', 
        changedFiles: changedFilesList,
        summary: result.summary,
        cssWarnings,
        usesBackend
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
