// ============================================================================
// INDEXEDDB PERSISTENT CACHE SERVICE
// Provides offline-capable caching for AI responses and project data
// ============================================================================

const DB_NAME = 'wakti-cache-db';
const DB_VERSION = 1;

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
  category: string;
}

type StoreName = 'ai-responses' | 'project-files' | 'conversation-context' | 'general';

class IndexedDBCacheService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Store configurations
  private readonly stores: StoreName[] = [
    'ai-responses',
    'project-files', 
    'conversation-context',
    'general'
  ];

  // Default TTL values (in milliseconds)
  private readonly TTL = {
    'ai-responses': 24 * 60 * 60 * 1000,      // 24 hours
    'project-files': 7 * 24 * 60 * 60 * 1000,  // 7 days
    'conversation-context': 30 * 60 * 1000,    // 30 minutes
    'general': 60 * 60 * 1000,                 // 1 hour
  };

  // Max entries per store
  private readonly MAX_ENTRIES = {
    'ai-responses': 500,
    'project-files': 1000,
    'conversation-context': 100,
    'general': 200,
  };

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('📦 IndexedDB not available in this environment');
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('📦 IndexedDB failed to open:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('📦 IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores for each category
        this.stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'key' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
            store.createIndex('category', 'category', { unique: false });
            console.log(`📦 Created IndexedDB store: ${storeName}`);
          }
        });
      };
    });

    return this.initPromise;
  }

  /**
   * Get a value from the cache
   */
  async get<T>(store: StoreName, key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(store, 'readonly');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.get(key);

        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined;
          
          if (!entry) {
            resolve(null);
            return;
          }

          // Check if expired
          if (Date.now() > entry.expiresAt) {
            console.log(`📦 Cache expired for key: ${key}`);
            this.delete(store, key); // Clean up expired entry
            resolve(null);
            return;
          }

          console.log(`📦 Cache HIT: ${store}/${key}`);
          resolve(entry.value);
        };

        request.onerror = () => {
          console.error('📦 Cache get error:', request.error);
          resolve(null);
        };
      } catch (error) {
        console.error('📦 Cache get exception:', error);
        resolve(null);
      }
    });
  }

  /**
   * Set a value in the cache
   */
  async set<T>(
    store: StoreName, 
    key: string, 
    value: T, 
    options?: { ttl?: number; category?: string }
  ): Promise<void> {
    await this.init();
    if (!this.db) return;

    const ttl = options?.ttl || this.TTL[store];
    const category = options?.category || 'default';

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      category,
    };

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(store, 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.put(entry);

        request.onsuccess = () => {
          console.log(`📦 Cache SET: ${store}/${key}`);
          this.enforceMaxEntries(store);
          resolve();
        };

        request.onerror = () => {
          console.error('📦 Cache set error:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('📦 Cache set exception:', error);
        reject(error);
      }
    });
  }

  /**
   * Delete a value from the cache
   */
  async delete(store: StoreName, key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(store, 'readwrite');
        const objectStore = transaction.objectStore(store);
        objectStore.delete(key);
        resolve();
      } catch (error) {
        console.error('📦 Cache delete exception:', error);
        resolve();
      }
    });
  }

  /**
   * Clear all entries in a store
   */
  async clearStore(store: StoreName): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(store, 'readwrite');
        const objectStore = transaction.objectStore(store);
        objectStore.clear();
        console.log(`📦 Cleared store: ${store}`);
        resolve();
      } catch (error) {
        console.error('📦 Cache clear exception:', error);
        resolve();
      }
    });
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    for (const store of this.stores) {
      await this.clearStore(store);
    }
    console.log('📦 All caches cleared');
  }

  /**
   * Remove expired entries from a store
   */
  async cleanupExpired(store: StoreName): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(store, 'readwrite');
        const objectStore = transaction.objectStore(store);
        const index = objectStore.index('expiresAt');
        const range = IDBKeyRange.upperBound(Date.now());
        const request = index.openCursor(range);
        let deletedCount = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log(`📦 Cleaned up ${deletedCount} expired entries from ${store}`);
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          resolve(0);
        };
      } catch (error) {
        console.error('📦 Cleanup exception:', error);
        resolve(0);
      }
    });
  }

  /**
   * Enforce max entries limit by removing oldest entries
   */
  private async enforceMaxEntries(store: StoreName): Promise<void> {
    if (!this.db) return;

    const maxEntries = this.MAX_ENTRIES[store];
    
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(store, 'readwrite');
        const objectStore = transaction.objectStore(store);
        const countRequest = objectStore.count();

        countRequest.onsuccess = () => {
          const count = countRequest.result;
          
          if (count <= maxEntries) {
            resolve();
            return;
          }

          // Delete oldest entries
          const deleteCount = count - maxEntries;
          const index = objectStore.index('timestamp');
          const request = index.openCursor();
          let deleted = 0;

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor && deleted < deleteCount) {
              cursor.delete();
              deleted++;
              cursor.continue();
            } else {
              console.log(`📦 Evicted ${deleted} old entries from ${store}`);
              resolve();
            }
          };

          request.onerror = () => resolve();
        };

        countRequest.onerror = () => resolve();
      } catch (error) {
        resolve();
      }
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<Record<string, { count: number; oldestEntry: number | null }>> {
    await this.init();
    if (!this.db) return {};

    const stats: Record<string, { count: number; oldestEntry: number | null }> = {};

    for (const store of this.stores) {
      stats[store] = await new Promise((resolve) => {
        try {
          const transaction = this.db!.transaction(store, 'readonly');
          const objectStore = transaction.objectStore(store);
          const countRequest = objectStore.count();

          countRequest.onsuccess = () => {
            const count = countRequest.result;
            
            if (count === 0) {
              resolve({ count: 0, oldestEntry: null });
              return;
            }

            // Get oldest entry
            const index = objectStore.index('timestamp');
            const cursorRequest = index.openCursor();
            
            cursorRequest.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest).result;
              resolve({
                count,
                oldestEntry: cursor?.value?.timestamp || null,
              });
            };

            cursorRequest.onerror = () => {
              resolve({ count, oldestEntry: null });
            };
          };

          countRequest.onerror = () => {
            resolve({ count: 0, oldestEntry: null });
          };
        } catch (error) {
          resolve({ count: 0, oldestEntry: null });
        }
      });
    }

    return stats;
  }

  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.db !== null;
  }
}

// Export singleton instance
export const IndexedDBCache = new IndexedDBCacheService();

// ============================================================================
// CONVENIENCE FUNCTIONS FOR SPECIFIC USE CASES
// ============================================================================

/**
 * Cache an AI response
 */
export async function cacheAIResponse(
  prompt: string, 
  response: string, 
  metadata?: Record<string, any>
): Promise<void> {
  const key = generateCacheKey(prompt);
  await IndexedDBCache.set('ai-responses', key, { response, metadata });
}

/**
 * Get a cached AI response
 */
export async function getCachedAIResponse(
  prompt: string
): Promise<{ response: string; metadata?: Record<string, any> } | null> {
  const key = generateCacheKey(prompt);
  return IndexedDBCache.get('ai-responses', key);
}

/**
 * Cache project files
 */
export async function cacheProjectFiles(
  projectId: string, 
  files: Record<string, string>
): Promise<void> {
  await IndexedDBCache.set('project-files', projectId, files);
}

/**
 * Get cached project files
 */
export async function getCachedProjectFiles(
  projectId: string
): Promise<Record<string, string> | null> {
  return IndexedDBCache.get('project-files', projectId);
}

/**
 * Cache conversation context
 */
export async function cacheConversationContext(
  conversationId: string, 
  context: any
): Promise<void> {
  await IndexedDBCache.set('conversation-context', conversationId, context);
}

/**
 * Get cached conversation context
 */
export async function getCachedConversationContext(
  conversationId: string
): Promise<any | null> {
  return IndexedDBCache.get('conversation-context', conversationId);
}

/**
 * Generate a cache key from prompt text
 */
function generateCacheKey(text: string): string {
  // Simple hash function for cache keys
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `prompt_${Math.abs(hash).toString(36)}`;
}

// Run cleanup on init
IndexedDBCache.init().then(() => {
  // Clean up expired entries periodically
  setInterval(() => {
    IndexedDBCache.cleanupExpired('ai-responses');
    IndexedDBCache.cleanupExpired('conversation-context');
  }, 5 * 60 * 1000); // Every 5 minutes
});
