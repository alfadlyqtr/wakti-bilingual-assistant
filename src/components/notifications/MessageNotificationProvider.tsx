import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { sendMessage } from '@/services/messageService';
import { MessageNotificationPopup, IncomingMessagePreview } from './MessageNotificationPopup';

/**
 * Item #8 post-Batch-B: in-app popup for incoming direct messages.
 *
 * Subscribes globally (once per authenticated session) to the `messages` table
 * via Supabase Realtime, filtered by `recipient_id=eq.${user.id}`. When a new
 * row is inserted, it:
 *   1. Respects the user's `notification_preferences.message_popups` toggle
 *      (defaults to true if unset).
 *   2. Skips showing when the user is already viewing the matching chat
 *      (route `/contacts/:senderId`) so we don't interrupt active conversations.
 *   3. Skips messages already seen (dismissed) this session.
 *   4. Fetches the sender's profile (name, avatar) and opens the popup.
 *
 * The popup offers: inline Reply, Open chat (navigates to /contacts/:senderId), Close.
 *
 * No DB migration is needed — the `messages` table is already in the
 * `supabase_realtime` publication (verified Apr 2026).
 */

const MAX_PREVIEW_CHARS = 80;

interface MessageNotificationProviderProps {
  children: ReactNode;
}

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_type: 'text' | 'image' | 'voice' | 'pdf';
  content?: string | null;
  created_at: string;
};

function buildPreview(row: MessageRow, isAr: boolean): string {
  switch (row.message_type) {
    case 'voice': return isAr ? '🎤 رسالة صوتية' : '🎤 Voice message';
    case 'image': return isAr ? '🖼 صورة' : '🖼 Image';
    case 'pdf':   return isAr ? '📄 ملف PDF' : '📄 PDF file';
    case 'text':
    default: {
      const text = (row.content || '').trim();
      if (!text) return isAr ? '(رسالة فارغة)' : '(empty message)';
      return text.length > MAX_PREVIEW_CHARS
        ? text.slice(0, MAX_PREVIEW_CHARS).trimEnd() + '…'
        : text;
    }
  }
}

export function MessageNotificationProvider({ children }: MessageNotificationProviderProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [currentMessage, setCurrentMessage] = useState<IncomingMessagePreview | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Track IDs we've already shown/dismissed this session to prevent re-show on reconnect
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // Cached preference — read from profiles.notification_preferences.message_popups.
  // Defaults to true if missing. Written by NotificationSettings.
  const [popupsEnabled, setPopupsEnabled] = useState<boolean>(true);

  // Load the preference once per user session
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', user.id)
          .maybeSingle();
        if (!active) return;
        const prefs = (data?.notification_preferences as any) || {};
        // Default to true unless explicitly set to false
        setPopupsEnabled(prefs.message_popups !== false);
      } catch {
        // Ignore — stay at default (true)
      }
    })();

    // Also respond to same-tab updates (NotificationSettings dispatches no event
    // today, so listen to a custom one we can fire if desired). As a safety
    // fallback, refresh on window focus.
    const refreshOnFocus = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', user.id)
          .maybeSingle();
        if (!active) return;
        const prefs = (data?.notification_preferences as any) || {};
        setPopupsEnabled(prefs.message_popups !== false);
      } catch {}
    };
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      active = false;
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [user?.id]);

  // Track current location so we can skip popup when user is already on the chat.
  // useRef keeps the latest value readable inside the realtime callback without
  // re-subscribing the channel on every navigation.
  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

  // Main subscription
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `msg-notif-${user.id}`;

    // Defensive: remove stale channel if one exists from a previous mount
    const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existing) supabase.removeChannel(existing);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const row = payload?.new as MessageRow | undefined;
          if (!row) return;

          // Guard rails (ordered cheapest → most expensive):
          if (!popupsEnabled) return;                                     // user preference off
          if (row.sender_id === user.id) return;                          // own message echo
          if (seenMessageIdsRef.current.has(row.id)) return;              // duplicate delivery
          if (locationRef.current === `/contacts/${row.sender_id}`) return; // already viewing that chat

          // Mark as seen immediately to avoid races with rapid duplicates
          seenMessageIdsRef.current.add(row.id);

          // Fetch sender profile for name + avatar
          let senderName = '';
          let senderAvatar: string | undefined;
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username, avatar_url')
              .eq('id', row.sender_id)
              .maybeSingle();
            senderName = profile?.display_name || profile?.username || (language === 'ar' ? 'مستخدم' : 'Someone');
            senderAvatar = profile?.avatar_url || undefined;
          } catch (e) {
            console.error('[MsgPopup] Failed to fetch sender profile', e);
            senderName = language === 'ar' ? 'مستخدم' : 'Someone';
          }

          setCurrentMessage({
            messageId: row.id,
            senderId: row.sender_id,
            senderName,
            senderAvatar,
            preview: buildPreview(row, language === 'ar'),
            messageType: row.message_type,
            createdAt: row.created_at,
          });
          setIsOpen(true);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, popupsEnabled, language]);

  // Clear state when user logs out
  useEffect(() => {
    if (!user?.id) {
      setCurrentMessage(null);
      setIsOpen(false);
      seenMessageIdsRef.current.clear();
    }
  }, [user?.id]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Keep `currentMessage` in state momentarily so the exit animation can run
    window.setTimeout(() => setCurrentMessage(null), 350);
  }, []);

  const handleOpenChat = useCallback(() => {
    if (!currentMessage) return;
    const senderId = currentMessage.senderId;
    setIsOpen(false);
    window.setTimeout(() => setCurrentMessage(null), 350);
    navigate(`/contacts/${senderId}`);
  }, [currentMessage, navigate]);

  const handleSendReply = useCallback(
    async (text: string): Promise<boolean> => {
      if (!currentMessage) return false;
      try {
        await sendMessage(currentMessage.senderId, {
          message_type: 'text',
          content: text,
        });
        return true;
      } catch (error) {
        console.error('[MessageNotificationProvider] reply send failed:', error);
        return false;
      }
    },
    [currentMessage],
  );

  const popup = useMemo(
    () => (
      <MessageNotificationPopup
        isOpen={isOpen}
        message={currentMessage}
        onClose={handleClose}
        onOpenChat={handleOpenChat}
        onSendReply={handleSendReply}
      />
    ),
    [isOpen, currentMessage, handleClose, handleOpenChat, handleSendReply],
  );

  return (
    <>
      {children}
      {popup}
    </>
  );
}
