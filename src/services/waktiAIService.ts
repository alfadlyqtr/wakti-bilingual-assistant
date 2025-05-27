
import { supabase, callEdgeFunctionWithRetry } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  confidence_level?: 'high' | 'medium' | 'low';
  action_taken?: string;
  action_result?: any;
  input_type: 'text' | 'voice';
  language: 'en' | 'ar';
  metadata?: any;
  created_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
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
}

export class WaktiAIService {
  // Send message to AI and get response
  static async sendMessage(
    message: string,
    conversationId?: string,
    language: 'en' | 'ar' = 'en',
    inputType: 'text' | 'voice' = 'text'
  ): Promise<AIResponse> {
    return await callEdgeFunctionWithRetry<AIResponse>('wakti-ai-brain', {
      body: {
        message,
        conversationId,
        language,
        inputType
      }
    });
  }

  // Transcribe voice input
  static async transcribeVoice(
    audioData: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<TranscriptionResponse> {
    return await callEdgeFunctionWithRetry<TranscriptionResponse>('wakti-voice-transcription', {
      body: {
        audioData,
        language
      }
    });
  }

  // Get all conversations for current user
  static async getConversations(): Promise<AIConversation[]> {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  }

  // Get messages for a specific conversation
  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    const { data, error } = await supabase
      .from('ai_chat_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Delete a conversation
  static async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;
  }

  // Update conversation title
  static async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('ai_conversations')
      .update({ title })
      .eq('id', conversationId);

    if (error) throw error;
  }

  // Get recent chat history for context (last 5 messages)
  static async getRecentContext(conversationId?: string): Promise<Partial<AIMessage>[]> {
    if (!conversationId) return [];

    const { data, error } = await supabase
      .from('ai_chat_history')
      .select('role, content, intent, action_result')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    return data || [];
  }

  // Clean up old conversations (keep last 50)
  static async cleanupOldConversations(): Promise<void> {
    const { error } = await supabase.rpc('cleanup_old_conversations');
    if (error) throw error;
  }

  // Check if AI services are available
  static async checkAIAvailability(): Promise<{ deepseek: boolean; openai: boolean }> {
    try {
      const response = await callEdgeFunctionWithRetry<{ deepseek: boolean; openai: boolean }>('check-ai-availability', {});
      return response;
    } catch (error) {
      console.error('Error checking AI availability:', error);
      return { deepseek: false, openai: false };
    }
  }

  // Generate image using AI
  static async generateImage(prompt: string): Promise<{ imageUrl: string; prompt: string }> {
    return await callEdgeFunctionWithRetry<{ imageUrl: string; prompt: string }>('generate-image', {
      body: { prompt }
    });
  }

  // Execute specific actions
  static async executeAction(
    action: string,
    params: any,
    conversationId: string
  ): Promise<any> {
    return await callEdgeFunctionWithRetry('wakti-execute-action', {
      body: {
        action,
        params,
        conversationId
      }
    });
  }
}
