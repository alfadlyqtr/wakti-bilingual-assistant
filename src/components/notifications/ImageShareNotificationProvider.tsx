import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  acceptImageShare,
  declineImageShare,
  getPendingImageShares,
  ImageShareRecord,
} from '@/services/imageShareService';
import { ImageShareNotificationPopup } from './ImageShareNotificationPopup';
import { useTheme } from '@/providers/ThemeProvider';

interface ImageShareNotificationProviderProps {
  children: ReactNode;
}

export function ImageShareNotificationProvider({ children }: ImageShareNotificationProviderProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [pendingShares, setPendingShares] = useState<ImageShareRecord[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const senderShareStatusRef = useRef<Record<string, ImageShareRecord['status']>>({});

  useEffect(() => {
    if (!user?.id) {
      setPendingShares([]);
      setDismissedIds([]);
      senderShareStatusRef.current = {};
      return;
    }

    let active = true;

    const refresh = () => {
      getPendingImageShares()
        .then((shares) => {
          if (active) setPendingShares(shares);
        })
        .catch((error) => {
          console.error('[ImageShareNotificationProvider] refresh error:', error);
        });
    };

    refresh();

    const channel = supabase
      .channel(`image-shares-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'image_shares',
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
        .from('image_shares')
        .select('id, status, image_snapshot')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[ImageShareNotificationProvider] sender seed error:', error);
        return;
      }

      if (!active) return;

      senderShareStatusRef.current = Object.fromEntries(
        ((data || []) as Pick<ImageShareRecord, 'id' | 'status'>[]).map((share) => [share.id, share.status]),
      );
    };

    seedSenderStatuses();

    const senderChannel = supabase
      .channel(`image-share-status-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'image_shares',
        filter: `sender_id=eq.${user.id}`,
      }, (payload) => {
        const share = payload.new as ImageShareRecord | null;
        if (!share?.id) return;

        const previousStatus = senderShareStatusRef.current[share.id];
        senderShareStatusRef.current[share.id] = share.status;

        if (previousStatus === share.status) return;

        const promptLabel = share.image_snapshot?.prompt || (language === 'ar' ? 'صورتك' : 'your image');

        if (share.status === 'accepted') {
          toast.success(language === 'ar'
            ? `تم قبول مشاركة الصورة: ${promptLabel}`
            : `Your shared image was accepted: ${promptLabel}`);
        }

        if (share.status === 'declined') {
          toast.error(language === 'ar'
            ? `تم رفض مشاركة الصورة: ${promptLabel}`
            : `Your shared image was declined: ${promptLabel}`);
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
      await acceptImageShare(currentShare.id);
      setPendingShares((prev) => prev.filter((share) => share.id !== currentShare.id));
      setDismissedIds((prev) => prev.filter((id) => id !== currentShare.id));
      window.dispatchEvent(new CustomEvent('wakti-saved-images-reload'));
      toast.success(isAr ? 'تم حفظ الصورة في الصور المحفوظة ✓' : 'Image saved to your Saved Images ✓');
    } catch (error: any) {
      console.error('[ImageShareNotificationProvider] accept error:', error);
      toast.error((isAr ? 'فشل حفظ الصورة' : 'Failed to save image') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!currentShare || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await declineImageShare(currentShare.id);
      setPendingShares((prev) => prev.filter((share) => share.id !== currentShare.id));
      setDismissedIds((prev) => prev.filter((id) => id !== currentShare.id));
      toast.success(isAr ? 'تم رفض المشاركة' : 'Share declined');
    } catch (error: any) {
      console.error('[ImageShareNotificationProvider] decline error:', error);
      toast.error((isAr ? 'فشل رفض المشاركة' : 'Failed to decline share') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {children}
      <ImageShareNotificationPopup
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
