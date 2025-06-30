
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
  aiNickname?: string;
}

// ENHANCED: Vision-specific prompt templates for different image types
const VISION_PROMPT_TEMPLATES = {
  receipt: 'Extract all visible text and summarize vendor, total, and date.',
  screenshot: 'Analyze the UI. What app is this? What is happening?',
  document: 'Summarize the content of this document, including headings and details.',
  selfie: 'Describe the person, their expression, clothing, and background.',
  scene: 'Describe this image in detail. Mention people, objects, text, and what\'s happening.'
};

// ENHANCED: Detect image type from user message context
function detectImageType(userMessage: string): keyof typeof VISION_PROMPT_TEMPLATES {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('receipt') || lowerMessage.includes('bill') || lowerMessage.includes('invoice')) {
    return 'receipt';
  }
  if (lowerMessage.includes('screenshot') || lowerMessage.includes('screen') || lowerMessage.includes('app')) {
    return 'screenshot';
  }
  if (lowerMessage.includes('document') || lowerMessage.includes('paper') || lowerMessage.includes('text')) {
    return 'document';
  }
  if (lowerMessage.includes('selfie') || lowerMessage.includes('photo of me') || lowerMessage.includes('picture of me')) {
    return 'selfie';
  }
  
  // Default to 'scene' for general image analysis
  return 'scene';
}

// ENHANCED: Build vision-enhanced user message with appropriate template
function buildVisionMessage(userMessage: string, imageType: keyof typeof VISION_PROMPT_TEMPLATES): string {
  const template = VISION_PROMPT_TEMPLATES[imageType];
  
  // If user provided a meaningful prompt, append template
  if (userMessage && userMessage.trim().length > 5) {
    return `${userMessage}\n\n${template}`;
  }
  
  // If user typed nothing or just generic text, use only the template
  return template;
}

// ENHANCED: PersonalizationProcessor logic moved directly into edge function
class PersonalizationProcessor {
  /**
   * ENHANCED: Main post-processing function with AGGRESSIVE personalization enforcement
   */
  static enhanceResponse(
    originalResponse: string,
    options: { personalTouch: PersonalTouchData | null; language: string; }
  ): string {
    if (!options.personalTouch) {
      return originalResponse;
    }

    console.log('🎨 PERSONALIZATION PROCESSOR: Starting AGGRESSIVE enhancement and enforcement');

    // STEP 1: Apply AGGRESSIVE enforcement to ensure response matches user preferences
    const enforcedResponse = PersonalizationEnforcer.enforcePersonalization(
      originalResponse,
      {
        personalTouch: options.personalTouch,
        language: options.language,
        originalResponse
      }
    );

    // STEP 2: Apply additional AGGRESSIVE enhancements
    let enhancedResponse = enforcedResponse;

    // AGGRESSIVE: Apply custom instructions if provided
    if (options.personalTouch.instruction && options.personalTouch.instruction.trim()) {
      enhancedResponse = this.applyCustomInstructions(
        enhancedResponse,
        options.personalTouch.instruction,
        options.language
      );
      console.log('📝 CUSTOM INSTRUCTION: AGGRESSIVELY applied user custom instruction');
    }

    // AGGRESSIVE: Final personality double-check
    enhancedResponse = this.finalPersonalityCheck(
      enhancedResponse,
      options.personalTouch,
      options.language
    );

    console.log('✅ PERSONALIZATION PROCESSOR: AGGRESSIVELY completed', {
      originalLength: originalResponse.length,
      finalLength: enhancedResponse.length,
      enforcementApplied: enforcedResponse !== originalResponse,
      majorChanges: enhancedResponse.length > originalResponse.length * 1.2
    });

    return enhancedResponse;
  }

  /**
   * AGGRESSIVE: Apply custom instructions to the response
   */
  private static applyCustomInstructions(
    response: string,
    instruction: string,
    language: string
  ): string {
    // If instruction mentions "steps" or "break down", enforce step format
    if (instruction.toLowerCase().includes('step') || instruction.toLowerCase().includes('break')) {
      const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length > 1) {
        const stepPrefix = language === 'ar' ? 'خطوة' : 'Step';
        return sentences.map((step, index) => 
          `${stepPrefix} ${index + 1}: ${step.trim()}`
        ).join('\n\n');
      }
    }

    // If instruction mentions "simple" or "baby steps", make it simpler
    if (instruction.toLowerCase().includes('simple') || instruction.toLowerCase().includes('baby')) {
      return response.replace(/\b\w{8,}\b/g, (word) => {
        // Replace complex words with simpler alternatives
        const simpleReplacements: { [key: string]: string } = {
          'complicated': 'hard',
          'sophisticated': 'smart',
          'implementation': 'setup',
          'configuration': 'setting',
          'optimization': 'making better'
        };
        return simpleReplacements[word.toLowerCase()] || word;
      });
    }

    return response;
  }

  /**
   * AGGRESSIVE: Final personality enforcement check
   */
  private static finalPersonalityCheck(
    response: string,
    personalTouch: PersonalTouchData,
    language: string
  ): string {
    let finalResponse = response;

    // AGGRESSIVE TONE CHECK
    switch (personalTouch.tone) {
      case 'funny':
        if (!/[😄😆🤪🎉😊🙃]|haha|ههه|funny|joke|lol/i.test(finalResponse)) {
          const funnyAddition = language === 'ar' 
            ? ' 😄 هههه، هذا ممتع!'
            : ' 😄 Haha, this is fun!';
          finalResponse += funnyAddition;
        }
        break;

      case 'casual':
        if (!/[😊👍✨💫🙂]|awesome|cool|nice|يلا|طيب|حلو/i.test(finalResponse)) {
          const casualAddition = language === 'ar' 
            ? ' 😊 يلا، هيك أحسن!'
            : ' 😊 Awesome, that\'s better!';
          finalResponse += casualAddition;
        }
        break;

      case 'encouraging':
        if (!/[💪🌟✨🚀👏🎯]|you got|amazing|great|excellent|تستطيع|رائع|ممتاز|عظيم/i.test(finalResponse)) {
          const encouragingAddition = language === 'ar' 
            ? ' 💪 أنت تستطيع فعل هذا! رائع!'
            : ' 💪 You got this! Amazing work!';
          finalResponse += encouragingAddition;
        }
        break;
    }

    // AGGRESSIVE NICKNAME CHECK
    if (personalTouch.nickname && personalTouch.nickname.trim() && finalResponse.length > 100) {
      if (!finalResponse.toLowerCase().includes(personalTouch.nickname.toLowerCase())) {
        // 70% chance to add nickname for longer responses
        if (Math.random() < 0.7) {
          const greetings = language === 'ar' ? [
            `${personalTouch.nickname}، `,
            `أهلاً ${personalTouch.nickname}! `,
            `استمع ${personalTouch.nickname}، `
          ] : [
            `${personalTouch.nickname}, `,
            `Hey ${personalTouch.nickname}! `,
            `Listen ${personalTouch.nickname}, `
          ];
          const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
          finalResponse = randomGreeting + finalResponse;
        }
      }
    }

    return finalResponse;
  }
}

// ENHANCED: PersonalizationEnforcer logic moved directly into edge function
class PersonalizationEnforcer {
  /**
   * ENHANCED: Main enforcement function with AGGRESSIVE personalization
   */
  static enforcePersonalization(
    originalResponse: string,
    options: { personalTouch: PersonalTouchData | null; language: string; originalResponse: string; }
  ): string {
    if (!options.personalTouch) {
      return originalResponse;
    }

    let enforcedResponse = originalResponse;
    const { personalTouch, language } = options;

    console.log('🎯 PERSONALIZATION ENFORCER: Starting AGGRESSIVE enforcement', {
      tone: personalTouch.tone,
      style: personalTouch.style,
      originalLength: originalResponse.length
    });

    // 1. AGGRESSIVE: Enforce style preferences (length, format)
    enforcedResponse = this.enforceStylePreferences(
      enforcedResponse,
      personalTouch.style,
      language
    );

    // 2. AGGRESSIVE: Enforce tone consistency
    enforcedResponse = this.enforceToneConsistency(
      enforcedResponse,
      personalTouch.tone,
      language
    );

    // 3. AGGRESSIVE: Add nickname usage
    enforcedResponse = this.enforceNicknameUsage(
      enforcedResponse,
      personalTouch.nickname,
      language
    );

    // 4. AGGRESSIVE: Add AI nickname signature
    enforcedResponse = this.enforceAINickname(
      enforcedResponse,
      personalTouch.aiNickname,
      language
    );

    console.log('✅ PERSONALIZATION ENFORCER: AGGRESSIVELY completed', {
      originalLength: originalResponse.length,
      enforcedLength: enforcedResponse.length,
      changesApplied: enforcedResponse !== originalResponse
    });

    return enforcedResponse;
  }

  /**
   * AGGRESSIVE: Enforce style preferences (short answers, bullet points, etc.)
   */
  private static enforceStylePreferences(
    response: string,
    style: string,
    language: string
  ): string {
    switch (style) {
      case 'short answers':
        return this.enforceShortAnswers(response, language);
      case 'bullet points':
        return this.enforceBulletPoints(response, language);
      case 'step-by-step':
        return this.enforceStepByStep(response, language);
      case 'detailed':
        // Detailed responses are kept as-is
        return response;
      default:
        return response;
    }
  }

  /**
   * AGGRESSIVE: Enforce short answer preference
   */
  private static enforceShortAnswers(response: string, language: string): string {
    // If response is already short (< 100 chars), keep it
    if (response.length <= 100) {
      return response;
    }

    // AGGRESSIVE: Split into sentences and keep ONLY the first one for ultra-short
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return response;

    // Take ONLY first sentence and ensure it's under 100 chars
    let shortResponse = sentences[0].trim();
    if (shortResponse.length > 100) {
      shortResponse = shortResponse.substring(0, 97) + '...';
    }
    
    return shortResponse + (shortResponse.endsWith('.') ? '' : '.');
  }

  /**
   * AGGRESSIVE: Enforce bullet points format
   */
  private static enforceBulletPoints(response: string, language: string): string {
    // If already has bullet points, keep it
    if (response.includes('•') || response.includes('-') || response.includes('*')) {
      return response;
    }

    // AGGRESSIVE: Split by ANY punctuation and create bullets
    const parts = response.split(/[.!?;,]+|and|or|also|في|و|أيضاً/).filter(s => s.trim().length > 5);
    
    if (parts.length <= 1) {
      return response;
    }

    const bulletChar = '•';
    return parts.map(part => `${bulletChar} ${part.trim()}`).join('\n');
  }

  /**
   * AGGRESSIVE: Enforce step-by-step format
   */
  private static enforceStepByStep(response: string, language: string): string {
    // If already has step numbers, keep it
    if (/\d+\.\s/.test(response) || response.includes('Step') || response.includes('خطوة')) {
      return response;
    }

    // AGGRESSIVE: Split by sentences and create numbered steps
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 5);
    
    if (sentences.length <= 1) {
      return response;
    }

    const stepPrefix = language === 'ar' ? 'خطوة' : 'Step';
    return sentences.map((step, index) => 
      `${stepPrefix} ${index + 1}: ${step.trim()}`
    ).join('\n\n');
  }

  /**
   * AGGRESSIVE: Enforce tone consistency
   */
  private static enforceToneConsistency(
    response: string,
    tone: string,
    language: string
  ): string {
    switch (tone) {
      case 'funny':
        return this.enforceFunnyTone(response, language);
      case 'casual':
        return this.enforceCasualTone(response, language);
      case 'encouraging':
        return this.enforceEncouragingTone(response, language);
      case 'serious':
        return this.enforceSeriousTone(response, language);
      default:
        return response;
    }
  }

  /**
   * AGGRESSIVE: Enforce funny tone
   */
  private static enforceFunnyTone(response: string, language: string): string {
    // Check if response already has funny elements
    const hasFunnyElements = /[😄😆🤪🎉😊🙃]|haha|ههه|funny|joke|lol/i.test(response);
    
    if (hasFunnyElements) {
      return response;
    }

    // AGGRESSIVE: Add multiple funny elements
    const funnyAdditions = language === 'ar' ? [
      ' 😄 هههه، هذا مضحك!',
      ' 🤪 يلا نضحك شوي!',
      ' 😆 حلو، أنا بحب النكت!',
      ' 🎉 هاي نكتة حلوة، مش كده؟'
    ] : [
      ' 😄 Haha, that\'s hilarious!',
      ' 🤪 Let\'s have some fun!',
      ' 😆 LOL, I love jokes!',
      ' 🎉 That\'s a good one, right?'
    ];

    const randomAddition = funnyAdditions[Math.floor(Math.random() * funnyAdditions.length)];
    return response + randomAddition;
  }

  /**
   * AGGRESSIVE: Enforce casual tone
   */
  private static enforceCasualTone(response: string, language: string): string {
    // Check if response is already casual
    const hasCasualElements = /[😊👍✨💫🙂]|awesome|cool|nice|يلا|طيب|حلو/i.test(response);
    
    if (hasCasualElements) {
      return response;
    }

    // AGGRESSIVE: Add casual elements and modify formal words
    let casualResponse = response
      .replace(/\bHowever\b/g, 'But')
      .replace(/\bTherefore\b/g, 'So')
      .replace(/\bNevertheless\b/g, 'Still')
      .replace(/\bFurthermore\b/g, 'Also');

    const casualAdditions = language === 'ar' ? [
      ' 😊 يلا، هيك أحسن!',
      ' 👍 طيب كده!',
      ' ✨ حلو أوي!',
      ' 🙂 بسيط جداً!'
    ] : [
      ' 😊 Cool, that\'s better!',
      ' 👍 Awesome stuff!',
      ' ✨ Pretty neat!',
      ' 🙂 Super simple!'
    ];

    const randomAddition = casualAdditions[Math.floor(Math.random() * casualAdditions.length)];
    return casualResponse + randomAddition;
  }

  /**
   * AGGRESSIVE: Enforce encouraging tone
   */
  private static enforceEncouragingTone(response: string, language: string): string {
    const hasEncouragingElements = /[💪🌟✨🚀👏🎯]|you got|amazing|great|excellent|تستطيع|رائع|ممتاز|عظيم/i.test(response);
    
    if (hasEncouragingElements) {
      return response;
    }

    // AGGRESSIVE: Add encouraging words throughout
    let encouragingResponse = response
      .replace(/\bcan\b/gi, 'can totally')
      .replace(/\bwill\b/gi, 'will definitely')
      .replace(/يمكن/g, 'بالتأكيد يمكن')
      .replace(/سوف/g, 'سوف بالتأكيد');

    const encouragingAdditions = language === 'ar' ? [
      ' 💪 أنت تستطيع فعل هذا! رائع!',
      ' 🌟 ممتاز! استمر هكذا!',
      ' 🚀 عظيم! أنت في الطريق الصحيح!',
      ' 👏 برافو! هذا إنجاز رائع!'
    ] : [
      ' 💪 You totally got this! Amazing!',
      ' 🌟 Excellent! Keep it up!',
      ' 🚀 Great job! You\'re on the right track!',
      ' 👏 Bravo! That\'s fantastic progress!'
    ];

    const randomAddition = encouragingAdditions[Math.floor(Math.random() * encouragingAdditions.length)];
    return encouragingResponse + randomAddition;
  }

  /**
   * AGGRESSIVE: Enforce serious tone
   */
  private static enforceSeriousTone(response: string, language: string): string {
    // AGGRESSIVE: Remove ALL casual elements and emojis
    let seriousResponse = response
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/!+/g, '.') // Replace ALL exclamations
      .replace(/\bhaha\b/gi, '')
      .replace(/\blol\b/gi, '')
      .replace(/ههه/g, '')
      .replace(/\s+/g, ' ') // Clean up spacing
      .trim();
    
    // AGGRESSIVE: Make language more formal
    seriousResponse = seriousResponse
      .replace(/\bawesome\b/gi, 'excellent')
      .replace(/\bcool\b/gi, 'good')
      .replace(/\bnice\b/gi, 'satisfactory')
      .replace(/يلا/g, '')
      .replace(/حلو/g, 'جيد')
      .replace(/طيب/g, 'حسناً');
    
    return seriousResponse;
  }

  /**
   * AGGRESSIVE: Enforce nickname usage
   */
  private static enforceNicknameUsage(
    response: string,
    nickname: string,
    language: string
  ): string {
    if (!nickname || nickname.trim().length === 0) {
      return response;
    }

    // Don't add nickname if response is very short or already contains it
    if (response.length < 30 || response.toLowerCase().includes(nickname.toLowerCase())) {
      return response;
    }

    const greetingPhrases = language === 'ar' ? [
      `${nickname}، `,
      `أهلاً ${nickname}! `,
      `استمع ${nickname}، `,
      `${nickname} العزيز، `
    ] : [
      `${nickname}, `,
      `Hey ${nickname}! `,
      `Listen ${nickname}, `,
      `Dear ${nickname}, `
    ];

    // AGGRESSIVE: 60% chance to add nickname
    if (Math.random() < 0.6) {
      const randomGreeting = greetingPhrases[Math.floor(Math.random() * greetingPhrases.length)];
      return randomGreeting + response;
    }

    return response;
  }

  /**
   * AGGRESSIVE: Enforce AI nickname signature
   */
  private static enforceAINickname(
    response: string,
    aiNickname: string | undefined,
    language: string
  ): string {
    if (!aiNickname || aiNickname.trim().length === 0) {
      return response;
    }

    // Check if signature already exists
    if (response.includes(aiNickname)) {
      return response;
    }

    const signatures = language === 'ar' ? [
      `\n\n- ${aiNickname} 🤖`,
      `\n\n~ ${aiNickname} ✨`,
      `\n\n— ${aiNickname} 💫`,
      `\n\n🤖 ${aiNickname}`
    ] : [
      `\n\n- ${aiNickname} 🤖`,
      `\n\n~ ${aiNickname} ✨`,
      `\n\n— ${aiNickname} 💫`,
      `\n\n🤖 ${aiNickname}`
    ];

    // AGGRESSIVE: 40% chance to add signature
    if (Math.random() < 0.4) {
      const randomSignature = signatures[Math.floor(Math.random() * signatures.length)];
      return response + randomSignature;
    }

    return response;
  }
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

// ENHANCED: Vision-specific system prompt
function buildVisionSystemPrompt(language: string): string {
  return language === 'ar'
    ? "أنت مساعد ذكي مفيد يحلل الصور. استخرج كل النص المرئي، وحدد الأشخاص والأشياء والمشاهد، واستجب بوصف واضح ومنظم. استدل دائماً من التفاصيل البصرية وقدم رؤى عند الإمكان."
    : "You are a helpful AI assistant that analyzes images. Extract all visible text, identify people, objects, and scenes, and respond with clear, structured descriptions. Always reason from visual details and provide insights where possible.";
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

    // Build context for AI
    let fullContext = '';
    if (context) fullContext += `Context: ${context}\n\n`;
    if (conversationSummary) fullContext += `Previous conversation: ${conversationSummary}\n\n`;

    // ENHANCED: Vision support for attached files with intelligent prompt templates
    if (processedFiles && processedFiles.length > 0) {
      console.log('🔍 VISION MODE: Processing', processedFiles.length, 'attached files');
      
      const imageFiles = processedFiles.filter(file => 
        file.type === 'image' || (file.publicUrl && file.type?.startsWith('image/'))
      );
      
      if (imageFiles.length > 0) {
        console.log('🔍 VISION PROCESSING: Starting OpenAI Vision analysis with enhanced prompts');
        
        // ENHANCED: Detect image type and build appropriate prompt
        const imageType = detectImageType(message);
        const enhancedMessage = buildVisionMessage(message, imageType);
        
        console.log('🔍 VISION: Detected image type:', imageType);
        console.log('🔍 VISION: Enhanced message:', enhancedMessage.substring(0, 100) + '...');
        
        // Build vision-specific messages array with enhanced system prompt
        const visionMessages = [
          { role: 'system', content: buildVisionSystemPrompt(language) }
        ];
        
        // Add full context if available
        if (fullContext.trim()) {
          visionMessages.push({ role: 'system', content: fullContext });
        }
        
        // Add recent messages for continuity
        recentMessages.forEach(msg => {
          if (msg.role && msg.content) {
            visionMessages.push({
              role: msg.role,
              content: msg.content
            });
          }
        });
        
        // Build multimodal content with enhanced prompt
        const visionContent = [
          { type: 'text', text: enhancedMessage }
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
        
        visionMessages.push({ role: 'user', content: visionContent });
        
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
            messages: visionMessages,
            max_tokens: maxTokens,
            temperature: getPersonalizedTemperature(personalTouch)
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

    // ENHANCED: Build aggressive personalized system prompt for regular chat
    const personalizedSystemPrompt = buildPersonalizedSystemPrompt(personalTouch, language);
    console.log('🎯 FULL PERSONALIZED SYSTEM PROMPT:', personalizedSystemPrompt.substring(0, 200) + '...');

    // ENHANCED: Get personality-based temperature
    const personalizedTemperature = getPersonalizedTemperature(personalTouch);
    console.log('🎯 PERSONALIZED TEMPERATURE:', personalizedTemperature);

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
