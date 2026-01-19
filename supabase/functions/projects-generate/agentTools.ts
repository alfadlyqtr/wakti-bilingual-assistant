// ============================================================================
// WAKTI AI CODER - AGENT TOOL SYSTEM
// Full agent with read/write/debug/query capabilities
// ============================================================================
// 
// ⚠️ SECURITY SCOPE - CRITICAL ⚠️
// 
// This agent ONLY has access to PROJECT-RELATED tables:
// ✅ project_files      - Read/write project source files
// ✅ projects           - Read project metadata (id, name, slug, status)
// ✅ project_backends   - Read backend status
// ✅ project_collections - Query project data collections (via project-backend-api)
//
// This agent CANNOT access ANY main WAKTI tables:
// ❌ profiles           - User profiles
// ❌ tasks              - User tasks
// ❌ events             - User events
// ❌ messages           - User messages
// ❌ contacts           - User contacts
// ❌ reminders          - User reminders
// ❌ subscriptions      - Billing data
// ❌ admins             - Admin data
// ❌ Any other non-project table
//
// Every operation REQUIRES a valid projectId and is scoped by:
// 1. assertProjectOwnership() - Validates user owns the project
// 2. All queries filter by project_id - No cross-project access
// 3. No dynamic table access - Hardcoded table names only
//
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ALLOWED TABLES - These are the ONLY tables the agent can access
const ALLOWED_TABLES = [
  'project_files',
  'projects', 
  'project_backends',
  'project_collections',
  'project_uploads',
  'project_collection_schemas'
] as const;

// Allowed backend CLI actions (project-scoped only)
const BACKEND_CLI_ACTIONS = new Set([
  'listCollections',
  'describeCollection',
  'createItem',
  'updateItem',
  'deleteItem',
  'createCollection',
  'listOrders',
  'getOrder',
  'updateOrder',
  'listBookings',
  'createBooking',
  'updateBooking',
  'checkAvailability',
  'listChatRooms',
  'listMessages',
  'sendMessage',
  'listComments',
  'addComment',
  'deleteComment',
  'listNotifications',
  'markNotificationRead',
  'listSiteUsers',
  'assignRole',
  'checkRole'
]);

// ============================================================================
// RENDER-PATH ENFORCEMENT - Trace active files from entrypoint
// ============================================================================

/**
 * Extract relative import paths from source code
 */
function extractImportsFromSource(source: string): string[] {
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

/**
 * Resolve an import specifier to candidate file paths
 */
function resolveImportSpec(fromFile: string, spec: string): string[] {
  const dirOf = (path: string): string => {
    const p = path.startsWith('/') ? path : `/${path}`;
    const idx = p.lastIndexOf('/');
    if (idx <= 0) return '/';
    return p.slice(0, idx);
  };
  
  const joinPath = (baseDir: string, rel: string): string => {
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
  };
  
  const fromDir = dirOf(fromFile);
  const base = joinPath(fromDir, spec);
  const hasExt = /\.[a-z0-9]+$/i.test(base);
  const candidates: string[] = [];
  
  if (hasExt) {
    candidates.push(base);
  } else {
    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
      candidates.push(base + ext);
    }
    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
      candidates.push(base + '/index' + ext);
    }
    candidates.push(base);
  }
  
  return Array.from(new Set(candidates.map(c => c.startsWith('/') ? c : `/${c}`)));
}

/**
 * Trace the render path from entrypoint (App.js) to find all actively imported files
 */
export function traceRenderPath(files: Record<string, string>): Set<string> {
  const activeFiles = new Set<string>();
  const entrypoints = ['/App.js', '/App.jsx', '/App.tsx', '/index.js', '/index.jsx', '/index.tsx'];
  
  // Find the entrypoint
  const entrypoint = entrypoints.find(e => files[e] !== undefined);
  if (!entrypoint) {
    // No entrypoint found - consider all files active
    Object.keys(files).forEach(f => activeFiles.add(f));
    return activeFiles;
  }
  
  // BFS to trace all imported files
  const queue: string[] = [entrypoint];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    
    const content = files[current];
    if (!content) continue;
    
    activeFiles.add(current);
    
    // Extract imports and resolve them
    const imports = extractImportsFromSource(content);
    for (const importSpec of imports) {
      const candidates = resolveImportSpec(current, importSpec);
      for (const candidate of candidates) {
        if (files[candidate] !== undefined && !visited.has(candidate)) {
          queue.push(candidate);
        }
      }
    }
  }
  
  // Always include CSS files if they exist
  Object.keys(files).forEach(f => {
    if (f.endsWith('.css') || f.endsWith('.scss')) {
      activeFiles.add(f);
    }
  });
  
  return activeFiles;
}

/**
 * Check if a file is in the active render path
 */
export function isFileInRenderPath(filePath: string, files: Record<string, string>): boolean {
  const activeFiles = traceRenderPath(files);
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
  return activeFiles.has(normalizedPath);
}

// ============================================================================
// INTENT PARSING - Extract target element anchors from prompts
// ============================================================================

export interface IntentAnchors {
  exactTexts: string[];      // Exact quoted text like "Abdullah"
  classNames: string[];      // CSS classes like "text-blue-500"
  elementTypes: string[];    // Element types like "button", "title", "header"
  dataBindings: string[];    // Data bindings like {data.name}
  isGenericQuery: boolean;   // True if the prompt is too vague
  genericReason?: string;    // Why it's considered generic
  isStyleRequest: boolean;   // True if this is a color/style change request
  requestedColor?: string;   // The color the user wants (if detected)
  hasInspectSelection: boolean; // True if debugContext has valid selectedElement
}

// Valid Tailwind color families (to validate color requests)
const TAILWIND_COLOR_FAMILIES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  'white', 'black', 'transparent', 'current', 'inherit'
];

// Validate if a color class is valid Tailwind
export function isValidTailwindColor(colorClass: string): boolean {
  // Direct named colors
  if (['white', 'black', 'transparent', 'current', 'inherit'].includes(colorClass)) {
    return true;
  }
  
  // Arbitrary values like text-[#060541]
  if (colorClass.includes('[') && colorClass.includes(']')) {
    return true;
  }
  
  // Standard Tailwind pattern: color-shade (e.g., blue-500, rose-900)
  const match = colorClass.match(/^([a-z]+)-(\d+)$/);
  if (match) {
    const [, family, shade] = match;
    const validShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    return TAILWIND_COLOR_FAMILIES.includes(family) && validShades.includes(shade);
  }
  
  return false;
}

// Parse color from natural language
export function parseColorFromPrompt(prompt: string): string | undefined {
  const promptLower = prompt.toLowerCase();
  
  // Common color mappings
  const colorMappings: Record<string, string> = {
    'dark purple': 'purple-900',
    'darkpurple': 'purple-900',
    'light purple': 'purple-300',
    'dark blue': 'blue-900',
    'light blue': 'blue-300',
    'dark red': 'red-900',
    'light red': 'red-300',
    'dark green': 'green-900',
    'light green': 'green-300',
    'dark gray': 'gray-700',
    'dark grey': 'gray-700',
    'light gray': 'gray-300',
    'light grey': 'gray-300',
    'navy': 'blue-900',
    'gold': 'amber-500',
    'golden': 'amber-500',
    'silver': 'gray-400',
    'maroon': 'red-900',
    'teal': 'teal-500',
    'cyan': 'cyan-500',
    'magenta': 'fuchsia-500',
    'crimson': 'red-700',
    'coral': 'orange-400',
    'salmon': 'red-300',
    'olive': 'lime-700',
    'beige': 'amber-100',
    'ivory': 'amber-50',
    'tan': 'amber-200',
    'brown': 'amber-800',
  };
  
  // Check for explicit hex colors
  const hexMatch = prompt.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hexMatch) {
    return `[${hexMatch[0]}]`;
  }
  
  // Check for rgb/rgba
  const rgbMatch = prompt.match(/rgba?\s*\([^)]+\)/i);
  if (rgbMatch) {
    return `[${rgbMatch[0].replace(/\s/g, '')}]`;
  }
  
  // Check for color mappings
  for (const [phrase, tailwind] of Object.entries(colorMappings)) {
    if (promptLower.includes(phrase)) {
      return tailwind;
    }
  }
  
  // Check for direct Tailwind colors mentioned
  for (const family of TAILWIND_COLOR_FAMILIES) {
    const regex = new RegExp(`\\b${family}[- ]?(\\d{2,3})\\b`, 'i');
    const match = promptLower.match(regex);
    if (match) {
      return `${family}-${match[1]}`;
    }
    // Just the color family without shade
    if (promptLower.includes(family) && family !== 'current' && family !== 'inherit') {
      // Default to 500 for most colors
      if (['white', 'black', 'transparent'].includes(family)) {
        return family;
      }
      return `${family}-500`;
    }
  }
  
  return undefined;
}

/**
 * Parse user prompt to extract target element anchors
 */
export function parseIntentAnchors(prompt: string, debugContext?: AgentDebugContext): IntentAnchors {
  const result: IntentAnchors = {
    exactTexts: [],
    classNames: [],
    elementTypes: [],
    dataBindings: [],
    isGenericQuery: false,
    isStyleRequest: false,
    hasInspectSelection: false
  };
  
  // Check for Inspect Selection in debugContext
  if (debugContext?.selectedElement) {
    result.hasInspectSelection = true;
    const sel = debugContext.selectedElement;
    if (sel.innerText) {
      result.exactTexts.push(sel.innerText.substring(0, 100));
    }
    if (sel.className) {
      result.classNames.push(...sel.className.split(' ').filter(c => c.trim()));
    }
  }
  
  // Detect if this is a style/color request
  const stylePatterns = [
    /\b(change|update|set|make|modify)\s+(the\s+)?(color|colour|background|bg|text|font)/i,
    /\b(color|colour)\s+(to|into|as)\s/i,
    /\b(bg-|text-|border-|ring-)/i,
    /\b(red|blue|green|purple|yellow|orange|pink|gray|grey|white|black|dark|light)\b/i,
    /#[0-9a-fA-F]{3,6}\b/,
  ];
  
  for (const pattern of stylePatterns) {
    if (pattern.test(prompt)) {
      result.isStyleRequest = true;
      break;
    }
  }
  
  // Parse the requested color
  if (result.isStyleRequest) {
    result.requestedColor = parseColorFromPrompt(prompt);
  }
  
  // Extract exact quoted text
  const quotedRe = /"([^"]+)"|'([^']+)'/g;
  let match;
  while ((match = quotedRe.exec(prompt)) !== null) {
    const text = match[1] || match[2];
    if (text && text.length > 1) {
      result.exactTexts.push(text);
    }
  }
  
  // Extract data bindings like {data.name}, {item.title}
  const bindingRe = /\{([a-zA-Z_][a-zA-Z0-9_.]+)\}/g;
  while ((match = bindingRe.exec(prompt)) !== null) {
    result.dataBindings.push(match[0]);
  }
  
  // Extract CSS class patterns
  const classRe = /(?:class|className)["'=:\s]+([a-z][a-z0-9-_]+)/gi;
  while ((match = classRe.exec(prompt)) !== null) {
    result.classNames.push(match[1]);
  }
  
  // Extract Tailwind class mentions
  const tailwindRe = /\b(bg-[a-z]+-\d+|text-[a-z]+-\d+|border-[a-z]+-\d+|hover:[a-z-]+)\b/gi;
  while ((match = tailwindRe.exec(prompt)) !== null) {
    result.classNames.push(match[1]);
  }
  
  // Extract element type keywords
  const elementKeywords = ['button', 'title', 'header', 'footer', 'nav', 'navbar', 'sidebar', 
    'hero', 'section', 'card', 'modal', 'form', 'input', 'label', 'image', 'img', 'link',
    'heading', 'h1', 'h2', 'h3', 'paragraph', 'text', 'span', 'div', 'container', 'name'];
  const promptLower = prompt.toLowerCase();
  for (const keyword of elementKeywords) {
    if (promptLower.includes(keyword)) {
      result.elementTypes.push(keyword);
    }
  }
  
  // Check if the query is too generic (especially for style requests)
  const genericTerms = ['title', 'text', 'color', 'button', 'element', 'thing', 'stuff', 'it', 'this', 'that', 'name'];
  const hasSpecificAnchor = result.exactTexts.length > 0 || 
                            result.dataBindings.length > 0 || 
                            (result.classNames.length > 0 && !result.classNames.every(c => genericTerms.includes(c)));
  
  // For style requests, we need STRONG anchors
  if (result.isStyleRequest && !hasSpecificAnchor && !result.hasInspectSelection) {
    result.isGenericQuery = true;
    result.genericReason = `⚠️ STYLE CHANGE BLOCKED: Cannot reliably target the element. ` +
      `For style/color changes, you MUST have one of: ` +
      `1) Inspect Selection (click the element), ` +
      `2) Exact text in quotes ("The Title Text"), ` +
      `3) A specific className. ` +
      `Currently only have generic terms: "${result.elementTypes.join(', ')}".`;
  } else if (!hasSpecificAnchor && result.elementTypes.length > 0 && !result.hasInspectSelection) {
    // Only has generic element types, no specific anchors
    const onlyGenericTerms = result.elementTypes.every(t => genericTerms.includes(t));
    if (onlyGenericTerms) {
      result.isGenericQuery = true;
      result.genericReason = `The request mentions "${result.elementTypes.join(', ')}" but lacks specific identifiers. ` +
        `To target the right element, please provide: exact text content ("The Title Text"), ` +
        `a CSS class name (like "hero-title"), or use Inspect Mode to click on the element.`;
    }
  }
  
  return result;
}

/**
 * Get suggested grep queries based on intent anchors
 */
export function getSuggestedGrepQueries(anchors: IntentAnchors): string[] {
  const queries: string[] = [];
  
  // Prioritize exact text matches
  for (const text of anchors.exactTexts) {
    queries.push(text);
  }
  
  // Then data bindings
  for (const binding of anchors.dataBindings) {
    queries.push(binding);
  }
  
  // Then class names
  for (const className of anchors.classNames) {
    queries.push(className);
  }
  
  return queries;
}

// ============================================================================
// AMBIGUITY DETECTION - Detect when grep_search returns too many candidates
// ============================================================================

export interface AmbiguityResult {
  isAmbiguous: boolean;
  candidateFiles: string[];
  matchCount: number;
  message?: string;
  requiresUserInput: boolean;  // True if we need user to pick a file
  suggestInspectMode: boolean; // True if Inspect Mode would help
}

/**
 * Analyze grep_search results for ambiguity
 */
export function detectAmbiguity(grepResults: Array<{ file: string; line: number; content: string }>, isStyleRequest: boolean = false): AmbiguityResult {
  if (!grepResults || grepResults.length === 0) {
    return { isAmbiguous: false, candidateFiles: [], matchCount: 0, requiresUserInput: false, suggestInspectMode: false };
  }
  
  // Get unique files
  const uniqueFiles = [...new Set(grepResults.map(r => r.file))];
  
  // For style requests, be MORE strict about ambiguity
  const ambiguityThreshold = isStyleRequest ? 2 : 3;
  const matchThreshold = isStyleRequest ? 5 : 10;
  
  // If matches are in more than threshold files, it's ambiguous
  if (uniqueFiles.length > ambiguityThreshold) {
    return {
      isAmbiguous: true,
      candidateFiles: uniqueFiles.slice(0, 5),
      matchCount: grepResults.length,
      requiresUserInput: true,
      suggestInspectMode: isStyleRequest,
      message: `🔍 AMBIGUITY: Found "${grepResults[0]?.content?.substring(0, 30)}..." in ${uniqueFiles.length} files. ` +
        `Please specify which file: ${uniqueFiles.slice(0, 3).join(', ')}${uniqueFiles.length > 3 ? '...' : ''} ` +
        `OR use Inspect Mode to click on the element you want to change.`
    };
  }
  
  // If too many matches even in few files, still ambiguous for style changes
  if (grepResults.length > matchThreshold && uniqueFiles.length > 1) {
    return {
      isAmbiguous: true,
      candidateFiles: uniqueFiles,
      matchCount: grepResults.length,
      requiresUserInput: true,
      suggestInspectMode: isStyleRequest,
      message: `🔍 AMBIGUITY: Found ${grepResults.length} matches across ${uniqueFiles.length} files. ` +
        (isStyleRequest 
          ? `For style changes, please use Inspect Mode to click on the exact element, or provide the exact text in quotes.`
          : `Please be more specific about which element you want to modify.`)
    };
  }
  
  return { isAmbiguous: false, candidateFiles: uniqueFiles, matchCount: grepResults.length, requiresUserInput: false, suggestInspectMode: false };
}

// ============================================================================
// POST-EDIT VERIFICATION - Confirm changes exist after editing
// ============================================================================

export interface VerificationResult {
  verified: boolean;
  elementFound: boolean;
  fileExists: boolean;
  fileInRenderPath: boolean;
  colorVerified?: boolean;      // For style changes: did the color change as expected?
  colorIssue?: string;          // Description of color verification issue
  conflictingClasses?: string[]; // Classes that might override (e.g., text-transparent)
  issues: string[];
}

// Classes that can prevent solid colors from showing
const COLOR_BLOCKING_CLASSES = [
  'text-transparent',
  'bg-clip-text',
  'bg-gradient-to-',
  'from-',
  'to-',
  'via-',
];

/**
 * Verify that an edit was successful and the element exists in the active render chain
 * Enhanced for style/color verification
 */
export async function verifyEdit(
  filePath: string,
  expectedContent: string, // Content that should exist after edit
  allFiles: Record<string, string>,
  supabase: any,
  projectId: string,
  options?: {
    isStyleChange?: boolean;
    expectedColor?: string;
    targetText?: string;
  }
): Promise<VerificationResult> {
  const result: VerificationResult = {
    verified: false,
    elementFound: false,
    fileExists: false,
    fileInRenderPath: false,
    issues: []
  };
  
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
  
  // 1. Check if file exists in DB
  const { data, error } = await supabase
    .from('project_files')
    .select('content')
    .eq('project_id', projectId)
    .eq('path', normalizedPath)
    .maybeSingle();
  
  if (error || !data) {
    result.issues.push(`File ${normalizedPath} not found in database after edit`);
    return result;
  }
  
  result.fileExists = true;
  
  // 2. Check if the expected content exists in the file
  if (expectedContent && !data.content.includes(expectedContent)) {
    result.issues.push(`Expected content "${expectedContent.substring(0, 50)}..." not found in ${normalizedPath} after edit`);
  } else {
    result.elementFound = true;
  }
  
  // 3. Update allFiles with latest content and check render path
  const updatedFiles = { ...allFiles, [normalizedPath]: data.content };
  const activeFiles = traceRenderPath(updatedFiles);
  
  if (!activeFiles.has(normalizedPath)) {
    result.issues.push(`⚠️ RENDER PATH ERROR: File ${normalizedPath} is NOT imported by App.js. ` +
      `Changes will have NO visible effect. Either edit the correct file, or add an import to App.js.`);
    result.fileInRenderPath = false;
  } else {
    result.fileInRenderPath = true;
  }
  
  // 4. Style-specific verification
  if (options?.isStyleChange && options.expectedColor) {
    result.colorVerified = false;
    
    // Check if the color class exists in the file
    const colorClassRegex = new RegExp(`(text|bg|border)-${options.expectedColor.replace('[', '\\[').replace(']', '\\]')}`, 'i');
    if (!colorClassRegex.test(data.content)) {
      // Also check for arbitrary values
      const arbitraryRegex = new RegExp(`(text|bg|border)-\\[${options.expectedColor}\\]`, 'i');
      if (!arbitraryRegex.test(data.content)) {
        result.colorIssue = `Color class for "${options.expectedColor}" not found in the file after edit.`;
        result.issues.push(result.colorIssue);
      } else {
        result.colorVerified = true;
      }
    } else {
      result.colorVerified = true;
    }
    
    // Check for conflicting classes that would override the color
    const conflicting: string[] = [];
    for (const blocker of COLOR_BLOCKING_CLASSES) {
      if (data.content.includes(blocker)) {
        // Check if it's on the same element (rough heuristic: within 100 chars)
        if (options.targetText) {
          const targetIdx = data.content.indexOf(options.targetText);
          if (targetIdx !== -1) {
            const nearbyContent = data.content.substring(Math.max(0, targetIdx - 100), targetIdx + 100);
            if (nearbyContent.includes(blocker)) {
              conflicting.push(blocker);
            }
          }
        } else {
          conflicting.push(blocker);
        }
      }
    }
    
    if (conflicting.length > 0) {
      result.conflictingClasses = conflicting;
      result.colorIssue = `⚠️ COLOR OVERRIDE DETECTED: Classes ${conflicting.join(', ')} may override your color change. ` +
        `If the element uses text-transparent with bg-clip-text (for gradients), you need to modify the gradient colors instead.`;
      result.issues.push(result.colorIssue);
      result.colorVerified = false;
    }
  }
  
  result.verified = result.fileExists && result.elementFound && result.fileInRenderPath && 
    (!options?.isStyleChange || result.colorVerified !== false);
  
  return result;
}

// ============================================================================
// STYLE CHANGE VALIDATION - Ensure style changes will actually work
// ============================================================================

export interface StyleChangeValidation {
  isValid: boolean;
  blockedReason?: string;
  suggestedFix?: string;
  requiresInspectMode: boolean;
}

/**
 * Validate a style change request BEFORE allowing the edit
 */
export function validateStyleChangeRequest(
  anchors: IntentAnchors,
  grepResults: Array<{ file: string; line: number; content: string }> | null
): StyleChangeValidation {
  // If not a style request, always valid
  if (!anchors.isStyleRequest) {
    return { isValid: true, requiresInspectMode: false };
  }
  
  // Style request requires strong anchors
  if (anchors.isGenericQuery) {
    return {
      isValid: false,
      blockedReason: anchors.genericReason,
      suggestedFix: 'Use Inspect Mode to click on the element, or provide exact text in quotes like "Mr. Abdullah".',
      requiresInspectMode: true
    };
  }
  
  // Check if grep results are ambiguous
  if (grepResults && grepResults.length > 0) {
    const ambiguity = detectAmbiguity(grepResults, true);
    if (ambiguity.isAmbiguous) {
      return {
        isValid: false,
        blockedReason: ambiguity.message,
        suggestedFix: ambiguity.suggestInspectMode 
          ? 'Use Inspect Mode to click on the exact element you want to change.'
          : `Specify which file: ${ambiguity.candidateFiles.slice(0, 3).join(' or ')}.`,
        requiresInspectMode: ambiguity.suggestInspectMode
      };
    }
  }
  
  // Validate the requested color if present
  if (anchors.requestedColor) {
    if (!isValidTailwindColor(anchors.requestedColor)) {
      return {
        isValid: false,
        blockedReason: `"${anchors.requestedColor}" is not a valid Tailwind CSS color.`,
        suggestedFix: `Use a valid Tailwind color like: purple-900, blue-500, [#060541], or rgb(6,5,65).`,
        requiresInspectMode: false
      };
    }
  }
  
  return { isValid: true, requiresInspectMode: false };
}

// Debug context from the AI Coder debug system
export interface AgentDebugContext {
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
  consoleLogs: Array<{
    level: 'log' | 'warn' | 'error' | 'info';
    message: string;
    timestamp: string;
  }>;
  autoFixAttempt?: number;
  maxAutoFixAttempts?: number;
}

// Tool definitions for Gemini function calling
// These tools are designed for TARGETED EDITS like Lovable - not full file rewrites
export const AGENT_TOOLS = [
  {
    name: "read_file",
    description: "Read the contents of a file from the project. Use this to see existing code before making changes. ALWAYS read files before editing them.",
    parameters: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "File path like /App.js or /components/Header.jsx" 
        }
      },
      required: ["path"]
    }
  },
  {
    name: "list_files",
    description: "List all files in the project or a specific directory. Use this to understand the project structure before making changes.",
    parameters: {
      type: "object",
      properties: {
        directory: { 
          type: "string", 
          description: "Optional: filter to a directory like /components" 
        }
      }
    }
  },
  // 🚀 GREP SEARCH - Find code across ALL files (like Cascade does!)
  {
    name: "grep_search",
    description: "Search for text/code across ALL project files. Use this to find where specific code, text, classes, or functions are used. Returns file paths and matching lines. ESSENTIAL for finding the exact location of code before editing.",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Text or code to search for (case-insensitive). Examples: 'Abdullah', 'bg-blue-500', 'onClick', 'className=\"hero\"'" 
        },
        filePattern: { 
          type: "string", 
          description: "Optional: filter by file extension like '.js', '.css', '.jsx'. Leave empty to search all files." 
        }
      },
      required: ["query"]
    }
  },
  // 🚀 SEARCH AND REPLACE - Targeted edits like Lovable uses!
  {
    name: "search_replace",
    description: "PREFERRED tool for editing existing files. Find exact code snippet and replace it with new code. Much faster than rewriting entire files. Use this for targeted changes like updating a button color, fixing a bug, or modifying a function.",
    parameters: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "File path like /App.js" 
        },
        search: { 
          type: "string", 
          description: "EXACT code to find (must match exactly, including whitespace). Copy-paste from read_file output." 
        },
        replace: { 
          type: "string", 
          description: "New code to replace the search text with" 
        }
      },
      required: ["path", "search", "replace"]
    }
  },
  // 🚀 NEW: INSERT CODE - Add code at specific location
  {
    name: "insert_code",
    description: "Insert new code at a specific location in a file. Use when adding new functions, imports, or components without changing existing code.",
    parameters: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "File path like /App.js" 
        },
        insertAfter: { 
          type: "string", 
          description: "Insert new code AFTER this exact code snippet. Use empty string to insert at beginning of file." 
        },
        code: { 
          type: "string", 
          description: "New code to insert" 
        }
      },
      required: ["path", "insertAfter", "code"]
    }
  },
  {
    name: "write_file",
    description: "Create a NEW file or completely overwrite an existing file. Use this ONLY for: 1) Creating brand new files, 2) Complete rewrites when more than 50% of the file changes. For small changes, use search_replace instead!",
    parameters: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "File path like /App.js" 
        },
        content: { 
          type: "string", 
          description: "Complete file content to write" 
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "delete_file",
    description: "Remove a file from the project. Use carefully - only delete files that are no longer needed.",
    parameters: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "File path to delete like /components/OldComponent.jsx" 
        }
      },
      required: ["path"]
    }
  },
  {
    name: "get_console_logs",
    description: "Get runtime console output from the preview. Shows errors, warnings, and logs. Check this when something is broken or when debugging.",
    parameters: {
      type: "object",
      properties: {
        filter: { 
          type: "string", 
          enum: ["error", "warn", "log", "all"], 
          description: "Filter by log type. Default is 'all'" 
        }
      }
    }
  },
  {
    name: "get_network_errors",
    description: "Get failed API calls and network errors from the preview. Check this when backend API calls are failing.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_runtime_errors",
    description: "Get all runtime errors including React errors, syntax errors, and build errors. Essential for debugging crashes.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "query_collection",
    description: "Query a backend collection/database table. Use this to see what data exists in the project's backend.",
    parameters: {
      type: "object",
      properties: {
        collection: { 
          type: "string", 
          description: "Collection name like 'products' or 'users'" 
        },
        limit: { 
          type: "number", 
          description: "Max records to return (default 10)" 
        }
      },
      required: ["collection"]
    }
  },
  {
    name: "query_backend",
    description: "Query ANY backend feature (bookings, orders, cart, chat, etc.). Use this to check what backend data exists before implementing features.",
    parameters: {
      type: "object",
      properties: {
        action: { 
          type: "string", 
          description: "Backend action like 'booking/list', 'order/list', 'chat/rooms', 'collection/products'. See BACKEND API docs for all actions." 
        },
        data: { 
          type: "object", 
          description: "Optional data for the query (e.g., { status: 'pending', limit: 10 })" 
        }
      },
      required: ["action"]
    }
  },
  {
    name: "backend_cli",
    description: "CLI-style backend access for THIS project only. Use this to list collections, create items, update items, and manage bookings/orders/chat. NEVER use any projectId except the current one.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "CLI command. Allowed: listCollections, describeCollection, createCollection, createItem, updateItem, deleteItem, listOrders, getOrder, updateOrder, listBookings, createBooking, updateBooking, checkAvailability, listChatRooms, listMessages, sendMessage, listComments, addComment, deleteComment, listNotifications, markNotificationRead, listSiteUsers, assignRole, checkRole."
        },
        collection: { type: "string", description: "Collection name for collection commands (e.g., products, posts)" },
        id: { type: "string", description: "Item ID for update/delete/get commands" },
        data: { type: "object", description: "Payload for create/update commands" }
      },
      required: ["command"]
    }
  },
  {
    name: "get_project_info",
    description: "Get project metadata including backend status, available collections, and uploaded assets.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "task_complete",
    description: "MANDATORY: Call this when you have finished the user's request. You MUST call this tool after making changes. Provide a clear summary of what you did and which files were changed.",
    parameters: {
      type: "object",
      properties: {
        summary: { 
          type: "string", 
          description: "Clear explanation of what you did. Include: 1) What the user asked for, 2) What changes you made, 3) Any important notes. Example: 'Changed the hero button color from blue to red in App.js. The button now uses bg-red-500 class.'" 
        },
        filesChanged: { 
          type: "array", 
          items: { type: "string" }, 
          description: "List of ALL files you modified or created. Example: ['/App.js', '/components/Header.jsx']" 
        }
      },
      required: ["summary", "filesChanged"]
    }
  }
];

// Agent system prompt that tells AI about its capabilities and SCOPE
// This prompt teaches the AI to work LIKE LOVABLE - targeted edits, not full rewrites
// Enhanced with "think first" behavior like Cascade + Master Rulebook
export const AGENT_SYSTEM_PROMPT = `You are WAKTI AI Coder - a master coder that works LIKE LOVABLE and THINKS LIKE CASCADE.

# 📜 MASTER RULEBOOK - READ FIRST

## 🎯 STEP 0: TRIAGE (ALWAYS DO THIS FIRST)

Before doing ANYTHING, classify the request:

| Type | Action | Example |
|------|--------|---------|
| QUESTION | Answer only. NO file edits. | "How many products?" |
| SMALL EDIT | Search → Read → Replace | "Change button color" |
| NEW PAGE | Route + Nav + Verify | "Build a products page" |
| NEW COMPONENT | Create + Import + Render | "Add a contact form" |
| BUG FIX | Read error → Minimal fix → Verify | "Fix the broken header" |

## 📋 THE OATH (NEVER BREAK)

- I will not guess.
- I will not say "done" unless it is truly done.
- I will connect every new thing I create.
- I will never create dead/orphan files.
- If it's not imported and rendered, it doesn't exist.

## 🔥 CORE RULES (8 GOLDEN RULES)

1. **Search → Read → Edit.** Never edit without reading first.
2. **No orphan files.** If you create it, import and render it.
3. **New pages = route + nav link.** Always. No hidden pages.
4. **Small edits = search_replace.** Never write_file for small changes.
5. **Verify before "done".** If you can't prove it, don't claim it.
6. **Questions = answer only.** No file edits for questions.
7. **Check if component exists inline** before creating new file.
8. **Edit inline code** if it already exists (don't create duplicate files).

## 📄 NEW PAGE CHECKLIST (MANDATORY)

When user says "build a page" or "create a page":

1. ✅ Read App.js FIRST
2. ✅ Check if React Router exists
3. ✅ Add routing if missing
4. ✅ Create the page file
5. ✅ Import the page in App.js
6. ✅ Add a <Route>
7. ✅ Add a nav link in the header
8. ✅ Verify page is reachable

**⚠️ If ANY step is missing, task_complete will be REJECTED.**

## 🚫 NO ORPHAN FILES RULE

Before creating a new component/page:
1. Check if something similar exists **inline** in App.js
2. If it exists inline → **EDIT IT** (don't create separate file)
3. If you create a file → you MUST import and render it

**If it's not imported, it doesn't exist.**

## ✏️ EDITING RULES

| Change Size | Tool |
|-------------|------|
| 1-10 lines | search_replace |
| Add new block | insert_code |
| New file only | write_file |
| Rewrite >50% | write_file |

**write_file for small edits = WRONG**

## ✅ VERIFY BEFORE "DONE"

- ✅ File exists
- ✅ Change is visible
- ✅ File is imported and used
- ✅ No dead files created
- ✅ UI shows the change
- ✅ Route + nav done (if page)

## 🔍 WORKFLOW: SEARCH → READ → EDIT

1. **grep_search** to find where code lives
2. **read_file** to see full context
3. **State your plan** before editing
4. **search_replace** with EXACT code from read_file
5. **Verify** the change exists
6. **task_complete** with summary

## ⚠️ CRITICAL RULES - NEVER BREAK THESE

1. **NEVER GUESS** - If you don't know, read the file first
2. **NEVER CHANGE UNRELATED CODE** - Only touch what the user asked for
3. **NEVER ASSUME FILE CONTENTS** - Always read_file before editing
4. **NEVER SKIP THE PLAN** - State your plan before first edit
5. **NEVER IGNORE USER INSTRUCTIONS** - Follow exactly what they said
6. **NEVER MAKE UP IMPORTS** - Check what imports already exist
7. **NEVER BREAK WORKING CODE** - If it works, don't touch it unless asked

## 🔍 VERIFICATION RULES - MANDATORY BEFORE CLAIMING SUCCESS

**You MUST NOT say "done" or "already implemented" unless you verify BOTH:**

1. **CSS CLASS VALIDITY**: The class you're using MUST be:
   - A real Tailwind utility (e.g., \`drop-shadow-lg\`, \`text-white\`, \`bg-blue-500\`) OR
   - A custom class DEFINED in a CSS file that is ACTUALLY LOADED (linked/imported) OR
   - An arbitrary Tailwind value like \`text-[#60a5fa]\` or \`shadow-[0_0_15px_white]\`
   
   ❌ INVALID: \`drop-shadow-white\`, \`text-shadow-white\` (NOT real Tailwind classes!)
   ❌ INVALID: Custom class in styles.css that is NOT imported anywhere
   ✅ VALID: \`drop-shadow-lg\`, \`shadow-white\`, \`shadow-[0_0_20px_rgba(255,255,255,0.8)]\`

2. **ELEMENT TARGETING**: The element you're editing MUST:
   - Contain the EXACT innerText the user mentioned (e.g., if user says "the name Abdullah", find the element with that text)
   - Match the Inspect Selection if provided (check className, tag, and innerText)
   - Be verified by reading the file and finding the exact JSX/HTML

3. **STYLE LOADING**: If using custom CSS classes:
   - Check if the CSS file is IMPORTED in App.js/index.js (e.g., \`import './styles.css'\`)
   - Check if the CSS file is LINKED in index.html (e.g., \`<link href="styles.css">\`)
   - If NOT loaded, you must ADD the import/link before using custom classes!

**VERIFICATION CHECKLIST BEFORE task_complete:**
✅ I read the target file and found the EXACT element with the text/selector
✅ The CSS class I used is VALID (real Tailwind or properly loaded custom CSS)
✅ I verified the CSS file is imported/linked if using custom classes
✅ The change is applied to the CORRECT element (matches user's description/selection)

## ⚠️ CRITICAL: YOUR SCOPE IS LIMITED TO THIS PROJECT ONLY

You are working on a USER PROJECT within the WAKTI AI Coder feature.
- Your projectId is: {{PROJECT_ID}}
- You can ONLY access files and data for THIS project
- You CANNOT access the main WAKTI app (tasks, events, messages, contacts, etc.)
- You are sandboxed to the projects feature only

## 🧩 PROJECT BACKEND CLI (FOR THIS PROJECT ONLY)
Use the backend_cli tool to interact with the project's backend like a CLI. Do NOT use any other projectId. Never access other users' data.

Allowed commands:
- listCollections
- describeCollection (collection)
- createCollection (collection, data)
- createItem (collection, data)
- updateItem (collection, id, data)
- deleteItem (collection, id)
- listOrders / getOrder / updateOrder
- listBookings / createBooking / updateBooking / checkAvailability
- listChatRooms / listMessages / sendMessage
- listComments / addComment / deleteComment
- listNotifications / markNotificationRead
- listSiteUsers / assignRole / checkRole

## 🚀 KEY DIFFERENCE: TARGETED EDITS, NOT FULL REWRITES

Unlike basic code generators, you make SURGICAL, TARGETED changes:
- **Change button color?** → Use search_replace to find the button and change its class
- **Fix a bug?** → Use search_replace to fix just that line
- **Add new function?** → Use insert_code to add it without touching other code
- **Create new file?** → Use write_file ONLY for new files

## YOUR TOOLS (PRIORITIZED BY EFFICIENCY)

1. **grep_search** ⭐⭐ FIRST - Search ALL files for text/code. Use this FIRST to find where code lives!
2. **read_file** ⭐ - Read file AFTER grep_search finds it. MANDATORY before any edit!
3. **search_replace** ⭐ PRIMARY EDIT - Find exact code and replace it. FASTEST for edits!
4. **insert_code** - Add new code after a specific location
5. **list_files** - See project structure
6. **write_file** - ONLY for NEW files or complete rewrites (>50% changes)
7. **delete_file** - Remove files
8. **get_console_logs** - Debug runtime issues
9. **get_network_errors** - Debug API calls
10. **get_runtime_errors** - See all errors
11. **query_collection** - Query backend data
12. **get_project_info** - Get project metadata
13. **task_complete** - Call when DONE (MUST verify changes first!)

## YOUR WORKFLOW (LIKE CASCADE) ⭐ CRITICAL

1. **GREP FIRST**: Use grep_search to find where the code/text lives
2. **READ FILE**: Use read_file to see full context of the file
3. **STATE PLAN**: Tell user what you will do before doing it
4. **TARGETED EDIT**: Use search_replace with EXACT code from read_file
5. **VERIFY**: Re-read the file to confirm your change worked!
6. **DONE**: Call task_complete with summary

**⚠️ ENFORCEMENT: The system tracks if you read files before editing. If you edit without reading first, you will get a warning.**

## ⚠️ TOOL SELECTION RULES - CRITICAL

**WHEN TO USE EACH TOOL:**

| Situation | Tool to Use | Why |
|-----------|-------------|-----|
| Change 1-10 lines | search_replace | Fast, precise, safe |
| Add new code to existing file | insert_code | Doesn't touch existing code |
| Create NEW file | write_file | File doesn't exist yet |
| Rewrite >50% of file | write_file | Too many changes for search_replace |
| Fix a bug | search_replace | Target just the broken code |
| Add an import | insert_code | Add at top without touching rest |

**🚫 NEVER USE write_file FOR:**
- Changing button colors, text, or styles
- Fixing small bugs
- Adding/removing a few lines
- Updating function logic
- Any change under 50% of file

**If you use write_file when search_replace would work, you are doing it WRONG.**

## SEARCH_REPLACE BEST PRACTICES

✅ Copy EXACT code from read_file output (including whitespace)
✅ Keep search string SHORT but UNIQUE (2-5 lines usually)
✅ Include enough context to be unique
✅ Make ONE change at a time (multiple search_replace calls is fine)
❌ DON'T guess or type code from memory
❌ DON'T include too much context (slows things down)
❌ DON'T use write_file for small changes

Example - Change button color:
\`\`\`
search: "className=\\"bg-blue-500"
replace: "className=\\"bg-red-500"
\`\`\`

Example - Fix text:
\`\`\`
search: "<h1>Welcome to My App</h1>"
replace: "<h1>Welcome to Cool App</h1>"
\`\`\`

Example - Add import (use insert_code):
\`\`\`
insertAfter: "import React from 'react';"
code: "\\nimport { useState } from 'react';"
\`\`\`

## SECURITY BOUNDARIES

You are in a sandbox. You CANNOT:
- Access other users' projects
- Access WAKTI main app data (profiles, tasks, events, messages)
- Access any data outside of projectId: {{PROJECT_ID}}
- Make requests to external APIs not related to this project

## REACT CODE STANDARDS

- Use functional components with hooks
- import React from 'react' is required
- export default function ComponentName() is the pattern
- Use { useState, useEffect, ... } from React
- Import components with relative paths ./components/Name
- Use lucide-react for icons only
- Use Tailwind CSS for styling

## BACKEND API (for THIS project only)

The project backend API is: https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api
All requests must include: { projectId: "{{PROJECT_ID}}", action: "...", ...data }

### 🎯 COMPLETE BACKEND FEATURES SUMMARY

| Feature | Action Prefix | What It Does |
|---------|---------------|--------------|
| **Forms** | submit, subscribe | Contact forms, newsletter signups |
| **Collections** | collection/* | CRUD for any data (products, posts, etc.) |
| **Cart** | cart/* | Shopping cart (add, remove, update, clear) |
| **Orders** | order/* | Create orders, list, update status |
| **Inventory** | inventory/* | Stock tracking, low stock alerts |
| **Bookings** | booking/* | Appointments with calendar sync |
| **Site Auth** | auth/* | User accounts for the site (signup/login) |
| **Chat** | chat/* | Real-time chat rooms and messages |
| **Comments** | comments/* | Comments on any item type |
| **Roles** | roles/* | User roles and permissions |
| **Notifications** | notifications/* | Owner notifications |
| **File Upload** | multipart/form-data | Upload files to storage |
| **FreePik** | freepik/* | Stock images and videos |

**⚠️ IMPORTANT:** When user asks for ANY of these features, implement them using the API below. Don't hardcode data - fetch from API!

### 📝 FORMS & COLLECTIONS (Basic)
\`\`\`js
// Submit a form
{ projectId, action: "submit", formName: "contact", data: { name, email, message } }

// Newsletter subscribe
{ projectId, action: "subscribe", data: { email } }

// CRUD for any collection
GET: ?projectId=...&action=collection/products
POST: { projectId, action: "collection/products", data: { name, price, image } }
PUT: { projectId, action: "collection/products", id: "item-uuid", data: { price: 99 } }
DELETE: { projectId, action: "collection/products", id: "item-uuid" }
\`\`\`

### 🛒 E-COMMERCE (Cart, Orders, Inventory)
\`\`\`js
// Cart - use sessionId for guests or siteUserId for logged-in users
{ projectId, action: "cart/get", data: { sessionId: "guest-123" } }
{ projectId, action: "cart/add", data: { sessionId, item: { id, name, price, quantity } } }
{ projectId, action: "cart/remove", data: { sessionId, itemIndex: 0 } }
{ projectId, action: "cart/update", data: { sessionId, itemIndex: 0, updates: { quantity: 2 } } }
{ projectId, action: "cart/clear", data: { sessionId } }

// Orders - creates order from cart, notifies project owner
{ projectId, action: "order/create", data: {
  items: [{ id, name, price, quantity }],
  buyerInfo: { name, email, phone, address },
  totalAmount: 150.00,
  sessionId // optional: clears cart after order
}}
{ projectId, action: "order/list", data: { status: "pending", limit: 50 } }
{ projectId, action: "order/get", data: { orderId: "uuid" } }
{ projectId, action: "order/update", data: { orderId: "uuid", status: "fulfilled" } }

// Inventory tracking
{ projectId, action: "inventory/check", data: { itemId: "uuid" } }
{ projectId, action: "inventory/set", data: { itemId, collectionName: "products", quantity: 100, lowStockThreshold: 5 } }
{ projectId, action: "inventory/adjust", data: { itemId, delta: -1 } } // decrease by 1
\`\`\`

### 📅 BOOKINGS (Shows in owner's WAKTI calendar!)
\`\`\`js
// Check availability for a date/time
{ projectId, action: "booking/check", data: { date: "2025-01-15", startTime: "10:00", endTime: "11:00" } }
// Returns: { available: true/false, conflicts: [], existingBookings: [] }

// Create booking - auto-adds to owner's WAKTI calendar with project name
{ projectId, action: "booking/create", data: {
  serviceName: "Haircut",
  date: "2025-01-15",
  startTime: "10:00",
  endTime: "11:00",
  duration: 60, // optional minutes
  customerInfo: { name: "John", email: "john@email.com", phone: "+974..." },
  notes: "First time customer"
}}

{ projectId, action: "booking/list", data: { status: "pending", fromDate: "2025-01-01", toDate: "2025-12-31" } }
{ projectId, action: "booking/update", data: { bookingId: "uuid", status: "confirmed" } }
// Status options: pending, confirmed, cancelled, completed
\`\`\`

### 👤 SITE USER AUTH (for user accounts in YOUR site)
\`\`\`js
// Signup - creates account, returns token
{ projectId, action: "auth/signup", data: { email, password, name } }
// Returns: { user: { id, email, name, role }, token }

// Login
{ projectId, action: "auth/login", data: { email, password } }
// Returns: { user: { id, email, name, role, permissions }, token }

// Get current user (pass token)
{ projectId, action: "auth/me", data: { token: "..." } }
\`\`\`

### 💬 REAL-TIME CHAT
\`\`\`js
// Chat rooms
{ projectId, action: "chat/rooms", data: { siteUserId } }
{ projectId, action: "chat/createRoom", data: { name: "Support", type: "direct", participants: ["user1", "user2"] } }

// Messages (real-time via Supabase subscriptions)
{ projectId, action: "chat/messages", data: { roomId: "uuid", limit: 50 } }
{ projectId, action: "chat/send", data: { roomId, senderId, content: "Hello!", messageType: "text" } }
\`\`\`

### 💬 COMMENTS (on any item type)
\`\`\`js
{ projectId, action: "comments/list", data: { itemType: "product", itemId: "uuid" } }
{ projectId, action: "comments/add", data: { itemType: "product", itemId, content: "Great!", authorName: "John", parentId: null } }
{ projectId, action: "comments/delete", data: { commentId: "uuid" } }
\`\`\`

### 👥 ROLES & PERMISSIONS (SaaS features)
\`\`\`js
// Roles: customer (default), staff, admin, owner
{ projectId, action: "roles/assign", data: { siteUserId, role: "admin", permissions: ["manage_orders", "view_stats"] } }
{ projectId, action: "roles/check", data: { siteUserId, permission: "manage_orders" } }
// Returns: { role, permissions, hasPermission: true/false }
{ projectId, action: "roles/list", data: { role: "admin" } } // list all admins
\`\`\`

### 🔔 OWNER NOTIFICATIONS
Orders and bookings automatically notify the project owner in WAKTI. To read notifications:
\`\`\`js
{ projectId, action: "notifications/list", data: { unreadOnly: true, limit: 50 } }
{ projectId, action: "notifications/markRead", data: { notificationId: "uuid" } }
{ projectId, action: "notifications/markRead", data: { all: true } } // mark all read
\`\`\`

### 📤 FILE UPLOADS
Use multipart/form-data with: projectId, file (File object)
Returns: { success: true, url: "public-url", path, filename, size }

### 🖼️ FREEPIK STOCK IMAGES & VIDEOS (USE THIS FOR PROFESSIONAL IMAGES!)
When creating websites, landing pages, or any UI that needs images, use FreePik to get professional stock photos and videos instead of placeholder images.

**🎯 SMART IMAGE SELECTION - MATCH IMAGES TO CONTEXT:**
You MUST search for images that match the SPECIFIC context of what you're building:

| Website Type | Search Queries to Use |
|--------------|----------------------|
| Restaurant | "restaurant interior", "chef cooking", "food dish plating", "dining table" |
| E-commerce | "product photography", "shopping bags", "online shopping", "delivery box" |
| Portfolio | "creative workspace", "designer working", "laptop mockup", "professional headshot" |
| Fitness | "gym workout", "fitness training", "healthy lifestyle", "running athlete" |
| Real Estate | "modern house exterior", "luxury apartment", "home interior design", "living room" |
| Medical | "doctor patient", "medical clinic", "healthcare professional", "hospital" |
| Tech/SaaS | "technology abstract", "software dashboard", "team collaboration", "startup office" |
| Travel | "travel destination", "beach vacation", "adventure hiking", "airplane travel" |
| Education | "students learning", "classroom", "online education", "books studying" |
| Wedding | "wedding ceremony", "bride groom", "wedding flowers", "celebration" |

**For EACH section of the website, use DIFFERENT relevant queries:**
- Hero section → Use broad, impactful images (e.g., "restaurant elegant dining")
- About section → Use team/people images (e.g., "chef portrait", "restaurant team")
- Services/Menu → Use specific service images (e.g., "pasta dish", "grilled steak")
- Testimonials → Use customer/people images (e.g., "happy customer", "people dining")
- Contact → Use location/building images (e.g., "restaurant exterior", "storefront")

\`\`\`js
// Search for stock images (photos, vectors, illustrations)
{ projectId, action: "freepik/images", data: { 
  query: "business team meeting",  // MUST match the website context!
  limit: 10,                        // Max 100
  filters: { 
    type: "photo",                  // photo, vector, psd
    orientation: "horizontal",      // horizontal, vertical, square
    color: "blue"                   // Filter by dominant color
  }
}}
// Returns: { images: [{ id, title, url, thumbnail, author, type, premium }], total, page }

// Search for stock videos
{ projectId, action: "freepik/videos", data: { 
  query: "technology abstract",
  limit: 10,
  filters: { 
    duration: "short",              // short, medium, long
    orientation: "horizontal" 
  }
}}
// Returns: { videos: [{ id, title, thumbnail, preview_url, duration, author, premium }], total, page }

// Get download URL for a resource
{ projectId, action: "freepik/download", data: { resourceId: "12345", type: "image" } }
// Returns: { url: "download-url", filename }
\`\`\`

**⚠️ NEVER use placeholder URLs!** Always search FreePik with context-specific queries.
**⚠️ NEVER use the same image twice!** Search for different images for different sections.
**⚠️ Match orientation to layout:** Use "horizontal" for hero banners, "vertical" for cards, "square" for avatars.

### 🔄 REAL-TIME SUBSCRIPTIONS
These tables support Supabase Realtime for live updates:
- project_chat_messages (new messages)
- project_comments (new comments)
- project_orders (order updates)
- project_notifications (new notifications)

Use supabase.channel().on('postgres_changes', ...) to subscribe.

## 🛠️ IMPLEMENTATION PATTERNS (Copy-Paste Ready)

### Pattern 1: Contact Form with Backend
\`\`\`jsx
const [formData, setFormData] = useState({ name: '', email: '', message: '' });
const [status, setStatus] = useState('idle'); // idle, loading, success, error

const handleSubmit = async (e) => {
  e.preventDefault();
  setStatus('loading');
  try {
    const res = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '{{PROJECT_ID}}',
        action: 'submit',
        formName: 'contact',
        data: formData
      })
    });
    if (res.ok) setStatus('success');
    else throw new Error('Failed');
  } catch (err) {
    setStatus('error');
  }
};
\`\`\`

### Pattern 2: Booking Form with Date/Time
\`\`\`jsx
const [booking, setBooking] = useState({ 
  name: '', email: '', phone: '', 
  service: '', date: '', time: '', notes: '' 
});

const handleBooking = async (e) => {
  e.preventDefault();
  const res = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api', {
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
  // Handle response...
};
\`\`\`

### Pattern 3: Fetch Products from Collection
\`\`\`jsx
const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchProducts = async () => {
    const res = await fetch(
      'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api' +
      '?projectId={{PROJECT_ID}}&action=collection/products'
    );
    const data = await res.json();
    setProducts(data.items || []);
    setLoading(false);
  };
  fetchProducts();
}, []);
\`\`\`

### Pattern 4: Shopping Cart
\`\`\`jsx
const [cart, setCart] = useState({ items: [] });
const sessionId = localStorage.getItem('cartSession') || crypto.randomUUID();

const addToCart = async (product) => {
  localStorage.setItem('cartSession', sessionId);
  const res = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: '{{PROJECT_ID}}',
      action: 'cart/add',
      data: { sessionId, item: { id: product.id, name: product.data.name, price: product.data.price, quantity: 1 } }
    })
  });
  const data = await res.json();
  setCart(data.cart);
};
\`\`\`

### Pattern 5: Site User Login
\`\`\`jsx
const [user, setUser] = useState(null);
const [token, setToken] = useState(localStorage.getItem('siteToken'));

const login = async (email, password) => {
  const res = await fetch('https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: '{{PROJECT_ID}}',
      action: 'auth/login',
      data: { email, password }
    })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('siteToken', data.token);
    setToken(data.token);
    setUser(data.user);
  }
};
\`\`\`

## ⚠️ COMMON MISTAKES TO AVOID

1. **DON'T hardcode product data** - Always fetch from collection API
2. **DON'T forget projectId** - Every API call needs it
3. **DON'T use wrong action format** - It's "collection/products" not "products"
4. **DON'T forget error handling** - Always wrap in try/catch
5. **DON'T forget loading states** - Show spinner while fetching
6. **DON'T forget empty states** - Handle when data array is empty
7. **DON'T use placeholder images** - Use FreePik API for real images

## 🔴 CRITICAL: QUESTIONS vs CODE CHANGES

**If the user asks a QUESTION (how many, what, list, count, show me), you MUST:**
1. Use query_backend or query_collection to get the data
2. Answer the question directly in text
3. **DO NOT edit any files** - questions don't need code changes!

**Examples of QUESTIONS (answer only, no code edits):**
- "How many products do I have?" → Use query_backend, answer: "You have 5 products."
- "What services are available?" → Use query_collection, answer: "You have: Haircut, Massage, Facial."
- "List my orders" → Use query_backend, answer with order list
- "How many bookings?" → Use query_backend, answer: "You have 12 bookings."

**Examples of CODE CHANGE requests (edit files):**
- "Add a products page" → Create/edit files
- "Change the button color" → Use search_replace
- "Fix the header" → Use search_replace
- "Create a booking form" → Create/edit files

**🚫 NEVER edit files when user just asks a question!**

## ✅ BACKEND SAFETY CHECKS (MANDATORY)

**Before UPDATE or DELETE backend data:**
1. **Query first** (query_backend/query_collection)
2. **Confirm the item exists**
3. **Then update/delete**

**RLS mismatch guard:**
- If results look like they belong to another user or project, STOP and warn.
- Do NOT proceed with any write.

## 🔧 AUTO-FIX: FIXING ERRORS

When you receive error context (runtime errors, build errors, etc.):

1. **ALWAYS read_file FIRST** - See the current code before fixing
2. **Understand the error** - Parse the error message, file, and line number
3. **Make MINIMAL fix** - Use search_replace to fix just the broken part
4. **Common error patterns:**

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| "Module not found: X" | Missing import | Add import statement |
| "X is not defined" | Missing variable/import | Add definition or import |
| "Cannot read properties of undefined" | Null check missing | Add optional chaining (?.) |
| "Unexpected token" | Syntax error | Check for missing brackets, quotes |
| "is not a function" | Wrong import or typo | Check import and function name |
| "Objects are not valid as a React child" | Rendering object directly | Render a field or use JSON.stringify |
| "Too many re-renders" | setState in render | Move setState into useEffect/handler |
| "Hooks can only be called" | Hook used outside component | Move hook into component scope |
| "Invalid hook call" | Duplicate React or wrong import | Check React versions/imports |
| "Cannot update a component while rendering" | setState during render | Move to useEffect/handler |
| "Expected corresponding JSX closing tag" | Missing closing tag | Close the JSX tag |
| "Adjacent JSX elements" | Missing wrapper | Add fragment <>...</> |
| "Cannot find name 'React'" | Missing React import (older JSX) | Add import React |
| "Element type is invalid" | Bad export/import | Fix default vs named export |

**Example fix flow:**
1. Error: "useState is not defined" in /App.js line 5
2. read_file /App.js
3. See: import React from 'react'; (missing useState)
4. search_replace: add useState to import
5. task_complete

**POST-FIX VERIFY (MANDATORY):**
1. Re-read the edited file(s)
2. Confirm the error line now looks correct
3. Ensure no new errors were introduced

## 🔒 MANDATORY: search_replace OVER write_file

**You MUST use search_replace instead of write_file when:**
- The file already exists
- You're changing less than 50% of the file
- You're fixing a bug
- You're updating styles, text, or small logic

**write_file is ONLY for:**
- Creating a brand NEW file that doesn't exist
- Complete rewrites (>50% of file changes)

**If you use write_file for small edits, you are WRONG and will break things.**

## ✅ POST-EDIT VERIFICATION (MANDATORY)

After any code change:
1. **Read the file again**
2. **Confirm the exact change**
3. **Then respond**
`;

// Normalize file path to always start with /
function normalizeFilePath(path: string): string {
  const p = (path || "").trim();
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

// Assert no HTML documents are being written
function assertNoHtml(path: string, value: string): void {
  const normalizedPath = normalizeFilePath(path);
  if (normalizedPath.toLowerCase().endsWith(".html")) return;
  const v = (value || "").toLowerCase();
  if (v.includes("<!doctype") || v.includes("<html")) {
    throw new Error("AI_RETURNED_HTML");
  }
}

// Tool call interface
interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

// Security context for agent operations
interface AgentSecurityContext {
  projectId: string;
  userId: string;
  timestamp: Date;
}

// Execute a single tool call
// ⚠️ SECURITY: All operations are scoped to projectId
// The projectId is validated by assertProjectOwnership BEFORE this function is called
export async function executeToolCall(
  projectId: string,
  toolCall: ToolCall,
  debugContext: AgentDebugContext,
  supabase: ReturnType<typeof createClient>,
  userId?: string
): Promise<any> {
  const { name, arguments: args } = toolCall;
  
  // ============================================================================
  // SECURITY CHECK: Validate projectId is present and valid format
  // ============================================================================
  if (!projectId || typeof projectId !== 'string') {
    console.error(`[Agent SECURITY] Invalid projectId: ${projectId}`);
    return { error: 'SECURITY: Invalid project context' };
  }
  
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(projectId)) {
    console.error(`[Agent SECURITY] ProjectId not valid UUID: ${projectId}`);
    return { error: 'SECURITY: Invalid project ID format' };
  }
  
  console.log(`[Agent] Executing tool: ${name} for project: ${projectId}`, args);
  
  switch (name) {
    case "read_file": {
      const path = normalizeFilePath(args.path || "");
      const { data, error } = await supabase
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', path)
        .maybeSingle();
      
      if (error) {
        console.error(`[Agent] read_file error:`, error);
        return { error: `Failed to read file: ${error.message}` };
      }
      if (!data) {
        return { error: `File not found: ${path}` };
      }
      return { content: data.content, path };
    }
    
    case "list_files": {
      const directory = args.directory ? normalizeFilePath(args.directory) : null;
      const { data, error } = await supabase
        .from('project_files')
        .select('path')
        .eq('project_id', projectId);
      
      if (error) {
        console.error(`[Agent] list_files error:`, error);
        return { error: `Failed to list files: ${error.message}` };
      }
      
      let files = (data || []).map(f => f.path);
      if (directory) {
        files = files.filter(f => f.startsWith(directory));
      }
      return { files, count: files.length };
    }
    
    // 🚀 GREP SEARCH - Find code across ALL files (like Cascade does!)
    case "grep_search": {
      const query = args.query || "";
      const filePattern = args.filePattern || "";
      
      if (!query) {
        return { error: "grep_search: 'query' parameter is required" };
      }
      
      console.log(`[Agent] grep_search: query="${query}", filePattern="${filePattern}"`);
      
      // Get all files from project
      const { data: allFiles, error } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      
      if (error) {
        console.error(`[Agent] grep_search error:`, error);
        return { error: `Failed to search files: ${error.message}` };
      }
      
      const results: Array<{ file: string; line: number; content: string }> = [];
      const queryLower = query.toLowerCase();
      
      for (const file of (allFiles || [])) {
        // Filter by file pattern if specified
        if (filePattern && !file.path.endsWith(filePattern)) {
          continue;
        }
        
        const lines = (file.content || "").split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            results.push({
              file: file.path,
              line: i + 1,
              content: lines[i].trim().substring(0, 200) // Limit line length
            });
          }
        }
      }
      
      console.log(`[Agent] grep_search: Found ${results.length} matches for "${query}"`);
      
      // Limit results to prevent token overflow
      const limitedResults = results.slice(0, 50);
      
      return { 
        query,
        matches: limitedResults,
        totalMatches: results.length,
        truncated: results.length > 50,
        summary: results.length === 0 
          ? `No matches found for "${query}"` 
          : `Found ${results.length} match(es) in ${[...new Set(results.map(r => r.file))].length} file(s)`
      };
    }
    
    case "write_file": {
      const path = normalizeFilePath(args.path || "");
      const content = args.content || "";
      
      console.log(`[Agent] write_file called: path=${path}, contentLength=${content.length}`);
      
      if (!content.trim()) {
        console.error(`[Agent] write_file REJECTED: empty content for ${path}`);
        return { error: "Cannot write empty file content" };
      }
      
      assertNoHtml(path, content);
      
      console.log(`[Agent] write_file UPSERTING to DB: project_id=${projectId}, path=${path}`);
      
      const { data, error } = await supabase
        .from('project_files')
        .upsert({
          project_id: projectId,
          path: path,
          content: content
        }, { onConflict: 'project_id,path' })
        .select('id, path');
      
      if (error) {
        console.error(`[Agent] write_file DB ERROR:`, error);
        return { error: `Failed to write file: ${error.message}` };
      }
      
      console.log(`[Agent] write_file SUCCESS: ${path} (${content.length} bytes), DB response:`, data);
      
      return { success: true, path, bytesWritten: content.length };
    }
    
    case "delete_file": {
      const path = normalizeFilePath(args.path || "");
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('project_id', projectId)
        .eq('path', path);
      
      if (error) {
        console.error(`[Agent] delete_file error:`, error);
        return { error: `Failed to delete file: ${error.message}` };
      }
      
      return { success: true, deletedPath: path };
    }
    
    // 🚀 NEW: SEARCH AND REPLACE - Targeted edits like Lovable!
    case "search_replace": {
      const path = normalizeFilePath(args.path || "");
      const search = args.search || "";
      const replace = args.replace || "";
      
      console.log(`[Agent] search_replace called: path=${path}, searchLen=${search.length}, replaceLen=${replace.length}`);
      
      if (!search) {
        console.error(`[Agent] search_replace REJECTED: empty search string`);
        return { error: "search_replace: 'search' parameter is required" };
      }
      
      // Read current file content
      const { data, error: readError } = await supabase
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', path)
        .maybeSingle();
      
      if (readError) {
        console.error(`[Agent] search_replace read error:`, readError);
        return { error: `Failed to read file: ${readError.message}` };
      }
      if (!data) {
        console.error(`[Agent] search_replace FAILED: File not found: ${path}`);
        return { error: `File not found: ${path}` };
      }
      
      const currentContent = data.content;
      console.log(`[Agent] search_replace: File ${path} has ${currentContent.length} chars`);
      
      // Check if search string exists in file
      if (!currentContent.includes(search)) {
        // Try to provide helpful feedback
        const searchPreview = search.substring(0, 100);
        console.error(`[Agent] search_replace FAILED: Search string not found in ${path}`);
        console.error(`[Agent] Search preview: "${searchPreview}..."`);
        return { 
          error: `Search string not found in ${path}. Make sure you copied the exact code including whitespace. Search preview: "${searchPreview}..."`,
          suggestion: "Use read_file to get the exact content, then copy-paste the search string exactly."
        };
      }
      
      // Count occurrences
      const occurrences = currentContent.split(search).length - 1;
      console.log(`[Agent] search_replace: Found ${occurrences} occurrence(s)`);
      if (occurrences > 1) {
        console.warn(`[Agent] search_replace: Found ${occurrences} occurrences, replacing first one`);
      }
      
      // Perform the replacement
      const newContent = currentContent.replace(search, replace);
      
      assertNoHtml(path, newContent);
      
      // Write updated content
      const { error: writeError } = await supabase
        .from('project_files')
        .update({ content: newContent })
        .eq('project_id', projectId)
        .eq('path', path);
      
      if (writeError) {
        console.error(`[Agent] search_replace write error:`, writeError);
        return { error: `Failed to write file: ${writeError.message}` };
      }
      
      const changeSize = replace.length - search.length;
      console.log(`[Agent] search_replace success: ${path} (${changeSize > 0 ? '+' : ''}${changeSize} chars)`);
      
      return { 
        success: true, 
        path, 
        occurrences,
        charsRemoved: search.length,
        charsAdded: replace.length,
        netChange: changeSize
      };
    }
    
    // 🚀 NEW: INSERT CODE - Add code at specific location
    case "insert_code": {
      const path = normalizeFilePath(args.path || "");
      const insertAfter = args.insertAfter ?? "";
      const code = args.code || "";
      
      if (!code) {
        return { error: "insert_code: 'code' parameter is required" };
      }
      
      // Read current file content
      const { data, error: readError } = await supabase
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', path)
        .maybeSingle();
      
      if (readError) {
        console.error(`[Agent] insert_code read error:`, readError);
        return { error: `Failed to read file: ${readError.message}` };
      }
      if (!data) {
        return { error: `File not found: ${path}` };
      }
      
      const currentContent = data.content;
      let newContent: string;
      
      if (insertAfter === "") {
        // Insert at beginning of file
        newContent = code + currentContent;
      } else if (!currentContent.includes(insertAfter)) {
        const insertPreview = insertAfter.substring(0, 100);
        console.error(`[Agent] insert_code: insertAfter string not found in ${path}`);
        return { 
          error: `insertAfter string not found in ${path}. Search preview: "${insertPreview}..."`,
          suggestion: "Use read_file to get the exact content, then copy-paste the insertAfter string exactly."
        };
      } else {
        // Insert after the found string
        const insertIndex = currentContent.indexOf(insertAfter) + insertAfter.length;
        newContent = currentContent.slice(0, insertIndex) + code + currentContent.slice(insertIndex);
      }
      
      assertNoHtml(path, newContent);
      
      // Write updated content
      const { error: writeError } = await supabase
        .from('project_files')
        .update({ content: newContent })
        .eq('project_id', projectId)
        .eq('path', path);
      
      if (writeError) {
        console.error(`[Agent] insert_code write error:`, writeError);
        return { error: `Failed to write file: ${writeError.message}` };
      }
      
      console.log(`[Agent] insert_code success: ${path} (+${code.length} chars)`);
      
      return { 
        success: true, 
        path, 
        charsInserted: code.length,
        insertedAt: insertAfter === "" ? "beginning" : "after marker"
      };
    }

    case "get_console_logs": {
      const filter = args.filter || 'all';
      const logs = debugContext.consoleLogs || [];
      
      if (filter === 'all') {
        return { logs, count: logs.length };
      }
      
      const filtered = logs.filter(l => l.level === filter);
      return { logs: filtered, count: filtered.length, filter };
    }
    
    case "get_network_errors": {
      const errors = debugContext.networkErrors || [];
      return { 
        networkErrors: errors, 
        count: errors.length,
        summary: errors.length === 0 
          ? "No network errors detected" 
          : `${errors.length} network error(s) found`
      };
    }
    
    case "get_runtime_errors": {
      const errors = debugContext.errors || [];
      return { 
        errors: errors, 
        count: errors.length,
        summary: errors.length === 0 
          ? "No runtime errors detected" 
          : `${errors.length} runtime error(s) found`
      };
    }
    
    case "query_collection": {
      const collection = args.collection;
      const limit = args.limit || 10;
      
      if (!collection) {
        return { error: "Collection name is required" };
      }
      
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/project-backend-api?projectId=${projectId}&action=collection/${collection}&limit=${limit}`
        );
        
        if (!response.ok) {
          return { error: `Failed to query collection: HTTP ${response.status}` };
        }
        
        const data = await response.json();
        return { collection, data, count: Array.isArray(data) ? data.length : 0 };
      } catch (err: any) {
        return { error: `Failed to query collection: ${err.message}` };
      }
    }
    
    case "query_backend": {
      // Query any backend feature (bookings, orders, cart, chat, etc.)
      const action = args.action || "";
      const queryData = args.data || {};
      
      if (!action) {
        return { error: "Action is required (e.g., 'booking/list', 'order/list', 'chat/rooms')" };
      }
      
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        
        // For GET-style queries, use URL params
        const isGetAction = action.includes('/list') || action.includes('/get') || action.includes('/check') || action.includes('/rooms') || action.includes('/messages');
        
        if (isGetAction && Object.keys(queryData).length === 0) {
          const response = await fetch(
            `${SUPABASE_URL}/functions/v1/project-backend-api?projectId=${projectId}&action=${action}`
          );
          
          if (!response.ok) {
            const errText = await response.text();
            return { error: `Backend query failed: HTTP ${response.status} - ${errText}` };
          }
          
          return await response.json();
        }
        
        // For POST-style queries with data
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/project-backend-api`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              action,
              data: queryData
            })
          }
        );
        
        if (!response.ok) {
          const errText = await response.text();
          return { error: `Backend query failed: HTTP ${response.status} - ${errText}` };
        }
        
        return await response.json();
      } catch (err: any) {
        return { error: `Failed to query backend: ${err.message}` };
      }
    }

    case "backend_cli": {
      const command = args.command as string;
      const collection = args.collection as string | undefined;
      const id = args.id as string | undefined;
      const data = args.data || {};
      const safeUserId = userId || projectId;
      const supabaseClient = supabase as any;

      if (!command || !BACKEND_CLI_ACTIONS.has(command)) {
        return { error: `Invalid backend_cli command: ${command}` };
      }

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      if (!SUPABASE_URL) {
        return { error: "SUPABASE_URL missing" };
      }

      const commandMap: Record<string, { action: string; method: "GET" | "POST" | "PUT" | "DELETE" }> = {
        createItem: { action: "collection", method: "POST" },
        updateItem: { action: "collection", method: "PUT" },
        deleteItem: { action: "collection", method: "DELETE" },
        listOrders: { action: "order/list", method: "GET" },
        getOrder: { action: "order/get", method: "GET" },
        updateOrder: { action: "order/update", method: "POST" },
        listBookings: { action: "booking/list", method: "GET" },
        createBooking: { action: "booking/create", method: "POST" },
        updateBooking: { action: "booking/update", method: "POST" },
        checkAvailability: { action: "booking/check", method: "POST" },
        listChatRooms: { action: "chat/rooms", method: "GET" },
        listMessages: { action: "chat/messages", method: "GET" },
        sendMessage: { action: "chat/send", method: "POST" },
        listComments: { action: "comments/list", method: "GET" },
        addComment: { action: "comments/add", method: "POST" },
        deleteComment: { action: "comments/delete", method: "POST" },
        listNotifications: { action: "notifications/list", method: "GET" },
        markNotificationRead: { action: "notifications/markRead", method: "POST" },
        listSiteUsers: { action: "roles/list", method: "GET" },
        assignRole: { action: "roles/assign", method: "POST" },
        checkRole: { action: "roles/check", method: "GET" }
      };

      const isCollectionCommand = ["describeCollection", "createCollection", "createItem", "updateItem", "deleteItem"].includes(command);
      if (isCollectionCommand && !collection) {
        return { error: "collection is required for this command" };
      }

      if (["updateItem", "deleteItem"].includes(command) && !id) {
        return { error: "id is required for this command" };
      }

      try {
        if (command === "listCollections") {
          const { data: schemaRows, error: schemaError } = await supabaseClient
            .from('project_collection_schemas')
            .select('collection_name, schema, display_name')
            .eq('project_id', projectId);

          if (schemaError) return { error: `Failed to list collections: ${schemaError.message}` };

          const { data: collectionRows, error: collectionError } = await supabaseClient
            .from('project_collections')
            .select('collection_name')
            .eq('project_id', projectId)
            .eq('status', 'active');

          if (collectionError) return { error: `Failed to count collections: ${collectionError.message}` };

          const counts = (collectionRows || []).reduce((acc: Record<string, number>, row: { collection_name: string }) => {
            acc[row.collection_name] = (acc[row.collection_name] || 0) + 1;
            return acc;
          }, {});

          const collections = (schemaRows || []).map((row: { collection_name: string; display_name?: string; schema?: { fields?: Array<{ name: string; type: string }> } }) => ({
            name: row.collection_name,
            displayName: row.display_name || row.collection_name,
            fields: row.schema?.fields || [],
            itemCount: counts[row.collection_name] || 0
          }));

          return { collections };
        }

        if (command === "describeCollection") {
          const collectionName = collection as string;
          const { data: schemaRow, error: schemaError } = await supabaseClient
            .from('project_collection_schemas')
            .select('collection_name, schema, display_name')
            .eq('project_id', projectId)
            .eq('collection_name', collectionName)
            .maybeSingle();

          if (schemaError) return { error: `Failed to describe collection: ${schemaError.message}` };

          const { data: sampleRows, error: sampleError } = await supabaseClient
            .from('project_collections')
            .select('id, data, created_at')
            .eq('project_id', projectId)
            .eq('collection_name', collectionName)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(5);

          if (sampleError) return { error: `Failed to fetch sample items: ${sampleError.message}` };

          return {
            collection: {
              name: collectionName,
              displayName: (schemaRow as any)?.display_name || collectionName,
              schema: schemaRow?.schema || { fields: [] },
              sampleItems: sampleRows || []
            }
          };
        }

        if (command === "createCollection") {
          const collectionName = collection as string;
          const schemaData = data?.schema || data?.fields ? { fields: data?.fields || data?.schema?.fields || [] } : null;
          if (!schemaData || (schemaData.fields || []).length === 0) {
            return { error: "createCollection requires data.fields (array of {name,type})" };
          }

          const { data: existing } = await supabaseClient
            .from('project_collection_schemas')
            .select('id')
            .eq('project_id', projectId)
            .eq('collection_name', collectionName)
            .maybeSingle();

          if (existing?.id) {
            return { error: `Collection already exists: ${collectionName}` };
          }

          const { data: created, error: createError } = await supabaseClient
            .from('project_collection_schemas')
            .insert({
              project_id: projectId,
              user_id: safeUserId,
              collection_name: collectionName,
              display_name: collectionName.charAt(0).toUpperCase() + collectionName.slice(1),
              schema: schemaData
            })
            .select('id, collection_name, schema')
            .single();

          if (createError) {
            return { error: `Failed to create collection: ${createError.message}` };
          }

          return { collection: created };
        }

        const mapping = commandMap[command];
        if (!mapping) {
          return { error: `No mapping for backend_cli command: ${command}` };
        }

        const useGet = mapping.method === "GET" && (!data || Object.keys(data).length === 0);
        if (useGet) {
          const params = new URLSearchParams({
            projectId,
            action: mapping.action,
          });
          if (collection) params.set("collection", collection);
          if (id) params.set("id", id);
          const response = await fetch(`${SUPABASE_URL}/functions/v1/project-backend-api?${params.toString()}`);
          if (!response.ok) {
            const errText = await response.text();
            return { error: `backend_cli failed: HTTP ${response.status} - ${errText}` };
          }
          return await response.json();
        }

        const action = isCollectionCommand
          ? `collection/${collection}`
          : mapping.action;

        const response = await fetch(`${SUPABASE_URL}/functions/v1/project-backend-api`, {
          method: mapping.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            action,
            id,
            data
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return { error: `backend_cli failed: HTTP ${response.status} - ${errText}` };
        }

        return await response.json();
      } catch (err: any) {
        return { error: `backend_cli failed: ${err.message}` };
      }
    }
    
    case "get_project_info": {
      // Get project metadata
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, status, slug')
        .eq('id', projectId)
        .maybeSingle();
      
      // Get backend status
      const { data: backend } = await supabase
        .from('project_backends')
        .select('enabled, features')
        .eq('project_id', projectId)
        .maybeSingle();
      
      // Get file count
      const { count: fileCount } = await supabase
        .from('project_files')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);
      
      return {
        project: project || { id: projectId },
        backend: backend || { enabled: false },
        fileCount: fileCount || 0
      };
    }
    
    case "task_complete": {
      return { 
        acknowledged: true,
        summary: args.summary,
        filesChanged: args.filesChanged || []
      };
    }
    
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// Agent result interface - Enhanced for Phase 5: Better debugging
export interface AgentResult {
  success: boolean;
  summary: string;
  filesChanged: string[];
  iterations: number;
  toolCalls: Array<{ tool: string; result: any }>;
  error?: string;
  // Phase 5: Enhanced debugging info
  renderPathStatus?: {
    computed: boolean;
    activeFiles: string[];
    deadFiles: string[];  // Files edited but not in render path
  };
  verificationStatus?: {
    verified: boolean;
    issues: string[];
    colorVerified?: boolean;
    conflictingClasses?: string[];
  };
  ambiguityStatus?: {
    detected: boolean;
    candidateFiles?: string[];
    message?: string;
    requiresUserInput?: boolean;
    suggestInspectMode?: boolean;
  };
  styleChangeStatus?: {
    isStyleRequest: boolean;
    requestedColor?: string;
    colorValid?: boolean;
    blocked?: boolean;
    blockedReason?: string;
  };
  warnings: string[];
}

// Format tools for Gemini API
export function getGeminiToolsConfig() {
  return {
    functionDeclarations: AGENT_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }))
  };
}
