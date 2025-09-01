
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

    // 1. DETERMINISTIC: Always use nickname when available (no randomness, no length gate)
    const nickname = personalTouch.nickname?.trim();
    if (nickname && !new RegExp(`\\b${nickname}\\b`, 'i').test(originalResponse)) {
      const greeting = language === 'ar'
        ? `${nickname}، `
        : `Hey ${nickname}! `;
      enforcedResponse = greeting + enforcedResponse;
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

