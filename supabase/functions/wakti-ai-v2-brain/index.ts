import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-auth-token, x-skip-auth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

console.log("🚀 WAKTI AI V2: Ultra-fast service loaded with personalization support");

// Enhanced system prompt builder with personalization
function buildPersonalizedPrompt(language: string, personalization?: any): string {
  const basePrompt = language === 'ar' 
    ? `أنت WAKTI، مساعد ذكي متقدم ومفيد. كن ودوداً ومساعداً في إجاباتك. استخدم نصاً عادياً واضحاً بدون رموز زائدة.`
    : `You are WAKTI, an advanced and helpful AI assistant. Be friendly and helpful in your responses. Use clean, plain text without excessive formatting.`;

  if (!personalization?.auto_enable) {
    return basePrompt;
  }

  let personalizedPrompt = basePrompt;

  // Add nickname
  if (personalization.nickname) {
    personalizedPrompt += language === 'ar' 
      ? ` ناد المستخدم باسم "${personalization.nickname}".`
      : ` Call the user "${personalization.nickname}".`;
  }

  // Add role context
  if (personalization.role) {
    personalizedPrompt += language === 'ar' 
      ? ` المستخدم يعمل كـ ${personalization.role}.`
      : ` The user works as a ${personalization.role}.`;
  }

  // Add tone adjustment
  if (personalization.ai_tone && personalization.ai_tone !== 'neutral') {
    const toneMap = {
      funny: language === 'ar' ? 'مرحة' : 'funny',
      serious: language === 'ar' ? 'جدية' : 'serious', 
      casual: language === 'ar' ? 'عفوية' : 'casual',
      encouraging: language === 'ar' ? 'مشجعة' : 'encouraging',
      formal: language === 'ar' ? 'رسمية' : 'formal',
      sassy: language === 'ar' ? 'ساخرة' : 'sassy'
    };
    
    const tone = toneMap[personalization.ai_tone] || personalization.ai_tone;
    personalizedPrompt += language === 'ar' 
      ? ` استخدم نبرة ${tone} في ردودك.`
      : ` Use a ${tone} tone in your responses.`;
  }

  // Add reply style
  if (personalization.reply_style && personalization.reply_style !== 'detailed') {
    const styleMap = {
      short: language === 'ar' ? 'مختصرة' : 'short and concise',
      walkthrough: language === 'ar' ? 'خطوة بخطوة' : 'step-by-step walkthrough',
      bullet_points: language === 'ar' ? 'نقاط' : 'bullet point format'
    };
    
    const style = styleMap[personalization.reply_style] || personalization.reply_style;
    personalizedPrompt += language === 'ar' 
      ? ` قدم إجابات ${style}.`
      : ` Provide ${style} responses.`;
  }

  // Add traits
  if (personalization.traits && personalization.traits.length > 0) {
    const traitsMap = {
      chatty: language === 'ar' ? 'ثرثار' : 'chatty',
      witty: language === 'ar' ? 'ذكي' : 'witty',
      straight_shooting: language === 'ar' ? 'مباشر' : 'straight-shooting',
      encouraging: language === 'ar' ? 'مشجع' : 'encouraging',
      gen_z: language === 'ar' ? 'بأسلوب جيل زد' : 'Gen Z style',
      skeptical: language === 'ar' ? 'متشكك' : 'skeptical',
      traditional: language === 'ar' ? 'تقليدي' : 'traditional',
      forward_thinking: language === 'ar' ? 'متطلع للمستقبل' : 'forward-thinking',
      poetic: language === 'ar' ? 'شاعري' : 'poetic'
    };
    
    const mappedTraits = personalization.traits
      .map(trait => traitsMap[trait] || trait)
      .join(language === 'ar' ? '، ' : ', ');
    
    personalizedPrompt += language === 'ar' 
      ? ` اتبع هذه السمات: ${mappedTraits}.`
      : ` Embody these traits: ${mappedTraits}.`;
  }

  // Add custom instructions
  if (personalization.personal_note) {
    personalizedPrompt += language === 'ar' 
      ? ` تعليمات إضافية: ${personalization.personal_note}`
      : ` Additional instructions: ${personalization.personal_note}`;
  }

  console.log('🎛️ Built personalized system prompt');
  return personalizedPrompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 ULTRA-FAST AI: Processing request with personalization");
    
    // Authenticate user
    const authHeader = req.headers.get('authorization') || req.headers.get('x-auth-token');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error('Invalid authentication');
    }

    const requestBody = await req.json();
    const {
      message,
      language = 'en',
      conversationId = null,
      activeTrigger = 'chat',
      attachedFiles = [],
      conversationSummary = '',
      recentMessages = [],
      personalization = null
    } = requestBody;

    if (!message?.trim() && !attachedFiles?.length) {
      throw new Error('Message or attachment required');
    }

    console.log("🎛️ Using personalization:", personalization);

    // Choose API based on files (force OpenAI for vision)
    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    if (!apiKey || (attachedFiles?.length > 0 && attachedFiles.some(f => f.type?.startsWith('image/')))) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini';
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    // Build personalized system prompt
    const systemPrompt = buildPersonalizedPrompt(language, personalization);

    // Build context from conversation history
    let conversationContext = '';
    if (conversationSummary) {
      conversationContext += `Previous conversation: ${conversationSummary}\n\n`;
    }
    
    if (recentMessages?.length > 0) {
      conversationContext += 'Recent messages:\n';
      recentMessages.forEach(msg => {
        conversationContext += `${msg.role}: ${msg.content}\n`;
      });
      conversationContext += '\n';
    }

    // Prepare messages with file support
    let userContent = conversationContext + message;
    
    if (attachedFiles?.length > 0) {
      const contentParts = [{ type: 'text', text: userContent }];
      
      for (const file of attachedFiles) {
        if (file.type?.startsWith('image/') && file.content) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${file.type};base64,${file.content}`
            }
          });
        }
      }
      
      userContent = contentParts;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    console.log("🚀 ULTRA-FAST AI: Making API request with personalized prompt");

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    console.log("✅ ULTRA-FAST AI: Response generated successfully");

    return new Response(JSON.stringify({
      response: content,
      conversationId: conversationId,
      intent: 'chat_response',
      confidence: 'high',
      success: true,
      personalized: !!personalization?.auto_enable
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚀 ULTRA-FAST AI ERROR:", error);
    return new Response(JSON.stringify({
      error: error.message || 'AI service error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
