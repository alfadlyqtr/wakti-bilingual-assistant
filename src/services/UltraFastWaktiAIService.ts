// Ultra-Fast Wakti AI Service with enhanced memory, summaries, and task creation
import { supabase } from '@/integrations/supabase/client';
import { UltraFastMemoryCache } from './UltraFastMemoryCache';
import { StreamingResponseManager } from './StreamingResponseManager';
import { BackgroundProcessingQueue } from './BackgroundProcessingQueue';
import { EnhancedTaskCreationService } from './EnhancedTaskCreationService';
import { AIMessage } from './WaktiAIV2Service';

class UltraFastWaktiAIServiceClass {
  // ULTRA-FAST: Send message with enhanced memory and task creation
  async sendMessageUltraFast(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    activeTrigger: string = 'chat',
    attachedFiles: any[] = [],
    onStreamUpdate?: (chunk: string, isComplete: boolean) => void,
    onTaskDetected?: (taskData: any) => void
  ) {
    try {
      // Get user ID
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      // Generate or use existing conversation ID
      const actualConversationId = conversationId || `ultra-fast-${Date.now()}`;
      
      console.log('🚀 ULTRA-FAST: Processing message with enhanced memory');
      
      // ENHANCED: Check for task creation intent FIRST
      const taskIntent = EnhancedTaskCreationService.detectTaskCreationIntent(message);
      console.log('🎯 TASK INTENT:', taskIntent ? `${taskIntent.language} (${taskIntent.confidence})` : 'None');
      
      // STEP 1: Try to get context from ultra-fast cache with summary priority
      let contextData = await UltraFastMemoryCache.getConversationContext(userId, actualConversationId);
      
      // STEP 2: If no cache hit, queue background context loading
      if (!contextData && conversationId) {
        BackgroundProcessingQueue.enqueue('context_load', {
          userId,
          conversationId: actualConversationId
        });
        
        // Use minimal context for now
        contextData = {
          messages: [],
          summary: '',
          messageCount: 0,
          conversationId: actualConversationId
        };
      }
      
      // STEP 3: Start streaming if callback provided
      if (onStreamUpdate) {
        StreamingResponseManager.startStream(actualConversationId, onStreamUpdate);
      }
      
      // ENHANCED: Get compressed context for AI system prompt
      const compressedContext = UltraFastMemoryCache.getCompressedContext(userId, actualConversationId);
      console.log('🧠 COMPRESSED CONTEXT:', compressedContext.tokens, 'tokens');
      
      console.log('🚀 ULTRA-FAST: Sending to AI with enhanced context:', compressedContext.recentMessages.length, 'messages');
      
      // STEP 4: Call AI service with enhanced context and task awareness
      const aiPromise = supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId: actualConversationId,
          inputType,
          activeTrigger: taskIntent ? 'task_creation' : activeTrigger,
          attachedFiles,
          conversationSummary: compressedContext.summary,
          recentMessages: compressedContext.recentMessages,
          speedOptimized: true,
          aggressiveOptimization: true,
          maxTokens: 350,
          personalTouch: this.getPersonalTouch()
        }
      });
      
      // STEP 5: Race between AI response and timeout (12 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Ultra-fast timeout exceeded')), 12000)
      );
      
      const { data, error } = await Promise.race([aiPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error('❌ ULTRA-FAST: AI Error:', error);
        throw error;
      }
      
      // STEP 6: Create message objects with enhanced metadata
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        inputType: inputType,
        attachedFiles: attachedFiles
      };
      
      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'Response processed successfully.',
        timestamp: new Date(),
        intent: data.intent || (taskIntent ? 'task_creation' : 'chat'),
        confidence: data.confidence as 'high' | 'medium' | 'low' || (taskIntent ? 'high' : 'medium'),
        actionTaken: data.actionTaken
      };
      
      // STEP 7: Handle task creation if intent detected - TRIGGER FORM INSTEAD OF DIRECT CREATION
      let taskCreated = false;
      let taskData = null;
      if (taskIntent && taskIntent.confidence > 0.7) {
        try {
          taskData = EnhancedTaskCreationService.parseTaskFromMessage(message, taskIntent.language);
          console.log('📝 TASK DETECTED - TRIGGERING FORM:', taskData.title, `(${taskData.language})`);
          
          // Trigger the task confirmation form instead of creating directly
          if (onTaskDetected) {
            onTaskDetected(taskData);
          }
          
          taskCreated = false; // Will be created after user confirms
        } catch (error) {
          console.error('Task parsing failed:', error);
        }
      }
      
      // STEP 8: Update cache immediately with enhanced context
      const updatedContext = {
        messages: [...(contextData?.messages || []), userMessage, assistantMessage].slice(-10),
        summary: compressedContext.summary,
        messageCount: (contextData?.messageCount || 0) + 2,
        conversationId: actualConversationId,
        hasSummary: !!compressedContext.summary
      };
      
      UltraFastMemoryCache.setConversationContext(userId, actualConversationId, updatedContext);
      
      // STEP 9: Queue background operations (non-blocking)
      BackgroundProcessingQueue.enqueue('database_save', {
        userId,
        conversationId: actualConversationId,
        userMessage,
        assistantMessage
      });
      
      // STEP 10: Complete streaming if active
      if (onStreamUpdate) {
        StreamingResponseManager.completeStream(actualConversationId, assistantMessage.content);
      }
      
      console.log('✅ ULTRA-FAST: Completed with superior memory + task detection');
      
      return {
        ...data,
        conversationId: actualConversationId,
        response: assistantMessage.content,
        userMessage,
        assistantMessage,
        ultraFastMode: true,
        cacheHit: !!contextData,
        processingTime: Date.now(),
        taskCreated,
        taskIntent: taskIntent,
        taskData: taskData,
        summaryTokens: compressedContext.tokens
      };
      
    } catch (error: any) {
      console.error('❌ ULTRA-FAST: Service Error:', error);
      
      // Complete streaming on error
      if (onStreamUpdate && conversationId) {
        StreamingResponseManager.completeStream(conversationId);
      }
      
      throw new Error(error.message || 'Ultra-fast AI request failed');
    }
  }
  
  // Get personal touch settings
  private getPersonalTouch() {
    try {
      const stored = localStorage.getItem('wakti_personal_touch');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
  
  // Get conversations with enhanced cache optimization
  async getConversationsUltraFast(): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Query database with summary info
      const { data, error } = await supabase
        .from('ai_conversations')
        .select(`
          id, 
          title, 
          last_message_at, 
          created_at,
          ai_conversation_summaries!inner(summary_text, message_count)
        `)
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      return (data || []).map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessageAt: new Date(conv.last_message_at),
        createdAt: new Date(conv.created_at),
        hasSummary: !!(conv as any).ai_conversation_summaries?.summary_text,
        messageCount: (conv as any).ai_conversation_summaries?.message_count || 0
      }));
      
    } catch (error) {
      console.error('Error fetching conversations ultra-fast:', error);
      return [];
    }
  }
  
  // Clear conversation with enhanced cache invalidation
  clearConversationUltraFast(userId: string, conversationId: string): void {
    UltraFastMemoryCache.invalidateConversation(userId, conversationId);
    console.log('🗑️ ULTRA-FAST: Conversation cleared with summary');
  }
  
  // Enhanced cache statistics
  getCacheStats(): any {
    return {
      memoryCache: UltraFastMemoryCache.getCacheStats(),
      backgroundQueue: BackgroundProcessingQueue.getQueueStatus(),
      streamingActive: StreamingResponseManager.isStreaming('any'),
      taskCreationActive: true,
      timestamp: Date.now()
    };
  }

  // NEW: Force summary creation for conversation
  async forceSummaryCreation(userId: string, conversationId: string): Promise<void> {
    const contextData = UltraFastMemoryCache.getConversationContextSync(userId, conversationId);
    
    if (contextData && contextData.messageCount >= 5) {
      BackgroundProcessingQueue.enqueue('summary_update', {
        userId,
        conversationId,
        messageCount: contextData.messageCount
      });
      
      console.log('📝 FORCED SUMMARY CREATION:', conversationId);
    }
  }
}

export const UltraFastWaktiAIService = new UltraFastWaktiAIServiceClass();
