
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LegacyEvent {
  id: string;
  title: string;
  start_time?: string;
  location?: string;
  created_at: string;
}

export const useDashboardData = () => {
  const [events, setEvents] = useState<LegacyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      console.log('Fetching dashboard data (legacy systems only)');
      
      // Note: We're NOT fetching any events here since this is for the legacy system
      // The dashboard should show no task/reminder widgets
      console.log('Skipping events fetch - using Maw3d system instead');
      setEvents([]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    events, // This will be empty array to avoid conflicts with Maw3d
    isLoading,
    refetch: fetchDashboardData
  };
};
