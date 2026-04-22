/**
 * Model selection & pricing (Item 5, safe split).
 *
 * Pure data + routing logic — no side effects, no runtime state. Drives the
 * "smart model selection" strategy: cheap Flash for simple edits, Pro for
 * creation & complex agent work.
 *
 * Env overrides (all optional):
 *   GEMINI_MODEL_CREATE, GEMINI_MODEL_AGENT, GEMINI_MODEL_PLAN,
 *   GEMINI_MODEL_SIMPLE, GEMINI_MODEL_VISION
 */

// Declare Deno for TS servers that don't know about it (edge runtime only).
// deno-lint-ignore no-explicit-any
declare const Deno: any;

export interface ModelSelection {
  model: string;
  reason: string;
  tier: 'lite' | 'flash' | 'pro';
}

/** Pricing per 1M tokens (input/output) — used for cost estimation in logs. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite':   { input: 0.075, output: 0.30 },
  'gemini-2.5-flash':        { input: 0.15,  output: 0.60 },
  'gemini-2.0-flash':        { input: 0.10,  output: 0.40 },
  'gemini-2.5-pro':          { input: 1.25,  output: 5.00 },
  // Gemini 3.x preview models
  'gemini-3-flash-preview':  { input: 0.15,  output: 0.60 },
  'gemini-3.1-pro-preview':  { input: 1.25,  output: 5.00 },
};

// ============================================================================
// GEMINI 3.x MODEL SELECTION (env-driven, auto-fallback to 2.5)
// ============================================================================
// Default to stable 2.5 models. Preview 3.x models are too slow/rate-limited for the
// agent loop (150s edge-function budget) and cause GEMINI_AGENT_TIMEOUT failures.
// Opt-in to preview models via env vars when Google stabilises them.
export const GEMINI_MODEL_CREATE = Deno.env.get('GEMINI_MODEL_CREATE') || 'gemini-2.5-pro';
export const GEMINI_MODEL_AGENT  = Deno.env.get('GEMINI_MODEL_AGENT')  || 'gemini-2.5-flash';
export const GEMINI_MODEL_PLAN   = Deno.env.get('GEMINI_MODEL_PLAN')   || 'gemini-2.5-flash';
export const GEMINI_MODEL_SIMPLE = Deno.env.get('GEMINI_MODEL_SIMPLE') || 'gemini-2.5-flash-lite';
export const GEMINI_MODEL_VISION = Deno.env.get('GEMINI_MODEL_VISION') || 'gemini-2.5-flash';

/** Fallback map: if a 3.x model fails, retry with its 2.5 equivalent. */
export const MODEL_FALLBACK: Record<string, string> = {
  'gemini-3.1-pro-preview': 'gemini-2.5-pro',
  'gemini-3-flash-preview': 'gemini-2.5-flash',
};

// Patterns shared by plan / execute / chat and agent modes.
const SIMPLE_PATTERNS: RegExp[] = [
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

const COMPLEX_PATTERNS: RegExp[] = [
  /\b(refactor|restructure|redesign|rebuild|rewrite|architect)/i,
  /\b(create|build|implement|add)\s+(a\s+)?(new\s+)?(page|feature|system|module|component)/i,
  /\b(integrate|connect|setup|configure)\s+(the\s+)?(api|backend|database|auth)/i,
  /\b(multi-?step|workflow|wizard|form\s+validation)/i,
  /\b(complex|advanced|sophisticated)/i,
  /\b(debug|fix\s+crash|runtime\s+error|broken)/i,
];

export function selectOptimalModel(
  prompt: string,
  hasImages: boolean,
  mode: string,
  _fileCount: number = 0,
): ModelSelection {
  // PRO tier: Creation always uses the best Pro model
  if (mode === 'create') {
    return { model: GEMINI_MODEL_CREATE, reason: 'Project creation requires Pro (3.1)', tier: 'pro' };
  }

  if (hasImages) {
    return { model: GEMINI_MODEL_VISION, reason: 'Vision/screenshot analysis (3 Flash)', tier: 'flash' };
  }

  const promptLower = prompt.toLowerCase();

  // Agent/edit mode always uses Pro for superior tool-use reasoning
  if (mode === 'agent') {
    for (const pattern of SIMPLE_PATTERNS) {
      if (pattern.test(promptLower)) {
        return { model: GEMINI_MODEL_SIMPLE, reason: 'Simple agent edit (3 Flash)', tier: 'flash' };
      }
    }
    // Everything else in agent mode → Pro
    return { model: GEMINI_MODEL_AGENT, reason: 'Agent/edit mode requires Pro (3.1)', tier: 'pro' };
  }

  // plan / execute / chat modes
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(promptLower)) {
      return { model: GEMINI_MODEL_SIMPLE, reason: 'Simple edit (3 Flash)', tier: 'flash' };
    }
  }

  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(promptLower)) {
      return { model: GEMINI_MODEL_AGENT, reason: 'Complex operation (3.1 Pro)', tier: 'pro' };
    }
  }

  // Default: Flash for planning/aux (fast + smart)
  return { model: GEMINI_MODEL_PLAN, reason: 'Standard planning (3 Flash)', tier: 'flash' };
}
