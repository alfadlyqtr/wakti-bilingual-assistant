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
  // Enhanced sendMessage with better user context handling
  static async sendMessage(
    message: string,
    conversationId?: string,
    language: 'en' | 'ar' = 'en',
    inputType: 'text' | 'voice' = 'text'
  ): Promise<AIResponse> {
    try {
      console.log('WAKTI AI V2.1 CLIENT: Sending enhanced message to brain:', { 
        message, 
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

      console.log('WAKTI AI V2.1 CLIENT: Received enhanced response from brain:', response);
      
      // Enhanced response handling for image generation (both English and Arabic)
      if (response.actionTaken === 'generate_image' && response.actionResult) {
        if (response.actionResult.imageUrl) {
          // For English image generation, add success message
          if (language === 'en') {
            response.response += `\n\n🎨 Image generated successfully!`;
          }
          // For Arabic, don't add anything since the backend already handles the translation message
        } else if (response.actionResult.error) {
          response.response += `\n\n❌ ${language === 'ar' 
            ? 'فشل في إنشاء الصورة: ' + response.actionResult.error
            : 'Image generation failed: ' + response.actionResult.error}`;
        }
      }

      return response;
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in enhanced sendMessage:', error);
      
      // Enhanced error handling with user-friendly messages
      let errorMessage = language === 'ar' 
        ? 'عذراً، حدث خطأ في النظام. يرجى المحاولة مرة أخرى. 🔧'
        : 'Sorry, there was a system error. Please try again. 🔧';
      
      // Provide more specific error messages based on error type
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = language === 'ar' 
          ? 'خطأ في المصادقة. يرجى إعادة تسجيل الدخول وإعادة المحاولة. 🔑'
          : 'Authentication error. Please log in again and try. 🔑';
      } else if (error.message?.includes('API key') || error.message?.includes('configuration')) {
        errorMessage = language === 'ar' 
          ? 'خطأ في إعدادات النظام. يرجى التواصل مع الدعم الفني. ⚙️'
          : 'System configuration error. Please contact support. ⚙️';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = language === 'ar' 
          ? 'خطأ في الاتصال. يرجى التحقق من الإنترنت والمحاولة مرة أخرى. 🌐'
          : 'Connection error. Please check your internet and try again. 🌐';
      }
      
      // Enhanced error handling with fallback response
      const fallbackResponse: AIResponse = {
        response: errorMessage,
        conversationId: conversationId || 'error',
        intent: 'error',
        confidence: 'low',
        needsConfirmation: false,
        needsClarification: true
      };
      
      return fallbackResponse;
    }
  }

  // New method to get user knowledge for personalization
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

  // New method to save user knowledge
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

  // Enhanced voice transcription with better error handling
  static async transcribeVoice(
    audioData: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<TranscriptionResponse> {
    try {
      console.log('WAKTI AI V2.1 CLIENT: Transcribing voice input with enhanced processing:', { 
        language, 
        audioDataLength: audioData.length 
      });
      
      const response = await callEdgeFunctionWithRetry<TranscriptionResponse>('wakti-voice-v2', {
        body: {
          audioData,
          language
        }
      });

      console.log('WAKTI AI V2.1 CLIENT: Enhanced voice transcription result:', response);
      return response;
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in enhanced transcribeVoice:', error);
      
      // Return fallback response
      return {
        text: '',
        language: language,
        confidence: 0
      };
    }
  }

  // Enhanced conversation management - limit to 7 conversations
  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(7); // Strictly enforce 7 conversation limit

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

  // Get conversation messages with proper error handling
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
        inputType: msg.input_type as 'text' | 'voice'
      }));
    } catch (error) {
      console.error('WAKTI AI V2.1 CLIENT: Error in getConversationMessages:', error);
      return [];
    }
  }

  // Delete conversation with proper error handling
  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Delete chat history first (due to foreign key constraints)
      const { error: historyError } = await supabase
        .from('ai_chat_history')
        .delete()
        .eq('conversation_id', conversationId);

      if (historyError) {
        console.error('WAKTI AI V2.1 CLIENT: Error deleting chat history:', historyError);
        throw historyError;
      }

      // Then delete the conversation
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

  // Update conversation title with proper error handling
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

  // Test API connectivity (new method for debugging)
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
