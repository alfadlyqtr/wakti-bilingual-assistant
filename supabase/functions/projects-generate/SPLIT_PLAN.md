# `projects-generate` — Split Plan

Status as of **Item 5** remediation:

## What was extracted (safe, pure-data)

| File | What | Lines moved |
|------|------|-------------|
| `./prompts/themes.ts` | `THEME_PRESETS` | ~41 |
| `./prompts/fixer.ts`  | `FIXER_SYSTEM_PROMPT` | ~50 |
| `./models/selection.ts` | `MODEL_PRICING`, `GEMINI_MODEL_*`, `MODEL_FALLBACK`, `selectOptimalModel`, `ModelSelection` type | ~116 |

**Also deleted:** `_GEMINI_EDIT_FULL_REWRITE_PROMPT` (42 lines of dead code, already prefixed `_`).

## What remains in `index.ts`

The two largest prompts are **still inline** in `index.ts` because they contain:
- Nested backticks (fenced code examples)
- Escaped `${...}` sequences
- Tens of full JSX/React examples
- Backend-URL constants that expand to environment-specific values

Moving them cleanly requires a dedicated session with tests or staging validation.

| Constant | Location | Approx size | Status |
|----------|----------|-------------|--------|
| `BASE_SYSTEM_PROMPT` | `index.ts` ~L2475+ | ~700 lines / ~30 KB | ⏳ Deferred — Phase 2 |
| `GEMINI_EXECUTE_SYSTEM_PROMPT` | `index.ts` ~L3200+ | ~230 lines / ~10 KB | ⏳ Deferred — Phase 2 |
| `FOUNDATION_BRICKS` array | `index.ts` ~L3220+ | ~20 lines | ✅ Keep inline (small) |

## Phase 2 (future work — ~1 day, dedicated session)

Before attempting, set up at least one of:
1. Smoke test via a staging Supabase project that can run `projects-generate`.
2. Playwright test that triggers a simple "create a landing page" flow and asserts a valid JSON response.

### Phase 2a — Extract remaining prompts
Create:
- `./prompts/base.ts` → `BASE_SYSTEM_PROMPT`
- `./prompts/execute.ts` → `GEMINI_EXECUTE_SYSTEM_PROMPT`

After each, diff the generated output against an identical prompt before the move (byte-for-byte match — escaping is unforgiving here).

### Phase 2b — Extract model callers
Create `./models/gemini.ts` holding all the `callGemini*` variants (currently ~600 lines spread inside `index.ts`):
- `callGeminiWithModel`
- `callGemini25Pro`
- `callGemini25ProWithImages`
- `callGeminiPlanMode`
- `callGeminiExecuteMode`
- `callGeminiFullRewriteEdit`
- `callGeminiMissingFiles`

And `./models/fixerModel.ts` with `callClaudeOpus4Fixer` (keep internal function name for low risk; it's an impl detail).

### Phase 2c — Extract enforcement helpers
Many `filesRead`, `filesEdited`, `knownFiles` tracking helpers live inline. Move to `./enforcement/readBeforeEdit.ts`.

### Phase 2d — Extract job management
`createJob`, `updateJobStatus`, heartbeat logic → `./jobs/state.ts`.

### Phase 2e — Extract mode handlers
The `if (mode === 'create')` / `if (mode === 'edit')` / `if (mode === 'chat')` / `if (mode === 'plan')` / `if (mode === 'execute')` / `if (mode === 'agent')` big-switch blocks → `./modes/<mode>.ts`.

`index.ts` becomes a thin router of ~300 lines.

## Why not all at once

Zero tests + 7200-line file + live production = recipe for a silent regression.
Each phase above is self-contained and individually verifiable.

## Quick sanity grep (used during Item 5)

```bash
# find remaining monolithic constants still inside index.ts
grep -nE '^const\s+[A-Z_]+\s*(=|:)' supabase/functions/projects-generate/index.ts
```
