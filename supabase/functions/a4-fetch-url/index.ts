// deno-lint-ignore-file no-explicit-any
// A4 — URL to Content Fetcher
// -----------------------------------------------------------------------------
// Accepts: { url: string }
// Flow:
//   1. Auth check.
//   2. Fetch the URL as HTML.
//   3. Strip scripts/styles, extract visible text + <title>.
//   4. Call gemini-2.5-flash-lite (cheap) to clean, structure, and summarize.
//   5. Return { content, title, detected_language }.
// -----------------------------------------------------------------------------

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildTextContent, generateGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Strip HTML → visible text. Minimal + safe.
function htmlToText(html: string): { title: string; text: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] || "").replace(/\s+/g, " ").trim();

  // Remove script, style, noscript, svg, iframe blocks
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    // Common nav/footer/aside - drop as they pollute content
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  // Convert common block-ends to newlines so paragraphs survive
  out = out
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining tags
  out = out.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  out = out
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&(\w+);/g, " ");

  // Collapse whitespace, keep paragraph breaks
  out = out
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Safety cap to keep Gemini cheap
  const MAX_CHARS = 40000;
  if (out.length > MAX_CHARS) out = out.slice(0, MAX_CHARS);

  return { title, text: out };
}

function detectDominantLanguage(text: string): "en" | "ar" | "mixed" {
  const sample = text.slice(0, 4000);
  const arabicChars = (sample.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars = (sample.match(/[A-Za-z]/g) ?? []).length;

  if (arabicChars > 0 && latinChars > 0) return "mixed";
  if (arabicChars > 0) return "ar";
  return "en";
}

function fallbackStructuredContent(title: string, text: string): string {
  const cleanTitle = title.trim() || "Fetched Web Content";
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const intro = paragraphs[0] ?? text.slice(0, 700).trim();
  const bulletPool = paragraphs
    .slice(1)
    .join("\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 40)
    .slice(0, 8);

  const body = [
    cleanTitle,
    "",
    intro,
    ...(bulletPool.length > 0
      ? ["", "Key points", ...bulletPool.map((line) => `- ${line}`)]
      : []),
  ].join("\n");

  return body.slice(0, 3500).trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { success: false, error: "Method not allowed" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(500, { success: false, error: "Supabase env not configured" });
  }

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { success: false, error: "Missing auth token" });

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json(401, { success: false, error: "Invalid auth token" });
  }

  // Parse input
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "Invalid JSON body" });
  }

  const url = String(body.url || "").trim();
  if (!url) return json(400, { success: false, error: "url is required" });

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json(400, { success: false, error: "Invalid URL" });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return json(400, { success: false, error: "Only http(s) URLs allowed" });
  }

  // Fetch the page (10s timeout, small size cap via abort)
  let html = "";
  let fetchedTitle = "";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WaktiA4Bot/1.0; +https://wakti.qa)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    if (!resp.ok) {
      return json(502, { success: false, error: `Fetch failed (HTTP ${resp.status})` });
    }
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return json(415, { success: false, error: `Unsupported content-type: ${contentType}` });
    }
    html = await resp.text();
  } catch (e) {
    return json(502, { success: false, error: `Fetch error: ${(e as Error).message}` });
  }

  const { title, text } = htmlToText(html);
  fetchedTitle = title;
  const fallbackLanguage = detectDominantLanguage(text);
  const fallbackContent = fallbackStructuredContent(fetchedTitle, text);

  if (!text || text.length < 50) {
    return json(422, { success: false, error: "Page had no extractable text content" });
  }

  // Summarize / structure via cheap Gemini
  const systemInstruction =
    "You convert raw website text into clean, structured, document-ready content. Output STRICT JSON only, no prose, no markdown fences.";

  const userPayload = `Source URL: ${url}
Page title (best-effort): ${fetchedTitle || "(unknown)"}

Raw extracted text (between markers):
[TEXT BEGIN]
${text}
[TEXT END]

TASK:
1. Detect dominant language: "en", "ar", or "mixed".
2. Clean the raw text: remove navigation leftovers, cookie notices, duplicate menus, unrelated promos, legal boilerplate.
3. Preserve all useful FACTS, numbers, names, dates.
4. Produce a concise yet information-rich structured content ready to paste into an A4 document builder. Use plain text with:
   - A clear title line
   - Short intro paragraph
   - Section headings (UPPERCASE or sentence case, one per line)
   - Bullets with "- " prefix
   - Numbered lists with "1. "
   - Keep quotes and stats where meaningful
5. Target length: 1200-3500 characters. Never invent facts.

RETURN JSON EXACTLY:
{
  "title": "short clean title",
  "detected_language": "en" | "ar" | "mixed",
  "content": "full structured content as a single plain-text string with newlines"
}`;

  let gemini: any;
  try {
    gemini = await generateGemini(
      "gemini-2.5-flash-lite",
      [buildTextContent("user", userPayload)],
      systemInstruction,
      {
        temperature: 0.2,
        maxOutputTokens: 4000,
        response_mime_type: "application/json",
      },
    );
  } catch {
    return json(200, {
      success: true,
      title: fetchedTitle || null,
      detected_language: fallbackLanguage,
      content: fallbackContent,
    });
  }

  const out: string = gemini?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!out) {
    return json(200, {
      success: true,
      title: fetchedTitle || null,
      detected_language: fallbackLanguage,
      content: fallbackContent,
    });
  }

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(out);
  } catch {
    return json(200, {
      success: true,
      title: fetchedTitle || null,
      detected_language: fallbackLanguage,
      content: fallbackContent,
    });
  }

  const cleanTitle = String(parsedJson.title ?? fetchedTitle ?? "").slice(0, 300);
  const detected = ["en", "ar", "mixed"].includes(parsedJson.detected_language)
    ? parsedJson.detected_language
    : fallbackLanguage;
  const content = String(parsedJson.content ?? "").trim();

  if (!content) {
    return json(200, {
      success: true,
      title: cleanTitle || fetchedTitle || null,
      detected_language: fallbackLanguage,
      content: fallbackContent,
    });
  }

  return json(200, {
    success: true,
    title: cleanTitle,
    detected_language: detected,
    content,
  });
});
