import { supabase } from "@/integrations/supabase/client";

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
  // Task operations
  static async getTasks(): Promise<TRTask[]> {
    const { data, error } = await supabase
      .from('tr_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  static async createTask(task: Omit<TRTask, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'share_link' | 'completed' | 'completed_at' | 'snoozed_until'>): Promise<TRTask> {
    console.log('TRService.createTask: Starting task creation');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('TRService.createTask: Authentication error:', authError);
      throw new Error('Authentication failed. Please log in again.');
    }
    
    if (!user) {
      console.error('TRService.createTask: No user found');
      throw new Error('User not authenticated. Please log in.');
    }

    console.log('TRService.createTask: User authenticated:', user.id);
    console.log('TRService.createTask: Task data:', task);

    const taskData = { 
      ...task, 
      user_id: user.id, 
      completed: false 
    };

    console.log('TRService.createTask: Inserting task data:', taskData);

    const { data, error } = await supabase
      .from('tr_tasks')
      .insert([taskData])
      .select()
      .single();
    
    if (error) {
      console.error('TRService.createTask: Database error:', error);
      throw new Error(`Failed to create task: ${error.message}`);
    }

    console.log('TRService.createTask: Task created successfully:', data);
    return data;
  }

  static async updateTask(id: string, updates: Partial<TRTask>): Promise<TRTask> {
    const { data, error } = await supabase
      .from('tr_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('tr_tasks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
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

  // Reminder operations
  static async getReminders(): Promise<TRReminder[]> {
    const { data, error } = await supabase
      .from('tr_reminders')
      .select('*')
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  static async createReminder(reminder: Omit<TRReminder, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<TRReminder> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('tr_reminders')
      .insert([{ ...reminder, user_id: user.id }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateReminder(id: string, updates: Partial<TRReminder>): Promise<TRReminder> {
    const { data, error } = await supabase
      .from('tr_reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteReminder(id: string): Promise<void> {
    const { error } = await supabase
      .from('tr_reminders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Shared access operations
  static async recordSharedAccess(taskId: string, viewerName?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('tr_shared_access')
      .insert([{
        task_id: taskId,
        viewer_id: user?.id || null,
        viewer_name: viewerName || (user?.user_metadata?.full_name || user?.email || 'Guest')
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
