
import { useState, useEffect } from 'react';
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

  const MAX_DAILY_TRANSLATIONS = 25;
  const SOFT_WARNING_THRESHOLD = 20;

  const loadUserQuota = async () => {
    if (!user) return;
    
    try {
      setIsLoadingQuota(true);
      setQuotaError(null);
      
      console.log('🔄 Loading user quota for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_or_create_user_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading user quota:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ User quota loaded successfully:', quota);
        setUserQuota({
          daily_count: quota.daily_count,
          extra_translations: quota.extra_translations,
          purchase_date: quota.purchase_date
        });
      } else {
        console.warn('⚠️ No quota data returned, using defaults');
        setUserQuota({ daily_count: 0, extra_translations: 0 });
      }
    } catch (error) {
      console.error('❌ Error loading user quota:', error);
      setQuotaError('Failed to load quota data');
      setUserQuota({ daily_count: 0, extra_translations: 0 });
      
      toast({
        title: language === 'ar' ? 'تحذير' : 'Warning',
        description: language === 'ar' ? 'تعذر تحميل بيانات الحصة، ولكن يمكنك المتابعة' : 'Could not load quota data, but you can continue',
        variant: 'default'
      });
    } finally {
      setIsLoadingQuota(false);
    }
  };

  const incrementTranslationCount = async (): Promise<boolean> => {
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
          setUserQuota({
            daily_count: result.daily_count,
            extra_translations: result.extra_translations,
            purchase_date: userQuota.purchase_date
          });
          
          console.log('📊 Updated quota state:', {
            daily_count: result.daily_count,
            extra_translations: result.extra_translations
          });
          
          return true;
        } else {
          console.warn('⚠️ Translation count increment failed - quota exceeded');
          toast({
            title: language === 'ar' ? 'تم الوصول للحد الأقصى' : 'Limit Reached',
            description: language === 'ar' 
              ? 'لقد وصلت للحد الأقصى من الترجمات اليومية' 
              : 'You have reached your daily translation limit',
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
  };

  const purchaseExtraTranslations = async (count: number = 100) => {
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
          // Update local state immediately
          setUserQuota(prev => ({
            ...prev,
            extra_translations: result.new_extra_count,
            purchase_date: new Date().toISOString()
          }));
          
          toast({
            title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
            description: language === 'ar' 
              ? `تم إضافة ${count} ترجمة إضافية` 
              : `Added ${count} extra translations`,
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
  };

  // Auto-load quota when user changes
  useEffect(() => {
    if (user) {
      loadUserQuota();
    }
  }, [user]);

  // Helper computed values
  const remainingFreeTranslations = Math.max(0, MAX_DAILY_TRANSLATIONS - userQuota.daily_count);
  const isAtSoftLimit = userQuota.daily_count >= SOFT_WARNING_THRESHOLD;
  const isAtHardLimit = userQuota.daily_count >= MAX_DAILY_TRANSLATIONS && userQuota.extra_translations === 0;
  const canTranslate = quotaError || remainingFreeTranslations > 0 || userQuota.extra_translations > 0;

  return {
    userQuota,
    isLoadingQuota,
    quotaError,
    loadUserQuota,
    incrementTranslationCount,
    purchaseExtraTranslations,
    remainingFreeTranslations,
    isAtSoftLimit,
    isAtHardLimit,
    canTranslate,
    MAX_DAILY_TRANSLATIONS,
    SOFT_WARNING_THRESHOLD
  };
};
