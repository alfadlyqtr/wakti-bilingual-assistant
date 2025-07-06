
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
    console.log('🚀 VISION AI: Processing message with corrected Vision system');
    console.log('🖼️ VISION FILES:', processedFiles.length, 'files provided');
    
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
    
    // Build context from recent messages and summary
    let contextMessages = [];
    
    // Add conversation summary as system context if available
    if (conversationSummary && conversationSummary.trim()) {
      contextMessages.push({
        role: 'system',
        content: `Previous conversation context: ${conversationSummary.substring(0, 300)}`
      });
    }
    
    // Add recent messages for immediate context (last 3-5 messages)
    const formattedRecentMessages = recentMessages.slice(-3).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    contextMessages.push(...formattedRecentMessages);
    
    // FIXED: Correct bilingual system prompt as specified
    let systemPrompt = `ENGLISH: You are a precise, visual AI assistant. When users upload images, extract every visible detail — including text, layout, people, scenes, objects, and context. Always respond with a clear, structured summary and direct answers to the user's question. Start your reply with: "I can see..."

ARABIC: أنت مساعد ذكي دقيق يعتمد على الرؤية. عند رفع المستخدمين للصور، استخرج جميع التفاصيل الظاهرة — بما في ذلك النصوص، التخطيط، الأشخاص، المشاهد، الأشياء، والسياق. أجب دائماً بملخص منظم وواضح، وابدأ ردك بعبارة: "أرى أن..."`;
    
    if (shouldCreateTask) {
      systemPrompt += ` The user wants to create a task or reminder. Acknowledge this and provide helpful suggestions about the task details.`;
    }
    
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
    
    if (language === 'ar') {
      systemPrompt += ' Respond in Arabic.';
    }

    // Prepare messages for API
    const messages = [
      { role: 'system', content: systemPrompt },
      ...contextMessages
    ];

    // FIXED: Vision processing with base64 images
    if (processedFiles && processedFiles.length > 0) {
      console.log('🖼️ VISION API: Processing', processedFiles.length, 'files for Vision');
      
      // Create content array with text and images
      const messageContent = [
        { type: 'text', text: message }
      ];

      // Process each image file with base64 data
      for (const file of processedFiles) {
        if (file.type && file.type.startsWith('image/')) {
          console.log(`🖼️ VISION API: Processing image: ${file.name}`);
          
          const imageUrl = file.image_url?.url;
          console.log(`🔗 VISION URL: ${imageUrl ? imageUrl.substring(0, 50) + '...' : 'NOT FOUND'}`);
          
          if (imageUrl) {
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: imageUrl, // This is now base64 data URL
                detail: 'auto' // Changed from 'high' to 'auto'
              }
            });
          } else {
            console.error(`❌ VISION API: No valid URL found for image: ${file.name}`);
          }
        }
      }

      messages.push({ role: 'user', content: messageContent });
      console.log(`🖼️ VISION API: Message content prepared with ${messageContent.length - 1} images`);
    } else {
      messages.push({ role: 'user', content: message });
    }

    // FIXED: Use only gpt-4-vision-preview, no fallbacks
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const model = 'gpt-4-vision-preview'; // FIXED: Correct Vision model
    console.log(`🚀 VISION API: Using model ${model}`);

    try {
      const apiUrl = 'https://api.openai.com/v1/chat/completions';

      // FIXED: Log the complete request payload for debugging
      const requestPayload = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.3, // FIXED: Changed from 0 to 0.3
        stream: false
      };
      
      console.log('📤 VISION API REQUEST PAYLOAD:', JSON.stringify({
        model: requestPayload.model,
        messages: requestPayload.messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content.substring(0, 100) + '...' : 
                   Array.isArray(msg.content) ? 
                     msg.content.map(item => ({
                       type: item.type,
                       text: item.type === 'text' ? item.text?.substring(0, 50) + '...' : undefined,
                       image_url: item.type === 'image_url' ? {
                         url: item.image_url?.url?.substring(0, 50) + '...',
                         detail: item.image_url?.detail
                       } : undefined
                     })) : 'unknown_content'
        })),
        temperature: requestPayload.temperature,
        max_tokens: requestPayload.max_tokens
      }, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      // FIXED: Log the actual response details for debugging
      console.log(`📥 VISION API RESPONSE: Status ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ VISION API ERROR: Status ${response.status}`);
        console.error(`❌ VISION API ERROR BODY:`, errorText);
        
        // FIXED: Return actual OpenAI error instead of masking it
        throw new Error(`Vision API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log(`📥 VISION API: Success with model ${model}`);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('❌ VISION API: Invalid response structure:', data);
        throw new Error('Invalid Vision API response structure');
      }

      const aiResponse = data.choices[0].message.content;
      console.log('✅ VISION AI: Response generated successfully');
      console.log('🎯 VISION RESPONSE PREVIEW:', aiResponse.substring(0, 100) + '...');
      
      return {
        response: aiResponse,
        model: model,
        tokensUsed: data.usage?.total_tokens || 0,
        contextUsed: contextMessages.length,
        personalizedResponse: !!personalTouch,
        taskCreationIntent: shouldCreateTask,
        intent: shouldCreateTask ? 'task_creation' : 'chat',
        confidence: shouldCreateTask ? 'high' : 'medium'
      };

    } catch (error) {
      console.error(`🚨 VISION AI: API error:`, error);
      
      // FIXED: Return the actual error instead of masking it
      throw error;
    }

  } catch (error) {
    console.error('🚨 VISION AI: Critical processing error:', error);
    
    return {
      response: language === 'ar' 
        ? 'عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى.'
        : 'Sorry, I encountered an error processing your request. Please try again.',
      model: 'error',
      tokensUsed: 0,
      contextUsed: 0,
      personalizedResponse: false,
      taskCreationIntent: false,
      error: error.message
    };
  }
}
