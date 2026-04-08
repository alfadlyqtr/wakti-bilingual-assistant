import { supabase, ensurePassport, getCurrentUserId } from '@/integrations/supabase/client';
import { getContacts } from '@/services/contactsService';

export type MusicShareStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface MusicShareRecipient {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface MusicTrackShare {
  id: string;
  sender_id: string;
  recipient_id: string;
  source_track_id: string;
  status: MusicShareStatus;
  note: string | null;
  sender_snapshot: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
  track_snapshot: {
    title?: string;
    cover_url?: string;
    duration?: number | null;
  } | null;
  accepted_track_id?: string | null;
  created_at: string;
  responded_at?: string | null;
}

export async function getMutualMusicShareRecipients(): Promise<MusicShareRecipient[]> {
  await ensurePassport();
  const contacts = await getContacts();
  return (contacts || [])
    .filter((contact: any) => contact.relationshipStatus === 'mutual')
    .map((contact: any) => ({
      id: contact.contact_id,
      displayName: contact.profile?.display_name || contact.profile?.username || 'Wakti User',
      username: contact.profile?.username || 'user',
      avatarUrl: contact.profile?.avatar_url || undefined,
    }));
}

export async function sendMusicTrackShare(params: {
  recipientId: string;
  trackId: string;
  note?: string;
}): Promise<MusicTrackShare> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  await ensurePassport();

  const [{ data: profile, error: profileError }, { data: track, error: trackError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_music_tracks')
      .select('id, user_id, title, cover_url, duration')
      .eq('id', params.trackId)
      .eq('user_id', userId)
      .single(),
  ]);

  if (profileError) throw profileError;
  if (trackError) throw trackError;
  if (!track || track.user_id !== userId) throw new Error('Track not found');

  const { data, error } = await (supabase as any)
    .from('music_track_shares')
    .insert({
      sender_id: userId,
      recipient_id: params.recipientId,
      source_track_id: params.trackId,
      note: params.note?.trim() || null,
      sender_snapshot: {
        display_name: profile?.display_name || null,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
      },
      track_snapshot: {
        title: track.title || null,
        cover_url: track.cover_url || null,
        duration: track.duration ?? null,
      },
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as MusicTrackShare;
}

export async function getPendingMusicTrackShares(): Promise<MusicTrackShare[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  await ensurePassport();

  const { data, error } = await (supabase as any)
    .from('music_track_shares')
    .select('*')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as MusicTrackShare[];
}

export async function acceptMusicTrackShare(shareId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('accept_music_track_share', { p_share_id: shareId });
  if (error) throw error;
  return data as string;
}

export async function declineMusicTrackShare(shareId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('decline_music_track_share', { p_share_id: shareId });
  if (error) throw error;
}
