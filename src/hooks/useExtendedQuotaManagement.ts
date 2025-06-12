
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ExtendedUserSearchQuota {
  daily_count: number;
  extra_searches: number;
  purchase_date?: string;
  regular_search_count: number;
  extra_regular_searches: number;
  extra_advanced_searches: number;
}

export interface UserVoiceQuota {
  characters_used: number;
  characters_limit: number;
  extra_characters: number;
  purchase_date?: string;
}

export const useExtendedQuotaManagement = (language: 'en' | 'ar' = 'en') => {
  const { user } = useAuth();
  
  const [userSearchQuota, setUserSearchQuota] = useState<ExtendedUserSearchQuota>({
    daily_count: 0,
    extra_searches: 0,
    regular_search_count: 0,
    extra_regular_searches: 999999, // Unlimited regular searches
    extra_advanced_searches: 0
  });
  
  const [userVoiceQuota, setUserVoiceQuota] = useState<UserVoiceQuota>({
    characters_used: 0,
    characters_limit: 5000,
    extra_characters: 0
  });
  
  const [isLoadingSearchQuota, setIsLoadingSearchQuota] = useState(false);
  const [isLoadingVoiceQuota, setIsLoadingVoiceQuota] = useState(false);

  // Constants - Updated according to requirements
  // Regular Search: No quota tracking (unlimited)
  // Advanced Search: 5 free per month, 50 for 10 QAR
  const MAX_MONTHLY_ADVANCED_SEARCHES = 5;
  const MAX_MONTHLY_REGULAR_SEARCHES = 999999; // Unlimited

  const loadUserSearchQuota = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoadingSearchQuota(true);
      
      console.log('🔄 Loading user search quota for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_or_create_user_search_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading user search quota:', error);
        return;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ User search quota loaded successfully:', quota);
        setUserSearchQuota({
          daily_count: quota.daily_count,
          extra_searches: quota.extra_searches,
          purchase_date: quota.purchase_date,
          regular_search_count: 0, // Not tracked anymore
          extra_regular_searches: 999999, // Unlimited
          extra_advanced_searches: quota.extra_advanced_searches || 0
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user search quota:', error);
    } finally {
      setIsLoadingSearchQuota(false);
    }
  }, [user]);

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
          characters_used: quota.characters_used,
          characters_limit: quota.characters_limit,
          extra_characters: quota.extra_characters,
          purchase_date: quota.purchase_date
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user voice quota:', error);
    } finally {
      setIsLoadingVoiceQuota(false);
    }
  }, [user]);

  // Regular search increment - always returns success (no quota)
  const incrementRegularSearchCount = useCallback(async (): Promise<boolean> => {
    // Regular searches are now unlimited, always return true
    console.log('✅ Regular search - unlimited access');
    return true;
  }, []);

  // Advanced search increment - 5 free per month
  const incrementAdvancedSearchCount = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔄 Incrementing advanced search count for user:', user.id);
      
      const { data, error } = await supabase.rpc('increment_search_usage', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error incrementing advanced search count:', error);
        return false;
      }

      if (data && data.length > 0) {
        const result = data[0];
        
        if (result.success) {
          setUserSearchQuota(prev => ({
            ...prev,
            daily_count: result.daily_count,
            extra_advanced_searches: result.extra_advanced_searches
          }));
          return true;
        } else {
          toast({
            title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
            description: language === 'ar' 
              ? `لقد وصلت للحد الأقصى من البحثات المتقدمة الشهرية (${MAX_MONTHLY_ADVANCED_SEARCHES} بحث)` 
              : `You have reached your monthly advanced search limit (${MAX_MONTHLY_ADVANCED_SEARCHES} searches)`,
            variant: 'destructive'
          });
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error incrementing advanced search count:', error);
      return false;
    }
  }, [user, language, MAX_MONTHLY_ADVANCED_SEARCHES]);

  // Purchase extra advanced searches - 50 for 10 QAR
  const purchaseExtraAdvancedSearches = useCallback(async (count: number = 50) => {
    if (!user) return false;

    try {
      console.log('💰 Attempting to purchase extra advanced searches:', { userId: user.id, count });
      
      const { data, error } = await supabase.rpc('purchase_extra_advanced_searches', {
        p_user_id: user.id,
        p_count: count
      });

      if (error) {
        console.error('❌ Database error during advanced search purchase:', error);
        return false;
      }

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          console.log('✅ Advanced searches purchased successfully:', result.new_extra_count);
          
          setUserSearchQuota(prev => ({
            ...prev,
            extra_advanced_searches: result.new_extra_count,
            purchase_date: new Date().toISOString()
          }));
          
          await loadUserSearchQuota();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra advanced searches:', error);
      return false;
    }
  }, [user, loadUserSearchQuota]);

  // Purchase extra voice credits - stays the same (5000 for 10 QAR)
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
            extra_characters: result.new_extra_characters,
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
      loadUserSearchQuota();
      loadUserVoiceQuota();
    }
  }, [user?.id, loadUserSearchQuota, loadUserVoiceQuota]);

  const computedSearchValues = useMemo(() => {
    const remainingAdvancedSearches = Math.max(0, MAX_MONTHLY_ADVANCED_SEARCHES - userSearchQuota.daily_count);
    const canUseAdvancedSearch = remainingAdvancedSearches > 0 || userSearchQuota.extra_advanced_searches > 0;
    const canUseRegularSearch = true; // Always true - unlimited

    return {
      remainingAdvancedSearches,
      canUseAdvancedSearch,
      canUseRegularSearch
    };
  }, [userSearchQuota, MAX_MONTHLY_ADVANCED_SEARCHES]);

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

  // Add missing refresh functions
  const refreshSearchQuota = useCallback(async () => {
    await loadUserSearchQuota();
  }, [loadUserSearchQuota]);

  const refreshVoiceQuota = useCallback(async () => {
    await loadUserVoiceQuota();
  }, [loadUserVoiceQuota]);

  // Add missing increment functions with proper names
  const incrementRegularSearchUsage = useCallback(async (): Promise<boolean> => {
    return await incrementRegularSearchCount();
  }, [incrementRegularSearchCount]);

  const incrementAdvancedSearchUsage = useCallback(async (): Promise<boolean> => {
    return await incrementAdvancedSearchCount();
  }, [incrementAdvancedSearchCount]);

  return {
    userSearchQuota,
    userVoiceQuota,
    isLoadingSearchQuota,
    isLoadingVoiceQuota,
    loadUserSearchQuota,
    loadUserVoiceQuota,
    incrementRegularSearchCount,
    incrementAdvancedSearchCount,
    purchaseExtraAdvancedSearches,
    purchaseExtraVoiceCredits,
    MAX_MONTHLY_ADVANCED_SEARCHES,
    MAX_MONTHLY_REGULAR_SEARCHES,
    // Add missing properties
    refreshSearchQuota,
    refreshVoiceQuota,
    incrementRegularSearchUsage,
    incrementAdvancedSearchUsage,
    ...computedSearchValues,
    ...computedVoiceValues
  };
};
