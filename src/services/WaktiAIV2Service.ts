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
    attachedFiles: any[] = [],
    // Phase 4: Enhanced context
    calendarContext: any = null,
    userContext: any = null
  ): Promise<any> {
    console.log('🚀 WaktiAIV2Service.sendMessage called - Phase 4 with enhanced debugging');
    console.log('🔍 Request details:', {
      message: message?.substring(0, 100) + '...',
      userId,
      language,
      conversationId,
      inputType,
      confirmSearch,
      activeTrigger,
      hasTextGenParams: !!textGenParams,
      attachedFilesCount: attachedFiles?.length || 0,
      hasCalendarContext: !!calendarContext,
      hasUserContext: !!userContext,
      conversationHistoryLength: conversationHistory?.length || 0
    });

    try {
      // Validate required parameters
      if (!message || typeof message !== 'string' || message.trim() === '') {
        const error = new Error('Message is required and must be a non-empty string');
        console.error('❌ Validation error:', error.message);
        throw error;
      }

      if (!userId || typeof userId !== 'string') {
        const error = new Error('User ID is required and must be a string');
        console.error('❌ Validation error:', error.message);
        throw error;
      }

      // Check authentication status
      console.log('🔐 Checking authentication...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('❌ Authentication error details:', {
          message: authError.message,
          name: authError.name,
          status: authError.status
        });
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      
      if (!user) {
        const error = new Error('User not authenticated');
        console.error('❌ Authentication error:', error.message);
        throw error;
      }
      
      if (user.id !== userId) {
        const error = new Error('User ID mismatch');
        console.error('❌ Authentication error:', error.message, { 
          providedUserId: userId, 
          authenticatedUserId: user.id 
        });
        throw error;
      }

      console.log('✅ Authentication verified for user:', user.id);

      // Convert conversation history to the format expected by the edge function
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }));

      console.log('📝 Formatted conversation history:', {
        length: formattedHistory.length,
        roles: formattedHistory.map(h => h.role)
      });

      // Prepare request body
      const requestBody = {
        message,
        userId,
        language,
        conversationId,
        inputType,
        conversationHistory: formattedHistory,
        confirmSearch,
        activeTrigger,
        textGenParams,
        attachedFiles: attachedFiles || [],
        // Phase 4: Enhanced context
        calendarContext,
        userContext,
        enableAdvancedIntegration: true,
        enablePredictiveInsights: true,
        enableWorkflowAutomation: true
      };

      console.log('📤 Sending request to edge function:', {
        functionName: 'wakti-ai-v2-brain',
        bodySize: JSON.stringify(requestBody).length,
        requestBodyKeys: Object.keys(requestBody),
        timestamp: new Date().toISOString()
      });

      // Add detailed request body logging (excluding sensitive data)
      console.log('📤 Request body details:', {
        messageLength: requestBody.message.length,
        userId: requestBody.userId,
        language: requestBody.language,
        conversationId: requestBody.conversationId,
        inputType: requestBody.inputType,
        historyLength: requestBody.conversationHistory.length,
        activeTrigger: requestBody.activeTrigger,
        hasTextGenParams: !!requestBody.textGenParams,
        attachedFilesCount: requestBody.attachedFiles.length,
        hasCalendarContext: !!requestBody.calendarContext,
        hasUserContext: !!requestBody.userContext
      });

      // Make the request to the edge function
      const startTime = Date.now();
      console.log('🌐 Making supabase.functions.invoke call...');
      
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: requestBody
      });

      const duration = Date.now() - startTime;
      console.log(`⏱️ Edge function response time: ${duration}ms`);

      if (error) {
        console.error('❌ Edge function error - Full details:', {
          errorObject: error,
          name: error.name,
          message: error.message,
          context: error.context,
          details: error.details,
          hint: error.hint,
          code: error.code,
          duration,
          timestamp: new Date().toISOString()
        });
        
        // Enhanced error messaging without using .cause
        let errorMessage = 'Failed to process message';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = `Edge function error: ${error.details}`;
        } else if (error.context) {
          errorMessage = `Request failed: ${error.context}`;
        }
        
        // Create a new error with additional context
        const enhancedError = new Error(`${errorMessage} (Duration: ${duration}ms)`);
        throw enhancedError;
      }

      console.log('✅ Edge function response received:', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        success: data?.success,
        hasResponse: !!data?.response,
        hasError: !!data?.error,
        duration,
        timestamp: new Date().toISOString()
      });

      // Add detailed response logging
      if (data) {
        console.log('📥 Response data details:', {
          success: data.success,
          responseLength: data.response ? data.response.length : 0,
          hasGeneratedText: !!data.generatedText,
          hasConversationId: !!data.conversationId,
          hasActionTaken: !!data.actionTaken,
          hasQuotaStatus: !!data.quotaStatus,
          errorMessage: data.error,
          dataProperties: Object.keys(data)
        });
      }

      // Validate response
      if (!data) {
        const error = new Error('No data received from edge function');
        console.error('❌ Response validation error:', error.message);
        throw error;
      }

      if (data.error) {
        console.error('❌ Edge function returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data.success) {
        console.warn('⚠️ Edge function returned success=false:', data);
      }

      console.log('✅ WaktiAIV2Service.sendMessage completed successfully');
      return data;

    } catch (error: any) {
      console.error('❌ WaktiAIV2Service.sendMessage comprehensive error:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        userId,
        activeTrigger,
        messageLength: message?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      // Re-throw with enhanced context but without using .cause
      const enhancedError = new Error(`AI Service Error: ${error.message}`);
      throw enhancedError;
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
