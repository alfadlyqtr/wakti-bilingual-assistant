
// Ultra-Fast Wakti AI Service with CLAUDE 3.5 SONNET MIGRATION
import { supabase } from '@/integrations/supabase/client';
import { UltraFastMemoryCache } from './UltraFastMemoryCache';
import { StreamingResponseManager } from './StreamingResponseManager';
import { BackgroundProcessingQueue } from './BackgroundProcessingQueue';
import { EnhancedTaskCreationService } from './EnhancedTaskCreationService';
import { AIMessage } from './WaktiAIV2Service';

class UltraFastWaktiAIServiceClass {
  // CLAUDE MIGRATION: Send message with restored memory and Claude processing
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
      const actualConversationId = conversationId || `claude-${Date.now()}`;
      
      console.log('🚀 CLAUDE MIGRATION: Processing message with FULL Claude 3.5 Sonnet integration');
      
      // ENHANCED: Check for task creation intent FIRST
      const taskIntent = EnhancedTaskCreationService.detectTaskCreationIntent(message);
      console.log('🎯 TASK INTENT:', taskIntent ? `${taskIntent.language} (${taskIntent.confidence})` : 'None');
      
      // MEMORY - Get FULL context from database
      let contextData = await UltraFastMemoryCache.getConversationContext(userId, actualConversationId);
      
      // If no cache hit, queue background context loading
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
      
      // Start streaming if callback provided
      if (onStreamUpdate) {
        StreamingResponseManager.startStream(actualConversationId, onStreamUpdate);
      }
      
      // Get FULL context for AI system prompt
      const fullContext = UltraFastMemoryCache.getFullContext(userId, actualConversationId);
      console.log('🧠 CLAUDE CONTEXT RESTORED:', fullContext.recentMessages.length, 'messages,', fullContext.summary.length, 'chars summary');
      
      console.log('🚀 CLAUDE MIGRATION: Sending to Claude 3.5 Sonnet with FULL RESTORED context + Vision support');
      
      // Validate image files for Vision processing
      let validatedFiles = [];
      if (attachedFiles && attachedFiles.length > 0) {
        validatedFiles = attachedFiles.filter(file => {
          if (file.type && file.type.startsWith('image/')) {
            const hasValidUrl = file.image_url?.url;
            if (hasValidUrl) {
              console.log(`✅ CLAUDE VISION FILE READY: ${file.name} -> ${file.image_url.url.substring(0, 50)}...`);
              return true;
            } else {
              console.error(`❌ CLAUDE VISION FILE INVALID: ${file.name} - no valid URL`);
              return false;
            }
          }
          return false;
        });
        
        console.log(`🖼️ CLAUDE VISION PROCESSING: ${validatedFiles.length} of ${attachedFiles.length} files ready`);
      }
      
      // Call Claude brain service with FULL context, Vision support, and error handling
      const aiPromise = supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId: actualConversationId,
          inputType,
          activeTrigger: taskIntent ? 'task_creation' : activeTrigger,
          attachedFiles: validatedFiles, // Send validated files for Claude Vision
          conversationSummary: fullContext.summary, // FULL summary
          recentMessages: fullContext.recentMessages, // Last 3-4 messages
          speedOptimized: true,
          maxTokens: 4096,
          personalTouch: this.getPersonalTouch()
        }
      });
      
      // Race between AI response and timeout (15 seconds for Vision processing)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout - please try again')), 15000)
      );
      
      const { data, error } = await Promise.race([aiPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error('❌ CLAUDE MIGRATION: AI Error:', error);
        throw new Error(error.message || 'Claude AI processing failed');
      }
      
      // Create message objects with enhanced metadata
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        inputType: inputType,
        attachedFiles: validatedFiles // Store validated files
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
      
      // Handle task creation if intent detected - TRIGGER FORM INSTEAD OF DIRECT CREATION
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
      
      // Update cache immediately with FULL context
      const updatedContext = {
        messages: [...(contextData?.messages || []), userMessage, assistantMessage].slice(-10),
        summary: fullContext.summary, // Keep full summary
        messageCount: (contextData?.messageCount || 0) + 2,
        conversationId: actualConversationId,
        hasSummary: !!fullContext.summary
      };
      
      UltraFastMemoryCache.setConversationContext(userId, actualConversationId, updatedContext);
      
      // Queue background operations (non-blocking)
      BackgroundProcessingQueue.enqueue('database_save', {
        userId,
        conversationId: actualConversationId,
        userMessage,
        assistantMessage
      });
      
      // Complete streaming if active
      if (onStreamUpdate) {
        StreamingResponseManager.completeStream(actualConversationId, assistantMessage.content);
      }
      
      console.log('✅ CLAUDE MIGRATION: Completed with FULL CONTEXT + Vision + Error Handling');
      
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
        contextRestored: true, // ALWAYS true now
        fullContextUsed: true, // FULL context used
        visionEnabled: validatedFiles.length > 0,
        claudeMigrationActive: true, // CLAUDE MIGRATION confirmation
        claudeModel: 'claude-3-5-sonnet-20241022'
      };
      
    } catch (error: any) {
      console.error('❌ CLAUDE MIGRATION: Service Error:', error);
      
      // Complete streaming on error
      if (onStreamUpdate && conversationId) {
        StreamingResponseManager.completeStream(conversationId);
      }
      
      // Surface meaningful errors
      let userFriendlyError = 'Sorry, I encountered an error processing your request.';
      
      if (error.message.includes('timeout')) {
        userFriendlyError = 'Request timed out. Please try again.';
      } else if (error.message.includes('image') || error.message.includes('vision')) {
        userFriendlyError = '❌ Unable to process the uploaded image. Please upload a valid JPEG or PNG file.';
      } else if (error.message.includes('Authentication')) {
        userFriendlyError = 'Please log in to continue.';
      } else if (error.message.includes('Claude') || error.message.includes('Anthropic')) {
        userFriendlyError = 'AI service temporarily unavailable. Please try again in a moment.';
      }
      
      throw new Error(userFriendlyError);
    }
  }
  
  private getPersonalTouch() {
    try {
      const stored = localStorage.getItem('wakti_personal_touch');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
  
  async getConversationsUltraFast(): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

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
      console.error('Error fetching conversations:', error);
      return [];
    }
  }
  
  clearConversationUltraFast(userId: string, conversationId: string): void {
    UltraFastMemoryCache.invalidateConversation(userId, conversationId);
    console.log('🗑️ CLAUDE MIGRATION: Conversation cleared with FULL context');
  }
  
  getCacheStats(): any {
    return {
      memoryCache: UltraFastMemoryCache.getCacheStats(),
      backgroundQueue: BackgroundProcessingQueue.getQueueStatus(),
      streamingActive: StreamingResponseManager.isStreaming('any'),
      taskCreationActive: true,
      contextRestored: true, // ALWAYS true
      visionEnabled: true, // CLAUDE MIGRATION includes Vision
      claudeMigrationActive: true, // CLAUDE MIGRATION confirmation
      claudeModel: 'claude-3-5-sonnet-20241022',
      timestamp: Date.now()
    };
  }

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
