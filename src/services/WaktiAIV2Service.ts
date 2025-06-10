import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean | string;
  inputType?: 'text' | 'voice';
  browsingUsed?: boolean;
  browsingData?: any;
  quotaStatus?: any;
  requiresSearchConfirmation?: boolean;
  imageUrl?: string;
  isTextGenerated?: boolean;
  actionResult?: any;
  proactiveActions?: any[]; // Phase 3: Proactive suggestions
  userProfile?: any; // Phase 3: User learning data
}

export interface AIConversation {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;
}

export class WaktiAIV2Service {
  private static quotaCache: any = null;
  private static quotaCacheTime: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static saveChatSession(messages: AIMessage[], conversationId: string | null) {
    try {
      const sessionData = {
        messages: messages.slice(-20), // Keep only last 20 messages
        conversationId,
        timestamp: Date.now()
      };
      localStorage.setItem('wakti_ai_chat_session', JSON.stringify(sessionData));
      console.log('💾 Chat session saved to localStorage');
    } catch (error) {
      console.error('Failed to save chat session:', error);
    }
  }

  static loadChatSession(): { messages: AIMessage[], conversationId: string | null } | null {
    try {
      const sessionData = localStorage.getItem('wakti_ai_chat_session');
      if (!sessionData) return null;

      const parsed = JSON.parse(sessionData);
      
      // Check if session is too old (more than 24 hours)
      const now = Date.now();
      const sessionAge = now - (parsed.timestamp || 0);
      if (sessionAge > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('wakti_ai_chat_session');
        return null;
      }

      // Convert timestamp strings back to Date objects
      if (parsed.messages) {
        parsed.messages = parsed.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }

      console.log('📂 Chat session loaded from localStorage');
      return {
        messages: parsed.messages || [],
        conversationId: parsed.conversationId || null
      };
    } catch (error) {
      console.error('Failed to load chat session:', error);
      localStorage.removeItem('wakti_ai_chat_session');
      return null;
    }
  }

  static clearChatSession() {
    try {
      localStorage.removeItem('wakti_ai_chat_session');
      console.log('🗑️ Chat session cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear chat session:', error);
    }
  }

  static async sendMessage(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId: string | null = null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: AIMessage[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = []
  ): Promise<any> {
    try {
      console.log('🚀 WaktiAIV2Service.sendMessage called');
      console.log('🚀 Message:', message);
      console.log('🚀 Active Trigger:', activeTrigger);
      console.log('🚀 Attached Files:', attachedFiles?.length || 0);
      console.log('🚀 Conversation History:', conversationHistory?.length || 0);

      // Convert conversation history to the format expected by the edge function
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }));

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId,
          inputType,
          conversationHistory: formattedHistory,
          confirmSearch,
          activeTrigger,
          textGenParams,
          attachedFiles: attachedFiles || []
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(error.message || 'Failed to process message');
      }

      console.log('✅ WaktiAIV2Service.sendMessage success');
      return data;
    } catch (error) {
      console.error('❌ WaktiAIV2Service.sendMessage error:', error);
      throw error;
    }
  }

  // New method to confirm task creation
  static async confirmTaskCreation(
    userId: string,
    language: string = 'en',
    pendingTaskData: any
  ): Promise<any> {
    try {
      console.log('🔧 Confirming task creation:', pendingTaskData);

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message: '',
          userId,
          language,
          confirmTask: true,
          pendingTaskData
        }
      });

      if (error) {
        console.error('❌ Task confirmation error:', error);
        throw new Error(error.message || 'Failed to create task');
      }

      console.log('✅ Task creation confirmed');
      return data;
    } catch (error) {
      console.error('❌ Task confirmation error:', error);
      throw error;
    }
  }

  // New method to confirm reminder creation
  static async confirmReminderCreation(
    userId: string,
    language: string = 'en',
    pendingReminderData: any
  ): Promise<any> {
    try {
      console.log('🔔 Confirming reminder creation:', pendingReminderData);

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message: '',
          userId,
          language,
          confirmReminder: true,
          pendingReminderData
        }
      });

      if (error) {
        console.error('❌ Reminder confirmation error:', error);
        throw new Error(error.message || 'Failed to create reminder');
      }

      console.log('✅ Reminder creation confirmed');
      return data;
    } catch (error) {
      console.error('❌ Reminder confirmation error:', error);
      throw error;
    }
  }

  static async getOrFetchQuota(userId: string): Promise<any> {
    const now = Date.now();
    
    // Check cache first
    if (this.quotaCache && (now - this.quotaCacheTime) < this.CACHE_DURATION) {
      return this.quotaCache;
    }

    try {
      const { data, error } = await supabase.rpc('check_browsing_quota', {
        p_user_id: userId
      });
      
      if (error) {
        console.error("Quota check error:", error);
        return { count: 0, limit: 60, canBrowse: true, usagePercentage: 0, remaining: 60 };
      }
      
      const count = data || 0;
      const limit = 60;
      const usagePercentage = Math.round((count / limit) * 100);
      
      const quota = {
        count,
        limit,
        usagePercentage,
        remaining: Math.max(0, limit - count),
        canBrowse: count < limit,
        requiresConfirmation: usagePercentage >= 80
      };

      // Cache the result
      this.quotaCache = quota;
      this.quotaCacheTime = now;
      
      return quota;
    } catch (error) {
      console.error("Quota check error:", error);
      return { count: 0, limit: 60, canBrowse: true, usagePercentage: 0, remaining: 60 };
    }
  }

  static async getConversations(): Promise<AIConversation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  static async getConversationMessages(conversationId: string): Promise<any[]> {
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

  static async sendMessageWithSearchConfirmation(
    message: string,
    conversationId: string | null,
    language: string = 'en'
  ): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId: user.id,
          language,
          conversationId,
          confirmSearch: true,
          activeTrigger: 'search'
        }
      });

      if (error) throw new Error(error.message || 'Failed to process search confirmation');
      return data;
    } catch (error) {
      console.error('Error in search confirmation:', error);
      throw error;
    }
  }
}
