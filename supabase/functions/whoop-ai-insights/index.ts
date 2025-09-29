import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_openai_key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.ping) {
      return new Response(JSON.stringify({ ok: true, service: "whoop-ai-insights" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const payload = body?.data ?? {};
    const language = body?.language ?? "en";

    const system = language === 'ar'
      ? "أنت مدرب صحة ولياقة بدنية معتمد. كن إيجابيًا وداعمًا، وقدّم نصائح عملية قصيرة. لخص يوميًا وأسبوعيًا بناءً على البيانات المقدّمة. تجنّب الادعاءات الطبية."
      : "You are a certified health and fitness coach. Be positive, supportive, and actionable. Provide daily and weekly summaries based on the provided data. Avoid medical claims.";

    const userPrompt = `Analyze the following WHOOP aggregates and respond with JSON having keys: daily_summary, weekly_summary, tips (array of 3-5), motivations (array of 2-3), long_summary. Keep it concise, supportive, and actionable.\n\nDATA:\n${JSON.stringify(payload)}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("openai error", resp.status, t);
      return new Response(JSON.stringify({ error: "openai_error", status: resp.status, body: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("whoop-ai-insights error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
