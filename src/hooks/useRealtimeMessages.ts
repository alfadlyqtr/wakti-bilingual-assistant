import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Item #8 Batch B2: Direct-message Realtime subscription.
 *
 * Replaces the old 5-second polling in ChatPage/ChatPopup with a live
 * Supabase Realtime subscription on the `messages` table. When a row is
 * inserted/updated/deleted between the current user and the contact,
 * the corresponding React Query cache is invalidated so the list refetches.
 *
 * Two subscriptions are used because Supabase's postgres_changes filter only
 * supports a single column match at a time:
 *   - filter A: recipient_id = currentUserId  (messages coming in)
 *   - filter B: sender_id    = currentUserId  (messages we sent, e.g. from another device)
 *
 * Each payload is further filtered client-side to check whether the other
 * party of the row matches the active contact, so we don't invalidate the
 * cache for unrelated conversations.
 *
 * The `messages` table is already in the `supabase_realtime` publication
 * (verified Apr 2026), so no DB migration is needed.
 */
export function useRealtimeMessages(
  contactId: string | undefined | null,
  currentUserId: string | undefined | null,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!contactId || !currentUserId) return;

    // Stable channel name per (userA,userB) pair — sorting IDs prevents
    // two different subscriptions racing when both sides open the chat.
    const pairKey = [currentUserId, contactId].sort().join('-');
    const channelName = `dm-${pairKey}`;

    // Reuse/remove any existing channel for this pair before creating a new one.
    const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existing) supabase.removeChannel(existing);

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
    };

    const isRelevantPayload = (payload: any) => {
      const row = payload?.new || payload?.old;
      if (!row) return false;
      // Only invalidate when the row involves the currently-viewed contact.
      return (
        (row.sender_id === contactId && row.recipient_id === currentUserId) ||
        (row.sender_id === currentUserId && row.recipient_id === contactId)
      );
    };

    const channel = supabase
      .channel(channelName)
      // Incoming messages (we are the recipient)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${currentUserId}` },
        (payload: any) => { if (isRelevantPayload(payload)) invalidate(); },
      )
      // Outgoing messages (we are the sender — catches sends from another device/tab)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentUserId}` },
        (payload: any) => { if (isRelevantPayload(payload)) invalidate(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, currentUserId, queryClient]);
}
