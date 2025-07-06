
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
    console.log('🚀 ULTRA-FAST: Processing with BuddyChat AI');
    
    // NEW: Check for task creation triggers
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
    
    // Build system prompt with personalization + task creation awareness
    let systemPrompt = `You are WAKTI AI, an intelligent assistant. Be helpful, concise, and friendly.`;
    
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

    // CRITICAL FIX: Handle vision files correctly
    if (processedFiles && processedFiles.length > 0) {
      console.log('📁 VISION API: Processing files for AI:', JSON.stringify(processedFiles.map(f => ({
        type: f.type,
        name: f.name,
        hasImageUrl: !!f.image_url,
        imageUrlType: f.image_url?.url ? 'url' : 'unknown'
      })), null, 2));

      // Create content array with text and images
      const messageContent = [
        { type: 'text', text: message }
      ];

      // Add images to the message content
      for (const file of processedFiles) {
        if (file.type === 'image_url' && file.image_url && file.image_url.url) {
          console.log(`🖼️ VISION API: Adding image to message: ${file.name}`);
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: file.image_url.url,
              detail: file.image_url.detail || 'high'
            }
          });
        } else {
          console.error(`❌ VISION API: Invalid file structure for ${file.name}:`, file);
        }
      }

      messages.push({ role: 'user', content: messageContent });
    } else {
      messages.push({ role: 'user', content: message });
    }

    // ULTRA-FAST: Use available API with timeout protection
    const apiKey = OPENAI_API_KEY || DEEPSEEK_API_KEY;
    const apiUrl = OPENAI_API_KEY 
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.deepseek.com/chat/completions';
    
    const model = OPENAI_API_KEY ? 'gpt-4o-mini' : 'deepseek-chat';

    console.log(`🚀 ULTRA-FAST: Using ${OPENAI_API_KEY ? 'OpenAI' : 'DeepSeek'} with context: ${contextMessages.length} messages, files: ${processedFiles.length}`);

    const response = await Promise.race([
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
        setTimeout(() => reject(new Error('AI API timeout')), 12000)
      )
    ]) as Response;

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid AI API response structure');
    }

    const aiResponse = data.choices[0].message.content;
    
    console.log('🚀 ULTRA-FAST: AI response generated successfully');
    
    // ENHANCED: Return response with task creation intent
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
    console.error('🚨 ULTRA-FAST: AI processing error:', error);
    
    // Return error in consistent format
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
