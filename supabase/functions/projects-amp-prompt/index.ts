// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, mode, files } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // System prompt for amplifying user requests - STRICT NO-GUESS MODE
    // This helps amateur users without changing their intent or adding assumptions
    const systemPrompt = mode === 'code' 
      ? `You are a STRICT intent-preserving prompt formatter for an AI code editor.

🚨 ABSOLUTE RULES - NEVER BREAK THESE:
1. NEVER add features, elements, or changes the user did NOT explicitly ask for
2. NEVER guess or assume what the user wants - only reformat what they said
3. NEVER invent targets - if user says "my name", keep it as "name element", don't guess "header" or "profile card"
4. PRESERVE the user's exact words for targets (name, title, button, etc.)
5. Keep it as a direct command, not a question

YOUR ONLY JOB:
- Reformat the user's request into a clearer structure
- Add search hints based on their words (not invented ones)
- Add a "don't change anything else" constraint

OUTPUT FORMAT (always use this structure):
TARGET: [exact element user mentioned]
CHANGE: [exact change user requested]
CONSTRAINT: Do not modify anything else
SEARCH: [keywords from user's request to help locate the element]

EXAMPLES:

User: "change my name color to white"
OUTPUT:
TARGET: name text element
CHANGE: text color → white
CONSTRAINT: Do not modify anything else
SEARCH: name, displayName, userName, profile

User: "make the button bigger"
OUTPUT:
TARGET: button element
CHANGE: increase size (padding, font-size, or scale)
CONSTRAINT: Do not modify anything else
SEARCH: button, btn, Button

User: "fix the header"
OUTPUT:
TARGET: header element
CHANGE: [user did not specify - ask them what to fix]
CONSTRAINT: Do not modify anything else
SEARCH: header, Header, nav

CRITICAL: If the user's request is too vague (like "fix it" or "make it better"), output:
UNCLEAR: Please specify what exactly you want to change and how.

Never guess. Never add. Only reformat.`
      : `You are a STRICT intent-preserving prompt formatter.

RULES:
1. PRESERVE the user's exact intent - do not add or change anything
2. If it's a question, keep it as a question but clearer
3. If it's a command, keep it as a command but clearer
4. NEVER add features or suggestions the user didn't ask for
5. If the request is too vague, ask for clarification instead of guessing

Output ONLY the reformatted message, nothing else.`;

    // If files provided (code mode), scan for likely matches
    let likelyFiles: string[] = [];
    if (mode === 'code' && files && typeof files === 'object') {
      const promptLower = prompt.toLowerCase();
      const searchTerms = promptLower
        .split(/\s+/)
        .filter((w: string) => w.length > 2 && !['the', 'and', 'for', 'make', 'change', 'add', 'fix', 'update', 'color', 'size', 'text'].includes(w));
      
      // Scan files for matches
      const fileMatches: Array<{ path: string; score: number; matches: string[] }> = [];
      
      for (const [filePath, content] of Object.entries(files)) {
        if (typeof content !== 'string') continue;
        const contentLower = content.toLowerCase();
        let score = 0;
        const matches: string[] = [];
        
        for (const term of searchTerms) {
          if (contentLower.includes(term)) {
            score += 2;
            // Find the line with the match
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(term)) {
                matches.push(`line ${i + 1}: "${lines[i].trim().substring(0, 60)}"`);
                break; // Just first match per term
              }
            }
          }
        }
        
        // Bonus for UI files
        if (filePath.includes('App') || filePath.includes('Home') || filePath.includes('Hero')) score += 1;
        
        if (score > 0) {
          fileMatches.push({ path: filePath, score, matches });
        }
      }
      
      // Sort by score and take top 3
      fileMatches.sort((a, b) => b.score - a.score);
      likelyFiles = fileMatches.slice(0, 3).map(f => `${f.path} (${f.matches.slice(0, 2).join(', ')})`);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Original request: "${prompt}"\n\nAmplified version:` }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to amplify prompt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let amplified = data.choices?.[0]?.message?.content?.trim();
    
    // Append LIKELY FILES if we found matches (code mode only)
    if (mode === 'code' && likelyFiles.length > 0 && amplified && !amplified.startsWith('UNCLEAR:')) {
      amplified += `\nLIKELY FILES: ${likelyFiles.join(', ')}`;
    }

    if (!amplified) {
      return new Response(
        JSON.stringify({ error: "No amplified content returned" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ amplified, original: prompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in projects-amp-prompt:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
