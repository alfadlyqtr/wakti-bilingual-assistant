// Helper: JSON-encode each shared edge-function dependency to a single .json
// file so it can be inlined verbatim into a Supabase MCP deploy payload.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const sharedDir = resolve(root, "supabase/functions/_shared");
const files = ["a4-themes.ts", "a4-prompts.ts", "a4-prompt-engineer.ts", "gemini.ts"];

for (const f of files) {
  const src = readFileSync(resolve(sharedDir, f), "utf8");
  const out = JSON.stringify(src);
  writeFileSync(resolve(__dirname, `${f}.encoded.json`), out, "utf8");
  console.log(`encoded ${f}: ${src.length} chars -> ${out.length} json bytes`);
}

// Also encode the function entrypoints we plan to redeploy.
const fns = ["a4-callback", "a4-generate"];
for (const fn of fns) {
  const src = readFileSync(resolve(root, `supabase/functions/${fn}/index.ts`), "utf8");
  const out = JSON.stringify(src);
  writeFileSync(resolve(__dirname, `${fn}.index.encoded.json`), out, "utf8");
  console.log(`encoded ${fn}/index.ts: ${src.length} chars -> ${out.length} json bytes`);
}
