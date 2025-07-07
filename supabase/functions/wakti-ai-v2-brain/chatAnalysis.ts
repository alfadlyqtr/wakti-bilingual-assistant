
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { callClaudeAPI, callDeepSeekAPI, logWithTimestamp, validateApiKeys } from './utils.ts';

export async function processWithClaudeAI(
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
    console.log('🚀 WAKTI AI: Starting Claude processing with UPGRADED system');
    
    // Validate API keys at start
    const keyValidation = validateApiKeys();
    if (!keyValidation.valid) {
      throw new Error(`Missing API keys: ${keyValidation.missing.join(', ')}`);
    }
    
    console.log('🖼️ VISION: Processing', processedFiles.length, 'files for Vision');
    
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
    
    // Build FULL context from recent messages and summary
    let contextMessages = [];
    
    // Add conversation summary as system context if available
    if (conversationSummary && conversationSummary.trim()) {
      contextMessages.push({
        role: 'user',
        content: `Previous conversation context: ${conversationSummary}`
      });
      console.log(`🧠 CONTEXT: Added conversation summary (${conversationSummary.length} chars)`);
    }
    
    // Add recent messages for immediate context (last 3-4 messages)
    const formattedRecentMessages = recentMessages.slice(-4).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
    contextMessages.push(...formattedRecentMessages);
    console.log(`🧠 CONTEXT: Added ${formattedRecentMessages.length} recent messages`);
    
    // ENHANCED: Better image processing with proper validation
    const hasImages = processedFiles && processedFiles.length > 0 && 
                     processedFiles.some(file => file.type && file.type.startsWith('image/'));
    
    let systemPrompt = '';
    
    if (hasImages) {
      // VISION PROCESSING with Claude 3.5 Sonnet
      console.log('🖼️ VISION: Processing with images using Claude 3.5 Sonnet');
      
      // ENHANCED BILINGUAL VISION SYSTEM PROMPTS
      systemPrompt = language === 'ar' 
        ? `أنت مساعد ذكي متخصص في تحليل الصور والرؤية الحاسوبية. عندما يرفع المستخدمون صورة، يجب عليك:

1. **تحليل شامل للصورة**: فحص جميع العناصر المرئية بدقة عالية
2. **استخراج النصوص**: قراءة وتحليل أي نصوص موجودة في الصورة
3. **فهم السياق**: تحديد الغرض والمعنى من الصورة
4. **وصف مفصل**: تقديم وصف شامل وواضح بالعربية
5. **الإجابة على الأسئلة**: الرد على استفسارات المستخدم حول الصورة

ابدأ ردك دائماً بـ: "أستطيع أن أرى في هذه الصورة..."

إذا كانت الصورة غير واضحة، اذكر ذلك بصراحة. لا تفترض معلومات غير موجودة.`
        : `You are an advanced AI assistant with superior vision capabilities. When users upload images, you must:

1. **Comprehensive Image Analysis**: Examine all visual elements with high precision
2. **Text Extraction**: Read and analyze any text present in the image
3. **Context Understanding**: Determine the purpose and meaning of the image
4. **Detailed Description**: Provide thorough and clear descriptions
5. **Question Answering**: Respond to user queries about the image content

Always start your response with: "I can see in this image..."

If the image is unclear or low quality, mention that honestly. Do not fabricate information.`;
    } else {
      // Regular text chat with ENHANCED PERSONALIZATION
      console.log('💬 CHAT: Processing text-only using Claude 3.5 Sonnet');
      
      // ENHANCED chat prompt with better personalization
      systemPrompt = language === 'ar'
        ? `أنت مساعد ذكي متقدم اسمه WAKTI AI. أنت مفيد ومتعاون وذكي. اجب على أسئلة المستخدمين وطلباتهم بطريقة طبيعية ومحادثة.`
        : `You are WAKTI AI, an advanced intelligent assistant. You are helpful, collaborative, and smart. Respond naturally and conversationally to user questions and requests.`;
      
      // Add enhanced personalization if available
      if (personalTouch) {
        if (personalTouch.nickname) {
          systemPrompt += language === 'ar' 
            ? ` خاطب المستخدم باسم ${personalTouch.nickname}.`
            : ` Address the user as ${personalTouch.nickname}.`;
        }
        if (personalTouch.aiNickname) {
          systemPrompt += language === 'ar'
            ? ` يمكن مناداتك باسم ${personalTouch.aiNickname}.`
            : ` You can be called ${personalTouch.aiNickname}.`;
        }
        if (personalTouch.tone && personalTouch.tone !== 'neutral') {
          systemPrompt += language === 'ar'
            ? ` استخدم نبرة ${personalTouch.tone}.`
            : ` Use a ${personalTouch.tone} tone.`;
        }
        if (personalTouch.style) {
          systemPrompt += language === 'ar'
            ? ` قدم إجابات ${personalTouch.style}.`
            : ` Provide ${personalTouch.style} responses.`;
        }
        if (personalTouch.instruction) {
          systemPrompt += language === 'ar'
            ? ` تعليمات إضافية: ${personalTouch.instruction}`
            : ` Additional instruction: ${personalTouch.instruction}`;
        }
      }
    }
    
    if (shouldCreateTask) {
      systemPrompt += language === 'ar'
        ? ' المستخدم يريد إنشاء مهمة أو تذكير. اعترف بذلك وقدم اقتراحات مفيدة حول تفاصيل المهمة.'
        : ' The user wants to create a task or reminder. Acknowledge this and provide helpful suggestions about the task details.';
    }

    console.log(`🎯 MODEL SELECTION: Using Claude 3.5 Sonnet for ${hasImages ? 'Vision' : 'Chat'}`);

    // Prepare messages for Claude API
    const claudeMessages = [];
    
    // Add context messages
    if (contextMessages.length > 0) {
      claudeMessages.push(...contextMessages);
    }

    if (hasImages) {
      console.log('🖼️ VISION: Processing', processedFiles.length, 'files for Claude Vision');
      
      // FIXED: Enhanced image processing with proper validation
      const messageContent = [
        { type: 'text', text: message }
      ];

      // Enhanced image processing with better error handling
      for (const file of processedFiles) {
        if (file.type && file.type.startsWith('image/')) {
          console.log(`🖼️ VISION: Processing image: ${file.name}`);
          
          // FIXED: Better image URL handling
          let imageUrl = null;
          
          // Check for base64 data first (most reliable)
          if (file.base64Data && file.base64Data.length > 100) {
            // Ensure proper format
            const mediaType = file.type || 'image/jpeg';
            imageUrl = `data:${mediaType};base64,${file.base64Data}`;
          } else if (file.image_url?.url && file.image_url.url.startsWith('data:image/')) {
            imageUrl = file.image_url.url;
          } else if (file.url && file.url.startsWith('data:image/')) {
            imageUrl = file.url;
          }
          
          console.log(`🔗 VISION URL CHECK: ${imageUrl ? 'VALID BASE64 DATA FOUND' : 'NO VALID BASE64 DATA'}`);
          
          if (imageUrl && imageUrl.startsWith('data:image/')) {
            // Extract base64 data and media type
            const [mediaInfo, base64Data] = imageUrl.split(',');
            const mediaType = mediaInfo.split(':')[1].split(';')[0];
            
            if (base64Data && base64Data.length > 100) {
              messageContent.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              });
              console.log(`✅ VISION: Successfully added image ${file.name} (${base64Data.length} chars)`);
            } else {
              console.error(`❌ VISION: Invalid base64 data for ${file.name}`);
            }
          } else {
            console.error(`❌ VISION: No valid base64 URL found for image: ${file.name}`);
          }
        }
      }

      claudeMessages.push({ 
        role: 'user', 
        content: messageContent 
      });
      console.log(`🖼️ VISION: Message content prepared with ${messageContent.length - 1} images`);
    } else {
      // Simple text message for regular chat
      claudeMessages.push({ 
        role: 'user', 
        content: message 
      });
    }

    // Add system prompt as first message
    if (systemPrompt) {
      claudeMessages.unshift({ 
        role: 'user', 
        content: systemPrompt 
      });
    }

    // Enhanced retry logic with detailed error handling
    let lastError;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ATTEMPT ${attempt + 1}: Processing request`);
        
        if (attempt === 0) {
          // Primary: Claude 3.5 Sonnet
          const claudeResponse = await callClaudeAPI(claudeMessages, maxTokens);
          
          console.log('📥 CLAUDE SUCCESS: Response received from Claude 3.5 Sonnet');
          
          if (!claudeResponse.content || !claudeResponse.content[0] || !claudeResponse.content[0].text) {
            console.error('❌ CLAUDE ERROR: Invalid response structure:', claudeResponse);
            throw new Error('Invalid Claude API response structure');
          }

          const aiResponse = claudeResponse.content[0].text;
          console.log('✅ CLAUDE SUCCESS: Response generated successfully');
          console.log('🎯 RESPONSE PREVIEW:', aiResponse.substring(0, 200) + '...');
          
          return {
            response: aiResponse,
            model: 'claude-3-5-sonnet-20241022',
            tokensUsed: claudeResponse.usage?.input_tokens + claudeResponse.usage?.output_tokens || 0,
            contextUsed: contextMessages.length,
            personalizedResponse: !!personalTouch,
            taskCreationIntent: shouldCreateTask,
            intent: shouldCreateTask ? 'task_creation' : 'chat',
            confidence: shouldCreateTask ? 'high' : 'medium',
            attempt: attempt + 1,
            fallbackUsed: false,
            visionUsed: hasImages,
            fullContextRestored: true
          };

        } else {
          // Fallback: DeepSeek (chat only, no vision)
          console.log('🔄 FALLBACK: Using DeepSeek chat fallback');
          
          if (hasImages) {
            console.log('🔄 VISION FALLBACK: Converting to text-only for DeepSeek');
            const fallbackMessages = [
              { role: 'system', content: systemPrompt },
              ...contextMessages,
              { role: 'user', content: `${message} [Note: User uploaded ${processedFiles.length} image(s) but Vision processing failed]` }
            ];
            
            const deepseekResponse = await callDeepSeekAPI(fallbackMessages, maxTokens);
            
            return {
              response: deepseekResponse.choices[0].message.content,
              model: 'deepseek-chat',
              tokensUsed: deepseekResponse.usage?.total_tokens || 0,
              contextUsed: contextMessages.length,
              personalizedResponse: !!personalTouch,
              taskCreationIntent: shouldCreateTask,
              intent: shouldCreateTask ? 'task_creation' : 'chat',
              confidence: shouldCreateTask ? 'high' : 'medium',
              attempt: attempt + 1,
              fallbackUsed: true,
              visionUsed: false,
              fullContextRestored: true
            };
          } else {
            // Regular chat fallback
            const fallbackMessages = [
              { role: 'system', content: systemPrompt },
              ...contextMessages.map(msg => ({ role: msg.role, content: msg.content })),
              { role: 'user', content: message }
            ];
            
            const deepseekResponse = await callDeepSeekAPI(fallbackMessages, maxTokens);
            
            return {
              response: deepseekResponse.choices[0].message.content,
              model: 'deepseek-chat',
              tokensUsed: deepseekResponse.usage?.total_tokens || 0,
              contextUsed: contextMessages.length,
              personalizedResponse: !!personalTouch,
              taskCreationIntent: shouldCreateTask,
              intent: shouldCreateTask ? 'task_creation' : 'chat',
              confidence: shouldCreateTask ? 'high' : 'medium',
              attempt: attempt + 1,
              fallbackUsed: true,
              visionUsed: false,
              fullContextRestored: true
            };
          }
        }

      } catch (error) {
        console.error(`🚨 Attempt ${attempt + 1} failed:`, error);
        lastError = error;
        
        if (attempt < maxRetries) {
          console.log(`🔄 RETRY: Attempting DeepSeek fallback (attempt ${attempt + 2})`);
          continue;
        }
      }
    }
    
    // All retries failed - return meaningful error
    console.error('🚨 All retry attempts failed:', lastError);
    throw lastError;

  } catch (error) {
    console.error('🚨 Critical processing error:', error);
    
    // Enhanced error handling: More meaningful error messages
    let userFriendlyMessage = '';
    
    if (error.message.includes('API key')) {
      userFriendlyMessage = language === 'ar' 
        ? '❌ خطأ في إعداد النظام. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.'
        : '❌ System configuration error. Please try again or contact support.';
    } else if (error.message.includes('image') || error.message.includes('vision')) {
      userFriendlyMessage = language === 'ar' 
        ? '❌ عذراً، حدث خطأ أثناء معالجة الصورة. حاول مرة أخرى أو ارفع صورة جديدة.'
        : '❌ Sorry, I encountered an error processing your image. Please try again or upload a new image.';
    } else {
      userFriendlyMessage = language === 'ar' 
        ? '❌ عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى.'
        : '❌ Sorry, I encountered an error processing your request. Please try again.';
    }
    
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
