import { supabase, ensurePassport, getCurrentUserId } from '@/integrations/supabase/client';
import { getContacts } from '@/services/contactsService';

export type ProjectShareStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface ProjectShareRecipient {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface ProjectShareRecord {
  id: string;
  sender_id: string;
  recipient_id: string;
  source_project_id: string;
  status: ProjectShareStatus;
  note: string | null;
  sender_snapshot: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
  project_snapshot: {
    name?: string;
    description?: string | null;
    thumbnail_url?: string | null;
  } | null;
  accepted_project_id?: string | null;
  created_at: string;
  responded_at?: string | null;
}

export async function getMutualProjectShareRecipients(): Promise<ProjectShareRecipient[]> {
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

export async function sendProjectShare(params: {
  recipientId: string;
  projectId: string;
  note?: string;
}): Promise<ProjectShareRecord> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  await ensurePassport();

  const [{ data: profile, error: profileError }, { data: project, error: projectError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
    (supabase as any)
      .from('projects')
      .select('id, user_id, name, description, thumbnail_url')
      .eq('id', params.projectId)
      .eq('user_id', userId)
      .single(),
  ]);

  if (profileError) throw profileError;
  if (projectError) throw projectError;
  if (!project || project.user_id !== userId) throw new Error('Project not found');

  const { data, error } = await (supabase as any)
    .from('project_shares')
    .insert({
      sender_id: userId,
      recipient_id: params.recipientId,
      source_project_id: params.projectId,
      note: params.note?.trim() || null,
      sender_snapshot: {
        display_name: profile?.display_name || null,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
      },
      project_snapshot: {
        name: project.name || null,
        description: project.description || null,
        thumbnail_url: project.thumbnail_url || null,
      },
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as ProjectShareRecord;
}

export async function getPendingProjectShares(): Promise<ProjectShareRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  await ensurePassport();

  const { data, error } = await (supabase as any)
    .from('project_shares')
    .select('*')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as ProjectShareRecord[];
}

export async function acceptProjectShare(shareId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('accept_project_share', { p_share_id: shareId });
  if (error) throw error;
  return data as string;
}

export async function declineProjectShare(shareId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('decline_project_share', { p_share_id: shareId });
  if (error) throw error;
}
