import { supabase } from '@/integrations/supabase/client';

export type AnnouncementStatus = 'draft' | 'live' | 'archived';
export type AnnouncementDisplay = 'popup' | 'toast' | 'banner';
export type AnnouncementTrigger = 'on_first_login' | 'on_every_app_open' | 'on_page_visit' | 'on_event';
export type AnnouncementAudience =
  | 'all'
  | 'paid'
  | 'free'
  | 'gifted'
  | 'trial'
  | 'specific_users'
  | 'by_country'
  | 'by_language'
  | 'custom';
export type AnnouncementFrequency = 'show_once' | 'show_until_acted' | 'show_n_times';
export type AnnouncementCtaAction = 'url' | 'navigate' | 'event' | null;
export type AnnouncementPriority = 'normal' | 'high';

export interface AnnouncementAdminRow {
  id: string;
  announcement_key: string;
  is_system: boolean;
  title_en: string | null;
  title_ar: string | null;
  body_en: string | null;
  body_ar: string | null;
  icon: string | null;
  color: string | null;
  cta_enabled: boolean;
  cta_label_en: string | null;
  cta_label_ar: string | null;
  cta_action_type: AnnouncementCtaAction;
  cta_action_value: string | null;
  display_type: AnnouncementDisplay;
  trigger_type: AnnouncementTrigger;
  trigger_event_key: string | null;
  delay_seconds: number;
  include_routes: string[];
  exclude_routes: string[];
  audience_type: AnnouncementAudience;
  target_user_ids: string[];
  target_countries: string[];
  target_languages: string[];
  audience_filter: Record<string, unknown>;
  frequency: AnnouncementFrequency;
  max_shows: number;
  starts_at: string | null;
  ends_at: string | null;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  created_at: string;
  updated_at: string;
  total_events: number;
  seen_count: number;
  acted_count: number;
  dismissed_count: number;
  unique_users: number;
}

export type AnnouncementPayload = Partial<
  Omit<AnnouncementAdminRow, 'id' | 'is_system' | 'created_at' | 'updated_at' | 'total_events' | 'seen_count' | 'acted_count' | 'dismissed_count' | 'unique_users'>
>;

const db = supabase as any;

export const AnnouncementAdminService = {
  async list(): Promise<AnnouncementAdminRow[]> {
    const { data, error } = await db.rpc('admin_list_announcements');
    if (error) throw error;
    return (data || []) as AnnouncementAdminRow[];
  },

  async upsert(payload: AnnouncementPayload, id?: string | null): Promise<AnnouncementAdminRow> {
    const { data, error } = await db.rpc('admin_upsert_announcement', { p_payload: payload, p_id: id ?? null });
    if (error) throw error;
    return data as AnnouncementAdminRow;
  },

  async archive(id: string): Promise<void> {
    const { error } = await db.rpc('admin_archive_announcement', { p_id: id });
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await db.rpc('admin_delete_announcement', { p_id: id });
    if (error) throw error;
  },

  async duplicate(id: string): Promise<AnnouncementAdminRow> {
    const { data, error } = await db.rpc('admin_duplicate_announcement', { p_id: id });
    if (error) throw error;
    return data as AnnouncementAdminRow;
  },

  async searchUsers(term: string, limit = 20): Promise<{ id: string; email: string | null; display_name: string | null }[]> {
    const q = (term || '').trim();
    if (!q) return [];
    const { data, error } = await db
      .from('profiles')
      .select('id, email, display_name')
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};
