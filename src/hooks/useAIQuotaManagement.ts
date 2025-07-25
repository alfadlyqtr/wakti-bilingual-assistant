
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AIQuota {
  chat_characters_used: number;
  search_characters_used: number;
  image_prompts_used: number;
  created_at: string;
  updated_at: string;
}

// Simple in-memory cache to avoid repeated DB calls
let quotaCache: { [userId: string]: { data: AIQuota; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useAIQuotaManagement() {
  const { user } = useAuth();
  const [quota, setQuota] = useState<AIQuota | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuota = async (forceRefresh = false) => {
    if (!user?.id) return;

    try {
      // Check simple cache first unless forced refresh
      if (!forceRefresh && quotaCache[user.id]) {
        const cached = quotaCache[user.id];
        const now = Date.now();
        if (now - cached.timestamp < CACHE_DURATION) {
          setQuota(cached.data);
          return cached.data;
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

      // Simple cache update
      quotaCache[user.id] = {
        data: quotaData,
        timestamp: Date.now()
      };

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
    if (!user?.id) return;

    try {
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
      delete quotaCache[user.id];
      await fetchQuota(true);

    } catch (error) {
      console.error('Error in updateQuota:', error);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, [user?.id]);

  return {
    quota,
    loading,
    fetchQuota,
    updateQuota
  };
}
