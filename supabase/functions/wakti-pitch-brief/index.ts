// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BriefRequest {
  topic: string;
  slideCount: number;
  researchMode: boolean;
  language: 'en' | 'ar';
}

interface BriefResponse {
  success: boolean;
  brief?: {
    subject: string;
    objective: string;
    audience: string;
    scenario: string;
    tone: string;
    language: 'en' | 'ar';
    themeHint: string;
    researchContext?: string;
  };
  error?: string;
}

// Tavily search for research mode
async function searchWithTavily(query: string): Promise<string> {
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyKey) {
    console.warn("TAVILY_API_KEY not configured, skipping research");
    return "";
  }

  try {
    console.log("🔍 Tavily search for:", query);
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: query,
        search_depth: "advanced",
        include_answer: true,
        max_results: 5
      })
    });

    if (!response.ok) {
      console.error("Tavily error:", response.status);
      return "";
    }

    const data = await response.json();
    let context = "";
    
    if (data.answer) {
      context += `Research Summary: ${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      context += "Key Facts:\n";
      data.results.slice(0, 3).forEach((r: any, i: number) => {
        context += `${i + 1}. ${r.title}: ${r.content?.substring(0, 200) || ""}\n`;
      });
    }
    
    console.log("✅ Tavily research found:", context.substring(0, 200));
    return context;
  } catch (err) {
    console.error("Tavily search error:", err);
    return "";
  }
}

// Call OpenAI API (primary)
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.error("OpenAI error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("OpenAI call failed:", err);
    return null;
  }
}

// Call Gemini API (fallback)
async function callGemini(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return null;

  try {
    // Try correct Gemini model names
    const models = ["gemini-2.0-flash-001", "gemini-1.5-flash", "gemini-pro"];
    
    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024
              }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            console.log(`✅ Gemini ${model} succeeded`);
            return text;
          }
        }
        console.log(`⚠️ Gemini ${model} failed, trying next...`);
      } catch (e) {
        console.log(`⚠️ Gemini ${model} error:`, e);
      }
    }
    return null;
  } catch (err) {
    console.error("Gemini call failed:", err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { topic, slideCount, researchMode, language } = await req.json() as BriefRequest;

    if (!topic?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Topic is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Generating brief for: "${topic}" (${language}, ${slideCount} slides, research: ${researchMode})`);

    // If research mode is ON, search with Tavily first
    let researchContext = "";
    if (researchMode) {
      researchContext = await searchWithTavily(topic);
    }

    // Build prompts
    const systemPrompt = language === 'ar' 
      ? `أنت مساعد متخصص في إنشاء العروض التقديمية. أجب بصيغة JSON فقط:
{
  "subject": "الموضوع الرئيسي",
  "objective": "educate_audience أو pitch_investors أو training",
  "audience": "students أو investors أو general_public",
  "scenario": "classroom أو conference أو pitch_meeting",
  "tone": "professional أو data_driven أو inspirational",
  "themeHint": "academic_blue أو dark_fintech أو clean_minimal"
}`
      : `You are a presentation expert. Respond with JSON only:
{
  "subject": "Main presentation title",
  "objective": "educate_audience or pitch_investors or training",
  "audience": "students or investors or general_public",
  "scenario": "classroom or conference or pitch_meeting",
  "tone": "professional or data_driven or inspirational",
  "themeHint": "academic_blue or dark_fintech or clean_minimal"
}`;

    let userPrompt = language === 'ar'
      ? `أنشئ ملخصًا للعرض التقديمي حول: "${topic}"\nعدد الشرائح: ${slideCount}`
      : `Create a presentation brief for: "${topic}"\nSlide count: ${slideCount}`;

    // Add research context if available
    if (researchContext) {
      userPrompt += `\n\nResearch findings to incorporate:\n${researchContext}`;
    }

    // Try OpenAI first, then Gemini
    console.log("🤖 Trying OpenAI...");
    let responseText = await callOpenAI(systemPrompt, userPrompt);
    
    if (!responseText) {
      console.log("🤖 OpenAI failed, trying Gemini...");
      responseText = await callGemini(systemPrompt, userPrompt);
    }

    if (!responseText) {
      throw new Error("All AI providers failed");
    }

    console.log("AI response:", responseText.substring(0, 200));

    // Parse JSON response
    let briefData;
    try {
      briefData = JSON.parse(responseText);
    } catch (e) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        briefData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    const brief = {
      subject: briefData.subject || topic,
      objective: briefData.objective || 'educate_audience',
      audience: briefData.audience || 'students',
      scenario: briefData.scenario || 'classroom',
      tone: briefData.tone || 'professional',
      language,
      themeHint: briefData.themeHint || 'academic_blue',
      researchContext: researchContext || undefined,
    };

    console.log("✅ Generated brief:", brief.subject);

    return new Response(
      JSON.stringify({ success: true, brief } as BriefResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to generate brief" 
      } as BriefResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
