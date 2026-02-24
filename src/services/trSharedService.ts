// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import { TRSubtask } from "./trService";

export interface TRSharedResponse {
  id: string;
  task_id: string;
  visitor_name: string;
  response_type: 'completion' | 'comment' | 'snooze_request' | 'uncheck_request' | 'completion_request';
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

  // Clear all completion responses for a specific subtask (owner uncheck policy)
  static async clearAllSubtaskCompletions(taskId: string, subtaskId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_responses')
        .delete()
        .eq('task_id', taskId)
        .eq('subtask_id', subtaskId)
        .eq('response_type', 'completion');
      if (error) throw error;
    } catch (error) {
      console.error('Error clearing subtask completions:', error);
      throw error;
    }
  }

  // Approve uncheck request: owner sets the real subtask to incomplete and stamps the request
  static async approveUncheckRequest(requestId: string, taskId: string, subtaskId: string): Promise<void> {
    try {
      const { error: updateError } = await supabase
        .from('tr_shared_responses')
        .update({ content: JSON.stringify({ status: 'approved', actionTime: new Date().toISOString() }) })
        .eq('id', requestId);
      if (updateError) throw updateError;

      const { error: subErr } = await supabase
        .from('tr_subtasks')
        .update({ completed: false })
        .eq('id', subtaskId)
        .eq('task_id', taskId);
      if (subErr) throw subErr;
    } catch (error) {
      console.error('Error approving uncheck request:', error);
      throw error;
    }
  }

  // Deny uncheck request
  static async denyUncheckRequest(requestId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_responses')
        .update({ content: JSON.stringify({ status: 'denied', actionTime: new Date().toISOString() }) })
        .eq('id', requestId);
      if (error) throw error;
    } catch (error) {
      console.error('Error denying uncheck request:', error);
      throw error;
    }
  }


  // Request to uncheck a subtask (assignee cannot directly uncheck)
  static async requestUncheck(taskId: string, subtaskId: string, visitorName: string, reason?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_responses')
        .insert({
          task_id: taskId,
          subtask_id: subtaskId,
          visitor_name: visitorName,
          response_type: 'uncheck_request',
          content: reason || null
        });
      if (error) throw error;
    } catch (error) {
      console.error('Error requesting uncheck:', error);
      throw error;
    }
  }
  

  // Get visitor access information for a task
  static async getTaskVisitors(taskId: string): Promise<TRSharedAccess[]> {
    try {
      const { data, error } = await supabase
        .from('tr_shared_responses')
        .select('id, task_id, visitor_name, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const seen = new Set<string>();
      const unique = (data || []).filter(r => {
        if (seen.has(r.visitor_name)) return false;
        seen.add(r.visitor_name);
        return true;
      });
      return unique.map(r => ({ id: r.id, task_id: r.task_id, viewer_name: r.visitor_name, last_accessed: r.created_at, created_at: r.created_at }));
    } catch (error) {
      console.error('Error getting task visitors:', error);
      return [];
    }
  }

  // ── Unified People list for a task ──
  // Returns owner + all approved app assignees + all link visitors (deduplicated)
  static async getTaskPeople(taskId: string): Promise<{ owner: { name: string; userId: string } | null; participants: { name: string; source: 'app' | 'link'; lastActivity: string | null }[] }> {
    try {
      // 1. Get task owner userId
      const { data: taskData } = await supabase
        .from('tr_tasks')
        .select('user_id')
        .eq('id', taskId)
        .single();

      let owner: { name: string; userId: string } | null = null;
      if (taskData?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, first_name, last_name')
          .eq('id', taskData.user_id)
          .single();
        if (profile) {
          const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
          owner = { name: profile.display_name || full || 'Owner', userId: taskData.user_id };
        }
      }

      // 2. Get approved assignees from tr_task_assignments
      const { data: assignments } = await supabase
        .from('tr_task_assignments')
        .select('assignee_name')
        .eq('task_id', taskId)
        .eq('status', 'approved');

      // 3. Get unique visitor names from tr_shared_responses
      const { data: responseNames } = await supabase
        .from('tr_shared_responses')
        .select('visitor_name, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      // Build deduplicated participants map (name → { source, lastActivity })
      const participantMap = new Map<string, { source: 'app' | 'link'; lastActivity: string | null }>();

      // Add app assignees first
      for (const a of (assignments || [])) {
        if (a.assignee_name && (!owner || a.assignee_name !== owner.name)) {
          participantMap.set(a.assignee_name, { source: 'app', lastActivity: null });
        }
      }

      // Add link visitors from responses (merge, don't overwrite app source)
      const ownerAliases = new Set(['Owner', 'Owner (You)']);
      if (owner) ownerAliases.add(owner.name);
      for (const r of (responseNames || [])) {
        if (!r.visitor_name || ownerAliases.has(r.visitor_name)) continue;
        if (!participantMap.has(r.visitor_name)) {
          participantMap.set(r.visitor_name, { source: 'link', lastActivity: r.created_at });
        } else {
          // Update lastActivity if newer
          const existing = participantMap.get(r.visitor_name)!;
          if (!existing.lastActivity || (r.created_at && r.created_at > existing.lastActivity)) {
            existing.lastActivity = r.created_at;
          }
        }
      }

      const participants = Array.from(participantMap.entries()).map(([name, info]) => ({
        name,
        source: info.source,
        lastActivity: info.lastActivity,
      }));

      return { owner, participants };
    } catch (error) {
      console.error('Error getting task people:', error);
      return { owner: null, participants: [] };
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

        // Also mark the owner task as completed so everyone sees it as done immediately
        const { error: taskErr } = await supabase
          .from('tr_tasks')
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq('id', taskId);
        if (taskErr) throw taskErr;
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
        // Do NOT auto-uncomplete the owner task here; owner can override from their side.
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

        // Auto-sync: mark the real subtask as completed for the owner view
        const { error: subErr } = await supabase
          .from('tr_subtasks')
          .update({ completed: true })
          .eq('id', subtaskId)
          .eq('task_id', taskId);
        if (subErr) throw subErr;
      } else {
        // By policy: only owner can uncheck. Visitors should request uncheck instead.
        // We'll still allow explicit calls (owner tools) to clear a completion response if needed.
        const { error: delErr } = await supabase
          .from('tr_shared_responses')
          .delete()
          .eq('task_id', taskId)
          .eq('subtask_id', subtaskId)
          .eq('visitor_name', visitorName)
          .eq('response_type', 'completion');
        if (delErr) throw delErr;
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

  // Approve snooze request - updated to keep the request record with a status flag
  static async approveSnoozeRequest(requestId: string, taskId: string): Promise<void> {
    try {
      // Update the snooze request with an approval flag in the content
      const { error: updateError } = await supabase
        .from('tr_shared_responses')
        .update({
          content: JSON.stringify({
            status: 'approved',
            originalContent: (await supabase
              .from('tr_shared_responses')
              .select('content')
              .eq('id', requestId)
              .single()).data?.content,
            actionTime: new Date().toISOString()
          })
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Then update the task with a snooze
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { error: taskUpdateError } = await supabase
        .from('tr_tasks')
        .update({
          snoozed_until: tomorrow.toISOString(),
        })
        .eq('id', taskId);

      if (taskUpdateError) throw taskUpdateError;
      
    } catch (error) {
      console.error('Error approving snooze request:', error);
      throw error;
    }
  }

  // Deny snooze request - updated to keep the request record with a status flag
  static async denySnoozeRequest(requestId: string): Promise<void> {
    try {
      // Update the snooze request with a denial flag in the content
      const { error } = await supabase
        .from('tr_shared_responses')
        .update({
          content: JSON.stringify({
            status: 'denied',
            originalContent: (await supabase
              .from('tr_shared_responses')
              .select('content')
              .eq('id', requestId)
              .single()).data?.content,
            actionTime: new Date().toISOString()
          })
        })
        .eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      console.error('Error denying snooze request:', error);
      throw error;
    }
  }

  // Request task completion (assignee cannot directly complete main task)
  static async requestTaskCompletion(taskId: string, visitorName: string): Promise<void> {
    try {
      // First check if there's already a pending request to prevent duplicates
      const { data: existing } = await supabase
        .from('tr_shared_responses')
        .select('id, content')
        .eq('task_id', taskId)
        .eq('response_type', 'completion_request');
        
      const hasPending = existing?.some(r => {
        try {
          const parsed = JSON.parse(r.content || '{}');
          return parsed.status !== 'approved' && parsed.status !== 'denied';
        } catch {
          return true; // if no content or unparseable, it's pending
        }
      });

      if (hasPending) {
        throw new Error('A completion request is already pending');
      }

      const { error } = await supabase
        .from('tr_shared_responses')
        .insert({
          task_id: taskId,
          visitor_name: visitorName,
          response_type: 'completion_request',
          is_completed: true
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error requesting task completion:', error);
      throw error;
    }
  }

  // Approve completion request - marks task as completed
  static async approveCompletionRequest(requestId: string, taskId: string, visitorName: string): Promise<void> {
    try {
      // Update ALL completion requests for this task to 'approved' to clean up duplicates
      // Since the task is being marked completed, any pending requests from anyone are resolved.
      const { error: updateError } = await supabase
        .from('tr_shared_responses')
        .update({
          content: JSON.stringify({
            status: 'approved',
            actionTime: new Date().toISOString()
          })
        })
        .eq('task_id', taskId)
        .eq('response_type', 'completion_request');

      if (updateError) throw updateError;

      // Mark the task as completed
      const { error: taskUpdateError } = await supabase
        .from('tr_tasks')
        .update({
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (taskUpdateError) throw taskUpdateError;

      // Add a completion response to record who completed it
      const { error: completionError } = await supabase
        .from('tr_shared_responses')
        .insert({
          task_id: taskId,
          visitor_name: visitorName,
          response_type: 'completion',
          is_completed: true
        });

      if (completionError) throw completionError;
      
    } catch (error) {
      console.error('Error approving completion request:', error);
      throw error;
    }
  }

  // Deny completion request
  static async denyCompletionRequest(requestId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tr_shared_responses')
        .update({
          content: JSON.stringify({
            status: 'denied',
            actionTime: new Date().toISOString()
          })
        })
        .eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      console.error('Error denying completion request:', error);
      throw error;
    }
  }

  // Subscribe to real-time updates
  static subscribeToTaskUpdates(taskId: string, onUpdate: () => void) {
    const channel = supabase
      .channel(`task-activity-${taskId}`)
      // Shared responses (comments, completions, requests)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_shared_responses', filter: `task_id=eq.${taskId}` }, () => onUpdate())
      // Subtasks (title/complete/due updates)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_subtasks', filter: `task_id=eq.${taskId}` }, () => onUpdate())
      // Visitors / access pings
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_shared_responses', filter: `task_id=eq.${taskId}` }, () => onUpdate())
      // Parent task updates (e.g., task completed, snoozed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_tasks', filter: `id=eq.${taskId}` }, () => onUpdate())
      .subscribe();

    return channel;
  }
}
