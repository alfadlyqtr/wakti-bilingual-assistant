
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

// ULTRA-FAST: Main processing function with speed optimization
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
  maxTokens: number = 400
): Promise<string> {
  
  console.log(`🚀 ULTRA-FAST CHAT: Processing with maximum speed - ${interactionType} (${maxTokens} tokens)`);
  
  // ULTRA-FAST: Use minimal system prompt for speed
  let systemPrompt = customSystemPrompt;
  if (!systemPrompt) {
    systemPrompt = language === 'ar' 
      ? 'أنت Wakti AI، مساعد ذكي ومفيد وودود.'
      : 'You are Wakti AI, a smart, helpful, and friendly assistant.';
  }

  // ULTRA-FAST: Skip complex instructions for speed modes
  if (!interactionType.includes('hyper_fast') && !interactionType.includes('ultra_fast')) {
    systemPrompt += language === 'ar'
      ? '\n\nاجعل المحادثة طبيعية ومفيدة.'
      : '\n\nMake conversation natural and helpful.';
  }
  
  console.log(`🚀 ULTRA-FAST SYSTEM PROMPT: ${systemPrompt.substring(0, 80)}...`);
  
  // ULTRA-FAST: Build minimal context
  let speedContext = context;
  if (interactionType.includes('hyper_fast')) {
    speedContext = null; // No context for maximum speed
  } else if (interactionType.includes('ultra_fast') && context) {
    speedContext = context.substring(0, 200); // Minimal context
  }
  
  if (speedContext) {
    console.log(`🚀 SPEED CONTEXT: ${speedContext.length} characters`);
  }
  
  // ULTRA-FAST: Minimal message history
  const speedMessages = interactionType.includes('hyper_fast') ? [] : recentMessages.slice(-2);
  if (speedMessages.length > 0) {
    console.log(`🚀 SPEED MESSAGES: Including ${speedMessages.length} messages`);
  }

  // Build speed-optimized conversation messages
  const messages = buildSpeedOptimizedMessages(
    userMessage,
    speedContext,
    speedMessages,
    systemPrompt,
    interactionType
  );

  try {
    let response;
    
    // ULTRA-FAST: Prioritize OpenAI for speed, with speed-optimized settings
    if (OPENAI_API_KEY) {
      console.log(`🚀 ULTRA-FAST: Using OpenAI with speed optimization - ${messages.length} messages`);
      
      // ULTRA-FAST: Speed-optimized temperature
      let temperature = interactionType.includes('hyper_fast') ? 0.3 : 
                       interactionType.includes('ultra_fast') ? 0.5 : 0.7;
      
      console.log(`🚀 SPEED TEMPERATURE: ${temperature} for ultra-fast processing`);
      
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Fastest model
          messages: messages,
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: interactionType.includes('hyper_fast') ? 0.8 : 0.9,
          frequency_penalty: 0,
          presence_penalty: 0
        }),
      });
    } else {
      console.log(`🚀 ULTRA-FAST: Using DeepSeek with speed optimization - ${messages.length} messages`);
      
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages,
          max_tokens: maxTokens,
          temperature: interactionType.includes('hyper_fast') ? 0.3 : 0.7,
          top_p: 0.9
        }),
      });
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log(`🚀 ULTRA-FAST AI RESPONSE LENGTH: ${aiResponse.length} characters`);
    
    return aiResponse;
    
  } catch (error) {
    console.error('🚀 ULTRA-FAST CHAT ERROR:', error);
    
    // Ultra-fast fallback response
    const fallbackResponse = language === 'ar' 
      ? 'عذراً، حدث خطأ مؤقت. حاول مرة أخرى.'
      : 'Sorry, there was a temporary error. Please try again.';
    
    return fallbackResponse;
  }
}
