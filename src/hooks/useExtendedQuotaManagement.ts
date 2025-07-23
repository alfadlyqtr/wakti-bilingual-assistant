
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
    characters_limit: 6000,
    extra_characters: 0
  });
  
  const [isLoadingVoiceQuota, setIsLoadingVoiceQuota] = useState(false);
  const [voiceQuotaError, setVoiceQuotaError] = useState<string | null>(null);

  // Enhanced voice quota loading with better error handling
  const loadUserVoiceQuota = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoadingVoiceQuota(true);
      setVoiceQuotaError(null);
      
      console.log('🔄 Loading user voice quota for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_or_create_user_voice_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading user voice quota:', error);
        setVoiceQuotaError(error.message);
        
        // Try the diagnostic function to get more details
        try {
          const { data: testData, error: testError } = await supabase.rpc('test_user_voice_quota_access', {
            p_user_id: user.id
          });
          
          if (testError) {
            console.error('❌ Diagnostic test also failed:', testError);
          } else {
            console.log('✅ Diagnostic test result:', testData);
            if (testData && testData.success) {
              // If diagnostic test succeeds, use its data
              setUserVoiceQuota({
                characters_used: testData.characters_used || 0,
                characters_limit: testData.characters_limit || 6000,
                extra_characters: testData.extra_characters || 0,
                purchase_date: testData.purchase_date
              });
              setVoiceQuotaError(null);
              return;
            }
          }
        } catch (testError) {
          console.error('❌ Could not run diagnostic test:', testError);
        }
        
        return;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ User voice quota loaded successfully:', quota);
        setUserVoiceQuota({
          characters_used: quota.characters_used || 0,
          characters_limit: quota.characters_limit || 6000,
          extra_characters: quota.extra_characters || 0,
          purchase_date: quota.purchase_date
        });
        setVoiceQuotaError(null);
      } else {
        console.warn('⚠️ No voice quota data returned');
        setVoiceQuotaError('No voice quota data available');
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user voice quota:', error);
      setVoiceQuotaError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoadingVoiceQuota(false);
    }
  }, [user]);

  // Voice purchase function with enhanced error handling
  const purchaseExtraVoiceCredits = useCallback(async (characters: number = 6000) => {
    if (!user) return false;

    try {
      console.log('💰 Initiating voice credits purchase:', { userId: user.id, characters });
      
      const { data, error } = await supabase.rpc('purchase_extra_voice_credits', {
        p_user_id: user.id,
        p_characters: characters
      });

      if (error) {
        console.error('❌ Database error during voice credits purchase:', error);
        toast({
          title: "Purchase Failed",
          description: "Failed to purchase voice credits. Please try again.",
          variant: "destructive"
        });
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
          
          toast({
            title: "Purchase Successful",
            description: `Added ${characters} voice characters to your account.`,
            variant: "default"
          });
          
          await loadUserVoiceQuota();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra voice credits:', error);
      toast({
        title: "Purchase Error",
        description: "An unexpected error occurred during purchase.",
        variant: "destructive"
      });
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
    voiceQuotaError,
    loadUserVoiceQuota,
    purchaseExtraVoiceCredits,
    refreshVoiceQuota,
    ...computedVoiceValues
  };
};
