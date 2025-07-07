

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

console.log("🚀 WAKTI AI: Fixed AI system with proper model selection and context restoration");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 AI: Processing request with fixed AI system");
    const startTime = Date.now();

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
      maxTokens = 4096,
      userStyle = 'detailed',
      userTone = 'neutral',
      speedOptimized = true,
      aggressiveOptimization = false, // FIXED: Disabled aggressive optimization
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
    console.log(`🚀 AI: ${currentDateContext} | User ${user.id} | Files: ${attachedFiles?.length || 0}`);

    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      console.log(`📁 AI: Processing ${attachedFiles.length} files`);
      
      processedFiles = attachedFiles.filter(file => {
        if (file.type && file.type.startsWith('image/')) {
          const hasValidUrl = file.image_url?.url;
          if (!hasValidUrl) {
            console.error(`❌ AI: No valid URL for image: ${file.name}`);
            return false;
          }
          
          const isBase64 = file.image_url.url.startsWith('data:image/');
          console.log(`✅ AI: Processing ${file.name} -> ${isBase64 ? 'BASE64' : 'URL'}: ${file.image_url.url.substring(0, 50)}...`);
          return true;
        }
        return false;
      });
      
      console.log(`🚀 AI: Prepared ${processedFiles.length} files for processing`);
    }

    // FIXED: Context loading optimization - load summary + last 3-4 messages only
    let contextRecentMessages = recentMessages.slice(-4); // Last 4 messages as specified
    let contextConversationSummary = conversationSummary; // Keep full summary
    
    console.log(`🚀 CONTEXT RESTORED: Messages: ${contextRecentMessages.length}, Summary: ${contextConversationSummary.length} chars`);

    let taskAnalysisResult = null;
    try {
      console.log("🔍 TASK DETECTION: Analyzing message for task intent");
      taskAnalysisResult = await analyzeTaskIntent(message, language);
      console.log("🔍 TASK ANALYSIS RESULT:", JSON.stringify(taskAnalysisResult, null, 2));
    } catch (taskError) {
      console.error("🔍 TASK ANALYSIS ERROR:", taskError);
    }

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
        aggressiveOptimization: false, // FIXED
        userStyle,
        userTone,
        tokensUsed: 0,
        aiProvider: 'task_parser',
        taskCreationEnabled: true,
        personalizedResponse: false,
        taskDetected: true,
        currentDateContext,
        contextRestored: true
      };

      console.log(`🚀 TASK CONFIRMATION: Returning structured data in ${processingTime}ms`);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;

    switch (activeTrigger) {
      case 'search':
        console.log("🔍 SEARCH: Processing search request");
        const searchResult = await executeRegularSearch(message, language);
        if (searchResult.success) {
          browsingUsed = true;
          browsingData = searchResult.data;
          const context = searchResult.context.substring(0, 800);
          
          const chatResult = await processWithBuddyChatAI(
            `${currentDateContext}\n\n${message}\n\nSearch Context: ${context}`,
            userId,
            conversationId,
            language,
            processedFiles,
            contextRecentMessages, // FIXED: Use proper context
            contextConversationSummary, // FIXED: Use proper summary
            personalTouch,
            maxTokens,
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
            contextRecentMessages, // FIXED: Use proper context
            contextConversationSummary, // FIXED: Use proper summary
            personalTouch,
            maxTokens,
            activeTrigger
          );
          response = chatResult.response;
        }
        break;

      case 'image':
        console.log("🎨 IMAGE: Processing image generation");
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
          console.error("Image generation error:", error);
          response = language === 'ar' 
            ? `❌ عذراً، حدث خطأ أثناء إنشاء الصورة.`
            : `❌ Sorry, an error occurred while generating the image.`;
        }
        break;

      case 'chat':
      default:
        console.log(`🚀 AI CHAT: Processing with restored context and proper models`);
        console.log(`🖼️ FILES: ${processedFiles.length} files ready for processing`);
        
        const chatResult = await processWithBuddyChatAI(
          `${currentDateContext}\n\n${message}`,
          userId,
          conversationId,
          language,
          processedFiles,
          contextRecentMessages, // FIXED: Use proper context (last 3-4 messages)
          contextConversationSummary, // FIXED: Use full conversation summary
          personalTouch,
          maxTokens,
          activeTrigger
        );
        response = chatResult.response;
        console.log(`🎯 RESULT: Model used: ${chatResult.model}, Tokens: ${chatResult.tokensUsed}, Fallback: ${chatResult.fallbackUsed || false}`);
        break;
    }

    const processingTime = Date.now() - startTime;
    console.log(`🚀 AI: Processing completed in ${processingTime}ms`);

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: 'fixed_ai_with_context',
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
      aggressiveOptimization: false, // FIXED: Disabled
      userStyle,
      userTone,
      tokensUsed: maxTokens,
      aiProvider: 'openai_fixed_with_fallbacks',
      taskCreationEnabled: enableTaskCreation,
      personalizedResponse: !!personalTouch,
      currentDateContext,
      visionEnhanced: processedFiles.length > 0,
      contextRestored: true,
      modelsUsed: processedFiles.length > 0 ? 'gpt-4-vision-preview' : 'gpt-4o-mini',
      fallbacksAvailable: true
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚨 AI: Critical Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'AI processing error',
      success: false,
      currentDateContext: getCurrentDateContext(),
      contextRestored: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

