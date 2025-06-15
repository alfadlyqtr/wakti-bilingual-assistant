import { supabase } from '@/integrations/supabase/client';
import { ChatMemoryService } from './ChatMemoryService';

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

  // Enhanced buddy-chat message processing
  private static enhanceMessageWithBuddyChat(
    message: string, 
    response: any, 
    activeTrigger: string,
    conversationContext: string
  ): any {
    const buddyEnhancements: any = {};

    // Cross-mode suggestions
    if (activeTrigger === 'chat') {
      const searchTriggers = ['weather', 'news', 'current', 'latest', 'price', 'score', 'what is'];
      const needsSearch = searchTriggers.some(trigger => 
        message.toLowerCase().includes(trigger)
      );
      
      if (needsSearch) {
        buddyEnhancements.crossModeHint = 'search';
      }
    }

    if (activeTrigger === 'search' && response.browsingUsed) {
      buddyEnhancements.followUpSuggestion = this.generateSearchFollowUp(response.response);
    }

    // Conversation continuity detection
    if (conversationContext) {
      buddyEnhancements.conversationContinuity = this.detectTopicContinuity(
        message, 
        conversationContext
      );
    }

    // Engagement level based on response content
    buddyEnhancements.engagement = this.calculateEngagementLevel(response.response);

    return {
      ...response,
      buddyChat: buddyEnhancements
    };
  }

  // Generate natural follow-up suggestions for search results
  private static generateSearchFollowUp(searchResponse: string): string {
    const followUps = [
      "Would you like me to search for more specific details about this?",
      "What aspect of this interests you most?",
      "Should I look up related information?",
      "Would you like me to find more recent updates on this topic?",
      "Is there a particular part you'd like me to explore further?"
    ];
    
    return followUps[Math.floor(Math.random() * followUps.length)];
  }

  // Detect if user is continuing previous topic or starting new one
  private static detectTopicContinuity(message: string, conversationContext: string): string {
    const continuityWords = ['also', 'and', 'additionally', 'furthermore', 'more about', 'tell me more'];
    const newTopicWords = ['now', 'instead', 'different', 'change topic', 'something else'];
    
    const lowerMessage = message.toLowerCase();
    
    if (continuityWords.some(word => lowerMessage.includes(word))) {
      return 'continuing';
    }
    
    if (newTopicWords.some(word => lowerMessage.includes(word))) {
      return 'new_topic';
    }
    
    // Check if message relates to recent conversation topics
    const recentTopics = this.extractTopicsFromContext(conversationContext);
    const messageWords = lowerMessage.split(' ');
    
    const topicOverlap = recentTopics.some(topic => 
      messageWords.some(word => topic.includes(word) || word.includes(topic))
    );
    
    return topicOverlap ? 'related' : 'new_topic';
  }

  // Extract topics from conversation context
  private static extractTopicsFromContext(context: string): string[] {
    const topics: string[] = [];
    const lines = context.split('\n');
    
    lines.forEach(line => {
      if (line.startsWith('Topic: ')) {
        topics.push(line.replace('Topic: ', '').toLowerCase());
      }
    });
    
    return topics;
  }

  // Calculate engagement level based on response characteristics
  private static calculateEngagementLevel(response: string): 'high' | 'medium' | 'low' {
    const engagementIndicators = {
      high: ['?', '!', 'interesting', 'exciting', 'amazing', 'curious', 'explore'],
      medium: ['can', 'would', 'could', 'might', 'perhaps'],
      low: ['yes', 'no', 'ok', 'simple']
    };
    
    const lowerResponse = response.toLowerCase();
    
    for (const [level, indicators] of Object.entries(engagementIndicators)) {
      if (indicators.some(indicator => lowerResponse.includes(indicator))) {
        return level as 'high' | 'medium' | 'low';
      }
    }
    
    return 'medium';
  }

  // Enhanced conversation context preparation
  private static prepareEnhancedContext(
    userId: string, 
    activeTrigger: string, 
    contextMessages: any[]
  ): string {
    // Get enhanced memory context
    const memoryContext = ChatMemoryService.getConversationContext(userId);
    
    // Combine with current session context
    let fullContext = memoryContext;
    
    if (contextMessages && contextMessages.length > 0) {
      fullContext += '\nCurrent session:\n';
      contextMessages.slice(-5).forEach(msg => {
        fullContext += `${msg.role}: ${msg.content}\n`;
      });
    }
    
    // Add mode-specific context hints
    fullContext += `\nCurrent mode: ${activeTrigger}\n`;
    fullContext += this.getModeSpecificHints(activeTrigger);
    
    return fullContext;
  }

  // Get mode-specific conversation hints
  private static getModeSpecificHints(activeTrigger: string): string {
    switch (activeTrigger) {
      case 'chat':
        return 'Mode context: Casual conversation mode - be warm, engaging, and naturally suggest search mode for factual queries.\n';
      case 'search':
        return 'Mode context: Search mode - provide informative responses and engage conversationally after search results.\n';
      case 'image':
        return 'Mode context: Image generation mode - focus on creative image descriptions and artistic guidance.\n';
      default:
        return '';
    }
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

  // NEW: Clear chat memory
  clearChatMemory(userId?: string) {
    return ChatMemoryService.clearMemory(userId);
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
      console.log('📤 WAKTI AI V2: Sending enhanced buddy-chat message for user:', userId);

      // Prepare enhanced conversation context with memory
      const enhancedContext = this.prepareEnhancedContext(userId, activeTrigger, conversationHistory);
      
      // Load enhanced chat memory for better continuity
      let chatMemory: any[] = [];
      if (activeTrigger === 'chat') {
        const memoryExchanges = ChatMemoryService.loadMemory(userId);
        chatMemory = ChatMemoryService.formatForAI(memoryExchanges);
        console.log(`🧠 Loaded ${memoryExchanges.length} enhanced chat exchanges from memory`);
      }

      // Enhanced context for the AI
      const fullContextMessages = activeTrigger === 'chat' ? chatMemory : conversationHistory;

      // CORRECTED: Use the wakti-ai-v2-brain function with enhanced buddy-chat context
      const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId,
          inputType,
          conversationHistory: fullContextMessages,
          confirmSearch,
          activeTrigger,
          textGenParams,
          attachedFiles,
          calendarContext,
          userContext,
          enableAdvancedIntegration,
          enablePredictiveInsights,
          enableWorkflowAutomation,
          confirmTask,
          confirmReminder,
          pendingTaskData,
          pendingReminderData,
          // Enhanced buddy-chat context
          enhancedContext,
          memoryStats: ChatMemoryService.getMemoryStats(userId),
          conversationSummary: ChatMemoryService.loadConversationSummary(userId)
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'AI service error');
      }

      // Enhance response with buddy-chat features
      const enhancedResponse = this.enhanceMessageWithBuddyChat(
        message, 
        response.data, 
        activeTrigger,
        enhancedContext
      );

      // Save to enhanced chat memory if this was a successful chat mode interaction
      if (activeTrigger === 'chat' && enhancedResponse?.response) {
        ChatMemoryService.addExchange(message, enhancedResponse.response, userId);
      }

      console.log('📥 WAKTI AI V2: Received enhanced buddy-chat response');
      return enhancedResponse;
    } catch (error: any) {
      console.error('WaktiAIV2Service enhanced sendMessage error:', error);
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
