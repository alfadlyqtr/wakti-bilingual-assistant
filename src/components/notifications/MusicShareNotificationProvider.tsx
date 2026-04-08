import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  acceptMusicTrackShare,
  declineMusicTrackShare,
  getPendingMusicTrackShares,
  MusicTrackShare,
} from '@/services/musicShareService';
import { MusicShareNotificationPopup } from './MusicShareNotificationPopup';
import { useTheme } from '@/providers/ThemeProvider';

interface MusicShareNotificationProviderProps {
  children: ReactNode;
}

export function MusicShareNotificationProvider({ children }: MusicShareNotificationProviderProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [pendingShares, setPendingShares] = useState<MusicTrackShare[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const senderShareStatusRef = useRef<Record<string, MusicTrackShare['status']>>({});

  useEffect(() => {
    if (!user?.id) {
      setPendingShares([]);
      setDismissedIds([]);
      senderShareStatusRef.current = {};
      return;
    }

    let active = true;

    const refresh = () => {
      getPendingMusicTrackShares()
        .then((shares) => {
          if (active) setPendingShares(shares);
        })
        .catch((error) => {
          console.error('[MusicShareNotificationProvider] refresh error:', error);
        });
    };

    refresh();

    const channel = supabase
      .channel(`music-track-shares-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'music_track_shares',
        filter: `recipient_id=eq.${user.id}`,
      }, refresh)
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const handleFocus = () => refresh();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    const poll = setInterval(refresh, 30_000);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      clearInterval(poll);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      senderShareStatusRef.current = {};
      return;
    }

    let active = true;

    const seedSenderStatuses = async () => {
      const { data, error } = await (supabase as any)
        .from('music_track_shares')
        .select('id, status, track_snapshot')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[MusicShareNotificationProvider] sender seed error:', error);
        return;
      }

      if (!active) return;

      senderShareStatusRef.current = Object.fromEntries(
        ((data || []) as Pick<MusicTrackShare, 'id' | 'status'>[]).map((share) => [share.id, share.status]),
      );
    };

    seedSenderStatuses();

    const senderChannel = supabase
      .channel(`music-track-share-status-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'music_track_shares',
        filter: `sender_id=eq.${user.id}`,
      }, (payload) => {
        const share = payload.new as MusicTrackShare | null;
        if (!share?.id) return;

        const previousStatus = senderShareStatusRef.current[share.id];
        senderShareStatusRef.current[share.id] = share.status;

        if (previousStatus === share.status) return;

        const trackTitle = share.track_snapshot?.title || (language === 'ar' ? 'المقطع' : 'your track');

        if (share.status === 'accepted') {
          toast.success(language === 'ar'
            ? `تم قبول مشاركة ${trackTitle}`
            : `Your shared track was accepted: ${trackTitle}`);
        }

        if (share.status === 'declined') {
          toast.error(language === 'ar'
            ? `تم رفض مشاركة ${trackTitle}`
            : `Your shared track was declined: ${trackTitle}`);
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(senderChannel);
    };
  }, [language, user?.id]);

  const visibleShares = useMemo(
    () => pendingShares.filter((share) => !dismissedIds.includes(share.id)),
    [dismissedIds, pendingShares],
  );

  const currentShare = visibleShares[0] ?? null;
  const isAr = language === 'ar';

  const handleClose = () => {
    if (!currentShare) return;
    setDismissedIds((prev) => [...prev, currentShare.id]);
  };

  const handleAccept = async () => {
    if (!currentShare || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await acceptMusicTrackShare(currentShare.id);
      setPendingShares((prev) => prev.filter((share) => share.id !== currentShare.id));
      setDismissedIds((prev) => prev.filter((id) => id !== currentShare.id));
      window.dispatchEvent(new CustomEvent('wakti-music-tracks-reload'));
      toast.success(isAr ? 'تم حفظ المقطع في الموسيقى المحفوظة ✓' : 'Track saved to your Music ✓');
    } catch (error: any) {
      console.error('[MusicShareNotificationProvider] accept error:', error);
      toast.error((isAr ? 'فشل حفظ المقطع' : 'Failed to save track') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!currentShare || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await declineMusicTrackShare(currentShare.id);
      setPendingShares((prev) => prev.filter((share) => share.id !== currentShare.id));
      setDismissedIds((prev) => prev.filter((id) => id !== currentShare.id));
      toast.success(isAr ? 'تم رفض المشاركة' : 'Share declined');
    } catch (error: any) {
      console.error('[MusicShareNotificationProvider] decline error:', error);
      toast.error((isAr ? 'فشل رفض المشاركة' : 'Failed to decline share') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {children}
      <MusicShareNotificationPopup
        isOpen={!!currentShare}
        share={currentShare}
        onClose={handleClose}
        onAccept={handleAccept}
        onDecline={handleDecline}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
