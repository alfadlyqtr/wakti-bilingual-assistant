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

const THEME_PRESETS: Record<string, string> = {
  'wakti-dark': 'Wakti Dark theme: Deep Navy (#0c0f14), Royal Purple (#060541), Subtle Gray (#858384). Modern font, Glow shadows, Rounded corners, Cards layout. Mood: Elegant.',
  'midnight': 'Midnight theme: Deep Indigo (#1e1b4b), Dark Purple (#312e81), Royal Blue (#4338ca), Indigo (#6366f1). Modern font, Glow shadows, Rounded corners. Mood: Sophisticated.',
  'obsidian': 'Obsidian theme: Slate (#1e293b), Charcoal (#334155), Gray (#475569). Minimal font, No shadow, Subtle radius. Mood: Professional.',
  'brutalist': 'Brutalist theme: Indigo (#6366f1), Purple (#a855f7), Pink (#ec4899), Red (#f43f5e). Bold font, Neon shadows, No radius, Bento layout. Mood: Bold.',
  'wakti-light': 'Wakti Light theme: Off-White (#fcfefd), Deep Purple (#060541), Warm Beige (#e9ceb0). Classic font, Soft shadows, Rounded corners. Mood: Elegant.',
  'glacier': 'Glacier theme: Soft Blue (#60a5fa), Lavender (#a5b4fc), Light Purple (#c4b5fd), Ice (#e0e7ff). Minimal font, Soft shadows, Rounded corners. Mood: Calm.',
  'lavender': 'Lavender theme: Soft Purple (#a78bfa), Lilac (#c4b5fd), Pale Violet (#ddd6fe). Classic font, Soft shadows, Rounded corners. Mood: Elegant.',
  'vibrant': 'Vibrant theme: Blue (#3b82f6), Purple (#8b5cf6), Orange (#f97316), Pink (#ec4899). Bold font, Glow shadows, Rounded corners, Bento layout. Mood: Playful.',
  'neon': 'Neon theme: Cyan (#22d3ee), Lime (#a3e635), Yellow (#facc15), Pink (#f472b6). Bold font, Neon shadows, Pill radius, Bento layout. Mood: Bold/Electric.',
  'sunset': 'Sunset theme: Orange (#f97316), Peach (#fb923c), Soft Coral (#fdba74). Modern font, Glow shadows, Rounded corners. Mood: Playful/Warm.',
  'orchid': 'Orchid theme: Pink (#ec4899), Rose (#f472b6), Blush (#f9a8d4). Playful font, Soft shadows, Pill radius. Mood: Feminine/Playful.',
  'coral': 'Coral theme: Rose Red (#f43f5e), Salmon (#fb7185), Pink (#fda4af). Bold font, Hard shadows, Rounded corners, Bento layout. Mood: Bold.',
  'emerald': 'Emerald theme: Green (#10b981), Mint (#34d399), Seafoam (#6ee7b7). Modern font, Soft shadows, Rounded corners. Mood: Calm.',
  'forest': 'Forest theme: Bright Green (#22c55e), Lime (#4ade80), Pale Green (#86efac). Classic font, Soft shadows, Subtle radius. Mood: Organic.',
  'solar': 'Solar theme: Gold (#eab308), Yellow (#facc15), Lemon (#fde047). Bold font, Glow shadows, Rounded corners, Bento layout. Mood: Optimistic.',
  'ocean': 'Ocean theme: Sky Blue (#0ea5e9), Cyan (#38bdf8), Aqua (#7dd3fc). Modern font, Soft shadows, Rounded corners. Mood: Professional.',
  'harvest': 'Harvest theme: Amber (#f59e0b), Gold (#fbbf24), Warm Cream (#fde68a). Bold font, Hard shadows, Subtle radius, Magazine layout. Mood: Warm.',
  'none': 'Use a sophisticated dark premium theme with deep gradients (slate-950 to indigo-950) and glassmorphism.'
};

const BASE_SYSTEM_PROMPT = `
You are the world's most elite UI/UX designer, Full-Stack Architect, and React Expert. Your goal is to create "Wakti-standard" designs: ultra-premium, high-end, and artistic, while ensuring the application is fully functional, logical, and architecturally sound.

### PART 1: AESTHETICS & DESIGN
1.  **Theme Compliance**: {{THEME_INSTRUCTIONS}}
2.  **Layout**: Use "Bento Box" grids, asymmetrical layouts, and generous whitespace.
3.  **Visual Depth**: Use advanced glassmorphism (backdrop-blur-2xl bg-white/[0.02] border-white/[0.05]), multi-layered shadows, and mesh gradients.
4.  **Micro-interactions**: Every button and card must have hover effects (scale, glow, border-color change). Use Framer Motion. Buttons need "active:scale-95".

### PART 2: ARCHITECTURE
1.  **Frontend-as-Backend**: Create \`/utils/mockData.js\` for data. Use \`useEffect\` with simulated latency for realism.
2.  **In-Memory CRUD**: Make "Add", "Edit", and "Delete" work in React state.
3.  **No External Routing**: Use state-based navigation: \`const [page, setPage] = useState('home');\`.

### PART 3: IMAGE IDS
ONLY use these Unsplash IDs:
- Luxury: 1523170335258-f5ed11844a49, 1515562141207-7a88fb7ce338, 1617038220319-276d3cf663c6
- Tech: 1519389950473-47ba0277781c, 1551288049-bebda4e38f71, 1531297422935-40280f32a347
- Abstract: 1618005182384-a83a8bd57fbe, 1550684848-fac1c5b4e853, 1620121692634-99a437207985

### OUTPUT FORMAT:
Return ONLY a valid JSON object. No markdown fences. No explanation.
Structure:
{
  "/App.js": "...",
  "/components/Navbar.jsx": "...",
  "/utils/mockData.js": "..."
}

CRITICAL RULES:
1. Every opening JSX tag must be closed.
2. All string values must have properly escaped quotes (use \\" for quotes inside strings).
3. NEWLINES MUST BE ESCAPED AS \\n inside JSON strings. NO ACTUAL NEWLINES.
4. Output must be a single parseable JSON object.
`;

function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payloadB64 = token.split(".")[1];
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub || null;
  } catch {
    return null;
  }
}

function fixUnescapedNewlines(jsonStr: string): string {
  // Walk through character by character, escaping raw newlines inside JSON strings
  let result = '';
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    // If previous char was backslash, this char is escaped - just add it
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    
    // Backslash starts an escape sequence
    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }
    
    // Toggle string mode on unescaped quotes
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    
    // If inside a string and we hit a RAW newline (not \n), escape it
    if (inString && char === '\n') {
      result += '\\n';
      continue;
    }
    if (inString && char === '\r') {
      result += '\\r';
      continue;
    }
    if (inString && char === '\t') {
      result += '\\t';
      continue;
    }
    
    result += char;
  }
  
  return result;
}

function createFailsafeComponent(errorMessage: string): Record<string, string> {
  return {
    "/App.js": `import React from 'react';
import { AlertTriangle } from 'lucide-react';
export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 text-white">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Generation Error</h1>
        <p className="text-gray-400 mb-4">AI response could not be parsed.</p>
        <pre className="text-xs bg-black/50 p-4 rounded text-red-300 overflow-auto text-left whitespace-pre-wrap">${errorMessage.replace(/"/g, '\\"')}</pre>
      </div>
    </div>
  );
}`
  };
}

async function callGPT4oMini(systemPrompt: string, userPrompt: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${OPENAI_API_KEY}` 
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt }, 
        { role: "user", content: userPrompt }
      ],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const userId = getUserIdFromRequest(req);
  if (!userId) return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const { mode, prompt, currentFiles, assets, theme, userInstructions } = body;
    console.log(`[Mode] ${mode || 'create'} ${theme || 'none'}`);

    if (mode === 'chat') {
      const filesStr = Object.entries(currentFiles || {}).map(([k, v]) => `FILE: ${k}\n${v}`).join('\n\n');
      const answer = await callGPT4oMini("You are a Senior React Architect.", `CODEBASE:\n${filesStr}\n\nQUESTION: ${prompt}`);
      return new Response(JSON.stringify({ ok: true, message: answer }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const selectedThemeDesc = THEME_PRESETS[theme || 'none'] || THEME_PRESETS['none'];
    const finalSystemPrompt = BASE_SYSTEM_PROMPT.replace("{{THEME_INSTRUCTIONS}}", selectedThemeDesc);
    let textPrompt = "";

    if (mode === 'create' || !mode) {
      textPrompt = `CREATE NEW PROJECT.\n\nREQUEST: ${prompt}\n\n${userInstructions || ""}`;
    } else {
      const filesStr = Object.entries(currentFiles || {}).map(([k, v]) => `FILE: ${k}\n${v}`).join('\n\n');
      textPrompt = `EDIT PROJECT.\n\nCURRENT CODE:\n${filesStr}\n\nREQUEST: ${prompt}\n\n${userInstructions || ""}\n\nReturn ONLY changed files in JSON.`;
    }

    if (assets?.length > 0) textPrompt += `\n\nUSE THESE ASSETS: ${assets.join(", ")}`;

    console.log(`[Claude] Mode: ${mode || 'create'}, Prompt length: ${textPrompt.length}, System prompt length: ${finalSystemPrompt.length}`);
    console.log("[Claude] Requesting stream...");
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 16384,
        system: finalSystemPrompt,
        messages: [{ role: "user", content: textPrompt }],
        stream: true,
      }),
    });

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.json();
      throw new Error(err.error?.message || "Anthropic API error");
    }

    let fullContent = "";
    const reader = anthropicResponse.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error("No reader available");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content_block_delta') fullContent += data.delta.text;
          } catch { /* skip incomplete chunks */ }
        }
      }
    }

    console.log(`[Claude] Stream done. Length: ${fullContent.length}`);
    let content = fullContent.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) content = content.substring(jsonStart, jsonEnd + 1);
    
    content = fixUnescapedNewlines(content);

    try {
      const parsed = JSON.parse(content);
      const aiFiles = parsed.files || parsed;
      
      // For edit mode: merge OLD files with NEW AI files (AI files take priority)
      // This preserves unchanged files while applying AI's edits
      let finalFiles: Record<string, string>;
      if (mode === 'edit' && currentFiles) {
        finalFiles = { ...currentFiles, ...aiFiles }; // AI changes override old files
        console.log(`[Edit] Merged ${Object.keys(currentFiles).length} old files with ${Object.keys(aiFiles).length} AI changes`);
      } else {
        finalFiles = aiFiles;
      }
      
      console.log(`[Success] Returning ${Object.keys(finalFiles).length} files`);
      return new Response(JSON.stringify({ 
        ok: true, 
        files: finalFiles, 
        code: finalFiles["/App.js"] || "",
        message: mode === 'edit' ? "Updated." : "Created."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error("[Claude] Parse Error:", errMsg);
      return new Response(JSON.stringify({ 
        ok: true, 
        files: createFailsafeComponent(errMsg),
        code: "", 
        message: "Parse failed."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Fatal Error]", errMsg);
    return new Response(JSON.stringify({ ok: false, error: errMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

