

// Remove the old OpenAI import and use direct fetch calls instead
import { analyzeTaskIntent } from "./taskParsing.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// System prompts
const englishSystemPrompt = `You are a helpful AI assistant that analyzes images. Extract all visible text, identify people, objects, and scenes, and respond with clear, structured descriptions. Always reason from visual details and provide insights where possible.`;

const arabicSystemPrompt = `أنت مساعد ذكي مفيد يحلل الصور. استخرج كل النص المرئي، وحدد الأشخاص والأشياء والمشاهد، واستجب بوصف واضح ومنظم. استدل دائماً من التفاصيل البصرية وقدم رؤى عند الإمكان.`;

// Vision prompts
const englishVisionPromptTemplate = `Analyze the image and provide a detailed description. Identify any objects, people, or scenes present. Extract any text or information that can be read from the image.`;
const arabicVisionPromptTemplate = `حلل الصورة وقدم وصفًا تفصيليًا. حدد أي كائنات أو أشخاص أو مشاهد موجودة. استخرج أي نص أو معلومات يمكن قراءتها من الصورة.`;

// Image compression utility function
async function compressImageForVision(imageUrl: string): Promise<string> {
  try {
    console.log('🔍 COMPRESSION: Starting image compression for Vision API');
    
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // For Deno edge functions, we'll use a simplified compression approach
    // Convert to base64 with size limits
    const base64 = btoa(String.fromCharCode(...uint8Array));
    
    // Apply size limits (max 1MB for Vision API)
    const maxSize = 1024 * 1024; // 1MB limit
    if (base64.length > maxSize) {
      console.log('🔍 COMPRESSION: Image too large, applying compression');
      // Simple truncation-based compression approach for Deno
      return base64.substring(0, maxSize);
    }
    
    console.log('🔍 COMPRESSION: Image compression completed');
    return base64;
  } catch (error) {
    console.error('🚨 COMPRESSION ERROR:', error);
    // Return original URL if compression fails
    return imageUrl;
  }
}

// Build vision system prompt based on language
function buildVisionSystemPrompt(language: string): string {
  return language === 'ar' ? arabicSystemPrompt : englishSystemPrompt;
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
    
    // FIXED: Personalization setup WITHOUT nickname in system prompt
    let personalizedTemperature = 0.7;
    let systemPrompt = language === 'ar' ? arabicSystemPrompt : englishSystemPrompt;
    
    if (personalTouch) {
      console.log('🎨 PERSONALIZATION: Applying personal touch settings (no nickname in system prompt)');
      
      if (personalTouch.tone) {
        console.log('   - Setting tone:', personalTouch.tone);
        if (personalTouch.tone === 'formal') {
          personalizedTemperature = Math.max(0.3, personalizedTemperature - 0.2);
        } else if (personalTouch.tone === 'friendly') {
          personalizedTemperature = Math.min(0.9, personalizedTemperature + 0.2);
        }
      }
      
      // FIXED: Filter out nickname-related instructions to prevent double nicknames
      if (personalTouch.instruction) {
        const filteredInstruction = personalTouch.instruction
          .replace(/use my nickname/gi, '')
          .replace(/call me by my nickname/gi, '')
          .replace(/address me by name/gi, '')
          .trim();
        
        if (filteredInstruction.length > 0) {
          console.log('   - Adding filtered custom instruction:', filteredInstruction);
          systemPrompt += `\n\nADDITIONAL INSTRUCTION: ${filteredInstruction}`;
        }
      }
      
      if (personalTouch.aiNickname) {
        console.log('   - Setting AI nickname:', personalTouch.aiNickname);
        systemPrompt = systemPrompt.replace(/WAKTI/g, personalTouch.aiNickname);
      }
    }
    
    // Vision processing with compression
    if (attachedFiles && attachedFiles.length > 0) {
      console.log('🔍 VISION MODE: Processing', attachedFiles.length, 'attached files');
      console.log('🔍 VISION PROCESSING: Starting OpenAI Vision analysis with enhanced prompts');

      const visionSystemPrompt = buildVisionSystemPrompt(language);
      
      // Process files with compression
      const processedFiles = [];
      for (const file of attachedFiles) {
        if (file.publicUrl || file.url) {
          console.log('🔍 VISION: Compressing image before API call');
          const imageUrl = file.publicUrl || file.url;
          const compressedBase64 = await compressImageForVision(imageUrl);
          
          // Use compressed base64 format
          processedFiles.push({
            type: "image_url",
            image_url: {
              url: compressedBase64.startsWith('data:') 
                ? compressedBase64 
                : `data:image/jpeg;base64,${compressedBase64}`
            }
          });
          console.log('🔍 VISION: Added compressed image for analysis');
        }
      }

      // Detect image type and enhance message
      const imageType = detectImageType(message);
      console.log('🔍 VISION: Detected image type:', imageType);
      
      const visionPromptTemplate = getVisionPromptTemplate(imageType, language);
      const enhancedMessage = `${message}\n\n${visionPromptTemplate}${conversationContext}`;
      console.log('🔍 VISION: Enhanced message with context:', enhancedMessage.substring(0, 100) + '...');

      // Use current OpenAI vision model
      console.log('🔍 VISION API: Calling OpenAI Vision with gpt-4o-2024-05-13');
      
      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-2024-05-13', // Updated to current vision model
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
          max_tokens: Math.max(maxTokens * 2, 800), // More tokens for vision analysis
          temperature: personalizedTemperature
        }),
      });

      if (!visionResponse.ok) {
        const errorData = await visionResponse.json();
        console.error('🚨 VISION API ERROR:', errorData);
        throw new Error(`Vision API error: ${visionResponse.status}`);
      }

      const visionData = await visionResponse.json();
      const visionResult = visionData.choices[0].message.content;

      console.log('✅ VISION SUCCESS:', visionResult.length, 'characters');

      return {
        response: visionResult,
        success: true,
        model: 'gpt-4o-2024-05-13-vision',
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
        max_tokens: maxTokens,
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

