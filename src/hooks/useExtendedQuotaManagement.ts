
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserSearchQuota {
  daily_count: number;
  regular_search_count: number;
  extra_searches: number;
  extra_regular_searches: number;
  extra_advanced_searches: number;
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

  // Search quota limits
  const REGULAR_SEARCH_LIMIT = 15; // 15 regular searches per month
  const ADVANCED_SEARCH_LIMIT = 5; // 5 advanced searches per month

  const loadUserSearchQuota = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoadingSearchQuota(true);
      console.log('🔍 Loading user search quota for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_or_create_user_search_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading search quota:', error);
        return;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ Search quota loaded:', quota);
        setUserSearchQuota({
          daily_count: quota.daily_count || 0,
          regular_search_count: quota.regular_search_count || 0,
          extra_searches: quota.extra_searches || 0,
          extra_regular_searches: quota.extra_regular_searches || 0,
          extra_advanced_searches: quota.extra_advanced_searches || 0,
          purchase_date: quota.purchase_date
        });
      }
    } catch (error) {
      console.error('❌ Error loading search quota:', error);
    } finally {
      setIsLoadingSearchQuota(false);
    }
  }, [user]);

  const loadUserVoiceQuota = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoadingVoiceQuota(true);
      console.log('🎵 Loading user voice quota for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_or_create_user_voice_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Error loading voice quota:', error);
        return;
      }

      if (data && data.length > 0) {
        const quota = data[0];
        console.log('✅ Voice quota loaded:', quota);
        setUserVoiceQuota({
          characters_used: quota.characters_used || 0,
          characters_limit: quota.characters_limit || 5000,
          extra_characters: quota.extra_characters || 0,
          purchase_date: quota.purchase_date
        });
      }
    } catch (error) {
      console.error('❌ Error loading voice quota:', error);
    } finally {
      setIsLoadingVoiceQuota(false);
    }
  }, [user]);

  // Load quotas when user changes
  useEffect(() => {
    if (user) {
      loadUserSearchQuota();
      loadUserVoiceQuota();
    }
  }, [user?.id, loadUserSearchQuota, loadUserVoiceQuota]);

  // Computed values for search quotas
  const searchQuotaStatus = useMemo(() => {
    const regularRemaining = Math.max(0, REGULAR_SEARCH_LIMIT - userSearchQuota.regular_search_count);
    const advancedRemaining = Math.max(0, ADVANCED_SEARCH_LIMIT - userSearchQuota.daily_count);
    
    return {
      regularRemaining,
      advancedRemaining,
      regularLimit: REGULAR_SEARCH_LIMIT,
      advancedLimit: ADVANCED_SEARCH_LIMIT,
      extraRegularSearches: userSearchQuota.extra_regular_searches,
      extraAdvancedSearches: userSearchQuota.extra_advanced_searches
    };
  }, [userSearchQuota]);

  // Computed values for voice quota
  const totalAvailableCharacters = useMemo(() => {
    return Math.max(0, (userVoiceQuota.characters_limit + userVoiceQuota.extra_characters) - userVoiceQuota.characters_used);
  }, [userVoiceQuota]);

  const canUseVoice = useMemo(() => {
    return totalAvailableCharacters > 0;
  }, [totalAvailableCharacters]);

  return {
    userSearchQuota,
    userVoiceQuota,
    isLoadingSearchQuota,
    isLoadingVoiceQuota,
    loadUserSearchQuota,
    loadUserVoiceQuota,
    searchQuotaStatus,
    totalAvailableCharacters,
    canUseVoice,
    REGULAR_SEARCH_LIMIT,
    ADVANCED_SEARCH_LIMIT
  };
};
