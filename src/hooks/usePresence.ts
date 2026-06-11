import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";

type TypingPayload = {
  user_id: string;
  typing?: boolean;
};

/**
 * Tracks realtime online presence of users via Supabase Realtime Presence.
 * Returns utilities for checking online status, typing indicators, and last seen timestamps.
 */
export function usePresence(currentUserId?: string | null) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});

  const typingChannelName = useMemo(() => "online-users-typing", []);
  const ONLINE_WINDOW_MS = 45_000;

  // Format timestamp to relative time (e.g., "5m ago")
  const formatLastSeen = useCallback((timestamp: string) => {
    if (!timestamp) return 'Offline';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return 'Offline';
    }
  }, []);

  // Check if a user is currently typing
  const isTyping = useCallback((userId: string) => {
    return typingUsers.has(userId);
  }, [typingUsers]);

  const isOnline = useCallback((userId: string) => {
    const ts = lastSeen[userId];
    if (!ts) return false;
    try {
      return (Date.now() - new Date(ts).getTime()) <= ONLINE_WINDOW_MS;
    } catch {
      return false;
    }
  }, [lastSeen]);

  // Get neutral presence label
  const getLastSeen = useCallback((userId: string) => {
    const ts = lastSeen[userId];
    if (isOnline(userId)) return 'Online • now';
    if (ts) {
      try {
        const age = Date.now() - new Date(ts).getTime();
        if (age <= 60_000) return 'Last online just now';
        return `Last online ${formatLastSeen(ts)}`;
      } catch {
        return 'Offline';
      }
    }
    return 'Offline';
  }, [isOnline, lastSeen, formatLastSeen]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);

  const setUserTyping = useCallback((isTyping: boolean) => {
    if (!currentUserId) return;
    const ch = channelRef.current;
    if (!ch || !isSubscribedRef.current) return;
    try {
      ch.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: currentUserId,
          typing: isTyping,
        } satisfies TypingPayload,
      });
    } catch {}
  }, [currentUserId]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setLastSeen((prev) => ({ ...prev }));
    }, 15_000);

    return () => {
      window.clearInterval(ticker);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    let typingChannel: RealtimeChannel | null = null;

    try {
      typingChannel = supabase.channel(`${typingChannelName}-${currentUserId}`);
      channelRef.current = typingChannel;
      isSubscribedRef.current = false;

      const handleTypingEvent = (event: { payload?: TypingPayload }) => {
        const payload = event.payload;
        if (!payload?.user_id || payload.user_id === currentUserId) return;

        setTypingUsers(prev => {
          const next = new Set(prev);
          if (payload.typing) {
            next.add(payload.user_id);
          } else {
            next.delete(payload.user_id);
          }
          return next;
        });
      };

      typingChannel
        .on('broadcast', { event: 'typing' }, handleTypingEvent)
        .subscribe((status) => {
          isSubscribedRef.current = status === 'SUBSCRIBED';
        });
    } catch (err) {
      console.error('[usePresence] typing channel setup failed:', err);
      channelRef.current = null;
      isSubscribedRef.current = false;
    }

    return () => {
      isSubscribedRef.current = false;
      channelRef.current = null;
      if (typingChannel) {
        try { supabase.removeChannel(typingChannel); } catch {}
      }
    };
  }, [currentUserId, typingChannelName]);

  useEffect(() => {
    if (!currentUserId) return;

    const profilesChannel = supabase
      .channel(`profiles-last-seen-${currentUserId}`)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload: any) => {
          const row = payload?.new;
          if (!row?.id || !row?.last_seen) return;
          setLastSeen(prev => ({ ...prev, [row.id]: row.last_seen }));
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(profilesChannel); } catch {}
    };
  }, [currentUserId]);

  return {
    isOnline,
    isTyping,
    getLastSeen,
    setUserTyping,
    // Allow seeding last_seen from DB fetch when presence isn't available
    setExternalLastSeen: (userId: string, isoTimestamp?: string) => {
      if (!userId || !isoTimestamp) return;
      setLastSeen(prev => ({ ...prev, [userId]: isoTimestamp }));
    },
  };
}
