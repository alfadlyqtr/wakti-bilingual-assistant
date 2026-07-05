// Throwaway syntax-check harness for project-build's packageShims.
// Extracts each shim's template-literal body and runs `node --check` against it
// (ESM-aware parse only, no execution/resolution) to catch template-literal /
// escaping mistakes early, before writing more shims on top of broken ones.
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';

const filePath = 'c:/winsurf/wakti-bilingual-assistant/supabase/functions/project-build/index.ts';
const src = readFileSync(filePath, 'utf8');

const startMarker = 'const packageShims: Record<string, string> = {';
const startIdx = src.indexOf(startMarker);
if (startIdx === -1) throw new Error('Could not find packageShims start');

// Find the matching closing "    };" for the object literal by tracking brace depth
// from just after the opening brace.
let i = startIdx + startMarker.length;
let depth = 1;
while (depth > 0 && i < src.length) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') depth--;
  i++;
}
const block = src.slice(startIdx, i);

// Match each 'key': `...` entry (no nested backticks are used inside bodies by convention)
const entryRe = /'((?:[^'\\]|\\.)*)':\s*`([\s\S]*?)`/g;
let match;
let count = 0;
let failures = [];
const seenKeys = {};
while ((match = entryRe.exec(block)) !== null) {
  const key = match[1];
  const body = match[2];
  seenKeys[key] = (seenKeys[key] || 0) + 1;
  count++;
  // Step 1: resolve backslash-escapes exactly like TypeScript would, by
  // actually re-executing the raw body inside a real template literal
  // (node --check alone does NOT resolve escapes, so testing the raw
  // extracted text directly gives false positives/negatives for any
  // shim using \\, \n, etc. inside regexes).
  const resolveFile = `.tmp_shim_resolve_${count}.mjs`;
  const resolvedFile = `.tmp_shim_resolved_${count}.mjs`;
  const wrapper = "import { writeFileSync } from 'fs';\nconst __shim = `" + body + "`;\nwriteFileSync(" + JSON.stringify(resolvedFile) + ", __shim, 'utf8');\n";
  writeFileSync(resolveFile, wrapper, 'utf8');
  try {
    execSync(`node ${resolveFile}`, { stdio: 'pipe' });
    execSync(`node --check ${resolvedFile}`, { stdio: 'pipe' });
  } catch (err) {
    failures.push({ key, error: err.stderr ? err.stderr.toString() : String(err) });
  }
  try { unlinkSync(resolveFile); } catch {}
  try { unlinkSync(resolvedFile); } catch {}
}

const dupeKeys = Object.keys(seenKeys).filter((k) => seenKeys[k] > 1);
console.log('Duplicate top-level shim keys:', dupeKeys.length ? dupeKeys.join(', ') : 'NONE');

console.log(`Checked ${count} shim entries.`);
if (failures.length === 0) {
  console.log('ALL SHIMS PASS SYNTAX CHECK.');
} else {
  console.log(`${failures.length} FAILURES:`);
  failures.forEach((f) => {
    console.log(`\n--- ${f.key} ---`);
    console.log(f.error);
  });
  process.exitCode = 1;
}
