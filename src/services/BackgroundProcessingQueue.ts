
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
  
  // FIXED: Database save processing with real persistence
  private async processDatabaseSave(data: any): Promise<void> {
    try {
      const { supabase } = await import('../integrations/supabase/client');
      const { UltraFastMemoryCache } = await import('./UltraFastMemoryCache');
      
      const { userId, conversationId, userMessage, assistantMessage } = data;
      
      // Save user and assistant messages to database
      const messagesToSave = [userMessage, assistantMessage].filter(msg => msg);
      
      for (const message of messagesToSave) {
        await supabase.from('ai_chat_history').insert({
          user_id: userId,
          conversation_id: conversationId,
          role: message.role,
          content: message.content,
          input_type: message.inputType || 'text',
          intent: message.intent,
          confidence_level: message.confidence,
          action_taken: message.actionTaken,
          language: 'en' // Could be dynamic
        });
      }
      
      // Update conversation last_message_at
      await supabase.from('ai_conversations')
        .upsert({
          id: conversationId,
          user_id: userId,
          title: userMessage.content.substring(0, 50) + '...',
          last_message_at: new Date().toISOString()
        });
      
      console.log('💾 BACKGROUND SAVE COMPLETED:', conversationId);
      
      // Queue summary update if needed
      const contextData = UltraFastMemoryCache.getConversationContextSync(userId, conversationId);
      if (contextData && contextData.messageCount % 10 === 0) {
        this.enqueue('summary_update', {
          userId,
          conversationId,
          messageCount: contextData.messageCount
        });
      }
      
    } catch (error) {
      console.error('Database save failed:', error);
      throw error;
    }
  }
  
  // FIXED: Context load processing with real database operations
  private async processContextLoad(data: any): Promise<void> {
    try {
      const { supabase } = await import('../integrations/supabase/client');
      const { UltraFastMemoryCache } = await import('./UltraFastMemoryCache');
      
      const { userId, conversationId } = data;
      
      // Load messages from database
      const { data: messages, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Load summary if exists
      const { data: summaryData } = await supabase
        .from('ai_conversation_summaries')
        .select('*')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .single();
      
      const contextData = {
        messages: messages?.slice(-10) || [], // Keep recent messages
        summary: summaryData?.compressed_summary || summaryData?.summary_text || '',
        messageCount: messages?.length || 0,
        conversationId
      };
      
      UltraFastMemoryCache.setConversationContext(userId, conversationId, contextData);
      console.log('🔄 BACKGROUND CONTEXT LOADED:', conversationId, 'Messages:', contextData.messageCount);
      
    } catch (error) {
      console.error('Context load failed:', error);
      throw error;
    }
  }
  
  // NEW: Smart summary update processing
  private async processSummaryUpdate(data: any): Promise<void> {
    try {
      const { supabase } = await import('../integrations/supabase/client');
      const { userId, conversationId, messageCount } = data;
      
      // Load recent messages for summarization
      const { data: messages, error } = await supabase
        .from('ai_chat_history')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(50); // Last 50 messages
      
      if (error || !messages || messages.length < 5) {
        console.log('📝 SUMMARY SKIPPED: Not enough messages');
        return;
      }
      
      // Create conversation text for summarization
      const conversationText = messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      // Call AI for summarization
      const summaryResponse = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message: `Please provide a concise summary of this conversation in 2-3 sentences, focusing on key topics and user preferences:\n\n${conversationText}`,
          userId,
          language: 'en',
          conversationId,
          activeTrigger: 'summary',
          speedOptimized: true,
          maxTokens: 150
        }
      });
      
      if (summaryResponse.data?.response) {
        const summaryText = summaryResponse.data.response;
        const compressedSummary = summaryText.length > 300 ? summaryText.substring(0, 300) + '...' : summaryText;
        
        // Save summary using the new upsert function
        await supabase.rpc('upsert_conversation_summary', {
          p_user_id: userId,
          p_conversation_id: conversationId,
          p_summary_text: summaryText,
          p_message_count: messageCount,
          p_compressed_summary: compressedSummary,
          p_context_tokens: Math.floor(summaryText.length / 4) // Rough token estimate
        });
        
        console.log('📝 SUMMARY UPDATED:', conversationId, 'Length:', summaryText.length);
      }
      
    } catch (error) {
      console.error('Summary update failed:', error);
      throw error;
    }
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
