import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash-lite";
const GEMINI_VISION_MODEL = "gemini-2.0-flash";

const corsHeaders: { [key: string]: string } = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GeminiPart = { text?: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GeminiGenerateResult = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type UrlRequestBody = {
  mode: "url";
  url?: string;
  language?: "en" | "ar";
};

type ImageRequestBody = {
  mode: "image";
  imageBase64?: string;
  mimeType?: string;
  imageUrl?: string;
  language?: "en" | "ar";
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getGeminiApiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!key) throw new Error("Gemini API key not configured");
  return key;
}

async function generateGemini(
  model: string,
  contents: GeminiContent[],
  systemInstruction?: string,
  generationConfig?: Record<string, unknown>,
): Promise<GeminiGenerateResult> {
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getGeminiApiKey(),
    },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
      ...(generationConfig ? { generationConfig } : {}),
    }),
  });

  if (!resp.ok) {
    throw new Error(`Gemini error ${resp.status}: ${await resp.text()}`);
  }

  return await resp.json();
}

function extractGeminiText(result: GeminiGenerateResult): string {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function buildVisionContent(prompt: string, mimeType: string, base64: string, language?: "en" | "ar"): GeminiContent {
  const prefix = language === "ar" ? "يرجى الرد بالعربية فقط." : "Please respond in English only.";
  return {
    role: "user",
    parts: [
      { text: `${prefix} ${prompt}`.trim() },
      { inlineData: { mimeType, data: base64 } },
    ],
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function extractMetaContent(html: string, key: string): string {
  const escaped = escapeRegExp(key);
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }

  return "";
}

function resolveUrl(baseUrl: string, candidate: string): string {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractFirstImageUrl(html: string, baseUrl: string): string {
  const metaImage = extractMetaContent(html, "og:image") || extractMetaContent(html, "twitter:image") || extractMetaContent(html, "image");
  if (metaImage) return resolveUrl(baseUrl, metaImage);

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch?.[1]) return resolveUrl(baseUrl, decodeHtmlEntities(imgMatch[1].trim()));

  return "";
}

function htmlToText(html: string): { title: string; text: string; description: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeHtmlEntities((titleMatch?.[1] || "").replace(/\s+/g, " ").trim());
  const description = extractMetaContent(html, "description") || extractMetaContent(html, "og:description");

  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  out = out
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  out = decodeHtmlEntities(out)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (out.length > 24000) out = out.slice(0, 24000);

  return { title, text: out, description };
}

function isBlockedIp(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::" || lower === "0:0:0:0:0:0:0:1" || lower === "0:0:0:0:0:0:0:0") return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.replace("::ffff:", "");
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(mapped)) return isBlockedIp(mapped);
  }

  return false;
}

async function assertSafeHostname(hostname: string): Promise<string | null> {
  const host = hostname.replace(/^\[|\]$/g, "");
  const lower = host.toLowerCase();
  if (lower === "localhost" || lower === "ip6-localhost" || lower === "metadata.google.internal" || lower.endsWith(".local") || lower.endsWith(".internal")) {
    return "Hostname not allowed";
  }

  if (/^[0-9a-fA-F:.]+$/.test(host) && (host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host))) {
    if (isBlockedIp(host)) return "Private or reserved IP not allowed";
    return null;
  }

  try {
    const records: string[] = [];
    for (const recordType of ["A", "AAAA"] as const) {
      try {
        const resolved = await Deno.resolveDns(host, recordType);
        if (Array.isArray(resolved)) records.push(...(resolved as string[]));
      } catch {
        // ignore individual DNS lookup failures per record type
      }
    }

    if (records.length === 0) return "Could not resolve hostname";
    for (const ip of records) {
      if (isBlockedIp(String(ip))) return "Hostname resolves to a private/reserved IP";
    }

    return null;
  } catch (error) {
    return `DNS check failed: ${(error as Error).message}`;
  }
}

async function requireUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase env not configured");

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing auth token");

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabaseUser.auth.getUser(token);
  if (error || !data?.user) throw new Error("Invalid auth token");

  return data.user;
}

async function fetchRemoteImageAsBase64(imageUrl: string): Promise<{ mimeType: string; base64: string }> {
  const parsed = new URL(imageUrl);
  const blockReason = await assertSafeHostname(parsed.hostname);
  if (blockReason) throw new Error(`Image URL not allowed: ${blockReason}`);

  const resp = await fetch(imageUrl, { method: "GET" });
  if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status})`);
  const mimeType = resp.headers.get("content-type") || "image/jpeg";
  const buffer = await resp.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { mimeType, base64: btoa(binary) };
}

async function handleUrlMode(body: UrlRequestBody) {
  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) return { status: 400, body: { success: false, error: "url is required" } };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { status: 400, body: { success: false, error: "Invalid URL" } };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { status: 400, body: { success: false, error: "Only http(s) URLs allowed" } };
  }

  const blockReason = await assertSafeHostname(parsed.hostname);
  if (blockReason) {
    return { status: 400, body: { success: false, error: `URL not allowed: ${blockReason}` } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let html = "";
  try {
    const resp = await fetch(rawUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WaktiWishlistBot/1.0; +https://wakti.qa)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": body.language === "ar" ? "ar,en;q=0.8" : "en-US,en;q=0.9,ar;q=0.7",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!resp.ok) {
      clearTimeout(timeoutId);
      return { status: 502, body: { success: false, error: `Fetch failed (HTTP ${resp.status})` } };
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      clearTimeout(timeoutId);
      return { status: 415, body: { success: false, error: `Unsupported content-type: ${contentType}` } };
    }

    html = await resp.text();
  } catch (error) {
    clearTimeout(timeoutId);
    return { status: 502, body: { success: false, error: `Fetch error: ${(error as Error).message}` } };
  } finally {
    clearTimeout(timeoutId);
  }

  const extracted = htmlToText(html);
  const imageUrl = extractFirstImageUrl(html, rawUrl);
  const fallbackTitle = extracted.title || parsed.hostname.replace(/^www\./, "");
  const fallbackDescription = extracted.description || extracted.text.split(/\n{2,}/)[0]?.trim() || "";

  if (!extracted.text && !fallbackDescription) {
    return { status: 422, body: { success: false, error: "Page had no extractable content" } };
  }

  try {
    const gemini = await generateGemini(
      GEMINI_TEXT_MODEL,
      [{ role: "user", parts: [{ text: `URL: ${rawUrl}\nPage title: ${fallbackTitle}\nMeta description: ${fallbackDescription || "(none)"}\n\nVisible page text:\n${extracted.text || fallbackDescription}\n\nReturn JSON exactly: {"title":"short clean product or wish title","description":"1-3 concise sentences describing the wish or product"}` }] }],
      body.language === "ar"
        ? "أنت تستخرج اسم المنتج أو الرغبة ووصفها من صفحة ويب. أعد JSON فقط بدون أي نص إضافي."
        : "You extract a product or wishlist item title and description from a webpage. Return JSON only with no extra text.",
      {
        temperature: 0.2,
        maxOutputTokens: 500,
        response_mime_type: "application/json",
      },
    );

    const parsedJson = JSON.parse(extractGeminiText(gemini) || "{}");
    const title = String(parsedJson.title || fallbackTitle).trim().slice(0, 180);
    const description = String(parsedJson.description || fallbackDescription).trim().slice(0, 600);

    return {
      status: 200,
      body: {
        success: true,
        title,
        description,
        image_url: imageUrl || null,
      },
    };
  } catch {
    return {
      status: 200,
      body: {
        success: true,
        title: fallbackTitle,
        description: fallbackDescription,
        image_url: imageUrl || null,
      },
    };
  }
}

async function handleImageMode(body: ImageRequestBody) {
  let base64 = String(body.imageBase64 || "").trim();
  let mimeType = String(body.mimeType || "").trim() || "image/jpeg";

  if (!base64 && body.imageUrl) {
    const remote = await fetchRemoteImageAsBase64(String(body.imageUrl));
    base64 = remote.base64;
    mimeType = remote.mimeType;
  }

  if (!base64) {
    return { status: 400, body: { success: false, error: "imageBase64 is required" } };
  }

  try {
    const gemini = await generateGemini(
      GEMINI_VISION_MODEL,
      [buildVisionContent(
        body.language === "ar"
          ? "انظر إلى الصورة وحدد ما هو المنتج أو الشيء الرئيسي المناسب لقائمة الرغبات. أعد JSON فقط بهذا الشكل: {\"title\":\"اسم قصير وواضح\",\"description\":\"وصف قصير من جملة إلى ثلاث جمل\"}. لا تذكر الخلفية أو الكاميرا أو أنك ترى صورة."
          : "Look at the image and identify the main product or item suitable for a wishlist. Return JSON only in this shape: {\"title\":\"short clear name\",\"description\":\"short 1-3 sentence description\"}. Do not mention the background, camera, or that you are looking at an image.",
        mimeType,
        base64,
        body.language,
      )],
      body.language === "ar"
        ? "أنت مساعد لاستخراج اسم ووصف منتج من صورة. أعد JSON فقط."
        : "You extract a product title and description from an image. Return JSON only.",
      {
        temperature: 0.2,
        maxOutputTokens: 400,
        response_mime_type: "application/json",
      },
    );

    const parsedJson = JSON.parse(extractGeminiText(gemini) || "{}");
    const title = String(parsedJson.title || "").trim().slice(0, 180);
    const description = String(parsedJson.description || "").trim().slice(0, 600);

    return {
      status: 200,
      body: {
        success: true,
        title,
        description,
      },
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        success: false,
        error: (error as Error).message || "Image extraction failed",
      },
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { success: false, error: "Method not allowed" });
  }

  try {
    await requireUser(req);
  } catch (error) {
    return json(401, { success: false, error: (error as Error).message || "Unauthorized" });
  }

  let body: UrlRequestBody | ImageRequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "Invalid JSON body" });
  }

  if (body.mode === "url") {
    const result = await handleUrlMode(body);
    return json(result.status, result.body);
  }

  if (body.mode === "image") {
    const result = await handleImageMode(body);
    return json(result.status, result.body);
  }

  return json(400, { success: false, error: "Unsupported mode" });
});
