
// DEPRECATED: Personal Touch is now enforced via system prompt in VisionSystem.buildPersonalizationSection()
// This file is kept for backward compatibility but should not be used.

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
   * DEPRECATED: Personal Touch is now enforced via system prompt
   * This method now returns the original response unchanged
   */
  static enforcePersonalization(
    originalResponse: string,
    options: EnforcementOptions
  ): string {
    console.warn('🚨 DEPRECATED: PersonalizationEnforcer is deprecated. Personal Touch is now enforced via system prompt.');
    
    // Return original response unchanged - PT is handled in system prompt
    return originalResponse || 'Sorry, there was an error processing your request.';
  }

  /**
   * Get enforcement statistics (deprecated)
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

