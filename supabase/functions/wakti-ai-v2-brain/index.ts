
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { analyzeTaskIntent } from "./taskParsing.ts";
import { analyzeBuddyChatIntent, analyzeSmartModeIntent, processWithBuddyChatAI } from "./chatAnalysis.ts";
import { generateImageWithRunware } from "./imageGeneration.ts";
import { executeRegularSearch } from "./search.ts";
import { generateModeSuggestion, generateNaturalFollowUp, generateSearchFollowUp, generateConversationId, DEEPSEEK_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY, RUNWARE_API_KEY, supabase } from "./utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

console.log("🤖 BUDDY-CHAT AI BRAIN: Enhanced conversational intelligence loaded");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🤖 BUDDY-CHAT AI BRAIN: Processing with enhanced conversational intelligence");

    // CRITICAL: Extract and verify authentication token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("🤖 BUDDY-CHAT AI BRAIN: Missing authorization header");
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      console.error("🤖 BUDDY-CHAT AI BRAIN: Authentication failed:", authError);
      return new Response(JSON.stringify({ 
        error: "Invalid authentication",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get request body
    const requestBody = await req.json();
    // new: collect attachedFiles from request
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      confirmSearch = false,
      activeTrigger = 'chat',
      contextMessages = [],
      attachedFiles = [],
      calendarContext = null,
      userContext = null,
      enhancedContext = '',
      memoryStats = {},
      conversationSummary = null
    } = requestBody;

    // CRITICAL: Ensure userId matches authenticated user
    if (userId !== user.id) {
      console.error("🤖 BUDDY-CHAT AI BRAIN: User ID mismatch - potential security breach attempt");
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate required fields
    if ((!message || typeof message !== 'string' || message.trim() === '') && attachedFiles.length === 0) {
      console.error("🤖 BUDDY-CHAT AI BRAIN: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message or an attachment is required.",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🤖 BUDDY-CHAT AI BRAIN: Processing message for authenticated user:", user.id);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Active trigger mode:", activeTrigger);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Enhanced context available:", !!enhancedContext);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Memory stats:", memoryStats);

    // Enhanced buddy-chat analysis with natural intelligence
    const buddyAnalysis = analyzeBuddyChatIntent(message, activeTrigger, enhancedContext, language);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Buddy analysis result:", buddyAnalysis);

    // Enhanced task analysis - USING ONLY THE IMPORTED FUNCTION FROM taskParsing.ts
    const taskAnalysis = await analyzeTaskIntent(message, language);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Task analysis result:", taskAnalysis);

    // Smart cross-mode suggestions
    const modeAnalysis = analyzeSmartModeIntent(message, activeTrigger, language);
    console.log("🤖 BUDDY-CHAT AI BRAIN: Mode analysis result:", modeAnalysis);

    // Generate response based on enhanced buddy-chat intelligence
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;
    let buddyChat = {};

    // Handle task/reminder creation intelligence
    if (taskAnalysis.isTask || taskAnalysis.isReminder) {
      console.log("🤖 BUDDY-CHAT AI BRAIN: Task/Reminder detected, preparing confirmation data");
      
      needsConfirmation = true;
      
      if (taskAnalysis.isTask) {
        pendingTaskData = taskAnalysis.taskData;
        response = language === 'ar' 
          ? `اكتشفت أنك تريد إنشاء مهمة. راجع التفاصيل أدناه وتأكد من صحتها:`
          : `I detected you want to create a task. Please review the details below and confirm:`;
      } else {
        pendingReminderData = taskAnalysis.reminderData;
        response = language === 'ar' 
          ? `اكتشفت أنك تريد إنشاء تذكير. راجع التفاصيل أدناه وتأكد من صحتها:`
          : `I detected you want to create a reminder. Please review the details below and confirm:`;
      }
    } else {
      // Handle enhanced buddy-chat modes with natural intelligence
      switch (activeTrigger) {
        case 'search':
          // Enhanced search with conversational follow-up
          if (buddyAnalysis.naturalQuery || modeAnalysis.allowInMode) {
            console.log("🔍 Executing enhanced conversational search for user:", user.id);
            
            const searchResult = await executeRegularSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              
              // Process with enhanced buddy-chat AI
              response = await processWithBuddyChatAI(
                message, 
                searchResult.context, 
                language, 
                contextMessages, 
                enhancedContext,
                activeTrigger,
                'search_with_results'
              );
              
              // Add conversational follow-up for search
              response += generateSearchFollowUp(language);
            } else {
              response = await processWithBuddyChatAI(
                message, 
                null, 
                language, 
                contextMessages, 
                enhancedContext,
                activeTrigger,
                'search_without_results'
              );
            }
            
            buddyChat = {
              searchFollowUp: true,
              engagement: 'high'
            };
          } else {
            response = language === 'ar' 
              ? `🔍 أنت في وضع البحث الذكي\n\nيمكنني مساعدتك في البحث عن المعلومات الحديثة. ما الذي تود البحث عنه؟`
              : `🔍 You're in Smart Search Mode\n\nI can help you find current information. What would you like to search for?`;
          }
          break;

        case 'image':
          if (buddyAnalysis.naturalQuery || modeAnalysis.allowInMode) {
            try {
              console.log("🎨 Handling image generation request for prompt:", message);
              const imageResult = await generateImageWithRunware(message, user.id, language);
              
              if (imageResult.success) {
                imageUrl = imageResult.imageUrl;
                
                let baseResponse = language === 'ar' 
                  ? `تم إنشاء الصورة بنجاح.`
                  : `I've successfully generated the image.`;

                if (imageResult.translation_status === 'success' && imageResult.translatedPrompt) {
                  baseResponse += language === 'ar'
                    ? `\n\n📝 (ملاحظة: تمت ترجمة وصفك إلى الإنجليزية: "${imageResult.translatedPrompt}")`
                    : `\n\n📝 (Note: Your prompt was translated to English: "${imageResult.translatedPrompt}")`;
                }

                const buddyContext = `Image generated successfully. Original prompt: "${message}". ${imageResult.translatedPrompt ? `Translated to: "${imageResult.translatedPrompt}"` : ''}`;

                const buddyResponse = await processWithBuddyChatAI(
                  message,
                  buddyContext,
                  language,
                  contextMessages,
                  enhancedContext,
                  activeTrigger,
                  'image_generated'
                );

                response = baseResponse + "\n\n" + buddyResponse;
                
                buddyChat = {
                  creativeEncouragement: true,
                  engagement: 'high'
                };
              } else {
                console.error("Image generation failed:", imageResult.error);
                response = imageResult.error; // Use the specific error message from the handler
              }
            } catch (error) {
              console.error("An unexpected error occurred during image generation:", error);
              response = language === 'ar' 
                ? `❌ عذراً، حدث خطأ غير متوقع أثناء إنشاء الصورة.`
                : `❌ Sorry, an unexpected error occurred while generating the image.`;
            }
          } else {
            response = language === 'ar' 
              ? `🎨 أنت في وضع إنشاء الصور الإبداعي\n\nصف لي الصورة التي تريد إنشاءها وسأجعلها حقيقة!`
              : `🎨 You're in Creative Image Mode\n\nDescribe the image you want to create and I'll bring it to life!`;
          }
          break;

        case 'chat':
        default:
          // Enhanced buddy-chat mode with natural conversations
          response = await processWithBuddyChatAI(
            message, 
            null, 
            language, 
            contextMessages, 
            enhancedContext,
            activeTrigger,
            'buddy_chat',
            attachedFiles
          );
          
          // Add smart cross-mode suggestions
          if (modeAnalysis.suggestMode && modeAnalysis.suggestMode !== activeTrigger) {
            const modeSuggestion = generateModeSuggestion(modeAnalysis.suggestMode, language);
            response += '\n\n' + modeSuggestion;
            
            buddyChat = {
              crossModeSuggestion: modeAnalysis.suggestMode,
              engagement: 'medium'
            };
          } else {
            buddyChat = {
              followUpQuestion: generateNaturalFollowUp(message, response, language),
              engagement: 'high'
            };
          }
          break;
      }
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: buddyAnalysis?.intent,
      confidence: buddyAnalysis?.confidence,
      actionTaken,
      actionResult,
      imageUrl,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation: false,
      needsConfirmation,
      pendingTaskData,
      pendingReminderData,
      needsClarification: false,
      buddyChat,
      success: true
    };

    console.log("🤖 BUDDY-CHAT AI BRAIN: Sending enhanced conversational response for user:", user.id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🤖 BUDDY-CHAT AI BRAIN: Error processing request:", error);
    
    const errorResponse = {
      error: error.message || 'Unknown error occurred',
      success: false
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Generate natural follow-up questions
function generateNaturalFollowUp(userMessage: string, aiResponse: string, language: string = 'en'): string {
  const followUps = language === 'ar' ? [
    'هل تريد معرفة المزيد عن هذا؟',
    'ما رأيك في هذا؟',
    'هل هذا يساعدك؟',
    'هل لديك أسئلة أخرى؟',
    'ما الذي تريد معرفته أيضا؟'
  ] : [
    'What do you think about this?',
    'Would you like to know more?',
    'Is this helpful for you?',
    'Do you have any other questions?',
    'What else would you like to explore?'
  ];
  
  return followUps[Math.floor(Math.random() * followUps.length)];
}

// Generate mode suggestions (buddy-like, explicit about current mode, never asking for action, just suggestion)
function generateModeSuggestion(suggestedMode: string, language: string = 'en'): string {
  if (language === 'ar') {
    switch (suggestedMode) {
      case 'search':
        return "أنا حالياً في وضع المحادثة! للمعلومات الأحدث أو النتائج الفورية، اضغط على زر البحث بالأسفل 🔍";
      case 'image':
        return "محادثتنا الآن نصية، لكن إذا أردت صورة لهذا، جرّب زر الصور بالأسفل 🎨";
      case 'chat':
        return "هذه إجابة مباشرة منّي. إذا أردت دردشة أعمق أو معرفة أكثر، استمر في الحديث هنا! 😊";
      default:
        return "جرّب الوضع المناسب من الأزرار بالأسفل لتحصل على أفضل تجربة!";
    }
  } else {
    switch (suggestedMode) {
      case 'search':
        return "I'm in chat mode! For up-to-date scores or info, just hit the search button below! 🔍";
      case 'image':
        return "We're chatting here—if you want an image for this, tap the image button below! 🎨";
      case 'chat':
        return "That's a quick answer from me. If you want to chat more, just keep talking! 😊";
      default:
        return "Try the buttons below for the best experience for your request!";
    }
  }
}

// Generate search follow-up
function generateSearchFollowUp(language: string = 'en'): string {
  const followUps = language === 'ar' ? [
    '\n\n🔍 هل تريد البحث عن تفاصيل أكثر؟',
    '\n\n💭 ما الذي يثير اهتمامك في هذا الموضوع؟',
    '\n\n📚 هل تريد معرفة معلومات ذات صلة؟'
  ] : [
    '\n\n🔍 Would you like me to search for more details?',
    '\n\n💭 What interests you most about this topic?',
    '\n\n📚 Want to explore related information?'
  ];
  
  return followUps[Math.floor(Math.random() * followUps.length)];
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
