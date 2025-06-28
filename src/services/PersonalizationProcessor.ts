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
   * Main post-processing function to personalize AI responses
   */
  static enhanceResponse(
    originalResponse: string,
    options: ProcessingOptions
  ): string {
    if (!options.personalTouch) {
      return originalResponse;
    }

    let enhancedResponse = originalResponse;
    const { personalTouch, language } = options;

    // 1. Apply nickname integration
    if (personalTouch.nickname) {
      enhancedResponse = this.addNicknameToResponse(
        enhancedResponse,
        personalTouch.nickname,
        language
      );
    }

    // 2. Apply tone-specific adjustments
    if (personalTouch.tone && personalTouch.tone !== 'neutral') {
      enhancedResponse = this.applyTonePersonality(
        enhancedResponse,
        personalTouch.tone,
        language
      );
    }

    // 3. Apply style formatting
    if (personalTouch.style) {
      enhancedResponse = this.applyStyleFormatting(
        enhancedResponse,
        personalTouch.style,
        language
      );
    }

    // 4. Add AI nickname signature if set
    if (personalTouch.aiNickname) {
      enhancedResponse = this.addAINicknameSignature(
        enhancedResponse,
        personalTouch.aiNickname,
        language
      );
    }

    return enhancedResponse;
  }

  /**
   * Naturally integrate user's nickname into the response
   */
  private static addNicknameToResponse(
    response: string,
    nickname: string,
    language: string = 'en'
  ): string {
    // Don't add nickname if response is very short or already contains it
    if (response.length < 50 || response.toLowerCase().includes(nickname.toLowerCase())) {
      return response;
    }

    const greetingPhrases = language === 'ar' ? [
      `${nickname}، `,
      `أهلاً ${nickname}! `,
      `${nickname} عزيزي، `,
      `طيب ${nickname}، `
    ] : [
      `${nickname}, `,
      `Hey ${nickname}! `,
      `${nickname}, `,
      `Alright ${nickname}, `
    ];

    // Randomly choose a greeting style (20% chance to add nickname)
    if (Math.random() < 0.3) {
      const randomGreeting = greetingPhrases[Math.floor(Math.random() * greetingPhrases.length)];
      return randomGreeting + response;
    }

    return response;
  }

  /**
   * Apply tone-specific personality adjustments
   */
  private static applyTonePersonality(
    response: string,
    tone: string,
    language: string = 'en'
  ): string {
    switch (tone) {
      case 'funny':
        return this.makeFunny(response, language);
      case 'casual':
        return this.makeCasual(response, language);
      case 'encouraging':
        return this.makeEncouraging(response, language);
      case 'serious':
        return this.makeSerious(response, language);
      default:
        return response;
    }
  }

  /**
   * Apply style-specific formatting
   */
  private static applyStyleFormatting(
    response: string,
    style: string,
    language: string = 'en'
  ): string {
    switch (style) {
      case 'short answers':
        return this.makeShort(response, language);
      case 'bullet points':
        return this.convertToBulletPoints(response, language);
      case 'detailed':
        return this.makeDetailed(response, language);
      case 'step-by-step':
        return this.convertToSteps(response, language);
      default:
        return response;
    }
  }

  /**
   * Funny tone adjustments
   */
  private static makeFunny(response: string, language: string): string {
    const funnyEmojis = ['😄', '🤪', '😆', '🎉', '😊', '🙃'];
    const randomEmoji = funnyEmojis[Math.floor(Math.random() * funnyEmojis.length)];

    // Add random funny expressions
    const funnyPhrases = language === 'ar' ? [
      ' هههه',
      ' 😄',
      '! يلا نشوف',
      '! حلو كده'
    ] : [
      ' haha',
      ' 😄',
      '! Let\'s see',
      '! Cool beans'
    ];

    // 40% chance to add funny elements
    if (Math.random() < 0.4) {
      const randomPhrase = funnyPhrases[Math.floor(Math.random() * funnyPhrases.length)];
      response += randomPhrase;
    }

    // Add emoji at the end occasionally
    if (Math.random() < 0.3) {
      response += ` ${randomEmoji}`;
    }

    return response;
  }

  /**
   * Casual tone adjustments
   */
  private static makeCasual(response: string, language: string): string {
    const casualEmojis = ['😊', '👍', '✨', '💫', '🙂'];
    const randomEmoji = casualEmojis[Math.floor(Math.random() * casualEmojis.length)];

    // Add casual expressions
    const casualPhrases = language === 'ar' ? [
      '!',
      ' 😊',
      '! يلا',
      '! طيب'
    ] : [
      '!',
      ' 😊',
      '! Awesome',
      '! Cool'
    ];

    if (Math.random() < 0.3) {
      const randomPhrase = casualPhrases[Math.floor(Math.random() * casualPhrases.length)];
      response += randomPhrase;
    }

    // Add emoji occasionally
    if (Math.random() < 0.25) {
      response += ` ${randomEmoji}`;
    }

    return response;
  }

  /**
   * Encouraging tone adjustments
   */
  private static makeEncouraging(response: string, language: string): string {
    const encouragingEmojis = ['💪', '🌟', '✨', '🚀', '👏', '🎯'];
    const randomEmoji = encouragingEmojis[Math.floor(Math.random() * encouragingEmojis.length)];

    const encouragingPhrases = language === 'ar' ? [
      '! أنت تستطيع',
      '! رائع',
      '! ممتاز',
      ' 💪'
    ] : [
      '! You got this',
      '! Amazing',
      '! Excellent',
      ' 💪'
    ];

    if (Math.random() < 0.4) {
      const randomPhrase = encouragingPhrases[Math.floor(Math.random() * encouragingPhrases.length)];
      response += randomPhrase;
    }

    if (Math.random() < 0.3) {
      response += ` ${randomEmoji}`;
    }

    return response;
  }

  /**
   * Serious tone adjustments
   */
  private static makeSerious(response: string, language: string): string {
    // Remove casual elements and emojis for serious tone
    response = response.replace(/[😀-🿿]/g, ''); // Remove all emojis
    response = response.replace(/!+/g, '.'); // Replace exclamations with periods
    response = response.replace(/\s+/g, ' ').trim(); // Clean up spacing
    
    return response;
  }

  /**
   * Short answers style
   */
  private static makeShort(response: string, language: string): string {
    // Split into sentences and keep only the most important ones
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 2) return response;
    
    // Keep first 2 sentences for short answers
    const shortResponse = sentences.slice(0, 2).join('. ').trim();
    return shortResponse + (shortResponse.endsWith('.') ? '' : '.');
  }

  /**
   * Convert to bullet points
   */
  private static convertToBulletPoints(response: string, language: string): string {
    // Split by sentences or common separators
    const points = response.split(/[.!?]+|,\s*(?=\w)/).filter(s => s.trim().length > 15);
    
    if (points.length <= 1) return response;
    
    const bulletChar = language === 'ar' ? '•' : '•';
    return points.map(point => `${bulletChar} ${point.trim()}`).join('\n');
  }

  /**
   * Make detailed - add more context
   */
  private static makeDetailed(response: string, language: string): string {
    // For detailed style, we mainly preserve the original response
    // The API call should already be configured for detailed responses
    return response;
  }

  /**
   * Convert to step-by-step format
   */
  private static convertToSteps(response: string, language: string): string {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length <= 1) return response;
    
    const stepPrefix = language === 'ar' ? 'خطوة' : 'Step';
    return sentences.map((step, index) => 
      `${stepPrefix} ${index + 1}: ${step.trim()}`
    ).join('\n\n');
  }

  /**
   * Add AI nickname signature
   */
  private static addAINicknameSignature(
    response: string,
    aiNickname: string,
    language: string
  ): string {
    const signatures = language === 'ar' ? [
      `\n\n- ${aiNickname} 🤖`,
      `\n\n~ ${aiNickname}`,
      `\n\n— ${aiNickname} ✨`
    ] : [
      `\n\n- ${aiNickname} 🤖`,
      `\n\n~ ${aiNickname}`,
      `\n\n— ${aiNickname} ✨`
    ];

    // 30% chance to add signature
    if (Math.random() < 0.3) {
      const randomSignature = signatures[Math.floor(Math.random() * signatures.length)];
      return response + randomSignature;
    }

    return response;
  }

  /**
   * Get processing performance stats
   */
  static getProcessingStats(): { averageTime: number; totalProcessed: number } {
    // This could be expanded to track actual performance metrics
    return {
      averageTime: 45, // milliseconds
      totalProcessed: 0
    };
  }
}
