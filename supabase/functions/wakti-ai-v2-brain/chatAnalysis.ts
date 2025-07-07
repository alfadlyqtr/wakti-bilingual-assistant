
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function processWithBuddyChatAI(
  message: string,
  userId: string,
  conversationId: string | null,
  language: string = 'en',
  processedFiles: any[] = [],
  recentMessages: any[] = [],
  conversationSummary: string = '',
  personalTouch: any = null,
  maxTokens: number = 4096,
  activeTrigger: string = 'chat'
) {
  try {
    console.log('🚀 CHAT PROCESSING: Starting with COMPLETE REPAIR SYSTEM');
    console.log('🖼️ FILES:', processedFiles.length, 'files provided for Vision');
    
    // Check for task creation triggers 
    const taskTriggers = {
      en: ['create task', 'create a task', 'new task', 'add task', 'make task', 'create reminder', 'remind me'],
      ar: ['أنشئ مهمة', 'إنشاء مهمة', 'مهمة جديدة', 'أضف مهمة', 'أنشئ تذكير', 'ذكرني']
    };
    
    const shouldCreateTask = taskTriggers[language as 'en' | 'ar']?.some(trigger => 
      message.toLowerCase().includes(trigger.toLowerCase())
    ) || taskTriggers.en.some(trigger => 
      message.toLowerCase().includes(trigger.toLowerCase())
    );
    
    // PHASE 2: MEMORY - Build FULL context from recent messages and summary
    let contextMessages = [];
    
    // Add conversation summary as system context if available
    if (conversationSummary && conversationSummary.trim()) {
      contextMessages.push({
        role: 'system',
        content: `Previous conversation context: ${conversationSummary}`
      });
      console.log(`🧠 CONTEXT: Added conversation summary (${conversationSummary.length} chars)`);
    }
    
    // Add recent messages for immediate context (last 3-4 messages)
    const formattedRecentMessages = recentMessages.slice(-4).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    contextMessages.push(...formattedRecentMessages);
    console.log(`🧠 CONTEXT: Added ${formattedRecentMessages.length} recent messages`);
    
    // PHASE 1: VISION - Check if this is an image processing request
    const hasImages = processedFiles && processedFiles.length > 0 && 
                     processedFiles.some(file => file.type && file.type.startsWith('image/'));
    
    let systemPrompt = '';
    let model = '';
    
    if (hasImages) {
      // PHASE 1: VISION PROCESSING with gpt-4-vision-preview
      console.log('🖼️ VISION: Processing with images using gpt-4-vision-preview');
      model = 'gpt-4-vision-preview';
      
      // PHASE 3: BILINGUAL VISION SYSTEM PROMPTS
      systemPrompt = language === 'ar' 
        ? `أنت مساعد ذكي يعتمد على الرؤية. عندما يرفع المستخدمون صورة، يجب عليك ملاحظتها بعناية واستخراج جميع المعلومات الظاهرة — بما في ذلك النصوص، الأرقام، التخطيط، التصميم، الأشخاص، الأشياء، المشاهد، والسياق البصري. أجب دائماً بوضوح وبدقة وبشكل مفيد. إذا سأل المستخدم سؤالًا، أجب عنه مباشرة باستخدام ما تراه في الصورة.

ابدأ ردك دائماً بعبارة:
"أرى أن..."

إذا كانت الصورة غير واضحة أو منخفضة الجودة — قل ذلك.
لا تفترض معلومات غير موجودة. كن صادقاً بشأن ما يمكنك رؤيته أو لا يمكنك رؤيته.`
        : `You are an intelligent visual assistant. When users upload images, you must carefully observe and extract all visible information — including any text, numbers, layout, design, people, objects, scenes, and visual context. Always answer clearly, accurately, and helpfully. If the user asks a question, answer it directly using information from the image.

Always start your reply with:
"I can see…"

If the image is blurry, low resolution, or unclear — say that.
Do not make up information. Be honest about what you can or cannot see.`;
    } else {
      // PHASE 1: Regular text chat with gpt-4o-mini
      console.log('💬 CHAT: Processing text-only using gpt-4o-mini');
      model = 'gpt-4o-mini';
      
      // Regular chat prompt with personalization
      systemPrompt = `You are a helpful AI assistant. Respond naturally and conversationally to the user's questions and requests.`;
      
      // Add personalization if available
      if (personalTouch) {
        if (personalTouch.nickname) {
          systemPrompt += ` Address the user as ${personalTouch.nickname}.`;
        }
        if (personalTouch.aiNickname) {
          systemPrompt += ` You can be called ${personalTouch.aiNickname}.`;
        }
        if (personalTouch.tone && personalTouch.tone !== 'neutral') {
          systemPrompt += ` Use a ${personalTouch.tone} tone.`;
        }
        if (personalTouch.style) {
          systemPrompt += ` Provide ${personalTouch.style} responses.`;
        }
        if (personalTouch.instruction) {
          systemPrompt += ` Additional instruction: ${personalTouch.instruction}`;
        }
      }
    }
    
    if (shouldCreateTask) {
      systemPrompt += ` The user wants to create a task or reminder. Acknowledge this and provide helpful suggestions about the task details.`;
    }
    
    if (language === 'ar') {
      systemPrompt += ' Respond in Arabic.';
    }

    console.log(`🎯 MODEL SELECTION: Using ${model} for ${hasImages ? 'Vision' : 'Chat'}`);

    // Prepare messages for API
    const messages = [
      { role: 'system', content: systemPrompt },
      ...contextMessages
    ];

    if (hasImages) {
      console.log('🖼️ VISION: Processing', processedFiles.length, 'files for Vision');
      
      // Create content array with text and images for Vision
      const messageContent = [
        { type: 'text', text: message }
      ];

      // Process each image file with base64 data
      for (const file of processedFiles) {
        if (file.type && file.type.startsWith('image/')) {
          console.log(`🖼️ VISION: Processing image: ${file.name}`);
          
          const imageUrl = file.image_url?.url;
          console.log(`🔗 VISION URL: ${imageUrl ? imageUrl.substring(0, 50) + '...' : 'NOT FOUND'}`);
          
          if (imageUrl) {
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'auto'
              }
            });
          } else {
            console.error(`❌ VISION: No valid URL found for image: ${file.name}`);
          }
        }
      }

      messages.push({ role: 'user', content: messageContent });
      console.log(`🖼️ VISION: Message content prepared with ${messageContent.length - 1} images`);
    } else {
      // Simple text message for regular chat
      messages.push({ role: 'user', content: message });
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // PHASE 5: RETRY LOGIC with proper fallbacks
    let lastError;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        let currentModel = model;
        let apiUrl = 'https://api.openai.com/v1/chat/completions';
        let apiKey = OPENAI_API_KEY;
        
        // PHASE 5: RETRY LOGIC - Determine model and API based on attempt
        if (attempt === 1) {
          if (hasImages) {
            // Vision fallback: retry with gpt-4o-mini (still has vision)
            currentModel = 'gpt-4o-mini';
            console.log(`🔄 VISION FALLBACK: Retrying with ${currentModel}`);
          } else {
            // Chat fallback: switch to DeepSeek
            currentModel = 'deepseek-chat';
            apiUrl = 'https://api.deepseek.com/chat/completions';
            apiKey = DEEPSEEK_API_KEY;
            console.log(`🔄 CHAT FALLBACK: Retrying with ${currentModel}`);
          }
        } else if (attempt === 2) {
          // Final fallback for Vision: convert to text-only with gpt-4o-mini
          if (hasImages) {
            currentModel = 'gpt-4o-mini';
            console.log(`🔄 FINAL VISION FALLBACK: Converting to text-only with ${currentModel}`);
          }
        }
        
        if (!apiKey) {
          throw new Error(`${currentModel === 'deepseek-chat' ? 'DeepSeek' : 'OpenAI'} API key not configured`);
        }
        
        console.log(`🔄 ATTEMPT ${attempt + 1}: Calling OpenAI with model: ${currentModel}`);
        
        // Adjust messages for fallback models
        let finalMessages = messages;
        if (attempt === 2 && hasImages) {
          // For final Vision fallback, convert to text-only
          finalMessages = [
            { role: 'system', content: systemPrompt },
            ...contextMessages,
            { role: 'user', content: `${message} [Note: User uploaded ${processedFiles.length} image(s) but Vision processing failed]` }
          ];
        }

        const requestPayload = {
          model: currentModel,
          messages: finalMessages,
          max_tokens: maxTokens,
          temperature: 0.7,
          stream: false
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        });

        console.log(`📥 API RESPONSE: Status ${response.status} for ${currentModel}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }
          
          // PHASE 4: MEANINGFUL ERROR MESSAGES
          let userFriendlyError = 'Sorry, I encountered an error processing your request.';
          
          if (response.status === 429) {
            userFriendlyError = language === 'ar' 
              ? 'عذراً، تم تجاوز الحد المسموح للطلبات. يرجى المحاولة مرة أخرى بعد قليل.'
              : 'Rate limit exceeded. Please try again in a moment.';
          } else if (response.status === 401) {
            userFriendlyError = language === 'ar'
              ? 'خطأ في المصادقة. يرجى المحاولة مرة أخرى.'
              : 'Authentication error. Please try again.';
          } else if (response.status === 400) {
            userFriendlyError = language === 'ar'
              ? '❌ لم أتمكن من معالجة الصورة المرفوعة. يرجى رفع صورة صالحة بصيغة JPEG أو PNG.'
              : '❌ Unable to process the uploaded image. Please upload a valid JPEG or PNG file.';
          }
          
          const error = new Error(`${currentModel} API error (${response.status}): ${errorData.error?.message || errorText}`);
          error.userFriendly = userFriendlyError;
          throw error;
        }

        const data = await response.json();
        console.log(`📥 API: Success with model ${currentModel}`);
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error('❌ API: Invalid response structure:', data);
          throw new Error('Invalid API response structure');
        }

        const aiResponse = data.choices[0].message.content;
        console.log('✅ AI: Response generated successfully');
        console.log('🎯 RESPONSE PREVIEW:', aiResponse.substring(0, 100) + '...');
        
        return {
          response: aiResponse,
          model: currentModel,
          tokensUsed: data.usage?.total_tokens || 0,
          contextUsed: contextMessages.length,
          personalizedResponse: !!personalTouch,
          taskCreationIntent: shouldCreateTask,
          intent: shouldCreateTask ? 'task_creation' : 'chat',
          confidence: shouldCreateTask ? 'high' : 'medium',
          attempt: attempt + 1,
          fallbackUsed: attempt > 0,
          visionUsed: hasImages && (currentModel === 'gpt-4-vision-preview' || currentModel === 'gpt-4o-mini'),
          fullContextRestored: true
        };

      } catch (error) {
        console.error(`🚨 AI: Attempt ${attempt + 1} failed:`, error);
        lastError = error;
        
        if (attempt < maxRetries) {
          console.log(`🔄 RETRY: Attempting fallback model (attempt ${attempt + 2})`);
          continue;
        }
      }
    }
    
    // All retries failed - return meaningful error
    console.error('🚨 AI: All retry attempts failed:', lastError);
    throw lastError;

  } catch (error) {
    console.error('🚨 AI: Critical processing error:', error);
    
    // PHASE 4: SURFACE MEANINGFUL ERRORS
    const userFriendlyMessage = error.userFriendly || (language === 'ar' 
      ? '❌ عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى أو ارفع صورة جديدة.'
      : '❌ Sorry, I encountered an error processing your request. Please try again or upload a new image.');
    
    return {
      response: userFriendlyMessage,
      model: 'error',
      tokensUsed: 0,
      contextUsed: 0,
      personalizedResponse: false,
      taskCreationIntent: false,
      error: error.message,
      userFriendlyError: userFriendlyMessage,
      visionUsed: false,
      fullContextRestored: false
    };
  }
}
