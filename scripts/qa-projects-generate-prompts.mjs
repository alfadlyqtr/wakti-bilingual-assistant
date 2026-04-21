import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");

function read(relativePath) {
  return readFileSync(resolve(rootDir, relativePath), "utf8");
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Start marker not found: ${startMarker}`);
  }

  const contentStart = start + startMarker.length;
  const end = source.indexOf(endMarker, contentStart);
  if (end === -1) {
    throw new Error(`End marker not found: ${endMarker}`);
  }

  return source.slice(contentStart, end);
}

function collectBacktickTokens(text) {
  const normalized = text.replace(/\\`/g, "`");
  return [...normalized.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function extractAgentPrompt(source) {
  const match = source.match(/export const AGENT_SYSTEM_PROMPT = `([\s\S]*?)`;\r?\n\r?\n\/\/ Normalize file path to always start with \//);
  if (!match) {
    throw new Error("Could not extract AGENT_SYSTEM_PROMPT");
  }

  return match[1];
}

const results = [];
const warnings = [];

function pass(name, details = "") {
  results.push({ passed: true, name, details });
}

function fail(name, details = "") {
  results.push({ passed: false, name, details });
}

function warn(message) {
  warnings.push(message);
}

function check(condition, name, details = "") {
  if (condition) {
    pass(name, details);
  } else {
    fail(name, details);
  }
}

const agentToolsPath = "supabase/functions/projects-generate/agentTools.ts";
const capabilityIndexPath = "supabase/functions/projects-generate/prompts/capabilities/index.ts";

const agentToolsSource = read(agentToolsPath);
const capabilityIndexSource = read(capabilityIndexPath);

const prompt = extractAgentPrompt(agentToolsSource);

const promptLineCount = prompt.split(/\r?\n/).length;
const promptCharCount = prompt.length;

check(promptLineCount <= 900, "AGENT_SYSTEM_PROMPT line budget", `lines=${promptLineCount}, max=900`);
check(promptCharCount <= 36000, "AGENT_SYSTEM_PROMPT char budget", `chars=${promptCharCount}, max=36000`);

if (promptLineCount > 850) {
  warn(`Prompt lines are getting high: ${promptLineCount}`);
}

if (promptCharCount > 34000) {
  warn(`Prompt chars are getting high: ${promptCharCount}`);
}

const requiredPromptSections = [
  "# 🧱 THE LEGO PHILOSOPHY",
  "## 🎯 STEP 0: TRIAGE",
  "## ✏️ EDITING RULES - MORPH FIRST!",
  "## ✅ VERIFY BEFORE \"DONE\"",
  "## BACKEND API (for THIS project only)",
  "## 🔴 CRITICAL: QUESTIONS vs CODE CHANGES",
];

for (const section of requiredPromptSections) {
  check(prompt.includes(section), `Required prompt section present`, section);
}

const forbiddenPromptSections = [
  "## 🛠️ IMPLEMENTATION PATTERNS (Copy-Paste Ready)",
  "## ⚠️ TOOL SELECTION RULES - CRITICAL",
  "## 🔒 MANDATORY: morph_edit OVER write_file",
];

for (const section of forbiddenPromptSections) {
  check(!prompt.includes(section), "Legacy prompt block removed", section);
}

check(!prompt.includes("`stockImages`"), "No invalid stockImages capability alias", "Use `stock_images` instead");

const capabilityTypeBlock = extractBetween(capabilityIndexSource, "export type CapabilityName =", ";");
const capabilityNames = [...capabilityTypeBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const uniqueCapabilityNames = [...new Set(capabilityNames)];

check(uniqueCapabilityNames.length === 5, "Capability registry count", `count=${uniqueCapabilityNames.length}`);

const capabilityHintMatch = prompt.match(/matching capability name \(([^\n]+)\)/);
if (capabilityHintMatch) {
  const hintedNames = collectBacktickTokens(capabilityHintMatch[1]).filter((token) => token !== "get_capability_doc");
  const invalidHintedNames = hintedNames.filter((name) => !uniqueCapabilityNames.includes(name));
  check(invalidHintedNames.length === 0, "Prompt capability names align with registry", invalidHintedNames.join(", ") || hintedNames.join(", "));
} else {
  fail("Prompt capability hint present", "Could not find the get_capability_doc capability-name guidance line");
}

const capabilityFiles = {
  phaser_game: "supabase/functions/projects-generate/prompts/capabilities/phaser.ts",
  stock_images: "supabase/functions/projects-generate/prompts/capabilities/stockImages.ts",
  forms: "supabase/functions/projects-generate/prompts/capabilities/forms.ts",
  booking: "supabase/functions/projects-generate/prompts/capabilities/booking.ts",
  ecommerce: "supabase/functions/projects-generate/prompts/capabilities/ecommerce.ts",
};

for (const [capabilityName, filePath] of Object.entries(capabilityFiles)) {
  const source = read(filePath);
  check(source.includes("export const"), `Capability file exports prompt`, `${capabilityName} -> ${filePath}`);

  if (capabilityName !== "phaser_game") {
    check(source.includes("{{PROJECT_ID}}"), `Capability doc keeps PROJECT_ID placeholder`, capabilityName);
    check(source.includes("project-backend-api"), `Capability doc keeps backend API contract`, capabilityName);
  }
}

const stockCapabilitySource = read(capabilityFiles.stock_images);
check(stockCapabilitySource.includes("/utils/stockImages.js"), "Stock images capability still documents helper file", "/utils/stockImages.js");

const passedCount = results.filter((item) => item.passed).length;
const failed = results.filter((item) => !item.passed);

console.log("\nProjects Generate Prompt QA\n");
console.log(`Prompt size: ${promptLineCount} lines, ${promptCharCount} chars`);
console.log(`Checks: ${passedCount}/${results.length} passed`);

for (const item of results) {
  const icon = item.passed ? "PASS" : "FAIL";
  const suffix = item.details ? ` - ${item.details}` : "";
  console.log(`${icon} ${item.name}${suffix}`);
}

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const message of warnings) {
    console.log(`WARN ${message}`);
  }
}

if (failed.length > 0) {
  console.error(`\nPrompt QA failed with ${failed.length} failing check(s).`);
  process.exit(1);
}

console.log("\nPrompt QA passed.");
