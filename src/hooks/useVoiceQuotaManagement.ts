
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceQuota {
  characters_used: number;
  characters_limit: number;
  extra_characters: number;
  purchase_date?: string;
}

export function useVoiceQuotaManagement() {
  const [quota, setQuota] = useState<VoiceQuota | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuota = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_or_create_user_voice_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching voice quota:', error);
        return;
      }

      if (data && data.length > 0) {
        setQuota(data[0]);
      }
    } catch (error) {
      console.error('Error in fetchQuota:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuota = async () => {
    await fetchQuota();
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  return {
    quota,
    isLoading,
    updateQuota
  };
}
