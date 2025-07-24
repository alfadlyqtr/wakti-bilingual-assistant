
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
    console.log('🤖 WAKTI AI SERVICE: Initialized with Direct Fetch Streaming Support');
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

      console.log('🤖 BACKEND WORKER: Processing message in', activeTrigger, 'mode for conversation', conversationId);

      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        inputType: inputType,
        attachedFiles: attachedFiles
      };

      const personalTouch = this.getPersonalTouch();

      // Determine if this is a streaming mode (chat/vision) or non-streaming (image/search)
      const isStreamingMode = activeTrigger === 'chat' || activeTrigger === 'vision' || (activeTrigger === 'general' && inputType === 'vision');

      if (isStreamingMode) {
        console.log('🌊 STREAMING MODE: Using direct fetch for real-time streaming');
        return await this.handleStreamingRequest(
          message,
          userId,
          language,
          conversationId,
          inputType,
          recentMessages,
          activeTrigger,
          attachedFiles,
          personalTouch,
          onStreamUpdate
        );
      } else {
        console.log('📦 NON-STREAMING MODE: Using supabase.functions.invoke');
        return await this.handleNonStreamingRequest(
          message,
          userId,
          language,
          conversationId,
          inputType,
          recentMessages,
          activeTrigger,
          attachedFiles,
          personalTouch
        );
      }

    } catch (error: any) {
      console.error('❌ BACKEND WORKER: Message processing failed:', error);
      throw new Error(error.message || 'Backend worker failed');
    }
  }

  private async handleStreamingRequest(
    message: string,
    userId: string,
    language: string,
    conversationId: string | null,
    inputType: 'text' | 'voice' | 'vision',
    recentMessages: AIMessage[],
    activeTrigger: string,
    attachedFiles: any[],
    personalTouch: any,
    onStreamUpdate?: (text: string) => void
  ) {
    try {
      // Get auth session for manual authentication
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Authentication required for streaming');
      }

      // Prepare request payload
      const requestPayload = {
        message,
        userId,
        language,
        conversationId,
        inputType,
        activeTrigger,
        attachedFiles,
        conversationSummary: '',
        recentMessages,
        personalTouch,
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
      };

      // Use direct fetch to Edge Function for streaming
      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-ai-v2-brain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': session.access_token
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`Streaming request failed: ${response.status}`);
      }

      console.log('🌊 STREAMING: Processing real-time response');
      return await this.handleStreamingResponse(response, onStreamUpdate);

    } catch (error: any) {
      console.error('❌ STREAMING ERROR:', error);
      throw error;
    }
  }

  private async handleNonStreamingRequest(
    message: string,
    userId: string,
    language: string,
    conversationId: string | null,
    inputType: 'text' | 'voice' | 'vision',
    recentMessages: AIMessage[],
    activeTrigger: string,
    attachedFiles: any[],
    personalTouch: any
  ) {
    try {
      // Use supabase.functions.invoke for non-streaming modes (image/search)
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId,
          inputType,
          activeTrigger,
          attachedFiles,
          conversationSummary: '',
          recentMessages,
          personalTouch,
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
      });

      if (error) {
        console.error('❌ NON-STREAMING ERROR:', error);
        throw error;
      }

      console.log('✅ NON-STREAMING: Response received');
      return {
        ...data,
        conversationId: conversationId,
        response: data.response || 'Response received'
      };

    } catch (error: any) {
      console.error('❌ NON-STREAMING ERROR:', error);
      throw error;
    }
  }

  private async handleStreamingResponse(response: Response, onStreamUpdate?: (text: string) => void) {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    if (!reader) {
      throw new Error('No stream reader available');
    }

    try {
      console.log('🌊 STREAMING: Starting to read real-time response');
      
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
              
              // Handle Claude's streaming format
              if (data.delta?.text) {
                accumulatedText += data.delta.text;
                console.log('📝 STREAMING CHUNK:', data.delta.text);
                onStreamUpdate?.(accumulatedText);
              }
            } catch (e) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }

      console.log('✅ STREAMING: Complete response received');
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
