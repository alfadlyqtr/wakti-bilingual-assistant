import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserSearchQuota {
  daily_count: number; // This is actually advanced search monthly count
  regular_search_count: number; // Regular search monthly count
  extra_searches: number;
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
    extra_searches: 0 
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

  // Load search quota
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
        throw error;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ User search quota loaded successfully:', quota);
        setUserSearchQuota({
          daily_count: quota.daily_count,
          regular_search_count: quota.regular_search_count || 0,
          extra_searches: quota.extra_searches,
          purchase_date: quota.purchase_date
        });
      }
    } catch (error) {
      console.error('❌ Error loading user search quota:', error);
      setUserSearchQuota({ daily_count: 0, regular_search_count: 0, extra_searches: 0 });
      
      toast({
        title: language === 'ar' ? 'تحذير' : 'Warning',
        description: language === 'ar' ? 'تعذر تحميل بيانات حصة البحث' : 'Could not load search quota data',
        variant: 'default'
      });
    } finally {
      setIsLoadingSearchQuota(false);
    }
  }, [user, language]);

  // Load voice quota
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
        throw error;
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
      console.error('❌ Error loading user voice quota:', error);
      setUserVoiceQuota({ 
        characters_used: 0, 
        characters_limit: 5000, 
        extra_characters: 0 
      });
      
      toast({
        title: language === 'ar' ? 'تحذير' : 'Warning',
        description: language === 'ar' ? 'تعذر تحميل بيانات حصة الصوت' : 'Could not load voice quota data',
        variant: 'default'
      });
    } finally {
      setIsLoadingVoiceQuota(false);
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
            extra_searches: result.extra_searches
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
            extra_searches: result.extra_searches
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

  // Purchase extra searches (50 for 10 QAR)
  const purchaseExtraSearches = useCallback(async (count: number = 50) => {
    if (!user) return false;

    try {
      console.log('💰 Purchasing extra searches:', count);
      
      const { data, error } = await supabase.rpc('purchase_extra_searches', {
        p_user_id: user.id,
        p_count: count
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          setUserSearchQuota(prev => ({
            ...prev,
            extra_searches: result.new_extra_count,
            purchase_date: new Date().toISOString()
          }));
          
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${count} بحث إضافي (صالح لشهر واحد)` 
              : `Added ${count} extra searches (valid for 1 month)`,
          });
          
          console.log('💰 Extra searches purchased successfully:', result.new_extra_count);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Error purchasing extra searches:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الشراء' : 'Purchase Error',
        description: language === 'ar' ? 'فشل في شراء البحثات الإضافية' : 'Failed to purchase extra searches',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, language]);

  // Purchase extra voice credits (5,000 characters for 10 QAR)
  const purchaseExtraVoiceCredits = useCallback(async (characters: number = 5000) => {
    if (!user) return false;

    try {
      console.log('💰 Purchasing extra voice credits:', characters);
      
      const { data, error } = await supabase.rpc('purchase_extra_voice_credits', {
        p_user_id: user.id,
        p_characters: characters
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          setUserVoiceQuota(prev => ({
            ...prev,
            extra_characters: result.new_extra_characters,
            purchase_date: new Date().toISOString()
          }));
          
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${characters} حرف صوتي إضافي (صالح لشهر واحد)` 
              : `Added ${characters} extra voice characters (valid for 1 month)`,
          });
          
          console.log('💰 Extra voice credits purchased successfully:', result.new_extra_characters);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Error purchasing extra voice credits:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الشراء' : 'Purchase Error',
        description: language === 'ar' ? 'فشل في شراء الاعتمادات الصوتية الإضافية' : 'Failed to purchase extra voice credits',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, language]);

  // Purchase extra translations (100 for 10 QAR)
  const purchaseExtraTranslations = useCallback(async (count: number = 100) => {
    if (!user) return false;

    try {
      console.log('💰 Purchasing extra translations:', count);
      
      const { data, error } = await supabase.rpc('purchase_extra_translations', {
        p_user_id: user.id,
        p_count: count
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${count} ترجمة إضافية (صالحة لشهر واحد)` 
              : `Added ${count} extra translations (valid for 1 month)`,
          });
          
          console.log('💰 Extra translations purchased successfully:', result.new_extra_count);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Error purchasing extra translations:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الشراء' : 'Purchase Error',
        description: language === 'ar' ? 'فشل في شراء الترجمات الإضافية' : 'Failed to purchase extra translations',
        variant: 'destructive'
      });
      return false;
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
    const isAtAdvancedSearchHardLimit = userSearchQuota.daily_count >= MAX_MONTHLY_ADVANCED_SEARCHES && userSearchQuota.extra_searches === 0;
    const isAtRegularSearchHardLimit = userSearchQuota.regular_search_count >= MAX_MONTHLY_REGULAR_SEARCHES && userSearchQuota.extra_searches === 0;
    const canAdvancedSearch = remainingFreeAdvancedSearches > 0 || userSearchQuota.extra_searches > 0;
    const canRegularSearch = remainingFreeRegularSearches > 0 || userSearchQuota.extra_searches > 0;

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
    purchaseExtraSearches,
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
