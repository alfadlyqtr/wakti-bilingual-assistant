
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// Image type detection helper
function detectImageType(fileName: string, fileType: string): string {
  const name = fileName.toLowerCase();
  const type = fileType.toLowerCase();
  
  if (name.includes('receipt') || name.includes('invoice') || name.includes('bill')) {
    return 'receipt';
  }
  if (name.includes('document') || name.includes('doc') || name.includes('pdf') || type.includes('pdf')) {
    return 'document';
  }
  if (name.includes('screenshot') || name.includes('screen')) {
    return 'screenshot';
  }
  if (name.includes('selfie') || name.includes('portrait')) {
    return 'selfie';
  }
  return 'scene';
}

// Dynamic prompt generator based on image type
function generateDynamicPrompt(imageType: string, language: string): string {
  const prompts = {
    receipt: {
      en: "Extract all visible text. Summarize vendor, total amount, and date of this receipt.",
      ar: "استخرج جميع النصوص المرئية. لخص اسم البائع والمبلغ الإجمالي وتاريخ هذه الفاتورة."
    },
    document: {
      en: "Summarize this document. List headings, topics, and relevant details.",
      ar: "لخص هذه الوثيقة. اذكر العناوين والمواضيع والتفاصيل ذات الصلة."
    },
    screenshot: {
      en: "Analyze the UI shown in this screenshot. What app is this? What is happening?",
      ar: "حلل واجهة المستخدم المعروضة في لقطة الشاشة هذه. ما هو هذا التطبيق؟ ماذا يحدث؟"
    },
    selfie: {
      en: "Describe the person in the image, including expression, clothing, and background.",
      ar: "صف الشخص في الصورة، بما في ذلك التعبير والملابس والخلفية."
    },
    scene: {
      en: "Describe this image in detail. Mention people, objects, any text, and what's happening.",
      ar: "صف هذه الصورة بالتفصيل. اذكر الأشخاص والأشياء وأي نصوص وما يحدث."
    }
  };
  
  return prompts[imageType]?.[language] || prompts.scene[language] || prompts.scene.en;
}

// Image compression helper
async function compressImageIfNeeded(imageUrl: string): Promise<string> {
  try {
    // For now, return the original URL
    // In production, you might want to implement actual compression
    return imageUrl;
  } catch (error) {
    console.error('🖼️ COMPRESSION ERROR:', error);
    return imageUrl;
  }
}

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
    console.log('🚀 VISION AI: Processing message with enhanced Vision system');
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
    
    // ENHANCED BILINGUAL SYSTEM PROMPT (from ChatGPT screenshots)
    let systemPrompt = `ENGLISH:
You are a multilingual AI assistant that analyzes uploaded images. Extract all visible text, identify people, objects, and context. Provide a structured summary, and always include your reasoning. Be concise, yet precise.

ARABIC:
أنت مساعد ذكي متعدد اللغات تحلل الصور المرفوعة. استخرج كل النصوص المرئية، وحدد الأشخاص والأشياء والسياق. قدم ملخصًا منظمًا مع توضيح الأسباب دائماً. كن دقيقًا ومباشرًا.

When users send images:
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

    // ENHANCED VISION PROCESSING with Dynamic Prompts
    if (processedFiles && processedFiles.length > 0) {
      console.log('🖼️ VISION API: Processing', processedFiles.length, 'files for enhanced Vision');
      
      // Create content array with text and images
      const messageContent = [
        { type: 'text', text: message }
      ];

      // Process each image file with dynamic prompts
      for (const file of processedFiles) {
        if (file.type && file.type.startsWith('image/')) {
          console.log(`🖼️ VISION API: Processing image: ${file.name}`);
          
          // Detect image type and generate dynamic prompt
          const imageType = detectImageType(file.name, file.type);
          const dynamicPrompt = generateDynamicPrompt(imageType, language);
          
          console.log(`🎯 IMAGE TYPE: ${imageType}`);
          console.log(`📝 DYNAMIC PROMPT: ${dynamicPrompt}`);
          
          // Add dynamic prompt as additional text
          messageContent.push({
            type: 'text',
            text: dynamicPrompt
          });
          
          // Compress image if needed
          const imageUrl = await compressImageIfNeeded(file.image_url?.url || file.publicUrl);
          console.log(`🔗 VISION URL: ${imageUrl}`);
          
          if (imageUrl) {
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            });
          } else {
            console.error(`❌ VISION API: No valid URL found for image: ${file.name}`);
          }
        }
      }

      messages.push({ role: 'user', content: messageContent });
      console.log(`🖼️ VISION API: Message content prepared with ${messageContent.length - 1} elements`);
    } else {
      messages.push({ role: 'user', content: message });
    }

    // RETRY LOGIC with Primary and Fallback Models
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const models = ['gpt-4o', 'gpt-4-vision-preview']; // Primary and fallback
    let lastError = null;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      console.log(`🚀 VISION API: Attempting with model ${model} (attempt ${i + 1}/${models.length})`);

      try {
        const apiUrl = 'https://api.openai.com/v1/chat/completions';

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
              temperature: 0, // Set to 0 as per screenshots
              stream: false
            }),
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Vision API timeout')), 30000)
          )
        ]) as Response;

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ VISION API: Model ${model} failed:`, response.status, errorText);
          lastError = new Error(`Vision API error: ${response.status} - ${errorText}`);
          continue; // Try next model
        }

        const data = await response.json();
        console.log(`📥 VISION API: Success with model ${model}`);
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error('❌ VISION API: Invalid response structure:', data);
          lastError = new Error('Invalid Vision API response structure');
          continue; // Try next model
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
        console.error(`🚨 VISION AI: Model ${model} error:`, error);
        lastError = error;
        if (i === models.length - 1) {
          // Last attempt failed
          break;
        }
      }
    }
    
    // All models failed
    throw lastError || new Error('All Vision API models failed');

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
