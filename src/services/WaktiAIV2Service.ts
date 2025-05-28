import { supabase, callEdgeFunctionWithRetry } from '@/integrations/supabase/client';

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
  userContext?: any;
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
  userContext?: {
    userName: string;
    interests: string[];
    conversationCount: number;
    modelUsed?: string;
  };
}

export interface TranscriptionResponse {
  text: string;
  language: string;
  confidence: number;
}

export interface UserKnowledge {
  interests: string[];
  main_use?: string;
  role?: string;
  personal_note?: string;
}

export class WaktiAIV2Service {
  // Enhanced send message with context awareness
  static async sendMessage(
    message: string,
    conversationId?: string,
    language: 'en' | 'ar' = 'en',
    inputType: 'text' | 'voice' = 'text'
  ): Promise<AIResponse> {
    try {
      console.log('WAKTI AI V2.1 CLIENT: Sending enhanced message:', { 
        message: message.substring(0, 100), 
        conversationId, 
        language, 
        inputType 
      });
      
      const response = await callEdgeFunctionWithRetry<AIResponse>('wakti-ai-v2-brain', {
        body: {
          message,
          conversationId,
          language,
          inputType
        }
      });

      console.log('WAKTI AI V2.1 CLIENT: Enhanced response received:', {
        intent: response.intent,
        confidence: response.confidence,
        hasUserContext: !!response.userContext,
        userName: response.userContext?.userName,
        conversationCount: response.userContext?.conversationCount
      });
      
      // Enhanced response handling for image generation
      if (response.actionTaken === 'generate_image' && response.actionResult) {
        if (response.actionResult.imageUrl) {
          console.log('WAKTI AI V2.1 CLIENT: Image generated successfully');
        } else if (response.actionResult.error) {
          console.error('WAKTI AI V2.1 CLIENT: Image generation failed:', response.actionResult.error);
        }
      }

      return response;
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Enhanced error handling:', error);
      
      const errorMessage = language === 'ar' 
        ? 'عذراً، حدث خطأ في النظام المحسن. يرجى المحاولة مرة أخرى. 🔧'
        : 'Sorry, there was an error with the enhanced system. Please try again. 🔧';
      
      return {
        response: errorMessage,
        conversationId: conversationId || 'error',
        intent: 'error',
        confidence: 'low',
        needsConfirmation: false,
        needsClarification: true
      };
    }
  }

  // Enhanced voice transcription
  static async transcribeVoice(
    audioData: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<TranscriptionResponse> {
    try {
      console.log('WAKTI AI V2.1 CLIENT: Enhanced voice transcription:', { language });
      
      const response = await callEdgeFunctionWithRetry<TranscriptionResponse>('wakti-voice-v2', {
        body: {
          audioData,
          language
        }
      });

      console.log('WAKTI AI V2.1 CLIENT: Voice transcription result:', {
        textLength: response.text.length,
        confidence: response.confidence
      });
      
      return response;
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Voice transcription error:', error);
      return {
        text: '',
        language: language,
        confidence: 0
      };
    }
  }

  // Enhanced conversations with proper limit enforcement
  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(7); // Enforced limit of 7 conversations

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error fetching conversations:', error);
        return [];
      }

      console.log('WAKTI AI V2.1 CLIENT: Retrieved conversations:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in getConversations:', error);
      return [];
    }
  }

  // Enhanced conversation messages with metadata
  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error fetching messages:', error);
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
        userContext: msg.metadata
      }));
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in getConversationMessages:', error);
      return [];
    }
  }

  // User knowledge management
  static async getUserKnowledge(): Promise<UserKnowledge | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('ai_user_knowledge')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('WAKTI AI V2.1 CLIENT: Error fetching user knowledge:', error);
        return null;
      }

      return data ? {
        interests: data.interests || [],
        main_use: data.main_use,
        role: data.role,
        personal_note: data.personal_note
      } : null;
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in getUserKnowledge:', error);
      return null;
    }
  }

  static async updateUserKnowledge(knowledge: Partial<UserKnowledge>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('ai_user_knowledge')
        .upsert({
          user_id: user.id,
          ...knowledge,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('WAKTI AI V2.1 CLIENT: Error updating user knowledge:', error);
        throw error;
      }

      console.log('WAKTI AI V2.1 CLIENT: User knowledge updated successfully');
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in updateUserKnowledge:', error);
      throw error;
    }
  }

  // ... keep existing code (deleteConversation, updateConversationTitle, testConnection methods remain the same)

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
      const testMessage = "Hello, testing enhanced AI system";
      const response = await this.sendMessage(testMessage);
      
      if (response.response && !response.response.includes('system error')) {
        return { 
          success: true, 
          error: `Connected successfully. User: ${response.userContext?.userName}, Model: ${response.userContext?.modelUsed}` 
        };
      } else {
        return { success: false, error: 'AI service returned error response' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
