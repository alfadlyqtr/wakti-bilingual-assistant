
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PerformanceCache } from '@/services/PerformanceCache';

interface AIQuota {
  chat_characters_used: number;
  search_characters_used: number;
  image_prompts_used: number;
  created_at: string;
  updated_at: string;
}

export function useAIQuotaManagement() {
  const [quota, setQuota] = useState<AIQuota | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuota = async (forceRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cacheKey = `ai_quota_${user.id}`;
      
      // Check cache first unless forced refresh
      if (!forceRefresh) {
        const cached = PerformanceCache.get<AIQuota>(cacheKey);
        if (cached) {
          setQuota(cached);
          return cached;
        }
      }

      setLoading(true);

      // Use the database function to get or create quota silently
      const { data, error } = await supabase.rpc('get_or_create_ai_quota', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error fetching AI quota:', error);
        return null;
      }

      const quotaData = data?.[0] || {
        chat_characters_used: 0,
        search_characters_used: 0,
        image_prompts_used: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Cache for 5 minutes
      PerformanceCache.set(cacheKey, quotaData, 300000);
      setQuota(quotaData);
      return quotaData;

    } catch (error) {
      console.error('Error in fetchQuota:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateQuota = async (updates: Partial<Pick<AIQuota, 'chat_characters_used' | 'search_characters_used' | 'image_prompts_used'>>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('ai_quota_management')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating AI quota:', error);
        return;
      }

      // Invalidate cache and refetch
      const cacheKey = `ai_quota_${user.id}`;
      PerformanceCache.invalidate(cacheKey);
      await fetchQuota(true);

    } catch (error) {
      console.error('Error in updateQuota:', error);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  return {
    quota,
    loading,
    fetchQuota,
    updateQuota
  };
}
