// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

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

async function callGeminiGrounded(prompt: string): Promise<SlideOutline[]> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=" + geminiKey;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search_retrieval: {} }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Gemini grounded error:", text);
    throw new Error("Gemini grounded API error: " + res.status);
  }

  const data = await res.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error("No response from Gemini grounded");

  try {
    const parsed = JSON.parse(responseText);
    return parsed.slides || parsed;
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse grounded response");
    const p = JSON.parse(match[0]);
    return p.slides || p;
  }
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

async function _callGemini(prompt: string): Promise<SlideOutline[]> {
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

type InputMode = 'verbatim' | 'polish' | 'topic_only';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const brief = body.brief;
    const slideCount = body.slideCount || 10;
    const language = body.language || "en";
    const _theme = body.theme || "professional"; // Reserved for future use
    const inputMode: InputMode = body.inputMode || "topic_only";
    const originalText: string = body.originalText || "";
    const researchMode: boolean = Boolean(body.researchMode);

    if (!brief?.subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Brief is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating outline for: ${brief.subject} (mode: ${inputMode})`);

    // VERBATIM MODE: bypass AI and build slides directly from the user's text
    if (inputMode === "verbatim" && originalText.trim()) {
      // Split into lines and stanzas (blank line = new stanza)
      const rawLines = originalText.split(/\r?\n/);
      const nonEmptyLines = rawLines.map(l => l.trim()).filter(Boolean);

      let stanzas: string[][] = [];
      let current: string[] = [];
      for (const line of rawLines) {
        if (!line.trim()) {
          if (current.length) {
            stanzas.push(current);
            current = [];
          }
        } else {
          current.push(line.trim());
        }
      }
      if (current.length) {
        stanzas.push(current);
      }

      // Fallback: if we couldn't detect stanzas, treat all non-empty lines as one stanza
      if (stanzas.length === 0 && nonEmptyLines.length > 0) {
        stanzas = [nonEmptyLines];
      }

      const slides: SlideOutline[] = [];

      // Generate simple, meaningful slide titles for verbatim mode
      const slideTitles = [
        brief.subject || "My Message",
        language === "ar" ? "كلماتي" : "My Words",
        language === "ar" ? "من القلب" : "From the Heart",
        language === "ar" ? "شكراً لك" : "Thank You",
        language === "ar" ? "دائماً" : "Always & Forever",
      ];

      // Cover slide
      slides.push({
        slideNumber: 1,
        role: "cover",
        title: brief.subject || "My Message",
        subtitle: "",
        bullets: [],
        layoutHint: LAYOUT_MAP.cover,
        imageHint: getImageHint("cover", brief.subject, brief),
        footer: brief.subject.substring(0, 30).toUpperCase(),
      });

      // Content slides: one per stanza, up to slideCount - 1
      const maxContentSlides = Math.max(0, (slideCount || 1) - 1);
      stanzas.slice(0, maxContentSlides).forEach((stanza, index) => {
        // Use a simple title, not the first line of the stanza
        const slideTitle = slideTitles[index + 1] || `Part ${index + 1}`;
        
        // ALL lines of the stanza go into bullets (the user's exact words)
        slides.push({
          slideNumber: index + 2,
          role: "content",
          title: slideTitle,
          subtitle: null,
          bullets: stanza, // All lines exactly as written
          highlightedStats: [],
          columns: null,
          imageHint: getImageHint("content", brief.subject, brief),
          layoutHint: "title_and_bullets",
          footer: brief.subject.substring(0, 30).toUpperCase(),
        });
      });

      console.log(`Generated ${slides.length} verbatim slides (no AI)`);

      return new Response(
        JSON.stringify({ success: true, outline: slides }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For polish/topic-only modes, fall back to AI-based generation
    const prompt = language === "ar" 
      ? buildArabicPrompt(brief, slideCount, inputMode, originalText)
      : buildEnglishPrompt(brief, slideCount, inputMode, originalText);

    let slides: SlideOutline[] | null = null;
    let usedProvider: "openai" | "gemini" = "openai";
    let usedModel = "gpt-4o-mini";

    if (researchMode) {
      slides = await callGeminiGrounded(prompt);
      usedProvider = "gemini";
      usedModel = "gemini-2.0-flash-001";
      console.log("Using Gemini grounded");
    } else {
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
        imageHint: s.imageHint || getImageHint(role, brief.subject, brief),
        layoutHint: LAYOUT_MAP[role] || s.layoutHint || "title_and_bullets",
        footer: brief.subject.substring(0, 30).toUpperCase(),
      };
    });

    console.log("Generated " + validatedSlides.length + " Dokie-style slides");

    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-pitch-outline",
      provider: usedProvider,
      model: usedModel,
      inputText: brief.subject,
      status: "success",
      metadata: { slideCount: validatedSlides.length }
    });

    return new Response(
      JSON.stringify({ success: true, outline: validatedSlides }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-pitch-outline",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "error",
      errorMessage: (error as Error).message
    });

    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Failed to generate outline" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Content type classifier - determines how the AI should behave
type ContentType = 'personal' | 'creative' | 'informational';

type BriefLike = {
  objective?: string;
  audience?: string;
  tone?: string;
};

function detectContentType(subject: string, originalText: string, brief?: BriefLike): ContentType {
  // Personal / Love / Tribute indicators
  const personalKeywords = /\b(love|wife|husband|spouse|partner|darling|dearest|dear|tribute|anniversary|wedding|romantic|heart|family|home|mom|dad|mother|father|son|daughter|baby|child|friend|bestie|bff|thank you|grateful|appreciation|memory|memories|miss you|i love)\b/i;
  
  // Creative / Story / Poem indicators
  const creativeKeywords = /\b(poem|poetry|story|tale|once upon|chapter|verse|stanza|rhyme|fiction|novel|dream|imagine|fantasy)\b/i;
  
  // Check brief fields first (most reliable)
  const briefIndicatesPersonal = 
    brief?.objective === 'express_love' ||
    brief?.objective === 'celebrate_someone' ||
    brief?.audience === 'partner_spouse' ||
    brief?.audience === 'family' ||
    brief?.tone === 'romantic' ||
    brief?.tone === 'heartfelt';
  
  // Check text content
  const textIsPersonal = personalKeywords.test(subject) || personalKeywords.test(originalText);
  const textIsCreative = creativeKeywords.test(subject) || creativeKeywords.test(originalText);
  
  // Poem detection: multiple short lines, rhyming patterns, or stanza structure
  const lines = originalText.split(/\r?\n/).filter(l => l.trim());
  const avgLineLength = lines.length > 0 ? originalText.length / lines.length : 100;
  const looksLikePoem = lines.length >= 3 && avgLineLength < 60; // Short lines = likely poem
  
  if (briefIndicatesPersonal || textIsPersonal || looksLikePoem) {
    return 'personal';
  }
  if (textIsCreative) {
    return 'creative';
  }
  return 'informational';
}

// Smart image hint generator based on content type
function getImageHint(role: string, subject: string, brief?: BriefLike): string {
  // Detect if this is a love/tribute/personal scenario
  const loveKeywords = /\b(love|wife|husband|spouse|partner|darling|dearest|tribute|anniversary|wedding|romantic|heart|family|home)\b/i;
  const isPersonal = loveKeywords.test(subject) || 
    brief?.objective === 'express_love' || 
    brief?.audience === 'partner_spouse' ||
    brief?.tone === 'romantic' ||
    brief?.tone === 'heartfelt';

  if (isPersonal) {
    // Romantic / personal image hints
    const personalHints: Record<string, string> = {
      cover: "romantic couple sunset silhouette",
      content: "couple holding hands warm light",
      problem: "husband wife cozy home evening",
      solution: "family together happy moment",
      thank_you: "romantic flowers hearts love",
    };
    return personalHints[role] || "romantic couple warm light";
  }

  // Default business/academic hints
  const defaultHints: Record<string, string> = {
    cover: subject + " professional hero image",
    problem: subject + " challenge difficulty",
    solution: subject + " innovation technology",
    features: subject + " product interface app",
    product: subject + " demo screenshot mockup",
    market: subject + " growth chart business",
    team: "professional team collaboration",
    thank_you: subject + " success celebration",
  };
  return defaultHints[role] || subject + " professional business";
}

function buildEnglishPrompt(brief, slideCount, inputMode: InputMode, originalText: string) {
  // Detect content type to adjust behavior
  const contentType = detectContentType(brief.subject, originalText, brief);
  const isPersonalContent = contentType === 'personal' || contentType === 'creative';
  
  console.log(`Content type detected: ${contentType}, isPersonal: ${isPersonalContent}`);
  
  // Build mode-specific instructions
  let modeInstruction = '';
  let textSection = '';
  
  if (inputMode === 'verbatim' && originalText) {
    modeInstruction = `
⚠️ CRITICAL: VERBATIM MODE - USE THE USER'S EXACT TEXT
The user wants their words used EXACTLY as written. 
- DO NOT invent dates, places, events, or statistics
- DO NOT add fictional details like "July 2018" or "vacation to Bali"
- ONLY use what is explicitly stated in their text
- Split their text into slides, keeping their exact wording
- If they wrote a poem, each stanza can be a slide`;
    textSection = `

USER'S ORIGINAL TEXT (use EXACTLY as written):
"""
${originalText}
"""`;
  } else if (inputMode === 'polish' && originalText) {
    modeInstruction = `
⚠️ CRITICAL: POLISH MODE - IMPROVE BUT KEEP 100% AUTHENTIC
The user wants their text polished but keeping their voice.

ABSOLUTE RULES:
- DO NOT invent ANY dates, years, places, trips, events, or statistics
- DO NOT add fictional details like "first meeting in 2015" or "trip to Paris" or "12 countries"
- DO NOT create "Key Statistics" or "Background" sections for personal content
- ONLY use information that is EXPLICITLY written in their original text
- Keep all names, emotions, and sentiments from the original
- You may ONLY: improve grammar, add smooth transitions, group lines better
- If it's a poem/tribute/love letter, preserve the emotional essence completely

SLIDE STRUCTURE FOR PERSONAL CONTENT:
- Use simple, emotional titles like "My Words", "From the Heart", "Thank You"
- DO NOT use business titles like "Key Facts", "Background & Context", "Statistics"
- Each slide should contain the user's actual words, just organized better`;
    textSection = `

USER'S ORIGINAL TEXT (polish but keep 100% authentic - no invented facts):
"""
${originalText}
"""`;
  } else if (inputMode === 'topic_only' && isPersonalContent) {
    // SMART TOPIC-ONLY FOR PERSONAL CONTENT
    // Allow creative structure but ban fake biographical facts
    modeInstruction = `
⚠️ TOPIC-ONLY MODE FOR PERSONAL/EMOTIONAL CONTENT
You may create a structured presentation around this personal topic.

ALLOWED:
- Create emotional, heartfelt slide titles
- Organize themes (gratitude, love, memories, future together)
- Add poetic or reflective language
- Structure the message into a beautiful flow

STRICTLY FORBIDDEN:
- DO NOT invent specific dates ("first met in 2015", "married in 2018")
- DO NOT invent specific places ("trip to Paris", "vacation in Bali")
- DO NOT invent specific events ("engagement", "12 countries visited")
- DO NOT invent numbers ("5 years together", "3 children")
- DO NOT claim facts about their private life that aren't stated

SLIDE STRUCTURE:
- Use emotional titles: "The Love We Share", "What You Mean to Me", "Our Journey", "Forever Grateful"
- Focus on feelings, not fake biography
- Keep it authentic to the emotional tone`;
    textSection = originalText ? `

USER'S ORIGINAL TEXT (use as inspiration, but NO invented biographical facts):
"""
${originalText}
"""` : '';
  } else {
    // INFORMATIONAL TOPIC-ONLY (full freedom)
    modeInstruction = `
TOPIC-ONLY MODE: Create fresh, detailed content about the topic.
You may add relevant statistics, facts, and examples.`;
  }

  // Different JSON template based on content type
  if (isPersonalContent) {
    return `You are an expert at creating beautiful, emotional presentations.${modeInstruction}

TOPIC: ${brief.subject}
OBJECTIVE: ${brief.objective}
AUDIENCE: ${brief.audience}
TONE: ${brief.tone}${textSection}

Create EXACTLY ${slideCount} slides with EMOTIONAL, PERSONAL content.

RESPOND WITH VALID JSON:
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover",
      "title": "${brief.subject}",
      "subtitle": "A heartfelt message",
      "bullets": [],
      "imageHint": "romantic couple sunset silhouette"
    },
    {
      "slideNumber": 2,
      "role": "content",
      "title": "THE LOVE WE SHARE",
      "bullets": [
        "Heartfelt statement about what they mean to you",
        "Expression of gratitude and appreciation",
        "What makes them special in your life"
      ],
      "imageHint": "couple holding hands warm light"
    },
    {
      "slideNumber": 3,
      "role": "content",
      "title": "WHAT YOU MEAN TO ME",
      "bullets": [
        "How they make your life better",
        "The qualities you admire most",
        "Your feelings expressed from the heart"
      ],
      "imageHint": "family together happy moment"
    },
    {
      "slideNumber": 4,
      "role": "thank_you",
      "title": "THANK YOU, MY LOVE",
      "bullets": [],
      "imageHint": "romantic flowers hearts love"
    }
  ]
}

IMAGE HINT RULES FOR PERSONAL CONTENT:
- Use romantic, warm, emotional image queries
- Examples: "romantic couple sunset", "family home cozy", "holding hands warm light", "flowers hearts love"
- NEVER use business/corporate imagery

CRITICAL RULES:
1. Generate EXACTLY ${slideCount} slides
2. Use EMOTIONAL, PERSONAL titles - NOT business titles
3. NO "Key Statistics", "Background & Context", "Market Analysis" etc.
4. Keep content heartfelt and authentic
5. Remember: NO invented dates, places, trips, or numbers`;
  }

  // Informational content template (original business style)
  return `You are an expert presentation designer.${modeInstruction}

TOPIC: ${brief.subject}
OBJECTIVE: ${brief.objective}
AUDIENCE: ${brief.audience}
TONE: ${brief.tone}${textSection}

Create EXACTLY ${slideCount} slides.

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

CRITICAL RULES:
1. Generate EXACTLY ${slideCount} slides - first is cover, last is thank_you
2. Each bullet point must be DETAILED (15-25 words minimum)
3. Include SPECIFIC statistics, dates, names, and facts
4. Use **bold** for key terms and statistics
5. ALL slides except cover/thank_you MUST have 4-6 bullet points (NOT columns)
6. Make content educational and informative, not generic`;
}

function buildArabicPrompt(brief, slideCount, inputMode: InputMode, originalText: string) {
  // Detect content type to adjust behavior
  const contentType = detectContentType(brief.subject, originalText, brief);
  const isPersonalContent = contentType === 'personal' || contentType === 'creative';
  
  // Build mode-specific instructions
  let modeInstruction = '';
  let textSection = '';
  
  if (inputMode === 'verbatim' && originalText) {
    modeInstruction = `
⚠️ مهم جداً: وضع النص الحرفي
المستخدم يريد استخدام نصه كما هو بالضبط.
- لا تخترع تواريخ أو أماكن أو أحداث
- استخدم فقط ما هو مكتوب في النص الأصلي
- قسّم النص إلى شرائح مع الحفاظ على الكلمات الأصلية`;
    textSection = `

نص المستخدم الأصلي (استخدمه كما هو):
"""
${originalText}
"""`;
  } else if (inputMode === 'polish' && originalText) {
    modeInstruction = `
⚠️ مهم جداً: وضع التحسين
المستخدم يريد تحسين نصه مع الحفاظ على أصالته.
- لا تخترع تفاصيل غير موجودة في النص الأصلي
- حسّن التدفق والبنية فقط
- احتفظ بجميع الأسماء والمشاعر من النص الأصلي`;
    textSection = `

نص المستخدم الأصلي (حسّنه مع الحفاظ على الأصالة):
"""
${originalText}
"""`;
  } else if (inputMode === 'topic_only' && isPersonalContent) {
    // SMART TOPIC-ONLY FOR PERSONAL CONTENT (Arabic)
    modeInstruction = `
⚠️ وضع الموضوع للمحتوى الشخصي/العاطفي
يمكنك إنشاء عرض تقديمي منظم حول هذا الموضوع الشخصي.

مسموح:
- إنشاء عناوين عاطفية وصادقة
- تنظيم المواضيع (الامتنان، الحب، الذكريات، المستقبل معاً)
- إضافة لغة شعرية أو تأملية

ممنوع تماماً:
- لا تخترع تواريخ محددة ("التقينا في 2015")
- لا تخترع أماكن محددة ("رحلة إلى باريس")
- لا تخترع أحداث ("خطوبة"، "12 دولة زرناها")
- لا تخترع أرقام ("5 سنوات معاً"، "3 أطفال")`;
    textSection = originalText ? `

نص المستخدم الأصلي (استخدمه كإلهام، لكن بدون حقائق مخترعة):
"""
${originalText}
"""` : '';
  } else {
    modeInstruction = `
وضع الموضوع فقط: أنشئ محتوى جديد ومفصل عن الموضوع.`;
  }

  // Different template based on content type
  if (isPersonalContent) {
    return `أنت خبير في إنشاء عروض تقديمية جميلة وعاطفية.${modeInstruction}

الموضوع: ${brief.subject}
الهدف: ${brief.objective}
الجمهور: ${brief.audience}
النبرة: ${brief.tone}${textSection}

أنشئ بالضبط ${slideCount} شريحة بمحتوى عاطفي وشخصي.

أجب بـ JSON صالح فقط:
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover",
      "title": "${brief.subject}",
      "subtitle": "رسالة من القلب",
      "bullets": [],
      "imageHint": "romantic couple sunset silhouette"
    },
    {
      "slideNumber": 2,
      "role": "content",
      "title": "الحب الذي نتشاركه",
      "bullets": [
        "تعبير صادق عما يعنيه لك",
        "امتنان وتقدير من القلب",
        "ما يجعله مميزاً في حياتك"
      ],
      "imageHint": "couple holding hands warm light"
    }
  ]
}

قواعد الصور للمحتوى الشخصي:
- استخدم صور رومانسية ودافئة
- أمثلة: "romantic couple sunset", "family home cozy", "holding hands warm light"

القواعد الحاسمة:
1. أنشئ بالضبط ${slideCount} شريحة
2. استخدم عناوين عاطفية - ليست عناوين تجارية
3. لا "إحصائيات رئيسية" أو "خلفية وسياق"
4. تذكر: لا تواريخ أو أماكن أو أرقام مخترعة`;
  }

  // Informational content template (original)
  return `أنت خبير في تصميم العروض التقديمية.${modeInstruction}

الموضوع: ${brief.subject}
الهدف: ${brief.objective}
الجمهور: ${brief.audience}
النبرة: ${brief.tone}${textSection}

أنشئ بالضبط ${slideCount} شريحة.

أجب بـ JSON صالح فقط:
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover",
      "title": "عنوان جذاب ومقنع",
      "subtitle": "عنوان فرعي توضيحي",
      "bullets": [],
      "imageHint": "${brief.subject}"
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

القواعد الحاسمة:
1. أنشئ بالضبط ${slideCount} شريحة - الأولى غلاف والأخيرة شكر
2. كل نقطة يجب أن تكون مفصلة (15-25 كلمة على الأقل)
3. أضف إحصائيات وتواريخ وأسماء وحقائق محددة
4. استخدم **نص عريض** للمصطلحات والإحصائيات الرئيسية
5. جميع الشرائح (ما عدا الغلاف والشكر) يجب أن تحتوي على 4-6 نقاط مفصلة
6. اجعل المحتوى تعليمياً ومعلوماتياً وليس عاماً`;
}
