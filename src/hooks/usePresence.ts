import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  // Check if a user is online
  const isOnline = useCallback((userId: string) => {
    return onlineUserIds.has(userId);
  }, [onlineUserIds]);

  // Get formatted last seen time
  const getLastSeen = useCallback((userId: string) => {
    if (isOnline(userId)) return 'Online now';
    return lastSeen[userId] ? `Last seen ${formatLastSeen(lastSeen[userId])}` : 'Offline';
  }, [isOnline, lastSeen, formatLastSeen]);

  // Set typing status for current user
  const setUserTyping = useCallback((isTyping: boolean) => {
    if (!currentUserId) return;
    
    const channel = supabase.channel(channelName);
    channel.subscribe(() => {
      channel.track({
        user_id: currentUserId,
        typing: isTyping,
        last_seen: new Date().toISOString()
      } as PresencePayload);
    });
  }, [channelName, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

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
          await channel.track({
            user_id: currentUserId,
            typing: false,
            last_seen: new Date().toISOString()
          } as PresencePayload);
        }
      });

    // Set up heartbeat to update last_seen every 30s
    const heartbeat = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        await channel.track({
          user_id: currentUserId,
          typing: false,
          last_seen: new Date().toISOString()
        } as PresencePayload);
      }
    }, 30000);

    // Cleanup
    return () => {
      clearInterval(heartbeat);
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
  };
}
