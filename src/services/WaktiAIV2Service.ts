import { supabase } from '@/integrations/supabase/client';
import { UploadedFile } from '@/hooks/useFileUpload';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean;
  inputType?: 'text' | 'voice';
  browsingUsed?: boolean;
  browsingData?: any;
  quotaStatus?: any;
  requiresSearchConfirmation?: boolean;
  imageUrl?: string;
  isTextGenerated?: boolean;
  attachedFiles?: UploadedFile[];
}

export interface AIConversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  intent?: string;
  confidence_level?: 'high' | 'medium' | 'low';
  action_taken?: any;
  input_type?: 'text' | 'voice';
  browsing_used?: boolean;
  browsing_data?: any;
  quota_status?: any;
}

class WaktiAIV2ServiceClass {
  private static instance: WaktiAIV2ServiceClass;
  private quotaCache: { [userId: string]: any } = {};
  private quotaCacheTimestamp: { [userId: string]: number } = {};
  private readonly QUOTA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): WaktiAIV2ServiceClass {
    if (!WaktiAIV2ServiceClass.instance) {
      WaktiAIV2ServiceClass.instance = new WaktiAIV2ServiceClass();
    }
    return WaktiAIV2ServiceClass.instance;
  }

  // Enhanced sendMessage method with file support
  async sendMessage(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId: string | null = null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: AIMessage[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = []
  ) {
    try {
      console.log('🔄 WaktiAIV2Service: Sending message with enhanced file support');
      console.log('🔄 Message:', message);
      console.log('🔄 Active Trigger:', activeTrigger);
      console.log('🔄 Attached Files:', attachedFiles?.length || 0);

      const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId,
          inputType,
          conversationHistory: conversationHistory.slice(-10),
          confirmSearch,
          activeTrigger,
          textGenParams,
          attachedFiles // Pass attached files to the edge function
        }
      });

      if (response.error) {
        console.error('🔄 Edge function error:', response.error);
        throw new Error(response.error.message || 'Failed to get AI response');
      }

      console.log('🔄 WaktiAIV2Service: Received response from edge function');
      return response.data;
    } catch (error: any) {
      console.error('🔄 WaktiAIV2Service: Error sending message:', error);
      throw error;
    }
  }

  async sendMessageWithSearchConfirmation(
    message: string,
    conversationId: string | null,
    language: string = 'en'
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      return await this.sendMessage(
        message,
        user.id,
        language,
        conversationId,
        'text',
        [],
        true // confirmSearch = true
      );
    } catch (error: any) {
      console.error('Error sending message with search confirmation:', error);
      throw error;
    }
  }

  async getOrFetchQuota(userId: string) {
    try {
      const now = Date.now();
      const cacheKey = userId;
      
      if (
        this.quotaCache[cacheKey] && 
        this.quotaCacheTimestamp[cacheKey] && 
        (now - this.quotaCacheTimestamp[cacheKey]) < this.QUOTA_CACHE_DURATION
      ) {
        return this.quotaCache[cacheKey];
      }

      const response = await supabase.functions.invoke('unified-ai-brain', {
        body: {
          message: 'quota_check',
          userId,
          language: 'en'
        }
      });

      if (response.error) {
        console.error('Error fetching quota:', response.error);
        const fallbackQuota = { count: 0, limit: 60, canBrowse: true };
        this.quotaCache[cacheKey] = fallbackQuota;
        this.quotaCacheTimestamp[cacheKey] = now;
        return fallbackQuota;
      }

      const quota = response.data?.quotaStatus || { count: 0, limit: 60, canBrowse: true };
      this.quotaCache[cacheKey] = quota;
      this.quotaCacheTimestamp[cacheKey] = now;
      
      return quota;
    } catch (error: any) {
      console.error('Error getting quota:', error);
      const fallbackQuota = { count: 0, limit: 60, canBrowse: true };
      return fallbackQuota;
    }
  }

  async getConversations(): Promise<AIConversation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, title, last_message_at, created_at')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  saveChatSession(messages: AIMessage[], conversationId: string | null = null) {
    try {
      const sessionData = {
        messages: messages.slice(-20),
        conversationId,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('wakti_ai_session', JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }

  loadChatSession(): { messages: AIMessage[], conversationId: string | null } | null {
    try {
      const savedSession = localStorage.getItem('wakti_ai_session');
      if (!savedSession) return null;

      const sessionData = JSON.parse(savedSession);
      
      if (sessionData.messages && Array.isArray(sessionData.messages)) {
        const messages = sessionData.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        return {
          messages,
          conversationId: sessionData.conversationId || null
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error loading chat session:', error);
      return null;
    }
  }

  clearChatSession() {
    try {
      localStorage.removeItem('wakti_ai_session');
    } catch (error) {
      console.error('Error clearing chat session:', error);
    }
  }
}

export const WaktiAIV2Service = WaktiAIV2ServiceClass.getInstance();
