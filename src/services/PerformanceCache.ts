
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class PerformanceCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }

  clear(keyPrefix?: string): void {
    if (keyPrefix) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(keyPrefix));
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    return item !== null && Date.now() <= item.expiry;
  }
}

export const performanceCache = new PerformanceCache();
