import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: string;
  inputType?: 'text' | 'voice';
  imageUrl?: string;
  browsingUsed?: boolean;
  browsingData?: {
    hasResults: boolean;
    imageUrl?: string;
    sources?: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  };
  quotaStatus?: {
    count: number;
    limit: number;
    usagePercentage: number;
    remaining: number;
  };
}

export interface AIConversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

export interface AIResponse {
  response: string;
  conversationId: string;
  intent: string;
  confidence: 'high' | 'medium' | 'low';
  actionTaken?: string;
  actionResult?: any;
  needsConfirmation: boolean;
  needsClarification: boolean;
  isNewConversation?: boolean;
}

export interface TranscriptionResponse {
  text: string;
  language: string;
  confidence: number;
}

export class WaktiAIV2Service {
  static async sendMessage(
    message: string,
    conversationId?: string,
    language: 'en' | 'ar' = 'en',
    inputType: 'text' | 'voice' = 'text'
  ): Promise<AIResponse> {
    try {
      console.log('🔍 WAKTI AI CLIENT: Starting sendMessage with:', { 
        message, 
        conversationId, 
        language, 
        inputType 
      });
      
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          conversationId,
          language,
          inputType
        }
      });

      console.log('🔍 WAKTI AI CLIENT: Supabase response:', { data, error });

      if (error) {
        console.error('🔍 WAKTI AI CLIENT: Supabase error:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!data) {
        console.error('🔍 WAKTI AI CLIENT: No data received');
        throw new Error('No data received from AI service');
      }

      console.log('🔍 WAKTI AI CLIENT: Returning data:', data);
      return data;
      
    } catch (error) {
      console.error('🔍 WAKTI AI CLIENT: Error in sendMessage:', error);
      
      const fallbackResponse: AIResponse = {
        response: language === 'ar' 
          ? `عذراً، حدث خطأ: ${error.message || 'خطأ غير معروف'}`
          : `Sorry, there was an error: ${error.message || 'Unknown error'}`,
        conversationId: conversationId || 'error',
        intent: 'error',
        confidence: 'low',
        needsConfirmation: false,
        needsClarification: false
      };
      
      return fallbackResponse;
    }
  }

  static async getUserKnowledge(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('ai_user_knowledge')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('WAKTI AI V2.1 CLIENT: Error fetching user knowledge:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in getUserKnowledge:', error);
      return null;
    }
  }

  static async saveUserKnowledge(knowledge: {
    interests: string[];
    role?: string;
    main_use?: string;
    personal_note?: string;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_user_knowledge')
        .upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          ...knowledge
        });

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error saving user knowledge:', error);
        throw error;
      }
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in saveUserKnowledge:', error);
      throw error;
    }
  }

  static async transcribeVoice(
    audioData: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<TranscriptionResponse> {
    try {
      console.log('WAKTI AI V2.1 CLIENT: Transcribing voice input with enhanced processing:', { 
        language, 
        audioDataLength: audioData.length 
      });
      
      const { data, error } = await supabase.functions.invoke('wakti-voice-v2', {
        body: {
          audioData,
          language
        }
      });

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error from voice function:', error);
        throw error;
      }

      console.log('WAKTI AI V2.1 CLIENT: Enhanced voice transcription result:', data);
      return data;
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in enhanced transcribeVoice:', error);
      
      return {
        text: '',
        language: language,
        confidence: 0
      };
    }
  }

  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(7);

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error fetching conversations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in getConversations:', error);
      return [];
    }
  }

  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error fetching conversation messages:', error);
        return [];
      }
      
      return (data || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        confidence: msg.confidence_level as 'high' | 'medium' | 'low',
        actionTaken: msg.action_taken,
        inputType: msg.input_type as 'text' | 'voice',
        browsingUsed: msg.browsing_used,
        browsingData: msg.browsing_data,
        quotaStatus: msg.quota_status
      }));
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in getConversationMessages:', error);
      return [];
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { error: historyError } = await supabase
        .from('ai_chat_history')
        .delete()
        .eq('conversation_id', conversationId);

      if (historyError) {
        console.error('WAKTI AI V2.1 CLIENT: Error deleting chat history:', historyError);
        throw historyError;
      }

      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error deleting conversation:', error);
        throw error;
      }
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in deleteConversation:', error);
      throw error;
    }
  }

  static async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ title })
        .eq('id', conversationId);

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error updating conversation title:', error);
        throw error;
      }
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in updateConversationTitle:', error);
      throw error;
    }
  }

  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const testMessage = "Hello, are you working? Please respond naturally.";
      const response = await this.sendMessage(testMessage);
      
      if (response.response && !response.response.includes('system error')) {
        return { success: true };
      } else {
        return { success: false, error: 'AI service returned error response' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
