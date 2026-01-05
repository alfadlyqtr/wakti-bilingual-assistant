import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const allowedOrigins = [
  "https://wakti.qa",
  "https://www.wakti.qa",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const getCorsHeaders = (origin: string | null) => {
  const isLocalDev =
    origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"));
  const isAllowed =
    isLocalDev ||
    (origin && allowedOrigins.some((allowed) => origin.startsWith(allowed)));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, accept, cache-control, x-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
};

function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.split(".").length !== 3) return null;
    const payloadB64 = token.split(".")[1];
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    return payload.sub || null;
  } catch {
    return null;
  }
}

// EMP (Enhance My Prompt) - Uses GPT-4o-mini to enhance user prompts
async function enhancePrompt(userPrompt: string, theme: string, assets: string[]): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.log("[EMP] No API key, returning original prompt");
    return userPrompt;
  }

  const themeDescriptions: Record<string, string> = {
    'wakti-dark': 'dark premium theme with deep navy (#0c0f14), royal purple (#060541), and subtle gray (#858384)',
    'wakti-light': 'clean light theme with off-white (#fcfefd), deep purple (#060541), and warm beige (#e9ceb0)',
    'vibrant': 'vibrant colorful theme with electric blue, purple, and orange gradients',
    'emerald': 'elegant emerald green theme with teal and dark backgrounds',
  };

  const themeDesc = themeDescriptions[theme] || themeDescriptions['wakti-dark'];
  const assetInfo = assets.length > 0 
    ? `\n\nThe user has uploaded ${assets.length} image(s) that MUST be used in the design: ${assets.join(', ')}`
    : '';

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `You are an expert prompt enhancer for an AI web developer. Your job is to take a user's simple request and enhance it into a detailed, specific prompt that will result in a stunning website.

RULES:
1. NEVER remove or change the user's core request - only ADD details
2. Add specific UI/UX suggestions (animations, layout, sections)
3. Include the theme colors naturally
4. If assets are provided, specify where to use them (hero, logo, etc.)
5. Keep it concise - max 3-4 sentences
6. Return ONLY the enhanced prompt, no explanations

THEME TO USE: ${themeDesc}${assetInfo}`
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error("[EMP] API error:", response.status);
      return userPrompt;
    }

    const data = await response.json();
    const enhanced = data.choices?.[0]?.message?.content?.trim();
    
    if (enhanced && enhanced.length > userPrompt.length) {
      console.log("[EMP] Enhanced prompt:", enhanced.substring(0, 100));
      return enhanced;
    }
    
    return userPrompt;
  } catch (e) {
    console.error("[EMP] Error:", e);
    return userPrompt;
  }
}

// Wakti-style system prompt for ULTRA-PREMIUM multi-file generation (Better than Lovable)
const WAKTI_SYSTEM_PROMPT = `
You are the world's most elite UI/UX designer, Full-Stack Architect, and React Expert. Your goal is to create "Wakti-standard" designs: ultra-premium, high-end, and artistic, while ensuring the application is fully functional, logical, and architecturally sound.

Your work must exceed the quality of platforms like Lovable or Vercel v0, acting not just as a designer, but as a Senior Software Engineer.

### PART 1: AESTHETICS & DESIGN (THE WAKTI STANDARD)
1.  **Aesthetics**: Use sophisticated color palettes. Favor deep dark themes with glowing accents (cyan, emerald, purple) or ultra-clean "Apple-style" light themes.
2.  **Layout**: Use "Bento Box" grids, asymmetrical layouts, and generous whitespace.
3.  **Visual Depth**: Use advanced glassmorphism (backdrop-blur-2xl bg-white/[0.02] border-white/[0.05]), multi-layered shadows, and subtle mesh gradients.
4.  **Micro-interactions**: Every button and card must have hover effects (scale, glow, border-color change). Use Framer Motion or Tailwind transitions. Buttons need "active:scale-95".
5.  **Typography**: Use bold, high-contrast headings with letter-spacing. Hero text: "text-7xl font-extrabold tracking-tighter bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent".

### PART 2: FULL-STACK ARCHITECTURE & LOGIC (THE BRAIN)
1.  **Frontend-as-Backend**: Since this runs in a sandbox, you must SIMULATE a full-stack environment.
    - Create a file \`/utils/mockData.js\` to act as your "Database". Export rich, realistic JSON arrays here.
    - NEVER use static hardcoded text inside components. Map over data from your mock database.
2.  **Simulated Latency**: To make the app feel real and show off loading states:
    - Create a helper: \`const simulateFetch = (data, ms = 800) => new Promise(r => setTimeout(() => r(data), ms));\`
    - Use this in \`useEffect\` to load data, so skeleton loaders actually appear before content.
3.  **In-Memory CRUD**: Make "Add", "Edit", and "Delete" buttons ACTUALLY WORK within the session:
    - Store data in React state (e.g., \`const [items, setItems] = useState(initialData);\`).
    - "Add" should append to state. "Delete" should filter from state. "Edit" should update in state.
    - Changes persist during the session (until refresh). This makes the app feel alive.
4.  **State Management**: Use \`useState\` and \`useEffect\` for complex interactivity.
    - Implement real filtering, sorting, and searching where applicable.
    - Handle "Loading" states (skeletons) and "Empty" states (friendly error messages).
5.  **Component Architecture**:
    - **Smart vs. Dumb**: Keep logic in parent pages/hooks, and keep UI components pure.
    - **Modularity**: Break code into \`/components/ui\`, \`/components/layout\`, and \`/hooks\`.
6.  **Robustness**:
    - Form inputs must work (controlled components).
    - Buttons must trigger actions that update state visibly.
    - Images must have fallbacks (onError handlers).

### PART 3: QUALITY & BEST PRACTICES (SENIOR ENGINEER STANDARDS)
1.  **Image Strategy (The "Wakti" Collection)**:
    - NEVER use placeholders like "via.placeholder.com" or solid colors.
    - NEVER invent random Unsplash IDs (they often break).
    - YOU MUST SELECT from this curated list of high-quality IDs based on the user's topic.
    - URL Format: \`https://images.unsplash.com/photo-{ID}?auto=format&fit=crop&w=800&q=80\`
    
    **USE THESE EXACT IDs:**
    - **Luxury / Watches / Jewelry**: \`1523170335258-f5ed11844a49\` (Watch), \`1515562141207-7a88fb7ce338\` (Gold), \`1617038220319-276d3cf663c6\` (Dark Luxury).
    - **Tech / SaaS / Startup**: \`1519389950473-47ba0277781c\` (Macbook), \`1551288049-bebda4e38f71\` (Data Viz), \`1531297422935-40280f32a347\` (Server Room).
    - **Abstract / Backgrounds**: \`1618005182384-a83a8bd57fbe\` (Dark Waves), \`1550684848-fac1c5b4e853\` (Blue/Purple Gradient), \`1620121692634-99a437207985\` (Glassmorphism Mesh).
    - **Food / Coffee**: \`1497935586351-b67a49e012bf\` (Latte), \`1504674900247-0877df9cc836\` (Dark Food Photography).
    - **People / Community**: \`1522071820081-009f0129c71c\` (Office Team), \`1534528741775-53994a69daeb\` (Portrait).
    - **Travel / Nature**: \`1472214103451-9374bd1c798e\` (Mountains), \`1507525428034-b723cf961d3e\` (Ocean).
    
    *If the user's request doesn't fit a specific category, default to the "Abstract / Backgrounds" IDs to keep it safe and premium.*

2.  **Error Handling**: Wrap data operations in try/catch. Prevent preview crashes.
3.  **Accessibility (a11y)**: Use proper \`aria-labels\`, semantic HTML (\`<nav>\`, \`<main>\`, \`<section>\`), and keyboard navigation support.
4.  **Performance**: Use \`React.memo\` for heavy list items and \`useMemo\`/\`useCallback\` where beneficial.
5.  **Bilingual/RTL Support**: Support RTL/LTR layouts using Tailwind's \`rtl:\` and \`ltr:\` modifiers if the content suggests it.

### PART 4: TECHNICAL REQUIREMENTS
- **Environment**: Sandpack (React 18 + Vite).
- **Styling**: Tailwind CSS for ALL styling. Use \`clsx\` or \`tailwind-merge\` for class conditional logic.
- **Icons**: Lucide React.
- **Animation**: Framer Motion (MANDATORY for page transitions and complex interactions).
- **Charts**: Use Recharts if data visualization is needed.
- **Responsiveness**: Mobile-first approach is non-negotiable.
- **NO EXTERNAL ROUTING**: Do NOT use \`react-router-dom\` or any routing library. Sandpack doesn't have it.
  - For multi-page apps, use STATE-BASED navigation: \`const [currentPage, setCurrentPage] = useState('home');\`
  - Render pages conditionally: \`{currentPage === 'home' && <Home />}\`
  - Navigation links should call \`onClick={() => setCurrentPage('contact')}\` instead of \`<Link to="/contact">\`.

### OUTPUT FORMAT:
Return ONLY a JSON object containing the files. No explanation. No markdown.
The structure must look like a real production repo.

Example:
{
  "/App.js": "import... export default function App() { ... }",
  "/utils/mockData.js": "export const users = [...];",
  "/components/Navbar.jsx": "...",
  "/components/Hero.jsx": "...",
  "/hooks/useTheme.js": "..."
}

CRITICAL: NO MARKDOWN. NO EXPLANATION. ONLY RAW JSON.`;

// Single file system prompt (legacy, for edits)
const SINGLE_FILE_SYSTEM_PROMPT = `You are an expert React developer.
Generate a single React component that renders a complete page.

RULES:
1. Use "export default function App()" 
2. Import React at the top
3. Use Tailwind CSS for styling
4. Use lucide-react for icons
5. Use framer-motion for animations
6. Return ONLY the JavaScript code, no markdown

DESIGN:
- Dark theme: bg-slate-950
- Gradients: from-indigo-500 to-purple-600
- Glassmorphism: backdrop-blur-xl bg-white/5
- Large text: text-5xl font-bold
- Animations: hover:scale-105 transition-all`;

// Generate a single React component (simpler, more reliable)
async function generateSingleFileComponent(prompt: string, assets: string[] = []): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const systemPrompt = `You are an expert React developer. Generate a SINGLE complete React component.

RULES:
1. Start with: import React from "react";
2. Use: export default function App() { ... }
3. Use Tailwind CSS for ALL styling
4. Use lucide-react for icons: import { Icon } from "lucide-react"
5. Use framer-motion for animations: import { motion } from "framer-motion"
6. Return ONLY the JavaScript code, no markdown, no explanation

DESIGN:
- Dark premium theme: bg-slate-950, bg-zinc-900
- Vivid gradients: from-indigo-500 to-purple-600
- Glassmorphism: backdrop-blur-xl bg-white/5 border border-white/10
- Large typography: text-5xl font-bold
- Smooth animations: transition-all duration-300
- Hover effects: hover:scale-105

IMAGE URLS:
- Hero: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800'
- Product: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'`;

  let userPrompt = `Create a stunning React component for: "${prompt}"`;
  if (assets.length > 0) {
    userPrompt += `\n\nUse these images:\n${assets.map((url, i) => `- Image ${i + 1}: ${url}`).join('\n')}`;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[projects-generate] OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  let code = data.choices?.[0]?.message?.content || "";
  
  // Clean up markdown if present
  code = code.replace(/^```(?:jsx?|tsx?|javascript|typescript)?\n?/gi, '');
  code = code.replace(/\n?```$/gi, '');
  
  return code.trim();
}

// Generate multiple files like Google AI Studio (kept for future use)
interface GeneratedFiles {
  [path: string]: string;
}

async function _generateMultiFileProject(prompt: string, assets: string[] = []): Promise<GeneratedFiles> {
  let userPrompt = `Create a stunning, production-ready React project for: "${prompt}"
  
Generate AT LEAST these files:
- /App.js (main component that imports and renders all others)
- /components/Header.jsx (navigation/header)
- /components/HeroSection.jsx (hero/banner section)
- /components/Features.jsx or /components/ProductCard.jsx (main content)
- /components/Footer.jsx (footer)

Add more components as needed for the design.`;

  if (assets.length > 0) {
    userPrompt += `\n\nIMPORTANT - User uploaded images (use these URLs DIRECTLY in <img src="..."> tags, DO NOT use import statements):
${assets.map((url, i) => `- Image ${i + 1} URL: "${url}"`).join('\n')}

Example usage: <img src="${assets[0]}" alt="Logo" className="h-12" />
NEVER import images like "import logo from './assets/...'". Always use the full URL directly.`;
  }

  // Use GPT-4o for code generation (reliable JSON output)
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: WAKTI_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[projects-generate] OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  
  try {
    // Clean markdown if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    
    const parsed = JSON.parse(jsonStr.trim());
    
    // Handle different response formats
    // Format 1: { "files": { "/App.js": "..." } }
    // Format 2: { "/App.js": "..." } (files at root)
    if (parsed.files && typeof parsed.files === 'object') {
      console.log("[projects-generate] Found files in 'files' property");
      return parsed.files;
    }
    
    // Check if root has file paths
    const keys = Object.keys(parsed);
    if (keys.some(k => k.startsWith('/') || k.endsWith('.js') || k.endsWith('.jsx'))) {
      console.log("[projects-generate] Found files at root level");
      return parsed;
    }
    
    console.error("[projects-generate] Unexpected JSON structure:", keys);
    throw new Error("Unexpected JSON structure");
  } catch (e) {
    console.error("[projects-generate] Failed to parse JSON:", e, content.substring(0, 200));
    
    // Fallback: Create a basic React component from the content
    // If it looks like HTML, wrap it in a React component
    if (content.includes('<!DOCTYPE') || content.includes('<html')) {
      console.log("[projects-generate] Detected HTML, converting to React");
      const fallbackCode = `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold mb-4">Generation Error</h1>
        <p className="text-gray-400">The AI returned invalid code. Please try again.</p>
      </div>
    </div>
  );
}`;
      return { "/App.js": fallbackCode };
    }
    
    // If it looks like React code, use it directly
    if (content.includes('export default') || content.includes('function App')) {
      return { "/App.js": content };
    }
    
    // Last resort fallback
    return { "/App.js": `import React from 'react';
export default function App() {
  return <div className="p-8 bg-slate-950 min-h-screen text-white">
    <h1 className="text-2xl font-bold">Error: Could not parse AI response</h1>
  </div>;
}` };
  }
}

// Chat about project (read-only Q&A) - Uses GPT-4o-mini for fast, cheap answers
async function chatAboutProject(
  currentFiles: GeneratedFiles, 
  question: string,
  history: Array<{role: string, content: string}> = [],
  userInstructions: string = ''
): Promise<string> {
  console.log("[chatAboutProject] Answering question:", question.substring(0, 100));
  console.log("[chatAboutProject] Project files:", Object.keys(currentFiles));
  console.log("[chatAboutProject] History messages:", history.length);
  
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Convert files to a readable format for the AI
  const filesStr = Object.entries(currentFiles)
    .map(([path, content]) => `=== ${path} ===\n${content}`)
    .join('\n\n');

  // Build conversation history for context
  const historyStr = history.length > 0 
    ? `\n\n--- Previous Conversation ---\n${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}\n--- End of History ---\n`
    : '';

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content: `You are a Senior Software Architect in "Ask Mode" - your job is to ANALYZE, INVESTIGATE, and PROPOSE PLANS without making any code changes.

BEHAVIOR:
1. When the user asks a question about the code, analyze it thoroughly and explain clearly.
2. When the user asks for a change, feature, or fix:
   - DO NOT make the change yourself
   - Instead, INVESTIGATE the codebase
   - PROPOSE A PLAN with clear steps
   - End your response with: "**Ready to implement?** Switch to Code mode and I'll apply these changes."

RESPONSE STYLE:
- Be analytical and thorough like a Senior Engineer
- If proposing changes, list them as a numbered plan
- Always end change requests with the "Ready to implement?" prompt
- For pure questions (no changes needed), just answer helpfully

You have access to all project files and conversation history for context.${userInstructions ? `

--- USER'S CUSTOM INSTRUCTIONS (MUST FOLLOW) ---
${userInstructions}
--- END OF CUSTOM INSTRUCTIONS ---` : ''}`,
        },
        {
          role: "user",
          content: `Here is the project's source code:\n\n${filesStr}${historyStr}\n\n---\n\nUser's current question: ${question}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[chatAboutProject] OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content || "I couldn't generate an answer. Please try again.";
  
  console.log("[chatAboutProject] Answer:", answer.substring(0, 100));
  return answer.trim();
}

// Edit result interface
interface EditResult {
  files: GeneratedFiles;
  summary: string;
}

// Edit existing files with DeepSeek (cheaper, faster) - returns files AND a summary of changes
async function editWithDeepSeek(
  currentFiles: GeneratedFiles, 
  editRequest: string,
  history: Array<{role: string, content: string}> = [],
  userInstructions: string = ''
): Promise<EditResult> {
  console.log("[editWithDeepSeek] Starting edit with request:", editRequest.substring(0, 100));
  console.log("[editWithDeepSeek] Current files:", Object.keys(currentFiles));
  console.log("[editWithDeepSeek] History messages:", history.length);
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  // Convert files to a readable format for the AI
  const filesStr = Object.entries(currentFiles)
    .map(([path, content]) => `=== ${path} ===\n${content}`)
    .join('\n\n');

  // Build conversation history for context
  const historyStr = history.length > 0 
    ? `\n\n--- Previous Conversation ---\n${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}\n--- End of History ---\n`
    : '';

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 8000,
      messages: [
        {
          role: "system",
          content: `You are editing an existing React project. Apply the user's changes.
You have access to the previous conversation history to understand context.
If the user refers to something from earlier (like "do the same for X" or "now change that to Y"), use the context.

Return a JSON object with:
1. "files" - the updated file contents (only files that changed)
2. "summary" - a brief, friendly explanation of what you changed (1-3 sentences, like a helpful assistant would say)

Example response:
{
  "files": {
    "/components/Hero.js": "updated code..."
  },
  "summary": "I updated the hero headline in Hero.js from 'Welcome' to 'Hello World'. The change is now live in your preview!"
}

Keep the summary conversational and specific about what changed. Return ONLY valid JSON.${userInstructions ? `

--- USER'S CUSTOM INSTRUCTIONS (MUST FOLLOW) ---
${userInstructions}
--- END OF CUSTOM INSTRUCTIONS ---` : ''}`,
        },
        {
          role: "user",
          content: `Current project files:\n\n${filesStr}${historyStr}\n\n---\n\nUser's current edit request: ${editRequest}\n\nReturn the updated files and a summary as JSON.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[projects-generate] DeepSeek API error:", response.status, errorText);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  
  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    
    const parsed = JSON.parse(jsonStr.trim());
    const updatedFiles = parsed.files || {};
    const summary = parsed.summary || "Changes applied successfully!";
    
    // Merge with existing files (keep unchanged files)
    return { 
      files: { ...currentFiles, ...updatedFiles },
      summary: summary
    };
  } catch (e) {
    console.error("[projects-generate] Failed to parse edit JSON:", e);
    // Return original files unchanged with generic message
    return { 
      files: currentFiles,
      summary: "I tried to apply your changes but encountered an issue. Please try again."
    };
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { mode, prompt, currentFiles, currentCode, assets, theme, userInstructions } = body;

    // Log user instructions if provided
    if (userInstructions) {
      console.log("[projects-generate] User instructions provided:", userInstructions.substring(0, 100));
    }

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing prompt", code: "BAD_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract history from request body
    const history = body.history || [];
    console.log("[projects-generate] Conversation history:", history.length, "messages");

    // Handle CHAT mode - Q&A about the project (read-only, no file edits)
    if (mode === 'chat' && (currentFiles || currentCode)) {
      console.log("[projects-generate] Chat mode - answering question about project");
      
      const chatAnswer = await chatAboutProject(
        currentFiles || { "/App.js": currentCode || "" },
        prompt,
        history, // Pass conversation history for context
        userInstructions || '' // Pass user's custom instructions
      );
      
      return new Response(
        JSON.stringify({
          ok: true,
          message: chatAnswer,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle EDIT mode - modify existing files
    if (mode === 'edit' && (currentFiles || currentCode)) {
      console.log("[projects-generate] Edit mode - modifying existing project");
      
      // Use the edit function to modify existing code - returns { files, summary }
      const editResult = await editWithDeepSeek(
        currentFiles || { "/App.js": currentCode || "" },
        prompt,
        history, // Pass conversation history for context
        userInstructions || '' // Pass user's custom instructions
      );
      
      const mainCode = editResult.files["/App.js"] || Object.values(editResult.files)[0] || "";
      
      return new Response(
        JSON.stringify({
          ok: true,
          files: editResult.files,
          code: mainCode,
          message: editResult.summary, // Include the summary of what changed
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CREATE mode - Generate multi-file React project (Lovable-style)
    console.log("[projects-generate] Create mode - generating new project");
    console.log("[projects-generate] Theme:", theme, "Assets:", assets?.length || 0);
    
    // Step 1: Enhance the prompt using EMP (GPT-4o-mini)
    const enhancedPrompt = await enhancePrompt(prompt, theme || 'wakti-dark', assets || []);
    console.log("[projects-generate] Enhanced prompt:", enhancedPrompt.substring(0, 150));
    
    // Step 2: Generate with enhanced prompt
    const generatedFiles = await _generateMultiFileProject(enhancedPrompt, assets || []);
    
    // Also extract App.js as the main code for backwards compatibility
    const mainCode = generatedFiles["/App.js"] || "";

    return new Response(
      JSON.stringify({
        ok: true,
        files: generatedFiles,
        code: mainCode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[projects-generate] Error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
