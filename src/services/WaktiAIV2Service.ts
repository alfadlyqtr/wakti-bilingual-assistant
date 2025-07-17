
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
    attachedFiles: any[] = []
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
          setTimeout(() => reject(new Error('Backend timeout - Claude took too long')), 10000) // Reduced to 10s
        )
      ]) as any;

      if (error) {
        console.error('❌ BACKEND WORKER: Claude processing error:', error);
        throw error;
      }

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
