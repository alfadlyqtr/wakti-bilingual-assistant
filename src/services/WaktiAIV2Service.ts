
import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean | null;
  inputType?: 'text' | 'voice' | 'vision';
  imageUrl?: string;
  browsingUsed?: boolean;
  browsingData?: any;
  attachedFiles?: any[];
  isTextGenerated?: boolean;
}

export interface AIConversation {
  id: string;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}

class WaktiAIV2ServiceClass {
  private personalTouchCache: any = null;

  constructor() {
    console.log('🤖 WAKTI AI SERVICE: Initialized as Backend Worker (Frontend Boss mode)');
  }

  async sendMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' | 'vision' = 'text',
    recentMessages: AIMessage[] = [],
    skipContextLoad: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = [],
    onStreamUpdate?: (text: string) => void
  ) {
    try {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      console.log('🤖 BACKEND WORKER: Processing message in', activeTrigger, 'mode for frontend conversation', conversationId);

      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        inputType: inputType,
        attachedFiles: attachedFiles
      };

      const personalTouch = this.getPersonalTouch();

      // VISION TIMEOUT FIX: Determine timeout based on request type
      const isVisionRequest = inputType === 'vision' || (attachedFiles && attachedFiles.length > 0);
      const timeoutDuration = isVisionRequest ? 30000 : 10000; // 30s for vision, 10s for chat
      
      console.log(`⏱️ BACKEND WORKER: Using ${timeoutDuration/1000}s timeout for ${isVisionRequest ? 'VISION' : 'CHAT'} request`);

      // BACKEND WORKER: Pure Claude processing, no conversation management
      const { data, error } = await Promise.race([
        supabase.functions.invoke('wakti-ai-v2-brain', {
          body: {
            message,
            userId,
            language,
            conversationId: conversationId, // Accept frontend ID without validation
            inputType,
            activeTrigger,
            attachedFiles,
            conversationSummary: '',
            recentMessages: recentMessages, // Use frontend-provided conversation history
            personalTouch: personalTouch,
            customSystemPrompt: '',
            maxTokens: 4096,
            userStyle: 'detailed',
            userTone: 'neutral',
            speedOptimized: true,
            aggressiveOptimization: false,
            hasTaskIntent: false,
            personalityEnabled: true,
            enableTaskCreation: true,
            enablePersonality: true,
            memoryEnabled: true,
            integratedContext: null
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Backend timeout - ${isVisionRequest ? 'Vision' : 'Chat'} processing took too long (>${timeoutDuration/1000}s)`)), timeoutDuration)
        )
      ]) as any;

      if (error) {
        console.error('❌ BACKEND WORKER: Claude processing error:', error);
        throw error;
      }

      // Handle streaming for chat/vision modes
      if (activeTrigger !== 'image' && activeTrigger !== 'search') {
        console.log('🌊 BACKEND WORKER: Handling streaming response');
        return await this.handleStreamingResponse(data, onStreamUpdate);
      }

      // Handle JSON response for image/search modes
      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an issue processing your request.',
        timestamp: new Date(),
        intent: data.intent,
        confidence: data.confidence as 'high' | 'medium' | 'low',
        actionTaken: data.actionTaken,
        imageUrl: data.imageUrl,
        browsingUsed: data.browsingUsed,
        browsingData: data.browsingData
      };

      console.log('✅ BACKEND WORKER: Claude processing complete, returning to frontend boss');

      return {
        ...data,
        conversationId: conversationId, // Return frontend-provided ID unchanged
        response: assistantMessage.content
      };

    } catch (error: any) {
      console.error('❌ BACKEND WORKER: Claude processing failed:', error);
      throw new Error(error.message || 'Backend worker failed');
    }
  }

  private async handleStreamingResponse(response: any, onStreamUpdate?: (text: string) => void) {
    // If response is not a stream (fallback to regular response)
    if (!response || typeof response.arrayBuffer !== 'function') {
      console.log('📄 BACKEND WORKER: Non-streaming response received');
      return {
        response: response?.response || 'Response received',
        success: true,
        conversationId: null,
        intent: 'chat'
      };
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    if (!reader) {
      throw new Error('No stream reader available');
    }

    try {
      console.log('🌊 BACKEND WORKER: Starting to read streaming response');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              
              const data = JSON.parse(jsonStr);
              
              if (data.delta?.text) {
                accumulatedText += data.delta.text;
                onStreamUpdate?.(accumulatedText);
              }
            } catch (e) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }

      console.log('✅ BACKEND WORKER: Streaming response completed');
      return {
        response: accumulatedText,
        success: true,
        conversationId: null,
        intent: 'chat'
      };
    } finally {
      reader.releaseLock();
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

  clearPersonalTouchCache() {
    this.personalTouchCache = null;
  }

  // Legacy methods - now handled by frontend
  async getConversations(): Promise<AIConversation[]> {
    console.log('⚠️ BACKEND WORKER: getConversations called - should use frontend memory instead');
    return [];
  }

  async getConversationMessages(conversationId: string): Promise<any[]> {
    console.log('⚠️ BACKEND WORKER: getConversationMessages called - should use frontend memory instead');
    return [];
  }

  async deleteConversation(conversationId: string): Promise<void> {
    console.log('⚠️ BACKEND WORKER: deleteConversation called - should use frontend memory instead');
  }

  saveChatSession(messages: AIMessage[], conversationId?: string | null) {
    console.log('⚠️ BACKEND WORKER: saveChatSession called - should use EnhancedFrontendMemory instead');
  }

  loadChatSession(): { messages: AIMessage[], conversationId?: string | null } | null {
    console.log('⚠️ BACKEND WORKER: loadChatSession called - should use EnhancedFrontendMemory instead');
    return null;
  }

  clearChatSession() {
    console.log('⚠️ BACKEND WORKER: clearChatSession called - should use EnhancedFrontendMemory instead');
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
export { WaktiAIV2ServiceClass };
