
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
  created_at: string;
}

interface LegacyEvent {
  id: string;
  title: string;
  start_time?: string;
  location?: string;
  created_at: string;
}

interface Reminder {
  id: string;
  title: string;
  due_date: string;
  created_at: string;
}

export const useDashboardData = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<LegacyEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      console.log('Fetching dashboard data (legacy systems only)');
      
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
      } else {
        console.log('Fetched tasks for dashboard:', tasksData?.length || 0);
        setTasks(tasksData || []);
      }

      // Note: We're NOT fetching any events here since this is for the legacy system
      // The dashboard should show tasks and reminders, but no events to avoid conflicts
      console.log('Skipping events fetch - using Maw3d system instead');
      setEvents([]);

      // Fetch reminders
      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .select('id, title, due_date, created_at')
        .order('due_date', { ascending: true })
        .limit(5);

      if (remindersError) {
        console.error('Error fetching reminders:', remindersError);
      } else {
        console.log('Fetched reminders for dashboard:', remindersData?.length || 0);
        setReminders(remindersData || []);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    tasks,
    events, // This will be empty array to avoid conflicts with Maw3d
    reminders,
    isLoading,
    refetch: fetchDashboardData
  };
};
