# Plan: Harden AI Coder Agent Mode

## Problem Statement
The AI Coder sometimes:
1. Claims to complete tasks without using any tools
2. Only forces tool usage when specific keywords are detected
3. Relies on keyword matching instead of mandatory exploration

## Root Cause
The current enforcement logic in `supabase/functions/projects-generate/index.ts` (lines 2651-2662) only forces tool usage when:
- It is iteration 0
- The prompt matches specific edit keywords
- No tools have been called yet

This allows the agent to skip tool calls for prompts that do not match the regex pattern.

---

## Implementation Plan

### Step 1: Force Initial Exploration on EVERY Agent Request

**File:** `supabase/functions/projects-generate/index.ts`

**Location:** Before the agent loop starts (around line 2570)

**Change:** Inject a mandatory "exploration phase" message at the START of every agent conversation:

```typescript
// BEFORE the agent loop, inject a mandatory exploration instruction
const mandatoryExplorationPrompt = `
MANDATORY FIRST STEP: Before making ANY changes, you MUST:
1. Call list_files to understand the project structure
2. Call grep_search to find the relevant code for this request
3. Call read_file on the most likely target file

Do NOT proceed to edit or complete the task until you have explored the codebase.
`;

// Add this to the initial system/user messages
messages.push({
  role: "user",
  parts: [{ text: mandatoryExplorationPrompt }]
});
```

### Step 2: Block task_complete if No Exploration Happened

**File:** `supabase/functions/projects-generate/index.ts`

**Location:** Inside the `task_complete` handler (around line 2730)

**Change:** Add a check that blocks completion if ZERO exploration tools were called:

```typescript
// Track exploration tools
const explorationCalls = toolCallsLog.filter(tc => 
  tc.tool === 'list_files' || tc.tool === 'grep_search' || tc.tool === 'read_file'
);

// BLOCK: If NO exploration was done at all, reject task_complete
if (explorationCalls.length === 0) {
  console.error(`[Agent Mode] BLOCKED: task_complete without ANY exploration!`);
  functionResponses[functionResponses.length - 1].functionResponse.response = {
    acknowledged: false,
    error: 'BLOCKED: You must explore the codebase first. Call list_files or grep_search before completing.',
    hint: 'Start with list_files to see what files exist, then grep_search to find the target code.'
  };
  // Force another iteration
  continue;
}
```

### Step 3: Remove Keyword Dependency for Force Logic

**File:** `supabase/functions/projects-generate/index.ts`

**Location:** Lines 2651-2662

**Change:** Simplify the force logic to apply to ALL requests, not just detected edit requests:

```typescript
// OLD: Only forced for detected edit requests
// const isEditRequest = /\b(change|update|fix|...)\b/i.test(prompt);
// if (iteration === 0 && isEditRequest && toolCallsLog.length === 0) { ... }

// NEW: Force exploration for ALL agent mode requests
if (iteration === 0 && toolCallsLog.length === 0) {
  console.log(`[Agent Mode] FORCING exploration - no tools called on iteration 0`);
  messages.push({
    role: "user",
    parts: [{
      text: `You MUST use tools before responding. Call list_files first, then grep_search to find relevant code, then read_file on the target. Do NOT respond without using tools.`
    }]
  });
  continue;
}
```

### Step 4: Add Minimum Tool Call Threshold

**File:** `supabase/functions/projects-generate/index.ts`

**Location:** After the agent loop completes

**Change:** Add a final safety check that the agent made at least 1 meaningful tool call:

```typescript
// After loop ends, verify minimum tool usage
const meaningfulToolCalls = toolCallsLog.filter(tc => 
  tc.tool !== 'task_complete' && tc.result?.success !== false
);

if (meaningfulToolCalls.length === 0) {
  console.error(`[Agent Mode] SAFETY BLOCK: Agent completed with ZERO meaningful tool calls!`);
  // Return an error instead of success
  return new Response(JSON.stringify({
    mode: 'agent',
    result: {
      summary: 'The AI Coder failed to explore the codebase. Please try again with a more specific request.',
      filesChanged: [],
      error: 'NO_TOOL_CALLS'
    }
  }), { headers: corsHeaders, status: 200 });
}
```

---

## Additional Fix: Sandpack Refresh Race Condition

The investigation revealed that edits ARE persisting to the database but the preview sometimes does not refresh. This is a secondary issue.

**File:** `src/pages/ProjectDetail.tsx`

**Location:** Around line 4009

**Change:** After setting `generatedFiles`, also increment `sandpackKey` to force a full re-mount:

```typescript
setGeneratedFiles(newFiles);
setCodeContent(newCode);
setSandpackKey(prev => prev + 1); // Force Sandpack to fully re-mount
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/projects-generate/index.ts` | Add mandatory exploration prompt before loop |
| `supabase/functions/projects-generate/index.ts` | Block task_complete if zero exploration tools called |
| `supabase/functions/projects-generate/index.ts` | Remove keyword dependency - force exploration for ALL requests |
| `supabase/functions/projects-generate/index.ts` | Add minimum tool call threshold safety check |
| `src/pages/ProjectDetail.tsx` | Force Sandpack re-mount after agent edits |

---

## Expected Outcome

After these changes:
1. The AI Coder will ALWAYS call at least `list_files` or `grep_search` before doing anything
2. The agent cannot claim completion without exploring the codebase first
3. The preview will reliably refresh after edits are applied
4. No more "Applied" messages without actual visible changes
