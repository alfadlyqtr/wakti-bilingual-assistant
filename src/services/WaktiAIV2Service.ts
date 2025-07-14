
import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean | null;
  inputType?: 'text' | 'voice' | 'vision';
  imageUrl?: string;
  browsingUsed?: boolean;
  browsingData?: any;
  attachedFiles?: any[];
  isTextGenerated?: boolean;
}

export interface AIConversation {
  id: string;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}

class WaktiAIV2ServiceClass {
  private saveQueue: Array<() => Promise<void>> = [];
  private processing = false;

  constructor() {
    this.startBackgroundProcessor();
  }

  private startBackgroundProcessor() {
    setInterval(async () => {
      if (this.processing || this.saveQueue.length === 0) return;
      
      this.processing = true;
      const tasks = [...this.saveQueue];
      this.saveQueue.length = 0;
      
      try {
        await Promise.allSettled(tasks.map(task => task()));
        console.log('✅ SIMPLIFIED MEMORY: Background processed', tasks.length, 'tasks');
      } catch (error) {
        console.warn('Background save failed:', error);
      } finally {
        this.processing = false;
      }
    }, 1000);
  }

  private async getOrCreateConversation(userId: string, existingConversationId?: string | null): Promise<string> {
    if (existingConversationId) {
      return existingConversationId;
    }

    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: userId,
          title: 'WAKTI AI Conversation',
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.warn('Conversation creation failed:', error);
        return `fallback-${Date.now()}`;
      }
      
      console.log('✅ SIMPLIFIED MEMORY: New conversation created:', data.id);
      return data.id;
    } catch (error) {
      console.warn('Conversation creation error:', error);
      return `fallback-${Date.now()}`;
    }
  }

  async sendMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' | 'vision' = 'text',
    recentMessages: AIMessage[] = [],
    skipContextLoad: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = []
  ) {
    try {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      console.log('🚀 SIMPLIFIED MEMORY SYSTEM: Processing message with direct conversation history');

      const actualConversationId = await this.getOrCreateConversation(userId, conversationId);

      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        inputType: inputType,
        attachedFiles: attachedFiles
      };

      const personalTouch = this.getPersonalTouch();

      const { data, error } = await Promise.race([
        supabase.functions.invoke('wakti-ai-v2-brain', {
          body: {
            message,
            userId,
            language,
            conversationId: actualConversationId,
            inputType,
            activeTrigger,
            attachedFiles,
            conversationSummary: '',
            recentMessages: [],
            personalTouch: personalTouch,
            customSystemPrompt: '',
            maxTokens: 4096,
            userStyle: 'detailed',
            userTone: 'neutral',
            speedOptimized: true,
            aggressiveOptimization: false,
            hasTaskIntent: false,
            personalityEnabled: true,
            enableTaskCreation: true,
            enablePersonality: true,
            memoryEnabled: true,
            integratedContext: null
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI request timeout - please try again')), 25000)
        )
      ]) as any;

      if (error) {
        console.error('❌ SIMPLIFIED MEMORY: AI service error:', error);
        throw error;
      }

      const assistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an issue processing your request.',
        timestamp: new Date(),
        intent: data.intent,
        confidence: data.confidence as 'high' | 'medium' | 'low',
        actionTaken: data.actionTaken,
        imageUrl: data.imageUrl,
        browsingUsed: data.browsingUsed,
        browsingData: data.browsingData
      };

      // Simple message saving without complex memory processing
      this.queueMessageSave(userId, actualConversationId, userMessage, assistantMessage);

      console.log('✅ SIMPLIFIED MEMORY SYSTEM: Message processed with direct conversation history');

      return {
        ...data,
        conversationId: actualConversationId,
        response: assistantMessage.content
      };

    } catch (error: any) {
      console.error('❌ SIMPLIFIED MEMORY: AI Service Error:', error);
      throw new Error(error.message || 'AI request failed');
    }
  }

  private queueMessageSave(userId: string, conversationId: string, message: AIMessage, response?: AIMessage) {
    this.saveQueue.push(async () => {
      try {
        if (conversationId.startsWith('fallback-')) {
          console.log('⚠️ SIMPLIFIED MEMORY: Skipping database save for fallback conversation');
          return;
        }

        const messagesToSave = response ? [message, response] : [message];
        
        const insertData = messagesToSave.map(msg => ({
          user_id: userId,
          conversation_id: conversationId,
          role: msg.role,
          content: msg.content,
          intent: msg.intent,
          confidence_level: msg.confidence,
          action_taken: msg.actionTaken,
          input_type: msg.inputType || 'text',
          browsing_used: msg.browsingUsed || false,
          browsing_data: msg.browsingData,
          metadata: {
            imageUrl: msg.imageUrl,
            attachedFiles: msg.attachedFiles
          }
        }));

        const { error: insertError } = await supabase
          .from('ai_chat_history')
          .insert(insertData);

        if (insertError) {
          console.error('❌ SIMPLIFIED MEMORY: Database save failed:', insertError);
          return;
        }
        
        const { error: updateError } = await supabase
          .from('ai_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);

        if (updateError) {
          console.warn('⚠️ SIMPLIFIED MEMORY: Conversation timestamp update failed:', updateError);
        }
        
        console.log('✅ SIMPLIFIED MEMORY: Database saved', messagesToSave.length, 'messages');
      } catch (error) {
        console.error('❌ SIMPLIFIED MEMORY: Background message save failed:', error);
      }
    });
  }

  private getPersonalTouch() {
    try {
      const stored = localStorage.getItem('wakti_personal_touch');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  async getConversations(): Promise<AIConversation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, title, last_message_at, created_at')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || []).map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessageAt: new Date(conv.last_message_at),
        createdAt: new Date(conv.created_at)
      }));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  async getConversationMessages(conversationId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      return [];
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await Promise.all([
        supabase.from('ai_chat_history').delete().eq('conversation_id', conversationId),
        supabase.from('ai_conversations').delete().eq('id', conversationId)
      ]);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  saveChatSession(messages: AIMessage[], conversationId?: string | null) {
    try {
      const sessionData = {
        messages: messages.slice(-10),
        conversationId,
        timestamp: Date.now()
      };
      localStorage.setItem('wakti_ai_session', JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Session save failed:', error);
    }
  }

  loadChatSession(): { messages: AIMessage[], conversationId?: string | null } | null {
    try {
      const stored = localStorage.getItem('wakti_ai_session');
      if (!stored) return null;

      const sessionData = JSON.parse(stored);
      
      if (Date.now() - sessionData.timestamp > 24 * 60 * 60 * 1000) {
        this.clearChatSession();
        return null;
      }

      return {
        messages: sessionData.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        conversationId: sessionData.conversationId
      };
    } catch (error) {
      console.warn('Session load failed:', error);
      return null;
    }
  }

  clearChatSession() {
    try {
      localStorage.removeItem('wakti_ai_session');
    } catch (error) {
      console.warn('Session clear failed:', error);
    }
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
export { WaktiAIV2ServiceClass };
