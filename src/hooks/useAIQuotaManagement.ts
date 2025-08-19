import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  const [quota, setQuota] = useState<AIQuota | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuota = async (forceRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_or_create_ai_quota', { p_user_id: user.id });
      if (rpcError) {
        console.error('Error fetching AI quota via RPC:', rpcError);
        return null;
      }

      const quotaData = (Array.isArray(rpcData) ? rpcData[0] : rpcData) || {
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
      delete quotaCache[user.id];
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
