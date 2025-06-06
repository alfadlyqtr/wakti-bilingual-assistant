
import { supabase } from "@/integrations/supabase/client";
import { TRSubtask } from "./trService";

export interface TRSharedResponse {
  id: string;
  task_id: string;
  visitor_name: string;
  response_type: 'completion' | 'comment' | 'snooze_request';
  content?: string;
  is_completed?: boolean;
  subtask_id?: string;
  created_at: string;
}

export interface TRSharedAccess {
  id: string;
  task_id: string;
  viewer_name: string;
  last_accessed: string;
  created_at: string;
}

export class TRSharedService {
  // Get all responses for a task - now ordered by newest first
  static async getTaskResponses(taskId: string): Promise<TRSharedResponse[]> {
    try {
      const { data, error } = await supabase
        .from('tr_shared_responses')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false }); // Changed to descending for newest first

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting task responses:', error);
      return [];
    }
  }

  // Get visitor access information for a task
  static async getTaskVisitors(taskId: string): Promise<TRSharedAccess[]> {
    try {
      const { data, error } = await supabase
        .from('tr_shared_access')
        .select('*')
        .eq('task_id', taskId)
        .order('last_accessed', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting task visitors:', error);
      return [];
    }
  }

  // Get subtasks for a task
  static async getTaskSubtasks(taskId: string): Promise<TRSubtask[]> {
    try {
      const { data, error } = await supabase
        .from('tr_subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting task subtasks:', error);
      return [];
    }
  }

  // Mark task as completed
  static async markTaskCompleted(taskId: string, visitorName: string, isCompleted: boolean): Promise<void> {
    try {
      if (isCompleted) {
        // Add completion response
        const { error } = await supabase
          .from('tr_shared_responses')
          .insert({
            task_id: taskId,
            visitor_name: visitorName,
            response_type: 'completion',
            is_completed: true
          });

        if (error) throw error;
      } else {
        // Remove completion response
        const { error } = await supabase
          .from('tr_shared_responses')
          .delete()
          .eq('task_id', taskId)
          .eq('visitor_name', visitorName)
          .eq('response_type', 'completion')
          .is('subtask_id', null);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error marking task completed:', error);
      throw error;
    }
  }

  // Mark subtask as completed
  static async markSubtaskCompleted(taskId: string, subtaskId: string, visitorName: string, isCompleted: boolean): Promise<void> {
    try {
      if (isCompleted) {
        // Add subtask completion response
        const { error } = await supabase
          .from('tr_shared_responses')
          .insert({
            task_id: taskId,
            subtask_id: subtaskId,
            visitor_name: visitorName,
            response_type: 'completion',
            is_completed: true
          });

        if (error) throw error;
      } else {
        // Remove subtask completion response
        const { error } = await supabase
          .from('tr_shared_responses')
          .delete()
          .eq('task_id', taskId)
          .eq('subtask_id', subtaskId)
          .eq('visitor_name', visitorName)
          .eq('response_type', 'completion');

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error marking subtask completed:', error);
      throw error;
    }
  }

  // Add a comment
  static async addComment(taskId: string, visitorName: string, content: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_responses')
        .insert({
          task_id: taskId,
          visitor_name: visitorName,
          response_type: 'comment',
          content: content
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  // Request snooze
  static async requestSnooze(taskId: string, visitorName: string, reason?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_responses')
        .insert({
          task_id: taskId,
          visitor_name: visitorName,
          response_type: 'snooze_request',
          content: reason
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error requesting snooze:', error);
      throw error;
    }
  }

  // Approve snooze request
  static async approveSnoozeRequest(requestId: string, taskId: string): Promise<void> {
    // First delete the request
    try {
      const { error } = await supabase
        .from('tr_shared_responses')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      // Then update the task with a snooze
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { error: updateError } = await supabase
        .from('tr_tasks')
        .update({
          snoozed_until: tomorrow.toISOString(),
        })
        .eq('id', taskId);

      if (updateError) throw updateError;
      
    } catch (error) {
      console.error('Error approving snooze request:', error);
      throw error;
    }
  }

  // Deny snooze request
  static async denySnoozeRequest(requestId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_responses')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      console.error('Error denying snooze request:', error);
      throw error;
    }
  }

  // Subscribe to real-time updates
  static subscribeToTaskUpdates(taskId: string, onUpdate: () => void) {
    const channel = supabase
      .channel(`task-responses-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tr_shared_responses',
          filter: `task_id=eq.${taskId}`
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          onUpdate();
        }
      )
      .subscribe();

    return channel;
  }
}
