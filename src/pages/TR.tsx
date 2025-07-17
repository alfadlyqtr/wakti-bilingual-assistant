
import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { TaskList } from '@/components/tr/TaskList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

interface TRTask {
  id: string;
  title: string;
  description?: string;
  due_date: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'normal' | 'high';
  task_type: 'one-time' | 'recurring';
  is_shared: boolean;
  completed: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const TR = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { refetch } = useUnreadMessages();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('my_tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching tasks:', error);
          toast.error('Failed to load tasks.');
        }

        // Map the data to match TRTask interface
        const mappedTasks: TRTask[] = (data || []).map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          due_date: task.due_date,
          status: task.status,
          priority: task.priority || 'normal',
          task_type: task.task_type || 'one-time',
          is_shared: task.is_shared || false,
          completed: task.status === 'completed',
          user_id: task.user_id,
          created_at: task.created_at,
          updated_at: task.updated_at || task.created_at
        }));

        setTasks(mappedTasks);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();

    // Setup real-time subscription for task updates
    const taskSubscription = supabase
      .channel('public:my_tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'my_tasks' },
        (payload) => {
          console.log('Task change received!', payload);
          fetchTasks(); // Refresh tasks on any change
          refetch(); // Refresh unread counts
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskSubscription);
    };
  }, [user, refetch]);

  const handleCreateTask = async (newTaskData: Partial<TRTask>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('my_tasks')
        .insert([{ 
          ...newTaskData, 
          user_id: user.id,
          status: 'open'
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        toast.error('Failed to create task.');
        return;
      }

      // Map the created task to TRTask format
      const mappedTask: TRTask = {
        id: data.id,
        title: data.title,
        description: data.description,
        due_date: data.due_date,
        status: data.status,
        priority: data.priority || 'normal',
        task_type: data.task_type || 'one-time',
        is_shared: data.is_shared || false,
        completed: data.status === 'completed',
        user_id: data.user_id,
        created_at: data.created_at,
        updated_at: data.updated_at || data.created_at
      };

      setTasks([mappedTask, ...tasks]);
      setIsCreateDialogOpen(false);
      toast.success('Task created successfully!');
      refetch();
    } catch (error) {
      console.error('Unexpected error creating task:', error);
      toast.error('Unexpected error creating task.');
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<TRTask>) => {
    try {
      const { data, error } = await supabase
        .from('my_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('Error updating task:', error);
        toast.error('Failed to update task.');
        return;
      }

      // Map the updated task to TRTask format
      const mappedTask: TRTask = {
        id: data.id,
        title: data.title,
        description: data.description,
        due_date: data.due_date,
        status: data.status,
        priority: data.priority || 'normal',
        task_type: data.task_type || 'one-time',
        is_shared: data.is_shared || false,
        completed: data.status === 'completed',
        user_id: data.user_id,
        created_at: data.created_at,
        updated_at: data.updated_at || data.created_at
      };

      setTasks(tasks.map(task => task.id === taskId ? mappedTask : task));
      toast.success('Task updated successfully!');
      refetch();
    } catch (error) {
      console.error('Unexpected error updating task:', error);
      toast.error('Unexpected error updating task.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('my_tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        toast.error('Failed to delete task.');
        return;
      }

      setTasks(tasks.filter(task => task.id !== taskId));
      toast.success('Task deleted successfully!');
      refetch();
    } catch (error) {
      console.error('Unexpected error deleting task:', error);
      toast.error('Unexpected error deleting task.');
    }
  };

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-foreground">My Tasks</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        </div>
        <TaskList
          tasks={tasks}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
        {/* Create dialog would go here - simplified for now */}
      </div>
    </div>
  );
};

export default TR;
