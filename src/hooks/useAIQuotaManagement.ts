
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AIQuotaData {
  chat_characters_used: number;
  search_characters_used: number;
  image_prompts_used: number;
  created_at: string;
  updated_at: string;
}

export function useAIQuotaManagement() {
  const [quotaData, setQuotaData] = useState<AIQuotaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuotaData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the database function to get or create quota silently
      const { data, error } = await supabase.rpc('get_or_create_ai_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching AI quota:', error);
        return;
      }

      if (data && data.length > 0) {
        setQuotaData(data[0]);
      }
    } catch (error) {
      console.error('Error in fetchQuotaData:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const updateQuotaUsage = async (type: 'chat' | 'search' | 'image', characters: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !quotaData) return;

      const updateField = type === 'chat' ? 'chat_characters_used' : 
                         type === 'search' ? 'search_characters_used' : 
                         'image_prompts_used';

      const currentValue = quotaData[updateField];
      const newValue = currentValue + characters;

      const { error } = await supabase
        .from('ai_quota_management')
        .update({ [updateField]: newValue })
        .eq('user_id', user.id);

      if (!error) {
        setQuotaData(prev => prev ? { ...prev, [updateField]: newValue } : null);
      }
    } catch (error) {
      console.error('Error updating quota usage:', error);
    }
  };

  useEffect(() => {
    fetchQuotaData();
  }, []);

  return {
    quotaData,
    isLoading,
    fetchQuotaData,
    updateQuotaUsage
  };
}
