import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");

const WAKTI_AI_ID = "00000000-0000-0000-0000-000000000002";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Gemini API helpers
function getGeminiApiKey(): string {
  const key = GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API key not configured");
  return key;
}

type GeminiPart = { text?: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

async function callGemini(
  model: string,
  contents: GeminiContent[],
  systemInstruction?: string,
  useGrounding = false,
): Promise<any> {
  const key = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body: any = { contents };
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }
  if (useGrounding) {
    body.tools = [{ googleSearch: {} }];
  }
  body.generationConfig = { temperature: 0.7, maxOutputTokens: 1024 };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${text}`);
  }
  return await resp.json();
}

function extractGeminiText(result: any): string {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

type AiSettings = {
  tone: string;
  responseLength: string;
  responseStyle: string;
};

const DEFAULT_AI_SETTINGS: AiSettings = {
  tone: "friendly",
  responseLength: "medium",
  responseStyle: "natural",
};

// Tone descriptions for system prompt
function getToneDescription(tone: string, lang: string): string {
  const map: Record<string, { ar: string; en: string }> = {
    friendly: { ar: "ودود ومتفائل", en: "friendly and upbeat" },
    formal: { ar: "رسمي ومهذب", en: "formal and polite" },
    sarcastic: { ar: "ساخر بشكل خفيف", en: "lightly sarcastic" },
    chill: { ar: "هادئ وعفوي", en: "chill and laid-back" },
    professional: { ar: "احترافي", en: "professional" },
    enthusiastic: { ar: "متحمس", en: "enthusiastic" },
  };
  return map[tone]?.[lang === "ar" ? "ar" : "en"] || (lang === "ar" ? "ودود" : "friendly");
}

// Length descriptions for system prompt
function getLengthDescription(length: string, lang: string): string {
  const map: Record<string, { ar: string; en: string }> = {
    short: { ar: "قصير جداً — 1-2 أسطر", en: "very short — 1-2 lines" },
    medium: { ar: "متوسط — 3-5 أسطر", en: "medium — 3-5 lines" },
    long: { ar: "مفصل — 6-10 أسطر", en: "detailed — 6-10 lines" },
  };
  return map[length]?.[lang === "ar" ? "ar" : "en"] || (lang === "ar" ? "متوسط" : "medium");
}

// Style descriptions for system prompt
function getStyleDescription(style: string, lang: string): string {
  const map: Record<string, { ar: string; en: string }> = {
    natural: { ar: "طبيعي كأي عضو في المجموعة", en: "natural like any group member" },
    concise: { ar: "مختصر وموجز", en: "concise and to the point" },
    detailed: { ar: "مفصل مع أمثلة", en: "detailed with examples" },
    funny: { ar: "فكاهي ومرح", en: "funny and playful" },
    educational: { ar: "تعليمي معلوماتي", en: "educational and informative" },
    encouraging: { ar: "محفز وداعم", en: "encouraging and supportive" },
  };
  return map[style]?.[lang === "ar" ? "ar" : "en"] || (lang === "ar" ? "طبيعي" : "natural");
}

// Fetch conversation context + AI settings
async function fetchConversationContext(
  conversationId: string,
  limit = 30,
  senderId?: string,
  senderLocation?: { lat: number; lng: number }
) {
  const { data: messages, error } = await supabaseAdmin
    .from("conversation_messages")
    .select("id, sender_id, content, message_type, media_url, media_type, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Fetch AI settings + name from conversation
  const { data: convRow, error: sErr } = await supabaseAdmin
    .from("conversations")
    .select("name, ai_tone, ai_response_length, ai_response_style")
    .eq("id", conversationId)
    .single();

  if (sErr) console.error("Failed to fetch AI settings:", sErr);

  const aiSettings: AiSettings = {
    tone: convRow?.ai_tone || DEFAULT_AI_SETTINGS.tone,
    responseLength: convRow?.ai_response_length || DEFAULT_AI_SETTINGS.responseLength,
    responseStyle: convRow?.ai_response_style || DEFAULT_AI_SETTINGS.responseStyle,
  };
  const conversationName = convRow?.name || "Group";

  // Fetch participant profiles with more detail
  const { data: participants, error: pErr } = await supabaseAdmin
    .from("conversation_participants")
    .select("user_id, is_ai, profiles:user_id(display_name, username, avatar_url, country, city, language)")
    .eq("conversation_id", conversationId);

  if (pErr) throw pErr;

  const nameMap = new Map<string, string>();
  const memberList: { name: string; location: string; isAi: boolean }[] = [];

  for (const p of participants || []) {
    const profile = (p as any).profiles;
    const name = profile?.display_name || profile?.username || "Member";
    nameMap.set(p.user_id, name);

    // Use device GPS if provided for the sender, otherwise fall back to profile city/country
    let location: string;
    if (senderId && senderLocation && p.user_id === senderId) {
      const { lat, lng } = senderLocation;
      location = `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } else {
      location = [profile?.city, profile?.country].filter(Boolean).join(", ") || "Unknown";
    }

    memberList.push({
      name,
      location,
      isAi: p.is_ai || p.user_id === WAKTI_AI_ID,
    });
  }

  return { messages: messages || [], nameMap, memberList, aiSettings, conversationName };
}

// Fetch the triggering message with media if any
async function fetchTriggeringMessage(messageId: string) {
  const { data, error } = await supabaseAdmin
    .from("conversation_messages")
    .select("id, sender_id, content, message_type, media_url, media_type, created_at")
    .eq("id", messageId)
    .single();

  if (error) throw error;
  return data;
}

// Download image and return base64
async function fetchImageBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const buf = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const mimeType = blob.type || "image/jpeg";
    return { mimeType, data: base64 };
  } catch (e) {
    console.error("Image fetch failed:", e);
    return null;
  }
}

// Build system prompt
function buildSystemPrompt(
  language: string,
  groupName: string,
  memberList: { name: string; location: string; isAi: boolean }[],
  aiSettings: AiSettings
): string {
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Qatar",
  });

  const humanMembers = memberList.filter((m) => !m.isAi);
  const membersText = humanMembers
    .map((m) => `- ${m.name}${m.location !== "Unknown" ? ` (${m.location})` : ""}`)
    .join("\n");

  const toneDesc = getToneDescription(aiSettings.tone, language);
  const lengthDesc = getLengthDescription(aiSettings.responseLength, language);
  const styleDesc = getStyleDescription(aiSettings.responseStyle, language);

  if (language === "ar") {
    return `أنت "وكتي" (Wakti)، عضو ذكي في مجموعة دردشة اسمها "${groupName}".

معلومات المجموعة:
- اسم المجموعة: ${groupName}
- عدد الأعضاء: ${humanMembers.length}
- الأعضاء:
${membersText}

التاريخ: ${currentDate}

شخصية Wakti في هذه المجموعة (تم ضبطها بواسطة منشئ المجموعة):
- النبرة: ${toneDesc}
- طول الرد: ${lengthDesc}
- أسلوب الرد: ${styleDesc}

قواعد السلوك:
- أنت عضو حقيقي في هذه المجموعة — لست روبوت دردشة تقليدي
- تحدث بنبرة ${toneDesc} كأنك عضو عادي
- ${styleDesc}
- استخدم الإيموجي بشكل خفيف وطبيعي
- لا تبدأ ردودك بـ "بصفتي مساعد AI" أو "Wakti:" — أنت مجرد "وكتي"
- عندما يُطلب منك البحث، استخدم Google Search
- عندما تُشارك صورة، انظر للتفاصيل بدقة — الخلفية، الأشخاص، الأشياء، النصوص، الأعلام، المكان. اذكر ما لاحظته بشكل محدد
- لا تكن موجزاً جداً مع الصور — اذكر 2-3 ملاحظات محددة
- طول الرد: ${lengthDesc}
- تعرف على الأعضاء بأسمائهم وتحدث إليهم مباشرة
- لا تذكر أبداً أنك "ذكاء اصطناعي"`;
  }

  return `You are "Wakti", a smart member of a group chat called "${groupName}".

Group info:
- Group name: ${groupName}
- Members count: ${humanMembers.length}
- Members:
${membersText}

Date: ${currentDate}

Wakti personality in this group (set by the group creator):
- Tone: ${toneDesc}
- Response length: ${lengthDesc}
- Response style: ${styleDesc}

Behavior rules:
- You are a REAL member of this group — not a traditional chatbot
- Speak in a ${toneDesc} tone like any group member
- Reply in a ${styleDesc} manner
- Use emojis lightly and naturally
- Never start with "As an AI" or "Wakti:" — you are just "Wakti"
- When asked to search, use Google Search
- When someone shares an image, look closely at ALL details — background, people, objects, text, flags, signs, location clues. Mention what you notice specifically
- Don't be too brief with images — share 2-3 specific observations
- Keep responses ${lengthDesc}
- Know members by name and speak to them directly
- NEVER mention you are "artificial intelligence"`;
}

// Build message history for Gemini
async function buildContents(
  messages: any[],
  nameMap: Map<string, string>,
  triggerType: string,
  language: string,
  groupName: string,
  triggerMessage?: any
): Promise<GeminiContent[]> {
  const contents: GeminiContent[] = [];

  // Add conversation history (last ~15 messages, oldest first)
  const historyMessages = [...messages].reverse();
  for (const msg of historyMessages) {
    const senderName = nameMap.get(msg.sender_id) || "Member";
    const isWakti = msg.sender_id === WAKTI_AI_ID;
    const role: "user" | "model" = isWakti ? "model" : "user";

    // Don't prepend sender name for AI's own messages — prevents "Wakti: Wakti:" repetition
    let text = isWakti ? "" : `${senderName}: `;
    if (msg.message_type === "image" && msg.media_url) {
      text += `[shared an image]`;
      if (msg.content) text += ` — "${msg.content}"`;
    } else if (msg.message_type === "voice") {
      text += `[voice message]`;
    } else {
      text += msg.content || "";
    }

    contents.push({ role, parts: [{ text }] });
  }

  // Add the current trigger instruction
  if (triggerType === "welcome_back") {
    const instruction = language === "ar"
      ? `قدم ملخصاً قصيراً وودوداً لآخر ${messages.length} رسائل في المجموعة. اذكر الأسماء وما نوقش. لا تكتب أكثر من 4-5 أسطر.`
      : `Give a short friendly summary of the last ${messages.length} messages in the group. Mention names and what was discussed. Keep it to 4-5 lines max.`;
    contents.push({ role: "user", parts: [{ text: instruction }] });
  } else if (triggerType === "mention" && triggerMessage) {
    const senderName = nameMap.get(triggerMessage.sender_id) || "Someone";
    const mentionText = triggerMessage.content || "";
    const isImageTrigger = triggerMessage.message_type === "image";
    const instruction = language === "ar"
      ? isImageTrigger
        ? `${senderName} شارك صورة وسألك: "${mentionText}"\n\nانظر للصورة بدقة وعلق على التفاصيل اللي تلاحظها — الخلفية، الأشخاص، الأشياء، المكان. رد بشكل طبيعي.`
        : `${senderName} وجه سؤالاً لك: ${mentionText}\n\nرد بشكل طبيعي وموجز كعضو في المجموعة.`
      : isImageTrigger
        ? `${senderName} shared an image and asked: "${mentionText}"\n\nLook closely at the image and comment on specific details you notice — background, people, objects, location. Reply naturally.`
        : `${senderName} asked you: ${mentionText}\n\nReply naturally and concisely as a group member.`;
    contents.push({ role: "user", parts: [{ text: instruction }] });
  } else {
    const instruction = language === "ar"
      ? `شارك في المحادثة برد طبيعي وموجز كعضو في المجموعة.`
      : `Jump into the conversation with a natural, brief reply as a group member.`;
    contents.push({ role: "user", parts: [{ text: instruction }] });
  }

  return contents;
}

// Insert AI response as a message
async function insertAiMessage(conversationId: string, text: string) {
  const { error } = await supabaseAdmin.from("conversation_messages").insert({
    conversation_id: conversationId,
    sender_id: WAKTI_AI_ID,
    message_type: "text",
    content: text,
  });

  if (error) throw error;
}

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      conversation_id,
      trigger_type = "mention",
      message_id,
      language = "en",
      sender_id,
      sender_location,
    } = body;

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch context (includes AI settings + conversation name)
    const senderLoc = sender_location && typeof sender_location.lat === "number" && typeof sender_location.lng === "number"
      ? { lat: sender_location.lat, lng: sender_location.lng }
      : undefined;
    const { messages, nameMap, memberList, aiSettings, conversationName }: { messages: any[]; nameMap: Map<string, string>; memberList: any[]; aiSettings: AiSettings; conversationName: string } = await fetchConversationContext(
      conversation_id,
      15, // reduced from 30 for speed
      sender_id,
      senderLoc
    );

    const groupName = conversationName;

    // Fetch triggering message if provided
    let triggerMessage = null;
    if (message_id) {
      triggerMessage = await fetchTriggeringMessage(message_id);
    }

    // Build system prompt (passes AI personality settings)
    const systemPrompt = buildSystemPrompt(language, groupName, memberList, aiSettings);

    // Build contents
    const contents = await buildContents(
      messages,
      nameMap,
      trigger_type,
      language,
      groupName,
      triggerMessage || undefined
    );

    // Handle vision — check trigger message AND recent messages for images
    let visionImage: { mimeType: string; data: string } | null = null;

    // 1. Trigger message itself is an image
    if (triggerMessage?.message_type === "image" && triggerMessage.media_url) {
      visionImage = await fetchImageBase64(triggerMessage.media_url);
    }

    // 2. Trigger is text — look at last 5 messages for any recent image
    if (!visionImage && triggerMessage?.message_type === "text") {
      const recentImages = messages
        .filter((m: any) => m.message_type === "image" && m.media_url)
        .slice(0, 1); // most recent image
      if (recentImages.length > 0) {
        visionImage = await fetchImageBase64(recentImages[0].media_url);
      }
    }

    if (visionImage) {
      // Add image to the last user message
      const lastUserMsg = contents[contents.length - 1];
      if (lastUserMsg.role === "user") {
        lastUserMsg.parts.push({
          inlineData: { mimeType: visionImage.mimeType, data: visionImage.data },
        });
      }
    }

    // Call Gemini 2.0 Flash with grounding
    const geminiResult = await callGemini(
      "gemini-2.0-flash",
      contents,
      systemPrompt,
      true // enable search grounding
    );

    let aiText = extractGeminiText(geminiResult);

    // Strip "Wakti:" prefix if AI generated it (prevents "Wakti: Wakti:" display)
    aiText = aiText.replace(/^Wakti:\s*/i, "").trim();

    if (!aiText) {
      throw new Error("No response from Gemini");
    }

    // Insert the AI response
    await insertAiMessage(conversation_id, aiText);

    // Extract grounding metadata for frontend
    const groundingMetadata = geminiResult?.candidates?.[0]?.groundingMetadata;
    const searchQueries = groundingMetadata?.webSearchQueries || [];

    return new Response(
      JSON.stringify({
        success: true,
        response: aiText,
        search_used: searchQueries.length > 0,
        search_queries: searchQueries,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Wakti Group AI Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
