
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
  maxTokens: number = 400,
  activeTrigger: string = 'chat'
) {
  try {
    console.log('🚀 VISION AI: Processing message with Vision system');
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
    
    // CRITICAL: Enhanced system prompt for Vision API
    let systemPrompt = `You are WAKTI AI, an intelligent assistant with vision capabilities. When users send images:

1. ALWAYS acknowledge that you can see the image by starting with "I can see..."
2. Describe what you observe in detail
3. Answer any questions about the image content
4. Be helpful, concise, and friendly

If you cannot see an image that was sent, something is wrong with the system.`;
    
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

    // CRITICAL: Process images for Vision API
    if (processedFiles && processedFiles.length > 0) {
      console.log('🖼️ VISION API: Processing', processedFiles.length, 'files for Vision');
      
      // Create content array with text and images
      const messageContent = [
        { type: 'text', text: message }
      ];

      // Process each image file
      for (const file of processedFiles) {
        if (file.type && file.type.startsWith('image/')) {
          console.log(`🖼️ VISION API: Processing image: ${file.name}`);
          console.log(`🔗 VISION URL: ${file.publicUrl || file.image_url?.url}`);
          
          // Use the proper Vision API format
          if (file.image_url && file.image_url.url) {
            console.log(`✅ VISION API: Using direct image_url format`);
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: file.image_url.url,
                detail: file.image_url.detail || 'high'
              }
            });
          } else if (file.publicUrl) {
            console.log(`✅ VISION API: Using publicUrl fallback`);
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: file.publicUrl,
                detail: 'high'
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

    // CRITICAL: Use OpenAI with proper Vision model
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    const model = 'gpt-4o'; // Use the proper Vision model you mentioned was working

    console.log(`🚀 VISION API: Using OpenAI ${model} for Vision processing`);
    console.log(`📤 VISION API: Sending request with ${messages.length} messages`);

    const response = await Promise.race([
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
          stream: false
        }),
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Vision API timeout')), 15000)
      )
    ]) as Response;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ VISION API: Response not OK:', response.status, errorText);
      throw new Error(`Vision API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📥 VISION API: Response received');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ VISION API: Invalid response structure:', data);
      throw new Error('Invalid Vision API response structure');
    }

    const aiResponse = data.choices[0].message.content;
    console.log('✅ VISION AI: Response generated successfully');
    
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
    console.error('🚨 VISION AI: Processing error:', error);
    
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
