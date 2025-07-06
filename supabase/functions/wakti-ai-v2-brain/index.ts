
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

const getCurrentDateContext = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return `Current date and time: ${dateStr}, ${timeStr}`;
};

console.log("🚀 WAKTI AI VISION: Enhanced with proper Vision API support");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 VISION AI: Processing request with restored Vision system");
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

    const currentDateContext = getCurrentDateContext();
    console.log(`🚀 VISION AI: ${currentDateContext} | User ${user.id} | Files: ${attachedFiles?.length || 0}`);

    // CRITICAL: Process files for Vision API
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      console.log(`📁 VISION API: Processing ${attachedFiles.length} files`);
      
      processedFiles = attachedFiles.filter(file => {
        if (file.type && file.type.startsWith('image/')) {
          const hasValidUrl = file.image_url?.url || file.publicUrl;
          if (!hasValidUrl) {
            console.error(`❌ VISION API: No valid URL for image: ${file.name}`);
            return false;
          }
          console.log(`✅ VISION API: File ready: ${file.name} -> ${file.image_url?.url || file.publicUrl}`);
          return true;
        }
        return false;
      });
      
      console.log(`🚀 VISION AI: Prepared ${processedFiles.length} files for Vision API`);
    }

    // Optimize context for speed
    let minimalRecentMessages = aggressiveOptimization ? recentMessages.slice(-2) : recentMessages.slice(-3);
    let minimalConversationSummary = aggressiveOptimization ? '' : conversationSummary.substring(0, 200);
    
    console.log(`🚀 SPEED MODE: Context messages: ${minimalRecentMessages.length}, Summary: ${minimalConversationSummary.length} chars`);

    // Task detection
    let taskAnalysisResult = null;
    try {
      console.log("🔍 TASK DETECTION: Analyzing message for task intent");
      taskAnalysisResult = await analyzeTaskIntent(message, language);
      console.log("🔍 TASK ANALYSIS RESULT:", JSON.stringify(taskAnalysisResult, null, 2));
    } catch (taskError) {
      console.error("🔍 TASK ANALYSIS ERROR:", taskError);
    }

    // Return task confirmation if detected
    if (taskAnalysisResult && (taskAnalysisResult.isTask || taskAnalysisResult.isReminder)) {
      console.log(`🔍 TASK DETECTED: ${taskAnalysisResult.isTask ? 'Task' : 'Reminder'} - Returning confirmation data`);
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        response: '',
        conversationId: conversationId || generateConversationId(),
        intent: taskAnalysisResult.isTask ? 'task_creation' : 'reminder_creation',
        confidence: 'high',
        actionTaken: false,
        imageUrl: null,
        browsingUsed: false,
        browsingData: null,
        needsConfirmation: true,
        pendingTaskData: taskAnalysisResult.isTask ? taskAnalysisResult.taskData : null,
        pendingReminderData: taskAnalysisResult.isReminder ? taskAnalysisResult.reminderData : null,
        success: true,
        processingTime,
        speedOptimized: true,
        aggressiveOptimization,
        userStyle,
        userTone,
        tokensUsed: 0,
        aiProvider: 'task_parser',
        taskCreationEnabled: true,
        personalizedResponse: false,
        taskDetected: true,
        currentDateContext,
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

    // Main processing
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
            
            const chatResult = await processWithBuddyChatAI(
              `${currentDateContext}\n\n${message}\n\nSearch Context: ${context}`,
              userId,
              conversationId,
              language,
              processedFiles,
              minimalRecentMessages,
              minimalConversationSummary,
              personalTouch,
              Math.min(maxTokens, 300),
              activeTrigger
            );
            response = chatResult.response;
          } else {
            const chatResult = await processWithBuddyChatAI(
              `${currentDateContext}\n\n${message}`,
              userId,
              conversationId,
              language,
              processedFiles,
              [],
              '',
              personalTouch,
              Math.min(maxTokens, 200),
              activeTrigger
            );
            response = chatResult.response;
          }
        } else {
          const chatResult = await processWithBuddyChatAI(
            `${currentDateContext}\n\n${message}`,
            userId,
            conversationId,
            language,
            processedFiles,
            [],
            '',
            personalTouch,
            Math.min(maxTokens, 150),
            'chat'
          );
          response = chatResult.response;
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
        console.log(`🚀 VISION AI CHAT: Processing with Vision system`);
        console.log(`🖼️ VISION FILES: ${processedFiles.length} files ready for Vision API`);
        
        const chatResult = await processWithBuddyChatAI(
          `${currentDateContext}\n\n${message}`,
          userId,
          conversationId,
          language,
          processedFiles,
          minimalRecentMessages,
          minimalConversationSummary,
          personalTouch,
          maxTokens,
          activeTrigger
        );
        response = chatResult.response;
        break;
    }

    const processingTime = Date.now() - startTime;
    console.log(`🚀 VISION AI: Processed in ${processingTime}ms with Vision support`);

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: aggressiveOptimization ? 'hyper_fast' : (speedOptimized ? 'ultra_fast' : 'speed_optimized'),
      confidence: 'high',
      actionTaken,
      imageUrl,
      browsingUsed,
      browsingData,
      needsConfirmation: false,
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
      currentDateContext,
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
    console.error("🚨 VISION AI: Critical Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Processing error',
      success: false,
      currentDateContext: getCurrentDateContext()
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
