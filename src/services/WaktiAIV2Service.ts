
import { AIMessage, AIConversation } from '@/types/wakti-ai';
import { supabase } from '@/integrations/supabase/client';

// Export the types for other components to use
export type { AIMessage, AIConversation };

export class WaktiAIV2Service {
  private static quotaCache: { [userId: string]: any } = {};
  private static conversationCache: { [userId: string]: any[] } = {};

  static async getOrFetchQuota(userId: string, forceRefresh: boolean = false): Promise<any> {
    if (this.quotaCache[userId] && !forceRefresh) {
      console.log('📊 Returning cached quota for user:', userId);
      return this.quotaCache[userId];
    }

    try {
      console.log('📊 Fetching quota from Supabase for user:', userId);
      const { data, error } = await supabase
        .from('ai_quota')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching quota from Supabase:', error);
        throw error;
      }

      this.quotaCache[userId] = data;
      return data;
    } catch (error) {
      console.error('❌ Error in getOrFetchQuota:', error);
      throw error;
    }
  }

  static invalidateQuotaCache() {
    this.quotaCache = {};
    console.log('🗑️  Quota cache invalidated');
  }

  static async getConversations(): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (this.conversationCache[user.id]) {
        console.log('💬 Returning cached conversations for user:', user.id);
        return this.conversationCache[user.id];
      }

      console.log('💬 Fetching conversations from Supabase for user:', user.id);

      const { data, error } = await supabase
        .from('ai_chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching conversations from Supabase:', error);
        throw error;
      }

      this.conversationCache[user.id] = data;
      return data;
    } catch (error) {
      console.error('❌ Error in getConversations:', error);
      return [];
    }
  }

  static async getConversationMessages(conversationId: string): Promise<any[]> {
    try {
      console.log('📚 Fetching messages for conversation:', conversationId);

      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching messages from Supabase:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ Error in getConversationMessages:', error);
      return [];
    }
  }

  static async ensureConversationExists(userId: string, messages: AIMessage[], language: string): Promise<string | null> {
    try {
      console.log('🆕 Ensuring conversation exists for user:', userId);

      const firstUserMessage = messages.find(msg => msg.role === 'user');
      const title = firstUserMessage ? firstUserMessage.content.substring(0, 50) : 'New Conversation';

      const { data, error } = await supabase
        .from('ai_chat_conversations')
        .insert([{
          user_id: userId,
          title: title,
          language: language,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error creating conversation in Supabase:', error);
        throw error;
      }

      this.conversationCache[userId] = null;
      return data.id;
    } catch (error) {
      console.error('❌ Error in ensureConversationExists:', error);
      return null;
    }
  }

  static async updateConversationTimestamp(conversationId: string): Promise<void> {
    try {
      console.log('⏱️  Updating timestamp for conversation:', conversationId);

      const { error } = await supabase
        .from('ai_chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) {
        console.error('❌ Error updating conversation timestamp in Supabase:', error);
        throw error;
      }

      this.invalidateConversationCache();
    } catch (error) {
      console.error('❌ Error in updateConversationTimestamp:', error);
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      console.log('🗑️  Deleting conversation:', conversationId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('ai_chat_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.error('❌ Error deleting conversation from Supabase:', error);
        throw error;
      }

      this.invalidateConversationCache();
    } catch (error) {
      console.error('❌ Error in deleteConversation:', error);
    }
  }

  static invalidateConversationCache() {
    this.quotaCache = {};
    console.log('🗑️  Conversation cache invalidated');
  }

  static async saveCurrentConversationIfNeeded(userId: string, messages: AIMessage[], conversationId: string | null, language: string): Promise<void> {
    if (conversationId) {
      console.log('💾 Conversation already exists, skipping save');
      return;
    }

    try {
      console.log('💾 Saving current conversation for user:', userId);

      const firstUserMessage = messages.find(msg => msg.role === 'user');
      const title = firstUserMessage ? firstUserMessage.content.substring(0, 50) : 'New Conversation';

      const { data, error } = await supabase
        .from('ai_chat_conversations')
        .insert([{
          user_id: userId,
          title: title,
          language: language,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error creating conversation in Supabase:', error);
        throw error;
      }

      const newConversationId = data.id;

      for (const message of messages) {
        await supabase
          .from('ai_chat_history')
          .insert({
            conversation_id: newConversationId,
            user_id: userId,
            role: message.role,
            content: message.content,
            created_at: message.timestamp.toISOString(),
            language: language,
            input_type: message.inputType || 'text',
            intent: message.intent,
            confidence_level: message.confidence,
            action_taken: message.actionTaken ? String(message.actionTaken) : null,
            browsing_used: message.browsingUsed || false,
            browsing_data: message.browsingData || null,
            quota_status: message.quotaStatus || null,
            action_result: message.actionResult || null
          });
      }

      this.invalidateConversationCache();
      console.log('✅ Current conversation saved successfully');
    } catch (error) {
      console.error('❌ Error in saveCurrentConversationIfNeeded:', error);
    }
  }

  static async sendMessage(
    message: string,
    userId: string,
    language: string,
    conversationId: string | null = null,
    inputType: 'text' | 'voice' = 'text',
    context: AIMessage[] = [],
    includeContext: boolean = true,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = [],
    calendarContext: any = null,
    userContext: any = null,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    taskData: any = null,
    reminderData: any = null
  ) {
    try {
      console.log('🔄 WAKTI AI V2.5: Sending message to unified brain...', {
        message: message.slice(0, 100),
        activeTrigger,
        inputType,
        contextLength: context.length,
        hasCalendarContext: !!calendarContext,
        hasUserContext: !!userContext,
        confirmTask,
        confirmReminder
      });

      // Skip the informational message for search mode - go directly to search
      if (activeTrigger === 'search' && message.trim() && !confirmTask && !confirmReminder) {
        console.log('🔍 Direct search mode - bypassing informational message');
      }

      const requestData = {
        message,
        user_id: userId,
        language,
        conversation_id: conversationId,
        input_type: inputType,
        context: includeContext ? context : [],
        active_trigger: activeTrigger,
        text_gen_params: textGenParams,
        attached_files: attachedFiles || [],
        calendar_context: calendarContext,
        user_context: userContext,
        confirm_task: confirmTask,
        confirm_reminder: confirmReminder,
        task_data: taskData,
        reminder_data: reminderData,
        // Add flag to skip informational messages for direct search
        direct_search: activeTrigger === 'search' && message.trim() && !confirmTask && !confirmReminder
      };

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: requestData
      });

      if (error) {
        console.error('❌ WAKTI AI V2.5: Supabase function error:', error);
        throw new Error(error.message || 'Failed to process request');
      }

      if (!data) {
        console.error('❌ WAKTI AI V2.5: No data received from function');
        throw new Error('No response received from AI service');
      }

      console.log('✅ WAKTI AI V2.5: Response received:', {
        hasResponse: !!data.response,
        responseLength: data.response?.length,
        intent: data.intent,
        confidence: data.confidence,
        actionTaken: data.actionTaken,
        browsingUsed: data.browsingUsed,
        hasQuotaStatus: !!data.quotaStatus,
        conversationId: data.conversationId
      });

      return {
        response: data.response || '',
        intent: data.intent,
        confidence: data.confidence,
        actionTaken: data.actionTaken,
        browsingUsed: data.browsingUsed,
        browsingData: data.browsingData,
        quotaStatus: data.quotaStatus,
        conversationId: data.conversationId,
        requiresSearchConfirmation: data.requiresSearchConfirmation,
        imageUrl: data.imageUrl,
        fileAnalysisResults: data.fileAnalysisResults,
        deepIntegration: data.deepIntegration,
        automationSuggestions: data.automationSuggestions,
        predictiveInsights: data.predictiveInsights,
        workflowActions: data.workflowActions,
        contextualActions: data.contextualActions,
        needsConfirmation: data.needsConfirmation,
        pendingTaskData: data.pendingTaskData,
        pendingReminderData: data.pendingReminderData,
        actionResult: data.actionResult,
        error: null
      };

    } catch (error: any) {
      console.error('❌ WAKTI AI V2.5: Service error:', error);
      return {
        response: '',
        intent: 'error',
        confidence: 'low' as const,
        actionTaken: false,
        browsingUsed: false,
        browsingData: null,
        quotaStatus: null,
        conversationId: null,
        requiresSearchConfirmation: false,
        imageUrl: null,
        fileAnalysisResults: [],
        deepIntegration: null,
        automationSuggestions: [],
        predictiveInsights: null,
        workflowActions: [],
        contextualActions: [],
        needsConfirmation: false,
        pendingTaskData: null,
        pendingReminderData: null,
        actionResult: null,
        error: error.message || 'Failed to send message'
      };
    }
  }

  static async sendMessageWithSearchConfirmation(
    message: string,
    conversationId: string | null,
    language: string
  ): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const requestData = {
        message,
        user_id: user.id,
        language,
        conversation_id: conversationId,
        search_confirmation: true
      };

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: requestData
      });

      if (error) {
        console.error('Error calling Supabase function:', error);
        throw new Error(error.message || 'Failed to process request');
      }

      if (!data) {
        throw new Error('No response received from AI service');
      }

      return {
        response: data.response || '',
        intent: data.intent,
        confidence: data.confidence,
        actionTaken: data.actionTaken,
        browsingUsed: data.browsingUsed,
        browsingData: data.browsingData,
        quotaStatus: data.quotaStatus,
        conversationId: data.conversationId,
        requiresSearchConfirmation: data.requiresSearchConfirmation,
        imageUrl: data.imageUrl,
        error: null
      };

    } catch (error: any) {
      console.error('Service error:', error);
      return {
        response: '',
        intent: 'error',
        confidence: 'low' as const,
        actionTaken: false,
        browsingUsed: false,
        browsingData: null,
        quotaStatus: null,
        conversationId: null,
        requiresSearchConfirmation: false,
        imageUrl: null,
        error: error.message || 'Failed to send message'
      };
    }
  }

  static saveChatSession(messages: AIMessage[], conversationId: string | null) {
    try {
      const sessionData = {
        messages: messages,
        conversationId: conversationId
      };
      localStorage.setItem('chatSession', JSON.stringify(sessionData));
      console.log('💾 Chat session saved to local storage');
    } catch (error) {
      console.error('❌ Error saving chat session to local storage:', error);
    }
  }

  static loadChatSession(): { messages: AIMessage[], conversationId: string | null } | null {
    try {
      const sessionData = localStorage.getItem('chatSession');
      if (sessionData) {
        const parsedSession = JSON.parse(sessionData);
        console.log('📂 Chat session loaded from local storage');
        return parsedSession;
      }
      return null;
    } catch (error) {
      console.error('❌ Error loading chat session from local storage:', error);
      return null;
    }
  }

  static clearChatSession() {
    try {
      localStorage.removeItem('chatSession');
      console.log('🗑️  Chat session cleared from local storage');
    } catch (error) {
      console.error('❌ Error clearing chat session from local storage:', error);
    }
  }

  static async getCalendarContext(userId: string): Promise<any | null> {
    try {
      console.log('📅 Fetching calendar context for user:', userId);

      const { data, error } = await supabase.functions.invoke('get-calendar-context', {
        body: { user_id: userId }
      });

      if (error) {
        console.error('❌ Error fetching calendar context:', error);
        return null;
      }

      console.log('📅 Calendar context fetched successfully');
      return data;
    } catch (error) {
      console.error('❌ Error in getCalendarContext:', error);
      return null;
    }
  }

  static async getUserContext(userId: string): Promise<any | null> {
    try {
      console.log('👤 Fetching user context for user:', userId);

      const { data, error } = await supabase.functions.invoke('get-user-context', {
        body: { user_id: userId }
      });

      if (error) {
        console.error('❌ Error fetching user context:', error);
        return null;
      }

      console.log('👤 User context fetched successfully');
      return data;
    } catch (error) {
      console.error('❌ Error in getUserContext:', error);
      return null;
    }
  }

  static async clearChatMemory(userId: string): Promise<void> {
    try {
      console.log('🧠 Clearing chat memory for user:', userId);

      const { error } = await supabase.functions.invoke('clear-chat-memory', {
        body: { user_id: userId }
      });

      if (error) {
        console.error('❌ Error clearing chat memory:', error);
        throw error;
      }

      console.log('🧠 Chat memory cleared successfully');
    } catch (error) {
      console.error('❌ Error in clearChatMemory:', error);
    }
  }

  static async confirmTaskCreation(
    userId: string,
    language: string,
    taskData: any
  ): Promise<any> {
    try {
      console.log('✅ Confirming task creation:', taskData);

      const response = await WaktiAIV2Service.sendMessage(
        'confirm_task',
        userId,
        language,
        null,
        'text',
        [],
        false,
        'chat',
        null,
        [],
        null,
        null,
        true,
        false,
        taskData,
        null
      );

      return response;
    } catch (error: any) {
      console.error('❌ Error confirming task creation:', error);
      return {
        error: error.message || 'Failed to confirm task creation'
      };
    }
  }

  static async confirmReminderCreation(
    userId: string,
    language: string,
    reminderData: any
  ): Promise<any> {
    try {
      console.log('✅ Confirming reminder creation:', reminderData);

      const response = await WaktiAIV2Service.sendMessage(
        'confirm_reminder',
        userId,
        language,
        null,
        'text',
        [],
        false,
        'chat',
        null,
        [],
        null,
        null,
        false,
        true,
        null,
        reminderData
      );

      return response;
    } catch (error: any) {
      console.error('❌ Error confirming reminder creation:', error);
      return {
        error: error.message || 'Failed to confirm reminder creation'
      };
    }
  }
}
