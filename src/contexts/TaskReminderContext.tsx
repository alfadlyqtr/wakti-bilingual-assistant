
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from "sonner";
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

// Types
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'completed' | 'overdue';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TaskType = 'task' | 'reminder';

export interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  task_id: string;
}

export interface Task {
  id: string;
  user_id: string;
  type: TaskType;
  title: string;
  description?: string;
  due_date?: string;
  priority: TaskPriority;
  status: TaskStatus;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  subtask_group_title?: string;
  created_at: string;
  updated_at: string;
  subtasks?: Subtask[];
  is_shared?: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  due_date: string;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TaskReminderContextType {
  tasks: Task[];
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  fetchReminders: () => Promise<void>;
  createTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>, subtasks?: Omit<Subtask, 'id' | 'task_id'>[]) => Promise<string | null>;
  updateTask: (taskId: string, task: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  createReminder: (reminder: Omit<Reminder, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Promise<string | null>;
  updateReminder: (reminderId: string, reminder: Partial<Omit<Reminder, 'id' | 'created_by' | 'created_at' | 'updated_at'>>) => Promise<boolean>;
  deleteReminder: (reminderId: string) => Promise<boolean>;
  createSubtask: (taskId: string, title: string) => Promise<string | null>;
  updateSubtask: (subtaskId: string, isCompleted: boolean) => Promise<boolean>;
  deleteSubtask: (subtaskId: string) => Promise<boolean>;
  shareTask: (taskId: string, userId: string) => Promise<boolean>;
  unshareTask: (taskId: string, userId: string) => Promise<boolean>;
  fetchSharedUsers: (taskId: string) => Promise<string[]>;
  clearError: () => void;
}

const TaskReminderContext = createContext<TaskReminderContextType | undefined>(undefined);

export const TaskReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { language } = useTheme();

  const clearError = () => {
    setError(null);
  };

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session found');
        return false;
      }
      console.log('User authenticated:', session.user.id);
      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  };

  const fetchTasks = async () => {
    try {
      setError(null);
      console.log('Starting fetchTasks...');
      
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        console.log('Not authenticated, setting empty tasks array');
        setTasks([]);
        return;
      }

      console.log('Fetching tasks from database...');
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'task')
        .order('due_date', { ascending: true });

      if (tasksError) {
        console.error('Database error fetching tasks:', tasksError);
        setError(`Database error: ${tasksError.message}`);
        return;
      }

      const tasksList = tasksData || [];
      console.log(`Successfully fetched ${tasksList.length} tasks`);

      const tasksWithSubtasks = await Promise.all(tasksList.map(async (task) => {
        try {
          const { data: subtasks, error: subtasksError } = await supabase
            .from('subtasks')
            .select('*')
            .eq('task_id', task.id)
            .order('created_at');

          if (subtasksError) {
            console.warn('Error fetching subtasks for task', task.id, ':', subtasksError);
          }

          const { data: sharedData, error: sharedError } = await supabase
            .from('task_shares')
            .select('id')
            .eq('task_id', task.id);

          if (sharedError) {
            console.warn('Error checking shared status for task', task.id, ':', sharedError);
          }

          return { 
            ...task, 
            subtasks: subtasks || [],
            is_shared: sharedData && sharedData.length > 0,
            priority: task.priority as TaskPriority,
            status: task.status as TaskStatus,
            recurrence_pattern: task.recurrence_pattern as RecurrencePattern | undefined,
            type: task.type as TaskType
          };
        } catch (error) {
          console.warn('Error processing task:', task.id, error);
          return { 
            ...task, 
            subtasks: [],
            is_shared: false,
            priority: task.priority as TaskPriority,
            status: task.status as TaskStatus,
            recurrence_pattern: task.recurrence_pattern as RecurrencePattern | undefined,
            type: task.type as TaskType
          };
        }
      }));

      const now = new Date();
      const updatedTasks = tasksWithSubtasks.map(task => {
        if (task.status !== 'completed' && task.due_date && new Date(task.due_date) < now) {
          return { ...task, status: 'overdue' as TaskStatus };
        }
        return task;
      });

      setTasks(updatedTasks);
      console.log('Tasks state updated successfully');
    } catch (error) {
      console.error('Unexpected error in fetchTasks:', error);
      setError('An unexpected error occurred while loading tasks. Please try again.');
    }
  };

  const fetchReminders = async () => {
    try {
      setError(null);
      console.log('Starting fetchReminders...');
      
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        console.log('Not authenticated, setting empty reminders array');
        setReminders([]);
        return;
      }

      console.log('Fetching reminders from database...');
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('type', 'reminder')
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Database error fetching reminders:', error);
        setError(`Database error: ${error.message}`);
        return;
      }

      const remindersList = data || [];
      console.log(`Successfully fetched ${remindersList.length} reminders`);

      const typedReminders = remindersList.map(reminder => ({
        id: reminder.id,
        title: reminder.title,
        due_date: reminder.due_date,
        is_recurring: reminder.is_recurring,
        recurrence_pattern: reminder.recurrence_pattern as RecurrencePattern | undefined,
        created_by: reminder.user_id,
        created_at: reminder.created_at,
        updated_at: reminder.updated_at
      }));

      setReminders(typedReminders);
      console.log('Reminders state updated successfully');
    } catch (error) {
      console.error('Unexpected error in fetchReminders:', error);
      setError('An unexpected error occurred while loading reminders. Please try again.');
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Initializing TaskReminderProvider...');
        
        await Promise.allSettled([fetchTasks(), fetchReminders()]);
        
        console.log('Initial data fetch completed');
      } catch (error) {
        console.error('Error during initialization:', error);
        setError('Failed to initialize. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session ? 'authenticated' : 'not authenticated');
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setTimeout(() => {
            fetchTasks();
            fetchReminders();
          }, 100);
        } else if (event === 'SIGNED_OUT') {
          setTasks([]);
          setReminders([]);
          setError(null);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const createTask = async (
    taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    subtasks?: Omit<Subtask, 'id' | 'task_id'>[]
  ) => {
    try {
      setError(null);
      
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        setError("Authentication required to create tasks");
        sonnerToast.error("Authentication Error", {
          description: "You must be logged in to create tasks"
        });
        return null;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...taskData,
          user_id: userId
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating task:', error);
        setError(`Failed to create task: ${error.message}`);
        sonnerToast.error("Error", {
          description: error.message
        });
        return null;
      }

      const taskId = data.id;

      if (subtasks && subtasks.length > 0) {
        const subtasksToInsert = subtasks.map(subtask => ({
          ...subtask,
          task_id: taskId
        }));

        const { error: subtaskError } = await supabase
          .from('subtasks')
          .insert(subtasksToInsert);

        if (subtaskError) {
          console.error('Error creating subtasks:', subtaskError);
          sonnerToast.warning("Warning", {
            description: "Task created but failed to add subtasks"
          });
        }
      }

      sonnerToast.success(t("taskCreatedSuccessfully", language));

      await fetchTasks();
      return taskId;
    } catch (error) {
      console.error('Error in createTask:', error);
      setError('Failed to create task. Please try again.');
      return null;
    }
  };

  const updateTask = async (
    taskId: string,
    taskData: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task:', error);
        setError(`Failed to update task: ${error.message}`);
        sonnerToast.error("Error", {
          description: error.message
        });
        return false;
      }

      sonnerToast.success(t("taskUpdatedSuccessfully", language));

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error in updateTask:', error);
      setError('Failed to update task. Please try again.');
      return false;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        setError(`Failed to delete task: ${error.message}`);
        sonnerToast.error("Error", {
          description: error.message
        });
        return false;
      }

      sonnerToast.success(t("taskDeletedSuccessfully", language));

      setTasks(tasks.filter(task => task.id !== taskId));
      return true;
    } catch (error) {
      console.error('Error in deleteTask:', error);
      setError('Failed to delete task. Please try again.');
      return false;
    }
  };

  const createReminder = async (
    reminderData: Omit<Reminder, 'id' | 'created_by' | 'created_at' | 'updated_at'>
  ) => {
    try {
      setError(null);
      
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        setError("Authentication required to create reminders");
        sonnerToast.error("Authentication Error", {
          description: "You must be logged in to create reminders"
        });
        return null;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          type: 'reminder',
          title: reminderData.title,
          due_date: reminderData.due_date,
          is_recurring: reminderData.is_recurring,
          recurrence_pattern: reminderData.recurrence_pattern,
          priority: 'medium',
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating reminder:', error);
        setError(`Failed to create reminder: ${error.message}`);
        sonnerToast.error("Error", {
          description: error.message
        });
        return null;
      }

      sonnerToast.success(t("reminderCreatedSuccessfully", language));

      await fetchReminders();
      return data.id;
    } catch (error) {
      console.error('Error in createReminder:', error);
      setError('Failed to create reminder. Please try again.');
      return null;
    }
  };

  const updateReminder = async (
    reminderId: string,
    reminderData: Partial<Omit<Reminder, 'id' | 'created_by' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('tasks')
        .update({
          title: reminderData.title,
          due_date: reminderData.due_date,
          is_recurring: reminderData.is_recurring,
          recurrence_pattern: reminderData.recurrence_pattern
        })
        .eq('id', reminderId);

      if (error) {
        console.error('Error updating reminder:', error);
        setError(`Failed to update reminder: ${error.message}`);
        sonnerToast.error("Error", {
          description: error.message
        });
        return false;
      }

      sonnerToast.success(t("reminderUpdatedSuccessfully", language));

      await fetchReminders();
      return true;
    } catch (error) {
      console.error('Error in updateReminder:', error);
      setError('Failed to update reminder. Please try again.');
      return false;
    }
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', reminderId);

      if (error) {
        console.error('Error deleting reminder:', error);
        setError(`Failed to delete reminder: ${error.message}`);
        sonnerToast.error("Error", {
          description: error.message
        });
        return false;
      }

      sonnerToast.success(t("reminderDeletedSuccessfully", language));

      setReminders(reminders.filter(reminder => reminder.id !== reminderId));
      return true;
    } catch (error) {
      console.error('Error in deleteReminder:', error);
      setError('Failed to delete reminder. Please try again.');
      return false;
    }
  };

  const createSubtask = async (taskId: string, title: string) => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('subtasks')
        .insert({
          task_id: taskId,
          title,
          is_completed: false
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating subtask:', error);
        setError(`Failed to create subtask: ${error.message}`);
        sonnerToast.error("Error", {
          description: error.message
        });
        return null;
      }

      await fetchTasks();
      return data.id;
    } catch (error) {
      console.error('Error in createSubtask:', error);
      setError('Failed to create subtask. Please try again.');
      return null;
    }
  };

  const updateSubtask = async (subtaskId: string, isCompleted: boolean) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('subtasks')
        .update({ is_completed: isCompleted })
        .eq('id', subtaskId);

      if (error) {
        console.error('Error updating subtask:', error);
        setError(`Failed to update subtask: ${error.message}`);
        return false;
      }

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error in updateSubtask:', error);
      setError('Failed to update subtask. Please try again.');
      return false;
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) {
        console.error('Error deleting subtask:', error);
        setError(`Failed to delete subtask: ${error.message}`);
        return false;
      }

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error in deleteSubtask:', error);
      setError('Failed to delete subtask. Please try again.');
      return false;
    }
  };

  const shareTask = async (taskId: string, userId: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('task_shares')
        .insert({
          task_id: taskId,
          shared_with: userId
        });

      if (error) {
        console.error('Error sharing task:', error);
        setError(`Failed to share task: ${error.message}`);
        sonnerToast.error("Error", {
          description: error.message
        });
        return false;
      }

      sonnerToast.success(t("taskSharedSuccessfully", language));

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error in shareTask:', error);
      setError('Failed to share task. Please try again.');
      return false;
    }
  };

  const unshareTask = async (taskId: string, userId: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('task_shares')
        .delete()
        .eq('task_id', taskId)
        .eq('shared_with', userId);

      if (error) {
        console.error('Error unsharing task:', error);
        setError(`Failed to unshare task: ${error.message}`);
        return false;
      }

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error in unshareTask:', error);
      setError('Failed to unshare task. Please try again.');
      return false;
    }
  };

  const fetchSharedUsers = async (taskId: string) => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('task_shares')
        .select('shared_with')
        .eq('task_id', taskId);

      if (error) {
        console.error('Error fetching shared users:', error);
        setError(`Failed to fetch shared users: ${error.message}`);
        return [];
      }

      return data.map(item => item.shared_with);
    } catch (error) {
      console.error('Error in fetchSharedUsers:', error);
      setError('Failed to fetch shared users. Please try again.');
      return [];
    }
  };

  const contextValue: TaskReminderContextType = {
    tasks,
    reminders,
    loading,
    error,
    fetchTasks,
    fetchReminders,
    createTask,
    updateTask,
    deleteTask,
    createReminder,
    updateReminder,
    deleteReminder,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    shareTask,
    unshareTask,
    fetchSharedUsers,
    clearError
  };

  return (
    <TaskReminderContext.Provider value={contextValue}>
      {children}
    </TaskReminderContext.Provider>
  );
};

export const useTaskReminder = () => {
  const context = useContext(TaskReminderContext);
  if (context === undefined) {
    throw new Error('useTaskReminder must be used within a TaskReminderProvider');
  }
  return context;
};
