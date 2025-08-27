
interface CachedResponse {
  response: string;
  timestamp: number;
}

class AIResponseCacheService {
  private cache = new Map<string, CachedResponse>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private basicResponses = {
    // English
    'hello': "Hey! How can I help you today? 👋",
    'hi': "Hello! 👋",
    'hey': "Hey there! What's up? 😊",
    'how are you': "I'm doing great — ready when you are! 🚀",
    'how are you?': "I'm doing great — ready when you are! 🚀",
    'what\'s your name': "I'm WAKTI, your AI assistant! 🤖",
    'what is your name': "I'm WAKTI, your AI assistant! 🤖",
    'who are you': "I'm WAKTI, your intelligent AI assistant here to help! ✨",
    'thanks': "You're welcome! Happy to help! 😊",
    'thank you': "You're very welcome! Anything else I can do for you? 😊",
    'bye': "Goodbye! Have a wonderful day! 👋",
    'goodbye': "Goodbye! Take care! 👋",
    
    // Arabic
    'مرحبا': "مرحباً! كيف يمكنني مساعدتك اليوم؟ 👋",
    'أهلا': "أهلاً وسهلاً! 👋",
    'السلام عليكم': "وعليكم السلام ورحمة الله وبركاته! 🤲",
    'كيف حالك': "بخير والحمد لله — مستعد لمساعدتك! 🚀",
    'كيف حالك؟': "بخير والحمد لله — مستعد لمساعدتك! 🚀",
    'ما اسمك': "أنا WAKTI، مساعدك الذكي! 🤖",
    'من أنت': "أنا WAKTI، مساعدك الذكي هنا لمساعدتك! ✨",
        'شكرا': "عفواً! سعيد بمساعدتك! 😊",
    'شكراً': "عفواً! سعيد بمساعدتك! 😊",
    'مع السلامة': "مع السلامة! اعتن بنفسك! 👋"
  };

  getCachedResponse(input: string): string | null {
    const normalizedInput = input.toLowerCase().trim();
    
    // Check basic responses first
    if (this.basicResponses[normalizedInput]) {
      return this.basicResponses[normalizedInput];
    }

    // Check dynamic cache
    const cached = this.cache.get(normalizedInput);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.response;
    }

    return null;
  }

  setCachedResponse(input: string, response: string): void {
    const normalizedInput = input.toLowerCase().trim();
    this.cache.set(normalizedInput, {
      response,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const AIResponseCache = new AIResponseCacheService();
