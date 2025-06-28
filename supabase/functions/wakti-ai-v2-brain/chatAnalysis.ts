
import { DEEPSEEK_API_KEY, OPENAI_API_KEY } from "./utils.ts";

export async function processWithBuddyChatAI(
  message: string,
  context: string | null,
  language: string,
  recentMessages: any[],
  conversationSummary: string,
  activeTrigger: string,
  interactionType: string,
  attachedFiles: any[] = [],
  customSystemPrompt: string = '',
  maxTokens: number = 400,
  personalTouch: any = null
): Promise<string> {
  
  console.log(`🚀 ENHANCED CHAT: Processing with SMART MEMORY (${recentMessages.length}+ trigger) - ${interactionType} (${maxTokens} tokens)`);

  // ENHANCED: Check if we have images attached for Vision
  const hasImages = attachedFiles && attachedFiles.length > 0 && 
    attachedFiles.some(file => file.type && file.type.startsWith('image/'));

  if (hasImages) {
    console.log(`🔍 VISION MODE: Processing ${attachedFiles.length} attached files`);
    return await processWithOpenAIVision(message, attachedFiles, language, personalTouch, maxTokens);
  }

  // ENHANCED: Apply FULL personalization from the start
  let personalizedSystemPrompt = buildPersonalizedSystemPrompt(language, personalTouch);
  
  if (customSystemPrompt && customSystemPrompt.trim()) {
    personalizedSystemPrompt += `\n\nAdditional Instructions: ${customSystemPrompt}`;
  }

  console.log("🎯 APPLYING FULL PERSONALIZATION:", {
    nickname: personalTouch?.nickname || 'none',
    tone: personalTouch?.tone || 'neutral',
    style: personalTouch?.style || 'detailed',
    instruction: personalTouch?.instruction || ''
  });

  console.log("🎯 FULL PERSONALIZED SYSTEM PROMPT:", personalizedSystemPrompt.substring(0, 100) + "...");

  // ENHANCED: Build conversation context with smart memory
  const messages = [];
  
  messages.push({
    role: "system",
    content: personalizedSystemPrompt
  });

  // ENHANCED: Add conversation context for continuity (SMART MEMORY)
  if (conversationSummary && conversationSummary.trim()) {
    console.log("🧠 SMART MEMORY: Using enhanced conversation context");
    messages.push({
      role: "system",
      content: `Previous conversation context: ${conversationSummary}`
    });
  }

  // ENHANCED: Add recent messages for better context understanding
  if (recentMessages && recentMessages.length > 0) {
    console.log(`🧠 CONTEXT: Using ${recentMessages.length} recent messages for continuity`);
    recentMessages.forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });
  }

  // Add current user message
  messages.push({
    role: "user",
    content: message
  });

  console.log(`🧠 MESSAGE COUNT: System(1) + Context(${conversationSummary ? 1 : 0}) + History(${recentMessages.length}) + Current(1) = ${messages.length}`);

  // ENHANCED: Personalized temperature based on tone
  const temperature = personalTouch?.tone === 'serious' ? 0.3 : 
                     personalTouch?.tone === 'casual' ? 0.7 : 0.5;
  console.log(`🎯 PERSONALIZED TEMPERATURE: ${temperature}`);

  return await makeAPICall(messages, maxTokens, temperature);
}

async function processWithOpenAIVision(
  message: string, 
  attachedFiles: any[], 
  language: string, 
  personalTouch: any, 
  maxTokens: number
): Promise<string> {
  
  console.log("🔍 VISION PROCESSING: Starting OpenAI Vision analysis");
  
  if (!OPENAI_API_KEY) {
    return language === 'ar' 
      ? 'عذراً، مفتاح OpenAI غير متوفر لتحليل الصور.'
      : 'Sorry, OpenAI API key is not available for image analysis.';
  }

  // Build personalized system prompt for vision
  const personalizedSystemPrompt = buildPersonalizedSystemPrompt(language, personalTouch);

  // Build vision message content
  const messageContent = [
    {
      type: "text",
      text: message || (language === 'ar' ? 'حلل هذه الصورة' : 'Analyze this image')
    }
  ];

  // Add images to message content
  attachedFiles.forEach(file => {
    if (file.type && file.type.startsWith('image/')) {
      if (file.optimized && file.publicUrl) {
        // Use optimized URL for Vision
        messageContent.push({
          type: "image_url",
          image_url: {
            url: file.publicUrl,
            detail: "high" // High detail for better analysis
          }
        });
        console.log(`🔍 VISION: Added optimized image URL`);
      } else if (file.url) {
        // Fallback to regular URL
        messageContent.push({
          type: "image_url",
          image_url: {
            url: file.url,
            detail: "high"
          }
        });
        console.log(`🔍 VISION: Added fallback image URL`);
      }
    }
  });

  const messages = [
    {
      role: "system",
      content: personalizedSystemPrompt
    },
    {
      role: "user",
      content: messageContent
    }
  ];

  try {
    console.log("🔍 VISION API: Calling OpenAI Vision with gpt-4o");
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Vision-capable model
        messages: messages,
        max_tokens: Math.min(maxTokens, 1000), // Vision responses can be longer
        temperature: personalTouch?.tone === 'serious' ? 0.3 : 0.5
      }),
    });

    if (!response.ok) {
      console.error("🔍 VISION ERROR: API call failed", response.status);
      throw new Error(`OpenAI Vision API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from Vision API');
    }

    console.log(`🔍 VISION SUCCESS: Generated ${content.length} characters`);
    return content;

  } catch (error) {
    console.error("🔍 VISION ERROR:", error);
    
    // Fallback to text-only mode
    const fallbackMessage = language === 'ar' 
      ? `عذراً، لم أتمكن من تحليل الصورة. يمكنني مساعدتك بالنص فقط: ${message}`
      : `Sorry, I couldn't analyze the image. I can help with text only: ${message}`;
    
    return await processTextOnly(fallbackMessage, language, personalTouch, maxTokens);
  }
}

async function processTextOnly(
  message: string, 
  language: string, 
  personalTouch: any, 
  maxTokens: number
): Promise<string> {
  
  const personalizedSystemPrompt = buildPersonalizedSystemPrompt(language, personalTouch);
  
  const messages = [
    {
      role: "system",
      content: personalizedSystemPrompt
    },
    {
      role: "user",
      content: message
    }
  ];

  return await makeAPICall(messages, maxTokens, 0.5);
}

function buildPersonalizedSystemPrompt(language: string, personalTouch: any): string {
  let systemPrompt = language === 'ar' 
    ? "أنت وقتي AI، مساعد ذكي ومفيد وودود."
    : "You are Wakti AI, a smart, helpful, and friendly assistant.";

  if (personalTouch) {
    // Add nickname
    if (personalTouch.nickname && personalTouch.nickname.trim()) {
      systemPrompt += language === 'ar' 
        ? ` المستخدم يفضل أن تناديه ${personalTouch.nickname.trim()}.`
        : ` The user prefers to be called ${personalTouch.nickname.trim()}.`;
    }

    // Add tone
    if (personalTouch.tone) {
      switch (personalTouch.tone) {
        case 'serious':
          systemPrompt += language === 'ar' 
            ? " تحدث بجدية ومهنية."
            : " Speak seriously and professionally.";
          break;
        case 'casual':
          systemPrompt += language === 'ar' 
            ? " تحدث بطريقة غير رسمية وودية."
            : " Speak casually and friendly.";
          break;
        case 'humorous':
          systemPrompt += language === 'ar' 
            ? " أضف لمسة من الفكاهة إلى إجاباتك."
            : " Add humor to your responses.";
          break;
      }
    }

    // Add style
    if (personalTouch.style) {
      switch (personalTouch.style) {
        case 'short answers':
          systemPrompt += language === 'ar' 
            ? " كن مباشراً ومختصراً."
            : " Be direct and concise.";
          break;
        case 'detailed':
          systemPrompt += language === 'ar' 
            ? " قدم إجابات مفصلة وشاملة."
            : " Provide detailed and comprehensive answers.";
          break;
      }
    }

    // Add custom instruction
    if (personalTouch.instruction && personalTouch.instruction.trim()) {
      systemPrompt += ` ${personalTouch.instruction.trim()}`;
    }
  }

  // Add language-specific guidance
  if (language === 'ar') {
    systemPrompt += " أجب باللغة العربية دائماً.";
  } else {
    systemPrompt += " Always respond in English.";
  }

  return systemPrompt;
}

async function makeAPICall(messages: any[], maxTokens: number, temperature: number): Promise<string> {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 API Call Attempt ${attempt}/${maxRetries}`);
    
    try {
      // Try OpenAI first if available
      if (OPENAI_API_KEY) {
        console.log("🚀 Trying OpenAI with proper timeout handling...");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout
        
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: messages,
              max_tokens: maxTokens,
              temperature: temperature
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const result = await response.json();
            const content = result.choices?.[0]?.message?.content;
            if (content) {
              console.log("✅ OpenAI Success");
              console.log(`✅ SUCCESS via OPENAI: ${content.length} characters (SMART MEMORY ENABLED)`);
              return content;
            }
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.log("⏰ OpenAI timeout, trying DeepSeek...");
          } else {
            console.log("❌ OpenAI failed, trying DeepSeek...");
          }
        }
      }

      // Fallback to DeepSeek
      if (DEEPSEEK_API_KEY) {
        console.log("🚀 Trying DeepSeek as fallback...");
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature
          })
        });

        if (response.ok) {
          const result = await response.json();
          const content = result.choices?.[0]?.message?.content;
          if (content) {
            console.log("✅ DeepSeek Success");
            console.log(`✅ SUCCESS via DEEPSEEK: ${content.length} characters (SMART MEMORY ENABLED)`);
            return content;
          }
        }
      }

      // If we get here, both APIs failed this attempt
      if (attempt === maxRetries) {
        throw new Error("All AI services are currently unavailable");
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw new Error("Failed to get AI response after all retries");
}
