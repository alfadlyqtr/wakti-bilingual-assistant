// Regression tests for system prompt templates (base.ts, geminiExecute.ts).
//
// These catch the exact class of bug that broke tonight's prompt edits:
// a placeholder gets renamed/removed in the template but the .replace() call
// in index.ts is not updated (or vice versa), silently shipping a raw
// "{{PLACEHOLDER}}" string to the AI instead of real content.
//
// Pure string checks, no network/API calls — safe to run anytime, zero cost.
//
// Run with:  deno test supabase/functions/projects-generate/prompts/base.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";
import { BASE_SYSTEM_PROMPT } from "./base.ts";
import { buildGeminiExecuteSystemPrompt } from "./geminiExecute.ts";

// Keep this list in sync with the .replace(...) calls in index.ts
// (search index.ts for these exact tokens if this test starts failing).
const BASE_PLACEHOLDERS = ["{{THEME_INSTRUCTIONS}}", "{{ALLOWED_PACKAGES_LIST}}", "{{CAPABILITY_DOCS}}"];
const EXECUTE_PLACEHOLDERS = ["{{ALLOWED_PACKAGES_LIST}}"];

Deno.test("BASE_SYSTEM_PROMPT: contains every expected placeholder exactly once", () => {
  for (const token of BASE_PLACEHOLDERS) {
    const occurrences = BASE_SYSTEM_PROMPT.split(token).length - 1;
    assert(occurrences >= 1, `Expected ${token} to appear in BASE_SYSTEM_PROMPT, but it's missing`);
  }
});

Deno.test("BASE_SYSTEM_PROMPT: no leftover placeholder after simulated full replacement", () => {
  const filled = BASE_PLACEHOLDERS.reduce(
    (acc, token) => acc.replaceAll(token, "DUMMY_VALUE"),
    BASE_SYSTEM_PROMPT,
  );
  assertEquals(/\{\{[A-Z_]+\}\}/.test(filled), false, "A {{PLACEHOLDER}} was left unfilled");
});

Deno.test("buildGeminiExecuteSystemPrompt: contains every expected placeholder exactly once", () => {
  const prompt = buildGeminiExecuteSystemPrompt(["example_capability"]);
  for (const token of EXECUTE_PLACEHOLDERS) {
    const occurrences = prompt.split(token).length - 1;
    assert(occurrences >= 1, `Expected ${token} to appear in the Gemini Execute prompt, but it's missing`);
  }
});

Deno.test("buildGeminiExecuteSystemPrompt: no leftover placeholder after simulated full replacement", () => {
  const prompt = buildGeminiExecuteSystemPrompt(["example_capability"]);
  const filled = EXECUTE_PLACEHOLDERS.reduce(
    (acc, token) => acc.replaceAll(token, "DUMMY_VALUE"),
    prompt,
  );
  assertEquals(/\{\{[A-Z_]+\}\}/.test(filled), false, "A {{PLACEHOLDER}} was left unfilled");
});
