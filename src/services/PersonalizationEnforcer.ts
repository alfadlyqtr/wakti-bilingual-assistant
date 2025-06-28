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
   * Main enforcement function that ensures AI responses match user preferences
   */
  static enforcePersonalization(
    originalResponse: string,
    options: EnforcementOptions
  ): string {
    if (!options.personalTouch) {
      return originalResponse;
    }

    let enforcedResponse = originalResponse;
    const { personalTouch, language } = options;

    console.log('🎯 PERSONALIZATION ENFORCER: Starting enforcement', {
      tone: personalTouch.tone,
      style: personalTouch.style,
      originalLength: originalResponse.length
    });

    // 1. Enforce style preferences (length, format)
    enforcedResponse = this.enforceStylePreferences(
      enforcedResponse,
      personalTouch.style,
      language
    );

    // 2. Enforce tone consistency
    enforcedResponse = this.enforceToneConsistency(
      enforcedResponse,
      personalTouch.tone,
      language
    );

    // 3. Add nickname usage
    enforcedResponse = this.enforceNicknameUsage(
      enforcedResponse,
      personalTouch.nickname,
      language
    );

    // 4. Add AI nickname signature
    enforcedResponse = this.enforceAINickname(
      enforcedResponse,
      personalTouch.aiNickname,
      language
    );

    console.log('✅ PERSONALIZATION ENFORCER: Completed', {
      originalLength: originalResponse.length,
      enforcedLength: enforcedResponse.length,
      changesApplied: enforcedResponse !== originalResponse
    });

    return enforcedResponse;
  }

  /**
   * Enforce style preferences (short answers, bullet points, etc.)
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
   * Enforce short answer preference
   */
  private static enforceShortAnswers(response: string, language: string): string {
    // If response is already short (< 150 chars), keep it
    if (response.length <= 150) {
      return response;
    }

    // Split into sentences and keep first 2
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 2) {
      return response;
    }

    // Take first 2 sentences and ensure proper ending
    const shortResponse = sentences.slice(0, 2).join('. ').trim();
    return shortResponse + (shortResponse.endsWith('.') ? '' : '.');
  }

  /**
   * Enforce bullet points format
   */
  private static enforceBulletPoints(response: string, language: string): string {
    // If already has bullet points, keep it
    if (response.includes('•') || response.includes('-') || response.includes('*')) {
      return response;
    }

    // Split by sentences or key phrases
    const points = response.split(/[.!?]+|,\s*(?=\w)/).filter(s => s.trim().length > 15);
    
    if (points.length <= 1) {
      return response;
    }

    const bulletChar = '•';
    return points.map(point => `${bulletChar} ${point.trim()}`).join('\n');
  }

  /**
   * Enforce step-by-step format
   */
  private static enforceStepByStep(response: string, language: string): string {
    // If already has step numbers, keep it
    if (/\d+\.\s/.test(response) || response.includes('Step') || response.includes('خطوة')) {
      return response;
    }

    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length <= 1) {
      return response;
    }

    const stepPrefix = language === 'ar' ? 'خطوة' : 'Step';
    return sentences.map((step, index) => 
      `${stepPrefix} ${index + 1}: ${step.trim()}`
    ).join('\n\n');
  }

  /**
   * Enforce tone consistency
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
   * Enforce funny tone
   */
  private static enforceFunnyTone(response: string, language: string): string {
    // Check if response already has funny elements
    const hasFunnyElements = /[😄😆🤪🎉😊🙃]|haha|هههه/.test(response);
    
    if (hasFunnyElements) {
      return response;
    }

    // Add funny elements
    const funnyAdditions = language === 'ar' ? [
      ' 😄',
      ' هههه',
      '! يلا نشوف',
      '! حلو كده'
    ] : [
      ' 😄',
      ' haha',
      '! That\'s fun',
      '! Cool beans'
    ];

    const randomAddition = funnyAdditions[Math.floor(Math.random() * funnyAdditions.length)];
    return response + randomAddition;
  }

  /**
   * Enforce casual tone
   */
  private static enforceCasualTone(response: string, language: string): string {
    // Check if response is already casual
    const hasCasualElements = /[😊👍✨💫🙂]|awesome|cool|يلا|طيب/.test(response.toLowerCase());
    
    if (hasCasualElements) {
      return response;
    }

    const casualAdditions = language === 'ar' ? [
      ' 😊',
      '! يلا',
      '! طيب'
    ] : [
      ' 😊',
      '! Awesome',
      '! Cool'
    ];

    const randomAddition = casualAdditions[Math.floor(Math.random() * casualAdditions.length)];
    return response + randomAddition;
  }

  /**
   * Enforce encouraging tone
   */
  private static enforceEncouragingTone(response: string, language: string): string {
    const hasEncouragingElements = /[💪🌟✨🚀👏🎯]|you got this|amazing|excellent|تستطيع|رائع|ممتاز/.test(response.toLowerCase());
    
    if (hasEncouragingElements) {
      return response;
    }

    const encouragingAdditions = language === 'ar' ? [
      '! أنت تستطيع 💪',
      '! رائع',
      '! ممتاز ✨'
    ] : [
      '! You got this 💪',
      '! Amazing',
      '! Excellent ✨'
    ];

    const randomAddition = encouragingAdditions[Math.floor(Math.random() * encouragingAdditions.length)];
    return response + randomAddition;
  }

  /**
   * Enforce serious tone
   */
  private static enforceSeriousTone(response: string, language: string): string {
    // Remove casual elements and emojis for serious tone
    let seriousResponse = response.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    seriousResponse = seriousResponse.replace(/!+/g, '.'); // Replace exclamations with periods
    seriousResponse = seriousResponse.replace(/\s+/g, ' ').trim(); // Clean up spacing
    
    return seriousResponse;
  }

  /**
   * Enforce nickname usage
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
    if (response.length < 50 || response.toLowerCase().includes(nickname.toLowerCase())) {
      return response;
    }

    const greetingPhrases = language === 'ar' ? [
      `${nickname}، `,
      `أهلاً ${nickname}! `,
      `طيب ${nickname}، `
    ] : [
      `${nickname}, `,
      `Hey ${nickname}! `,
      `Alright ${nickname}, `
    ];

    // 30% chance to add nickname
    if (Math.random() < 0.3) {
      const randomGreeting = greetingPhrases[Math.floor(Math.random() * greetingPhrases.length)];
      return randomGreeting + response;
    }

    return response;
  }

  /**
   * Enforce AI nickname signature
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
      `\n\n~ ${aiNickname}`,
      `\n\n— ${aiNickname} ✨`
    ] : [
      `\n\n- ${aiNickname} 🤖`,
      `\n\n~ ${aiNickname}`,
      `\n\n— ${aiNickname} ✨`
    ];

    // 25% chance to add signature
    if (Math.random() < 0.25) {
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
