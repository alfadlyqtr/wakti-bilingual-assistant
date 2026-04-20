import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";

type PresencePayload = {
  user_id: string;
  typing?: boolean;
  last_seen?: string;
};

/**
 * Tracks realtime online presence of users via Supabase Realtime Presence.
 * Returns utilities for checking online status, typing indicators, and last seen timestamps.
 */
export function usePresence(currentUserId?: string | null) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});

  // Stable channel name to aggregate presence app-wide
  const channelName = useMemo(() => "online-users", []);

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

  // Consider a user online if we currently see them in the presence channel.
  // last_seen is primarily used for "last online" text, not for gating online status.
  const isOnline = useCallback((userId: string) => {
    return onlineUserIds.has(userId);
  }, [onlineUserIds]);

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

  // Item #8 Medium #9: hold the persistent presence channel in a ref so
  // setUserTyping can reuse it instead of creating/leaking a new channel on
  // every keystroke. The old code created a fresh channel + subscribe for
  // each call and never removed it, leaking one realtime channel per typing
  // tick on long chat sessions.
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);

  // Set typing status for current user
  const setUserTyping = useCallback((isTyping: boolean) => {
    if (!currentUserId) return;
    const ch = channelRef.current;
    if (!ch || !isSubscribedRef.current) return; // channel not ready yet — drop the signal rather than leak
    try {
      ch.track({
        user_id: currentUserId,
        typing: isTyping,
        last_seen: new Date().toISOString(),
      } as PresencePayload);
    } catch {
      // track() can throw if channel is in a closed/errored state — swallow silently
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });
    channelRef.current = channel;
    isSubscribedRef.current = false;

    const handlePresenceState = () => {
      const state = channel.presenceState<PresencePayload>();
      const ids = new Set<string>();
      const lastSeenTimes: Record<string, string> = {};
      
      Object.values(state).forEach((presences) => {
        presences?.forEach((presence) => {
          if (presence?.user_id) {
            ids.add(presence.user_id);
            if (presence.last_seen) {
              lastSeenTimes[presence.user_id] = presence.last_seen;
            }
          }
        });
      });
      
      setOnlineUserIds(ids);
      setLastSeen(prev => ({ ...prev, ...lastSeenTimes }));
    };

    const handleTypingEvent = (event: { event: string; payload: { user_id: string; typing: boolean } }) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (event.payload.typing) {
          next.add(event.payload.user_id);
        } else {
          next.delete(event.payload.user_id);
        }
        return next;
      });
    };

    channel
      .on('presence', { event: 'sync' }, handlePresenceState)
      .on('presence', { event: 'join' }, handlePresenceState)
      .on('presence', { event: 'leave' }, handlePresenceState)
      .on('broadcast', { event: 'typing' }, handleTypingEvent)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          await channel.track({
            user_id: currentUserId,
            typing: false,
            last_seen: new Date().toISOString()
          } as PresencePayload);
        }
      });

    // Cleanup
    return () => {
      isSubscribedRef.current = false;
      channelRef.current = null;
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [channelName, currentUserId]);

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
