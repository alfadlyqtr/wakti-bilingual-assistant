
import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean | string;
  inputType?: 'text' | 'voice';
  browsingUsed?: boolean;
  browsingData?: any;
  imageUrl?: string;
  isTextGenerated?: boolean;
  actionResult?: any;
  userProfile?: any;
  needsConfirmation?: boolean;
  pendingTaskData?: any;
  pendingReminderData?: any;
  attachedFiles?: any[];
}

export interface AIConversation {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;
}

export class WaktiAIV2ServiceClass {
  // ULTRA-FAST: Simplified localStorage operations
  private static getUserStorageKey(suffix: string): string {
    return `wakti_ai_${suffix}`;
  }

  // ULTRA-FAST: Direct file conversion for vision if needed
  private static async convertFilesToBase64IfNeeded(attachedFiles: any[]): Promise<any[]> {
    if (!attachedFiles || !Array.isArray(attachedFiles) || attachedFiles.length === 0) return [];

    const processed = await Promise.all(
      attachedFiles.map(async (file) => {
        if (file.content) {
          return { type: file.type, content: file.content };
        }
        if (!file.url) return null;
        
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          if (!file.type.startsWith('image/') && file.type !== 'text/plain') return null;
          
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              let result = reader.result as string;
              const base64Index = result.indexOf('base64,');
              if (base64Index !== -1) result = result.substring(base64Index + 7);
              resolve({ type: file.type, content: result });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error('[WaktiAIV2Service] File conversion failed:', file.url, e);
          return null;
        }
      })
    );

    return processed.filter(Boolean);
  }

  // Instance method delegates
  saveChatSession(messages: AIMessage[], conversationId: string | null) {
    return WaktiAIV2ServiceClass.saveChatSession(messages, conversationId);
  }

  loadChatSession() {
    return WaktiAIV2ServiceClass.loadChatSession();
  }

  clearChatSession() {
    return WaktiAIV2ServiceClass.clearChatSession();
  }

  sendMessage(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: any[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = [],
    calendarContext: any = null,
    userContext: any = null,
    enableAdvancedIntegration: boolean = true,
    enablePredictiveInsights: boolean = true,
    enableWorkflowAutomation: boolean = true,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    pendingTaskData: any = null,
    pendingReminderData: any = null
  ) {
    return WaktiAIV2ServiceClass.sendMessage(
      message, userId, language, conversationId, inputType, conversationHistory,
      confirmSearch, activeTrigger, textGenParams, attachedFiles, calendarContext,
      userContext, enableAdvancedIntegration, enablePredictiveInsights,
      enableWorkflowAutomation, confirmTask, confirmReminder, pendingTaskData, pendingReminderData
    );
  }

  getConversations() {
    return WaktiAIV2ServiceClass.getConversations();
  }

  getConversationMessages(conversationId: string) {
    return WaktiAIV2ServiceClass.getConversationMessages(conversationId);
  }

  deleteConversation(conversationId: string) {
    return WaktiAIV2ServiceClass.deleteConversation(conversationId);
  }

  // ULTRA-FAST: Simplified session storage
  static saveChatSession(messages: AIMessage[], conversationId: string | null) {
    try {
      const sessionData = {
        messages: messages.slice(-20), // Keep only last 20 messages
        conversationId,
        timestamp: Date.now()
      };
      
      const storageKey = this.getUserStorageKey('chat_session');
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save chat session:', error);
    }
  }

  static loadChatSession(): { messages: AIMessage[], conversationId: string | null } | null {
    try {
      const storageKey = this.getUserStorageKey('chat_session');
      const sessionData = localStorage.getItem(storageKey);
      if (!sessionData) return null;

      const parsed = JSON.parse(sessionData);
      
      // Check if session is less than 24 hours old
      const now = Date.now();
      const sessionAge = now - (parsed.timestamp || 0);
      if (sessionAge > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return null;
      }

      if (parsed.messages) {
        parsed.messages = parsed.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }

      return {
        messages: parsed.messages || [],
        conversationId: parsed.conversationId || null
      };
    } catch (error) {
      console.error('Failed to load chat session:', error);
      const storageKey = this.getUserStorageKey('chat_session');
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  static clearChatSession() {
    try {
      const storageKey = this.getUserStorageKey('chat_session');
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear chat session:', error);
    }
  }

  // ULTRA-FAST: Direct service call with minimal overhead
  static async sendMessage(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: any[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = [],
    calendarContext: any = null,
    userContext: any = null,
    enableAdvancedIntegration: boolean = true,
    enablePredictiveInsights: boolean = true,
    enableWorkflowAutomation: boolean = true,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    pendingTaskData: any = null,
    pendingReminderData: any = null
  ) {
    try {
      console.log('⚡ ULTRA-FAST: Direct service call initiated');

      // ULTRA-FAST: Process attached files if needed
      let processedAttachedFiles = attachedFiles;
      if (attachedFiles && attachedFiles.length > 0) {
        const missingBase64 = attachedFiles.some(f => f.url && !f.content && f.type?.startsWith('image/'));
        if (missingBase64) {
          processedAttachedFiles = await this.convertFilesToBase64IfNeeded(attachedFiles);
        }
      }

      // ULTRA-FAST: Direct API call with minimal payload
      const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId,
          inputType,
          activeTrigger,
          attachedFiles: processedAttachedFiles
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'AI service error');
      }

      console.log('⚡ ULTRA-FAST: Response received in record time');
      return response.data;
    } catch (error: any) {
      console.error('⚡ ULTRA-FAST: Service error:', error);
      throw error;
    }
  }

  // ULTRA-FAST: Simplified conversation operations
  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(20); // Limit to 20 most recent

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  static async getConversationMessages(conversationId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100); // Limit to 100 messages

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      // FAST: Simple parallel deletion
      const [messagesResult, conversationResult] = await Promise.all([
        supabase.from('ai_chat_history').delete().eq('conversation_id', conversationId),
        supabase.from('ai_conversations').delete().eq('id', conversationId)
      ]);

      if (messagesResult.error) throw messagesResult.error;
      if (conversationResult.error) throw conversationResult.error;
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
