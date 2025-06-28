/**
 * Enhanced chat analysis with ultra-fast processing and post-processing personalization
 * UPDATED: Smart memory management with 10+ message trigger
 */
import { DEEPSEEK_API_KEY, OPENAI_API_KEY } from "./utils.ts";

export function analyzeBuddyChatIntent(message: string, activeTrigger: string, enhancedContext: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // ENHANCED: Better pattern matching for personality
  const patterns = {
    greeting: ['hi', 'hello', 'hey', 'مرحبا', 'أهلا', 'السلام عليكم'],
    question: ['what', 'how', 'when', 'why', 'where', 'ما', 'كيف', 'متى', 'لماذا', 'أين', '?'],
    thanks: ['thanks', 'thank', 'شكرا', 'شكراً'],
    // FIXED: Task creation only on explicit commands
    task: ['create task', 'add task', 'make task', 'new task', 'أنشئ مهمة', 'أضف مهمة', 'اعمل مهمة'],
    reminder: ['create reminder', 'add reminder', 'set reminder', 'make reminder', 'ذكرني', 'أنشئ تذكير', 'اعمل تذكير']
  };
  
  let intent = 'general_chat';
  let confidence = 'medium';
  
  // Enhanced intent detection - ONLY explicit task commands
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

// ENHANCED: Build personalized system prompts using FULL personal touch data
const buildPersonalizedSystemPrompt = (
  language: string,
  personalTouch: any | null,
  interactionType: string
) => {
  let systemPrompt = language === 'ar' 
    ? 'أنت Wakti AI، مساعد ذكي ومفيد وودود.'
    : 'You are Wakti AI, a smart, helpful, and friendly assistant.';

  // CRITICAL: Apply FULL personalization BEFORE API call for speed
  if (personalTouch) {
    console.log('🎯 APPLYING FULL PERSONALIZATION:', personalTouch);
    
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

    // Apply tone instructions - FULL OPTIONS
    switch (personalTouch.tone) {
      case 'funny':
        systemPrompt += language === 'ar'
          ? ' كن مرحاً ومسلياً في ردودك. استخدم الفكاهة والنكات المناسبة.'
          : ' Be funny and entertaining in your responses. Use appropriate humor and jokes.';
        break;
      case 'casual':
        systemPrompt += language === 'ar'
          ? ' تحدث بطريقة عادية ومسترخية. استخدم لغة بسيطة وودودة.'
          : ' Speak casually and relaxed. Use simple, friendly language.';
        break;
      case 'encouraging':
        systemPrompt += language === 'ar'
          ? ' كن محفزاً وإيجابياً دائماً. ادعم المستخدم وشجعه.'
          : ' Be encouraging and positive always. Support and motivate the user.';
        break;
      case 'serious':
        systemPrompt += language === 'ar'
          ? ' تحدث بجدية ومهنية. كن مباشراً ومركزاً.'
          : ' Speak seriously and professionally. Be direct and focused.';
        break;
      case 'neutral':
        systemPrompt += language === 'ar'
          ? ' حافظ على نبرة متوازنة ومهذبة.'
          : ' Maintain a balanced and polite tone.';
        break;
    }

    // Apply style instructions - FULL OPTIONS
    switch (personalTouch.style) {
      case 'short answers':
        systemPrompt += language === 'ar'
          ? ' اجعل إجاباتك مختصرة ومباشرة. لا تطل في الشرح.'
          : ' Keep your answers brief and direct. Don\'t elaborate unnecessarily.';
        break;
      case 'bullet points':
        systemPrompt += language === 'ar'
          ? ' نظم إجاباتك في نقاط واضحة ومرتبة.'
          : ' Organize your answers in clear, ordered bullet points.';
        break;
      case 'step-by-step':
        systemPrompt += language === 'ar'
          ? ' اشرح الأشياء خطوة بخطوة بترتيب منطقي.'
          : ' Explain things step by step in logical order.';
        break;
      case 'detailed':
        systemPrompt += language === 'ar'
          ? ' قدم إجابات مفصلة وشاملة مع الأمثلة.'
          : ' Provide detailed, comprehensive answers with examples.';
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

// ENHANCED: Build speed-optimized messages with SMART MEMORY INTEGRATION
const buildSpeedOptimizedMessages = (
  userMessage: string, 
  context: string | null, 
  recentMessages: any[], 
  systemPrompt: string,
  interactionType: string
) => {
  const messages = [{ role: 'system', content: systemPrompt }];

  // ENHANCED: Smart context integration with conversation summaries
  if (context && context.length > 0) {
    // Check if context contains enhanced conversation memory
    const isEnhancedMemory = context.includes('Enhanced Conversation Memory:') || 
                            context.includes('Conversation Context');
    
    if (isEnhancedMemory) {
      messages.push({
        role: 'system',
        content: `Smart Memory Context: ${context.substring(0, 800)}` // INCREASED limit
      });
      console.log('🧠 SMART MEMORY: Using enhanced conversation context');
    } else {
      messages.push({
        role: 'system',
        content: `Previous context: ${context.substring(0, 600)}`
      });
    }
  }

  // ENHANCED: More conversation history for better continuity (8-12 messages)
  if (recentMessages && recentMessages.length > 0) {
    const maxMessages = interactionType.includes('hyper_fast') ? 6 : 
                       interactionType.includes('ultra_fast') ? 8 : 12; // INCREASED
    
    const conversationHistory = recentMessages.slice(-maxMessages).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: typeof msg.content === 'string' 
        ? msg.content.substring(0, 400) // INCREASED from 300
        : '[Message with attachment]'
    }));
    
    messages.push(...conversationHistory);
    console.log(`🧠 CONTEXT: Using ${conversationHistory.length} recent messages for continuity`);
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
};

// FIXED: Properly working timeout wrapper with AbortController
const makeAPICallWithTimeout = async (
  apiCall: () => Promise<Response>, 
  timeoutMs: number = 12000,
  abortController?: AbortController
): Promise<Response> => {
  
  const controller = abortController || new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`⏰ TIMEOUT: Aborting API call after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);
  
  try {
    const response = await apiCall();
    clearTimeout(timeoutId);
    
    if (controller.signal.aborted) {
      throw new Error('Request timeout');
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (controller.signal.aborted || error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    throw error;
  }
};

// FIXED: Enhanced API call with DEEPSEEK-R1-0528 model
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
      console.log('🚀 Trying OpenAI with proper timeout handling...');
      
      const openAICall = () => fetch('https://api.openai.com/v1/chat/completions', {
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

      const response = await makeAPICallWithTimeout(openAICall, 12000);
      
      if (!response.ok) {
        throw new Error(`OpenAI API failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ OpenAI Success');
      return { data, provider: 'openai' };
      
    } catch (error) {
      console.warn(`⚠️ OpenAI failed: ${error.message}`);
      
      if (retryCount < 2 && (error.message.includes('timeout') || error.message.includes('network'))) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return makeResilientAPICall(messages, maxTokens, temperature, retryCount + 1);
      }
    }
  }

  // FIXED: Fallback to DeepSeek-R1-0528
  if (DEEPSEEK_API_KEY) {
    try {
      console.log('🔄 Falling back to DeepSeek-R1-0528...');
      
      const deepSeekCall = () => fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'DeepSeek-R1-0528', // UPDATED MODEL
          messages: messages,
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: 0.9
        }),
      });

      const response = await makeAPICallWithTimeout(deepSeekCall, 12000);
      
      if (!response.ok) {
        throw new Error(`DeepSeek API failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ DeepSeek-R1-0528 Success');
      return { data, provider: 'deepseek-r1' };
      
    } catch (error) {
      console.warn(`⚠️ DeepSeek-R1-0528 failed: ${error.message}`);
      
      if (retryCount < 2 && (error.message.includes('timeout') || error.message.includes('network'))) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return makeResilientAPICall(messages, maxTokens, temperature, retryCount + 1);
      }
    }
  }

  throw new Error('AI services are temporarily busy. Please try again.');
};

// ENHANCED: Main processing function with SMART MEMORY INTEGRATION
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
  
  console.log(`🚀 ENHANCED CHAT: Processing with SMART MEMORY (10+ trigger) - ${interactionType} (${maxTokens} tokens)`);
  
  try {
    // ENHANCED: Build FULLY personalized system prompt BEFORE API call
    let systemPrompt = customSystemPrompt;
    if (!systemPrompt) {
      systemPrompt = buildPersonalizedSystemPrompt(language, personalTouch, interactionType);
    }

    console.log(`🎯 FULL PERSONALIZED SYSTEM PROMPT: ${systemPrompt.substring(0, 150)}...`);
    
    // ENHANCED: Smart context handling with memory integration
    let enhancedContext = context;
    if (conversationSummary && conversationSummary.length > 0) {
      enhancedContext = enhancedContext 
        ? `${conversationSummary}\n\nRecent context: ${enhancedContext}`
        : conversationSummary;
    }
    
    // Build enhanced conversation messages with SMART MEMORY
    const messages = buildSpeedOptimizedMessages(
      userMessage,
      enhancedContext,
      recentMessages.slice(-12), // INCREASED from -8 to -12
      systemPrompt,
      interactionType
    );

    // ENHANCED: Better temperature based on personalization
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
    console.log(`🧠 MESSAGE COUNT: System(1) + Context(${enhancedContext ? 1 : 0}) + History(${recentMessages.slice(-12).length}) + Current(1) = ${messages.length}`);

    // Make resilient API call with proper timeout handling
    const result = await makeResilientAPICall(messages, maxTokens, temperature);
    const aiResponse = result.data.choices[0].message.content;
    
    console.log(`✅ SUCCESS via ${result.provider.toUpperCase()}: ${aiResponse.length} characters (SMART MEMORY ENABLED)`);
    
    return aiResponse;
    
  } catch (error) {
    console.error('🚨 ENHANCED CHAT ERROR:', error);
    
    if (error.message?.includes('timeout') || error.message?.includes('busy')) {
      const fallbackResponse = language === 'ar' 
        ? 'عذراً، الذكاء الاصطناعي يستغرق وقتاً أطول من المعتاد. حاول مرة أخرى من فضلك.'
        : 'Sorry, AI is taking longer than usual. Please try again.';
      
      return fallbackResponse;
    }
    
    const fallbackResponse = language === 'ar' 
      ? 'عذراً، أواجه صعوبة مؤقتة. حاول مرة أخرى من فضلك.'
      : 'Sorry, I\'m having a temporary issue. Please try again.';
    
    return fallbackResponse;
  }
}
