
// Simple cache for TRService to avoid redundant API calls
export class TRServiceCache {
  private static taskCache: { data: any[], timestamp: number } | null = null;
  private static reminderCache: { data: any[], timestamp: number } | null = null;
  private static CACHE_DURATION = 30000; // 30 seconds

  static getTasks(): any[] | null {
    if (!this.taskCache) return null;
    
    const now = Date.now();
    if (now - this.taskCache.timestamp > this.CACHE_DURATION) {
      this.taskCache = null;
      return null;
    }
    
    return this.taskCache.data;
  }

  static setTasks(data: any[]): void {
    this.taskCache = {
      data,
      timestamp: Date.now()
    };
  }

  static getReminders(): any[] | null {
    if (!this.reminderCache) return null;
    
    const now = Date.now();
    if (now - this.reminderCache.timestamp > this.CACHE_DURATION) {
      this.reminderCache = null;
      return null;
    }
    
    return this.reminderCache.data;
  }

  static setReminders(data: any[]): void {
    this.reminderCache = {
      data,
      timestamp: Date.now()
    };
  }

  static clearTasks(): void {
    this.taskCache = null;
  }

  static clearReminders(): void {
    this.reminderCache = null;
  }

  static clearAll(): void {
    this.taskCache = null;
    this.reminderCache = null;
  }
}
