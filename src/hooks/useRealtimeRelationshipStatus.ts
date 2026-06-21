import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDirectChatPermission, type DirectChatPermissionState } from '@/services/contactsService';

export function useRealtimeRelationshipStatus(contactId: string | null | undefined, enabled = true) {
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

    setIsLoading(true);
    refreshPermission();

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
  }, [contactId, enabled]);

  return { permission, isLoading, canSend: permission === 'allowed' && !isLoading };
}
