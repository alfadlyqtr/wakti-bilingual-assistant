import { ensurePassport, getCurrentUserId, supabase } from '@/integrations/supabase/client';
import { getContacts } from '@/services/contactsService';

export type GameInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export type GameInviteType = 'chess' | 'tictactoe';

export interface GameInviteRecipient {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface GameInviteRecord {
  id: string;
  sender_id: string;
  recipient_id: string;
  game_type: GameInviteType;
  game_code: string;
  status: GameInviteStatus;
  sender_snapshot: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
  game_snapshot: {
    title?: string;
    code?: string;
  } | null;
  created_at: string;
  responded_at?: string | null;
}

export interface GameInviteAcceptResult {
  game_type: GameInviteType;
  game_code: string;
}

export async function getMutualGameInviteRecipients(): Promise<GameInviteRecipient[]> {
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

export async function sendGameInvite(params: {
  recipientId: string;
  gameType: GameInviteType;
  gameCode: string;
}): Promise<GameInviteRecord> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  await ensurePassport();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;

  const title = params.gameType === 'chess' ? 'Chess' : 'Tic-Tac-Toe';

  const { data, error } = await (supabase as any)
    .from('game_invites')
    .insert({
      sender_id: userId,
      recipient_id: params.recipientId,
      game_type: params.gameType,
      game_code: params.gameCode,
      sender_snapshot: {
        display_name: profile?.display_name || null,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
      },
      game_snapshot: {
        title,
        code: params.gameCode,
      },
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as GameInviteRecord;
}

export async function getPendingGameInvites(): Promise<GameInviteRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  await ensurePassport();

  const { data, error } = await (supabase as any)
    .from('game_invites')
    .select('*')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as GameInviteRecord[];
}

export async function acceptGameInvite(inviteId: string, playerName?: string): Promise<GameInviteAcceptResult> {
  const { data, error } = await (supabase as any).rpc('accept_game_invite', {
    p_invite_id: inviteId,
    p_player_name: playerName?.trim() || null,
  });
  if (error) throw error;
  return data as GameInviteAcceptResult;
}

export async function declineGameInvite(inviteId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('decline_game_invite', { p_invite_id: inviteId });
  if (error) throw error;
}
