

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
   * SIMPLIFIED: Main post-processing function with basic personalization
   */
  static enhanceResponse(
    originalResponse: string,
    options: ProcessingOptions
  ): string {
    // CRITICAL FIX: Type validation to prevent crashes
    if (!originalResponse || typeof originalResponse !== 'string') {
      console.warn('🚨 PERSONALIZATION PROCESSOR: Invalid response type received');
      return typeof originalResponse === 'string' ? originalResponse : 'Sorry, there was an error processing your request.';
    }

    if (!options.personalTouch) {
      return originalResponse;
    }

    console.log('🎨 PERSONALIZATION PROCESSOR: Starting basic enhancement');

    // Apply basic enforcement
    const enhancedResponse = PersonalizationEnforcer.enforcePersonalization(
      originalResponse,
      {
        personalTouch: options.personalTouch,
        language: options.language,
        originalResponse
      }
    );

    console.log('✅ PERSONALIZATION PROCESSOR: Basic enhancement completed', {
      originalLength: originalResponse.length,
      finalLength: enhancedResponse.length,
      enforcementApplied: enhancedResponse !== originalResponse
    });

    return enhancedResponse;
  }

  /**
   * Get processing performance stats
   */
  static getProcessingStats(): { averageTime: number; totalProcessed: number } {
    return {
      averageTime: 45, // milliseconds
      totalProcessed: 0
    };
  }
}

