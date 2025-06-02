
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserSearchQuota {
  daily_count: number;
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
  const [userSearchQuota, setUserSearchQuota] = useState<UserSearchQuota>({ daily_count: 0, extra_searches: 0 });
  const [userVoiceQuota, setUserVoiceQuota] = useState<UserVoiceQuota>({ 
    characters_used: 0, 
    characters_limit: 5000, 
    extra_characters: 0 
  });
  const [isLoadingSearchQuota, setIsLoadingSearchQuota] = useState(false);
  const [isLoadingVoiceQuota, setIsLoadingVoiceQuota] = useState(false);

  const MAX_DAILY_SEARCHES = 10;
  const SEARCH_SOFT_WARNING_THRESHOLD = 8;

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
          extra_searches: quota.extra_searches,
          purchase_date: quota.purchase_date
        });
      }
    } catch (error) {
      console.error('❌ Error loading user search quota:', error);
      setUserSearchQuota({ daily_count: 0, extra_searches: 0 });
      
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

  // Increment search usage
  const incrementSearchUsage = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('⚠️ No user found for search quota increment');
      return false;
    }

    try {
      console.log('🔄 Incrementing search usage for user:', user.id);
      
      const { data, error } = await supabase.rpc('increment_search_usage', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error incrementing search usage:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const result = data[0];
        console.log('✅ Search usage result:', result);
        
        if (result.success) {
          setUserSearchQuota(prev => ({
            daily_count: result.daily_count,
            extra_searches: result.extra_searches,
            purchase_date: prev.purchase_date
          }));
          
          return true;
        } else {
          console.warn('⚠️ Search usage increment failed - quota exceeded');
          toast({
            title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
            description: language === 'ar' 
              ? 'لقد وصلت للحد الأقصى من البحث المتقدم اليومي (10 بحثات)' 
              : 'You have reached your daily advanced search limit (10 searches)',
            variant: 'destructive'
          });
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error incrementing search usage:', error);
      
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

  // Purchase extra searches
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
              ? `تم إضافة ${count} بحث متقدم إضافي (صالح لشهر واحد)` 
              : `Added ${count} extra advanced searches (valid for 1 month)`,
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

  // Purchase extra voice credits
  const purchaseExtraVoiceCredits = useCallback(async (characters: number = 10000) => {
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
    const remainingFreeSearches = Math.max(0, MAX_DAILY_SEARCHES - userSearchQuota.daily_count);
    const isAtSearchSoftLimit = userSearchQuota.daily_count >= SEARCH_SOFT_WARNING_THRESHOLD;
    const isAtSearchHardLimit = userSearchQuota.daily_count >= MAX_DAILY_SEARCHES && userSearchQuota.extra_searches === 0;
    const canSearch = remainingFreeSearches > 0 || userSearchQuota.extra_searches > 0;

    return {
      remainingFreeSearches,
      isAtSearchSoftLimit,
      isAtSearchHardLimit,
      canSearch
    };
  }, [userSearchQuota, MAX_DAILY_SEARCHES, SEARCH_SOFT_WARNING_THRESHOLD]);

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
    incrementSearchUsage,
    purchaseExtraSearches,
    MAX_DAILY_SEARCHES,
    ...searchComputedValues,
    
    // Voice quota
    userVoiceQuota,
    isLoadingVoiceQuota,
    loadUserVoiceQuota,
    purchaseExtraVoiceCredits,
    ...voiceComputedValues
  };
};
