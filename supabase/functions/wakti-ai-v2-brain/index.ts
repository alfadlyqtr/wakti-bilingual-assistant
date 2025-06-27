import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { analyzeTaskIntent } from "./taskParsing.ts";
import { processWithBuddyChatAI } from "./chatAnalysis.ts";
import { generateImageWithRunware } from "./imageGeneration.ts";
import { executeRegularSearch } from "./search.ts";
import { generateConversationId, DEEPSEEK_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY, RUNWARE_API_KEY, supabase } from "./utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-auth-token, x-skip-auth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

console.log("⚡ WAKTI AI ENHANCED: Personality-first processing with smart optimization");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⚡ WAKTI AI ENHANCED: Processing with personality and task creation");
    const startTime = Date.now();

    // HYPER-FAST: Skip full auth if cached token provided
    const skipAuth = req.headers.get('x-skip-auth') === 'true';
    const authToken = req.headers.get('x-auth-token');
    
    let user;
    if (skipAuth && authToken) {
      try {
        const { data } = await supabase.auth.getUser(authToken);
        user = data.user;
      } catch (e) {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) throw new Error('Authentication required');
        const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        user = data.user;
      }
    } else {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) throw new Error('Authentication required');
      const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      user = data.user;
    }

    if (!user) {
      return new Response(JSON.stringify({ 
        error: "Invalid authentication",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const requestBody = await req.json();
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      activeTrigger = 'chat',
      attachedFiles = [],
      conversationSummary = '',
      recentMessages = [],
      customSystemPrompt = '',
      maxTokens = 600,
      userStyle = 'detailed',
      userTone = 'neutral',
      speedOptimized = false,
      aggressiveOptimization = false,
      hasTaskIntent = false,
      personalityEnabled = true
    } = requestBody;

    if (userId !== user.id) {
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!message?.trim() && !attachedFiles?.length) {
      return new Response(JSON.stringify({ 
        error: "Message or attachment required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`⚡ ENHANCED: Processing for user ${user.id} with style: ${userStyle}, tone: ${userTone}, tokens: ${maxTokens}, personality: ${personalityEnabled}`);

    // HYPER-OPTIMIZED: Process attached files with URL handling
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      processedFiles = await processAttachedFilesOptimized(attachedFiles);
      console.log(`⚡ ENHANCED: Processed ${processedFiles.length} files`);
    }

    // ENHANCED: Smart processing pipeline with task creation restoration
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;

    // ENHANCED: Task detection with restored logic
    if (hasTaskIntent || (!aggressiveOptimization && activeTrigger === 'chat')) {
      console.log("⚡ ENHANCED: Checking for task creation intent");
      const taskAnalysis = await analyzeTaskIntent(message, language);
      
      if (taskAnalysis.isTask || taskAnalysis.isReminder) {
        console.log("⚡ ENHANCED: Task/reminder creation detected");
        needsConfirmation = true;
        
        if (taskAnalysis.isTask) {
          pendingTaskData = taskAnalysis.taskData;
          response = language === 'ar' 
            ? `اكتشفت أنك تريد إنشاء مهمة! 📝 راجع التفاصيل وتأكد:`
            : `I detected you want to create a task! 📝 Please review and confirm:`;
        } else {
          pendingReminderData = taskAnalysis.reminderData;
          response = language === 'ar' 
            ? `اكتشفت أنك تريد إنشاء تذكير! ⏰ راجع التفاصيل وتأكد:`
            : `I detected you want to create a reminder! ⏰ Please review and confirm:`;
        }
      }
    }

    // ENHANCED: Processing with personality restoration
    if (!needsConfirmation) {
      switch (activeTrigger) {
        case 'search':
          if (!aggressiveOptimization) {
            console.log("⚡ ENHANCED: Search with personality");
            const searchResult = await executeRegularSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              // ENHANCED: Better context handling
              const context = userStyle === 'short answers' ? 
                searchResult.context.substring(0, 400) : 
                searchResult.context.substring(0, 1000);
              response = await processWithBuddyChatAI(
                message, 
                context, 
                language, 
                recentMessages.slice(-2), // More context for personality
                '',
                activeTrigger,
                personalityEnabled ? 'personality_search' : 'search_results',
                attachedFiles,
                customSystemPrompt,
                maxTokens
              );
            } else {
              response = await processWithBuddyChatAI(
                message, 
                '', 
                language, 
                [],
                '',
                activeTrigger,
                'search_failed',
                attachedFiles,
                customSystemPrompt,
                maxTokens
              );
            }
          } else {
            response = await processWithBuddyChatAI(
              message, 
              '', 
              language, 
              [],
              '',
              'chat',
              'hyper_fast_chat',
              attachedFiles,
              customSystemPrompt,
              Math.min(maxTokens, 200)
            );
          }
          break;

        case 'image':
          if (!aggressiveOptimization) {
            console.log("⚡ ENHANCED: Image generation with personality");
            try {
              const imageResult = await generateImageWithRunware(message, user.id, language);
              
              if (imageResult.success) {
                imageUrl = imageResult.imageUrl;
                
                let baseResponse = language === 'ar' 
                  ? `تم إنشاء الصورة بنجاح! 🎨✨`
                  : `Image generated successfully! 🎨✨`;

                if (imageResult.translation_status === 'success' && imageResult.translatedPrompt) {
                  baseResponse += language === 'ar'
                    ? `\n\n📝 (ترجمة: "${imageResult.translatedPrompt}")`
                    : `\n\n📝 (Translated: "${imageResult.translatedPrompt}")`;
                }

                // ENHANCED: Add personality to image responses
                if (userTone === 'funny') {
                  baseResponse += language === 'ar' 
                    ? `\n\nأتمنى أن تعجبك! 😄🖼️`
                    : `\n\nHope you love it! 😄🖼️`;
                } else if (userTone === 'casual') {
                  baseResponse += language === 'ar' 
                    ? `\n\nشو رأيك؟ 😊`
                    : `\n\nWhat do you think? 😊`;
                }

                response = baseResponse;
              } else {
                response = imageResult.error;
              }
            } catch (error) {
              console.error("Image generation error:", error);
              response = language === 'ar' 
                ? `❌ عذراً، حدث خطأ أثناء إنشاء الصورة.`
                : `❌ Sorry, an error occurred while generating the image.`;
            }
          } else {
            response = language === 'ar' 
              ? `عذراً، إنشاء الصور غير متاح في الوضع السريع.`
              : `Sorry, image generation not available in speed mode.`;
          }
          break;

        case 'chat':
        default:
          console.log(`⚡ ENHANCED: Chat processing with ${personalityEnabled ? 'personality' : 'speed'} mode`);
          // ENHANCED: Build better chat context with personality
          let chatContext = null;
          
          if (!aggressiveOptimization) {
            chatContext = conversationSummary ? 
              `${conversationSummary}\n\nRecent: ${recentMessages.slice(-2).map(m => `${m.role}: ${m.content.substring(0, 100)}`).join('\n')}` :
              null;
          }
          
          const interactionType = aggressiveOptimization ? 'hyper_fast_openai_chat' : 
                                 personalityEnabled ? 'personality_enhanced_chat' : 
                                 'balanced_chat';
          
          response = await processWithBuddyChatAI(
            message, 
            chatContext, 
            language, 
            personalityEnabled ? recentMessages.slice(-2) : [],
            '',
            activeTrigger,
            interactionType,
            processedFiles,
            customSystemPrompt,
            maxTokens
          );
          break;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`⚡ ENHANCED: Processed in ${processingTime}ms (${personalityEnabled ? 'personality' : 'speed'} mode)`);

    // ENHANCED: Response structure with personality indicators
    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: personalityEnabled ? 'personality_enhanced' : (aggressiveOptimization ? 'hyper_fast' : 'balanced'),
      confidence: 'high',
      actionTaken,
      imageUrl,
      browsingUsed,
      browsingData,
      needsConfirmation,
      pendingTaskData,
      pendingReminderData,
      success: true,
      processingTime,
      speedOptimized,
      personalityEnabled,
      userStyle,
      userTone,
      tokensUsed: maxTokens,
      aiProvider: OPENAI_API_KEY ? 'openai' : 'deepseek'
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("⚡ ENHANCED: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Processing error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// HYPER-OPTIMIZED: Process files with URL handling instead of Base64
async function processAttachedFilesOptimized(attachedFiles: any[]): Promise<any[]> {
  if (!attachedFiles || attachedFiles.length === 0) return [];

  return attachedFiles.map(file => {
    // If file is optimized (has URL), use it directly for OpenAI Vision
    if (file.optimized && file.url) {
      return {
        type: 'image_url',
        image_url: {
          url: file.url
        }
      };
    }
    
    // Fallback to existing Base64 processing for non-optimized files
    if (file.content) {
      return {
        type: 'image_url',
        image_url: {
          url: `data:${file.type};base64,${file.content}`
        }
      };
    }
    
    return null;
  }).filter(Boolean);
}
