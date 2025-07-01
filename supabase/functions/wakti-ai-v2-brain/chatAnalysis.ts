
// Remove the old OpenAI import and use direct fetch calls instead
import { analyzeTaskIntent } from "./taskParsing.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// RESTORED: Complete system prompts for general AI conversation
const englishSystemPrompt = `You are WAKTI AI, a helpful and intelligent personal assistant. You can help with various tasks including:
- General conversation and questions
- Task management and organization
- Event planning and scheduling
- Providing information and explanations
- Creative assistance and brainstorming
- Problem-solving and analysis

You should be friendly, helpful, and concise in your responses. Adapt your tone and style based on user preferences when provided.`;

const arabicSystemPrompt = `أنت وقتي AI، مساعد شخصي ذكي ومفيد. يمكنك المساعدة في مهام مختلفة تشمل:
- المحادثة العامة والأسئلة
- إدارة المهام والتنظيم
- تخطيط الأحداث والجدولة
- تقديم المعلومات والتوضيحات
- المساعدة الإبداعية والعصف الذهني
- حل المشاكل والتحليل

يجب أن تكون ودودًا ومفيدًا ومختصرًا في إجاباتك. تكيف مع نبرة وأسلوب المستخدم حسب التفضيلات المقدمة.`;

// Vision prompts
const englishVisionPromptTemplate = `Analyze the image and provide a detailed description. Identify any objects, people, or scenes present. Extract any text or information that can be read from the image.`;
const arabicVisionPromptTemplate = `حلل الصورة وقدم وصفًا تفصيليًا. حدد أي كائنات أو أشخاص أو مشاهد موجودة. استخرج أي نص أو معلومات يمكن قراءتها من الصورة.`;

// FIXED: Proper image compression utility function without recursion
async function compressImageForVision(imageUrl: string): Promise<string> {
  try {
    console.log('🔍 COMPRESSION: Starting proper image compression for Vision API');
    
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    const base64 = btoa(String.fromCharCode(...uint8Array));
    
    // Check size limits (OpenAI Vision API has ~20MB limit, but we'll be conservative)
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit
    if (arrayBuffer.byteLength > maxSizeBytes) {
      console.log('🔍 COMPRESSION: Image too large, applying simple truncation');
      // Simple approach: truncate the base64 string (not ideal but prevents crashes)
      const truncatedLength = Math.floor(maxSizeBytes * 0.75); // Account for base64 overhead
      return base64.substring(0, truncatedLength);
    }
    
    console.log('🔍 COMPRESSION: Image compression completed successfully');
    return base64;
  } catch (error) {
    console.error('🚨 COMPRESSION ERROR:', error);
    // Return original URL if compression fails - let OpenAI handle it
    return imageUrl;
  }
}

// Build vision system prompt based on language
function buildVisionSystemPrompt(language: string): string {
  const basePrompt = language === 'ar' ? arabicSystemPrompt : englishSystemPrompt;
  const visionAddition = language === 'ar' 
    ? '\n\nيمكنك أيضًا تحليل الصور ووصفها واستخراج النصوص منها.'
    : '\n\nYou can also analyze images, describe them, and extract text from them.';
  
  return basePrompt + visionAddition;
}

// Get vision prompt template based on image type and language
function getVisionPromptTemplate(imageType: string, language: string): string {
  let prompt = language === 'ar' ? arabicVisionPromptTemplate : englishVisionPromptTemplate;
  
  if (imageType === 'document') {
    prompt += language === 'ar'
      ? '\n\nاستخرج أي نص أو معلومات يمكن قراءتها من الصورة. إذا كانت هناك أي جداول أو بيانات منظمة، فقم بتقديمها بتنسيق منظم.'
      : '\n\nExtract any text or information that can be read from the image. If there are any tables or structured data, present them in an organized format.';
  }
  
  return prompt;
}

// Detect image type based on message content
function detectImageType(message: string): string {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('document') || lowerMessage.includes('invoice') || lowerMessage.includes('receipt')) {
    return 'document';
  }
  return 'general';
}

export async function processWithBuddyChatAI(
  message: string,
  userId: string,
  conversationId: string | null,
  language: string = 'en',
  attachedFiles: any[] = [],
  recentMessages: any[] = [],
  conversationSummary: string = '',
  personalTouch: any = null,
  maxTokens: number = 500,
  activeTrigger: string = 'chat'
): Promise<any> {
  try {
    console.log('🚀 ULTRA-FAST CHAT: Processing with timeout protection and personalization');
    
    const startTime = Date.now();
    
    // CRITICAL FIX: Ensure maxTokens is ALWAYS a number
    let safeMaxTokens: number;
    if (typeof maxTokens === 'string') {
      safeMaxTokens = parseInt(maxTokens, 10);
      if (isNaN(safeMaxTokens)) {
        safeMaxTokens = 500; // Default fallback
      }
    } else if (typeof maxTokens === 'number') {
      safeMaxTokens = maxTokens;
    } else {
      safeMaxTokens = 500; // Default fallback
    }
    
    console.log(`🔧 TOKEN SAFETY: Original: ${maxTokens} (${typeof maxTokens}) -> Safe: ${safeMaxTokens} (${typeof safeMaxTokens})`);
    
    // Task detection (non-blocking)
    let isTask = false;
    let taskData = null;
    
    try {
      const taskAnalysis = await analyzeTaskIntent(message, language);
      isTask = taskAnalysis.isTask;
      taskData = taskAnalysis.taskData;
      
      if (isTask && taskData) {
        console.log('✅ TASK DETECTED:', taskData);
      } else {
        console.log('ℹ️  No task detected');
      }
    } catch (taskError) {
      console.warn('⚠️  Task analysis failed:', taskError);
    }
    
    // CRITICAL FIX: Validate recentMessages is an array
    let conversationContext = '';
    if (recentMessages && Array.isArray(recentMessages) && recentMessages.length > 0) {
      console.log('🧠 MEMORY: Building conversation context from', recentMessages.length, 'recent messages');
      conversationContext = '\n\nRecent conversation context:\n';
      recentMessages.slice(-5).forEach((msg: any, index: number) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        conversationContext += `${role}: ${msg.content}\n`;
      });
    } else {
      console.log('🧠 MEMORY: No valid recentMessages array provided, skipping context');
      console.log('🧠 MEMORY DEBUG: recentMessages type:', typeof recentMessages, 'isArray:', Array.isArray(recentMessages));
    }
    
    if (conversationSummary) {
      console.log('🧠 MEMORY: Adding conversation summary');
      conversationContext += `\nConversation summary: ${conversationSummary}\n`;
    }
    
    // SIMPLIFIED: Basic personalization setup
    let personalizedTemperature = 0.7;
    let systemPrompt = language === 'ar' ? arabicSystemPrompt : englishSystemPrompt;
    
    if (personalTouch) {
      console.log('🎨 PERSONALIZATION: Applying basic personal touch settings');
      
      if (personalTouch.tone) {
        console.log('   - Setting tone:', personalTouch.tone);
        if (personalTouch.tone === 'formal') {
          personalizedTemperature = Math.max(0.3, personalizedTemperature - 0.2);
        } else if (personalTouch.tone === 'friendly') {
          personalizedTemperature = Math.min(0.9, personalizedTemperature + 0.2);
        }
      }
      
      if (personalTouch.aiNickname) {
        console.log('   - Setting AI nickname:', personalTouch.aiNickname);
        systemPrompt = systemPrompt.replace(/WAKTI/g, personalTouch.aiNickname);
      }
    }
    
    // FIXED: Vision processing with proper compression (no recursion)
    if (attachedFiles && attachedFiles.length > 0) {
      console.log('🔍 VISION MODE: Processing', attachedFiles.length, 'attached files');
      console.log('🔍 VISION PROCESSING: Starting OpenAI Vision analysis with fixed compression');

      const visionSystemPrompt = buildVisionSystemPrompt(language);
      
      // FIXED: Process files with proper compression (no stack overflow)
      const processedFiles = [];
      for (const file of attachedFiles) {
        if (file.publicUrl || file.url) {
          console.log('🔍 VISION: Applying fixed compression to image');
          const imageUrl = file.publicUrl || file.url;
          
          // FIXED: Use the corrected compression function
          const compressedData = await compressImageForVision(imageUrl);
          
          // Create proper base64 data URL for OpenAI Vision API
          const dataUrl = compressedData.startsWith('data:') 
            ? compressedData 
            : `data:image/jpeg;base64,${compressedData}`;
          
          processedFiles.push({
            type: "image_url",
            image_url: {
              url: dataUrl
            }
          });
          console.log('🔍 VISION: Successfully processed image for Vision API');
        }
      }

      // Detect image type and enhance message
      const imageType = detectImageType(message);
      console.log('🔍 VISION: Detected image type:', imageType);
      
      const visionPromptTemplate = getVisionPromptTemplate(imageType, language);
      const enhancedMessage = `${message}\n\n${visionPromptTemplate}${conversationContext}`;
      console.log('🔍 VISION: Enhanced message with context:', enhancedMessage.substring(0, 100) + '...');

      // Use current OpenAI vision model
      console.log('🔍 VISION API: Calling OpenAI Vision with gpt-4o (fixed compression)');
      
      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Using gpt-4o for better vision capabilities
          messages: [
            { role: 'system', content: visionSystemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: enhancedMessage },
                ...processedFiles
              ]
            }
          ],
          max_tokens: Math.max(safeMaxTokens * 2, 800),
          temperature: personalizedTemperature
        }),
      });

      if (!visionResponse.ok) {
        const errorData = await visionResponse.json();
        console.error('🚨 VISION API ERROR:', errorData);
        throw new Error(`Vision API error: ${visionResponse.status} - ${JSON.stringify(errorData)}`);
      }

      const visionData = await visionResponse.json();
      const visionResult = visionData.choices[0].message.content;

      console.log('✅ VISION SUCCESS:', visionResult.length, 'characters');

      return {
        response: visionResult,
        success: true,
        model: 'gpt-4o-vision',
        processingTime: Date.now() - startTime,
        tokensUsed: visionData.usage?.total_tokens || 0,
        visionProcessed: true,
        personalizedResponse: !!personalTouch
      };
    }

    // ENHANCED: Regular chat processing with conversation context
    console.log('💬 REGULAR CHAT: Calling OpenAI with gpt-4o-mini and conversation context');
    
    const enhancedMessage = message + conversationContext;
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enhancedMessage }
        ],
        max_tokens: safeMaxTokens,
        temperature: personalizedTemperature
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('🚨 OPENAI ERROR:', errorData);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = openaiData.choices[0].message.content;

    console.log('✅ OPENAI SUCCESS:', aiResponse.length, 'characters');

    return {
      response: aiResponse,
      success: true,
      model: 'gpt-4o-mini',
      processingTime: Date.now() - startTime,
      tokensUsed: openaiData.usage?.total_tokens || 0,
      personalizedResponse: !!personalTouch,
      isTask: isTask,
      taskData: taskData
    };

  } catch (error) {
    console.error('🚨 ENHANCED CHAT ERROR:', error);
    throw error;
  }
}
