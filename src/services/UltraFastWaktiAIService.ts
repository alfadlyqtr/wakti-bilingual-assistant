
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
    console.log('🚀 EMERGENCY MODE: Starting ultra-fast request');
    console.log('📊 REQUEST DETAILS:', {
      message: message.substring(0, 50) + '...',
      userId: userId?.substring(0, 8) + '...',
      language,
      conversationId: conversationId?.substring(0, 8) + '...',
      inputType,
      activeTrigger,
      filesCount: attachedFiles?.length || 0
    });

    const startTime = Date.now();
    let tempConversationId = conversationId || `emergency_${Date.now()}`;

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

      // Prepare EMERGENCY MODE request payload
      const requestPayload = {
        message,
        userId,
        language,
        conversationId: tempConversationId,
        inputType,
        activeTrigger,
        attachedFiles: attachedFiles || [],
        enableStreaming: false, // Disable streaming for emergency mode
        maxTokens: 4096,
        emergencyMode: true
      };

      console.log('🎯 EMERGENCY PAYLOAD: Prepared for Edge Function');

      // Call Supabase Edge Function with emergency timeout
      console.log('🔗 CALLING: wakti-ai-v2-brain Edge Function (EMERGENCY MODE)...');
      
      const { data: response, error: functionError } = await supabase.functions
        .invoke('wakti-ai-v2-brain', {
          body: requestPayload,
          headers: {
            'Content-Type': 'application/json',
            'x-app-name': 'wakti-ai-emergency',
            'x-auth-token': session.access_token,
            'x-skip-auth': 'true'
          }
        });

      console.log('📡 EMERGENCY RESPONSE: Edge Function response received');
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
        emergencyMode: response.emergencyFix,
        debugMode: response.debugMode
      });

      // Update assistant message with response
      assistantMessage.content = response.response || 'Emergency mode response received';

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
      console.log(`✅ EMERGENCY COMPLETE: Total time ${totalTime}ms`);

      return {
        userMessage,
        assistantMessage,
        conversationId: tempConversationId,
        responseTime: totalTime,
        success: true,
        claude4Enabled: response.claude4Upgrade || false,
        emergencyMode: true
      };

    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error('🚨 EMERGENCY ERROR:', error);
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
          ? '❌ نظام الطوارئ: حدث خطأ. يرجى المحاولة مرة أخرى.'
          : '❌ Emergency mode: An error occurred. Please try again.',
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
        error: error.message,
        emergencyMode: true
      };
    }
  }

  clearConversationUltraFast(userId: string, conversationId: string) {
    console.log('🗑️ EMERGENCY CACHE: Clearing conversation cache');
    this.memoryCache.invalidateConversation(userId, conversationId);
  }
}

export const UltraFastWaktiAIService = new UltraFastWaktiAIServiceClass();
