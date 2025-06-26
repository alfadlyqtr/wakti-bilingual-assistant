
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { analyzeTaskIntent } from "../wakti-ai-v2-brain/taskParsing.ts";
import { processWithBuddyChatAI } from "../wakti-ai-v2-brain/chatAnalysis.ts";
import { generateImageWithRunware } from "../wakti-ai-v2-brain/imageGeneration.ts";
import { executeRegularSearch } from "../wakti-ai-v2-brain/search.ts";
import { generateConversationId, DEEPSEEK_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY, RUNWARE_API_KEY, supabase } from "../wakti-ai-v2-brain/utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-auth-token, x-skip-auth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

console.log("⚡ WAKTI AI V2 STREAMING: Streaming pipeline loaded");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⚡ STREAMING: Processing request");
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
      language = 'en',
      conversationId = null,
      activeTrigger = 'chat',
      attachedFiles = [],
      stream = true
    } = requestBody;

    if (!message?.trim() && !attachedFiles?.length) {
      return new Response(JSON.stringify({ 
        error: "Message or attachment required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("⚡ STREAMING: Starting response stream for user:", user.id);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Send initial thinking message
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            token: '',
            thinking: true,
            message: language === 'ar' ? 'WAKTI يفكر...' : 'WAKTI is thinking...'
          })}\n\n`));

          // Process attached files
          let processedFiles = [];
          if (attachedFiles && attachedFiles.length > 0) {
            processedFiles = await processAttachedFilesOptimized(attachedFiles);
          }

          let response = '';
          let imageUrl = null;
          let browsingUsed = false;
          let browsingData = null;
          let actionTaken = null;
          let needsConfirmation = false;
          let pendingTaskData = null;
          let pendingReminderData = null;

          // Quick task detection
          const hasTaskKeywords = /create task|add task|أنشئ مهمة|create reminder|add reminder/i.test(message);

          if (hasTaskKeywords) {
            console.log("⚡ STREAMING: Task creation detected");
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

              // Stream the response
              await streamText(controller, encoder, response);
            }
          }

          // Process based on trigger if no confirmation needed
          if (!needsConfirmation) {
            switch (activeTrigger) {
              case 'search':
                console.log("⚡ STREAMING: Search execution");
                const searchResult = await executeRegularSearch(message, language);
                if (searchResult.success) {
                  browsingUsed = true;
                  browsingData = searchResult.data;
                  response = await streamChatResponse(
                    message, 
                    searchResult.context, 
                    language, 
                    activeTrigger,
                    controller,
                    encoder
                  );
                } else {
                  response = await streamChatResponse(
                    message, 
                    '', 
                    language, 
                    activeTrigger,
                    controller,
                    encoder
                  );
                }
                break;

              case 'image':
                console.log("⚡ STREAMING: Image generation");
                try {
                  const imageResult = await generateImageWithRunware(message, user.id, language);
                  
                  if (imageResult.success) {
                    imageUrl = imageResult.imageUrl;
                    response = language === 'ar' 
                      ? `تم إنشاء الصورة بنجاح.`
                      : `Image generated successfully.`;

                    if (imageResult.translation_status === 'success' && imageResult.translatedPrompt) {
                      response += language === 'ar'
                        ? `\n\n📝 (ترجمة: "${imageResult.translatedPrompt}")`
                        : `\n\n📝 (Translated: "${imageResult.translatedPrompt}")`;
                    }
                  } else {
                    response = imageResult.error;
                  }
                  
                  await streamText(controller, encoder, response);
                } catch (error) {
                  response = language === 'ar' 
                    ? `❌ عذراً، حدث خطأ أثناء إنشاء الصورة.`
                    : `❌ Sorry, an error occurred while generating the image.`;
                  await streamText(controller, encoder, response);
                }
                break;

              case 'chat':
              default:
                console.log("⚡ STREAMING: Chat processing");
                response = await streamChatResponse(
                  message, 
                  null, 
                  language, 
                  activeTrigger,
                  controller,
                  encoder,
                  processedFiles
                );
                break;
            }
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();

          const processingTime = Date.now() - startTime;
          console.log(`⚡ STREAMING: Completed in ${processingTime}ms`);

        } catch (error) {
          console.error("⚡ STREAMING: Error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            error: error.message || 'Streaming error' 
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error("⚡ STREAMING: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Streaming error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Helper function to stream text token by token
async function streamText(controller: any, encoder: TextEncoder, text: string) {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const chunk = words.slice(0, i + 1).join(' ');
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: chunk })}\n\n`));
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for streaming effect
  }
}

// Helper function to stream chat response
async function streamChatResponse(
  message: string, 
  context: string | null, 
  language: string, 
  activeTrigger: string,
  controller: any,
  encoder: TextEncoder,
  attachedFiles: any[] = []
): Promise<string> {
  try {
    const fullResponse = await processWithBuddyChatAI(
      message, 
      context, 
      language, 
      [],
      '',
      activeTrigger,
      'streaming_chat',
      attachedFiles
    );

    // Stream the response
    await streamText(controller, encoder, fullResponse);
    return fullResponse;
  } catch (error) {
    const errorMessage = language === 'ar' 
      ? 'عذراً، حدث خطأ في المعالجة.'
      : 'Sorry, an error occurred during processing.';
    
    await streamText(controller, encoder, errorMessage);
    return errorMessage;
  }
}

// Process optimized files
async function processAttachedFilesOptimized(attachedFiles: any[]): Promise<any[]> {
  if (!attachedFiles || attachedFiles.length === 0) return [];

  return attachedFiles.map(file => {
    if (file.optimized && file.url) {
      return {
        type: 'image_url',
        image_url: {
          url: file.url
        }
      };
    }
    
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
