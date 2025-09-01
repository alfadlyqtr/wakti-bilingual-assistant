

// DEPRECATED: Personal Touch is now enforced via system prompt in VisionSystem.buildPersonalizationSection()
// This file is kept for backward compatibility but should not be used.

import { PersonalizationEnforcer } from './PersonalizationEnforcer';

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
  aiNickname?: string;
}

interface ProcessingOptions {
  personalTouch: PersonalTouchData | null;
  language: string;
  responseTime?: number;
}

export class PersonalizationProcessor {
  /**
   * DEPRECATED: Personal Touch is now enforced via system prompt
   * This method now returns the original response unchanged
   */
  static enhanceResponse(
    originalResponse: string,
    options: ProcessingOptions
  ): string {
    console.warn('🚨 DEPRECATED: PersonalizationProcessor is deprecated. Personal Touch is now enforced via system prompt.');
    
    // Return original response unchanged - PT is handled in system prompt
    return originalResponse || 'Sorry, there was an error processing your request.';
  }

  /**
   * Get processing performance stats (deprecated)
   */
  static getProcessingStats(): { averageTime: number; totalProcessed: number } {
    return {
      averageTime: 0,
      totalProcessed: 0
    };
  }
}

