
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

console.log("⚡ WAKTI AI ENHANCED: Full personality restoration with task creation");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⚡ WAKTI AI ENHANCED: Processing with restored personality and task creation");
    const startTime = Date.now();

    // Auth handling
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
      personalityEnabled = true,
      enableTaskCreation = true,
      enablePersonality = true
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

    console.log(`⚡ ENHANCED: User ${user.id} | Style: ${userStyle} | Tone: ${userTone} | Tokens: ${maxTokens} | Personality: ${personalityEnabled} | Task Creation: ${enableTaskCreation}`);

    // ENHANCED: Process attached files with URL handling
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      processedFiles = await processAttachedFilesOptimized(attachedFiles);
      console.log(`⚡ ENHANCED: Processed ${processedFiles.length} files`);
    }

    // ENHANCED: Smart processing pipeline with full task creation restoration
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;

    // ENHANCED: Full task detection logic restoration
    if (enableTaskCreation && (hasTaskIntent || (!aggressiveOptimization && activeTrigger === 'chat'))) {
      console.log("⚡ ENHANCED: Analyzing for task/reminder creation intent");
      
      try {
        const taskAnalysis = await analyzeTaskIntent(message, language);
        console.log("⚡ TASK ANALYSIS RESULT:", JSON.stringify(taskAnalysis, null, 2));
        
        if (taskAnalysis.isTask || taskAnalysis.isReminder) {
          console.log(`⚡ ENHANCED: ${taskAnalysis.isTask ? 'Task' : 'Reminder'} creation detected!`);
          needsConfirmation = true;
          
          if (taskAnalysis.isTask && taskAnalysis.taskData) {
            pendingTaskData = taskAnalysis.taskData;
            response = language === 'ar' 
              ? `🚀 اكتشفت أنك تريد إنشاء مهمة! 📝\n\n**المهمة:** ${taskAnalysis.taskData.title}\n${taskAnalysis.taskData.description ? `**الوصف:** ${taskAnalysis.taskData.description}\n` : ''}${taskAnalysis.taskData.due_date ? `**التاريخ:** ${taskAnalysis.taskData.due_date}\n` : ''}${taskAnalysis.taskData.due_time ? `**الوقت:** ${taskAnalysis.taskData.due_time}\n` : ''}${taskAnalysis.taskData.priority ? `**الأولوية:** ${taskAnalysis.taskData.priority}\n` : ''}\nراجع التفاصيل وتأكد! 👍`
              : `🚀 I detected you want to create a task! 📝\n\n**Task:** ${taskAnalysis.taskData.title}\n${taskAnalysis.taskData.description ? `**Description:** ${taskAnalysis.taskData.description}\n` : ''}${taskAnalysis.taskData.due_date ? `**Date:** ${taskAnalysis.taskData.due_date}\n` : ''}${taskAnalysis.taskData.due_time ? `**Time:** ${taskAnalysis.taskData.due_time}\n` : ''}${taskAnalysis.taskData.priority ? `**Priority:** ${taskAnalysis.taskData.priority}\n` : ''}\nPlease review and confirm! 👍`;
          } else if (taskAnalysis.isReminder && taskAnalysis.reminderData) {
            pendingReminderData = taskAnalysis.reminderData;
            response = language === 'ar' 
              ? `⏰ اكتشفت أنك تريد إنشاء تذكير!\n\n**التذكير:** ${taskAnalysis.reminderData.title}\n${taskAnalysis.reminderData.description ? `**الوصف:** ${taskAnalysis.reminderData.description}\n` : ''}${taskAnalysis.reminderData.due_date ? `**التاريخ:** ${taskAnalysis.reminderData.due_date}\n` : ''}${taskAnalysis.reminderData.due_time ? `**الوقت:** ${taskAnalysis.reminderData.due_time}\n` : ''}\nراجع التفاصيل وتأكد! 👍`
              : `⏰ I detected you want to create a reminder!\n\n**Reminder:** ${taskAnalysis.reminderData.title}\n${taskAnalysis.reminderData.description ? `**Description:** ${taskAnalysis.reminderData.description}\n` : ''}${taskAnalysis.reminderData.due_date ? `**Date:** ${taskAnalysis.reminderData.due_date}\n` : ''}${taskAnalysis.reminderData.due_time ? `**Time:** ${taskAnalysis.reminderData.due_time}\n` : ''}\nPlease review and confirm! 👍`;
          }
        }
      } catch (taskError) {
        console.error("⚡ TASK ANALYSIS ERROR:", taskError);
        // Continue with normal processing if task analysis fails
      }
    }

    // ENHANCED: Main processing with full personality restoration
    if (!needsConfirmation) {
      switch (activeTrigger) {
        case 'search':
          if (!aggressiveOptimization) {
            console.log("⚡ ENHANCED: Search with full personality");
            const searchResult = await executeRegularSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              // Enhanced context for detailed users
              const context = userStyle === 'short answers' ? 
                searchResult.context.substring(0, 400) : 
                userStyle === 'detailed' ? searchResult.context.substring(0, 1500) :
                searchResult.context.substring(0, 1000);
              
              response = await processWithBuddyChatAI(
                message, 
                context, 
                language, 
                personalityEnabled ? recentMessages.slice(-3) : recentMessages.slice(-1),
                conversationSummary,
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
            // Fallback for speed mode
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

                // ENHANCED: Full personality implementation for image responses
                if (userTone === 'funny') {
                  baseResponse += language === 'ar' 
                    ? `\n\nأتمنى أن تحب هذه التحفة الفنية! 😄🖼️ هل تريد المزيد من الإبداع؟`
                    : `\n\nHope you love this masterpiece! 😄🖼️ Want me to create more artistic magic?`;
                } else if (userTone === 'casual') {
                  baseResponse += language === 'ar' 
                    ? `\n\nشو رأيك؟ طلعت حلوة؟ 😊`
                    : `\n\nWhat do you think? Turned out pretty cool, right? 😊`;
                } else if (userTone === 'encouraging') {
                  baseResponse += language === 'ar' 
                    ? `\n\nرائع! صورة مذهلة تعكس إبداعك! 💪✨`
                    : `\n\nAmazing! This stunning image reflects your creativity! 💪✨`;
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
          console.log(`⚡ ENHANCED: Chat processing with ${personalityEnabled ? 'FULL PERSONALITY' : 'SPEED'} mode`);
          
          // ENHANCED: Build better chat context with full personality
          let chatContext = null;
          
          if (!aggressiveOptimization) {
            // Enhanced context building for personality
            if (conversationSummary && personalityEnabled) {
              chatContext = `${conversationSummary}\n\nRecent conversation:\n${recentMessages.slice(-3).map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.substring(0, 150) : '[attachment]'}`).join('\n')}`;
            } else if (conversationSummary) {
              chatContext = `${conversationSummary}\n\nRecent: ${recentMessages.slice(-1).map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.substring(0, 100) : '[attachment]'}`).join('\n')}`;
            }
          }
          
          // ENHANCED: Determine interaction type based on personality settings
          const interactionType = aggressiveOptimization ? 'hyper_fast_openai_chat' : 
                                 personalityEnabled ? 'personality_enhanced_chat' : 
                                 'balanced_chat';
          
          console.log(`⚡ CHAT MODE: ${interactionType} | Context Length: ${chatContext?.length || 0} | Messages: ${recentMessages.length}`);
          
          response = await processWithBuddyChatAI(
            message, 
            chatContext, 
            language, 
            personalityEnabled ? recentMessages.slice(-3) : recentMessages.slice(-1),
            conversationSummary,
            activeTrigger,
            interactionType,
            processedFiles,
            customSystemPrompt, // Full system prompt without truncation
            maxTokens
          );
          break;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`⚡ ENHANCED: Processed in ${processingTime}ms (${personalityEnabled ? 'PERSONALITY' : aggressiveOptimization ? 'SPEED' : 'BALANCED'} mode)`);

    // ENHANCED: Response structure with full personality context
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
      aiProvider: OPENAI_API_KEY ? 'openai' : 'deepseek',
      taskCreationEnabled: enableTaskCreation,
      personalityContext: personalityEnabled ? {
        systemPromptLength: customSystemPrompt.length,
        contextMessages: recentMessages.length,
        summaryLength: conversationSummary.length
      } : null
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
