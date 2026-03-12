import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI, FunctionCallingMode } from "https://esm.sh/@google/generative-ai@0.21.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY") || "";

const ADMIN_EMAIL = "admin@tmw.qa";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Tool declarations for Gemini ──────────────────────────────────────────────
const tools = [
  {
    functionDeclarations: [
      {
        name: "get_pulse_summary",
        description:
          "Fetches live high-level KPIs: total users, active paid subscribers, gift subscribers, current MRR, and conversion rate from the ceo_pulse_summary view.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
      },
      {
        name: "get_store_metrics",
        description:
          "Fetches the last 14 days of real Apple App Store download data from the app_metrics table (platform='apple'). Data is synced daily at 7 AM via the sync-apple-stats function. Returns date, platform, downloads, and revenue per row.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
      },
      {
        name: "search_user_status",
        description:
          "Searches for a specific user in the profiles table by email address. Returns their subscription status, plan, last_seen timestamp, and account health.",
        parameters: {
          type: "OBJECT",
          properties: {
            email: {
              type: "STRING",
              description: "The email address of the user to look up.",
            },
          },
          required: ["email"],
        },
      },
    ],
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function executeTool(name: string, args: Record<string, string>, supabase: any): Promise<string> {
  try {
    if (name === "get_pulse_summary") {
      const { data, error } = await supabase.from("ceo_pulse_summary").select("*");
      if (error) return `Error fetching pulse: ${error.message}`;
      return JSON.stringify(data?.[0] ?? { note: "No data returned" });
    }

    if (name === "get_store_metrics") {
      const { data, error } = await supabase
        .from("app_metrics")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(14);
      if (error) {
        if (error.code === "42P01") {
          return JSON.stringify({ note: "app_metrics table does not exist yet. Store metrics are not yet being tracked." });
        }
        return `Error fetching store metrics: ${error.message}`;
      }
      return JSON.stringify(data ?? []);
    }

    if (name === "search_user_status") {
      const email = args.email?.trim();
      if (!email) return "No email provided.";
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, is_subscribed, subscription_status, plan_name, next_billing_date, last_seen, is_suspended, created_at, country")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (error) return `Error searching user: ${error.message}`;
      if (!data) return `No user found with email matching "${email}".`;
      return JSON.stringify(data);
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool execution error: ${String(err)}`;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth & CEO check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Verify CEO identity
    if (user.email !== ADMIN_EMAIL) {
      return json({ error: "Access denied. This endpoint is restricted to the CEO." }, 403);
    }

    if (!GEMINI_API_KEY) {
      return json({ error: "GEMINI_API_KEY not configured in Supabase secrets." }, 500);
    }

    // ── Parse request body ──
    const body = await req.json();
    const { message, history = [] } = body as {
      message: string;
      history: Array<{ role: string; parts: Array<{ text: string }> }>;
    };

    if (!message?.trim()) return json({ error: "No message provided" }, 400);

    // ── Build Gemini model + chat ──
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction:
        "You are the Wakti Intelligence Engine, Abdullah's strategic advisor and executive right hand. " +
        "You have a direct neural link to the platform database. Be concise and strategic. " +
        "Always use the available tools to fetch real data — never guess numbers. " +
        "Highlight growth opportunities and risks like churn or low conversion. " +
        "If you don't have a tool for specific information, say so clearly. " +
        "Format responses with short bullet points or clear paragraphs. No fluff.",
      tools,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
    });

    const chat = model.startChat({ history });

    // ── Agentic loop: send → check tool calls → execute → continue ──
    let response = await chat.sendMessage(message);

    for (let iteration = 0; iteration < 5; iteration++) {
      const candidate = response.response.candidates?.[0];
      if (!candidate) break;

      const functionCalls = candidate.content?.parts?.filter((p: { functionCall?: unknown }) => p.functionCall);
      if (!functionCalls || functionCalls.length === 0) break;

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        functionCalls.map(async (part: { functionCall: { name: string; args: Record<string, string> } }) => {
          const { name, args } = part.functionCall;
          const result = await executeTool(name, args ?? {}, supabase);
          return {
            functionResponse: {
              name,
              response: { result },
            },
          };
        })
      );

      // Send tool results back to model
      response = await chat.sendMessage(toolResults);
    }

    const finalText = response.response.text();

    return json({ reply: finalText });
  } catch (err) {
    console.error("[wakti-ceo-brain] error:", err);
    return json({ error: "Brain offline. Internal error.", details: String(err) }, 500);
  }
});
