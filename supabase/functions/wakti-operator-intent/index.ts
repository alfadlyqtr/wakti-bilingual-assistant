import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    capability: { type: "string", enum: ["music", "other", "unknown"] },
    capabilityId: { type: ["string", "null"], enum: ["dashboard", "wakti_ai", "image_studio", "music_studio", "video_studio", "qr_creator", "text_tools", "voice_studio", "email", "tasks_reminders", "calendar", "maw3d", "contacts_chat", "social", "projects", "files", "vitality", "deen", "games", "journal", "account", "wishlists", "settings", "help", null] },
    actionId: { type: ["string", "null"] },
    intent: { type: "string", enum: ["conversation", "guidance", "prepare", "generate", "confirm", "cancel", "clarify"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    title: { type: ["string", "null"] },
    topic: { type: ["string", "null"] },
    lyrics: { type: ["string", "null"] },
    style: { type: ["string", "null"] },
    mode: { type: ["string", "null"], enum: ["custom", "instrumental", null] },
    vocalType: { type: ["string", "null"], enum: ["auto", "none", "male", "female", null] },
    response: { type: ["string", "null"] },
    clarificationQuestion: { type: ["string", "null"] },
  },
  required: ["capability", "capabilityId", "actionId", "intent", "confidence", "title", "topic", "lyrics", "style", "mode", "vocalType", "response", "clarificationQuestion"],
};

function fallbackResult(transcript: string) {
  return {
    capability: "unknown",
    capabilityId: null,
    actionId: null,
    intent: "clarify",
    confidence: 0,
    title: null,
    topic: transcript,
    lyrics: null,
    style: null,
    mode: null,
    vocalType: null,
    response: null,
    clarificationQuestion: "What would you like Wakti to do with this?",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const language = body?.language === "ar" ? "ar" : "en";
    const capabilityManifest = typeof body?.capabilityManifest === "string" ? body.capabilityManifest.slice(0, 12000) : "";
    const previousMusic = body?.previousMusic && typeof body.previousMusic === "object" ? body.previousMusic : null;
    if (!transcript) {
      return new Response(JSON.stringify({ error: "Transcript is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = language === "ar"
      ? "أنت محلل نية لمشغل وكتي. افهم معنى كلام المستخدم وليس الكلمات المفتاحية فقط. قائمة التنفيذ المرسلة تحتوي على سطر لكل إجراء بالشكل capabilityId/actionId. الحقول الإلزامية تحمل علامة *، والشرط بين قوسين يعني أنها مطلوبة فقط عند تحقق الشرط. اختر capabilityId وactionId المتطابقين من نفس السطر فقط عندما يطابق الطلب ميزة وإجراء حقيقيين في وكتي. اجعل actionId فارغاً فقط عندما لا يوجد إجراء محدد. عند طلب إجراء واضح وتكون معلومة إلزامية ناقصة، اجعل intent = clarify واسأل في clarificationQuestion عن هذه المعلومة الناقصة فقط؛ لا تخترع قيمة ولا تسأل عن الحقول الاختيارية. اجعل capability = music فقط عندما capabilityId هو music_studio، واجعله other للقدرات الأخرى، وunknown عندما لا توجد قدرة مناسبة. فرّق بين حديث المستخدم عن فكرة وبين أمر واضح لتنفيذها. للأغاني فقط، استخرج العنوان والموضوع والكلمات والنمط والوضع ونوع الصوت إن ذُكرت صراحة، ولا تخترع تفاصيل. intent يكون conversation للحديث فقط، guidance لطلب الشرح، prepare لتجهيز مسودة، generate لأمر إنشاء واضح، confirm لتأكيد إجراء سابق، cancel للإلغاء، وclarify عند غموض المطلوب أو نقص معلومة إلزامية. إذا كانت هناك مسودة موسيقى سابقة، استخدمها لفهم المتابعات القصيرة مثل نعم، ابدأ، غيّرها، أو ألغِ. أعد JSON مطابقاً للمخطط فقط."
      : "You classify intent for the Wakti Operator. Understand the user's meaning, not keywords alone. The supplied execution manifest has one line per real action in the form capabilityId/actionId. Required fields have a * suffix; a condition in parentheses means the field is required only when that condition is true. Select a capabilityId and actionId from the same manifest line only when the request matches a real Wakti feature and action. Return a null actionId only when no specific action applies. When a clear action request is missing a required field, set intent to clarify and use clarificationQuestion to ask only for that missing field; never invent a value or ask for optional fields. Set capability to music only when capabilityId is music_studio, other for every other known capability, and unknown when no capability applies. Distinguish talking about an idea from a clear instruction to act. For music only, extract only details explicitly stated: title, topic, lyrics, style, mode, and vocal type. Do not invent missing details. Use conversation when the user is discussing or describing an idea without asking Wakti to act, guidance when asking how or what options exist, prepare when asking for help preparing a draft, generate when clearly instructing Wakti to create the song, confirm when confirming a previous action, cancel when cancelling, and clarify when the request is not clear or a required field is missing. If a previous music draft is provided, use it to understand short follow-ups such as yes, go ahead, change it, or cancel. Return JSON matching the schema only.";

    const startTime = Date.now();
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "wakti_operator_intent",
            strict: true,
            schema: responseSchema,
          },
        },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({ transcript, capabilityManifest, previousMusic }),
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      console.error("Operator intent model error:", openaiResponse.status, await openaiResponse.text());
      return new Response(JSON.stringify(fallbackResult(transcript)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await openaiResponse.json();
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return new Response(JSON.stringify(fallbackResult(transcript)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = fallbackResult(transcript);
    }

    await logAIFromRequest(req, {
      functionName: "wakti-operator-intent",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: transcript,
      outputText: content,
      durationMs: Date.now() - startTime,
      status: "success",
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Operator intent error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify(fallbackResult("")), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
