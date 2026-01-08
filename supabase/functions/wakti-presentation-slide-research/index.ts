// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Language = "en" | "ar";

interface RequestBody {
  topic: string;
  slideNumber: number;
  slideCount: number;
  language: Language;
  objective: string;
  audience: string;
  scenario: string;
  tone: string;
  currentTitle?: string;
  currentBullets?: string[];
  query?: string;
}

async function callGeminiGrounded(prompt: string): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

  console.log("🔍 Attempting Gemini grounded search...");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search_retrieval: {} }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1400,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Gemini grounded error:", text);
    throw new Error("Gemini grounded API error: " + res.status);
  }

  const data = await res.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error("No response from Gemini grounded");
  console.log("✅ Gemini grounded success");
  return responseText;
}

async function callTavilySearch(prompt: string, topic: string): Promise<string> {
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyKey) throw new Error("TAVILY_API_KEY not configured");

  console.log("🔍 Attempting Tavily search as fallback...");
  
  // Extract a search query from the prompt (first 100 chars or until newline)
  const searchQuery = topic.substring(0, 100);
  
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: searchQuery,
      max_results: 5,
      include_answer: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Tavily search error:", text);
    throw new Error("Tavily API error: " + res.status);
  }

  const data = await res.json();
  const answer = data?.answer || "";
  const results = data?.results || [];
  
  if (!answer && results.length === 0) {
    throw new Error("No search results from Tavily");
  }

  // Build a context string from search results
  const context = results
    .map((r: any) => `- ${r.title}: ${r.content}`)
    .join("\n");

  // Use Claude/OpenAI to structure the search results into slide format
  const structurePrompt = prompt + `\n\nWeb search context:\n${answer}\n\n${context}`;
  
  // Try OpenAI to structure the results
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured for Tavily fallback");

  const structureRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: structurePrompt }],
      temperature: 0.6,
      max_tokens: 1400,
    }),
  });

  if (!structureRes.ok) {
    const text = await structureRes.text();
    console.error("❌ OpenAI structure error:", text);
    throw new Error("OpenAI structure error: " + structureRes.status);
  }

  const structureData = await structureRes.json();
  const responseText = structureData?.choices?.[0]?.message?.content;
  if (!responseText) throw new Error("No response from OpenAI structure");
  
  console.log("✅ Tavily + OpenAI fallback success");
  return responseText;
}

function buildPrompt(body: RequestBody): string {
  const baseContext = body.language === "ar"
    ? `أنت مساعد لإنشاء محتوى شريحة واحدة داخل عرض تقديمي. يجب أن يكون البحث موجهاً للعرض فقط (ليس بحثاً عاماً).

السياق (من قوائم العرض):
- الموضوع: ${body.topic}
- الهدف: ${body.objective}
- الجمهور: ${body.audience}
- السيناريو: ${body.scenario}
- النبرة: ${body.tone}

هذه هي الشريحة رقم ${body.slideNumber} من أصل ${body.slideCount}.`
    : `You create content for ONE slide inside a presentation. The web search must be presentation-focused (not generic).

Presentation dropdown context:
- Topic: ${body.topic}
- Objective: ${body.objective}
- Audience: ${body.audience}
- Scenario: ${body.scenario}
- Tone: ${body.tone}

This is slide ${body.slideNumber} of ${body.slideCount}.`;

  const existing = (body.currentTitle || (body.currentBullets && body.currentBullets.length))
    ? (body.language === "ar"
      ? `\n\nالمحتوى الحالي للشريحة (إن وجد):\n- العنوان: ${body.currentTitle || ""}\n- النقاط: ${(body.currentBullets || []).join(" | ")}`
      : `\n\nCurrent slide content (if any):\n- Title: ${body.currentTitle || ""}\n- Bullets: ${(body.currentBullets || []).join(" | ")}`)
    : "";

  const userQuery = body.query?.trim()
    ? (body.language === "ar"
      ? `\n\nطلب المستخدم للبحث: ${body.query.trim()}`
      : `\n\nUser research request: ${body.query.trim()}`)
    : "";

  const instruction = body.language === "ar"
    ? `\n\nمطلوب: أعد JSON صالح فقط بالشكل التالي (بدون أي نص إضافي):
{
  "title": "عنوان الشريحة",
  "subtitle": "(اختياري)",
  "bullets": ["نقطة 1", "نقطة 2", "نقطة 3", "نقطة 4"]
}

قواعد صارمة:
- لا تخرج عن سياق العرض (الهدف/الجمهور/السيناريو/النبرة)
- اجعل النقاط واضحة وقابلة للعرض (4-6 نقاط قصيرة)
- لا تذكر مصادر وروابط داخل النقاط
- إذا كانت الشريحة غامضة، قدّم تعريف + مثال + رقم/إحصائية واحدة حديثة من البحث`
    : `\n\nReturn valid JSON only (no extra text):
{
  "title": "Slide title",
  "subtitle": "(optional)",
  "bullets": ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4"]
}

Strict rules:
- Must align with the presentation dropdown context (objective/audience/scenario/tone)
- 4-6 short, slide-ready bullets
- Do not include sources/links inside bullets
- If unclear, provide a definition + example + ONE recent stat from the grounded search`;

  return `${baseContext}${existing}${userQuery}${instruction}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as RequestBody;

    if (!body.topic?.trim()) {
      return new Response(JSON.stringify({ success: false, error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(body);
    let raw: string;
    let usedProvider = "gemini";
    let usedModel = "gemini-2.5-flash-lite";

    // Try Gemini grounded first
    try {
      raw = await callGeminiGrounded(prompt);
    } catch (geminiError) {
      console.error("⚠️ Gemini failed, trying Tavily fallback...");
      try {
        raw = await callTavilySearch(prompt, body.topic);
        usedProvider = "tavily";
        usedModel = "tavily+gpt-4o-mini";
      } catch (tavilyError) {
        console.error("❌ Both Gemini and Tavily failed");
        throw new Error(`Gemini: ${geminiError instanceof Error ? geminiError.message : "Unknown"} | Tavily: ${tavilyError instanceof Error ? tavilyError.message : "Unknown"}`);
      }
    }

    let slide;
    try {
      slide = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Failed to parse response as JSON");
      slide = JSON.parse(match[0]);
    }

    const normalized = {
      title: String(slide?.title || ""),
      subtitle: slide?.subtitle ? String(slide.subtitle) : "",
      bullets: Array.isArray(slide?.bullets)
        ? slide.bullets.map((b: unknown) => String(b)).filter(Boolean)
        : [],
    };

    await logAIFromRequest(req, {
      functionName: "wakti-presentation-slide-research",
      provider: usedProvider as "gemini" | "tavily",
      model: usedModel,
      inputText: body.topic,
      status: "success",
      metadata: { slideNumber: body.slideNumber, slideCount: body.slideCount },
    });

    return new Response(JSON.stringify({ success: true, slide: normalized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);

    await logAIFromRequest(req, {
      functionName: "wakti-presentation-slide-research",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
