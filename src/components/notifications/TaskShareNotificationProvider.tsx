import { ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  acceptTaskContactShare,
  declineTaskContactShare,
  getPendingTaskContactShares,
  TaskContactShareRecord,
} from '@/services/taskContactShareService';
import { TaskShareNotificationPopup } from './TaskShareNotificationPopup';
import { useTheme } from '@/providers/ThemeProvider';

interface TaskShareNotificationProviderProps {
  children: ReactNode;
}

export function TaskShareNotificationProvider({ children }: TaskShareNotificationProviderProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [pendingShares, setPendingShares] = useState<TaskContactShareRecord[]>([]);
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
      getPendingTaskContactShares()
        .then((shares) => {
          if (active) setPendingShares(shares);
        })
        .catch((error) => {
          console.error('[TaskShareNotificationProvider] refresh error:', error);
        });
    };

    refresh();

    const channel = supabase
      .channel(`task-contact-shares-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tr_task_assignments',
        filter: `assignee_id=eq.${user.id}`,
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
      await acceptTaskContactShare(currentShare.id);
      setPendingShares((prev) => prev.filter((share) => share.id !== currentShare.id));
      setDismissedIds((prev) => prev.filter((id) => id !== currentShare.id));
      toast.success(isAr ? 'تمت إضافة المهمة إلى المهام المشتركة ✓' : 'Task added to Shared Tasks ✓');
    } catch (error: any) {
      console.error('[TaskShareNotificationProvider] accept error:', error);
      toast.error((isAr ? 'فشل قبول المهمة' : 'Failed to accept task') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!currentShare || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await declineTaskContactShare(currentShare.id);
      setPendingShares((prev) => prev.filter((share) => share.id !== currentShare.id));
      setDismissedIds((prev) => prev.filter((id) => id !== currentShare.id));
      toast.success(isAr ? 'تم رفض المشاركة' : 'Share declined');
    } catch (error: any) {
      console.error('[TaskShareNotificationProvider] decline error:', error);
      toast.error((isAr ? 'فشل رفض المشاركة' : 'Failed to decline share') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {children}
      <TaskShareNotificationPopup
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
