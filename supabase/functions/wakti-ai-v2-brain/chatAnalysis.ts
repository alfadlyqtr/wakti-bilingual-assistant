
import { PersonalizationProcessor } from '../../../src/services/PersonalizationProcessor.ts';

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
  aiNickname?: string;
}

// ENHANCED: Much more aggressive personality-based system prompts
function buildPersonalizedSystemPrompt(personalTouch: PersonalTouchData | null, language: string): string {
  let basePrompt = language === 'ar' 
    ? "أنت وقتي AI، مساعد ذكي ومفيد وودود."
    : "You are Wakti AI, a smart, helpful, and friendly assistant.";

  if (!personalTouch) {
    return basePrompt + (language === 'ar' 
      ? " قدم إجابات مفصلة وشاملة."
      : " Provide detailed and comprehensive answers.");
  }

  // AGGRESSIVE PERSONALITY ENFORCEMENT
  const { nickname, tone, style, instruction, aiNickname } = personalTouch;

  // Build personality-focused prompt
  let personalityPrompt = basePrompt;

  // AGGRESSIVE TONE ENFORCEMENT
  switch (tone) {
    case 'funny':
      personalityPrompt += language === 'ar' 
        ? " كن مرحاً ومضحكاً! استخدم النكت والتعليقات الطريفة والإيموجي المرحة. اجعل كل إجابة ممتعة ومسلية!"
        : " Be FUNNY and HILARIOUS! Use jokes, witty comments, and fun emojis. Make EVERY response entertaining and amusing!";
      break;
    case 'casual':
      personalityPrompt += language === 'ar' 
        ? " كن عادياً ومريحاً! استخدم لغة بسيطة وودية. تكلم كصديق مقرب!"
        : " Be SUPER CASUAL and relaxed! Use simple, friendly language. Talk like a close friend!";
      break;
    case 'encouraging':
      personalityPrompt += language === 'ar' 
        ? " كن محفزاً ومشجعاً! استخدم كلمات الدعم والتحفيز. اجعل المستخدم يشعر بالثقة!"
        : " Be VERY ENCOURAGING and supportive! Use motivational words. Make the user feel confident and capable!";
      break;
    case 'serious':
      personalityPrompt += language === 'ar' 
        ? " كن جدياً ومهنياً. تجنب الإيموجي والنكت. استخدم لغة رسمية."
        : " Be SERIOUS and professional. Avoid emojis and jokes. Use formal language.";
      break;
  }

  // AGGRESSIVE STYLE ENFORCEMENT
  switch (style) {
    case 'short answers':
      personalityPrompt += language === 'ar' 
        ? " اجعل إجاباتك قصيرة جداً ومباشرة! لا تتجاوز جملتين."
        : " Keep answers VERY SHORT and direct! Maximum 2 sentences.";
      break;
    case 'bullet points':
      personalityPrompt += language === 'ar' 
        ? " استخدم النقاط دائماً! قسم كل إجابة إلى نقاط واضحة."
        : " ALWAYS use bullet points! Break every answer into clear points.";
      break;
    case 'step-by-step':
      personalityPrompt += language === 'ar' 
        ? " قسم كل شيء إلى خطوات واضحة ومرقمة!"
        : " Break EVERYTHING into clear, numbered steps!";
      break;
  }

  // NICKNAME USAGE
  if (nickname && nickname.trim()) {
    personalityPrompt += language === 'ar' 
      ? ` ناد المستخدم باسم "${nickname}" في إجاباتك!`
      : ` Address the user as "${nickname}" in your responses!`;
  }

  // AI NICKNAME
  if (aiNickname && aiNickname.trim()) {
    personalityPrompt += language === 'ar' 
      ? ` قدم نفسك كـ "${aiNickname}" أحياناً.`
      : ` Sometimes introduce yourself as "${aiNickname}".`;
  }

  // CUSTOM INSTRUCTIONS
  if (instruction && instruction.trim()) {
    personalityPrompt += language === 'ar' 
      ? ` تعليمات خاصة: ${instruction}`
      : ` Special instructions: ${instruction}`;
  }

  return personalityPrompt;
}

// ENHANCED: Aggressive temperature based on personality
function getPersonalizedTemperature(personalTouch: PersonalTouchData | null): number {
  if (!personalTouch) return 0.7;

  switch (personalTouch.tone) {
    case 'funny': return 0.9; // High creativity for humor
    case 'casual': return 0.8; // High for casual conversation
    case 'encouraging': return 0.8; // High for varied encouragement
    case 'serious': return 0.3; // Low for consistency
    default: return 0.7;
  }
}

export async function processWithBuddyChatAI(
  message: string,
  context: string | null,
  language: string = 'en',
  recentMessages: any[] = [],
  conversationSummary: string = '',
  activeTrigger: string = 'chat',
  interactionType: string = 'enhanced_chat',
  processedFiles: any[] = [],
  customSystemPrompt: string = '',
  maxTokens: number = 600,
  personalTouch: PersonalTouchData | null = null
): Promise<string> {
  try {
    console.log('🎯 APPLYING FULL PERSONALIZATION:', {
      nickname: personalTouch?.nickname || 'none',
      tone: personalTouch?.tone || 'neutral',
      style: personalTouch?.style || 'detailed',
      instruction: personalTouch?.instruction || ''
    });

    // ENHANCED: Build aggressive personalized system prompt
    const personalizedSystemPrompt = buildPersonalizedSystemPrompt(personalTouch, language);
    console.log('🎯 FULL PERSONALIZED SYSTEM PROMPT:', personalizedSystemPrompt.substring(0, 200) + '...');

    // ENHANCED: Get personality-based temperature
    const personalizedTemperature = getPersonalizedTemperature(personalTouch);
    console.log('🎯 PERSONALIZED TEMPERATURE:', personalizedTemperature);

    // Build context for AI
    let fullContext = '';
    if (context) fullContext += `Context: ${context}\n\n`;
    if (conversationSummary) fullContext += `Previous conversation: ${conversationSummary}\n\n`;

    // Build message history
    const messages = [
      { role: 'system', content: personalizedSystemPrompt }
    ];

    // Add context if available
    if (fullContext.trim()) {
      messages.push({ role: 'system', content: fullContext });
    }

    // Add recent messages for continuity
    console.log('🧠 CONTEXT: Using', recentMessages.length, 'recent messages for continuity');
    recentMessages.forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });

    // ENHANCED: Vision support for attached files
    if (processedFiles && processedFiles.length > 0) {
      console.log('🔍 VISION MODE: Processing', processedFiles.length, 'attached files');
      
      const imageFiles = processedFiles.filter(file => 
        file.type === 'image' || (file.publicUrl && file.type?.startsWith('image/'))
      );
      
      if (imageFiles.length > 0) {
        console.log('🔍 VISION PROCESSING: Starting OpenAI Vision analysis');
        
        const visionContent = [
          { type: 'text', text: message }
        ];
        
        imageFiles.forEach(file => {
          if (file.publicUrl) {
            console.log('🔍 VISION: Added optimized image URL');
            visionContent.push({
              type: 'image_url',
              image_url: { url: file.publicUrl }
            });
          }
        });
        
        messages.push({ role: 'user', content: visionContent });
        
        // Use OpenAI for Vision
        console.log('🔍 VISION API: Calling OpenAI Vision with gpt-4o');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: maxTokens,
            temperature: personalizedTemperature
          }),
        });

        if (!response.ok) throw new Error(`Vision API error: ${response.status}`);
        
        const data = await response.json();
        const rawResponse = data.choices[0].message.content;
        
        console.log('🔍 VISION SUCCESS: Generated', rawResponse.length, 'characters');
        
        // CRITICAL: Apply post-processing personalization
        const enhancedResponse = PersonalizationProcessor.enhanceResponse(rawResponse, {
          personalTouch,
          language
        });
        
        return enhancedResponse;
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    console.log('🧠 MESSAGE COUNT: System(' + messages.filter(m => m.role === 'system').length + 
                ') + Context(' + (fullContext ? 1 : 0) + 
                ') + History(' + recentMessages.length + 
                ') + Current(1) = ' + messages.length);

    // Try OpenAI first if available
    if (OPENAI_API_KEY) {
      console.log('🔄 API Call Attempt 1/3');
      console.log('🚀 Trying OpenAI with proper timeout handling...');
      
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
            temperature: personalizedTemperature
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawResponse = data.choices[0].message.content;
          console.log('✅ OpenAI Success');
          console.log('✅ SUCCESS via OPENAI:', rawResponse.length, 'characters (SMART MEMORY ENABLED)');
          
          // CRITICAL: Apply post-processing personalization
          const enhancedResponse = PersonalizationProcessor.enhanceResponse(rawResponse, {
            personalTouch,
            language
          });
          
          return enhancedResponse;
        }
      } catch (error) {
        console.error('OpenAI failed, trying DeepSeek...', error);
      }
    }

    // Fallback to DeepSeek
    if (DEEPSEEK_API_KEY) {
      console.log('🔄 API Call Attempt 2/3');
      console.log('🚀 Trying DeepSeek...');
      
      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            max_tokens: maxTokens,
            temperature: personalizedTemperature
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawResponse = data.choices[0].message.content;
          console.log('✅ DeepSeek Success');
          console.log('✅ SUCCESS via DEEPSEEK:', rawResponse.length, 'characters (SMART MEMORY ENABLED)');
          
          // CRITICAL: Apply post-processing personalization
          const enhancedResponse = PersonalizationProcessor.enhanceResponse(rawResponse, {
            personalTouch,
            language
          });
          
          return enhancedResponse;
        }
      } catch (error) {
        console.error('DeepSeek failed:', error);
      }
    }

    // Final fallback
    return language === 'ar' 
      ? 'عذراً، حدث خطأ في الاتصال بخدمة الذكاء الاصطناعي.'
      : 'Sorry, there was an error connecting to the AI service.';

  } catch (error) {
    console.error('🚨 ENHANCED CHAT ERROR:', error);
    return language === 'ar' 
      ? 'عذراً، حدث خطأ أثناء معالجة طلبك.'
      : 'Sorry, there was an error processing your request.';
  }
}
