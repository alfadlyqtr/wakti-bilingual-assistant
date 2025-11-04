import { supabase, ensurePassport, getCurrentUserId } from "@/integrations/supabase/client";
import { TRServiceCache } from "./trServiceCache";

export interface TRTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  due_date: string;
  due_time?: string;
  priority: 'normal' | 'high' | 'urgent';
  task_type: 'one-time' | 'repeated';
  is_shared: boolean;
  share_link?: string;
  completed: boolean;
  completed_at?: string;
  snoozed_until?: string;
  created_at: string;
  updated_at: string;
}

export interface TRSubtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  order_index: number;
  // Optional scheduling fields (local day string and HH:mm)
  due_date?: string | null;
  due_time?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TRReminder {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  due_date: string;
  due_time?: string;
  snoozed_until?: string;
  created_at: string;
  updated_at: string;
}

export interface TRSharedAccess {
  id: string;
  task_id: string;
  viewer_id?: string;
  viewer_name?: string;
  last_accessed: string;
  created_at: string;
}

export class TRService {
  // Helper method to sanitize task data before database operations
  private static sanitizeTaskData(taskData: any) {
    const sanitized = { ...taskData };
    
    // Convert empty strings to null for optional fields
    if (sanitized.due_time === '') {
      sanitized.due_time = null;
    }
    if (sanitized.description === '') {
      sanitized.description = null;
    }
    
    console.log('Sanitized task data:', sanitized);
    return sanitized;
  }

  // Task operations - Updated with caching for instant loading
  static async getTasks(): Promise<TRTask[]> {
    console.log('TRService.getTasks: Starting to fetch tasks');
    
    // Try to get cached data first for instant loading
    const cachedTasks = TRServiceCache.getTasks();
    if (cachedTasks) {
      console.log('TRService.getTasks: Returning cached tasks:', cachedTasks.length);
      
      // Still fetch fresh data in background and update cache
      this.refreshTasksInBackground();
      
      return cachedTasks;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('TRService.getTasks: No user found');
      throw new Error('User not authenticated. Please log in.');
    }

    console.log('TRService.getTasks: Fetching tasks for user:', userId);

    await ensurePassport();
    const { data, error } = await supabase
      .from('tr_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('TRService.getTasks: Database error:', error);
      throw error;
    }

    const tasks = data || [];
    console.log('TRService.getTasks: Fetched tasks count:', tasks.length);
    
    // Cache the fresh data
    TRServiceCache.setTasks(tasks);
    
    return tasks;
  }

  // Background refresh for cached data
  private static async refreshTasksInBackground(): Promise<void> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      await ensurePassport();
      const { data, error } = await supabase
        .from('tr_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        TRServiceCache.setTasks(data);
        console.log('TRService: Background refresh completed for tasks');
      }
    } catch (error) {
      console.error('TRService: Background refresh failed for tasks:', error);
    }
  }

  static async createTask(task: Omit<TRTask, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'share_link' | 'completed' | 'completed_at' | 'snoozed_until'>): Promise<TRTask> {
    console.log('TRService.createTask: Starting task creation');
    console.log('TRService.createTask: Raw input data:', task);
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('TRService.createTask: No user found');
      throw new Error('User not authenticated. Please log in.');
    }

    console.log('TRService.createTask: User authenticated:', userId);

    const taskData = { 
      ...task, 
      user_id: userId, 
      completed: false 
    };

    const sanitizedData = this.sanitizeTaskData(taskData);

    console.log('TRService.createTask: Final sanitized data being inserted:', sanitizedData);

    await ensurePassport();
    const { data, error } = await supabase
      .from('tr_tasks')
      .insert([sanitizedData])
      .select()
      .single();
    
    if (error) {
      console.error('TRService.createTask: Database error:', error);
      console.error('TRService.createTask: Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to create task: ${error.message}`);
    }

    console.log('TRService.createTask: Task created successfully:', data);
    
    // Clear cache to force refresh
    TRServiceCache.clearTasks();
    
    return data;
  }

  static async updateTask(id: string, updates: Partial<TRTask>): Promise<TRTask> {
    const sanitizedUpdates = this.sanitizeTaskData(updates);
    
    const { data, error } = await supabase
      .from('tr_tasks')
      .update(sanitizedUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Clear cache to force refresh
    TRServiceCache.clearTasks();
    
    return data;
  }

  static async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('tr_tasks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // Clear cache to force refresh
    TRServiceCache.clearTasks();
  }

  static async getTaskByShareLink(shareLink: string): Promise<TRTask | null> {
    const { data, error } = await supabase
      .from('tr_tasks')
      .select('*')
      .eq('share_link', shareLink)
      .eq('is_shared', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  static async getSharedTask(shareLink: string): Promise<TRTask | null> {
    const { data, error } = await supabase
      .from('tr_tasks')
      .select('*')
      .eq('share_link', shareLink)
      .eq('is_shared', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  // Subtask operations
  static async getSubtasks(taskId: string): Promise<TRSubtask[]> {
    const { data, error } = await supabase
      .from('tr_subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('order_index', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  static async createSubtask(subtask: Omit<TRSubtask, 'id' | 'created_at' | 'updated_at'>): Promise<TRSubtask> {
    const { data, error } = await supabase
      .from('tr_subtasks')
      .insert([subtask])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateSubtask(id: string, updates: Partial<TRSubtask>): Promise<TRSubtask> {
    const { data, error } = await supabase
      .from('tr_subtasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteSubtask(id: string): Promise<void> {
    const { error } = await supabase
      .from('tr_subtasks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Reminder operations - Updated with caching for instant loading
  static async getReminders(): Promise<TRReminder[]> {
    console.log('TRService.getReminders: Starting to fetch reminders');
    
    // Try to get cached data first for instant loading
    const cachedReminders = TRServiceCache.getReminders();
    if (cachedReminders) {
      console.log('TRService.getReminders: Returning cached reminders:', cachedReminders.length);
      
      // Still fetch fresh data in background and update cache
      this.refreshRemindersInBackground();
      
      return cachedReminders;
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('TRService.getReminders: No user found');
      throw new Error('User not authenticated. Please log in.');
    }

    console.log('TRService.getReminders: Fetching reminders for user:', userId);

    await ensurePassport();
    const { data, error } = await supabase
      .from('tr_reminders')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });
    
    if (error) {
      console.error('TRService.getReminders: Database error:', error);
      throw error;
    }

    const reminders = data || [];
    console.log('TRService.getReminders: Fetched reminders count:', reminders.length);
    
    // Cache the fresh data
    TRServiceCache.setReminders(reminders);
    
    return reminders;
  }

  // Background refresh for cached reminders
  private static async refreshRemindersInBackground(): Promise<void> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      await ensurePassport();
      const { data, error } = await supabase
        .from('tr_reminders')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });
      
      if (!error && data) {
        TRServiceCache.setReminders(data);
        console.log('TRService: Background refresh completed for reminders');
      }
    } catch (error) {
      console.error('TRService: Background refresh failed for reminders:', error);
    }
  }

  static async createReminder(reminder: Omit<TRReminder, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'snoozed_until'>): Promise<TRReminder> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const sanitizedReminder = this.sanitizeTaskData(reminder);

    await ensurePassport();
    const { data, error } = await supabase
      .from('tr_reminders')
      .insert([{ ...sanitizedReminder, user_id: userId }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Clear cache to force refresh
    TRServiceCache.clearReminders();
    
    return data;
  }

  static async updateReminder(id: string, updates: Partial<TRReminder>): Promise<TRReminder> {
    const sanitizedUpdates = this.sanitizeTaskData(updates);
    
    const { data, error } = await supabase
      .from('tr_reminders')
      .update(sanitizedUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Clear cache to force refresh
    TRServiceCache.clearReminders();
    
    return data;
  }

  static async snoozeReminder(id: string): Promise<TRReminder> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data, error } = await supabase
      .from('tr_reminders')
      .update({ 
        snoozed_until: tomorrow.toISOString().split('T')[0]
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Clear cache to force refresh
    TRServiceCache.clearReminders();
    
    return data;
  }

  static async deleteReminder(id: string): Promise<void> {
    const { error } = await supabase
      .from('tr_reminders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // Clear cache to force refresh
    TRServiceCache.clearReminders();
  }

  // Shared access operations
  static async recordSharedAccess(taskId: string, viewerName?: string): Promise<void> {
    const userId = await getCurrentUserId();
    
    await ensurePassport();
    const { error } = await supabase
      .from('tr_shared_access')
      .insert([{
        task_id: taskId,
        viewer_id: userId || null,
        viewer_name: viewerName || 'Guest'
      }]);
    
    if (error) throw error;
  }

  static async getSharedAccess(taskId: string): Promise<TRSharedAccess[]> {
    const { data, error } = await supabase
      .from('tr_shared_access')
      .select('*')
      .eq('task_id', taskId)
      .order('last_accessed', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
}
