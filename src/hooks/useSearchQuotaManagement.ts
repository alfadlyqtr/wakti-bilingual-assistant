
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface SearchQuota {
  regular_search_count: number;
  extra_regular_searches: number;
  purchase_date?: string;
}

export const useSearchQuotaManagement = (language: 'en' | 'ar' = 'en') => {
  const { user } = useAuth();
  const [searchQuota, setSearchQuota] = useState<SearchQuota>({ regular_search_count: 0, extra_regular_searches: 0 });
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  // Monthly limit for searches
  const MAX_MONTHLY_SEARCHES = 10;
  const SEARCH_PACKAGE_SIZE = 50; // 50 searches per package
  const SEARCH_PACKAGE_PRICE = 10; // 10 QAR

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

  // Load search quota function
  const loadSearchQuota = useCallback(async (forceRefresh: boolean = false) => {
    if (!user) return;
    
    try {
      setIsLoadingQuota(true);
      setQuotaError(null);
      
      console.log('🔄 Loading user search quota for user:', user.id, forceRefresh ? '(force refresh)' : '');
      
      const { data, error } = await supabase.rpc('get_or_create_user_search_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading user search quota:', error);
        handleDatabaseError(error, 'Loading search quota');
        setQuotaError('Failed to load quota data');
        return;
      }

      if (data && data[0]) {
        const quota = data[0];
        console.log('✅ User search quota loaded successfully:', quota);
        setSearchQuota({
          regular_search_count: quota.regular_search_count || 0,
          extra_regular_searches: quota.extra_regular_searches || 0,
          purchase_date: quota.purchase_date
        });
      } else {
        console.log('📝 No quota data found, using defaults');
        setSearchQuota({
          regular_search_count: 0,
          extra_regular_searches: 0,
          purchase_date: null
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error loading user search quota:', error);
      setQuotaError('Failed to load quota data');
      handleDatabaseError(error, 'Loading search quota');
      setSearchQuota({ regular_search_count: 0, extra_regular_searches: 0 });
    } finally {
      setIsLoadingQuota(false);
    }
  }, [user, language]);

  // Purchase search package function
  const purchaseSearchPackage = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.error('❌ No authenticated user found');
      return false;
    }

    try {
      console.log('💰 Attempting to purchase search package:', { userId: user.id, packageSize: SEARCH_PACKAGE_SIZE });
      
      const { data, error } = await supabase.rpc('purchase_search_package', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Database error during search package purchase:', error);
        handleDatabaseError(error, 'Purchasing search package');
        return false;
      }

      if (data && data[0]) {
        const result = data[0];
        console.log('✅ Search package purchased successfully:', result);
        
        // Update local state immediately
        setSearchQuota(prev => ({
          ...prev,
          extra_regular_searches: result.new_extra_count,
          purchase_date: new Date().toISOString()
        }));
        
        toast({
          title: language === 'ar' ? 'تم الشراء بنجاح' : 'Purchase Successful',
          description: language === 'ar' 
            ? `تم إضافة ${SEARCH_PACKAGE_SIZE} بحث إضافي (صالح لمدة 30 يوماً)` 
            : `Added ${SEARCH_PACKAGE_SIZE} extra searches (valid for 30 days)`,
        });
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Unexpected error purchasing search package:', error);
      handleDatabaseError(error, 'Purchasing search package');
      return false;
    }
  }, [user, language, SEARCH_PACKAGE_SIZE]);

  // Refresh quota function
  const refreshSearchQuota = useCallback(async () => {
    console.log('🔄 External refresh of search quota requested');
    await loadSearchQuota(true);
  }, [loadSearchQuota]);

  // Load quota when user changes
  useEffect(() => {
    if (user && !isLoadingQuota) {
      loadSearchQuota();
    }
  }, [user?.id]);

  // Memoize computed values to prevent unnecessary re-renders
  const computedValues = useMemo(() => {
    const remainingFreeSearches = Math.max(0, MAX_MONTHLY_SEARCHES - searchQuota.regular_search_count);
    const isAtLimit = searchQuota.regular_search_count >= MAX_MONTHLY_SEARCHES && searchQuota.extra_regular_searches === 0;
    const canSearch = quotaError || remainingFreeSearches > 0 || searchQuota.extra_regular_searches > 0;

    return {
      remainingFreeSearches,
      isAtLimit,
      canSearch,
      totalUsed: searchQuota.regular_search_count,
      extraSearches: searchQuota.extra_regular_searches
    };
  }, [searchQuota, quotaError, MAX_MONTHLY_SEARCHES]);

  return {
    searchQuota,
    isLoadingQuota,
    quotaError,
    loadSearchQuota,
    purchaseSearchPackage,
    refreshSearchQuota,
    MAX_MONTHLY_SEARCHES,
    SEARCH_PACKAGE_SIZE,
    SEARCH_PACKAGE_PRICE,
    ...computedValues
  };
};
