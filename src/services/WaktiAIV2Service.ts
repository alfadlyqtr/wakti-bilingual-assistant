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
  proactiveActions?: any[];
  userProfile?: any;
  deepIntegration?: any;
  automationSuggestions?: any[];
  predictiveInsights?: any;
  workflowActions?: any[];
  contextualActions?: any[];
  needsConfirmation?: boolean;
  pendingTaskData?: any;
  pendingReminderData?: any;
  attachedFiles?: any[];
  fileAnalysisResults?: any[];
  buddyChat?: {
    followUpSuggestion?: string;
    crossModeHint?: string;
    conversationContinuity?: string;
    engagement?: 'high' | 'medium' | 'low';
  };
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

export class WaktiAIV2ServiceClass {
  private static quotaCache: any = null;
  private static quotaCacheTime: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // SECURITY FIX: Get user-specific localStorage key
  private static getUserStorageKey(suffix: string): string {
    return `wakti_ai_${suffix}`;
  }

  // Helper: Convert any attachedFiles[] with `url` and no `content` to base64 format for vision models
  private static async convertFilesToBase64IfNeeded(attachedFiles: any[]): Promise<any[]> {
    if (!attachedFiles || !Array.isArray(attachedFiles) || attachedFiles.length === 0) return [];

    // Only process files that do NOT already have a 'content' field (already base64)
    const processed = await Promise.all(
      attachedFiles.map(async (file) => {
        if (file.content) {
          // Already in the correct format for vision
          return { type: file.type, content: file.content };
        }
        if (!file.url) {
          // Not a supported file, skip
          return null;
        }
        try {
          // Fetch the file from the public URL and convert to base64
          const response = await fetch(file.url);
          const blob = await response.blob();
          // Only image/* or plain text supported!
          if (!file.type.startsWith('image/') && file.type !== 'text/plain') return null;
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              // This gets the full data URL; strip the prefix to send only base64 part per OpenAI docs
              let result = reader.result as string;
              // Only keep the base64 content (for data:image/jpeg;base64,... OR data:text/plain;base64,...)
              const base64Index = result.indexOf('base64,');
              if (base64Index !== -1) result = result.substring(base64Index + 7);
              resolve({ type: file.type, content: result });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error('[WaktiAIV2Service] Failed to fetch and convert file to base64:', file.url, e);
          return null;
        }
      })
    );

    // Filter nulls (unsupported or failed)
    return processed.filter(Boolean);
  }

  // Instance methods that delegate to static methods
  saveChatSession(messages: AIMessage[], conversationId: string | null) {
    return WaktiAIV2ServiceClass.saveChatSession(messages, conversationId);
  }

  loadChatSession() {
    return WaktiAIV2ServiceClass.loadChatSession();
  }

  clearChatSession() {
    return WaktiAIV2ServiceClass.clearChatSession();
  }

  sendMessage(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: any[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = [],
    calendarContext: any = null,
    userContext: any = null,
    enableAdvancedIntegration: boolean = true,
    enablePredictiveInsights: boolean = true,
    enableWorkflowAutomation: boolean = true,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    pendingTaskData: any = null,
    pendingReminderData: any = null
  ) {
    return WaktiAIV2ServiceClass.sendMessage(
      message, userId, language, conversationId, inputType, conversationHistory,
      confirmSearch, activeTrigger, textGenParams, attachedFiles, calendarContext,
      userContext, enableAdvancedIntegration, enablePredictiveInsights,
      enableWorkflowAutomation, confirmTask, confirmReminder, pendingTaskData, pendingReminderData
    );
  }

  confirmTaskCreation(userId: string, language: string = 'en', pendingTaskData: any) {
    return WaktiAIV2ServiceClass.confirmTaskCreation(userId, language, pendingTaskData);
  }

  confirmReminderCreation(userId: string, language: string = 'en', pendingReminderData: any) {
    return WaktiAIV2ServiceClass.confirmReminderCreation(userId, language, pendingReminderData);
  }

  getOrFetchQuota(userId: string, forceRefresh: boolean = false) {
    return WaktiAIV2ServiceClass.getOrFetchQuota(userId, forceRefresh);
  }

  invalidateQuotaCache() {
    return WaktiAIV2ServiceClass.invalidateQuotaCache();
  }

  ensureConversationExists(userId: string, sessionMessages: AIMessage[], language: string = 'en') {
    return WaktiAIV2ServiceClass.ensureConversationExists(userId, sessionMessages, language);
  }

  updateConversationTimestamp(conversationId: string) {
    return WaktiAIV2ServiceClass.updateConversationTimestamp(conversationId);
  }

  saveCurrentConversationIfNeeded(userId: string, sessionMessages: AIMessage[], currentConversationId: string | null, language: string = 'en') {
    return WaktiAIV2ServiceClass.saveCurrentConversationIfNeeded(userId, sessionMessages, currentConversationId, language);
  }

  getCalendarContext(userId: string) {
    return WaktiAIV2ServiceClass.getCalendarContext(userId);
  }

  getUserContext(userId: string) {
    return WaktiAIV2ServiceClass.getUserContext(userId);
  }

  getConversations() {
    return WaktiAIV2ServiceClass.getConversations();
  }

  getConversationMessages(conversationId: string) {
    return WaktiAIV2ServiceClass.getConversationMessages(conversationId);
  }

  deleteConversation(conversationId: string) {
    return WaktiAIV2ServiceClass.deleteConversation(conversationId);
  }

  sendMessageWithSearchConfirmation(message: string, conversationId: string | null, language: string = 'en') {
    return WaktiAIV2ServiceClass.sendMessageWithSearchConfirmation(message, conversationId, language);
  }

  // SECURITY FIX: Enhanced static method for better conversation saving with user isolation
  static async ensureConversationExists(
    userId: string, 
    sessionMessages: AIMessage[], 
    language: string = 'en'
  ): Promise<string | null> {
    if (sessionMessages.length === 0) return null;

    try {
      const firstUserMessage = sessionMessages.find(msg => msg.role === 'user');
      const title = firstUserMessage?.content?.slice(0, 50) + '...' || 'Untitled Conversation';

      const { data: conversation, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: userId,
          title: title,
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error creating conversation in ensureConversationExists:', error);
        return null;
      }

      if (conversation) {
        console.log('✅ Created new conversation:', conversation.id);
        
        const messageInserts = sessionMessages.map((msg, index) => ({
          conversation_id: conversation.id,
          user_id: userId,
          role: msg.role,
          content: msg.content,
          created_at: new Date(Date.now() + index).toISOString(),
          language: language,
          input_type: msg.inputType || 'text',
          intent: msg.intent,
          confidence_level: msg.confidence,
          action_taken: msg.actionTaken ? String(msg.actionTaken) : null,
          browsing_used: msg.browsingUsed || false,
          browsing_data: msg.browsingData || null,
          quota_status: msg.quotaStatus || null,
          action_result: msg.actionResult || null
        }));

        const { error: messagesError } = await supabase
          .from('ai_chat_history')
          .insert(messageInserts);

        if (messagesError) {
          console.error('❌ Error saving messages in ensureConversationExists:', messagesError);
        } else {
          console.log('✅ Saved', messageInserts.length, 'messages to conversation');
        }

        return conversation.id;
      }
    } catch (error) {
      console.error('❌ Error in ensureConversationExists:', error);
    }

    return null;
  }

  // Enhanced static method for saving current conversation when starting new one
  static async saveCurrentConversationIfNeeded(
    userId: string,
    sessionMessages: AIMessage[],
    currentConversationId: string | null,
    language: string = 'en'
  ): Promise<void> {
    if (sessionMessages.length > 0 && !currentConversationId) {
      try {
        console.log('🔄 WAKTI AI V2: Saving unsaved conversation with', sessionMessages.length, 'messages for user:', userId);
        
        const conversationId = await this.ensureConversationExists(userId, sessionMessages, language);
        if (conversationId) {
          console.log('✅ Conversation saved successfully:', conversationId);
        }
      } catch (error) {
        console.error('❌ Error in saveCurrentConversationIfNeeded:', error);
      }
    }
  }

  // Enhanced method to update conversation timestamp
  static async updateConversationTimestamp(conversationId: string): Promise<void> {
    if (!conversationId) return;

    try {
      await supabase
        .from('ai_conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      console.log('✅ Updated conversation timestamp:', conversationId);
    } catch (error) {
      console.error('❌ Error updating conversation timestamp:', error);
    }
  }

  // SECURITY FIX: User-isolated session storage
  static saveChatSession(messages: AIMessage[], conversationId: string | null) {
    try {
      const sessionData = {
        messages: messages.slice(-30),
        conversationId,
        timestamp: Date.now()
      };
      
      const storageKey = this.getUserStorageKey('chat_session');
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
      console.log('💾 Chat session saved to localStorage with user isolation');
    } catch (error) {
      console.error('Failed to save chat session:', error);
    }
  }

  static loadChatSession(): { messages: AIMessage[], conversationId: string | null } | null {
    try {
      const storageKey = this.getUserStorageKey('chat_session');
      const sessionData = localStorage.getItem(storageKey);
      if (!sessionData) return null;

      const parsed = JSON.parse(sessionData);
      
      const now = Date.now();
      const sessionAge = now - (parsed.timestamp || 0);
      if (sessionAge > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return null;
      }

      if (parsed.messages) {
        parsed.messages = parsed.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }

      console.log('📂 Chat session loaded from localStorage with user isolation');
      return {
        messages: parsed.messages || [],
        conversationId: parsed.conversationId || null
      };
    } catch (error) {
      console.error('Failed to load chat session:', error);
      const storageKey = this.getUserStorageKey('chat_session');
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  static clearChatSession() {
    try {
      const storageKey = this.getUserStorageKey('chat_session');
      localStorage.removeItem(storageKey);
      console.log('🗑️ Chat session cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear chat session:', error);
    }
  }

  static async sendMessage(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: any[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = [],
    calendarContext: any = null,
    userContext: any = null,
    enableAdvancedIntegration: boolean = true,
    enablePredictiveInsights: boolean = true,
    enableWorkflowAutomation: boolean = true,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    pendingTaskData: any = null,
    pendingReminderData: any = null
  ) {
    try {
      console.log('📤 WAKTI AI V2: Sending DIRECT message for user:', userId);

      // --- BEGIN VISION LOGIC (convert attachedFiles with url to base64 if needed) ---
      let processedAttachedFiles = attachedFiles;
      if (attachedFiles && attachedFiles.length > 0) {
        const missingBase64 = attachedFiles.some(f => f.url && !f.content && f.type?.startsWith('image/'));
        if (missingBase64) {
          processedAttachedFiles = await this.convertFilesToBase64IfNeeded(attachedFiles);
          if (!processedAttachedFiles || processedAttachedFiles.length === 0) {
            console.warn('[WaktiAIV2Service] No image files were available after conversion. Proceeding without files.');
          }
        }
        console.log('🖼️ Final attached files sent to vision:', processedAttachedFiles.map(f => ({
          type: f.type,
          hasContent: !!f.content,
          contentSnippet: f.content ? ('' + f.content).substring(0, 24) : 'none'
        })));
      }
      // --- END CRITICAL VISION LOGIC ---

      // DIRECT CALL: Use the wakti-ai-v2-brain function directly - no optimization layers
      const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId,
          inputType,
          contextMessages: conversationHistory,
          confirmSearch,
          activeTrigger,
          textGenParams,
          attachedFiles: processedAttachedFiles,
          calendarContext,
          userContext,
          enableAdvancedIntegration,
          enablePredictiveInsights,
          enableWorkflowAutomation,
          confirmTask,
          confirmReminder,
          pendingTaskData,
          pendingReminderData,
          enhancedContext: '', // No complex context enhancement
          memoryStats: {}, // No complex memory stats
          conversationSummary: null // No conversation summary
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'AI service error');
      }

      console.log('📥 WAKTI AI V2: Received DIRECT response');
      return response.data;
    } catch (error: any) {
      console.error('WaktiAIV2Service DIRECT sendMessage error:', error);
      throw error;
    }
  }

  // New method to confirm task creation
  static async confirmTaskCreation(
    userId: string,
    language: string = 'en',
    pendingTaskData: any
  ): Promise<any> {
    console.log('🔧 confirmTaskCreation called:', { userId, language, pendingTaskData });
    
    try {
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

      console.log('✅ Task creation confirmed successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Task confirmation comprehensive error:', error);
      throw error;
    }
  }

  static async confirmReminderCreation(
    userId: string,
    language: string = 'en',
    pendingReminderData: any
  ): Promise<any> {
    console.log('🔔 confirmReminderCreation called:', { userId, language, pendingReminderData });
    
    try {
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

      console.log('✅ Reminder creation confirmed successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Reminder confirmation comprehensive error:', error);
      throw error;
    }
  }

  // NEW: Method to invalidate quota cache
  static invalidateQuotaCache(): void {
    console.log('🗑️ Invalidating quota cache');
    this.quotaCache = null;
    this.quotaCacheTime = 0;
  }

  // UPDATED: Enhanced getOrFetchQuota with forceRefresh parameter
  static async getOrFetchQuota(userId: string, forceRefresh: boolean = false): Promise<any> {
    const now = Date.now();
    
    if (!forceRefresh && this.quotaCache && (now - this.quotaCacheTime) < this.CACHE_DURATION) {
      return this.quotaCache;
    }

    try {
      const { data, error } = await supabase
        .from('ai_quota_management')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      this.quotaCache = data || null;
      this.quotaCacheTime = now;
      
      return this.quotaCache;
    } catch (error: any) {
      console.error('Error fetching quota:', error);
      return null;
    }
  }

  static async getCalendarContext(userId: string): Promise<any> {
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const [tasksData, remindersData, eventsData] = await Promise.all([
        supabase
          .from('tr_tasks')
          .select('*')
          .eq('user_id', userId)
          .gte('due_date', today.toISOString().split('T')[0])
          .lte('due_date', nextWeek.toISOString().split('T')[0]),
        
        supabase
          .from('tr_reminders')
          .select('*')
          .eq('user_id', userId)
          .gte('due_date', today.toISOString().split('T')[0])
          .lte('due_date', nextWeek.toISOString().split('T')[0]),
        
        supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .gte('date', today.toISOString().split('T')[0])
          .lte('date', nextWeek.toISOString().split('T')[0])
      ]);

      return {
        upcomingTasks: tasksData.data || [],
        upcomingReminders: remindersData.data || [],
        upcomingEvents: eventsData.data || [],
        currentDate: today.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Error fetching calendar context:', error);
      return null;
    }
  }

  static async getUserContext(userId: string): Promise<any> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, preferences')
        .eq('id', userId)
        .single();

      const { data: recentTasks } = await supabase
        .from('tr_tasks')
        .select('title, priority, completed')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        profile: profile || {},
        recentActivity: recentTasks || [],
        preferences: profile?.preferences || {}
      };
    } catch (error) {
      console.error('Error fetching user context:', error);
      return null;
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
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
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
    } catch (error: any) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { error: messagesError } = await supabase
        .from('ai_chat_history')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) throw messagesError;

      const { error: conversationError } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (conversationError) throw conversationError;
    } catch (error: any) {
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

      return await this.sendMessage(
        message,
        user.id,
        language,
        conversationId,
        'text',
        [],
        true
      );
    } catch (error: any) {
      console.error('Error sending message with search confirmation:', error);
      throw error;
    }
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
