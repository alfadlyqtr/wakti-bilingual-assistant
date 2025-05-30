
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AdvancedSearchQuota {
  advanced_search_count: number;
  extra_advanced_searches: number;
  advanced_search_purchase_date?: string;
}

export const useAdvancedSearchQuota = (language: 'en' | 'ar' = 'en') => {
  const { user } = useAuth();
  const [quota, setQuota] = useState<AdvancedSearchQuota>({ 
    advanced_search_count: 0, 
    extra_advanced_searches: 0 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_DAILY_SEARCHES = 3;
  const SOFT_WARNING_THRESHOLD = 2;

  const loadQuota = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Loading advanced search quota for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_or_create_user_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading advanced search quota:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const quotaData = data[0];
        console.log('✅ Advanced search quota loaded:', quotaData);
        setQuota({
          advanced_search_count: quotaData.advanced_search_count || 0,
          extra_advanced_searches: quotaData.extra_advanced_searches || 0,
          advanced_search_purchase_date: quotaData.advanced_search_purchase_date
        });
      }
    } catch (error) {
      console.error('❌ Error loading advanced search quota:', error);
      setError('Failed to load quota data');
      
      toast({
        title: language === 'ar' ? 'تحذير' : 'Warning',
        description: language === 'ar' ? 'تعذر تحميل بيانات الحصة' : 'Could not load quota data',
        variant: 'default'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, language]);

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('⚠️ No user found for advanced search quota increment');
      return false;
    }

    try {
      console.log('🔄 Incrementing advanced search usage for user:', user.id);
      
      const { data, error } = await supabase.rpc('increment_advanced_search_usage', {
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
          setQuota(prev => ({
            advanced_search_count: result.advanced_search_count,
            extra_advanced_searches: result.extra_advanced_searches,
            advanced_search_purchase_date: prev.advanced_search_purchase_date
          }));
          
          return true;
        } else {
          console.warn('⚠️ Advanced search usage increment failed - quota exceeded');
          toast({
            title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
            description: language === 'ar' 
              ? 'لقد وصلت للحد الأقصى من البحث المتقدم اليومي (3 بحثات)' 
              : 'You have reached your daily advanced search limit (3 searches)',
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
          ? 'حدث خطأ في تتبع الاستخدام' 
          : 'Error tracking usage',
        variant: 'default'
      });
      
      return false;
    }
  }, [user, language]);

  const purchaseExtra = useCallback(async (count: number = 50) => {
    if (!user) return false;

    try {
      console.log('💰 Purchasing extra advanced searches:', count);
      
      const { data, error } = await supabase.rpc('purchase_extra_advanced_searches', {
        p_user_id: user.id,
        p_count: count
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          setQuota(prev => ({
            ...prev,
            extra_advanced_searches: result.new_extra_count,
            advanced_search_purchase_date: new Date().toISOString()
          }));
          
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${count} بحث متقدم إضافي (صالح لشهر واحد)` 
              : `Added ${count} extra advanced searches (valid for 1 month)`,
          });
          
          console.log('💰 Extra advanced searches purchased successfully:', result.new_extra_count);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Error purchasing extra advanced searches:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الشراء' : 'Purchase Error',
        description: language === 'ar' ? 'فشل في شراء البحث المتقدم الإضافي' : 'Failed to purchase extra advanced searches',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, language]);

  useEffect(() => {
    if (user && !isLoading) {
      loadQuota();
    }
  }, [user?.id]);

  const computedValues = useMemo(() => {
    const remainingFreeSearches = Math.max(0, MAX_DAILY_SEARCHES - quota.advanced_search_count);
    const isAtSoftLimit = quota.advanced_search_count >= SOFT_WARNING_THRESHOLD;
    const isAtHardLimit = quota.advanced_search_count >= MAX_DAILY_SEARCHES && quota.extra_advanced_searches === 0;
    const canSearch = error || remainingFreeSearches > 0 || quota.extra_advanced_searches > 0;

    return {
      remainingFreeSearches,
      isAtSoftLimit,
      isAtHardLimit,
      canSearch
    };
  }, [quota, error, MAX_DAILY_SEARCHES, SOFT_WARNING_THRESHOLD]);

  return {
    quota,
    isLoading,
    error,
    loadQuota,
    incrementUsage,
    purchaseExtra,
    MAX_DAILY_SEARCHES,
    SOFT_WARNING_THRESHOLD,
    ...computedValues
  };
};
