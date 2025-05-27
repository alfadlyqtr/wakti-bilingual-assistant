
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
  // Send message to AI V2.1 Brain
  static async sendMessage(
    message: string,
    conversationId?: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<AIResponse> {
    return await callEdgeFunctionWithRetry<AIResponse>('wakti-ai-v2-brain', {
      body: {
        message,
        conversationId,
        language
      }
    });
  }

  // Enhanced voice transcription
  static async transcribeVoice(
    audioData: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<TranscriptionResponse> {
    return await callEdgeFunctionWithRetry<TranscriptionResponse>('wakti-voice-v2', {
      body: {
        audioData,
        language
      }
    });
  }

  // Get all conversations
  static async getConversations(): Promise<AIConversation[]> {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data || [];
  }

  // Get conversation messages
  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    const { data, error } = await supabase
      .from('ai_chat_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
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
  }

  // Delete conversation
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
}
