
/**
 * Enhanced chat analysis with ultra-fast processing and post-processing personalization
 */
import { DEEPSEEK_API_KEY, OPENAI_API_KEY } from "./utils.ts";

export function analyzeBuddyChatIntent(message: string, activeTrigger: string, enhancedContext: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // ENHANCED: Better pattern matching for personality
  const patterns = {
    greeting: ['hi', 'hello', 'hey', 'مرحبا', 'أهلا', 'السلام عليكم'],
    question: ['what', 'how', 'when', 'why', 'where', 'ما', 'كيف', 'متى', 'لماذا', 'أين', '?'],
    thanks: ['thanks', 'thank', 'شكرا', 'شكراً'],
    task: ['create task', 'add task', 'أنشئ مهمة', 'أضف مهمة'],
    reminder: ['remind me', 'set reminder', 'ذكرني', 'أنشئ تذكير']
  };
  
  let intent = 'general_chat';
  let confidence = 'medium';
  
  // Enhanced intent detection
  for (const [intentType, patternList] of Object.entries(patterns)) {
    if (patternList.some(pattern => lowerMessage.includes(pattern))) {
      intent = intentType;
      confidence = 'high';
      break;
    }
  }
  
  return {
    intent,
    confidence,
    naturalQuery: true,
    conversational: true
  };
}

export function analyzeSmartModeIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // ENHANCED: Better mode detection with personality
  const modePatterns = {
    search: ['weather', 'news', 'price', 'search for', 'طقس', 'أخبار', 'ابحث عن'],
    image: ['create image', 'draw', 'generate image', 'أنشئ صورة', 'ارسم'],
    chat: ['chat', 'talk', 'conversation', 'تحدث', 'محادثة']
  };
  
  let suggestMode = null;
  let allowInMode = true;
  
  // Enhanced mode suggestion
  if (activeTrigger === 'chat') {
    for (const [mode, patterns] of Object.entries(modePatterns)) {
      if (mode !== 'chat' && patterns.some(pattern => lowerMessage.includes(pattern))) {
        suggestMode = mode;
        break;
      }
    }
  }
  
  return {
    suggestMode,
    allowInMode,
    naturalFlow: true
  };
}

// ENHANCED: Build personalized system prompts BEFORE API calls
const buildPersonalizedSystemPrompt = (
  language: string,
  personalTouch: any | null,
  interactionType: string
) => {
  let systemPrompt = language === 'ar' 
    ? 'أنت Wakti AI، مساعد ذكي ومفيد وودود.'
    : 'You are Wakti AI, a smart, helpful, and friendly assistant.';

  // Apply personalization BEFORE API call for speed
  if (personalTouch) {
    // Add nickname context
    if (personalTouch.nickname) {
      systemPrompt += language === 'ar'
        ? ` المستخدم يفضل أن تناديه ${personalTouch.nickname}.`
        : ` The user prefers to be called ${personalTouch.nickname}.`;
    }

    // Add AI nickname
    if (personalTouch.aiNickname) {
      systemPrompt += language === 'ar'
        ? ` أنت معروف باسم ${personalTouch.aiNickname}.`
        : ` You are known as ${personalTouch.aiNickname}.`;
    }

    // Apply tone instructions
    switch (personalTouch.tone) {
      case 'funny':
        systemPrompt += language === 'ar'
          ? ' كن مرحاً ومسلياً في ردودك.'
          : ' Be funny and entertaining in your responses.';
        break;
      case 'casual':
        systemPrompt += language === 'ar'
          ? ' تحدث بطريقة عادية ومسترخية.'
          : ' Speak casually and relaxed.';
        break;
      case 'encouraging':
        systemPrompt += language === 'ar'
          ? ' كن محفزاً وإيجابياً دائماً.'
          : ' Be encouraging and positive always.';
        break;
      case 'serious':
        systemPrompt += language === 'ar'
          ? ' تحدث بجدية ومهنية.'
          : ' Speak seriously and professionally.';
        break;
    }

    // Apply style instructions
    switch (personalTouch.style) {
      case 'short answers':
        systemPrompt += language === 'ar'
          ? ' اجعل إجاباتك مختصرة ومباشرة.'
          : ' Keep your answers brief and direct.';
        break;
      case 'bullet points':
        systemPrompt += language === 'ar'
          ? ' نظم إجاباتك في نقاط واضحة.'
          : ' Organize your answers in clear bullet points.';
        break;
      case 'step-by-step':
        systemPrompt += language === 'ar'
          ? ' اشرح الأشياء خطوة بخطوة.'
          : ' Explain things step by step.';
        break;
    }

    // Add custom instructions
    if (personalTouch.instruction && personalTouch.instruction.trim()) {
      systemPrompt += language === 'ar'
        ? ` تعليمات إضافية: ${personalTouch.instruction}`
        : ` Additional instructions: ${personalTouch.instruction}`;
    }
  }

  return systemPrompt;
};

// ULTRA-FAST: Build speed-optimized conversation messages
const buildSpeedOptimizedMessages = (
  userMessage: string, 
  context: string | null, 
  recentMessages: any[], 
  systemPrompt: string,
  interactionType: string
) => {
  const messages = [{ role: 'system', content: systemPrompt }];

  // ULTRA-FAST: Minimal context for speed
  if (context && context.length > 0 && !interactionType.includes('hyper_fast')) {
    messages.push({
      role: 'system',
      content: `Context: ${context.substring(0, 300)}`
    });
  }

  // ULTRA-FAST: Minimal conversation history for maximum speed
  if (recentMessages && recentMessages.length > 0) {
    const maxMessages = interactionType.includes('hyper_fast') ? 1 : 
                       interactionType.includes('ultra_fast') ? 2 : 3;
    
    const conversationHistory = recentMessages.slice(-maxMessages).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: typeof msg.content === 'string' 
        ? msg.content.substring(0, interactionType.includes('hyper_fast') ? 100 : 200)
        : '[Message with attachment]'
    }));
    
    messages.push(...conversationHistory);
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
};

// CRITICAL: Add timeout wrapper for API calls
const makeAPICallWithTimeout = async (apiCall: Promise<Response>, timeoutMs: number = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await Promise.race([
      apiCall,
      fetch('', { signal: controller.signal }).catch(() => {
        throw new Error('Request timeout');
      })
    ]);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// CRITICAL: Enhanced API call with proper fallback
const makeResilientAPICall = async (
  messages: any[],
  maxTokens: number,
  temperature: number,
  retryCount: number = 0
): Promise<any> => {
  console.log(`🔄 API Call Attempt ${retryCount + 1}/3`);
  
  // Try OpenAI first if available
  if (OPENAI_API_KEY) {
    try {
      console.log('🚀 Trying OpenAI with timeout...');
      
      const openAICall = fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: 0.9,
          frequency_penalty: 0,
          presence_penalty: 0
        }),
      });

      const response = await makeAPICallWithTimeout(openAICall, 8000);
      
      if (!response.ok) {
        throw new Error(`OpenAI API failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ OpenAI Success');
      return { data, provider: 'openai' };
      
    } catch (error) {
      console.warn(`⚠️ OpenAI failed: ${error.message}`);
      
      // If it's a timeout or network error and we have retries left, retry
      if (retryCount < 2 && (error.message.includes('timeout') || error.message.includes('network'))) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000)); // Exponential backoff
        return makeResilientAPICall(messages, maxTokens, temperature, retryCount + 1);
      }
    }
  }

  // Fallback to DeepSeek
  if (DEEPSEEK_API_KEY) {
    try {
      console.log('🔄 Falling back to DeepSeek...');
      
      const deepSeekCall = fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages,
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: 0.9
        }),
      });

      const response = await makeAPICallWithTimeout(deepSeekCall, 8000);
      
      if (!response.ok) {
        throw new Error(`DeepSeek API failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ DeepSeek Success');
      return { data, provider: 'deepseek' };
      
    } catch (error) {
      console.warn(`⚠️ DeepSeek failed: ${error.message}`);
      
      // If it's a timeout or network error and we have retries left, retry
      if (retryCount < 2 && (error.message.includes('timeout') || error.message.includes('network'))) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000)); // Exponential backoff
        return makeResilientAPICall(messages, maxTokens, temperature, retryCount + 1);
      }
    }
  }

  // If all APIs fail
  throw new Error('All AI providers failed or timed out');
};

// ULTRA-FAST: Main processing function with timeout protection and personalization
export async function processWithBuddyChatAI(
  userMessage: string,
  context: string | null = null,
  language: string = 'en',
  recentMessages: any[] = [],
  conversationSummary: string = '',
  activeTrigger: string = 'chat',
  interactionType: string = 'ultra_fast_chat',
  attachedFiles: any[] = [],
  customSystemPrompt: string = '',
  maxTokens: number = 400,
  personalTouch: any | null = null
): Promise<string> {
  
  console.log(`🚀 ULTRA-FAST CHAT: Processing with timeout protection - ${interactionType} (${maxTokens} tokens)`);
  
  try {
    // ENHANCED: Build personalized system prompt BEFORE API call
    let systemPrompt = customSystemPrompt;
    if (!systemPrompt) {
      systemPrompt = buildPersonalizedSystemPrompt(language, personalTouch, interactionType);
    }

    console.log(`🎯 PERSONALIZED SYSTEM PROMPT: ${systemPrompt.substring(0, 100)}...`);
    
    // ULTRA-FAST: Minimal context for speed
    let speedContext = context;
    if (interactionType.includes('hyper_fast')) {
      speedContext = null; // No context for maximum speed
    } else if (interactionType.includes('ultra_fast') && context) {
      speedContext = context.substring(0, 200); // Minimal context
    }
    
    // Build speed-optimized conversation messages
    const messages = buildSpeedOptimizedMessages(
      userMessage,
      speedContext,
      recentMessages.slice(-2), // Minimal for speed
      systemPrompt,
      interactionType
    );

    // CRITICAL: Enhanced temperature based on personalization
    let temperature = interactionType.includes('hyper_fast') ? 0.3 : 0.7;
    if (personalTouch?.tone) {
      switch (personalTouch.tone) {
        case 'funny':
          temperature = Math.min(temperature + 0.2, 0.9);
          break;
        case 'serious':
          temperature = Math.max(temperature - 0.2, 0.3);
          break;
        case 'casual':
          temperature = Math.min(temperature + 0.1, 0.8);
          break;
      }
    }

    console.log(`🎯 PERSONALIZED TEMPERATURE: ${temperature}`);

    // CRITICAL: Make resilient API call with proper fallback
    const result = await makeResilientAPICall(messages, maxTokens, temperature);
    const aiResponse = result.data.choices[0].message.content;
    
    console.log(`✅ SUCCESS via ${result.provider.toUpperCase()}: ${aiResponse.length} characters`);
    
    return aiResponse;
    
  } catch (error) {
    console.error('🚨 CRITICAL ERROR:', error);
    
    // NEVER return timeout errors to users - always provide fallback
    const fallbackResponse = language === 'ar' 
      ? 'عذراً، أواجه صعوبة في الوصول للخدمة حالياً. حاول مرة أخرى من فضلك.'
      : 'Sorry, I\'m having trouble connecting right now. Please try again.';
    
    return fallbackResponse;
  }
}
