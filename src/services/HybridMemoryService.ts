interface HybridMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  attachedFiles?: any[];
}

interface HybridConversationContext {
  recentMessages: HybridMessage[];
  conversationSummary: string;
  messageCount: number;
  conversationId: string | null;
  lastAccess: number;
}

class HybridMemoryServiceClass {
  private static readonly BROWSER_LAYER_SIZE = 5; // Last 5 messages in React state
  private static readonly SESSION_LAYER_SIZE = 20; // 20 messages in localStorage
  private static readonly SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly DATABASE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  // LAYER 1: BROWSER MEMORY (React State) - Instant Access
  private static browserCache = new Map<string, HybridMessage[]>();
  
  // LAYER 2: SESSION MEMORY (localStorage) - Fast Context
  private static getSessionKey(userId?: string): string {
    return userId ? `wakti_hybrid_session_${userId}` : 'wakti_hybrid_session';
  }
  
  // LAYER 3: DATABASE MEMORY - Permanent Storage (handled by WaktiAIV2Service)
  
  /**
   * HYBRID MEMORY: Get context from all 3 layers (Browser > Session > Database)
   */
  static async getHybridContext(userId: string, conversationId: string | null): Promise<HybridConversationContext> {
    const cacheKey = `${userId}_${conversationId || 'new'}`;
    
    try {
      console.log('🧠 HYBRID MEMORY: Loading context from 3-layer system');
      
      // LAYER 1: Try browser cache first (instant)
      const browserMessages = this.browserCache.get(cacheKey) || [];
      if (browserMessages.length > 0) {
        console.log(`⚡ LAYER 1 (Browser): Found ${browserMessages.length} messages - Instant access`);
        return {
          recentMessages: browserMessages.slice(-this.BROWSER_LAYER_SIZE),
          conversationSummary: '',
          messageCount: browserMessages.length,
          conversationId,
          lastAccess: Date.now()
        };
      }
      
      // LAYER 2: Try session storage (fast)
      const sessionData = this.loadSessionMemory(userId);
      if (sessionData && sessionData.messages.length > 0) {
        console.log(`🚀 LAYER 2 (Session): Found ${sessionData.messages.length} messages - Fast access`);
        
        // Update browser cache
        this.browserCache.set(cacheKey, sessionData.messages);
        
        return {
          recentMessages: sessionData.messages.slice(-this.SESSION_LAYER_SIZE),
          conversationSummary: sessionData.conversationSummary || '',
          messageCount: sessionData.messages.length,
          conversationId: sessionData.conversationId,
          lastAccess: Date.now()
        };
      }
      
      // LAYER 3: Database fallback (slower but comprehensive)
      console.log('📚 LAYER 3 (Database): Loading from permanent storage');
      return {
        recentMessages: [],
        conversationSummary: '',
        messageCount: 0,
        conversationId,
        lastAccess: Date.now()
      };
      
    } catch (error) {
      console.error('❌ HYBRID MEMORY: Context loading failed:', error);
      return {
        recentMessages: [],
        conversationSummary: '',
        messageCount: 0,
        conversationId,
        lastAccess: Date.now()
      };
    }
  }
  
  /**
   * HYBRID MEMORY: Add message to all layers
   */
  static addMessage(userId: string, conversationId: string | null, userMessage: HybridMessage, assistantMessage: HybridMessage): void {
    const cacheKey = `${userId}_${conversationId || 'new'}`;
    
    try {
      // LAYER 1: Update browser cache
      const existingMessages = this.browserCache.get(cacheKey) || [];
      const updatedMessages = [...existingMessages, userMessage, assistantMessage];
      
      // Keep only recent messages in browser
      const trimmedMessages = updatedMessages.slice(-this.BROWSER_LAYER_SIZE);
      this.browserCache.set(cacheKey, trimmedMessages);
      
      // LAYER 2: Update session storage
      this.saveSessionMemory(userId, conversationId, updatedMessages, '');
      
      console.log(`✅ HYBRID MEMORY: Added messages to all layers`);
      
    } catch (error) {
      console.error('❌ HYBRID MEMORY: Failed to add message:', error);
    }
  }
  
  /**
   * LAYER 2: Session Memory Management
   */
  private static loadSessionMemory(userId: string): any {
    try {
      const sessionKey = this.getSessionKey(userId);
      const stored = localStorage.getItem(sessionKey);
      
      if (!stored) return null;
      
      const sessionData = JSON.parse(stored);
      const now = Date.now();
      
      // Check if session is expired
      if (sessionData.timestamp && (now - sessionData.timestamp) > this.SESSION_EXPIRY) {
        localStorage.removeItem(sessionKey);
        return null;
      }
      
      return sessionData;
    } catch (error) {
      console.error('❌ HYBRID MEMORY: Session load failed:', error);
      return null;
    }
  }
  
  private static saveSessionMemory(userId: string, conversationId: string | null, messages: HybridMessage[], summary: string): void {
    try {
      const sessionKey = this.getSessionKey(userId);
      
      // Keep only recent messages in session
      const recentMessages = messages.slice(-this.SESSION_LAYER_SIZE);
      
      const sessionData = {
        messages: recentMessages,
        conversationId,
        conversationSummary: summary,
        timestamp: Date.now(),
        messageCount: messages.length
      };
      
      localStorage.setItem(sessionKey, JSON.stringify(sessionData));
      console.log(`💾 HYBRID MEMORY: Saved ${recentMessages.length} messages to session storage`);
      
    } catch (error) {
      console.error('❌ HYBRID MEMORY: Session save failed:', error);
    }
  }
  
  /**
   * Clear all hybrid memory layers
   */
  static clearAllMemory(userId: string, conversationId?: string | null): void {
    try {
      const cacheKey = `${userId}_${conversationId || 'new'}`;
      
      // LAYER 1: Clear browser cache
      this.browserCache.delete(cacheKey);
      
      // LAYER 2: Clear session storage
      const sessionKey = this.getSessionKey(userId);
      localStorage.removeItem(sessionKey);
      
      console.log('🗑️ HYBRID MEMORY: Cleared all memory layers');
      
    } catch (error) {
      console.error('❌ HYBRID MEMORY: Clear failed:', error);
    }
  }
  
  /**
   * Get memory statistics
   */
  static getMemoryStats(userId: string): any {
    try {
      const sessionData = this.loadSessionMemory(userId);
      const browserCacheSize = Array.from(this.browserCache.keys()).filter(key => key.startsWith(userId)).length;
      
      return {
        browserCacheEntries: browserCacheSize,
        sessionMessages: sessionData?.messages?.length || 0,
        sessionAge: sessionData?.timestamp ? Date.now() - sessionData.timestamp : 0,
        layersActive: {
          browser: browserCacheSize > 0,
          session: !!sessionData,
          database: true // Always available
        }
      };
    } catch (error) {
      console.error('❌ HYBRID MEMORY: Stats failed:', error);
      return { error: 'Failed to get memory stats' };
    }
  }
}

export const HybridMemoryService = HybridMemoryServiceClass;
