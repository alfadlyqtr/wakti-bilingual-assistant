import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTrialErrorPayload, checkAndConsumeTrialToken } from "../_shared/trial-tracker.ts";

// Declare EdgeRuntime for background task support
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
import {
  validateProjectCSS,
  formatCSSWarnings,
  getCSSInheritanceGuidelines as _getCSSInheritanceGuidelines,
  validateThemeConsistency,
  formatThemeWarnings,
  type CSSWarning as _CSSWarning,
} from "../_shared/cssValidator.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { formatPackagesForPrompt } from "../_shared/sandpackPackages.ts";
// Split modules (Item 5 — safe, pure-data extractions)
import { THEME_PRESETS } from "./prompts/themes.ts";
import { FIXER_SYSTEM_PROMPT } from "./prompts/fixer.ts";
import { BASE_SYSTEM_PROMPT } from "./prompts/base.ts";
import { buildGeminiExecuteSystemPrompt } from "./prompts/geminiExecute.ts";
// Prompt-injection defenses (Phase A — Item A4)
import { sanitizeUserInput, withUserInputGuard } from "../_shared/promptSafety.ts";
// Template-token resolver (Phase A — Item A5) — replaces {{PROJECT_ID}} at DB save.
import { resolveProjectPlaceholdersInFiles } from "../_shared/projectFileTemplates.ts";
// Three-layer prompt architecture — capability registry (slims ~323 lines off the base prompt).
import {
  CAPABILITY_MANIFEST,
  assembleCapabilityDocs,
  getCapabilityDoc as _getCapabilityDoc,
} from "./prompts/capabilities/index.ts";
import {
  MODEL_PRICING,
  MODEL_FALLBACK,
  GEMINI_MODEL_CREATE,
  GEMINI_MODEL_PLAN,
  GEMINI_MODEL_SIMPLE,
  GEMINI_MODEL_VISION,
  isPremiumDesignRequest,
  selectOptimalModel,
  type ModelSelection,
} from "./models/selection.ts";
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
  executeFileSearchPlan,
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
  type SmokeTestItem,
  // 🔗 Dead button/link checker
  detectFakeInteractiveElements,
  formatFakeElementNote,
  type FakeElementFinding
} from "./agentTools.ts";

// ============================================================================
// WAKTI PROJECTS-GENERATE V2 - OPTIMIZED ENGINE
// ============================================================================
// SMART MODEL SELECTION: dynamic Flash/Pro routing with model fallbacks
// TOOL-FIRST EXECUTION: agent and execute now share Morph-aware edit tracking
// CREDIT TRACKING: Log model used, tokens, and estimated cost
// Modes: plan (propose changes) | execute (write code) | create | chat | agent
// ============================================================================

// ============================================================================
// SMART MODEL SELECTION  — moved to ./models/selection.ts
//   Imports: MODEL_PRICING, GEMINI_MODEL_* constants, MODEL_FALLBACK,
//            selectOptimalModel, type ModelSelection
// ============================================================================

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
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[GEMINI_MODEL_CREATE] || MODEL_PRICING['gemini-2.5-pro'];
  return ((inputTokens / 1000000) * pricing.input) + ((outputTokens / 1000000) * pricing.output);
}

function logCreditUsage(
  _mode: string,
  modelSelection: ModelSelection,
  inputText: string,
  outputText: string,
  _projectId: string
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
  
  
  return usage;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// ============================================================================
// DOCUMENT & VISION PROCESSING - Extract text from PDFs/DOCX, analyze images
// ============================================================================

interface ProcessedAsset {
  filename: string;
  url: string;
  file_type: string | null;
  extractedText?: string;  // For PDF/DOCX
  visionAnalysis?: string; // For images
}

function getDocumentExtractionModel(): string {
  return Deno.env.get('GEMINI_MODEL_DOCUMENT') || GEMINI_MODEL_PLAN;
}

/**
 * Extract text from a PDF using pdf-parse via fetch to a public API
 * For Deno Edge Functions, we use Gemini's native PDF understanding
 */
async function extractTextFromPDF(url: string, apiKey: string): Promise<string> {
  try {
    // Download the PDF
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[PDF Extract] Failed to download: ${response.status}`);
      return '';
    }
    
    const pdfBytes = await response.arrayBuffer();
    // Chunk-based base64 encoding (spread operator crashes on files >50KB)
    const uint8 = new Uint8Array(pdfBytes);
    let binaryStr = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binaryStr += String.fromCharCode(...uint8.subarray(i, Math.min(i + chunkSize, uint8.length)));
    }
    const base64Pdf = btoa(binaryStr);
    
    // Use Gemini to extract text from PDF (it has native PDF understanding)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${getDocumentExtractionModel()}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: base64Pdf
                }
              },
              {
                text: `Extract ALL text content from this PDF document. This is a CV/resume or document that the user wants to use as inspiration for their website. 
                
Return the extracted text in a clean, structured format. Include:
- Name and contact information
- Professional summary/objective
- Work experience (company, role, dates, responsibilities)
- Education (institution, degree, dates)
- Skills and certifications
- Any other relevant sections

Format it clearly so it can be used to generate a portfolio/CV website.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000
          }
        })
      }
    );
    
    if (!geminiResponse.ok) {
      console.error(`[PDF Extract] Gemini API error: ${geminiResponse.status}`);
      return '';
    }
    
    const result = await geminiResponse.json();
    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return extractedText;
    
  } catch (error) {
    console.error('[PDF Extract] Error:', error);
    return '';
  }
}

/**
 * Extract text from a DOCX file using Gemini's document understanding
 */
async function extractTextFromDOCX(url: string, apiKey: string): Promise<string> {
  try {
    // Download the DOCX
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[DOCX Extract] Failed to download: ${response.status}`);
      return '';
    }
    
    const docxBytes = await response.arrayBuffer();
    // Chunk-based base64 encoding (spread operator crashes on files >50KB)
    const uint8Docx = new Uint8Array(docxBytes);
    let binaryStrDocx = '';
    const chunkSizeDocx = 8192;
    for (let i = 0; i < uint8Docx.length; i += chunkSizeDocx) {
      binaryStrDocx += String.fromCharCode(...uint8Docx.subarray(i, Math.min(i + chunkSizeDocx, uint8Docx.length)));
    }
    const base64Docx = btoa(binaryStrDocx);
    
    // Use Gemini to extract text (it can handle DOCX as well)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${getDocumentExtractionModel()}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  data: base64Docx
                }
              },
              {
                text: `Extract ALL text content from this Word document. This is a CV/resume or document that the user wants to use as inspiration for their website.

Return the extracted text in a clean, structured format. Include all sections, headings, and content.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000
          }
        })
      }
    );
    
    if (!geminiResponse.ok) {
      console.error(`[DOCX Extract] Gemini API error: ${geminiResponse.status}`);
      return '';
    }
    
    const result = await geminiResponse.json();
    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return extractedText;
    
  } catch (error) {
    console.error('[DOCX Extract] Error:', error);
    return '';
  }
}

// Fix C: request-scoped circuit-breaker for Vision. Once we see a 429 from Gemini
// Vision for a single request, stop calling it for the rest of that request — a
// burst of sequential 429 retries was eating 30+ seconds of our 150s edge budget
// before the agent loop even started.
let _visionRateLimitedUntil = 0;
function isVisionRateLimited(): boolean {
  return Date.now() < _visionRateLimitedUntil;
}
function markVisionRateLimited(): void {
  // Block further vision calls for 60 seconds (covers a full request lifecycle)
  _visionRateLimitedUntil = Date.now() + 60_000;
}

/**
 * Analyze an image using Gemini Vision to extract design inspiration
 */
async function analyzeImageForInspiration(url: string, apiKey: string): Promise<string> {
  // Short-circuit if Vision is rate-limited in this request window
  if (isVisionRateLimited()) {
    console.warn('[Vision] Skipping analysis — circuit breaker open (recent 429)');
    return '';
  }
  try {
    // Download the image
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Vision] Failed to download: ${response.status}`);
      return '';
    }
    
    const imageBytes = await response.arrayBuffer();
    // Chunk-based base64 encoding (spread operator crashes on files >50KB)
    const uint8Img = new Uint8Array(imageBytes);
    let binaryStrImg = '';
    const chunkSizeImg = 8192;
    for (let i = 0; i < uint8Img.length; i += chunkSizeImg) {
      binaryStrImg += String.fromCharCode(...uint8Img.subarray(i, Math.min(i + chunkSizeImg, uint8Img.length)));
    }
    const base64Image = btoa(binaryStrImg);
    
    // Determine mime type from URL or response
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    
    // Use Gemini Vision to analyze the image
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_VISION}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image
                }
              },
              {
                text: `Analyze this image as design inspiration for a website. The user uploaded this as a reference.

Describe in detail:
1. **Visual Style**: Colors, gradients, shadows, overall aesthetic (modern, minimal, bold, elegant, etc.)
2. **Layout**: How elements are arranged, grid structure, spacing, alignment
3. **Typography**: Font styles visible (serif, sans-serif, bold, light), text hierarchy
4. **UI Elements**: Buttons, cards, navigation, icons, any interactive elements
5. **Mood/Vibe**: What feeling does this design convey?
6. **Key Design Patterns**: Any notable design patterns or techniques used

If this is a screenshot of a website, describe what sections are visible and how they're designed.
If this is a logo or brand image, describe the brand identity elements.
If this is a photo, describe how it could be used in a website design.

Be specific and actionable so the AI can recreate a similar style.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      }
    );
    
    if (!geminiResponse.ok) {
      console.error(`[Vision] Gemini API error: ${geminiResponse.status}`);
      // Fix C: trip the circuit breaker on rate-limit / quota so subsequent
      // image analyses in the same request don't burn the edge budget.
      if (geminiResponse.status === 429 || geminiResponse.status === 503) {
        markVisionRateLimited();
      }
      return '';
    }
    
    const result = await geminiResponse.json();
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return analysis;
    
  } catch (error) {
    console.error('[Vision] Error:', error);
    return '';
  }
}

/**
 * Process all uploaded assets - extract text from documents, analyze images
 */
/**
 * Detect if a file is a PDF based on file type, filename, or URL
 */
function isPdfFile(fileType: string | null, filename: string, url: string): boolean {
  const ft = (fileType || '').toLowerCase();
  const fn = filename.toLowerCase();
  const urlLower = url.toLowerCase();
  
  // Check MIME types
  if (ft.includes('pdf') || ft === 'application/pdf') return true;
  
  // Check filename extension
  if (fn.endsWith('.pdf')) return true;
  
  // Check URL for .pdf extension (before query params)
  const urlPath = urlLower.split('?')[0];
  if (urlPath.endsWith('.pdf')) return true;
  
  // Check if filename contains pdf (e.g., "resume_pdf" or "cv-pdf")
  if (fn.includes('pdf') && !fn.includes('image')) return true;
  
  return false;
}

/**
 * Detect if a file is a Word document based on file type, filename, or URL
 */
function isWordFile(fileType: string | null, filename: string, url: string): boolean {
  const ft = (fileType || '').toLowerCase();
  const fn = filename.toLowerCase();
  const urlLower = url.toLowerCase();
  
  // Check MIME types
  if (ft.includes('word') || ft.includes('document') || ft.includes('msword') || ft.includes('officedocument')) return true;
  if (ft === 'application/msword' || ft === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  
  // Check filename extension
  if (fn.endsWith('.doc') || fn.endsWith('.docx')) return true;
  
  // Check URL for doc/docx extension
  const urlPath = urlLower.split('?')[0];
  if (urlPath.endsWith('.doc') || urlPath.endsWith('.docx')) return true;
  
  return false;
}

/**
 * Detect if a file is an image based on file type, filename, or URL
 */
function isImageFile(fileType: string | null, filename: string, url: string): boolean {
  const ft = (fileType || '').toLowerCase();
  const fn = filename.toLowerCase();
  const urlLower = url.toLowerCase();
  
  // Check MIME types
  if (ft.includes('image') || ft.startsWith('image/')) return true;
  
  // Check filename extension
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico|heic|heif)$/i.test(fn)) return true;
  
  // Check URL for image extension
  const urlPath = urlLower.split('?')[0];
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico|heic|heif)$/i.test(urlPath)) return true;
  
  return false;
}

async function processUploadedAssets(
  assets: Array<{ filename: string; url: string; file_type: string | null }>,
  apiKey: string
): Promise<{ processedAssets: ProcessedAsset[]; documentContent: string; visionInspirations: string }> {
  const processedAssets: ProcessedAsset[] = [];
  let documentContent = '';
  let visionInspirations = '';
  
  for (const asset of assets) {
    const processed: ProcessedAsset = { ...asset };
    
    // Check if it's a PDF using robust detection
    if (isPdfFile(asset.file_type, asset.filename, asset.url)) {
      const text = await extractTextFromPDF(asset.url, apiKey);
      if (text) {
        processed.extractedText = text;
        documentContent += `\n\n📄 **CONTENT FROM ${asset.filename}:**\n${text}\n`;
      }
    }
    // Check if it's a DOCX/DOC using robust detection
    else if (isWordFile(asset.file_type, asset.filename, asset.url)) {
      const text = await extractTextFromDOCX(asset.url, apiKey);
      if (text) {
        processed.extractedText = text;
        documentContent += `\n\n📄 **CONTENT FROM ${asset.filename}:**\n${text}\n`;
      }
    }
    // Check if it's an image using robust detection
    else if (isImageFile(asset.file_type, asset.filename, asset.url)) {
      const analysis = await analyzeImageForInspiration(asset.url, apiKey);
      if (analysis) {
        processed.visionAnalysis = analysis;
        visionInspirations += `\n\n🎨 **DESIGN INSPIRATION FROM ${asset.filename}:**\n${analysis}\n`;
      }
    }
    
    processedAssets.push(processed);
  }
  
  return { processedAssets, documentContent, visionInspirations };
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
  collections: Array<{ name: string; itemCount: number; schema?: Record<string, unknown> }>;
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
  customerData?: Array<{ userId: string; preferences: Record<string, unknown> }>;
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
  consoleLogs?: Array<{
    level: 'log' | 'warn' | 'error' | 'info';
    message: string;
    timestamp: string;
  }>;
  autoFixAttempt?: number;
  maxAutoFixAttempts?: number;
  selectedElement?: AgentDebugContext['selectedElement'];
  executionMode?: AgentExecutionMode;
}

interface RequestBody {
  action?: 'start' | 'status' | 'get_files' | 'pause' | 'resume' | 'agent_run';
  jobId?: string;
  resumeFromJobId?: string;
  projectId?: string;
  mode?: 'create' | 'edit' | 'plan' | 'execute' | 'chat' | 'agent';
  prompt?: string;
  currentFiles?: Record<string, string>;
  hotFiles?: string[];
  assets?: string[];
  theme?: string;
  userInstructions?: string;
  images?: Array<ImageAttachment | string>;
  assetIntent?: 'layout' | 'style' | 'content';
  planToExecute?: string;
  uploadedAssets?: UploadedAsset[];
  backendContext?: BackendContext;
  debugContext?: DebugContext;  // NEW: Debug context for error-aware editing
  executionMode?: AgentExecutionMode;
  fixerMode?: boolean;  // NEW: Use "The Fixer" (premium model, internal impl) for final auto-fix attempt
  fixerContext?: {  // NEW: Extra context for The Fixer
    errorMessage: string;
    previousAttempts: number;
    recentEdits?: string[];  // Files that were recently edited
    chatHistory?: string;  // Recent chat context
    // Structured hints (Item 9) — parsed client-side so The Fixer doesn't
    // have to re-derive them from the stack trace.
    missingPackage?: string | null;
    errorType?: 'missing-dependency' | 'runtime' | string;
  };
  lang?: 'ar' | 'en';  // Language for generated content
}

const normalizeAssetIntent = (value: unknown): 'layout' | 'style' | 'content' | undefined => {
  return value === 'layout' || value === 'style' || value === 'content' ? value : undefined;
};

const buildAssetIntentPrompt = (assetIntent?: 'layout' | 'style' | 'content'): string => {
  if (assetIntent === 'layout') {
    return 'ATTACHMENT INTENT: Copy layout. Prioritize section structure, hierarchy, spacing, and arrangement from the attached references. Do not promise pixel-perfect cloning.';
  }

  if (assetIntent === 'style') {
    return 'ATTACHMENT INTENT: Use style. Prioritize colors, mood, typography, and visual feel from the attached references. Treat them as inspiration, not exact structure.';
  }

  if (assetIntent === 'content') {
    return 'ATTACHMENT INTENT: Extract content. Prioritize reading text, items, prices, headings, and structured information from the attached references, then turn that into real site content.';
  }

  return '';
};

const ASSET_NEEDLE_REGEX = /\b(image|images|photo|picture|logo|screenshot|visual|design reference|style reference|pdf|doc|docx|resume|cv|portfolio data|uploaded|attachment|file|files|my photo|my image|use this image|extract content|look at|analyze)\b/i;

function shouldProcessUploadedAssets(params: {
  mode: string;
  prompt: string;
  images: unknown;
  uploadedAssets: UploadedAsset[];
  assets: string[];
  assetIntent?: 'layout' | 'style' | 'content';
}): boolean {
  const { mode, prompt, images, uploadedAssets, assets, assetIntent } = params;

  if (mode === 'create') return true;

  const hasInlineImages = Array.isArray(images) && images.length > 0;
  if (hasInlineImages) return true;

  const hasUploadedAssets = Array.isArray(uploadedAssets) && uploadedAssets.length > 0;
  const hasAssetUrls = Array.isArray(assets) && assets.length > 0;
  if (!hasUploadedAssets && !hasAssetUrls) return false;

  if (assetIntent === 'layout' || assetIntent === 'style' || assetIntent === 'content') return true;

  return ASSET_NEEDLE_REGEX.test(prompt || '');
}

function joinPromptSections(...sections: Array<string | undefined | null>): string {
  return sections
    .map((section) => typeof section === 'string' ? section.trim() : '')
    .filter(Boolean)
    .join('\n\n');
}

function detectProjectStructure(currentFiles: Record<string, string>): {
  entryFile: string;
  appFile: string;
  headerFile: string | null;
  dataFile: string | null;
  contextFiles: string[];
} {
  const allPaths = Object.keys(currentFiles || {});
  const findFile = (candidates: string[]): string | null => {
    for (const candidate of candidates) {
      const directHit = allPaths.find((path) => path.toLowerCase() === candidate.toLowerCase());
      if (directHit) return directHit;
    }
    for (const candidate of candidates) {
      const base = candidate.split('/').pop()?.toLowerCase();
      if (!base) continue;
      const fuzzyHit = allPaths.find((path) => path.toLowerCase().endsWith('/' + base) || path.toLowerCase() === '/' + base);
      if (fuzzyHit) return fuzzyHit;
    }
    return null;
  };

  return {
    entryFile: findFile(['/index.js', '/src/index.js', '/index.jsx', '/src/index.jsx', '/index.tsx', '/src/index.tsx', '/src/main.jsx', '/src/main.tsx', '/main.jsx']) || '/index.js',
    appFile: findFile(['/App.js', '/App.jsx', '/App.tsx', '/src/App.js', '/src/App.jsx', '/src/App.tsx']) || '/App.js',
    headerFile: findFile(['/components/Header.jsx', '/components/Header.js', '/components/Navbar.jsx', '/components/Navigation.jsx', '/src/components/Header.jsx', '/src/components/Navbar.jsx']),
    dataFile: findFile(['/utils/mockData.js', '/utils/data.js', '/data/mockData.js', '/src/utils/mockData.js', '/src/data/mockData.js']),
    contextFiles: allPaths.filter((path) => /\/context(s)?\//i.test(path)),
  };
}

function buildProjectStructureAwareness(currentFiles: Record<string, string>): string {
  const allPaths = Object.keys(currentFiles || {});
  if (allPaths.length === 0) return '';

  const structure = detectProjectStructure(currentFiles);
  return `📌 PROJECT STRUCTURE (start from what already exists):
- Entry file: ${structure.entryFile}
- Root App: ${structure.appFile}
${structure.headerFile ? `- Header/Nav: ${structure.headerFile}` : '- Header/Nav: not detected yet'}
${structure.contextFiles.length > 0 ? `- Context files: ${structure.contextFiles.join(', ')}` : '- Context files: none detected yet'}
${structure.dataFile ? `- Data file: ${structure.dataFile}` : '- Data file: none detected yet'}
- Total known files: ${allPaths.length}`;
}

function buildUploadedAssetsAwareness(params: {
  uploadedAssets?: UploadedAsset[];
  documentContentBlocks?: string[];
  visionInspiration?: string;
  assetIntentPrompt?: string;
  includeAssetPickerRules?: boolean;
}): string {
  const uploadedAssets = Array.isArray(params.uploadedAssets) ? params.uploadedAssets : [];
  const documentBlocks = (params.documentContentBlocks || []).map((block) => (block || '').trim()).filter(Boolean);
  const sections: string[] = [];

  if (uploadedAssets.length > 0) {
    let assetsSection = `📁 USER UPLOADED ASSETS (real project files you can use directly):\n${uploadedAssets.map((asset) => `- ${asset.filename} (${asset.file_type || 'file'}): ${asset.url}`).join('\n')}\nUse these exact URLs when the user refers to their photo, image, logo, PDF, or uploaded file.`;
    if (params.includeAssetPickerRules && uploadedAssets.length > 1) {
      assetsSection += `\nIf the user says \"my photo\" or \"my image\" without naming a file and multiple assets exist, ask them to choose the exact file before using one.`;
    } else if (uploadedAssets.length === 1) {
      const singleAsset = uploadedAssets[0];
      const fileType = (singleAsset.file_type || '').toLowerCase();
      assetsSection += `\nIf the user says \"my photo\" or \"my image\", use ${singleAsset.filename}.`;
      // 🔧 Auto-use single uploaded file even when the prompt never explicitly
      // says "use my photo" — previously the file just sat unused unless the
      // user typed those exact words, even after attaching it specifically
      // for the site.
      if (fileType.startsWith('image/')) {
        assetsSection += `\nThe user uploaded exactly one image (${singleAsset.filename}) with this request. Unless the prompt gives other explicit instructions for it, use this image prominently — as the hero image or personal/profile photo, whichever fits the brief best. Do not leave it unused.`;
      } else if (fileType.startsWith('video/')) {
        assetsSection += `\nThe user uploaded exactly one video (${singleAsset.filename}) with this request. Unless the prompt gives other explicit instructions for it, use it as a hero/background video. Do not leave it unused.`;
      } else if (fileType.includes('pdf') || fileType.includes('word') || fileType.includes('document')) {
        assetsSection += `\nThe user uploaded exactly one document (${singleAsset.filename}) with this request. Extract and use its real content (text, data, structure) to populate the site — do not invent placeholder content that could come from this document instead.`;
      }
    }
    sections.push(assetsSection);
  }

  if (documentBlocks.length > 0) {
    sections.push(`📄 REAL DOCUMENT DATA (use this exactly, do not invent replacements):\n${documentBlocks.join('\n\n')}`);
  }

  if (params.visionInspiration && params.visionInspiration.trim()) {
    sections.push(`🎨 DESIGN INSPIRATION FROM USER ASSETS:\n${params.visionInspiration.trim()}\nApply this feel, not generic filler.`);
  }

  if (params.assetIntentPrompt && params.assetIntentPrompt.trim()) {
    sections.push(`🧭 ATTACHMENT INTENT:\n${params.assetIntentPrompt.trim()}`);
  }

  return joinPromptSections(...sections);
}

function buildBackendAwareness(projectId: string | undefined, backendContext?: BackendContext): string {
  const effectiveProjectId = projectId || '{{PROJECT_ID}}';
  const collectionSummary = backendContext?.collections && backendContext.collections.length > 0
    ? backendContext.collections.map((collection) => `${collection.name}(${collection.itemCount})`).join(', ')
    : 'None yet';

  const sections: string[] = [
    `🗄️ PROJECT BACKEND AWARENESS:\n- Project ID for backend calls: ${effectiveProjectId}\n- API endpoint: https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api\n- Foundation bricks always available: ${getFoundationBricks().join(', ')}\n- Use this backend for real project data instead of hardcoding mock content.`,
  ];

  if (backendContext?.enabled) {
    sections.push(`CURRENT BACKEND STATE:\n- Collections: ${collectionSummary}\n- Forms: ${backendContext.formSubmissionsCount}\n- Uploads: ${backendContext.uploadsCount}\n- Site users: ${backendContext.siteUsersCount}${backendContext.hasShopSetup ? `\n- Shop: active with ${backendContext.productsCount || 0} products and ${backendContext.ordersCount || 0} orders` : ''}${backendContext.hasBookingsSetup ? `\n- Bookings: active with ${backendContext.servicesCount || 0} services and ${backendContext.bookingsCount || 0} bookings` : ''}${(backendContext.chatRoomsCount || 0) > 0 || (backendContext.commentsCount || 0) > 0 ? `\n- Social: ${backendContext.chatRoomsCount || 0} chat rooms, ${backendContext.commentsCount || 0} comments` : ''}`);
  } else {
    sections.push('CURRENT BACKEND STATE:\n- Backend data is not active yet, but the project backend API is still available and should be used for real persisted features.');
  }

  sections.push(`EXACT BACKEND CONTRACT REMINDERS:\n- Submit form: { projectId: "${effectiveProjectId}", action: "submit", formName: "contact", data: {...} }\n- Get collection: { projectId: "${effectiveProjectId}", action: "collection/products" }\n- Auth signup: { projectId: "${effectiveProjectId}", action: "auth/signup", data: { email, password, name } }\n- Booking create: { projectId: "${effectiveProjectId}", action: "booking/create", data: { serviceName, date, startTime, customerInfo: { name, email, phone } } }\nGOLDEN RULES:\n- Always use this exact projectId\n- Always show loading and empty states\n- Never invent backend formats when the project backend already defines them`);

  return joinPromptSections(...sections);
}

function buildUnifiedProjectAwarenessContext(params: {
  projectId?: string;
  currentFiles?: Record<string, string>;
  uploadedAssets?: UploadedAsset[];
  backendContext?: BackendContext;
  documentContentBlocks?: string[];
  visionInspiration?: string;
  assetIntentPrompt?: string;
  includeProjectStructure?: boolean;
  includeAssetPickerRules?: boolean;
}): string {
  const sections: string[] = [
    '🧠 WAKTI PROJECT AWARENESS:\nTreat this like a real project with real files, real backend state, and real uploaded assets. Start from what already exists. Build with confidence, not guesses.',
    '✨ FIRST-RUN ORCHESTRATION:\nOpen with a calm premium-builder mindset. Identify the most likely visible surface first, anchor your decisions in the real project facts below, and choose one coherent upgrade path instead of sounding like an internal system or a hesitant debugger.',
  ];

  if (params.includeProjectStructure && params.currentFiles) {
    const structureSection = buildProjectStructureAwareness(params.currentFiles);
    if (structureSection) sections.push(structureSection);
  }

  const uploadedAssetsSection = buildUploadedAssetsAwareness({
    uploadedAssets: params.uploadedAssets,
    documentContentBlocks: params.documentContentBlocks,
    visionInspiration: params.visionInspiration,
    assetIntentPrompt: params.assetIntentPrompt,
    includeAssetPickerRules: params.includeAssetPickerRules,
  });
  if (uploadedAssetsSection) sections.push(uploadedAssetsSection);

  sections.push(buildBackendAwareness(params.projectId, params.backendContext));

  return joinPromptSections(...sections);
}

type JobStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed';

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
          mode: 'create' | 'edit' | 'agent';
          prompt: string | null;
          result_summary: string | null;
          error: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          status: JobStatus;
          mode: 'create' | 'edit' | 'agent';
          prompt?: string | null;
          result_summary?: string | null;
          error?: string | null;
          metadata?: Record<string, unknown> | null;
        };
        Update: {
          status?: JobStatus;
          result_summary?: string | null;
          error?: string | null;
          metadata?: Record<string, unknown> | null;
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

const REACT_RUNTIME_ENTRY_CANDIDATES = [
  "/index.js",
  "/index.jsx",
  "/index.tsx",
  "/src/index.js",
  "/src/index.jsx",
  "/src/index.tsx",
  "/src/main.js",
  "/src/main.jsx",
  "/src/main.tsx",
  "/wakti_entry.js",
  "/wakti_entry.jsx",
  "/wakti_entry.tsx",
  "/src/wakti_entry.js",
  "/src/wakti_entry.jsx",
  "/src/wakti_entry.tsx",
] as const;

const REACT_APP_ENTRY_CANDIDATES = [
  "/App.js",
  "/App.jsx",
  "/App.tsx",
  "/src/App.js",
  "/src/App.jsx",
  "/src/App.tsx",
] as const;

function buildReactHtmlShell(html: string): string {
  const source = typeof html === "string" ? html.trim() : "";
  if (!source) {
    return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\" />\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n</head>\n<body>\n<div id=\"root\"></div>\n</body>\n</html>";
  }

  const htmlAttrsMatch = source.match(/<html([^>]*)>/i);
  const htmlAttrs = htmlAttrsMatch?.[1]?.trim() ? ` ${htmlAttrsMatch[1].trim()}` : ' lang="en"';
  const bodyAttrsMatch = source.match(/<body([^>]*)>/i);
  const bodyAttrs = bodyAttrsMatch?.[1]?.trim() ? ` ${bodyAttrsMatch[1].trim()}` : "";
  let headContent = source.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1]?.trim() || "";

  if (!/<meta[^>]+charset=/i.test(headContent)) {
    headContent = `<meta charset="UTF-8" />${headContent ? `\n${headContent}` : ""}`;
  }
  if (!/name=["']viewport["']/i.test(headContent)) {
    headContent = `${headContent}${headContent ? "\n" : ""}<meta name="viewport" content="width=device-width, initial-scale=1.0" />`;
  }

  return `<!DOCTYPE html>\n<html${htmlAttrs}>\n<head>\n${headContent}\n</head>\n<body${bodyAttrs}>\n<div id="root"></div>\n</body>\n</html>`;
}

function normalizeReactProjectHtmlFiles(files: Record<string, string>): Record<string, string> {
  const normalizedEntries = Object.entries(files).map(([path, content]) => [normalizeFilePath(path), content] as const);
  const normalized: Record<string, string> = Object.fromEntries(normalizedEntries);
  const hasReactRuntime = REACT_RUNTIME_ENTRY_CANDIDATES.some((path) => typeof normalized[path] === "string" && normalized[path].trim().length > 0);
  const hasReactApp = REACT_APP_ENTRY_CANDIDATES.some((path) => typeof normalized[path] === "string" && normalized[path].trim().length > 0);

  if (!hasReactRuntime && !hasReactApp) {
    return normalized;
  }

  if (typeof normalized["/index.html"] === "string") {
    normalized["/index.html"] = buildReactHtmlShell(normalized["/index.html"]);
  }

  if (typeof normalized["/public/index.html"] === "string") {
    normalized["/public/index.html"] = buildReactHtmlShell(normalized["/public/index.html"]);
  }

  return normalized;
}

const BANNED_IMAGE_HOST_PATTERN = /https?:\/\/[^"'`\s)]*(?:images\.unsplash\.com|source\.unsplash\.com|unsplash\.com|picsum\.photos|via\.placeholder\.com|placeholder\.com|placehold\.it)/gi;

function replaceBannedImageHosts(content: string, replacementUrls: string[]): string {
  if (!content || replacementUrls.length === 0) return content;
  let replacementIndex = 0;
  return content.replace(BANNED_IMAGE_HOST_PATTERN, () => {
    const nextUrl = replacementUrls[replacementIndex] || replacementUrls[replacementUrls.length - 1];
    replacementIndex += 1;
    return nextUrl;
  });
}

function replaceBannedImageHostsInFiles(files: Record<string, string>, replacementUrls: string[]): Record<string, string> {
  if (replacementUrls.length === 0) return files;
  const cleanedUrls = replacementUrls.filter((url) => typeof url === 'string' && url.trim().length > 0);
  if (cleanedUrls.length === 0) return files;
  const nextFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    nextFiles[path] = replaceBannedImageHosts(content, cleanedUrls);
  }
  return nextFiles;
}

// ============================================================================
// FULL REWRITE ENGINE (NO PATCHES)
// ============================================================================

// ============================================================================
// UNIVERSAL MODEL CALLER - Supports all Gemini models with dynamic selection
// Includes exponential backoff for rate limiting (429 errors)
// ============================================================================
async function callGeminiWithModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = true,
  maxRetries: number = 2,
  options: { enableGoogleSearch?: boolean; timeoutMs?: number } = {}
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  // 🛡️ Prompt-injection defense: always append the untrusted-input guard
  // to the system prompt. Idempotent — no-op if already applied.
  systemPrompt = withUserInputGuard(systemPrompt);

  let lastError: Error | null = null;
  let activeModel = model;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s, 8s
      const backoffMs = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
    
    try {
      const response = await withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": GEMINI_API_KEY,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              ...(options.enableGoogleSearch ? { tools: [{ google_search: {} }] } : {}),
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 65536,
                // Google Search grounding counts as a "tool" in the Gemini API.
                // Gemini explicitly forbids responseMimeType: application/json when any tool is present.
                // When Google Search is on, use text mode — extractJsonObject handles JSON extraction from text.
                ...((jsonMode && !options.enableGoogleSearch) ? { responseMimeType: "application/json" } : {}),
              },
            }),
          }
        ),
        // Default 120s for most callers. CREATE mode passes a larger, budget-aware
        // value (see createDraftTimeoutMs/etc.) since generating 10k-30k tokens of
        // full-site code genuinely needs more than 120s for complex requests.
        options.timeoutMs ?? 120000,
        'GEMINI_CALL'
      );

      // Handle rate limiting with retry
      if (response.status === 429) {
        const errorText = await response.text();
        console.warn(`[Gemini ${model}] Rate limited (429): ${errorText}`);
        lastError = new Error(`Gemini API rate limited: 429`);
        continue; // Retry with backoff
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Gemini ${activeModel}] HTTP ${response.status}: ${errorText}`);
        // Fallback on: 404 (model not found), 503 (overloaded), 400 for preview/non-existent models
        const isModelNotFound = response.status === 404
          || response.status === 503
          || (response.status === 400 && MODEL_FALLBACK[activeModel] !== undefined);
        if (isModelNotFound && MODEL_FALLBACK[activeModel]) {
          const fallbackModel = MODEL_FALLBACK[activeModel];
          console.warn(`[Gemini] ${activeModel} unavailable (${response.status}), falling back to ${fallbackModel}`);
          activeModel = fallbackModel;
          continue;
        }
        throw new Error(summarizeGeminiError(response.status, errorText));
      }

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      if (jsonMode) {
        text = normalizeGeminiResponseText(text);
      }
      
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Only retry on rate limit errors, throw immediately for other errors
      if (!lastError.message.includes('429') && !lastError.message.includes('rate limit')) {
        throw lastError;
      }
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('Gemini API call failed after retries');
}

// Legacy wrapper for backward compatibility - always uses Pro
function callGemini25Pro(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = true,
  options: { enableGoogleSearch?: boolean; timeoutMs?: number } = {}
): Promise<string> {
  return callGeminiWithModel(GEMINI_MODEL_CREATE, systemPrompt, userPrompt, jsonMode, 3, options);
}

function shouldUseGoogleSearchGrounding(prompt: string): boolean {
  const sportsIntent = /\b(sport|sports|football|soccer|fifa|afc|uefa|team|club|national\s+team|squad|roster|lineup|standings|table|fixtures?|results?|match|matches|fan\s+site|supporters?)\b/i.test(prompt);
  const qatarIntent = /qatar|qatari|القطري|قطر|العنابي/i.test(prompt);
  const freshnessIntent = /\b(current|latest|live|today|recent|breaking|news|standings|table|roster|squad|lineup|fixtures?|results?)\b/i.test(prompt);
  return freshnessIntent && (sportsIntent || qatarIntent);
}

function buildGroundedFreshnessInstructions(prompt: string): string {
  if (!shouldUseGoogleSearchGrounding(prompt)) {
    return "";
  }

  return `

🔎 FRESHNESS REQUIREMENT:
- This request requires current real-world sports information.
- Use grounded Google Search results for current news, standings, roster, fixtures, and recent results.
- Do NOT invent or guess current facts.
- If a fact cannot be verified, render a clear unavailable/empty state instead of fake content.
- News cards must open a real article detail view or expanded detail state.
- If player headshots cannot be verified, use a neutral placeholder instead of random photos.`;
}

interface DesignCriticResult {
  pass: boolean;
  score: number;
  verdict: string;
  issues: string[];
  requiredActions: string[];
  reviewedFiles: string[];
}

async function loadFilesForDesignCritic(
  supabase: SupabaseAdminClient,
  projectId: string,
  candidatePaths: string[],
  cachedFiles: Record<string, string>,
): Promise<Record<string, string>> {
  const reviewedFiles = Array.from(new Set(candidatePaths.map(normalizeFilePath).filter(Boolean))).slice(0, 6);
  const files: Record<string, string> = {};
 
  if (reviewedFiles.length > 0) {
    const { data } = await supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', projectId)
      .in('path', reviewedFiles);

    for (const row of data || []) {
      const normalizedPath = normalizeFilePath(row.path);
      if (typeof row.content === 'string' && row.content.trim().length > 0) {
        files[normalizedPath] = row.content;
      }
    }
  }

  for (const path of reviewedFiles) {
    if (!files[path] && typeof cachedFiles[path] === 'string' && cachedFiles[path].trim().length > 0) {
      files[path] = cachedFiles[path];
    }
  }

  return files;
}

async function runDesignCritic(
  userPrompt: string,
  changeSummary: string,
  changedFiles: Record<string, string>,
): Promise<DesignCriticResult> {
  const reviewedFiles = Object.keys(changedFiles);

  if (reviewedFiles.length === 0) {
    return {
      pass: true,
      score: 10,
      verdict: 'No files supplied to design critic.',
      issues: [],
      requiredActions: [],
      reviewedFiles: [],
    };
  }

  const fileContext = reviewedFiles
    .map((path) => `=== FILE: ${path} ===\n${(changedFiles[path] || '').slice(0, 12000)}`)
    .join('\n\n');

  const combinedCode = reviewedFiles
    .map((path) => changedFiles[path] || '')
    .join('\n')
    .toLowerCase();

  const heuristicIssues: string[] = [];
  const heuristicActions: string[] = [];
  const focalVisualEvidence = /<img|backgroundimage|image_url|\.png|\.jpg|\.jpeg|\.webp|mockup|preview|hero-image|heroimage|object-cover/.test(combinedCode);
  const ctaEvidence = /<button|<a\s|href=|onclick|shop now|explore|get started|learn more|book now|contact us/.test(combinedCode);
  const headingEvidence = /<h1|text-5xl|text-6xl|text-7xl|text-\[clamp\(|font-serif/.test(combinedCode);
  const contrastEvidence = /overlay|bg-black\/|from-black|via-black|to-black|text-white|backdrop-blur|bg-gradient|shadow-\[|linear-gradient/.test(combinedCode);

  if (!focalVisualEvidence) {
    heuristicIssues.push('No strong focal visual signal was found in the changed code.');
    heuristicActions.push('Add a real hero visual, premium product image, editorial image treatment, or an equivalent high-impact focal asset.');
  }

  if (!ctaEvidence) {
    heuristicIssues.push('No clear call-to-action signal was found in the changed code.');
    heuristicActions.push('Add a clearly visible primary CTA with strong placement in the hero.');
  }

  if (!headingEvidence) {
    heuristicIssues.push('No strong dominant heading signal was found in the changed code.');
    heuristicActions.push('Add a clearly dominant hero heading with premium hierarchy.');
  }

  if (!contrastEvidence) {
    heuristicIssues.push('No clear contrast or overlay strategy was found in the changed code.');
    heuristicActions.push('Strengthen contrast with a proper overlay, text treatment, background separation, or clearer surface layering.');
  }

  const systemPrompt = `You are the Design Critic role for WAKTI AI Coder.

Your job is to judge whether the changed code actually satisfies a premium design request.

Be strict. Reject results that are still generic, flat, empty, poorly composed, awkward, overlapping, placeholder-like, or obviously below premium quality.

For design-heavy work, expect the result to visibly align with one strong premium starter system such as:
- Luxury Fashion Hero
- Premium SaaS Hero
- Editorial Landing Page
- Modern Service Brand Homepage

Hard fail the result if ANY of these are true:
- Text readability is bad.
- Hero contrast is weak or washed out.
- The focal visual is missing, broken, irrelevant, or too low-impact.
- The main heading blends into the background or lacks clear dominance.
- The CTA is hard to notice or visually lost.
- The hero feels empty, generic, placeholder-like, or compositionally dead.

Return ONLY valid JSON with this shape:
{
  "pass": true,
  "score": 8,
  "verdict": "Short verdict",
  "issues": ["Issue 1"],
  "requiredActions": ["Action 1"]
}`;

  const criticPrompt = `USER REQUEST:
${userPrompt}

CHANGE SUMMARY:
${changeSummary || 'No summary provided.'}

CHANGED FILES TO REVIEW:
${fileContext}

Heuristic review notes from the system:
${heuristicIssues.length > 0 ? heuristicIssues.map((issue) => `- ${issue}`).join('\n') : '- No deterministic heuristic issues detected.'}

Judge whether this result is truly strong enough for a premium design request. Use score 0-10, and only pass truly premium work.`;

  const criticModel = selectOptimalModel(userPrompt, false, 'agent', reviewedFiles.length).model;
  const raw = await callGeminiWithModel(criticModel, systemPrompt, criticPrompt, true, 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    const recovered = recoverBrokenJson(raw);
    if (!recovered) {
      throw parseErr;
    }
    parsed = recovered;
  }

  const obj = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  const issues = Array.isArray(obj.issues) ? obj.issues.filter((issue): issue is string => typeof issue === 'string') : [];
  const requiredActions = Array.isArray(obj.requiredActions)
    ? obj.requiredActions.filter((action): action is string => typeof action === 'string')
    : [];
  const score = typeof obj.score === 'number' ? obj.score : 0;
  const modelPass = obj.pass === true && score >= 8;
  const heuristicPass = heuristicIssues.length === 0;

  return {
    pass: modelPass && heuristicPass,
    score,
    verdict: typeof obj.verdict === 'string' ? obj.verdict : 'Design critic review completed.',
    issues: [...heuristicIssues, ...issues],
    requiredActions: [...heuristicActions, ...requiredActions],
    reviewedFiles,
  };
}

// ============================================================================
// STEP 1: ANALYZE SCREENSHOT - Extract visible UI text anchors
// ============================================================================
async function analyzeScreenshotForAnchors(
  images: string[]
): Promise<{ anchors: string[]; description: string }> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const model = GEMINI_MODEL_VISION;
  
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
    return {
      anchors: Array.isArray(result.anchors) ? result.anchors : [],
      description: result.description || ''
    };
  } catch {
    console.error(`[Screenshot Analysis] JSON parse failed`);
    return { anchors: [], description: '' };
  }
}

// GEMINI VISION EDIT CALLER - Vision-capable for screenshots/PDFs
// ============================================================================
async function callGeminiVisionWithFiles(
  systemPrompt: string,
  userPrompt: string,
  images?: string[],
  jsonMode: boolean = true,
  timeoutMs: number = 120000
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  // 🛡️ Prompt-injection defense: always append the untrusted-input guard
  // to the system prompt. Idempotent — no-op if already applied.
  systemPrompt = withUserInputGuard(systemPrompt);

  // Use the configured Gemini vision model
  const model = GEMINI_MODEL_VISION;
  
  // Build content parts - text + optional images
  const parts: Array<{text?: string; inlineData?: {mimeType: string; data: string}}> = [];
  
  // Add images first if provided
  if (images && images.length > 0) {
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
        }
      }
    }
  }
  
  // Add text prompt
  parts.push({ text: userPrompt });
  

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
    timeoutMs, // default 120s; CREATE mode's polish pass passes a larger, budget-aware value
    'GEMINI_25_PRO_VISION'
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini Vision] HTTP ${response.status}: ${errorText}`);
    throw new Error(summarizeGeminiError(response.status, errorText));
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

function getFoundationBricks(): string[] {
  return [
    'products',
    'categories',
    'orders',
    'cart_items',
    'services',
    'bookings',
    'messages',
    'comments',
    'reviews',
    'forms',
    'customer_data',
    'users',
    'items'
  ];
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

  const systemPrompt = buildGeminiExecuteSystemPrompt(getFoundationBricks())
    .replace("{{ALLOWED_PACKAGES_LIST}}", formatPackagesForPrompt());

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
  assetIntent?: 'layout' | 'style' | 'content',
  uploadedAssets?: UploadedAsset[], // User uploaded assets from backend
  backendContext?: BackendContext, // Backend context for AI awareness
  extractedDocumentContent?: string, // Extracted text from PDFs/DOCX
  extractedVisionInspirations?: string, // Design inspiration from images
  projectId?: string,
  timeoutMs?: number // Optional override — CREATE mode's polish pass needs more than the 120s default
): Promise<{ files: Record<string, string>; summary: string }> {
  const SYSTEM_FILE_RE = /[\\/]_wakti_|[\\/]__wakti_/i; // Protected Wakti system files — never expose to AI
  const fileContext = Object.entries(currentFiles || {})
    .filter(([path]) => !SYSTEM_FILE_RE.test(path))
    .map(([path, content]) => `=== FILE: ${path} ===\n${content}`)
    .join("\n\n");

  const systemPrompt = buildGeminiExecuteSystemPrompt(getFoundationBricks())
    .replace("{{ALLOWED_PACKAGES_LIST}}", formatPackagesForPrompt());

  // Build image context if provided
  let imageContext = '';
  let pdfTextContent = '';
  let screenshotAnchorsContext = '';
  const assetIntentPrompt = buildAssetIntentPrompt(assetIntent);
  
  if (images && images.length > 0) {
    // STEP 1: Analyze screenshots to extract visible text anchors
    const screenshotImages = images.filter(img => 
      typeof img === 'string' && img.startsWith('data:image/')
    );
    
    if (screenshotImages.length > 0) {
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
        }
      } catch (err) {
        console.error(`[Edit Mode] Screenshot analysis failed:`, err);
      }
    }
    
    // Process PDFs - Extract actual content using Gemini
    const GEMINI_API_KEY_EDIT = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
    
    for (const imgData of images) {
      if (typeof imgData !== 'string') continue;
      
      // Check if it's a PDF with text marker
      if (imgData.startsWith('[PDF:')) {
        const endMarker = imgData.indexOf(']');
        if (endMarker > 0) {
          const pdfName = imgData.substring(5, endMarker);
          const pdfBase64Data = imgData.substring(endMarker + 1);
          
          // Extract text from PDF using Gemini Vision
          try {
            const pdfMatches = pdfBase64Data.match(/^data:([^;]+);base64,(.+)$/);
            if (pdfMatches && GEMINI_API_KEY_EDIT) {
              const pdfMimeType = pdfMatches[1];
              const pdfBase64 = pdfMatches[2];
              
              const extractResponse = await withTimeout(
                fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${getDocumentExtractionModel()}:generateContent`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY_EDIT,
                  },
                  body: JSON.stringify({
                    contents: [{
                      role: "user",
                      parts: [
                        { inlineData: { mimeType: pdfMimeType, data: pdfBase64 } },
                        { text: `Extract ALL text content from this PDF document. This appears to be a CV/Resume or important document.
                        
Return the COMPLETE text content including:
- Name and contact information
- Professional summary/objective
- Work experience (company names, job titles, dates, responsibilities)
- Education (degrees, institutions, dates)
- Skills (technical and soft skills)
- Certifications, awards, languages
- Any other relevant information

Format the output clearly with sections. Do NOT summarize - extract the FULL text.` }
                      ]
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                  }),
                }
              ),
              30000, // 30s timeout — PDF extraction should be fast; no timeout was causing indefinite hang
              'PDF_EXTRACTION'
              );
              
              if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                const extractedText = extractData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (extractedText) {
                  pdfTextContent += `

📄 **EXTRACTED CONTENT FROM ${pdfName}:**
${extractedText}

🚨 **CRITICAL**: Use this REAL data from the user's document above.
DO NOT make up fake information. Use EXACTLY what is in the extracted content.`;
                } else {
                  pdfTextContent += `\n\n📄 ATTACHED PDF: ${pdfName} - Could not extract text.`;
                }
              } else {
                console.error(`[Edit Mode] PDF extraction API error: ${extractResponse.status}`);
                pdfTextContent += `\n\n📄 ATTACHED PDF: ${pdfName} - Extraction failed.`;
              }
            } else {
              pdfTextContent += `\n\n📄 ATTACHED PDF: ${pdfName} - Please describe the content.`;
            }
          } catch (pdfErr) {
            console.error(`[Edit Mode] PDF extraction error:`, pdfErr);
            pdfTextContent += `\n\n📄 ATTACHED PDF: ${pdfName} - Extraction error.`;
          }
        }
      }
    }
    if (pdfTextContent) {
      imageContext = `\n\n🖼️ ATTACHED FILES:\n${pdfTextContent}\nUSE THE INFORMATION FROM THESE ATTACHMENTS TO BUILD THE PROJECT.\n`;
    }
  }
  if (assetIntentPrompt) {
    imageContext += `\n\n🧭 ${assetIntentPrompt}`;
  }

  const sharedProjectAwarenessContext = buildUnifiedProjectAwarenessContext({
    projectId,
    currentFiles,
    uploadedAssets,
    backendContext,
    documentContentBlocks: [extractedDocumentContent, pdfTextContent],
    visionInspiration: extractedVisionInspirations,
    assetIntentPrompt,
    includeProjectStructure: true,
  });

  const userMessage = `CURRENT CODEBASE:
${fileContext}
${imageContext}${sharedProjectAwarenessContext}${screenshotAnchorsContext}
USER REQUEST:
${userPrompt}

${userInstructions ? `ADDITIONAL INSTRUCTIONS:\n${userInstructions}\n\n` : ""}
Implement this request. Return the FULL content of every file that needs to be modified or created.
Return ONLY a valid JSON object with the structure shown in the system prompt.`;

  // Full rewrite edits run through the configured Gemini vision-capable model
  const text = await callGeminiVisionWithFiles(systemPrompt, userMessage, images, true, timeoutMs ?? 120000);
  
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
  const model = GEMINI_MODEL_SIMPLE;

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
  return await callGeminiWithModel(GEMINI_MODEL_SIMPLE, systemPrompt, userPrompt, false);
}

function extractJsonObject(text: string): string {
  const cleaned = (text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  if (jsonStart === -1) return cleaned;

  // Walk character-by-character to find the first COMPLETE balanced JSON object.
  // This prevents including stray text or a second JSON block that Gemini sometimes
  // appends after the main object — which causes "Unexpected non-whitespace after JSON".
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) {
        return cleaned.substring(jsonStart, i + 1); // First complete object — stop here
      }
    }
  }

  // No balanced object found — fall back to last } (original behaviour)
  const fallbackEnd = cleaned.lastIndexOf("}");
  return fallbackEnd > jsonStart ? cleaned.substring(jsonStart, fallbackEnd + 1) : cleaned;
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
  mode: 'create' | 'edit' | 'agent';
  prompt: string;
  initialStatus?: JobStatus;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; status: JobStatus }> {
  const { data, error } = await supabase
    .from("project_generation_jobs")
    .insert({
      project_id: params.projectId,
      user_id: params.userId,
      status: params.initialStatus || "running",
      mode: params.mode,
      prompt: params.prompt,
      metadata: params.metadata || {},
    })
    .select("id, status")
    .single();

  if (error) throw new Error(`DB_JOB_INSERT_FAILED: ${error.message}`);
  return { id: data.id, status: data.status };
}

async function updateJob(supabase: SupabaseAdminClient, jobId: string, patch: Partial<{ status: JobStatus; error: string | null; result_summary: string | null; metadata: Record<string, unknown> | null }>) {
  const { error } = await supabase
    .from("project_generation_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw new Error(`DB_JOB_UPDATE_FAILED: ${error.message}`);
}

type AgentJobTimelineEvent = {
  at: string;
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  note?: string;
};

function classifyAgentErrorCode(rawMessage: string): 'timeout' | 'rate_limit' | 'model_error' | 'network' | 'validation' | 'unknown' {
  const msg = (rawMessage || '').toLowerCase();
  if (!msg) return 'unknown';
  if (msg.includes('timeout') || msg.includes('504') || msg.includes('deadline') || msg.includes('budget')) return 'timeout';
  if (msg.includes('429') || msg.includes('rate') || msg.includes('quota')) return 'rate_limit';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('gateway') || msg.includes('cors')) return 'network';
  if (msg.includes('400') || msg.includes('invalid') || msg.includes('missing') || msg.includes('forbidden')) return 'validation';
  if (msg.includes('gemini') || msg.includes('model') || msg.includes('api error') || msg.includes('500') || msg.includes('503')) return 'model_error';
  return 'unknown';
}

function summarizeGeminiError(status: number, errorText: string): string {
  let detail = '';
  try {
    const parsed = JSON.parse(errorText);
    if (parsed?.error?.message) detail = String(parsed.error.message);
    else if (parsed?.message) detail = String(parsed.message);
  } catch {
    detail = errorText;
  }
  const compact = (detail || errorText || '').replace(/\s+/g, ' ').trim();
  return compact ? `Gemini API error: ${status} - ${compact.slice(0, 500)}` : `Gemini API error: ${status}`;
}

function classifyCreateErrorCode(rawMessage: string): 'timeout' | 'rate_limit' | 'validation' | 'model_error' | 'network' | 'json' | 'unknown' {
  const msg = (rawMessage || '').toLowerCase();
  if (!msg) return 'unknown';
  if (msg.includes('timeout') || msg.includes('deadline') || msg.includes('gateway') || msg.includes('budget')) return 'timeout';
  if (msg.includes('429') || msg.includes('rate') || msg.includes('quota')) return 'rate_limit';
  if (msg.includes('400') || msg.includes('invalid') || msg.includes('unsupported') || msg.includes('too many') || msg.includes('responsemimetype')) return 'validation';
  if (msg.includes('json') || msg.includes('unexpected token') || msg.includes('unterminated')) return 'json';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('cors')) return 'network';
  if (msg.includes('gemini') || msg.includes('model') || msg.includes('500') || msg.includes('503')) return 'model_error';
  return 'unknown';
}

function buildCreateFailureSummary(rawMessage: string): string {
  switch (classifyCreateErrorCode(rawMessage)) {
    case 'validation':
      return 'The AI provider rejected the build request before code was created.';
    case 'rate_limit':
      return 'The AI provider was busy and rate-limited this build.';
    case 'timeout':
      return 'The build ran out of safe time before finishing.';
    case 'json':
      return 'The AI returned an incomplete code payload.';
    case 'network':
      return 'The build lost connection while generating code.';
    case 'model_error':
      return 'The AI model failed while generating the project.';
    default:
      return 'The build failed before a working project could be saved.';
  }
}

function appendAgentTimeline(
  metadata: Record<string, unknown> | null | undefined,
  event: AgentJobTimelineEvent,
): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  const previous = Array.isArray(base.timeline) ? (base.timeline as AgentJobTimelineEvent[]) : [];
  const nextTimeline = [...previous, event].slice(-40);
  return {
    ...base,
    timeline: nextTimeline,
    currentStep: event.step,
    currentStepStatus: event.status,
    lastUpdateAt: event.at,
  };
}

async function patchJobMetadata(
  supabase: SupabaseAdminClient,
  jobId: string,
  patch: Record<string, unknown>,
  timelineEvent?: AgentJobTimelineEvent,
): Promise<Record<string, unknown>> {
  const { data: existing, error: readErr } = await supabase
    .from('project_generation_jobs')
    .select('metadata')
    .eq('id', jobId)
    .maybeSingle();

  if (readErr) throw new Error(`DB_JOB_METADATA_READ_FAILED: ${readErr.message}`);

  const currentMetadata = (existing?.metadata && typeof existing.metadata === 'object')
    ? { ...(existing.metadata as Record<string, unknown>) }
    : {};

  const merged = {
    ...currentMetadata,
    ...patch,
  };

  const finalMetadata = timelineEvent
    ? appendAgentTimeline(merged, timelineEvent)
    : merged;

  await updateJob(supabase, jobId, { metadata: finalMetadata });
  return finalMetadata;
}

async function replaceProjectFiles(supabase: SupabaseAdminClient, projectId: string, files: Record<string, string>) {
  const { error: delErr } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId);
  if (delErr) throw new Error(`DB_FILES_DELETE_FAILED: ${delErr.message}`);

  // 🧩 Resolve {{PROJECT_ID}} placeholder so the preview works immediately (Phase A — Item A5).
  const resolved = normalizeReactProjectHtmlFiles(resolveProjectPlaceholdersInFiles(files, projectId));

  const rows = Object.entries(resolved).map(([path, content]) => ({
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
  // 🧩 Resolve {{PROJECT_ID}} placeholder so the preview works immediately (Phase A — Item A5).
  const resolved = normalizeReactProjectHtmlFiles(resolveProjectPlaceholdersInFiles(files, projectId));

  const rows = Object.entries(resolved).map(([path, content]) => ({
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

type ToolCallPayload = Record<string, unknown>;
type ToolCallResult = Record<string, unknown>;
type ClaudeToolDefinition = {
  name: string;
  description: string;
  parameters?: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
};
type ClaudeToolCall = { id: string; name: string; input: Record<string, unknown> };
type ProjectUploadRow = {
  bucket_id: string | null;
  storage_path: string;
  filename: string;
  file_type: string | null;
};
type GeminiToolMessage = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
};
type GeminiFunctionResponseMessage = { functionResponse: { name: string; response: unknown } };
type GeminiTextPart = GeminiToolMessage & { text: string };
type GeminiFunctionCallPart = GeminiToolMessage & { functionCall: { name: string; args?: Record<string, unknown> } };
type ToolCallLogEntry = { tool: string; args: ToolCallPayload; result: ToolCallResult };

type AgentExecutionMode = 'surgical_edit' | 'design_rebuild';

const PRIMARY_EXISTING_FILE_EDIT_TOOL = 'morph_edit';
const EDIT_TOOL_NAMES = new Set(['morph_edit', 'morph_edit_auto', 'search_replace', 'write_file', 'insert_code']);

function isAgentExecutionMode(value: unknown): value is AgentExecutionMode {
  return value === 'surgical_edit' || value === 'design_rebuild';
}

function resolveAgentExecutionMode(promptText: string, requestedMode: unknown): AgentExecutionMode {
  if (isAgentExecutionMode(requestedMode)) return requestedMode;
  return isPremiumDesignRequest(promptText) ? 'design_rebuild' : 'surgical_edit';
}

function buildAgentExecutionModeInstructions(executionMode: AgentExecutionMode): string {
  if (executionMode === 'design_rebuild') {
    return `

## EXECUTION MODE: DESIGN REBUILD

You are in DESIGN REBUILD mode.

- Visual outcome is the priority.
- If the current hero, homepage, or target section is weak, you MUST rebuild the structure, not just patch classes.
- You may use write_file on an existing target file after reading it when a proper section rewrite is the minimum correct solution.
- Minimize unrelated edits, but do not stay artificially surgical when the layout itself is the problem.
`;
  }

  return `

## EXECUTION MODE: SURGICAL EDIT

You are in SURGICAL EDIT mode.

- Prefer morph_edit for existing files.
- Keep the change tight and specific.
- Do not rewrite large sections unless the request explicitly requires it.
`;
}

function normalizeAgentSelectedElement(value: unknown): AgentDebugContext['selectedElement'] {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const tagName = typeof record.tagName === 'string' ? record.tagName : null;
  const className = typeof record.className === 'string' ? record.className : null;
  const id = typeof record.id === 'string' ? record.id : null;
  const innerText = typeof record.innerText === 'string' ? record.innerText : null;
  const openingTag = typeof record.openingTag === 'string' ? record.openingTag : null;
  if (!tagName || !className || !id || !innerText || !openingTag) {
    return null;
  }

  const computedStyleValue = record.computedStyle;
  const rectValue = record.rect;
  let computedStyle: NonNullable<NonNullable<AgentDebugContext['selectedElement']>['computedStyle']> | undefined;
  if (computedStyleValue && typeof computedStyleValue === 'object') {
    const computedStyleRecord = computedStyleValue as Record<string, unknown>;
    computedStyle = {
      color: typeof computedStyleRecord.color === 'string' ? computedStyleRecord.color : '',
      backgroundColor: typeof computedStyleRecord.backgroundColor === 'string' ? computedStyleRecord.backgroundColor : '',
      fontSize: typeof computedStyleRecord.fontSize === 'string' ? computedStyleRecord.fontSize : '',
    };
  }
  let rect: NonNullable<NonNullable<AgentDebugContext['selectedElement']>['rect']> | undefined;
  if (rectValue && typeof rectValue === 'object') {
    const rectRecord = rectValue as Record<string, unknown>;
    rect = {
      top: typeof rectRecord.top === 'number' ? rectRecord.top : 0,
      left: typeof rectRecord.left === 'number' ? rectRecord.left : 0,
      width: typeof rectRecord.width === 'number' ? rectRecord.width : 0,
      height: typeof rectRecord.height === 'number' ? rectRecord.height : 0,
    };
  }

  return {
    tagName,
    className,
    id,
    innerText,
    openingTag,
    ...(computedStyle ? { computedStyle } : {}),
    ...(rect ? { rect } : {}),
  };
}

function extractVerificationSnippet(source: unknown): string {
  if (typeof source !== 'string') return '';
  return source
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line !== '// ... existing code ...')
    .slice(0, 6)
    .join('\n');
}

function getLoggedToolPath(entry: ToolCallLogEntry): string | null {
  const rawPath = entry.result?.path || entry.result?.filepath || entry.result?.deletedPath || entry.args?.path;
  if (typeof rawPath !== 'string' || rawPath.length === 0) return null;
  return normalizeFilePath(rawPath);
}

function getSuccessfulEditToolCalls(toolCallsLog: ToolCallLogEntry[]): ToolCallLogEntry[] {
  return toolCallsLog.filter(entry => EDIT_TOOL_NAMES.has(entry.tool) && entry.result?.success === true);
}

function collectFilesChangedFromToolCalls(toolCallsLog: ToolCallLogEntry[]): string[] {
  const filesChanged: string[] = [];
  for (const entry of toolCallsLog) {
    const deletedPath = typeof entry.result?.deletedPath === 'string' ? entry.result.deletedPath : null;
    if (entry.tool === 'delete_file' && entry.result?.success && deletedPath) {
      filesChanged.push(`(deleted) ${normalizeFilePath(deletedPath)}`);
      continue;
    }

    if (!EDIT_TOOL_NAMES.has(entry.tool) || entry.result?.success !== true) continue;
    const loggedPath = getLoggedToolPath(entry);
    if (loggedPath) filesChanged.push(loggedPath);
  }
  return filesChanged;
}

async function verifyPersistedFileChanges(params: {
  supabase: SupabaseAdminClient;
  projectId: string;
  baselineFiles: Record<string, string>;
  candidatePaths: string[];
}): Promise<string[]> {
  const { supabase, projectId, baselineFiles, candidatePaths } = params;

  const normalizedBaseline: Record<string, string> = {};
  for (const [rawPath, content] of Object.entries(baselineFiles || {})) {
    if (typeof content !== 'string') continue;
    const normalizedPath = normalizeFilePath(rawPath);
    normalizedBaseline[normalizedPath] = content;
  }

  const normalizedCandidates = [...new Set(
    (candidatePaths || [])
      .map((path) => (path || '').replace(/^\(deleted\)\s*/i, '').trim())
      .map((path) => normalizeFilePath(path))
      .filter((path) => Boolean(path))
  )];

  if (normalizedCandidates.length === 0) {
    return [];
  }

  const { data: rows, error } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', projectId)
    .in('path', normalizedCandidates);

  if (error) {
    console.warn('[Agent Mode] verifyPersistedFileChanges query failed:', error.message);
    return [];
  }

  const persistedMap: Record<string, string> = {};
  for (const row of rows || []) {
    if (typeof row.path === 'string' && typeof row.content === 'string') {
      persistedMap[normalizeFilePath(row.path)] = row.content;
    }
  }

  const verifiedChanged: string[] = [];
  for (const path of normalizedCandidates) {
    const beforeExists = Object.prototype.hasOwnProperty.call(normalizedBaseline, path);
    const afterExists = Object.prototype.hasOwnProperty.call(persistedMap, path);

    if (!beforeExists && afterExists) {
      verifiedChanged.push(path);
      continue;
    }

    if (beforeExists && !afterExists) {
      verifiedChanged.push(path);
      continue;
    }

    if (beforeExists && afterExists && normalizedBaseline[path] !== persistedMap[path]) {
      verifiedChanged.push(path);
    }
  }

  return verifiedChanged;
}

function getExpectedVerificationContent(entry: ToolCallLogEntry): string {
  if (entry.tool === 'morph_edit') {
    return extractVerificationSnippet(entry.args?.code_edit);
  }
  if (entry.tool === 'morph_edit_auto') {
    return extractVerificationSnippet(entry.args?.code_edit);
  }
  if (entry.tool === 'search_replace') {
    if (entry.result?.method === 'morph') {
      return extractVerificationSnippet(entry.args?.replace);
    }
    return typeof entry.args?.replace === 'string' ? entry.args.replace : '';
  }
  if (entry.tool === 'insert_code') {
    return typeof entry.args?.code === 'string' ? entry.args.code : '';
  }
  if (entry.tool === 'write_file') {
    return extractVerificationSnippet(entry.args?.content);
  }
  return '';
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeToolCallArgs(value: Record<string, unknown> | undefined): ToolCallPayload {
  return value ?? {};
}

function toGeminiParts(value: unknown): GeminiToolMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is GeminiToolMessage => typeof item === 'object' && item !== null);
}

function isGeminiTextPart(part: GeminiToolMessage): part is GeminiTextPart {
  return typeof part.text === 'string';
}

function isGeminiFunctionCallPart(part: GeminiToolMessage): part is GeminiFunctionCallPart {
  return typeof part.functionCall?.name === 'string';
}

function toGrepMatches(value: unknown): Array<{ file: string; content?: string; line?: number }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { file: string; content?: string; line?: number } => {
    return typeof item === 'object' && item !== null && typeof (item as { file?: unknown }).file === 'string';
  });
}

function toStrictGrepMatches(value: unknown): Array<{ file: string; line: number; content: string }> {
  return toGrepMatches(value).map((match) => ({
    file: match.file,
    line: typeof match.line === 'number' ? match.line : 0,
    content: typeof match.content === 'string' ? match.content : ''
  }));
}

function getToolResultContent(result: ToolCallResult): string | null {
  return typeof result.content === 'string' ? result.content : null;
}

async function readProjectFileContent(
  supabase: SupabaseAdminClient,
  projectId: string,
  path: string
): Promise<string | null> {
  const normalizedPath = normalizeFilePath(path);
  const { data } = await supabase
    .from('project_files')
    .select('content')
    .eq('project_id', projectId)
    .eq('path', normalizedPath)
    .maybeSingle();

  return typeof data?.content === 'string' ? data.content : null;
}

async function enforceEditToolPolicy(params: {
  toolName: string;
  args?: ToolCallPayload;
  projectId: string;
  supabase: SupabaseAdminClient;
  knownFiles: Set<string>;
  filesRead: Set<string>;
  fileContentCache: Map<string, string>;
  allFilesCache?: Record<string, string>;
  executionMode: AgentExecutionMode;
}): Promise<{ targetPath: string | null; blockResult?: Record<string, unknown> }> {
  const { toolName, args, projectId, supabase, knownFiles, filesRead, fileContentCache, allFilesCache, executionMode } = params;
  const targetPath = typeof args?.path === 'string' ? normalizeFilePath(args.path) : null;

  if (!targetPath || !EDIT_TOOL_NAMES.has(toolName)) {
    return { targetPath };
  }

  const isNewFileCreation = toolName === 'write_file' && !knownFiles.has(targetPath);
  const hadReadTargetFile = filesRead.has(targetPath);

  if (!knownFiles.has(targetPath) && toolName !== 'write_file') {
    return {
      targetPath,
      blockResult: {
        success: false,
        error: `BLOCKED: File "${targetPath}" does not exist in this project. You can only edit files that exist.`,
        hint: 'Use list_files to see all project files, then edit one of those.',
        availableFiles: [...knownFiles].slice(0, 10)
      }
    };
  }

  if (isNewFileCreation) {
    knownFiles.add(targetPath);
    return { targetPath };
  }

  let targetContent = fileContentCache.get(targetPath) || null;
  if (!targetContent) {
    targetContent = await readProjectFileContent(supabase, projectId, targetPath);
    if (targetContent) {
      fileContentCache.set(targetPath, targetContent);
      allFilesCache && (allFilesCache[targetPath] = targetContent);
    }
  }

  const hasReadAnyFile = filesRead.size > 0;
  const requiresStrictRead = !hasReadAnyFile && (toolName === 'morph_edit' || toolName === 'search_replace' || toolName === 'insert_code');

  if (requiresStrictRead && targetContent) {
    filesRead.add(targetPath);
  } else if (hasReadAnyFile && !filesRead.has(targetPath) && targetContent) {
    filesRead.add(targetPath);
  }

  if (toolName === 'write_file' && targetContent) {
    const existingLineCount = targetContent.split('\n').length;
    if (existingLineCount < 500) {
      if (executionMode === 'design_rebuild') {
        if (!hadReadTargetFile) {
          return {
            targetPath,
            blockResult: {
              success: false,
              error: `BLOCKED: Design rebuild mode can only overwrite "${targetPath}" after you read that exact file first.`,
              hint: 'Use read_file on the target file, confirm the current structure is weak, then rewrite it.'
            }
          };
        }
        return { targetPath };
      }

      return {
        targetPath,
        blockResult: {
          success: false,
          error: `BLOCKED: write_file cannot overwrite existing file "${targetPath}" because it has ${existingLineCount} lines. Existing files under 500 lines must use ${PRIMARY_EXISTING_FILE_EDIT_TOOL}.`,
          hint: `Read the file, then use ${PRIMARY_EXISTING_FILE_EDIT_TOOL} for surgical edits. Use search_replace only if Morph fails.`
        }
      };
    }
  }

  return { targetPath };
}

// Pre-generate images with Nano Banana 2 and store them in project storage
const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';
const _kieKeySource = Deno.env.get('KIE_AI_API_KEY') ? 'KIE_AI_API_KEY'
  : Deno.env.get('KIE_API_KEY') ? 'KIE_API_KEY'
  : Deno.env.get('NANO_BANANA_API_KEY') ? 'NANO_BANANA_API_KEY'
  : Deno.env.get('KIE_BEARER_TOKEN') ? 'KIE_BEARER_TOKEN'
  : 'NOT_FOUND';
const KIE_API_KEY = (
  Deno.env.get('KIE_AI_API_KEY') ||
  Deno.env.get('KIE_API_KEY') ||
  Deno.env.get('NANO_BANANA_API_KEY') ||
  Deno.env.get('KIE_BEARER_TOKEN') ||
  ''
).trim();
console.log(`[NanoBanana] Key source: ${_kieKeySource}, key length: ${KIE_API_KEY.length}`);
const KIE_NANO_BANANA_CALLBACK_URL = (Deno.env.get('KIE_NANO_BANANA_CALLBACK_URL') || '').trim();

interface PreFetchedImage {
  query: string;
  url: string;
  storedUrl: string;
  filename: string;
  uploadId?: string; // ID from project_uploads table for linking to products
}

type ProjectImageSurface = 'website' | 'web_app' | 'website_or_web_app';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectNanoBananaAspectRatio(query: string): string {
  const q = query.toLowerCase();

  if (/story|portrait|poster|person|model|vertical|phone/i.test(q)) return '9:16';
  if (/logo|icon|product shot|square|thumbnail|card/i.test(q)) return '1:1';
  if (/hero|banner|cover|landscape|wide|interior|exterior/i.test(q)) return '16:9';

  return 'auto';
}

function detectProjectImageSurface(prompt: string): ProjectImageSurface {
  const text = (prompt || '').toLowerCase();

  if (/\b(web\s*app|webapp|dashboard|admin\s*panel|admin|portal|platform|saas|application|app)\b/i.test(text) || /تطبيق|ويب\s*آب|لوحة\s*تحكم|منصة|بوابة/i.test(prompt)) {
    return 'web_app';
  }

  if (/\b(website|site|landing\s*page|homepage|marketing\s*site|portfolio\s*site|company\s*site)\b/i.test(text) || /موقع|صفحة\s*هبوط|صفحة\s*رئيسية/i.test(prompt)) {
    return 'website';
  }

  return 'website_or_web_app';
}

function buildProjectImageContextHint(surface: ProjectImageSurface): string {
  if (surface === 'web_app') {
    return 'Important context: this image is for a user web app interface. Keep it product-ready, digital-first, and suitable for modern UI usage.';
  }

  if (surface === 'website') {
    return 'Important context: this image is for a user website. Keep it web-ready, brand-safe, and suitable for real production pages.';
  }

  return 'Important context: this image is for a user website or web app. Keep it web-ready, product-safe, and suitable for real production UI/UX.';
}

function composeProjectImagePrompt(query: string, surface: ProjectImageSurface): string {
  const coreQuery = query.trim();
  if (!coreQuery) return coreQuery;

  const contextHint = buildProjectImageContextHint(surface);
  // No readable brand name/logo/signage text in the image — each image is generated by a
  // separate independent call with no shared memory, so any invented storefront sign, name
  // tag, or uniform embroidery will never match the real business name used in the site's
  // actual text/headings, or match another generated image in the same set.
  const noTextRule = 'Do not include any readable text, logo, signage, name tags, or branding in the image — no shop signs, no uniform embroidery, no wall text of any kind. Keep the scene free of invented text.';
  return `${coreQuery}\n\n${contextHint}\n\n${noTextRule}`;
}

function extractImageUrlsFromUnknown(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) return [trimmed];

    try {
      return extractImageUrlsFromUnknown(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap((entry) => extractImageUrlsFromUnknown(entry))));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const prioritizedKeys = ['resultUrls', 'images', 'image_urls', 'imageUrls', 'urls', 'output', 'data'];
    const collected: string[] = [];

    for (const key of prioritizedKeys) {
      if (record[key] !== undefined) {
        collected.push(...extractImageUrlsFromUnknown(record[key]));
      }
    }

    if (collected.length > 0) {
      return Array.from(new Set(collected));
    }

    for (const nested of Object.values(record)) {
      collected.push(...extractImageUrlsFromUnknown(nested));
    }

    return Array.from(new Set(collected));
  }

  return [];
}

function buildNanoBananaCallbackUrl(projectId: string, query: string, index: number): string | undefined {
  if (!KIE_NANO_BANANA_CALLBACK_URL) {
    return undefined;
  }

  try {
    const url = new URL(KIE_NANO_BANANA_CALLBACK_URL);
    url.searchParams.set('source', 'projects-generate');
    url.searchParams.set('project_id', projectId);
    url.searchParams.set('query_index', String(index));
    url.searchParams.set('query', query.slice(0, 120));
    return url.toString();
  } catch {
    return KIE_NANO_BANANA_CALLBACK_URL;
  }
}

async function waitForNanoBananaImage(taskId: string): Promise<string | null> {
  if (!KIE_API_KEY) return null;

  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${KIE_API_BASE_URL}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const raw = await response.text();
      console.warn(`[NanoBanana] recordInfo failed (${response.status}) for ${taskId}: ${raw}`);
      await sleep(1500);
      continue;
    }

    const payload = await response.json();
    const state = String(payload?.data?.state || '').toLowerCase();

    if (state === 'success') {
      const data = payload?.data || {};
      const urls = extractImageUrlsFromUnknown(data.resultJson ?? data.result ?? data.output ?? data);
      const firstUrl = urls.find((entry) => /^https?:\/\//i.test(entry)) || null;
      return firstUrl;
    }

    if (state === 'fail') {
      const failMsg = payload?.data?.failMsg || payload?.msg || 'Nano Banana task failed';
      console.warn(`[NanoBanana] task failed (${taskId}): ${failMsg}`);
      return null;
    }

    await sleep(Math.min(5000, 1500 + attempt * 250));
  }

  console.warn(`[NanoBanana] task timeout: ${taskId}`);
  return null;
}

async function preFetchAndStoreImages(
  supabase: SupabaseAdminClient,
  projectId: string,
  _userId: string,
  queries: string[],
  projectSurface: ProjectImageSurface
): Promise<PreFetchedImage[]> {
  const storedImages: PreFetchedImage[] = [];

  if (!KIE_API_KEY) {
    console.warn('[NanoBanana] KIE API key missing, skipping image generation prefetch');
    return storedImages;
  }

  console.log(`[NanoBanana] KIE key found (length=${KIE_API_KEY.length}), starting image generation`);
  
  const uniqueQueries = Array.from(new Set(
    queries
      .map((query) => query.trim())
      .filter((query) => query.length > 0)
  )).slice(0, 8);

  console.log(`[NanoBanana] Submitting ${uniqueQueries.length} image queries: ${uniqueQueries.join(' | ')}`);

  const taskSubmissions = await Promise.all(
    uniqueQueries.map(async (query, index) => {
      try {
        const aspectRatio = selectNanoBananaAspectRatio(query);
        const callbackUrl = buildNanoBananaCallbackUrl(projectId, query, index);
        const generationPrompt = composeProjectImagePrompt(query, projectSurface);

        const response = await fetch(`${KIE_API_BASE_URL}/jobs/createTask`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            model: 'nano-banana-2-lite',
            ...(callbackUrl ? { callBackUrl: callbackUrl } : {}),
            input: {
              prompt: generationPrompt,
              image_urls: [],
              aspect_ratio: aspectRatio,
            },
          }),
        });

        if (!response.ok) {
          const raw = await response.text();
          console.warn(`[PreFetch] createTask failed (${response.status}) for "${query}": ${raw}`);
          return null;
        }

        const payload = await response.json();
        const taskId = payload?.data?.taskId as string | undefined;
        if (!taskId) {
          console.warn(`[PreFetch] Missing taskId for "${query}"`);
          return null;
        }

        return { query, taskId };
      } catch (err) {
        console.warn(`[PreFetch] Error submitting task for "${query}":`, err);
        return null;
      }
    })
  );

  const readyTasks = taskSubmissions.filter((entry): entry is { query: string; taskId: string } => Boolean(entry));

  const resolvedImages = await Promise.all(
    readyTasks.map(async ({ query, taskId }) => {
      try {
        const imageUrl = await waitForNanoBananaImage(taskId);
        if (!imageUrl) {
          return null;
        }

        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
          return null;
        }

        const imgBlob = await imgRes.blob();
        const extMatch = imageUrl.match(/\.(png|jpg|jpeg|webp)(?:\?|$)/i);
        const ext = (extMatch?.[1] || 'jpg').toLowerCase();
        const filename = `prefetch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
        const storagePath = `${_userId}/${projectId}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('project-uploads')
          .upload(storagePath, imgBlob, {
            contentType: imgBlob.type || 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.warn(`[PreFetch] Upload failed for "${query}": ${uploadError.message}`);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('project-uploads')
          .getPublicUrl(storagePath);

        const storedUrl = urlData?.publicUrl || '';
        if (!storedUrl) {
          return null;
        }

        const { data: uploadData, error: insertError } = await supabase
          .from('project_uploads')
          .insert({
            project_id: projectId,
            user_id: _userId,
            filename,
            storage_path: storagePath,
            file_type: imgBlob.type || 'image/jpeg',
            size_bytes: imgBlob.size,
            bucket_id: 'project-uploads',
          })
          .select('id')
          .single();

        if (insertError) {
          console.warn(`[PreFetch] Failed to insert upload record: ${insertError.message}`);
        }

        return {
          query,
          url: imageUrl,
          storedUrl,
          filename,
          uploadId: uploadData?.id,
        } as PreFetchedImage;
      } catch (err) {
        console.warn(`[PreFetch] Error resolving task for "${query}":`, err);
        return null;
      }
    })
  );

  storedImages.push(...resolvedImages.filter((entry): entry is PreFetchedImage => Boolean(entry)));
  
  return storedImages;
}

// ============================================================================
// 🚀 POST-GENERATION BOOTSTRAPPING: Auto-seed backend data based on generated code
// ============================================================================
interface BootstrapResults {
  productsSeeded: number;
  servicesSeeded: number;
  imagesStored: number;
  collectionsCreated: string[];
}

async function bootstrapBackendData(
  supabase: SupabaseAdminClient,
  projectId: string,
  userId: string,
  files: Record<string, string>,
  prompt: string,
  preFetchedImages: PreFetchedImage[] = []
): Promise<BootstrapResults> {
  const results: BootstrapResults = {
    productsSeeded: 0,
    servicesSeeded: 0,
    imagesStored: preFetchedImages.length,
    collectionsCreated: []
  };

  // 🔧 FIX: This function used to auto-seed 4 fake sample products/services
  // (e.g. "Manicure $80", "Haircut & Style $150") into the live backend on every
  // create. That directly contradicted the explicit "do NOT hardcode any service
  // names, prices, or durations — show a friendly empty state" instruction already
  // required in every shop/booking prompt, and left real users with fictional
  // catalog data they never asked for. The backend now starts genuinely empty —
  // the user adds their own real products/services, matching what the generated
  // site's own empty-state copy already promises.
  results.imagesStored = preFetchedImages.length;
  void files;
  void prompt;
  void userId;

  return results;
}

// Detect if prompt is in Arabic
function isArabicPrompt(prompt: string): boolean {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(prompt);
}

// Get currency based on prompt language (Arabic = QAR default, English = USD)
function detectCurrency(prompt: string, lang?: string): string {
  if (lang === 'ar' || isArabicPrompt(prompt)) return 'QAR';
  return 'USD';
}

// Generate sample products based on prompt context - NOW LANGUAGE-AWARE
function generateSampleProducts(prompt: string, lang?: string): Array<Record<string, unknown>> {
  const isArabic = lang === 'ar' || isArabicPrompt(prompt);
  const currency = detectCurrency(prompt, lang);
  
  // Detect business type and generate relevant products
  if (/coffee|cafe|قهوة|كافيه/i.test(prompt)) {
    return isArabic ? [
      { name: 'إسبريسو', price: 15, currency, category: 'مشروبات ساخنة', description: 'قهوة غنية ومركزة', inStock: true },
      { name: 'كابتشينو', price: 20, currency, category: 'مشروبات ساخنة', description: 'إسبريسو مع رغوة الحليب', inStock: true },
      { name: 'لاتيه مثلج', price: 22, currency, category: 'مشروبات باردة', description: 'إسبريسو بارد مع الحليب', inStock: true },
      { name: 'كرواسون', price: 12, currency, category: 'معجنات', description: 'كرواسون طازج بالزبدة', inStock: true }
    ] : [
      { name: 'Espresso', price: 15, currency, category: 'Hot Drinks', description: 'Rich and bold single shot', inStock: true },
      { name: 'Cappuccino', price: 20, currency, category: 'Hot Drinks', description: 'Espresso with steamed milk foam', inStock: true },
      { name: 'Iced Latte', price: 22, currency, category: 'Cold Drinks', description: 'Chilled espresso with cold milk', inStock: true },
      { name: 'Croissant', price: 12, currency, category: 'Pastries', description: 'Freshly baked butter croissant', inStock: true }
    ];
  }
  
  // Abaya / Fashion / Clothing
  if (/abaya|عباية|عبايات|clothing|fashion|ملابس|أزياء/i.test(prompt)) {
    return isArabic ? [
      { name: 'عباية سوداء كلاسيك', price: 350, currency, category: 'عبايات', description: 'عباية سوداء أنيقة بقصة كلاسيكية', inStock: true },
      { name: 'عباية مطرزة', price: 450, currency, category: 'عبايات', description: 'عباية فاخرة بتطريز يدوي', inStock: true },
      { name: 'عباية كاجوال', price: 280, currency, category: 'عبايات', description: 'عباية يومية مريحة', inStock: true },
      { name: 'عباية سهرة', price: 650, currency, category: 'مناسبات', description: 'عباية فخمة للمناسبات الخاصة', inStock: true }
    ] : [
      { name: 'Classic Black Abaya', price: 350, currency, category: 'Abayas', description: 'Elegant classic cut black abaya', inStock: true },
      { name: 'Embroidered Abaya', price: 450, currency, category: 'Abayas', description: 'Luxury hand-embroidered abaya', inStock: true },
      { name: 'Casual Abaya', price: 280, currency, category: 'Abayas', description: 'Comfortable everyday abaya', inStock: true },
      { name: 'Evening Abaya', price: 650, currency, category: 'Occasions', description: 'Premium abaya for special events', inStock: true }
    ];
  }
  
  if (/electronics|tech|إلكترونيات|تقنية/i.test(prompt)) {
    return isArabic ? [
      { name: 'سماعات لاسلكية', price: 299, currency, category: 'صوتيات', description: 'عزل ضوضاء نشط', inStock: true },
      { name: 'ساعة ذكية', price: 599, currency, category: 'أجهزة ذكية', description: 'تتبع الصحة والإشعارات', inStock: true },
      { name: 'شاحن متنقل', price: 149, currency, category: 'إكسسوارات', description: 'سعة 20000 مللي أمبير', inStock: true },
      { name: 'سماعة بلوتوث', price: 249, currency, category: 'صوتيات', description: 'مقاومة للماء', inStock: true }
    ] : [
      { name: 'Wireless Earbuds', price: 299, currency, category: 'Audio', description: 'Active noise cancellation', inStock: true },
      { name: 'Smart Watch', price: 599, currency, category: 'Wearables', description: 'Health tracking & notifications', inStock: true },
      { name: 'Portable Charger', price: 149, currency, category: 'Accessories', description: '20000mAh fast charging', inStock: true },
      { name: 'Bluetooth Speaker', price: 249, currency, category: 'Audio', description: 'Waterproof outdoor speaker', inStock: true }
    ];
  }

  // GCC-SPECIFIC INDUSTRIES
  // Perfume / Oud / Bakhoor
  if (/perfume|عطر|عطور|oud|عود|bakhoor|بخور|fragrance/i.test(prompt)) {
    return isArabic ? [
      { name: 'عود كمبودي فاخر', price: 850, currency, category: 'عود', description: 'عود كمبودي طبيعي 100%', inStock: true },
      { name: 'دهن العود الملكي', price: 1200, currency, category: 'دهن عود', description: 'دهن عود معتق 10 سنوات', inStock: true },
      { name: 'بخور الدار', price: 180, currency, category: 'بخور', description: 'بخور فاخر للمنزل', inStock: true },
      { name: 'عطر مسك أبيض', price: 350, currency, category: 'عطور', description: 'مسك طبيعي نقي', inStock: true }
    ] : [
      { name: 'Premium Cambodian Oud', price: 850, currency, category: 'Oud', description: '100% natural Cambodian oud', inStock: true },
      { name: 'Royal Oud Oil', price: 1200, currency, category: 'Oud Oil', description: '10-year aged oud oil', inStock: true },
      { name: 'Home Bakhoor', price: 180, currency, category: 'Bakhoor', description: 'Premium home incense', inStock: true },
      { name: 'White Musk Perfume', price: 350, currency, category: 'Perfumes', description: 'Pure natural musk', inStock: true }
    ];
  }

  // Jewelry / Gold
  if (/jewelry|jewellery|gold|ذهب|مجوهرات|حلي/i.test(prompt)) {
    return isArabic ? [
      { name: 'طقم ذهب 21 قيراط', price: 4500, currency, category: 'أطقم', description: 'طقم كامل ذهب عيار 21', inStock: true },
      { name: 'سلسلة ذهب ناعمة', price: 1200, currency, category: 'سلاسل', description: 'سلسلة ذهب إيطالي', inStock: true },
      { name: 'خاتم ألماس', price: 8500, currency, category: 'خواتم', description: 'خاتم ألماس طبيعي', inStock: true },
      { name: 'أسورة ذهب', price: 2800, currency, category: 'أساور', description: 'أسورة ذهب عريضة', inStock: true }
    ] : [
      { name: '21K Gold Set', price: 4500, currency, category: 'Sets', description: 'Complete 21K gold set', inStock: true },
      { name: 'Fine Gold Chain', price: 1200, currency, category: 'Chains', description: 'Italian gold chain', inStock: true },
      { name: 'Diamond Ring', price: 8500, currency, category: 'Rings', description: 'Natural diamond ring', inStock: true },
      { name: 'Gold Bangle', price: 2800, currency, category: 'Bangles', description: 'Wide gold bangle', inStock: true }
    ];
  }

  // Dates / Arabic Sweets
  if (/dates|تمر|تمور|sweets|حلويات|baklava|بقلاوة|kunafa|كنافة/i.test(prompt)) {
    return isArabic ? [
      { name: 'تمر سكري فاخر', price: 120, currency, category: 'تمور', description: 'تمر سكري سعودي ممتاز', inStock: true },
      { name: 'تمر محشي لوز', price: 180, currency, category: 'تمور محشية', description: 'تمر محشي باللوز المحمص', inStock: true },
      { name: 'بقلاوة مشكلة', price: 85, currency, category: 'حلويات', description: 'تشكيلة بقلاوة فاخرة', inStock: true },
      { name: 'كنافة نابلسية', price: 65, currency, category: 'حلويات', description: 'كنافة بالجبنة الطازجة', inStock: true }
    ] : [
      { name: 'Premium Sukkari Dates', price: 120, currency, category: 'Dates', description: 'Premium Saudi Sukkari dates', inStock: true },
      { name: 'Almond Stuffed Dates', price: 180, currency, category: 'Stuffed Dates', description: 'Dates stuffed with roasted almonds', inStock: true },
      { name: 'Mixed Baklava', price: 85, currency, category: 'Sweets', description: 'Premium baklava assortment', inStock: true },
      { name: 'Nabulsi Kunafa', price: 65, currency, category: 'Sweets', description: 'Kunafa with fresh cheese', inStock: true }
    ];
  }
  
  // Default generic products - language aware
  return isArabic ? [
    { name: 'منتج مميز', price: 99, currency, category: 'مميز', description: 'الأكثر مبيعاً لدينا', inStock: true },
    { name: 'منتج كلاسيكي', price: 79, currency, category: 'شائع', description: 'المفضل لدى العملاء', inStock: true },
    { name: 'وصل حديثاً', price: 129, currency, category: 'جديد', description: 'أحدث إصداراتنا', inStock: true },
    { name: 'إصدار خاص', price: 149, currency, category: 'محدود', description: 'إصدار حصري محدود', inStock: true }
  ] : [
    { name: 'Premium Product', price: 99, currency, category: 'Featured', description: 'Our best-selling item', inStock: true },
    { name: 'Classic Item', price: 79, currency, category: 'Popular', description: 'Customer favorite', inStock: true },
    { name: 'New Arrival', price: 129, currency, category: 'New', description: 'Just launched this season', inStock: true },
    { name: 'Special Edition', price: 149, currency, category: 'Limited', description: 'Exclusive limited release', inStock: true }
  ];
}

// Generate sample services based on prompt context - NOW LANGUAGE-AWARE
function generateSampleServices(prompt: string, lang?: string): Array<Record<string, unknown>> {
  const isArabic = lang === 'ar' || isArabicPrompt(prompt);
  const currency = detectCurrency(prompt, lang);
  
  if (/barber|حلاق/i.test(prompt)) {
    return isArabic ? [
      { name: 'قص شعر', price: 50, currency, duration: 30, description: 'قصة شعر رجالية كلاسيكية' },
      { name: 'تهذيب اللحية', price: 30, currency, duration: 15, description: 'تشكيل وتهذيب اللحية' },
      { name: 'حلاقة بالموس', price: 60, currency, duration: 30, description: 'حلاقة تقليدية بالموس الحاد' },
      { name: 'باقة كاملة', price: 70, currency, duration: 45, description: 'قص شعر + لحية' }
    ] : [
      { name: 'Haircut', price: 50, currency, duration: 30, description: 'Classic men\'s haircut' },
      { name: 'Beard Trim', price: 30, currency, duration: 15, description: 'Shape and trim beard' },
      { name: 'Hot Towel Shave', price: 60, currency, duration: 30, description: 'Traditional straight razor shave' },
      { name: 'Hair & Beard Combo', price: 70, currency, duration: 45, description: 'Full grooming package' }
    ];
  }
  
  if (/salon|beauty|صالون|تجميل/i.test(prompt)) {
    return isArabic ? [
      { name: 'قص وتصفيف', price: 150, currency, duration: 60, description: 'قص وغسيل وتصفيف' },
      { name: 'صبغة شعر', price: 250, currency, duration: 90, description: 'صبغة كاملة' },
      { name: 'مانيكير', price: 80, currency, duration: 45, description: 'عناية بالأظافر' },
      { name: 'تنظيف بشرة', price: 180, currency, duration: 60, description: 'تنظيف عميق للبشرة' }
    ] : [
      { name: 'Haircut & Style', price: 150, currency, duration: 60, description: 'Cut, wash, and style' },
      { name: 'Hair Coloring', price: 250, currency, duration: 90, description: 'Full color treatment' },
      { name: 'Manicure', price: 80, currency, duration: 45, description: 'Nail care and polish' },
      { name: 'Facial Treatment', price: 180, currency, duration: 60, description: 'Deep cleansing facial' }
    ];
  }
  
  if (/clinic|doctor|عيادة|طبيب/i.test(prompt)) {
    return isArabic ? [
      { name: 'استشارة', price: 200, currency, duration: 30, description: 'استشارة طبية أولية' },
      { name: 'متابعة', price: 100, currency, duration: 15, description: 'زيارة متابعة' },
      { name: 'فحص شامل', price: 500, currency, duration: 60, description: 'فحص صحي شامل' },
      { name: 'تطعيم', price: 150, currency, duration: 15, description: 'تطعيم قياسي' }
    ] : [
      { name: 'Consultation', price: 200, currency, duration: 30, description: 'Initial medical consultation' },
      { name: 'Follow-up Visit', price: 100, currency, duration: 15, description: 'Progress check appointment' },
      { name: 'Health Checkup', price: 500, currency, duration: 60, description: 'Comprehensive health screening' },
      { name: 'Vaccination', price: 150, currency, duration: 15, description: 'Standard immunization' }
    ];
  }
  
  // Default generic services - language aware
  return isArabic ? [
    { name: 'خدمة أساسية', price: 100, currency, duration: 30, description: 'موعد قياسي' },
    { name: 'خدمة مميزة', price: 200, currency, duration: 60, description: 'جلسة ممتدة' },
    { name: 'خدمة سريعة', price: 75, currency, duration: 15, description: 'موعد سريع' },
    { name: 'باقة VIP', price: 350, currency, duration: 90, description: 'تجربة فاخرة كاملة' }
  ] : [
    { name: 'Basic Service', price: 100, currency, duration: 30, description: 'Standard appointment' },
    { name: 'Premium Service', price: 200, currency, duration: 60, description: 'Extended session' },
    { name: 'Express Service', price: 75, currency, duration: 15, description: 'Quick appointment' },
    { name: 'VIP Package', price: 350, currency, duration: 90, description: 'Full premium experience' }
  ];
}

// Section-tagged image query — each image is mapped to the section it belongs in
interface ImageSectionQuery {
  section: string;
  query: string;
}

// AI-powered image query extraction — returns section-tagged queries, never blind keyword matches
async function extractImageQueriesAI(prompt: string, hasPersonalPhoto: boolean = false): Promise<ImageSectionQuery[]> {
  const personalPhotoRule = hasPersonalPhoto
    ? `\n\n🚨 THE USER ALREADY UPLOADED A REAL PERSONAL PHOTO for this brief. That photo — not a generated image — is the hero/profile visual. Do NOT request a "hero" section image, and do NOT request any image containing a person's face or portrait. Only request an image for a genuinely separate need (e.g. a background/environment/atmosphere shot with no person in it) if the brief clearly implies one. If nothing separate is needed, return an empty sections array.`
    : '';
  const systemPrompt = `You are a web design image curator. Given a website brief, decide ONLY the images this SPECIFIC page will actually use, then return a JSON object with this structure:
{"sections": [
  {"section": "hero", "query": "..."}
]}${personalPhotoRule}

🔧 CRITICAL — DECIDE REAL NEED FIRST, DO NOT PAD:
Each image costs real money to generate. Only request an image for a section if the brief genuinely implies that section will exist on the page.
- A simple one-page personal/founder landing page usually only needs 1-3 images total (e.g. hero, maybe one supporting visual). Do NOT request "team", "portfolio_work", or "services_context" images for a single founder with no team/portfolio/services mentioned.
- A full multi-section business site (shop, agency, restaurant, multi-service company) can justify up to 6 images if those sections are actually implied by the brief.
- Never invent a section image just to "fill a slot." An unused generated image is a wasted cost — when in doubt, generate fewer, not more.

AVAILABLE SECTION TYPES (use only the ones that actually apply — do not include ones that don't):
- hero: The defining first-impression visual. Must perfectly match this brand's identity and tone. Almost always needed.
- proof_case_study: Specific to what they actually built or sold. Children's toy company → warm playful family setting. NOT a generic shopping app. Only if the brief implies real proof/case-study content.
- team: Founder or team in their real environment — executive workspace, collaboration, professional setting. Only if there's an actual team or "about us" beyond a single founder photo.
- portfolio_work: The KIND of work they do, shown through real context and environment. NEVER a design artifact. Only if there's a real portfolio/work-showcase section.
- location_atmosphere: The city or region they operate in — skyline, business district, architectural mood at night. Only if location/geography is a meaningful part of the brand story.
- services_context: Their service in action — a strategy session, a build meeting, a product launch moment. Only if there's an actual services section beyond a simple CTA.

CRITICAL RULES:
- Read the ENTIRE brief before writing any query. Understand what business this actually is.
- GCC country names (Qatar, Kuwait, UAE, Saudi Arabia) = geographic location ONLY — NEVER trigger football or sports images unless the brief is explicitly about a sports team or event.
- SINGLE FOUNDER, one-page personal landing page, no team/portfolio/services sections mentioned:
  → Generate ONLY hero (and optionally proof_case_study if there's a real product/story to show). That's it — 1-2 images total. Do NOT add team, portfolio_work, location_atmosphere, or services_context just because this is a "tech founder" brief.
- Tech company / software agency / startup with an ACTUAL team, portfolio, or services section described in the brief — use only the ones that genuinely apply:
  → hero: founder name or executive workspace description (e.g. "Kuwaiti tech founder at MacBook in modern glass office at night")
  → proof_case_study (only if real product/story exists): what the actual product served (e.g. children playing with toys, not a shopping app screen)
  → team (only if a real team/about-us exists): software engineers or executives in a dark creative office environment
  → portfolio_work (only if a real portfolio section exists): people in a product strategy meeting or code review session
  → location_atmosphere (only if location is a real part of the brand story): Kuwait City or Doha skyline at night from above
  → services_context (only if a real services section exists): tech team collaborating around monitors in a premium dark office

BANNED QUERY TERMS — these cause KIE to embed text watermarks directly into the image. NEVER use them:
❌ "UI mockup", "app mockup", "web app UI", "interface mockup", "dashboard mockup"
❌ "wireframe", "prototype", "figma", "design system", "mobile app UI", "app screenshot", "app design"
❌ Any term that describes a DESIGN ARTIFACT instead of a real scene

Instead — always describe a REAL SCENE or REAL ENVIRONMENT:
✅ "software engineers reviewing product on large monitor in modern dark office"
✅ "tech founder at MacBook in Kuwait penthouse workspace overlooking city lights"
✅ "startup team in strategy session around large table with multiple screens"
✅ "Kuwait City skyline at night with financial district towers lit up"

Every query must be specific enough to generate a contextually correct and contextually relevant image.
Return ONLY the JSON object, nothing else.`;

  const userPrompt = `Website brief (read fully to understand the business):\n${prompt.slice(0, 2500)}`;

  try {
    const raw = await callGeminiWithModel(GEMINI_MODEL_SIMPLE, systemPrompt, userPrompt, true, 2);
    const jsonStr = extractJsonObject(raw);
    const obj = jsonStr ? JSON.parse(jsonStr) as Record<string, unknown> : null;
    if (obj && Array.isArray((obj as Record<string, unknown>).sections)) {
      const sections = ((obj as Record<string, unknown>).sections as { section: string; query: string }[])
        .filter((s) => typeof s.section === 'string' && typeof s.query === 'string' && s.query.trim().length > 0)
        .slice(0, 6);
      if (sections.length > 0) return sections;
    }
  } catch (err) {
    console.warn('[ImageQuery] AI extraction failed, using fallback:', err);
  }
  if (hasPersonalPhoto) {
    // The user's real photo already covers the hero/profile slot — don't fall
    // back to a generic hero image that would just compete with it unused.
    return [];
  }
  return [
    { section: 'hero', query: 'professional modern business executive workspace interior dark premium' },
    { section: 'team', query: 'technology startup team collaborating on screens in modern office' },
    { section: 'location_atmosphere', query: 'modern Gulf city skyline at night financial district towers' },
  ];
}

// Entity facts database for grounding
const ENTITY_FACTS: Record<string, { name: string; colors: string[]; colorNames: string[]; nicknames?: string[]; keyPlayers?: string[]; achievements?: string[] }> = {
  'qatar': {
    name: 'Qatar National Football Team',
    colors: ['#7B252A', '#FFFFFF'],
    colorNames: ['maroon', 'white'],
    nicknames: ['Al-Annabi', 'The Maroons'],
    keyPlayers: ['Hassan Al-Haydos', 'Akram Afif', 'Almoez Ali'],
    achievements: ['2019 AFC Asian Cup Champions']
  },
  'saudi': {
    name: 'Saudi Arabia National Football Team',
    colors: ['#006C35', '#FFFFFF'],
    colorNames: ['green', 'white'],
    nicknames: ['The Green Falcons'],
  },
  'uae': {
    name: 'UAE National Football Team',
    colors: ['#FF0000', '#FFFFFF', '#00732F', '#000000'],
    colorNames: ['red', 'white', 'green', 'black'],
    nicknames: ['The Whites'],
  },
  'barcelona': {
    name: 'FC Barcelona',
    colors: ['#A50044', '#004D98'],
    colorNames: ['deep red', 'blue'],
    nicknames: ['Barça', 'Blaugrana'],
  },
  'real_madrid': {
    name: 'Real Madrid CF',
    colors: ['#FFFFFF', '#00529F'],
    colorNames: ['white', 'blue'],
    nicknames: ['Los Blancos', 'The Whites'],
  },
};

// Function to extract theme from user prompt
function extractThemeFromPrompt(prompt: string): string {
  
  // Check for specific entity mentions
  // Qatar patterns: qatar, qatari, القطري, القطر, قطر, العنابي, منتخب قطر
  if (/qatar|qatari|القطري|القطر|قطر|العنابي|منتخب\s*قطر/i.test(prompt)) {
    const facts = ENTITY_FACTS.qatar;
    return `🚨 QATAR NATIONAL TEAM THEME - MANDATORY COLORS (NON-NEGOTIABLE) 🚨
⚠️ YOU MUST USE THESE EXACT COLORS - NO EXCEPTIONS:
- PRIMARY COLOR: Maroon/Burgundy (#7B252A) - MUST be used for headers, buttons, accents, borders
- SECONDARY COLOR: White (#FFFFFF) - MUST be used for text on maroon backgrounds
- Background: Dark slate bg-[#0c0f14] with MAROON accents (NOT blue, NOT purple)
- Cards: bg-slate-900/50 with MAROON border (border-[#7B252A])
- Buttons: bg-[#7B252A] hover:bg-[#8B353A] text-white
- Icons/Accents: MAROON (#7B252A) - NOT any other color
- Text highlights: text-[#7B252A] for emphasis

🏆 QATAR TEAM FACTS (USE IN CONTENT):
- Team nickname: ${facts.nicknames?.join(', ')} (العنابي - The Maroons)
- Key players: ${facts.keyPlayers?.join(', ')}
- Achievement: ${facts.achievements?.[0]}
- Team colors are MAROON and WHITE - this is their identity

❌ DO NOT USE: Blue, Purple, Green, Orange as primary colors
✅ ONLY USE: Maroon (#7B252A) and White (#FFFFFF) as the main theme colors`;
  }
  
  if (/saudi|السعودية|الأخضر/i.test(prompt)) {
    return `SAUDI ARABIA THEME - MANDATORY COLORS:
- Primary: Green (#006C35) - Use for headers, buttons, accents
- Secondary: White (#FFFFFF) - Use for text, backgrounds
- Background: Dark with green accents
- Use these EXACT colors for Saudi Arabia.`;
  }
  
  if (/uae|emirates|الإمارات/i.test(prompt)) {
    return `UAE THEME - MANDATORY COLORS:
- Primary: Red (#FF0000), Green (#00732F), Black (#000000)
- Secondary: White (#FFFFFF)
- Use UAE flag colors appropriately.`;
  }
  
  if (/barcelona|barça|برشلونة/i.test(prompt)) {
    return `FC BARCELONA THEME - MANDATORY COLORS:
- Primary: Deep Red (#A50044) and Blue (#004D98)
- Use Blaugrana colors throughout.`;
  }
  
  if (/real madrid|ريال مدريد/i.test(prompt)) {
    return `REAL MADRID THEME - MANDATORY COLORS:
- Primary: White (#FFFFFF) with Blue (#00529F) accents
- Clean, elegant design befitting Los Blancos.`;
  }
  
  // Check for color mentions in prompt
  const colorMentions: string[] = [];
  if (/maroon|عنابي/i.test(prompt)) colorMentions.push('maroon (#7B252A)');
  if (/blue|أزرق/i.test(prompt)) colorMentions.push('blue (#3b82f6)');
  if (/green|أخضر/i.test(prompt)) colorMentions.push('green (#10b981)');
  if (/red|أحمر/i.test(prompt)) colorMentions.push('red (#ef4444)');
  if (/purple|بنفسجي/i.test(prompt)) colorMentions.push('purple (#8b5cf6)');
  if (/orange|برتقالي/i.test(prompt)) colorMentions.push('orange (#f97316)');
  if (/pink|وردي/i.test(prompt)) colorMentions.push('pink (#ec4899)');
  if (/gold|ذهبي/i.test(prompt)) colorMentions.push('gold (#eab308)');
  if (/black|أسود/i.test(prompt)) colorMentions.push('black (#000000)');
  if (/white|أبيض/i.test(prompt)) colorMentions.push('white (#FFFFFF)');
  
  if (colorMentions.length > 0) {
    return `USER SPECIFIED COLORS - MANDATORY:
- Use these colors mentioned in the prompt: ${colorMentions.join(', ')}
- Background: Dark slate bg-[#0c0f14] (MUST BE DARK)
- Apply the specified colors to headers, buttons, accents, and highlights
- Ensure good contrast with dark background`;
  }
  
  // Check for style/mood mentions
  if (/modern|عصري/i.test(prompt)) {
    return `MODERN STYLE THEME:
- Clean lines, minimal design
- Background: Dark slate bg-[#0c0f14]
- Accent: Indigo (#6366f1) and Purple (#8b5cf6)
- Modern sans-serif fonts, subtle shadows
- Strong hierarchy, premium whitespace, and a polished first impression
- Avoid generic starter layouts; use a confident, intentional composition`;
  }
  
  if (/elegant|أنيق|luxury|فاخر/i.test(prompt)) {
    return `ELEGANT/LUXURY THEME:
- Sophisticated design with gold accents
- Background: Deep dark bg-[#0c0f14]
- Accent: Gold (#eab308) and Cream
- Classic fonts, subtle animations
- Editorial composition, refined spacing, and premium product presentation
- Avoid cheap gradients, weak hero text, or flat placeholder sections`;
  }
  
  if (/playful|fun|مرح/i.test(prompt)) {
    return `PLAYFUL THEME:
- Vibrant, energetic design
- Background: Dark with colorful accents
- Multiple bright colors: Pink, Orange, Cyan
- Rounded corners, bouncy animations
- Keep the layout polished and well-composed, not childish or cluttered`;
  }
  
  // Default fallback - let AI decide based on context
  return `CONTEXT-AWARE THEME:
- Analyze the user's request and choose appropriate colors for the domain
- For sports: Use team colors if identifiable
- For restaurants: Warm, appetizing colors
- For tech/business: Professional blues and grays
- For creative: Vibrant, artistic colors
- Background: Dark slate bg-[#0c0f14] (MUST BE DARK)
- NEVER use white/light backgrounds
- Default to a premium, polished, brand-aware direction with strong hierarchy and wow-factor
- Use a clear visual baseline such as elegant brand site, modern commerce, polished service business, editorial showcase, or premium landing page depending on context
- If the prompt is vague, fill the gap with taste and strong composition, not generic filler or empty gray hero sections`;
}

// THEME_PRESETS moved to ./prompts/themes.ts (imported at top of file).

// 🧠 THREE-LAYER PROMPT ARCHITECTURE (see ./prompts/capabilities/index.ts)
// Layer 1 (CORE): identity + output format + defensive coding + theme wiring
// Layer 2 (MANIFEST): short capability menu
// Layer 3 (DOCS): injected via {{CAPABILITY_DOCS}} — only when detected

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

// Dead prompt `_GEMINI_EDIT_FULL_REWRITE_PROMPT` deleted (Item 5). It was
// unused (prefix `_`) and not referenced anywhere. Git history preserves it.

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

  // 🛡️ Prompt-injection defense: always append the untrusted-input guard.
  systemPrompt = withUserInputGuard(systemPrompt);
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
// THE FIXER - final auto-fix attempt
// ============================================================================
// When the primary coder fails 3 times, The Fixer gets one shot with full context.
// Backed by a premium coding model via streaming. Model choice is an internal
// implementation detail and MUST NOT be surfaced to users.
// ============================================================================

// FIXER_SYSTEM_PROMPT moved to ./prompts/fixer.ts (imported at top of file).

async function callClaudeOpus4Fixer(
  systemPrompt: string, 
  userPrompt: string,
  tools: ClaudeToolDefinition[]
): Promise<{ content: string; toolCalls?: ClaudeToolCall[] }> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

  // 🛡️ Prompt-injection defense: always append the untrusted-input guard.
  systemPrompt = withUserInputGuard(systemPrompt);


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
    throw new Error(`Fixer API error: ${anthropicResponse.status}`);
  }

  // Read streaming response
  const reader = anthropicResponse.body?.getReader();
  if (!reader) throw new Error("No response body from Fixer");

  const decoder = new TextDecoder();
  let fullContent = "";
  const toolCalls: ClaudeToolCall[] = [];
  let currentToolUse: ClaudeToolCall | null = null;
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


  return { content: fullContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
}

// Claude 3.7 Sonnet with STREAMING to avoid 504 gateway timeout
async function callClaudeStreaming(systemPrompt: string, userPrompt: string, images: ImageAttachment[] | undefined): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

  // 🛡️ Prompt-injection defense: always append the untrusted-input guard.
  systemPrompt = withUserInputGuard(systemPrompt);

  // Build content array (text + optional images for vision)
  const contentBlocks: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> = [];
  
  // Add images first if present (vision mode)
  if (images && images.length > 0) {
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
  if (!userId) {
    const createResponseEarly = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return createResponseEarly({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const body: RequestBody = await req.json();
    const action = body.action || 'start';
    const jobId = (body.jobId || '').toString().trim();
    const projectId = (body.projectId || '').toString().trim();
    const mode = body.mode || 'create';

    const userAuthHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const supabase = getAdminClient(userAuthHeader);

    // Helper to create consistent responses
    const createResponse = (data: unknown, status = 200) => {
      return new Response(JSON.stringify(data), { 
        status,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    };

    // Trial gate: ai_coder — 5 prompts for free users (only on 'start' — status/get_files are reads)
    if (action === 'start') {
      const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPA_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminForTrial = createClient(SUPA_URL, SUPA_SVC);
      const trial = await checkAndConsumeTrialToken(adminForTrial, userId, 'ai_coder', 5);
      if (!trial.allowed) {
        return new Response(JSON.stringify({
          ok: false,
          ...buildTrialErrorPayload('ai_coder', trial),
          message: 'Free trial allows 5 prompts. Subscribe for unlimited access!',
          messageAr: 'التجربة المجانية تسمح بـ 5 أوامر فقط. اشترك للحصول على وصول غير محدود!',
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'status') {
      if (!jobId) return createResponse({ ok: false, error: 'Missing jobId' }, 400);
      const { data, error } = await supabase
        .from('project_generation_jobs')
        .select('id, project_id, status, mode, prompt, error, result_summary, metadata, created_at, updated_at')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw new Error(`DB_JOB_STATUS_FAILED: ${error.message}`);
      if (!data) return createResponse({ ok: false, error: 'Job not found' }, 404);
      
      // STALE JOB DETECTION: If job is "running" but hasn't updated in 8+ minutes, mark it failed
      if (data.status === 'running') {
        const updatedAt = new Date(data.updated_at).getTime();
        const now = Date.now();
        const staleThresholdMs = 8 * 60 * 1000; // 8 minutes
        if (now - updatedAt > staleThresholdMs) {
          console.warn(`[Status] Job ${jobId} is stale (no update for ${Math.round((now - updatedAt) / 1000)}s), marking failed`);
          const metadata = (data.metadata && typeof data.metadata === 'object')
            ? (data.metadata as Record<string, unknown>)
            : {};
          const draftSaved = metadata.draftSaved === true;
          const recoveredSummary = typeof data.result_summary === 'string' && data.result_summary.trim().length > 0
            ? data.result_summary
            : 'Working draft saved. Premium polish stopped early, so the saved draft was kept.';
          if (draftSaved) {
            await updateJob(supabase, jobId, {
              status: 'succeeded',
              error: null,
              result_summary: recoveredSummary,
            });
            const recoveredMetadata = await patchJobMetadata(
              supabase,
              jobId,
              {
                createStage: 'done',
                stalledAfterDraft: true,
                recoveredFromStaleRun: true,
                polishApplied: metadata.polishApplied === true,
              },
              {
                at: new Date().toISOString(),
                step: 'done',
                status: 'completed',
                note: recoveredSummary,
              },
            );
            return createResponse({
              ok: true,
              job: { ...data, status: 'succeeded', error: null, result_summary: recoveredSummary, metadata: recoveredMetadata },
            });
          }
          await updateJob(supabase, jobId, { 
            status: 'failed', 
            error: 'Job stalled - worker may have crashed. Please try again.',
            result_summary: null 
          });
          return createResponse({ 
            ok: true, 
            job: { ...data, status: 'failed', error: 'Job stalled - worker may have crashed. Please try again.' } 
          });
        }
      }
      
      return createResponse({ ok: true, job: data });
    }

    if (action === 'pause') {
      if (!jobId) return createResponse({ ok: false, error: 'Missing jobId' }, 400);

      const { data: jobRow, error: jobErr } = await supabase
        .from('project_generation_jobs')
        .select('id, project_id, user_id, status, metadata')
        .eq('id', jobId)
        .maybeSingle();
      if (jobErr) throw new Error(`DB_JOB_PAUSE_LOOKUP_FAILED: ${jobErr.message}`);
      if (!jobRow) return createResponse({ ok: false, error: 'Job not found' }, 404);
      if (jobRow.user_id !== userId) return createResponse({ ok: false, error: 'Forbidden' }, 403);

      if (jobRow.status !== 'running' && jobRow.status !== 'queued') {
        return createResponse({ ok: false, error: 'Only running or queued jobs can be paused' }, 409);
      }

      const nowIso = new Date().toISOString();
      await updateJob(supabase, jobId, { status: 'paused', result_summary: 'Paused by user request', error: null });
      await patchJobMetadata(
        supabase,
        jobId,
        {
          pauseRequested: true,
          pausedByUser: true,
          pausedAt: nowIso,
        },
        {
          at: nowIso,
          step: 'paused',
          status: 'completed',
          note: 'Paused by user request',
        },
      );

      return createResponse({ ok: true, job: { ...jobRow, status: 'paused' } });
    }

    if (action === 'resume') {
      if (!jobId) return createResponse({ ok: false, error: 'Missing jobId' }, 400);

      const { data: pausedJob, error: pausedErr } = await supabase
        .from('project_generation_jobs')
        .select('id, project_id, user_id, status, mode, prompt, metadata')
        .eq('id', jobId)
        .maybeSingle();
      if (pausedErr) throw new Error(`DB_JOB_RESUME_LOOKUP_FAILED: ${pausedErr.message}`);
      if (!pausedJob) return createResponse({ ok: false, error: 'Job not found' }, 404);
      if (pausedJob.user_id !== userId) return createResponse({ ok: false, error: 'Forbidden' }, 403);

      if (pausedJob.mode !== 'agent') {
        return createResponse({ ok: false, error: 'Only agent jobs can be resumed' }, 409);
      }

      if (pausedJob.status !== 'paused' && pausedJob.status !== 'failed') {
        return createResponse({ ok: false, error: 'Job is not paused or failed' }, 409);
      }

      body.resumeFromJobId = pausedJob.id;
      body.projectId = pausedJob.project_id;
      body.prompt = (body.prompt || pausedJob.prompt || '').toString();
      if (!body.prompt) {
        return createResponse({ ok: false, error: 'Missing prompt for resume' }, 400);
      }
    }

    if (action === 'get_files') {
      if (!projectId) return createResponse({ ok: false, error: 'Missing projectId' }, 400);
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
      return createResponse({ ok: true, files });
    }

    // ========================================================================
    // MODE HANDLING: create | edit | plan | execute | chat
    // ========================================================================
    // 🛡️ Sanitize untrusted user input at the boundary (Phase A — Item A4).
    // Strips role-marker smuggling, jailbreak directives, control chars, and
    // caps length. Arabic / RTL text is preserved.
    const prompt = sanitizeUserInput(body.prompt, { label: 'prompt', maxLength: 16000 });
    const theme = (body.theme || 'none').toString();
    const assets = Array.isArray(body.assets) ? body.assets : [];
    const userInstructions = sanitizeUserInput(body.userInstructions, { label: 'userInstructions', maxLength: 8000 });
    const images = body.images;
    const assetIntent = normalizeAssetIntent(body.assetIntent);
    const planToExecute = (body.planToExecute || '').toString();
    const uploadedAssets = Array.isArray(body.uploadedAssets) ? body.uploadedAssets : [];
    const backendContext = body.backendContext;
    const debugContext = body.debugContext;  // NEW: Captured errors from preview
    const requestedExecutionMode = body.executionMode;
    const lang = (body.lang || 'en').toString(); // Language for content generation (ar/en)
    
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
    const assetIntentPrompt = buildAssetIntentPrompt(assetIntent);
    
    // ========================================================================
    // PROCESS UPLOADED ASSETS - Extract text from PDFs/DOCX, analyze images
    // ========================================================================
    let documentContentStr = '';
    let visionInspirationStr = '';
    const shouldRunAssetPipeline = shouldProcessUploadedAssets({
      mode,
      prompt,
      images,
      uploadedAssets,
      assets,
      assetIntent,
    });
    
    if (shouldRunAssetPipeline) {
      // BULLETPROOF SERVER-SIDE FETCH: ALWAYS fetch from DB using service-role client.
      // Client-provided URLs may be broken (public URLs that 400). Service-role signed URLs always work.
      if (projectId) {
        try {
          const { data: dbUploads, error: dbErr } = await supabase
            .from('project_uploads')
            .select('filename, storage_path, file_type, bucket_id')
            .eq('project_id', projectId);
          
          if (dbErr) {
            console.error(`[Assets] DB fetch error:`, dbErr);
          } else if (dbUploads && dbUploads.length > 0) {
            // Clear client-provided assets — replace with server-side resolved URLs
            uploadedAssets.length = 0;
            for (const upload of dbUploads as ProjectUploadRow[]) {
              const bucket = upload.bucket_id || 'project-assets';
              const storagePath = upload.storage_path;
              // 🔧 FIX: Previously this used a 1-hour signed URL, which then got
              // permanently hardcoded into the generated site's static <img src>.
              // The link died after an hour, breaking the image forever for every
              // future visitor. `project-uploads` is a bucket we already know
              // serves real, permanent public URLs (it's what AI-generated images
              // use). So instead of a temporary signed link, copy the file into
              // that bucket once and use its permanent public URL everywhere.
              const permanentPath = `${userId}/${projectId}/asset-${upload.storage_path.split('/').pop()}`;
              let resolvedUrl = '';
              try {
                const { data: existingHead } = await supabase.storage
                  .from('project-uploads')
                  .list(`${userId}/${projectId}`, { search: permanentPath.split('/').pop() });
                const alreadyCopied = Array.isArray(existingHead) && existingHead.some((f) => permanentPath.endsWith(f.name));

                if (!alreadyCopied) {
                  const { data: fileBlob, error: downloadErr } = await supabase.storage
                    .from(bucket)
                    .download(storagePath);
                  if (downloadErr || !fileBlob) {
                    throw downloadErr || new Error('Empty file download');
                  }
                  const { error: copyUploadErr } = await supabase.storage
                    .from('project-uploads')
                    .upload(permanentPath, fileBlob, {
                      contentType: upload.file_type || fileBlob.type || 'application/octet-stream',
                      upsert: true,
                    });
                  if (copyUploadErr) throw copyUploadErr;
                }

                const { data: pubData } = supabase.storage.from('project-uploads').getPublicUrl(permanentPath);
                resolvedUrl = pubData.publicUrl;
              } catch (copyErr) {
                console.warn(`[Assets] Permanent copy failed for ${upload.filename}, falling back to signed URL:`, copyErr);
                // Last-resort fallback: a working (if temporary) signed URL beats no image at all.
                const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
                resolvedUrl = signedData?.signedUrl || '';
              }

              if (resolvedUrl) {
                uploadedAssets.push({
                  filename: upload.filename,
                  url: resolvedUrl,
                  file_type: upload.file_type
                });
              }
            }
          }
        } catch (fetchErr) {
          console.error(`[Assets] Exception fetching from DB:`, fetchErr);
        }
      }
      
      // FALLBACK #2: If still empty, check assets[] URLs for PDF/doc extensions
      if (uploadedAssets.length === 0 && assets.length > 0) {
        const docExtensions = ['.pdf', '.docx', '.doc', '.txt', '.rtf'];
        const imgExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        for (const url of assets) {
          if (typeof url !== 'string') continue;
          const lowerUrl = url.toLowerCase().split('?')[0];
          const filename = lowerUrl.split('/').pop() || 'file';
          let file_type: string | null = null;
          if (docExtensions.some(ext => lowerUrl.endsWith(ext))) {
            if (lowerUrl.endsWith('.pdf')) file_type = 'application/pdf';
            else if (lowerUrl.endsWith('.docx')) file_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (lowerUrl.endsWith('.doc')) file_type = 'application/msword';
            else if (lowerUrl.endsWith('.txt')) file_type = 'text/plain';
            else if (lowerUrl.endsWith('.rtf')) file_type = 'application/rtf';
            uploadedAssets.push({ filename, url, file_type });
          } else if (imgExtensions.some(ext => lowerUrl.endsWith(ext))) {
            file_type = 'image/' + (lowerUrl.endsWith('.jpg') ? 'jpeg' : lowerUrl.split('.').pop());
            uploadedAssets.push({ filename, url, file_type });
          }
        }
      }
      
      const geminiApiKeyForAssets = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
      if (uploadedAssets.length > 0 && geminiApiKeyForAssets) {
        try {
          const { documentContent, visionInspirations } = await processUploadedAssets(
            uploadedAssets as Array<{ filename: string; url: string; file_type: string | null }>,
            geminiApiKeyForAssets
          );
          documentContentStr = documentContent;
          visionInspirationStr = visionInspirations;
        } catch (err) {
          console.error('[Assets] Error processing assets:', err);
        }
      } else {
        console.warn(`[Assets] SKIPPED extraction: uploadedAssets=${uploadedAssets.length}, hasGeminiKey=${!!geminiApiKeyForAssets}`);
      }
    } else {
      console.log('[Assets] Skipped heavy asset pipeline for text-only request');
    }

    // CHAT MODE: Smart Q&A - answers questions OR returns a plan if code changes are needed
    // Now with SMART MODEL SELECTION + CONTEXT OPTIMIZATION (file names only, not content)
    if (mode === 'chat') {
      const currentFiles = body.currentFiles || {};
      const fileCount = Object.keys(currentFiles).length;
      
      // 🚀 SMART CONTEXT: Send file contents ONLY for relevant source files.
      // Saves tokens by skipping bundled assets, node_modules, lockfiles, images, etc.
      // Keeps accuracy because the AI gets the actual code it needs to edit.
      const SOURCE_EXTENSIONS = /\.(jsx?|tsx?|css|scss|html|json|md|svg)$/i;
      const SKIP_PATTERNS = /(node_modules|\.git|dist|build|coverage|\.lock|package-lock|yarn\.lock|\.min\.(js|css)$|\.map$)/i;
      const SYSTEM_FILE_PATTERN = /[\\/]_wakti_|[\\/]__wakti_/i; // Protected Wakti system files — never expose to AI
      const MAX_FILE_BYTES = 50_000; // ~12K tokens per file cap
      const MAX_TOTAL_BYTES = 400_000; // ~100K tokens total cap (well under 1M context)

      let filesContentStr = '';
      let totalBytes = 0;
      const includedFiles: string[] = [];
      const skippedFiles: string[] = [];

      for (const [path, content] of Object.entries(currentFiles)) {
        if (typeof content !== 'string') { skippedFiles.push(path); continue; }
        if (SKIP_PATTERNS.test(path)) { skippedFiles.push(path); continue; }
        if (SYSTEM_FILE_PATTERN.test(path)) { continue; } // Silently exclude — never shown to AI
        if (!SOURCE_EXTENSIONS.test(path)) { skippedFiles.push(path); continue; }

        const size = content.length;
        if (size > MAX_FILE_BYTES) {
          filesContentStr += `\n--- FILE: ${path} (${size} bytes — truncated) ---\n${content.slice(0, MAX_FILE_BYTES)}\n...[truncated]...\n---------------------------\n`;
          totalBytes += MAX_FILE_BYTES;
          includedFiles.push(path);
        } else if (totalBytes + size < MAX_TOTAL_BYTES) {
          filesContentStr += `\n--- FILE: ${path} ---\n${content}\n---------------------------\n`;
          totalBytes += size;
          includedFiles.push(path);
        } else {
          // Over budget — include name only so AI knows it exists
          skippedFiles.push(path);
        }
      }

      const filesStr = `📁 Project Files (${fileCount} total | ${includedFiles.length} included with content | ${skippedFiles.length} name-only):

INCLUDED (full content above): ${includedFiles.join(', ')}

NAME-ONLY (ask via read_file tool if needed): ${skippedFiles.join(', ')}

${filesContentStr}`;

      // ========================================================================
      // 🎯 FEATURE CONTRACT PRE-PASS (Project-aware + amateur-prompt aware)
      // Detects common feature requests and injects explicit end-to-end wiring
      // requirements so the AI cannot return a partial/orphan implementation.
      // ========================================================================
      const allPaths = Object.keys(currentFiles);
      const findFile = (candidates: string[]): string | null => {
        for (const c of candidates) {
          const hit = allPaths.find(p => p.toLowerCase() === c.toLowerCase());
          if (hit) return hit;
        }
        // Fuzzy fallback — match by basename
        for (const c of candidates) {
          const base = c.split('/').pop()!.toLowerCase();
          const hit = allPaths.find(p => p.toLowerCase().endsWith('/' + base) || p.toLowerCase() === '/' + base);
          if (hit) return hit;
        }
        return null;
      };
      const entryFile =
        findFile(['/index.js', '/src/index.js', '/index.jsx', '/src/index.jsx', '/src/main.jsx', '/main.jsx']) || '/index.js';
      const appFile =
        findFile(['/App.js', '/App.jsx', '/src/App.js', '/src/App.jsx', '/src/App.tsx']) || '/App.js';
      const headerFile =
        findFile(['/components/Header.jsx', '/components/Header.js', '/components/Navbar.jsx', '/components/Navigation.jsx', '/src/components/Header.jsx']);
      const dataFile =
        findFile(['/utils/mockData.js', '/utils/data.js', '/data/mockData.js', '/src/utils/mockData.js']);
      const contextDirFiles = allPaths.filter(p => /\/context(s)?\//i.test(p));
      const sharedProjectAwarenessStr = buildUnifiedProjectAwarenessContext({
        projectId,
        currentFiles,
        uploadedAssets,
        backendContext,
        documentContentBlocks: [documentContentStr],
        visionInspiration: visionInspirationStr,
        assetIntentPrompt,
        includeProjectStructure: true,
        includeAssetPickerRules: uploadedAssets.length > 1,
      });

      const promptLower = (prompt || '').toLowerCase();
      const isLanguageToggle =
        /\b(language|lang|bilingual|i18n|rtl)\s*(toggle|switch|button|selector|picker|dropdown|menu|support)?\b/i.test(promptLower) ||
        /\b(english|en)\s*(\/|and|or|&)\s*(arabic|ar)\b/i.test(promptLower) ||
        /\b(arabic|ar)\s*(\/|and|or|&)\s*(english|en)\b/i.test(promptLower) ||
        /\b(bilingual|multilingual|internationalization|localization)\b/i.test(promptLower) ||
        /\b(add|enable|support)\s+(arabic|rtl|right[- ]to[- ]left)\b/i.test(promptLower) ||
        /عربي\s*(و|\/)?\s*انجليزي|زر\s*اللغة|قائمة\s*اللغة/i.test(prompt || '');

      const isDarkModeToggle =
        /\b(dark|light|night|day)\s*(mode|theme)\s*(toggle|switch|button)?\b/i.test(promptLower) ||
        /\b(theme)\s*(toggle|switch|button)\b/i.test(promptLower) ||
        /\b(toggle|switch)\s+(between\s+)?(dark|light|theme|night|day)\b/i.test(promptLower);

      let featureContractStr = '';
      if (isLanguageToggle) {
        featureContractStr = `

🎯 FEATURE CONTRACT — LANGUAGE TOGGLE (English / Arabic + RTL) using react-i18next
The user wants a WORKING bilingual toggle. Use react-i18next — it is ALREADY installed as a package.

PHASE 1 ONLY — Create foundation files (do not translate every component yet):

REQUIRED FILES:
1. CREATE  /src/i18n.js  — configure i18next:
   import i18n from 'i18next'; import { initReactI18next } from 'react-i18next';
   Resources must include 'en' and 'ar' namespaces with translation keys for all strings in the files below.
   Add: i18n.on('languageChanged', lng => { document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'; document.documentElement.lang = lng; });
   Call i18n.use(initReactI18next).init({ resources, fallbackLng: 'en', lng: 'en', interpolation: { escapeValue: false } });
   export default i18n;

2. UPDATE  ${entryFile}  — add: import './i18n'; (BEFORE the ReactDOM.render / createRoot call — no Provider needed, i18next is global)

3. UPDATE  ${appFile}  — add: import { useTranslation } from 'react-i18next'; const { t, i18n } = useTranslation();
   Render a VISIBLE toggle button in the top nav/header (e.g. "EN" ↔ "عر") that calls i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
   Replace hardcoded strings in THIS file with t('key') calls.

${headerFile ? `4. UPDATE  ${headerFile}  — add useTranslation; replace hardcoded strings with t('key'); add the translation keys to i18n.js resources.` : ''}

HARD RULES:
- Use react-i18next. Do NOT create a custom LanguageContext — react-i18next is already available.
- The toggle button MUST be visible in the nav/header.
- document.documentElement.dir MUST flip between 'ltr' and 'rtl' when language changes.
- PHASE 1 ONLY: these ${headerFile ? '4' : '3'} files maximum. A second automatic pass translates remaining components.
- All files above MUST appear in the "codeChanges" array of your JSON plan.
`;
      } else if (isDarkModeToggle) {
        featureContractStr = `

🎯 FEATURE CONTRACT — DARK / LIGHT MODE TOGGLE
The user wants a WORKING theme toggle.

REQUIRED FILES:
1. UPDATE  ${appFile}  — add darkMode state (or use an existing ThemeContext); render a VISIBLE toggle button (sun/moon) in the top nav/header; toggle a "dark" class on <html> or root div; persist in localStorage
2. UPDATE any styles file that uses CSS variables — ensure dark mode flips variables (OR rely on Tailwind 'dark:' classes)

HARD RULES:
- The toggle MUST be visible in the UI.
- Clicking it MUST visibly change the theme.
- Persist the choice (localStorage) so it survives reload.
- Do NOT return a plan that only adds state without rendering the button.
`;
      }

      // Smart model selection for chat mode
      const hasImages = Array.isArray(images) && images.length > 0;
      const chatModelSelection = selectOptimalModel(prompt, hasImages, 'chat', fileCount);
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
      
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
${assetPickerPriorityStr}${attachedImagesContext}${hasImages && !attachedImagesContext.includes('ATTACHED') ? '\n🖼️ SCREENSHOT ANALYSIS MODE: The user has attached screenshot(s). Analyze them carefully and implement what you see or what the user asks based on the visual.\n' : ''}${sharedProjectAwarenessStr}${featureContractStr}
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
    { "title": "Step description", "file": "/App.js", "current": "old code snippet", "changeTo": "new code snippet" }
  ],
  "codeChanges": [
    { "file": "/App.js", "line": 10, "code": "// Full code block to replace" }
  ]
}

⚠️ MULTI-FILE REQUESTS (e.g. a language toggle needing a NEW i18n/config file PLUS edits to a header component): give EACH step its OWN "file" field for the file THAT step touches. A step without "file" falls back to the single top-level "file" — only rely on the top-level "file" when every step truly touches the same one file.

⚠️ OUTPUT SHAPE IS FLAT: return the object exactly as shown, at the top level. NEVER wrap it inside another object like {"plan": {...}} — "type", "title", "file", "steps", and "codeChanges" must be top-level keys, never nested one level deeper.

📝 MARKDOWN FORMAT FOR QUESTIONS:
Use emojis, **bold**, \`code\`, and bullet points. Be friendly!

🚨 VALID JSON TYPES - ONLY THESE TWO ARE ALLOWED:
1. "type": "plan" - For code changes (use the format above)
2. "type": "asset_picker" - ONLY when user has multiple uploaded images and doesn't specify which one

❌ NEVER invent other types like "booking_wizard", "form_wizard", "contact_form", etc.
❌ NEVER output raw JSON with invented types - the system will show it as broken text to the user
✅ If user wants to change a form/booking/contact page, use "type": "plan" and provide the code changes

⚠️ CRITICAL: For ANY request that implies changing code (and asset_picker doesn't apply), return ONLY the JSON object with "type": "plan". No explanations. No "Here's the plan". Just raw JSON starting with { and ending with }.

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
              const pdfBase64Data = imgData.substring(endBracket + 1);
              
              // Extract text from PDF using Gemini Vision
              try {
                // Parse the base64 data URL
                const pdfMatches = pdfBase64Data.match(/^data:([^;]+);base64,(.+)$/);
                if (pdfMatches) {
                  const pdfMimeType = pdfMatches[1];
                  const pdfBase64 = pdfMatches[2];
                  
                  // Use Gemini to extract text from PDF
                  const extractResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${getDocumentExtractionModel()}:generateContent`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": GEMINI_API_KEY,
                      },
                      body: JSON.stringify({
                        contents: [{
                          role: "user",
                          parts: [
                            {
                              inlineData: {
                                mimeType: pdfMimeType,
                                data: pdfBase64
                              }
                            },
                            {
                              text: `Extract ALL text content from this PDF document. This appears to be a CV/Resume or important document.
                              
Return the COMPLETE text content including:
- Name and contact information
- Professional summary/objective
- Work experience (company names, job titles, dates, responsibilities)
- Education (degrees, institutions, dates)
- Skills (technical and soft skills)
- Certifications, awards, languages
- Any other relevant information

Format the output clearly with sections. Do NOT summarize - extract the FULL text.`
                            }
                          ]
                        }],
                        generationConfig: {
                          temperature: 0.1,
                          maxOutputTokens: 8192,
                        },
                      }),
                    }
                  );
                  
                  if (extractResponse.ok) {
                    const extractData = await extractResponse.json();
                    const extractedText = extractData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (extractedText) {
                      pdfTextContent += `

📄 **EXTRACTED CONTENT FROM ${pdfName}:**
${extractedText}

🚨 **CRITICAL**: Use this REAL data from the user's document above.
DO NOT make up fake information. Use EXACTLY what is in the extracted content.`;
                    } else {
                      pdfTextContent += `\n\n📄 USER ATTACHED PDF: "${pdfName}" - Could not extract text. Please describe the content.`;
                    }
                  } else {
                    console.error(`[Chat Mode] PDF extraction API error: ${extractResponse.status}`);
                    pdfTextContent += `\n\n📄 USER ATTACHED PDF: "${pdfName}" - Extraction failed. Please describe the content.`;
                  }
                } else {
                  pdfTextContent += `\n\n📄 USER ATTACHED PDF: "${pdfName}" - Please describe the content.`;
                }
              } catch (pdfErr) {
                console.error(`[Chat Mode] PDF extraction error:`, pdfErr);
                pdfTextContent += `\n\n📄 USER ATTACHED PDF: "${pdfName}" - Extraction error. Please describe the content.`;
              }
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
      }
      
      // Add the text prompt (with PDF context if any)
      const fullPrompt = pdfTextContent ? `${prompt}${pdfTextContent}` : prompt;
      contentParts.push({ text: fullPrompt });

      // Use smart model selection for chat based on prompt complexity and attachments
      const selectedChatModel = chatModelSelection.model;
      
      // Retry logic for chat mode - up to 2 attempts with increased timeout
      let chatResponse: Response | null = null;
      let lastError: Error | null = null;
      const maxRetries = 2;
      const chatTimeout = 140000; // 140 seconds (stays under edge function 150s limit)
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
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
                    // Language toggle / dark-mode toggle plans touch many files — need more output budget
                    maxOutputTokens: (isLanguageToggle || isDarkModeToggle) ? 16384 : 4096,
                    responseMimeType: "application/json", // Add JSON MIME type for consistent format handling
                  },
                }),
              }
            ),
            chatTimeout,
            'GEMINI_CHAT'
          );
          // Retry on rate-limit (429) and transient 5xx as well
          if (chatResponse && !chatResponse.ok && (chatResponse.status === 429 || chatResponse.status >= 500) && attempt < maxRetries) {
            lastError = new Error(`Gemini HTTP ${chatResponse.status}`);
            console.warn(`[Chat Mode] Attempt ${attempt} got ${chatResponse.status}, retrying...`);
            await new Promise(r => setTimeout(r, 2000));
            chatResponse = null;
            continue;
          }
          break; // Success, exit retry loop
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[Chat Mode] Attempt ${attempt} failed: ${lastError.message}`);
          const retriable = lastError.message.includes('TIMEOUT') || lastError.message.includes('429') || lastError.message.includes('fetch');
          if (attempt < maxRetries && retriable) {
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
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
      
      // Method 2: Extract JSON from mixed content using balanced brace matching
      if (!extractedJson) {
        // Find the first { and try to extract balanced JSON
        const firstBrace = trimmedAnswer.indexOf('{');
        if (firstBrace !== -1) {
          let braceCount = 0;
          let jsonEnd = -1;
          for (let i = firstBrace; i < trimmedAnswer.length; i++) {
            if (trimmedAnswer[i] === '{') braceCount++;
            else if (trimmedAnswer[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
          
          if (jsonEnd > firstBrace) {
            const potentialJson = trimmedAnswer.substring(firstBrace, jsonEnd);
            // Check what type it is
            if (potentialJson.includes('"type"')) {
              if (potentialJson.includes('"asset_picker"')) {
                extractedJson = potentialJson;
                jsonType = 'asset_picker';
              } else if (potentialJson.includes('"plan"')) {
                extractedJson = potentialJson;
                jsonType = 'plan';
              }
            }
          }
        }
      }
      
      if (extractedJson && jsonType) {
        // Validate it's actually valid JSON before returning
        try {
          const rawParsed = JSON.parse(extractedJson);
          // 🔧 Defensive unwrap: the AI is instructed to return a FLAT
          // {"type":"plan","title":...,"file":...,"steps":[...]} object, but
          // sometimes nests everything under an extra "plan" key instead
          // (e.g. {"plan": {"title":...,"steps":[...]}}). Every downstream
          // consumer below (contract verifier + auto-executor) reads flat
          // parsed.title/.file/.steps/.codeChanges, so an unnoticed nested
          // shape silently looks like an EMPTY plan: the verifier then
          // reports everything as "missing", the auto-executor applies zero
          // changes, and the raw JSON leaks into the chat as literal text
          // instead of being executed. Unwrap once if the flat shape looks
          // empty but a nested "plan" object holds the real content.
          // deno-lint-ignore no-explicit-any
          const parsed: any = ((): any => {
            if (!rawParsed || typeof rawParsed !== 'object') return rawParsed;
            const looksEmpty = !rawParsed.file && !Array.isArray(rawParsed.steps) && !Array.isArray(rawParsed.codeChanges) && !Array.isArray(rawParsed.files);
            const nested = rawParsed.plan;
            if (looksEmpty && nested && typeof nested === 'object') {
              const hasNestedContent = nested.file || Array.isArray(nested.steps) || Array.isArray(nested.codeChanges) || Array.isArray(nested.files);
              if (hasNestedContent) return { ...rawParsed, ...nested };
            }
            return rawParsed;
          })();
          if (jsonType === 'asset_picker') {
            // Return asset_picker for frontend to show selection UI
            return createResponse({ 
              ok: true, 
              assetPicker: parsed,
              mode: 'asset_picker',
              creditUsage: chatCreditUsage
            });
          } else {
            // ================================================================
            // 🎯 COMPLETION CONTRACT VERIFIER
            // If a feature contract was expected, verify the plan actually
            // touches the required wiring files. Attach a truthfulness warning
            // when the plan is partial so the frontend can show honest status.
            // ================================================================
            const contractWarnings: string[] = [];
            try {
              const planFiles: string[] = [];
              if (parsed && typeof parsed === 'object') {
                if (typeof parsed.file === 'string') planFiles.push(parsed.file);
                if (Array.isArray(parsed.steps)) {
                  for (const step of parsed.steps) {
                    // Mirrors the auto-executor's own fallback below: a step
                    // without its own "file" targets the plan's top-level file.
                    if (step && typeof step.file === 'string') planFiles.push(step.file);
                    else if (typeof parsed.file === 'string') planFiles.push(parsed.file);
                  }
                }
                if (Array.isArray(parsed.codeChanges)) {
                  for (const ch of parsed.codeChanges) {
                    if (ch && typeof ch.file === 'string') planFiles.push(ch.file);
                  }
                }
                if (Array.isArray(parsed.files)) {
                  for (const f of parsed.files) {
                    if (typeof f === 'string') planFiles.push(f);
                    else if (f && typeof f.path === 'string') planFiles.push(f.path);
                  }
                }
              }
              const normalizedPlanFiles = Array.from(new Set(planFiles.map(p => p.toLowerCase())));
              const planHits = (needle: string) =>
                normalizedPlanFiles.some(p => p.includes(needle.toLowerCase()));
              const planHitsBasename = (basename: string) =>
                normalizedPlanFiles.some(p => p.endsWith('/' + basename.toLowerCase()) || p === '/' + basename.toLowerCase());

              if (isLanguageToggle) {
                // Accept EITHER a dedicated LanguageContext provider OR an
                // i18next-style config file — both are legitimate, commonly
                // used architectures for bilingual support (the phase-2
                // followup logic below already treats them as equivalent).
                const hasContext =
                  normalizedPlanFiles.some(p => /\/context(s)?\/.*language/i.test(p)) ||
                  planHits('languagecontext') ||
                  normalizedPlanFiles.some(p => /i18n/i.test(p)) ||
                  planHits('i18n');
                const hasEntry = planHits(entryFile.toLowerCase()) || planHitsBasename(entryFile.split('/').pop() || 'index.js');
                const hasApp = planHits(appFile.toLowerCase()) || planHitsBasename(appFile.split('/').pop() || 'App.js');
                if (!hasContext) contractWarnings.push('Missing LanguageContext provider file.');
                if (!hasEntry) contractWarnings.push(`Provider not mounted in ${entryFile}.`);
                if (!hasApp) contractWarnings.push(`Toggle UI / translated labels not wired in ${appFile}.`);
              } else if (isDarkModeToggle) {
                const hasApp = planHits(appFile.toLowerCase()) || planHitsBasename(appFile.split('/').pop() || 'App.js');
                if (!hasApp) contractWarnings.push(`Dark-mode toggle not wired in ${appFile}.`);
              }
            } catch (verifyErr) {
              console.error('[Contract Verifier] Error:', verifyErr);
            }

            if (contractWarnings.length > 0) {
              console.warn('[Contract Verifier] Partial plan detected:', contractWarnings);
              return createResponse({
                ok: true,
                plan: JSON.stringify(parsed),
                mode: 'plan',
                creditUsage: chatCreditUsage,
                contractWarnings,
                partial: true
              });
            }

            // For language toggle: build a queued phase-2 followup that translates remaining components.
            // Phase 1 only touched LanguageContext + index.js + App.js + Header.
            // Phase 2 will translate every other component file.
            let queuedFollowup: string | undefined;
            if (isLanguageToggle) {
              const phase1Files = new Set([
                entryFile.toLowerCase(),
                appFile.toLowerCase(),
                ...(headerFile ? [headerFile.toLowerCase()] : []),
                'i18n.js', 'i18n', 'languagecontext',
              ]);
              const remainingComponents = allPaths
                .filter(p => {
                  if (SYSTEM_FILE_PATTERN.test(p)) return false;
                  if (!SOURCE_EXTENSIONS.test(p)) return false;
                  if (SKIP_PATTERNS.test(p)) return false;
                  const pl = p.toLowerCase();
                  if (phase1Files.has(pl)) return false;
                  if (phase1Files.has(pl.split('/').pop() || '')) return false;
                  // Skip i18n config and locale files — already handled in phase 1
                  if (/i18n|locales?|translation/i.test(p)) return false;
                  // Only component/page files — skip data, utils, config
                  return /\.(jsx?|tsx?)$/.test(p) && /\/(components|pages|sections|views)\//i.test(p);
                })
                .slice(0, 12); // Cap at 12 to prevent runaway passes
              if (remainingComponents.length > 0) {
                queuedFollowup = `Phase 2 — translate remaining components using react-i18next: ${remainingComponents.join(', ')}. For each file: add import { useTranslation } from 'react-i18next'; const { t } = useTranslation(); replace every hardcoded English string with a t('key') call; add the matching Arabic translations for all new keys into the 'ar' resources inside /src/i18n.js; flip any directional classes (left/right, pl-/pr-, text-left/text-right) based on i18n.dir(). Keep all logic and structure untouched.`;
              }
            }

            // ================================================================
            // 🚀 AUTO-EXECUTE: Apply plan changes directly to DB
            // Never show raw JSON/code in chat — implement it silently,
            // then return a clean human-readable summary to the user.
            // ================================================================
            try {
              const filesToWrite: Record<string, string> = {};
              const changesApplied: string[] = [];
              const changesFailed: string[] = [];
              const primaryFile = typeof parsed.file === 'string' ? parsed.file : null;

              // Helper: fetch current file content from DB
              const getCurrentContent = async (fp: string): Promise<string> => {
                const np = fp.startsWith('/') ? fp : `/${fp}`;
                const { data } = await supabase
                  .from('project_files')
                  .select('content')
                  .eq('project_id', projectId)
                  .eq('path', np)
                  .maybeSingle();
                return (data as { content?: string } | null)?.content || '';
              };

              // Helper: apply one change (new file or morphed edit)
              const applyChange = async (fp: string, changeTo: string, current: string, desc: string) => {
                const np = fp.startsWith('/') ? fp : `/${fp}`;
                if (!current.trim()) {
                  filesToWrite[np] = changeTo;
                  changesApplied.push(`Created ${np}`);
                } else {
                  const morphResult = await morphFastApply({ originalCode: current, codeEdit: changeTo, instructions: desc });
                  if (morphResult.success && morphResult.mergedCode) {
                    filesToWrite[np] = morphResult.mergedCode;
                    changesApplied.push(`Updated ${np}`);
                  } else if (changeTo.length > 150) {
                    filesToWrite[np] = changeTo;
                    changesApplied.push(`Applied ${np}`);
                  } else {
                    // Merge failed and the snippet is too small to safely use as a
                    // full-file replacement. Do NOT silently drop this — record it
                    // so the response can honestly report a partial result instead
                    // of falsely claiming the whole request was completed.
                    changesFailed.push(np);
                  }
                }
              };

              // Process steps array
              if (Array.isArray(parsed.steps)) {
                for (const step of parsed.steps as Array<Record<string, unknown>>) {
                  const stepFile = (typeof step.file === 'string' ? step.file : primaryFile);
                  if (stepFile && typeof step.changeTo === 'string' && step.changeTo.trim()) {
                    const currentContent = typeof step.current === 'string' && step.current.trim()
                      ? step.current
                      : await getCurrentContent(stepFile);
                    await applyChange(stepFile, step.changeTo, currentContent, typeof step.title === 'string' ? step.title : 'Update');
                  }
                }
              }

              // Process codeChanges array
              if (Array.isArray(parsed.codeChanges)) {
                for (const change of parsed.codeChanges as Array<Record<string, unknown>>) {
                  if (typeof change.file === 'string' && typeof change.code === 'string' && change.code.trim()) {
                    const np = change.file.startsWith('/') ? change.file : `/${change.file}`;
                    if (!filesToWrite[np]) {
                      const currentContent = await getCurrentContent(change.file);
                      await applyChange(change.file, change.code, currentContent, 'Code change');
                    }
                  }
                }
              }

              // Save all changed files to DB
              if (Object.keys(filesToWrite).length > 0) {
                await upsertProjectFiles(supabase, projectId, filesToWrite);
                const title = typeof parsed.title === 'string' ? parsed.title.replace(/^[^\w]+/, '') : 'Changes applied';
                if (changesFailed.length === 0) {
                  const summary = `✅ Done! ${title}\n\nFiles updated:\n${changesApplied.map(c => `• ${c}`).join('\n')}${queuedFollowup ? '\n\n⏳ More components will be translated in the next pass.' : ''}`;
                  return createResponse({ ok: true, message: summary, mode: 'agent', creditUsage: chatCreditUsage, filesChanged: Object.keys(filesToWrite) });
                }
                // Partial result: some steps landed, some did not. Never say "Done!"
                // when part of the request silently failed — be explicit instead.
                const partialSummary = `⚠️ Partially applied. ${title}\n\nFiles updated:\n${changesApplied.map(c => `• ${c}`).join('\n')}\n\nCould not safely auto-apply changes to:\n${changesFailed.map(c => `• ${c}`).join('\n')}\n\nTry resending that part with a more specific detail (e.g. the exact element or color).`;
                return createResponse({ ok: true, message: partialSummary, mode: 'agent', creditUsage: chatCreditUsage, filesChanged: Object.keys(filesToWrite) });
              }
            } catch (autoExecErr) {
              console.error('[Chat Auto-Execute] Failed, falling back to plan:', autoExecErr);
            }

            // Fallback: if auto-execution failed or produced no files, return the plan
            const planJsonToReturn = queuedFollowup
              ? JSON.stringify({ ...parsed, queuedFollowup })
              : JSON.stringify(parsed);
            return createResponse({ ok: true, plan: planJsonToReturn, mode: 'plan', creditUsage: chatCreditUsage });
          }
        } catch {
          // Invalid JSON, return as regular message
        }
      }
      
      // Return as regular chat message with credit usage
      return createResponse({ ok: true, message: answer, creditUsage: chatCreditUsage });
    }

    // ========================================================================
    // AGENT MODE: Full autonomous agent with tool calling
    // ========================================================================
    if (mode === 'agent') {
      const agentStartTime = Date.now(); // Track duration for AI logging
      
      if (!projectId) {
        return createResponse({ ok: false, error: 'Missing projectId' }, 400);
      }
      if (!prompt) {
        return createResponse({ ok: false, error: 'Missing prompt' }, 400);
      }
      
      await assertProjectOwnership(supabase, projectId, userId);

      const isInternalAgentRun = action === 'agent_run';
      const shouldQueueAgentJob = (action === 'start' || action === 'resume') && !isInternalAgentRun;

      const launchAgentWorker = async (params: {
        agentJobId: string;
        runPrompt: string;
        resumeFromJobId?: string | null;
      }) => {
        const { agentJobId, runPrompt, resumeFromJobId } = params;
        const startedAt = new Date().toISOString();

        try {
          await updateJob(supabase, agentJobId, {
            status: 'running',
            error: null,
            result_summary: 'Preparing agent context',
          });

          await patchJobMetadata(
            supabase,
            agentJobId,
            {
              startedAt,
              resumeFromJobId: resumeFromJobId || null,
              pauseRequested: false,
              errorCode: null,
            },
            {
              at: startedAt,
              step: 'preparing',
              status: 'in_progress',
              note: 'Preparing agent context',
            },
          );

          const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
          if (!SUPABASE_URL) {
            throw new Error('SUPABASE_URL missing for agent worker invocation');
          }

          const workerBody: RequestBody = {
            ...body,
            action: 'agent_run',
            mode: 'agent',
            projectId,
            prompt: runPrompt,
            jobId: agentJobId,
            resumeFromJobId: resumeFromJobId || undefined,
          };

          const workerResponse = await withTimeout(
            fetch(`${SUPABASE_URL}/functions/v1/projects-generate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(userAuthHeader ? { Authorization: userAuthHeader } : {}),
              },
              body: JSON.stringify(workerBody),
            }),
            145000,
            'AGENT_WORKER_HTTP',
          );

          if (!workerResponse.ok) {
            const workerErrorText = await workerResponse.text();
            const workerMessage = `Agent worker failed with HTTP ${workerResponse.status}: ${workerErrorText.slice(0, 500)}`;
            const errorCode = classifyAgentErrorCode(workerMessage);
            const shouldPause = errorCode === 'timeout';
            const failedAt = new Date().toISOString();

            await updateJob(supabase, agentJobId, {
              status: shouldPause ? 'paused' : 'failed',
              error: workerMessage,
              result_summary: shouldPause
                ? 'Paused due to timeout budget. Resume to continue.'
                : null,
            });
            await patchJobMetadata(
              supabase,
              agentJobId,
              {
                errorCode,
                workerHttpStatus: workerResponse.status,
                workerErrorText: workerErrorText.slice(0, 1000),
              },
              {
                at: failedAt,
                step: shouldPause ? 'paused' : 'failed',
                status: 'failed',
                note: workerMessage,
              },
            );
            return;
          }

          const workerData = await workerResponse.json() as {
            ok?: boolean;
            error?: string;
            message?: string;
            result?: AgentResult & { type?: string; suggestion?: string };
          };

          if (!workerData?.ok) {
            const failedMessage = workerData?.error || 'Agent worker returned a non-ok payload';
            const failedAt = new Date().toISOString();
            await updateJob(supabase, agentJobId, {
              status: 'failed',
              error: failedMessage,
              result_summary: null,
            });
            await patchJobMetadata(
              supabase,
              agentJobId,
              { errorCode: classifyAgentErrorCode(failedMessage) },
              {
                at: failedAt,
                step: 'failed',
                status: 'failed',
                note: failedMessage,
              },
            );
            return;
          }

          const workerResult = workerData.result || null;
          const failedReason = String(workerResult?.error || '').trim();
          const pausedForBudget =
            workerResult?.type === 'paused_for_budget'
            || failedReason === 'TIME_BUDGET_EXCEEDED'
            || failedReason.includes('AGENT_WORKER_HTTP_TIMEOUT');

          if (workerResult?.success === false) {
            const failAt = new Date().toISOString();
            await updateJob(supabase, agentJobId, {
              status: pausedForBudget ? 'paused' : 'failed',
              error: failedReason || 'Agent worker reported an unsuccessful result',
              result_summary: workerResult.summary || null,
            });
            await patchJobMetadata(
              supabase,
              agentJobId,
              {
                errorCode: classifyAgentErrorCode(failedReason),
                workerResult,
                pausedForBudget,
              },
              {
                at: failAt,
                step: pausedForBudget ? 'paused' : 'failed',
                status: pausedForBudget ? 'in_progress' : 'failed',
                note: workerResult.summary || failedReason || 'Agent run did not complete successfully',
              },
            );
            return;
          }

          const completedAt = new Date().toISOString();
          await updateJob(supabase, agentJobId, {
            status: 'succeeded',
            error: null,
            result_summary: workerResult?.summary || workerData.message || 'Agent job completed',
          });
          await patchJobMetadata(
            supabase,
            agentJobId,
            {
              errorCode: null,
              workerResult,
              filesChanged: workerResult?.filesChanged || [],
              completedAt,
            },
            {
              at: completedAt,
              step: 'done',
              status: 'completed',
              note: workerResult?.summary || 'Agent job completed',
            },
          );
        } catch (workerErr) {
          const workerMessage = workerErr instanceof Error ? workerErr.message : String(workerErr);
          const errorCode = classifyAgentErrorCode(workerMessage);
          const shouldPause = errorCode === 'timeout';
          const failedAt = new Date().toISOString();

          await updateJob(supabase, agentJobId, {
            status: shouldPause ? 'paused' : 'failed',
            error: workerMessage,
            result_summary: shouldPause
              ? 'Paused due to timeout budget. Resume to continue.'
              : null,
          });
          await patchJobMetadata(
            supabase,
            agentJobId,
            {
              errorCode,
              workerException: workerMessage,
            },
            {
              at: failedAt,
              step: shouldPause ? 'paused' : 'failed',
              status: 'failed',
              note: workerMessage,
            },
          );
        }
      };

      if (shouldQueueAgentJob) {
        const { data: activeAgentJobs, error: activeJobsErr } = await supabase
          .from('project_generation_jobs')
          .select('id, status')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .eq('mode', 'agent')
          .in('status', ['queued', 'running'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (activeJobsErr) {
          throw new Error(`DB_ACTIVE_AGENT_JOB_LOOKUP_FAILED: ${activeJobsErr.message}`);
        }

        if (activeAgentJobs && activeAgentJobs.length > 0) {
          const existingJob = activeAgentJobs[0];
          return createResponse({
            ok: false,
            error: 'AGENT_CONCURRENCY_GUARD',
            message: 'Another agent job is still running for this project. Please wait or pause it first.',
            messageAr: 'هناك مهمة وكيل تعمل الآن لهذا المشروع. انتظر حتى تنتهي أو قم بإيقافها أولاً.',
            activeJobId: existingJob.id,
            activeStatus: existingJob.status,
          }, 429);
        }

        const nowIso = new Date().toISOString();
        const agentJob = await createJob(supabase, {
          projectId,
          userId,
          mode: 'agent',
          prompt,
          initialStatus: 'queued',
          metadata: {
            timeline: [
              {
                at: nowIso,
                step: action === 'resume' ? 'resume_requested' : 'queued',
                status: 'pending',
                note: action === 'resume' ? 'Resume requested by user' : 'Queued for agent execution',
              },
            ],
            currentStep: action === 'resume' ? 'resume_requested' : 'queued',
            currentStepStatus: 'pending',
            pauseRequested: false,
            resumedFromJobId: body.resumeFromJobId || null,
            hotFiles: Array.isArray(body.hotFiles) ? body.hotFiles.slice(0, 20) : [],
          },
        });

        const launchPromise = launchAgentWorker({
          agentJobId: agentJob.id,
          runPrompt: prompt,
          resumeFromJobId: body.resumeFromJobId || null,
        });

        if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime?.waitUntil === 'function') {
          EdgeRuntime.waitUntil(launchPromise);
        } else {
          void launchPromise;
        }

        return createResponse({
          ok: true,
          mode: 'agent',
          jobId: agentJob.id,
          status: 'queued',
          message: action === 'resume'
            ? 'Agent resume job queued. Poll status for progress.'
            : 'Agent job queued. Poll status for progress.',
        });
      }
      
      // ========================================================================
      // THE FIXER MODE: final auto-fix attempt (attempt #4)
      // ========================================================================
      if (body.fixerMode && body.fixerContext) {
        // Build Fixer context with all available information
        const fctx = body.fixerContext;
        const structuredBlock = (fctx.missingPackage || fctx.errorType)
          ? `\n## STRUCTURED ERROR DATA (pre-parsed — trust these over the raw stack trace):\n- Error type: ${fctx.errorType || 'unknown'}\n${fctx.missingPackage ? `- Missing package: \`${fctx.missingPackage}\`\n` : ''}`
          : '';

        const missingPkgGuidance = fctx.missingPackage
          ? `\n## ⛔ HANDLING THE MISSING PACKAGE:\n` +
            `The package \`${fctx.missingPackage}\` is NOT available in the Sandpack preview and CANNOT be installed. ` +
            `You MUST remove every import of \`${fctx.missingPackage}\` and replace it with an allowed alternative ` +
            `(see the ALLOWED PACKAGES list in the system prompt). If no direct replacement exists, fall back to ` +
            `vanilla React + Tailwind/CSS. NEVER tell the user to install it.\n`
          : '';

        const fixerUserPrompt = `🔧 THE FIXER - FINAL AUTO-FIX ATTEMPT

## ERROR TO FIX:
\`\`\`
${fctx.errorMessage}
\`\`\`
${structuredBlock}
## CONTEXT:
- Previous auto-fix attempts: ${fctx.previousAttempts} (all failed)
- You are the LAST RESORT before showing recovery UI to the user
${fctx.recentEdits?.length ? `- Recently edited files: ${fctx.recentEdits.join(', ')}` : ''}
${fctx.chatHistory ? `\n## RECENT CHAT HISTORY:\n${fctx.chatHistory}` : ''}
${missingPkgGuidance}
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
          const fixerMessages: Array<{ role: string; content: string }> = [
            { role: "user", content: fixerUserPrompt }
          ];
          let fixerTaskComplete: { summary: string; filesChanged: string[] } | null = null;
          const fixerToolCallsLog: ToolCallLogEntry[] = [];
          const fixerMaxIterations = 6; // Fixer gets 6 iterations max
          
          for (let fixerIter = 0; fixerIter < fixerMaxIterations; fixerIter++) {
            const fixerResponse = await callClaudeOpus4Fixer(
              FIXER_SYSTEM_PROMPT,
              fixerMessages.map(m => m.content).join('\n\n'),
              toolsArray
            );
            
            // Handle tool calls
            if (fixerResponse.toolCalls && fixerResponse.toolCalls.length > 0) {
              const toolResults: string[] = [];
              
              for (const toolCall of fixerResponse.toolCalls) {
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
                
                fixerToolCallsLog.push({ tool: toolCall.name, args: normalizeToolCallArgs(toolCall.input), result });
                toolResults.push(`Tool: ${toolCall.name}\nResult: ${JSON.stringify(result).substring(0, 1000)}`);
                
                // Check for task_complete
                if (toolCall.name === 'task_complete') {
                  fixerTaskComplete = {
                    summary: typeof toolCall.input.summary === 'string' ? toolCall.input.summary : 'Fix applied by The Fixer',
                    filesChanged: toStringArray(toolCall.input.filesChanged)
                  };
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
              break;
            }
          }
          
          // Return Fixer result
          const fixerDuration = Date.now() - agentStartTime;
          
          if (fixerTaskComplete) {
            return createResponse({
              ok: true,
              mode: 'agent',
              fixerMode: true,
              result: {
                summary: `🔧 THE FIXER: ${fixerTaskComplete.summary}`,
                filesChanged: fixerTaskComplete.filesChanged,
                toolCalls: fixerToolCallsLog.map(tc => ({ tool: tc.tool, success: tc.result?.success !== false }))
              },
              duration: fixerDuration
            });
          } else {
            // Fixer also failed
            return createResponse({
              ok: false,
              mode: 'agent',
              fixerMode: true,
              fixerFailed: true,
              error: 'The Fixer was unable to fix the error. Recovery options should be shown.',
              toolCalls: fixerToolCallsLog.map(tc => ({ tool: tc.tool, success: tc.result?.success !== false })),
              duration: fixerDuration
            });
          }
        } catch (fixerError) {
          console.error(`[THE FIXER] Error:`, fixerError);
          return createResponse({
            ok: false,
            mode: 'agent',
            fixerMode: true,
            fixerFailed: true,
            error: `The Fixer encountered an error: ${fixerError instanceof Error ? fixerError.message : 'Unknown error'}`
          }, 500);
        }
      }
      
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
      
      // ====================================================================
      // STEP 1: SCREENSHOT ANALYSIS - Extract visible text anchors FIRST
      // ====================================================================
      let screenshotAnchorsContext = '';
      // Frontend sends images as string[] (base64 or URLs), not ImageAttachment[]
      const agentImages = (images as unknown as string[]) || [];
      
      if (agentImages.length > 0) {
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
            }
          }
        } catch (err) {
          console.error(`[Agent Mode] Screenshot analysis failed:`, err);
        }
      }
      
      const agentExecutionMode = resolveAgentExecutionMode(prompt, requestedExecutionMode ?? debugContext?.executionMode);
      const selectedElement = normalizeAgentSelectedElement(debugContext?.selectedElement);

      // Build enhanced debug context for the agent
      const agentDebugContext: AgentDebugContext = {
        errors: debugContext?.errors || [],
        networkErrors: debugContext?.networkErrors || [],
        consoleLogs: debugContext?.consoleLogs || [],
        autoFixAttempt: debugContext?.autoFixAttempt,
        maxAutoFixAttempts: debugContext?.maxAutoFixAttempts,
        selectedElement,
        executionMode: agentExecutionMode
      };
      
      // Build system prompt with project ID - replace placeholder with actual project ID
      // Option B: inject relevant capability docs based on prompt (lean core + smart injection)
      const agentCapabilityDocs = assembleCapabilityDocs(prompt || '');
      const systemPromptWithProjectId = AGENT_SYSTEM_PROMPT.replace(/\{\{PROJECT_ID\}\}/g, projectId)
        + buildAgentExecutionModeInstructions(agentExecutionMode)
        + (agentCapabilityDocs.text ? agentCapabilityDocs.text : '');
      
      // ========================================================================
      // CONTEXT OPTIMIZATION: Send only file NAMES, not full content
      // Agent uses read_file tool to fetch what it needs (80% token reduction!)
      // ========================================================================
      const currentFiles = body.currentFiles || {};
      const normalizedCurrentFilesBaseline: Record<string, string> = {};
      for (const [path, content] of Object.entries(currentFiles as Record<string, unknown>)) {
        if (typeof content !== 'string') continue;
        normalizedCurrentFilesBaseline[normalizeFilePath(path)] = content;
      }
      let fileList = Object.keys(currentFiles).join('\n');
      let fileCount = Object.keys(currentFiles).length;

      const isLikelyFastFollowup =
        String(prompt || '').trim().length > 0
        && String(prompt || '').trim().length <= 220
        && !/\b(create|build|from scratch|full app|full website|entire|complete app|complete website|redesign|rebuild)\b/i.test(prompt || '');
      const agentMaxIterations = isLikelyFastFollowup ? 10 : 18;
      const agentMaxOutputTokens = isLikelyFastFollowup ? 3072 : 4096;
      const agentBudgetMs = isLikelyFastFollowup ? 60000 : 120000;
      
      // SAFETY NET: If currentFiles is empty, fetch file list from DB
      if (fileCount === 0) {
        const { data: dbFiles } = await supabase
          .from('project_files')
          .select('path, content')
          .eq('project_id', projectId);
        
        if (dbFiles && dbFiles.length > 0) {
          fileList = dbFiles.map((f: { path: string }) => normalizeFilePath(f.path)).join('\n');
          fileCount = dbFiles.length;
          for (const row of dbFiles) {
            if (typeof row.path === 'string' && typeof row.content === 'string') {
              normalizedCurrentFilesBaseline[normalizeFilePath(row.path)] = row.content;
            }
          }
        }
      }
      
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
        
      }
      
      // Extract inspect selection from debug context for precise element targeting
      let inspectSelectionContext = '';
      if (agentDebugContext.selectedElement) {
        const selected = agentDebugContext.selectedElement;
        inspectSelectionContext = `
🎯 USER SELECTED ELEMENT:
Tag: ${selected.tagName}
Class: ${selected.className || '(none)'}
ID: ${selected.id || '(none)'}
Text: ${selected.innerText || '(empty)'}

⚠️ CRITICAL: The user selected this exact element. Prioritize this payload over console-log guesses.
`;
      } else if (agentDebugContext.consoleLogs && agentDebugContext.consoleLogs.length > 0) {
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
      // Get all project files for intent analysis
      const { data: allProjectFiles } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      
      const filesForIntent = ((allProjectFiles || []) as Array<{ path: string; content: string }>).map((f: { path: string; content: string }) => ({ path: f.path, content: f.content }));
      const entryPoint = filesForIntent.find((f: { path: string; content: string }) => f.path.includes('App.jsx') || f.path.includes('App.tsx'))?.path || '/App.jsx';
      
      const editIntent = analyzeEditIntent(enrichedPrompt, filesForIntent, entryPoint);
      const fileSearchPlan = executeFileSearchPlan(enrichedPrompt, filesForIntent, editIntent, entryPoint);
      const plannedPrimaryFiles = [...new Set(fileSearchPlan.primaryHits.map((hit) => hit.path).filter(Boolean))];
      const plannedContextFiles = [...new Set(fileSearchPlan.contextHits.map((hit) => hit.path).filter(Boolean))];
      const searchTermsHint = fileSearchPlan.searchTerms.length > 0
        ? `\n🔎 SEARCH TERMS: ${fileSearchPlan.searchTerms.join(', ')}`
        : '';
      const primaryFilesHint = plannedPrimaryFiles.length > 0
        ? `\n📌 PRIMARY FILES: ${plannedPrimaryFiles.join(', ')}`
        : '';
      const contextFilesHint = plannedContextFiles.length > 0
        ? `\n🧭 CONTEXT FILES: ${plannedContextFiles.join(', ')}`
        : '';
      const shouldUseAutopilot = /premium|luxury|editorial|modern|clean(?:er| up)?|polish|polished|wow|vibe|look better|feel better|make (?:it|this) (?:better|cleaner|more modern|more premium)|improve (?:the )?(?:design|layout|spacing|hierarchy|typography|homepage|landing page|hero)|redesign|rebuild|refresh/i.test(enrichedPrompt);
      // Build intent guidance based on analysis
      let intentGuidance = '';
      if (editIntent.confidence >= 0.7) {
        const targetFilesHint = plannedPrimaryFiles.length > 0 ? ` → Focus on: ${plannedPrimaryFiles.join(', ')}` : '';
        switch (editIntent.type) {
          case 'ADD_FEATURE':
            intentGuidance = `\n🎯 INTENT: ADD NEW FEATURE${targetFilesHint}\n→ You'll likely need to CREATE new files or ADD code to existing files.\n`;
            break;
          case 'FIX_ISSUE':
            intentGuidance = `\n🎯 INTENT: FIX AN ISSUE${targetFilesHint}\n→ Read the relevant files first, understand the error, then make targeted fixes.\n`;
            break;
          case 'UPDATE_STYLE':
            intentGuidance = `\n🎯 INTENT: UPDATE STYLING${targetFilesHint}\n→ Look for CSS classes, Tailwind utilities, or style objects to modify.\n`;
            break;
          case 'UPDATE_COMPONENT':
            intentGuidance = `\n🎯 INTENT: UPDATE EXISTING COMPONENT${targetFilesHint}\n→ Find and read the component file first, then make targeted edits.\n`;
            break;
          case 'REMOVE_ELEMENT':
            intentGuidance = `\n🎯 INTENT: REMOVE ELEMENT${targetFilesHint}\n→ The system found the file containing this element. Read it, then remove the element.\n`;
            break;
        }
      }
      if (shouldUseAutopilot) {
        const autopilotFocus = plannedPrimaryFiles.length > 0
          ? plannedPrimaryFiles.join(', ')
          : (editIntent.targetFiles[0] || entryPoint);
        intentGuidance += `\n🪄 AUTOPILOT MODE: This is a broad improvement request. Infer the strongest visible target first and make one coherent upgrade path. Start with ${autopilotFocus}. Only ask for clarification if the request is truly ambiguous or unsafe.`;
      }
      intentGuidance += `${searchTermsHint}${primaryFilesHint}${contextFilesHint}`;

      let fileSearchPlanContext = '';
      const primarySearchLines = fileSearchPlan.primaryHits
        .slice(0, 4)
        .map((hit) => `- ${hit.path}:${hit.line} [${Math.round(hit.confidence * 100)}% ${hit.matchType}]\n${hit.preview}`);
      const contextSearchLines = fileSearchPlan.contextHits
        .slice(0, 4)
        .map((hit) => `- ${hit.path}:${hit.line} [${Math.round(hit.confidence * 100)}% ${hit.matchType}]\n${hit.preview}`);
      if (primarySearchLines.length > 0 || contextSearchLines.length > 0) {
        fileSearchPlanContext = `\n🗺️ FILE SEARCH PLAN:`
          + `${primarySearchLines.length > 0 ? `\nPRIMARY HITS:\n${primarySearchLines.join('\n\n')}` : ''}`
          + `${contextSearchLines.length > 0 ? `\n\nCONTEXT HITS:\n${contextSearchLines.join('\n\n')}` : ''}`;
      }

      const prioritizedIntentPaths = [...new Set([
        ...plannedPrimaryFiles,
        ...plannedContextFiles,
      ])].filter(Boolean).slice(0, 6);

      let intentPrefetchContext = '';
      if (prioritizedIntentPaths.length > 0) {
        const intentPrefetchSections: string[] = [];
        let prefetchedChars = 0;
        for (const filePath of prioritizedIntentPaths) {
          const matchedFile = filesForIntent.find((file) => file.path === filePath);
          if (!matchedFile) continue;
          const remaining = 8000 - prefetchedChars;
          if (remaining <= 0) break;
          const snippet = matchedFile.content.slice(0, Math.min(remaining, 1800));
          if (!snippet.trim()) continue;
          intentPrefetchSections.push(`\n--- ${matchedFile.path} ---\n${snippet}`);
          prefetchedChars += snippet.length;
        }

        if (intentPrefetchSections.length > 0) {
          intentPrefetchContext = `\n📚 PRIORITY FILE SNAPSHOTS:${intentPrefetchSections.join('\n')}`;
        }
      }
      
      // 🔧 FIX: Extract PDF content from images array in AGENT mode
      let agentPdfExtractedContent = '';
      if (images && images.length > 0) {
        const GEMINI_API_KEY_AGENT = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
        
        for (const imgData of images as Array<ImageAttachment | string>) {
          const imagePayload = typeof imgData === 'string' ? imgData : imgData?.data;
          if (typeof imagePayload !== 'string') continue;
          
          // Check if it's a PDF (marked with [PDF:filename] prefix)
          if (imagePayload.startsWith('[PDF:')) {
            const endBracket = imagePayload.indexOf(']');
            if (endBracket > 0) {
              const pdfName = imagePayload.substring(5, endBracket);
              const pdfBase64Data = imagePayload.substring(endBracket + 1);
              
              try {
                const pdfMatches = pdfBase64Data.match(/^data:([^;]+);base64,(.+)$/);
                if (pdfMatches && GEMINI_API_KEY_AGENT) {
                  const pdfMimeType = pdfMatches[1];
                  const pdfBase64 = pdfMatches[2];
                  
                  const extractResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${getDocumentExtractionModel()}:generateContent`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": GEMINI_API_KEY_AGENT,
                      },
                      body: JSON.stringify({
                        contents: [{
                          role: "user",
                          parts: [
                            { inlineData: { mimeType: pdfMimeType, data: pdfBase64 } },
                            { text: `Extract ALL text content from this PDF document. This appears to be a CV/Resume or important document.
                            
Return the COMPLETE text content including:
- Name and contact information
- Professional summary/objective
- Work experience (company names, job titles, dates, responsibilities)
- Education (degrees, institutions, dates)
- Skills (technical and soft skills)
- Certifications, awards, languages
- Any other relevant information

Format the output clearly with sections. Do NOT summarize - extract the FULL text.` }
                          ]
                        }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                      }),
                    }
                  );
                  
                  if (extractResponse.ok) {
                    const extractData = await extractResponse.json();
                    const extractedText = extractData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (extractedText) {
                      agentPdfExtractedContent += `\n\n📄 **EXTRACTED CONTENT FROM ${pdfName}:**\n${extractedText}`;
                    }
                  } else {
                    console.error(`[Agent Mode] PDF extraction API error: ${extractResponse.status}`);
                  }
                }
              } catch (pdfErr) {
                console.error(`[Agent Mode] PDF extraction error:`, pdfErr);
              }
            }
          }
        }
      }

      const sharedAgentAwarenessContext = buildUnifiedProjectAwarenessContext({
        projectId,
        currentFiles: normalizedCurrentFilesBaseline,
        uploadedAssets,
        backendContext,
        documentContentBlocks: [documentContentStr, agentPdfExtractedContent],
        visionInspiration: visionInspirationStr,
        assetIntentPrompt,
        includeProjectStructure: true,
      });
      
      // Prepare the initial user message with FILE LIST ONLY (not content)
      let userMessageContent = `📁 PROJECT FILES (${fileCount} files):
${fileList}
${criticalFilesContext}
${sharedAgentAwarenessContext}
${intentGuidance}
${fileSearchPlanContext}
${intentPrefetchContext}
⚙️ EXECUTION MODE: ${agentExecutionMode === 'design_rebuild' ? 'DESIGN REBUILD' : 'SURGICAL EDIT'}
⚠️ IMPORTANT: Use the read_file tool to view file contents before editing.
Use list_files to see directory structure.
Use morph_edit for intelligent code fixes (preferred), search_replace for simple replacements, or write_file for new files.
${inspectSelectionContext}
${screenshotAnchorsContext}

USER REQUEST:
${enrichedPrompt}`;

      // Add extracted PDF content to agent prompt
      if (agentPdfExtractedContent) {
        userMessageContent += `

📄 **EXTRACTED DOCUMENT CONTENT FROM ATTACHED PDF** (USE THIS DATA):
${agentPdfExtractedContent}

🚨 **CRITICAL**: The above content was extracted from the user's uploaded PDF (CV/Resume/etc).
USE THIS REAL DATA to update the website - names, experience, skills, education, contact info, etc.
DO NOT make up fake information. Use EXACTLY what is in the extracted content above.
Update the relevant content/data files with this REAL information.`;
      }
      
      // Add debug context if there are errors
      if (agentDebugContext.errors.length > 0 || agentDebugContext.networkErrors.length > 0) {
        userMessageContent += `\n\n🚨🚨🚨 CRITICAL: RUNTIME ERRORS DETECTED - YOU MUST FIX THESE! 🚨🚨🚨\n`;
        userMessageContent += `\n⛔ YOU CANNOT COMPLETE THIS TASK UNTIL THESE ERRORS ARE FIXED.\n`;
        userMessageContent += `\n📋 REQUIRED STEPS:\n1. Use read_file to see the broken file\n2. Find the exact line causing the error\n3. Use morph_edit to fix it (preferred) or search_replace as backup\n4. Only then call task_complete\n`;
        
        if (agentDebugContext.errors.length > 0) {
          userMessageContent += `\n**Runtime Errors (MUST FIX):**\n`;
          agentDebugContext.errors.slice(-5).forEach((e, i) => {
            userMessageContent += `${i + 1}. [${e.type}] ${e.message}\n`;
            if (e.file) userMessageContent += `   📁 File: ${e.file}${e.line ? `:${e.line}` : ''}\n`;
            
            // Extract property name from error message for specific fixes
            const propMatch = e.message?.match(/reading '(\w+)'/);
            const propName = propMatch ? propMatch[1] : null;
            
            // Add DETAILED step-by-step fix instructions for common errors
            if (e.message?.includes('Cannot read properties of undefined')) {
              userMessageContent += `\n   🔧 **EXACT FIX STEPS:**\n`;
              userMessageContent += `   Step 1: read_file "${e.file || 'the file above'}"\n`;
              userMessageContent += `   Step 2: Find where "${propName || 'the property'}" is accessed (look for .${propName} or ['${propName}'])\n`;
              userMessageContent += `   Step 3: The variable BEFORE the dot is undefined. Common causes:\n`;
              userMessageContent += `      - data[i18n.language] returns undefined → FIX: const lang = i18n.language?.substring(0,2) || 'en'; const data = myData[lang] || myData.en || {};\n`;
              userMessageContent += `      - props.something is undefined → FIX: Add default: const { something = [] } = props;\n`;
              userMessageContent += `      - array.map() on undefined → FIX: (array || []).map(...)\n`;
              userMessageContent += `   Step 4: Use morph_edit to add the null check/fallback (preferred) or search_replace\n`;
              userMessageContent += `   Step 5: Verify the fix compiles, then task_complete\n`;
            } else if (e.message?.includes('is not defined')) {
              const varMatch = e.message?.match(/(\w+) is not defined/);
              const varName = varMatch ? varMatch[1] : 'variable';
              userMessageContent += `\n   🔧 **EXACT FIX STEPS:**\n`;
              userMessageContent += `   Step 1: read_file "${e.file || 'the file above'}"\n`;
              userMessageContent += `   Step 2: "${varName}" is used but never imported/defined\n`;
              userMessageContent += `   Step 3: Either add import statement OR define the variable\n`;
              userMessageContent += `   Step 4: Use morph_edit to add the import at the top of the file\n`;
            } else if (e.message?.includes('is not a function')) {
              userMessageContent += `\n   🔧 **EXACT FIX STEPS:**\n`;
              userMessageContent += `   Step 1: read_file "${e.file || 'the file above'}"\n`;
              userMessageContent += `   Step 2: Find where the function is called\n`;
              userMessageContent += `   Step 3: The variable is not a function - check its type/source\n`;
              userMessageContent += `   Step 4: Use morph_edit to add typeof check: if (typeof fn === 'function') fn()\n`;
            }
          });
        }
        
        if (agentDebugContext.networkErrors.length > 0) {
          userMessageContent += `\n**Network Errors:**\n`;
          agentDebugContext.networkErrors.slice(-3).forEach((e, i) => {
            userMessageContent += `${i + 1}. ${e.method} ${e.url} → ${e.status} ${e.statusText}\n`;
          });
        }
        
        userMessageContent += `\n📋 REQUIRED STEPS:\n1. Read the file(s) with the error\n2. Find the exact line causing the error\n3. Fix it using morph_edit or search_replace\n4. Call task_complete ONLY after fixing\n`;
      }
      
      // Agent conversation loop
      const messages: Array<{ role: string; parts: GeminiToolMessage[] }> = [
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
      // 🔒 NEW: RENDER PATH TRACKING - Know which files are actually used
      const allFilesCache: Record<string, string> = {};
      let activeRenderPath: Set<string> = new Set();
      let renderPathComputed = false;
      
      // 🔒 ENHANCED: INTENT PARSING - Extract specific anchors from user prompt (with debugContext)
      const intentAnchors = parseIntentAnchors(prompt, agentDebugContext);
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
      
      // Adaptive iteration budget: faster for short follow-up edits, fuller stamina for larger edits
      const maxIterations = agentMaxIterations;
      const toolCallsLog: ToolCallLogEntry[] = [];
      let taskCompleteResult: { summary: string; filesChanged: string[] } | null = null;
      let designCriticResult: DesignCriticResult | null = null;
      
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
4. Start with the strongest visible target and one coherent builder path - do not sound lost or procedural.
${explorationGuidance}
Do NOT call task_complete or respond without first exploring the codebase.
This is a HARD REQUIREMENT - the system will reject task_complete if no exploration was done.
`;
      messages.push({
        role: "user",
        parts: [{ text: mandatoryExplorationPrompt }]
      });
      // Smart model selection for agent mode
      const hasVisionInput = Boolean(body.images && body.images.length > 0);
      // fileCount already defined above in context optimization section
      const agentModelSelection = selectOptimalModel(prompt, hasVisionInput, 'agent', fileCount);
      const premiumDesignRequest = agentExecutionMode === 'design_rebuild' || isPremiumDesignRequest(prompt);
      
      // Track total input for cost estimation
      const totalInputText = systemPromptWithProjectId + userMessageContent;
      let totalOutputText = '';
      
      // Hard wall-clock budget guard — keep fast path tighter for short follow-up edit requests.
      const AGENT_BUDGET_MS = Math.max(30000, Math.min(agentBudgetMs, 110000));
      let budgetExceeded = false;
      const initialAgentModel = isLikelyFastFollowup ? GEMINI_MODEL_SIMPLE : agentModelSelection.model;
      const modelAttemptChain = [
        initialAgentModel,
        MODEL_FALLBACK[initialAgentModel],
        agentModelSelection.model,
        MODEL_FALLBACK[agentModelSelection.model],
        'gemini-2.5-flash',
      ].filter((modelName): modelName is string => typeof modelName === 'string' && modelName.length > 0)
        .filter((modelName, idx, arr) => arr.indexOf(modelName) === idx)
        .slice(0, 3);
      
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Budget check: bail out cleanly before the edge function gets killed
        const elapsedMs = Date.now() - agentStartTime;
        if (elapsedMs > AGENT_BUDGET_MS) {
          console.warn(`[Agent Mode] Budget exceeded at iteration ${iteration} (${elapsedMs}ms). Returning partial progress.`);
          budgetExceeded = true;
          break;
        }
        
        // Call Gemini with smart model selection + per-call retry on 429/5xx/timeout.
        // Fix B: on retry, drop to MODEL_FALLBACK[model] if available (e.g. 3.1-pro-preview → 2.5-pro)
        // so we never stack two failures on the same flaky preview model.
        let geminiResponse: Response | null = null;
        let iterLastError: Error | null = null;
        const iterMaxRetries = Math.max(1, modelAttemptChain.length);
        for (let iterAttempt = 1; iterAttempt <= iterMaxRetries; iterAttempt++) {
          const modelForAttempt = modelAttemptChain[Math.min(iterAttempt - 1, modelAttemptChain.length - 1)] || agentModelSelection.model;
          if (iterAttempt > 1) {
            console.warn(`[Agent Mode] Falling back to ${modelForAttempt} for retry`);
          }
          try {
            const remainingBudgetMs = AGENT_BUDGET_MS - (Date.now() - agentStartTime);
            if (remainingBudgetMs <= 10000) {
              iterLastError = new Error('TIME_BUDGET_EXCEEDED');
              break;
            }

            const perCallTimeoutMs = Math.max(12000, Math.min(35000, remainingBudgetMs - 8000));
            geminiResponse = await withTimeout(
              fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelForAttempt}:generateContent`,
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
                      maxOutputTokens: agentMaxOutputTokens,
                    },
                  }),
                }
              ),
              perCallTimeoutMs,
              'GEMINI_AGENT'
            );
            // Retry on transient HTTP errors
            if (geminiResponse && !geminiResponse.ok && (geminiResponse.status === 429 || geminiResponse.status >= 500) && iterAttempt < iterMaxRetries) {
              iterLastError = new Error(`Gemini HTTP ${geminiResponse.status}`);
              console.warn(`[Agent Mode] Iter ${iteration} attempt ${iterAttempt} got ${geminiResponse.status}, retrying...`);
              await new Promise(r => setTimeout(r, 1500));
              geminiResponse = null;
              continue;
            }
            break;
          } catch (err) {
            iterLastError = err instanceof Error ? err : new Error(String(err));
            console.warn(`[Agent Mode] Iter ${iteration} attempt ${iterAttempt} failed: ${iterLastError.message}`);
            const retriable = iterLastError.message.includes('TIMEOUT') || iterLastError.message.includes('429') || iterLastError.message.includes('fetch');
            if (iterAttempt < iterMaxRetries && retriable) {
              await new Promise(r => setTimeout(r, 1500));
            } else {
              throw iterLastError;
            }
          }
        }
        
        if (!geminiResponse) {
          if (iterLastError?.message === 'TIME_BUDGET_EXCEEDED') {
            budgetExceeded = true;
            break;
          }
          throw iterLastError || new Error('Agent Gemini call failed after retries');
        }
        
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
        const contentParts = toGeminiParts(content.parts);
        const textParts = contentParts.filter(isGeminiTextPart);
        textParts.forEach((p) => { totalOutputText += p.text; });
        
        // Add model response to messages
        messages.push({ role: "model", parts: contentParts });
        
        // Check for function calls
        const functionCalls = contentParts.filter(isGeminiFunctionCallPart);
        
        if (!functionCalls || functionCalls.length === 0) {
          // No function calls, check if we got a text response
          const textPart = contentParts.find(isGeminiTextPart);
          if (textPart) {
            // 🚀 MORPH FAST APPLY: Check for <edit> blocks in the response
            const morphEdits = parseMorphEdits(textPart.text);
            let autoMorphApplied = false;
            if (morphEdits.length > 0) {
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
                    
                    toolCallsLog.push({
                      tool: 'morph_edit_auto',
                      args: { path: edit.targetFile, instructions: edit.instructions, code_edit: edit.update },
                      result: { success: true, method: 'morph', changes: morphResult.changes }
                    });
                    
                    // Update file cache
                    fileContentCache.set(normalizedPath, morphResult.mergedCode);
                    allFilesCache[normalizedPath] = morphResult.mergedCode;
                    filesRead.add(normalizedPath);
                    filesEdited.add(normalizedPath);
                    lastEditPath = normalizedPath;
                    editVerificationPending = true;
                    autoMorphApplied = true;
                  } else {
                    console.error(`[Morph] Failed to apply edit to ${edit.targetFile}: ${morphResult.error}`);
                    toolCallsLog.push({
                      tool: 'morph_edit_auto',
                      args: { path: edit.targetFile, instructions: edit.instructions, code_edit: edit.update },
                      result: { success: false, error: morphResult.error }
                    });
                  }
                } catch (err) {
                  console.error(`[Morph] Exception applying edit to ${edit.targetFile}:`, err);
                }
              }

              if (autoMorphApplied) {
                const changedFiles = [...filesEdited].slice(-6);
                messages.push({
                  role: "user",
                  parts: [{
                    text: `Your <edit> blocks were applied successfully. Now do the required finish pass: 1) read_file each changed file to verify the final code, 2) fix anything still wrong, 3) call task_complete with a clear summary and the changed files: ${changedFiles.join(', ')}.`
                  }]
                });
                continue;
              }

              messages.push({
                role: "user",
                parts: [{
                  text: `Your <edit> blocks were detected but did not apply successfully. Read the target file, then either use morph_edit directly or output corrected <edit> blocks with exact target_file and better update context.`
                }]
              });
              continue;
            }
          }
          
          // 🚀 AUTO-SEARCH FALLBACK: If model skips tools on early iterations, WE run them automatically
          // This makes the AI Coder "Cascade-like" - always searches before editing
          if (iteration <= 1 && toolCallsLog.length === 0) {
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
            const autoSearchResults: Array<{ file: string; line: number; content: string }> = [];
            let bestMatchFile: string | null = null;
            let bestMatchContent: string | null = null;
            
            if (suggestedQueries.length > 0) {
              const searchQuery = suggestedQueries[0];
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
                  const matchedFile = (allProjectFiles || []).find((f: { path: string; content: string }) => f.path === bestMatchFile);
                  if (matchedFile) {
                    bestMatchContent = matchedFile.content;
                    filesRead.add(bestMatchFile);
                    if (typeof bestMatchContent === 'string') {
                      fileContentCache.set(bestMatchFile, bestMatchContent);
                    }
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
        const functionResponses: GeminiFunctionResponseMessage[] = [];
        
        for (const fc of functionCalls) {
          const { name, args } = fc.functionCall;
          
          // ========================================================================
          // 🔒 ENFORCEMENT: Read-before-edit check (like Cascade)
          // ========================================================================
          const policy = await enforceEditToolPolicy({
            toolName: name,
            args,
            projectId,
            supabase,
            knownFiles,
            filesRead,
            fileContentCache,
            allFilesCache,
            executionMode: agentExecutionMode
          });
          const targetPath = policy.targetPath;
          
          // ========================================================================
          // 🚀 MORPH DOCS WORKFLOW ENFORCEMENT: Search → Read → Edit → Verify
          // All edit tools (morph_edit, search_replace, write_file, insert_code)
          // ========================================================================
          const isEditTool = name === 'morph_edit' || name === 'search_replace' || name === 'write_file' || name === 'insert_code';
          
          if (isEditTool && targetPath) {
            if (policy.blockResult) {
              console.error(`[Agent Mode] 🚫 BLOCKED: ${policy.blockResult.error}`);
              toolCallsLog.push({ tool: name, args: normalizeToolCallArgs(args), result: policy.blockResult });
              functionResponses.push({
                functionResponse: { name, response: policy.blockResult }
              });
              continue;
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
                const fetchedContent = typeof fileData?.content === 'string' ? fileData.content : null;
                if (fetchedContent && targetPath) {
                  targetContent = fetchedContent;
                  fileContentCache.set(targetPath, fetchedContent);
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
                      break;
                    }
                  }
                }
                
                if (correctFile && correctFile !== targetPath) {
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
          const resultContent = getToolResultContent(result);
          if (name === 'read_file' && targetPath && resultContent) {
            filesRead.add(targetPath);
            // Cache file content for render path computation AND search_replace validation
            allFilesCache[targetPath] = resultContent;
            fileContentCache.set(targetPath, resultContent);
          }
          
          
          const grepMatches = toGrepMatches(result.matches);
          if (name === 'grep_search' && grepMatches.length > 0) {
            // Mark all files found in grep as "read" (agent knows about them)
            grepMatches.forEach((m) => filesRead.add(m.file));
            // 🔒 NEW: AMBIGUITY DETECTION
            const ambiguity = detectAmbiguity(toStrictGrepMatches(result.matches));
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
            // 🔒 NEW: RENDER PATH ENFORCEMENT - Check if edited file is in active render chain
            if (!renderPathComputed && Object.keys(allFilesCache).length > 0) {
              activeRenderPath = traceRenderPath(allFilesCache);
              renderPathComputed = true;
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
                            (_match: string, imports: string) => `import { BrowserRouter, ${imports.trim()} } from 'react-router-dom'`
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
          
          toolCallsLog.push({ tool: name, args: normalizeToolCallArgs(args), result });
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
            const successfulEdits = getSuccessfulEditToolCalls(toolCallsLog);
            
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
                error: 'BLOCKED: You claimed to complete an edit task but made NO successful edits. You MUST: 1) Use grep_search to find the code, 2) Use read_file to see the exact code, 3) Use morph_edit to make the change. Use search_replace only as backup. Try again!',
                hint: 'Use grep_search first to find where the code is, then read_file, then morph_edit.'
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
              const verificationIssues: string[] = [];
              
              for (const editedFile of filesEdited) {
                // Find the last successful edit to this file
                const lastEdit = [...toolCallsLog].reverse().find(tc => {
                  if (!EDIT_TOOL_NAMES.has(tc.tool) || tc.result?.success !== true) return false;
                  return getLoggedToolPath(tc) === editedFile;
                });
                
                if (lastEdit) {
                  // Verify the edit by checking if file was re-read after edit
                  const editIndex = toolCallsLog.indexOf(lastEdit);
                  const verifyRead = toolCallsLog.find((tc, idx) => 
                    idx > editIndex && tc.tool === 'read_file' && tc.args?.path === editedFile
                  );
                  
                  if (!verifyRead) {
                    console.warn(`[Agent Mode] ⚠️ VERIFICATION: ${editedFile} was not re-read after edit`);
                    // Perform async verification
                    const expectedContent = getExpectedVerificationContent(lastEdit);
                    const verification = await verifyEdit(
                      editedFile, 
                      expectedContent,
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
                console.warn(`[Agent Mode] 🚫 VERIFICATION BLOCK:`, verificationIssues);
                functionResponses[functionResponses.length - 1].functionResponse.response = {
                  acknowledged: false,
                  error: `BLOCKED: Final verification did not prove the edits. ${verificationIssues[0]}`,
                  issues: verificationIssues,
                  hint: 'Read each changed file again, confirm the final code really contains the intended change, then call task_complete.'
                };
                editVerificationPending = false;
                continue;
              }
              
              editVerificationPending = false;
            }

            if (successfulEdits.length > 0 && filesEdited.size > 0 && filesVerified.size === 0) {
              console.warn(`[Agent Mode] 🚫 VERIFIED-NOTHING BLOCK: edited=${filesEdited.size}, verified=${filesVerified.size}`);
              functionResponses[functionResponses.length - 1].functionResponse.response = {
                acknowledged: false,
                error: 'BLOCKED: You made edits but did not verify any final rendered file state. Re-read the changed files and confirm the real final code before completing.',
                filesEdited: [...filesEdited],
                hint: 'Use read_file on the changed files after editing, verify the result, then call task_complete.'
              };
              continue;
            }
            
            // All checks passed - allow task_complete
            if (result.acknowledged) {
              if (agentExecutionMode === 'design_rebuild' && successfulEdits.length > 0) {
                const criticCandidatePaths = toStringArray(result.filesChanged).length > 0
                  ? toStringArray(result.filesChanged)
                  : [...filesEdited];
                const criticFiles = await loadFilesForDesignCritic(supabase, projectId, criticCandidatePaths, allFilesCache);

                designCriticResult = await runDesignCritic(
                  prompt,
                  typeof result.summary === 'string' ? result.summary : 'Task completed',
                  criticFiles,
                );

                if (!designCriticResult.pass) {
                  console.warn(`[Agent Mode] 🚫 DESIGN CRITIC BLOCKED task_complete: ${designCriticResult.verdict}`);
                  resultWarnings.push(...designCriticResult.issues.map((issue) => `Design critic: ${issue}`));
                  functionResponses[functionResponses.length - 1].functionResponse.response = {
                    acknowledged: false,
                    error: `BLOCKED: Design critic rejected the result. ${designCriticResult.verdict}`,
                    issues: designCriticResult.issues,
                    requiredActions: designCriticResult.requiredActions,
                    score: designCriticResult.score,
                    reviewedFiles: designCriticResult.reviewedFiles,
                    hint: 'Do a stronger rewrite of the target section. Improve hierarchy, spacing, composition, typography, CTA placement, and overall premium feel before calling task_complete again.'
                  };
                  continue;
                }
              }

              // Add any warnings from verification
              const warnings = [];
              if (grepAmbiguityDetected) warnings.push('Multiple file candidates were found');
              if (filesEdited.size > filesVerified.size) warnings.push('Some edits were not verified');
              
              taskCompleteResult = {
                summary: typeof result.summary === 'string' ? result.summary : 'Task completed',
                filesChanged: toStringArray(result.filesChanged).length > 0 ? toStringArray(result.filesChanged) : [...filesEdited],
                ...(warnings.length > 0 ? { warnings } : {})
              };
            }
          }
        }
        
        // Add function responses to messages
        messages.push({ role: "user", parts: functionResponses });
        
        // If task is complete, exit loop
        if (taskCompleteResult) {
          break;
        }
      }

      if (budgetExceeded) {
        return createResponse({
          ok: true,
          mode: 'agent',
          result: {
            success: false,
            type: 'paused_for_budget',
            summary: 'Agent paused to stay within safe runtime budget. Resume to continue from the latest saved state.',
            filesChanged: collectFilesChangedFromToolCalls(toolCallsLog),
            error: 'TIME_BUDGET_EXCEEDED',
            warnings: ['Runtime budget reached before final verification.'],
          },
        });
      }
      
      // 🔒 HARDENED: Final safety check - ensure at least 1 meaningful tool call was made
      const meaningfulToolCalls = toolCallsLog.filter(tc => 
        tc.tool !== 'task_complete' && tc.result?.success !== false
      );
      
      if (meaningfulToolCalls.length === 0) {
        console.error(`[Agent Mode] 🔒 SAFETY BLOCK: Agent completed with ZERO meaningful tool calls!`);
        console.error(`[Agent Mode] All calls: ${toolCallsLog.map(tc => tc.tool).join(', ')}`);
        return createResponse({
          ok: true,
          mode: 'agent',
          result: {
            success: false,
            summary: 'The AI Coder failed to explore the codebase. Please try again with a more specific request.',
            filesChanged: [],
            error: 'NO_TOOL_CALLS'
          }
        });
      }
      
      // ========================================================================
      // 🎯 OPTION D: CLARIFICATION RESPONSE - When multiple candidates found
      // Return a special response type that frontend renders as a choice card
      // ========================================================================
      if (grepAmbiguityDetected && grepCandidateFiles.length > 1) {
        // Check if the agent made any edits despite ambiguity
        const successfulEditsCheck = getSuccessfulEditToolCalls(toolCallsLog);
        
        // If no successful edits and ambiguity detected, return clarification card
        if (successfulEditsCheck.length === 0) {
          // Extract candidate details from grep results
          const candidateDetails: Array<{ file: string; preview: string; line?: number }> = [];
          for (const tc of toolCallsLog) {
            if (tc.tool === 'grep_search' && tc.result?.matches) {
              for (const match of toGrepMatches(tc.result.matches)) {
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
          
          return createResponse({
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
          });
        }
      }
      
      // Collect all files that were written
      const filesChanged = collectFilesChangedFromToolCalls(toolCallsLog);

      const candidateFilesForVerification = [
        ...(taskCompleteResult?.filesChanged || []),
        ...filesChanged,
      ];

      const verifiedPersistedFilesChanged = await verifyPersistedFileChanges({
        supabase,
        projectId,
        baselineFiles: normalizedCurrentFilesBaseline,
        candidatePaths: candidateFilesForVerification,
      });

      const isLikelyEditIntent =
        /\b(change|update|fix|add|remove|set|make|edit|modify|delete|replace|rename|create|implement|build|write|code|connect|wire|style|design|layout|header|button|page|section|scroll|responsive|mobile|اصلح|عدل|غيّر|أضف|احذف|ابن|طوّر|حسّن)\b/i.test(prompt || '')
        || (/\b(in the|to the|on the|into|onto)\b/i.test(prompt || '') && !/\b(what|how|why|explain|tell me|show me|describe)\b/i.test(prompt || ''));

      if (isLikelyEditIntent && verifiedPersistedFilesChanged.length === 0 && !grepAmbiguityDetected) {
        return createResponse({
          ok: true,
          mode: 'agent',
          result: {
            success: false,
            type: 'no_verified_changes',
            summary: 'Agent run finished without verified persisted file changes. This request is marked not_applied.',
            filesChanged: [],
            error: 'NO_VERIFIED_CHANGES',
            warnings: [
              'Task completion was rejected for trust contract: no real code diff detected.',
            ],
          },
        });
      }
      
      // ========================================================================
      // SAFETY NET: Check for missing referenced files and auto-generate them
      // This catches cases where AI creates imports but forgets to create files
      // ========================================================================
      if (filesChanged.length > 0) {
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
      // ========================================================================
      // 🔒 UPGRADE #2: Multi-file Safety Guardrails Check
      // ========================================================================
      const multiFileGuardrail = checkMultiFileGuardrails(filesEdited, toolCallsLog, allFilesCache);
      
      // ========================================================================
      // 🧪 UPGRADE #3: Run Smoke Tests on Changed Files
      // ========================================================================
      const smokeTestResult = runSmokeTests([...filesEdited], allFilesCache);
      if (!smokeTestResult.passed) {
        console.warn(`[Agent Mode] 🧪 Smoke test FAILED: ${smokeTestResult.criticalErrors.join(', ')}`);
        resultWarnings.push(...smokeTestResult.criticalErrors);
      }

      // 🔗 Dead button/link checker — never blocks, just discloses in the final chat message
      const agentFakeElements: FakeElementFinding[] = [];
      for (const filePath of filesEdited) {
        const content = allFilesCache[filePath];
        if (content) agentFakeElements.push(...detectFakeInteractiveElements(content, filePath));
      }
      const agentFakeElementNote = formatFakeElementNote(agentFakeElements);

      let agentSummary = taskCompleteResult?.summary || `Agent completed after ${toolCallsLog.length} tool calls`;
      if (agentFakeElementNote) {
        agentSummary = `${agentSummary} | ${agentFakeElementNote}`;
      }

      const result: AgentResult = {
        success: true,
        summary: agentSummary,
        filesChanged: verifiedPersistedFilesChanged.length > 0
          ? verifiedPersistedFilesChanged
          : (taskCompleteResult?.filesChanged || [...new Set(filesChanged)]),
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
        warnings: [
          ...resultWarnings,
          ...(verifiedPersistedFilesChanged.length === 0
            ? ['Trust check: no persisted file diff verified in backend pass.']
            : []),
        ],
        designCritic: designCriticResult ? {
          pass: designCriticResult.pass,
          score: designCriticResult.score,
          verdict: designCriticResult.verdict,
          issues: designCriticResult.issues,
          requiredActions: designCriticResult.requiredActions,
          reviewedFiles: designCriticResult.reviewedFiles,
        } : undefined,
        // 🎯 NEW: Premium Upgrades
        changeReport,
        multiFileGuardrail,
        smokeTestResult
      };
      
      return createResponse({ 
        ok: true, 
        mode: 'agent',
        result,
        creditUsage: agentCreditUsage
      });
    }

    // PLAN MODE: Propose changes without executing (Lovable-style)
    // Now with SMART MODEL SELECTION and CREDIT LOGGING
    if (mode === 'plan') {
      if (!projectId) {
        return createResponse({ ok: false, error: 'Missing projectId' }, 400);
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
        
        const { plan, modelSelection: planModelSelection } = await callGeminiPlanMode(prompt, existingFiles);
        
        // Log credit usage for plan mode
        const planInputText = Object.values(existingFiles).join('\n') + prompt;
        const planCreditUsage = logCreditUsage('plan', planModelSelection, planInputText, plan, projectId);
        
        return createResponse({ ok: true, plan, mode: 'plan', creditUsage: planCreditUsage });
      } catch (planError) {
        const planErrorMessage = planError instanceof Error ? planError.message : String(planError);
        console.error(`[Plan Mode] Error: ${planErrorMessage}`);
        return createResponse({ ok: false, error: planErrorMessage }, 500);
      }
    }

    // ========================================================================
    // EXECUTE MODE V2: AGENT-STYLE EXECUTION (Tool-based targeted reading)
    // Instead of sending full file contents, we use agent loop with tools
    // This reduces input tokens from ~19K to ~3K (85% reduction!)
    // ========================================================================
    if (mode === 'execute') {
      if (!projectId) {
        return createResponse({ ok: false, error: 'Missing projectId' }, 400);
      }
      if (!planToExecute) {
        return createResponse({ ok: false, error: 'Missing planToExecute' }, 400);
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
        
        const fileList = ((existingRows || []) as Array<{ path: string }>).map((r: { path: string }) => normalizeFilePath(r.path)).join('\n');
        const fileCount = existingRows?.length || 0;

        // 🚀 ITEM 3 — PRE-LOAD PLAN FILES (skip redundant read_file tool calls)
        // Extract paths the plan explicitly references and fetch their current content
        // so the agent has them in its first prompt. Saves ~2 tool calls per file.
        let preloadedFilesStr = '';
        const preloadedFilesMap: Record<string, string> = {};
        try {
          const planPathMatches = Array.from(
            String(planToExecute).matchAll(/["'`\s](\/[A-Za-z0-9_./-]+\.(?:jsx?|tsx?|css|scss|html|json|md))\b/g)
          ).map(m => m[1]);
          const uniquePaths = [...new Set(planPathMatches)].slice(0, 15); // cap at 15 to stay token-safe

          if (uniquePaths.length > 0) {
            const { data: planFileRows } = await supabase
              .from('project_files')
              .select('path, content')
              .eq('project_id', projectId)
              .in('path', uniquePaths);

            if (planFileRows && planFileRows.length > 0) {
              preloadedFilesStr = '\n\n📂 PRE-LOADED FILES (referenced by the plan — no read_file needed):\n';
              for (const row of planFileRows as Array<{ path: string; content: string }>) {
                const content = typeof row.content === 'string' ? row.content : '';
                if (content.length < 50_000) {
                  preloadedFilesMap[normalizeFilePath(row.path)] = content;
                  preloadedFilesStr += `\n--- FILE: ${row.path} ---\n${content}\n---------------------------\n`;
                }
              }
            }
          }
        } catch (preloadErr) {
          console.warn('[Execute] Plan preload failed (non-fatal):', preloadErr);
        }

        // Prepare agent-style system prompt for execute mode
        const execExecutionMode = resolveAgentExecutionMode(`${planToExecute}\n${userInstructions || ''}`, requestedExecutionMode ?? debugContext?.executionMode);
        const executeSystemPrompt = AGENT_SYSTEM_PROMPT.replace(/\{\{PROJECT_ID\}\}/g, projectId) + buildAgentExecutionModeInstructions(execExecutionMode) + `

## 🎯 EXECUTE MODE SPECIFIC INSTRUCTIONS

You are in EXECUTE MODE. A plan has already been created and approved. Your job is to EXECUTE IT PRECISELY.

**EXECUTION RULES:**
1. Read the plan carefully
2. Use read_file to get file contents BEFORE editing (unless pre-loaded)
3. You are powered by Morph AST Engine. You MUST use morph_edit for all code changes. Do not use search_replace unless morph_edit explicitly fails or it is a simple 1-line exact string match.
4. Use write_file ONLY for new files unless DESIGN REBUILD mode requires a read-first rewrite of an existing target file.
5. Execute ALL steps in the plan
6. Call task_complete when done with a summary of what you changed

**DO NOT:**
- Skip any step in the plan
- Deviate from the plan
- Add features not in the plan
- Make assumptions - read files first!`;
        const sharedExecuteAwarenessContext = buildUnifiedProjectAwarenessContext({
          projectId,
          currentFiles: normalizedCurrentFilesBaseline,
          uploadedAssets,
          backendContext,
          documentContentBlocks: [documentContentStr],
          visionInspiration: visionInspirationStr,
          assetIntentPrompt,
          includeProjectStructure: true,
        });
        
        // Prepare execute mode user message (FILE LIST + pre-loaded plan files)
        const executeUserMessage = `📁 PROJECT FILES (${fileCount} files):
${fileList}
${preloadedFilesStr}
${sharedExecuteAwarenessContext}

⚙️ EXECUTION MODE: ${execExecutionMode === 'design_rebuild' ? 'DESIGN REBUILD' : 'SURGICAL EDIT'}
⚠️ IMPORTANT: For files already pre-loaded above, you already have the content — go straight to morph_edit. Use read_file ONLY for files NOT pre-loaded.

📋 PLAN TO EXECUTE:
${planToExecute}

${userInstructions ? `ADDITIONAL INSTRUCTIONS:\n${userInstructions}\n\n` : ''}
Execute this plan step by step. Read files first (if not pre-loaded), then make changes using morph_edit.
Call task_complete when finished.`;
        
        // Agent loop for execute mode (shared tool mental model with higher iteration stamina)
        const execMessages: Array<{ role: string; parts: GeminiToolMessage[] }> = [
          { role: "user", parts: [{ text: executeUserMessage }] }
        ];
        
        const execMaxIterations = 15; // Increased from 3 to 15 for site-wide execution stamina
        const execToolCallsLog: ToolCallLogEntry[] = [];
        let execTaskCompleteResult: { summary: string; filesChanged: string[] } | null = null;
        const execKnownFiles: Set<string> = new Set((existingRows || []).map((r: { path: string }) => normalizeFilePath(r.path)));
        const execFilesRead: Set<string> = new Set(Object.keys(preloadedFilesMap));
        const execFilesEdited = new Set<string>();
        const execAllFilesCache: Record<string, string> = { ...preloadedFilesMap };
        const execFileContentCache: Map<string, string> = new Map<string, string>(Object.entries(preloadedFilesMap));
        const execFilesVerified = new Set<string>();
        let execEditVerificationPending = false;
        
        // Model selection for execute mode
        const execModelSelection = selectOptimalModel(planToExecute, false, 'execute', fileCount);
        const execTotalInputText = executeSystemPrompt + executeUserMessage;
        let execTotalOutputText = '';
        
        // Empty debug context for execute mode
        const execDebugContext: AgentDebugContext = {
          errors: [],
          networkErrors: [],
          consoleLogs: [],
          selectedElement: normalizeAgentSelectedElement(debugContext?.selectedElement),
          executionMode: execExecutionMode
        };
        
        const GEMINI_API_KEY_EXEC = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
        if (!GEMINI_API_KEY_EXEC) throw new Error("GEMINI_API_KEY missing");
        
        for (let iteration = 0; iteration < execMaxIterations; iteration++) {
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
                    // NOTE: Do NOT use responseMimeType with function calling - it breaks tool use
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
          const contentParts = toGeminiParts(content.parts);
          const textParts = contentParts.filter(isGeminiTextPart);
          textParts.forEach((p) => { execTotalOutputText += p.text; });
          
          execMessages.push({ role: "model", parts: contentParts });
          
          // Check for function calls
          const functionCalls = contentParts.filter(isGeminiFunctionCallPart);
          
          if (!functionCalls || functionCalls.length === 0) {
            break;
          }
          
          // Execute function calls
          const functionResponses: GeminiFunctionResponseMessage[] = [];
          
          for (const fc of functionCalls) {
            const { name, args } = fc.functionCall;
            
            const policy = await enforceEditToolPolicy({
              toolName: name,
              args,
              projectId,
              supabase,
              knownFiles: execKnownFiles,
              filesRead: execFilesRead,
              fileContentCache: execFileContentCache,
              allFilesCache: execAllFilesCache,
              executionMode: execExecutionMode
            });
            const targetPath = policy.targetPath;

            let result: ToolCallResult;
            if (policy.blockResult) {
              result = policy.blockResult;
            } else {
              result = await executeToolCall(projectId, { name, arguments: args || {} }, execDebugContext, supabase, userId) as ToolCallResult;
            }

            if (name === 'read_file' && targetPath && typeof result.content === 'string') {
              execFilesRead.add(targetPath);
              execAllFilesCache[targetPath] = result.content;
              execFileContentCache.set(targetPath, result.content);
            }

            if (targetPath && EDIT_TOOL_NAMES.has(name) && result.success === true) {
              execFilesEdited.add(targetPath);
              execEditVerificationPending = true;
            }
            
            execToolCallsLog.push({ tool: name, args: normalizeToolCallArgs(args), result });
            functionResponses.push({
              functionResponse: { name, response: result }
            });
            
            // Check for task_complete
            if (name === 'task_complete' && result.acknowledged === true) {
              const successfulExecEdits = getSuccessfulEditToolCalls(execToolCallsLog);
              if (successfulExecEdits.length === 0) {
                execTaskCompleteResult = null;
                functionResponses[functionResponses.length - 1].functionResponse.response = {
                  acknowledged: false,
                  error: 'BLOCKED: Execute mode completed without any successful edits. Read the target files and use morph_edit to execute the plan.',
                  hint: 'Use morph_edit as the primary edit tool. Use search_replace only as backup.'
                };
                continue;
              }

              if (execFilesEdited.size > 0 && execEditVerificationPending) {
                const verificationIssues: string[] = [];
                for (const editedFile of execFilesEdited) {
                  const lastEdit = [...execToolCallsLog].reverse().find(tc => {
                    if (!EDIT_TOOL_NAMES.has(tc.tool) || tc.result?.success !== true) return false;
                    return getLoggedToolPath(tc) === editedFile;
                  });

                  if (!lastEdit) continue;

                  const expectedContent = getExpectedVerificationContent(lastEdit);
                  const verification = await verifyEdit(
                    editedFile,
                    expectedContent,
                    execAllFilesCache,
                    supabase,
                    projectId
                  );

                  if (!verification.verified) {
                    verificationIssues.push(...verification.issues);
                  }

                  if (verification.fileInRenderPath) {
                    execFilesVerified.add(editedFile);
                  }
                }

                execEditVerificationPending = false;

                if (verificationIssues.length > 0) {
                  execTaskCompleteResult = null;
                  functionResponses[functionResponses.length - 1].functionResponse.response = {
                    acknowledged: false,
                    error: `BLOCKED: Execute mode edits were not verified. ${verificationIssues[0]}`,
                    issues: verificationIssues
                  };
                  continue;
                }
              }

              execTaskCompleteResult = {
                summary: typeof result.summary === 'string' ? result.summary : 'Plan executed',
                filesChanged: toStringArray(result.filesChanged)
              };
            }
          }
          
          execMessages.push({ role: "user", parts: functionResponses });
          
          if (execTaskCompleteResult) {
            break;
          }
        }
        
        // Collect files changed
        const execFilesChanged = collectFilesChangedFromToolCalls(execToolCallsLog);
        
        // Log credit usage
        const execCreditUsage = logCreditUsage('execute', execModelSelection, execTotalInputText, execTotalOutputText, projectId);
        
        await updateJob(supabase, job.id, { 
          status: 'succeeded', 
          result_summary: execTaskCompleteResult?.summary || `Executed plan with ${execToolCallsLog.length} tool calls`, 
          error: null 
        });
        
        return createResponse({ 
          ok: true, 
          jobId: job.id, 
          status: 'succeeded', 
          mode: 'execute-agent',
          filesChanged: [...new Set(execFilesChanged)],
          summary: execTaskCompleteResult ? execTaskCompleteResult.summary : 'Plan executed',
          toolCalls: execToolCallsLog.length,
          creditUsage: execCreditUsage 
        });
        
      } catch (innerErr) {
        const innerMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
        const innerStack = innerErr instanceof Error ? innerErr.stack : '';
        console.error(`[Execute Mode V2] Error: ${innerMsg}`);
        console.error(`[Execute Mode V2] Stack: ${innerStack}`);
        await updateJob(supabase, job.id, { status: 'failed', error: innerMsg, result_summary: null });
        // Return detailed error for debugging
        return createResponse({ 
          ok: false, 
          jobId: job.id, 
          error: innerMsg,
          errorDetails: innerStack?.substring(0, 500) || 'No stack trace'
        }, 500);
      }
    }

    // CREATE and EDIT modes require projectId and prompt
    if (!projectId) {
      return createResponse({ ok: false, error: 'Missing projectId' }, 400);
    }
    if (!prompt) {
      return createResponse({ ok: false, error: 'Missing prompt' }, 400);
    }

    await assertProjectOwnership(supabase, projectId, userId);

    const safeMode: 'create' | 'edit' = mode === 'edit' ? 'edit' : 'create';
    const job = await createJob(supabase, {
      projectId,
      userId,
      mode: safeMode,
      prompt,
      metadata: safeMode === 'create'
        ? { createStage: 'drafting', draftSaved: false, polishAttempted: false, polishApplied: false }
        : {},
    });

    // ========================================================================
    // ASYNC BACKGROUND WORKER: Run generation in background, return immediately
    // ========================================================================
    // This prevents the 150s gateway timeout from killing the request
    // The frontend will poll for status using action: 'status'
    
    // Heartbeat helper - updates job every 15 seconds to show it's still alive
    let heartbeatInterval: number | undefined;
    const startHeartbeat = (jobId: string) => {
      heartbeatInterval = setInterval(async () => {
        try {
          await supabase
            .from('project_generation_jobs')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', jobId);
        } catch (e) {
          console.warn(`[Heartbeat] Failed to update:`, e);
        }
      }, 15000) as unknown as number;
    };
    const stopHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };

    // ========================================================================
    // BACKGROUND WORKER FUNCTION - runs after we return to client
    // ========================================================================
    const runGenerationWorker = async () => {
      // Start heartbeat immediately
      startHeartbeat(job.id);
      let createDraftSaved = false;
      let createRecoveredSummary: string | null = null;
      
    try {
      // Handle theme selection - prioritize detailed userInstructions from frontend theme picker
      let selectedThemeDesc: string;
      if (userInstructions && userInstructions.trim().length > 20) {
        // Frontend sent detailed theme instructions (colors, typography, shadows, layout, mood)
        // These are MUCH richer than THEME_PRESETS one-liners — use them as primary
        selectedThemeDesc = userInstructions;
      } else if (theme === 'user_prompt' || !theme) {
        selectedThemeDesc = extractThemeFromPrompt(prompt);
      } else {
        selectedThemeDesc = THEME_PRESETS[theme] || THEME_PRESETS['none'];
      }
      // CRITICAL: Force theme instructions to be the most important rule
      const themeEnforcement = `\n\nCRITICAL STYLE RULES (MUST FOLLOW):\n${selectedThemeDesc}\n\nIMPORTANT: Define these colors as CSS variables in :root and use var(--...) everywhere. Ensure ALL components use these exact colors and vibe. DO NOT USE DEFAULT COLORS.`;
      
      // Language instructions for content generation
      const langInstructions = lang === 'ar' 
        ? `\n\n🌍 LANGUAGE REQUIREMENT - ARABIC (العربية):\n- Generate ALL user-facing text content in Arabic\n- Use Arabic script for ALL labels, buttons, headings, descriptions, and placeholder text\n- Add dir="rtl" to the root element for proper RTL layout\n- Keep code comments and variable names in English\n- Example: Instead of "Welcome" use "مرحباً", instead of "Contact Us" use "تواصل معنا"`
        : '';
      
      // 🧠 THREE-LAYER PROMPT: auto-detect which capability docs belong to this prompt.
      //   Layer 1 (CORE) is the slim BASE_SYSTEM_PROMPT.
      //   Layer 2 (MANIFEST) is always appended so the AI knows what's available.
      //   Layer 3 (DOCS) is conditional — only the relevant ones get injected.
      const { names: detectedCaps, text: capabilityDocsText } = assembleCapabilityDocs(prompt);
      const capabilityBlock = `${CAPABILITY_MANIFEST}${capabilityDocsText}`;
      if (detectedCaps.length > 0) {
        console.log(`[CreateMode] Capabilities detected for prompt: ${detectedCaps.join(', ')}`);
      } else {
        console.log(`[CreateMode] No capabilities detected — manifest-only (slim path).`);
      }

      const finalSystemPrompt = BASE_SYSTEM_PROMPT
        .replace("{{THEME_INSTRUCTIONS}}", themeEnforcement)
        .replace("{{ALLOWED_PACKAGES_LIST}}", formatPackagesForPrompt())
        .replace("{{CAPABILITY_DOCS}}", capabilityBlock) + langInstructions;

      // CREATE MODE: Generate new project from scratch
      if (safeMode === 'create') {
        // 🔧 FIX: Start the safety clock here, BEFORE image generation, not after.
        // Previously this was set right before the draft call, which meant the
        // minutes spent generating 5-6 images were invisible to the polish
        // time-budget guard below. That let the total job time blow past the
        // platform's execution limit without the guard ever tripping, leaving
        // jobs stuck in "running" forever.
        const createStartTime = Date.now();
        // 🔧 FIX: Confirmed via Supabase docs + this project's org plan (Pro) that
        // background tasks (EdgeRuntime.waitUntil) get a 400s wall-clock ceiling.
        // Every AI call below used to have a flat hardcoded 120s timeout no matter
        // how much of that budget was already spent — which caused GEMINI_CALL_TIMEOUT
        // failures on complex prompts (rich e-commerce/booking flows, detailed custom
        // themes) that genuinely need more than 120s to generate 10k-30k tokens of
        // code. Each call below now gets a timeout sized from whatever budget is
        // actually left, so a fast image-gen phase means a much bigger window for the
        // draft call, while the total never risks crossing the real platform ceiling.
        const CREATE_TOTAL_TIME_BUDGET_MS = 360000; // 6 min, ~40s safety margin under the 400s ceiling
        const remainingCreateBudgetMs = () => CREATE_TOTAL_TIME_BUDGET_MS - (Date.now() - createStartTime);
        await patchJobMetadata(
          supabase,
          job.id,
          { createStage: 'generating_images' },
          {
            at: new Date().toISOString(),
            step: 'generating_images',
            status: 'in_progress',
            note: 'Generating custom images for your site',
          },
        );
        // Pre-generate and store images from Nano Banana 2 based on user's prompt
        const hasUploadedPersonalPhoto = uploadedAssets.some((a) => (a.file_type || '').toLowerCase().startsWith('image/'));
        const imageSectionQueries = await extractImageQueriesAI(prompt, hasUploadedPersonalPhoto);
        const imageQueryStrings = imageSectionQueries.map((q) => q.query);
        const projectImageSurface = detectProjectImageSurface(prompt);
        let preFetchedImages: PreFetchedImage[] = [];
        const sharedCreateAwarenessContext = buildUnifiedProjectAwarenessContext({
          projectId,
          uploadedAssets,
          backendContext,
          documentContentBlocks: [documentContentStr],
          visionInspiration: visionInspirationStr,
          assetIntentPrompt,
        });
        
        if (imageQueryStrings.length > 0) {
          try {
            preFetchedImages = await preFetchAndStoreImages(supabase, projectId, userId, imageQueryStrings, projectImageSurface);
          } catch (prefetchErr) {
            console.warn(`[Create Mode] Image pre-generation failed:`, prefetchErr);
            // Continue without pre-fetched images
          }
        }
        
        let textPrompt = `CREATE NEW PROJECT.\n\nREQUEST: ${prompt}\n\n${userInstructions || ""}`;
        if (assetIntentPrompt) {
          textPrompt += `\n\n🧭 ${assetIntentPrompt}`;
        }
        textPrompt += `\n\n🏆 MASTER BUILDER STANDARD:\nYou are the master builder behind the screen. You have one shot to stop the user in their tracks, make them feel the weight of what you've built, and impress them and wow them and ensure they never forget the experience.\n\nThe user's prompt is your brief — it is the floor, never the ceiling. You own the structure, the priority, and the final outcome. Your job is to listen to what they asked for, obey it, identify what they actually need to be blown away, and deliver that.\n\nBuild the most powerful, visceral, and uncompromising version of this reality. You are to deliver the best of the best only.`;
        
        // Add pre-fetched images as a SECTION MAP so AI places each image in the right section.
        // Hoisted into its own variable so the timeout-retry slim prompt below can reuse it too —
        // previously the slim prompt dropped this entirely, so any draft that needed a retry
        // shipped with zero image usage even though the images were already generated and paid for.
        let imageSectionMapBlock = '';
        if (preFetchedImages.length > 0) {
          // Build section → URL map by matching stored image queries back to their section
          const sectionMap: Record<string, string> = {};
          for (const img of preFetchedImages) {
            const match = imageSectionQueries.find((q) => q.query === img.query);
            if (match && !sectionMap[match.section]) {
              sectionMap[match.section] = img.storedUrl;
            }
          }
          const sectionLines = Object.entries(sectionMap)
            .map(([section, url]) => `  ${section.toUpperCase().replace(/_/g, ' ')} → ${url}`)
            .join('\n');
          imageSectionMapBlock = `\n\n🖼️ PRE-GENERATED IMAGES — SECTION MAP (NANO-BANANA-2-LITE):\nEach image was generated specifically for its designated section. Place each URL only in its matching section:\n${sectionLines}\n\nRULES:\n- Use each URL in its designated section only\n- Use these URLs directly as <img src="..."> — do NOT call any stock image API\n- If a section has no mapped image, use another URL creatively by vibe — never leave an image slot empty`;
          textPrompt += imageSectionMapBlock;
        }
        if (sharedCreateAwarenessContext) {
          textPrompt += `\n\n${sharedCreateAwarenessContext}`;
        }
        
        if (assets && assets.length > 0) textPrompt += `\n\nUSE THESE ASSETS: ${assets.join(", ")}`;

        const groundedFreshnessInstructions = buildGroundedFreshnessInstructions(prompt);
        if (groundedFreshnessInstructions) {
          textPrompt += groundedFreshnessInstructions;
        }
        
        // 🔧 FIX: Extract PDF content from images array (attached PDFs in chat)
        // This handles PDFs attached via the attach button, not just uploadedAssets
        if (images && images.length > 0) {
          const GEMINI_API_KEY_CREATE = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
          let hasPdfAttachment = false;
          let pdfExtractedContent = '';
          
          for (const imgData of images) {
            if (typeof imgData !== 'string') continue;
            
            // Check if it's a PDF (marked with [PDF:filename] prefix)
            if (imgData.startsWith('[PDF:')) {
              hasPdfAttachment = true;
              const endBracket = imgData.indexOf(']');
              if (endBracket > 0) {
                const pdfName = imgData.substring(5, endBracket);
                const pdfBase64Data = imgData.substring(endBracket + 1);
                
                try {
                  const pdfMatches = pdfBase64Data.match(/^data:([^;]+);base64,(.+)$/);
                  if (pdfMatches && GEMINI_API_KEY_CREATE) {
                    const pdfMimeType = pdfMatches[1];
                    const pdfBase64 = pdfMatches[2];
                    
                    const extractResponse = await fetch(
                      `https://generativelanguage.googleapis.com/v1beta/models/${getDocumentExtractionModel()}:generateContent`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-goog-api-key": GEMINI_API_KEY_CREATE,
                        },
                        body: JSON.stringify({
                          contents: [{
                            role: "user",
                            parts: [
                              { inlineData: { mimeType: pdfMimeType, data: pdfBase64 } },
                              { text: `Extract ALL text content from this PDF document. This appears to be a CV/Resume or important document.
                              
Return the COMPLETE text content including:
- Name and contact information
- Professional summary/objective
- Work experience (company names, job titles, dates, responsibilities)
- Education (degrees, institutions, dates)
- Skills (technical and soft skills)
- Certifications, awards, languages
- Any other relevant information

Format the output clearly with sections. Do NOT summarize - extract the FULL text.` }
                            ]
                          }],
                          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                        }),
                      }
                    );
                    
                    if (extractResponse.ok) {
                      const extractData = await extractResponse.json();
                      const extractedText = extractData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                      if (extractedText) {
                        pdfExtractedContent += `\n\n📄 **EXTRACTED CONTENT FROM ${pdfName}:**\n${extractedText}`;
                      }
                    } else {
                      console.error(`[Create Mode] PDF extraction API error: ${extractResponse.status}`);
                    }
                  }
                } catch (pdfErr) {
                  console.error(`[Create Mode] PDF extraction error:`, pdfErr);
                }
              }
            }
          }
          
          // Add extracted PDF content to prompt
          if (pdfExtractedContent) {
            textPrompt += `

📄 **EXTRACTED DOCUMENT CONTENT FROM ATTACHED PDF** (USE THIS DATA TO BUILD THE WEBSITE):
${pdfExtractedContent}

🚨 **CRITICAL**: The above content was extracted from the user's uploaded PDF (CV/Resume/etc).
USE THIS REAL DATA to populate the website - names, experience, skills, education, contact info, etc.
DO NOT make up fake information. Use EXACTLY what is in the extracted content above.
If this is a portfolio/CV website, use the person's REAL name, REAL experience, REAL skills from the document.`;
          }
          
          // Only add screenshot-to-code prefix if there are actual images (not just PDFs)
          if (!hasPdfAttachment || images.some(img => typeof img === 'string' && !img.startsWith('[PDF:'))) {
            textPrompt = `SCREENSHOT-TO-CODE: Analyze the attached screenshot(s) and recreate this UI as a React application.\n\n${textPrompt}`;
          }
        }

        // Use the configured create model for project generation
        const shouldEnableGoogleSearch = shouldUseGoogleSearchGrounding(prompt);
        if (shouldEnableGoogleSearch) {
          console.log(`[CreateMode] Google Search grounding enabled for freshness-sensitive sports prompt.`);
        }
        await patchJobMetadata(
          supabase,
          job.id,
          {
            createStage: 'drafting',
            draftSaved: false,
            polishAttempted: false,
            polishApplied: false,
          },
          {
            at: new Date().toISOString(),
            step: 'drafting',
            status: 'in_progress',
            note: 'Building the working first draft',
          },
        );
        let aiText: string;
        let draftFallbackUsed = false;
        try {
          // Reserve 100s of the remaining budget for a possible slim retry + save/polish
          // bookkeeping; give everything else to this first, best-quality attempt.
          const draft1TimeoutMs = Math.max(90000, Math.min(220000, remainingCreateBudgetMs() - 100000));
          aiText = await callGemini25Pro(finalSystemPrompt, textPrompt, true, {
            enableGoogleSearch: shouldEnableGoogleSearch,
            timeoutMs: draft1TimeoutMs,
          });
        } catch (draftErr) {
          const draftErrMsg = draftErr instanceof Error ? draftErr.message : String(draftErr);
          const draftErrCode = classifyCreateErrorCode(draftErrMsg);
          if (draftErrCode !== 'validation' && draftErrCode !== 'timeout' && draftErrCode !== 'json') {
            throw draftErr;
          }
          draftFallbackUsed = true;
          const slimPrompt = `CREATE NEW PROJECT.\n\nREQUEST SUMMARY:\n${prompt}\n\n${userInstructions || ""}\n\nDRAFT-FIRST FALLBACK MODE:\nReturn a smaller but complete first draft. Prioritize one strong homepage/app shell, valid routing, mounted runtime entry, key sections, backend-safe structure, and clear CTA flow. Keep the project polished enough to ship as a first draft, but avoid extra complexity that could break the run.${imageSectionMapBlock}`;
          await patchJobMetadata(
            supabase,
            job.id,
            {
              createStage: 'drafting',
              draftFallbackUsed: true,
              initialDraftError: draftErrMsg.slice(0, 1000),
            },
            {
              at: new Date().toISOString(),
              step: 'drafting',
              status: 'in_progress',
              note: 'Retrying with a slimmer first-draft prompt',
            },
          );
          // Retry gets whatever safely remains — smaller if the first attempt ate
          // most of the budget, but never less than 45s for a genuinely simpler prompt.
          const draft2TimeoutMs = Math.max(45000, Math.min(180000, remainingCreateBudgetMs() - 30000));
          aiText = await callGemini25Pro(finalSystemPrompt, slimPrompt, true, {
            enableGoogleSearch: shouldEnableGoogleSearch,
            timeoutMs: draft2TimeoutMs,
          });
        }
        const createDuration = Date.now() - createStartTime;
        // Log AI usage for project creation
        await logAIFromRequest(req, {
          functionName: "projects-generate",
          provider: "google",
          model: GEMINI_MODEL_CREATE,
          inputText: textPrompt.substring(0, 1000),
          outputText: aiText.substring(0, 500),
          durationMs: createDuration,
          status: "success",
          metadata: { mode: "create", project_id: projectId, theme: theme, draft_fallback_used: draftFallbackUsed }
        });

        let content = extractJsonObject(aiText);
        content = fixUnescapedNewlines(content);
        let parsed = JSON.parse(content);
        let { files, summary } = coerceFilesMap(parsed);
        // If AI returned HTML instead of React, retry with ultra-strict prompt.
        // 🔧 FIX: This safety-net retry previously had no timeout budget and no
        // try/catch — a single slow or timed-out retry threw uncaught and killed
        // the entire job, discarding a working draft1 and already-paid-for images.
        // It now gets a bounded, remaining-budget-aware timeout and falls back to
        // keeping draft1's files on failure instead of destroying the whole job;
        // the existing MISSING_APP_JS/assertNoHtml checks below still make the
        // final call on whether the result is actually usable.
        if (!files["/App.js"] || files["/App.js"]?.toLowerCase().includes("<!doctype")) {
          const strictPrompt = `You are a REACT CODE generator. Return ONLY a JSON object with React files.

CRITICAL: Your response must be a JSON object like this:
{
  "/App.js": "import React from 'react';\\nexport default function App() { return (<div>...</div>); }"
}

DO NOT return HTML. DO NOT use <!DOCTYPE>. DO NOT use <html> tags.
The /App.js file MUST start with: import React from 'react';

USER REQUEST: ${prompt}

Return ONLY the JSON object. No explanation.`;

          try {
            const htmlRetryTimeoutMs = Math.max(30000, Math.min(120000, remainingCreateBudgetMs() - 15000));
            const retryAiText = await callGemini25Pro(strictPrompt, "", true, { timeoutMs: htmlRetryTimeoutMs });
            const retryContent = fixUnescapedNewlines(extractJsonObject(retryAiText));
            const retryParsed = JSON.parse(retryContent);
            const retryResult = coerceFilesMap(retryParsed);
            if (retryResult.files["/App.js"] && !retryResult.files["/App.js"].toLowerCase().includes("<!doctype")) {
              files = retryResult.files;
              summary = retryResult.summary;
            } else {
              console.warn('[Create Mode] HTML-retry did not return a valid /App.js — keeping draft1 output.');
            }
          } catch (htmlRetryErr) {
            const htmlRetryMsg = htmlRetryErr instanceof Error ? htmlRetryErr.message : String(htmlRetryErr);
            console.warn(`[Create Mode] HTML-retry failed (${htmlRetryMsg}) — keeping draft1 output.`);
          }
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

        // Theme Consistency Linter (Item 8) — detect hardcoded colors outside :root
        const themeWarnings = validateThemeConsistency(files);
        if (themeWarnings.length > 0) {
          console.warn(formatThemeWarnings(themeWarnings));
          const themeSummary = `🎨 ${themeWarnings.length} hardcoded color${themeWarnings.length === 1 ? '' : 's'} outside :root — theme changes may not apply everywhere`;
          summary = summary ? `${summary} | ${themeSummary}` : themeSummary;
        }

        // Inject project ID into backend API calls (catches multiple placeholder patterns)
        for (const [path, content] of Object.entries(files)) {
          // Replace all known placeholder patterns
          const fixed = content.replace(/\{\{PROJECT_ID\}\}|PROJECT_ID_HERE/g, projectId);
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

        files = replaceBannedImageHostsInFiles(
          files,
          preFetchedImages.map((img) => img.storedUrl).filter((url) => typeof url === 'string' && url.trim().length > 0)
        );

        // Check if project uses backend API and auto-enable it
        const usesBackend = Object.values(files).some(content => 
          content.includes('project-backend-api')
        );
        await supabase.from('project_backends').upsert({
          project_id: projectId,
          user_id: userId,
          enabled: true,
          enabled_at: new Date().toISOString(),
          features: { forms: true }
        }, { onConflict: 'project_id' });

        await patchJobMetadata(
          supabase,
          job.id,
          {
            createStage: 'saving_draft',
            draftFallbackUsed,
          },
          {
            at: new Date().toISOString(),
            step: 'saving_draft',
            status: 'in_progress',
            note: 'Saving the working first draft',
          },
        );
        await replaceProjectFiles(supabase, projectId, files);
        createDraftSaved = true;
        createRecoveredSummary = summary || 'Working first draft saved.';
        const bootstrappedNotes: string[] = [];
        try {
          const bootstrapResults = await bootstrapBackendData(supabase, projectId, userId, files, prompt, preFetchedImages);
          if (bootstrapResults.servicesSeeded > 0) bootstrappedNotes.push(`Seeded ${bootstrapResults.servicesSeeded} services`);
          if (bootstrapResults.productsSeeded > 0) bootstrappedNotes.push(`Seeded ${bootstrapResults.productsSeeded} products`);
        } catch (bootstrapErr) {
          const bootstrapMsg = bootstrapErr instanceof Error ? bootstrapErr.message : String(bootstrapErr);
          bootstrappedNotes.push(`Backend bootstrap skipped: ${bootstrapMsg}`);
          await patchJobMetadata(supabase, job.id, {
            bootstrapWarning: bootstrapMsg.slice(0, 1000),
          });
        }
        await patchJobMetadata(
          supabase,
          job.id,
          {
            createStage: 'polishing',
            draftSaved: true,
            draftSummary: createRecoveredSummary,
            polishAttempted: true,
            polishApplied: false,
          },
          {
            at: new Date().toISOString(),
            step: 'polishing',
            status: 'in_progress',
            note: 'Working draft saved. Adding premium polish.',
          },
        );

        let finalSummary = summary || 'Created.';
        if (bootstrappedNotes.length > 0) {
          finalSummary = `${finalSummary} | ${bootstrappedNotes.join(' | ')}`;
        }

        // Safety budget: polish runs a second full Gemini call (up to 120s) on top of
        // whatever drafting already took. If drafting alone (including a timeout-retry)
        // already ate a large chunk of the background-task time budget, attempting polish
        // risks the whole worker being killed by the platform mid-call, which leaves the
        // job stuck in "running" forever since neither the success path nor the catch
        // below ever gets to run. Skip polish outright once past a safe threshold so the
        // draft we already saved reliably ships as the final result instead of risking a hang.
        const elapsedSinceStartMs = Date.now() - createStartTime;
        const POLISH_TIME_BUDGET_MS = 240000; // 4 minutes
        if (elapsedSinceStartMs > POLISH_TIME_BUDGET_MS) {
          finalSummary = `${finalSummary} | Working draft saved. Premium polish was skipped to avoid a timeout (drafting already took ${Math.round(elapsedSinceStartMs / 1000)}s).`;
          createRecoveredSummary = finalSummary;
          await patchJobMetadata(
            supabase,
            job.id,
            {
              createStage: 'done',
              draftSaved: true,
              polishAttempted: false,
              polishApplied: false,
              polishSkippedReason: 'time_budget_exceeded',
            },
            {
              at: new Date().toISOString(),
              step: 'done',
              status: 'completed',
              note: 'Working draft kept — skipped premium polish to avoid a timeout',
            },
          );
        } else {
        await patchJobMetadata(
          supabase,
          job.id,
          {
            createStage: 'polishing',
            draftSaved: true,
            draftSummary: createRecoveredSummary,
            polishAttempted: true,
            polishApplied: false,
          },
          {
            at: new Date().toISOString(),
            step: 'polishing',
            status: 'in_progress',
            note: 'Working draft saved. Adding premium polish.',
          },
        );

        try {
          // 🔧 FIX: The draft prompt included the pre-generated image section map
          // (imageSectionMapBlock) so the AI knew which real image URL to place in
          // which section. This polish prompt is a SEPARATE full-rewrite call — if it
          // doesn't repeat that map, the AI has no memory of the images and can drop
          // or replace them while rewriting sections, wasting images that were already
          // generated and paid for.
          const polishImageReminder = preFetchedImages.length > 0
            ? `${imageSectionMapBlock}\n\n⚠️ These images are ALREADY placed in the current draft — KEEP every one of them in its section exactly as-is. Do not remove, replace, or leave any of them unused while polishing.`
            : '';
          const polishPrompt = `${prompt}\n\nThe working first draft is already saved. Upgrade it into a premium final version without breaking the runtime entry, routing, backend wiring, or any working section. Improve hierarchy, composition, visual rhythm, CTA clarity, spacing, premium feel, and first impression. Keep all existing working functionality intact.${polishImageReminder}`;
          // Give polish whatever safely remains of the total budget, capped at a sane
          // range — it's a full-rewrite call too, so it's just as prone to the old flat
          // 120s being too short for a large, feature-rich site.
          const polishTimeoutMs = Math.max(60000, Math.min(150000, remainingCreateBudgetMs() - 20000));
          const polishResult = await callGeminiFullRewriteEdit(
            polishPrompt,
            files,
            userInstructions,
            undefined, // CV/images not needed — draft already has CV content baked in; re-passing causes PDF re-extraction hang
            assetIntent,
            uploadedAssets,
            backendContext,
            documentContentStr, // already extracted CV/doc text
            visionInspirationStr,
            projectId,
            polishTimeoutMs,
          );
          let finalPolishFiles: Record<string, string> = polishResult.files || {};
          const missing = findMissingReferencedFiles({ changedFiles: finalPolishFiles, existingFiles: files });
          if (missing.length > 0) {
            const generatedMissing = await callGeminiMissingFiles(missing, finalPolishFiles, files, polishPrompt);
            finalPolishFiles = { ...finalPolishFiles, ...generatedMissing };
          }
          for (const [path, content] of Object.entries(finalPolishFiles)) {
            finalPolishFiles[path] = content.replace(/\{\{PROJECT_ID\}\}|PROJECT_ID_HERE/g, projectId);
          }
          finalPolishFiles = replaceBannedImageHostsInFiles(
            finalPolishFiles,
            preFetchedImages.map((img) => img.storedUrl).filter((url) => typeof url === 'string' && url.trim().length > 0)
          );
          if (Object.keys(finalPolishFiles).length > 0) {
            await upsertProjectFiles(supabase, projectId, finalPolishFiles);
            files = { ...files, ...finalPolishFiles };
          }
          if (polishResult.summary) {
            finalSummary = `${finalSummary} | ${polishResult.summary}`;
          }
          createRecoveredSummary = finalSummary;
          await patchJobMetadata(
            supabase,
            job.id,
            {
              createStage: 'done',
              draftSaved: true,
              polishAttempted: true,
              polishApplied: true,
            },
            {
              at: new Date().toISOString(),
              step: 'done',
              status: 'completed',
              note: 'Premium polish applied successfully',
            },
          );
        } catch (polishErr) {
          const polishMsg = polishErr instanceof Error ? polishErr.message : String(polishErr);
          finalSummary = `${finalSummary} | Working draft saved. Premium polish was skipped: ${buildCreateFailureSummary(polishMsg)}`;
          createRecoveredSummary = finalSummary;
          await patchJobMetadata(
            supabase,
            job.id,
            {
              createStage: 'done',
              draftSaved: true,
              polishAttempted: true,
              polishApplied: false,
              polishError: polishMsg.slice(0, 1000),
              errorCode: classifyCreateErrorCode(polishMsg),
              errorDetail: polishMsg.slice(0, 1000),
            },
            {
              at: new Date().toISOString(),
              step: 'done',
              status: 'completed',
              note: 'Working draft kept because premium polish failed',
            },
          );
        }
        }

        // 🔗 Dead button/link checker — never blocks, just discloses in the final chat message
        const createFakeElements: FakeElementFinding[] = [];
        for (const [path, content] of Object.entries(files)) {
          createFakeElements.push(...detectFakeInteractiveElements(content, path));
        }
        const createFakeElementNote = formatFakeElementNote(createFakeElements);
        if (createFakeElementNote) {
          finalSummary = `${finalSummary} | ${createFakeElementNote}`;
          createRecoveredSummary = createRecoveredSummary ? `${createRecoveredSummary} | ${createFakeElementNote}` : createRecoveredSummary;
        }

        stopHeartbeat();
        await updateJob(supabase, job.id, { status: 'succeeded', result_summary: createRecoveredSummary || finalSummary, error: null });
        return; // Worker done - job status updated in DB
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

      const userPrompt = `${prompt}\n\n${userInstructions || ""}`;
      
      // USE FULL REWRITE - NO PATCHES (now with image support + uploaded assets + backend context + extracted content)
      const imageArray = Array.isArray(images) ? images as unknown as string[] : undefined;
      const editStartTime = Date.now();
      const result = await callGeminiFullRewriteEdit(userPrompt, existingFiles, userInstructions, imageArray, assetIntent, uploadedAssets, backendContext, documentContentStr, visionInspirationStr, projectId);
      const editDuration = Date.now() - editStartTime;
      const changedFiles = result.files || {};
      
      // Log AI usage for edit mode
      await logAIFromRequest(req, {
        functionName: "projects-generate",
        provider: "google",
        model: GEMINI_MODEL_VISION,
        inputText: userPrompt.substring(0, 1000),
        outputText: JSON.stringify(Object.keys(changedFiles)),
        durationMs: editDuration,
        status: "success",
        metadata: { mode: "edit", project_id: projectId, files_changed: Object.keys(changedFiles).length }
      });
      
      if (Object.keys(changedFiles).length === 0) {
        console.error(`[Edit Mode] WARNING: AI returned no changed files!`);
      }
      
      if (changedFiles["/App.js"]) assertNoHtml("/App.js", changedFiles["/App.js"]);

      const missing = findMissingReferencedFiles({ changedFiles, existingFiles });
      let finalFilesToUpsert: Record<string, string> = { ...changedFiles };

      if (missing.length > 0) {
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

      // Theme Consistency Linter (Item 8) — detect hardcoded colors outside :root
      const editThemeWarnings = validateThemeConsistency(allFilesToCheck);
      if (editThemeWarnings.length > 0) {
        console.warn(formatThemeWarnings(editThemeWarnings));
        const themeSummary = `🎨 ${editThemeWarnings.length} hardcoded color${editThemeWarnings.length === 1 ? '' : 's'} outside :root`;
        result.summary = result.summary ? `${result.summary} | ${themeSummary}` : themeSummary;
      }

      // 🔗 Dead button/link checker — never blocks, just discloses in the final chat message
      const editFakeElements: FakeElementFinding[] = [];
      for (const [path, content] of Object.entries(finalFilesToUpsert)) {
        editFakeElements.push(...detectFakeInteractiveElements(content, path));
      }
      const editFakeElementNote = formatFakeElementNote(editFakeElements);
      if (editFakeElementNote) {
        result.summary = result.summary ? `${result.summary} | ${editFakeElementNote}` : editFakeElementNote;
      }

      // Inject project ID into backend API calls (catches multiple placeholder patterns)
      for (const [path, content] of Object.entries(finalFilesToUpsert)) {
        // Replace all known placeholder patterns
        const fixed = content.replace(/\{\{PROJECT_ID\}\}|PROJECT_ID_HERE/g, projectId);
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

      finalFilesToUpsert = replaceBannedImageHostsInFiles(
        finalFilesToUpsert,
        uploadedAssets?.map((asset) => asset.url).filter((url) => typeof url === 'string' && url.trim().length > 0) || []
      );

      // Option A: Always enable backend for every project (so generated projects are always "live")
      await supabase.from('project_backends').upsert({
        project_id: projectId,
        user_id: userId,
        enabled: true,
        enabled_at: new Date().toISOString(),
        features: { forms: true }
      }, { onConflict: 'project_id' });

      await upsertProjectFiles(supabase, projectId, finalFilesToUpsert);
      
      stopHeartbeat();
      await updateJob(supabase, job.id, { status: 'succeeded', result_summary: result.summary || 'Updated.', error: null });
      return; // Worker done - job status updated in DB

    } catch (innerErr) {
      const innerMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      stopHeartbeat();
      try {
        if (safeMode === 'create' && createDraftSaved) {
          const recoveredSummary = createRecoveredSummary || 'Working draft saved. Premium polish stopped early, so the saved draft was kept.';
          await updateJob(supabase, job.id, { status: 'succeeded', error: null, result_summary: recoveredSummary });
          await patchJobMetadata(
            supabase,
            job.id,
            {
              createStage: 'done',
              draftSaved: true,
              polishAttempted: true,
              polishApplied: false,
              polishError: innerMsg.slice(0, 1000),
              recoveredAfterError: true,
              errorCode: classifyCreateErrorCode(innerMsg),
              errorDetail: innerMsg.slice(0, 1000),
            },
            {
              at: new Date().toISOString(),
              step: 'done',
              status: 'completed',
              note: recoveredSummary,
            },
          );
        } else {
          await updateJob(supabase, job.id, { status: 'failed', error: innerMsg, result_summary: null });
          if (safeMode === 'create') {
            await patchJobMetadata(
              supabase,
              job.id,
              {
                createStage: 'failed',
                draftSaved: false,
                errorCode: classifyCreateErrorCode(innerMsg),
                errorDetail: innerMsg.slice(0, 1000),
                failureSummary: buildCreateFailureSummary(innerMsg),
              },
              {
                at: new Date().toISOString(),
                step: 'failed',
                status: 'failed',
                note: buildCreateFailureSummary(innerMsg),
              },
            );
          }
        }
      } catch (e) {
        console.error('[projects-generate] Failed to mark job failed:', e);
      }
      console.error(`[Background Worker] Job ${job.id} failed: ${innerMsg}`);
    }
    }; // End of runGenerationWorker

    // ========================================================================
    // RUN GENERATION IN BACKGROUND - Return jobId immediately
    // ========================================================================
    // The frontend will poll for status using action: 'status'
    // This prevents the 150s gateway timeout from killing the request
    
    // Use EdgeRuntime.waitUntil if available, otherwise run synchronously
    // EdgeRuntime.waitUntil allows the function to return immediately while
    // the generation continues in the background
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(runGenerationWorker());
      // Return immediately with jobId - frontend will poll for status
      return createResponse({ ok: true, jobId: job.id, status: 'running' });
    } else {
      await runGenerationWorker();
      return createResponse({ ok: true, jobId: job.id, status: 'succeeded' });
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Fatal Error]", errMsg);
    return new Response(JSON.stringify({ ok: false, error: errMsg }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
