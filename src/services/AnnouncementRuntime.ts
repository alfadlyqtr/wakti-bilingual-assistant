import { supabase } from '@/integrations/supabase/client';

export interface PendingAnnouncement {
  id: string;
  announcement_key: string;
  title_en: string | null;
  title_ar: string | null;
  body_en: string | null;
  body_ar: string | null;
  icon: string | null;
  color: string | null;
  cta_enabled: boolean;
  cta_label_en: string | null;
  cta_label_ar: string | null;
  cta_action_type: 'url' | 'navigate' | 'event' | null;
  cta_action_value: string | null;
  display_type: 'popup' | 'toast' | 'banner';
  trigger_type: 'on_first_login' | 'on_every_app_open' | 'on_page_visit' | 'on_event';
  trigger_event_key: string | null;
  delay_seconds: number;
  include_routes: string[];
  exclude_routes: string[];
  frequency: 'show_once' | 'show_until_acted' | 'show_n_times';
  max_shows: number;
  priority: 'normal' | 'high';
  test_override?: boolean;
}

const db = supabase as any;
const ANNOUNCEMENT_REFRESH_EVENT = 'wakti-announcements-refresh';

export const AnnouncementRuntime = {
  async getPending(): Promise<PendingAnnouncement[]> {
    const { data, error } = await db.rpc('get_pending_announcements');
    if (error) {
      console.warn('[AnnouncementRuntime] getPending error:', error.message);
      return [];
    }
    return (data || []) as PendingAnnouncement[];
  },

  async recordShown(announcementId: string): Promise<void> {
    try {
      await db.rpc('record_announcement_shown', { p_announcement_id: announcementId });
    } catch (err) {
      console.warn('[AnnouncementRuntime] recordShown failed', err);
    }
  },

  subscribe(userId: string, onRefresh: () => void): () => void {
    const channel = supabase
      .channel(`announcement-runtime-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => onRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_audience_groups' }, () => onRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_test_recipients', filter: `user_id=eq.${userId}` }, () => onRefresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  triggerRefresh(): void {
    window.dispatchEvent(new Event(ANNOUNCEMENT_REFRESH_EVENT));
  },

  onRefresh(handler: () => void): () => void {
    window.addEventListener(ANNOUNCEMENT_REFRESH_EVENT, handler);
    return () => window.removeEventListener(ANNOUNCEMENT_REFRESH_EVENT, handler);
  },
};

export function matchesRoute(pathname: string, include: string[], exclude: string[]): boolean {
  const path = pathname || '/';
  const excluded = (exclude || []).some((p) => matchPattern(path, p));
  if (excluded) return false;
  const list = include || [];
  if (list.length === 0) return true;
  return list.some((p) => matchPattern(path, p));
}

function matchPattern(path: string, pattern: string): boolean {
  if (!pattern) return false;
  if (pattern === path) return true;
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return path.startsWith(prefix);
  }
  return path === pattern;
}
