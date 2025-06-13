import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: string;
  actionTaken?: string | boolean;
  actionResult?: any;
  needsConfirmation?: boolean;
  pendingTaskData?: any;
  pendingReminderData?: any;
  attachedFiles?: AttachedFile[];
  imageUrl?: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  preview?: string;
}

export interface AIConversation {
  id: string;
  title: string;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
}

export interface ChatSession {
  messages: AIMessage[];
  conversationId: string | null;
}

export class WaktiAIV2Service {
  // Enhanced chat memory service with local storage
  static formatForAI(exchanges: any[]) {
    const formatted = [];
    for (const exchange of exchanges) {
      formatted.push({ role: 'user', content: exchange.user_message });
      formatted.push({ role: 'assistant', content: exchange.ai_response });
    }
    return formatted;
  }
  
  static loadChatMemory(userId: string) {
    try {
      const key = `wakti_chat_memory_${userId}`;
      const stored = localStorage?.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static saveChatMemory(userMsg: string, aiResponse: string, userId: string) {
    try {
      const key = `wakti_chat_memory_${userId}`;
      const existing = JSON.parse(localStorage?.getItem(key) || '[]');
      existing.push({
        user_message: userMsg,
        ai_response: aiResponse,
        timestamp: new Date().toISOString()
      });
      const recent = existing.slice(-20); // Keep last 20 exchanges
      localStorage?.setItem(key, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to save chat memory:', error);
    }
  }

  static loadChatSession(): ChatSession | null {
    try {
      const stored = localStorage.getItem('wakti_ai_chat_session');
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        messages: parsed.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      };
    } catch (error) {
      console.error('Error loading chat session:', error);
      return null;
    }
  }

  static saveChatSession(messages: AIMessage[], conversationId: string | null) {
    try {
      const session: ChatSession = {
        messages,
        conversationId
      };
      localStorage.setItem('wakti_ai_chat_session', JSON.stringify(session));
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }

  static clearChatSession() {
    try {
      localStorage.removeItem('wakti_ai_chat_session');
    } catch (error) {
      console.error('Error clearing chat session:', error);
    }
  }

  static async sendMessage(
    message: string,
    options: {
      language?: string;
      conversationId?: string | null;
      inputType?: string;
      conversationHistory?: any[];
      confirmSearch?: boolean;
      activeTrigger?: string;
      textGenParams?: any;
      attachedFiles?: AttachedFile[];
      calendarContext?: any;
      userContext?: any;
      enableAdvancedIntegration?: boolean;
      enablePredictiveInsights?: boolean;
      enableWorkflowAutomation?: boolean;
      confirmTask?: boolean;
      confirmReminder?: boolean;
      pendingTaskData?: any;
      pendingReminderData?: any;
    } = {}
  ) {
    try {
      // Get current user for chat memory
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Load chat memory from localStorage
      const memoryExchanges = this.loadChatMemory(user.id);
      const chatMemory = this.formatForAI(memoryExchanges);

      console.log('🚀 WaktiAIV2Service: Sending message with chat memory:', chatMemory.length, 'messages');

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          language: options.language || 'en',
          conversationId: options.conversationId,
          inputType: options.inputType || 'text',
          conversationHistory: options.conversationHistory || [],
          confirmSearch: options.confirmSearch || false,
          activeTrigger: options.activeTrigger || 'chat',
          textGenParams: options.textGenParams,
          attachedFiles: options.attachedFiles || [],
          calendarContext: options.calendarContext,
          userContext: options.userContext,
          enableAdvancedIntegration: options.enableAdvancedIntegration !== false,
          enablePredictiveInsights: options.enablePredictiveInsights !== false,
          enableWorkflowAutomation: options.enableWorkflowAutomation !== false,
          confirmTask: options.confirmTask || false,
          confirmReminder: options.confirmReminder || false,
          pendingTaskData: options.pendingTaskData,
          pendingReminderData: options.pendingReminderData,
          chatMemory: chatMemory // Send chat memory data to edge function
        }
      });

      if (error) {
        console.error('❌ WaktiAIV2Service: Edge function error:', error);
        throw error;
      }

      console.log('✅ WaktiAIV2Service: Response received from edge function');

      // Save to chat memory if this was a chat mode interaction
      if (options.activeTrigger === 'chat' && data?.response) {
        this.saveChatMemory(message, data.response, user.id);
      }

      return data;
    } catch (error: any) {
      console.error('❌ WaktiAIV2Service: Error sending message:', error);
      throw error;
    }
  }

  static async confirmTaskCreation(userId: string, language: string, pendingTask: any) {
    try {
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message: '',
          userId,
          language,
          confirmTask: true,
          pendingTaskData: pendingTask
        }
      });

      if (error) {
        console.error('❌ WaktiAIV2Service: Task confirmation error:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('❌ WaktiAIV2Service: Error confirming task:', error);
      throw error;
    }
  }

  static async confirmReminderCreation(userId: string, language: string, pendingReminder: any) {
    try {
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message: '',
          userId,
          language,
          confirmReminder: true,
          pendingReminderData: pendingReminder
        }
      });

      if (error) {
        console.error('❌ WaktiAIV2Service: Reminder confirmation error:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('❌ WaktiAIV2Service: Error confirming reminder:', error);
      throw error;
    }
  }

  static async createConversation(title: string): Promise<AIConversation> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          title,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        title: data.title,
        createdAt: new Date(data.created_at),
        lastMessageAt: new Date(data.last_message_at),
        messageCount: 0
      };
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select(`
          id,
          title,
          created_at,
          last_message_at,
          ai_chat_history(count)
        `)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      return data.map(conv => ({
        id: conv.id,
        title: conv.title,
        createdAt: new Date(conv.created_at),
        lastMessageAt: new Date(conv.last_message_at),
        messageCount: conv.ai_chat_history?.[0]?.count || 0
      }));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        confidence: msg.confidence,
        actionTaken: msg.action_taken,
        actionResult: msg.action_result
      }));
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  }
}
