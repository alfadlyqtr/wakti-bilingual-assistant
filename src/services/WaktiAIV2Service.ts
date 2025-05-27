
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
}

export interface TranscriptionResponse {
  text: string;
  language: string;
  confidence: number;
}

export class WaktiAIV2Service {
  // Send message to AI V2.1 Brain with enhanced error handling
  static async sendMessage(
    message: string,
    conversationId?: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<AIResponse> {
    try {
      console.log('WAKTI AI V2.1: Sending message to brain:', { message, conversationId, language });
      
      const response = await callEdgeFunctionWithRetry<AIResponse>('wakti-ai-v2-brain', {
        body: {
          message,
          conversationId,
          language
        }
      });

      console.log('WAKTI AI V2.1: Received response from brain:', response);
      return response;
    } catch (error) {
      console.error('WAKTI AI V2.1: Error in sendMessage:', error);
      
      // Enhanced error handling with fallback response
      const fallbackResponse: AIResponse = {
        response: language === 'ar' 
          ? 'عذراً، حدث خطأ في النظام. يرجى المحاولة مرة أخرى. 🔧'
          : 'Sorry, there was a system error. Please try again. 🔧',
        conversationId: conversationId || 'error',
        intent: 'error',
        confidence: 'low',
        needsConfirmation: false,
        needsClarification: true
      };
      
      return fallbackResponse;
    }
  }

  // Enhanced voice transcription with better error handling
  static async transcribeVoice(
    audioData: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<TranscriptionResponse> {
    try {
      console.log('WAKTI AI V2.1: Transcribing voice input:', { language, audioDataLength: audioData.length });
      
      const response = await callEdgeFunctionWithRetry<TranscriptionResponse>('wakti-voice-v2', {
        body: {
          audioData,
          language
        }
      });

      console.log('WAKTI AI V2.1: Voice transcription result:', response);
      return response;
    } catch (error) {
      console.error('WAKTI AI V2.1: Error in transcribeVoice:', error);
      
      // Return fallback response
      return {
        text: '',
        language: language,
        confidence: 0
      };
    }
  }

  // Get all conversations with proper error handling
  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('WAKTI AI V2.1: Error fetching conversations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('WAKTI AI V2.1: Error in getConversations:', error);
      return [];
    }
  }

  // Get conversation messages with proper error handling
  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('WAKTI AI V2.1: Error fetching conversation messages:', error);
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
        inputType: msg.input_type as 'text' | 'voice'
      }));
    } catch (error) {
      console.error('WAKTI AI V2.1: Error in getConversationMessages:', error);
      return [];
    }
  }

  // Delete conversation with proper error handling
  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.error('WAKTI AI V2.1: Error deleting conversation:', error);
        throw error;
      }
    } catch (error) {
      console.error('WAKTI AI V2.1: Error in deleteConversation:', error);
      throw error;
    }
  }

  // Update conversation title with proper error handling
  static async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ title })
        .eq('id', conversationId);

      if (error) {
        console.error('WAKTI AI V2.1: Error updating conversation title:', error);
        throw error;
      }
    } catch (error) {
      console.error('WAKTI AI V2.1: Error in updateConversationTitle:', error);
      throw error;
    }
  }
}
