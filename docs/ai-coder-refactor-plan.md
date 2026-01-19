# AI Coder Refactor Plan - Based on Open Lovable Architecture

## 🔍 Key Differences: Our Implementation vs Open Lovable

### 1. **Edit Intent Analysis** (MISSING IN OURS)
Open Lovable has a dedicated `edit-intent-analyzer.ts` that:
- Classifies user intent into types: UPDATE_COMPONENT, ADD_FEATURE, FIX_ISSUE, UPDATE_STYLE, REFACTOR, FULL_REBUILD, ADD_DEPENDENCY
- Uses regex patterns to detect intent from user prompts
- Finds target files BEFORE making any edits
- Calculates confidence scores

**Our Current State**: We jump straight to editing without analyzing intent first.

### 2. **File Search Executor** (MISSING IN OURS)
Open Lovable has `file-search-executor.ts` that:
- Creates a search plan with specific terms and regex patterns
- Searches files for exact code locations BEFORE editing
- Returns line numbers, context, and confidence levels
- Has fallback search strategies

**Our Current State**: We use grep_search but don't have a structured search plan.

### 3. **Context Selector** (PARTIALLY IMPLEMENTED)
Open Lovable's `context-selector.ts`:
- Selects primary files (to edit) vs context files (for reference)
- Builds enhanced system prompts with file structure
- Includes edit examples for teaching the AI
- Truncates large context files to save tokens

**Our Current State**: We send all files without smart selection.

### 4. **Morph Fast Apply** (IMPLEMENTED BUT NOT USED CORRECTLY)
Open Lovable's `morph-fast-apply.ts`:
- Uses `<edit target_file="...">` XML blocks
- Parses edits with `parseMorphEdits()` function
- Applies edits one by one with `applyMorphEditToFile()`
- Uses `morph-v3-large` model (we use `auto`)

**Our Current State**: We have `morphFastApply()` but the AI isn't outputting `<edit>` blocks.

### 5. **Edit Examples** (MISSING IN OURS)
Open Lovable has `edit-examples.ts` with:
- 9 detailed examples showing correct vs incorrect approaches
- Specific patterns for each edit type
- Key principles: minimal changes, preserve functionality, target precision

**Our Current State**: We have some examples in the system prompt but not as comprehensive.

---

## 🛠️ Implementation Plan

### Phase 1: Add Edit Intent Analyzer
Create a function that analyzes user prompts and returns:
- Edit type (UPDATE_COMPONENT, ADD_FEATURE, etc.)
- Target files
- Confidence score
- Search terms

### Phase 2: Add File Search Executor
Before any edit:
1. Create a search plan based on intent
2. Search all files for relevant code
3. Return exact locations with context
4. Use this to inform the AI where to edit

### Phase 3: Fix Morph Integration
The AI needs to output `<edit>` blocks like:
```xml
<edit target_file="src/App.js">
<instructions>Add a products link to the navigation</instructions>
<update>
// ... existing code ...
<nav>
  <a href="/">Home</a>
  <a href="/products">Products</a>
</nav>
// ... existing code ...
</update>
</edit>
```

### Phase 4: Add Comprehensive Edit Examples
Add the 9 examples from Open Lovable to teach the AI proper edit behavior.

---

## 📋 Immediate Fixes Needed

1. **System Prompt**: Add instruction to output `<edit>` blocks
2. **Parse Morph Edits**: Add `parseMorphEdits()` function
3. **Apply Edits**: Process `<edit>` blocks through Morph API
4. **Add Examples**: Include edit examples in system prompt

---

## 🎯 Target Architecture

```
User Request
    ↓
[Edit Intent Analyzer] → Classify intent, find target files
    ↓
[File Search Executor] → Search for exact code locations
    ↓
[Context Selector] → Build optimized context for AI
    ↓
[Gemini AI] → Generate <edit> blocks
    ↓
[Parse Morph Edits] → Extract edit blocks from response
    ↓
[Morph Fast Apply] → Apply each edit intelligently
    ↓
[Verify Changes] → Confirm edits were applied correctly
```
