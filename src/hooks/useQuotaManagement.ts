
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserQuota {
  daily_count: number;
  extra_translations: number;
  purchase_date?: string;
  monthly_count: number;
  monthly_period: string;
  quota_cycle_start?: string;
}

export const useQuotaManagement = (language: 'en' | 'ar' = 'en') => {
  const { user } = useAuth();
  
  // Changed: Use consistent 10 monthly translations limit
  const MAX_MONTHLY_TRANSLATIONS = 10;
  
  const [userQuota, setUserQuota] = useState<UserQuota>({
    daily_count: 0,
    extra_translations: 0,
    monthly_count: 0,
    monthly_period: new Date().toISOString().slice(0, 7) // YYYY-MM format
  });
  
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  // Load user quota
  const loadUserQuota = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoadingQuota(true);
      setQuotaError(null);
      
      console.log('🔄 Loading user translation quota (MONTHLY) for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_or_create_user_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading user quota:', error);
        setQuotaError(error.message);
        return;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ User translation quota (MONTHLY) loaded successfully:', quota);
        setUserQuota({
          daily_count: quota.daily_count || 0,
          extra_translations: quota.extra_translations || 0,
          purchase_date: quota.purchase_date,
          monthly_count: quota.monthly_count || 0,
          monthly_period: quota.monthly_period || new Date().toISOString().slice(0, 7),
          quota_cycle_start: quota.quota_cycle_start
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user quota:', error);
      setQuotaError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoadingQuota(false);
    }
  }, [user]);

  // Increment translation count (now monthly)
  const incrementTranslationCount = useCallback(async () => {
    if (!user) return { success: false, remainingTranslations: 0 };

    try {
      console.log('📈 Incrementing translation usage (MONTHLY) for user:', user.id);
      
      const { data, error } = await supabase.rpc('increment_translation_usage', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error incrementing translation usage:', error);
        return { success: false, remainingTranslations: 0 };
      }

      if (data && data.length > 0) {
        const result = data[0];
        console.log('✅ Translation usage incremented (MONTHLY):', result);
        
        setUserQuota(prev => ({
          ...prev,
          monthly_count: result.monthly_count,
          daily_count: result.daily_count, // Keep for backward compatibility
          extra_translations: result.extra_translations
        }));
        
        const remaining = Math.max(0, MAX_MONTHLY_TRANSLATIONS - result.monthly_count) + result.extra_translations;
        return { success: result.success, remainingTranslations: remaining };
      }
      
      return { success: false, remainingTranslations: 0 };
    } catch (error) {
      console.error('❌ Unexpected error incrementing translation usage:', error);
      return { success: false, remainingTranslations: 0 };
    }
  }, [user, MAX_MONTHLY_TRANSLATIONS]);

  // Purchase extra translations
  const purchaseExtraTranslations = useCallback(async (count: number = 100) => {
    if (!user) return false;

    try {
      console.log('💰 Purchasing extra translations:', { userId: user.id, count });
      
      const { data, error } = await supabase.rpc('purchase_extra_translations', {
        p_user_id: user.id,
        p_count: count
      });

      if (error) {
        console.error('❌ Database error during translation purchase:', error);
        return false;
      }

      if (data && data.length > 0) {
        const result = data[0];
        if (result.success) {
          console.log('✅ Extra translations purchased successfully:', result.new_extra_count);
          
          setUserQuota(prev => ({
            ...prev,
            extra_translations: result.new_extra_count,
            purchase_date: new Date().toISOString()
          }));
          
          await loadUserQuota();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra translations:', error);
      return false;
    }
  }, [user, loadUserQuota]);

  useEffect(() => {
    if (user) {
      loadUserQuota();
    }
  }, [user?.id, loadUserQuota]);

  // Computed values (now based on monthly quota)
  const computedValues = useMemo(() => {
    const remainingFreeTranslations = Math.max(0, MAX_MONTHLY_TRANSLATIONS - userQuota.monthly_count);
    const totalAvailableTranslations = remainingFreeTranslations + userQuota.extra_translations;
    const canTranslate = totalAvailableTranslations > 0;
    
    // Calculate limit status based on monthly usage
    const usagePercentage = (userQuota.monthly_count / MAX_MONTHLY_TRANSLATIONS) * 100;
    const isAtSoftLimit = usagePercentage >= 80 && totalAvailableTranslations > 0;
    const isAtHardLimit = totalAvailableTranslations === 0;

    return {
      remainingFreeTranslations,
      totalAvailableTranslations,
      canTranslate,
      isAtSoftLimit,
      isAtHardLimit
    };
  }, [userQuota, MAX_MONTHLY_TRANSLATIONS]);

  // Refresh function
  const refreshTranslationQuota = useCallback(async () => {
    console.log('🔄 External refresh of translation quota (MONTHLY) requested');
    await loadUserQuota();
  }, [loadUserQuota]);

  return {
    userQuota,
    isLoadingQuota,
    quotaError,
    MAX_DAILY_TRANSLATIONS: MAX_MONTHLY_TRANSLATIONS, // Keep for backward compatibility
    MAX_MONTHLY_TRANSLATIONS,
    loadUserQuota,
    incrementTranslationCount,
    purchaseExtraTranslations,
    refreshTranslationQuota,
    ...computedValues
  };
};
