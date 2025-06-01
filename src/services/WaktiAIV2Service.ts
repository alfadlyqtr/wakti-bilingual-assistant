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
  isTextGenerated?: boolean; // Add this new field
}

export interface AIConversation {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
}

type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';

export class WaktiAIV2Service {
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔍 WaktiAIV2Service: Testing connection...');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }
      
      // Test with a simple echo message
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
        activeTrigger, // CRITICAL: Ensure this is passed through
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
        activeTrigger: 'search' // Force search mode for confirmation
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

  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_message_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
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
      
      // Delete chat history first
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
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }
}
