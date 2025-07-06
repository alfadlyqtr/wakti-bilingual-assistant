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

// CRITICAL FIX: Current date context for AI
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

console.log("🚀 WAKTI AI ULTRA-FAST: Enhanced with current date context and fixed Vision API");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 VISION AI: Processing with restored Vision system and current date context");
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

    // CRITICAL FIX: Include current date in all AI processing
    const currentDateContext = getCurrentDateContext();
    console.log(`🚀 VISION AI: ${currentDateContext} | User ${user.id} | Personal Touch: ${!!personalTouch}`);

    // RESTORED: Direct file processing for Vision API
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      console.log(`📁 VISION API: Processing ${attachedFiles.length} files with restored format:`, JSON.stringify(attachedFiles.map(f => ({
        name: f.name,
        type: f.type,
        hasImageUrl: !!f.image_url,
        hasPublicUrl: !!f.publicUrl,
        optimized: f.optimized
      })), null, 2));
      
      // DIRECT PASS: Files are already in correct format from useOptimizedFileUpload
      processedFiles = attachedFiles.filter(file => {
        if (file.type && file.type.startsWith('image/')) {
          const hasValidUrl = file.image_url?.url || file.publicUrl;
          if (!hasValidUrl) {
            console.error(`❌ VISION API: No valid URL for image: ${file.name}`, file);
            return false;
          }
          console.log(`✅ VISION API: File ready for processing: ${file.name}`);
          return true;
        }
        return false;
      });
      
      console.log(`🚀 VISION AI: Successfully prepared ${processedFiles.length} files for Vision API`);
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
        currentDateContext, // CRITICAL FIX: Include date context
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
            
            // CRITICAL FIX: Extract response field from result object
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
            response = chatResult.response; // Extract the response field
          } else {
            // CRITICAL FIX: Extract response field from result object
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
            response = chatResult.response; // Extract the response field
          }
        } else {
          // CRITICAL FIX: Extract response field from result object
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
          response = chatResult.response; // Extract the response field
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
        console.log(`🚀 VISION AI CHAT: Processing with restored Vision system and personalization`);
        
        // ULTRA-FAST: Minimal context for lightning speed
        let chatContext = aggressiveOptimization ? '' : minimalConversationSummary;
        
        console.log(`🚀 VISION AI CHAT: Context: ${chatContext?.length || 0} | Messages: ${minimalRecentMessages.length} | Files: ${processedFiles.length} | Personal Touch: ${!!personalTouch}`);
        
        // CRITICAL FIX: Extract response field from result object + include date context
        const chatResult = await processWithBuddyChatAI(
          `${currentDateContext}\n\n${message}`,
          userId,
          conversationId,
          language,
          processedFiles,
          minimalRecentMessages,
          chatContext,
          personalTouch,
          maxTokens,
          activeTrigger
        );
        response = chatResult.response; // Extract the response field
        break;
    }

    const processingTime = Date.now() - startTime;
    console.log(`🚀 VISION AI: Processed in ${processingTime}ms (${aggressiveOptimization ? 'HYPER-FAST' : speedOptimized ? 'ULTRA-FAST' : 'SPEED'} mode)`);

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
      currentDateContext, // CRITICAL FIX: Include date context in response
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
      currentDateContext: getCurrentDateContext() // Include date even in errors
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// CRITICAL FIX: Current date context for AI
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
