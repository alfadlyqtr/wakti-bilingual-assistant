import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateProjectCSS, formatCSSWarnings, getCSSInheritanceGuidelines, type CSSWarning } from "../_shared/cssValidator.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { 
  AGENT_TOOLS, 
  AGENT_SYSTEM_PROMPT, 
  executeToolCall, 
  getGeminiToolsConfig, 
  type AgentDebugContext, 
  type AgentResult,
  // Smart enforcement utilities
  traceRenderPath,
  isFileInRenderPath,
  parseIntentAnchors,
  getSuggestedGrepQueries,
  detectAmbiguity,
  verifyEdit,
  // NEW Phase 1-5: Enhanced validation
  validateStyleChangeRequest,
  isValidTailwindColor,
  parseColorFromPrompt,
  type IntentAnchors,
  type AmbiguityResult,
  type VerificationResult,
  type StyleChangeValidation,
  // 🔍 Edit Intent Analyzer (from Open Lovable)
  analyzeEditIntent,
  type EditIntent,
  type EditIntentType,
  // 🔧 Error Classification (from Open Lovable's build-validator.ts)
  classifyError,
  extractMissingPackages,
  calculateRetryDelay,
  type ErrorType,
  type ClassifiedError,
  // 📄 Fallback Response Parsing (from Open Lovable's apply-ai-code/route.ts)
  parseAIResponseForFiles,
  applyParsedFileChanges,
  type ParsedFileChange,
  type ParsedAIResponse,
  // 🚀 Morph Fast Apply - Intelligent Code Merging (10,500+ tok/sec)
  morphFastApply,
  morphEditFile,
  smartSearchReplace,
  parseMorphEdits,
  type MorphApplyInput,
  type MorphApplyResult,
  type MorphEditBlock,
  // 🔍 Morph Warp Grep - AI-Powered Code Search
  morphWarpGrep,
  type WarpGrepResult,
  // 🎯 UPGRADE #1: Auto "Explain What Changed" Report
  generateChangeReport,
  type ChangeReport,
  type ChangeReportEntry,
  // 🔒 UPGRADE #2: Multi-file Safety Guardrails
  checkMultiFileGuardrails,
  type MultiFileGuardrail,
  type MultiFileChecklistItem,
  // 🧪 UPGRADE #3: Smoke-Test Runner
  runSmokeTests,
  type SmokeTestResult,
  type SmokeTestItem
} from "./agentTools.ts";

// ============================================================================
// WAKTI PROJECTS-GENERATE V2 - OPTIMIZED ENGINE
// ============================================================================
// SMART MODEL SELECTION: Flash-Lite for simple, Flash for medium, Pro for complex
// REDUCED ITERATIONS: 4 instead of 8 for agent mode
// CREDIT TRACKING: Log model used, tokens, and estimated cost
// Modes: plan (propose changes) | execute (write code) | create | chat | agent
// ============================================================================

// ============================================================================
// SMART MODEL SELECTION - Reduce AI costs by 60-80%
// ============================================================================
interface ModelSelection {
  model: string;
  reason: string;
  tier: 'lite' | 'flash' | 'pro';
}

// Pricing per 1M tokens (input/output) - for cost estimation
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
};

function selectOptimalModel(
  prompt: string, 
  hasImages: boolean, 
  mode: string,
  fileCount: number = 0
): ModelSelection {
  // PRO tier: Creation, vision, and complex operations ALWAYS use Pro
  if (mode === 'create') {
    return { model: 'gemini-2.5-pro', reason: 'Project creation requires Pro', tier: 'pro' };
  }
  
  if (hasImages) {
    return { model: 'gemini-2.5-pro', reason: 'Vision/screenshot analysis requires Pro', tier: 'pro' };
  }
  
  // Analyze prompt complexity
  const promptLower = prompt.toLowerCase();
  
  // SIMPLE patterns (Flash-Lite) - ~10x cheaper than Pro
  const simplePatterns = [
    /\b(change|update|set|fix)\s+(the\s+)?(color|colour|text|font|size|background|bg)/i,
    /\b(typo|spelling|text)\s*(fix|error|mistake|change)/i,
    /\b(remove|delete|hide)\s+(the\s+)?(button|text|element|section)/i,
    /\b(show|display|unhide)\s+(the\s+)?(button|text|element|section)/i,
    /\b(change|update)\s+(the\s+)?(title|heading|label|placeholder)/i,
    /\bmake\s+(it\s+)?(bigger|smaller|larger|wider|taller|shorter)/i,
    /\b(add|change)\s+(the\s+)?(padding|margin|spacing|border)/i,
    /\brename\s/i,
    /\bchange\s.*\s(to|into)\s/i,
  ];
  
  // COMPLEX patterns (Pro) - Full capabilities needed
  const complexPatterns = [
    /\b(refactor|restructure|redesign|rebuild|rewrite|architect)/i,
    /\b(create|build|implement|add)\s+(a\s+)?(new\s+)?(page|feature|system|module|component)/i,
    /\b(integrate|connect|setup|configure)\s+(the\s+)?(api|backend|database|auth)/i,
    /\b(multi-?step|workflow|wizard|form\s+validation)/i,
    /\b(complex|advanced|sophisticated)/i,
    /\b(debug|fix\s+crash|runtime\s+error|broken)/i,
  ];
  
  // Check for simple edits first
  for (const pattern of simplePatterns) {
    if (pattern.test(promptLower)) {
      // Simple edit with small project = Flash-Lite
      if (fileCount < 10) {
        return { model: 'gemini-2.5-flash-lite', reason: 'Simple edit detected', tier: 'lite' };
      }
      // Simple edit with larger project = Flash (needs more context handling)
      return { model: 'gemini-2.5-flash', reason: 'Simple edit in larger project', tier: 'flash' };
    }
  }
  
  // Check for complex operations
  for (const pattern of complexPatterns) {
    if (pattern.test(promptLower)) {
      return { model: 'gemini-2.5-pro', reason: 'Complex operation detected', tier: 'pro' };
    }
  }
  
  // Default: Flash for medium complexity (5x cheaper than Pro)
  return { model: 'gemini-2.5-flash', reason: 'Standard edit', tier: 'flash' };
}

// ============================================================================
// CREDIT USAGE TRACKING
// ============================================================================
interface CreditUsage {
  model: string;
  tier: 'lite' | 'flash' | 'pro';
  inputTokensEstimate: number;
  outputTokensEstimate: number;
  estimatedCostUSD: number;
  reason: string;
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for code
  return Math.ceil(text.length / 4);
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-2.5-pro'];
  return ((inputTokens / 1000000) * pricing.input) + ((outputTokens / 1000000) * pricing.output);
}

function logCreditUsage(
  mode: string,
  modelSelection: ModelSelection,
  inputText: string,
  outputText: string,
  projectId: string
): CreditUsage {
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const cost = calculateCost(modelSelection.model, inputTokens, outputTokens);
  
  const usage: CreditUsage = {
    model: modelSelection.model,
    tier: modelSelection.tier,
    inputTokensEstimate: inputTokens,
    outputTokensEstimate: outputTokens,
    estimatedCostUSD: cost,
    reason: modelSelection.reason
  };
  
  console.log(`[💰 CREDIT USAGE] Mode: ${mode} | Model: ${usage.model} (${usage.tier})`);
  console.log(`[💰 CREDIT USAGE] Tokens: ~${inputTokens} in / ~${outputTokens} out`);
  console.log(`[💰 CREDIT USAGE] Estimated cost: $${cost.toFixed(6)}`);
  console.log(`[💰 CREDIT USAGE] Reason: ${usage.reason}`);
  console.log(`[💰 CREDIT USAGE] Project: ${projectId}`);
  
  return usage;
}

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

interface UploadedAsset {
  filename: string;
  url: string;
  file_type: string | null;
}

interface BackendContext {
  enabled: boolean;
  collections: Array<{ name: string; itemCount: number; schema?: any }>;
  formSubmissionsCount: number;
  uploadsCount: number;
  siteUsersCount: number;
  // E-commerce data
  products?: Array<{ name: string; price: number; image?: string; category?: string }>;
  productsCount?: number;
  ordersCount?: number;
  hasShopSetup?: boolean;
  // Booking data  
  services?: Array<{ name: string; duration: number; price: number }>;
  servicesCount?: number;
  bookingsCount?: number;
  hasBookingsSetup?: boolean;
  // Chat & Comments
  chatRoomsCount?: number;
  commentsCount?: number;
  // Customer Engagement
  reviewsCount?: number;
  formsCount?: number;
  customerDataCount?: number;
  reviews?: Array<{ rating: number; text: string; productId?: string }>;
  forms?: Array<{ id: string; name: string; fields: Array<{ name: string; type: string }> }>;
  customerData?: Array<{ userId: string; preferences: Record<string, any> }>;
}

// Debug context from the AI Coder debug system
interface DebugContext {
  errors: Array<{
    type: 'runtime' | 'syntax' | 'network' | 'render' | 'build' | 'console';
    message: string;
    stack?: string;
    file?: string;
    line?: number;
    componentStack?: string;
  }>;
  networkErrors: Array<{
    url: string;
    method: string;
    status: number;
    statusText: string;
    responseBody?: string;
  }>;
  autoFixAttempt?: number;
  maxAutoFixAttempts?: number;
}

interface RequestBody {
  action?: 'start' | 'status' | 'get_files';
  jobId?: string;
  projectId?: string;
  mode?: 'create' | 'edit' | 'plan' | 'execute' | 'chat' | 'agent';
  prompt?: string;
  currentFiles?: Record<string, string>;
  assets?: string[];
  theme?: string;
  userInstructions?: string;
  images?: ImageAttachment[];
  planToExecute?: string;
  uploadedAssets?: UploadedAsset[];
  backendContext?: BackendContext;
  debugContext?: DebugContext;  // NEW: Debug context for error-aware editing
  fixerMode?: boolean;  // NEW: Use Claude Opus 4 as "The Fixer" for final auto-fix attempt
  fixerContext?: {  // NEW: Extra context for The Fixer
    errorMessage: string;
    previousAttempts: number;
    recentEdits?: string[];  // Files that were recently edited
    chatHistory?: string;  // Recent chat context
  };
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

// ============================================================================
// UNIVERSAL MODEL CALLER - Supports all Gemini models with dynamic selection
// ============================================================================
async function callGeminiWithModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = true
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  
  console.log(`[Gemini] Calling model: ${model}`);

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
    console.error(`[Gemini ${model}] HTTP ${response.status}: ${errorText}`);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  if (jsonMode) {
    text = normalizeGeminiResponseText(text);
  }
  
  return text;
}

// Legacy wrapper for backward compatibility - always uses Pro
async function callGemini25Pro(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = true
): Promise<string> {
  return callGeminiWithModel('gemini-2.5-pro', systemPrompt, userPrompt, jsonMode);
}

// ============================================================================
// STEP 1: ANALYZE SCREENSHOT - Extract visible UI text anchors
// ============================================================================
async function analyzeScreenshotForAnchors(
  images: string[]
): Promise<{ anchors: string[]; description: string }> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const model = "gemini-2.5-pro";
  
  // Build image parts
  const parts: Array<{text?: string; inlineData?: {mimeType: string; data: string}}> = [];
  
  for (const imgData of images) {
    if (typeof imgData !== 'string') continue;
    if (imgData.startsWith('data:image/')) {
      const commaIdx = imgData.indexOf(',');
      if (commaIdx > 0) {
        const mimeMatch = imgData.match(/^data:(image\/[^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64Data = imgData.substring(commaIdx + 1);
        parts.push({
          inlineData: { mimeType, data: base64Data }
        });
      }
    }
  }
  
  if (parts.length === 0) {
    return { anchors: [], description: '' };
  }
  
  // Add analysis prompt - focus on the MAIN/PRIMARY element, not all visible text
  parts.push({ 
    text: `The user is pointing at a specific UI section in this screenshot. Identify the PRIMARY section they want to modify.

RULES:
1. Focus on the MAIN/CENTRAL element - usually the largest or most prominent section
2. If there's a section heading with a button below it, that's likely the target
3. Ignore navigation bars, headers, footers unless they ARE the main focus
4. Look for visual emphasis: larger text, icons, colored buttons

EXTRACT (for the PRIMARY section only):
1. The main section heading (e.g., "Get In Touch", "Contact Us")
2. Any button text within that section (e.g., "Contact Me", "Send Message")
3. Unique identifiers specific to THIS section

Return JSON:
{
  "anchors": ["primary heading", "button text", ...],
  "description": "What this section IS (e.g., 'contact section with email button')",
  "confidence": "high/medium/low"
}

CRITICAL: Return ONLY the PRIMARY section's text. If you see multiple sections, pick the ONE that appears most prominent or central.`
  });

  console.log(`[Screenshot Analysis] Analyzing ${parts.length - 1} images for text anchors...`);

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
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      }
    ),
    30000, // 30 seconds for quick analysis
    'SCREENSHOT_ANALYSIS'
  );

  if (!response.ok) {
    console.error(`[Screenshot Analysis] Failed: ${response.status}`);
    return { anchors: [], description: '' };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  
  try {
    const result = JSON.parse(text);
    console.log(`[Screenshot Analysis] Found anchors:`, result.anchors);
    return {
      anchors: Array.isArray(result.anchors) ? result.anchors : [],
      description: result.description || ''
    };
  } catch {
    console.error(`[Screenshot Analysis] JSON parse failed`);
    return { anchors: [], description: '' };
  }
}

// GEMINI 2.5 PRO WITH IMAGES - Vision-capable for screenshots/PDFs
// ============================================================================
async function callGemini25ProWithImages(
  systemPrompt: string,
  userPrompt: string,
  images?: string[],
  jsonMode: boolean = true
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  // Use Gemini 2.5 Pro (vision-capable)
  const model = "gemini-2.5-pro";
  
  // Build content parts - text + optional images
  const parts: Array<{text?: string; inlineData?: {mimeType: string; data: string}}> = [];
  
  // Add images first if provided
  if (images && images.length > 0) {
    console.log(`[Gemini 2.5 Pro Vision] Processing ${images.length} attachments...`);
    for (const imgData of images) {
      if (typeof imgData !== 'string') continue;
      
      // Handle PDF with marker [PDF:filename]data:...
      if (imgData.startsWith('[PDF:')) {
        const endMarker = imgData.indexOf(']');
        if (endMarker > 0) {
          const dataUrl = imgData.substring(endMarker + 1);
          if (dataUrl.startsWith('data:application/pdf;base64,')) {
            const base64Data = dataUrl.replace('data:application/pdf;base64,', '');
            parts.push({
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data
              }
            });
            console.log(`[Gemini 2.5 Pro Vision] Added PDF attachment`);
          }
        }
        continue;
      }
      
      // Handle regular images (data:image/...;base64,...)
      if (imgData.startsWith('data:image/')) {
        const commaIdx = imgData.indexOf(',');
        if (commaIdx > 0) {
          const mimeMatch = imgData.match(/^data:(image\/[^;]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const base64Data = imgData.substring(commaIdx + 1);
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data
            }
          });
          console.log(`[Gemini 2.5 Pro Vision] Added image (${mimeType})`);
        }
      }
    }
  }
  
  // Add text prompt
  parts.push({ text: userPrompt });
  
  console.log(`[Gemini 2.5 Pro Vision] Calling model: ${model} with ${parts.length} parts`);

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
          contents: [{ role: "user", parts }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        }),
      }
    ),
    300000, // 300 seconds
    'GEMINI_25_PRO_VISION'
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini 2.5 Pro Vision] HTTP ${response.status}: ${errorText}`);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  if (jsonMode) {
    text = normalizeGeminiResponseText(text);
  }
  
  return text;
}

// NOTE: Create mode uses callGemini25Pro directly (line ~2243)

// PLAN MODE: AI proposes changes, returns a structured plan (Lovable-style)
// Now with SMART MODEL SELECTION + CONTEXT OPTIMIZATION (targeted files only)
async function callGeminiPlanMode(
  userPrompt: string,
  currentFiles: Record<string, string>
): Promise<{ plan: string; modelSelection: ModelSelection }> {
  const fileCount = Object.keys(currentFiles || {}).length;
  
  // 🚀 CONTEXT OPTIMIZATION V2: Send file structure + SCAN ALL FILES to find relevant elements
  const fileNames = Object.keys(currentFiles || {});
  const promptLower = userPrompt.toLowerCase();
  
  // Extract keywords from user prompt (names, specific text, element types)
  const promptWords = promptLower.split(/\s+/).filter(w => w.length > 3);
  
  // Scan ALL files to find which ones contain relevant keywords/elements
  const fileRelevanceScores: Record<string, number> = {};
  for (const filePath of fileNames) {
    const content = currentFiles[filePath] || '';
    const contentLower = content.toLowerCase();
    let score = 0;
    
    // Check for prompt keywords in file
    for (const word of promptWords) {
      if (contentLower.includes(word)) score += 2;
    }
    
    // Bonus for visual/UI files
    if (filePath.includes('Home') || filePath.includes('Hero')) score += 3;
    if (filePath.includes('Header') || filePath.includes('Nav')) score += 2;
    if (filePath.includes('page') || filePath.includes('Page')) score += 2;
    
    // Key entry files always get included
    const keyFiles = ['App.jsx', 'App.js', 'App.tsx', 'index.jsx', 'index.js', 'index.tsx'];
    if (keyFiles.some(k => filePath.endsWith(k))) score += 5;
    
    fileRelevanceScores[filePath] = score;
  }
  
  // Sort by relevance and take DYNAMIC top-N files based on project size
  // Small projects (≤10 files): include all
  // Medium projects (11-30 files): top 15
  // Large projects (>30 files): top 20
  const dynamicTopN = fileCount <= 10 ? fileCount : (fileCount <= 30 ? 15 : 20);
  console.log(`[Plan Mode] Dynamic context: ${dynamicTopN} files (project has ${fileCount})`);
  
  const sortedFiles = Object.entries(fileRelevanceScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, dynamicTopN)
    .map(([path]) => path);
  
  // Include content of relevant files only
  const relevantContext = sortedFiles
    .map(path => `=== FILE: ${path} ===\n${currentFiles[path] || ''}`)
    .join("\n\n");
  
  const otherFiles = fileNames.filter(f => !sortedFiles.includes(f)).join('\n');
  
  const fileContext = `📁 Project has ${fileCount} files.

📄 Most Relevant Files (full content for analysis):
${relevantContext}

${otherFiles ? `📁 Other files (names only):
${otherFiles}` : ''}

⚠️ CRITICAL: Scan the relevant files above to find the EXACT element/text mentioned in the request. Do NOT guess - verify the element exists.`;

  // Smart model selection for plan mode
  const modelSelection = selectOptimalModel(userPrompt, false, 'plan', fileCount);
  console.log(`[Plan Mode] Model selected: ${modelSelection.model} (${modelSelection.tier}) - ${modelSelection.reason}`);

  const systemPrompt = `You are a code analysis engine. Your ONLY job is to analyze the provided codebase and propose REAL, SPECIFIC changes.

🚨 CRITICAL RULES (MUST FOLLOW):
1. EXTRACT ACTUAL CODE from the provided files - do NOT invent or use placeholders
2. Show REAL line numbers where code currently exists
3. "current" field MUST contain the EXACT code snippet from the file (copy-paste from provided code)
4. "changeTo" field MUST contain the EXACT new code (real modification, not placeholder)
5. Output ONLY valid JSON - no explanations, no markdown, no text before/after
6. Every "current" value MUST exist in the provided files - verify by line number

PRODUCT CREATION RULES (MANDATORY):
- NEVER hardcode a projectId. Use the existing projectId variable in the file.
- Use supabase.functions.invoke('project-backend-api', { body: { projectId, action: 'collection/products', data } }) or a fetch call with dynamic projectId.
- Convert price to a number before sending.
- Use toast for success/error (no alert()).
- After success, add CTA text: "Manage stock in Backend → Shop → Inventory".

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

  const plan = await callGeminiWithModel(modelSelection.model, systemPrompt, userMessage, true);
  return { plan, modelSelection };
}

// EXECUTE MODE: AI writes full file rewrites based on a plan
// Now with SMART MODEL SELECTION + ULTRA-OPTIMIZED CONTEXT (only plan-specified files)
async function callGeminiExecuteMode(
  planToExecute: string,
  currentFiles: Record<string, string>,
  userInstructions: string = ""
): Promise<{ files: Record<string, string>; summary: string; modelSelection: ModelSelection }> {
  const fileCount = Object.keys(currentFiles || {}).length;
  
  // 🚀 CONTEXT OPTIMIZATION V2: STRICT - only files explicitly mentioned in plan
  const allFileNames = Object.keys(currentFiles || {});
  const planLower = planToExecute.toLowerCase();
  
  // Extract ONLY files explicitly mentioned in the plan (strict matching)
  const mentionedFiles = allFileNames.filter(filePath => {
    const fileName = filePath.split('/').pop() || '';
    const fileNameNoExt = fileName.replace(/\.(jsx?|tsx?|css|scss)$/i, '');
    return planLower.includes(filePath.toLowerCase()) || 
           planLower.includes(fileName.toLowerCase()) ||
           planLower.includes(fileNameNoExt.toLowerCase());
  });
  
  // MINIMAL entry files - only if they contain routing AND are very small
  const criticalEntryFiles = ['App.jsx', 'App.js', 'App.tsx'];
  const entryFiles = allFileNames.filter(f => {
    if (!criticalEntryFiles.some(k => f.endsWith(k))) return false;
    const content = currentFiles[f] || '';
    // Only include if it's a small routing file (< 2KB)
    return content.length < 2000;
  });
  
  // Combine mentioned + critical entry files (dedupe)
  const relevantFiles = [...new Set([...mentionedFiles, ...entryFiles])];
  
  // ULTRA-COMPACT context: Only mentioned files, no other file list
  const relevantContext = relevantFiles
    .map(path => `=== ${path} ===\n${currentFiles[path] || ''}`)
    .join("\n\n");
  
  const fileContext = `📄 Files to modify:
${relevantContext}`;

  // Smart model selection for execute mode
  const modelSelection = selectOptimalModel(planToExecute, false, 'execute', fileCount);
  console.log(`[Execute Mode] Model selected: ${modelSelection.model} (${modelSelection.tier}) - ${modelSelection.reason}`);

  const systemPrompt = GEMINI_EXECUTE_SYSTEM_PROMPT;

  const userMessage = `CURRENT CODEBASE:
${fileContext}

PLAN TO EXECUTE:
${planToExecute}

${userInstructions ? `ADDITIONAL INSTRUCTIONS:\n${userInstructions}\n\n` : ""}
Execute this plan. Return the FULL content of every file that needs to be modified or created.
Return ONLY a valid JSON object with the structure shown in the system prompt.`;

  const text = await callGeminiWithModel(modelSelection.model, systemPrompt, userMessage, true);
  
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

  return { files, summary: summary || "Changes applied.", modelSelection };
}

// EDIT MODE (Legacy compatibility): Direct edit without plan step
async function callGeminiFullRewriteEdit(
  userPrompt: string,
  currentFiles: Record<string, string>,
  userInstructions: string = "",
  images?: string[], // Support for images/PDFs
  uploadedAssets?: UploadedAsset[], // User uploaded assets from backend
  backendContext?: BackendContext // Backend context for AI awareness
): Promise<{ files: Record<string, string>; summary: string }> {
  const fileContext = Object.entries(currentFiles || {})
    .map(([path, content]) => `=== FILE: ${path} ===\n${content}`)
    .join("\n\n");

  const systemPrompt = GEMINI_EXECUTE_SYSTEM_PROMPT;

  // Build image context if provided
  let imageContext = '';
  let pdfTextContent = '';
  let screenshotAnchorsContext = '';
  
  if (images && images.length > 0) {
    console.log(`[Edit Mode] Processing ${images.length} attached files...`);
    
    // STEP 1: Analyze screenshots to extract visible text anchors
    const screenshotImages = images.filter(img => 
      typeof img === 'string' && img.startsWith('data:image/')
    );
    
    if (screenshotImages.length > 0) {
      console.log(`[Edit Mode] Running 2-step screenshot analysis...`);
      try {
        const { anchors, description } = await analyzeScreenshotForAnchors(screenshotImages);
        if (anchors.length > 0) {
          screenshotAnchorsContext = `

🎯 SCREENSHOT ANALYSIS (STEP 1 COMPLETE):
The user attached a screenshot. I analyzed it and found these text anchors:
- Visible text: ${anchors.map(a => `"${a}"`).join(', ')}
- Section description: ${description}

⚠️ CRITICAL INSTRUCTION FOR STEP 2:
1. Search the codebase for these EXACT strings: ${anchors.slice(0, 3).map(a => `"${a}"`).join(', ')}
2. The section containing these strings is what the user is referring to
3. Apply the user's request ONLY to that section
4. Do NOT invent or guess other text - use ONLY the anchors above
`;
          console.log(`[Edit Mode] Screenshot anchors injected: ${anchors.join(', ')}`);
        }
      } catch (err) {
        console.error(`[Edit Mode] Screenshot analysis failed:`, err);
      }
    }
    
    // Process PDFs
    for (const imgData of images) {
      if (typeof imgData !== 'string') continue;
      
      // Check if it's a PDF with text marker
      if (imgData.startsWith('[PDF:')) {
        const endMarker = imgData.indexOf(']');
        if (endMarker > 0) {
          const pdfName = imgData.substring(5, endMarker);
          pdfTextContent += `\n\n📄 ATTACHED PDF: ${pdfName}\n(PDF content attached - extract and use relevant information from it)\n`;
        }
      }
    }
    if (pdfTextContent) {
      imageContext = `\n\n🖼️ ATTACHED FILES:\n${pdfTextContent}\nUSE THE INFORMATION FROM THESE ATTACHMENTS TO BUILD THE PROJECT.\n`;
    }
  }
  
  // Build uploaded assets context
  const uploadedAssetsContext = uploadedAssets && uploadedAssets.length > 0 
    ? `\n\n📁 USER UPLOADED ASSETS (Use these URLs directly in the code):
${uploadedAssets.map(a => `- **${a.filename}** (${a.file_type || 'file'}): ${a.url}`).join('\n')}
When user says "my photo", "my image", "uploaded image", "profile picture", use the appropriate URL from above.\n`
    : '';

  // Build backend context section - "BRICK FOUNDATION + LEGO FREEDOM" philosophy
  const backendContextStr = backendContext?.enabled ? `

🗄️ PROJECT BACKEND (PRE-CONFIGURED & READY TO USE):
API: https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

=== 🧱 THE LEGO PHILOSOPHY ===
Think of this like building with Lego:
- **BRICKS (Foundation):** Pre-configured building blocks that ALWAYS work. No setup needed.
- **FREEDOM:** You can build ANY kind of "house" using these bricks + custom pieces.
- **RELIABILITY:** The backend is already connected. Just use it. No API keys, no config.

=== 📦 YOUR BUILDING BLOCKS (Always Available) ===
These collections are pre-installed and ready: ${FOUNDATION_BRICKS.join(', ')}
- Use them directly: { projectId, action: 'collection/[name]' }
- Need something custom? Create it: { projectId, action: 'collection/my_custom_thing', data: {...} }

=== 📊 CURRENT DATA ===
- Collections: ${backendContext.collections.length > 0 
  ? backendContext.collections.map(c => c.name + '(' + c.itemCount + ')').join(', ') 
  : 'None yet - they auto-create on first use!'}
- Forms: ${backendContext.formSubmissionsCount} submissions
- Uploads: ${backendContext.uploadsCount} files
- Users: ${backendContext.siteUsersCount} registered

${backendContext.hasShopSetup ? `=== 🛒 E-COMMERCE (ACTIVE) ===
Products: ${backendContext.productsCount || 0} items${backendContext.products && backendContext.products.length > 0 ? `
Sample: ${backendContext.products.slice(0, 5).map(p => p.name + ' ($' + p.price + ')').join(', ')}` : ''}
Orders: ${backendContext.ordersCount || 0}

**EXACT API CONTRACTS (copy-paste ready):**
GET products:  { projectId: "{{PROJECT_ID}}", action: "collection/products" }
Add to cart:   { projectId: "{{PROJECT_ID}}", action: "cart/add", data: { sessionId: "guest-xxx", item: { id, name, price, quantity } } }
View cart:     { projectId: "{{PROJECT_ID}}", action: "cart/get", data: { sessionId: "guest-xxx" } }
Create order:  { projectId: "{{PROJECT_ID}}", action: "order/create", data: { items: [...], buyerInfo: { name, email, phone }, totalAmount: 99.99 } }
` : `=== 🛒 E-COMMERCE (Ready to Activate) ===
No products yet. When user wants a shop:
1. Generate beautiful product grid with loading/empty states
2. Fetch from: { projectId, action: "collection/products" }
3. Show CTA: "Add products in Backend → Shop → Inventory"
`}

${backendContext.hasBookingsSetup ? `=== 📅 BOOKINGS (ACTIVE) ===
Services: ${backendContext.servicesCount || 0}${backendContext.services && backendContext.services.length > 0 ? `
Available: ${backendContext.services.slice(0, 5).map(s => s.name + ' (' + s.duration + 'min, $' + s.price + ')').join(', ')}` : ''}
Bookings: ${backendContext.bookingsCount || 0}

**EXACT API CONTRACTS (copy-paste ready):**
GET services:      { projectId: "{{PROJECT_ID}}", action: "collection/services" }
Check availability: { projectId: "{{PROJECT_ID}}", action: "booking/check", data: { date: "2025-01-15", startTime: "10:00" } }
Create booking:    { projectId: "{{PROJECT_ID}}", action: "booking/create", data: { serviceName: "Haircut", date: "2025-01-15", startTime: "10:00", customerInfo: { name, email, phone } } }
` : `=== 📅 BOOKINGS (Ready to Activate) ===
No services yet. When user wants appointments:
1. Generate booking form with date/time picker
2. Fetch services from: { projectId, action: "collection/services" }
3. Show CTA: "Add services in Backend → Bookings → Services"
`}

=== 🔐 USER AUTH (Built-in) ===
**EXACT API CONTRACTS:**
Signup: { projectId: "{{PROJECT_ID}}", action: "auth/signup", data: { email, password, name } }
Login:  { projectId: "{{PROJECT_ID}}", action: "auth/login", data: { email, password } }
Me:     { projectId: "{{PROJECT_ID}}", action: "auth/me", data: { token: "..." } }

=== 💬 CUSTOMER ENGAGEMENT ===
**EXACT API CONTRACTS:**
Submit form:   { projectId: "{{PROJECT_ID}}", action: "submit", formName: "contact", data: { name, email, message } }
Add review:    { projectId: "{{PROJECT_ID}}", action: "collection/reviews", data: { rating: 5, text: "Great!", authorName: "John" } }
Save customer: { projectId: "{{PROJECT_ID}}", action: "collection/customer_data", data: { customerName, email, notes } }

${(backendContext.chatRoomsCount || 0) > 0 || (backendContext.commentsCount || 0) > 0 ? `=== 💬 SOCIAL (Active) ===
Chat Rooms: ${backendContext.chatRoomsCount || 0} | Comments: ${backendContext.commentsCount || 0}
` : ''}

=== 🎨 UI FREEDOM (Build Any "House") ===
The foundation is set. Now build whatever the user wants:
- **Bento Grids:** Use Tailwind grid-cols-2/3/4 with varying spans
- **Glassmorphism:** backdrop-blur-xl bg-white/5 border-white/10
- **Gradients:** bg-gradient-to-r from-purple-500 to-pink-500
- **Animations:** framer-motion for everything
- **Custom Layouts:** Split screens, asymmetric grids, magazine layouts

=== ⚡ GOLDEN RULES ===
1. **ALWAYS fetch from API** - Never hardcode products/services/data
2. **ALWAYS show loading states** - Skeleton loaders while fetching
3. **ALWAYS handle empty states** - Beautiful CTAs when no data
4. **ALWAYS use {{PROJECT_ID}}** - It's auto-injected, just use it
5. **NEVER guess API formats** - Use the EXACT contracts above
` : '';

  const userMessage = `CURRENT CODEBASE:
${fileContext}
${imageContext}${uploadedAssetsContext}${backendContextStr}${screenshotAnchorsContext}
USER REQUEST:
${userPrompt}

${userInstructions ? `ADDITIONAL INSTRUCTIONS:\n${userInstructions}\n\n` : ""}
Implement this request. Return the FULL content of every file that needs to be modified or created.
Return ONLY a valid JSON object with the structure shown in the system prompt.`;

  // Use vision-capable model if images are provided
  const text = await callGemini25ProWithImages(systemPrompt, userMessage, images, true);
  
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

async function callGeminiMissingFiles(
  missingPaths: string[],
  changedFiles: Record<string, string>,
  existingFiles: Record<string, string>,
  originalUserPrompt: string
): Promise<Record<string, string>> {
  const model = 'gemini-2.0-flash'; // Optimized for speed/cost

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

OUTPUT FORMAT (STRICT JSON):
{
  "/components/Example.jsx": "import React from 'react';\\n..."
}`;

  const userMsg = `The project update referenced files that do not exist.

MISSING FILES (return these exact paths):\n${missingPaths.join('\n')}

CONTEXT:\n${filesStr}\n\nORIGINAL REQUEST:\n${originalUserPrompt}`;

  console.log(`[Gemini Missing Files] Generating ${missingPaths.length} missing files using ${model}`);

  const text = await callGeminiWithModel(model, systemPrompt, userMsg, true);
  
  const parsed = JSON.parse(text);
  const filesObj = (parsed && typeof parsed === 'object') ? (parsed as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filesObj)) {
    if (typeof v !== 'string') continue;
    out[normalizeFilePath(k)] = v;
  }

  return out;
}

async function _callGeminiFlashLite(systemPrompt: string, userPrompt: string): Promise<string> {
  return await callGeminiWithModel('gemini-2.5-flash-lite', systemPrompt, userPrompt, false);
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

### REACT ROUTER RULES (CRITICAL - PREVENTS CRASHES)
If you MUST use react-router-dom (Link, Route, Routes, useNavigate, useLocation, useParams):
1. **ALWAYS wrap App with BrowserRouter** - Either in index.js OR inside App.js itself
2. **NEVER call useLocation/useNavigate outside Router context** - These hooks MUST be inside a component wrapped by BrowserRouter
3. **PREFERRED PATTERN**: Keep Router inside App.js to avoid context issues:
   \`\`\`jsx
   // App.js - SAFE pattern
   import { BrowserRouter, Routes, Route } from 'react-router-dom';
   
   function AppContent() {
     const location = useLocation(); // Safe - inside Router
     return <div>...</div>;
   }
   
   export default function App() {
     return (
       <BrowserRouter>
         <AppContent />
       </BrowserRouter>
     );
   }
   \`\`\`
4. **AVOID**: Putting BrowserRouter in index.js and useLocation in App.js top-level - this can cause race conditions in Sandpack.

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

### PART 6: STOCK IMAGES (FREEPIK API - MANDATORY)
**⚠️ NEVER use placeholder URLs like picsum, unsplash, or via.placeholder!**

For EVERY image in your code, you MUST use the Freepik API to get real stock photos.
Generate a utility function that fetches images from Freepik:

\`\`\`jsx
// In your App.js or a utils file, add this helper:
const BACKEND_URL = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api";

const fetchStockImages = async (query, limit = 5) => {
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '{{PROJECT_ID}}',
        action: 'freepik/images',
        data: { query, limit }
      })
    });
    const data = await res.json();
    return data.images?.map(img => img.url) || [];
  } catch (err) {
    console.error('Failed to fetch images:', err);
    return [];
  }
};

// Usage in component:
const [heroImage, setHeroImage] = useState('');
useEffect(() => {
  fetchStockImages('barber shop interior').then(imgs => setHeroImage(imgs[0] || ''));
}, []);
\`\`\`

**IMAGE QUERY EXAMPLES BY BUSINESS TYPE:**
- Barber shop: "barber shop interior", "haircut styles", "barber chair", "men grooming"
- Restaurant: "restaurant interior", "food plating", "chef cooking"
- Fitness: "gym equipment", "personal training", "fitness class"
- Salon: "beauty salon", "hair styling", "nail art"
- Real estate: "modern house exterior", "luxury apartment", "home interior"

**RULES:**
1. Query MUST match the business context (not generic "business" or "team")
2. Use different queries for different sections (hero, about, services, etc.)
3. NEVER hardcode image URLs - always fetch from Freepik API
4. Show loading skeleton while images load

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

### PART 8: BOOKING/APPOINTMENT SYSTEM
When the user asks for booking, appointments, scheduling (barber, salon, spa, clinic, etc.):

\`\`\`jsx
const BACKEND_URL = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api";

// Booking form state
const [booking, setBooking] = useState({ 
  name: '', email: '', phone: '', 
  service: '', date: '', time: '', notes: '' 
});
const [loading, setLoading] = useState(false);
const [success, setSuccess] = useState(false);

const handleBooking = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '{{PROJECT_ID}}',
        action: 'booking/create',
        data: {
          serviceName: booking.service,
          date: booking.date,
          startTime: booking.time,
          customerInfo: { name: booking.name, email: booking.email, phone: booking.phone },
          notes: booking.notes
        }
      })
    });
    if (res.ok) {
      setSuccess(true);
      setBooking({ name: '', email: '', phone: '', service: '', date: '', time: '', notes: '' });
    }
  } catch (err) {
    console.error('Booking failed:', err);
  } finally {
    setLoading(false);
  }
};
\`\`\`

BOOKING UI REQUIREMENTS:
- Multi-step form: 1) Select Service → 2) Pick Date/Time → 3) Enter Details
- Show service cards with name, duration, and price
- Date picker with available dates highlighted
- Time slots grid showing available times
- Summary panel showing selected service, date, time before confirmation
- Success animation after booking confirmed

### CRITICAL: NO SUPABASE CLIENT IN USER PROJECTS
1. NEVER import or use @supabase/supabase-js in generated user projects.
2. NEVER add supabaseUrl or supabaseAnonKey to frontend code.
3. ALWAYS use the project-backend-api endpoint for products, items, orders, cart, forms, and data.
4. If the user asks for a shop/products/items page, fetch via project-backend-api with projectId.
`;

// Foundation bricks: pre-configured backend building blocks (not limiting templates)
const FOUNDATION_BRICKS = [
  // E-commerce core
  'products',
  'categories',
  'orders',
  'cart_items',

  // Services core
  'services',
  'bookings',

  // Customer engagement
  'messages',
  'comments',
  'reviews',        // NEW: Social proof, ratings, testimonials
  'forms',          // NEW: Contact forms, quote requests
  'customer_data',  // NEW: Preferences, notes, history

  // Infrastructure
  'users',
  'items'
];

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const GEMINI_EXECUTE_SYSTEM_PROMPT = `You are a Senior React Engineer who ACTUALLY IMPLEMENTS what users ask for.

🚨 CRITICAL: DO WHAT THE USER ASKS. If they want colors, add colors. If they want animations, add animations. If they want gradients, add gradients. NO EXCUSES.

### SCREENSHOT ANALYSIS (CRITICAL - READ FIRST)
When the user attaches a screenshot:
1. **ANALYZE THE IMAGE FIRST** - Identify exactly what UI element/section is visible
2. **MATCH TO CODE** - Find the EXACT component/section in the codebase that matches what's shown
3. **VERIFY BEFORE ACTING** - Do NOT guess. If the screenshot shows "Get In Touch" section, find that exact text in the code
4. **FOLLOW EXACT REQUEST** - If user says "remove this section", remove the EXACT section shown in the screenshot, not a different one

### IMPORTANT: DO NOT INVENT TEXT FROM SCREENSHOTS
- The user's typed message is the SOURCE OF TRUTH (e.g., "remove this section").
- The screenshot is ONLY a locator to identify WHICH section they mean.
- Do NOT fabricate quoted strings like "Click me" from OCR/guessing.
- Only reference text that is CLEARLY visible AND RELEVANT (e.g., headings/buttons like "Get In Touch", "Contact Me").
- If you cannot confidently identify a matching section in code, do NOT guess or ask for unrelated clarification.
- In removal requests, prefer matching by the MOST UNIQUE visible anchor first:
  1) Section heading text
  2) Unique button labels within that section
  3) Nearby nav link labels if it clearly maps to that section

🚨 COMMON MISTAKE TO AVOID:
- User shows screenshot of "Get In Touch" section and says "remove this"
- ❌ WRONG: Remove "Our Commitment" section (different section!)
- ✅ CORRECT: Remove the "Get In Touch" section that matches the screenshot

**HOW TO IDENTIFY THE CORRECT SECTION:**
1. Look at the screenshot - note the exact text, buttons, layout
2. Search the codebase for that exact text (e.g., "Get In Touch", "Contact Me")
3. Remove/modify ONLY that matching code block
4. If you can't find an exact match, tell the user - don't guess

### YOUR JOB
1. READ the user's request carefully
2. If screenshot attached, ANALYZE it to identify the exact element
3. IMPLEMENT exactly what they asked for - don't be conservative
4. Return FULL FILE REWRITES (no patches, no diffs)

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
3. Only TEXT should be inside text-transparent bg-clip-text spans - separate icons from them

### WAKTI BACKEND API (OPTIONAL - USE WHEN USER NEEDS BACKEND FEATURES)
The project has access to a simple backend API. Use it when users need:
- Contact forms / Newsletter signups
- Dynamic data (products, blog posts, testimonials, etc.)
- File uploads
- Simple user authentication for their site

**API Endpoint:** https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

**FOUNDATION BRICKS (ALWAYS AVAILABLE):**
- Collections you can use anytime: ${FOUNDATION_BRICKS.join(', ')}
- You may create new collections if the user asks for something else

**⚠️ CRITICAL - PROJECT ID:**
- The projectId placeholder is: {{PROJECT_ID}}
- It will be AUTO-REPLACED with the real project ID after generation
- DO NOT extract IDs from image URLs, storage paths, or any other source!
- NEVER use user_id as projectId - they are different!

**1. Form Submission (Contact/Newsletter):**
\`\`\`javascript
const submitForm = async (formData) => {
  const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: '{{PROJECT_ID}}', // AUTO-INJECTED - do not change
      action: 'submit',
      formName: 'contact', // or 'newsletter'
      data: formData
    })
  });
  return response.json();
};
\`\`\`

**2. Fetch Collection Data (Products, Blog Posts, etc.):**
\`\`\`javascript
const getProducts = async () => {
  const response = await fetch(
    'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api' +
    '?projectId={{PROJECT_ID}}&action=collection/products'
  );
  // Returns: { items: [{ id, data, created_at, ... }] }
  const data = await response.json();
  return data.items;
};
\`\`\`

**3. Create Collection Item:**
\`\`\`javascript
const createProduct = async (productData) => {
  const response = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: '{{PROJECT_ID}}', // AUTO-INJECTED - do not change
      action: 'collection/products',
      data: productData
    })
  });
  return response.json();
};
\`\`\`

**4. PRODUCTS PAGE TEMPLATE (USE THIS EXACT PATTERN):**
When creating a products/shop page, ALWAYS fetch from the backend API. NEVER use placeholder data.
\`\`\`jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Loader2 } from 'lucide-react';

const BACKEND_URL = 'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api';
const PROJECT_ID = '{{PROJECT_ID}}'; // AUTO-INJECTED

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(
          BACKEND_URL + '?projectId=' + PROJECT_ID + '&action=collection/products'
        );
        const data = await response.json();
        // project-backend-api returns: { items: [{ id, data }] }
        if (data && Array.isArray(data.items)) {
          setProducts(data.items);
        } else {
          setError('Failed to load products');
        }
      } catch (err) {
        setError('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;
  if (products.length === 0) return <div className="text-center py-20">No products available</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Our Products</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product, index) => (
          <motion.div
            key={product.id || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
          >
            {product.data?.image_url && (
              <img src={product.data.image_url} alt={product.data?.name} className="w-full h-48 object-cover" />
            )}
            <div className="p-4">
              <h3 className="text-lg font-semibold">{product.data?.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{product.data?.description}</p>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xl font-bold">{product.data?.price}</span>
                <button className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Add to Cart
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
\`\`\`

🚨 CRITICAL: When user asks for products page:
- ALWAYS use the template above
- ALWAYS fetch from backend API (not hardcoded data)
- ALWAYS display product.image_url, product.name, product.description, product.price
- NEVER show "No description available" or "Price: $N/A" placeholders

Only use the backend API when users explicitly ask for backend functionality like forms, data storage, or authentication.
Do NOT add backend calls unless the user requests it.`;

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

// ============================================================================
// THE FIXER - Claude Opus 4 for final auto-fix attempt
// ============================================================================
// When Gemini fails 3 times, The Fixer gets one shot with full context
// Uses Claude claude-sonnet-4-5-20250929 (best coding model) with streaming
// ============================================================================

const FIXER_SYSTEM_PROMPT = `You are THE FIXER - an elite debugging AI called in when other attempts have failed.

## YOUR MISSION
Previous auto-fix attempts (using a weaker model) have FAILED. You are the last resort before the user sees a recovery screen. You MUST fix this error.

## YOUR APPROACH
1. **UNDERSTAND** - Read the error carefully. What is the ROOT CAUSE?
2. **INVESTIGATE** - Use tools to read the broken file(s) and understand the current state
3. **DIAGNOSE** - Why did previous fixes fail? What did they miss?
4. **FIX** - Apply a CORRECT fix using search_replace
5. **VERIFY** - Confirm the fix is syntactically correct

## CRITICAL RULES
- You have ONE SHOT. Make it count.
- Read the file BEFORE editing. Copy EXACT code for search_replace.
- Fix the ROOT CAUSE, not symptoms.
- For syntax errors: check brackets, braces, JSX tags, imports.
- For undefined errors: add missing imports or definitions.
- NEVER guess. ALWAYS read first.

## TOOLS AVAILABLE
- grep_search: Find code in files
- read_file: Read file contents
- list_files: See project structure
- search_replace: Edit existing code
- task_complete: Call when done with summary

## OUTPUT
After fixing, call task_complete with:
- What was broken
- What you fixed
- Why previous attempts failed`;

async function callClaudeOpus4Fixer(
  systemPrompt: string, 
  userPrompt: string,
  tools: any[]
): Promise<{ content: string; toolCalls?: any[] }> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

  console.log(`[THE FIXER] Claude claude-sonnet-4-5-20250929 activated - Final auto-fix attempt`);

  // Convert Gemini-style tools to Claude format
  const claudeTools = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties: tool.parameters?.properties || {},
      required: tool.parameters?.required || []
    }
  }));

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 
      'x-api-key': ANTHROPIC_API_KEY, 
      'anthropic-version': '2023-06-01', 
      'content-type': 'application/json' 
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 16384,
      stream: true,
      system: systemPrompt,
      tools: claudeTools,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text();
    console.error(`[THE FIXER] HTTP ${anthropicResponse.status}: ${errText}`);
    throw new Error(`Claude Fixer API error: ${anthropicResponse.status}`);
  }

  // Read streaming response
  const reader = anthropicResponse.body?.getReader();
  if (!reader) throw new Error("No response body from Claude Fixer");

  const decoder = new TextDecoder();
  let fullContent = "";
  let toolCalls: any[] = [];
  let currentToolUse: any = null;
  let toolInputJson = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const event = JSON.parse(jsonStr);
          
          // Handle text content
          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullContent += event.delta.text;
          }
          
          // Handle tool use start
          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: {}
            };
            toolInputJson = "";
          }
          
          // Handle tool input delta
          if (event.type === 'content_block_delta' && event.delta?.partial_json) {
            toolInputJson += event.delta.partial_json;
          }
          
          // Handle tool use end
          if (event.type === 'content_block_stop' && currentToolUse) {
            try {
              currentToolUse.input = JSON.parse(toolInputJson);
            } catch {
              currentToolUse.input = {};
            }
            toolCalls.push(currentToolUse);
            currentToolUse = null;
            toolInputJson = "";
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  console.log(`[THE FIXER] Response complete. Content: ${fullContent.length} chars, Tool calls: ${toolCalls.length}`);

  return { content: fullContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
}

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
    const uploadedAssets = Array.isArray(body.uploadedAssets) ? body.uploadedAssets : [];
    const backendContext = body.backendContext;
    const debugContext = body.debugContext;  // NEW: Captured errors from preview
    
    // Build debug context section for prompts (OPTION B: Smart Error Context)
    const debugContextStr = debugContext && (debugContext.errors?.length > 0 || debugContext.networkErrors?.length > 0) ? `

### 🔴 DEBUG CONTEXT - ERRORS DETECTED IN PREVIEW
The preview is showing errors that MUST be fixed. This is auto-fix attempt ${debugContext.autoFixAttempt || 1} of ${debugContext.maxAutoFixAttempts || 3}.

**Runtime Errors (${debugContext.errors?.length || 0}):**
${debugContext.errors?.slice(-5).map((e, i) => `
${i + 1}. [${e.type}] ${e.message}
   ${e.file ? `File: ${e.file}${e.line ? `:${e.line}` : ''}` : ''}
   ${e.stack ? `Stack: ${e.stack.split('\\n').slice(0, 3).join('\\n')}` : ''}
`).join('') || 'None'}

**Network Errors (${debugContext.networkErrors?.length || 0}):**
${debugContext.networkErrors?.slice(-3).map((e, i) => `
${i + 1}. ${e.method} ${e.url} → ${e.status} ${e.statusText}
`).join('') || 'None'}

🚨 **CRITICAL INSTRUCTION**: You MUST fix these errors in your response. The previous code had bugs that broke the preview. Analyze the errors above and ensure your code changes resolve them.
` : '';
    
    // Build uploaded assets section for prompts
    const uploadedAssetsStr = uploadedAssets.length > 0 
      ? `\n\n### 📁 USER UPLOADED ASSETS (Available for use in the project)
These files have been uploaded by the user to their backend storage. You can use them directly in the code:
${uploadedAssets.map((a: UploadedAsset, i: number) => `${i + 1}. **${a.filename}** (${a.file_type || 'file'}): \`${a.url}\``).join('\n')}

${uploadedAssets.length > 1 
  ? `⚠️ IMPORTANT: If the user says "my photo", "my image", "uploaded image" without specifying which one, you MUST ask them to choose by returning this JSON:
{
  "type": "asset_picker",
  "message": "Which image would you like me to use?",
  "originalRequest": "[the user's original request]",
  "assets": [${uploadedAssets.map((a: UploadedAsset) => `{ "filename": "${a.filename}", "url": "${a.url}", "file_type": "${a.file_type || 'file'}" }`).join(', ')}]
}

Only return the asset_picker JSON if:
1. User mentions "my photo/image" generically AND
2. There are multiple uploaded assets AND
3. User didn't specify which file by name

If user says "use image-196.png" or specifies a filename, use that specific file directly.` 
  : `When the user refers to "my photo", "my image", "uploaded image", "profile picture", etc., use this URL: ${uploadedAssets[0]?.url}`}

Example usage: <img src="${uploadedAssets[0]?.url || 'URL_HERE'}" alt="User uploaded image" />`
      : '';

    // Build backend context section for prompts
    const backendContextStr = backendContext?.enabled ? `

### 🗄️ PROJECT BACKEND STATUS (Your project has a backend!)
The backend is **ENABLED** for this project. Here's what's available:

**Current Data:**
- 📊 **Collections:** ${backendContext.collections.length > 0 
  ? backendContext.collections.map(c => `${c.name} (${c.itemCount} items)`).join(', ') 
  : 'None created yet'}
- 📝 **Form Submissions:** ${backendContext.formSubmissionsCount} received
- 📤 **Uploaded Files:** ${backendContext.uploadsCount} files
- 👥 **Site Users:** ${backendContext.siteUsersCount} registered

**FOUNDATION BRICKS (ALWAYS AVAILABLE):**
- Collections you can use anytime: ${FOUNDATION_BRICKS.join(', ')}
- You may create new collections if the user asks for something else

${backendContext.hasShopSetup ? `**=== E-COMMERCE (ACTIVE) ===**
- Products: ${backendContext.productsCount || 0} items${backendContext.products && backendContext.products.length > 0 ? `
- Sample products: ${backendContext.products.slice(0, 5).map(p => `${p.name} ($${p.price})`).join(', ')}` : ''}
- Orders: ${backendContext.ordersCount || 0}` : ''}

${backendContext.hasBookingsSetup ? `**=== BOOKINGS (ACTIVE) ===**
- Services: ${backendContext.servicesCount || 0}${backendContext.services && backendContext.services.length > 0 ? `
- Available services: ${backendContext.services.slice(0, 5).map(s => `${s.name} (${s.duration}min, $${s.price})`).join(', ')}` : ''}
- Bookings: ${backendContext.bookingsCount || 0}` : ''}

**API Endpoint:** https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

**⚠️ CRITICAL - PROJECT ID (USE THIS EXACT VALUE):**
The projectId for ALL API calls is: **${projectId}**
DO NOT extract project IDs from image URLs or storage paths! Always use exactly: "${projectId}"

**Available Actions:**
1. **Form Submission:** POST { projectId: '${projectId}', action: 'submit', formName: 'contact', data: {...} }
2. **Get Collection:** GET ?projectId=${projectId}&action=collection/{name}
3. **Create Item:** POST { projectId: '${projectId}', action: 'collection/{name}', data: {...} }
4. **File Upload:** User can upload files via Backend Dashboard → Uploads tab

**CRITICAL SAFETY RULES (MUST FOLLOW):**
- ✅ Use ONLY this projectId: "${projectId}" (never hardcode any other ID)
- ✅ If you add product creation, show a success CTA: "Manage stock in Backend → Shop → Inventory"
- ✅ Use a safe API call (fetch or supabase.functions.invoke) with Content-Type: application/json

When user asks to "add products", "create blog posts", "store data", etc., use the collection API.
When user asks for "contact form", "newsletter", use the form submission API.
` : '';


    // CHAT MODE: Smart Q&A - answers questions OR returns a plan if code changes are needed
    // Now with SMART MODEL SELECTION + CONTEXT OPTIMIZATION (file names only, not content)
    if (mode === 'chat') {
      const currentFiles = body.currentFiles || {};
      const fileCount = Object.keys(currentFiles).length;
      
      // 🚀 CONTEXT OPTIMIZATION: Send only file NAMES, not content (reduces tokens by 90%+)
      const fileList = Object.keys(currentFiles).join('\n');
      const filesStr = `📁 Project Structure (${fileCount} files - names only for efficiency):
${fileList}

⚠️ Note: For detailed code analysis or edits, use Agent mode which can read specific files on-demand.`;
      
      // Smart model selection for chat mode
      const hasImages = Array.isArray(images) && images.length > 0;
      const chatModelSelection = selectOptimalModel(prompt, hasImages, 'chat', fileCount);
      console.log(`[Chat Mode] Model selected: ${chatModelSelection.model} (${chatModelSelection.tier}) - ${chatModelSelection.reason}`);
      
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
      
      console.log(`[Chat Mode] Has images: ${hasImages}, count: ${hasImages ? images.length : 0}`);
      
      // Build asset picker priority section - MUST be checked FIRST
      const assetPickerPriorityStr = uploadedAssets.length > 1 
        ? `
🚨🚨🚨 PRIORITY 1 - ASSET SELECTION CHECK (CHECK THIS FIRST!) 🚨🚨🚨

BEFORE doing ANYTHING else, check these conditions:
1. Does the user mention "my photo", "my image", "uploaded image", "profile picture", "my picture", "صورتي", "الصورة" WITHOUT specifying a filename?
2. Are there MULTIPLE uploaded assets available? (YES - there are ${uploadedAssets.length} files)

Available uploaded files:
${uploadedAssets.map((a: UploadedAsset, i: number) => `${i + 1}. ${a.filename}`).join('\n')}

IF BOTH CONDITIONS ARE TRUE → You MUST return ONLY this JSON (nothing else, no text before or after):
{
  "type": "asset_picker",
  "message": "Which image would you like me to use?",
  "originalRequest": "[copy the user's exact request here]",
  "assets": [${uploadedAssets.map((a: UploadedAsset) => `{"filename":"${a.filename}","url":"${a.url}","file_type":"${a.file_type || 'file'}"}`).join(',')}]
}

SKIP asset_picker ONLY IF:
- User specifies a filename like "use ${uploadedAssets[0]?.filename}" or mentions a specific file
- User is asking a pure question (not requesting any change)

EXAMPLE - RETURN ASSET_PICKER:
User: "Use my photo as the profile picture" → Return asset_picker JSON
User: "Add my image to the hero section" → Return asset_picker JSON
User: "استخدم صورتي في الخلفية" → Return asset_picker JSON

EXAMPLE - DON'T RETURN ASSET_PICKER:
User: "Use ${uploadedAssets[0]?.filename} as the profile picture" → Use that specific file
User: "What does useState do?" → Answer the question

`
        : '';

      // Build enhanced prompt for attached images
      const attachedImagesContext = hasImages ? `
🖼️ ATTACHED IMAGES HANDLING (CRITICAL):
The user has attached ${(images as unknown as string[]).length} image(s) directly to this message.

🎨 COLOR/STYLE INSPIRATION MODE (CHECK FIRST!):
If user says ANY of these phrases, ONLY extract colors/style - do NOT embed the image:
- "use colors for inspiration", "colors only", "color palette", "color scheme"
- "inspired by", "get colors from", "match the colors", "use these colors"
- "للإلهام", "استخدم الألوان", "لون فقط", "الألوان"
- "style inspiration", "design inspiration"

When in COLOR INSPIRATION mode:
1. Analyze the image to identify dominant colors (e.g., "#AF1E2D red", "#192168 navy blue")
2. Apply those EXACT colors to the design using CSS variables or inline styles
3. DO NOT use the image URL anywhere in the code
4. DO NOT embed or display the image
5. ONLY update color values to match what you see in the image

Example: User uploads Montreal Canadiens logo + says "use colors for inspiration"
→ Extract: primary red (#AF1E2D), navy blue (#192168), white (#FFFFFF)
→ Apply these colors to backgrounds, text, buttons, etc.
→ NEVER add the logo image to the code

RULES FOR DIRECT IMAGE USE (only if NOT inspiration mode):
1. If user says "use this as background" → Set the attached image as CSS background
2. If user says "create a carousel/gallery/slider" → Use ALL attached images in a carousel
3. If user says "add to hero/banner" → Use the attached image in the hero section
4. If user says "use as logo/icon" → Use as an <img> tag with appropriate sizing
5. NEVER ask "which image?" when images are already attached - just USE them

Attached Image URLs (use ONLY if NOT inspiration mode):
${(images as unknown as string[]).filter((img: string) => !img.startsWith('[PDF:')).map((img: string, i: number) => `${i + 1}. ${img.startsWith('http') ? img : '[base64-image-' + (i + 1) + ']'}`).join('\n')}
` : '';

      const chatSystemPrompt = `You are a helpful AI assistant for a React code editor. You help users with their projects.
${assetPickerPriorityStr}${attachedImagesContext}${hasImages && !attachedImagesContext.includes('ATTACHED') ? '\n🖼️ SCREENSHOT ANALYSIS MODE: The user has attached screenshot(s). Analyze them carefully and implement what you see or what the user asks based on the visual.\n' : ''}
🚨 PRIORITY 2 - CODE CHANGE DETECTION (Only if asset_picker doesn't apply):

IS IT A CODE CHANGE REQUEST? Check for these keywords:
- "fix", "change", "add", "remove", "update", "modify", "make", "create"
- "doesn't work", "not working", "broken", "bug", "error"
- "أصلح", "غير", "أضف", "احذف", "عدل", "اجعل", "لا يعمل", "مشكلة"
- Any request implying the user wants you to DO something to the code
- If user attached a screenshot, they likely want you to recreate or modify based on it
- If user attached images + gave instructions, they want those images USED in the code

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

⚠️ CRITICAL: For ANY request that implies changing code (and asset_picker doesn't apply), return ONLY the JSON object. No explanations. No "Here's the plan". Just raw JSON starting with { and ending with }.
${backendContextStr}${uploadedAssets.length === 1 ? `

### 📁 USER UPLOADED ASSET
When the user refers to "my photo", "my image", "uploaded image", use this URL: ${uploadedAssets[0]?.url}
Example: <img src="${uploadedAssets[0]?.url}" alt="User image" />` : uploadedAssets.length > 1 ? `

### 📁 USER UPLOADED ASSETS
Files available: ${uploadedAssets.map((a: UploadedAsset) => a.filename).join(', ')}
Remember: If user doesn't specify which file, return asset_picker JSON first!` : ''}

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

      // Use smart model selection - Flash-Lite for simple Q&A, Flash for code changes, Pro for vision
      const selectedChatModel = chatModelSelection.model;
      
      // Retry logic for chat mode - up to 2 attempts with increased timeout
      let chatResponse: Response | null = null;
      let lastError: Error | null = null;
      const maxRetries = 2;
      const chatTimeout = 90000; // 90 seconds (increased from 60s)
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Chat Mode] Attempt ${attempt}/${maxRetries} with ${chatTimeout/1000}s timeout`);
          chatResponse = await withTimeout(
            fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${selectedChatModel}:generateContent`,
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
            chatTimeout,
            'GEMINI_CHAT'
          );
          break; // Success, exit retry loop
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[Chat Mode] Attempt ${attempt} failed: ${lastError.message}`);
          if (attempt < maxRetries && lastError.message.includes('TIMEOUT')) {
            console.log(`[Chat Mode] Retrying after timeout...`);
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
          } else {
            throw lastError;
          }
        }
      }
      
      if (!chatResponse) {
        throw lastError || new Error('Chat request failed after retries');
      }
      
      // Log credit usage for chat mode
      const chatInputText = chatSystemPrompt + fullPrompt + filesStr;
      let chatOutputText = '';

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error(`[Chat Mode] Gemini error: ${errorText}`);
        throw new Error(`Chat API error: ${chatResponse.status}`);
      }

      const chatData = await chatResponse.json();
      const answer = chatData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      chatOutputText = answer;
      
      // Log credit usage for chat mode
      const chatCreditUsage = logCreditUsage('chat', chatModelSelection, chatInputText, chatOutputText, projectId);
      
      // Check if the response contains a JSON (plan or asset_picker)
      const trimmedAnswer = answer.trim();
      
      // Try to extract JSON from response
      let extractedJson: string | null = null;
      let jsonType: 'plan' | 'asset_picker' | null = null;
      
      // Method 1: Direct JSON (starts with {)
      if (trimmedAnswer.startsWith('{') && trimmedAnswer.includes('"type"')) {
        if (trimmedAnswer.includes('"asset_picker"')) {
          extractedJson = trimmedAnswer;
          jsonType = 'asset_picker';
        } else if (trimmedAnswer.includes('"plan"')) {
          extractedJson = trimmedAnswer;
          jsonType = 'plan';
        }
      }
      
      // Method 2: Extract JSON from mixed content
      if (!extractedJson) {
        // Check for asset_picker first (higher priority)
        const assetPickerMatch = trimmedAnswer.match(/\{[\s\S]*"type"\s*:\s*"asset_picker"[\s\S]*\}/);
        if (assetPickerMatch) {
          extractedJson = assetPickerMatch[0];
          jsonType = 'asset_picker';
        } else {
          // Check for plan
          const planMatch = trimmedAnswer.match(/\{[\s\S]*"type"\s*:\s*"plan"[\s\S]*\}/);
          if (planMatch) {
            extractedJson = planMatch[0];
            jsonType = 'plan';
          }
        }
      }
      
      if (extractedJson && jsonType) {
        // Validate it's actually valid JSON before returning
        try {
          const parsed = JSON.parse(extractedJson);
          console.log(`[Chat Mode] Detected ${jsonType} response`);
          
          if (jsonType === 'asset_picker') {
            // Return asset_picker for frontend to show selection UI
            return new Response(JSON.stringify({ 
              ok: true, 
              assetPicker: parsed,
              mode: 'asset_picker',
              creditUsage: chatCreditUsage
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          } else {
            return new Response(JSON.stringify({ ok: true, plan: extractedJson, mode: 'plan', creditUsage: chatCreditUsage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch {
          // Invalid JSON, return as regular message
          console.log(`[Chat Mode] Failed to parse ${jsonType} JSON`);
        }
      }
      
      // Return as regular chat message with credit usage
      return new Response(JSON.stringify({ ok: true, message: answer, creditUsage: chatCreditUsage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========================================================================
    // AGENT MODE: Full autonomous agent with tool calling
    // ========================================================================
    if (mode === 'agent') {
      const agentStartTime = Date.now(); // Track duration for AI logging
      
      if (!projectId) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing projectId' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!prompt) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing prompt' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      await assertProjectOwnership(supabase, projectId, userId);
      
      // ========================================================================
      // THE FIXER MODE: Claude Opus 4 for final auto-fix attempt (attempt #4)
      // ========================================================================
      if (body.fixerMode && body.fixerContext) {
        console.log(`[THE FIXER] 🔧 Fixer Mode activated - Claude claude-sonnet-4-5-20250929 taking over`);
        console.log(`[THE FIXER] Error: ${body.fixerContext.errorMessage.substring(0, 200)}...`);
        console.log(`[THE FIXER] Previous attempts: ${body.fixerContext.previousAttempts}`);
        
        // Build Fixer context with all available information
        const fixerUserPrompt = `🔧 THE FIXER - FINAL AUTO-FIX ATTEMPT

## ERROR TO FIX:
\`\`\`
${body.fixerContext.errorMessage}
\`\`\`

## CONTEXT:
- Previous auto-fix attempts: ${body.fixerContext.previousAttempts} (all failed)
- You are the LAST RESORT before showing recovery UI to the user
${body.fixerContext.recentEdits?.length ? `- Recently edited files: ${body.fixerContext.recentEdits.join(', ')}` : ''}
${body.fixerContext.chatHistory ? `\n## RECENT CHAT HISTORY:\n${body.fixerContext.chatHistory}` : ''}

## YOUR MISSION:
1. Use read_file to see the CURRENT state of the broken file(s)
2. Understand WHY previous fixes failed
3. Apply a CORRECT fix using search_replace
4. Call task_complete when done

## PROJECT FILES:
${Object.keys(body.currentFiles || {}).join('\n') || 'Use list_files to discover files'}

REMEMBER: You have ONE SHOT. Read first, then fix correctly.`;

        try {
          // Get tools config for Claude
          const geminiTools = getGeminiToolsConfig();
          const toolsArray = geminiTools.functionDeclarations || [];
          
          // Run The Fixer with tool calling loop
          let fixerMessages: Array<{ role: string; content: any }> = [
            { role: "user", content: fixerUserPrompt }
          ];
          let fixerTaskComplete: { summary: string; filesChanged: string[] } | null = null;
          const fixerToolCallsLog: Array<{ tool: string; args: any; result: any }> = [];
          const fixerMaxIterations = 6; // Fixer gets 6 iterations max
          
          for (let fixerIter = 0; fixerIter < fixerMaxIterations; fixerIter++) {
            console.log(`[THE FIXER] Iteration ${fixerIter + 1}/${fixerMaxIterations}`);
            
            const fixerResponse = await callClaudeOpus4Fixer(
              FIXER_SYSTEM_PROMPT,
              fixerMessages.map(m => m.content).join('\n\n'),
              toolsArray
            );
            
            // Handle tool calls
            if (fixerResponse.toolCalls && fixerResponse.toolCalls.length > 0) {
              const toolResults: string[] = [];
              
              for (const toolCall of fixerResponse.toolCalls) {
                console.log(`[THE FIXER] Tool call: ${toolCall.name}`);
                
                // Execute the tool - match executeToolCall signature
                const toolCallObj = {
                  name: toolCall.name,
                  arguments: toolCall.input
                };
                const fixerDebugContext: AgentDebugContext = {
                  errors: [],
                  networkErrors: [],
                  consoleLogs: []
                };
                const result = await executeToolCall(
                  projectId,
                  toolCallObj,
                  fixerDebugContext,
                  supabase,
                  userId
                );
                
                fixerToolCallsLog.push({ tool: toolCall.name, args: toolCall.input, result });
                toolResults.push(`Tool: ${toolCall.name}\nResult: ${JSON.stringify(result).substring(0, 1000)}`);
                
                // Check for task_complete
                if (toolCall.name === 'task_complete') {
                  fixerTaskComplete = {
                    summary: toolCall.input.summary || 'Fix applied by The Fixer',
                    filesChanged: toolCall.input.filesChanged || []
                  };
                  console.log(`[THE FIXER] ✅ Task complete: ${fixerTaskComplete.summary}`);
                  break;
                }
              }
              
              if (fixerTaskComplete) break;
              
              // Add tool results to conversation
              fixerMessages.push({
                role: "assistant",
                content: fixerResponse.content + '\n\nTool calls made.'
              });
              fixerMessages.push({
                role: "user", 
                content: `Tool Results:\n${toolResults.join('\n\n')}\n\nContinue fixing or call task_complete if done.`
              });
            } else {
              // No tool calls, just text response
              console.log(`[THE FIXER] Text response: ${fixerResponse.content.substring(0, 200)}...`);
              break;
            }
          }
          
          // Return Fixer result
          const fixerDuration = Date.now() - agentStartTime;
          
          if (fixerTaskComplete) {
            return new Response(JSON.stringify({
              ok: true,
              mode: 'agent',
              fixerMode: true,
              result: {
                summary: `🔧 THE FIXER: ${fixerTaskComplete.summary}`,
                filesChanged: fixerTaskComplete.filesChanged,
                toolCalls: fixerToolCallsLog.map(tc => ({ tool: tc.tool, success: tc.result?.success !== false }))
              },
              duration: fixerDuration
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          } else {
            // Fixer also failed
            return new Response(JSON.stringify({
              ok: false,
              mode: 'agent',
              fixerMode: true,
              fixerFailed: true,
              error: 'The Fixer (Claude Opus 4) was unable to fix the error. Recovery options should be shown.',
              toolCalls: fixerToolCallsLog.map(tc => ({ tool: tc.tool, success: tc.result?.success !== false })),
              duration: fixerDuration
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch (fixerError) {
          console.error(`[THE FIXER] Error:`, fixerError);
          return new Response(JSON.stringify({
            ok: false,
            mode: 'agent',
            fixerMode: true,
            fixerFailed: true,
            error: `The Fixer encountered an error: ${fixerError instanceof Error ? fixerError.message : 'Unknown error'}`
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      
      console.log(`[Agent Mode] Starting agent loop for: ${prompt.substring(0, 100)}...`);
      
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
      
      // ====================================================================
      // STEP 1: SCREENSHOT ANALYSIS - Extract visible text anchors FIRST
      // ====================================================================
      let screenshotAnchorsContext = '';
      // Frontend sends images as string[] (base64 or URLs), not ImageAttachment[]
      const agentImages = (images as unknown as string[]) || [];
      
      if (agentImages.length > 0) {
        console.log(`[Agent Mode] Found ${agentImages.length} images, running screenshot analysis...`);
        try {
          const screenshotImages = agentImages.filter(img => 
            typeof img === 'string' && img.startsWith('data:image/')
          );
          
          if (screenshotImages.length > 0) {
            const { anchors, description } = await analyzeScreenshotForAnchors(screenshotImages);
            if (anchors.length > 0) {
              screenshotAnchorsContext = `

🎯 SCREENSHOT ANALYSIS COMPLETE:
The user attached a screenshot. I analyzed it and found these text anchors:
- Visible text: ${anchors.map(a => `"${a}"`).join(', ')}
- Section description: ${description}

⚠️ CRITICAL - USE THESE ANCHORS:
1. When user says "remove this", "change this", etc. - they mean the section with these anchors
2. Search the codebase for these EXACT strings: ${anchors.slice(0, 3).map(a => `"${a}"`).join(', ')}
3. Apply the user's request ONLY to the section containing these strings
4. Do NOT guess or invent text - use ONLY the anchors above
`;
              console.log(`[Agent Mode] Screenshot anchors: ${anchors.join(', ')}`);
            }
          }
        } catch (err) {
          console.error(`[Agent Mode] Screenshot analysis failed:`, err);
        }
      }
      
      // Build enhanced debug context for the agent
      const agentDebugContext: AgentDebugContext = {
        errors: debugContext?.errors || [],
        networkErrors: debugContext?.networkErrors || [],
        consoleLogs: debugContext?.consoleLogs || [],
        autoFixAttempt: debugContext?.autoFixAttempt,
        maxAutoFixAttempts: debugContext?.maxAutoFixAttempts
      };
      
      // Build system prompt with project ID - replace placeholder with actual project ID
      const systemPromptWithProjectId = AGENT_SYSTEM_PROMPT.replace(/\{\{PROJECT_ID\}\}/g, projectId);
      
      // ========================================================================
      // CONTEXT OPTIMIZATION: Send only file NAMES, not full content
      // Agent uses read_file tool to fetch what it needs (80% token reduction!)
      // ========================================================================
      let currentFiles = body.currentFiles || {};
      let fileList = Object.keys(currentFiles).join('\n');
      let fileCount = Object.keys(currentFiles).length;
      
      // SAFETY NET: If currentFiles is empty, fetch file list from DB
      if (fileCount === 0) {
        console.log(`[Agent Mode] WARNING: currentFiles empty, fetching from DB...`);
        const { data: dbFiles } = await supabase
          .from('project_files')
          .select('path')
          .eq('project_id', projectId);
        
        if (dbFiles && dbFiles.length > 0) {
          fileList = dbFiles.map(f => normalizeFilePath(f.path)).join('\n');
          fileCount = dbFiles.length;
          console.log(`[Agent Mode] Recovered ${fileCount} files from DB`);
        }
      }
      
      console.log(`[Agent Mode] OPTIMIZED: Sending ${fileCount} file NAMES only (not content)`);
      console.log(`[Agent Mode] Files: ${fileList.substring(0, 200)}...`);
      
      // ========================================================================
      // 🚀 CRITICAL FILES PRE-READ: Auto-read index.js and App.js for context
      // This prevents the AI from making mistakes like double BrowserRouter
      // ========================================================================
      let criticalFilesContext = '';
      const criticalPaths = ['/index.js', '/src/index.js', '/src/main.jsx', '/App.js', '/src/App.js', '/src/App.jsx'];
      
      const { data: criticalFiles } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId)
        .in('path', criticalPaths);
      
      if (criticalFiles && criticalFiles.length > 0) {
        criticalFilesContext = `\n\n📋 CRITICAL PROJECT FILES (PRE-LOADED FOR CONTEXT):\n`;
        criticalFilesContext += `⚠️ IMPORTANT: Review these files BEFORE making any routing or structure changes!\n\n`;
        
        for (const file of criticalFiles) {
          // Check for existing router setup
          const hasRouter = file.content?.includes('BrowserRouter') || file.content?.includes('HashRouter');
          const hasRoutes = file.content?.includes('<Routes') || file.content?.includes('<Route');
          const hasLink = file.content?.includes('<Link') || file.content?.includes('useNavigate');
          
          criticalFilesContext += `--- ${file.path} ---\n`;
          criticalFilesContext += `${file.content?.substring(0, 2000) || '(empty)'}\n`;
          
          if (hasRouter) {
            criticalFilesContext += `⚠️ NOTE: This file ALREADY has BrowserRouter - DO NOT add another one!\n`;
          }
          if (hasRoutes) {
            criticalFilesContext += `⚠️ NOTE: This file has Routes/Route - check existing routes before adding new ones.\n`;
          }
          if (hasLink) {
            criticalFilesContext += `⚠️ NOTE: This file uses Link/useNavigate - requires BrowserRouter wrapper.\n`;
          }
          criticalFilesContext += `\n`;
        }
        
        console.log(`[Agent Mode] 📋 Pre-loaded ${criticalFiles.length} critical files for context`);
      }
      
      // Extract inspect selection from debug context for precise element targeting
      let inspectSelectionContext = '';
      if (agentDebugContext.consoleLogs && agentDebugContext.consoleLogs.length > 0) {
        const inspectLogs = agentDebugContext.consoleLogs.filter(log => 
          log.message.includes('Element selected') || 
          log.message.includes('InspectablePreview') ||
          log.message.includes('Selected element')
        );
        if (inspectLogs.length > 0) {
          const lastInspect = inspectLogs[inspectLogs.length - 1];
          inspectSelectionContext = `
🎯 USER SELECTED ELEMENT (from Inspect Mode):
${lastInspect.message}

⚠️ CRITICAL: The user clicked on this specific element. Your changes MUST target this EXACT element.
Match the className and innerText to find it in the code.
`;
          console.log(`[Agent Mode] Inspect selection context injected: ${lastInspect.message.substring(0, 200)}...`);
        }
      }
      
      // ========================================================================
      // 🧠 OPTION B: SMART PROMPT PRE-PROCESSING
      // Enrich vague user requests with specific guidance for amateur users
      // ========================================================================
      let enrichedPrompt = prompt;
      const promptLower = prompt.toLowerCase();
      
      // Detect "title" requests and add guidance
      if (promptLower.includes('title') || promptLower.includes('heading') || promptLower.includes('عنوان')) {
        if (!promptLower.includes('section') && !promptLower.includes('card') && !promptLower.includes('قسم')) {
          enrichedPrompt += `

🎯 CLARIFICATION: When user says "title" or "heading", they mean the MAIN/PRIMARY one:
- Look for the LARGEST text (h1, or elements with text-4xl, text-5xl, text-6xl)
- Look for dynamic content like {data.name}, {user.name}, {title}, {name}
- The main title is usually in the HERO section at the top
- Do NOT change section titles, card titles, or smaller headings
- If you find MULTIPLE possible titles, you MUST ask the user which one they mean`;
        }
      }
      
      // Detect "name" requests (like "change the name color")
      if (promptLower.includes('name') || promptLower.includes('اسم')) {
        if (!promptLower.includes('file') && !promptLower.includes('variable') && !promptLower.includes('ملف')) {
          enrichedPrompt += `

🎯 CLARIFICATION: When user says "name", they likely mean a person's name displayed on the page:
- Search for {data.name}, {user.name}, {profile.name}, or similar dynamic bindings
- Look for the prominent name display (usually large text, hero section)
- Do NOT change variable names or file names unless explicitly asked`;
        }
      }
      
      // Detect color change requests
      if (promptLower.includes('color') || promptLower.includes('لون')) {
        enrichedPrompt += `

🎯 COLOR CHANGE GUIDANCE:
- First use grep_search to find the EXACT element
- Read the file to see the CURRENT color class (e.g., text-cyan-400, text-purple-900)
- Copy the EXACT current class and replace it - do NOT guess the class name
- Valid Tailwind colors: red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose (with shades 50-950)`;
      }
      
      // 🔍 Analyze edit intent to help AI understand what user wants
      const editIntent = analyzeEditIntent(enrichedPrompt);
      console.log(`[Agent Mode] Edit intent: ${editIntent.type} (confidence: ${editIntent.confidence}) - ${editIntent.description}`);
      
      // Build intent guidance based on analysis
      let intentGuidance = '';
      if (editIntent.confidence >= 0.7) {
        switch (editIntent.type) {
          case 'ADD_FEATURE':
            intentGuidance = `\n🎯 INTENT: ADD NEW FEATURE${editIntent.targetHint ? ` (${editIntent.targetHint})` : ''}\n→ You'll likely need to CREATE new files or ADD code to existing files.\n`;
            break;
          case 'FIX_ISSUE':
            intentGuidance = `\n🎯 INTENT: FIX AN ISSUE\n→ Read the relevant files first, understand the error, then make targeted fixes.\n`;
            break;
          case 'UPDATE_STYLE':
            intentGuidance = `\n🎯 INTENT: UPDATE STYLING\n→ Look for CSS classes, Tailwind utilities, or style objects to modify.\n`;
            break;
          case 'UPDATE_COMPONENT':
            intentGuidance = `\n🎯 INTENT: UPDATE EXISTING COMPONENT${editIntent.targetHint ? ` (${editIntent.targetHint})` : ''}\n→ Find and read the component file first, then make targeted edits.\n`;
            break;
          case 'QUESTION':
            intentGuidance = `\n🎯 INTENT: QUESTION (may not need edits)\n→ User might just be asking for information. Answer first, edit only if needed.\n`;
            break;
          case 'FULL_REBUILD':
            intentGuidance = `\n🎯 INTENT: FULL REBUILD\n→ User wants to start fresh. Create new files from scratch.\n`;
            break;
        }
      }
      
      // Prepare the initial user message with FILE LIST ONLY (not content)
      let userMessageContent = `📁 PROJECT FILES (${fileCount} files):
${fileList}
${criticalFilesContext}
${intentGuidance}
⚠️ IMPORTANT: Use the read_file tool to view file contents before editing.
Use list_files to see directory structure.
Use search_replace for targeted edits (preferred) or write_file for new files.
${inspectSelectionContext}
${screenshotAnchorsContext}

USER REQUEST:
${enrichedPrompt}`;
      
      // Add debug context if there are errors
      if (agentDebugContext.errors.length > 0 || agentDebugContext.networkErrors.length > 0) {
        userMessageContent += `\n\n🔴 ERRORS DETECTED - YOU MUST FIX THESE:\n`;
        
        if (agentDebugContext.errors.length > 0) {
          userMessageContent += `\n**Runtime Errors:**\n`;
          agentDebugContext.errors.slice(-5).forEach((e, i) => {
            userMessageContent += `${i + 1}. [${e.type}] ${e.message}\n`;
            if (e.file) userMessageContent += `   File: ${e.file}${e.line ? `:${e.line}` : ''}\n`;
          });
        }
        
        if (agentDebugContext.networkErrors.length > 0) {
          userMessageContent += `\n**Network Errors:**\n`;
          agentDebugContext.networkErrors.slice(-3).forEach((e, i) => {
            userMessageContent += `${i + 1}. ${e.method} ${e.url} → ${e.status} ${e.statusText}\n`;
          });
        }
      }
      
      // Agent conversation loop
      const messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }> }> = [
        { role: "user", parts: [{ text: userMessageContent }] }
      ];
      
      // 🔒 ENFORCEMENT TRACKING - Like Cascade, track what files were read/edited
      const filesRead: Set<string> = new Set();
      const filesEdited: Set<string> = new Set();
      const filesVerified: Set<string> = new Set();
      
      // 🔒 NEW: KNOWN FILES SET - Only allow edits to files that EXIST in the project
      const knownFiles: Set<string> = new Set();
      // Populate from fileList (already normalized paths)
      fileList.split('\n').filter(f => f.trim()).forEach(f => {
        const normalized = f.startsWith('/') ? f : `/${f}`;
        knownFiles.add(normalized);
      });
      console.log(`[Agent Mode] 🔒 Known files set initialized with ${knownFiles.size} files: ${[...knownFiles].slice(0, 5).join(', ')}...`);
      
      // 🔒 NEW: RENDER PATH TRACKING - Know which files are actually used
      let allFilesCache: Record<string, string> = {};
      let activeRenderPath: Set<string> = new Set();
      let renderPathComputed = false;
      
      // 🔒 ENHANCED: INTENT PARSING - Extract specific anchors from user prompt (with debugContext)
      const intentAnchors = parseIntentAnchors(prompt, agentDebugContext);
      console.log(`[Agent Mode] 🎯 Intent anchors parsed:`, JSON.stringify({
        exactTexts: intentAnchors.exactTexts,
        classNames: intentAnchors.classNames,
        dataBindings: intentAnchors.dataBindings,
        isGeneric: intentAnchors.isGenericQuery,
        isStyleRequest: intentAnchors.isStyleRequest,
        requestedColor: intentAnchors.requestedColor,
        hasInspectSelection: intentAnchors.hasInspectSelection
      }));
      
      // 🔒 PHASE 1: Early block for style changes without proper anchors
      let styleChangeBlocked = false;
      let styleBlockReason = '';
      if (intentAnchors.isStyleRequest && intentAnchors.isGenericQuery && !intentAnchors.hasInspectSelection) {
        styleChangeBlocked = true;
        styleBlockReason = intentAnchors.genericReason || 'Style change requires specific element targeting.';
        console.warn(`[Agent Mode] ⚠️ STYLE CHANGE PRE-BLOCKED: ${styleBlockReason}`);
      }
      
      // 🔒 Validate requested color if present
      let colorValidation = { valid: true, message: '' };
      if (intentAnchors.requestedColor) {
        const isValid = isValidTailwindColor(intentAnchors.requestedColor);
        if (!isValid) {
          colorValidation = { 
            valid: false, 
            message: `"${intentAnchors.requestedColor}" is not a valid Tailwind color. Use colors like: purple-900, blue-500, [#060541].`
          };
          console.warn(`[Agent Mode] ⚠️ INVALID COLOR: ${colorValidation.message}`);
        }
      }
      
      // 🔒 NEW: AMBIGUITY TRACKING - Track if agent found multiple candidates
      let grepAmbiguityDetected = false;
      let grepCandidateFiles: string[] = [];
      const grepAmbiguityMessage = '';
      const grepRequiresUserInput = false;
      const grepSuggestInspectMode = false;
      
      // 🔒 EDIT TRACKING - Track last edit for verification
      let lastEditPath: string | null = null;
      let editVerificationPending = false;
      
      // 🔒 CONTENT TRACKING - Cache content from read_file to validate search_replace
      const fileContentCache: Map<string, string> = new Map();
      
      // 🔒 NEW: Accumulated warnings for result
      const resultWarnings: string[] = [];
      
      // Increased iterations to allow for proper read-edit-verify workflow
      const maxIterations = 8; // Increased to allow for mandatory exploration + edits
      const toolCallsLog: Array<{ tool: string; args: any; result: any }> = [];
      let taskCompleteResult: { summary: string; filesChanged: string[] } | null = null;
      
      // 🔒 HARDENING: Inject mandatory exploration prompt with SMART SUGGESTIONS
      // If intent parsing found good anchors, suggest them. If generic, warn.
      let explorationGuidance = '';
      if (intentAnchors.exactTexts.length > 0) {
        explorationGuidance = `
SPECIFIC TARGETS DETECTED: Search for these exact strings first:
${intentAnchors.exactTexts.map(t => `- grep_search for "${t}"`).join('\n')}
`;
      } else if (intentAnchors.isGenericQuery) {
        explorationGuidance = `
⚠️ WARNING: Your request is GENERIC. "${intentAnchors.genericReason}"
You MUST use Inspect Mode or provide exact text content to target the right element.
`;
      }
      
      const mandatoryExplorationPrompt = `
MANDATORY FIRST STEP: Before making ANY changes or completing ANY task, you MUST:
1. Call list_files to understand the project structure
2. Call grep_search to find the relevant code for this request  
3. Call read_file on the most likely target file(s)
${explorationGuidance}
Do NOT call task_complete or respond without first exploring the codebase.
This is a HARD REQUIREMENT - the system will reject task_complete if no exploration was done.
`;
      messages.push({
        role: "user",
        parts: [{ text: mandatoryExplorationPrompt }]
      });
      console.log(`[Agent Mode] 🔒 Injected mandatory exploration prompt with intent-aware guidance`);
      
      // Smart model selection for agent mode
      const hasVisionInput = body.images && body.images.length > 0;
      // fileCount already defined above in context optimization section
      const agentModelSelection = selectOptimalModel(prompt, hasVisionInput, 'agent', fileCount);
      
      console.log(`[Agent Mode] Model selected: ${agentModelSelection.model} (${agentModelSelection.tier}) - ${agentModelSelection.reason}`);
      
      // Track total input for cost estimation
      let totalInputText = systemPromptWithProjectId + userMessageContent;
      let totalOutputText = '';
      
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        console.log(`[Agent Mode] ========== ITERATION ${iteration + 1}/${maxIterations} ==========`);
        console.log(`[Agent Mode] User prompt: ${prompt.substring(0, 500)}...`);
        
        // Call Gemini with smart model selection
        // Pro for complex/vision, Flash for standard, Flash-Lite for simple
        const geminiResponse = await withTimeout(
          fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${agentModelSelection.model}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY,
              },
              body: JSON.stringify({
                contents: messages,
                systemInstruction: { parts: [{ text: systemPromptWithProjectId }] },
                tools: [getGeminiToolsConfig()],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 8192,
                },
              }),
            }
          ),
          120000,
          'GEMINI_AGENT'
        );
        
        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error(`[Agent Mode] Gemini error: ${errorText}`);
          throw new Error(`Agent API error: ${geminiResponse.status}`);
        }
        
        const geminiData = await geminiResponse.json();
        const candidate = geminiData.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const content = candidate?.content;
        
        if (!content) {
          console.error(`[Agent Mode] No content in response`);
          break;
        }
        
        // Track output for cost estimation
        const textParts = content.parts?.filter((p: any) => p.text) || [];
        textParts.forEach((p: any) => { totalOutputText += p.text || ''; });
        
        // Add model response to messages
        messages.push({ role: "model", parts: content.parts });
        
        // Check for function calls
        const functionCalls = content.parts?.filter((p: any) => p.functionCall);
        
        if (!functionCalls || functionCalls.length === 0) {
          // No function calls, check if we got a text response
          const textPart = content.parts?.find((p: any) => p.text);
          if (textPart) {
            console.log(`[Agent Mode] Got text response (no tools): ${textPart.text.substring(0, 100)}...`);
            
            // 🚀 MORPH FAST APPLY: Check for <edit> blocks in the response
            const morphEdits = parseMorphEdits(textPart.text);
            if (morphEdits.length > 0) {
              console.log(`[Agent Mode] 🚀 Found ${morphEdits.length} <edit> blocks, applying via Morph Fast Apply...`);
              
              for (const edit of morphEdits) {
                try {
                  // Read the current file content
                  const { data: fileData } = await supabase
                    .from('project_files')
                    .select('content')
                    .eq('project_id', projectId)
                    .eq('path', edit.targetFile.startsWith('/') ? edit.targetFile : `/${edit.targetFile}`)
                    .maybeSingle();
                  
                  if (!fileData?.content) {
                    console.error(`[Morph] File not found: ${edit.targetFile}`);
                    toolCallsLog.push({
                      tool: 'morph_edit_auto',
                      args: { path: edit.targetFile },
                      result: { success: false, error: 'File not found' }
                    });
                    continue;
                  }
                  
                  // Apply via Morph Fast Apply
                  const morphResult = await morphFastApply({
                    originalCode: fileData.content,
                    codeEdit: edit.update,
                    instructions: edit.instructions,
                    filepath: edit.targetFile
                  });
                  
                  if (morphResult.success && morphResult.mergedCode) {
                    // Write the merged code back
                    const normalizedPath = edit.targetFile.startsWith('/') ? edit.targetFile : `/${edit.targetFile}`;
                    await supabase
                      .from('project_files')
                      .update({ content: morphResult.mergedCode })
                      .eq('project_id', projectId)
                      .eq('path', normalizedPath);
                    
                    console.log(`[Morph] ✅ Applied edit to ${edit.targetFile}`);
                    toolCallsLog.push({
                      tool: 'morph_edit_auto',
                      args: { path: edit.targetFile, instructions: edit.instructions },
                      result: { success: true, method: 'morph', changes: morphResult.changes }
                    });
                    
                    // Update file cache
                    fileContentCache.set(normalizedPath, morphResult.mergedCode);
                    filesRead.add(normalizedPath);
                  } else {
                    console.error(`[Morph] Failed to apply edit to ${edit.targetFile}: ${morphResult.error}`);
                    toolCallsLog.push({
                      tool: 'morph_edit_auto',
                      args: { path: edit.targetFile },
                      result: { success: false, error: morphResult.error }
                    });
                  }
                } catch (err) {
                  console.error(`[Morph] Exception applying edit to ${edit.targetFile}:`, err);
                }
              }
            }
          }
          
          // 🚀 AUTO-SEARCH FALLBACK: If model skips tools on early iterations, WE run them automatically
          // This makes the AI Coder "Cascade-like" - always searches before editing
          if (iteration <= 1 && toolCallsLog.length === 0) {
            console.log(`[Agent Mode] 🚀 AUTO-SEARCH FALLBACK: Model skipped tools, running automatic search...`);
            
            // Step 1: Get suggested grep queries from intent anchors
            const suggestedQueries = getSuggestedGrepQueries(intentAnchors);
            
            // Step 2: If no specific anchors, extract keywords from prompt
            if (suggestedQueries.length === 0) {
              const keywords = prompt.toLowerCase()
                .split(/\s+/)
                .filter(w => w.length > 3 && !['change', 'update', 'make', 'the', 'this', 'that', 'color', 'style'].includes(w));
              if (keywords.length > 0) {
                suggestedQueries.push(keywords[0]);
              }
            }
            
            // Step 3: Run automatic grep search
            let autoSearchResults: Array<{ file: string; line: number; content: string }> = [];
            let bestMatchFile: string | null = null;
            let bestMatchContent: string | null = null;
            
            if (suggestedQueries.length > 0) {
              const searchQuery = suggestedQueries[0];
              console.log(`[Agent Mode] 🔍 Auto-grep for: "${searchQuery}"`);
              
              // Get all files from project for grep
              const { data: allProjectFiles } = await supabase
                .from('project_files')
                .select('path, content')
                .eq('project_id', projectId);
              
              if (allProjectFiles) {
                const queryLower = searchQuery.toLowerCase();
                for (const file of allProjectFiles) {
                  const lines = (file.content || "").split('\n');
                  for (let i = 0; i < lines.length; i++) {
                    if (lines[i].toLowerCase().includes(queryLower)) {
                      autoSearchResults.push({
                        file: file.path,
                        line: i + 1,
                        content: lines[i].trim().substring(0, 200)
                      });
                    }
                  }
                }
                
                // Find best match file (most matches)
                const fileCounts: Record<string, number> = {};
                autoSearchResults.forEach(r => {
                  fileCounts[r.file] = (fileCounts[r.file] || 0) + 1;
                });
                const sortedFiles = Object.entries(fileCounts).sort((a, b) => b[1] - a[1]);
                if (sortedFiles.length > 0) {
                  bestMatchFile = sortedFiles[0][0];
                  // Read the best match file
                  const matchedFile = allProjectFiles.find(f => f.path === bestMatchFile);
                  if (matchedFile) {
                    bestMatchContent = matchedFile.content;
                    filesRead.add(bestMatchFile);
                    fileContentCache.set(bestMatchFile, bestMatchContent);
                    console.log(`[Agent Mode] 📖 Auto-read best match: ${bestMatchFile}`);
                  }
                }
              }
            }
            
            // Step 4: Inject auto-search results into conversation
            let autoSearchContext = `\n\n🚀 AUTO-SEARCH RESULTS (I searched for you):\n`;
            
            if (autoSearchResults.length > 0) {
              autoSearchContext += `Found ${autoSearchResults.length} matches for "${suggestedQueries[0]}":\n`;
              autoSearchResults.slice(0, 10).forEach(r => {
                autoSearchContext += `- ${r.file}:${r.line}: ${r.content.substring(0, 100)}\n`;
              });
              
              if (bestMatchFile && bestMatchContent) {
                autoSearchContext += `\n📄 BEST MATCH FILE (${bestMatchFile}):\n\`\`\`\n${bestMatchContent.substring(0, 3000)}\n\`\`\`\n`;
                autoSearchContext += `\n⚠️ IMPORTANT: Use the EXACT code from above for your search_replace. Do NOT guess or modify the search string.`;
              }
            } else {
              // No grep results - just list files
              autoSearchContext += `No specific matches found. Here are the project files:\n${fileList}\n`;
              autoSearchContext += `\nUse read_file to examine the most likely target file.`;
            }
            
            messages.push({
              role: "user",
              parts: [{
                text: autoSearchContext + `\n\nNow proceed with the user's request using the information above. Use morph_edit with '// ... existing code ...' markers - it handles fuzzy matching and is more reliable than search_replace.`
              }]
            });
            
            // Log the auto-search as a tool call
            toolCallsLog.push({ 
              tool: 'auto_search', 
              args: { query: suggestedQueries[0] || 'files' }, 
              result: { matches: autoSearchResults.length, bestFile: bestMatchFile } 
            });
            
            continue; // Continue to next iteration with the injected context
          }
          
          break;
        }
        
        // Execute function calls
        const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];
        
        for (const fc of functionCalls) {
          const { name, args } = fc.functionCall;
          
          // ========================================================================
          // DEEP LOGGING: Log every tool call with full details
          // ========================================================================
          console.log(`[Agent Mode] ========== TOOL CALL ==========`);
          console.log(`[Agent Mode] Tool: ${name}`);
          console.log(`[Agent Mode] Args: ${JSON.stringify(args, null, 2).substring(0, 2000)}`);
          
          // ========================================================================
          // 🔒 ENFORCEMENT: Read-before-edit check (like Cascade)
          // ========================================================================
          const targetPath = args?.path ? (args.path.startsWith('/') ? args.path : `/${args.path}`) : null;
          
          // ========================================================================
          // 🚀 MORPH DOCS WORKFLOW ENFORCEMENT: Search → Read → Edit → Verify
          // All edit tools (morph_edit, search_replace, write_file, insert_code)
          // ========================================================================
          const isEditTool = name === 'morph_edit' || name === 'search_replace' || name === 'write_file' || name === 'insert_code';
          
          if (isEditTool && targetPath) {
            // 🔒 HARD BLOCK: Reject edits to files that don't exist in the project (unless write_file for new file)
            const isNewFileCreation = name === 'write_file' && !knownFiles.has(targetPath);
            
            if (!knownFiles.has(targetPath) && name !== 'write_file') {
              console.error(`[Agent Mode] 🚫 BLOCKED: Attempted ${name} on "${targetPath}" which does NOT exist in project!`);
              console.error(`[Agent Mode] Known files: ${[...knownFiles].join(', ')}`);
              
              // Return error instead of executing
              const blockResult = {
                success: false,
                error: `BLOCKED: File "${targetPath}" does not exist in this project. ` +
                  `You can only edit files that exist. Available files: ${[...knownFiles].slice(0, 5).join(', ')}${knownFiles.size > 5 ? '...' : ''}`,
                hint: `Use list_files to see all project files, then edit one of those.`,
                availableFiles: [...knownFiles].slice(0, 10)
              };
              
              toolCallsLog.push({ tool: name, args, result: blockResult });
              functionResponses.push({
                functionResponse: { name, response: blockResult }
              });
              continue; // Skip to next function call
            }
            
            // If creating a new file, add it to knownFiles
            if (isNewFileCreation) {
              console.log(`[Agent Mode] 📝 New file creation: ${targetPath}`);
              knownFiles.add(targetPath);
            }
            
            // 🔒 MORPH DOCS ENFORCEMENT: MUST read_file BEFORE any edit (morph_edit, search_replace, insert_code)
            // Per Morph docs: "Always read files before editing to understand the structure"
            // This is the #1 reason for failed edits - AI doesn't know the current file state
            if (!filesRead.has(targetPath) && !isNewFileCreation && (name === 'morph_edit' || name === 'search_replace' || name === 'insert_code')) {
              console.error(`[Agent Mode] 🚫 BLOCKED: ${name} on ${targetPath} without reading first!`);
              
              const toolHint = name === 'morph_edit' 
                ? `Step 1: read_file("${targetPath}") → Step 2: Understand structure → Step 3: morph_edit with '// ... existing code ...' markers`
                : name === 'search_replace'
                ? `Step 1: read_file("${targetPath}") → Step 2: Copy EXACT code → Step 3: search_replace`
                : `Step 1: read_file("${targetPath}") → Step 2: Find insertion point → Step 3: insert_code`;
              
              const blockResult = {
                error: `BLOCKED: Per Morph docs workflow, you MUST read_file("${targetPath}") BEFORE using ${name}. ` +
                  `This ensures you understand the file structure and have accurate code to work with.`,
                hint: toolHint,
                blocked: true,
                workflow: '🔍 Search → 📖 Read → ✏️ Edit → ✅ Verify'
              };
              
              toolCallsLog.push({ tool: name, args, result: blockResult });
              functionResponses.push({
                functionResponse: { name, response: blockResult }
              });
              continue; // Skip to next function call - force AI to read first
            }
            
            // Soft warning for write_file on existing files without reading
            if (!filesRead.has(targetPath) && !isNewFileCreation && name === 'write_file') {
              console.warn(`[Agent Mode] ⚠️ WARNING: write_file on existing ${targetPath} without reading first - may overwrite important code!`);
            }
            
            // 🚀 SOFT VALIDATION REDIRECT: If search string not in target file, find the right file automatically
            if (name === 'search_replace' && args?.search && targetPath) {
              const searchString = args.search as string;
              
              // Check if we have cached content for this file
              let targetContent = fileContentCache.get(targetPath);
              
              // If not cached, try to fetch it
              if (!targetContent) {
                const { data: fileData } = await supabase
                  .from('project_files')
                  .select('content')
                  .eq('project_id', projectId)
                  .eq('path', targetPath)
                  .maybeSingle();
                if (fileData?.content) {
                  targetContent = fileData.content;
                  fileContentCache.set(targetPath, targetContent);
                }
              }
              
              // If search string NOT in target file, find the correct file
              if (targetContent && !targetContent.includes(searchString)) {
                console.warn(`[Agent Mode] 🔄 SOFT REDIRECT: Search string not found in ${targetPath}, searching all files...`);
                
                // Search all project files for the search string
                const { data: allFiles } = await supabase
                  .from('project_files')
                  .select('path, content')
                  .eq('project_id', projectId);
                
                let correctFile: string | null = null;
                if (allFiles) {
                  for (const file of allFiles) {
                    if (file.content && file.content.includes(searchString)) {
                      correctFile = file.path;
                      console.log(`[Agent Mode] 🎯 Found correct file: ${correctFile}`);
                      break;
                    }
                  }
                }
                
                if (correctFile && correctFile !== targetPath) {
                  // REDIRECT: Update the args to use the correct file
                  console.log(`[Agent Mode] 🔄 REDIRECTING edit from ${targetPath} to ${correctFile}`);
                  args.path = correctFile;
                  // Update tracking
                  filesRead.add(correctFile);
                  resultWarnings.push(`Auto-redirected edit from ${targetPath} to ${correctFile} (search string found there)`);
                } else if (!correctFile) {
                  console.error(`[Agent Mode] 🚫 Search string not found in ANY file - edit will likely fail`);
                  resultWarnings.push(`Warning: Search string not found in any project file`);
                }
              }
            }
          }
          
          const result = await executeToolCall(projectId, { name, arguments: args || {} }, agentDebugContext, supabase, userId);
          
          // ========================================================================
          // 🔒 TRACKING: Update read/edit tracking sets + ENHANCED ENFORCEMENT
          // ========================================================================
          if (name === 'read_file' && targetPath && result.content) {
            filesRead.add(targetPath);
            // Cache file content for render path computation AND search_replace validation
            allFilesCache[targetPath] = result.content;
            fileContentCache.set(targetPath, result.content);
            console.log(`[Agent Mode] 📖 Tracked read: ${targetPath} (${result.content.length} chars cached)`);
          }
          
          if (name === 'list_files' && result.files && !renderPathComputed) {
            // When we get the file list, pre-populate for render path computation
            console.log(`[Agent Mode] 📁 Got file list, will compute render path on first edit`);
          }
          
          if (name === 'grep_search' && result.matches && result.matches.length > 0) {
            // Mark all files found in grep as "read" (agent knows about them)
            result.matches.forEach((m: { file: string }) => filesRead.add(m.file));
            console.log(`[Agent Mode] 🔍 Grep found files: ${[...new Set(result.matches.map((m: { file: string }) => m.file))].join(', ')}`);
            
            // 🔒 NEW: AMBIGUITY DETECTION
            const ambiguity = detectAmbiguity(result.matches);
            if (ambiguity.isAmbiguous) {
              grepAmbiguityDetected = true;
              grepCandidateFiles = ambiguity.candidateFiles;
              console.warn(`[Agent Mode] ⚠️ AMBIGUITY DETECTED: ${ambiguity.message}`);
              // Inject warning into result
              result.ambiguityWarning = ambiguity.message;
              result.candidateFiles = ambiguity.candidateFiles;
            }
          }
          
          if ((name === 'search_replace' || name === 'write_file' || name === 'insert_code' || name === 'morph_edit') && targetPath && result.success) {
            filesEdited.add(targetPath);
            lastEditPath = targetPath;
            editVerificationPending = true;
            console.log(`[Agent Mode] ✏️ Tracked edit: ${targetPath}`);
            
            // 🔒 NEW: RENDER PATH ENFORCEMENT - Check if edited file is in active render chain
            if (!renderPathComputed && Object.keys(allFilesCache).length > 0) {
              activeRenderPath = traceRenderPath(allFilesCache);
              renderPathComputed = true;
              console.log(`[Agent Mode] 🔗 Computed render path: ${[...activeRenderPath].join(', ')}`);
            }
            
            if (renderPathComputed && !activeRenderPath.has(targetPath)) {
              console.error(`[Agent Mode] 🚫 RENDER PATH WARNING: Edited ${targetPath} is NOT in active render chain!`);
              result.renderPathWarning = `⚠️ WARNING: File "${targetPath}" is NOT imported by App.js or any active component. ` +
                `Changes to this file will have NO visible effect. Consider editing a file that IS imported, or add an import to App.js.`;
              result.activeFiles = [...activeRenderPath].slice(0, 10);
            }
            
            // 🔒 REACT ROUTER VALIDATION: Check if <Link> was added but BrowserRouter is missing
            if (targetPath.includes('App.js') || targetPath.includes('App.jsx') || targetPath.includes('App.tsx')) {
              const { data: appData } = await supabase
                .from('project_files')
                .select('content')
                .eq('project_id', projectId)
                .eq('path', targetPath)
                .maybeSingle();
              
              const { data: indexData } = await supabase
                .from('project_files')
                .select('content')
                .eq('project_id', projectId)
                .or('path.eq./index.js,path.eq./index.jsx,path.eq./index.tsx,path.eq./src/index.js,path.eq./src/index.jsx,path.eq./src/index.tsx,path.eq./src/main.jsx,path.eq./src/main.tsx')
                .maybeSingle();
              
              if (appData?.content && indexData?.content) {
                const appContent = appData.content;
                const indexContent = indexData.content;
                
                // Check if App uses react-router-dom components
                const usesRouterComponents = /\b(Link|NavLink|Route|Routes|useNavigate|useParams|useLocation)\b/.test(appContent);
                const hasBrowserRouter = /\b(BrowserRouter|HashRouter|MemoryRouter|Router)\b/.test(indexContent);
                
                if (usesRouterComponents && !hasBrowserRouter) {
                  console.error(`[Agent Mode] 🚫 REACT ROUTER ERROR: App uses router components but index.js missing BrowserRouter!`);
                  console.log(`[Agent Mode] 🔧 AUTO-FIX: Applying BrowserRouter fix automatically...`);
                  
                  // ========================================================================
                  // 🔧 AUTO-FIX: Automatically wrap App with BrowserRouter in index.js
                  // This implements Option 1 (Agent Auto-Fix) + Option 3 (Error Boundary Auto-Retry)
                  // ========================================================================
                  try {
                    // Find the index.js path
                    const { data: indexFile } = await supabase
                      .from('project_files')
                      .select('path, content')
                      .eq('project_id', projectId)
                      .or('path.eq./index.js,path.eq./index.jsx,path.eq./index.tsx,path.eq./src/index.js,path.eq./src/index.jsx,path.eq./src/index.tsx,path.eq./src/main.jsx,path.eq./src/main.tsx')
                      .maybeSingle();
                    
                    if (indexFile?.content) {
                      let fixedIndexContent = indexFile.content;
                      const indexPath = indexFile.path;
                      
                      // Check if BrowserRouter import already exists
                      if (!fixedIndexContent.includes('BrowserRouter')) {
                        // Add BrowserRouter import
                        if (fixedIndexContent.includes("from 'react-router-dom'")) {
                          // Add to existing import
                          fixedIndexContent = fixedIndexContent.replace(
                            /import\s*\{([^}]+)\}\s*from\s*['"]react-router-dom['"]/,
                            (_match, imports) => `import { BrowserRouter, ${imports.trim()} } from 'react-router-dom'`
                          );
                        } else {
                          // Add new import after React import
                          fixedIndexContent = fixedIndexContent.replace(
                            /(import\s+React.*?['"];?\n)/,
                            `$1import { BrowserRouter } from 'react-router-dom';\n`
                          );
                        }
                      }
                      
                      // Wrap <App /> with <BrowserRouter>
                      // Handle various render patterns
                      if (!fixedIndexContent.includes('<BrowserRouter>')) {
                        // Pattern 1: root.render(<App />)
                        fixedIndexContent = fixedIndexContent.replace(
                          /root\.render\(\s*<App\s*\/>\s*\)/g,
                          'root.render(<BrowserRouter><App /></BrowserRouter>)'
                        );
                        // Pattern 2: ReactDOM.render(<App />, ...)
                        fixedIndexContent = fixedIndexContent.replace(
                          /ReactDOM\.render\(\s*<App\s*\/>\s*,/g,
                          'ReactDOM.render(<BrowserRouter><App /></BrowserRouter>,'
                        );
                        // Pattern 3: render(<App />)
                        fixedIndexContent = fixedIndexContent.replace(
                          /render\(\s*<App\s*\/>\s*\)/g,
                          'render(<BrowserRouter><App /></BrowserRouter>)'
                        );
                      }
                      
                      // Save the fixed file
                      if (fixedIndexContent !== indexFile.content) {
                        const { error: updateError } = await supabase
                          .from('project_files')
                          .update({ content: fixedIndexContent, updated_at: new Date().toISOString() })
                          .eq('project_id', projectId)
                          .eq('path', indexPath);
                        
                        if (!updateError) {
                          console.log(`[Agent Mode] ✅ AUTO-FIX SUCCESS: Added BrowserRouter to ${indexPath}`);
                          result.autoFixApplied = true;
                          result.autoFixMessage = `✅ Auto-fixed: Added BrowserRouter wrapper to ${indexPath}`;
                          result.autoFixedFiles = [indexPath];
                        } else {
                          console.error(`[Agent Mode] ❌ AUTO-FIX FAILED: ${updateError.message}`);
                          result.autoFixApplied = false;
                          result.autoFixError = updateError.message;
                        }
                      }
                    }
                  } catch (autoFixError) {
                    console.error(`[Agent Mode] ❌ AUTO-FIX ERROR:`, autoFixError);
                    result.autoFixApplied = false;
                    result.autoFixError = String(autoFixError);
                  }
                  
                  // Still set the warning for visibility
                  result.routerWarning = `⚠️ Router issue detected and auto-fixed. If you still see errors, ensure useLocation/useNavigate are inside a component wrapped by BrowserRouter.`;
                  result.autoFixRequired = true;
                  result.autoFixType = 'missing-browser-router';
                }
              }
            }
          }
          
          // Log the result
          console.log(`[Agent Mode] Result: ${JSON.stringify(result, null, 2).substring(0, 1000)}`);
          console.log(`[Agent Mode] ================================`);
          
          toolCallsLog.push({ tool: name, args, result });
          functionResponses.push({
            functionResponse: { name, response: result }
          });
          
          // ========================================================================
          // 🔒 HARD ENFORCEMENT: Block task_complete with comprehensive checks
          // ========================================================================
          if (name === 'task_complete') {
            // 🔒 CHECK 1: Block if NO exploration happened at all
            const explorationCalls = toolCallsLog.filter(tc => 
              tc.tool === 'list_files' || tc.tool === 'grep_search' || tc.tool === 'read_file'
            );
            
            // Count successful edits (moved up to fix "used before declaration" error)
            const successfulEdits = toolCallsLog.filter(tc => 
              (tc.tool === 'search_replace' || tc.tool === 'write_file' || tc.tool === 'insert_code') && 
              tc.result?.success === true
            );
            
            if (explorationCalls.length === 0) {
              console.error(`[Agent Mode] 🚫 BLOCKED task_complete: NO exploration tools called!`);
              functionResponses[functionResponses.length - 1].functionResponse.response = {
                acknowledged: false,
                error: 'BLOCKED: You must explore the codebase first. Call list_files or grep_search before completing.',
                hint: 'Start with list_files to see what files exist, then grep_search to find the target code, then read_file to see it.'
              };
              continue;
            }
            
            // 🔒 CHECK 2: Block if ambiguity was detected and not resolved
            if (grepAmbiguityDetected && successfulEdits.length === 0) {
              console.error(`[Agent Mode] 🚫 BLOCKED task_complete: Ambiguity detected but not resolved!`);
              functionResponses[functionResponses.length - 1].functionResponse.response = {
                acknowledged: false,
                error: `BLOCKED: Multiple candidate files were found (${grepCandidateFiles.slice(0, 3).join(', ')}${grepCandidateFiles.length > 3 ? '...' : ''}). ` +
                  `You must clarify which file to edit. Ask the user to specify or use Inspect Mode.`,
                candidateFiles: grepCandidateFiles,
                hint: 'When multiple files match, ask the user to clarify which file they want to edit.'
              };
              continue;
            }
            
            // Check if this is an EDIT/BUILD request (user wants changes to files)
            // Expanded list: includes common request patterns like "put X in Y", "X in the header", etc.
            const isEditRequest = /\b(change|update|fix|add|remove|set|make|edit|modify|delete|replace|rename|color|style|build|create|implement|generate|write|develop|code|put|insert|include|connect|link|wire|show|display|place|move|header|menu|nav|button|page|route|routing)\b/i.test(prompt);
            
            // Also check for implicit edit patterns like "X in the Y" which implies adding something
            const isImplicitEdit = /\b(in the|to the|on the|into|onto)\b/i.test(prompt) && !/\b(what|how|why|explain|tell me|show me|describe)\b/i.test(prompt);
            
            // 🔒 CHECK 3: Block if edit request but NO successful edits
            if ((isEditRequest || isImplicitEdit) && successfulEdits.length === 0) {
              console.error(`[Agent Mode] 🚫 BLOCKED task_complete: Edit request but NO successful edits made!`);
              console.error(`[Agent Mode] Prompt: "${prompt.substring(0, 100)}..."`);
              console.error(`[Agent Mode] isEditRequest=${isEditRequest}, isImplicitEdit=${isImplicitEdit}`);
              functionResponses[functionResponses.length - 1].functionResponse.response = {
                acknowledged: false,
                error: 'BLOCKED: You claimed to complete an edit task but made NO successful edits. You MUST: 1) Use grep_search to find the code, 2) Use read_file to see the exact code, 3) Use search_replace to make the change. Try again!',
                hint: 'Use grep_search first to find where the code is, then read_file, then search_replace.'
              };
              continue;
            }
            
            // 🔒 CHECK 4: RENDER PATH ENFORCEMENT - Block if edited file is not in render chain
            if (filesEdited.size > 0 && renderPathComputed) {
              const deadFiles = [...filesEdited].filter(f => !activeRenderPath.has(f));
              if (deadFiles.length > 0 && deadFiles.length === filesEdited.size) {
                console.error(`[Agent Mode] 🚫 BLOCKED task_complete: ALL edited files are outside render path!`);
                console.error(`[Agent Mode] Dead files: ${deadFiles.join(', ')}`);
                console.error(`[Agent Mode] Active files: ${[...activeRenderPath].slice(0, 10).join(', ')}`);
                functionResponses[functionResponses.length - 1].functionResponse.response = {
                  acknowledged: false,
                  error: `BLOCKED: You edited "${deadFiles.join(', ')}" but these files are NOT imported by App.js. ` +
                    `Changes will have NO visible effect. Edit a file that IS in the active render chain: ${[...activeRenderPath].slice(0, 5).join(', ')}`,
                  activeFiles: [...activeRenderPath].slice(0, 10),
                  hint: 'Use list_files and read App.js to find which files are actually imported and rendered.'
                };
                continue;
              }
            }
            
            // 🔒 CHECK 5: PAGE ROUTING ENFORCEMENT - Block if page created but not wired up
            const isPageCreationRequest = /\b(build|create|add|make).*(page|screen|view)\b/i.test(prompt);
            if (isPageCreationRequest && successfulEdits.length > 0) {
              // Check if a page file was created (in /pages/ or /src/pages/)
              const pageFilesCreated = [...filesEdited].filter(f => 
                f.includes('/pages/') || f.includes('/Pages/') || 
                (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.tsx')) && 
                !f.includes('App.') && !f.includes('index.')
              );
              
              // Check if App.js was also modified (to add routing)
              const appJsModified = [...filesEdited].some(f => 
                f.includes('App.js') || f.includes('App.jsx') || f.includes('App.tsx')
              );
              
              if (pageFilesCreated.length > 0 && !appJsModified) {
                console.error(`[Agent Mode] 🚫 BLOCKED task_complete: Page created but NOT wired up in App.js!`);
                console.error(`[Agent Mode] Page files: ${pageFilesCreated.join(', ')}`);
                functionResponses[functionResponses.length - 1].functionResponse.response = {
                  acknowledged: false,
                  error: `BLOCKED: You created page file(s) "${pageFilesCreated.join(', ')}" but did NOT wire them up in App.js! ` +
                    `A page file without routing is USELESS - it won't load! ` +
                    `You MUST: 1) Add react-router-dom imports to App.js, 2) Import the new page component, ` +
                    `3) Add a <Route path="/..." element={<PageName />} />, 4) Add a navigation link.`,
                  pageFilesCreated,
                  hint: 'Read App.js, add BrowserRouter/Routes if missing, import your page, add a Route, and add a nav link.'
                };
                continue;
              }
              
              // Additional check: If App.js was modified, verify it has the page import
              if (pageFilesCreated.length > 0 && appJsModified) {
                // Get the latest App.js content
                const { data: appJsData } = await supabase
                  .from('project_files')
                  .select('content')
                  .eq('project_id', projectId)
                  .or('path.eq./App.js,path.eq./App.jsx,path.eq./App.tsx')
                  .maybeSingle();
                
                if (appJsData?.content) {
                  const appContent = appJsData.content;
                  const missingImports: string[] = [];
                  const missingRoutes: string[] = [];
                  
                  for (const pageFile of pageFilesCreated) {
                    // Extract component name from file path
                    const fileName = pageFile.split('/').pop()?.replace(/\.(js|jsx|tsx)$/, '') || '';
                    
                    // Check if imported
                    const importPattern = new RegExp(`import\\s+.*${fileName}`, 'i');
                    if (!importPattern.test(appContent)) {
                      missingImports.push(fileName);
                    }
                    
                    // Check if has Route
                    const routePattern = new RegExp(`<Route.*${fileName}|element=.*${fileName}`, 'i');
                    if (!routePattern.test(appContent)) {
                      missingRoutes.push(fileName);
                    }
                  }
                  
                  if (missingImports.length > 0 || missingRoutes.length > 0) {
                    console.error(`[Agent Mode] 🚫 BLOCKED task_complete: Page not fully wired up!`);
                    console.error(`[Agent Mode] Missing imports: ${missingImports.join(', ')}`);
                    console.error(`[Agent Mode] Missing routes: ${missingRoutes.join(', ')}`);
                    functionResponses[functionResponses.length - 1].functionResponse.response = {
                      acknowledged: false,
                      error: `BLOCKED: Page file created but not fully wired up! ` +
                        (missingImports.length > 0 ? `Missing imports in App.js: ${missingImports.join(', ')}. ` : '') +
                        (missingRoutes.length > 0 ? `Missing Routes in App.js: ${missingRoutes.join(', ')}. ` : '') +
                        `The page won't be accessible without proper routing!`,
                      missingImports,
                      missingRoutes,
                      hint: 'Add the import statement and Route element for each page in App.js.'
                    };
                    continue;
                  }
                }
              }
            }
            
            // 🔒 CHECK 6: POST-EDIT VERIFICATION - Confirm changes exist after editing
            if (filesEdited.size > 0 && editVerificationPending) {
              let verificationIssues: string[] = [];
              
              for (const editedFile of filesEdited) {
                // Find the last successful edit to this file
                const lastEdit = [...toolCallsLog].reverse().find(tc => 
                  (tc.tool === 'search_replace' || tc.tool === 'write_file' || tc.tool === 'insert_code') && 
                  tc.result?.path === editedFile && tc.result?.success
                );
                
                if (lastEdit) {
                  // Verify the edit by checking if file was re-read after edit
                  const editIndex = toolCallsLog.indexOf(lastEdit);
                  const verifyRead = toolCallsLog.find((tc, idx) => 
                    idx > editIndex && tc.tool === 'read_file' && tc.args?.path === editedFile
                  );
                  
                  if (!verifyRead) {
                    console.warn(`[Agent Mode] ⚠️ VERIFICATION: ${editedFile} was not re-read after edit`);
                    // Perform async verification
                    const verification = await verifyEdit(
                      editedFile, 
                      lastEdit.args?.replace || '', 
                      allFilesCache, 
                      supabase, 
                      projectId
                    );
                    
                    if (!verification.verified) {
                      verificationIssues.push(...verification.issues);
                    }
                    
                    // Update verification status
                    if (verification.fileInRenderPath) {
                      filesVerified.add(editedFile);
                    }
                  } else {
                    filesVerified.add(editedFile);
                  }
                }
              }
              
              if (verificationIssues.length > 0) {
                console.warn(`[Agent Mode] ⚠️ VERIFICATION ISSUES:`, verificationIssues);
                // Don't block, but add warnings to result
                result.verificationWarnings = verificationIssues;
              }
              
              editVerificationPending = false;
            }
            
            // All checks passed - allow task_complete
            if (result.acknowledged) {
              // Add any warnings from verification
              const warnings = [];
              if (grepAmbiguityDetected) warnings.push('Multiple file candidates were found');
              if (filesEdited.size > filesVerified.size) warnings.push('Some edits were not verified');
              
              taskCompleteResult = {
                summary: result.summary || 'Task completed',
                filesChanged: result.filesChanged || [...filesEdited],
                ...(warnings.length > 0 ? { warnings } : {})
              };
            }
          }
        }
        
        // Add function responses to messages
        messages.push({ role: "user", parts: functionResponses });
        
        // If task is complete, exit loop
        if (taskCompleteResult) {
          console.log(`[Agent Mode] Task completed: ${taskCompleteResult.summary}`);
          break;
        }
      }
      
      // 🔒 HARDENED: Final safety check - ensure at least 1 meaningful tool call was made
      const meaningfulToolCalls = toolCallsLog.filter(tc => 
        tc.tool !== 'task_complete' && tc.result?.success !== false
      );
      
      if (meaningfulToolCalls.length === 0) {
        console.error(`[Agent Mode] 🔒 SAFETY BLOCK: Agent completed with ZERO meaningful tool calls!`);
        console.error(`[Agent Mode] All calls: ${toolCallsLog.map(tc => tc.tool).join(', ')}`);
        return new Response(JSON.stringify({
          ok: true,
          mode: 'agent',
          result: {
            success: false,
            summary: 'The AI Coder failed to explore the codebase. Please try again with a more specific request.',
            filesChanged: [],
            error: 'NO_TOOL_CALLS'
          }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      
      // ========================================================================
      // 🎯 OPTION D: CLARIFICATION RESPONSE - When multiple candidates found
      // Return a special response type that frontend renders as a choice card
      // ========================================================================
      if (grepAmbiguityDetected && grepCandidateFiles.length > 1) {
        // Check if the agent made any edits despite ambiguity
        const successfulEditsCheck = toolCallsLog.filter(tc => 
          (tc.tool === 'search_replace' || tc.tool === 'write_file' || tc.tool === 'insert_code') && 
          tc.result?.success === true
        );
        
        // If no successful edits and ambiguity detected, return clarification card
        if (successfulEditsCheck.length === 0) {
          console.log(`[Agent Mode] 🎯 CLARIFICATION NEEDED: Found ${grepCandidateFiles.length} candidates, no edits made`);
          
          // Extract candidate details from grep results
          const candidateDetails: Array<{ file: string; preview: string; line?: number }> = [];
          for (const tc of toolCallsLog) {
            if (tc.tool === 'grep_search' && tc.result?.matches) {
              for (const match of tc.result.matches) {
                if (grepCandidateFiles.includes(match.file)) {
                  candidateDetails.push({
                    file: match.file,
                    preview: match.content?.substring(0, 100) || '',
                    line: match.line
                  });
                }
              }
            }
          }
          
          return new Response(JSON.stringify({
            ok: true,
            mode: 'agent',
            result: {
              success: true,
              type: 'clarification_needed',
              title: 'Which element do you mean?',
              message: 'I found multiple elements that could match your request. Please specify which one you want to change:',
              candidates: candidateDetails.slice(0, 5),
              candidateFiles: grepCandidateFiles.slice(0, 5),
              suggestion: 'You can click on the element in the preview to select it precisely, or describe it more specifically.',
              filesChanged: [],
              summary: 'Clarification needed'
            }
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
        }
      }
      
      // Collect all files that were written
      const filesChanged: string[] = [];
      toolCallsLog.forEach(tc => {
        if (tc.tool === 'write_file' && tc.result?.success && tc.result?.path) {
          filesChanged.push(tc.result.path);
        }
        if (tc.tool === 'search_replace' && tc.result?.success && tc.result?.path) {
          filesChanged.push(tc.result.path);
        }
        if (tc.tool === 'insert_code' && tc.result?.success && tc.result?.path) {
          filesChanged.push(tc.result.path);
        }
        if (tc.tool === 'delete_file' && tc.result?.success && tc.result?.deletedPath) {
          filesChanged.push(`(deleted) ${tc.result.deletedPath}`);
        }
      });
      
      // ========================================================================
      // SAFETY NET: Check for missing referenced files and auto-generate them
      // This catches cases where AI creates imports but forgets to create files
      // ========================================================================
      if (filesChanged.length > 0) {
        console.log(`[Agent Mode] Checking for missing referenced files...`);
        
        // Get current project files after agent changes
        const { data: currentRows } = await supabase
          .from('project_files')
          .select('path, content')
          .eq('project_id', projectId);
        
        const currentFiles: Record<string, string> = {};
        for (const row of currentRows || []) {
          currentFiles[normalizeFilePath(row.path)] = row.content;
        }
        
        // Find missing files
        const missing = findMissingReferencedFiles({ changedFiles: currentFiles, existingFiles: {} });
        
        if (missing.length > 0) {
          console.log(`[Agent Mode] SAFETY NET: Found ${missing.length} missing files: ${missing.join(', ')}`);
          
          try {
            // Auto-generate missing files using Gemini
            const generatedMissing = await callGeminiMissingFiles(missing, currentFiles, {}, prompt);
            
            // Write the generated files
            for (const [path, content] of Object.entries(generatedMissing)) {
              const normalizedPath = normalizeFilePath(path);
              const { error: writeErr } = await supabase
                .from('project_files')
                .upsert({
                  project_id: projectId,
                  path: normalizedPath,
                  content: content
                }, { onConflict: 'project_id,path' });
              
              if (!writeErr) {
                filesChanged.push(normalizedPath);
                console.log(`[Agent Mode] SAFETY NET: Created missing file: ${normalizedPath}`);
              }
            }
          } catch (genErr) {
            console.error(`[Agent Mode] SAFETY NET: Failed to generate missing files:`, genErr);
          }
        }
      }
      
      // Log credit usage for agent mode
      const agentCreditUsage = logCreditUsage(
        'agent',
        agentModelSelection,
        totalInputText,
        totalOutputText,
        projectId
      );
      
      // 📊 LOG TO ADMIN AI USAGE - Track in ai_logs table for admin dashboard
      const agentDurationMs = Date.now() - agentStartTime;
      await logAIFromRequest(req, {
        functionName: "projects-generate",
        provider: "gemini",
        model: agentModelSelection.model,
        inputText: totalInputText.substring(0, 2000),
        outputText: totalOutputText.substring(0, 2000),
        inputTokens: agentCreditUsage.inputTokensEstimate,
        outputTokens: agentCreditUsage.outputTokensEstimate,
        durationMs: agentDurationMs,
        status: "success",
        metadata: {
          mode: "agent",
          tier: agentModelSelection.tier,
          reason: agentModelSelection.reason,
          projectId,
          fileCount,
          iterations: Math.ceil(toolCallsLog.length / 2),
          toolCalls: toolCallsLog.length,
          filesChanged: filesChanged.length,
          costUSD: agentCreditUsage.estimatedCostUSD
        }
      });
      
      // ========================================================================
      // 🎯 UPGRADE #1: Generate "What Changed" Report
      // ========================================================================
      const changeReport = generateChangeReport(toolCallsLog, prompt);
      console.log(`[Agent Mode] 📋 Change Report: ${changeReport.title} - ${changeReport.summary}`);
      
      // ========================================================================
      // 🔒 UPGRADE #2: Multi-file Safety Guardrails Check
      // ========================================================================
      const multiFileGuardrail = checkMultiFileGuardrails(filesEdited, toolCallsLog, allFilesCache);
      if (multiFileGuardrail.triggered) {
        console.log(`[Agent Mode] 🔒 Multi-file guardrail: ${multiFileGuardrail.message}`);
      }
      
      // ========================================================================
      // 🧪 UPGRADE #3: Run Smoke Tests on Changed Files
      // ========================================================================
      const smokeTestResult = runSmokeTests([...filesEdited], allFilesCache);
      if (!smokeTestResult.passed) {
        console.warn(`[Agent Mode] 🧪 Smoke test FAILED: ${smokeTestResult.criticalErrors.join(', ')}`);
        resultWarnings.push(...smokeTestResult.criticalErrors);
      } else if (smokeTestResult.warnings.length > 0) {
        console.log(`[Agent Mode] 🧪 Smoke test passed with ${smokeTestResult.warnings.length} warning(s)`);
      }
      
      const result: AgentResult = {
        success: true,
        summary: taskCompleteResult?.summary || `Agent completed after ${toolCallsLog.length} tool calls`,
        filesChanged: taskCompleteResult?.filesChanged || [...new Set(filesChanged)],
        iterations: Math.ceil(toolCallsLog.length / 2),
        toolCalls: toolCallsLog,
        // Phase 5: Enhanced debugging info
        renderPathStatus: {
          computed: renderPathComputed,
          activeFiles: [...activeRenderPath].slice(0, 10),
          deadFiles: [...filesEdited].filter(f => renderPathComputed && !activeRenderPath.has(f))
        },
        ambiguityStatus: {
          detected: grepAmbiguityDetected,
          candidateFiles: grepCandidateFiles,
          message: grepAmbiguityMessage,
          requiresUserInput: grepRequiresUserInput,
          suggestInspectMode: grepSuggestInspectMode
        },
        styleChangeStatus: {
          isStyleRequest: intentAnchors.isStyleRequest,
          requestedColor: intentAnchors.requestedColor,
          colorValid: colorValidation.valid,
          blocked: styleChangeBlocked,
          blockedReason: styleBlockReason || colorValidation.message || undefined
        },
        warnings: resultWarnings,
        // 🎯 NEW: Premium Upgrades
        changeReport,
        multiFileGuardrail,
        smokeTestResult
      };
      
      console.log(`[Agent Mode] Completed. Files changed: ${result.filesChanged.join(', ')}`);
      
      return new Response(JSON.stringify({ 
        ok: true, 
        mode: 'agent',
        result,
        creditUsage: agentCreditUsage
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PLAN MODE: Propose changes without executing (Lovable-style)
    // Now with SMART MODEL SELECTION and CREDIT LOGGING
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
        
        const { plan, modelSelection: planModelSelection } = await callGeminiPlanMode(prompt, existingFiles);
        
        // Log credit usage for plan mode
        const planInputText = Object.values(existingFiles).join('\n') + prompt;
        const planCreditUsage = logCreditUsage('plan', planModelSelection, planInputText, plan, projectId);
        
        console.log(`[Plan Mode] Plan generated, length: ${plan.length}`);
        
        return new Response(JSON.stringify({ ok: true, plan, mode: 'plan', creditUsage: planCreditUsage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (planError: any) {
        console.error(`[Plan Mode] Error: ${planError.message}`);
        return new Response(JSON.stringify({ ok: false, error: planError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ========================================================================
    // EXECUTE MODE V2: AGENT-STYLE EXECUTION (Tool-based targeted reading)
    // Instead of sending full file contents, we use agent loop with tools
    // This reduces input tokens from ~19K to ~3K (85% reduction!)
    // ========================================================================
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
        // Get current file LIST only (not content) - ULTRA OPTIMIZED
        const { data: existingRows, error: existingErr } = await supabase
          .from('project_files')
          .select('path')
          .eq('project_id', projectId);
        if (existingErr) throw new Error(`DB_FILES_SELECT_FAILED: ${existingErr.message}`);
        
        const fileList = (existingRows || []).map(r => normalizeFilePath(r.path)).join('\n');
        const fileCount = existingRows?.length || 0;
        
        console.log(`[Execute Mode V2] AGENT-STYLE: Sending ${fileCount} file NAMES only (not content)`);
        console.log(`[Execute Mode V2] Plan to execute: ${planToExecute.substring(0, 200)}...`);
        
        // Prepare agent-style system prompt for execute mode
        const executeSystemPrompt = AGENT_SYSTEM_PROMPT.replace(/\{\{PROJECT_ID\}\}/g, projectId) + `

## 🎯 EXECUTE MODE SPECIFIC INSTRUCTIONS

You are in EXECUTE MODE. A plan has already been created and approved. Your job is to EXECUTE IT PRECISELY.

**EXECUTION RULES:**
1. Read the plan carefully
2. Use read_file to get file contents BEFORE editing
3. Use search_replace for targeted edits (preferred)
4. Use write_file ONLY for new files
5. Execute ALL steps in the plan
6. Call task_complete when done with a summary of what you changed

**DO NOT:**
- Skip any step in the plan
- Deviate from the plan
- Add features not in the plan
- Make assumptions - read files first!`;
        
        // Prepare execute mode user message (FILE LIST ONLY)
        const executeUserMessage = `📁 PROJECT FILES (${fileCount} files):
${fileList}

⚠️ IMPORTANT: Use read_file to see file contents before editing.
Use search_replace for targeted edits (preferred).

📋 PLAN TO EXECUTE:
${planToExecute}

${userInstructions ? `ADDITIONAL INSTRUCTIONS:\n${userInstructions}\n\n` : ''}
Execute this plan step by step. Read files first, then make changes using search_replace.
Call task_complete when finished.`;
        
        // Agent loop for execute mode (max 3 iterations - execute is focused)
        const execMessages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }> }> = [
          { role: "user", parts: [{ text: executeUserMessage }] }
        ];
        
        const execMaxIterations = 3;
        const execToolCallsLog: Array<{ tool: string; args: any; result: any }> = [];
        let execTaskCompleteResult: { summary: string; filesChanged: string[] } | null = null;
        
        // Model selection for execute mode
        const execModelSelection = selectOptimalModel(planToExecute, false, 'execute', fileCount);
        console.log(`[Execute Mode V2] Model selected: ${execModelSelection.model} (${execModelSelection.tier})`);
        
        let execTotalInputText = executeSystemPrompt + executeUserMessage;
        let execTotalOutputText = '';
        
        // Empty debug context for execute mode
        const execDebugContext: AgentDebugContext = {
          errors: [],
          networkErrors: [],
          consoleLogs: []
        };
        
        const GEMINI_API_KEY_EXEC = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
        if (!GEMINI_API_KEY_EXEC) throw new Error("GEMINI_API_KEY missing");
        
        for (let iteration = 0; iteration < execMaxIterations; iteration++) {
          console.log(`[Execute Mode V2] ========== ITERATION ${iteration + 1}/${execMaxIterations} ==========`);
          
          const geminiResponse = await withTimeout(
            fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${execModelSelection.model}:generateContent`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": GEMINI_API_KEY_EXEC,
                },
                body: JSON.stringify({
                  contents: execMessages,
                  systemInstruction: { parts: [{ text: executeSystemPrompt }] },
                  tools: [getGeminiToolsConfig()],
                  generationConfig: {
                    temperature: 0.1, // Lower temp for precise execution
                    maxOutputTokens: 8192,
                  },
                }),
              }
            ),
            120000,
            'GEMINI_EXECUTE_AGENT'
          );
          
          if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error(`[Execute Mode V2] Gemini error: ${errorText}`);
            throw new Error(`Execute API error: ${geminiResponse.status}`);
          }
          
          const geminiData = await geminiResponse.json();
          const candidate = geminiData.candidates?.[0];
          const content = candidate?.content;
          
          if (!content) {
            console.error(`[Execute Mode V2] No content in response`);
            break;
          }
          
          // Track output
          const textParts = content.parts?.filter((p: any) => p.text) || [];
          textParts.forEach((p: any) => { execTotalOutputText += p.text || ''; });
          
          execMessages.push({ role: "model", parts: content.parts });
          
          // Check for function calls
          const functionCalls = content.parts?.filter((p: any) => p.functionCall);
          
          if (!functionCalls || functionCalls.length === 0) {
            const textPart = content.parts?.find((p: any) => p.text);
            if (textPart) {
              console.log(`[Execute Mode V2] Got text response: ${textPart.text.substring(0, 100)}...`);
            }
            break;
          }
          
          // Execute function calls
          const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];
          
          for (const fc of functionCalls) {
            const { name, args } = fc.functionCall;
            
            console.log(`[Execute Mode V2] Tool: ${name} | Args: ${JSON.stringify(args).substring(0, 500)}`);
            
            const result = await executeToolCall(projectId, { name, arguments: args || {} }, execDebugContext, supabase, userId);
            
            console.log(`[Execute Mode V2] Result: ${JSON.stringify(result).substring(0, 300)}`);
            
            execToolCallsLog.push({ tool: name, args, result });
            functionResponses.push({
              functionResponse: { name, response: result }
            });
            
            // Check for task_complete
            if (name === 'task_complete' && result.acknowledged) {
              execTaskCompleteResult = {
                summary: result.summary || 'Plan executed',
                filesChanged: result.filesChanged || []
              };
            }
          }
          
          execMessages.push({ role: "user", parts: functionResponses });
          
          if (execTaskCompleteResult) {
            console.log(`[Execute Mode V2] Task completed: ${execTaskCompleteResult.summary}`);
            break;
          }
        }
        
        // Collect files changed
        const execFilesChanged: string[] = [];
        execToolCallsLog.forEach(tc => {
          if (tc.tool === 'write_file' && tc.result?.success && tc.result?.path) {
            execFilesChanged.push(tc.result.path);
          }
          if (tc.tool === 'search_replace' && tc.result?.success && tc.result?.path) {
            execFilesChanged.push(tc.result.path);
          }
          if (tc.tool === 'insert_code' && tc.result?.success && tc.result?.path) {
            execFilesChanged.push(tc.result.path);
          }
        });
        
        // Log credit usage
        const execCreditUsage = logCreditUsage('execute', execModelSelection, execTotalInputText, execTotalOutputText, projectId);
        
        console.log(`[Execute Mode V2] Completed. Files changed: ${[...new Set(execFilesChanged)].join(', ')}`);
        
        await updateJob(supabase, job.id, { 
          status: 'succeeded', 
          result_summary: execTaskCompleteResult?.summary || `Executed plan with ${execToolCallsLog.length} tool calls`, 
          error: null 
        });
        
        return new Response(JSON.stringify({ 
          ok: true, 
          jobId: job.id, 
          status: 'succeeded', 
          mode: 'execute-agent',
          filesChanged: [...new Set(execFilesChanged)],
          summary: execTaskCompleteResult?.summary || 'Plan executed',
          toolCalls: execToolCallsLog.length,
          creditUsage: execCreditUsage 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        
      } catch (innerErr) {
        const innerMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
        console.error(`[Execute Mode V2] Error: ${innerMsg}`);
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
        assertNoHtml("/App.js", files["/App.js"]);

        // CSS Inheritance Validation - warn about common visual bugs
        const cssWarnings = validateProjectCSS(files);
        if (cssWarnings.length > 0) {
          console.warn(formatCSSWarnings(cssWarnings));
          // Include warnings in the summary so they're visible to developers
          const warningsSummary = cssWarnings.map(w => `⚠️ ${w.file}: ${w.issue}`).join('; ');
          summary = summary ? `${summary} | CSS Warnings: ${warningsSummary}` : `CSS Warnings: ${warningsSummary}`;
        }

        // Inject project ID into backend API calls (catches multiple placeholder patterns)
        for (const [path, content] of Object.entries(files)) {
          // Replace all known placeholder patterns
          let fixed = content.replace(/\{\{PROJECT_ID\}\}|PROJECT_ID_HERE/g, projectId);
          files[path] = fixed;
        }
        
        // Post-generation validation: auto-fix any wrong projectId values
        for (const [path, content] of Object.entries(files)) {
          const wrongProjectIdPattern = /projectId:\s*['"]([a-f0-9-]{36})['"]/gi;
          let match;
          let fixedContent = content;
          while ((match = wrongProjectIdPattern.exec(content)) !== null) {
            if (match[1] !== projectId) {
              console.warn(`[Create Mode] Auto-fixing wrong projectId: ${match[1]} → ${projectId} in ${path}`);
              fixedContent = fixedContent.replace(new RegExp(`['"]${match[1]}['"]`, 'g'), `'${projectId}'`);
            }
          }
          files[path] = fixedContent;
        }

        // Check if project uses backend API and auto-enable it
        const usesBackend = Object.values(files).some(content => 
          content.includes('project-backend-api')
        );
        console.log(`[Create Mode] Enabling backend foundation for project...`);
        await supabase.from('project_backends').upsert({
          project_id: projectId,
          user_id: userId,
          enabled: true,
          enabled_at: new Date().toISOString(),
          features: { forms: true }
        }, { onConflict: 'project_id' });

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
      console.log(`[Edit Mode] Images attached: ${images ? (Array.isArray(images) ? images.length : 'yes') : 'none'}`);
      console.log(`[Edit Mode] Uploaded assets: ${uploadedAssets.length}`);
      console.log(`[Edit Mode] Backend enabled: ${backendContext?.enabled || false}`);
      const userPrompt = `${prompt}\n\n${userInstructions || ""}`;
      
      // USE FULL REWRITE - NO PATCHES (now with image support + uploaded assets + backend context)
      const imageArray = Array.isArray(images) ? images as unknown as string[] : undefined;
      const result = await callGeminiFullRewriteEdit(userPrompt, existingFiles, userInstructions, imageArray, uploadedAssets, backendContext);
      const changedFiles = result.files || {};
      
      console.log(`[Edit Mode] Changed files returned: ${Object.keys(changedFiles).join(', ') || 'NONE'}`);
      console.log(`[Edit Mode] Summary: ${result.summary}`);
      
      if (Object.keys(changedFiles).length === 0) {
        console.error(`[Edit Mode] WARNING: AI returned no changed files!`);
      }
      
      if (changedFiles["/App.js"]) assertNoHtml("/App.js", changedFiles["/App.js"]);

      const missing = findMissingReferencedFiles({ changedFiles, existingFiles });
      let finalFilesToUpsert: Record<string, string> = { ...changedFiles };

      if (missing.length > 0) {
        console.log(`[Edit validation] Missing referenced files detected: ${missing.join(', ')}`);
        const generatedMissing = await callGeminiMissingFiles(missing, changedFiles, existingFiles, userPrompt);
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

      // Inject project ID into backend API calls (catches multiple placeholder patterns)
      for (const [path, content] of Object.entries(finalFilesToUpsert)) {
        // Replace all known placeholder patterns
        let fixed = content.replace(/\{\{PROJECT_ID\}\}|PROJECT_ID_HERE/g, projectId);
        finalFilesToUpsert[path] = fixed;
      }
      
      // Post-generation validation: auto-fix any wrong projectId values
      for (const [path, content] of Object.entries(finalFilesToUpsert)) {
        const wrongProjectIdPattern = /projectId:\s*['"]([a-f0-9-]{36})['"]/gi;
        let match;
        let fixedContent = content;
        while ((match = wrongProjectIdPattern.exec(content)) !== null) {
          if (match[1] !== projectId) {
            console.warn(`[Edit Mode] Auto-fixing wrong projectId: ${match[1]} → ${projectId} in ${path}`);
            fixedContent = fixedContent.replace(new RegExp(`['"]${match[1]}['"]`, 'g'), `'${projectId}'`);
          }
        }
        finalFilesToUpsert[path] = fixedContent;
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
