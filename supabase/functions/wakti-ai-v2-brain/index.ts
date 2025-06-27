
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

console.log("⚡ WAKTI AI ULTRA-FAST: OpenAI-first processing pipeline with DeepSeek fallback");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⚡ WAKTI AI ULTRA-FAST: Processing with OpenAI primary, DeepSeek fallback");
    const startTime = Date.now();

    // ULTRA-FAST: Skip full auth if cached token provided
    const skipAuth = req.headers.get('x-skip-auth') === 'true';
    const authToken = req.headers.get('x-auth-token');
    
    let user;
    if (skipAuth && authToken) {
      // Minimal token validation instead of full getUser()
      try {
        const { data } = await supabase.auth.getUser(authToken);
        user = data.user;
      } catch (e) {
        // Fallback to full auth if token invalid
        const authHeader = req.headers.get('authorization');
        if (!authHeader) throw new Error('Authentication required');
        const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        user = data.user;
      }
    } else {
      // Standard auth for non-optimized requests
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
      speedOptimized = false
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

    console.log(`⚡ ULTRA-FAST: Processing for user ${user.id} with style: ${userStyle}, tokens: ${maxTokens}`);

    // OPTIMIZED: Process attached files with URL handling
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      processedFiles = await processAttachedFilesOptimized(attachedFiles);
      console.log(`⚡ OPTIMIZED: Processed ${processedFiles.length} files`);
    }

    // ULTRA-FAST: Smart processing pipeline with OpenAI priority
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;

    // SPEED-OPTIMIZED: Quick task detection for high-priority keywords only
    const hasTaskKeywords = /create task|add task|أنشئ مهمة|create reminder|add reminder/i.test(message);

    if (hasTaskKeywords) {
      console.log("⚡ ULTRA-FAST: Task creation detected");
      const taskAnalysis = await analyzeTaskIntent(message, language);
      
      if (taskAnalysis.isTask || taskAnalysis.isReminder) {
        needsConfirmation = true;
        
        if (taskAnalysis.isTask) {
          pendingTaskData = taskAnalysis.taskData;
          response = language === 'ar' 
            ? `اكتشفت أنك تريد إنشاء مهمة. راجع التفاصيل وتأكد:`
            : `I detected you want to create a task. Please review and confirm:`;
        } else {
          pendingReminderData = taskAnalysis.reminderData;
          response = language === 'ar' 
            ? `اكتشفت أنك تريد إنشاء تذكير. راجع التفاصيل وتأكد:`
            : `I detected you want to create a reminder. Please review and confirm:`;
        }
      }
    }

    // ULTRA-FAST: Direct processing based on trigger with OpenAI priority
    if (!needsConfirmation) {
      switch (activeTrigger) {
        case 'search':
          console.log("⚡ ULTRA-FAST: Direct search execution");
          const searchResult = await executeRegularSearch(message, language);
          if (searchResult.success) {
            browsingUsed = true;
            browsingData = searchResult.data;
            // ULTRA-FAST: Use minimal context for search with OpenAI processing
            const context = userStyle === 'short answers' ? 
              searchResult.context.substring(0, 500) : // Limit context for short answers
              searchResult.context;
            response = await processWithBuddyChatAI(
              message, 
              context, 
              language, 
              [],
              '',
              activeTrigger,
              'search_results',
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
          break;

        case 'image':
          console.log("⚡ ULTRA-FAST: Direct image generation");
          try {
            const imageResult = await generateImageWithRunware(message, user.id, language);
            
            if (imageResult.success) {
              imageUrl = imageResult.imageUrl;
              
              let baseResponse = language === 'ar' 
                ? `تم إنشاء الصورة بنجاح.`
                : `Image generated successfully.`;

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
          console.log("⚡ ULTRA-FAST: Direct chat processing with OpenAI");
          // ULTRA-FAST: Build minimal chat context for OpenAI processing
          const chatContext = userStyle === 'short answers' ? 
            null : // Skip context for short answers
            (conversationSummary ? 
              `${conversationSummary}\n\nRecent: ${recentMessages.slice(-1).map(m => `${m.role}: ${m.content.substring(0, 100)}`).join('\n')}` :
              null);
          
          response = await processWithBuddyChatAI(
            message, 
            chatContext, 
            language, 
            [],
            '',
            activeTrigger,
            'ultra_fast_openai_chat',
            processedFiles,
            customSystemPrompt,
            maxTokens
          );
          break;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`⚡ ULTRA-FAST: Processed in ${processingTime}ms (target: <4000ms with OpenAI)`);

    // ULTRA-FAST: Minimal response structure
    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: 'ultra_fast_openai',
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
      tokensUsed: maxTokens,
      aiProvider: OPENAI_API_KEY ? 'openai' : 'deepseek'
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("⚡ ULTRA-FAST: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Processing error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// OPTIMIZED: Process files with URL handling instead of Base64
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
