
import { supabase } from "@/integrations/supabase/client";

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  userId: string;
  conversationId: string;
  language: string;
  inputType?: 'text' | 'voice';
  imageUrl?: string | null;
  browsingUsed?: boolean;
  browsingData?: any;
  needsConfirmation?: boolean;
  needsClarification?: boolean;
  pendingTaskData?: any;
  partialTaskData?: any;
  attachedFiles?: any[];
}

export interface AIConversation {
  id: string;
  created_at: string;
  name: string;
  user_id: string;
  title?: string;
  last_message_at?: string;
}

export class WaktiAIV2Service {
  static async getConversations(userId: string): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error: any) {
      console.error('Error in getConversations:', error);
      throw new Error(error.message);
    }
  }

  static async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching conversation messages:', error);
        throw new Error(error.message);
      }

      return (data || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        userId: msg.user_id,
        conversationId: msg.conversation_id,
        language: msg.language || 'en'
      }));
    } catch (error: any) {
      console.error('Error in getConversationMessages:', error);
      throw new Error(error.message);
    }
  }

  static async getUserProfile(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in getUserProfile:', error);
      throw new Error(error.message);
    }
  }

  static async getQuotaStatus(userId: string): Promise<any> {
    // Mock implementation - replace with actual quota logic if needed
    return {
      showWarning: false,
      remaining: 100,
      total: 100
    };
  }

  static async getSearchQuotaStatus(userId: string): Promise<any> {
    // Mock implementation - replace with actual search quota logic if needed
    return {
      remainingFreeSearches: 5,
      extraSearches: 0,
      isAtLimit: false,
      maxMonthlySearches: 5
    };
  }

  static async getTranslationQuota(userId: string): Promise<any> {
    // Mock implementation - replace with actual translation quota logic if needed
    return {
      daily_count: 0,
      max_daily: 25
    };
  }

  static async createConversation(userId: string, name: string): Promise<AIConversation> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert([{ user_id: userId, name: name }])
        .select()
        .single();

      if (error) {
        console.error('Error creating conversation:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in createConversation:', error);
      throw new Error(error.message);
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.error('Error deleting conversation:', error);
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error('Error in deleteConversation:', error);
      throw new Error(error.message);
    }
  }

  static async sendMessage(payload: {
    message: string;
    userId: string;
    language: string;
    conversationId: string | null;
    inputType?: string;
    conversationHistory?: AIMessage[];
    activeTrigger?: string;
    attachedFiles?: any[];
  }): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: JSON.stringify(payload)
      });

      if (error) {
        console.error('Error invoking function:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error in sendMessage:', error);
      throw new Error(error.message);
    }
  }

  // ENHANCED: Better task data extraction from natural language
  private static extractTaskDataFromMessage(text: string) {
    const lowerText = text.toLowerCase();
    
    let title = "";
    let subtasks: string[] = [];
    let due_date = null;
    let due_time = null;
    let priority = "normal";
    let hasTaskKeywords = false;

    // Check for task keywords (both English and Arabic)
    if (lowerText.includes('task') || lowerText.includes('shopping') || lowerText.includes('buy') || 
        lowerText.includes('get') || lowerText.includes('need to') || lowerText.includes('مهمة') || 
        lowerText.includes('تسوق') || lowerText.includes('شراء')) {
      hasTaskKeywords = true;
    }

    // ENHANCED: Better extraction for "need to buy X Y Z" format
    const needToBuyMatch = text.match(/\b(need to buy|have to buy|must buy|buy|get|pick up)\s+(.+?)(\s+due|\s+tomorrow|\s+today|$)/i);
    if (needToBuyMatch && !title) {
      const itemsText = needToBuyMatch[2].trim();
      title = `Buy ${itemsText}`;
      
      // Extract individual items as subtasks
      const items = itemsText
        .split(/\s+and\s+|,\s*|\s+/)
        .map(item => item.trim())
        .filter(item => item && item.length > 0 && !item.match(/\b(due|at|to|in|from|for|on|when|where|why|how)\b/i))
        .slice(0, 10);
      
      if (items.length > 1) {
        subtasks = items;
      }
    }

    // Extract shopping list format: "shopping list lulu" or "shopping at lulu"
    const shoppingMatch = text.match(/\b(shopping\s+list|shop\s+at|shopping\s+at|قائمة\s+تسوق|تسوق\s+في)\s+([^,\.\s]+)/i);
    if (shoppingMatch && !title) {
      const location = shoppingMatch[2].trim();
      title = `Shopping at ${location.charAt(0).toUpperCase() + location.slice(1)}`;
    }

    // Extract title from "create a task" format
    const taskMatch = text.match(/\b(create|add|make|new|أنشئ|اضف|اعمل)\s+(a\s+)?(task|مهمة)\s+(.+?)(\s+due|\s+sub\s+tasks?|$)/i);
    if (taskMatch && !title) {
      title = taskMatch[4].trim();
    }

    // ENHANCED: Extract subtasks from various formats
    if (!subtasks.length) {
      // Format: "sub tasks rice milk water"
      const subtaskMatch = text.match(/\b(sub\s+tasks?|المهام\s+الفرعية)\s+(.+?)(\s+due|$)/i);
      if (subtaskMatch) {
        const itemsText = subtaskMatch[2];
        subtasks = itemsText
          .split(/\s+(?:and\s+)?|,\s*|\s*&\s*/)
          .map(item => item.trim())
          .filter(item => item && item.length > 0 && !item.match(/\b(due|at|to|in|from|for|on|when|where|why|how)\b/i))
          .slice(0, 10);
      }
    }

    // Extract due date - enhanced patterns
    const datePatterns = [
      /\b(due|موعد)\s+(tomorrow|today|tonight|غداً|اليوم|الليلة)\b/i,
      /\b(due|موعد)\s+(tomorrow|غداً)\s+(morning|afternoon|evening|noon|night|صباحاً|ظهراً|مساءً)/i,
      /\b(due|موعد)\s+(next|this|القادم|هذا)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد)/i,
      /\b(tomorrow|today|tonight|غداً|اليوم|الليلة)\b/i,
      /\b(due|موعد)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{0,4})/i
    ];

    for (const pattern of datePatterns) {
      const dateMatch = text.match(pattern);
      if (dateMatch) {
        due_date = dateMatch[2] || dateMatch[1];
        break;
      }
    }

    // Extract due time - enhanced patterns
    const timePatterns = [
      /\b(noon|midnight|ظهراً|منتصف\s+الليل)\b/i,
      /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)\b/i,
      /\b(\d{1,2}):(\d{2})\b/i,
      /\b(morning|afternoon|evening|night|صباحاً|ظهراً|مساءً|ليلاً)\b/i
    ];

    for (const pattern of timePatterns) {
      const timeMatch = text.match(pattern);
      if (timeMatch) {
        if (timeMatch[0].toLowerCase() === 'noon' || timeMatch[0].includes('ظهراً')) {
          due_time = '12:00';
        } else if (timeMatch[0].toLowerCase() === 'midnight' || timeMatch[0].includes('منتصف الليل')) {
          due_time = '00:00';
        } else {
          due_time = timeMatch[0];
        }
        break;
      }
    }

    // Extract priority
    const priorityRegex = /\b(high|medium|low|urgent|critical|عالي|متوسط|منخفض|عاجل)\b\s*(priority|أولوية)/i;
    const priorityMatch = text.match(priorityRegex);
    
    if (priorityMatch) {
      const priorityWord = priorityMatch[1].toLowerCase();
      if (priorityWord === 'عالي' || priorityWord === 'high') priority = "high";
      else if (priorityWord === 'عاجل' || priorityWord === 'urgent') priority = "urgent";
      else if (priorityWord === 'منخفض' || priorityWord === 'low') priority = "normal";
      else priority = priorityMatch[1].toLowerCase();
    } else if (lowerText.includes("urgent") || lowerText.includes("عاجل") || lowerText.includes("asap")) {
      priority = "urgent";
    } else if (lowerText.includes("important") || lowerText.includes("مهم") || lowerText.includes("soon")) {
      priority = "high";
    }
    
    return {
      title: title || (lowerText.includes('مهمة') ? "مهمة جديدة" : "New task"),
      description: "",
      subtasks: subtasks,
      due_date: due_date,
      due_time: due_time,
      priority: priority as 'normal' | 'high' | 'urgent',
      task_type: 'one-time' as const,
      hasTaskKeywords
    };
  }

  // FIXED: Use correct database tables (tr_tasks and tr_subtasks)
  static async executeTaskAction(taskData: any, userId: string): Promise<{ success: boolean; message: string; taskId?: string }> {
    try {
      console.log('Creating task with data:', taskData);
      
      // Import TRService for task creation
      const { TRService } = await import('@/services/trService');
      
      // Format the task data for TR service
      const formattedTaskData = {
        title: taskData.title,
        description: taskData.description || '',
        due_date: taskData.due_date,
        due_time: taskData.due_time,
        priority: taskData.priority || 'normal',
        task_type: taskData.task_type || 'one-time',
        is_shared: false // Add the required field
      };

      // Create the main task using TRService
      const createdTask = await TRService.createTask(formattedTaskData);
      console.log('Task created successfully:', createdTask);

      // Create subtasks if they exist
      if (taskData.subtasks && taskData.subtasks.length > 0) {
        console.log('Creating subtasks:', taskData.subtasks);
        
        for (let i = 0; i < taskData.subtasks.length; i++) {
          const subtaskTitle = taskData.subtasks[i];
          if (subtaskTitle && subtaskTitle.trim()) {
            try {
              await TRService.createSubtask({
                task_id: createdTask.id,
                title: subtaskTitle.trim(),
                completed: false,
                order_index: i
              });
              console.log(`Subtask created: ${subtaskTitle}`);
            } catch (subtaskError) {
              console.error(`Error creating subtask "${subtaskTitle}":`, subtaskError);
            }
          }
        }
      }

      return {
        success: true,
        message: `Task "${taskData.title}" created successfully${taskData.subtasks?.length ? ` with ${taskData.subtasks.length} subtasks` : ''}`,
        taskId: createdTask.id
      };
    } catch (error) {
      console.error('Error creating task:', error);
      return {
        success: false,
        message: `Failed to create task: ${error.message}`
      };
    }
  }
}
