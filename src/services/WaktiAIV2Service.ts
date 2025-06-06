import { supabase } from '@/integrations/supabase/client';

export interface AIResponse {
  response: string;
  conversationId?: string;
  intent?: string;
  confidence?: string;
  actionTaken?: string;
  actionResult?: any;
  imageUrl?: string;
  browsingUsed?: boolean;
  browsingData?: {
    hasResults: boolean;
    sources?: any[];
    images?: any[];
    query?: string;
  };
  quotaStatus?: {
    count: number;
    limit: number;
    usagePercentage: number;
    remaining: number;
  };
  requiresSearchConfirmation?: boolean;
  error?: string;
}

export interface TranscriptionResponse {
  text: string;
  success: boolean;
  error?: string;
}

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
  browsingData?: {
    query?: string;
    sources?: any[];
  };
  quotaStatus?: {
    count: number;
    limit: number;
    usagePercentage: number;
  };
  requiresSearchConfirmation?: boolean;
  imageUrl?: string;
  isTextGenerated?: boolean;
}

export interface AIConversation {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
}

type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';

// Session storage keys
const CHAT_SESSION_KEY = 'wakti_ai_chat_session';
const CURRENT_CONVERSATION_KEY = 'wakti_ai_current_conversation';
const MAX_CHAT_MESSAGES = 20;

export class WaktiAIV2Service {
  // Session management for current chat
  static saveChatSession(messages: AIMessage[], conversationId?: string): void {
    try {
      // Limit to 20 messages
      const limitedMessages = messages.slice(-MAX_CHAT_MESSAGES);
      
      const sessionData = {
        messages: limitedMessages,
        conversationId,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(sessionData));
      
      if (conversationId) {
        sessionStorage.setItem(CURRENT_CONVERSATION_KEY, conversationId);
      }
      
      console.log('💾 Chat session saved:', limitedMessages.length, 'messages');
    } catch (error) {
      console.error('❌ Error saving chat session:', error);
    }
  }

  static loadChatSession(): { messages: AIMessage[]; conversationId?: string } | null {
    try {
      const sessionData = sessionStorage.getItem(CHAT_SESSION_KEY);
      if (!sessionData) return null;

      const parsed = JSON.parse(sessionData);
      
      // Convert timestamp strings back to Date objects
      if (parsed.messages) {
        parsed.messages = parsed.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
      
      console.log('📂 Chat session loaded:', parsed.messages?.length || 0, 'messages');
      return parsed;
    } catch (error) {
      console.error('❌ Error loading chat session:', error);
      return null;
    }
  }

  static clearChatSession(): void {
    try {
      sessionStorage.removeItem(CHAT_SESSION_KEY);
      sessionStorage.removeItem(CURRENT_CONVERSATION_KEY);
      console.log('🗑️ Chat session cleared');
    } catch (error) {
      console.error('❌ Error clearing chat session:', error);
    }
  }

  static getCurrentConversationId(): string | null {
    try {
      return sessionStorage.getItem(CURRENT_CONVERSATION_KEY);
    } catch (error) {
      console.error('❌ Error getting current conversation ID:', error);
      return null;
    }
  }

  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔍 WaktiAIV2Service: Testing connection...');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }
      
      const testPayload = {
        message: "Connection test",
        userId: session.user.id,
        language: 'en',
        conversationId: null,
        inputType: 'text',
        activeTrigger: 'chat'
      };
      
      console.log('🔍 WaktiAIV2Service: Calling wakti-ai-v2-brain with test payload:', testPayload);
      
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: testPayload
      });
      
      if (error) {
        console.error('🔍 WaktiAIV2Service: Connection test failed:', error);
        return { success: false, error: error.message };
      }
      
      console.log('🔍 WaktiAIV2Service: Connection test successful:', data);
      return { success: true };
      
    } catch (error) {
      console.error('🔍 WaktiAIV2Service: Connection test error:', error);
      return { success: false, error: error.message };
    }
  }

  static async getOrFetchQuota(userId: string): Promise<any> {
    try {
      console.log('📊 Fetching quota for user:', userId);
      
      const { data, error } = await supabase
        .from('ai_quotas')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }
      
      if (!data) {
        // Create default quota if none exists
        const defaultQuota = {
          user_id: userId,
          daily_limit: 100,
          daily_count: 0,
          last_reset: new Date().toISOString().split('T')[0]
        };
        
        const { data: newQuota, error: insertError } = await supabase
          .from('ai_quotas')
          .insert(defaultQuota)
          .select()
          .single();
        
        if (insertError) {
          throw insertError;
        }
        
        return {
          count: 0,
          limit: 100,
          usagePercentage: 0,
          remaining: 100
        };
      }
      
      return {
        count: data.daily_count || 0,
        limit: data.daily_limit || 100,
        usagePercentage: Math.round(((data.daily_count || 0) / (data.daily_limit || 100)) * 100),
        remaining: (data.daily_limit || 100) - (data.daily_count || 0)
      };
    } catch (error) {
      console.error('❌ Error fetching quota:', error);
      return {
        count: 0,
        limit: 100,
        usagePercentage: 0,
        remaining: 100
      };
    }
  }

  static async sendMessage(
    message: string, 
    userId: string, 
    language: string = 'en',
    conversationId?: string,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: AIMessage[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams?: any
  ): Promise<AIResponse> {
    try {
      console.log('🔄 WaktiAIV2Service: === SEND MESSAGE START ===');
      console.log('🔄 WaktiAIV2Service: Message:', message);
      console.log('🔄 WaktiAIV2Service: Active Trigger (SERVICE):', activeTrigger);
      console.log('🔄 WaktiAIV2Service: Text Gen Params:', textGenParams);
      console.log('🔄 WaktiAIV2Service: Confirm Search:', confirmSearch);
      console.log('🔄 WaktiAIV2Service: Language:', language);

      const payload = {
        message,
        userId,
        language,
        conversationId,
        inputType,
        conversationHistory,
        confirmSearch,
        activeTrigger,
        textGenParams
      };

      console.log('🔄 WaktiAIV2Service: === PAYLOAD TO EDGE FUNCTION ===');
      console.log('🔄 WaktiAIV2Service: Active Trigger in payload:', payload.activeTrigger);
      console.log('🔄 WaktiAIV2Service: Full payload:', JSON.stringify(payload, null, 2));

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: payload
      });

      console.log('🔄 WaktiAIV2Service: === EDGE FUNCTION RESPONSE ===');
      console.log('🔄 WaktiAIV2Service: Error:', error);
      console.log('🔄 WaktiAIV2Service: Data success:', data?.success);
      console.log('🔄 WaktiAIV2Service: Browsing used:', data?.browsingUsed);
      console.log('🔄 WaktiAIV2Service: Trigger mode returned:', data?.triggerMode);
      console.log('🔄 WaktiAIV2Service: Strict mode returned:', data?.strictMode);

      if (error) {
        console.error('🔄 WaktiAIV2Service: ❌ Edge function error:', error);
        throw error;
      }

      if (!data.success) {
        console.error('🔄 WaktiAIV2Service: ❌ AI processing failed:', data.error);
        throw new Error(data.error || 'AI processing failed');
      }

      console.log('🔄 WaktiAIV2Service: ✅ Message sent successfully');
      console.log('🔄 WaktiAIV2Service: Response length:', data.response?.length);

      return {
        response: data.response,
        conversationId: data.conversationId,
        intent: data.intent,
        confidence: data.confidence,
        actionTaken: data.actionTaken,
        actionResult: data.actionResult,
        imageUrl: data.imageUrl,
        browsingUsed: data.browsingUsed,
        browsingData: data.browsingData,
        quotaStatus: data.quotaStatus,
        requiresSearchConfirmation: data.requiresSearchConfirmation
      };

    } catch (error: any) {
      console.error('🔄 WaktiAIV2Service: ❌ Service error:', error);
      return {
        response: 'Sorry, I encountered an error processing your request. Please try again.',
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  static async sendMessageWithTrigger(
    message: string,
    conversationId?: string | null,
    language: string = 'en',
    inputType: 'text' | 'voice' = 'text',
    activeTrigger: TriggerMode = 'chat'
  ): Promise<AIResponse> {
    try {
      console.log('🔍 WaktiAIV2Service: Sending message with trigger:', activeTrigger);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }
      
      const payload = {
        message,
        userId: session.user.id,
        language,
        conversationId,
        inputType,
        activeTrigger
      };
      
      console.log('🔍 WaktiAIV2Service: Calling wakti-ai-v2-brain with trigger payload:', payload);
      
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: payload
      });
      
      if (error) {
        console.error('🔍 WaktiAIV2Service: wakti-ai-v2-brain error:', error);
        throw new Error(error.message || 'AI service error');
      }
      
      if (!data.success) {
        console.error('🔍 WaktiAIV2Service: wakti-ai-v2-brain returned failure:', data);
        throw new Error(data.error || 'AI processing failed');
      }
      
      console.log('🔍 WaktiAIV2Service: wakti-ai-v2-brain response:', data);
      
      return {
        response: data.response,
        conversationId: data.conversationId,
        intent: data.intent,
        confidence: data.confidence,
        actionTaken: data.actionTaken,
        actionResult: data.actionResult,
        imageUrl: data.imageUrl,
        browsingUsed: data.browsingUsed,
        browsingData: data.browsingData,
        quotaStatus: data.quotaStatus,
        requiresSearchConfirmation: data.requiresSearchConfirmation
      };
      
    } catch (error) {
      console.error('🔍 WaktiAIV2Service: Service error:', error);
      throw error;
    }
  }

  static async sendMessageWithSearchConfirmation(
    message: string,
    conversationId?: string | null,
    language: string = 'en',
    inputType: 'text' | 'voice' = 'text'
  ): Promise<AIResponse> {
    try {
      console.log('🔍 WaktiAIV2Service: Sending message with search confirmation');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }
      
      const payload = {
        message,
        userId: session.user.id,
        language,
        conversationId,
        inputType,
        confirmSearch: true,
        activeTrigger: 'search'
      };
      
      console.log('🔍 WaktiAIV2Service: Calling wakti-ai-v2-brain with search confirmation:', payload);
      
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: payload
      });
      
      if (error) {
        console.error('🔍 WaktiAIV2Service: wakti-ai-v2-brain error:', error);
        throw new Error(error.message || 'AI service error');
      }
      
      if (!data.success) {
        console.error('🔍 WaktiAIV2Service: wakti-ai-v2-brain returned failure:', data);
        throw new Error(data.error || 'AI processing failed');
      }
      
      console.log('🔍 WaktiAIV2Service: wakti-ai-v2-brain search confirmation response:', data);
      
      return {
        response: data.response,
        conversationId: data.conversationId,
        intent: data.intent,
        confidence: data.confidence,
        actionTaken: data.actionTaken,
        actionResult: data.actionResult,
        imageUrl: data.imageUrl,
        browsingUsed: data.browsingUsed,
        browsingData: data.browsingData,
        quotaStatus: data.quotaStatus,
        requiresSearchConfirmation: data.requiresSearchConfirmation
      };
      
    } catch (error) {
      console.error('🔍 WaktiAIV2Service: Service error:', error);
      throw error;
    }
  }

  // Updated to limit to 5 conversations and ensure proper ordering
  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }
      
      console.log('📋 Fetching recent conversations (max 5)...');
      
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_message_at', { ascending: false })
        .limit(5); // Limit to 5 most recent conversations
      
      if (error) {
        throw error;
      }
      
      console.log(`📋 Retrieved ${data?.length || 0} conversations`);
      return data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  static async getConversationMessages(conversationId: string): Promise<any[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }
      
      console.log('🗑️ Deleting conversation:', conversationId);
      
      // Delete chat history first (foreign key constraint)
      await supabase
        .from('ai_chat_history')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id);
      
      // Delete conversation
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', session.user.id);
      
      if (error) {
        throw error;
      }
      
      // Clear session if this was the current conversation
      const currentConversationId = this.getCurrentConversationId();
      if (currentConversationId === conversationId) {
        this.clearChatSession();
      }
      
      console.log('✅ Conversation deleted successfully');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // Cleanup old conversations manually
  static async cleanupExpiredConversations(): Promise<void> {
    try {
      console.log('🧹 Starting manual conversation cleanup...');
      
      const { error } = await supabase.functions.invoke('cleanup-ai-conversations');
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Manual cleanup completed');
    } catch (error) {
      console.error('❌ Manual cleanup failed:', error);
      throw error;
    }
  }
}
