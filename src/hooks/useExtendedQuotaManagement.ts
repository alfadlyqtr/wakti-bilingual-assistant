import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserSearchQuota {
  daily_count: number; // This is actually advanced search monthly count
  regular_search_count: number; // Regular search monthly count
  extra_searches: number; // Keep for backward compatibility
  extra_regular_searches: number; // Separate regular extras
  extra_advanced_searches: number; // Separate advanced extras
  purchase_date?: string;
}

export interface UserVoiceQuota {
  characters_used: number;
  characters_limit: number;
  extra_characters: number;
  purchase_date?: string;
}

export const useExtendedQuotaManagement = (language: 'en' | 'ar' = 'en') => {
  const { user } = useAuth();
  const [userSearchQuota, setUserSearchQuota] = useState<UserSearchQuota>({ 
    daily_count: 0, 
    regular_search_count: 0, 
    extra_searches: 0,
    extra_regular_searches: 0,
    extra_advanced_searches: 0
  });
  const [userVoiceQuota, setUserVoiceQuota] = useState<UserVoiceQuota>({ 
    characters_used: 0, 
    characters_limit: 5000, 
    extra_characters: 0 
  });
  const [isLoadingSearchQuota, setIsLoadingSearchQuota] = useState(false);
  const [isLoadingVoiceQuota, setIsLoadingVoiceQuota] = useState(false);

  const MAX_MONTHLY_ADVANCED_SEARCHES = 5;
  const MAX_MONTHLY_REGULAR_SEARCHES = 15;
  const ADVANCED_SEARCH_SOFT_WARNING_THRESHOLD = 4;
  const REGULAR_SEARCH_SOFT_WARNING_THRESHOLD = 12;

  // Enhanced error handling helper
  const handleDatabaseError = (error: any, operation: string) => {
    console.error(`❌ ${operation} failed:`, error);
    
    let userMessage = language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred';
    
    if (error?.message) {
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        userMessage = language === 'ar' ? 'خطأ في النظام، يرجى المحاولة لاحقاً' : 'System error, please try again later';
      } else if (error.message.includes('permission')) {
        userMessage = language === 'ar' ? 'ليس لديك صلاحية للقيام بهذه العملية' : 'You do not have permission for this operation';
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        userMessage = language === 'ar' ? 'تم الوصول للحد الأقصى المسموح' : 'Quota limit reached';
      }
    }
    
    toast({
      title: language === 'ar' ? 'خطأ' : 'Error',
      description: userMessage,
      variant: 'destructive'
    });
    
    return false;
  };

  // Load search quota with enhanced error handling
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
        handleDatabaseError(error, 'Loading search quota');
        return;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ User search quota loaded successfully:', quota);
        setUserSearchQuota({
          daily_count: quota.daily_count,
          regular_search_count: quota.regular_search_count || 0,
          extra_searches: quota.extra_searches,
          extra_regular_searches: quota.extra_regular_searches || 0,
          extra_advanced_searches: quota.extra_advanced_searches || 0,
          purchase_date: quota.purchase_date
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user search quota:', error);
      handleDatabaseError(error, 'Loading search quota');
    } finally {
      setIsLoadingSearchQuota(false);
    }
  }, [user, language]);

  // Load voice quota with enhanced error handling
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
        handleDatabaseError(error, 'Loading voice quota');
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
      handleDatabaseError(error, 'Loading voice quota');
    } finally {
      setIsLoadingVoiceQuota(false);
    }
  }, [user, language]);

  // Enhanced purchase function for regular searches
  const purchaseExtraRegularSearches = useCallback(async (count: number = 50) => {
    if (!user) {
      console.error('❌ No authenticated user found');
      return false;
    }

    try {
      console.log('💰 Attempting to purchase extra regular searches:', { userId: user.id, count });
      
      // First ensure quota exists
      await loadUserSearchQuota();
      
      const { data, error } = await supabase.rpc('purchase_extra_regular_searches', {
        p_user_id: user.id,
        p_count: count
      });

      if (error) {
        console.error('❌ Database error during regular search purchase:', error);
        handleDatabaseError(error, 'Purchasing regular searches');
        return false;
      }

      console.log('💰 Regular search purchase response:', data);

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          console.log('✅ Regular searches purchased successfully:', result.new_extra_count);
          
          // Update local state immediately
          setUserSearchQuota(prev => ({
            ...prev,
            extra_regular_searches: result.new_extra_count,
            purchase_date: new Date().toISOString()
          }));
          
          // Reload quota to ensure consistency
          await loadUserSearchQuota();
          
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${count} بحث عادي إضافي (صالح لشهر واحد)` 
              : `Added ${count} extra regular searches (valid for 1 month)`,
          });
          
          return true;
        } else {
          console.error('❌ Purchase failed - database returned success: false');
          handleDatabaseError(new Error('Purchase operation failed'), 'Purchasing regular searches');
          return false;
        }
      } else {
        console.error('❌ No data returned from purchase function');
        handleDatabaseError(new Error('No data returned from purchase'), 'Purchasing regular searches');
        return false;
      }
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra regular searches:', error);
      handleDatabaseError(error, 'Purchasing regular searches');
      return false;
    }
  }, [user, language, loadUserSearchQuota]);

  // Enhanced purchase function for advanced searches
  const purchaseExtraAdvancedSearches = useCallback(async (count: number = 50) => {
    if (!user) {
      console.error('❌ No authenticated user found');
      return false;
    }

    try {
      console.log('💰 Attempting to purchase extra advanced searches:', { userId: user.id, count });
      
      // First ensure quota exists
      await loadUserSearchQuota();
      
      const { data, error } = await supabase.rpc('purchase_extra_advanced_searches', {
        p_user_id: user.id,
        p_count: count
      });

      if (error) {
        console.error('❌ Database error during advanced search purchase:', error);
        handleDatabaseError(error, 'Purchasing advanced searches');
        return false;
      }

      console.log('💰 Advanced search purchase response:', data);

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          console.log('✅ Advanced searches purchased successfully:', result.new_extra_count);
          
          // Update local state immediately
          setUserSearchQuota(prev => ({
            ...prev,
            extra_advanced_searches: result.new_extra_count,
            purchase_date: new Date().toISOString()
          }));
          
          // Reload quota to ensure consistency
          await loadUserSearchQuota();
          
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${count} بحث متقدم إضافي (صالح لشهر واحد)` 
              : `Added ${count} extra advanced searches (valid for 1 month)`,
          });
          
          return true;
        } else {
          console.error('❌ Purchase failed - database returned success: false');
          handleDatabaseError(new Error('Purchase operation failed'), 'Purchasing advanced searches');
          return false;
        }
      } else {
        console.error('❌ No data returned from purchase function');
        handleDatabaseError(new Error('No data returned from purchase'), 'Purchasing advanced searches');
        return false;
      }
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra advanced searches:', error);
      handleDatabaseError(error, 'Purchasing advanced searches');
      return false;
    }
  }, [user, language, loadUserSearchQuota]);

  // Enhanced purchase function for voice credits
  const purchaseExtraVoiceCredits = useCallback(async (characters: number = 5000) => {
    if (!user) {
      console.error('❌ No authenticated user found');
      return false;
    }

    try {
      console.log('💰 Attempting to purchase extra voice credits:', { userId: user.id, characters });
      
      // First ensure quota exists
      await loadUserVoiceQuota();
      
      const { data, error } = await supabase.rpc('purchase_extra_voice_credits', {
        p_user_id: user.id,
        p_characters: characters
      });

      if (error) {
        console.error('❌ Database error during voice credit purchase:', error);
        handleDatabaseError(error, 'Purchasing voice credits');
        return false;
      }

      console.log('💰 Voice credit purchase response:', data);

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          console.log('✅ Voice credits purchased successfully:', result.new_extra_characters);
          
          // Update local state immediately
          setUserVoiceQuota(prev => ({
            ...prev,
            extra_characters: result.new_extra_characters,
            purchase_date: new Date().toISOString()
          }));
          
          // Reload quota to ensure consistency
          await loadUserVoiceQuota();
          
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${characters} حرف صوتي إضافي (صالح لشهر واحد)` 
              : `Added ${characters} extra voice characters (valid for 1 month)`,
          });
          
          return true;
        } else {
          console.error('❌ Purchase failed - database returned success: false');
          handleDatabaseError(new Error('Purchase operation failed'), 'Purchasing voice credits');
          return false;
        }
      } else {
        console.error('❌ No data returned from purchase function');
        handleDatabaseError(new Error('No data returned from purchase'), 'Purchasing voice credits');
        return false;
      }
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra voice credits:', error);
      handleDatabaseError(error, 'Purchasing voice credits');
      return false;
    }
  }, [user, language, loadUserVoiceQuota]);

  // Enhanced purchase function for translations
  const purchaseExtraTranslations = useCallback(async (count: number = 150) => {
    if (!user) {
      console.error('❌ No authenticated user found');
      return false;
    }

    try {
      console.log('💰 Attempting to purchase extra translations:', { userId: user.id, count });
      
      const { data, error } = await supabase.rpc('purchase_extra_translations', {
        p_user_id: user.id,
        p_count: count
      });

      if (error) {
        console.error('❌ Database error during translation purchase:', error);
        handleDatabaseError(error, 'Purchasing translations');
        return false;
      }

      console.log('💰 Translation purchase response:', data);

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          console.log('✅ Translations purchased successfully:', result.new_extra_count);
          
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${count} ترجمة إضافية (صالحة لشهر واحد)` 
              : `Added ${count} extra translations (valid for 1 month)`,
          });
          
          return true;
        } else {
          console.error('❌ Purchase failed - database returned success: false');
          handleDatabaseError(new Error('Purchase operation failed'), 'Purchasing translations');
          return false;
        }
      } else {
        console.error('❌ No data returned from purchase function');
        handleDatabaseError(new Error('No data returned from purchase'), 'Purchasing translations');
        return false;
      }
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra translations:', error);
      handleDatabaseError(error, 'Purchasing translations');
      return false;
    }
  }, [user, language]);

  // Increment advanced search usage
  const incrementAdvancedSearchUsage = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('⚠️ No user found for advanced search quota increment');
      return false;
    }

    try {
      console.log('🔄 Incrementing advanced search usage for user:', user.id);
      
      const { data, error } = await supabase.rpc('increment_search_usage', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error incrementing advanced search usage:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const result = data[0];
        console.log('✅ Advanced search usage result:', result);
        
        if (result.success) {
          setUserSearchQuota(prev => ({
            ...prev,
            daily_count: result.daily_count,
            extra_advanced_searches: result.extra_advanced_searches
          }));
          
          return true;
        } else {
          console.warn('⚠️ Advanced search usage increment failed - quota exceeded');
          toast({
            title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
            description: language === 'ar' 
              ? 'لقد وصلت للحد الأقصى من البحث المتقدم الشهري (5 بحثات)' 
              : 'You have reached your monthly advanced search limit (5 searches)',
            variant: 'destructive'
          });
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error incrementing advanced search usage:', error);
      
      toast({
        title: language === 'ar' ? 'تحذير' : 'Warning',
        description: language === 'ar' 
          ? 'حدث خطأ في تتبع الاستخدام، ولكن يمكنك المتابعة' 
          : 'Error tracking usage, but you can continue',
        variant: 'default'
      });
      
      return true;
    }
  }, [user, language]);

  // Increment regular search usage
  const incrementRegularSearchUsage = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('⚠️ No user found for regular search quota increment');
      return false;
    }

    try {
      console.log('🔄 Incrementing regular search usage for user:', user.id);
      
      const { data, error } = await supabase.rpc('increment_regular_search_usage', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error incrementing regular search usage:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const result = data[0];
        console.log('✅ Regular search usage result:', result);
        
        if (result.success) {
          setUserSearchQuota(prev => ({
            ...prev,
            regular_search_count: result.regular_search_count,
            extra_regular_searches: result.extra_regular_searches
          }));
          
          return true;
        } else {
          console.warn('⚠️ Regular search usage increment failed - quota exceeded');
          toast({
            title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
            description: language === 'ar' 
              ? 'لقد وصلت للحد الأقصى من البحث الشهري (15 بحث)' 
              : 'You have reached your monthly search limit (15 searches)',
            variant: 'destructive'
          });
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error incrementing regular search usage:', error);
      
      toast({
        title: language === 'ar' ? 'تحذير' : 'Warning',
        description: language === 'ar' 
          ? 'حدث خطأ في تتبع الاستخدام، ولكن يمكنك المتابعة' 
          : 'Error tracking usage, but you can continue',
        variant: 'default'
      });
      
      return true;
    }
  }, [user, language]);

  // Load quotas when user changes
  useEffect(() => {
    if (user && !isLoadingSearchQuota) {
      loadUserSearchQuota();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && !isLoadingVoiceQuota) {
      loadUserVoiceQuota();
    }
  }, [user?.id]);

  // Computed values for search quota
  const searchComputedValues = useMemo(() => {
    const remainingFreeAdvancedSearches = Math.max(0, MAX_MONTHLY_ADVANCED_SEARCHES - userSearchQuota.daily_count);
    const remainingFreeRegularSearches = Math.max(0, MAX_MONTHLY_REGULAR_SEARCHES - userSearchQuota.regular_search_count);
    const isAtAdvancedSearchSoftLimit = userSearchQuota.daily_count >= ADVANCED_SEARCH_SOFT_WARNING_THRESHOLD;
    const isAtRegularSearchSoftLimit = userSearchQuota.regular_search_count >= REGULAR_SEARCH_SOFT_WARNING_THRESHOLD;
    const isAtAdvancedSearchHardLimit = userSearchQuota.daily_count >= MAX_MONTHLY_ADVANCED_SEARCHES && userSearchQuota.extra_advanced_searches === 0;
    const isAtRegularSearchHardLimit = userSearchQuota.regular_search_count >= MAX_MONTHLY_REGULAR_SEARCHES && userSearchQuota.extra_regular_searches === 0;
    const canAdvancedSearch = remainingFreeAdvancedSearches > 0 || userSearchQuota.extra_advanced_searches > 0;
    const canRegularSearch = remainingFreeRegularSearches > 0 || userSearchQuota.extra_regular_searches > 0;

    return {
      remainingFreeAdvancedSearches,
      remainingFreeRegularSearches,
      isAtAdvancedSearchSoftLimit,
      isAtRegularSearchSoftLimit,
      isAtAdvancedSearchHardLimit,
      isAtRegularSearchHardLimit,
      canAdvancedSearch,
      canRegularSearch
    };
  }, [userSearchQuota, MAX_MONTHLY_ADVANCED_SEARCHES, MAX_MONTHLY_REGULAR_SEARCHES, ADVANCED_SEARCH_SOFT_WARNING_THRESHOLD, REGULAR_SEARCH_SOFT_WARNING_THRESHOLD]);

  // Computed values for voice quota
  const voiceComputedValues = useMemo(() => {
    const remainingVoiceCharacters = Math.max(0, userVoiceQuota.characters_limit - userVoiceQuota.characters_used);
    const totalAvailableCharacters = remainingVoiceCharacters + userVoiceQuota.extra_characters;
    const canUseVoice = totalAvailableCharacters > 0;

    return {
      remainingVoiceCharacters,
      totalAvailableCharacters,
      canUseVoice
    };
  }, [userVoiceQuota]);

  return {
    // Search quota
    userSearchQuota,
    isLoadingSearchQuota,
    loadUserSearchQuota,
    incrementAdvancedSearchUsage,
    incrementRegularSearchUsage,
    purchaseExtraRegularSearches,
    purchaseExtraAdvancedSearches,
    MAX_MONTHLY_ADVANCED_SEARCHES,
    MAX_MONTHLY_REGULAR_SEARCHES,
    ...searchComputedValues,
    
    // Voice quota
    userVoiceQuota,
    isLoadingVoiceQuota,
    loadUserVoiceQuota,
    purchaseExtraVoiceCredits,
    ...voiceComputedValues,

    // Translation quota
    purchaseExtraTranslations
  };
};
