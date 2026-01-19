import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateProjectCSS, formatCSSWarnings } from "../_shared/cssValidator.ts";

// ============================================================================
// WAKTI AI CODER V3 - SIMPLIFIED & MORPH-FIRST
// ============================================================================
// MODES: chat | agent | create (only 3 modes!)
// MODELS: Gemini 2.5 Pro (create), Gemini 2.5 Flash + Morph (edits)
// TOOLS: 9 tools (down from 14)
// GUARDRAILS: Simplified (read-before-edit, syntax check, simple ambiguity)
// ============================================================================

// ============================================================================
// CORS & TYPES
// ============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  action?: string;
  jobId?: string;
  projectId?: string;
  mode?: 'chat' | 'agent' | 'create';
  prompt?: string;
  theme?: string;
  assets?: string[];
  userInstructions?: string;
  images?: string[];
  currentFiles?: Record<string, string>;
  uploadedAssets?: UploadedAsset[];
  backendContext?: BackendContext;
  debugContext?: DebugContext;
}

interface UploadedAsset {
  filename: string;
  url: string;
  file_type?: string;
}

interface BackendContext {
  enabled: boolean;
  collections: Array<{ name: string; itemCount: number }>;
  formSubmissionsCount: number;
  uploadsCount: number;
  siteUsersCount: number;
}

interface DebugContext {
  errors?: Array<{
    type: string;
    message: string;
    file?: string;
    line?: number;
    stack?: string;
  }>;
  networkErrors?: Array<{
    method: string;
    url: string;
    status: number;
    statusText: string;
  }>;
  autoFixAttempt?: number;
  maxAutoFixAttempts?: number;
}

// ============================================================================
// MODEL SELECTION - Gemini Pro for CREATE, Flash for everything else
// ============================================================================
interface ModelSelection {
  model: string;
  reason: string;
  tier: 'flash' | 'pro';
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
};

function selectModel(mode: string, hasImages: boolean): ModelSelection {
  // PRO only for creation and vision
  if (mode === 'create') {
    return { model: 'gemini-2.5-pro', reason: 'Project creation requires Pro', tier: 'pro' };
  }
  if (hasImages) {
    return { model: 'gemini-2.5-pro', reason: 'Vision analysis requires Pro', tier: 'pro' };
  }
  // Everything else uses Flash
  return { model: 'gemini-2.5-flash', reason: 'Standard operations use Flash', tier: 'flash' };
}

function logCreditUsage(mode: string, model: ModelSelection, inputTokens: number, outputTokens: number, _projectId: string) {
  const pricing = MODEL_PRICING[model.model] || MODEL_PRICING['gemini-2.5-flash'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;
  
  console.log(`[Credit] Mode: ${mode} | Model: ${model.model} | Input: ${inputTokens} | Output: ${outputTokens} | Cost: $${totalCost.toFixed(4)}`);
  
  return { model: model.model, inputTokens, outputTokens, estimatedCost: totalCost };
}

// ============================================================================
// SUPABASE HELPERS
// ============================================================================
function getAdminClient(userAuthHeader?: string | null): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    global: { headers: userAuthHeader ? { Authorization: userAuthHeader } : {} },
    auth: { persistSession: false }
  });
}

async function assertProjectOwnership(supabase: SupabaseClient, projectId: string, userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('PROJECT_NOT_FOUND_OR_NOT_OWNER');
}

interface JobInput {
  projectId: string;
  userId: string;
  mode: string;
  prompt: string;
}

async function createJob(supabase: SupabaseClient, input: JobInput) {
  const { data, error } = await supabase
    .from('project_generation_jobs')
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      mode: input.mode,
      prompt: input.prompt.substring(0, 500),
      status: 'running'
    })
    .select('id')
    .single();
  if (error) throw new Error(`DB_JOB_CREATE_FAILED: ${error.message}`);
  return data;
}

async function updateJob(supabase: SupabaseClient, jobId: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from('project_generation_jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) console.error(`[Job Update Error] ${error.message}`);
}

function normalizeFilePath(path: string): string {
  const p = (path || "").trim();
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

function assertNoHtml(path: string, content: string): void {
  if (path.toLowerCase().endsWith(".html")) return;
  const c = (content || "").toLowerCase();
  if (c.includes("<!doctype") || c.includes("<html")) {
    throw new Error("AI_RETURNED_HTML");
  }
}

// ============================================================================
// GEMINI API CALLS
// ============================================================================
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  tools?: any
): Promise<{ text: string; functionCalls?: any[] }> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  const body: any = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 65536,
    }
  };

  if (tools) {
    body.tools = [tools];
    body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content;
  
  if (!content) {
    throw new Error("No content in Gemini response");
  }

  const textPart = content.parts?.find((p: any) => p.text);
  const functionCalls = content.parts?.filter((p: any) => p.functionCall);

  return {
    text: textPart?.text || "",
    functionCalls: functionCalls?.map((fc: any) => fc.functionCall) || []
  };
}

async function callGeminiWithMessages(
  systemPrompt: string,
  messages: Array<{ role: string; parts: any[] }>,
  model: string,
  tools?: any
): Promise<{ content: any; text: string; functionCalls?: any[] }> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  const body: any = {
    contents: messages,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 65536,
    }
  };

  if (tools) {
    body.tools = [tools];
    body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content;
  
  if (!content) {
    throw new Error("No content in Gemini response");
  }

  const textPart = content.parts?.find((p: any) => p.text);
  const functionCalls = content.parts?.filter((p: any) => p.functionCall);

  return {
    content,
    text: textPart?.text || "",
    functionCalls: functionCalls?.map((fc: any) => fc.functionCall) || []
  };
}

// ============================================================================
// MORPH API - PRIMARY EDIT TOOL
// ============================================================================
interface MorphEditResult {
  success: boolean;
  mergedCode?: string;
  error?: string;
  tokensUsed?: number;
}

async function morphFastApply(
  originalCode: string,
  codeEdit: string,
  instructions: string,
  filepath?: string
): Promise<MorphEditResult> {
  const MORPH_API_KEY = Deno.env.get("MORPH_API_KEY");
  
  if (!MORPH_API_KEY) {
    console.warn("[Morph] MORPH_API_KEY not set");
    return { success: false, error: "MORPH_API_KEY not configured" };
  }

  try {
    console.log(`[Morph] Fast Apply: ${filepath || 'unknown'}`);
    
    const messageContent = `<instruction>${instructions}</instruction>
<code>${originalCode}</code>
<update>${codeEdit}</update>`;

    const response = await fetch("https://api.morphllm.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MORPH_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: messageContent }],
        temperature: 0.0,
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Morph] API error: ${response.status} - ${errorText}`);
      return { success: false, error: `Morph API error: ${response.status}` };
    }

    const data = await response.json();
    const mergedCode = data.choices?.[0]?.message?.content;

    if (!mergedCode) {
      return { success: false, error: "No merged code returned" };
    }

    console.log(`[Morph] Success: merged ${mergedCode.length} chars`);
    return {
      success: true,
      mergedCode,
      tokensUsed: data.usage?.total_tokens
    };

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Morph] Exception: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// SIMPLIFIED TOOLS (9 tools, Morph-first)
// ============================================================================
const AGENT_TOOLS = {
  functionDeclarations: [
    {
      name: "read_file",
      description: "Read file contents. ALWAYS read before editing.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path like /App.js" }
        },
        required: ["path"]
      }
    },
    {
      name: "list_files",
      description: "List all project files.",
      parameters: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Optional: filter to directory" }
        }
      }
    },
    {
      name: "grep_search",
      description: "Search for text/code across all files. Use FIRST to find code location.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to search for" },
          filePattern: { type: "string", description: "Optional: filter by extension like .js" }
        },
        required: ["query"]
      }
    },
    {
      name: "morph_edit",
      description: "PRIMARY EDIT TOOL. Intelligent code merge using Morph. Use '// ... existing code ...' markers for unchanged sections.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          instructions: { type: "string", description: "What you're changing" },
          code_edit: { type: "string", description: "Code with '// ... existing code ...' markers" }
        },
        required: ["path", "instructions", "code_edit"]
      }
    },
    {
      name: "search_replace",
      description: "BACKUP edit tool. Exact string replacement. Use morph_edit instead when possible.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          search: { type: "string", description: "EXACT code to find" },
          replace: { type: "string", description: "New code" }
        },
        required: ["path", "search", "replace"]
      }
    },
    {
      name: "write_file",
      description: "Create NEW files only. Never use for editing existing files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          content: { type: "string", description: "Complete file content" }
        },
        required: ["path", "content"]
      }
    },
    {
      name: "delete_file",
      description: "Delete a file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to delete" }
        },
        required: ["path"]
      }
    },
    {
      name: "get_debug_info",
      description: "Get all errors, logs, and network issues from preview.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["all", "errors", "network"], description: "What to get" }
        }
      }
    },
    {
      name: "task_complete",
      description: "MANDATORY: Call when done. Provide summary and files changed.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "What you did" },
          filesChanged: { type: "array", items: { type: "string" }, description: "Files modified" }
        },
        required: ["summary", "filesChanged"]
      }
    }
  ]
};

// ============================================================================
// TOOL EXECUTION
// ============================================================================
async function executeToolCall(
  projectId: string,
  toolCall: { name: string; args: any },
  debugContext: DebugContext | undefined,
  supabase: SupabaseClient
): Promise<any> {
  const { name, args } = toolCall;
  
  // Security check
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return { error: 'Invalid project ID' };
  }

  console.log(`[Tool] ${name}`, JSON.stringify(args).substring(0, 200));

  switch (name) {
    case "read_file": {
      const path = normalizeFilePath(args.path || "");
      const { data, error } = await supabase
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', path)
        .maybeSingle();
      
      if (error) return { error: `Read failed: ${error.message}` };
      if (!data) return { error: `File not found: ${path}` };
      return { content: data.content, path };
    }

    case "list_files": {
      const directory = args.directory ? normalizeFilePath(args.directory) : null;
      const { data, error } = await supabase
        .from('project_files')
        .select('path')
        .eq('project_id', projectId);
      
      if (error) return { error: `List failed: ${error.message}` };
      
      let files = (data || []).map(f => f.path);
      if (directory) files = files.filter(f => f.startsWith(directory));
      return { files, count: files.length };
    }

    case "grep_search": {
      const query = args.query || "";
      const filePattern = args.filePattern || "";
      
      if (!query) return { error: "Query required" };

      const { data: allFiles, error } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      
      if (error) return { error: `Search failed: ${error.message}` };

      const results: Array<{ file: string; line: number; content: string }> = [];
      const queryLower = query.toLowerCase();

      for (const file of (allFiles || [])) {
        if (filePattern && !file.path.endsWith(filePattern)) continue;
        
        const lines = (file.content || "").split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            results.push({
              file: file.path,
              line: i + 1,
              content: lines[i].trim().substring(0, 150)
            });
          }
        }
      }

      // Simple ambiguity check: >5 matches = ask user
      if (results.length > 5) {
        const uniqueFiles = [...new Set(results.map(r => r.file))];
        return {
          matches: results.slice(0, 10),
          totalMatches: results.length,
          ambiguous: true,
          message: `Found ${results.length} matches in ${uniqueFiles.length} files. Which file do you want to edit? ${uniqueFiles.slice(0, 3).join(', ')}`
        };
      }

      return { matches: results, totalMatches: results.length };
    }

    case "morph_edit": {
      const path = normalizeFilePath(args.path || "");
      const instructions = args.instructions || "";
      const codeEdit = args.code_edit || "";

      if (!codeEdit) return { error: "code_edit required" };
      if (!instructions) return { error: "instructions required" };

      // Read current file
      const { data, error: readError } = await supabase
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', path)
        .maybeSingle();

      if (readError) return { error: `Read failed: ${readError.message}` };
      if (!data) return { error: `File not found: ${path}` };

      // Call Morph Fast Apply
      const morphResult = await morphFastApply(data.content, codeEdit, instructions, path);

      if (!morphResult.success || !morphResult.mergedCode) {
        return { error: morphResult.error || "Morph merge failed" };
      }

      // Validate syntax (basic bracket check)
      const syntaxCheck = validateBasicSyntax(morphResult.mergedCode, path);
      if (!syntaxCheck.valid) {
        return { 
          error: `Syntax error: ${syntaxCheck.error}. Edit blocked.`,
          blocked: true
        };
      }

      // Write merged content
      const { error: writeError } = await supabase
        .from('project_files')
        .update({ content: morphResult.mergedCode })
        .eq('project_id', projectId)
        .eq('path', path);

      if (writeError) return { error: `Write failed: ${writeError.message}` };

      return { 
        success: true, 
        path,
        method: 'morph',
        tokensUsed: morphResult.tokensUsed
      };
    }

    case "search_replace": {
      const path = normalizeFilePath(args.path || "");
      const search = args.search || "";
      const replace = args.replace || "";

      if (!search) return { error: "search required" };

      const { data, error: readError } = await supabase
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', path)
        .maybeSingle();

      if (readError) return { error: `Read failed: ${readError.message}` };
      if (!data) return { error: `File not found: ${path}` };

      if (!data.content.includes(search)) {
        return { 
          error: `Search string not found in ${path}. Use read_file first to get exact code.`,
          suggestion: "Try morph_edit instead - it handles fuzzy matching."
        };
      }

      const newContent = data.content.replace(search, replace);
      
      // Validate syntax
      const syntaxCheck = validateBasicSyntax(newContent, path);
      if (!syntaxCheck.valid) {
        return { error: `Syntax error: ${syntaxCheck.error}. Edit blocked.`, blocked: true };
      }

      const { error: writeError } = await supabase
        .from('project_files')
        .update({ content: newContent })
        .eq('project_id', projectId)
        .eq('path', path);

      if (writeError) return { error: `Write failed: ${writeError.message}` };

      return { success: true, path, method: 'exact' };
    }

    case "write_file": {
      const path = normalizeFilePath(args.path || "");
      const content = args.content || "";

      if (!content.trim()) return { error: "Cannot write empty file" };
      
      assertNoHtml(path, content);

      const { error } = await supabase
        .from('project_files')
        .upsert({ project_id: projectId, path, content }, { onConflict: 'project_id,path' });

      if (error) return { error: `Write failed: ${error.message}` };

      return { 
        success: true, 
        path, 
        bytesWritten: content.length,
        warning: "⚠️ Don't forget to import this file where needed!"
      };
    }

    case "delete_file": {
      const path = normalizeFilePath(args.path || "");
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('project_id', projectId)
        .eq('path', path);

      if (error) return { error: `Delete failed: ${error.message}` };
      return { success: true, deletedPath: path };
    }

    case "get_debug_info": {
      const filter = args.filter || 'all';
      const result: any = {};

      if (filter === 'all' || filter === 'errors') {
        result.errors = debugContext?.errors || [];
      }
      if (filter === 'all' || filter === 'network') {
        result.networkErrors = debugContext?.networkErrors || [];
      }

      result.summary = `${result.errors?.length || 0} errors, ${result.networkErrors?.length || 0} network issues`;
      return result;
    }

    case "task_complete": {
      return {
        acknowledged: true,
        summary: args.summary,
        filesChanged: args.filesChanged || []
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ============================================================================
// SYNTAX VALIDATION (Simplified)
// ============================================================================
function validateBasicSyntax(content: string, filePath: string): { valid: boolean; error?: string } {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (!['js', 'jsx', 'ts', 'tsx'].includes(ext)) return { valid: true };

  // Check balanced brackets
  const brackets: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closers: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prev = i > 0 ? content[i - 1] : '';

    if (inString && prev === '\\') continue;

    if ((char === '"' || char === "'" || char === '`') && !inString) {
      inString = true;
      stringChar = char;
      continue;
    }
    if (inString && char === stringChar) {
      inString = false;
      continue;
    }
    if (inString) continue;

    if (brackets[char]) {
      stack.push(char);
    } else if (closers[char]) {
      const last = stack.pop();
      if (last !== closers[char]) {
        return { valid: false, error: `Unbalanced brackets at position ${i}` };
      }
    }
  }

  if (stack.length > 0) {
    return { valid: false, error: `Unclosed brackets: ${stack.map(b => brackets[b]).join(', ')}` };
  }

  return { valid: true };
}

// ============================================================================
// SIMPLIFIED SYSTEM PROMPT (~150 lines instead of 800)
// ============================================================================
const AGENT_SYSTEM_PROMPT = `You are WAKTI AI Coder - a master coder that makes SURGICAL, TARGETED edits.

## CORE RULES (NEVER BREAK)
1. **Search → Read → Edit.** Never edit without reading first.
2. **Use morph_edit** as your PRIMARY edit tool. It handles fuzzy matching.
3. **No orphan files.** If you create a file, import it somewhere.
4. **Verify before done.** Don't claim success without checking.

## WORKFLOW
1. grep_search → Find where code lives
2. read_file → See full context
3. morph_edit → Make the change (use "// ... existing code ..." markers)
4. task_complete → Summarize what you did

## TOOL PRIORITY
| Tool | When to Use |
|------|-------------|
| morph_edit | PRIMARY - All edits to existing files |
| search_replace | BACKUP - Only if morph_edit fails |
| write_file | NEW files only |
| grep_search | Find code first |
| read_file | Always before editing |

## morph_edit FORMAT
Use "// ... existing code ..." to mark unchanged sections:
\`\`\`
// ... existing code ...
function newFunction() {
  // your new code here
}
// ... existing code ...
\`\`\`

## AMBIGUITY RULE
If grep_search returns >5 matches, ASK the user which file to edit.

## PROJECT SCOPE
- Project ID: {{PROJECT_ID}}
- You can ONLY access files for THIS project
- Backend API: https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

## REACT STANDARDS
- Use functional components with hooks
- import React from 'react' is required
- Use Tailwind CSS for styling
- Use lucide-react for icons
`;

// ============================================================================
// THEME PRESETS
// ============================================================================
const THEME_PRESETS: Record<string, string> = {
  none: "Use a clean, modern design with good contrast.",
  dark: "Dark theme with bg-gray-900, text-white, accent colors.",
  light: "Light theme with bg-white, text-gray-900, subtle shadows.",
  vibrant: "Colorful gradients, bold colors, energetic feel.",
  minimal: "Minimalist design, lots of whitespace, simple typography.",
  corporate: "Professional look, blues and grays, clean lines.",
};

// ============================================================================
// JSON EXTRACTION HELPERS
// ============================================================================
function extractJsonObject(text: string): string {
  // Try to find JSON in markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // Find first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  
  return text;
}

function fixUnescapedNewlines(json: string): string {
  // Fix common JSON issues
  return json
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function coerceFilesMap(parsed: any): { files: Record<string, string>; summary: string } {
  if (parsed.files && typeof parsed.files === 'object') {
    return { files: parsed.files, summary: parsed.summary || '' };
  }
  
  // If the response is directly a files map
  const files: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string' && key.startsWith('/')) {
      files[key] = value;
    }
  }
  
  if (Object.keys(files).length > 0) {
    return { files, summary: '' };
  }
  
  throw new Error('Could not parse files from response');
}

// ============================================================================
// MAIN SERVER
// ============================================================================
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get user ID from JWT
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  let userId = "";
  
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    userId = payload.sub || "";
  } catch {
    // Invalid token
  }

  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body: RequestBody = await req.json();
    const action = body.action || 'start';
    const jobId = (body.jobId || '').toString().trim();
    const projectId = (body.projectId || '').toString().trim();
    const supabase = getAdminClient(req.headers.get("Authorization"));

    // ========================================================================
    // ACTION: status
    // ========================================================================
    if (action === 'status') {
      if (!jobId) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing jobId' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      const { data, error } = await supabase
        .from('project_generation_jobs')
        .select('id, project_id, status, mode, error, result_summary, created_at, updated_at')
        .eq('id', jobId)
        .maybeSingle();
      
      if (error) throw new Error(`DB error: ${error.message}`);
      if (!data) {
        return new Response(JSON.stringify({ ok: false, error: 'Job not found' }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      return new Response(JSON.stringify({ ok: true, job: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ========================================================================
    // ACTION: get_files
    // ========================================================================
    if (action === 'get_files') {
      if (!projectId) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing projectId' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      await assertProjectOwnership(supabase, projectId, userId);
      
      const { data, error } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      
      if (error) throw new Error(`DB error: ${error.message}`);
      
      const files: Record<string, string> = {};
      for (const row of data || []) {
        files[normalizeFilePath(row.path)] = row.content;
      }
      
      return new Response(JSON.stringify({ ok: true, files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ========================================================================
    // MODE HANDLING: chat | agent | create
    // ========================================================================
    const mode = body.mode || 'create';
    const prompt = (body.prompt || '').toString();
    const theme = (body.theme || 'none').toString();
    const userInstructions = (body.userInstructions || '').toString();
    const images = body.images;
    const uploadedAssets = body.uploadedAssets || [];
    const _backendContext = body.backendContext;
    const debugContext = body.debugContext;
    const currentFiles = body.currentFiles || {};

    // ========================================================================
    // CHAT MODE: Q&A only
    // ========================================================================
    if (mode === 'chat') {
      const hasImages = Array.isArray(images) && images.length > 0;
      const modelSelection = selectModel('chat', hasImages);
      
      const fileList = Object.keys(currentFiles).join('\n');
      const chatPrompt = `Project files:\n${fileList}\n\nUser question: ${prompt}`;
      
      const result = await callGemini(
        "You are a helpful coding assistant. Answer questions about the project.",
        chatPrompt,
        modelSelection.model
      );

      return new Response(JSON.stringify({
        ok: true,
        mode: 'chat',
        response: result.text,
        model: modelSelection.model
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ========================================================================
    // AGENT MODE: Autonomous editing with tools
    // ========================================================================
    if (mode === 'agent') {
      if (!projectId) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing projectId' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await assertProjectOwnership(supabase, projectId, userId);
      const job = await createJob(supabase, { projectId, userId, mode: 'agent', prompt });

      try {
        const hasImages = Array.isArray(images) && images.length > 0;
        const modelSelection = selectModel('agent', hasImages);
        
        // Build system prompt with project context
        let systemPrompt = AGENT_SYSTEM_PROMPT.replace(/\{\{PROJECT_ID\}\}/g, projectId);
        
        // Add debug context if errors exist
        if (debugContext?.errors?.length || debugContext?.networkErrors?.length) {
          systemPrompt += `\n\n## 🔴 ERRORS TO FIX\n`;
          if (debugContext.errors?.length) {
            systemPrompt += debugContext.errors.slice(-3).map(e => 
              `- [${e.type}] ${e.message}${e.file ? ` in ${e.file}` : ''}`
            ).join('\n');
          }
          if (debugContext.networkErrors?.length) {
            systemPrompt += '\n' + debugContext.networkErrors.slice(-2).map(e =>
              `- ${e.method} ${e.url} → ${e.status}`
            ).join('\n');
          }
        }

        // Add uploaded assets context
        if (uploadedAssets.length > 0) {
          systemPrompt += `\n\n## 📁 UPLOADED ASSETS\n`;
          systemPrompt += uploadedAssets.map((a: UploadedAsset) => 
            `- ${a.filename}: ${a.url}`
          ).join('\n');
        }

        // Agent loop
        const MAX_ITERATIONS = 8;
        const messages: Array<{ role: string; parts: any[] }> = [
          { role: "user", parts: [{ text: prompt }] }
        ];
        
        const filesRead = new Set<string>();
        const filesEdited = new Set<string>();
        const toolCallsLog: Array<{ tool: string; result: any }> = [];
        let taskCompleteResult: { summary: string; filesChanged: string[] } | null = null;

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          console.log(`[Agent] Iteration ${iteration + 1}/${MAX_ITERATIONS}`);

          const response = await callGeminiWithMessages(
            systemPrompt,
            messages,
            modelSelection.model,
            AGENT_TOOLS
          );

          messages.push({ role: "model", parts: response.content.parts });

          // No function calls = done
          if (!response.functionCalls || response.functionCalls.length === 0) {
            console.log(`[Agent] No more function calls, ending`);
            break;
          }

          // Execute function calls
          const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];

          for (const fc of response.functionCalls) {
            const result = await executeToolCall(
              projectId,
              { name: fc.name, args: fc.args || {} },
              debugContext,
              supabase
            );

            // Track files read/edited
            if (fc.name === 'read_file' && result.path) {
              filesRead.add(result.path);
            }
            if (['morph_edit', 'search_replace', 'write_file'].includes(fc.name) && result.success) {
              filesEdited.add(result.path);
            }

            toolCallsLog.push({ tool: fc.name, result });
            functionResponses.push({
              functionResponse: { name: fc.name, response: result }
            });

            // Check for task_complete
            if (fc.name === 'task_complete' && result.acknowledged) {
              // Simple guardrails
              if (filesEdited.size > 0 && filesRead.size === 0) {
                // Edited without reading - block
                functionResponses[functionResponses.length - 1].functionResponse.response = {
                  error: "You edited files without reading them first. Use read_file before editing.",
                  blocked: true
                };
              } else {
                taskCompleteResult = {
                  summary: result.summary,
                  filesChanged: result.filesChanged
                };
              }
            }
          }

          messages.push({ role: "user", parts: functionResponses });

          if (taskCompleteResult) {
            console.log(`[Agent] Task complete: ${taskCompleteResult.summary}`);
            break;
          }
        }

        // Log credit usage
        const inputTokens = messages.reduce((sum, m) => 
          sum + JSON.stringify(m).length / 4, 0
        );
        const outputTokens = toolCallsLog.reduce((sum, tc) => 
          sum + JSON.stringify(tc).length / 4, 0
        );
        const creditUsage = logCreditUsage('agent', modelSelection, inputTokens, outputTokens, projectId);

        await updateJob(supabase, job.id, {
          status: 'succeeded',
          result_summary: taskCompleteResult?.summary || 'Agent completed',
          error: null
        });

        return new Response(JSON.stringify({
          ok: true,
          jobId: job.id,
          status: 'succeeded',
          mode: 'agent',
          summary: taskCompleteResult?.summary ?? 'Agent completed',
          filesChanged: [...filesEdited],
          toolCalls: toolCallsLog.length,
          creditUsage
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Agent] Error: ${errMsg}`);
        await updateJob(supabase, job.id, { status: 'failed', error: errMsg });
        return new Response(JSON.stringify({ ok: false, jobId: job.id, error: errMsg }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ========================================================================
    // CREATE MODE: Generate new project
    // ========================================================================
    if (!projectId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing projectId' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (!prompt) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing prompt' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    await assertProjectOwnership(supabase, projectId, userId);
    const job = await createJob(supabase, { projectId, userId, mode: 'create', prompt });

    try {
      const themeDesc = THEME_PRESETS[theme] || THEME_PRESETS['none'];
      
      const createSystemPrompt = `You are a React code generator. Create a complete React application.

## OUTPUT FORMAT
Return a JSON object with file paths as keys and file contents as values:
{
  "/App.js": "import React from 'react';\\nexport default function App() { return <div>...</div>; }",
  "/components/Header.jsx": "...",
  "summary": "Created a landing page with..."
}

## RULES
- /App.js is REQUIRED and must be the entry point
- Use functional components with hooks
- Use Tailwind CSS for styling
- Use lucide-react for icons
- NO HTML files - React only!

## THEME
${themeDesc}

## PROJECT ID
${projectId}
`;

      const hasImages = Array.isArray(images) && images.length > 0;
      const modelSelection = selectModel('create', hasImages);

      let createPrompt = `CREATE: ${prompt}`;
      if (userInstructions) createPrompt += `\n\nInstructions: ${userInstructions}`;

      const result = await callGemini(createSystemPrompt, createPrompt, modelSelection.model);
      
      let jsonContent = extractJsonObject(result.text);
      jsonContent = fixUnescapedNewlines(jsonContent);
      
      const parsed = JSON.parse(jsonContent);
      let { files, summary } = coerceFilesMap(parsed);

      // Validate App.js exists
      if (!files["/App.js"]) {
        throw new Error("MISSING_APP_JS");
      }
      assertNoHtml("/App.js", files["/App.js"]);

      // Inject project ID
      for (const [path, content] of Object.entries(files)) {
        files[path] = content.replace(/\{\{PROJECT_ID\}\}/g, projectId);
      }

      // CSS validation
      const cssWarnings = validateProjectCSS(files);
      if (cssWarnings.length > 0) {
        console.warn(formatCSSWarnings(cssWarnings));
      }

      // Save files
      for (const [path, content] of Object.entries(files)) {
        await supabase
          .from('project_files')
          .upsert({ project_id: projectId, path, content }, { onConflict: 'project_id,path' });
      }

      // Log credit usage
      const inputTokens = (createSystemPrompt + createPrompt).length / 4;
      const outputTokens = result.text.length / 4;
      const creditUsage = logCreditUsage('create', modelSelection, inputTokens, outputTokens, projectId);

      await updateJob(supabase, job.id, {
        status: 'succeeded',
        result_summary: summary || 'Project created',
        error: null
      });

      return new Response(JSON.stringify({
        ok: true,
        jobId: job.id,
        status: 'succeeded',
        mode: 'create',
        filesCreated: Object.keys(files),
        summary,
        creditUsage
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Create] Error: ${errMsg}`);
      await updateJob(supabase, job.id, { status: 'failed', error: errMsg });
      return new Response(JSON.stringify({ ok: false, jobId: job.id, error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Fatal] ${errMsg}`);
    return new Response(JSON.stringify({ ok: false, error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
