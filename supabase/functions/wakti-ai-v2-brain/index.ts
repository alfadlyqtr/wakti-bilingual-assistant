
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

console.log("🚀 WAKTI AI ULTRA-FAST: Timeout-protected with pre-processing personalization");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 ULTRA-FAST AI: Processing with timeout protection");
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
      maxTokens = 400,
      userStyle = 'detailed',
      userTone = 'neutral',
      speedOptimized = true,
      aggressiveOptimization = true,
      hasTaskIntent = false,
      personalityEnabled = true, // Enable personalization
      enableTaskCreation = true,
      enablePersonality = true, // Enable personalization
      personalTouch = null // Personal touch data from frontend
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

    console.log(`🚀 ULTRA-FAST: User ${user.id} | Personal Touch: ${!!personalTouch} | Speed Mode: ${speedOptimized} | Aggressive: ${aggressiveOptimization}`);

    // ULTRA-FAST: Process attached files with minimal overhead
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      processedFiles = await processAttachedFilesOptimized(attachedFiles);
      console.log(`🚀 ULTRA-FAST: Processed ${processedFiles.length} files`);
    }

    // ULTRA-FAST: Minimal context for maximum speed
    let minimalRecentMessages = aggressiveOptimization ? recentMessages.slice(-2) : recentMessages.slice(-3);
    let minimalConversationSummary = aggressiveOptimization ? '' : conversationSummary.substring(0, 200);
    
    console.log(`🚀 SPEED MODE: Context messages: ${minimalRecentMessages.length}, Summary: ${minimalConversationSummary.length} chars`);

    // SMART: Only analyze tasks for explicit keywords
    const shouldAnalyzeTask = enableTaskCreation && 
                             !aggressiveOptimization && 
                             (hasTaskIntent || 
                              message.toLowerCase().includes('create task') ||
                              message.toLowerCase().includes('add task') ||
                              message.toLowerCase().includes('remind me') ||
                              message.toLowerCase().includes('set reminder') ||
                              message.toLowerCase().includes('أنشئ مهمة') ||
                              message.toLowerCase().includes('أضف مهمة') ||
                              message.toLowerCase().includes('ذكرني') ||
                              message.toLowerCase().includes('أنشئ تذكير'));

    // ULTRA-FAST: Smart processing pipeline with speed optimization
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;

    // SMART: Task detection only for explicit keywords
    if (shouldAnalyzeTask) {
      console.log("🔍 SMART TASK: Analyzing explicit task request");
      
      try {
        const taskAnalysis = await analyzeTaskIntent(message, language);
        console.log("🔍 TASK RESULT:", JSON.stringify(taskAnalysis, null, 2));
        
        if (taskAnalysis.isTask || taskAnalysis.isReminder) {
          console.log(`🔍 SMART TASK: ${taskAnalysis.isTask ? 'Task' : 'Reminder'} detected!`);
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
        console.error("🔍 SMART TASK ERROR:", taskError);
      }
    }

    // ULTRA-FAST: Main processing with timeout protection
    if (!needsConfirmation) {
      switch (activeTrigger) {
        case 'search':
          if (!aggressiveOptimization) {
            console.log("🔍 FAST SEARCH: Speed-optimized search");
            const searchResult = await executeRegularSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              const context = searchResult.context.substring(0, aggressiveOptimization ? 300 : 800);
              
              response = await processWithBuddyChatAI(
                message, 
                context, 
                language, 
                minimalRecentMessages,
                minimalConversationSummary,
                activeTrigger,
                'ultra_fast_search',
                attachedFiles,
                customSystemPrompt,
                Math.min(maxTokens, 300),
                personalTouch
              );
            } else {
              response = await processWithBuddyChatAI(
                message, 
                '', 
                language, 
                [],
                '',
                activeTrigger,
                'ultra_fast_search_failed',
                attachedFiles,
                customSystemPrompt,
                Math.min(maxTokens, 200),
                personalTouch
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
              Math.min(maxTokens, 150),
              personalTouch
            );
          }
          break;

        case 'image':
          if (!aggressiveOptimization) {
            console.log("🎨 FAST IMAGE: Speed-optimized image generation");
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

                response = baseResponse;
              } else {
                response = imageResult.error;
              }
            } catch (error) {
              console.error("Fast image generation error:", error);
              response = language === 'ar' 
                ? `❌ عذراً، حدث خطأ أثناء إنشاء الصورة.`
                : `❌ Sorry, an error occurred while generating the image.`;
            }
          } else {
            response = language === 'ar' 
              ? `عذراً، إنشاء الصور غير متاح في الوضع السريع.`
              : `Sorry, image generation not available in ultra-fast mode.`;
          }
          break;

        case 'chat':
        default:
          console.log(`🚀 ULTRA-FAST CHAT: Processing with timeout protection and personalization`);
          
          // ULTRA-FAST: Minimal context for lightning speed
          let chatContext = aggressiveOptimization ? null : minimalConversationSummary;
          
          // ULTRA-FAST: Determine interaction type for maximum speed
          const interactionType = aggressiveOptimization ? 'hyper_fast_openai_chat' : 
                                 speedOptimized ? 'ultra_fast_chat' : 
                                 'speed_optimized_chat';
          
          console.log(`🚀 ULTRA-FAST CHAT: ${interactionType} | Context: ${chatContext?.length || 0} | Messages: ${minimalRecentMessages.length} | Personal Touch: ${!!personalTouch}`);
          
          response = await processWithBuddyChatAI(
            message, 
            chatContext, 
            language, 
            minimalRecentMessages,
            minimalConversationSummary,
            activeTrigger,
            interactionType,
            processedFiles,
            customSystemPrompt,
            maxTokens,
            personalTouch // Pass personal touch for pre-processing
          );
          break;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`🚀 ULTRA-FAST: Processed in ${processingTime}ms (${aggressiveOptimization ? 'HYPER-FAST' : speedOptimized ? 'ULTRA-FAST' : 'SPEED'} mode)`);

    // ULTRA-FAST: Response structure optimized for speed
    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: aggressiveOptimization ? 'hyper_fast' : (speedOptimized ? 'ultra_fast' : 'speed_optimized'),
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
      speedOptimized: true,
      aggressiveOptimization,
      userStyle,
      userTone,
      tokensUsed: maxTokens,
      aiProvider: OPENAI_API_KEY ? 'openai' : 'deepseek',
      taskCreationEnabled: enableTaskCreation,
      personalizedResponse: !!personalTouch,
      ultraFastMode: {
        speedOptimized,
        aggressiveOptimization,
        contextMessages: minimalRecentMessages.length,
        summaryLength: minimalConversationSummary.length,
        tokensLimit: maxTokens,
        personalTouch: !!personalTouch
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚨 ULTRA-FAST: Critical Error:", error);
    
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
