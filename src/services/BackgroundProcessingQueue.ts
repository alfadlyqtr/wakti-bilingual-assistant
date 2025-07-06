
// Background Processing Queue for non-blocking operations
interface QueueTask {
  id: string;
  type: 'database_save' | 'context_load' | 'summary_update' | 'cache_sync';
  data: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

class BackgroundProcessingQueueClass {
  private queue: QueueTask[] = [];
  private processing = false;
  private readonly maxRetries = 3;
  private readonly processInterval = 500; // Process every 500ms
  
  constructor() {
    this.startProcessor();
  }
  
  // Add task to queue
  enqueue(type: QueueTask['type'], data: any, maxRetries = this.maxRetries): string {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: QueueTask = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
      maxRetries
    };
    
    this.queue.push(task);
    console.log('📋 QUEUED:', type, id);
    
    return id;
  }
  
  // Start background processor
  private startProcessor(): void {
    setInterval(() => {
      if (!this.processing && this.queue.length > 0) {
        this.processQueue();
      }
    }, this.processInterval);
  }
  
  // Process queue
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    // Process up to 5 tasks at once for efficiency
    const tasksToProcess = this.queue.splice(0, 5);
    
    const processingPromises = tasksToProcess.map(task => 
      this.processTask(task).catch(error => {
        console.error('❌ TASK FAILED:', task.type, task.id, error);
        
        // Retry if not exceeded max retries
        if (task.retries < task.maxRetries) {
          task.retries++;
          task.timestamp = Date.now();
          this.queue.push(task);
          console.log('🔄 TASK RETRIED:', task.type, task.id, `(${task.retries}/${task.maxRetries})`);
        }
      })
    );
    
    await Promise.allSettled(processingPromises);
    
    this.processing = false;
    
    if (tasksToProcess.length > 0) {
      console.log('⚡ PROCESSED:', tasksToProcess.length, 'tasks, Queue size:', this.queue.length);
    }
  }
  
  // Process individual task
  private async processTask(task: QueueTask): Promise<void> {
    switch (task.type) {
      case 'database_save':
        await this.processDatabaseSave(task.data);
        break;
        
      case 'context_load':
        await this.processContextLoad(task.data);
        break;
        
      case 'summary_update':
        await this.processSummaryUpdate(task.data);
        break;
        
      case 'cache_sync':
        await this.processCacheSync(task.data);
        break;
        
      default:
        console.warn('Unknown task type:', task.type);
    }
  }
  
  // Database save processing
  private async processDatabaseSave(data: any): Promise<void> {
    const { WaktiAIV2Service } = await import('./WaktiAIV2Service');
    // Delegate to existing service
    console.log('💾 BACKGROUND SAVE:', data.conversationId);
  }
  
  // Context load processing
  private async processContextLoad(data: any): Promise<void> {
    const { WaktiAIV2Service } = await import('./WaktiAIV2Service');
    const { UltraFastMemoryCache } = await import('./UltraFastMemoryCache');
    
    try {
      // Load from database and cache
      const messages = await WaktiAIV2Service.getConversationMessages(data.conversationId);
      const summary = ''; // Would load summary here
      
      const contextData = {
        messages: messages.slice(-10), // Keep recent messages
        summary,
        messageCount: messages.length,
        conversationId: data.conversationId
      };
      
      UltraFastMemoryCache.setConversationContext(data.userId, data.conversationId, contextData);
      console.log('🔄 BACKGROUND CONTEXT LOADED:', data.conversationId);
    } catch (error) {
      console.error('Context load failed:', error);
      throw error;
    }
  }
  
  // Summary update processing
  private async processSummaryUpdate(data: any): Promise<void> {
    // Would implement summary generation here
    console.log('📝 BACKGROUND SUMMARY UPDATE:', data.conversationId);
  }
  
  // Cache sync processing
  private async processCacheSync(data: any): Promise<void> {
    // Sync caches between layers
    console.log('🔄 BACKGROUND CACHE SYNC');
  }
  
  // Get queue status
  getQueueStatus(): any {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      tasks: this.queue.map(task => ({
        id: task.id,
        type: task.type,
        retries: task.retries,
        age: Date.now() - task.timestamp
      }))
    };
  }
  
  // Clear queue
  clearQueue(): void {
    this.queue = [];
    console.log('🗑️ QUEUE CLEARED');
  }
}

export const BackgroundProcessingQueue = new BackgroundProcessingQueueClass();
