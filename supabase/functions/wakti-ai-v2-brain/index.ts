
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
      personalityEnabled = true,
      enableTaskCreation = true,
      enablePersonality = true,
      personalTouch = null
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

    // ULTRA-FAST: Process attached files with minimal overhead (ENHANCED for Vision)
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      processedFiles = await processAttachedFilesOptimized(attachedFiles);
      console.log(`🚀 ULTRA-FAST: Processed ${processedFiles.length} files (Vision-ready)`);
    }

    // ULTRA-FAST: Minimal context for maximum speed
    let minimalRecentMessages = aggressiveOptimization ? recentMessages.slice(-2) : recentMessages.slice(-3);
    let minimalConversationSummary = aggressiveOptimization ? '' : conversationSummary.substring(0, 200);
    
    console.log(`🚀 SPEED MODE: Context messages: ${minimalRecentMessages.length}, Summary: ${minimalConversationSummary.length} chars`);

    // ENHANCED: Task detection for ALL chat triggers (not just when enableTaskCreation)
    let taskAnalysisResult = null;
    try {
      console.log("🔍 TASK DETECTION: Analyzing message for task intent");
      taskAnalysisResult = await analyzeTaskIntent(message, language);
      console.log("🔍 TASK ANALYSIS RESULT:", JSON.stringify(taskAnalysisResult, null, 2));
    } catch (taskError) {
      console.error("🔍 TASK ANALYSIS ERROR:", taskError);
    }

    // CRITICAL FIX: Return structured confirmation data when task is detected
    if (taskAnalysisResult && (taskAnalysisResult.isTask || taskAnalysisResult.isReminder)) {
      console.log(`🔍 TASK DETECTED: ${taskAnalysisResult.isTask ? 'Task' : 'Reminder'} - Returning confirmation data`);
      
      const processingTime = Date.now() - startTime;
      
      // Return structured confirmation response (NO text response)
      const result = {
        response: '', // Empty response - let the UI handle the confirmation
        conversationId: conversationId || generateConversationId(),
        intent: taskAnalysisResult.isTask ? 'task_creation' : 'reminder_creation',
        confidence: 'high',
        actionTaken: false,
        imageUrl: null,
        browsingUsed: false,
        browsingData: null,
        needsConfirmation: true, // CRITICAL: This triggers the confirmation form
        pendingTaskData: taskAnalysisResult.isTask ? taskAnalysisResult.taskData : null,
        pendingReminderData: taskAnalysisResult.isReminder ? taskAnalysisResult.reminderData : null,
        success: true,
        processingTime,
        speedOptimized: true,
        aggressiveOptimization,
        userStyle,
        userTone,
        tokensUsed: 0, // No AI tokens used for task detection
        aiProvider: 'task_parser',
        taskCreationEnabled: true,
        personalizedResponse: false,
        taskDetected: true,
        ultraFastMode: {
          speedOptimized,
          aggressiveOptimization,
          contextMessages: 0,
          summaryLength: 0,
          tokensLimit: 0,
          personalTouch: false
        }
      };

      console.log(`🚀 TASK CONFIRMATION: Returning structured data in ${processingTime}ms`);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ULTRA-FAST: Main processing with timeout protection (only if no task detected)
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;

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
              processedFiles, // Pass processed files for potential Vision
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
              processedFiles, // Pass processed files for potential Vision
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
            processedFiles, // Pass processed files for potential Vision
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
          processedFiles, // ENHANCED: Pass processed files for Vision support
          customSystemPrompt,
          maxTokens,
          personalTouch
        );
        break;
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
      needsConfirmation: false, // No confirmation needed for regular chat
      pendingTaskData: null,
      pendingReminderData: null,
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

// HYPER-OPTIMIZED: Process files with URL handling for Vision API
async function processAttachedFilesOptimized(attachedFiles: any[]): Promise<any[]> {
  if (!attachedFiles || attachedFiles.length === 0) return [];

  return attachedFiles.map(file => {
    // ENHANCED: For Vision API, we need the public URL
    if (file.type && file.type.startsWith('image/')) {
      // If file is optimized with public URL, use it directly for Vision
      if (file.optimized && file.publicUrl) {
        console.log("🔍 VISION: Using optimized public URL for Vision API");
        return {
          type: 'image',
          publicUrl: file.publicUrl,
          optimized: true,
          ...file
        };
      }
      
      // If we have a regular URL, use it
      if (file.url) {
        console.log("🔍 VISION: Using regular URL for Vision API");
        return {
          type: 'image',
          url: file.url,
          ...file
        };
      }
    }
    
    // Fallback to existing Base64 processing for non-Vision files
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
