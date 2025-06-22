
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
  translationQuota: {
    dailyCount: number;
    extraTranslations: number;
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
    translationQuota: {
      dailyCount: 0,
      extraTranslations: 0
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
        // Load tasks created
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

        // Load voice usage
        const { data: voiceUsageData } = await supabase
          .from('user_voice_usage')
          .select('characters_used, characters_limit, extra_characters')
          .eq('user_id', userId)
          .single();

        // Load translation quota
        const today = new Date().toISOString().split('T')[0];
        const { data: translationData } = await supabase
          .from('user_translation_quotas')
          .select('daily_count, extra_translations')
          .eq('user_id', userId)
          .eq('daily_date', today)
          .single();

        // Load Tasjeel records
        const { count: tasjeelRecords } = await supabase
          .from('tasjeel_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        // Load last login
        const { data: sessionData } = await supabase
          .from('user_sessions')
          .select('created_at')
          .eq('user_id', userId)
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
          translationQuota: {
            dailyCount: translationData?.daily_count || 0,
            extraTranslations: translationData?.extra_translations || 0
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
