
// Performance caching service for Wakti AI optimizations
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PerformanceCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private authCache = new Map<string, { user: any; timestamp: number }>();

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

  // General cache methods
  set<T>(key: string, data: T, ttl: number = 300000) { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    this.authCache.clear();
  }

  // Smart context detection
  needsCalendarContext(message: string): boolean {
    const calendarKeywords = [
      'calendar', 'task', 'tasks', 'reminder', 'reminders', 'event', 'events',
      'schedule', 'appointment', 'meeting', 'deadline', 'due', 'create',
      'add task', 'new task', 'set reminder', 'remind me', 'check my',
      'what do i have', 'my schedule', 'today', 'tomorrow', 'this week'
    ];
    
    const lowerMessage = message.toLowerCase();
    return calendarKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}

export const PerformanceCache = new PerformanceCacheService();
