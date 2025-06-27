
interface CachedResponse {
  response: string;
  timestamp: number;
}

interface UserPatternCache {
  userId: string;
  patterns: Map<string, CachedResponse>;
  lastUpdated: number;
}

class AIResponseCacheService {
  private cache = new Map<string, CachedResponse>();
  private userPatterns = new Map<string, UserPatternCache>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PATTERN_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  private basicResponses = {
    // English - Expanded
    'hello': "Hey! How can I help you today? 👋",
    'hi': "Hello! 👋",
    'hey': "Hey there! What's up? 😊",
    'how are you': "I'm doing great — ready when you are! 🚀",
    'how are you?': "I'm doing great — ready when you are! 🚀",
    'what\'s your name': "I'm WAKTI, your AI assistant! 🤖",
    'what is your name': "I'm WAKTI, your AI assistant! 🤖",
    'who are you': "I'm WAKTI, your intelligent AI assistant here to help! ✨",
    'good morning': "Good morning! Hope you have a great day ahead! ☀️",
    'good afternoon': "Good afternoon! How can I assist you today? 🌞",
    'good evening': "Good evening! What can I help you with? 🌙",
    'thanks': "You're welcome! Happy to help! 😊",
    'thank you': "You're very welcome! Anything else I can do for you? 😊",
    'bye': "Goodbye! Have a wonderful day! 👋",
    'goodbye': "Goodbye! Take care! 👋",
    'help': "I'm here to help! What do you need assistance with? 🤔",
    'what can you do': "I can help with tasks, answer questions, search the web, generate images, and much more! What would you like to try? ✨",
    'yes': "Great! How can I help you further? 😊",
    'no': "No problem! Is there anything else I can help you with? 🤔",
    'ok': "Perfect! What's next? 👍",
    'okay': "Sounds good! What would you like to do? 👍",
    
    // Arabic - Expanded
    'مرحبا': "مرحباً! كيف يمكنني مساعدتك اليوم؟ 👋",
    'أهلا': "أهلاً وسهلاً! 👋",
    'السلام عليكم': "وعليكم السلام ورحمة الله وبركاته! 🤲",
    'كيف حالك': "بخير والحمد لله — مستعد لمساعدتك! 🚀",
    'كيف حالك؟': "بخير والحمد لله — مستعد لمساعدتك! 🚀",
    'ما اسمك': "أنا WAKTI، مساعدك الذكي! 🤖",
    'من أنت': "أنا WAKTI، مساعدك الذكي هنا لمساعدتك! ✨",
    'صباح الخير': "صباح النور! أتمنى لك يوماً رائعاً! ☀️",
    'مساء الخير': "مساء النور! كيف يمكنني مساعدتك؟ 🌙",
    'شكرا': "عفواً! سعيد بمساعدتك! 😊",
    'شكراً': "عفواً! سعيد بمساعدتك! 😊",
    'مع السلامة': "مع السلامة! اعتن بنفسك! 👋",
    'مساعدة': "أنا هنا لمساعدتك! ماذا تحتاج؟ 🤔",
    'ماذا تستطيع': "يمكنني مساعدتك في المهام والإجابة على الأسئلة والبحث وإنشاء الصور وأكثر! ماذا تريد أن تجرب؟ ✨",
    'نعم': "رائع! كيف يمكنني مساعدتك أكثر؟ 😊",
    'لا': "لا مشكلة! هل هناك شيء آخر يمكنني مساعدتك فيه؟ 🤔",
    'حسناً': "ممتاز! ما التالي؟ 👍",
    'موافق': "جيد! ماذا تريد أن تفعل؟ 👍"
  };

  private followUpResponses = {
    // English follow-ups
    'can you help me': "Of course! What do you need help with? 😊",
    'i need help': "I'm here to help! What can I assist you with? 🤝",
    'what else': "I can help with many things! Tasks, reminders, searching, or just chatting. What interests you? 🌟",
    'anything else': "Always! I'm here whenever you need assistance. What's on your mind? 💭",
    
    // Arabic follow-ups  
    'هل يمكنك مساعدتي': "بالطبع! بماذا تحتاج المساعدة؟ 😊",
    'أحتاج مساعدة': "أنا هنا لمساعدتك! بماذا يمكنني أن أساعدك؟ 🤝",
    'ماذا أيضاً': "يمكنني مساعدتك في أشياء كثيرة! المهام والتذكيرات والبحث أو حتى الدردشة. ماذا يهمك؟ 🌟",
    'شيء آخر': "دائماً! أنا هنا عندما تحتاج المساعدة. ما الذي يدور في بالك؟ 💭"
  };

  getCachedResponse(input: string, userId?: string): string | null {
    const normalizedInput = input.toLowerCase().trim();
    
    // Check basic responses first (fastest)
    if (this.basicResponses[normalizedInput]) {
      return this.basicResponses[normalizedInput];
    }

    // Check follow-up responses
    if (this.followUpResponses[normalizedInput]) {
      return this.followUpResponses[normalizedInput];
    }

    // Check user pattern cache
    if (userId) {
      const userCache = this.userPatterns.get(userId);
      if (userCache && Date.now() - userCache.lastUpdated < this.PATTERN_CACHE_DURATION) {
        const pattern = userCache.patterns.get(normalizedInput);
        if (pattern && Date.now() - pattern.timestamp < this.CACHE_DURATION) {
          return pattern.response;
        }
      }
    }

    // Check dynamic cache
    const cached = this.cache.get(normalizedInput);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.response;
    }

    return null;
  }

  setCachedResponse(input: string, response: string, userId?: string): void {
    const normalizedInput = input.toLowerCase().trim();
    
    // Store in general cache
    this.cache.set(normalizedInput, {
      response,
      timestamp: Date.now()
    });

    // Store in user pattern cache if userId provided
    if (userId && input.length < 100) { // Only cache shorter inputs for patterns
      let userCache = this.userPatterns.get(userId);
      if (!userCache) {
        userCache = {
          userId,
          patterns: new Map(),
          lastUpdated: Date.now()
        };
        this.userPatterns.set(userId, userCache);
      }
      
      userCache.patterns.set(normalizedInput, {
        response,
        timestamp: Date.now()
      });
      userCache.lastUpdated = Date.now();
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearUserPatterns(userId: string): void {
    this.userPatterns.delete(userId);
  }

  // Clean expired entries periodically
  cleanupExpired(): void {
    const now = Date.now();
    
    // Clean general cache
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
    
    // Clean user pattern cache
    for (const [userId, userCache] of this.userPatterns.entries()) {
      if (now - userCache.lastUpdated > this.PATTERN_CACHE_DURATION) {
        this.userPatterns.delete(userId);
      } else {
        // Clean expired patterns within user cache
        for (const [pattern, data] of userCache.patterns.entries()) {
          if (now - data.timestamp > this.CACHE_DURATION) {
            userCache.patterns.delete(pattern);
          }
        }
      }
    }
  }
}

export const AIResponseCache = new AIResponseCacheService();

// Clean up expired cache entries every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    AIResponseCache.cleanupExpired();
  }, 30 * 60 * 1000);
}
