
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserQuota {
  daily_count: number;
  extra_translations: number;
  purchase_date?: string;
}

export const useQuotaManagement = (language: 'en' | 'ar' = 'en') => {
  const { user } = useAuth();
  const [userQuota, setUserQuota] = useState<UserQuota>({ daily_count: 0, extra_translations: 0 });
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  // Monthly limit for translations (changed from 25 to 10)
  const MAX_DAILY_TRANSLATIONS = 10; // Now represents monthly limit
  const SOFT_WARNING_THRESHOLD = 8; // Warn at 8 out of 10

  // Enhanced error handling helper
  const handleDatabaseError = (error: any, operation: string) => {
    console.error(`❌ ${operation} failed:`, error);
    
    let userMessage = language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred';
    
    if (error?.message) {
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        userMessage = language === 'ar' ? 'خطأ في النظام، يرجى المحاولة لاحقاً' : 'System error, please try again later';
      } else if (error.message.includes('permission')) {
        userMessage = language === 'ar' ? 'ليس لديك صلاحية للقيام بهذه العملية' : 'You do not have permission for this operation';
      }
    }
    
    toast({
      title: language === 'ar' ? 'خطأ' : 'Error',
      description: userMessage,
      variant: 'destructive'
    });
    
    return false;
  };

  // Memoize the loadUserQuota function to prevent infinite re-renders
  const loadUserQuota = useCallback(async (forceRefresh: boolean = false) => {
    if (!user) return;
    
    try {
      setIsLoadingQuota(true);
      setQuotaError(null);
      
      console.log('🔄 Loading user translation quota for user:', user.id, forceRefresh ? '(force refresh)' : '');
      
      const { data, error } = await supabase.rpc('get_or_create_user_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading user translation quota:', error);
        handleDatabaseError(error, 'Loading translation quota');
        setQuotaError('Failed to load quota data');
        return;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ User translation quota loaded successfully:', quota);
        setUserQuota({
          daily_count: quota.daily_count || 0,
          extra_translations: quota.extra_translations || 0,
          purchase_date: quota.purchase_date
        });
      } else {
        console.warn('⚠️ No translation quota data returned, using defaults');
        setUserQuota({ daily_count: 0, extra_translations: 0 });
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user translation quota:', error);
      setQuotaError('Failed to load quota data');
      handleDatabaseError(error, 'Loading translation quota');
      setUserQuota({ daily_count: 0, extra_translations: 0 });
    } finally {
      setIsLoadingQuota(false);
    }
  }, [user, language]);

  const incrementTranslationCount = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('⚠️ No user found for quota increment');
      return false;
    }

    try {
      console.log('🔄 Incrementing translation count for user:', user.id);
      console.log('📊 Current quota before increment:', userQuota);
      
      const { data, error } = await supabase.rpc('increment_translation_usage', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error incrementing translation count:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const result = data[0];
        console.log('✅ Translation count result:', result);
        
        if (result.success) {
          // Update local state immediately
          setUserQuota(prev => ({
            daily_count: result.daily_count || 0,
            extra_translations: result.extra_translations || 0,
            purchase_date: prev.purchase_date
          }));
          
          console.log('📊 Updated quota state:', {
            daily_count: result.daily_count,
            extra_translations: result.extra_translations
          });
          
          // NEW: Force refresh quota after increment for immediate UI update
          setTimeout(() => {
            console.log('🔄 Force refreshing quota after translation...');
            loadUserQuota(true);
          }, 500);
          
          return true;
        } else {
          console.warn('⚠️ Translation count increment failed - quota exceeded');
          toast({
            title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
            description: language === 'ar' 
              ? `لقد وصلت للحد الأقصى من الترجمات الشهرية (${MAX_DAILY_TRANSLATIONS} ترجمة)` 
              : `You have reached your monthly translation limit (${MAX_DAILY_TRANSLATIONS} translations)`,
            variant: 'destructive'
          });
          return false;
        }
      }
      
      console.warn('⚠️ No data returned from increment function');
      return false;
    } catch (error) {
      console.error('❌ Error incrementing translation count:', error);
      
      // Show error but allow translation to continue for now
      toast({
        title: language === 'ar' ? 'تحذير' : 'Warning',
        description: language === 'ar' 
          ? 'حدث خطأ في تتبع الاستخدام، ولكن يمكنك المتابعة' 
          : 'Error tracking usage, but you can continue',
        variant: 'default'
      });
      
      console.log('🔄 Using fallback - allowing translation to continue despite quota error');
      return true;
    }
  }, [user, userQuota, language, MAX_DAILY_TRANSLATIONS, loadUserQuota]);

  // Enhanced purchase function for translations - now 100 for 10 QAR
  const purchaseExtraTranslations = useCallback(async (count: number = 100) => {
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
          
          // Update local state immediately
          setUserQuota(prev => ({
            ...prev,
            extra_translations: result.new_extra_count || 0,
            purchase_date: new Date().toISOString()
          }));
          
          // Reload quota to ensure consistency
          await loadUserQuota(true);
          
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
  }, [user, language, loadUserQuota]);

  // NEW: Add a refresh function that can be called externally
  const refreshTranslationQuota = useCallback(async () => {
    console.log('🔄 External refresh of translation quota requested');
    await loadUserQuota(true);
  }, [loadUserQuota]);

  // Only load quota when user changes, not on every render
  useEffect(() => {
    if (user && !isLoadingQuota) {
      loadUserQuota();
    }
  }, [user?.id]);

  // Memoize computed values to prevent unnecessary re-renders
  const computedValues = useMemo(() => {
    const remainingFreeTranslations = Math.max(0, MAX_DAILY_TRANSLATIONS - userQuota.daily_count);
    const isAtSoftLimit = userQuota.daily_count >= SOFT_WARNING_THRESHOLD;
    const isAtHardLimit = userQuota.daily_count >= MAX_DAILY_TRANSLATIONS && userQuota.extra_translations === 0;
    const canTranslate = quotaError || remainingFreeTranslations > 0 || userQuota.extra_translations > 0;

    return {
      remainingFreeTranslations,
      isAtSoftLimit,
      isAtHardLimit,
      canTranslate
    };
  }, [userQuota, quotaError, MAX_DAILY_TRANSLATIONS, SOFT_WARNING_THRESHOLD]);

  return {
    userQuota,
    isLoadingQuota,
    quotaError,
    loadUserQuota,
    incrementTranslationCount,
    purchaseExtraTranslations,
    refreshTranslationQuota, // NEW: Export the refresh function
    MAX_DAILY_TRANSLATIONS,
    SOFT_WARNING_THRESHOLD,
    ...computedValues
  };
};
