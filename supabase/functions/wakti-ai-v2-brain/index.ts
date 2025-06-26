
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

console.log("⚡ WAKTI AI ULTRA-FAST: Direct processing pipeline loaded");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⚡ WAKTI AI ULTRA-FAST: Processing request with minimal overhead");

    // STREAMLINED: Single auth check with minimal validation
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // FAST: Direct user extraction without full verification
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
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
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      activeTrigger = 'chat',
      attachedFiles = []
    } = requestBody;

    // STREAMLINED: Basic validation only
    if (userId !== user.id) {
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if ((!message || message.trim() === '') && attachedFiles.length === 0) {
      return new Response(JSON.stringify({ 
        error: "Message or attachment required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("⚡ WAKTI AI ULTRA-FAST: Direct processing for user:", user.id);

    // ULTRA-FAST: Skip all analysis overhead, go direct to processing
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;

    // FAST: Only check for explicit task creation if keywords are present
    const hasTaskKeywords = message.toLowerCase().includes('create task') || 
                           message.toLowerCase().includes('add task') ||
                           message.toLowerCase().includes('أنشئ مهمة') ||
                           message.toLowerCase().includes('create reminder') ||
                           message.toLowerCase().includes('add reminder');

    if (hasTaskKeywords) {
      console.log("⚡ ULTRA-FAST: Task creation detected, minimal analysis");
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

    // ULTRA-FAST: Direct processing based on trigger without analysis
    if (!needsConfirmation) {
      switch (activeTrigger) {
        case 'search':
          console.log("⚡ ULTRA-FAST: Direct search execution");
          const searchResult = await executeRegularSearch(message, language);
          if (searchResult.success) {
            browsingUsed = true;
            browsingData = searchResult.data;
            response = await processWithBuddyChatAI(
              message, 
              searchResult.context, 
              language, 
              [],
              '',
              activeTrigger,
              'search_results',
              attachedFiles
            );
          } else {
            response = await processWithBuddyChatAI(
              message, 
              null, 
              language, 
              [],
              '',
              activeTrigger,
              'search_failed',
              attachedFiles
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
          console.log("⚡ ULTRA-FAST: Direct chat processing");
          response = await processWithBuddyChatAI(
            message, 
            null, 
            language, 
            [],
            '',
            activeTrigger,
            'direct_chat',
            attachedFiles
          );
          break;
      }
    }

    // ULTRA-FAST: Minimal response structure
    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: 'processed',
      confidence: 'high',
      actionTaken,
      imageUrl,
      browsingUsed,
      browsingData,
      needsConfirmation,
      pendingTaskData,
      pendingReminderData,
      success: true
    };

    console.log("⚡ WAKTI AI ULTRA-FAST: Response ready in record time");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("⚡ WAKTI AI ULTRA-FAST: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Processing error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
