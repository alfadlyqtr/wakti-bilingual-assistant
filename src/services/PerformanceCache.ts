
// Enhanced performance caching service for Wakti AI optimizations
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PerformanceCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private authCache = new Map<string, { user: any; timestamp: number }>();
  private requestCache = new Map<string, Promise<any>>(); // For request deduplication

  // Auth token caching (5-10 minutes)
  cacheAuth(token: string, user: any, ttl: number = 600000) { // 10 minutes
    this.authCache.set(token, {
      user,
      timestamp: Date.now() + ttl
    });
  }

  getCachedAuth(token: string) {
    const cached = this.authCache.get(token);
    if (!cached || Date.now() > cached.timestamp) {
      this.authCache.delete(token);
      return null;
    }
    return cached.user;
  }

  // Enhanced cache methods with better performance
  set<T>(key: string, data: T, ttl: number = 300000) { // 5 minutes default
    try {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl
      });
      console.log(`📦 Cached data for key: ${key}, TTL: ${ttl}ms`);
    } catch (error) {
      console.error('❌ Error setting cache:', error);
    }
  }

  get<T>(key: string): T | null {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        console.log(`🔍 Cache miss for key: ${key}`);
        return null;
      }
      
      if (Date.now() - entry.timestamp > entry.ttl) {
        console.log(`⏰ Cache expired for key: ${key}`);
        this.cache.delete(key);
        return null;
      }
      
      console.log(`🎯 Cache hit for key: ${key}`);
      return entry.data;
    } catch (error) {
      console.error('❌ Error getting cache:', error);
      return null;
    }
  }

  // Request deduplication - prevent multiple simultaneous requests
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if request is already in progress
    const existingRequest = this.requestCache.get(key);
    if (existingRequest) {
      console.log(`🔄 Deduplicating request for key: ${key}`);
      return existingRequest;
    }

    // Start new request and cache the promise
    const requestPromise = requestFn();
    this.requestCache.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } catch (error) {
      throw error;
    } finally {
      // Clean up the request cache
      this.requestCache.delete(key);
    }
  }

  invalidate(key: string) {
    const deleted = this.cache.delete(key);
    this.requestCache.delete(key); // Also clear any pending requests
    if (deleted) {
      console.log(`🗑️ Invalidated cache for key: ${key}`);
    }
  }

  clear() {
    const cacheSize = this.cache.size;
    const authSize = this.authCache.size;
    const requestSize = this.requestCache.size;
    
    this.cache.clear();
    this.authCache.clear();
    this.requestCache.clear();
    
    console.log(`🧹 Cleared cache: ${cacheSize} entries, ${authSize} auth entries, ${requestSize} pending requests`);
  }

  // Smart context detection - enhanced with more keywords
  needsCalendarContext(message: string): boolean {
    const calendarKeywords = [
      'calendar', 'task', 'tasks', 'reminder', 'reminders', 'event', 'events',
      'schedule', 'appointment', 'meeting', 'deadline', 'due', 'create',
      'add task', 'new task', 'set reminder', 'remind me', 'check my',
      'what do i have', 'my schedule', 'today', 'tomorrow', 'this week',
      'next week', 'next month', 'upcoming', 'overdue', 'complete', 'finish'
    ];
    
    const lowerMessage = message.toLowerCase();
    const needsContext = calendarKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (needsContext) {
      console.log(`🧠 Calendar context needed for message: "${message.slice(0, 50)}..."`);
    }
    
    return needsContext;
  }

  // Cache statistics for debugging
  getStats() {
    return {
      cacheSize: this.cache.size,
      authCacheSize: this.authCache.size,
      pendingRequests: this.requestCache.size,
      cacheKeys: Array.from(this.cache.keys()),
    };
  }
}

export const PerformanceCache = new PerformanceCacheService();
