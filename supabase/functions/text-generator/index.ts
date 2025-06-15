
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎯 Text Generator: Processing request");
    const { prompt, mode, language, messageAnalysis } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!DEEPSEEK_API_KEY) {
      console.error("🎯 Text Generator: DeepSeek API key not configured");
      return new Response(
        JSON.stringify({ error: "DeepSeek API key not configured" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("🎯 Text Generator: Calling DeepSeek API for text generation");
    console.log("🎯 Mode:", mode);
    console.log("🎯 Language:", language);
    console.log("🎯 Prompt length:", prompt.length);

    const systemPrompt = getSystemPrompt(language);
    
    const startTime = Date.now();
    const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const duration = Date.now() - startTime;
    console.log(`🎯 Text Generator: DeepSeek request completed in ${duration}ms`);

    if (!deepseekResponse.ok) {
      const errorData = await deepseekResponse.json();
      console.error("🎯 Text Generator: DeepSeek API error:", errorData);
      throw new Error(`DeepSeek API failed: ${JSON.stringify(errorData)}`);
    }

    const result = await deepseekResponse.json();
    const generatedText = result.choices[0]?.message?.content || "";

    if (!generatedText) {
      throw new Error("No text generated from DeepSeek API");
    }

    console.log("🎯 Text Generator: Successfully generated text, length:", generatedText.length);

    return new Response(
      JSON.stringify({
        success: true,
        generatedText: generatedText,
        mode: mode,
        language: language
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error("🎯 Text Generator: Error:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Text generation failed" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// System prompt for text generation
function getSystemPrompt(language: string): string {
  const basePrompt = language === 'ar' 
    ? "أنت مساعد ذكي متخصص في إنشاء النصوص عالية الجودة. مهمتك هي إنشاء محتوى واضح ومفيد ومتسق بناءً على طلب المستخدم."
    : "You are an intelligent assistant specialized in generating high-quality text content. Your task is to create clear, helpful, and coherent content based on the user's request.";

  const guidelines = language === 'ar'
    ? `
المبادئ التوجيهية:
- اكتب نصاً واضحاً ومباشراً
- تجنب استخدام النجوم (*) للتنسيق
- اتبع النبرة والطول المطلوبين
- حافظ على الاتساق في الأسلوب
- قدم محتوى مفيداً وذا صلة
- لا تضع افتراضات غير ضرورية
- ركز على إنشاء النص فقط`
    : `
Guidelines:
- Write clear and direct text
- Do not use asterisks (*) for formatting
- Follow the requested tone and length
- Maintain consistency in style
- Provide helpful and relevant content
- Do not make unnecessary assumptions
- Focus only on text generation`;

  return basePrompt + guidelines;
}

// Simple message analysis for smart replies (completely isolated)
function analyzeMessageSimple(message: string, language: string) {
  const lowerText = message.toLowerCase();
  
  // Basic analysis without any task detection
  const analysis = {
    messageType: "message",
    intent: "communication",
    mainPoints: [message.substring(0, 100) + (message.length > 100 ? "..." : "")],
    questionsAsked: [],
    urgency: "medium",
    tone: "neutral"
  };

  // Detect basic patterns
  if (lowerText.includes("urgent") || lowerText.includes("asap")) {
    analysis.urgency = "high";
  }
  
  if (lowerText.includes("thank") || lowerText.includes("please")) {
    analysis.tone = "polite";
  }
  
  if (lowerText.includes("?")) {
    analysis.intent = "inquiry";
    analysis.questionsAsked = ["Question detected in message"];
  }

  return analysis;
}
