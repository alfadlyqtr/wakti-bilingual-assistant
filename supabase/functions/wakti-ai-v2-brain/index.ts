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
    let userKnowledge = null;
    
    if (user) {
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('display_name, username')
          .eq('id', user.id)
          .single();
        userName = profile?.display_name || profile?.username || 'there';

        // Fetch user knowledge for AI personalization
        console.log("WAKTI AI V2.1: Fetching user knowledge for personalization");
        const { data: knowledge } = await supabaseClient
          .from('ai_user_knowledge')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (knowledge) {
          userKnowledge = knowledge;
          console.log("WAKTI AI V2.1: User knowledge loaded:", {
            hasMainUse: !!knowledge.main_use,
            role: knowledge.role,
            interestsCount: knowledge.interests?.length || 0
          });
        }
      } catch (error) {
        console.log("Could not fetch user profile/knowledge, using defaults");
      }
    }

    // Analyze intent and confidence - with proper inputType handling
    const analysis = analyzeMessage(message, language, inputType);
    console.log("WAKTI AI V2.1: Intent analysis:", analysis);

    // Handle conversation creation and management
    let conversationIdToUse = conversationId;
    let isNewConversation = false;

    if (user && (!conversationId || conversationId.includes('temp-'))) {
      try {
        // Create new conversation
        const conversationTitle = generateConversationTitle(message, language);
        
        const { data: newConversation, error: convError } = await supabaseClient
          .from('ai_conversations')
          .insert({
            user_id: user.id,
            title: conversationTitle,
            last_message_at: new Date().toISOString()
          })
          .select('*')
          .single();

        if (convError) {
          console.error("WAKTI AI V2.1: Error creating conversation:", convError);
          conversationIdToUse = 'temp-' + Date.now();
        } else {
          conversationIdToUse = newConversation.id;
          isNewConversation = true;
          console.log("WAKTI AI V2.1: Created new conversation:", conversationIdToUse);

          // Enforce conversation limit (keep only 7 most recent)
          await enforceConversationLimit(supabaseClient, user.id);
        }
      } catch (error) {
        console.error("WAKTI AI V2.1: Error in conversation creation:", error);
        conversationIdToUse = 'temp-' + Date.now();
      }
    } else if (!conversationIdToUse) {
      conversationIdToUse = 'temp-' + Date.now();
    }

    // Save user message to chat history if we have a valid conversation
    if (user && conversationIdToUse && !conversationIdToUse.includes('temp-')) {
      try {
        await supabaseClient
          .from('ai_chat_history')
          .insert({
            conversation_id: conversationIdToUse,
            user_id: user.id,
            role: 'user',
            content: message,
            input_type: inputType,
            language: language,
            intent: analysis.intent,
            confidence_level: analysis.confidence
          });
      } catch (error) {
        console.error("WAKTI AI V2.1: Error saving user message:", error);
      }
    }

    // SPECIAL CASE: Arabic TEXT image requests ONLY (not voice input)
    if (analysis.intent === 'image' && analysis.confidence === 'high' && language === 'ar' && inputType === 'text') {
      console.log("WAKTI AI V2.1: Handling Arabic TEXT image request with translation");
      
      try {
        const translationResult = await translateImagePrompt(analysis.actionData.prompt, language);
        
        if (translationResult.translatedPrompt && !translationResult.error) {
          const arabicResponse = `يُولّد الصور باللغة الإنجليزية فقط.
لا تقلق — لقد قمت بترجمة نصك أدناه.
انسخه وألصقه، وسأقوم بإنشاء الصورة لك:

**النص المترجم:**
${translationResult.translatedPrompt}`;

          // Save assistant response
          if (user && conversationIdToUse && !conversationIdToUse.includes('temp-')) {
            try {
              await supabaseClient
                .from('ai_chat_history')
                .insert({
                  conversation_id: conversationIdToUse,
                  user_id: user.id,
                  role: 'assistant',
                  content: arabicResponse,
                  input_type: 'text',
                  language: language,
                  intent: analysis.intent,
                  confidence_level: analysis.confidence,
                  action_taken: 'translate_for_image',
                  action_result: {
                    translatedPrompt: translationResult.translatedPrompt,
                    originalPrompt: analysis.actionData.prompt
                  }
                });

              // Update conversation last message time
              await supabaseClient
                .from('ai_conversations')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', conversationIdToUse);
            } catch (error) {
              console.error("WAKTI AI V2.1: Error saving assistant response:", error);
            }
          }

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
              isNewConversation: isNewConversation
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
            isNewConversation: isNewConversation
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
      userKnowledge,
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

    // Save assistant response to chat history
    if (user && conversationIdToUse && !conversationIdToUse.includes('temp-')) {
      try {
        await supabaseClient
          .from('ai_chat_history')
          .insert({
            conversation_id: conversationIdToUse,
            user_id: user.id,
            role: 'assistant',
            content: aiResponse,
            input_type: 'text',
            language: language,
            intent: analysis.intent,
            confidence_level: analysis.confidence,
            action_taken: actionTaken,
            action_result: actionResult
          });

        // Update conversation last message time
        await supabaseClient
          .from('ai_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationIdToUse);
      } catch (error) {
        console.error("WAKTI AI V2.1: Error saving assistant response:", error);
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
        isNewConversation: isNewConversation
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

// Enforce conversation limit - keep only 7 most recent conversations
async function enforceConversationLimit(supabaseClient: any, userId: string) {
  try {
    console.log("WAKTI AI V2.1: Enforcing conversation limit for user:", userId);
    
    // Get conversations ordered by last message time (newest first)
    const { data: conversations, error } = await supabaseClient
      .from('ai_conversations')
      .select('id, last_message_at')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error("WAKTI AI V2.1: Error fetching conversations for cleanup:", error);
      return;
    }

    // If we have more than 7 conversations, delete the oldest ones
    if (conversations && conversations.length > 7) {
      const conversationsToDelete = conversations.slice(7); // Keep first 7, delete rest
      const idsToDelete = conversationsToDelete.map(conv => conv.id);
      
      console.log("WAKTI AI V2.1: Deleting", idsToDelete.length, "old conversations");

      // Delete chat history for these conversations first
      const { error: historyError } = await supabaseClient
        .from('ai_chat_history')
        .delete()
        .in('conversation_id', idsToDelete);

      if (historyError) {
        console.error("WAKTI AI V2.1: Error deleting old chat history:", historyError);
      }

      // Delete the conversations
      const { error: deleteError } = await supabaseClient
        .from('ai_conversations')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error("WAKTI AI V2.1: Error deleting old conversations:", deleteError);
      } else {
        console.log("WAKTI AI V2.1: Successfully deleted", idsToDelete.length, "old conversations");
      }
    }
  } catch (error) {
    console.error("WAKTI AI V2.1: Error in enforceConversationLimit:", error);
  }
}

// Generate conversation title from first message
function generateConversationTitle(message: string, language: string) {
  // Remove common command patterns
  const cleanMessage = message
    .replace(/^(create task|add task|new task|أنشئ مهمة|أضف مهمة)/gi, '')
    .replace(/^(create event|add event|schedule|أنشئ حدث|أضف حدث)/gi, '')
    .replace(/^(remind me|reminder|ذكرني|تذكير)/gi, '')
    .replace(/^(generate image|create image|أنشئ صورة|ارسم)/gi, '')
    .trim();

  // Take first few words and limit length
  const words = cleanMessage.split(' ').slice(0, 4).join(' ');
  const title = words.length > 30 ? words.substring(0, 30) + '...' : words;
  
  // Fallback to default if title is too short
  if (title.length < 3) {
    return language === 'ar' ? 'محادثة جديدة' : 'New Chat';
  }
  
  return title;
}

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

// Helper function to normalize Arabic text for better pattern matching
function normalizeArabic(text: string) {
  return text
    .replace(/[أإآ]/g, 'ا')           // Normalize different forms of Alif
    .replace(/[ًٌٍَُِّْ]/g, '')         // Remove all diacritics
    .replace(/\s+/g, ' ')             // Normalize spaces
    .trim();                          // Remove leading/trailing spaces
}

function analyzeMessage(message: string, language: string, inputType: string = 'text') {
  // CRITICAL: If input is from voice, skip image detection entirely
  if (inputType === 'voice') {
    console.log("WAKTI AI V2.1: Voice input detected, skipping image analysis");
    return {
      intent: 'general_chat',
      confidence: 'low' as const,
      actionData: null
    };
  }
  
  // Updated Arabic image patterns - expanded list including Gulf dialect
  const arabicImagePatterns = [
    "ارسم", 
    "أنشئ صورة", 
    "صورة جديدة", 
    "أعطني صورة", 
    "أريد صورة", 
    "أنشئ لي", 
    "أود رؤية صورة", 
    "ارني صورة", 
    "عرض صورة",
    "ورني صورة",
    "ابي صورة",
    "صورة لو سمحت",
    "هات لي صورة",
    "ابغى صورة",
    "ورني رسم",
    "ارسم لي",
    "ابيك ترسم",
    "تراني ابغى صورة",
    "يلا ارسم",
    "اعطني رسم",
    "صورة لوحدي",
    "صورة فنية"
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
      
    // Image patterns - only for TEXT input
    image: language === 'ar' ? arabicImagePatterns : englishImagePatterns
  };

  // Apply normalization for Arabic text comparison
  let messageToCompare;
  if (language === 'ar') {
    messageToCompare = normalizeArabic(message);
    console.log("WAKTI AI V2.1: Normalized Arabic message:", messageToCompare);
  } else {
    messageToCompare = message.toLowerCase();
  }

  // Check for high confidence matches
  for (const [intent, intentPatterns] of Object.entries(patterns)) {
    for (const pattern of intentPatterns) {
      let patternToCompare;
      if (language === 'ar') {
        patternToCompare = normalizeArabic(pattern);
        console.log(`WAKTI AI V2.1: Checking normalized pattern "${patternToCompare}" against "${messageToCompare}"`);
      } else {
        patternToCompare = pattern.toLowerCase();
      }
      
      if (messageToCompare.includes(patternToCompare)) {
        console.log(`WAKTI AI V2.1: Pattern match found for intent "${intent}": "${pattern}"`);
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
  
  let hasCreateWord = false;
  if (language === 'ar') {
    const normalizedCreateWords = createWords.map(word => normalizeArabic(word));
    hasCreateWord = normalizedCreateWords.some(word => messageToCompare.includes(word));
  } else {
    const createWordsToCheck = createWords.map(w => w.toLowerCase());
    hasCreateWord = createWordsToCheck.some(word => messageToCompare.includes(word));
  }
  
  if (hasCreateWord) {
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
  const removePatterns = language === 'ar' 
    ? ['أنشئ مهمة', 'أضف مهمة', 'أنشئ حدث', 'أضف حدث', 'ذكرني']
    : ['create task', 'add task', 'new task', 'create event', 'add event', 'remind me', 'generate image', 'create image', 'create an image'];
  
  let title = message;
  if (intent !== 'image') {
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

// Enhanced function to translate Arabic image prompts with preserved keywords
async function translateImagePrompt(arabicPrompt: string, language: string) {
  try {
    console.log("WAKTI AI V2.1: Translating Arabic prompt for image generation:", arabicPrompt);
    
    // Improved system prompt for better translation preservation
    const systemPrompt = `You are a precise translator for AI image generation. Translate this Arabic image request to English while preserving all keywords and formatting exactly.

Rules:
- Translate this as an image generation prompt — keep all keywords and formatting
- Do not rewrite or summarize 
- Preserve visual descriptions exactly
- Maintain any artistic style requests
- Keep composition and lighting details
- Output only the translated English prompt, nothing else

Translate this Arabic image request:`;

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
            temperature: 0.1, // Very low temperature for consistent translations
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
          temperature: 0.1, // Very low temperature for consistent translations
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

// ENHANCED: Generate response with user knowledge personalization
async function generateResponse(message: string, analysis: any, language: string, userName: string, userKnowledge: any, context: any[]) {
  // Special handling for English image generation
  if (analysis.intent === 'image' && analysis.confidence === 'high' && language === 'en') {
    return `I'll create an image for you now! 🎨\n\nImage description: "${analysis.actionData.prompt}"\n\nPlease wait a moment...`;
  }

  // NEW: Build personalized system prompt with user knowledge
  let systemPrompt = language === 'ar' 
    ? `أنت مساعد ذكي متطور لتطبيق وكتي. اسم المستخدم هو ${userName}.`
    : `You are an advanced smart assistant for the Wakti app. The user's name is ${userName}.`;

  // Add personalization based on user knowledge
  if (userKnowledge) {
    console.log("WAKTI AI V2.1: Adding personalization from user knowledge");
    
    if (userKnowledge.role) {
      const roleContext = language === 'ar' 
        ? `المستخدم يعمل كـ ${userKnowledge.role}.`
        : `The user works as a ${userKnowledge.role}.`;
      systemPrompt += ` ${roleContext}`;
    }

    if (userKnowledge.main_use) {
      const mainUseContext = language === 'ar'
        ? `هدفهم الأساسي من استخدام التطبيق: ${userKnowledge.main_use}`
        : `Their main goal with the app: ${userKnowledge.main_use}`;
      systemPrompt += ` ${mainUseContext}`;
    }

    if (userKnowledge.interests && userKnowledge.interests.length > 0) {
      const interestsContext = language === 'ar'
        ? `اهتماماتهم تشمل: ${userKnowledge.interests.join('، ')}.`
        : `Their interests include: ${userKnowledge.interests.join(', ')}.`;
      systemPrompt += ` ${interestsContext}`;
    }

    if (userKnowledge.personal_note) {
      const personalContext = language === 'ar'
        ? `ملاحظة شخصية: ${userKnowledge.personal_note}`
        : `Personal note: ${userKnowledge.personal_note}`;
      systemPrompt += ` ${personalContext}`;
    }
  }

  // Add general instructions
  const generalInstructions = language === 'ar'
    ? ` أنت ودود ومفيد وذكي، تساعد في إدارة المهام والأحداث والتذكيرات وإنشاء الصور بطريقة طبيعية ومحادثة. استخدم الرموز التعبيرية بشكل مناسب. كن مختصراً ومفيداً وشخصياً في ردودك.`
    : ` You are friendly, helpful, and intelligent, assisting with managing tasks, events, reminders, and image generation in a natural, conversational way. Use emojis appropriately. Be concise, helpful, and personalized in your responses.`;
  
  systemPrompt += generalInstructions;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  console.log("WAKTI AI V2.1: Using personalized system prompt with user knowledge");

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
