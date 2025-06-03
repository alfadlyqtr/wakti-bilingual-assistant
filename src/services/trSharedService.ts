import { supabase } from "@/integrations/supabase/client";

export interface TRSnoozeRequest {
  id: string;
  task_id: string;
  visitor_name: string;
  session_id?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
}

export interface TRVisitorCompletion {
  id: string;
  task_id: string;
  subtask_id?: string;
  visitor_name: string;
  session_id: string;
  completion_type: 'task' | 'subtask';
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TRSharedAccessExtended {
  id: string;
  task_id: string;
  viewer_id?: string;
  viewer_name?: string;
  session_id?: string;
  visitor_ip?: string;
  is_active: boolean;
  last_accessed: string;
  created_at: string;
}

export class TRSharedService {
  // Generate a unique session ID for visitors
  static generateSessionId(): string {
    return `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Record visitor access to shared task
  static async recordVisitorAccess(taskId: string, visitorName: string, sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_access')
        .insert({
          task_id: taskId,
          viewer_name: visitorName,
          session_id: sessionId,
          is_active: true,
          last_accessed: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error recording visitor access:', error);
      throw error;
    }
  }

  // Update visitor activity status
  static async updateVisitorActivity(sessionId: string, isActive: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_access')
        .update({ 
          is_active: isActive,
          last_accessed: new Date().toISOString()
        })
        .eq('session_id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating visitor activity:', error);
    }
  }

  // Get active visitors for a task
  static async getActiveVisitors(taskId: string): Promise<TRSharedAccessExtended[]> {
    try {
      const { data, error } = await supabase
        .from('tr_shared_access')
        .select('*')
        .eq('task_id', taskId)
        .eq('is_active', true)
        .order('last_accessed', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting active visitors:', error);
      return [];
    }
  }

  // Check if task should be marked as completed based on visitor completions
  private static async checkAndUpdateTaskCompletion(taskId: string): Promise<void> {
    try {
      // Get all visitor completions for the task
      const { data: completions, error: completionsError } = await supabase
        .from('tr_visitor_completions')
        .select('*')
        .eq('task_id', taskId)
        .eq('completion_type', 'task')
        .eq('is_completed', true);

      if (completionsError) throw completionsError;

      // Get all subtasks for the task
      const { data: subtasks, error: subtasksError } = await supabase
        .from('tr_subtasks')
        .select('*')
        .eq('task_id', taskId);

      if (subtasksError) throw subtasksError;

      // Get all subtask completions
      const { data: subtaskCompletions, error: subtaskCompletionsError } = await supabase
        .from('tr_visitor_completions')
        .select('*')
        .eq('task_id', taskId)
        .eq('completion_type', 'subtask')
        .eq('is_completed', true);

      if (subtaskCompletionsError) throw subtaskCompletionsError;

      // Check if at least one visitor has completed the main task
      const hasTaskCompletion = completions && completions.length > 0;

      // Check if all subtasks are completed by at least one visitor
      let allSubtasksCompleted = true;
      if (subtasks && subtasks.length > 0) {
        for (const subtask of subtasks) {
          const subtaskCompleted = subtaskCompletions?.some(
            completion => completion.subtask_id === subtask.id
          );
          if (!subtaskCompleted) {
            allSubtasksCompleted = false;
            break;
          }
        }
      }

      // Update the original task if it should be completed
      const shouldBeCompleted = hasTaskCompletion && allSubtasksCompleted;
      
      // Get current task status
      const { data: currentTask, error: taskError } = await supabase
        .from('tr_tasks')
        .select('completed')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;

      // Only update if the completion status needs to change
      if (currentTask && currentTask.completed !== shouldBeCompleted) {
        const { error: updateError } = await supabase
          .from('tr_tasks')
          .update({ 
            completed: shouldBeCompleted,
            completed_at: shouldBeCompleted ? new Date().toISOString() : null
          })
          .eq('id', taskId);

        if (updateError) throw updateError;
      }

    } catch (error) {
      console.error('Error checking and updating task completion:', error);
    }
  }

  // Mark task as completed by visitor
  static async markTaskCompleted(taskId: string, visitorName: string, sessionId: string, isCompleted: boolean): Promise<void> {
    try {
      // Check if visitor has already completed this task
      const { data: existing } = await supabase
        .from('tr_visitor_completions')
        .select('*')
        .eq('task_id', taskId)
        .eq('session_id', sessionId)
        .eq('completion_type', 'task')
        .single();

      if (existing) {
        // Update existing completion
        const { error } = await supabase
          .from('tr_visitor_completions')
          .update({ is_completed: isCompleted })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new completion record
        const { error } = await supabase
          .from('tr_visitor_completions')
          .insert({
            task_id: taskId,
            visitor_name: visitorName,
            session_id: sessionId,
            completion_type: 'task',
            is_completed: isCompleted
          });

        if (error) throw error;
      }

      // Check and update the original task completion status
      await this.checkAndUpdateTaskCompletion(taskId);

    } catch (error) {
      console.error('Error marking task completed:', error);
      throw error;
    }
  }

  // Mark subtask as completed by visitor
  static async markSubtaskCompleted(taskId: string, subtaskId: string, visitorName: string, sessionId: string, isCompleted: boolean): Promise<void> {
    try {
      // Check if visitor has already completed this subtask
      const { data: existing } = await supabase
        .from('tr_visitor_completions')
        .select('*')
        .eq('task_id', taskId)
        .eq('subtask_id', subtaskId)
        .eq('session_id', sessionId)
        .eq('completion_type', 'subtask')
        .single();

      if (existing) {
        // Update existing completion
        const { error } = await supabase
          .from('tr_visitor_completions')
          .update({ is_completed: isCompleted })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new completion record
        const { error } = await supabase
          .from('tr_visitor_completions')
          .insert({
            task_id: taskId,
            subtask_id: subtaskId,
            visitor_name: visitorName,
            session_id: sessionId,
            completion_type: 'subtask',
            is_completed: isCompleted
          });

        if (error) throw error;
      }

      // Check and update the original task completion status
      await this.checkAndUpdateTaskCompletion(taskId);

    } catch (error) {
      console.error('Error marking subtask completed:', error);
      throw error;
    }
  }

  // Get visitor completions for a task
  static async getVisitorCompletions(taskId: string): Promise<TRVisitorCompletion[]> {
    try {
      const { data, error } = await supabase
        .from('tr_visitor_completions')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting visitor completions:', error);
      return [];
    }
  }

  // Get visitor completion for specific item
  static async getVisitorCompletion(taskId: string, sessionId: string, subtaskId?: string): Promise<TRVisitorCompletion | null> {
    try {
      let query = supabase
        .from('tr_visitor_completions')
        .select('*')
        .eq('task_id', taskId)
        .eq('session_id', sessionId);

      if (subtaskId) {
        query = query.eq('subtask_id', subtaskId).eq('completion_type', 'subtask');
      } else {
        query = query.eq('completion_type', 'task').is('subtask_id', null);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error getting visitor completion:', error);
      return null;
    }
  }

  // Request task snooze
  static async requestSnooze(taskId: string, visitorName: string, sessionId: string, reason?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_task_snooze_requests')
        .insert({
          task_id: taskId,
          visitor_name: visitorName,
          session_id: sessionId,
          reason: reason,
          status: 'pending'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error requesting snooze:', error);
      throw error;
    }
  }

  // Get snooze requests for a task
  static async getSnoozeRequests(taskId: string): Promise<TRSnoozeRequest[]> {
    try {
      const { data, error } = await supabase
        .from('tr_task_snooze_requests')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting snooze requests:', error);
      return [];
    }
  }

  // Update snooze request status (for task owner)
  static async updateSnoozeRequest(requestId: string, status: 'approved' | 'denied'): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_task_snooze_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating snooze request:', error);
      throw error;
    }
  }

  // Subscribe to real-time updates for a task
  static subscribeToTaskUpdates(taskId: string, onUpdate: (payload: any) => void) {
    const channel = supabase
      .channel(`task-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tr_visitor_completions',
          filter: `task_id=eq.${taskId}`
        },
        onUpdate
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tr_task_snooze_requests',
          filter: `task_id=eq.${taskId}`
        },
        onUpdate
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tr_shared_access',
          filter: `task_id=eq.${taskId}`
        },
        onUpdate
      )
      .subscribe();

    return channel;
  }
}
