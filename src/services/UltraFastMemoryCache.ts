
// Ultra-Fast Memory Cache with COMPLETE CONTEXT RESTORATION
class UltraFastMemoryCacheClass {
  private cache = new Map<string, any>();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // PHASE 2: Get FULL context - NO MORE compression or optimization
  getFullContext(userId: string, conversationId: string): { 
    recentMessages: any[], 
    summary: string, 
    tokens: number 
  } {
    const cacheKey = `${userId}-${conversationId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log('🧠 CACHE HIT: FULL context retrieved - NO COMPRESSION');
      return {
        recentMessages: cached.messages.slice(-4), // Last 4 messages as specified
        summary: cached.summary || '', // FULL summary - NO truncation
        tokens: this.estimateTokens(cached.summary + JSON.stringify(cached.messages.slice(-4)))
      };
    }
    
    console.log('🧠 CACHE MISS: No full context available');
    return {
      recentMessages: [],
      summary: '',
      tokens: 0
    };
  }

  // Keep existing compressed method for backward compatibility
  getCompressedContext(userId: string, conversationId: string): { 
    recentMessages: any[], 
    summary: string, 
    tokens: number 
  } {
    console.log('⚠️ DEPRECATED: getCompressedContext called - redirecting to getFullContext');
    return this.getFullContext(userId, conversationId);
  }

  async getConversationContext(userId: string, conversationId: string): Promise<any> {
    const cacheKey = `${userId}-${conversationId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log('🧠 CONTEXT CACHE HIT: FULL context available');
      return cached;
    }
    
    console.log('🧠 CONTEXT CACHE MISS: Will load from database');
    return null;
  }

  setConversationContext(userId: string, conversationId: string, context: any): void {
    const cacheKey = `${userId}-${conversationId}`;
    
    // Enforce cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(cacheKey, {
      ...context,
      timestamp: Date.now()
    });
    
    console.log('🧠 CONTEXT CACHED: FULL context stored -', cacheKey);
  }

  getConversationContextSync(userId: string, conversationId: string): any {
    const cacheKey = `${userId}-${conversationId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached;
    }
    
    return null;
  }

  invalidateConversation(userId: string, conversationId: string): void {
    const cacheKey = `${userId}-${conversationId}`;
    this.cache.delete(cacheKey);
    console.log('🗑️ CACHE INVALIDATED:', cacheKey);
  }

  getCacheStats(): any {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL,
      keys: Array.from(this.cache.keys()).slice(0, 5), // Show first 5 keys
      fullContextEnabled: true, // CONFIRMED: Full context restored
      compressionDisabled: true, // CONFIRMED: No more aggressive compression
      repairSystemActive: true // COMPLETE REPAIR confirmation
    };
  }

  private estimateTokens(text: string): number {
    // Rough token estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ CACHE CLEARED: COMPLETE REPAIR system reset');
  }
}

export const UltraFastMemoryCache = new UltraFastMemoryCacheClass();
