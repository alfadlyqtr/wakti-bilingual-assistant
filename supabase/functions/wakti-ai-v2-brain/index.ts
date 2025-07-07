
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { analyzeTaskIntent } from "./taskParsing.ts";
import { processWithClaudeAI } from "./chatAnalysis.ts";
import { generateImageWithRunware } from "./imageGeneration.ts";
import { executeRegularSearch } from "./search.ts";
import { generateConversationId, validateApiKeys, logWithTimestamp, supabase } from "./utils.ts";

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

console.log("🚀 WAKTI AI: UPGRADED Edge Function Starting - Enhanced Claude System");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI: Processing request with UPGRADED validation system");
    const startTime = Date.now();

    // CRITICAL: Validate API keys at startup
    const keyValidation = validateApiKeys();
    if (!keyValidation.valid) {
      console.error("❌ CRITICAL: Missing API keys at startup:", keyValidation.missing);
      return new Response(JSON.stringify({ 
        error: `System configuration incomplete. Missing: ${keyValidation.missing.join(', ')}`,
        success: false,
        missingKeys: keyValidation.missing
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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
        error: "Authentication required - please log in",
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
      hasTaskIntent = false,
      personalityEnabled = true,
      enableTaskCreation = true,
      enablePersonality = true,
      personalTouch = null
    } = requestBody;

    if (userId !== user.id) {
      return new Response(JSON.stringify({ 
        error: "Access denied - user ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!message?.trim() && !attachedFiles?.length) {
      return new Response(JSON.stringify({ 
        error: "Message or image required - please provide input",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const currentDateContext = getCurrentDateContext();
    console.log(`🚀 WAKTI AI: ${currentDateContext} | User ${user.id} | Files: ${attachedFiles?.length || 0}`);

    // FIXED: Enhanced image processing with comprehensive validation
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      console.log(`📁 VISION: Validating ${attachedFiles.length} files with ENHANCED processing`);
      
      processedFiles = attachedFiles.filter(file => {
        if (file.type && file.type.startsWith('image/')) {
          // FIXED: Check for base64 data in multiple locations
          const hasBase64Data = file.base64Data && file.base64Data.length > 100;
          const hasValidImageUrl = file.image_url?.url && file.image_url.url.startsWith('data:image/');
          const hasValidUrl = file.url && file.url.startsWith('data:image/');
          
          if (hasBase64Data || hasValidImageUrl || hasValidUrl) {
            console.log(`✅ VISION: Valid image ${file.name} -> BASE64 DATA AVAILABLE`);
            return true;
          } else {
            console.error(`❌ VISION: No valid base64 data for image: ${file.name}`);
            return false;
          }
        }
        return false;
      });
      
      if (processedFiles.length === 0 && attachedFiles.length > 0) {
        return new Response(JSON.stringify({
          error: "❌ Unable to process the uploaded images. Please upload valid JPEG or PNG files with proper base64 data.",
          success: false,
          debugInfo: attachedFiles.map(f => ({
            name: f.name,
            type: f.type,
            hasBase64: !!f.base64Data,
            hasImageUrl: !!f.image_url,
            hasUrl: !!f.url
          }))
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      console.log(`🚀 VISION: Successfully validated ${processedFiles.length} files for ENHANCED Claude Vision processing`);
    }

    // Enhanced context loading from database
    let contextRecentMessages = [];
    let contextConversationSummary = '';
    
    if (conversationId) {
      console.log(`🧠 CONTEXT: Loading ENHANCED context for conversation ${conversationId}`);
      
      try {
        // Get conversation summary from database
        const { data: summaryData, error: summaryError } = await supabase
          .from('ai_conversation_summaries')
          .select('summary_text, message_count')
          .eq('user_id', user.id)
          .eq('conversation_id', conversationId)
          .single();

        if (summaryData && !summaryError) {
          contextConversationSummary = summaryData.summary_text || '';
          console.log(`🧠 CONTEXT: Loaded summary (${contextConversationSummary.length} chars, ${summaryData.message_count} messages)`);
        }

        // Get recent messages from database
        const { data: messagesData, error: messagesError } = await supabase
          .from('ai_chat_history')
          .select('role, content, created_at')
          .eq('user_id', user.id)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(4);

        if (messagesData && !messagesError) {
          contextRecentMessages = messagesData.reverse().map(msg => ({
            role: msg.role,
            content: msg.content
          }));
          console.log(`🧠 CONTEXT: Loaded ${contextRecentMessages.length} recent messages from database`);
        }
      } catch (contextError) {
        console.error('🧠 CONTEXT ERROR:', contextError);
      }
    }
    
    // Fallback to provided context if database load failed
    if (contextRecentMessages.length === 0 && recentMessages.length > 0) {
      contextRecentMessages = recentMessages.slice(-4);
      console.log(`🧠 CONTEXT FALLBACK: Using provided messages (${contextRecentMessages.length})`);
    }
    
    if (!contextConversationSummary && conversationSummary) {
      contextConversationSummary = conversationSummary;
      console.log(`🧠 CONTEXT FALLBACK: Using provided summary (${contextConversationSummary.length} chars)`);
    }
    
    console.log(`🧠 CONTEXT COMPLETE: Messages: ${contextRecentMessages.length}, Summary: ${contextConversationSummary.length} chars`);

    // ENHANCED TASK DETECTION
    let taskAnalysisResult = null;
    try {
      console.log("🔍 TASK DETECTION: Analyzing message with ENHANCED intent detection");
      taskAnalysisResult = await analyzeTaskIntent(message, language);
      console.log("🔍 ENHANCED TASK ANALYSIS RESULT:", JSON.stringify(taskAnalysisResult, null, 2));
    } catch (taskError) {
      console.error("🔍 TASK ANALYSIS ERROR:", taskError);
    }

    if (taskAnalysisResult && (taskAnalysisResult.isTask || taskAnalysisResult.isReminder)) {
      console.log(`🔍 TASK DETECTED: ${taskAnalysisResult.isTask ? 'Task' : 'Reminder'} - Returning ENHANCED confirmation data`);
      
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
        userStyle,
        userTone,
        tokensUsed: 0,
        aiProvider: 'enhanced_task_parser',
        taskCreationEnabled: true,
        personalizedResponse: false,
        taskDetected: true,
        currentDateContext,
        contextRestored: true,
        fullContextUsed: true,
        enhancedTaskParsing: true
      };

      console.log(`🚀 ENHANCED TASK CONFIRMATION: Returning structured data in ${processingTime}ms`);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MAIN PROCESSING WITH ENHANCED CLAUDE
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;

    switch (activeTrigger) {
      case 'search':
        console.log("🔍 SEARCH: Processing ENHANCED search request");
        const searchResult = await executeRegularSearch(message, language);
        if (searchResult.success) {
          browsingUsed = true;
          browsingData = searchResult.data;
          const context = searchResult.context.substring(0, 1200); // Increased context
          
          const chatResult = await processWithClaudeAI(
            `${currentDateContext}\n\n${message}\n\nSearch Context: ${context}`,
            userId,
            conversationId,
            language,
            processedFiles,
            contextRecentMessages,
            contextConversationSummary,
            personalTouch,
            maxTokens,
            activeTrigger
          );
          response = chatResult.response;
          console.log(`✅ SEARCH: Search completed with ${context.length} chars context`);
        } else {
          console.error(`❌ SEARCH: Search failed:`, searchResult.error);
          const chatResult = await processWithClaudeAI(
            `${currentDateContext}\n\n${message}\n\n[Note: Search functionality unavailable]`,
            userId,
            conversationId,
            language,
            processedFiles,
            contextRecentMessages,
            contextConversationSummary,
            personalTouch,
            maxTokens,
            activeTrigger
          );
          response = chatResult.response;
        }
        break;

      case 'image':
        console.log("🎨 IMAGE: Processing ENHANCED image generation");
        try {
          const imageResult = await generateImageWithRunware(message, user.id, language);
          
          if (imageResult.success) {
            imageUrl = imageResult.imageUrl;
            
            let baseResponse = language === 'ar' 
              ? `تم إنشاء الصورة بنجاح! 🎨✨`
              : `Image generated successfully! 🎨✨`;

            if (imageResult.translation_status === 'success' && imageResult.translatedPrompt) {
              baseResponse += language === 'ar'
                ? `\n\n📝 (ترجمة محسنة: "${imageResult.translatedPrompt}")`
                : `\n\n📝 (Enhanced Translation: "${imageResult.translatedPrompt}")`;
            }

            response = baseResponse;
            console.log(`✅ IMAGE: Image generated successfully with URL: ${imageUrl}`);
          } else {
            console.error(`❌ IMAGE: Generation failed:`, imageResult.error);
            response = imageResult.error;
          }
        } catch (error) {
          console.error("❌ IMAGE: Generation error:", error);
          response = language === 'ar' 
            ? `❌ عذراً، حدث خطأ أثناء إنشاء الصورة.`
            : `❌ Sorry, an error occurred while generating the image.`;
        }
        break;

      case 'chat':
      default:
        console.log(`🚀 WAKTI AI: Processing with ENHANCED Claude System`);
        console.log(`🖼️ VISION: ${processedFiles.length} files ready for ENHANCED Claude Vision processing`);
        
        const chatResult = await processWithClaudeAI(
          `${currentDateContext}\n\n${message}`,
          userId,
          conversationId,
          language,
          processedFiles,
          contextRecentMessages,
          contextConversationSummary,
          personalTouch,
          maxTokens,
          activeTrigger
        );
        response = chatResult.response;
        console.log(`🎯 ENHANCED RESULT: Model: ${chatResult.model}, Tokens: ${chatResult.tokensUsed}, Fallback: ${chatResult.fallbackUsed || false}`);
        break;
    }

    const processingTime = Date.now() - startTime;
    console.log(`🚀 WAKTI AI: ENHANCED processing completed successfully in ${processingTime}ms`);

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: 'wakti_ai_enhanced_complete',
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
      userStyle,
      userTone,
      tokensUsed: maxTokens,
      aiProvider: 'wakti_ai_enhanced_system',
      taskCreationEnabled: enableTaskCreation,
      personalizedResponse: !!personalTouch,
      currentDateContext,
      visionEnhanced: processedFiles.length > 0,
      contextRestored: true,
      modelsUsed: processedFiles.length > 0 ? 'claude-3-5-sonnet-20241022 with enhanced vision' : 'claude-3-5-sonnet-20241022 with deepseek fallback',
      fallbacksAvailable: true,
      fullContextUsed: true,
      apiKeysValidated: true,
      enhancedSystem: true,
      upgradeComplete: true
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚨 WAKTI AI: CRITICAL ENHANCED ERROR:", error);
    
    // Enhanced error handling with specific error types
    let userFriendlyError = 'Sorry, I encountered an error processing your request. Please try again.';
    let statusCode = 500;
    
    if (error.message.includes('Authentication')) {
      userFriendlyError = 'Please log in to continue using WAKTI AI.';
      statusCode = 401;
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      userFriendlyError = 'Too many requests. Please wait a moment and try again.';
      statusCode = 429;
    } else if (error.message.includes('image') || error.message.includes('vision')) {
      userFriendlyError = '❌ Unable to process the uploaded image. Please upload a valid JPEG or PNG file with proper data.';
      statusCode = 400;
    } else if (error.message.includes('API key')) {
      userFriendlyError = 'System configuration error. Please contact support.';
      statusCode = 500;
    } else if (error.message.includes('Anthropic') || error.message.includes('Claude')) {
      userFriendlyError = 'AI service temporarily unavailable. Please try again in a moment.';
      statusCode = 503;
    } else if (error.message.includes('Tavily') || error.message.includes('search')) {
      userFriendlyError = 'Search service temporarily unavailable. Regular chat is still available.';
      statusCode = 503;
    } else if (error.message.includes('Runware') || error.message.includes('image generation')) {
      userFriendlyError = 'Image generation service temporarily unavailable. Regular chat is still available.';
      statusCode = 503;
    }
    
    return new Response(JSON.stringify({
      error: userFriendlyError,
      success: false,
      currentDateContext: getCurrentDateContext(),
      contextRestored: false,
      errorDetails: error.message,
      enhancedErrorHandling: true,
      upgradeComplete: false
    }), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
