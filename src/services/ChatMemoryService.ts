interface ChatExchange {
  userMessage: string;
  assistantMessage: string;
  timestamp: number;
  topic?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intent?: string;
}

interface ConversationSummary {
  mainTopics: string[];
  userPreferences: string[];
  conversationStyle: 'casual' | 'formal' | 'technical';
  lastActiveTimestamp: number;
}

class ChatMemoryServiceClass {
  private static readonly MAX_EXCHANGES = 50; // Upgraded from 5 to 50
  private static readonly STORAGE_KEY = 'wakti_chat_memory';
  private static readonly SUMMARY_KEY = 'wakti_conversation_summary';
  private static readonly MEMORY_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly SUMMARY_THRESHOLD = 30; // Create summary after 30 exchanges

  // Get user-specific storage key
  private static getUserStorageKey(userId?: string, suffix: string = ''): string {
    return userId ? `${this.STORAGE_KEY}_${userId}${suffix}` : `${this.STORAGE_KEY}${suffix}`;
  }

  // Enhanced topic detection from message content
  private static detectTopic(message: string): string {
    const topicKeywords = {
      'work': ['work', 'job', 'office', 'meeting', 'project', 'deadline', 'colleague'],
      'health': ['health', 'doctor', 'medicine', 'exercise', 'diet', 'sleep'],
      'family': ['family', 'mom', 'dad', 'sister', 'brother', 'kids', 'children'],
      'technology': ['tech', 'computer', 'software', 'app', 'internet', 'code'],
      'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel', 'visit'],
      'food': ['food', 'cook', 'recipe', 'restaurant', 'eat', 'dinner'],
      'entertainment': ['movie', 'music', 'game', 'book', 'show', 'entertainment'],
      'finance': ['money', 'budget', 'investment', 'bank', 'financial', 'expense'],
      'education': ['learn', 'study', 'school', 'course', 'education', 'training']
    };

    const lowerMessage = message.toLowerCase();
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return topic;
      }
    }
    return 'general';
  }

  // Enhanced sentiment analysis
  private static detectSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'awesome', 'excellent', 'happy', 'love', 'amazing', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'frustrated', 'annoying', 'difficult'];
    
    const lowerMessage = message.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  // Load enhanced memory with topic and sentiment analysis
  static loadMemory(userId?: string): ChatExchange[] {
    try {
      const storageKey = this.getUserStorageKey(userId);
      const stored = localStorage.getItem(storageKey);
      
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      const now = Date.now();

      // Check if memory is expired
      if (parsed.timestamp && (now - parsed.timestamp) > this.MEMORY_EXPIRY) {
        localStorage.removeItem(storageKey);
        return [];
      }

      return parsed.exchanges || [];
    } catch (error) {
      console.error('Error loading enhanced chat memory:', error);
      return [];
    }
  }

  // Enhanced save with automatic summarization
  static saveMemory(exchanges: ChatExchange[], userId?: string): void {
    try {
      const storageKey = this.getUserStorageKey(userId);
      
      // Keep recent exchanges and create summary if needed
      let recentExchanges = exchanges.slice(-this.MAX_EXCHANGES);
      
      // Auto-summarize if we have too many exchanges
      if (exchanges.length >= this.SUMMARY_THRESHOLD) {
        this.createConversationSummary(exchanges, userId);
        // Keep only the most recent exchanges after summarization
        recentExchanges = exchanges.slice(-20);
      }
      
      const memoryData = {
        exchanges: recentExchanges,
        timestamp: Date.now()
      };

      localStorage.setItem(storageKey, JSON.stringify(memoryData));
      console.log(`💾 Enhanced memory saved: ${recentExchanges.length} exchanges`);
    } catch (error) {
      console.error('Error saving enhanced chat memory:', error);
    }
  }

  // Create conversation summary for long-term context
  static createConversationSummary(exchanges: ChatExchange[], userId?: string): void {
    try {
      const summaryKey = this.getUserStorageKey(userId, '_summary');
      
      const topics = [...new Set(exchanges.map(e => e.topic).filter(Boolean))];
      const sentiments = exchanges.map(e => e.sentiment).filter(Boolean);
      const positiveRatio = sentiments.filter(s => s === 'positive').length / sentiments.length;
      
      // Detect user preferences from conversation patterns
      const userMessages = exchanges.filter(e => e.userMessage).map(e => e.userMessage.toLowerCase());
      const preferences = this.extractPreferences(userMessages);
      
      const summary: ConversationSummary = {
        mainTopics: topics.slice(0, 10), // Keep top 10 topics
        userPreferences: preferences,
        conversationStyle: positiveRatio > 0.6 ? 'casual' : positiveRatio < 0.3 ? 'formal' : 'neutral' as any,
        lastActiveTimestamp: Date.now()
      };
      
      localStorage.setItem(summaryKey, JSON.stringify(summary));
      console.log('📋 Conversation summary created:', summary);
    } catch (error) {
      console.error('Error creating conversation summary:', error);
    }
  }

  // Extract user preferences from conversation history
  private static extractPreferences(userMessages: string[]): string[] {
    const preferencePatterns = {
      'detailed_explanations': ['explain', 'detail', 'elaborate', 'more info'],
      'quick_answers': ['quick', 'brief', 'short', 'summarize'],
      'visual_learner': ['show', 'example', 'demonstrate', 'visual'],
      'step_by_step': ['step', 'guide', 'tutorial', 'how to'],
      'casual_tone': ['cool', 'awesome', 'hey', 'thanks'],
      'formal_tone': ['please', 'thank you', 'kindly', 'appreciate']
    };

    const preferences: string[] = [];
    const allText = userMessages.join(' ');

    for (const [preference, keywords] of Object.entries(preferencePatterns)) {
      const matches = keywords.filter(keyword => allText.includes(keyword)).length;
      if (matches >= 2) { // Threshold for preference detection
        preferences.push(preference);
      }
    }

    return preferences;
  }

  // Load conversation summary
  static loadConversationSummary(userId?: string): ConversationSummary | null {
    try {
      const summaryKey = this.getUserStorageKey(userId, '_summary');
      const stored = localStorage.getItem(summaryKey);
      
      if (!stored) return null;
      
      const summary = JSON.parse(stored);
      
      // Check if summary is still valid (within 30 days)
      const now = Date.now();
      const summaryAge = now - (summary.lastActiveTimestamp || 0);
      if (summaryAge > 30 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(summaryKey);
        return null;
      }
      
      return summary;
    } catch (error) {
      console.error('Error loading conversation summary:', error);
      return null;
    }
  }

  // Enhanced add exchange with topic and sentiment detection
  static addExchange(userMessage: string, assistantMessage: string, userId?: string): void {
    const currentMemory = this.loadMemory(userId);
    
    const newExchange: ChatExchange = {
      userMessage,
      assistantMessage,
      timestamp: Date.now(),
      topic: this.detectTopic(userMessage + ' ' + assistantMessage),
      sentiment: this.detectSentiment(userMessage),
      intent: this.detectIntent(userMessage)
    };

    const updatedMemory = [...currentMemory, newExchange];
    this.saveMemory(updatedMemory, userId);
  }

  // Enhanced intent detection
  private static detectIntent(message: string): string {
    const intentPatterns = {
      'question': ['what', 'how', 'when', 'where', 'why', 'which', '?'],
      'request': ['please', 'can you', 'could you', 'would you'],
      'task': ['create', 'make', 'add', 'remind', 'schedule'],
      'search': ['find', 'search', 'look up', 'tell me about'],
      'casual': ['hi', 'hello', 'hey', 'thanks', 'ok']
    };

    const lowerMessage = message.toLowerCase();
    for (const [intent, keywords] of Object.entries(intentPatterns)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return intent;
      }
    }
    return 'general';
  }

  // Get conversation context for AI with enhanced information
  static getConversationContext(userId?: string): string {
    const memory = this.loadMemory(userId);
    const summary = this.loadConversationSummary(userId);
    
    if (memory.length === 0 && !summary) return '';
    
    let context = '';
    
    // Add summary context if available
    if (summary) {
      context += `Previous conversation context:\n`;
      context += `Main topics discussed: ${summary.mainTopics.join(', ')}\n`;
      context += `User prefers: ${summary.userPreferences.join(', ')}\n`;
      context += `Conversation style: ${summary.conversationStyle}\n\n`;
    }
    
    // Add recent conversation history
    if (memory.length > 0) {
      context += `Recent conversation:\n`;
      const recentExchanges = memory.slice(-5); // Show last 5 exchanges
      recentExchanges.forEach((exchange, index) => {
        context += `User: ${exchange.userMessage}\n`;
        context += `Assistant: ${exchange.assistantMessage}\n`;
        if (exchange.topic) context += `Topic: ${exchange.topic}\n`;
        context += '\n';
      });
    }
    
    return context;
  }

  // Clear all memory including summary
  static clearMemory(userId?: string): void {
    try {
      const storageKey = this.getUserStorageKey(userId);
      const summaryKey = this.getUserStorageKey(userId, '_summary');
      localStorage.removeItem(storageKey);
      localStorage.removeItem(summaryKey);
      console.log('🗑️ Enhanced chat memory and summary cleared');
    } catch (error) {
      console.error('Error clearing enhanced chat memory:', error);
    }
  }

  // Convert exchanges to message format for AI with enhanced context
  static formatForAI(exchanges: ChatExchange[]): Array<{role: 'user' | 'assistant', content: string}> {
    const messages: Array<{role: 'user' | 'assistant', content: string}> = [];
    
    // Take more recent exchanges for better context
    const recentExchanges = exchanges.slice(-10); // Increased from 5 to 10
    
    recentExchanges.forEach(exchange => {
      messages.push({ role: 'user', content: exchange.userMessage });
      messages.push({ role: 'assistant', content: exchange.assistantMessage });
    });

    return messages;
  }

  // Get memory statistics for debugging
  static getMemoryStats(userId?: string): any {
    const memory = this.loadMemory(userId);
    const summary = this.loadConversationSummary(userId);
    
    return {
      exchangeCount: memory.length,
      topics: [...new Set(memory.map(e => e.topic).filter(Boolean))],
      hasSummary: !!summary,
      oldestExchange: memory.length > 0 ? new Date(memory[0].timestamp) : null,
      newestExchange: memory.length > 0 ? new Date(memory[memory.length - 1].timestamp) : null
    };
  }
}

export const ChatMemoryService = ChatMemoryServiceClass;
