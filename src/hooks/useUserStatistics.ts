
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserStatistics {
  tasksCreated: number;
  eventsCreated: number;
  aiQueries: number;
  voiceUsage: {
    charactersUsed: number;
    charactersLimit: number;
    extraCharacters: number;
  };
  searchQuota: {
    monthlyCount: number;
    extraSearches: number;
  };
  tasjeelRecords: number;
  lastLoginAt: string | null;
}

export const useUserStatistics = (userId: string | null) => {
  const [statistics, setStatistics] = useState<UserStatistics>({
    tasksCreated: 0,
    eventsCreated: 0,
    aiQueries: 0,
    voiceUsage: {
      charactersUsed: 0,
      charactersLimit: 5000,
      extraCharacters: 0
    },
    searchQuota: {
      monthlyCount: 0,
      extraSearches: 0
    },
    tasjeelRecords: 0,
    lastLoginAt: null
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const loadUserStatistics = async () => {
      setIsLoading(true);
      try {
        // Load tasks created (TR tasks)
        const { count: tasksCreated } = await supabase
          .from('tr_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        // Load events created
        const { count: eventsCreated } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('organizer_id', userId);

        // Load AI queries (current month)
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
        const { count: aiQueries } = await supabase
          .from('ai_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('month_year', currentMonth);

        // Load voice usage from user_voice_usage table
        const { data: voiceUsageData } = await supabase
          .from('user_voice_usage')
          .select('characters_used, characters_limit, extra_characters')
          .eq('user_id', userId)
          .single();

        // Load search quota from user_search_quotas table (monthly limit is 10)
        const currentMonthKey = new Date().toISOString().slice(0, 7);
        const { data: searchQuotaData } = await supabase
          .from('user_search_quotas')
          .select('regular_search_count, extra_regular_searches')
          .eq('user_id', userId)
          .eq('monthly_date', currentMonthKey)
          .single();

        // Load Tasjeel records
        const { count: tasjeelRecords } = await supabase
          .from('tasjeel_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        // Load last login from user_sessions table
        const { data: sessionData } = await supabase
          .from('user_sessions')
          .select('created_at')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        setStatistics({
          tasksCreated: tasksCreated || 0,
          eventsCreated: eventsCreated || 0,
          aiQueries: aiQueries || 0,
          voiceUsage: {
            charactersUsed: voiceUsageData?.characters_used || 0,
            charactersLimit: voiceUsageData?.characters_limit || 5000,
            extraCharacters: voiceUsageData?.extra_characters || 0
          },
          searchQuota: {
            monthlyCount: searchQuotaData?.regular_search_count || 0,
            extraSearches: searchQuotaData?.extra_regular_searches || 0
          },
          tasjeelRecords: tasjeelRecords || 0,
          lastLoginAt: sessionData?.created_at || null
        });
      } catch (error) {
        console.error('Error loading user statistics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserStatistics();
  }, [userId]);

  return { statistics, isLoading };
};
