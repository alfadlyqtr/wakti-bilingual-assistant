
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

export async function processWithBuddyChatAI(
  message: string, 
  context: string | null, 
  language: string = 'en', 
  contextMessages: any[] = [],
  enhancedContext: string = '',
  activeTrigger: string = 'chat',
  interactionType: string = 'buddy_chat',
  attachedFiles: any[] = [],
  customSystemPrompt: string = '',
  maxTokens: number = 600
) {
  try {
    console.log(`⚡ ENHANCED CHAT: Processing ${interactionType} with ${maxTokens} tokens`);
    console.log(`⚡ SYSTEM PROMPT: ${customSystemPrompt.substring(0, 100)}...`);
    if (attachedFiles.length > 0) {
      console.log(`⚡ ENHANCED: Processing with ${attachedFiles.length} file(s)`);
    }
    
    // ENHANCED: Use OpenAI as primary for best personality support
    let apiKey = OPENAI_API_KEY;
    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    let model = 'gpt-4o-mini'; // Best balance of speed and capability
    let usingOpenAI = true;
    
    // Fallback to DeepSeek if OpenAI is not available
    if (!apiKey) {
      console.log("⚡ ENHANCED: OpenAI unavailable, falling back to DeepSeek");
      apiKey = DEEPSEEK_API_KEY;
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      model = 'deepseek-chat';
      usingOpenAI = false;
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    // ENHANCED: Use full system prompt for personality (NO TRUNCATION)
    const systemPrompt = customSystemPrompt || (language === 'ar' 
      ? `أنت WAKTI AI، مساعد ذكي ومفيد. كن ودوداً ومفيداً.`
      : `You are WAKTI AI, a smart and helpful assistant. Be friendly and helpful.`);
    
    console.log(`⚡ FULL SYSTEM PROMPT LENGTH: ${systemPrompt.length} characters`);
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    // ENHANCED: Smart context inclusion based on interaction type and personality
    const includeFullContext = !interactionType.includes('hyper_fast');
    const isPersonalityMode = interactionType.includes('personality');
    
    if (includeFullContext && context && context.length > 0) {
      const contextToInclude = isPersonalityMode ? context : context.substring(0, 800);
      messages.push({ 
        role: 'assistant', 
        content: `Context: ${contextToInclude}` 
      });
      console.log(`⚡ CONTEXT INCLUDED: ${contextToInclude.length} characters`);
    }
    
    // ENHANCED: Include more context messages for personality
    if (includeFullContext && contextMessages && contextMessages.length > 0) {
      const messagesToInclude = isPersonalityMode ? 
        contextMessages.slice(-3) : // More messages for personality
        contextMessages.slice(-1);
        
      console.log(`⚡ CONTEXT MESSAGES: Including ${messagesToInclude.length} messages`);
      
      messagesToInclude.forEach(recentMessage => {
        if (recentMessage) {
          let content = recentMessage.content;
          if (typeof content !== 'string') {
            if (Array.isArray(content) && content.length > 0) {
              const textPart = content.find(p => p.type === 'text');
              content = textPart ? textPart.text : '[attachment]';
            } else {
              content = '[attachment]';
            }
          }
          
          // Longer content for personality mode
          const maxContentLength = isPersonalityMode ? 300 : 200;
          messages.push({
            role: recentMessage.role,
            content: content.substring(0, maxContentLength)
          });
        }
      });
    }
    
    // Enhanced context from conversation summary
    if (includeFullContext && enhancedContext && enhancedContext.length > 0) {
      const summaryToInclude = isPersonalityMode ? enhancedContext : enhancedContext.substring(0, 400);
      messages.push({
        role: 'assistant',
        content: `Previous conversation summary: ${summaryToInclude}`
      });
      console.log(`⚡ SUMMARY CONTEXT: ${summaryToInclude.length} characters`);
    }
    
    // Construct user message content
    let userContent: any = message;
    
    // If there are files, build a multipart message for vision-capable models
    if (attachedFiles && attachedFiles.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: message }];

      attachedFiles.forEach(file => {
        if (file.type && file.type.startsWith('image/')) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${file.type};base64,${file.content}`
            }
          });
        }
      });
      
      userContent = contentParts;
    }

    messages.push({ role: 'user', content: userContent });
    
    console.log(`⚡ ENHANCED: Using ${usingOpenAI ? 'OpenAI' : 'DeepSeek'} for ${interactionType} with ${messages.length} messages`);
    
    // ENHANCED: Temperature based on interaction type and personality
    let temperature = 0.7; // Default balanced temperature
    
    if (interactionType.includes('personality')) {
      temperature = 0.8; // Higher creativity for personality
    } else if (interactionType.includes('hyper_fast')) {
      temperature = 0.3; // Lower for consistency in speed mode
    } else if (interactionType.includes('funny') || interactionType.includes('casual')) {
      temperature = 0.9; // Even higher for humor and casual conversation
    }
    
    console.log(`⚡ TEMPERATURE: ${temperature} for ${interactionType}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API failed: ${response.status}`, errorText);
      
      // If OpenAI fails, try DeepSeek as fallback
      if (usingOpenAI && DEEPSEEK_API_KEY) {
        console.log("⚡ ENHANCED: OpenAI failed, trying DeepSeek fallback");
        return processWithBuddyChatAI(
          message, context, language, contextMessages, enhancedContext,
          activeTrigger, interactionType, attachedFiles, customSystemPrompt, maxTokens
        );
      }
      
      throw new Error(`AI API failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    console.log(`⚡ AI RESPONSE LENGTH: ${aiResponse.length} characters`);
    return aiResponse;
    
  } catch (error) {
    console.error("⚡ ENHANCED CHAT: Processing error:", error);
    
    // ENHANCED: Better fallback responses with personality
    if (language === 'ar') {
      return `عذراً، مشكلة مؤقتة. سأعود قريباً بشخصيتي الكاملة! 😊`;
    } else {
      return `Sorry, temporary issue. I'll be back soon with my full personality! 😊`;
    }
  }
}
