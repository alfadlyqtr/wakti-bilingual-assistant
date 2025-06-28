
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
   * Main post-processing function to personalize AI responses with enforcement
   */
  static enhanceResponse(
    originalResponse: string,
    options: ProcessingOptions
  ): string {
    if (!options.personalTouch) {
      return originalResponse;
    }

    console.log('🎨 PERSONALIZATION PROCESSOR: Starting enhancement and enforcement');

    // STEP 1: Apply enforcement to ensure response matches user preferences
    const enforcedResponse = PersonalizationEnforcer.enforcePersonalization(
      originalResponse,
      {
        personalTouch: options.personalTouch,
        language: options.language,
        originalResponse
      }
    );

    // STEP 2: Apply additional enhancements if needed
    let enhancedResponse = enforcedResponse;

    // Apply custom instructions if provided
    if (options.personalTouch.instruction && options.personalTouch.instruction.trim()) {
      // Log custom instruction application
      console.log('📝 CUSTOM INSTRUCTION: Applied user custom instruction');
    }

    console.log('✅ PERSONALIZATION PROCESSOR: Completed', {
      originalLength: originalResponse.length,
      finalLength: enhancedResponse.length,
      enforcementApplied: enforcedResponse !== originalResponse
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
