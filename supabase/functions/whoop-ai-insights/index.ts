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
    const timeOfDay = body?.time_of_day ?? "general";
    const userTimezone = body?.user_timezone ?? "UTC";

    // Enhanced system prompt with time-based coaching
    const system = language === 'ar'
      ? `أنت WAKTI AI - مدرب صحة ولياقة بدنية معتمد متخصص في تحليل بيانات WHOOP.

السياق: ${timeOfDay} - ${userTimezone}
البيانات: أحدث مقاييس النوم والتعافي والإجهاد والتمارين

التعليمات:
- الصباح (5-11 صباحًا): ركز على الاستعداد ومستويات الطاقة وتخطيط التمارين
- منتصف النهار (12-6 مساءً): قيّم الإجهاد الحالي والوتيرة وتذكيرات الترطيب
- المساء (5-11 مساءً): استراتيجيات التعافي وإعداد النوم والتأمل

النبرة: داعمة ومحفزة وقابلة للتطبيق. استخدم اسم المستخدم عند توفره.
التنسيق: أرجع JSON صالح فقط بدون markdown أو نص إضافي.
القيود: لا تشخيص طبي. ركز على تحسين الأداء.`
      : `You are WAKTI AI, a certified health and fitness coach specializing in WHOOP data analysis.

Context: ${timeOfDay} - ${userTimezone}
Data: Latest sleep, recovery, strain, and workout metrics

Instructions:
- Morning (5-11am): Focus on readiness, energy levels, workout planning
- Midday (12-6pm): Assess current strain, pacing, hydration reminders  
- Evening (5-11pm): Recovery strategies, sleep preparation, reflection

Tone: Supportive, motivational, actionable. Use user's name when available.
Format: Return ONLY valid JSON with no markdown or extra text.
Constraints: No medical diagnoses. Focus on performance optimization.`;

    const userPrompt = `Analyze the following WHOOP data and respond with strict JSON format:

REQUIRED STRUCTURE:
{
  "daily_summary": "Brief daily overview with coaching tone",
  "weekly_summary": "Weekly progress and trends analysis", 
  "tips": ["actionable tip 1", "tip 2", "tip 3"],
  "motivations": ["motivational message 1", "message 2"],
  "visuals": [
    {
      "title": "Sleep Quality",
      "type": "donut", 
      "data_keys": ["sleep_hours", "goal_hours"],
      "colors": ["#10B981", "#EF4444"],
      "center_text": "85%"
    },
    {
      "title": "Recovery Trend (7d)",
      "type": "line",
      "data_keys": ["recovery_scores_7d"],
      "gradient": true,
      "color": "#8B5CF6"
    },
    {
      "title": "Today's Strain",
      "type": "gauge",
      "data_keys": ["strain_today", "optimal_strain"],
      "zones": [{"min": 0, "max": 8, "color": "#10B981"}, {"min": 8, "max": 15, "color": "#F59E0B"}, {"min": 15, "max": 21, "color": "#EF4444"}]
    }
  ]
}

DATA:
${JSON.stringify(payload)}`;

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
