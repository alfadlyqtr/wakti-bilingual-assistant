import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const lyrics = typeof body?.lyrics === "string" ? body.lyrics.trim() : "";
    const language = body?.language === "ar" ? "ar" : "en";

    if (!title && !lyrics) {
      return new Response(JSON.stringify({ error: "Missing title or lyrics" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lyricsExcerpt = lyrics.length > 1200 ? lyrics.slice(0, 1200) : lyrics;

    const system = language === "ar"
      ? "أنت مساعد خبير في كتابة وصف يوتيوب للأغاني. اكتب وصفًا قصيرًا وطبيعيًا وجذابًا، بدون مبالغة، وبدون حشو تسويقي، وبدون هاشتاقات، وبدون رموز تعبيرية إلا إذا كانت ضرورية جدًا. استخدم عنوان الأغنية وبعض كلماتها فقط لفهم الجو العام. لا تخترع معلومات غير موجودة. أعد الوصف فقط كنص جاهز للنشر، من سطرين إلى أربعة أسطر كحد أقصى."
      : "You are an expert assistant for writing YouTube music descriptions. Write a short, natural, useful description with no hype, no fluff, no hashtags, and no unnecessary emojis. Use the song title and parts of the lyrics only to understand the vibe. Do not invent facts. Return only the final publish-ready description, in 2 to 4 short lines max.";

    const userPrompt = language === "ar"
      ? `عنوان الأغنية:\n${title || "غير متوفر"}\n\nمقتطف من الكلمات:\n${lyricsExcerpt || "غير متوفر"}\n\nالمطلوب:\n- وصف قصير مناسب ليوتيوب\n- واضح وبسيط\n- يعكس جو الأغنية\n- لا تكرر العنوان كثيرًا\n- لا تضف هاشتاقات`
      : `Song title:\n${title || "N/A"}\n\nLyrics excerpt:\n${lyricsExcerpt || "N/A"}\n\nNeed:\n- a short YouTube description\n- clear and simple
- reflects the song vibe
- do not over-repeat the title
- do not add hashtags`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI generation failed", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiResp.json();
    const generated = json?.choices?.[0]?.message?.content?.trim?.() || "";

    if (!generated) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ description: generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
