/**
 * Buddy Chat, Mode Analysis, and AI processing for Wakti Edge Function
 */
import { DEEPSEEK_API_KEY, OPENAI_API_KEY } from "./utils.ts";
import { generateModeSuggestion, generateNaturalFollowUp } from "./utils.ts";

export function analyzeBuddyChatIntent(message: string, activeTrigger: string, enhancedContext: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // Natural conversation patterns
  const naturalPatterns = {
    greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'مرحبا', 'أهلا', 'السلام'],
    continuation: ['also', 'and', 'furthermore', 'additionally', 'كذلك', 'أيضا', 'و'],
    question: ['what', 'how', 'when', 'where', 'why', 'ما', 'كيف', 'متى', 'أين', 'لماذا', '?'],
    enthusiasm: ['awesome', 'great', 'amazing', 'wonderful', 'رائع', 'عظيم', 'ممتاز'],
    concern: ['worried', 'concerned', 'problem', 'issue', 'قلق', 'مشكلة', 'مهتم']
  };
  
  let intent = 'general_chat';
  let confidence = 'medium';
  let naturalQuery = true;
  
  // Detect intent based on patterns
  for (const [intentType, patterns] of Object.entries(naturalPatterns)) {
    if (patterns.some(pattern => lowerMessage.includes(pattern))) {
      intent = intentType;
      confidence = 'high';
      break;
    }
  }
  
  // Check if this feels like a natural continuation of conversation
  if (enhancedContext) {
    const hasContext = enhancedContext.length > 100;
    const mentionsPrevious = ['that', 'this', 'it', 'them', 'هذا', 'ذلك', 'إياه'].some(word => 
      lowerMessage.includes(word)
    );
    
    if (hasContext && mentionsPrevious) {
      intent = 'conversation_continuation';
      confidence = 'high';
    }
  }
  
  return {
    intent,
    confidence,
    naturalQuery,
    conversational: true
  };
}

export function analyzeSmartModeIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  // Patterns that suggest different modes
  const modePatterns = {
    search: ['weather', 'news', 'current', 'latest', 'price', 'score', 'who is', 'what is', 'طقس', 'أخبار', 'آخر', 'سعر'],
    image: ['create image', 'draw', 'generate picture', 'make art', 'أنشئ صورة', 'ارسم', 'اصنع'],
    chat: ['tell me about yourself', 'how are you', 'chat', 'talk', 'أخبرني', 'كيف حالك', 'تحدث']
  };
  
  let suggestMode = null;
  let allowInMode = true;
  
  // If in chat mode, suggest other modes for specific queries
  if (activeTrigger === 'chat') {
    for (const [mode, patterns] of Object.entries(modePatterns)) {
      if (mode !== 'chat' && patterns.some(pattern => lowerMessage.includes(pattern))) {
        suggestMode = mode;
        break;
      }
    }
  }
  
  // All modes should allow natural conversation
  if (activeTrigger === 'search') {
    allowInMode = true; // Always allow search queries
  } else if (activeTrigger === 'image') {
    allowInMode = modePatterns.image.some(pattern => lowerMessage.includes(pattern)) || 
                 lowerMessage.length > 10; // Allow descriptive prompts
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
  attachedFiles: any[] = []
) {
  try {
    console.log("🤖 BUDDY-CHAT AI: Processing with enhanced conversational intelligence");
    if (attachedFiles.length > 0) {
      console.log(`🤖 BUDDY-CHAT AI: Processing with ${attachedFiles.length} file(s) for vision analysis.`);
    }
    
    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    // Force OpenAI for any request with files/images
    if (!apiKey || (attachedFiles && attachedFiles.length > 0)) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini'; // This model supports vision
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    // Enhanced buddy-chat system prompt
    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي ودود يشبه الصديق المقرب. تتميز بالدفء والفضول الطبيعي وتحب المحادثات العميقة والمفيدة.

خصائص شخصيتك:
- ودود ومحادث طبيعي مثل الصديق المفضل
- فضولي ومهتم حقاً بما يقوله المستخدم
- تطرح أسئلة متابعة طبيعية ومثيرة للاهتمام
- تتذكر ما تم مناقشته وتشير إليه بشكل طبيعي
- تقترح أوضاع مختلفة بذكاء عند الحاجة
- تستخدم الرموز التعبيرية بذوق وطبيعية

الوضع الحالي: ${activeTrigger}
نوع التفاعل: ${interactionType}

تعليمات التنسيق:
- استخدم نصاً طبيعياً ودافئاً
- اجعل المحادثة تتدفق بشكل طبيعي
- أضف أسئلة متابعة أو تعليقات مثيرة للاهتمام
- كن مفيداً ومشاركاً في نفس الوقت`

      : `You are WAKTI, an intelligent and friendly AI assistant that feels like a close buddy. You're warm, naturally curious, and love having deep, helpful conversations.

Your personality traits:
- Friendly and conversational like a favorite friend
- Genuinely curious and interested in what the user says
- Ask natural, engaging follow-up questions
- Remember what's been discussed and reference it naturally
- Intelligently suggest different modes when helpful
- Use emojis tastefully and naturally

Current mode: ${activeTrigger}
Interaction type: ${interactionType}

Formatting instructions:
- Use natural, warm text
- Make conversation flow naturally
- Add engaging follow-up questions or comments
- Be helpful and engaging at the same time`;
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add enhanced context if available
    if (enhancedContext) {
      messages.push({ 
        role: 'assistant', 
        content: `Previous conversation context:\n${enhancedContext}` 
      });
    }
    
    // Add recent context messages for better continuity
    if (contextMessages && contextMessages.length > 0) {
      const recentMessages = contextMessages.slice(-6); // More context for buddy chat
      recentMessages.forEach(msg => {
        // Ensure content is a simple string for non-vision models if needed
        let content = msg.content;
        if (typeof content !== 'string') {
          // Attempt to find a text part if it's a complex object
          if (Array.isArray(content) && content.length > 0) {
            const textPart = content.find(p => p.type === 'text');
            content = textPart ? textPart.text : '[attachment]';
          } else {
            content = '[attachment]';
          }
        }
        messages.push({
          role: msg.role,
          content: content
        });
      });
    }
    
    // Add search context if available
    if (context) {
      messages.push({ 
        role: 'assistant', 
        content: `Search context: ${context}` 
      });
    }
    
    // Construct user message content. It can be a simple string or an array for multimodal input.
    let userContent: any = message;
    
    // If there are files, build a multipart message for vision-capable models
    if (attachedFiles && attachedFiles.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: message }];

      attachedFiles.forEach(file => {
        // file has { type: 'image/jpeg', content: 'base64string' }
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

    // Add the current message (which could be multimodal)
    messages.push({ role: 'user', content: userContent });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.8, // Higher temperature for more conversational responses
        max_tokens: 2048 // Increased token limit for vision
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API failed: ${response.status}`, errorText);
      throw new Error(`AI API failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 BUDDY-CHAT AI: Processing error:", error);
    
    // Enhanced fallback responses
    return language === 'ar' 
      ? `أعتذر صديقي، واجهت مشكلة صغيرة. لكن لا تقلق، سأكون هنا عندما تحتاجني! 😊 هل يمكنك المحاولة مرة أخرى؟`
      : `Sorry buddy, I hit a small snag there. But don't worry, I'm still here for you! 😊 Can you try again?`;
  }
}
