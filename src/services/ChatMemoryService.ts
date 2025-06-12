interface ChatExchange {
  userMessage: string;
  assistantMessage: string;
  timestamp: number;
}

class ChatMemoryServiceClass {
  private static readonly MAX_EXCHANGES = 5;
  private static readonly STORAGE_KEY = 'wakti_chat_memory';
  private static readonly MEMORY_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  // Get user-specific storage key
  private static getUserStorageKey(userId?: string): string {
    return userId ? `${this.STORAGE_KEY}_${userId}` : this.STORAGE_KEY;
  }

  // Load chat memory from localStorage
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
      console.error('Error loading chat memory:', error);
      return [];
    }
  }

  // Save chat memory to localStorage
  static saveMemory(exchanges: ChatExchange[], userId?: string): void {
    try {
      const storageKey = this.getUserStorageKey(userId);
      
      // Keep only the last MAX_EXCHANGES
      const trimmedExchanges = exchanges.slice(-this.MAX_EXCHANGES);
      
      const memoryData = {
        exchanges: trimmedExchanges,
        timestamp: Date.now()
      };

      localStorage.setItem(storageKey, JSON.stringify(memoryData));
      console.log(`💾 Saved ${trimmedExchanges.length} chat exchanges to memory`);
    } catch (error) {
      console.error('Error saving chat memory:', error);
    }
  }

  // Add a new exchange to memory
  static addExchange(userMessage: string, assistantMessage: string, userId?: string): void {
    const currentMemory = this.loadMemory(userId);
    
    const newExchange: ChatExchange = {
      userMessage,
      assistantMessage,
      timestamp: Date.now()
    };

    const updatedMemory = [...currentMemory, newExchange];
    this.saveMemory(updatedMemory, userId);
  }

  // Clear all memory
  static clearMemory(userId?: string): void {
    try {
      const storageKey = this.getUserStorageKey(userId);
      localStorage.removeItem(storageKey);
      console.log('🗑️ Chat memory cleared');
    } catch (error) {
      console.error('Error clearing chat memory:', error);
    }
  }

  // Convert exchanges to message format for AI
  static formatForAI(exchanges: ChatExchange[]): Array<{role: 'user' | 'assistant', content: string}> {
    const messages: Array<{role: 'user' | 'assistant', content: string}> = [];
    
    exchanges.forEach(exchange => {
      messages.push({ role: 'user', content: exchange.userMessage });
      messages.push({ role: 'assistant', content: exchange.assistantMessage });
    });

    return messages;
  }

  // Get memory size for debugging
  static getMemorySize(userId?: string): number {
    return this.loadMemory(userId).length;
  }
}

export const ChatMemoryService = ChatMemoryServiceClass;
