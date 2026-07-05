import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  acceptProjectShare,
  declineProjectShare,
  getPendingProjectShares,
  ProjectShareRecord,
} from '@/services/projectShareService';
import { ProjectShareNotificationPopup } from './ProjectShareNotificationPopup';
import { useTheme } from '@/providers/ThemeProvider';
import { emitEvent } from '@/utils/eventBus';

interface ProjectShareNotificationProviderProps {
  children: ReactNode;
}

export function ProjectShareNotificationProvider({ children }: ProjectShareNotificationProviderProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [pendingShares, setPendingShares] = useState<ProjectShareRecord[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const senderShareStatusRef = useRef<Record<string, ProjectShareRecord['status']>>({});

  useEffect(() => {
    if (!user?.id) {
      setPendingShares([]);
      setDismissedIds([]);
      senderShareStatusRef.current = {};
      return;
    }

    let active = true;

    const refresh = () => {
      getPendingProjectShares()
        .then((shares) => {
          if (active) setPendingShares(shares);
        })
        .catch((error) => {
          console.error('[ProjectShareNotificationProvider] refresh error:', error);
        });
    };

    refresh();

    const channel = supabase
      .channel(`project-shares-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_shares',
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
        .from('project_shares')
        .select('id, status, project_snapshot')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[ProjectShareNotificationProvider] sender seed error:', error);
        return;
      }

      if (!active) return;

      senderShareStatusRef.current = Object.fromEntries(
        ((data || []) as Pick<ProjectShareRecord, 'id' | 'status'>[]).map((share) => [share.id, share.status]),
      );
    };

    seedSenderStatuses();

    const senderChannel = supabase
      .channel(`project-share-status-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'project_shares',
        filter: `sender_id=eq.${user.id}`,
      }, (payload) => {
        const share = payload.new as ProjectShareRecord | null;
        if (!share?.id) return;

        const previousStatus = senderShareStatusRef.current[share.id];
        senderShareStatusRef.current[share.id] = share.status;

        if (previousStatus === share.status) return;

        const projectName = share.project_snapshot?.name || (language === 'ar' ? 'مشروعك' : 'your project');

        if (share.status === 'accepted') {
          toast.success(language === 'ar'
            ? `تم قبول مشاركة ${projectName}`
            : `Your shared project was accepted: ${projectName}`);
        }

        if (share.status === 'declined') {
          toast.error(language === 'ar'
            ? `تم رفض مشاركة ${projectName}`
            : `Your shared project was declined: ${projectName}`);
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
      await acceptProjectShare(currentShare.id);
      setPendingShares((prev) => prev.filter((share) => share.id !== currentShare.id));
      setDismissedIds((prev) => prev.filter((id) => id !== currentShare.id));
      emitEvent('wakti-projects-reload');
      toast.success(isAr ? 'تم إضافة المشروع إلى مشاريعك ✓' : 'Project added to your projects ✓');
    } catch (error: any) {
      console.error('[ProjectShareNotificationProvider] accept error:', error);
      const isLimitReached = typeof error?.message === 'string' && error.message.includes('PROJECT_LIMIT_REACHED');
      if (isLimitReached) {
        toast.error(isAr
          ? 'لديك 3 مشاريع بالفعل (الحد الأقصى). احذف مشروعًا للقبول.'
          : "You've reached the limit of 3 projects. Delete one to accept this share.");
      } else {
        toast.error((isAr ? 'فشل قبول المشروع' : 'Failed to accept project') + (error?.message ? `: ${error.message}` : ''));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!currentShare || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await declineProjectShare(currentShare.id);
      setPendingShares((prev) => prev.filter((share) => share.id !== currentShare.id));
      setDismissedIds((prev) => prev.filter((id) => id !== currentShare.id));
      toast.success(isAr ? 'تم رفض المشاركة' : 'Share declined');
    } catch (error: any) {
      console.error('[ProjectShareNotificationProvider] decline error:', error);
      toast.error((isAr ? 'فشل رفض المشاركة' : 'Failed to decline share') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {children}
      <ProjectShareNotificationPopup
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
