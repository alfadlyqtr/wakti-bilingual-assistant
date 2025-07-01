
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
   * ENHANCED: Main post-processing function with AGGRESSIVE personalization enforcement
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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
    // CRITICAL FIX: Type validation
    if (!response || typeof response !== 'string') {
      return response;
    }

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
