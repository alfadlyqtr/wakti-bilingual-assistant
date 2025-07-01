interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
  aiNickname?: string;
}

interface EnforcementOptions {
  personalTouch: PersonalTouchData | null;
  language: string;
  originalResponse: string;
}

export class PersonalizationEnforcer {
  /**
   * ENHANCED: Main enforcement function with AGGRESSIVE personalization
   */
  static enforcePersonalization(
    originalResponse: string,
    options: EnforcementOptions
  ): string {
    // CRITICAL FIX: Type validation to prevent crashes
    if (!originalResponse || typeof originalResponse !== 'string') {
      console.warn('🚨 PERSONALIZATION: Invalid response type, returning fallback');
      return typeof originalResponse === 'string' ? originalResponse : 'Sorry, there was an error processing your request.';
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

    const hasEncouragingElements = /[💪🌟✨🚀👏🎯]|you got|amazing|great|excellent|تستطيع|رائع|ممتاز/i.test(response);
    
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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
   * ENHANCED: Enforce nickname usage with CREATIVE VARIATIONS
   */
  private static enforceNicknameUsage(
    response: string,
    nickname: string,
    language: string
  ): string {
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string' || !nickname || nickname.trim().length === 0) {
      return response;
    }

    // Don't add nickname if response is very short or already contains it
    if (response.length < 30 || response.toLowerCase().includes(nickname.toLowerCase())) {
      return response;
    }

    // ENHANCED: Creative and diverse greeting phrases
    const greetingPhrases = language === 'ar' ? [
      `${nickname}، `,
      `أهلاً ${nickname}! `,
      `استمع ${nickname}، `,
      `${nickname} العزيز، `,
      `صديقي ${nickname}، `,
      `يا ${nickname}، `,
      `${nickname} الغالي، `,
      `مستخدم وقتي ${nickname}، `,
      `صديق وقتي ${nickname}، `,
      `${nickname} حبيبي، `,
      `أخوي ${nickname}، `,
      `رفيقي ${nickname}، `,
      `${nickname} يا عسل، `,
      `حياك ${nickname}، `,
      `${nickname} يا بطل، `
    ] : [
      `${nickname}, `,
      `Hey ${nickname}! `,
      `Listen ${nickname}, `,
      `Dear ${nickname}, `,
      `My friend ${nickname}, `,
      `Yo ${nickname}, `,
      `${nickname} my buddy, `,
      `WAKTI user ${nickname}, `,
      `${nickname} buddy, `,
      `My BFF ${nickname}, `,
      `${nickname} mate, `,
      `${nickname} pal, `,
      `Champion ${nickname}, `,
      `${nickname} rockstar, `,
      `Superstar ${nickname}, `
    ];

    // ENHANCED: 70% chance to add nickname with more variety
    if (Math.random() < 0.7) {
      const randomGreeting = greetingPhrases[Math.floor(Math.random() * greetingPhrases.length)];
      return randomGreeting + response;
    }

    return response;
  }

  /**
   * ENHANCED: Enforce AI nickname signature with more variety
   */
  private static enforceAINickname(
    response: string,
    aiNickname: string | undefined,
    language: string
  ): string {
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string' || !aiNickname || aiNickname.trim().length === 0) {
      return response;
    }

    // Check if signature already exists
    if (response.includes(aiNickname)) {
      return response;
    }

    // ENHANCED: More creative signature variations
    const signatures = language === 'ar' ? [
      `\n\n- ${aiNickname} 🤖`,
      `\n\n~ ${aiNickname} ✨`,
      `\n\n— ${aiNickname} 💫`,
      `\n\n🤖 ${aiNickname}`,
      `\n\n💙 ${aiNickname}`,
      `\n\n🚀 ${aiNickname}`,
      `\n\n🌟 ${aiNickname}`,
      `\n\n⚡ ${aiNickname}`,
      `\n\n🎯 مساعدك ${aiNickname}`,
      `\n\n✨ صديقك ${aiNickname}`,
      `\n\n🤝 رفيقك ${aiNickname}`,
      `\n\n💪 ${aiNickname} دائماً هنا`
    ] : [
      `\n\n- ${aiNickname} 🤖`,
      `\n\n~ ${aiNickname} ✨`,
      `\n\n— ${aiNickname} 💫`,
      `\n\n🤖 ${aiNickname}`,
      `\n\n💙 ${aiNickname}`,
      `\n\n🚀 ${aiNickname}`,
      `\n\n🌟 ${aiNickname}`,
      `\n\n⚡ ${aiNickname}`,
      `\n\n🎯 Your assistant ${aiNickname}`,
      `\n\n✨ Your buddy ${aiNickname}`,
      `\n\n🤝 Your pal ${aiNickname}`,
      `\n\n💪 ${aiNickname} at your service`
    ];

    // ENHANCED: 50% chance to add signature with more variety
    if (Math.random() < 0.5) {
      const randomSignature = signatures[Math.floor(Math.random() * signatures.length)];
      return response + randomSignature;
    }

    return response;
  }

  /**
   * Get enforcement statistics
   */
  static getEnforcementStats(): { 
    totalEnforcements: number; 
    styleEnforcements: number; 
    toneEnforcements: number; 
  } {
    // This could be expanded to track actual enforcement statistics
    return {
      totalEnforcements: 0,
      styleEnforcements: 0,
      toneEnforcements: 0
    };
  }
}
