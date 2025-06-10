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
  // Phase 4: Advanced Integration
  deepIntegration?: any; // Calendar, contacts, voice integration results
  automationSuggestions?: any[]; // Smart scheduling, prioritization suggestions
  predictiveInsights?: any; // Predictive intelligence results
  workflowActions?: any[]; // Automated workflow suggestions
  contextualActions?: any[]; // Context-aware quick actions
  // Task/Reminder confirmation properties
  needsConfirmation?: boolean;
  pendingTaskData?: any;
  pendingReminderData?: any;
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

  getOrFetchQuota(userId: string) {
    return WaktiAIV2ServiceClass.getOrFetchQuota(userId);
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

  getCalendarContext(userId: string) {
    return WaktiAIV2ServiceClass.getCalendarContext(userId);
  }

  getUserContext(userId: string) {
    return WaktiAIV2ServiceClass.getUserContext(userId);
  }

  executeAdvancedAction(userId: string, actionType: string, actionData: any, language: string = 'en') {
    return WaktiAIV2ServiceClass.executeAdvancedAction(userId, actionType, actionData, language);
  }

  // Static methods (keep all existing static methods)
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
      const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId,
          inputType,
          conversationHistory,
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
          pendingReminderData
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'AI service error');
      }

      return response.data;
    } catch (error: any) {
      console.error('WaktiAIV2Service sendMessage error:', error);
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

  // New method to confirm reminder creation
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

  // Phase 4: Advanced Integration Methods
  static async getCalendarContext(userId: string): Promise<any> {
    console.log('📅 Getting calendar context for user:', userId);
    
    try {
      // Get upcoming events and tasks for context
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [tasksResult, eventsResult, remindersResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, due_date, priority, status')
          .eq('user_id', userId)
          .gte('due_date', now.toISOString())
          .lte('due_date', nextWeek.toISOString())
          .limit(10),
        
        supabase
          .from('maw3d_events')
          .select('id, title, event_date, start_time, end_time')
          .eq('created_by', userId)
          .gte('event_date', now.toISOString().split('T')[0])
          .limit(10),
        
        supabase
          .from('tr_reminders')
          .select('id, title, due_date, due_time')
          .eq('user_id', userId)
          .gte('due_date', now.toISOString().split('T')[0])
          .limit(10)
      ]);

      const context = {
        upcomingTasks: tasksResult.data || [],
        upcomingEvents: eventsResult.data || [],
        upcomingReminders: remindersResult.data || [],
        currentDateTime: now.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      console.log('📅 Calendar context retrieved:', {
        tasksCount: context.upcomingTasks.length,
        eventsCount: context.upcomingEvents.length,
        remindersCount: context.upcomingReminders.length
      });

      return context;
    } catch (error) {
      console.error('❌ Error fetching calendar context:', error);
      return null;
    }
  }

  static async getUserContext(userId: string): Promise<any> {
    console.log('👤 Getting user context for user:', userId);
    
    try {
      const [profileResult, preferencesResult, activityResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        
        supabase
          .from('ai_user_knowledge')
          .select('*')
          .eq('user_id', userId)
          .single(),
        
        // Get recent activity patterns
        supabase
          .from('tasks')
          .select('created_at, status, priority')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      const context = {
        profile: profileResult.data,
        preferences: preferencesResult.data,
        recentActivity: activityResult.data || [],
        productivityPatterns: await this.analyzeProductivityPatterns(userId)
      };

      console.log('👤 User context retrieved:', {
        hasProfile: !!context.profile,
        hasPreferences: !!context.preferences,
        activityCount: context.recentActivity.length,
        hasPatterns: !!context.productivityPatterns
      });

      return context;
    } catch (error) {
      console.error('❌ Error fetching user context:', error);
      return null;
    }
  }

  private static async analyzeProductivityPatterns(userId: string): Promise<any> {
    try {
      // Analyze when user typically creates tasks, completes them, etc.
      const { data } = await supabase
        .from('tasks')
        .select('created_at, status, due_date, priority')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!data || data.length === 0) return null;

      // Simple pattern analysis
      const patterns = {
        mostActiveHours: this.getMostActiveHours(data),
        preferredPriority: this.getPreferredPriority(data),
        completionRate: this.getCompletionRate(data),
        averageTaskDuration: this.getAverageTaskDuration(data)
      };

      return patterns;
    } catch (error) {
      console.error('Error analyzing productivity patterns:', error);
      return null;
    }
  }

  private static getMostActiveHours(tasks: any[]): number[] {
    const hourCounts: { [key: number]: number } = {};
    
    tasks.forEach(task => {
      const hour = new Date(task.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private static getPreferredPriority(tasks: any[]): string {
    const priorityCounts: { [key: string]: number } = {};
    
    tasks.forEach(task => {
      const priority = task.priority || 'normal';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    return Object.entries(priorityCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'normal';
  }

  private static getCompletionRate(tasks: any[]): number {
    const completed = tasks.filter(task => task.status === 'completed').length;
    return tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  }

  private static getAverageTaskDuration(tasks: any[]): number {
    const completedTasks = tasks.filter(task => 
      task.status === 'completed' && task.due_date
    );

    if (completedTasks.length === 0) return 0;

    const durations = completedTasks.map(task => {
      const created = new Date(task.created_at);
      const due = new Date(task.due_date);
      return Math.max(0, Math.floor((due.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
    });

    return Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length);
  }

  // Phase 4: Advanced automation methods
  static async executeAdvancedAction(
    userId: string,
    actionType: string,
    actionData: any,
    language: string = 'en'
  ): Promise<any> {
    console.log('⚡ executeAdvancedAction called:', { userId, actionType, actionData });
    
    try {
      const { data, error } = await supabase.functions.invoke('wakti-execute-action', {
        body: {
          action: {
            type: actionType,
            data: actionData
          },
          userId,
          language,
          advanced: true // Phase 4 flag
        }
      });

      if (error) throw error;
      
      console.log('✅ Advanced action executed successfully');
      return data;
    } catch (error) {
      console.error('❌ Error executing advanced action:', error);
      throw error;
    }
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
