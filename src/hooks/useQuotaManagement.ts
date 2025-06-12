
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

  // Simplified quota loading function
  const loadUserQuota = useCallback(async (forceRefresh: boolean = false) => {
    if (!user) return;
    
    try {
      setIsLoadingQuota(true);
      setQuotaError(null);
      
      console.log('🔄 Loading user translation quota for user:', user.id, forceRefresh ? '(force refresh)' : '');
      
      // Get current date for quota lookup
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Try to get today's quota directly from the table
      const { data, error } = await supabase
        .from('user_translation_quotas')
        .select('*')
        .eq('user_id', user.id)
        .eq('daily_date', today)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('❌ Error loading user translation quota:', error);
        handleDatabaseError(error, 'Loading translation quota');
        setQuotaError('Failed to load quota data');
        return;
      }

      if (data) {
        console.log('✅ User translation quota loaded successfully:', data);
        setUserQuota({
          daily_count: data.daily_count || 0,
          extra_translations: data.extra_translations || 0,
          purchase_date: data.purchase_date
        });
      } else {
        // No record for today, create one
        console.log('📝 Creating new quota record for today');
        const { data: newData, error: insertError } = await supabase
          .from('user_translation_quotas')
          .insert({
            user_id: user.id,
            daily_date: today,
            daily_count: 0,
            extra_translations: 0
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Error creating quota record:', insertError);
          handleDatabaseError(insertError, 'Creating translation quota');
          setQuotaError('Failed to create quota data');
          return;
        }
        
        console.log('✅ New quota record created:', newData);
        setUserQuota({
          daily_count: 0,
          extra_translations: 0,
          purchase_date: null
        });
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

  // Simplified increment function with immediate UI update
  const incrementTranslationCount = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('⚠️ No user found for quota increment');
      return false;
    }

    try {
      console.log('🔄 Incrementing translation count for user:', user.id);
      console.log('📊 Current quota before increment:', userQuota);
      
      const today = new Date().toISOString().split('T')[0];
      
      // Check current quota
      const remainingFree = Math.max(0, MAX_DAILY_TRANSLATIONS - userQuota.daily_count);
      
      if (remainingFree > 0) {
        // Use free quota
        const { data, error } = await supabase
          .from('user_translation_quotas')
          .update({ 
            daily_count: userQuota.daily_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('daily_date', today)
          .select()
          .single();
        
        if (error) {
          console.error('❌ Error incrementing daily count:', error);
          throw error;
        }
        
        // Update local state immediately
        setUserQuota(prev => ({
          ...prev,
          daily_count: prev.daily_count + 1
        }));
        
        console.log('✅ Daily translation count incremented');
        return true;
        
      } else if (userQuota.extra_translations > 0) {
        // Use extra translations
        const { data, error } = await supabase
          .from('user_translation_quotas')
          .update({ 
            extra_translations: userQuota.extra_translations - 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('daily_date', today)
          .select()
          .single();
        
        if (error) {
          console.error('❌ Error using extra translation:', error);
          throw error;
        }
        
        // Update local state immediately
        setUserQuota(prev => ({
          ...prev,
          extra_translations: prev.extra_translations - 1
        }));
        
        console.log('✅ Extra translation used');
        return true;
        
      } else {
        // No translations available
        console.warn('⚠️ Translation quota exceeded');
        toast({
          title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
          description: language === 'ar' 
            ? `لقد وصلت للحد الأقصى من الترجمات الشهرية (${MAX_DAILY_TRANSLATIONS} ترجمة)` 
            : `You have reached your monthly translation limit (${MAX_DAILY_TRANSLATIONS} translations)`,
          variant: 'destructive'
        });
        return false;
      }
      
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
  }, [user, userQuota, language, MAX_DAILY_TRANSLATIONS]);

  // Enhanced purchase function for translations - now 100 for 10 QAR
  const purchaseExtraTranslations = useCallback(async (count: number = 100) => {
    if (!user) {
      console.error('❌ No authenticated user found');
      return false;
    }

    try {
      console.log('💰 Attempting to purchase extra translations:', { userId: user.id, count });
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('user_translation_quotas')
        .update({
          extra_translations: userQuota.extra_translations + count,
          purchase_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('daily_date', today)
        .select()
        .single();

      if (error) {
        console.error('❌ Database error during translation purchase:', error);
        handleDatabaseError(error, 'Purchasing translations');
        return false;
      }

      console.log('✅ Translations purchased successfully');
      
      // Update local state immediately
      setUserQuota(prev => ({
        ...prev,
        extra_translations: prev.extra_translations + count,
        purchase_date: new Date().toISOString()
      }));
      
      toast({
        title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
        description: language === 'ar' 
          ? `تم إضافة ${count} ترجمة إضافية (صالحة لشهر واحد)` 
          : `Added ${count} extra translations (valid for 1 month)`,
      });
      
      return true;
    } catch (error) {
      console.error('❌ Unexpected error purchasing extra translations:', error);
      handleDatabaseError(error, 'Purchasing translations');
      return false;
    }
  }, [user, userQuota, language]);

  // Simplified refresh function
  const refreshTranslationQuota = useCallback(async () => {
    console.log('🔄 External refresh of translation quota requested');
    await loadUserQuota(true);
  }, [loadUserQuota]);

  // Load quota when user changes
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
    refreshTranslationQuota,
    MAX_DAILY_TRANSLATIONS,
    SOFT_WARNING_THRESHOLD,
    ...computedValues
  };
};
