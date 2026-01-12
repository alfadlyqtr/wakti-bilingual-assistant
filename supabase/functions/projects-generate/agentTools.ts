// ============================================================================
// WAKTI AI CODER - AGENT TOOL SYSTEM
// Full agent with read/write/debug/query capabilities
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  {
    name: "write_file",
    description: "Create or update a file in the project. Use this to save your code changes. ALWAYS write the COMPLETE file content, not patches.",
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
    name: "get_project_info",
    description: "Get project metadata including backend status, available collections, and uploaded assets.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "task_complete",
    description: "Call this when you have finished the user's request. Provide a summary of what you did.",
    parameters: {
      type: "object",
      properties: {
        summary: { 
          type: "string", 
          description: "What you did to complete the task" 
        },
        filesChanged: { 
          type: "array", 
          items: { type: "string" }, 
          description: "List of files you modified or created" 
        }
      },
      required: ["summary"]
    }
  }
];

// Agent system prompt that tells AI about its capabilities
export const AGENT_SYSTEM_PROMPT = `You are WAKTI AI Coder - a powerful coding agent with FULL ACCESS to the project.

## YOUR CAPABILITIES (USE THEM!)

You have these tools and MUST use them:

1. **read_file** - Read any file. ALWAYS read files before editing them.
2. **list_files** - See all project files. Use this to understand the project structure.
3. **write_file** - Create or update files. This is how you make changes.
4. **delete_file** - Remove files that are no longer needed.
5. **get_console_logs** - See runtime logs. Check this when something is broken.
6. **get_network_errors** - See failed API calls. Check this for backend issues.
7. **get_runtime_errors** - See React errors, syntax errors, crashes.
8. **query_collection** - Query the database. See what data exists.
9. **get_project_info** - Get project metadata and backend status.
10. **task_complete** - Call this when you're done with your summary.

## YOUR WORKFLOW

1. FIRST: Use list_files to see the project structure
2. THEN: Use read_file to read relevant files
3. CHECK: Use get_runtime_errors or get_console_logs if there are problems
4. FIX: Use write_file to save your changes
5. VERIFY: Check errors again if needed
6. DONE: Call task_complete with a summary

## CRITICAL RULES

- NEVER guess file contents. Always read_file first.
- ALWAYS check console logs and errors when debugging
- You can call multiple tools in sequence
- Write COMPLETE files, not patches or diffs
- If you create new components, make sure to import them where needed
- Only use lucide-react for icons (never react-icons or heroicons)
- Use Tailwind CSS for styling
- Test your logic mentally before writing

## REACT CODE STANDARDS

- Use functional components with hooks
- import React from 'react' is required
- export default function ComponentName() is the pattern
- Use { useState, useEffect, ... } from React
- Import components with relative paths ./components/Name

## BACKEND API

If the project uses backend features, the API is:
https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

For form submissions:
{
  projectId: "PROJECT_ID",
  action: "submit",
  formName: "contact",
  data: { name, email, message }
}

For collections:
GET: ?projectId=PROJECT_ID&action=collection/products
POST: { projectId: "PROJECT_ID", action: "collection/products", data: {...} }
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

// Execute a single tool call
export async function executeToolCall(
  projectId: string,
  toolCall: ToolCall,
  debugContext: AgentDebugContext,
  supabase: ReturnType<typeof createClient>
): Promise<any> {
  const { name, arguments: args } = toolCall;
  
  console.log(`[Agent] Executing tool: ${name}`, args);
  
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
    
    case "write_file": {
      const path = normalizeFilePath(args.path || "");
      const content = args.content || "";
      
      if (!content.trim()) {
        return { error: "Cannot write empty file content" };
      }
      
      assertNoHtml(path, content);
      
      const { error } = await supabase
        .from('project_files')
        .upsert({
          project_id: projectId,
          path: path,
          content: content
        }, { onConflict: 'project_id,path' });
      
      if (error) {
        console.error(`[Agent] write_file error:`, error);
        return { error: `Failed to write file: ${error.message}` };
      }
      
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

// Agent result interface
export interface AgentResult {
  success: boolean;
  summary: string;
  filesChanged: string[];
  iterations: number;
  toolCalls: Array<{ tool: string; result: any }>;
  error?: string;
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
