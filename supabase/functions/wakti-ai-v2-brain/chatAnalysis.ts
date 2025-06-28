
/**
 * Enhanced chat analysis with full personality integration for Wakti Edge Function
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

// ENHANCED: Build personalized conversation messages with natural follow-up integration
const buildPersonalizedMessages = (
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
      content: `Previous conversation context: ${context}`
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
        ? msg.content
        : '[Message with attachment]'
    }));
    
    messages.push(...conversationHistory);
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
};

// ENHANCED: Main processing function with integrated personal conversation flow
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
  maxTokens: number = 500
): Promise<string> {
  
  console.log(`⚡ PERSONAL CHAT: Processing with personalization - ${interactionType} (${maxTokens} tokens)`);
  
  // ENHANCED: Use custom system prompt for personalization
  let systemPrompt = customSystemPrompt;
  if (!systemPrompt) {
    systemPrompt = language === 'ar' 
      ? 'أنت Wakti AI، مساعد ذكي ومفيد وودود. كن متفاعلاً وشخصياً في المحادثة.'
      : 'You are Wakti AI, a smart, helpful, and friendly assistant. Be interactive and personal in conversation.';
  }

  // ENHANCED: Add natural conversation flow instructions
  systemPrompt += language === 'ar'
    ? '\n\nاجعل المحادثة طبيعية ومتدفقة. إذا كان لديك سؤال متابعة، أدرجه في نهاية ردك بشكل طبيعي.'
    : '\n\nMake conversation natural and flowing. If you have a follow-up question, include it naturally at the end of your response.';
  
  console.log(`⚡ PERSONALIZED SYSTEM PROMPT: ${systemPrompt.substring(0, 100)}...`);
  
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
  const messages = buildPersonalizedMessages(
    userMessage,
    enhancedContext,
    recentMessages,
    systemPrompt,
    interactionType
  );

  try {
    let response;
    
    // ENHANCED: Choose AI provider based on interaction type - prioritize OpenAI for personality
    if (OPENAI_API_KEY) {
      console.log(`⚡ PERSONAL: Using OpenAI for personalized conversation with ${messages.length} messages`);
      
      // Enhanced temperature for more personality
      let temperature = 0.8; // Higher for more personality
      if (interactionType.includes('hyper_fast')) {
        temperature = 0.6;
      }
      
      console.log(`⚡ TEMPERATURE: ${temperature} for personalized conversation`);
      
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
          presence_penalty: 0.2 // Higher for more conversational variety
        }),
      });
    } else {
      console.log(`⚡ PERSONAL: Using DeepSeek for personalized conversation with ${messages.length} messages`);
      
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
          temperature: 0.8,
          top_p: 0.9
        }),
      });
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log(`⚡ PERSONAL AI RESPONSE LENGTH: ${aiResponse.length} characters`);
    
    return aiResponse;
    
  } catch (error) {
    console.error('⚡ PERSONAL CHAT ERROR:', error);
    
    // Fallback response with personalization
    const fallbackResponse = language === 'ar' 
      ? 'عذراً، حدث خطأ مؤقت. يمكنك المحاولة مرة أخرى أو طرح سؤال آخر.'
      : 'Sorry, there was a temporary error. You can try again or ask another question.';
    
    return fallbackResponse;
  }
}
