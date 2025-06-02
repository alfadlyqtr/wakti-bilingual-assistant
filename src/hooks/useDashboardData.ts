
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
  created_at: string;
  task_type: string;
}

interface LegacyEvent {
  id: string;
  title: string;
  start_time?: string;
  location?: string;
  created_at: string;
}

export const useDashboardData = () => {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [events, setEvents] = useState<LegacyEvent[]>([]);
  const [reminders, setReminders] = useState<MyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      console.log('Fetching dashboard data (new my_tasks system)');
      
      // Update overdue tasks first
      try {
        await supabase.rpc('update_overdue_tasks');
      } catch (err) {
        console.warn('Could not update overdue tasks:', err);
      }

      // Fetch tasks and reminders from new my_tasks table
      const { data: myTasksData, error: myTasksError } = await supabase
        .from('my_tasks')
        .select('id, title, status, priority, due_date, created_at, task_type')
        .order('created_at', { ascending: false })
        .limit(10);

      if (myTasksError) {
        console.error('Error fetching my_tasks:', myTasksError);
      } else {
        console.log('Fetched my_tasks for dashboard:', myTasksData?.length || 0);
        
        const tasksList = myTasksData?.filter(item => item.task_type === 'task') || [];
        const remindersList = myTasksData?.filter(item => item.task_type === 'reminder') || [];
        
        setTasks(tasksList.slice(0, 5));
        setReminders(remindersList.slice(0, 5));
      }

      // Note: No events fetch since this is for the new system
      console.log('Dashboard widgets updated with new my_tasks system');
      setEvents([]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    tasks,
    events, // Empty array for legacy compatibility
    reminders,
    isLoading,
    refetch: fetchDashboardData
  };
};
