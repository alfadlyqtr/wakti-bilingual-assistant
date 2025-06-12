
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserVoiceQuota {
  characters_used: number;
  characters_limit: number;
  extra_characters: number;
  purchase_date?: string;
}

export const useExtendedQuotaManagement = (language: 'en' | 'ar' = 'en') => {
  const { user } = useAuth();
  
  const [userVoiceQuota, setUserVoiceQuota] = useState<UserVoiceQuota>({
    characters_used: 0,
    characters_limit: 5000,
    extra_characters: 0
  });
  
  const [isLoadingVoiceQuota, setIsLoadingVoiceQuota] = useState(false);

  // Voice quota loading
  const loadUserVoiceQuota = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoadingVoiceQuota(true);
      
      console.log('🔄 Loading user voice quota for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_or_create_user_voice_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading user voice quota:', error);
        return;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ User voice quota loaded successfully:', quota);
        setUserVoiceQuota({
          characters_used: quota.characters_used || 0,
          characters_limit: quota.characters_limit || 5000,
          extra_characters: quota.extra_characters || 0,
          purchase_date: quota.purchase_date
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user voice quota:', error);
    } finally {
      setIsLoadingVoiceQuota(false);
    }
  }, [user]);

  // Voice purchase function
  const purchaseExtraVoiceCredits = useCallback(async (characters: number = 5000) => {
    if (!user) return false;

    try {
      console.log('💰 Attempting to purchase extra voice credits:', { userId: user.id, characters });
      
      const { data, error } = await supabase.rpc('purchase_extra_voice_credits', {
        p_user_id: user.id,
        p_characters: characters
      });

      if (error) {
        console.error('❌ Database error during voice credits purchase:', error);
        return false;
      }

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          console.log('✅ Voice credits purchased successfully:', result.new_extra_characters);
          
          setUserVoiceQuota(prev => ({
            ...prev,
            extra_characters: result.new_extra_characters || 0,
            purchase_date: new Date().toISOString()
          }));
          
          await loadUserVoiceQuota();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra voice credits:', error);
      return false;
    }
  }, [user, loadUserVoiceQuota]);

  useEffect(() => {
    if (user) {
      loadUserVoiceQuota();
    }
  }, [user?.id, loadUserVoiceQuota]);

  // Voice quota computed values
  const computedVoiceValues = useMemo(() => {
    const remainingVoiceCharacters = Math.max(0, userVoiceQuota.characters_limit - userVoiceQuota.characters_used);
    const totalAvailableCharacters = remainingVoiceCharacters + userVoiceQuota.extra_characters;
    const canUseVoice = totalAvailableCharacters > 0;

    return {
      remainingVoiceCharacters,
      totalAvailableCharacters,
      canUseVoice
    };
  }, [userVoiceQuota]);

  // Refresh functions
  const refreshVoiceQuota = useCallback(async () => {
    console.log('🔄 External refresh of voice quota requested');
    await loadUserVoiceQuota();
  }, [loadUserVoiceQuota]);

  return {
    userVoiceQuota,
    isLoadingVoiceQuota,
    loadUserVoiceQuota,
    purchaseExtraVoiceCredits,
    refreshVoiceQuota,
    ...computedVoiceValues
  };
};
