import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [pendingShares, setPendingShares] = useState<MusicTrackShare[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setPendingShares([]);
      setDismissedIds([]);
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
      toast.success(isAr ? 'تم حفظ المقطع في الموسيقى المحفوظة' : 'Track saved to your Music tab');
      navigate('/music?subtab=editor');
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
