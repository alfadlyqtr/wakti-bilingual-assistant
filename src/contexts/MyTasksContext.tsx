
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';

export interface MyTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'normal' | 'urgent' | 'high';
  task_type: 'task' | 'reminder';
  is_repeated: boolean;
  is_shared: boolean;
  status: 'pending' | 'completed' | 'overdue';
  subtasks: Subtask[];
  short_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_by_user_id?: string;
  completed_by_name: string;
  completed_at: string;
  completion_type: 'task' | 'subtask';
  subtask_index?: number;
}

interface MyTasksContextType {
  tasks: MyTask[];
  loading: boolean;
  error: string | null;
  createTask: (task: Omit<MyTask, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<MyTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  enableSharing: (id: string) => Promise<string>;
  disableSharing: (id: string) => Promise<void>;
  fetchTasks: () => Promise<void>;
  clearError: () => void;
}

const MyTasksContext = createContext<MyTasksContextType | undefined>(undefined);

export const MyTasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { language } = useTheme();

  const clearError = () => setError(null);

  const fetchTasks = async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, update any overdue tasks
      await supabase.rpc('update_overdue_tasks');

      const { data, error: fetchError } = await supabase
        .from('my_tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsLast: true });

      if (fetchError) throw fetchError;

      const formattedTasks: MyTask[] = (data || []).map(task => ({
        ...task,
        subtasks: task.subtasks || []
      }));

      setTasks(formattedTasks);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message || t('errorFetchingTasks', language));
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (taskData: Omit<MyTask, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      setError(null);
      const { data, error: createError } = await supabase
        .from('my_tasks')
        .insert({
          ...taskData,
          user_id: user.id
        })
        .select()
        .single();

      if (createError) throw createError;

      toast.success(t(taskData.task_type === 'task' ? 'taskCreated' : 'reminderCreated', language));
      await fetchTasks();
    } catch (err: any) {
      console.error('Error creating task:', err);
      setError(err.message || t('errorCreatingTask', language));
      toast.error(t('errorCreatingTask', language));
    }
  };

  const updateTask = async (id: string, updates: Partial<MyTask>) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('my_tasks')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchTasks();
    } catch (err: any) {
      console.error('Error updating task:', err);
      setError(err.message || t('errorUpdatingTask', language));
      toast.error(t('errorUpdatingTask', language));
    }
  };

  const deleteTask = async (id: string) => {
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('my_tasks')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success(t('taskDeleted', language));
      await fetchTasks();
    } catch (err: any) {
      console.error('Error deleting task:', err);
      setError(err.message || t('errorDeletingTask', language));
      toast.error(t('errorDeletingTask', language));
    }
  };

  const toggleTaskStatus = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTask(id, { status: newStatus });
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map(subtask =>
      subtask.id === subtaskId
        ? { ...subtask, completed: !subtask.completed }
        : subtask
    );

    await updateTask(taskId, { subtasks: updatedSubtasks });
  };

  const enableSharing = async (id: string): Promise<string> => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('my_tasks')
        .update({ is_shared: true })
        .eq('id', id)
        .select('short_id')
        .single();

      if (updateError) throw updateError;

      await fetchTasks();
      toast.success(t('taskSharingEnabled', language));
      return data.short_id;
    } catch (err: any) {
      console.error('Error enabling sharing:', err);
      setError(err.message || t('errorEnablingSharing', language));
      toast.error(t('errorEnablingSharing', language));
      throw err;
    }
  };

  const disableSharing = async (id: string) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('my_tasks')
        .update({ is_shared: false })
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchTasks();
      toast.success(t('taskSharingDisabled', language));
    } catch (err: any) {
      console.error('Error disabling sharing:', err);
      setError(err.message || t('errorDisablingSharing', language));
      toast.error(t('errorDisablingSharing', language));
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const value: MyTasksContextType = {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleSubtask,
    enableSharing,
    disableSharing,
    fetchTasks,
    clearError
  };

  return (
    <MyTasksContext.Provider value={value}>
      {children}
    </MyTasksContext.Provider>
  );
};

export const useMyTasks = () => {
  const context = useContext(MyTasksContext);
  if (context === undefined) {
    throw new Error('useMyTasks must be used within a MyTasksProvider');
  }
  return context;
};
