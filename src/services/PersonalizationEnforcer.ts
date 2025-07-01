
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
   * SIMPLIFIED: Main enforcement function with basic personalization
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

    console.log('🎯 PERSONALIZATION ENFORCER: Starting basic enforcement', {
      tone: personalTouch.tone,
      style: personalTouch.style,
      originalLength: originalResponse.length
    });

    // 1. Basic nickname usage (only if very appropriate)
    if (personalTouch.nickname && personalTouch.nickname.trim() && originalResponse.length > 50) {
      // Only 30% chance to add nickname to prevent overuse
      if (Math.random() < 0.3 && !originalResponse.toLowerCase().includes(personalTouch.nickname.toLowerCase())) {
        const greetings = language === 'ar' ? [
          `${personalTouch.nickname}، `,
          `أهلاً ${personalTouch.nickname}! `
        ] : [
          `${personalTouch.nickname}, `,
          `Hey ${personalTouch.nickname}! `
        ];
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        enforcedResponse = randomGreeting + enforcedResponse;
      }
    }

    // 2. Basic AI nickname signature (only occasionally)
    if (personalTouch.aiNickname && Math.random() < 0.2) {
      const signature = language === 'ar' 
        ? `\n\n- ${personalTouch.aiNickname} 🤖`
        : `\n\n- ${personalTouch.aiNickname} 🤖`;
      enforcedResponse += signature;
    }

    console.log('✅ PERSONALIZATION ENFORCER: Basic enforcement completed', {
      originalLength: originalResponse.length,
      enforcedLength: enforcedResponse.length,
      changesApplied: enforcedResponse !== originalResponse
    });

    return enforcedResponse;
  }

  /**
   * Get enforcement statistics
   */
  static getEnforcementStats(): { 
    totalEnforcements: number; 
    styleEnforcements: number; 
    toneEnforcements: number; 
  } {
    return {
      totalEnforcements: 0,
      styleEnforcements: 0,
      toneEnforcements: 0
    };
  }
}
