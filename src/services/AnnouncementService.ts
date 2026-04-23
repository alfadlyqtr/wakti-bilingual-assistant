import { supabase } from '@/integrations/supabase/client';

// Generic one-time announcement / nudge tracker backed by public.user_announcement_events.
// Use one stable key per announcement (e.g. 'helpful_memory_onboarding_v1').
export type AnnouncementStatus = 'seen' | 'dismissed' | 'acted' | 'snoozed';

const localKey = (userId: string, key: string) => `wakti_announcement_${userId}_${key}`;

export const AnnouncementService = {
  async hasSeen(userId: string, key: string): Promise<boolean> {
    if (!userId || !key) return true;
    // Fast local cache first — avoids a network round-trip on every page load.
    try {
      if (localStorage.getItem(localKey(userId, key)) === '1') return true;
    } catch {}
    try {
      const db = supabase as any;
      const { data, error } = await db
        .from('user_announcement_events')
        .select('id, status')
        .eq('user_id', userId)
        .eq('announcement_key', key)
        .maybeSingle();
      if (error) return false;
      if (data?.id) {
        try { localStorage.setItem(localKey(userId, key), '1'); } catch {}
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async mark(userId: string, key: string, status: AnnouncementStatus, metadata?: Record<string, unknown>): Promise<void> {
    if (!userId || !key) return;
    const nowIso = new Date().toISOString();
    const payload: any = {
      user_id: userId,
      announcement_key: key,
      status,
      seen_at: nowIso,
      metadata: metadata || {},
      updated_at: nowIso,
    };
    if (status === 'acted') payload.acted_at = nowIso;
    if (status === 'dismissed') payload.dismissed_at = nowIso;
    try {
      const db = supabase as any;
      // Upsert by (user_id, announcement_key) — if no unique index, fall back to manual upsert.
      const { data: existing } = await db
        .from('user_announcement_events')
        .select('id')
        .eq('user_id', userId)
        .eq('announcement_key', key)
        .maybeSingle();
      if (existing?.id) {
        await db
          .from('user_announcement_events')
          .update(payload)
          .eq('id', existing.id);
      } else {
        await db
          .from('user_announcement_events')
          .insert(payload);
      }
      try { localStorage.setItem(localKey(userId, key), '1'); } catch {}
    } catch (error) {
      console.warn('AnnouncementService.mark failed', error);
    }
  },
};
