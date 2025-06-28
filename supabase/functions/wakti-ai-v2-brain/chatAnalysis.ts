/**
 * Enhanced chat analysis with full personality restoration for Wakti Edge Function
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

// ENHANCED: System prompts with conversation awareness
const getEnhancedSystemPrompt = (interactionType: string, language: string, customPrompt?: string) => {
  const basePersonality = language === 'ar' 
    ? 'أنت Wakti AI، مساعد ذكي ومفيد وودود. كن مرحاً ومرحاً! استخدم النكات والتورية والمرح في ردودك. اجعل المحادثات ممتعة وجذابة. تذكر السياق والمواضيع السابقة في المحادثة واشر إليها بشكل طبيعي.'
    : 'You are Wakti AI, a smart, helpful, and friendly assistant. Be funny and playful! Use jokes, puns, and humor in your responses. Make conversations enjoyable and engaging. Remember previous context and topics in the conversation and reference them naturally.';

  let systemPrompt = customPrompt || basePersonality;

  // ENHANCED: Add conversation-specific instructions
  switch (interactionType) {
    case 'personality_enhanced_conversation':
      systemPrompt += language === 'ar' 
        ? '\n\nكن متفاعلاً ومهتماً بالمحادثة. اطرح أسئلة متابعة ذكية واربط الردود بما قاله المستخدم سابقاً. اجعل المحادثة تبدو طبيعية ومتدفقة.'
        : '\n\nBe interactive and engaged in the conversation. Ask smart follow-up questions and connect responses to what the user said previously. Make the conversation feel natural and flowing.';
      break;
    case 'personality_search_enhanced':
      systemPrompt += language === 'ar' 
        ? '\n\nاستخدم المعلومات المقدمة واربطها بسياق المحادثة السابقة إذا كان ذلك مناسباً.'
        : '\n\nUse the provided information and connect it to previous conversation context when appropriate.';
      break;
    case 'hyper_fast_openai_chat':
      systemPrompt = language === 'ar' 
        ? 'أنت Wakti AI. كن مفيداً ومختصراً.'
        : 'You are Wakti AI. Be helpful and concise.';
      break;
  }

  return systemPrompt;
};

// ENHANCED: Build conversation-aware messages
const buildConversationMessages = (
  userMessage: string, 
  context: string | null, 
  recentMessages: any[], 
  systemPrompt: string,
  interactionType: string
) => {
  const messages = [{ role: 'system', content: systemPrompt }];

  // ENHANCED: Add conversation context more intelligently
  if (context && interactionType.includes('enhanced')) {
    messages.push({
      role: 'system',
      content: `Context: ${context}`
    });
  } else if (context) {
    messages.push({
      role: 'system',
      content: `Information: ${context}`
    });
  }

  // ENHANCED: Include conversation history with better context awareness
  if (recentMessages && recentMessages.length > 0) {
    const conversationHistory = recentMessages.slice(-5).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: typeof msg.content === 'string' 
        ? (interactionType.includes('enhanced') ? msg.content : msg.content.substring(0, 200))
        : '[Message with attachment]'
    }));
    
    messages.push(...conversationHistory);
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
};

// ENHANCED: Main processing function with conversation awareness
export async function processWithBuddyChatAI(
  userMessage: string,
  context: string | null = null,
  language: string = 'en',
  recentMessages: any[] = [],
  conversationSummary: string = '',
  activeTrigger: string = 'chat',
  interactionType: string = 'personality_enhanced_conversation',
  attachedFiles: any[] = [],
  customSystemPrompt: string = '',
  maxTokens: number = 600
): Promise<string> {
  
  console.log(`⚡ ENHANCED CHAT: Processing ${interactionType} with ${maxTokens} tokens`);
  
  // Build enhanced system prompt
  const systemPrompt = getEnhancedSystemPrompt(interactionType, language, customSystemPrompt);
  console.log(`⚡ ENHANCED SYSTEM PROMPT: ${systemPrompt.substring(0, 100)}...`);
  console.log(`⚡ FULL SYSTEM PROMPT LENGTH: ${systemPrompt.length} characters`);
  
  // ENHANCED: Build context with conversation awareness
  let enhancedContext = context;
  if (conversationSummary && interactionType.includes('enhanced')) {
    enhancedContext = conversationSummary + (context ? `\n\nCurrent context: ${context}` : '');
    console.log(`⚡ ENHANCED CONTEXT: Combined summary and context (${enhancedContext.length} chars)`);
  }
  
  if (enhancedContext) {
    console.log(`⚡ CONTEXT INCLUDED: ${enhancedContext.length} characters`);
  }
  
  // Enhanced message history inclusion
  if (recentMessages && recentMessages.length > 0) {
    console.log(`⚡ CONTEXT MESSAGES: Including ${recentMessages.length} messages`);
    console.log(`⚡ SUMMARY CONTEXT: ${conversationSummary.length} characters`);
  }

  // Build conversation messages
  const messages = buildConversationMessages(
    userMessage,
    enhancedContext,
    recentMessages,
    systemPrompt,
    interactionType
  );

  try {
    let response;
    
    // ENHANCED: Choose AI provider based on interaction type
    if (OPENAI_API_KEY && (interactionType.includes('enhanced') || interactionType.includes('openai'))) {
      console.log(`⚡ ENHANCED: Using OpenAI for ${interactionType} with ${messages.length} messages`);
      
      // Enhanced temperature based on interaction type
      let temperature = 0.7;
      if (interactionType.includes('personality') || interactionType.includes('enhanced')) {
        temperature = 0.8;
      } else if (interactionType.includes('hyper_fast')) {
        temperature = 0.5;
      }
      
      console.log(`⚡ TEMPERATURE: ${temperature} for ${interactionType}`);
      
      response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        }),
      });
    } else {
      console.log(`⚡ ENHANCED: Using DeepSeek for ${interactionType} with ${messages.length} messages`);
      
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
          temperature: interactionType.includes('enhanced') ? 0.8 : 0.7,
          top_p: 0.9
        }),
      });
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log(`⚡ AI RESPONSE LENGTH: ${aiResponse.length} characters`);
    
    return aiResponse;
    
  } catch (error) {
    console.error('⚡ ENHANCED CHAT ERROR:', error);
    
    // Fallback response with conversation awareness
    const fallbackResponse = language === 'ar' 
      ? 'عذراً، حدث خطأ في المعالجة. يمكنك المحاولة مرة أخرى أو طرح سؤال آخر.'
      : 'Sorry, there was a processing error. You can try again or ask another question.';
    
    return fallbackResponse;
  }
}
