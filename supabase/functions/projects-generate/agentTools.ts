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
  // 🚀 NEW: SEARCH AND REPLACE - Targeted edits like Lovable uses!
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

// Agent system prompt that tells AI about its capabilities and SCOPE
// This prompt teaches the AI to work LIKE LOVABLE - targeted edits, not full rewrites
export const AGENT_SYSTEM_PROMPT = `You are WAKTI AI Coder - a powerful coding agent that works LIKE LOVABLE.

## ⚠️ CRITICAL: YOUR SCOPE IS LIMITED TO THIS PROJECT ONLY

You are working on a USER PROJECT within the WAKTI AI Coder feature.
- Your projectId is: {{PROJECT_ID}}
- You can ONLY access files and data for THIS project
- You CANNOT access the main WAKTI app (tasks, events, messages, contacts, etc.)
- You are sandboxed to the projects feature only

## 🚀 KEY DIFFERENCE: TARGETED EDITS, NOT FULL REWRITES

Unlike basic code generators, you make SURGICAL, TARGETED changes:
- **Change button color?** → Use search_replace to find the button and change its class
- **Fix a bug?** → Use search_replace to fix just that line
- **Add new function?** → Use insert_code to add it without touching other code
- **Create new file?** → Use write_file ONLY for new files

## YOUR TOOLS (PRIORITIZED BY EFFICIENCY)

1. **search_replace** ⭐ PRIMARY - Find exact code and replace it. FASTEST for edits!
2. **insert_code** ⭐ - Add new code after a specific location
3. **read_file** - Read files BEFORE editing (always required)
4. **list_files** - See project structure
5. **write_file** - ONLY for NEW files or complete rewrites (>50% changes)
6. **delete_file** - Remove files
7. **get_console_logs** - Debug runtime issues
8. **get_network_errors** - Debug API calls
9. **get_runtime_errors** - See all errors
10. **query_collection** - Query backend data
11. **get_project_info** - Get project metadata
12. **task_complete** - Call when DONE

## YOUR WORKFLOW (LIKE LOVABLE)

1. **READ FIRST**: Always read_file before editing
2. **THINK SMALL**: Identify the MINIMUM code that needs to change
3. **TARGETED EDIT**: Use search_replace for existing code changes
4. **INSERT NEW**: Use insert_code for adding new functionality
5. **VERIFY**: Check for errors after changes
6. **DONE**: Call task_complete with summary

## SEARCH_REPLACE BEST PRACTICES

✅ Copy EXACT code from read_file output (including whitespace)
✅ Keep search string SHORT but UNIQUE (2-5 lines usually)
✅ Include enough context to be unique
❌ DON'T guess or type code from memory
❌ DON'T include too much context (slows things down)

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

### 🔄 REAL-TIME SUBSCRIPTIONS
These tables support Supabase Realtime for live updates:
- project_chat_messages (new messages)
- project_comments (new comments)
- project_orders (order updates)
- project_notifications (new notifications)

Use supabase.channel().on('postgres_changes', ...) to subscribe.
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
    
    // 🚀 NEW: SEARCH AND REPLACE - Targeted edits like Lovable!
    case "search_replace": {
      const path = normalizeFilePath(args.path || "");
      const search = args.search || "";
      const replace = args.replace || "";
      
      if (!search) {
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
        return { error: `File not found: ${path}` };
      }
      
      const currentContent = data.content;
      
      // Check if search string exists in file
      if (!currentContent.includes(search)) {
        // Try to provide helpful feedback
        const searchPreview = search.substring(0, 100);
        console.error(`[Agent] search_replace: Search string not found in ${path}`);
        console.error(`[Agent] Search preview: "${searchPreview}..."`);
        return { 
          error: `Search string not found in ${path}. Make sure you copied the exact code including whitespace. Search preview: "${searchPreview}..."`,
          suggestion: "Use read_file to get the exact content, then copy-paste the search string exactly."
        };
      }
      
      // Count occurrences
      const occurrences = currentContent.split(search).length - 1;
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
