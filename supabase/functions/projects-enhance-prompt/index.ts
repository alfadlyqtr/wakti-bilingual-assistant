import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sanitizeUserInput, withUserInputGuard } from "../_shared/promptSafety.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface EnhanceRequest {
  prompt?: unknown;
  theme?: unknown;
  themeInstructions?: unknown;
  hasAssets?: unknown;
  experience?: unknown;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Theme descriptions for EMP
const themeDescriptions: Record<string, string> = {
  'none': '', // No specific theme - let AI decide
  // Cool tones
  'glacier': 'cool glacier theme with soft blues (#60a5fa), lavender (#a5b4fc), and light purples (#c4b5fd) - icy, calm, professional',
  'ocean': 'ocean theme with sky blue (#0ea5e9), cyan (#38bdf8), and light aqua (#7dd3fc) - fresh, clean, trustworthy',
  'lavender': 'lavender theme with soft purple (#a78bfa), lilac (#c4b5fd), and pale violet (#ddd6fe) - elegant, calming, creative',
  // Warm tones
  'harvest': 'harvest theme with amber (#f59e0b), golden yellow (#fbbf24), and warm cream (#fde68a) - warm, inviting, energetic',
  'sunset': 'sunset theme with orange (#f97316), peach (#fb923c), and soft coral (#fdba74) - vibrant, warm, dynamic',
  'orchid': 'orchid theme with pink (#ec4899), rose (#f472b6), and soft blush (#f9a8d4) - feminine, modern, playful',
  'coral': 'coral theme with rose red (#f43f5e), salmon (#fb7185), and soft pink (#fda4af) - bold, energetic, passionate',
  // Nature
  'emerald': 'emerald theme with green (#10b981), mint (#34d399), and seafoam (#6ee7b7) - natural, fresh, growth-oriented',
  'forest': 'forest theme with bright green (#22c55e), lime (#4ade80), and pale green (#86efac) - organic, eco-friendly, vibrant',
  'solar': 'solar theme with gold (#eab308), yellow (#facc15), and light lemon (#fde047) - sunny, optimistic, attention-grabbing',
  // Dark & Bold
  'obsidian': 'obsidian dark theme with slate (#1e293b), charcoal (#334155), and gray (#475569) - sleek, professional, minimal',
  'brutalist': 'brutalist theme with indigo (#6366f1), purple (#a855f7), pink (#ec4899), and red (#f43f5e) - bold, artistic, unconventional',
  'midnight': 'midnight theme with deep indigo (#1e1b4b), dark purple (#312e81), and royal blue (#4338ca) - mysterious, premium, sophisticated',
  // Wakti brand
  'wakti-dark': 'dark premium theme with deep navy (#0c0f14), royal purple (#060541), and subtle gray (#858384)',
  'wakti-light': 'clean light theme with off-white (#fcfefd), deep purple (#060541), and warm beige (#e9ceb0)',
  // Vibrant
  'vibrant': 'vibrant theme with blue (#3b82f6), purple (#8b5cf6), orange (#f97316), and pink (#ec4899) - colorful, energetic, modern',
  'neon': 'neon theme with cyan (#22d3ee), lime (#a3e635), yellow (#facc15), and pink (#f472b6) - electric, futuristic, eye-catching',
};

function preserveOriginalRequest(enhancedPrompt: string, originalPrompt: string): string {
  const marker = "YOUR REQUEST";
  // Older responses (or a slow-to-update model) may still emit the previous
  // internal-sounding heading — treat that as already-preserved too, instead
  // of duplicating the original request under both headings.
  const legacyMarker = "ORIGINAL USER REQUEST (PRESERVED VERBATIM)";
  if ((enhancedPrompt.includes(marker) || enhancedPrompt.includes(legacyMarker)) && enhancedPrompt.includes(originalPrompt)) {
    return enhancedPrompt;
  }
  return `${marker}\n${originalPrompt}\n\n${enhancedPrompt}`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as EnhanceRequest;
    const rawPrompt = body.prompt;
    const theme = typeof body.theme === "string" ? body.theme : "";
    const themeInstructions = typeof body.themeInstructions === "string"
      ? sanitizeUserInput(body.themeInstructions, { label: "theme instructions", maxLength: 2000 })
      : "";
    const hasAssets = Boolean(body.hasAssets);
    const experience = body.experience === "new_project" ? "new project build" : "project build";

    if (!rawPrompt || typeof rawPrompt !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🛡️ Sanitize untrusted user input at the boundary.
    // 🔧 Raised from 4000 to 8000: detailed founder-brief style prompts (exact
    // copy, multiple sections, contact info) can legitimately exceed 4000
    // characters, and truncating them here silently destroys content before
    // the AI ever sees it.
    const prompt = sanitizeUserInput(rawPrompt, { label: "prompt", maxLength: 8000 });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use passed themeInstructions if available, otherwise fall back to simple description
    const themeDesc = themeInstructions || themeDescriptions[theme] || '';
    const assetInfo = hasAssets 
      ? '\n\nThe user has uploaded images that should be used prominently in the design (as hero image, logo, or featured content).'
      : '';

    console.log("[EMP] Enhancing prompt with theme:", theme, themeInstructions ? "(full instructions)" : themeDesc);

    const systemPrompt = withUserInputGuard(`You are Wakti's universal AMP prompt enhancer for new projects. Turn a non-technical user's idea into a build-ready specification that an AI web/app coder can implement accurately.

The user's request is the source of truth. Your job is to make it clearer and more complete without taking anything away from it.

NON-NEGOTIABLE PRESERVATION RULES:
1. Preserve every requirement, exact phrase, named item, URL, email, phone number, number, restriction, preference, and "do not" instruction from the user's request.
2. Start the output with a section named "YOUR REQUEST" and copy the complete sanitized user request exactly. Do not summarize it or replace it with your own words.
3. Never delete, weaken, contradict, or silently change the user's core goal.
4. Never invent factual business information such as names, prices, addresses, contact details, products, services, dates, testimonials, statistics, or payment providers.
5. Never turn a requested real feature into a decorative mockup, fake button, local-only state, or pretend backend behavior.

UNIVERSAL BUILD-BRIEF RULES:
1. Detect the project type from the user's words. Do not assume a salon, store, portfolio, or any other domain when the user did not say one.
2. Detect only the capabilities relevant to this request. When useful, name them with these canonical labels so the coding system can connect the right implementation guidance: phaser_game, stock_images, forms, booking, ecommerce, blog, sports, multi_file_features, comments, chat, roles.
3. Expand implied implementation needs that are necessary to make the user's requested features real: pages, screens, user roles, permissions, workflows, saved backend data, validation, loading states, empty states, errors, and success states.
4. Put every addition you make under "ADDED BUILD REQUIREMENTS" or "SAFE DEFAULTS". Make it clear that these are implementation guidance, not facts supplied by the user.
5. If a decision cannot safely be made, put it under "NEEDS USER DECISION". Do not hide the uncertainty and do not block the whole brief with unnecessary questions.
6. For a simple request, keep the brief focused. For a complex business or app request, provide a complete end-to-end plan.
7. If the user asks for authentication, dashboards, bookings, payments, orders, staff, admin tools, or persistent data, explicitly describe the real workflows and permissions needed.
8. Use real backend data where the platform supports it. Do not request or promise a payment provider, external integration, or capability that the user did not ask for unless it is clearly labeled as optional configuration.
9. Keep the explanation in the same language as the user's request. Keep canonical capability labels unchanged.
10. Return only the enhanced build brief. Do not add an introduction, apology, rating, or commentary outside the brief.

REQUIRED OUTPUT STRUCTURE:
YOUR REQUEST
[the complete user request copied exactly]

PROJECT TYPE
[detected project type, or "Needs clarification" if truly unclear]

PROJECT GOAL
[what the finished project should help people do, without adding a different goal]

DETECTED CAPABILITIES
[only relevant canonical capability labels, with one short reason for each]

REQUIRED PAGES AND SCREENS
[pages needed for the requested experience; include role-specific screens when relevant]

USER TYPES AND PERMISSIONS
[guest, customer, member, staff, admin, or other roles only when relevant]

END-TO-END WORKFLOWS
[the important journeys from start to finish]

BACKEND AND PERSISTENCE REQUIREMENTS
[what must be stored, fetched, updated, and protected so the requested behavior survives refresh and login]

VALIDATION, EMPTY, ERROR, AND SUCCESS STATES
[states needed for a trustworthy user experience]

DESIGN AND THEME DIRECTION
[apply the selected theme and assets without changing the user's product requirements]

ADDED BUILD REQUIREMENTS
[only implementation details needed to make the user's request real]

SAFE DEFAULTS
[reasonable choices that can be made without inventing user facts]

NEEDS USER DECISION
[only decisions that materially affect the build]

BUILD ACCEPTANCE CHECKLIST
[short, testable statements proving the requested project works]

${themeDesc ? `SELECTED THEME:
${themeDesc}` : 'SELECTED THEME: Choose a design direction that fits the detected project type without overriding the user request.'}${assetInfo}

The user experience is: ${experience}.`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 5000,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `ORIGINAL USER REQUEST (SOURCE OF TRUTH):\n${prompt}\n\nCreate the universal build brief now.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      // 🔧 Diagnostic logging: previously we only logged the HTTP status, which
      // hid whether the failure was a bad/expired key (401), quota/billing
      // (429), or an actual OpenAI outage (5xx). Logging the response body lets
      // us pinpoint the real cause from Supabase function logs next time this
      // fires, instead of guessing.
      const errorBody = await response.text().catch(() => '<unable to read response body>');
      console.error(`[EMP] OpenAI API error: status=${response.status} body=${errorBody}`);
      return new Response(
        JSON.stringify({ ok: false, error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim();

    if (!enhancedPrompt) {
      return new Response(
        JSON.stringify({ ok: true, enhancedPrompt: preserveOriginalRequest("", prompt) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const preservedPrompt = preserveOriginalRequest(enhancedPrompt, prompt);
    console.log("[EMP] Enhanced:", preservedPrompt.substring(0, 100));

    return new Response(
      JSON.stringify({ ok: true, enhancedPrompt: preservedPrompt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EMP] Error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
