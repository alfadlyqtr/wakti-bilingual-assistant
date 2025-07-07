
import { supabase } from '@/integrations/supabase/client';
import { WaktiAIV2Service, AIMessage } from './WaktiAIV2Service';
import { UltraFastMemoryCache } from './UltraFastMemoryCache';

interface StreamUpdateCallback {
  (chunk: string, isComplete: boolean): void;
}

interface TaskDetectionCallback {
  (taskData: any): void;
}

export class UltraFastWaktiAIServiceClass {
  // Remove 'new' since UltraFastMemoryCache is already instantiated
  private memoryCache = UltraFastMemoryCache;

  async sendMessageUltraFast(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId: string | null = null,
    inputType: 'text' | 'voice' = 'text',
    activeTrigger: string = 'chat',
    attachedFiles?: any[],
    onStreamUpdate?: StreamUpdateCallback,
    onTaskDetected?: TaskDetectionCallback
  ) {
    console.log('🚀 ULTRA-FAST: Starting request with enhanced debugging');
    console.log('📊 REQUEST DETAILS:', {
      message: message.substring(0, 100) + '...',
      userId: userId?.substring(0, 8) + '...',
      language,
      conversationId: conversationId?.substring(0, 8) + '...',
      inputType,
      activeTrigger,
      filesCount: attachedFiles?.length || 0,
      streamingEnabled: !!onStreamUpdate
    });

    const startTime = Date.now();
    let tempConversationId = conversationId || `temp_${Date.now()}`;

    try {
      // Get user authentication token
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.error('❌ AUTH ERROR:', authError);
        throw new Error('Authentication required');
      }
      console.log('✅ AUTH: User authenticated successfully');

      // Create user and assistant messages immediately for UI
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        inputType,
        attachedFiles: attachedFiles || []
      };

      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      console.log('📝 MESSAGES: Created UI messages');

      // Prepare request payload for Edge Function
      const requestPayload = {
        message,
        userId,
        language,
        conversationId: tempConversationId,
        inputType,
        activeTrigger,
        attachedFiles: attachedFiles || [],
        enableStreaming: !!onStreamUpdate,
        personalTouch: this.getPersonalTouch(),
        maxTokens: 4096,
        speedOptimized: true
      };

      console.log('🎯 PAYLOAD: Prepared request for Edge Function:', {
        payloadSize: JSON.stringify(requestPayload).length,
        hasFiles: (attachedFiles?.length || 0) > 0,
        streamingEnabled: requestPayload.enableStreaming
      });

      // Call Supabase Edge Function with enhanced timeout and error handling
      console.log('🔗 CALLING: wakti-ai-v2-brain Edge Function...');
      
      const { data: response, error: functionError } = await supabase.functions
        .invoke('wakti-ai-v2-brain', {
          body: requestPayload,
          headers: {
            'Content-Type': 'application/json',
            'x-app-name': 'wakti-ai-v2',
            'x-auth-token': session.access_token,
            'x-skip-auth': 'true'
          }
        });

      console.log('📡 RESPONSE: Edge Function response received');
      console.log('📊 RESPONSE STATUS:', {
        hasError: !!functionError,
        hasData: !!response,
        responseTime: Date.now() - startTime + 'ms'
      });

      if (functionError) {
        console.error('❌ EDGE FUNCTION ERROR:', functionError);
        throw new Error(`Edge Function error: ${functionError.message}`);
      }

      if (!response) {
        console.error('❌ NO RESPONSE: Edge Function returned null');
        throw new Error('No response from AI service');
      }

      console.log('✅ SUCCESS: Edge Function response processed');
      console.log('🎯 RESPONSE DETAILS:', {
        success: response.success,
        hasResponse: !!response.response,
        hasStreamingResponse: !!response.streamingResponse,
        intent: response.intent,
        model: response.aiProvider,
        claude4Upgrade: response.claude4Upgrade
      });

      // Handle streaming response
      if (response.streamingResponse && onStreamUpdate) {
        console.log('🌊 STREAMING: Processing streaming response');
        await this.handleStreamingResponse(response.streamingResponse, onStreamUpdate);
        assistantMessage.content = 'Streaming response completed';
      } else if (response.response) {
        console.log('💬 REGULAR: Processing regular response');
        assistantMessage.content = response.response;
      } else {
        console.error('❌ NO CONTENT: Response has no content');
        throw new Error('No content in AI response');
      }

      // Handle task detection
      if (response.needsConfirmation && (response.pendingTaskData || response.pendingReminderData)) {
        console.log('🎯 TASK DETECTED: Calling task detection callback');
        if (onTaskDetected) {
          onTaskDetected(response.pendingTaskData || response.pendingReminderData);
        }
      }

      // Update conversation ID
      if (response.conversationId) {
        tempConversationId = response.conversationId;
        console.log('🆔 CONVERSATION: Updated ID to', tempConversationId.substring(0, 8) + '...');
      }

      // Cache the conversation context using the correct method
      this.memoryCache.setConversationContext(userId, tempConversationId, {
        messages: [userMessage, assistantMessage],
        summary: '',
        timestamp: Date.now()
      });
      console.log('💾 CACHE: Conversation cached successfully');

      const totalTime = Date.now() - startTime;
      console.log(`✅ ULTRA-FAST COMPLETE: Total time ${totalTime}ms`);

      return {
        userMessage,
        assistantMessage,
        conversationId: tempConversationId,
        responseTime: totalTime,
        success: true,
        claude4Enabled: response.claude4Upgrade || false
      };

    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error('🚨 ULTRA-FAST ERROR:', error);
      console.error('📊 ERROR DETAILS:', {
        message: error.message,
        stack: error.stack?.substring(0, 500),
        totalTime: totalTime + 'ms'
      });

      // Create error response
      const errorMessage: AIMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: language === 'ar' 
          ? '❌ عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'
          : '❌ Sorry, an error occurred while processing your request. Please try again.',
        timestamp: new Date()
      };

      return {
        userMessage: {
          id: `user-error-${Date.now()}`,
          role: 'user' as const,
          content: message,
          timestamp: new Date(),
          inputType,
          attachedFiles: attachedFiles || []
        },
        assistantMessage: errorMessage,
        conversationId: tempConversationId,
        responseTime: totalTime,
        success: false,
        error: error.message
      };
    }
  }

  private async handleStreamingResponse(streamingResponse: any, onStreamUpdate: StreamUpdateCallback) {
    console.log('🌊 STREAM: Starting streaming response handler');
    try {
      // This would handle actual streaming - simplified for now
      if (typeof streamingResponse === 'string') {
        onStreamUpdate(streamingResponse, true);
      } else {
        console.log('⚠️ STREAM: Non-string streaming response, treating as complete');
        onStreamUpdate(JSON.stringify(streamingResponse), true);
      }
    } catch (error) {
      console.error('❌ STREAM ERROR:', error);
      onStreamUpdate('Streaming error occurred', true);
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

  clearConversationUltraFast(userId: string, conversationId: string) {
    console.log('🗑️ CACHE: Clearing conversation cache');
    this.memoryCache.invalidateConversation(userId, conversationId);
  }
}

export const UltraFastWaktiAIService = new UltraFastWaktiAIServiceClass();
