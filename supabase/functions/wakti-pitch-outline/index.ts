// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Dokie-style slide structure with rich content
interface SlideOutline {
  slideNumber: number;
  role: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  highlightedStats?: string[];  // e.g., ["75%", "$120B"]
  columns?: { title: string; description: string; icon: string }[];
  imageHint?: string;  // What kind of image to fetch
  layoutHint: string;
  footer?: string;
}

const LAYOUT_MAP: Record<string, string> = {
  cover: "cover",
  contents: "contents",
  problem: "image_right_bullets_left",
  solution: "three_column_cards",
  features: "image_left_bullets_right",
  product: "image_left_bullets_right",
  market: "chart_and_insights",
  target_audience: "four_quadrant_grid",
  business_model: "two_column_split",
  competitive: "comparison_table",
  traction: "stats_highlight",
  team: "three_column_cards",
  roadmap: "timeline",
  ask: "centered_cta",
  thank_you: "cover",
};

async function callGemini(prompt: string): Promise<SlideOutline[]> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=" + geminiKey;
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Gemini error:", text);
    throw new Error("Gemini API error: " + res.status);
  }

  const data = await res.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error("No response from Gemini");

  try {
    const parsed = JSON.parse(responseText);
    return parsed.slides || parsed;
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse response");
    const p = JSON.parse(match[0]);
    return p.slides || p;
  }
}

async function callOpenAI(prompt: string): Promise<SlideOutline[]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + openaiKey,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert presentation designer like Dokie.ai. Create rich, detailed slide outlines with statistics, highlights, and structured content. Respond ONLY with valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 8000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenAI error:", text);
    throw new Error("OpenAI API error: " + res.status);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  try {
    const parsed = JSON.parse(content);
    return parsed.slides || parsed;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse response");
    const p = JSON.parse(match[0]);
    return p.slides || p;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const brief = body.brief;
    const slideCount = body.slideCount || 10;
    const language = body.language || "en";
    const theme = body.theme || "professional";

    if (!brief?.subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Brief is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating Dokie-style outline for: " + brief.subject);

    // DOKIE-QUALITY PROMPT - Much more detailed
    const prompt = language === "ar" 
      ? buildArabicPrompt(brief, slideCount)
      : buildEnglishPrompt(brief, slideCount);

    let slides = null;

    try {
      slides = await callGemini(prompt);
      console.log("Using Gemini");
    } catch (err) {
      console.error("Gemini failed:", err);
    }

    if (!slides || slides.length === 0) {
      slides = await callOpenAI(prompt);
      console.log("Using OpenAI");
    }

    // Post-process: ensure proper layouts and structure
    const validatedSlides = slides.map(function(s, i) {
      const role = s.role || "content";
      return {
        slideNumber: s.slideNumber || i + 1,
        role: role,
        title: s.title || "Slide " + (i + 1),
        subtitle: s.subtitle || null,
        bullets: Array.isArray(s.bullets) ? s.bullets : [],
        highlightedStats: s.highlightedStats || [],
        columns: s.columns || null,
        imageHint: s.imageHint || getImageHint(role, brief.subject),
        layoutHint: LAYOUT_MAP[role] || s.layoutHint || "title_and_bullets",
        footer: brief.subject.substring(0, 30).toUpperCase(),
      };
    });

    console.log("Generated " + validatedSlides.length + " Dokie-style slides");

    return new Response(
      JSON.stringify({ success: true, outline: validatedSlides }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to generate outline" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getImageHint(role, subject) {
  const hints = {
    cover: subject + " professional hero image",
    problem: subject + " challenge difficulty",
    solution: subject + " innovation technology",
    features: subject + " product interface app",
    product: subject + " demo screenshot mockup",
    market: subject + " growth chart business",
    team: "professional team collaboration",
    thank_you: subject + " success celebration",
  };
  return hints[role] || subject + " professional business";
}

function buildEnglishPrompt(brief, slideCount) {
  return `You are an expert presentation designer creating a DETAILED school/business presentation.

TOPIC: ${brief.subject}
OBJECTIVE: ${brief.objective}
AUDIENCE: ${brief.audience}
TONE: ${brief.tone}

Create EXACTLY ${slideCount} slides with RICH, DETAILED content.

RESPOND WITH VALID JSON:
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover",
      "title": "COMPELLING TITLE",
      "subtitle": "Engaging subtitle",
      "bullets": [],
      "imageHint": "${brief.subject}"
    },
    {
      "slideNumber": 2,
      "role": "overview", 
      "title": "WHAT WE'LL COVER",
      "bullets": [
        "**Introduction** - Background and context with specific details",
        "**Key Facts** - Important statistics and data points",
        "**Main Topics** - Core areas we will explore in depth",
        "**Impact** - Real-world significance and effects",
        "**Future** - Upcoming developments and conclusions"
      ],
      "imageHint": "${brief.subject} presentation"
    },
    {
      "slideNumber": 3,
      "role": "background",
      "title": "BACKGROUND & CONTEXT",
      "bullets": [
        "**Historical context** - Development over time with dates",
        "**Current state** - Present situation with specific numbers",
        "**Key players** - Major organizations and people involved",
        "**Global perspective** - International comparison",
        "**Local relevance** - Why this matters locally"
      ],
      "imageHint": "${brief.subject} history"
    },
    {
      "slideNumber": 4,
      "role": "statistics",
      "title": "KEY STATISTICS & DATA",
      "bullets": [
        "**First statistic** - Specific number with context and source",
        "**Second statistic** - Another important metric or percentage",
        "**Third statistic** - Key data point showing impact",
        "**Fourth statistic** - Comparison or trend data"
      ],
      "imageHint": "${brief.subject} data"
    },
    ... continue with more detailed slides until slideNumber ${slideCount}
  ]
}

IMAGE HINT RULES (VERY IMPORTANT):
- imageHint MUST be 2-4 simple words that describe a REAL photo
- ALWAYS start with the main subject: "${brief.subject}"
- Use concrete visual terms: people, building, flag, stadium, meeting, etc.
- NEVER use abstract words: overview, infographic, concept, illustration, banner
- Examples for "ice hockey Canada": "ice hockey players", "hockey stadium Canada", "hockey puck ice"
- Examples for "Qatar Kuwait relations": "Qatar Kuwait flags", "Gulf cooperation meeting", "Doha skyline"

CRITICAL RULES:
1. Generate EXACTLY ${slideCount} slides - first is cover, last is thank_you
2. Each bullet point must be DETAILED (15-25 words minimum)
3. Include SPECIFIC statistics, dates, names, and facts
4. Use **bold** for key terms and statistics
5. ALL slides except cover/thank_you MUST have 4-6 bullet points (NOT columns)
6. Make content educational and informative, not generic`;
}

function buildArabicPrompt(brief, slideCount) {
  return `أنت خبير في تصميم العروض التقديمية المدرسية والتجارية. أنشئ عرضاً تقديمياً مفصلاً وغنياً بالمحتوى.

الموضوع: ${brief.subject}
الهدف: ${brief.objective}
الجمهور: ${brief.audience}
النبرة: ${brief.tone}

أنشئ بالضبط ${slideCount} شريحة مع محتوى مفصل وغني.

أجب بـ JSON صالح فقط:
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover",
      "title": "عنوان جذاب ومقنع",
      "subtitle": "عنوان فرعي توضيحي",
      "bullets": [],
      "imageHint": "education technology classroom"
    },
    {
      "slideNumber": 2,
      "role": "overview",
      "title": "نظرة عامة على المحتوى",
      "bullets": [
        "**المقدمة** - خلفية الموضوع وسياقه مع تفاصيل محددة",
        "**الحقائق الرئيسية** - إحصائيات ونقاط بيانات مهمة",
        "**المواضيع الأساسية** - المجالات الرئيسية التي سنستكشفها",
        "**التأثير** - الأهمية والآثار في العالم الحقيقي"
      ],
      "imageHint": "presentation overview business"
    },
    ... أكمل حتى slideNumber ${slideCount}
  ]
}

قواعد imageHint (مهم جداً):
- يجب أن يكون imageHint بالإنجليزية فقط (2-4 كلمات بسيطة)
- استخدم كلمات مرئية ملموسة: people, building, technology, classroom, meeting
- لا تستخدم كلمات مجردة: overview, infographic, concept, illustration

القواعد الحاسمة:
1. أنشئ بالضبط ${slideCount} شريحة - الأولى غلاف والأخيرة شكر
2. كل نقطة يجب أن تكون مفصلة (15-25 كلمة على الأقل)
3. أضف إحصائيات وتواريخ وأسماء وحقائق محددة
4. استخدم **نص عريض** للمصطلحات والإحصائيات الرئيسية
5. جميع الشرائح (ما عدا الغلاف والشكر) يجب أن تحتوي على 4-6 نقاط مفصلة
6. اجعل المحتوى تعليمياً ومعلوماتياً وليس عاماً`;
}
