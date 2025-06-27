
/**
 * Hyper-optimized Buddy Chat, Mode Analysis, and AI processing for Wakti Edge Function
 */
import { DEEPSEEK_API_KEY, OPENAI_API_KEY } from "./utils.ts";

export function analyzeBuddyChatIntent(message: string, activeTrigger: string, enhancedContext: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // SPEED-OPTIMIZED: Reduced pattern matching for faster processing
  const quickPatterns = {
    greeting: ['hi', 'hello', 'hey', 'مرحبا', 'أهلا'],
    question: ['what', 'how', 'when', 'ما', 'كيف', 'متى', '?'],
    thanks: ['thanks', 'thank', 'شكرا']
  };
  
  let intent = 'general_chat';
  let confidence = 'medium';
  
  // Quick intent detection
  for (const [intentType, patterns] of Object.entries(quickPatterns)) {
    if (patterns.some(pattern => lowerMessage.includes(pattern))) {
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
  
  // SPEED-OPTIMIZED: Simplified mode detection
  const quickModePatterns = {
    search: ['weather', 'news', 'price', 'طقس', 'أخبار'],
    image: ['create image', 'draw', 'أنشئ صورة', 'ارسم'],
    chat: ['chat', 'talk', 'تحدث']
  };
  
  let suggestMode = null;
  let allowInMode = true;
  
  // Quick mode suggestion for chat
  if (activeTrigger === 'chat') {
    for (const [mode, patterns] of Object.entries(quickModePatterns)) {
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
    console.log(`⚡ HYPER-OPTIMIZED BUDDY-CHAT: Processing with ${maxTokens} tokens limit`);
    if (attachedFiles.length > 0) {
      console.log(`⚡ HYPER-OPTIMIZED: Processing with ${attachedFiles.length} file(s)`);
    }
    
    // HYPER-OPTIMIZED: Use OpenAI as primary for fastest responses (1-3s vs 9-10s)
    let apiKey = OPENAI_API_KEY;
    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    let model = 'gpt-4o-mini'; // Fastest model with vision support
    let usingOpenAI = true;
    
    // Fallback to DeepSeek if OpenAI is not available
    if (!apiKey) {
      console.log("⚡ HYPER-OPTIMIZED: OpenAI unavailable, falling back to DeepSeek");
      apiKey = DEEPSEEK_API_KEY;
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      model = 'deepseek-chat';
      usingOpenAI = false;
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    // HYPER-OPTIMIZED: Use custom system prompt or ultra-minimal default
    const systemPrompt = customSystemPrompt || (language === 'ar' 
      ? `أنت WAKTI. كن مختصراً.`
      : `You are WAKTI. Be concise.`);
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    // HYPER-OPTIMIZED: Skip context for hyper-fast modes
    const isHyperFast = interactionType.includes('hyper_fast');
    
    if (!isHyperFast && context && context.length < 150) { // Only add very short context
      messages.push({ 
        role: 'assistant', 
        content: `Context: ${context.substring(0, 100)}` 
      });
    }
    
    // HYPER-OPTIMIZED: Skip context messages for hyper-fast modes
    if (!isHyperFast && contextMessages && contextMessages.length > 0) {
      const recentMessage = contextMessages.slice(-1)[0]; // Only last message
      if (recentMessage) {
        let content = recentMessage.content;
        if (typeof content !== 'string') {
          if (Array.isArray(content) && content.length > 0) {
            const textPart = content.find(p => p.type === 'text');
            content = textPart ? textPart.text.substring(0, 50) : '[attachment]'; // Further reduced
          } else {
            content = '[attachment]';
          }
        }
        messages.push({
          role: recentMessage.role,
          content: content.substring(0, 100) // Limit all content
        });
      }
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
    
    console.log(`⚡ HYPER-OPTIMIZED: Using ${usingOpenAI ? 'OpenAI (fastest)' : 'DeepSeek (fallback)'}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: isHyperFast ? 0.3 : 0.7, // Lower temperature for speed
        max_tokens: maxTokens // Use dynamic token limit
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API failed: ${response.status}`, errorText);
      
      // If OpenAI fails, try DeepSeek as fallback
      if (usingOpenAI && DEEPSEEK_API_KEY) {
        console.log("⚡ HYPER-OPTIMIZED: OpenAI failed, trying DeepSeek fallback");
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
    console.error("⚡ HYPER-OPTIMIZED BUDDY-CHAT: Processing error:", error);
    
    // HYPER-OPTIMIZED: Shorter fallback responses
    return language === 'ar' 
      ? `عذراً، مشكلة مؤقتة. 😊`
      : `Sorry, temporary issue. 😊`;
  }
}
