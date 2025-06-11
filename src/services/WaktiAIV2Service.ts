
import { supabase } from '@/integrations/supabase/client';

export interface ChatSession {
  messages: AIMessage[];
  conversationId: string | null;
}

export interface AIConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  user_id: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: string;
  actionTaken?: boolean | string;
  actionResult?: any;
  inputType?: string;
  imageUrl?: string;
  browsingUsed?: boolean;
  browsingData?: any;
  quotaStatus?: any;
  requiresSearchConfirmation?: boolean;
  needsConfirmation?: boolean;
  needsClarification?: boolean;
  pendingTaskData?: any;
  pendingReminderData?: any;
  isTextGenerated?: boolean;
  attachedFiles?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
    thumbnail?: string;
  }>;
}

export class WaktiAIV2Service {
  static saveChatSession(messages: AIMessage[], conversationId: string | null) {
    const chatSession: ChatSession = {
      messages: messages,
      conversationId: conversationId,
    };
    localStorage.setItem('chatSession', JSON.stringify(chatSession));
  }

  static loadChatSession(): ChatSession | null {
    const chatSession = localStorage.getItem('chatSession');
    return chatSession ? JSON.parse(chatSession) : null;
  }

  static clearChatSession() {
    localStorage.removeItem('chatSession');
  }

  static async getUserProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  static async getCalendarContext() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get upcoming events and tasks for calendar context
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(10);

      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(10);

      return {
        events: events || [],
        tasks: tasks || []
      };
    } catch (error) {
      console.error('Error fetching calendar context:', error);
      return null;
    }
  }

  static async getUserContext() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user preferences and settings for context
      const { data: preferences, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return {
        userId: user.id,
        email: user.email,
        preferences: preferences || {}
      };
    } catch (error) {
      console.error('Error fetching user context:', error);
      return null;
    }
  }

  static async confirmTaskCreation(userId: string, language: string, pendingTask: any) {
    try {
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message: 'Confirm task creation',
          userId: userId,
          language,
          conversationId: null,
          inputType: 'text',
          conversationHistory: [],
          confirmSearch: false,
          activeTrigger: 'chat',
          textGenParams: null,
          attachedFiles: [],
          calendarContext: null,
          userContext: null,
          enableAdvancedIntegration: true,
          enablePredictiveInsights: true,
          enableWorkflowAutomation: true,
          confirmTask: true,
          confirmReminder: false,
          pendingTaskData: pendingTask,
          pendingReminderData: null
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error confirming task creation:', error);
      throw error;
    }
  }

  static async confirmReminderCreation(userId: string, language: string, pendingReminder: any) {
    try {
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message: 'Confirm reminder creation',
          userId: userId,
          language,
          conversationId: null,
          inputType: 'text',
          conversationHistory: [],
          confirmSearch: false,
          activeTrigger: 'chat',
          textGenParams: null,
          attachedFiles: [],
          calendarContext: null,
          userContext: null,
          enableAdvancedIntegration: true,
          enablePredictiveInsights: true,
          enableWorkflowAutomation: true,
          confirmTask: false,
          confirmReminder: true,
          pendingTaskData: null,
          pendingReminderData: pendingReminder
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error confirming reminder creation:', error);
      throw error;
    }
  }

  static async sendMessage(
    message: string,
    language: string = 'en',
    conversationId?: string,
    inputType: string = 'text',
    conversationHistory: AIMessage[] = [],
    attachedFiles: any[] = [],
    calendarContext?: any,
    userContext?: any,
    enableAdvancedIntegration: boolean = true,
    enablePredictiveInsights: boolean = true,
    enableWorkflowAutomation: boolean = true,
    activeTrigger: string = 'chat'
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Process attached files for DeepSeek analysis
      let processedMessage = message;
      let fileAnalysisContext = '';

      if (attachedFiles && attachedFiles.length > 0) {
        // Add file analysis context to the message
        fileAnalysisContext = `\n\nAttached files for analysis: ${attachedFiles.map(f => f.name).join(', ')}`;
        processedMessage = message + fileAnalysisContext;
      }

      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message: processedMessage,
          userId: user.id,
          language,
          conversationId,
          inputType,
          conversationHistory: conversationHistory.slice(-20),
          confirmSearch: false,
          activeTrigger,
          textGenParams: null,
          attachedFiles,
          calendarContext,
          userContext,
          enableAdvancedIntegration,
          enablePredictiveInsights,
          enableWorkflowAutomation,
          confirmTask: false,
          confirmReminder: false,
          pendingTaskData: null,
          pendingReminderData: null
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}
