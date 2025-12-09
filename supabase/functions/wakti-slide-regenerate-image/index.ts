// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
const RW_PREFERRED_MODEL = Deno.env.get("RUNWARE_PREFERRED_MODEL") || "runware:97@2";
const RW_FALLBACK_MODEL = Deno.env.get("RUNWARE_FALLBACK_MODEL") || "runware:100@1";
const RW_STEPS = (() => {
  const v = parseInt(Deno.env.get("RUNWARE_STEPS") ?? "28", 10);
  if (Number.isNaN(v)) return 28;
  return Math.min(60, Math.max(4, v));
})();
const RW_CFG = (() => {
  const v = parseFloat(Deno.env.get("RUNWARE_CFG") ?? "5.5");
  if (Number.isNaN(v)) return 5.5;
  return Math.min(20, Math.max(1, v));
})();

// Content type classifier - same logic as outline function
type ContentType = "personal" | "creative" | "informational";

function detectContentType(
  title: string,
  bullets: string[],
  objective?: string,
  audience?: string,
  tone?: string
): ContentType {
  const allText = [title, ...bullets].join(" ");

  // Personal / Love / Tribute indicators
  const personalKeywords =
    /\b(love|wife|husband|spouse|partner|darling|dearest|dear|tribute|anniversary|wedding|romantic|heart|family|home|mom|dad|mother|father|son|daughter|baby|child|friend|bestie|bff|thank you|grateful|appreciation|memory|memories|miss you|i love)\b/i;

  // Creative / Story / Poem indicators
  const creativeKeywords =
    /\b(poem|poetry|story|tale|once upon|chapter|verse|stanza|rhyme|fiction|novel|dream|imagine|fantasy)\b/i;

  // Check brief fields first (most reliable)
  const briefIndicatesPersonal =
    objective === "express_love" ||
    objective === "celebrate_someone" ||
    audience === "partner_spouse" ||
    audience === "family" ||
    tone === "romantic" ||
    tone === "heartfelt";

  const textIsPersonal = personalKeywords.test(allText);
  const textIsCreative = creativeKeywords.test(allText);

  if (briefIndicatesPersonal || textIsPersonal) {
    return "personal";
  }
  if (textIsCreative) {
    return "creative";
  }
  return "informational";
}

// Extract the main subject from slide text (title + bullets)
function extractMainSubject(title: string, bullets: string[]): string {
  const allText = [title, ...bullets].join(" ");
  
  // Remove common filler words and markdown
  const cleaned = allText
    .replace(/[*#_\[\]]/g, "")
    .replace(/\b(what|how|why|the|a|an|is|are|we|will|cover|key|statistics|data|background|context|introduction|overview|main|topics|impact|future|first|second|third|fourth)\b/gi, "")
    .trim();
  
  // Try to find capitalized phrases (proper nouns / brand names)
  // e.g. "Qatar Airways", "Artificial Intelligence", "World Cup"
  const properNounPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
  const properNouns = cleaned.match(properNounPattern) || [];
  
  // Also look for common topic patterns
  const topicPatterns = [
    /\b(\w+\s+Airways)\b/i,
    /\b(\w+\s+Airlines)\b/i,
    /\b(artificial intelligence|AI|machine learning)\b/i,
    /\b(climate change|global warming)\b/i,
    /\b(world cup|football|soccer)\b/i,
    /\b(solar system|planets|space)\b/i,
    /\b(history of \w+)\b/i,
  ];
  
  for (const pattern of topicPatterns) {
    const match = allText.match(pattern);
    if (match) return match[1];
  }
  
  // Use first proper noun found
  if (properNouns.length > 0) {
    return properNouns[0];
  }
  
  // Fallback: take first 3-4 meaningful words from cleaned text
  const words = cleaned.split(/\s+/).filter(w => w.length > 3).slice(0, 4);
  return words.join(" ") || "professional scene";
}

// Build a smart prompt based on slide content and type
function buildImagePrompt(
  title: string,
  bullets: string[],
  role: string,
  contentType: ContentType,
  userPrompt?: string
): string {
  // Base style modifiers
  const qualityModifiers = "high quality, professional photography, 4k, detailed";
  const negativeStyle = "no text, no watermark, no logo, no words, no letters";

  // Extract the real subject from slide content
  const mainSubject = extractMainSubject(title, bullets);
  console.log(`Extracted mainSubject: "${mainSubject}"`);

  let basePrompt = "";

  if (contentType === "personal") {
    // Romantic / personal image prompts
    const personalPrompts: Record<string, string> = {
      cover: "romantic couple silhouette at sunset, warm golden light, love, emotional",
      content: "couple holding hands, warm soft lighting, intimate moment, cozy atmosphere",
      thank_you: "beautiful flowers arrangement, hearts, romantic, soft pink and red colors",
      default: "warm family moment, soft lighting, emotional connection, love",
    };
    basePrompt = personalPrompts[role] || personalPrompts.default;
  } else if (contentType === "creative") {
    // Story / poem / creative - use subject in dreamy style
    basePrompt = `illustration of ${mainSubject}, storybook style, soft colors, dreamy atmosphere, artistic`;
  } else {
    // Informational / business content - use extracted subject
    const rolePrompts: Record<string, string> = {
      cover: `${mainSubject}, professional hero image, modern, clean design`,
      overview: `${mainSubject}, modern professional setting, clean composition`,
      background: `${mainSubject}, historical context, evolution, timeline visual`,
      statistics: `${mainSubject}, data visualization style, charts and graphs, analytics`,
      features: `${mainSubject}, product showcase, technology, innovation`,
      solution: `${mainSubject}, success and innovation, modern`,
      team: "professional team collaboration, diverse group, modern office",
      thank_you: `${mainSubject}, success, celebration, achievement`,
      content: `${mainSubject}, professional photography, modern`,
      default: `${mainSubject}, professional, modern, clean`,
    };
    basePrompt = rolePrompts[role] || rolePrompts.default;
  }

  // Combine with user prompt if provided
  let finalPrompt = basePrompt;
  if (userPrompt && userPrompt.trim()) {
    finalPrompt = `${basePrompt}, ${userPrompt.trim()}`;
  }

  return `${finalPrompt}, ${qualityModifiers}, ${negativeStyle}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      title = "",
      bullets = [],
      role = "content",
      objective,
      audience,
      tone,
      userPrompt = "",
    } = body;

    if (!title && bullets.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Title or bullets required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RUNWARE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Runware API key not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect content type
    const contentType = detectContentType(title, bullets, objective, audience, tone);
    console.log(`Regenerating image for slide: "${title}" (role: ${role}, contentType: ${contentType})`);

    // Build smart prompt (includes user hint if provided)
    const prompt = buildImagePrompt(title, bullets, role, contentType, userPrompt);
    console.log(`Generated prompt: ${prompt}`);

    // Build Runware payload
    const taskUUID = crypto.randomUUID();
    const buildPayload = (model: string) => [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY,
      },
      {
        taskType: "imageInference",
        taskUUID,
        positivePrompt: prompt,
        model,
        width: 1024,
        height: 768, // Landscape for slides
        numberResults: 1,
        outputFormat: "WEBP",
        includeCost: true,
        CFGScale: RW_CFG,
        scheduler: "FlowMatchEulerDiscreteScheduler",
        steps: RW_STEPS,
      },
    ];

    // Try preferred model, then fallback
    let modelUsed = RW_PREFERRED_MODEL;
    let response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(RW_PREFERRED_MODEL)),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn("Preferred model failed:", response.status, errText);
      modelUsed = RW_FALLBACK_MODEL;
      response = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(RW_FALLBACK_MODEL)),
      });
    }

    console.log("Runware API response status:", response.status, "modelUsed:", modelUsed);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status}`);
    }

    const result = await response.json();
    console.log("Runware API response:", JSON.stringify(result).slice(0, 500));

    // Find the image inference result
    const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");

    if (imageResult && imageResult.imageURL) {
      return new Response(
        JSON.stringify({
          success: true,
          imageUrl: imageResult.imageURL,
          prompt,
          contentType,
          modelUsed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error("No image URL in Runware response");
    }
  } catch (error) {
    console.error("Error regenerating image:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Image regeneration failed",
        details: (error as any).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
