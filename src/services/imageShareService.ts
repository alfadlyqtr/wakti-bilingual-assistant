import { supabase, ensurePassport, getCurrentUserId } from '@/integrations/supabase/client';
import { getContacts } from '@/services/contactsService';

export type ImageShareStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface ImageShareRecipient {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface ImageShareRecord {
  id: string;
  sender_id: string;
  recipient_id: string;
  source_image_id: string;
  status: ImageShareStatus;
  note: string | null;
  sender_snapshot: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
  image_snapshot: {
    image_url?: string;
    prompt?: string | null;
    submode?: string | null;
    quality?: string | null;
    created_at?: string | null;
  } | null;
  accepted_image_id?: string | null;
  created_at: string;
  responded_at?: string | null;
}

export async function getMutualImageShareRecipients(): Promise<ImageShareRecipient[]> {
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

export async function sendImageShare(params: {
  recipientId: string;
  imageId: string;
  note?: string;
}): Promise<ImageShareRecord> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  await ensurePassport();

  const [{ data: profile, error: profileError }, { data: image, error: imageError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
    (supabase as any)
      .from('user_generated_images')
      .select('id, user_id, image_url, prompt, submode, quality, created_at')
      .eq('id', params.imageId)
      .eq('user_id', userId)
      .single(),
  ]);

  if (profileError) throw profileError;
  if (imageError) throw imageError;
  if (!image || image.user_id !== userId) throw new Error('Image not found');

  const { data, error } = await (supabase as any)
    .from('image_shares')
    .insert({
      sender_id: userId,
      recipient_id: params.recipientId,
      source_image_id: params.imageId,
      note: params.note?.trim() || null,
      sender_snapshot: {
        display_name: profile?.display_name || null,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
      },
      image_snapshot: {
        image_url: image.image_url || null,
        prompt: image.prompt || null,
        submode: image.submode || null,
        quality: image.quality || null,
        created_at: image.created_at || null,
      },
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as ImageShareRecord;
}

export async function getPendingImageShares(): Promise<ImageShareRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  await ensurePassport();

  const { data, error } = await (supabase as any)
    .from('image_shares')
    .select('*')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as ImageShareRecord[];
}

export async function acceptImageShare(shareId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('accept_image_share', { p_share_id: shareId });
  if (error) throw error;
  return data as string;
}

export async function declineImageShare(shareId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('decline_image_share', { p_share_id: shareId });
  if (error) throw error;
}
