
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
    characters_limit: 6000, // Updated: Use consistent 6000 characters
    extra_characters: 0
  });
  
  const [isLoadingVoiceQuota, setIsLoadingVoiceQuota] = useState(false);

  // Voice quota loading with improved error handling
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
        
        // Fallback: Try direct database query
        console.log('🔄 Attempting fallback quota loading...');
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('user_voice_usage')
          .select('characters_used, characters_limit, extra_characters, purchase_date')
          .eq('user_id', user.id)
          .single();

        if (fallbackError) {
          if (fallbackError.code === 'PGRST116') {
            // No record found, create one
            console.log('🔄 Creating new voice quota record...');
            
            const { data: insertData, error: insertError } = await supabase
              .from('user_voice_usage')
              .insert({
                user_id: user.id,
                characters_used: 0,
                characters_limit: 6000,
                extra_characters: 0
              })
              .select('characters_used, characters_limit, extra_characters, purchase_date')
              .single();

            if (insertError) {
              console.error('❌ Failed to create voice quota record:', insertError);
              toast({
                title: "Voice Quota Error",
                description: "Failed to initialize voice quota. Please try again.",
                variant: "destructive"
              });
              return;
            }

            console.log('✅ Created new voice quota record:', insertData);
            setUserVoiceQuota({
              characters_used: insertData.characters_used || 0,
              characters_limit: insertData.characters_limit || 6000,
              extra_characters: insertData.extra_characters || 0,
              purchase_date: insertData.purchase_date
            });
          } else {
            console.error('❌ Fallback quota loading failed:', fallbackError);
            toast({
              title: "Voice Quota Error",
              description: "Failed to load voice quota. Please refresh the page.",
              variant: "destructive"
            });
          }
          return;
        }

        console.log('✅ Fallback quota loading successful:', fallbackData);
        setUserVoiceQuota({
          characters_used: fallbackData.characters_used || 0,
          characters_limit: fallbackData.characters_limit || 6000,
          extra_characters: fallbackData.extra_characters || 0,
          purchase_date: fallbackData.purchase_date
        });
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
      } else {
        console.warn('⚠️ No voice quota data returned from RPC');
        // Set default values
        setUserVoiceQuota({
          characters_used: 0,
          characters_limit: 6000,
          extra_characters: 0
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user voice quota:', error);
      toast({
        title: "Voice Quota Error",
        description: "An unexpected error occurred while loading voice quota.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingVoiceQuota(false);
    }
  }, [user]);

  // Voice purchase function - now properly handles the purchase flow
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
