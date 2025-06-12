import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ExtendedUserSearchQuota {
  daily_count: number; // Used for monthly advanced searches
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
    daily_count: 0, // This is actually monthly advanced search count
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

  // FIXED: Constants - Advanced search is monthly, regular is unlimited
  const MAX_MONTHLY_ADVANCED_SEARCHES = 5;
  const MAX_MONTHLY_REGULAR_SEARCHES = 999999; // Unlimited

  // FIXED: Simplified search quota loading with proper monthly logic
  const loadUserSearchQuota = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoadingSearchQuota(true);
      
      console.log('🔄 Loading user search quota for user:', user.id);
      
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      // Get current month's quota
      const { data, error } = await supabase
        .from('user_search_quotas')
        .select('*')
        .eq('user_id', user.id)
        .eq('monthly_date', currentMonth)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('❌ Error loading user search quota:', error);
        return;
      }

      if (data) {
        console.log('✅ User search quota loaded successfully:', data);
        setUserSearchQuota({
          daily_count: data.daily_count || 0, // This is monthly advanced search count
          extra_searches: data.extra_searches || 0,
          purchase_date: data.purchase_date,
          regular_search_count: data.regular_search_count || 0,
          extra_regular_searches: 999999, // Unlimited
          extra_advanced_searches: data.extra_advanced_searches || 0
        });
      } else {
        // Create new record for this month
        console.log('📝 Creating new search quota record for current month');
        const { data: newData, error: insertError } = await supabase
          .from('user_search_quotas')
          .insert({
            user_id: user.id,
            monthly_date: currentMonth,
            daily_count: 0, // Monthly advanced search count
            extra_searches: 0,
            regular_search_count: 0,
            extra_regular_searches: 0,
            extra_advanced_searches: 0
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Error creating search quota record:', insertError);
          return;
        }
        
        console.log('✅ New search quota record created:', newData);
        setUserSearchQuota({
          daily_count: 0,
          extra_searches: 0,
          regular_search_count: 0,
          extra_regular_searches: 999999,
          extra_advanced_searches: 0
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

  // FIXED: Regular search increment - always returns success (no quota, just tracking)
  const incrementRegularSearchCount = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Just log the usage, don't enforce any limits
      const { error } = await supabase
        .from('user_search_quotas')
        .update({
          regular_search_count: userSearchQuota.regular_search_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('monthly_date', currentMonth);
      
      if (error) {
        console.error('⚠️ Error logging regular search (non-blocking):', error);
      } else {
        // Update local state
        setUserSearchQuota(prev => ({
          ...prev,
          regular_search_count: prev.regular_search_count + 1
        }));
        console.log('✅ Regular search usage logged');
      }
      
      return true; // Always allow regular searches
    } catch (error) {
      console.error('⚠️ Error in incrementRegularSearchCount (non-blocking):', error);
      return true; // Always allow regular searches
    }
  }, [user, userSearchQuota]);

  // FIXED: Advanced search increment with proper monthly quota enforcement
  const incrementAdvancedSearchCount = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔄 Incrementing advanced search count for user:', user.id);
      console.log('📊 Current search quota:', userSearchQuota);
      
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // FIXED: Check if user has quota available (daily_count is actually monthly advanced count)
      const remainingFree = Math.max(0, MAX_MONTHLY_ADVANCED_SEARCHES - userSearchQuota.daily_count);
      
      if (remainingFree > 0) {
        // Use free monthly quota
        const { error } = await supabase
          .from('user_search_quotas')
          .update({
            daily_count: userSearchQuota.daily_count + 1, // Increment monthly advanced search count
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('monthly_date', currentMonth);
        
        if (error) {
          console.error('❌ Error incrementing advanced search count:', error);
          return false;
        }
        
        // Update local state immediately
        setUserSearchQuota(prev => ({
          ...prev,
          daily_count: prev.daily_count + 1
        }));
        
        console.log('✅ Advanced search count incremented (free monthly quota)');
        return true;
        
      } else if (userSearchQuota.extra_advanced_searches > 0) {
        // Use extra searches
        const { error } = await supabase
          .from('user_search_quotas')
          .update({
            extra_advanced_searches: userSearchQuota.extra_advanced_searches - 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('monthly_date', currentMonth);
        
        if (error) {
          console.error('❌ Error using extra advanced search:', error);
          return false;
        }
        
        // Update local state immediately
        setUserSearchQuota(prev => ({
          ...prev,
          extra_advanced_searches: prev.extra_advanced_searches - 1
        }));
        
        console.log('✅ Extra advanced search used');
        return true;
        
      } else {
        // No quota available
        console.warn('⚠️ Advanced search quota exceeded');
        toast({
          title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
          description: language === 'ar' 
            ? `لقد وصلت للحد الأقصى من البحثات المتقدمة الشهرية (${MAX_MONTHLY_ADVANCED_SEARCHES} بحث)` 
            : `You have reached your monthly advanced search limit (${MAX_MONTHLY_ADVANCED_SEARCHES} searches)`,
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Error incrementing advanced search count:', error);
      return false;
    }
  }, [user, userSearchQuota, language, MAX_MONTHLY_ADVANCED_SEARCHES]);

  // Purchase extra advanced searches - 50 for 10 QAR
  const purchaseExtraAdvancedSearches = useCallback(async (count: number = 50) => {
    if (!user) return false;

    try {
      console.log('💰 Attempting to purchase extra advanced searches:', { userId: user.id, count });
      
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      const { error } = await supabase
        .from('user_search_quotas')
        .update({
          extra_advanced_searches: userSearchQuota.extra_advanced_searches + count,
          purchase_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('monthly_date', currentMonth);

      if (error) {
        console.error('❌ Database error during advanced search purchase:', error);
        return false;
      }

      console.log('✅ Advanced searches purchased successfully');
      
      // Update local state immediately
      setUserSearchQuota(prev => ({
        ...prev,
        extra_advanced_searches: prev.extra_advanced_searches + count,
        purchase_date: new Date().toISOString()
      }));
      
      toast({
        title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
        description: language === 'ar' 
          ? `تم إضافة ${count} بحث متقدم إضافي (صالح لشهر واحد)` 
          : `Added ${count} extra advanced searches (valid for 1 month)`,
      });
      
      return true;
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra advanced searches:', error);
      return false;
    }
  }, [user, userSearchQuota, language]);

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
      loadUserSearchQuota();
      loadUserVoiceQuota();
    }
  }, [user?.id, loadUserSearchQuota, loadUserVoiceQuota]);

  // FIXED: Computed values with proper monthly logic
  const computedSearchValues = useMemo(() => {
    // daily_count is actually monthly advanced search count
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
    console.log('🔄 External refresh of search quota requested');
    await loadUserSearchQuota();
  }, [loadUserSearchQuota]);

  const refreshVoiceQuota = useCallback(async () => {
    console.log('🔄 External refresh of voice quota requested');
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
    refreshSearchQuota: loadUserSearchQuota,
    refreshVoiceQuota: loadUserVoiceQuota,
    incrementRegularSearchUsage: incrementRegularSearchCount,
    incrementAdvancedSearchUsage: incrementAdvancedSearchCount,
    ...computedSearchValues,
    ...computedVoiceValues
  };
};
