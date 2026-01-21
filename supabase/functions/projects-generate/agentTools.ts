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
// 🔍 EDIT INTENT ANALYZER (from Open Lovable)
// Analyzes user prompts to determine edit type and target files
// ============================================================================

export type EditIntentType = 
  | 'UPDATE_COMPONENT'  // Change existing component
  | 'ADD_FEATURE'       // Add new page/section/component
  | 'FIX_ISSUE'         // Fix a bug or error
  | 'UPDATE_STYLE'      // Change colors/theme/CSS
  | 'REFACTOR'          // Clean up/reorganize code
  | 'ADD_DEPENDENCY'    // Install/add package
  | 'FULL_REBUILD'      // Start over
  | 'QUESTION'          // Just asking, no edit needed
  | 'REMOVE_ELEMENT'    // Delete/remove something
  | 'UNKNOWN';

// ============================================================================
// 🔧 ERROR CLASSIFICATION (from Open Lovable's build-validator.ts)
// Classifies errors for smarter auto-fix strategies
// ============================================================================

export type ErrorType = 
  | 'missing-package'    // npm package not installed
  | 'missing-import'     // Import statement missing
  | 'syntax-error'       // JavaScript/JSX syntax error
  | 'undefined-variable' // Variable/function not defined
  | 'type-error'         // Type mismatch
  | 'render-error'       // React render error
  | 'network-error'      // API/fetch error
  | 'build-error'        // Build/compile error
  | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
  retryDelay: number;  // Milliseconds to wait before retry
  canAutoFix: boolean; // Whether AI can likely fix this automatically
}

/**
 * Classify an error for smarter auto-fix handling
 * Based on Open Lovable's build-validator.ts
 */
export function classifyError(error: { message: string; file?: string; line?: number; type?: string }): ClassifiedError {
  const msg = (error.message || '').toLowerCase();
  const originalMsg = error.message || '';
  
  // Missing package errors
  if (msg.includes('module not found') || msg.includes('cannot find module') || 
      msg.includes('failed to resolve import') || msg.includes('package not found')) {
    const packageMatch = originalMsg.match(/['"]([^'"]+)['"]/);
    const packageName = packageMatch ? packageMatch[1].split('/')[0] : 'unknown';
    return {
      type: 'missing-package',
      message: originalMsg,
      file: error.file,
      line: error.line,
      suggestedFix: `Add import for "${packageName}" or install the package`,
      retryDelay: 2000,
      canAutoFix: true
    };
  }
  
  // Missing import / undefined variable
  if (msg.includes('is not defined') || msg.includes('cannot find name') ||
      msg.includes('is not a function') || msg.includes('undefined is not')) {
    const varMatch = originalMsg.match(/['"]?(\w+)['"]?\s+is not defined/i) ||
                     originalMsg.match(/cannot find name\s+['"]?(\w+)/i);
    const varName = varMatch ? varMatch[1] : 'unknown';
    return {
      type: 'undefined-variable',
      message: originalMsg,
      file: error.file,
      line: error.line,
      suggestedFix: `Add import or define "${varName}"`,
      retryDelay: 1000,
      canAutoFix: true
    };
  }
  
  // Syntax errors
  if (msg.includes('unexpected token') || msg.includes('syntax error') ||
      msg.includes('parsing error') || msg.includes('unterminated') ||
      msg.includes('expected') || msg.includes('missing')) {
    return {
      type: 'syntax-error',
      message: originalMsg,
      file: error.file,
      line: error.line,
      suggestedFix: 'Check for missing brackets, quotes, or semicolons',
      retryDelay: 1000,
      canAutoFix: true
    };
  }
  
  // React render errors
  if (msg.includes('objects are not valid as a react child') ||
      msg.includes('too many re-renders') || msg.includes('invalid hook call') ||
      msg.includes('hooks can only be called') || msg.includes('cannot update a component')) {
    return {
      type: 'render-error',
      message: originalMsg,
      file: error.file,
      line: error.line,
      suggestedFix: 'Check React hooks usage and component structure',
      retryDelay: 1500,
      canAutoFix: true
    };
  }
  
  // Type errors
  if (msg.includes('type error') || msg.includes('cannot read properties of') ||
      msg.includes('is not assignable') || msg.includes('property') && msg.includes('does not exist')) {
    return {
      type: 'type-error',
      message: originalMsg,
      file: error.file,
      line: error.line,
      suggestedFix: 'Add null check or fix type mismatch',
      retryDelay: 1000,
      canAutoFix: true
    };
  }
  
  // Network errors
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('cors') ||
      msg.includes('api') || msg.includes('http') || msg.includes('request failed')) {
    return {
      type: 'network-error',
      message: originalMsg,
      file: error.file,
      line: error.line,
      suggestedFix: 'Check API endpoint and request configuration',
      retryDelay: 3000,
      canAutoFix: false  // Usually needs user input for API issues
    };
  }
  
  // Build errors
  if (msg.includes('build failed') || msg.includes('compilation error') ||
      msg.includes('esbuild') || msg.includes('vite') || msg.includes('webpack')) {
    return {
      type: 'build-error',
      message: originalMsg,
      file: error.file,
      line: error.line,
      suggestedFix: 'Check build configuration and dependencies',
      retryDelay: 2000,
      canAutoFix: true
    };
  }
  
  // Unknown error
  return {
    type: 'unknown',
    message: originalMsg,
    file: error.file,
    line: error.line,
    retryDelay: 2000,
    canAutoFix: false
  };
}

/**
 * Extract missing package names from error messages
 */
export function extractMissingPackages(errorMessage: string): string[] {
  const packages: string[] = [];
  
  // Pattern: Failed to resolve import "package-name"
  const resolveMatches = errorMessage.matchAll(/failed to resolve import ["']([^"']+)["']/gi);
  for (const match of resolveMatches) {
    const pkg = match[1];
    if (!pkg.startsWith('.') && !pkg.startsWith('/')) {
      // Extract base package name (e.g., @scope/package from @scope/package/subpath)
      const parts = pkg.split('/');
      const basePkg = pkg.startsWith('@') && parts.length >= 2 
        ? `${parts[0]}/${parts[1]}` 
        : parts[0];
      packages.push(basePkg);
    }
  }
  
  // Pattern: Module not found: 'package-name'
  const moduleMatches = errorMessage.matchAll(/module not found[:\s]+["']?([^"'\s]+)["']?/gi);
  for (const match of moduleMatches) {
    const pkg = match[1];
    if (!pkg.startsWith('.') && !pkg.startsWith('/')) {
      packages.push(pkg.split('/')[0]);
    }
  }
  
  return [...new Set(packages)];
}

/**
 * Calculate retry delay based on error type and attempt number
 */
export function calculateRetryDelay(attempt: number, errorType: ErrorType): number {
  const baseDelays: Record<ErrorType, number> = {
    'missing-package': 2000,
    'missing-import': 1000,
    'syntax-error': 1000,
    'undefined-variable': 1000,
    'type-error': 1000,
    'render-error': 1500,
    'network-error': 3000,
    'build-error': 2000,
    'unknown': 2000
  };
  
  const base = baseDelays[errorType] || 2000;
  // Exponential backoff with max of 10 seconds
  return Math.min(base * Math.pow(1.5, attempt - 1), 10000);
}

// ============================================================================
// 📄 FALLBACK RESPONSE PARSING (from Open Lovable's apply-ai-code/route.ts)
// Parses AI text responses for <file> tags when tools aren't used
// ============================================================================

export interface ParsedFileChange {
  path: string;
  content: string;
  action: 'create' | 'update' | 'delete';
}

export interface ParsedAIResponse {
  files: ParsedFileChange[];
  commands: string[];
  packages: string[];
  summary: string;
}

/**
 * Parse AI response text for file changes using <file> tags
 * Fallback when AI doesn't use proper tools
 * Based on Open Lovable's apply-ai-code/route.ts
 */
export function parseAIResponseForFiles(responseText: string): ParsedAIResponse {
  const result: ParsedAIResponse = {
    files: [],
    commands: [],
    packages: [],
    summary: ''
  };
  
  if (!responseText) return result;
  
  // Pattern 1: <file path="/path/to/file.js">content</file>
  const fileTagPattern = /<file\s+path=["']([^"']+)["'](?:\s+action=["']([^"']+)["'])?>([\s\S]*?)<\/file>/gi;
  let match;
  
  while ((match = fileTagPattern.exec(responseText)) !== null) {
    const path = match[1].startsWith('/') ? match[1] : `/${match[1]}`;
    const action = (match[2] || 'update') as 'create' | 'update' | 'delete';
    const content = match[3].trim();
    
    // Skip if content looks like it's just a placeholder
    if (content.includes('// ... rest of file') || content.includes('/* ... */')) {
      console.log(`[ParseAI] Skipping partial file: ${path}`);
      continue;
    }
    
    result.files.push({ path, content, action });
    console.log(`[ParseAI] Found file tag: ${path} (${action})`);
  }
  
  // Pattern 2: ```jsx filename="/path/to/file.js" or ```js // /path/to/file.js
  const codeBlockPattern = /```(?:jsx?|tsx?|css|html)?\s*(?:filename=["']([^"']+)["']|\/\/\s*([^\n]+\.(?:js|jsx|ts|tsx|css|html)))\n([\s\S]*?)```/gi;
  
  while ((match = codeBlockPattern.exec(responseText)) !== null) {
    const pathFromAttr = match[1];
    const pathFromComment = match[2];
    const rawPath = pathFromAttr || pathFromComment;
    
    if (!rawPath) continue;
    
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const content = match[3].trim();
    
    // Check if we already have this file from <file> tags
    if (result.files.some(f => f.path === path)) continue;
    
    // Skip partial content
    if (content.includes('// ... rest of file') || content.includes('/* ... */')) {
      continue;
    }
    
    result.files.push({ path, content, action: 'update' });
    console.log(`[ParseAI] Found code block file: ${path}`);
  }
  
  // Pattern 3: Extract npm install commands
  const npmPattern = /npm\s+install\s+([^\n]+)/gi;
  while ((match = npmPattern.exec(responseText)) !== null) {
    const packages = match[1].split(/\s+/).filter(p => !p.startsWith('-') && p.length > 0);
    result.packages.push(...packages);
  }
  
  // Pattern 4: Extract shell commands in <command> tags
  const commandPattern = /<command>([\s\S]*?)<\/command>/gi;
  while ((match = commandPattern.exec(responseText)) !== null) {
    result.commands.push(match[1].trim());
  }
  
  // Extract summary from first paragraph or <summary> tag
  const summaryMatch = responseText.match(/<summary>([\s\S]*?)<\/summary>/i);
  if (summaryMatch) {
    result.summary = summaryMatch[1].trim();
  } else {
    // Use first non-code paragraph as summary
    const paragraphs = responseText.split(/\n\n+/);
    for (const p of paragraphs) {
      if (!p.startsWith('```') && !p.startsWith('<') && p.length > 20) {
        result.summary = p.substring(0, 200);
        break;
      }
    }
  }
  
  console.log(`[ParseAI] Parsed ${result.files.length} files, ${result.packages.length} packages, ${result.commands.length} commands`);
  
  return result;
}

/**
 * Apply parsed file changes to the database
 * Used as fallback when AI doesn't use tools
 */
export async function applyParsedFileChanges(
  projectId: string,
  changes: ParsedFileChange[],
  supabase: ReturnType<typeof createClient>
): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
  const applied: string[] = [];
  const errors: string[] = [];
  
  for (const change of changes) {
    try {
      if (change.action === 'delete') {
        const { error } = await supabase
          .from('project_files')
          .delete()
          .eq('project_id', projectId)
          .eq('path', change.path);
        
        if (error) {
          errors.push(`Failed to delete ${change.path}: ${error.message}`);
        } else {
          applied.push(`Deleted: ${change.path}`);
        }
      } else {
        // Create or update
        const { error } = await supabase
          .from('project_files')
          .upsert({
            project_id: projectId,
            path: change.path,
            content: change.content
          }, { onConflict: 'project_id,path' });
        
        if (error) {
          errors.push(`Failed to ${change.action} ${change.path}: ${error.message}`);
        } else {
          applied.push(`${change.action === 'create' ? 'Created' : 'Updated'}: ${change.path}`);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push(`Error with ${change.path}: ${errorMessage}`);
    }
  }
  
  return { success: errors.length === 0, applied, errors };
}

// ============================================================================
// 🔍 MORPH WARP GREP - AI-Powered Code Search
// Uses Morph's Warp Grep model for intelligent code navigation
// Docs: https://docs.morphllm.com/api-reference/endpoint/warpgrep
// ============================================================================

export interface WarpGrepResult {
  success: boolean;
  files: Array<{
    path: string;
    lines: string;  // e.g., "1-60"
    content?: string;
  }>;
  thinking?: string;
  error?: string;
  turnsUsed?: number;
}

interface WarpGrepToolCall {
  type: 'grep' | 'read' | 'list_directory' | 'finish';
  pattern?: string;
  subDir?: string;
  path?: string;
  lines?: string;
  files?: Array<{ path: string; lines: string }>;
}

/**
 * Parse Warp Grep XML response for tool calls
 */
function parseWarpGrepResponse(response: string): { thinking: string; toolCalls: WarpGrepToolCall[] } {
  const thinking = response.match(/<think>([\s\S]*?)<\/think>/i)?.[1]?.trim() || '';
  const toolCalls: WarpGrepToolCall[] = [];
  
  // Parse <grep> tags
  const grepMatches = response.matchAll(/<grep>([\s\S]*?)<\/grep>/gi);
  for (const match of grepMatches) {
    const content = match[1];
    const pattern = content.match(/<pattern>([\s\S]*?)<\/pattern>/i)?.[1]?.trim();
    const subDir = content.match(/<sub_dir>([\s\S]*?)<\/sub_dir>/i)?.[1]?.trim();
    if (pattern) {
      toolCalls.push({ type: 'grep', pattern, subDir });
    }
  }
  
  // Parse <read> tags
  const readMatches = response.matchAll(/<read>([\s\S]*?)<\/read>/gi);
  for (const match of readMatches) {
    const content = match[1];
    const path = content.match(/<path>([\s\S]*?)<\/path>/i)?.[1]?.trim();
    const lines = content.match(/<lines>([\s\S]*?)<\/lines>/i)?.[1]?.trim();
    if (path) {
      toolCalls.push({ type: 'read', path, lines });
    }
  }
  
  // Parse <list_directory> tags
  const listMatches = response.matchAll(/<list_directory>([\s\S]*?)<\/list_directory>/gi);
  for (const match of listMatches) {
    const content = match[1];
    const path = content.match(/<path>([\s\S]*?)<\/path>/i)?.[1]?.trim() || content.trim();
    if (path) {
      toolCalls.push({ type: 'list_directory', path });
    }
  }
  
  // Parse <finish> tag
  const finishMatch = response.match(/<finish>([\s\S]*?)<\/finish>/i);
  if (finishMatch) {
    const content = finishMatch[1];
    const files: Array<{ path: string; lines: string }> = [];
    const fileMatches = content.matchAll(/<file>([\s\S]*?)<\/file>/gi);
    for (const match of fileMatches) {
      const fileContent = match[1];
      const path = fileContent.match(/<path>([\s\S]*?)<\/path>/i)?.[1]?.trim();
      const lines = fileContent.match(/<lines>([\s\S]*?)<\/lines>/i)?.[1]?.trim() || '1-100';
      if (path) {
        files.push({ path, lines });
      }
    }
    toolCalls.push({ type: 'finish', files });
  }
  
  return { thinking, toolCalls };
}

/**
 * Execute Warp Grep tool calls against our project files
 */
async function executeWarpGrepTools(
  toolCalls: WarpGrepToolCall[],
  projectId: string,
  allFiles: Record<string, string>,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const results: string[] = [];
  
  for (const call of toolCalls) {
    switch (call.type) {
      case 'grep': {
        const pattern = call.pattern || '';
        const subDir = call.subDir || '';
        const matches: string[] = [];
        
        try {
          const regex = new RegExp(pattern, 'gi');
          for (const [filePath, content] of Object.entries(allFiles)) {
            if (subDir && !filePath.startsWith(subDir) && !filePath.startsWith('/' + subDir)) {
              continue;
            }
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                // Include context (1 line before/after)
                const before = i > 0 ? `${filePath}-${i}-${lines[i-1]}` : '';
                const match = `${filePath}:${i+1}:${lines[i]}`;
                const after = i < lines.length - 1 ? `${filePath}-${i+2}-${lines[i+1]}` : '';
                if (before) matches.push(before);
                matches.push(match);
                if (after) matches.push(after);
                matches.push('--');
              }
            }
          }
        } catch {
          // Invalid regex, try literal search
          for (const [filePath, content] of Object.entries(allFiles)) {
            if (subDir && !filePath.startsWith(subDir) && !filePath.startsWith('/' + subDir)) {
              continue;
            }
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(pattern.toLowerCase())) {
                matches.push(`${filePath}:${i+1}:${lines[i]}`);
              }
            }
          }
        }
        
        results.push(`<grep pattern="${pattern}" sub_dir="${subDir}">\n${matches.slice(0, 50).join('\n')}\n</grep>`);
        break;
      }
      
      case 'read': {
        const path = call.path || '';
        const normalizedPath = path.startsWith('/') ? path : '/' + path;
        const content = allFiles[normalizedPath] || allFiles[path];
        
        if (content) {
          let output = content;
          if (call.lines) {
            const [start, end] = call.lines.split('-').map(n => parseInt(n, 10));
            const lines = content.split('\n');
            output = lines.slice((start || 1) - 1, end || lines.length).join('\n');
          }
          results.push(`<read path="${path}">\n${output.substring(0, 5000)}\n</read>`);
        } else {
          results.push(`<read path="${path}">\nFile not found\n</read>`);
        }
        break;
      }
      
      case 'list_directory': {
        const dirPath = call.path || '';
        const normalizedDir = dirPath.startsWith('/') ? dirPath : '/' + dirPath;
        const files = Object.keys(allFiles)
          .filter(f => f.startsWith(normalizedDir) || f.startsWith(dirPath))
          .map(f => f.replace(normalizedDir, '').replace(dirPath, ''))
          .filter(f => f && !f.includes('/'))  // Only direct children
          .slice(0, 50);
        
        // Also get subdirectories
        const subdirs = new Set<string>();
        for (const f of Object.keys(allFiles)) {
          if (f.startsWith(normalizedDir) || f.startsWith(dirPath)) {
            const relative = f.replace(normalizedDir, '').replace(dirPath, '');
            const parts = relative.split('/').filter(Boolean);
            if (parts.length > 1) {
              subdirs.add(parts[0] + '/');
            }
          }
        }
        
        const listing = [...subdirs, ...files].slice(0, 50).join('\n');
        results.push(`<list_directory path="${dirPath}">\n${listing}\n</list_directory>`);
        break;
      }
      
      case 'finish': {
        // Don't add anything for finish - it's the final answer
        break;
      }
    }
  }
  
  return results.join('\n\n');
}

/**
 * Morph Warp Grep - AI-powered code search
 * Uses multi-turn conversation to intelligently find code
 */
export async function morphWarpGrep(
  query: string,
  projectId: string,
  allFiles: Record<string, string>,
  supabase: ReturnType<typeof createClient>
): Promise<WarpGrepResult> {
  const MORPH_API_KEY = Deno.env.get("MORPH_API_KEY");
  
  if (!MORPH_API_KEY) {
    console.warn("[WarpGrep] MORPH_API_KEY not set");
    return { success: false, files: [], error: "MORPH_API_KEY not configured" };
  }
  
  try {
    console.log(`[WarpGrep] Starting search: "${query.substring(0, 50)}..."`);
    
    // Build repo structure from files
    const dirs = new Set<string>();
    for (const path of Object.keys(allFiles)) {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      for (let i = 0; i < parts.length - 1; i++) {
        current += '/' + parts[i];
        dirs.add(current);
      }
    }
    
    // Create tree structure (depth 2)
    const rootDirs = [...dirs].filter(d => d.split('/').filter(Boolean).length <= 2).sort();
    const rootFiles = Object.keys(allFiles).filter(f => f.split('/').filter(Boolean).length === 1);
    const repoStructure = [...rootDirs.map(d => d + '/'), ...rootFiles].join('\n');
    
    // Initial message
    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: "You are a code search agent. Use grep/read/list_directory/finish to locate code. Be efficient - use grep first to find patterns, then read specific files. Call finish when you have found the relevant code."
      },
      {
        role: "user",
        content: `<repo_structure>\n${repoStructure}\n</repo_structure>\n\n<search_string>\n${query}\n</search_string>`
      }
    ];
    
    let turnsUsed = 0;
    const maxTurns = 4;
    let lastThinking = '';
    
    while (turnsUsed < maxTurns) {
      turnsUsed++;
      
      const response = await fetch("https://api.morphllm.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MORPH_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "morph-warp-grep-v1",
          messages,
          temperature: 0.0,
          max_tokens: 2048
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WarpGrep] API error: ${response.status} - ${errorText}`);
        return { success: false, files: [], error: `Warp Grep API error: ${response.status}` };
      }
      
      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || '';
      
      console.log(`[WarpGrep] Turn ${turnsUsed}: ${assistantMessage.substring(0, 100)}...`);
      
      // Parse the response
      const { thinking, toolCalls } = parseWarpGrepResponse(assistantMessage);
      lastThinking = thinking || lastThinking;
      
      // Check for finish
      const finishCall = toolCalls.find(tc => tc.type === 'finish');
      if (finishCall && finishCall.files) {
        console.log(`[WarpGrep] Finished with ${finishCall.files.length} files`);
        
        // Read the actual content for each file
        const filesWithContent = finishCall.files.map(f => {
          const normalizedPath = f.path.startsWith('/') ? f.path : '/' + f.path;
          const content = allFiles[normalizedPath] || allFiles[f.path];
          return {
            path: f.path,
            lines: f.lines,
            content: content?.substring(0, 3000)
          };
        });
        
        return {
          success: true,
          files: filesWithContent,
          thinking: lastThinking,
          turnsUsed
        };
      }
      
      // Execute tool calls and continue conversation
      if (toolCalls.length === 0) {
        console.warn(`[WarpGrep] No tool calls in response, ending`);
        break;
      }
      
      const toolResults = await executeWarpGrepTools(toolCalls, projectId, allFiles, supabase);
      
      // Add to conversation
      messages.push({ role: "assistant", content: assistantMessage });
      messages.push({ 
        role: "user", 
        content: `${toolResults}\n\nYou have used ${turnsUsed} turn and have ${maxTurns - turnsUsed} remaining.`
      });
    }
    
    console.warn(`[WarpGrep] Max turns reached without finish`);
    return { success: false, files: [], error: "Search did not complete", turnsUsed };
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[WarpGrep] Exception: ${errorMessage}`);
    return { success: false, files: [], error: `Warp Grep exception: ${errorMessage}` };
  }
}

// ============================================================================
// 🔧 UDIFF GENERATION - For post-edit verification (Morph recommendation)
// Pattern: apply first, verify after - pass UDiff back to agent on errors
// ============================================================================

/**
 * Generate a unified diff between original and modified code
 * Used for verification after edits (Morph best practice)
 */
function generateUDiff(original: string, modified: string, filename: string): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  const diff: string[] = [];
  diff.push(`--- a/${filename}`);
  diff.push(`+++ b/${filename}`);
  
  // Simple line-by-line diff (not full Myers algorithm, but sufficient for verification)
  let i = 0, j = 0;
  let hunkStart = -1;
  let hunkLines: string[] = [];
  
  const flushHunk = () => {
    if (hunkLines.length > 0 && hunkStart >= 0) {
      const removedCount = hunkLines.filter(l => l.startsWith('-')).length;
      const addedCount = hunkLines.filter(l => l.startsWith('+')).length;
      const contextCount = hunkLines.filter(l => l.startsWith(' ')).length;
      diff.push(`@@ -${hunkStart + 1},${removedCount + contextCount} +${hunkStart + 1},${addedCount + contextCount} @@`);
      diff.push(...hunkLines);
      hunkLines = [];
      hunkStart = -1;
    }
  };
  
  while (i < originalLines.length || j < modifiedLines.length) {
    if (i < originalLines.length && j < modifiedLines.length && originalLines[i] === modifiedLines[j]) {
      // Context line (unchanged)
      if (hunkLines.length > 0) {
        hunkLines.push(` ${originalLines[i]}`);
        // Flush if we have 3+ context lines after changes
        const lastChangeIdx = Math.max(
          hunkLines.map((l, idx) => l.startsWith('-') || l.startsWith('+') ? idx : -1).reduce((a, b) => Math.max(a, b), -1)
        );
        if (hunkLines.length - lastChangeIdx > 3) {
          flushHunk();
        }
      }
      i++;
      j++;
    } else if (i < originalLines.length && (j >= modifiedLines.length || originalLines[i] !== modifiedLines[j])) {
      // Removed line
      if (hunkStart < 0) hunkStart = i;
      hunkLines.push(`-${originalLines[i]}`);
      i++;
    } else if (j < modifiedLines.length) {
      // Added line
      if (hunkStart < 0) hunkStart = Math.max(0, i - 1);
      hunkLines.push(`+${modifiedLines[j]}`);
      j++;
    }
  }
  
  flushHunk();
  
  return diff.length > 2 ? diff.join('\n') : '(no changes)';
}

// ============================================================================
// 🚀 MORPH FAST APPLY - Intelligent Code Merging (from Open Lovable)
// Uses Morph LLM API for 10,500+ tokens/sec code merging with 98% accuracy
// Docs: https://docs.morphllm.com/sdk/components/fast-apply
// ============================================================================

export interface MorphApplyInput {
  originalCode: string;      // Current file contents
  codeEdit: string;          // Code with "// ... existing code ..." markers
  instructions: string;      // What the model is changing
  filepath?: string;         // Optional, for context
}

export interface MorphApplyResult {
  success: boolean;
  mergedCode?: string;       // The merged result
  changes?: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
  };
  udiff?: string;            // Unified diff for verification
  error?: string;
  model?: string;            // Which Morph model was used
  tokensUsed?: number;
  retryAttempt?: number;     // Which retry attempt this was (0 = first try)
  contextLines?: number;     // How many context lines were used
}

// ============================================================================
// 🔧 PARSE MORPH EDITS - Extract <edit> blocks from AI response
// This is how Open Lovable structures edits for Morph Fast Apply
// ============================================================================

export interface MorphEditBlock {
  targetFile: string;
  instructions: string;
  update: string;
}

/**
 * Parse <edit> blocks from LLM output
 * Format: <edit target_file="path/to/file.js">
 *           <instructions>What to change</instructions>
 *           <update>Code with // ... existing code ... markers</update>
 *         </edit>
 */
export function parseMorphEdits(text: string): MorphEditBlock[] {
  const edits: MorphEditBlock[] = [];
  const editRegex = /<edit\s+target_file="([^"]+)">([\s\S]*?)<\/edit>/g;
  let match: RegExpExecArray | null;
  
  while ((match = editRegex.exec(text)) !== null) {
    const targetFile = match[1].trim();
    const inner = match[2];
    
    // Extract instructions
    const instrMatch = inner.match(/<instructions>([\s\S]*?)<\/instructions>/);
    const instructions = instrMatch ? instrMatch[1].trim() : '';
    
    // Extract update code
    const updateMatch = inner.match(/<update>([\s\S]*?)<\/update>/);
    const update = updateMatch ? updateMatch[1].trim() : '';
    
    if (targetFile && update) {
      edits.push({ targetFile, instructions, update });
      console.log(`[parseMorphEdits] Found edit for: ${targetFile}`);
    }
  }
  
  console.log(`[parseMorphEdits] Total edits found: ${edits.length}`);
  return edits;
}

/**
 * Call Morph Fast Apply API to intelligently merge code changes
 * This is the secret sauce - it understands code context and merges changes
 * even when the AI doesn't provide exact string matches
 * 
 * API: POST https://api.morphllm.com/v1/chat/completions
 * Model: morph-v3-fast (10,500+ tok/sec) or auto (recommended)
 */
export async function morphFastApply(input: MorphApplyInput): Promise<MorphApplyResult> {
  const MORPH_API_KEY = Deno.env.get("MORPH_API_KEY");
  
  if (!MORPH_API_KEY) {
    console.warn("[Morph] MORPH_API_KEY not set, falling back to exact match");
    return {
      success: false,
      error: "MORPH_API_KEY not configured"
    };
  }
  
  try {
    console.log(`[Morph] Fast Apply: ${input.filepath || 'unknown'}, instruction: ${input.instructions.substring(0, 50)}...`);
    
    // Build the message in Morph's expected format
    // <instruction>...</instruction>\n<code>...</code>\n<update>...</update>
    const messageContent = `<instruction>${input.instructions}</instruction>
<code>${input.originalCode}</code>
<update>${input.codeEdit}</update>`;
    
    const response = await fetch("https://api.morphllm.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MORPH_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "auto",  // Recommended - auto-selects optimal model
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ],
        temperature: 0.0,  // Deterministic for code
        max_tokens: 16000
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Morph] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Morph API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    const mergedCode = data.choices?.[0]?.message?.content;
    
    if (!mergedCode) {
      console.error("[Morph] No merged code in response");
      return {
        success: false,
        error: "No merged code returned from Morph"
      };
    }
    
    // Calculate changes
    const originalLines = input.originalCode.split('\n').length;
    const mergedLines = mergedCode.split('\n').length;
    const linesAdded = Math.max(0, mergedLines - originalLines);
    const linesRemoved = Math.max(0, originalLines - mergedLines);
    
    // Generate UDiff for verification (Morph recommendation: verify after, not before)
    const udiff = generateUDiff(input.originalCode, mergedCode, input.filepath || 'file');
    
    console.log(`[Morph] Success: +${linesAdded} -${linesRemoved} lines`);
    
    return {
      success: true,
      mergedCode,
      changes: {
        linesAdded,
        linesRemoved,
        linesModified: Math.min(linesAdded, linesRemoved)
      },
      udiff,
      model: data.model || "auto",
      tokensUsed: data.usage?.total_tokens
    };
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Morph] Exception: ${errorMessage}`);
    return {
      success: false,
      error: `Morph exception: ${errorMessage}`
    };
  }
}

/**
 * Enhanced search_replace that falls back to Morph Fast Apply
 * when exact string matching fails
 */
export async function smartSearchReplace(
  projectId: string,
  path: string,
  search: string,
  replace: string,
  instructions: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ success: boolean; method: 'exact' | 'morph'; error?: string; changes?: { linesAdded: number; linesRemoved: number } }> {
  
  // First, try exact match (fast path)
  const { data, error: readError } = await supabase
    .from('project_files')
    .select('content')
    .eq('project_id', projectId)
    .eq('path', path)
    .maybeSingle();
  
  if (readError || !data) {
    return { success: false, method: 'exact', error: `File not found: ${path}` };
  }
  
  const currentContent = data.content;
  
  // Try exact match first
  if (currentContent.includes(search)) {
    const newContent = currentContent.replace(search, replace);
    
    const { error: writeError } = await supabase
      .from('project_files')
      .update({ content: newContent })
      .eq('project_id', projectId)
      .eq('path', path);
    
    if (writeError) {
      return { success: false, method: 'exact', error: writeError.message };
    }
    
    return { 
      success: true, 
      method: 'exact',
      changes: {
        linesAdded: replace.split('\n').length,
        linesRemoved: search.split('\n').length
      }
    };
  }
  
  // Exact match failed - try Morph Fast Apply
  console.log(`[SmartReplace] Exact match failed for ${path}, trying Morph Fast Apply...`);
  
  // Convert search/replace to Morph's "// ... existing code ..." format
  // The replace content becomes the code_edit with markers
  const codeEdit = `// ... existing code ...\n${replace}\n// ... existing code ...`;
  
  const morphResult = await morphFastApply({
    originalCode: currentContent,
    codeEdit: codeEdit,
    instructions: instructions || `Replace code in ${path}`,
    filepath: path
  });
  
  if (!morphResult.success || !morphResult.mergedCode) {
    return { 
      success: false, 
      method: 'morph', 
      error: morphResult.error || "Morph merge failed" 
    };
  }
  
  // Write the Morph-merged content
  const { error: writeError } = await supabase
    .from('project_files')
    .update({ content: morphResult.mergedCode })
    .eq('project_id', projectId)
    .eq('path', path);
  
  if (writeError) {
    return { success: false, method: 'morph', error: writeError.message };
  }
  
  return { 
    success: true, 
    method: 'morph',
    changes: morphResult.changes
  };
}

/**
 * Direct Morph edit - for when AI uses "// ... existing code ..." markers
 * This is the preferred edit format for Morph
 * 
 * MORPH BEST PRACTICE: Retry with more context on failure
 * 1. First try with the provided code edit
 * 2. If failed, re-read file and add more surrounding context
 * 3. Simplify complex edits into smaller chunks
 */
export async function morphEditFile(
  projectId: string,
  filepath: string,
  instructions: string,
  codeEdit: string,  // Code with "// ... existing code ..." markers
  supabase: ReturnType<typeof createClient>,
  options?: { maxRetries?: number; contextLines?: number }
): Promise<MorphApplyResult & { filepath: string }> {
  
  const maxRetries = options?.maxRetries ?? 2;
  const baseContextLines = options?.contextLines ?? 5;
  
  // Read current file
  const { data, error: readError } = await supabase
    .from('project_files')
    .select('content')
    .eq('project_id', projectId)
    .eq('path', filepath)
    .maybeSingle();
  
  if (readError) {
    return { success: false, error: readError.message, filepath };
  }
  
  if (!data) {
    return { success: false, error: `File not found: ${filepath}`, filepath };
  }
  
  const originalContent = data.content;
  let lastError: string | undefined;
  let lastUdiff: string | undefined;
  
  // Retry loop with increasing context
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const contextLines = baseContextLines + (attempt * 5); // Increase context each retry
    
    // On retry, try to add more context around the edit
    let enhancedCodeEdit = codeEdit;
    if (attempt > 0) {
      console.log(`[MorphEdit] Retry ${attempt}/${maxRetries} with ${contextLines} context lines`);
      enhancedCodeEdit = addContextToEdit(originalContent, codeEdit, contextLines);
    }
    
    // Call Morph Fast Apply
    const morphResult = await morphFastApply({
      originalCode: originalContent,
      codeEdit: enhancedCodeEdit,
      instructions: attempt > 0 
        ? `${instructions} (Retry ${attempt}: providing more context)`
        : instructions,
      filepath
    });
    
    if (morphResult.success && morphResult.mergedCode) {
      // Verify the merge looks reasonable (basic sanity check)
      const originalLines = originalContent.split('\n').length;
      const mergedLines = morphResult.mergedCode.split('\n').length;
      const lineDiff = Math.abs(mergedLines - originalLines);
      
      // If the change is too drastic (>50% of file), warn but still apply
      if (lineDiff > originalLines * 0.5) {
        console.warn(`[MorphEdit] Large change detected: ${lineDiff} lines diff (${Math.round(lineDiff/originalLines*100)}% of file)`);
      }
      
      // Write merged content
      const { error: writeError } = await supabase
        .from('project_files')
        .update({ content: morphResult.mergedCode })
        .eq('project_id', projectId)
        .eq('path', filepath);
      
      if (writeError) {
        return { success: false, error: writeError.message, filepath };
      }
      
      return { 
        ...morphResult, 
        filepath,
        retryAttempt: attempt,
        contextLines
      };
    }
    
    // Store error for potential return
    lastError = morphResult.error;
    lastUdiff = morphResult.udiff;
    
    // If this was the last attempt, break
    if (attempt === maxRetries) {
      break;
    }
    
    // Small delay before retry
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // All retries failed - return with UDiff for debugging
  return { 
    success: false, 
    error: `Edit failed after ${maxRetries + 1} attempts: ${lastError}`,
    udiff: lastUdiff,
    filepath,
    retryAttempt: maxRetries
  };
}

/**
 * Add more context lines around the edit markers
 * This helps Morph understand where to place the changes
 */
function addContextToEdit(originalContent: string, codeEdit: string, contextLines: number): string {
  const lines = originalContent.split('\n');
  const editLines = codeEdit.split('\n');
  
  // Find non-marker lines in the edit
  const significantLines = editLines.filter(line => 
    !line.includes('// ... existing code ...') && 
    line.trim().length > 0
  );
  
  if (significantLines.length === 0) {
    return codeEdit;
  }
  
  // Try to find where these lines might go in the original
  const firstSignificant = significantLines[0].trim();
  let matchIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(firstSignificant) || 
        (firstSignificant.length > 10 && lines[i].trim().startsWith(firstSignificant.substring(0, 10)))) {
      matchIndex = i;
      break;
    }
  }
  
  if (matchIndex >= 0) {
    // Add context before and after
    const startIdx = Math.max(0, matchIndex - contextLines);
    const endIdx = Math.min(lines.length, matchIndex + contextLines);
    
    const contextBefore = lines.slice(startIdx, matchIndex).join('\n');
    const contextAfter = lines.slice(matchIndex + 1, endIdx).join('\n');
    
    // Rebuild edit with more context
    return `// ... existing code ...\n${contextBefore}\n${codeEdit}\n${contextAfter}\n// ... existing code ...`;
  }
  
  return codeEdit;
}

export interface EditIntent {
  type: EditIntentType;
  confidence: number;
  targetHint?: string;
  description: string;
}

/**
 * Analyze user prompt to determine what kind of edit they want
 */
export function analyzeEditIntent(prompt: string): EditIntent {
  const lower = prompt.toLowerCase();
  
  // Question patterns - no edit needed
  const questionPatterns = [
    /^(what|how|why|can you explain|tell me|show me|describe)/i,
    /\?$/,
    /^(is it|are there|does it|do you)/i
  ];
  for (const pattern of questionPatterns) {
    if (pattern.test(prompt) && !lower.includes('change') && !lower.includes('add') && !lower.includes('fix')) {
      return { type: 'QUESTION', confidence: 0.8, description: 'User is asking a question, may not need edits' };
    }
  }
  
  // Full rebuild patterns
  if (/start\s+over|from\s+scratch|rebuild\s+(the\s+)?app|new\s+app|recreate\s+everything/i.test(lower)) {
    return { type: 'FULL_REBUILD', confidence: 0.9, description: 'User wants to rebuild the entire app' };
  }
  
  // Add feature patterns
  const addPatterns = [
    { pattern: /add\s+(a\s+)?new\s+(\w+)\s+(page|section|feature|component)/i, hint: 'new $2' },
    { pattern: /create\s+(a\s+)?(\w+)\s+(page|section|feature|component)/i, hint: 'new $2' },
    { pattern: /add\s+(\w+)\s+to\s+(?:the\s+)?(\w+)/i, hint: '$1 to $2' },
    { pattern: /add\s+(?:a\s+)?(\w+)\s+(?:component|section|button|link)/i, hint: 'new $1' },
    { pattern: /include\s+(?:a\s+)?(\w+)/i, hint: '$1' },
    { pattern: /put\s+(.+?)\s+(?:in|on|to)\s+(?:the\s+)?(\w+)/i, hint: '$1 in $2' },
  ];
  for (const { pattern, hint } of addPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const targetHint = hint.replace(/\$(\d)/g, (_, n) => match[parseInt(n)] || '');
      return { type: 'ADD_FEATURE', confidence: 0.85, targetHint, description: `Add new feature: ${targetHint}` };
    }
  }
  
  // Fix issue patterns
  if (/fix\s+(the\s+)?(\w+|error|bug|issue|problem)|resolve\s+(the\s+)?error|debug|repair|broken|not\s+working/i.test(lower)) {
    return { type: 'FIX_ISSUE', confidence: 0.9, description: 'User wants to fix an issue or error' };
  }
  
  // Style update patterns
  if (/change\s+(the\s+)?(color|theme|style|styling|css|background|font)|make\s+it\s+(dark|light|blue|red|green|bigger|smaller)|style\s+(the\s+)?(\w+)/i.test(lower)) {
    return { type: 'UPDATE_STYLE', confidence: 0.85, description: 'User wants to update styling/appearance' };
  }
  
  // Update component patterns
  const updatePatterns = [
    /update\s+(the\s+)?(\w+)\s+(component|section|page)/i,
    /change\s+(the\s+)?(\w+)/i,
    /modify\s+(the\s+)?(\w+)/i,
    /edit\s+(the\s+)?(\w+)/i,
    /remove\s+.*\s+(button|link|text|element|section)/i,
    /delete\s+.*\s+(button|link|text|element|section)/i,
    /hide\s+.*\s+(button|link|text|element|section)/i,
  ];
  for (const pattern of updatePatterns) {
    if (pattern.test(lower)) {
      const match = lower.match(pattern);
      const targetHint = match ? match[2] || match[1] : undefined;
      return { type: 'UPDATE_COMPONENT', confidence: 0.8, targetHint, description: `Update existing component: ${targetHint || 'unknown'}` };
    }
  }
  
  // Refactor patterns
  if (/refactor|clean\s+up|reorganize|optimize|simplify/i.test(lower)) {
    return { type: 'REFACTOR', confidence: 0.75, description: 'User wants to refactor/clean up code' };
  }
  
  // Add dependency patterns
  if (/install\s+(\w+)|add\s+(\w+)\s+(package|library|dependency)|use\s+(\w+)\s+(library|framework)/i.test(lower)) {
    return { type: 'ADD_DEPENDENCY', confidence: 0.85, description: 'User wants to add a package/dependency' };
  }
  
  // Default - assume it's an update request
  return { type: 'UNKNOWN', confidence: 0.3, description: 'Could not determine intent - will analyze files' };
}

// ============================================================================
// 🔒 POST-EDIT SYNTAX VALIDATION - Catch broken code before saving
// ============================================================================

/**
 * Basic syntax validation for JS/JSX/TS/TSX files
 * Checks for common syntax errors that would break the preview
 */
function validateBasicSyntax(content: string, filePath: string): { valid: boolean; error?: string } {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const isJSX = ['jsx', 'tsx'].includes(ext);
  const isJS = ['js', 'ts', 'jsx', 'tsx', 'mjs'].includes(ext);
  
  if (!isJS) return { valid: true }; // Only validate JS/TS files
  
  // Check 1: Balanced brackets/braces/parens
  const brackets: { [key: string]: string } = { '(': ')', '[': ']', '{': '}' };
  const closers: { [key: string]: string } = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inComment = false;
  let inMultiComment = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prev = i > 0 ? content[i - 1] : '';
    const next = i < content.length - 1 ? content[i + 1] : '';
    
    // Skip escaped characters in strings
    if (inString && prev === '\\') continue;
    
    // Handle string boundaries
    if (!inComment && !inMultiComment) {
      if ((char === '"' || char === "'" || char === '`') && !inString) {
        inString = true;
        stringChar = char;
        if (char === '`') inTemplate = true;
        continue;
      }
      if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
        inTemplate = false;
        continue;
      }
    }
    
    // Skip string content
    if (inString) continue;
    
    // Handle comments
    if (char === '/' && next === '/' && !inMultiComment) {
      inComment = true;
      continue;
    }
    if (char === '\n' && inComment) {
      inComment = false;
      continue;
    }
    if (char === '/' && next === '*' && !inComment) {
      inMultiComment = true;
      continue;
    }
    if (char === '*' && next === '/' && inMultiComment) {
      inMultiComment = false;
      i++; // Skip the /
      continue;
    }
    if (inComment || inMultiComment) continue;
    
    // Track brackets
    if (brackets[char]) {
      stack.push(char);
    } else if (closers[char]) {
      const expected = closers[char];
      const last = stack.pop();
      if (last !== expected) {
        return { 
          valid: false, 
          error: `Unbalanced brackets: Found '${char}' but expected '${brackets[last || '(']}' at position ${i}` 
        };
      }
    }
  }
  
  if (stack.length > 0) {
    const unclosed = stack.map(b => brackets[b]).join(', ');
    return { valid: false, error: `Unclosed brackets: Missing ${unclosed}` };
  }
  
  // Check 2: JSX-specific - unclosed tags (basic check)
  if (isJSX) {
    // Check for obviously broken JSX like <div> without </div> or />
    const tagPattern = /<([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9-]*)\s*[^>]*(?<!\/|-)>/gi;
    const selfClosingPattern = /<([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9-]*)\s*[^>]*\/>/gi;
    const closingPattern = /<\/([A-Z][a-zA-Z0-9]*|[a-z][a-z0-9-]*)>/gi;
    
    // This is a simplified check - just ensure we don't have obvious issues
    const openTags = (content.match(tagPattern) || []).length;
    const selfClosing = (content.match(selfClosingPattern) || []).length;
    const closeTags = (content.match(closingPattern) || []).length;
    
    // Very rough heuristic: open tags should roughly equal close tags + self-closing
    // Allow some tolerance for fragments and complex JSX
    const diff = Math.abs(openTags - selfClosing - closeTags);
    if (diff > openTags * 0.5 && diff > 5) {
      return { valid: false, error: `Possible unclosed JSX tags: ${openTags} opening, ${closeTags} closing, ${selfClosing} self-closing` };
    }
  }
  
  // Check 3: Common syntax errors
  const syntaxPatterns = [
    { pattern: /\)\s*{[^}]*\)\s*{/g, error: 'Possible duplicate opening braces' },
    { pattern: /}\s*}\s*}/g, error: 'Possible extra closing braces' },
    { pattern: /,\s*,/g, error: 'Double comma found' },
    { pattern: /\(\s*\)/g, error: null }, // Empty parens are OK
    { pattern: /=\s*=\s*=/g, error: 'Triple equals without spaces (===) is fine, but found malformed comparison' },
  ];
  
  for (const { pattern, error } of syntaxPatterns) {
    if (error && pattern.test(content)) {
      // Double-check it's not in a string
      const match = content.match(pattern);
      if (match) {
        return { valid: false, error };
      }
    }
  }
  
  return { valid: true };
}

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
  // 🔍 WARP GREP - AI-powered intelligent code search (Morph)
  {
    name: "warp_grep",
    description: "AI-POWERED code search using Morph Warp Grep. Use natural language to find code. BEST for: complex searches, finding where features are implemented, understanding code flow. Example: 'Find where user authentication is handled' or 'Where is the login button click handler?'",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Natural language description of what code to find. Be specific about what you're looking for." 
        }
      },
      required: ["query"]
    }
  },
  // 🚀 SEARCH AND REPLACE - Targeted edits like Lovable uses!
  {
    name: "search_replace",
    description: "BACKUP edit tool. Exact string replacement - use ONLY when morph_edit fails or for very simple 1-line changes. Requires EXACT match including whitespace.",
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
  // 🚀 MORPH EDIT - Intelligent code merging powered by Morph LLM (10,500+ tok/sec)
  // Use this when you want to show partial code changes with "// ... existing code ..." markers
  {
    name: "morph_edit",
    description: "⭐ PRIMARY EDIT TOOL - USE THIS FIRST! Intelligent code merging powered by Morph AI. Use '// ... existing code ...' markers for unchanged sections. Handles fuzzy matching, doesn't need exact strings. ALWAYS prefer this over search_replace! Example: '// ... existing code ...\\nfunction newCode() { }\\n// ... existing code ...'",
    parameters: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "File path like /App.js" 
        },
        instructions: { 
          type: "string", 
          description: "Brief first-person description of what you're changing (e.g., 'I will add null check to login function')" 
        },
        code_edit: { 
          type: "string", 
          description: "Code with '// ... existing code ...' markers for unchanged sections. Show only what changes." 
        }
      },
      required: ["path", "instructions", "code_edit"]
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
// Updated with "BRICK FOUNDATION + LEGO FREEDOM" philosophy
export const AGENT_SYSTEM_PROMPT = `You are WAKTI AI Coder - a master coder that works LIKE LOVABLE and THINKS LIKE CASCADE.

# 🧱 THE LEGO PHILOSOPHY (UNDERSTAND THIS FIRST!)

You are building with Lego blocks, not from scratch:

## THE FOUNDATION (Already Built For You)
- **Pre-configured Backend:** The user's mini-backend is ALREADY connected. No setup needed.
- **Building Blocks:** Collections like products, services, reviews, orders are READY TO USE.
- **Zero Config:** No API keys, no environment variables, no Supabase setup. It just works.

## YOUR FREEDOM (Build Any House)
- The foundation is set, but you can build ANY kind of "house" on top.
- Use the bricks (pre-configured collections) OR create custom ones.
- Design ANY UI: Bento grids, Glassmorphism, split screens, magazine layouts.
- The user is the architect. You are the master builder.

## THE GOLDEN RULE
**Always use the backend.** Never hardcode data. The backend is there—use it!
- Need products? → Fetch from collection/products
- Need bookings? → Fetch from collection/services + booking/create
- Need custom data? → Create a new collection on the fly

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
| BACKEND FEATURE | Use existing bricks + API contracts | "Add a shop" |

## 📋 THE OATH (NEVER BREAK)

- I will not guess.
- I will not say "done" unless it is truly done.
- I will connect every new thing I create.
- I will never create dead/orphan files.
- If it's not imported and rendered, it doesn't exist.
- **I will ALWAYS fetch data from the backend, never hardcode.**
- **I will PROACTIVELY initialize backend collections when building features that need data.**

## 🚀 PROACTIVE BACKEND INITIALIZATION (AUTO-PILOT)

When building features that involve data (shops, bookings, contacts, etc.), I MUST:

1. **DETECT INTENT**: If user mentions shop/store/products → needs "products" collection
   - "Add a shop" → products, categories, orders
   - "Contact form" → messages/inquiries collection
   - "Booking system" → bookings collection
   - "Menu/Restaurant" → menu_items, categories
   - "Portfolio/Gallery" → projects/gallery_items
   - "Blog" → posts, categories
   - "Testimonials" → testimonials collection

2. **AUTO-CREATE COLLECTIONS**: Use backend_cli to silently create required collections:
   \`\`\`
   backend_cli({ command: "listCollections" })  // Check what exists
   backend_cli({ command: "createCollection", collection: "products", data: { name: "Sample Product", price: 99, description: "..." } })
   \`\`\`

3. **CONNECT UI TO BACKEND**: The UI I create MUST fetch from these collections, never hardcode:
   \`\`\`javascript
   // ✅ CORRECT - Fetch from backend
   const response = await fetch(\`\${BACKEND_URL}/api/collections/products\`);
   const products = await response.json();
   
   // ❌ WRONG - Hardcoded data
   const products = [{ name: "Product 1", price: 99 }];
   \`\`\`

4. **INFORM USER**: After auto-creating, tell the user:
   "I've set up your [products/bookings/etc] database. You can manage items in the Backend tab."

**COLLECTION MAPPING (Auto-detect from user intent):**
| User Says | Collections to Create |
|-----------|----------------------|
| shop, store, e-commerce, products | products, categories, orders |
| booking, appointment, schedule | bookings, services |
| contact, inquiry, message | messages |
| menu, restaurant, food | menu_items, categories |
| blog, articles, posts | posts, categories |
| gallery, portfolio, showcase | gallery_items |
| testimonials, reviews | testimonials |
| pricing, plans | pricing_plans |
| team, staff, members | team_members |
| FAQ, questions | faqs |

## 🔥 CORE RULES (8 GOLDEN RULES)

1. **Search → Read → Edit.** Never edit without reading first.
2. **No orphan files.** If you create it, import and render it.
3. **New pages = route + nav link.** Always. No hidden pages.
4. **Small edits = search_replace.** Never write_file for small changes.
5. **Verify before "done".** If you can't prove it, don't claim it.
6. **Questions = answer only.** No file edits for questions.
7. **Check if component exists inline** before creating new file.
8. **Edit inline code** if it already exists (don't create duplicate files).

## 📚 EDIT STRATEGY EXAMPLES (LEARN FROM THESE!)

### Example 1: Update Header Color
USER: "Make the header background black"

CORRECT APPROACH:
1. grep_search for "Header" or "header" or "bg-"
2. read_file the Header component
3. search_replace ONLY the background class

INCORRECT APPROACH:
- Regenerating entire App.js
- Creating new Header.jsx from scratch
- Modifying unrelated files

### Example 2: Add New Page
USER: "Add a videos page"

CORRECT APPROACH:
1. Create Videos.jsx component
2. Update routing in App.js
3. Add navigation link in Header

INCORRECT APPROACH:
- Regenerating entire application
- Recreating all existing pages

### Example 3: Fix Styling Issue
USER: "Fix the button styling on mobile"

CORRECT APPROACH:
1. grep_search for the button text or class
2. read_file to see full context
3. search_replace to add responsive classes (sm:, md:)

INCORRECT APPROACH:
- Regenerating all components
- Creating new CSS files
- Modifying global styles unnecessarily

### Example 4: Add Feature to Component
USER: "Add a search bar to the header"

CORRECT APPROACH:
1. read_file Header.jsx
2. search_replace to add search input
3. Preserve all existing header content

INCORRECT APPROACH:
- Creating Header.jsx from scratch
- Losing existing navigation/branding

### Example 5: Add New Component
USER: "Add a newsletter signup to the footer"

CORRECT APPROACH:
1. Create Newsletter.jsx component
2. read_file Footer.jsx
3. search_replace to import and add <Newsletter />

INCORRECT APPROACH:
- Recreating Footer from scratch
- Not importing the new component

### Example 6: Remove Element
USER: "Remove the deploy button"

CORRECT APPROACH:
1. grep_search for "deploy" to find exact location
2. read_file to see the button code
3. search_replace to remove ONLY that button

INCORRECT APPROACH:
- Creating a new file
- Editing multiple files
- Redesigning the entire section

### Example 7: Change Single Style (CRITICAL!)
USER: "Update the hero to bg blue"

CORRECT APPROACH:
1. grep_search for "hero" or "Hero"
2. read_file Hero.jsx
3. Find: className="... bg-gray-900 ..."
4. search_replace ONLY: bg-gray-900 → bg-blue-500
5. EVERYTHING ELSE stays EXACTLY the same!

**BEFORE:**
\`\`\`jsx
<div className="w-full bg-gray-900 text-white py-20 px-4">
\`\`\`

**AFTER:**
\`\`\`jsx
<div className="w-full bg-blue-500 text-white py-20 px-4">
\`\`\`

NOTICE: Only bg-gray-900 changed to bg-blue-500. Nothing else!

### Key Principles (MEMORIZE THESE!)
1. **Minimal Changes** - Only modify what's necessary
2. **Preserve Functionality** - Keep all existing features
3. **Respect Structure** - Follow existing patterns
4. **Target Precision** - Edit specific files, not everything
5. **Context Awareness** - Use imports/exports to understand relationships

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

## ✏️ EDITING RULES - MORPH FIRST!

| Change Size | Tool |
|-------------|------|
| ANY edit to existing file | ⭐ morph_edit (PRIMARY) |
| Simple 1-line change | search_replace (backup) |
| New file only | write_file |
| Rewrite >50% | write_file |

**⭐ ALWAYS try morph_edit FIRST - it handles fuzzy matching!**

## 🔒 MORPH-ONLY ENFORCEMENT (SURGICAL EDITS)

**For files under 500 lines, write_file is FORBIDDEN for edits.**

The system will REJECT write_file calls on existing files under 500 lines.
You MUST use morph_edit for ALL changes to existing files.

Why? Morph Fast Apply (10,500+ tok/sec) makes surgical edits that:
- Only touch the lines you need to change
- Preserve all existing code perfectly
- Handle fuzzy matching (no exact string needed)
- Are 10x faster than full rewrites

**ENFORCEMENT RULES:**
1. File exists + under 500 lines → morph_edit ONLY
2. File exists + over 500 lines + changing >50% → write_file allowed
3. File doesn't exist → write_file (new file creation)
4. Any edit attempt with write_file on small files → BLOCKED

**If morph_edit fails, try search_replace as backup. NEVER jump to write_file.**

## ✅ VERIFY BEFORE "DONE"

- ✅ File exists
- ✅ Change is visible
- ✅ File is imported and used
- ✅ No dead files created
- ✅ UI shows the change
- ✅ Route + nav done (if page)

## MORPH DOCS WORKFLOW: SEARCH → READ → EDIT → VERIFY (MANDATORY!)

**This workflow is ENFORCED by the system. Skipping steps will cause your edits to be BLOCKED.**

## TOOL NAME MAPPING (DOCS → WAKTI AI CODER)

- **codebase_search** → **grep_search** (use list_files for discovery if needed)
- **read_file** → **read_file**
- **edit_file** → **morph_edit**
- **list_dir** → **list_files**

**Same workflow, different tool names. Results are the same.**

### Step 1: SEARCH - Find the code
\`\`\`
grep_search({ query: "button color" })  // Find where the code lives
\`\`\`

### Step 2: READ - Understand the structure (REQUIRED before editing!)
\`\`\`
read_file({ path: "/App.js" })  // Get full context - BLOCKED if you skip this!
\`\`\`

### Step 3: ✏️ EDIT - Make precise changes with morph_edit
\`\`\`
morph_edit({
  path: "/App.js",
  instructions: "I will change the button color from blue to red",
  code_edit: "// ... existing code ...\\n<button className=\\"bg-red-500\\">\\n// ... existing code ..."
})
\`\`\`

### Step 4: ✅ VERIFY - Confirm the change worked (REQUIRED!)
\`\`\`
read_file({ path: "/App.js" })  // Read again to confirm your edit applied correctly
\`\`\`

### Step 5: 🏁 COMPLETE - Only after verification
\`\`\`
task_complete({ summary: "Changed button color to red in App.js" })
\`\`\`

**⭐ morph_edit is your PRIMARY tool - use it for ALL edits!**
**🚫 search_replace is BACKUP only - use when morph_edit fails**

## ⚠️ CRITICAL RULES - NEVER BREAK THESE

1. **NEVER GUESS** - If you don't know, read the file first
2. **NEVER CHANGE UNRELATED CODE** - Only touch what the user asked for
3. **NEVER ASSUME FILE CONTENTS** - Always read_file before editing
4. **NEVER SKIP THE PLAN** - State your plan before first edit
5. **NEVER IGNORE USER INSTRUCTIONS** - Follow exactly what they said
6. **NEVER MAKE UP IMPORTS** - Check what imports already exist
7. **NEVER BREAK WORKING CODE** - If it works, don't touch it unless asked
8. **NEVER WRITE CUSTOM EMAIL REGEX** - Always use validateEmail from /src/utils/validations.ts

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
- **Change button color?** → Use morph_edit with '// ... existing code ...' markers
- **Fix a bug?** → Use morph_edit for intelligent merge
- **Add new function?** → Use morph_edit or insert_code
- **Create new file?** → Use write_file ONLY for new files

## 📝 MORPH_EDIT PATTERNS (CRITICAL - FOLLOW THESE!)

**Pattern 1: Delete a section (keep surrounding code):**
\`\`\`
// ... existing code ...
function keepThis() {
  return "stay";
}

function alsoKeepThis() {
  return "also stay";
}
// ... existing code ...
\`\`\`

**Pattern 2: Add imports:**
\`\`\`
import { useState, useEffect } from "react";
import { calculateTax } from "./utils"; // New import
// ... existing code ...
\`\`\`

**Pattern 3: Add error handling:**
\`\`\`
// ... existing code ...
function divide(a, b) {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
}
// ... existing code ...
\`\`\`

**Pattern 4: Update function:**
\`\`\`
// ... existing code ...
function authenticateUser(email, password) {
  const result = await verifyUser(email, password);
  if (result) {
    return "Authenticated";
  }
  return "Unauthenticated";
}
// ... existing code ...
\`\`\`

**Pattern 5: Add new method to class:**
\`\`\`
// ... existing code ...
class UserService {
  async getUser(id) {
    return await this.db.findUser(id);
  }

  async updateUser(id, data) {
    return await this.db.updateUser(id, data);
  }
}
// ... existing code ...
\`\`\`

**⚠️ COMMON MISTAKES TO AVOID:**
\`\`\`
// ❌ WRONG - missing context markers
function newFunction() {
  return "hello";
}

// ✅ CORRECT - with context markers
// ... existing code ...
function newFunction() {
  return "hello";
}
// ... existing code ...
\`\`\`

## 📤 OUTPUT FORMAT FOR EDITS (CRITICAL!)

When making edits, you can ALSO output \`<edit>\` blocks for complex changes. This enables Morph Fast Apply:

\`\`\`xml
<edit target_file="/App.js">
<instructions>Add a Products link to the navigation header</instructions>
<update>
// ... existing code ...
<nav className="flex gap-4">
  <a href="/">Home</a>
  <a href="/products">Products</a>
  <a href="/contact">Contact</a>
</nav>
// ... existing code ...
</update>
</edit>
\`\`\`

**Rules for \`<edit>\` blocks:**
1. \`target_file\` must be the exact file path (e.g., "/App.js", "/components/Header.jsx")
2. \`<instructions>\` describes what you're changing (first-person, clear)
3. \`<update>\` contains code with \`// ... existing code ...\` markers for unchanged parts
4. You can output multiple \`<edit>\` blocks for multiple files
5. The system will use Morph AI to intelligently merge your changes

## YOUR TOOLS (PRIORITIZED BY EFFICIENCY)

1. **grep_search** ⭐⭐ FIRST - Search ALL files for text/code. Use this FIRST to find where code lives!
2. **read_file** ⭐ - Read file AFTER grep_search finds it. MANDATORY before any edit!
3. **morph_edit** ⭐⭐⭐ PRIMARY EDIT - Intelligent code merge with Morph AI. Use '// ... existing code ...' markers!
4. **search_replace** - BACKUP only - Exact string match (use if morph_edit fails)
5. **insert_code** - Add new code after a specific location
6. **list_files** - See project structure
7. **write_file** - ONLY for NEW files or complete rewrites (>50% changes)
8. **delete_file** - Remove files
9. **warp_grep** - AI-powered code search (natural language)
10. **get_console_logs** - Debug runtime issues
11. **get_network_errors** - Debug API calls
12. **get_runtime_errors** - See all errors
13. **query_collection** - Query backend data
14. **get_project_info** - Get project metadata
15. **task_complete** - Call when DONE (MUST verify changes first!)

## YOUR WORKFLOW (LIKE CASCADE) ⭐ CRITICAL

1. **GREP FIRST**: Use grep_search to find where the code/text lives
2. **READ FILE**: Use read_file to see full context of the file
3. **STATE PLAN**: Tell user what you will do before doing it
4. **MORPH_EDIT**: Use morph_edit with '// ... existing code ...' markers (PRIMARY!)
5. **VERIFY**: Re-read the file to confirm your change worked!
6. **DONE**: Call task_complete with summary

**⭐ morph_edit is powered by Morph AI - it handles fuzzy matching and doesn't need exact strings!**
**⚠️ ENFORCEMENT: The system tracks if you read files before editing. If you edit without reading first, you will get a warning.**

## ⚠️ TOOL SELECTION RULES - CRITICAL

**WHEN TO USE EACH TOOL:**

| Situation | Tool to Use | Why |
|-----------|-------------|-----|
| ANY edit to existing file | ⭐ morph_edit | PRIMARY - handles fuzzy matching! |
| Simple 1-line change | search_replace | Backup if morph_edit fails |
| Add new code to existing file | morph_edit or insert_code | morph_edit preferred |
| Create NEW file | write_file | File doesn't exist yet |
| Rewrite >50% of file | write_file | Too many changes |
| Fix a bug | morph_edit | Intelligent merge |
| Add an import | morph_edit or insert_code | morph_edit preferred |

**🚫 NEVER USE write_file FOR:**
- Changing button colors, text, or styles
- Fixing small bugs
- Adding/removing a few lines
- Updating function logic
- Any change under 50% of file

**⭐ Use morph_edit for ALL edits to existing files - it's powered by Morph AI!**

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
- "Change the button color" → Use morph_edit (PRIMARY)
- "Fix the header" → Use morph_edit (PRIMARY)
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

## 🔒 MANDATORY: morph_edit OVER write_file

**You MUST use morph_edit (PRIMARY) instead of write_file when:**
- The file already exists
- You're changing less than 50% of the file
- You're fixing a bug
- You're updating styles, text, or small logic

**write_file is ONLY for:**
- Creating a brand NEW file that doesn't exist
- Complete rewrites (>50% of file changes)

**morph_edit uses Morph AI (10,500+ tok/sec) for intelligent code merging - it handles fuzzy matching!**
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
    
    // 🚀 GREP SEARCH - Enhanced with context like Open Lovable's file-search-executor
    case "grep_search": {
      const query = args.query || "";
      const filePattern = args.filePattern || "";
      const includeContext = args.includeContext !== false; // Default true
      
      if (!query) {
        return { error: "grep_search: 'query' parameter is required" };
      }
      
      console.log(`[Agent] grep_search: query="${query}", filePattern="${filePattern}", context=${includeContext}`);
      
      // Get all files from project
      const { data: allFiles, error } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      
      if (error) {
        console.error(`[Agent] grep_search error:`, error);
        return { error: `Failed to search files: ${error.message}` };
      }
      
      // Enhanced result type with context (like Open Lovable's SearchResult)
      interface SearchMatch {
        file: string;
        line: number;
        content: string;
        contextBefore?: string[];  // 3 lines before
        contextAfter?: string[];   // 3 lines after
        confidence: 'high' | 'medium' | 'low';
      }
      
      const results: SearchMatch[] = [];
      const queryLower = query.toLowerCase();
      
      for (const file of (allFiles || [])) {
        // Filter by file pattern if specified
        if (filePattern && !file.path.endsWith(filePattern)) {
          continue;
        }
        
        const lines = (file.content || "").split('\n');
        for (let i = 0; i < lines.length; i++) {
          const lineLower = lines[i].toLowerCase();
          if (lineLower.includes(queryLower)) {
            // Calculate confidence based on match quality
            let confidence: 'high' | 'medium' | 'low' = 'medium';
            if (lines[i].includes(query)) {
              confidence = 'high'; // Exact case match
            } else if (lineLower.includes(queryLower) && query.length > 10) {
              confidence = 'high'; // Long query match
            }
            
            const match: SearchMatch = {
              file: file.path,
              line: i + 1,
              content: lines[i].trim().substring(0, 200),
              confidence
            };
            
            // Add surrounding context (3 lines before/after) like Open Lovable
            if (includeContext) {
              match.contextBefore = [];
              match.contextAfter = [];
              
              // 3 lines before
              for (let j = Math.max(0, i - 3); j < i; j++) {
                match.contextBefore.push(lines[j].trim().substring(0, 150));
              }
              
              // 3 lines after
              for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
                match.contextAfter.push(lines[j].trim().substring(0, 150));
              }
            }
            
            results.push(match);
          }
        }
      }
      
      console.log(`[Agent] grep_search: Found ${results.length} matches for "${query}"`);
      
      // Sort by confidence (high first)
      results.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.confidence] - order[b.confidence];
      });
      
      // Limit results to prevent token overflow
      const limitedResults = results.slice(0, 30); // Reduced limit since we have more data per result
      
      // Group by file for better overview
      const fileGroups = new Map<string, number>();
      for (const r of results) {
        fileGroups.set(r.file, (fileGroups.get(r.file) || 0) + 1);
      }
      
      return { 
        query,
        matches: limitedResults,
        totalMatches: results.length,
        truncated: results.length > 30,
        fileBreakdown: Object.fromEntries(fileGroups),
        summary: results.length === 0 
          ? `No matches found for "${query}"` 
          : `Found ${results.length} match(es) in ${fileGroups.size} file(s). Top files: ${[...fileGroups.entries()].slice(0, 3).map(([f, c]) => `${f}(${c})`).join(', ')}`,
        hint: results.length > 0 
          ? `Use read_file on "${results[0].file}" to see full context before editing.`
          : `Try a different search term or check file names with list_files.`
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
    
    // 🔍 WARP GREP - AI-powered intelligent code search (Morph)
    case "warp_grep": {
      const query = args.query || "";
      
      if (!query) {
        return { error: "warp_grep: 'query' parameter is required" };
      }
      
      console.log(`[Agent] warp_grep called: query="${query.substring(0, 50)}..."`);
      
      // Get all files from project
      const { data: allFilesData, error: filesError } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', projectId);
      
      if (filesError) {
        console.error(`[Agent] warp_grep files error:`, filesError);
        return { error: `Failed to get files: ${filesError.message}` };
      }
      
      // Build files map
      const filesMap: Record<string, string> = {};
      for (const file of (allFilesData || [])) {
        filesMap[file.path] = file.content || '';
      }
      
      // Call Morph Warp Grep
      const result = await morphWarpGrep(query, projectId, filesMap, supabase);
      
      if (!result.success) {
        console.error(`[Agent] warp_grep FAILED: ${result.error}`);
        return { 
          error: result.error,
          suggestion: "Try using grep_search with specific keywords instead."
        };
      }
      
      console.log(`[Agent] warp_grep SUCCESS: found ${result.files.length} files in ${result.turnsUsed} turns`);
      
      // Format results for the AI
      const formattedResults = result.files.map(f => ({
        path: f.path,
        lines: f.lines,
        preview: f.content?.substring(0, 500) || 'Content not available'
      }));
      
      return {
        success: true,
        thinking: result.thinking,
        files: formattedResults,
        turnsUsed: result.turnsUsed,
        hint: "Use read_file to see full content, then search_replace or morph_edit to make changes."
      };
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
      
      // 🔒 POST-EDIT SYNTAX VALIDATION - Catch broken code BEFORE saving
      const syntaxCheck = validateBasicSyntax(newContent, path);
      if (!syntaxCheck.valid) {
        console.error(`[Agent] search_replace BLOCKED: Syntax error detected in ${path}`);
        console.error(`[Agent] Syntax error: ${syntaxCheck.error}`);
        return { 
          error: `BLOCKED: Your replacement code has a syntax error: ${syntaxCheck.error}. ` +
            `The edit was NOT applied. Please fix the syntax and try again.`,
          syntaxError: syntaxCheck.error,
          blocked: true,
          hint: 'Check for missing brackets, unclosed tags, or malformed code in your replacement.'
        };
      }
      
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
    
    // 🚀 MORPH EDIT - Intelligent code merging powered by Morph LLM
    case "morph_edit": {
      const path = normalizeFilePath(args.path || "");
      const instructions = args.instructions || "";
      const codeEdit = args.code_edit || "";
      
      if (!codeEdit) {
        return { error: "morph_edit: 'code_edit' parameter is required" };
      }
      
      if (!instructions) {
        return { error: "morph_edit: 'instructions' parameter is required (helps Morph understand the change)" };
      }
      
      console.log(`[Agent] morph_edit called: path=${path}, instructions=${instructions.substring(0, 50)}...`);
      
      // Use the morphEditFile function
      const result = await morphEditFile(projectId, path, instructions, codeEdit, supabase);
      
      if (!result.success) {
        console.error(`[Agent] morph_edit FAILED: ${result.error}`);
        return { 
          error: result.error,
          suggestion: "If Morph fails, try using search_replace with exact code from read_file."
        };
      }
      
      console.log(`[Agent] morph_edit SUCCESS: ${path} (method: Morph Fast Apply)`);
      
      return { 
        success: true, 
        path,
        method: 'morph',
        model: result.model,
        changes: result.changes,
        tokensUsed: result.tokensUsed
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

// Agent result interface - Enhanced for Phase 5: Better debugging + Premium Upgrades
export interface AgentResult {
  success: boolean;
  summary: string;
  filesChanged: string[];
  iterations: number;
  toolCalls: Array<{ tool: string; result: unknown }>;
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
  // 🎯 Premium Upgrades (9/10+ features)
  changeReport?: ChangeReport;           // UPGRADE #1: Human-readable "What Changed" report
  multiFileGuardrail?: MultiFileGuardrail; // UPGRADE #2: Multi-file safety checks
  smokeTestResult?: SmokeTestResult;     // UPGRADE #3: Quick lint/syntax validation
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

// ============================================================================
// 🎯 UPGRADE #1: AUTO "EXPLAIN WHAT CHANGED" REPORT
// Generates a human-readable summary of all changes made during agent session
// ============================================================================

export interface ChangeReportEntry {
  file: string;
  action: 'created' | 'modified' | 'deleted';
  description: string;
  linesChanged?: number;
  keyChanges?: string[];
}

export interface ChangeReport {
  title: string;
  summary: string;
  changes: ChangeReportEntry[];
  totalFilesChanged: number;
  warnings?: string[];
}

/**
 * Generate a human-readable "What Changed" report from tool call logs
 * This solves the user trust issue: "What did it actually do?"
 */
export function generateChangeReport(
  toolCallsLog: Array<{ tool: string; args: Record<string, unknown>; result: Record<string, unknown> }>,
  userPrompt: string
): ChangeReport {
  const changes: ChangeReportEntry[] = [];
  const filesProcessed = new Set<string>();
  
  for (const tc of toolCallsLog) {
    const { tool, args, result } = tc;
    
    if (!result?.success) continue;
    
    const filePath = (args?.path || result?.path) as string;
    if (!filePath) continue;
    
    // Skip duplicate entries for same file
    const fileKey = `${tool}:${filePath}`;
    if (filesProcessed.has(fileKey)) continue;
    filesProcessed.add(fileKey);
    
    switch (tool) {
      case 'write_file': {
        const content = args?.content as string || '';
        const isNew = !result?.existed;
        changes.push({
          file: filePath,
          action: isNew ? 'created' : 'modified',
          description: isNew 
            ? `Created new file with ${content.split('\n').length} lines`
            : `Rewrote file (${content.split('\n').length} lines)`,
          linesChanged: content.split('\n').length,
          keyChanges: extractKeyChanges(content, tool)
        });
        break;
      }
      
      case 'search_replace': {
        const search = args?.search as string || '';
        const replace = args?.replace as string || '';
        const searchLines = search.split('\n').length;
        const replaceLines = replace.split('\n').length;
        const diff = replaceLines - searchLines;
        
        changes.push({
          file: filePath,
          action: 'modified',
          description: diff > 0 
            ? `Added ${diff} line(s)` 
            : diff < 0 
              ? `Removed ${Math.abs(diff)} line(s)` 
              : `Modified ${searchLines} line(s)`,
          linesChanged: Math.abs(diff) || searchLines,
          keyChanges: extractKeyChanges(replace, tool)
        });
        break;
      }
      
      case 'morph_edit': {
        const codeEdit = args?.code_edit as string || '';
        changes.push({
          file: filePath,
          action: 'modified',
          description: `Intelligent merge edit`,
          keyChanges: extractKeyChanges(codeEdit, tool)
        });
        break;
      }
      
      case 'insert_code': {
        const code = args?.code as string || '';
        changes.push({
          file: filePath,
          action: 'modified',
          description: `Inserted ${code.split('\n').length} line(s)`,
          linesChanged: code.split('\n').length,
          keyChanges: extractKeyChanges(code, tool)
        });
        break;
      }
      
      case 'delete_file': {
        changes.push({
          file: filePath,
          action: 'deleted',
          description: 'File deleted'
        });
        break;
      }
    }
  }
  
  // Generate summary
  const created = changes.filter(c => c.action === 'created').length;
  const modified = changes.filter(c => c.action === 'modified').length;
  const deleted = changes.filter(c => c.action === 'deleted').length;
  
  const summaryParts: string[] = [];
  if (created > 0) summaryParts.push(`${created} file(s) created`);
  if (modified > 0) summaryParts.push(`${modified} file(s) modified`);
  if (deleted > 0) summaryParts.push(`${deleted} file(s) deleted`);
  
  return {
    title: generateReportTitle(userPrompt, changes),
    summary: summaryParts.length > 0 ? summaryParts.join(', ') : 'No changes made',
    changes,
    totalFilesChanged: changes.length
  };
}

/**
 * Extract key changes from code for human-readable summary
 */
function extractKeyChanges(code: string, _tool: string): string[] {
  const keyChanges: string[] = [];
  
  // Detect imports added
  const importMatches = code.match(/import\s+.*from\s+['"][^'"]+['"]/g);
  if (importMatches && importMatches.length > 0) {
    keyChanges.push(`Added ${importMatches.length} import(s)`);
  }
  
  // Detect function definitions
  const funcMatches = code.match(/function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g);
  if (funcMatches && funcMatches.length > 0) {
    keyChanges.push(`Added/modified ${funcMatches.length} function(s)`);
  }
  
  // Detect component definitions
  const componentMatches = code.match(/export\s+(default\s+)?function\s+\w+|const\s+\w+\s*=\s*\(\)\s*=>\s*\{/g);
  if (componentMatches && componentMatches.length > 0) {
    keyChanges.push(`Component definition changed`);
  }
  
  // Detect style changes
  const styleMatches = code.match(/className=["'][^"']*["']|style=\{/g);
  if (styleMatches && styleMatches.length > 0) {
    keyChanges.push(`Styling updated`);
  }
  
  // Detect route changes
  if (code.includes('<Route') || code.includes('useNavigate') || code.includes('<Link')) {
    keyChanges.push(`Routing modified`);
  }
  
  return keyChanges.slice(0, 3); // Limit to 3 key changes
}

/**
 * Generate a human-readable title for the change report
 */
function generateReportTitle(userPrompt: string, changes: ChangeReportEntry[]): string {
  const promptLower = userPrompt.toLowerCase();
  
  // Try to extract action from prompt
  if (promptLower.includes('add') || promptLower.includes('create')) {
    const target = changes.find(c => c.action === 'created')?.file.split('/').pop() || 'feature';
    return `✅ Added ${target}`;
  }
  
  if (promptLower.includes('fix') || promptLower.includes('bug')) {
    return `🔧 Bug fix applied`;
  }
  
  if (promptLower.includes('change') || promptLower.includes('update') || promptLower.includes('modify')) {
    return `✏️ Changes applied`;
  }
  
  if (promptLower.includes('remove') || promptLower.includes('delete')) {
    return `🗑️ Removed content`;
  }
  
  if (promptLower.includes('style') || promptLower.includes('color') || promptLower.includes('design')) {
    return `🎨 Styling updated`;
  }
  
  // Default
  return changes.length > 0 ? `✅ ${changes.length} file(s) updated` : `ℹ️ Task completed`;
}

// ============================================================================
// 🔒 UPGRADE #2: MULTI-FILE SAFETY GUARDRAILS
// Require explicit confirmation or checklist for edits touching >2 files
// ============================================================================

export interface MultiFileGuardrail {
  triggered: boolean;
  fileCount: number;
  files: string[];
  checklist: MultiFileChecklistItem[];
  requiresConfirmation: boolean;
  message?: string;
}

export interface MultiFileChecklistItem {
  item: string;
  status: 'pending' | 'verified' | 'warning' | 'error';
  details?: string;
}

/**
 * Check if multi-file edit guardrails should be triggered
 * Returns a checklist of items to verify before proceeding
 */
export function checkMultiFileGuardrails(
  filesEdited: Set<string>,
  toolCallsLog: Array<{ tool: string; args: Record<string, unknown>; result: Record<string, unknown> }>,
  allFilesCache: Record<string, string>
): MultiFileGuardrail {
  const fileCount = filesEdited.size;
  const files = [...filesEdited];
  
  // Only trigger for >2 files
  if (fileCount <= 2) {
    return {
      triggered: false,
      fileCount,
      files,
      checklist: [],
      requiresConfirmation: false
    };
  }
  
  const checklist: MultiFileChecklistItem[] = [];
  
  // Check 1: All imports updated?
  const newComponents = files.filter(f => 
    f.includes('/components/') || f.includes('/pages/')
  );
  if (newComponents.length > 0) {
    const appJsEdited = files.some(f => f.includes('App.'));
    checklist.push({
      item: 'New components imported in App.js',
      status: appJsEdited ? 'verified' : 'warning',
      details: appJsEdited 
        ? `App.js was modified` 
        : `${newComponents.length} component(s) created but App.js not modified`
    });
  }
  
  // Check 2: Routes added for new pages?
  const newPages = files.filter(f => f.includes('/pages/'));
  if (newPages.length > 0) {
    const hasRouteChanges = toolCallsLog.some(tc => {
      const content = (tc.args?.content || tc.args?.replace || '') as string;
      return content.includes('<Route') || content.includes('path=');
    });
    checklist.push({
      item: 'Routes added for new pages',
      status: hasRouteChanges ? 'verified' : 'warning',
      details: hasRouteChanges 
        ? `Route definitions found` 
        : `${newPages.length} page(s) may not have routes`
    });
  }
  
  // Check 3: No orphan files?
  const orphanFiles: string[] = [];
  for (const file of files) {
    if (file.includes('App.') || file.includes('index.')) continue;
    
    // Check if this file is imported anywhere
    let isImported = false;
    for (const [_, content] of Object.entries(allFilesCache)) {
      const fileName = file.split('/').pop()?.replace(/\.(js|jsx|ts|tsx)$/, '');
      if (fileName && content.includes(fileName)) {
        isImported = true;
        break;
      }
    }
    if (!isImported) orphanFiles.push(file);
  }
  
  if (orphanFiles.length > 0) {
    checklist.push({
      item: 'No orphan files',
      status: 'warning',
      details: `${orphanFiles.length} file(s) may not be imported: ${orphanFiles.slice(0, 2).join(', ')}`
    });
  } else {
    checklist.push({
      item: 'No orphan files',
      status: 'verified',
      details: 'All files appear to be imported'
    });
  }
  
  // Check 4: Consistent styling?
  const hasStyleFiles = files.some(f => f.endsWith('.css') || f.endsWith('.scss'));
  const hasInlineStyles = toolCallsLog.some(tc => {
    const content = (tc.args?.content || tc.args?.replace || '') as string;
    return content.includes('className=') || content.includes('style={');
  });
  
  if (hasStyleFiles || hasInlineStyles) {
    checklist.push({
      item: 'Styling consistency',
      status: 'pending',
      details: 'Review styling changes for consistency'
    });
  }
  
  const hasWarnings = checklist.some(c => c.status === 'warning' || c.status === 'error');
  
  return {
    triggered: true,
    fileCount,
    files,
    checklist,
    requiresConfirmation: hasWarnings,
    message: hasWarnings 
      ? `⚠️ Multi-file edit (${fileCount} files) has ${checklist.filter(c => c.status === 'warning').length} warning(s)`
      : `✅ Multi-file edit (${fileCount} files) passed all checks`
  };
}

// ============================================================================
// 🧪 UPGRADE #3: SMOKE-TEST RUNNER (Quick Lint/Build Check)
// Run basic validation after changes to catch obvious errors
// ============================================================================

export interface SmokeTestResult {
  passed: boolean;
  tests: SmokeTestItem[];
  criticalErrors: string[];
  warnings: string[];
}

export interface SmokeTestItem {
  name: string;
  passed: boolean;
  message?: string;
}

/**
 * Run quick smoke tests on changed files
 * Catches obvious errors before user sees them
 */
export function runSmokeTests(
  filesChanged: string[],
  allFilesCache: Record<string, string>
): SmokeTestResult {
  const tests: SmokeTestItem[] = [];
  const criticalErrors: string[] = [];
  const warnings: string[] = [];
  
  for (const filePath of filesChanged) {
    const content = allFilesCache[filePath];
    if (!content) continue;
    
    const fileName = filePath.split('/').pop() || filePath;
    
    // Test 1: Syntax validation (basic bracket matching)
    const bracketTest = validateBrackets(content);
    tests.push({
      name: `${fileName}: Bracket matching`,
      passed: bracketTest.valid,
      message: bracketTest.valid ? undefined : bracketTest.error
    });
    if (!bracketTest.valid) {
      criticalErrors.push(`${fileName}: ${bracketTest.error}`);
    }
    
    // Test 2: JSX tag matching (for .jsx/.tsx files)
    if (filePath.match(/\.(jsx|tsx)$/)) {
      const jsxTest = validateJSXTags(content);
      tests.push({
        name: `${fileName}: JSX tags`,
        passed: jsxTest.valid,
        message: jsxTest.valid ? undefined : jsxTest.error
      });
      if (!jsxTest.valid) {
        criticalErrors.push(`${fileName}: ${jsxTest.error}`);
      }
    }
    
    // Test 3: Import validation
    const importTest = validateImports(content, filePath);
    tests.push({
      name: `${fileName}: Imports`,
      passed: importTest.valid,
      message: importTest.valid ? undefined : importTest.error
    });
    if (!importTest.valid && importTest.critical) {
      criticalErrors.push(`${fileName}: ${importTest.error}`);
    } else if (!importTest.valid) {
      warnings.push(`${fileName}: ${importTest.error}`);
    }

    // Test 4: Forbidden Supabase client usage in user projects
    const forbiddenSupabaseUsage = /@supabase\/supabase-js|supabaseAnonKey|supabaseUrl/.test(content);
    tests.push({
      name: `${fileName}: Forbidden Supabase client usage`,
      passed: !forbiddenSupabaseUsage,
      message: forbiddenSupabaseUsage
        ? 'Do not use supabase-js or anon keys in frontend. Use project-backend-api instead.'
        : undefined
    });
    if (forbiddenSupabaseUsage) {
      criticalErrors.push(`${fileName}: Forbidden Supabase client usage detected`);
    }
    
    // Test 5: No console.log in production (warning only)
    if (content.includes('console.log(')) {
      warnings.push(`${fileName}: Contains console.log statements`);
    }
  }
  
  return {
    passed: criticalErrors.length === 0,
    tests,
    criticalErrors,
    warnings
  };
}

/**
 * Validate bracket matching in code
 */
function validateBrackets(code: string): { valid: boolean; error?: string } {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const opens = new Set(['(', '[', '{']);
  const closes = new Set([')', ']', '}']);
  
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultiComment = false;
  
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1];
    const prevChar = code[i - 1];
    
    // Handle strings
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }
    
    if (inString) continue;
    
    // Handle comments
    if (char === '/' && nextChar === '/') {
      inComment = true;
      continue;
    }
    if (inComment && char === '\n') {
      inComment = false;
      continue;
    }
    if (inComment) continue;
    
    if (char === '/' && nextChar === '*') {
      inMultiComment = true;
      continue;
    }
    if (char === '*' && nextChar === '/') {
      inMultiComment = false;
      i++; // Skip the /
      continue;
    }
    if (inMultiComment) continue;
    
    // Check brackets
    if (opens.has(char)) {
      stack.push(char);
    } else if (closes.has(char)) {
      const expected = pairs[char];
      const actual = stack.pop();
      if (actual !== expected) {
        return { valid: false, error: `Mismatched bracket: expected '${expected}' but found '${char}'` };
      }
    }
  }
  
  if (stack.length > 0) {
    return { valid: false, error: `Unclosed bracket: '${stack[stack.length - 1]}'` };
  }
  
  return { valid: true };
}

/**
 * Validate JSX tag matching
 */
function validateJSXTags(code: string): { valid: boolean; error?: string } {
  // Simple check: count opening and closing tags
  const openingTags = code.match(/<[A-Z][a-zA-Z0-9]*(?:\s|>)/g) || [];
  const closingTags = code.match(/<\/[A-Z][a-zA-Z0-9]*>/g) || [];
  const selfClosing = code.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) || [];
  
  // Account for self-closing tags
  const expectedClosing = openingTags.length - selfClosing.length;
  
  if (closingTags.length < expectedClosing - 2) { // Allow some tolerance
    return { 
      valid: false, 
      error: `Possible unclosed JSX tags (${openingTags.length} opening, ${closingTags.length} closing)` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate imports
 */
function validateImports(code: string, _filePath: string): { valid: boolean; error?: string; critical?: boolean } {
  // Check for common import errors
  const imports = code.match(/import\s+.*from\s+['"][^'"]+['"]/g) || [];
  
  for (const imp of imports) {
    // Check for duplicate imports
    const importPath = imp.match(/from\s+['"]([^'"]+)['"]/)?.[1];
    if (importPath) {
      const duplicates = imports.filter(i => i.includes(`'${importPath}'`) || i.includes(`"${importPath}"`));
      if (duplicates.length > 1) {
        return { valid: false, error: `Duplicate import from '${importPath}'`, critical: false };
      }
    }
  }
  
  // Check for React import in JSX files
  if (code.includes('<') && code.includes('/>') && !code.includes("from 'react'") && !code.includes('from "react"')) {
    // Modern React doesn't require import, so just warn
    return { valid: true };
  }
  
  return { valid: true };
}
