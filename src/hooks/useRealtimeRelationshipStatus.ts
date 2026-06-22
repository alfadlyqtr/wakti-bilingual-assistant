import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDirectChatPermission, type DirectChatPermissionState } from '@/services/contactsService';

export function useRealtimeRelationshipStatus(contactId: string | null | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<DirectChatPermissionState>('disconnected');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!contactId || !enabled) {
      setPermission('disconnected');
      setIsLoading(false);
      return;
    }

    let active = true;

    const refreshPermission = async () => {
      try {
        const state = await getDirectChatPermission(contactId);
        if (active) {
          setPermission(state);
        }
      } catch {
        if (active) {
          setPermission('disconnected');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    // Read contacts cache first to avoid the 1-2s DB flash on every chat open.
    const contacts = queryClient.getQueryData<any[]>(['contacts']);
    const cachedContact = contacts?.find((c: any) => c.contact_id === contactId);

    if (cachedContact) {
      // Cache hit: set permission immediately so the UI never shows "reconnect to send messages".
      // The DB check still runs silently in the background for accuracy.
      const cachedPermission: DirectChatPermissionState =
        cachedContact.relationshipStatus === 'mutual' ? 'allowed' : 'disconnected';
      setPermission(cachedPermission);
      setIsLoading(false);
      refreshPermission();
    } else {
      // Cache miss (deep link, push notification, etc.): fall back to DB check.
      setIsLoading(true);
      refreshPermission();
    }

    const channel = supabase
      .channel(`relationship-${contactId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'contacts' },
        (payload: any) => {
          const row = payload?.new || payload?.old;
          if (!row) return;
          if (row.user_id === contactId || row.contact_id === contactId) {
            refreshPermission();
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [contactId, enabled, queryClient]);

  return { permission, isLoading, canSend: permission === 'allowed' && !isLoading };
}
