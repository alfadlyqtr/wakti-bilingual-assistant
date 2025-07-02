
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceQuota {
  characters_limit: number;
  characters_used: number;
  extra_characters: number;
}

export function useVoiceQuotaManagement() {
  const [quota, setQuota] = useState<VoiceQuota | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadQuota = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's voice quota from profiles or create default
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        // Default voice quota values
        const defaultQuota: VoiceQuota = {
          characters_limit: 10000, // 10k characters default limit
          characters_used: 0,
          extra_characters: 0
        };

        setQuota(defaultQuota);
      }
    } catch (error) {
      console.error('Error loading voice quota:', error);
      // Set default quota even on error
      setQuota({
        characters_limit: 10000,
        characters_used: 0,
        extra_characters: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuota = async () => {
    // Reload quota after usage
    await loadQuota();
  };

  useEffect(() => {
    loadQuota();
  }, []);

  return {
    quota,
    isLoading,
    updateQuota
  };
}
