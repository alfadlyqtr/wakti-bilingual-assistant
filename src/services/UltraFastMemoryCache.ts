// Ultra-Fast Memory Cache System with Hot/Warm/Cold layers
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface ConversationCache {
  messages: any[];
  summary: string;
  messageCount: number;
  conversationId: string;
}

class UltraFastMemoryCacheClass {
  // HOT Cache - In-memory for active conversations (last 5 minutes)
  private hotCache = new Map<string, CacheEntry<ConversationCache>>();
  
  // WARM Cache - Browser storage for recent conversations (last 24 hours)
  private warmStorageKey = 'wakti_warm_cache';
  
  // COLD Cache - Database for long-term storage (handled by existing service)
  
  private readonly HOT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly WARM_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_HOT_ENTRIES = 10;
  private readonly MAX_WARM_ENTRIES = 50;

  // ULTRA-FAST: Get conversation context with 3-layer cache
  async getConversationContext(userId: string, conversationId: string | null): Promise<ConversationCache | null> {
    if (!conversationId) return null;
    
    const cacheKey = `${userId}_${conversationId}`;
    
    // 🔥 LAYER 1: HOT Cache (instant access)
    const hotEntry = this.hotCache.get(cacheKey);
    if (hotEntry && this.isHotCacheValid(hotEntry)) {
      hotEntry.accessCount++;
      hotEntry.lastAccessed = Date.now();
      console.log('🔥 HOT CACHE HIT:', conversationId);
      return hotEntry.data;
    }
    
    // 🌡️ LAYER 2: WARM Cache (browser storage)
    const warmData = this.getFromWarmCache(cacheKey);
    if (warmData) {
      // Promote to hot cache
      this.setHotCache(cacheKey, warmData);
      console.log('🌡️ WARM CACHE HIT:', conversationId);
      return warmData;
    }
    
    // ❄️ LAYER 3: COLD Cache (database) - background load
    console.log('❄️ COLD CACHE MISS - Loading from database:', conversationId);
    return null; // Return null immediately, load in background
  }

  // ULTRA-FAST: Set conversation context in all cache layers
  setConversationContext(userId: string, conversationId: string, data: ConversationCache): void {
    const cacheKey = `${userId}_${conversationId}`;
    
    // Set in hot cache
    this.setHotCache(cacheKey, data);
    
    // Set in warm cache (background)
    this.setWarmCacheBackground(cacheKey, data);
    
    console.log('💾 CACHED:', conversationId, 'Messages:', data.messages.length);
  }

  // HOT Cache management
  private setHotCache(key: string, data: ConversationCache): void {
    // Clean up old entries if cache is full
    if (this.hotCache.size >= this.MAX_HOT_ENTRIES) {
      this.evictLeastRecentlyUsed();
    }
    
    this.hotCache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    });
  }

  private isHotCacheValid(entry: CacheEntry<ConversationCache>): boolean {
    return Date.now() - entry.timestamp < this.HOT_CACHE_TTL;
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.hotCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.hotCache.delete(oldestKey);
    }
  }

  // WARM Cache management (browser storage)
  private getFromWarmCache(key: string): ConversationCache | null {
    try {
      const stored = localStorage.getItem(this.warmStorageKey);
      if (!stored) return null;
      
      const warmCache = JSON.parse(stored);
      const entry = warmCache[key];
      
      if (entry && Date.now() - entry.timestamp < this.WARM_CACHE_TTL) {
        return entry.data;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private setWarmCacheBackground(key: string, data: ConversationCache): void {
    // Run in background to avoid blocking
    setTimeout(() => {
      try {
        const stored = localStorage.getItem(this.warmStorageKey) || '{}';
        const warmCache = JSON.parse(stored);
        
        // Add new entry
        warmCache[key] = {
          data,
          timestamp: Date.now()
        };
        
        // Clean up old entries
        const now = Date.now();
        const cleanedCache: any = {};
        let entryCount = 0;
        
        // Keep only recent and limit to MAX_WARM_ENTRIES
        Object.entries(warmCache)
          .filter(([_, entry]: [string, any]) => 
            now - entry.timestamp < this.WARM_CACHE_TTL
          )
          .sort((a: [string, any], b: [string, any]) => 
            b[1].timestamp - a[1].timestamp
          )
          .slice(0, this.MAX_WARM_ENTRIES)
          .forEach(([k, v]) => {
            cleanedCache[k] = v;
            entryCount++;
          });
        
        localStorage.setItem(this.warmStorageKey, JSON.stringify(cleanedCache));
        console.log('🌡️ WARM CACHE UPDATED:', entryCount, 'entries');
      } catch (error) {
        console.warn('Warm cache update failed:', error);
      }
    }, 0);
  }

  // Clear specific conversation from all caches
  invalidateConversation(userId: string, conversationId: string): void {
    const cacheKey = `${userId}_${conversationId}`;
    
    // Clear hot cache
    this.hotCache.delete(cacheKey);
    
    // Clear warm cache
    try {
      const stored = localStorage.getItem(this.warmStorageKey);
      if (stored) {
        const warmCache = JSON.parse(stored);
        delete warmCache[cacheKey];
        localStorage.setItem(this.warmStorageKey, JSON.stringify(warmCache));
      }
    } catch (error) {
      console.warn('Warm cache invalidation failed:', error);
    }
    
    console.log('🗑️ CACHE INVALIDATED:', conversationId);
  }

  // Clear all caches
  clearAllCaches(): void {
    this.hotCache.clear();
    try {
      localStorage.removeItem(this.warmStorageKey);
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
    console.log('🗑️ ALL CACHES CLEARED');
  }

  // Get cache statistics
  getCacheStats(): any {
    const hotStats = {
      size: this.hotCache.size,
      entries: Array.from(this.hotCache.keys())
    };
    
    let warmStats = { size: 0, entries: [] };
    try {
      const stored = localStorage.getItem(this.warmStorageKey);
      if (stored) {
        const warmCache = JSON.parse(stored);
        warmStats = {
          size: Object.keys(warmCache).length,
          entries: Object.keys(warmCache)
        };
      }
    } catch {
      // Ignore errors
    }
    
    return {
      hot: hotStats,
      warm: warmStats,
      timestamp: Date.now()
    };
  }
}

export const UltraFastMemoryCache = new UltraFastMemoryCacheClass();
