import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = "gemini-3.1-flash-lite";

const TONE_OPTIONS = [
  "playful and energetic",
  "premium and luxurious",
  "bold and confident",
  "warm and friendly",
  "calm and trustworthy",
];

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || "";
}

function extractHexColors(html: string): string[] {
  const counts = new Map<string, number>();
  const regex = /#([0-9a-fA-F]{6})\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const hex = match[1].toLowerCase();
    if (hex === "ffffff" || hex === "000000") continue;
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex]) => `#${hex}`);
}

function extractLogoUrl(html: string, baseUrl: string): string | null {
  const candidates = [
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        // try next candidate
      }
    }
  }
  return null;
}

function extractTextSample(html: string, maxChars = 3000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authedClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let targetUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (targetUrl && !/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;
    try {
      new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid website URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let html = "";
    try {
      const pageResp = await fetch(targetUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WaktiBrandScan/1.0)" },
        redirect: "follow",
      });
      if (!pageResp.ok) throw new Error(`Website responded with ${pageResp.status}`);
      html = (await pageResp.text()).slice(0, 500_000);
    } finally {
      clearTimeout(timeoutId);
    }

    const title = extractTitle(html);
    const description = extractMeta(html, "description") || extractMeta(html, "og:description");
    const siteName = extractMeta(html, "og:site_name");
    const themeColor = extractMeta(html, "theme-color");
    const hexColors = extractHexColors(html);
    const logoUrl = extractLogoUrl(html, targetUrl);
    const textSample = extractTextSample(html);

    const fallbackName = siteName || title.split(/[|\-–—]/)[0]?.trim() || new URL(targetUrl).hostname.replace(/^www\./, "");

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({
        ok: true,
        dna: {
          name: fallbackName,
          primary_color: themeColor || hexColors[0] || null,
          accent_color: hexColors[1] || null,
          tone: null,
          logo_url: logoUrl,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiPrompt = [
      "You are a brand analyst. Analyze this website snapshot and return ONLY a compact JSON object, no markdown, no commentary.",
      "",
      `Website: ${targetUrl}`,
      `Title: ${title}`,
      `Site name: ${siteName}`,
      `Description: ${description}`,
      `Theme color: ${themeColor || "none"}`,
      `Most used hex colors on the page: ${hexColors.join(", ") || "none"}`,
      `Visible text sample: ${textSample}`,
      "",
      "Return JSON with exactly these keys:",
      '- "name": short brand/business name (max 4 words)',
      '- "primary_color": the single most representative brand color as a hex code (prefer the theme color or the dominant non-neutral hex)',
      '- "accent_color": a secondary brand color as a hex code',
      `- "tone": exactly one of: ${TONE_OPTIONS.map((tone) => `"${tone}"`).join(", ")}`,
      "",
      "If you are unsure about colors, pick the closest from the listed hex colors. Never invent a hex that is not plausible for the brand.",
    ].join("\n");

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: aiPrompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
        }),
      },
    );

    let dna = {
      name: fallbackName,
      primary_color: themeColor || hexColors[0] || null as string | null,
      accent_color: hexColors[1] || null as string | null,
      tone: null as string | null,
      logo_url: logoUrl,
    };

    if (geminiResp.ok) {
      const geminiData = await geminiResp.json();
      const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const isHex = (value: unknown) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
          dna = {
            name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim().slice(0, 60) : dna.name,
            primary_color: isHex(parsed.primary_color) ? parsed.primary_color.trim() : dna.primary_color,
            accent_color: isHex(parsed.accent_color) ? parsed.accent_color.trim() : dna.accent_color,
            tone: TONE_OPTIONS.includes(parsed.tone) ? parsed.tone : null,
            logo_url: logoUrl,
          };
        } catch {
          // keep fallback dna
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, dna }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    const friendly = message.includes("aborted") || message.includes("AbortError")
      ? "The website took too long to respond"
      : message;
    return new Response(JSON.stringify({ error: friendly }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
