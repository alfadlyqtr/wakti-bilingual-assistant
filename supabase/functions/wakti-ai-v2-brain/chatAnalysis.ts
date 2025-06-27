
/**
 * Enhanced chat analysis with personality restoration for Wakti Edge Function
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

    // ENHANCED: Use full system prompt for personality
    const systemPrompt = customSystemPrompt || (language === 'ar' 
      ? `أنت WAKTI AI، مساعد ذكي ومفيد. كن ودوداً ومفيداً.`
      : `You are WAKTI AI, a smart and helpful assistant. Be friendly and helpful.`);
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    // ENHANCED: Smart context inclusion based on interaction type
    const includeFullContext = !interactionType.includes('hyper_fast');
    
    if (includeFullContext && context && context.length > 0) {
      messages.push({ 
        role: 'assistant', 
        content: `Context: ${context}` 
      });
    }
    
    // ENHANCED: Include more context messages for personality
    if (includeFullContext && contextMessages && contextMessages.length > 0) {
      const messagesToInclude = interactionType.includes('personality') ? 
        contextMessages.slice(-2) : contextMessages.slice(-1);
        
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
          messages.push({
            role: recentMessage.role,
            content: content.substring(0, 200) // More content for personality
          });
        }
      });
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
    
    console.log(`⚡ ENHANCED: Using ${usingOpenAI ? 'OpenAI' : 'DeepSeek'} for ${interactionType}`);
    
    // ENHANCED: Temperature based on interaction type
    const temperature = interactionType.includes('personality') ? 0.8 : 
                       interactionType.includes('hyper_fast') ? 0.3 : 0.7;
    
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
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("⚡ ENHANCED CHAT: Processing error:", error);
    
    // ENHANCED: Better fallback responses with some personality
    if (language === 'ar') {
      return `عذراً، مشكلة مؤقتة. سأعود قريباً! 😊`;
    } else {
      return `Sorry, temporary issue. I'll be back soon! 😊`;
    }
  }
}
