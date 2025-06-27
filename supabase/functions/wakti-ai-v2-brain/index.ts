
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

console.log("⚡ WAKTI AI ULTRA-FAST: Optimized processing pipeline loaded");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⚡ WAKTI AI ULTRA-FAST: Processing with maximum optimization");
    const startTime = Date.now();

    // ULTRA-FAST: Enhanced auth with longer cache validation
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
      minimalContext = false
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

    console.log("⚡ WAKTI AI ULTRA-FAST: Direct processing for user:", user.id);

    // ULTRA-FAST: Optimized file processing with direct URL handling
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      processedFiles = await processAttachedFilesUltraFast(attachedFiles);
      console.log(`⚡ OPTIMIZED: Processed ${processedFiles.length} files with direct URL handling`);
    }

    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;

    // ULTRA-FAST: Quick task detection with minimal analysis
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

    // ULTRA-FAST: Optimized processing by trigger type
    if (!needsConfirmation) {
      switch (activeTrigger) {
        case 'search':
          console.log("⚡ ULTRA-FAST: Direct search execution");
          const searchResult = await executeRegularSearch(message, language);
          if (searchResult.success) {
            browsingUsed = true;
            browsingData = searchResult.data;
            // ULTRA-FAST: Minimal context for search
            const context = minimalContext && conversationSummary ? 
              `${conversationSummary}\n\nResults: ${searchResult.context.substring(0, 1000)}` : // Truncated for speed
              searchResult.context;
            response = await processWithBuddyChatAI(
              message, 
              context, 
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
              minimalContext ? '' : conversationSummary, 
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
          console.log("⚡ ULTRA-FAST: Direct chat processing with minimal context");
          // ULTRA-FAST: Minimal context for faster processing
          const chatContext = minimalContext ? 
            (conversationSummary ? `Context: ${conversationSummary.substring(0, 200)}` : null) :
            (conversationSummary ? 
              `${conversationSummary}\n\nRecent: ${recentMessages.slice(-1).map(m => `${m.role}: ${m.content}`).join('\n')}` :
              null);
          response = await processWithBuddyChatAI(
            message, 
            chatContext, 
            language, 
            [],
            '',
            activeTrigger,
            'direct_chat',
            processedFiles
          );
          break;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`⚡ WAKTI AI ULTRA-FAST: Processed in ${processingTime}ms`);

    // ULTRA-FAST: Minimal response structure for speed
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
      success: true,
      processingTime
    };

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

// ULTRA-FAST: Direct URL file processing without heavy conversion
async function processAttachedFilesUltraFast(attachedFiles: any[]): Promise<any[]> {
  if (!attachedFiles || attachedFiles.length === 0) return [];

  return attachedFiles.map(file => {
    // Direct URL handling for optimized files (fastest path)
    if (file.optimized && file.publicUrl) {
      return {
        type: 'image_url',
        image_url: {
          url: file.publicUrl
        },
        name: file.name
      };
    }
    
    // Skip processing large files for speed
    if (file.content && file.content.length < 500000) { // 500KB limit
      return {
        type: 'image_url',
        image_url: {
          url: `data:${file.type};base64,${file.content}`
        },
        name: file.name
      };
    }
    
    return null;
  }).filter(Boolean);
}
