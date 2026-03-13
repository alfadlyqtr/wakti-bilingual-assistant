import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY") || "";

const ADMIN_EMAIL = "admin@tmw.qa";
const ADMIN_USER_ID = "81a08d4c-391e-4255-9d60-dc41024bad26";
const MODEL = "gemini-2.0-flash";

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

const tools = [
  {
    functionDeclarations: [
      {
        name: "execute_sql",
        description: "Executes any raw SQL query directly against the Wakti Supabase database. Use this for ANY data question: counts, joins, analytics, schema inspection, user lookups, revenue, anything. Always prefer this tool for complex or custom queries. Main tables: profiles, subscriptions, user_voice_usage, ai_logs, events, tasks, app_metrics.",
        parameters: {
          type: "OBJECT",
          properties: {
            sql: { type: "STRING", description: "The raw SQL query. Use standard PostgreSQL syntax. For time filters use: NOW() - INTERVAL '7 days'. Do not use backticks." },
          },
          required: ["sql"],
        },
      },
      {
        name: "get_pulse_summary",
        description: "Fetches live high-level KPIs from the ceo_pulse_summary view: total users, active paid, gift subscribers, MRR, conversion rate.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
      },
      {
        name: "get_user_list",
        description: "Returns users by type. filter='gift' = active gift subs, 'paid' = paid non-gift, 'trial' = free/inactive, 'recent' = last 20 signups.",
        parameters: {
          type: "OBJECT",
          properties: {
            filter: { type: "STRING", description: "One of: gift, paid, trial, recent" },
          },
          required: ["filter"],
        },
      },
      {
        name: "grant_gift",
        description: "Grants a gift subscription to a user by email. Duration: '1_week' or '1_month'.",
        parameters: {
          type: "OBJECT",
          properties: {
            email: { type: "STRING", description: "User email." },
            duration: { type: "STRING", description: "'1_week' or '1_month'" },
          },
          required: ["email", "duration"],
        },
      },
      {
        name: "gift_voice_credits",
        description: "Adds extra TTS/voice characters to a user account.",
        parameters: {
          type: "OBJECT",
          properties: {
            email: { type: "STRING", description: "User email." },
            amount: { type: "NUMBER", description: "Number of characters to add." },
          },
          required: ["email", "amount"],
        },
      },
    ],
  },
];

// deno-lint-ignore no-explicit-any
async function executeTool(name: string, args: Record<string, any>, supabase: any): Promise<string> {
  try {
    if (name === "execute_sql") {
      const sql = args.sql?.trim();
      if (!sql) return "No SQL provided.";
      console.log("[execute_sql] Running:", sql);
      const { data, error } = await supabase.rpc("admin_run_sql", { p_sql: sql });
      if (error) {
        console.error("[execute_sql] RPC error:", error);
        return `SQL Error: ${error.message} (code: ${error.code}, hint: ${error.hint || "none"})`;
      }
      console.log("[execute_sql] Result:", JSON.stringify(data)?.slice(0, 200));
      if (!data || (Array.isArray(data) && data.length === 0)) return "Query returned no rows.";
      return JSON.stringify(data);
    }

    if (name === "get_pulse_summary") {
      const { data, error } = await supabase.from("ceo_pulse_summary").select("*");
      if (error) return `DB error: ${error.message}`;
      return JSON.stringify(data?.[0] || "No data");
    }

    if (name === "get_user_list") {
      const filter = args.filter?.toLowerCase();
      if (filter === "gift") {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("plan_name, gift_duration, next_billing_date, status, profiles(email, display_name)")
          .eq("is_gift", true).eq("status", "active")
          .order("next_billing_date", { ascending: false });
        if (error) return `DB error: ${error.message}`;
        if (!data || data.length === 0) return "No active gift subscribers.";
        const seen = new Set<string>();
        const unique = data.filter((r: any) => { const e = r.profiles?.email; if (!e || seen.has(e)) return false; seen.add(e); return true; });
        return JSON.stringify(unique.map((r: any) => ({ email: r.profiles?.email, name: r.profiles?.display_name, plan: r.plan_name, duration: r.gift_duration, expires: r.next_billing_date })));
      }
      if (filter === "paid") {
        const { data, error } = await supabase.from("profiles").select("email, display_name, plan_name, next_billing_date").eq("is_subscribed", true).not("plan_name", "ilike", "Gift%").limit(50);
        if (error) return `DB error: ${error.message}`;
        return JSON.stringify(data || []);
      }
      if (filter === "trial") {
        const { data, error } = await supabase.from("profiles").select("email, display_name, created_at").eq("is_subscribed", false).eq("subscription_status", "inactive").order("created_at", { ascending: false }).limit(50);
        if (error) return `DB error: ${error.message}`;
        return JSON.stringify(data || []);
      }
      if (filter === "recent") {
        const { data, error } = await supabase.from("profiles").select("email, display_name, is_subscribed, subscription_status, created_at").order("created_at", { ascending: false }).limit(20);
        if (error) return `DB error: ${error.message}`;
        return JSON.stringify(data || []);
      }
      return `Unknown filter "${filter}". Use: gift, paid, trial, recent.`;
    }

    if (name === "grant_gift") {
      const email = args.email?.trim();
      const duration = args.duration?.trim();
      if (!email) return "No email provided.";
      if (!duration || !["1_week", "1_month"].includes(duration)) return "Invalid duration. Use '1_week' or '1_month'.";
      const { data: profile, error: le } = await supabase.from("profiles").select("id, display_name").ilike("email", email).maybeSingle();
      if (le) return `DB error: ${le.message}`;
      if (!profile) return `No user found: "${email}".`;
      const { error: rpcErr } = await supabase.rpc("admin_activate_subscription", {
        p_user_id: profile.id, p_plan_name: "premium", p_billing_amount: 0,
        p_billing_currency: "QAR", p_payment_method: "gift", p_fawran_payment_id: null,
        p_is_gift: true, p_gift_duration: duration, p_gift_given_by: ADMIN_USER_ID,
      });
      if (rpcErr) return `Gift failed: ${rpcErr.message}`;
      return `Gift (${duration.replace("_", " ")}) granted to ${profile.display_name || email}.`;
    }

    if (name === "gift_voice_credits") {
      const email = args.email?.trim();
      const amount = Number(args.amount);
      if (!email) return "No email provided.";
      if (!amount || amount <= 0) return "Invalid amount.";
      const { data: profile, error: le } = await supabase.from("profiles").select("id, display_name").ilike("email", email).maybeSingle();
      if (le) return `DB error: ${le.message}`;
      if (!profile) return `No user found: "${email}".`;
      const { data: existing } = await supabase.from("user_voice_usage").select("id, extra_characters").eq("user_id", profile.id).maybeSingle();
      if (existing) {
        const newTotal = (existing.extra_characters || 0) + amount;
        const { error: ue } = await supabase.from("user_voice_usage").update({ extra_characters: newTotal, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (ue) return `Update failed: ${ue.message}`;
        return `Added ${amount.toLocaleString()} characters to ${profile.display_name || email}. New total: ${newTotal.toLocaleString()}.`;
      } else {
        const { error: ie } = await supabase.from("user_voice_usage").insert({ user_id: profile.id, extra_characters: amount, characters_used: 0, characters_limit: 0 });
        if (ie) return `Insert failed: ${ie.message}`;
        return `Gifted ${amount.toLocaleString()} voice characters to ${profile.display_name || email}.`;
      }
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool exception: ${String(err)}`;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    if (user.email !== ADMIN_EMAIL) return json({ error: "Access denied. CEO only." }, 403);
    if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY missing" }, 500);

    const body = await req.json();
    const { message, history = [] } = body as { message: string; history: Array<{ role: string; parts: Array<{ text: string }> }> };
    if (!message?.trim()) return json({ error: "No message" }, 400);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const systemInstruction = {
      parts: [{ text:
        "You are the Wakti Executive Agent — Abdullah's AI right hand with god-mode database access. " +
        "ALWAYS use the execute_sql tool to answer data questions. Never say you cannot fetch data. " +
        "Write correct PostgreSQL SQL. For date filters: NOW() - INTERVAL '7 days'. " +
        "Tables: profiles (all users, is_subscribed, subscription_status, plan_name, country, created_at), " +
        "subscriptions (is_gift, gift_duration, next_billing_date, status, payment_method), " +
        "user_voice_usage (extra_characters, characters_used), ai_logs (function_name, model, tokens_used, created_at), " +
        "app_metrics (report_date, platform, downloads, revenue). " +
        "Be concise and strategic. Format with bullets or short paragraphs."
      }]
    };

    let currentContents = [...history, { role: "user", parts: [{ text: message }] }];
    const toolDeclarations = { functionDeclarations: tools[0].functionDeclarations };
    let finalText = "";
    let forceTool = true; // first turn: force a tool call

    for (let i = 0; i < 8; i++) {
      const toolConfig = forceTool
        ? { functionCallingConfig: { mode: "ANY" } }   // must call a tool
        : { functionCallingConfig: { mode: "AUTO" } };  // free to respond
      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction,
          contents: currentContents,
          tools: [toolDeclarations],
          toolConfig,
          generationConfig: { temperature: 0.2 },
        }),
      });

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text();
        return json({ error: `Gemini ${geminiRes.status}`, details: errBody }, 500);
      }

      const geminiData = await geminiRes.json();
      const candidate = geminiData?.candidates?.[0];
      if (!candidate) return json({ error: "No Gemini candidate", details: JSON.stringify(geminiData) }, 500);

      const parts = candidate.content?.parts ?? [];
      // deno-lint-ignore no-explicit-any
      const calls = parts.filter((p: any) => p.functionCall);

      if (calls.length === 0) {
        finalText = parts.map((p: { text?: string }) => p.text ?? "").join("");
        break;
      }

      const results = await Promise.all(
        // deno-lint-ignore no-explicit-any
        calls.map(async (p: any) => ({
          functionResponse: {
            name: p.functionCall.name,
            response: { result: await executeTool(p.functionCall.name, p.functionCall.args ?? {}, supabase) },
          },
        }))
      );

      currentContents = [...currentContents, { role: "model", parts }, { role: "user", parts: results }];
      forceTool = false; // subsequent turns: allow free response
    }

    return json({ reply: finalText || "Done." });
  } catch (err) {
    const s = String(err);
    console.error("[ceo-brain] crash:", s);
    return json({ error: "Brain offline.", details: s }, 500);
  }
});
