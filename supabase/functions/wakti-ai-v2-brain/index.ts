
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

console.log("⚡ WAKTI AI ENHANCED: Enhanced conversation memory and engagement");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⚡ WAKTI AI ENHANCED: Processing with enhanced conversation memory");
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
      maxTokens = 600,
      userStyle = 'detailed',
      userTone = 'neutral',
      speedOptimized = false,
      aggressiveOptimization = false,
      hasTaskIntent = false,
      personalityEnabled = true,
      enableTaskCreation = true,
      enablePersonality = true
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

    console.log(`⚡ ENHANCED: User ${user.id} | Style: ${userStyle} | Tone: ${userTone} | Tokens: ${maxTokens} | Personality: ${personalityEnabled} | Task Creation: ${enableTaskCreation}`);

    // ENHANCED: Process attached files with URL handling
    let processedFiles = [];
    if (attachedFiles && attachedFiles.length > 0) {
      processedFiles = await processAttachedFilesOptimized(attachedFiles);
      console.log(`⚡ ENHANCED: Processed ${processedFiles.length} files`);
    }

    // ENHANCED: Enhanced conversation memory integration
    let enhancedRecentMessages = recentMessages;
    let enhancedConversationSummary = conversationSummary;
    
    // Load additional conversation history if available
    if (conversationId && recentMessages.length < 7) {
      try {
        console.log("🧠 MEMORY: Loading extended conversation history");
        const { data: additionalMessages } = await supabase
          .from('ai_chat_history')
          .select('content, role, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (additionalMessages && additionalMessages.length > 0) {
          const formattedMessages = additionalMessages.reverse().map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.created_at
          }));
          enhancedRecentMessages = [...formattedMessages, ...recentMessages].slice(-7);
          console.log(`🧠 MEMORY: Enhanced context with ${enhancedRecentMessages.length} messages`);
        }
      } catch (error) {
        console.warn("🧠 MEMORY: Failed to load extended history:", error);
      }
    }

    // ENHANCED: Smart processing pipeline with enhanced conversation flow
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let actionTaken = null;
    let needsConfirmation = false;
    let pendingTaskData = null;
    let pendingReminderData = null;
    let followUpQuestion = null;
    let conversationTopics = [];

    // ENHANCED: Task detection with conversation awareness
    if (enableTaskCreation && (hasTaskIntent || (!aggressiveOptimization && activeTrigger === 'chat'))) {
      console.log("⚡ ENHANCED: Analyzing for task/reminder creation intent");
      
      try {
        const taskAnalysis = await analyzeTaskIntent(message, language);
        console.log("⚡ TASK ANALYSIS RESULT:", JSON.stringify(taskAnalysis, null, 2));
        
        if (taskAnalysis.isTask || taskAnalysis.isReminder) {
          console.log(`⚡ ENHANCED: ${taskAnalysis.isTask ? 'Task' : 'Reminder'} creation detected!`);
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
        console.error("⚡ TASK ANALYSIS ERROR:", taskError);
      }
    }

    // ENHANCED: Main processing with enhanced conversation memory
    if (!needsConfirmation) {
      switch (activeTrigger) {
        case 'search':
          if (!aggressiveOptimization) {
            console.log("⚡ ENHANCED: Search with enhanced conversation memory");
            const searchResult = await executeRegularSearch(message, language);
            if (searchResult.success) {
              browsingUsed = true;
              browsingData = searchResult.data;
              const context = userStyle === 'short answers' ? 
                searchResult.context.substring(0, 400) : 
                userStyle === 'detailed' ? searchResult.context.substring(0, 1500) :
                searchResult.context.substring(0, 1000);
              
              response = await processWithBuddyChatAI(
                message, 
                context, 
                language, 
                personalityEnabled ? enhancedRecentMessages.slice(-5) : enhancedRecentMessages.slice(-2),
                enhancedConversationSummary,
                activeTrigger,
                personalityEnabled ? 'personality_search_enhanced' : 'search_results',
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
              Math.min(maxTokens, 200)
            );
          }
          break;

        case 'image':
          if (!aggressiveOptimization) {
            console.log("⚡ ENHANCED: Image generation with enhanced conversation memory");
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

                // ENHANCED: Contextual personality responses with follow-up
                if (userTone === 'funny') {
                  baseResponse += language === 'ar' 
                    ? `\n\nأتمنى أن تحب هذه التحفة الفنية! 😄🖼️ هل تريد المزيد من الإبداع أم تفضل تعديل شيء معين؟`
                    : `\n\nHope you love this masterpiece! 😄🖼️ Want me to create more artistic magic or would you like to modify something specific?`;
                } else if (userTone === 'casual') {
                  baseResponse += language === 'ar' 
                    ? `\n\nشو رأيك؟ طلعت حلوة؟ إذا بدك تغيير أي شي، قلي! 😊`
                    : `\n\nWhat do you think? Turned out pretty cool, right? If you want to change anything, just let me know! 😊`;
                } else if (userTone === 'encouraging') {
                  baseResponse += language === 'ar' 
                    ? `\n\nرائع! صورة مذهلة تعكس إبداعك! 💪✨ هل تريد استكشاف المزيد من الأفكار الإبداعية؟`
                    : `\n\nAmazing! This stunning image reflects your creativity! 💪✨ Would you like to explore more creative ideas?`;
                }

                response = baseResponse;
                
                // Generate contextual follow-up
                followUpQuestion = generateImageFollowUp(message, language, userTone);
              } else {
                response = imageResult.error;
              }
            } catch (error) {
              console.error("Image generation error:", error);
              response = language === 'ar' 
                ? `❌ عذراً، حدث خطأ أثناء إنشاء الصورة.`
                : `❌ Sorry, an error occurred while generating the image.`;
            }
          } else {
            response = language === 'ar' 
              ? `عذراً، إنشاء الصور غير متاح في الوضع السريع.`
              : `Sorry, image generation not available in speed mode.`;
          }
          break;

        case 'chat':
        default:
          console.log(`⚡ ENHANCED: Chat processing with ${personalityEnabled ? 'ENHANCED PERSONALITY & MEMORY' : 'SPEED'} mode`);
          
          // ENHANCED: Build enhanced chat context with conversation memory
          let chatContext = null;
          
          if (!aggressiveOptimization) {
            if (enhancedConversationSummary && personalityEnabled) {
              chatContext = `${enhancedConversationSummary}\n\nRecent conversation:\n${enhancedRecentMessages.slice(-5).map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.substring(0, 200) : '[attachment]'}`).join('\n')}`;
            } else if (enhancedConversationSummary) {
              chatContext = `${enhancedConversationSummary}\n\nRecent: ${enhancedRecentMessages.slice(-2).map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.substring(0, 150) : '[attachment]'}`).join('\n')}`;
            }
          }
          
          // ENHANCED: Determine interaction type with enhanced conversation awareness
          const interactionType = aggressiveOptimization ? 'hyper_fast_openai_chat' : 
                                 personalityEnabled ? 'personality_enhanced_conversation' : 
                                 'balanced_chat';
          
          console.log(`⚡ ENHANCED CHAT MODE: ${interactionType} | Context Length: ${chatContext?.length || 0} | Messages: ${enhancedRecentMessages.length}`);
          
          response = await processWithBuddyChatAI(
            message, 
            chatContext, 
            language, 
            personalityEnabled ? enhancedRecentMessages.slice(-5) : enhancedRecentMessages.slice(-2),
            enhancedConversationSummary,
            activeTrigger,
            interactionType,
            processedFiles,
            customSystemPrompt,
            maxTokens
          );
          
          // ENHANCED: Generate smart follow-up questions for engaging conversation
          if (personalityEnabled && !aggressiveOptimization) {
            followUpQuestion = generateSmartFollowUp(message, response, enhancedRecentMessages, language, userTone);
            conversationTopics = extractConversationTopics(message, enhancedRecentMessages);
          }
          break;
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`⚡ ENHANCED: Processed in ${processingTime}ms (${personalityEnabled ? 'ENHANCED CONVERSATION' : aggressiveOptimization ? 'SPEED' : 'BALANCED'} mode)`);

    // ENHANCED: Response structure with conversation enhancements
    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: personalityEnabled ? 'conversation_enhanced' : (aggressiveOptimization ? 'hyper_fast' : 'balanced'),
      confidence: 'high',
      actionTaken,
      imageUrl,
      browsingUsed,
      browsingData,
      needsConfirmation,
      pendingTaskData,
      pendingReminderData,
      followUpQuestion,
      conversationTopics,
      success: true,
      processingTime,
      speedOptimized,
      personalityEnabled,
      userStyle,
      userTone,
      tokensUsed: maxTokens,
      aiProvider: OPENAI_API_KEY ? 'openai' : 'deepseek',
      taskCreationEnabled: enableTaskCreation,
      conversationContext: personalityEnabled ? {
        systemPromptLength: customSystemPrompt.length,
        contextMessages: enhancedRecentMessages.length,
        summaryLength: enhancedConversationSummary.length,
        conversationMemoryEnhanced: true
      } : null
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("⚡ ENHANCED: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Processing error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// ENHANCED: Smart follow-up question generation
function generateSmartFollowUp(userMessage: string, aiResponse: string, recentMessages: any[], language: string = 'en', tone: string = 'neutral'): string | null {
  // Don't generate follow-ups for very short conversations
  if (recentMessages.length < 2) return null;
  
  // Extract conversation patterns
  const lastUserMessages = recentMessages.filter(m => m.role === 'user').slice(-3);
  const conversationDepth = lastUserMessages.length;
  
  // Topic-based follow-ups
  const topics = extractTopicsFromMessage(userMessage);
  
  if (topics.includes('work') || topics.includes('project') || topics.includes('business')) {
    return language === 'ar' 
      ? 'كيف يمكنني مساعدتك أكثر في هذا المشروع؟ 🚀'
      : 'How can I help you further with this project? 🚀';
  }
  
  if (topics.includes('learn') || topics.includes('study') || topics.includes('education')) {
    return language === 'ar' 
      ? 'هل تريد أن نتعمق أكثر في هذا الموضوع؟ 📚'
      : 'Would you like to dive deeper into this topic? 📚';
  }
  
  if (topics.includes('problem') || topics.includes('issue') || topics.includes('help')) {
    return language === 'ar' 
      ? 'هل هناك جانب آخر من هذه المشكلة نحتاج لمناقشته؟ 🤔'
      : 'Is there another aspect of this issue we need to discuss? 🤔';
  }
  
  // Tone-based follow-ups
  if (tone === 'funny') {
    const funnyFollowUps = language === 'ar' ? [
      'هل عندك قصص أخرى مثيرة للاهتمام؟ 😄',
      'ما رأيك نجرب شيء جديد ومختلف؟ 🎉',
      'أي موضوع آخر يثير فضولك؟ 🤪'
    ] : [
      'Got any other interesting stories? 😄',
      'Want to try something new and different? 🎉',
      'What other topic sparks your curiosity? 🤪'
    ];
    return funnyFollowUps[Math.floor(Math.random() * funnyFollowUps.length)];
  }
  
  if (tone === 'encouraging') {
    const encouragingFollowUps = language === 'ar' ? [
      'أنت تتقدم بشكل رائع! ما الخطوة التالية؟ 💪',
      'هذا إنجاز عظيم! كيف يمكننا البناء عليه؟ ✨',
      'أنت على الطريق الصحيح! ما هدفك التالي؟ 🎯'
    ] : [
      'You\'re making great progress! What\'s the next step? 💪',
      'That\'s a great achievement! How can we build on it? ✨',
      'You\'re on the right track! What\'s your next goal? 🎯'
    ];
    return encouragingFollowUps[Math.floor(Math.random() * encouragingFollowUps.length)];
  }
  
  // General contextual follow-ups
  const generalFollowUps = language === 'ar' ? [
    'هل تريد استكشاف هذا الموضوع أكثر؟ 🔍',
    'ما رأيك في التطرق لجانب آخر من هذا؟ 💭',
    'هل هناك شيء محدد تريد التركيز عليه؟ 🎯',
    'كيف يمكنني مساعدتك بشكل أفضل؟ 🤝'
  ] : [
    'Would you like to explore this topic further? 🔍',
    'What do you think about approaching this from another angle? 💭',
    'Is there something specific you\'d like to focus on? 🎯',
    'How can I help you better? 🤝'
  ];
  
  return generalFollowUps[Math.floor(Math.random() * generalFollowUps.length)];
}

// ENHANCED: Generate image-specific follow-ups
function generateImageFollowUp(prompt: string, language: string = 'en', tone: string = 'neutral'): string | null {
  const imageFollowUps = language === 'ar' ? [
    'هل تريد إنشاء المزيد من الصور بنفس الموضوع؟ 🎨',
    'ما رأيك في تجربة أسلوب مختلف للصورة؟ ✨',
    'هل تريد تعديل أي تفاصيل في الصورة؟ 🖼️'
  ] : [
    'Would you like to create more images with the same theme? 🎨',
    'What about trying a different style for the image? ✨',
    'Would you like to modify any details in the image? 🖼️'
  ];
  
  return imageFollowUps[Math.floor(Math.random() * imageFollowUps.length)];
}

// ENHANCED: Extract topics from message
function extractTopicsFromMessage(message: string): string[] {
  const topics = [];
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('work') || lowerMessage.includes('job') || lowerMessage.includes('career')) topics.push('work');
  if (lowerMessage.includes('learn') || lowerMessage.includes('study') || lowerMessage.includes('education')) topics.push('learn');
  if (lowerMessage.includes('problem') || lowerMessage.includes('issue') || lowerMessage.includes('help')) topics.push('problem');
  if (lowerMessage.includes('project') || lowerMessage.includes('plan')) topics.push('project');
  if (lowerMessage.includes('business') || lowerMessage.includes('company')) topics.push('business');
  
  return topics;
}

// ENHANCED: Extract conversation topics
function extractConversationTopics(message: string, recentMessages: any[]): string[] {
  const topics = extractTopicsFromMessage(message);
  
  // Add topics from recent messages
  recentMessages.slice(-3).forEach(msg => {
    if (typeof msg.content === 'string') {
      const messagTopics = extractTopicsFromMessage(msg.content);
      topics.push(...messagTopics);
    }
  });
  
  // Remove duplicates and return
  return [...new Set(topics)];
}

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
