
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from "sonner";
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

// Types
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'completed' | 'overdue';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  task_id: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: TaskPriority;
  status: TaskStatus;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  subtask_group_title?: string;
  created_by: string;
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
  fetchTasks: () => Promise<void>;
  fetchReminders: () => Promise<void>;
  createTask: (task: Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>, subtasks?: Omit<Subtask, 'id' | 'task_id'>[]) => Promise<string | null>;
  updateTask: (taskId: string, task: Partial<Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>>) => Promise<boolean>;
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
}

const TaskReminderContext = createContext<TaskReminderContextType | undefined>(undefined);

export const TaskReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useTheme();

  // Fetch tasks on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      await Promise.all([fetchTasks(), fetchReminders()]);
      setLoading(false);
    };
    
    fetchInitialData();
    
    // Subscribe to changes in tasks and subtasks
    const tasksSubscription = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' }, 
        () => fetchTasks())
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'subtasks' }, 
        () => fetchTasks())
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reminders' }, 
        () => fetchReminders())
      .subscribe();
    
    return () => {
      supabase.removeChannel(tasksSubscription);
    };
  }, []);

  // Fetch tasks with their subtasks
  const fetchTasks = async () => {
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        return;
      }

      const tasksWithSubtasks = await Promise.all(tasksData.map(async (task) => {
        const { data: subtasks, error: subtasksError } = await supabase
          .from('subtasks')
          .select('*')
          .eq('task_id', task.id)
          .order('created_at');

        if (subtasksError) {
          console.error('Error fetching subtasks:', subtasksError);
          return { ...task, subtasks: [] };
        }

        // Check if task is shared
        const { data: sharedData } = await supabase
          .from('shared_tasks')
          .select('id')
          .eq('task_id', task.id);

        return { 
          ...task, 
          subtasks: subtasks || [],
          is_shared: sharedData && sharedData.length > 0
        };
      }));

      // Update overdue tasks
      const now = new Date();
      const updatedTasks = tasksWithSubtasks.map(task => {
        if (task.status !== 'completed' && task.due_date && new Date(task.due_date) < now) {
          return { 
            ...task, 
            status: 'overdue' as TaskStatus,
            priority: task.priority as TaskPriority,
            recurrence_pattern: task.recurrence_pattern as RecurrencePattern | undefined
          };
        }
        return { 
          ...task,
          priority: task.priority as TaskPriority,
          status: task.status as TaskStatus,
          recurrence_pattern: task.recurrence_pattern as RecurrencePattern | undefined
        };
      });

      setTasks(updatedTasks);
    } catch (error) {
      console.error('Error in fetchTasks:', error);
    }
  };

  // Fetch reminders
  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching reminders:', error);
        return;
      }

      const typedReminders = data.map(reminder => ({
        ...reminder,
        recurrence_pattern: reminder.recurrence_pattern as RecurrencePattern | undefined
      }));

      setReminders(typedReminders);
    } catch (error) {
      console.error('Error in fetchReminders:', error);
    }
  };

  // Create a new task
  const createTask = async (
    taskData: Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>,
    subtasks?: Omit<Subtask, 'id' | 'task_id'>[]
  ) => {
    try {
      const user = supabase.auth.getUser();
      const userId = (await user).data.user?.id;
      
      if (!userId) {
        sonnerToast.error("Authentication Error", {
          description: "You must be logged in to create tasks"
        });
        return null;
      }

      // Create task
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...taskData,
          created_by: userId
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating task:', error);
        sonnerToast.error("Error", {
          description: error.message
        });
        return null;
      }

      const taskId = data.id;

      // Create subtasks if provided
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
      return null;
    }
  };

  // Update an existing task
  const updateTask = async (
    taskId: string,
    taskData: Partial<Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task:', error);
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
      return false;
    }
  };

  // Delete a task
  const deleteTask = async (taskId: string) => {
    try {
      // Delete subtasks will cascade automatically due to foreign key constraint
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
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
      return false;
    }
  };

  // Create a new reminder
  const createReminder = async (
    reminderData: Omit<Reminder, 'id' | 'created_by' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const user = supabase.auth.getUser();
      const userId = (await user).data.user?.id;
      
      if (!userId) {
        sonnerToast.error("Authentication Error", {
          description: "You must be logged in to create reminders"
        });
        return null;
      }

      const { data, error } = await supabase
        .from('reminders')
        .insert({
          ...reminderData,
          created_by: userId
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating reminder:', error);
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
      return null;
    }
  };

  // Update an existing reminder
  const updateReminder = async (
    reminderId: string,
    reminderData: Partial<Omit<Reminder, 'id' | 'created_by' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update(reminderData)
        .eq('id', reminderId);

      if (error) {
        console.error('Error updating reminder:', error);
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
      return false;
    }
  };

  // Delete a reminder
  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId);

      if (error) {
        console.error('Error deleting reminder:', error);
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
      return false;
    }
  };

  // Create a new subtask
  const createSubtask = async (taskId: string, title: string) => {
    try {
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
        sonnerToast.error("Error", {
          description: error.message
        });
        return null;
      }

      await fetchTasks();
      return data.id;
    } catch (error) {
      console.error('Error in createSubtask:', error);
      return null;
    }
  };

  // Update subtask completion status
  const updateSubtask = async (subtaskId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ is_completed: isCompleted })
        .eq('id', subtaskId);

      if (error) {
        console.error('Error updating subtask:', error);
        return false;
      }

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error in updateSubtask:', error);
      return false;
    }
  };

  // Delete a subtask
  const deleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) {
        console.error('Error deleting subtask:', error);
        return false;
      }

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error in deleteSubtask:', error);
      return false;
    }
  };

  // Share a task with a user
  const shareTask = async (taskId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('shared_tasks')
        .insert({
          task_id: taskId,
          shared_with: userId
        });

      if (error) {
        console.error('Error sharing task:', error);
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
      return false;
    }
  };

  // Unshare a task with a user
  const unshareTask = async (taskId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('shared_tasks')
        .delete()
        .eq('task_id', taskId)
        .eq('shared_with', userId);

      if (error) {
        console.error('Error unsharing task:', error);
        return false;
      }

      await fetchTasks();
      return true;
    } catch (error) {
      console.error('Error in unshareTask:', error);
      return false;
    }
  };

  // Fetch users who have access to a shared task
  const fetchSharedUsers = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('shared_tasks')
        .select('shared_with')
        .eq('task_id', taskId);

      if (error) {
        console.error('Error fetching shared users:', error);
        return [];
      }

      return data.map(item => item.shared_with);
    } catch (error) {
      console.error('Error in fetchSharedUsers:', error);
      return [];
    }
  };

  const contextValue: TaskReminderContextType = {
    tasks,
    reminders,
    loading,
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
    fetchSharedUsers
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
