
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useDashboardData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .order('due_date', { ascending: true })
          .limit(3);
          
        if (!tasksError) {
          setTasks(tasksData || []);
        } else {
          console.error('Error fetching tasks:', tasksError);
          setTasks([]);
        }
        
        // Fetch events
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .order('start_time', { ascending: true })
          .limit(2);
          
        if (!eventsError) {
          setEvents(eventsData || []);
        } else {
          console.error('Error fetching events:', eventsError);
          setEvents([]);
        }
        
        // Fetch reminders
        const { data: remindersData, error: remindersError } = await supabase
          .from('reminders')
          .select('*')
          .order('due_date', { ascending: true })
          .limit(2);
          
        if (!remindersError) {
          setReminders(remindersData || []);
        } else {
          console.error('Error fetching reminders:', remindersError);
          setReminders([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  return { isLoading, tasks, events, reminders };
};
