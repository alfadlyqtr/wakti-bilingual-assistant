import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("WAKTI AI V2.1: Starting request processing");
    console.log("WAKTI AI V2.1: Available API Keys - DeepSeek:", !!DEEPSEEK_API_KEY, "OpenAI:", !!OPENAI_API_KEY);

    // Check if we have at least one API key
    if (!DEEPSEEK_API_KEY && !OPENAI_API_KEY) {
      console.error("WAKTI AI V2.1: No AI API keys configured");
      return new Response(
        JSON.stringify({ 
          error: "AI service configuration error",
          details: "No API keys configured. Please contact administrator."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { message, conversationId, language = 'en', inputType = 'text' } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info - but don't fail if authentication is missing for now
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    console.log("WAKTI AI V2.1: User authentication:", !!user, authError ? authError.message : "OK");
    
    // For now, proceed without authentication to test API keys
    const userId = user?.id || 'anonymous';

    // Get user profile for personalization (optional)
    let userName = 'there';
    if (user) {
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('display_name, username')
          .eq('id', user.id)
          .single();
        userName = profile?.display_name || profile?.username || 'there';
      } catch (error) {
        console.log("Could not fetch user profile, using default name");
      }
    }

    // Analyze intent and confidence - with special handling for Arabic voice vs image
    const analysis = analyzeMessage(message, language, inputType);
    console.log("WAKTI AI V2.1: Intent analysis:", analysis);

    // Handle conversation (simplified for now)
    let conversationIdToUse = conversationId || 'temp-' + Date.now();

    // SPECIAL CASE: Arabic image requests ONLY (not Arabic voice input)
    if (analysis.intent === 'image' && analysis.confidence === 'high' && language === 'ar' && inputType === 'text') {
      console.log("WAKTI AI V2.1: Handling Arabic TEXT image request with translation");
      
      try {
        const translationResult = await translateImagePrompt(analysis.actionData.prompt, language);
        
        if (translationResult.translatedPrompt && !translationResult.error) {
          const arabicResponse = `واكتي AI يُولّد الصور باللغة الإنجليزية فقط.
لا تقلق — لقد قمت بترجمة نصك أدناه.
انسخه وألصقه، وسأقوم بإنشاء الصورة لك:

**النص المترجم:**
${translationResult.translatedPrompt}`;

          return new Response(
            JSON.stringify({
              response: arabicResponse,
              conversationId: conversationIdToUse,
              intent: analysis.intent,
              confidence: analysis.confidence,
              actionTaken: 'translate_for_image',
              actionResult: {
                translatedPrompt: translationResult.translatedPrompt,
                originalPrompt: analysis.actionData.prompt
              },
              needsConfirmation: false,
              needsClarification: false,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(translationResult.error || "Translation failed");
        }
      } catch (error) {
        console.error("WAKTI AI V2.1: Arabic image translation failed:", error);
        const errorResponse = `عذراً، فشل في ترجمة طلب الصورة. يرجى المحاولة مرة أخرى أو كتابة الطلب باللغة الإنجليزية.

خطأ: ${error.message}`;
        
        return new Response(
          JSON.stringify({
            response: errorResponse,
            conversationId: conversationIdToUse,
            intent: 'error',
            confidence: 'low',
            needsConfirmation: false,
            needsClarification: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For ALL OTHER cases (including Arabic voice input), generate normal AI response
    const aiResponse = await generateResponse(
      message,
      analysis,
      language,
      userName,
      [] // Empty context for now to simplify
    );

    console.log("WAKTI AI V2.1: Generated response successfully");

    // Execute actions based on confidence (for non-Arabic image requests)
    let actionResult = null;
    let actionTaken = null;
    
    if (analysis.confidence === 'high' && analysis.actionData) {
      try {
        if (analysis.actionData.type === 'generate_image' && language === 'en') {
          // Call the generate-image function for English prompts only
          console.log("WAKTI AI V2.1: Calling image generation function for English");
          actionResult = await callImageGenerationFunction(analysis.actionData.prompt, req.headers.get("Authorization"));
          actionTaken = 'generate_image';
        } else if (user && analysis.actionData.type !== 'generate_image') {
          // Handle other actions that require authentication (but not Arabic image generation)
          actionResult = await executeAction(analysis.actionData, supabaseClient, user.id, language);
          actionTaken = analysis.actionData.type;
        }
        console.log("WAKTI AI V2.1: Action executed:", actionTaken);
      } catch (error) {
        console.error("WAKTI AI V2.1: Action execution failed:", error);
        actionResult = { error: error.message };
      }
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        conversationId: conversationIdToUse,
        intent: analysis.intent,
        confidence: analysis.confidence,
        actionTaken: actionTaken,
        actionResult: actionResult,
        needsConfirmation: analysis.confidence === 'medium',
        needsClarification: analysis.confidence === 'low',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("WAKTI AI V2.1 Brain error:", error);
    return new Response(
      JSON.stringify({ 
        error: "System error occurred",
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Call the generate-image edge function
async function callImageGenerationFunction(prompt: string, authHeader: string | null) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image generation failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("WAKTI AI V2.1: Image generation result:", result);
    return result;
  } catch (error) {
    console.error("WAKTI AI V2.1: Image generation error:", error);
    throw error;
  }
}

function analyzeMessage(message: string, language: string, inputType: string = 'text') {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced Arabic image patterns - but ONLY for TEXT input (not voice)
  const arabicImagePatterns = [
    'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة جديدة', 'توليد صورة', 'اعمل صورة',
    'أريد صورة', 'صورة لـ', 'صورة ل', 'اعطني صورة', 'اصنعلي صورة', 'اعملي صورة',
    'ارسملي', 'ارسم لي', 'أنشئلي صورة', 'كون صورة', 'اخلق صورة', 'اخلقلي صورة'
  ];
  
  // Enhanced English image patterns
  const englishImagePatterns = [
    'generate image', 'create image', 'draw', 'make picture', 'image of', 'picture of', 
    'create an image', 'pic of', 'create a pic', 'make a pic', 'generate a pic', 
    'photo of', 'create photo', 'draw me', 'make me a', 'create me a', 'generate me a', 
    'pic', 'picture', 'photo', 'show me', 'visualize', 'illustrate'
  ];
  
  // Enhanced intent patterns for both languages
  const patterns = {
    task: language === 'ar' 
      ? ['أنشئ مهمة', 'أضف مهمة', 'مهمة جديدة', 'اصنع مهمة', 'أريد مهمة', 'اعمل مهمة']
      : ['create task', 'add task', 'new task', 'make task', 'todo', 'need to do', 'task for', 'remind me to'],
    
    event: language === 'ar'
      ? ['أنشئ حدث', 'أضف حدث', 'موعد جديد', 'اجتماع', 'حفلة', 'مناسبة', 'احجز موعد']
      : ['create event', 'add event', 'schedule', 'meeting', 'appointment', 'plan event', 'book appointment'],
    
    reminder: language === 'ar'
      ? ['ذكرني', 'تذكير', 'لا تنس', 'نبهني', 'أذكرني', 'انبهني']
      : ['remind me', 'reminder', 'don\'t forget', 'alert me', 'notification', 'set reminder'],
      
    // CRITICAL: Only detect Arabic image patterns for TEXT input, not voice
    image: language === 'ar' && inputType === 'text' ? arabicImagePatterns : 
           language === 'en' ? englishImagePatterns : []
  };

  // Check for high confidence matches
  for (const [intent, intentPatterns] of Object.entries(patterns)) {
    for (const pattern of intentPatterns) {
      if (lowerMessage.includes(pattern)) {
        return {
          intent,
          confidence: 'high' as const,
          actionData: extractActionData(message, intent, language, inputType)
        };
      }
    }
  }

  // Medium confidence - partial matches
  const createWords = language === 'ar' ? ['أنشئ', 'أضف', 'اصنع'] : ['create', 'add', 'make'];
  if (createWords.some(word => lowerMessage.includes(word))) {
    return {
      intent: 'general_create',
      confidence: 'medium' as const,
      actionData: null
    };
  }

  return {
    intent: 'general_chat',
    confidence: 'low' as const,
    actionData: null
  };
}

function extractActionData(message: string, intent: string, language: string, inputType: string = 'text') {
  // For Arabic image prompts from TEXT input, keep the full message for proper translation context
  // For English, clean up command words
  // For Arabic VOICE input, do NOT treat as image generation
  const removePatterns = language === 'ar' 
    ? ['أنشئ مهمة', 'أضف مهمة', 'أنشئ حدث', 'أضف حدث', 'ذكرني']
    : ['create task', 'add task', 'new task', 'create event', 'add event', 'remind me', 'generate image', 'create image', 'create an image'];
  
  let title = message;
  if (intent !== 'image' || (language === 'ar' && inputType !== 'text')) {
    for (const pattern of removePatterns) {
      title = title.replace(new RegExp(pattern, 'gi'), '').trim();
    }
  }

  switch (intent) {
    case 'task':
      return {
        type: 'create_task',
        title: title || (language === 'ar' ? 'مهمة جديدة' : 'New Task'),
        description: '',
        priority: 'medium'
      };
    case 'event':
      return {
        type: 'create_event',
        title: title || (language === 'ar' ? 'حدث جديد' : 'New Event'),
        description: '',
        is_all_day: false
      };
    case 'reminder':
      return {
        type: 'create_reminder',
        title: title || (language === 'ar' ? 'تذكير جديد' : 'New Reminder')
      };
    case 'image':
      return {
        type: language === 'ar' && inputType === 'text' ? 'translate_for_image' : 'generate_image',
        // For Arabic TEXT, keep the full message for proper translation context
        prompt: language === 'ar' && inputType === 'text' ? message : (title || (language === 'ar' ? 'صورة جميلة' : 'beautiful artwork'))
      };
    default:
      return null;
  }
}

// Enhanced function to translate Arabic image prompts with better visual focus
async function translateImagePrompt(arabicPrompt: string, language: string) {
  try {
    console.log("WAKTI AI V2.1: Translating Arabic prompt for image generation:", arabicPrompt);
    
    // Enhanced system prompt focusing on visual elements and image generation context
    const systemPrompt = `You are an expert translator specializing in converting Arabic image generation requests to detailed English image prompts for AI art generation. Your task is to:

1. Focus on VISUAL ELEMENTS - extract what the user wants to SEE in the image
2. Think like an artist - what visual elements, composition, style, mood does the user want?
3. Convert the Arabic request into a detailed, descriptive English image prompt
4. Include artistic details like lighting, composition, style when implied
5. Make the prompt suitable for AI image generation tools

Key principles:
- Focus on visual description rather than literal translation
- Extract the essence of what should be pictured
- Add artistic detail when the Arabic suggests it
- Think: "What does the user want to see in this image?"

Examples of good translations:
- "أنشئ صورة لقطة تجلس تحت الشجرة" → "a peaceful cat sitting gracefully under a large tree, natural lighting, serene outdoor setting"
- "ارسم منزل جميل" → "a beautiful house with elegant architecture, well-maintained garden, warm lighting"
- "صورة طائر يطير في السماء" → "a bird soaring through a bright blue sky, wings spread wide, freedom and movement"
- "اصنع صورة لوردة حمراء" → "a stunning red rose in full bloom, detailed petals, soft natural lighting, elegant composition"

Translate this Arabic image request into a detailed English image prompt that focuses on visual elements:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: arabicPrompt }
    ];

    // Try DeepSeek first
    if (DEEPSEEK_API_KEY) {
      try {
        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: messages,
            temperature: 0.3, // Lower temperature for more consistent translations
            max_tokens: 200,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const translatedText = result.choices[0].message?.content || "";
          console.log("WAKTI AI V2.1: Translation successful:", translatedText);
          return { translatedPrompt: translatedText.trim() };
        }
      } catch (error) {
        console.log("WAKTI AI V2.1: DeepSeek translation failed, trying OpenAI");
      }
    }

    // Fallback to OpenAI
    if (OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messages,
          temperature: 0.3, // Lower temperature for more consistent translations
          max_tokens: 200,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const translatedText = result.choices[0].message?.content || "";
        console.log("WAKTI AI V2.1: OpenAI translation successful:", translatedText);
        return { translatedPrompt: translatedText.trim() };
      }
    }

    throw new Error("Translation failed - no AI service available");
  } catch (error) {
    console.error("WAKTI AI V2.1: Translation error:", error);
    return { error: error.message, translatedPrompt: arabicPrompt };
  }
}

async function generateResponse(message: string, analysis: any, language: string, userName: string, context: any[]) {
  // Special handling for English image generation
  if (analysis.intent === 'image' && analysis.confidence === 'high' && language === 'en') {
    return `I'll create an image for you now! 🎨\n\nImage description: "${analysis.actionData.prompt}"\n\nPlease wait a moment...`;
  }

  const systemPrompt = language === 'ar' 
    ? `أنت WAKTI AI V2.1، المساعد الذكي المتطور لتطبيق وكتي. اسم المستخدم هو ${userName}. أنت ودود ومفيد وذكي، تساعد في إدارة المهام والأحداث والتذكيرات وإنشاء الصور بطريقة طبيعية ومحادثة. استخدم الرموز التعبيرية بشكل مناسب. كن مختصراً ومفيداً.`
    : `You are WAKTI AI V2.1, the advanced smart assistant for the Wakti app. The user's name is ${userName}. You are friendly, helpful, and intelligent, assisting with managing tasks, events, reminders, and image generation in a natural, conversational way. Use emojis appropriately. Be concise and helpful.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  // Try DeepSeek first
  try {
    if (DEEPSEEK_API_KEY) {
      console.log("WAKTI AI V2.1: Trying DeepSeek API");
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      console.log("WAKTI AI V2.1: DeepSeek response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("WAKTI AI V2.1: DeepSeek success");
        return result.choices[0].message?.content || "";
      } else {
        const errorText = await response.text();
        console.error("WAKTI AI V2.1: DeepSeek failed with status:", response.status, errorText);
        throw new Error(`DeepSeek API failed: ${response.status} - ${errorText}`);
      }
    }
  } catch (error) {
    console.log("WAKTI AI V2.1: DeepSeek failed, trying OpenAI:", error.message);
  }

  // Fallback to OpenAI
  if (OPENAI_API_KEY) {
    try {
      console.log("WAKTI AI V2.1: Trying OpenAI API");
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      console.log("WAKTI AI V2.1: OpenAI response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("WAKTI AI V2.1: OpenAI success");
        return result.choices[0].message?.content || "";
      } else {
        const errorText = await response.text();
        console.error("WAKTI AI V2.1: OpenAI failed with status:", response.status, errorText);
        throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error("WAKTI AI V2.1: OpenAI failed:", error.message);
      throw error;
    }
  }

  throw new Error("No AI service available or all services failed");
}

async function executeAction(actionData: any, supabaseClient: any, userId: string, language: string) {
  console.log("WAKTI AI V2.1: Executing action:", actionData.type);
  
  switch (actionData.type) {
    case 'create_task':
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          user_id: userId,
          title: actionData.title,
          description: actionData.description,
          priority: actionData.priority,
          type: 'task',
          status: 'pending'
        })
        .select('*')
        .single();
      return { task, success: true };

    case 'create_event':
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 1);
      
      const { data: event } = await supabaseClient
        .from('maw3d_events')
        .insert({
          created_by: userId,
          title: actionData.title,
          description: actionData.description,
          event_date: eventDate.toISOString().split('T')[0],
          is_all_day: actionData.is_all_day,
          is_public: false
        })
        .select('*')
        .single();
      return { event, success: true };

    case 'create_reminder':
      const { data: reminder } = await supabaseClient
        .from('tasks')
        .insert({
          user_id: userId,
          title: actionData.title,
          type: 'reminder',
          status: 'pending',
          priority: 'medium'
        })
        .select('*')
        .single();
      return { reminder, success: true };

    default:
      throw new Error(`Unknown action: ${actionData.type}`);
  }
}

function generateTitle(message: string, language: string) {
  const words = message.split(' ').slice(0, 4).join(' ');
  return words.length > 30 ? words.substring(0, 30) + '...' : words;
}
