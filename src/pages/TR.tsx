import React, { useState, useEffect } from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { TaskList } from '@/components/tr/TaskList';
import { CreateTaskDialog } from '@/components/tr/CreateTaskDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
  user_id: string;
  created_at: string;
}

const TR = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
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

        setTasks(data || []);
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

  const handleCreateTask = async (newTask: Omit<Task, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('my_tasks')
        .insert([{ ...newTask, user_id: user.id }])
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        toast.error('Failed to create task.');
        return;
      }

      setTasks([...tasks, data]);
      setIsCreateDialogOpen(false);
      toast.success('Task created successfully!');
      refetch();
    } catch (error) {
      console.error('Unexpected error creating task:', error);
      toast.error('Unexpected error creating task.');
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
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

      setTasks(tasks.map(task => task.id === taskId ? data : task));
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
        <CreateTaskDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onCreate={handleCreateTask}
        />
      </div>
    </div>
  );
};

export default TR;
