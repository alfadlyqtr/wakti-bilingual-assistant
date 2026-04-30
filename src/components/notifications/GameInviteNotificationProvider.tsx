import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { useNavigate } from 'react-router-dom';
import {
  acceptGameInvite,
  declineGameInvite,
  GameInviteRecord,
  getPendingGameInvites,
} from '@/services/gameInviteService';
import { GameInviteNotificationPopup } from './GameInviteNotificationPopup';

interface GameInviteNotificationProviderProps {
  children: ReactNode;
}

export function GameInviteNotificationProvider({ children }: GameInviteNotificationProviderProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const navigate = useNavigate();
  const [pendingInvites, setPendingInvites] = useState<GameInviteRecord[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const senderInviteStatusRef = useRef<Record<string, GameInviteRecord['status']>>({});

  useEffect(() => {
    if (!user?.id) {
      setPendingInvites([]);
      setDismissedIds([]);
      senderInviteStatusRef.current = {};
      return;
    }

    let active = true;

    const refresh = () => {
      getPendingGameInvites()
        .then((invites) => {
          if (active) setPendingInvites(invites);
        })
        .catch((error) => {
          console.error('[GameInviteNotificationProvider] refresh error:', error);
        });
    };

    refresh();

    const channel = supabase
      .channel(`game-invites-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_invites',
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
      senderInviteStatusRef.current = {};
      return;
    }

    let active = true;

    const seedSenderStatuses = async () => {
      const { data, error } = await (supabase as any)
        .from('game_invites')
        .select('id, status, game_type')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[GameInviteNotificationProvider] sender seed error:', error);
        return;
      }

      if (!active) return;

      senderInviteStatusRef.current = Object.fromEntries(
        ((data || []) as Pick<GameInviteRecord, 'id' | 'status'>[]).map((invite) => [invite.id, invite.status]),
      );
    };

    seedSenderStatuses();

    const senderChannel = supabase
      .channel(`game-invite-status-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_invites',
        filter: `sender_id=eq.${user.id}`,
      }, (payload) => {
        const invite = payload.new as GameInviteRecord | null;
        if (!invite?.id) return;

        const previousStatus = senderInviteStatusRef.current[invite.id];
        senderInviteStatusRef.current[invite.id] = invite.status;

        if (previousStatus === invite.status) return;

        const gameTitle = invite.game_type === 'chess'
          ? (language === 'ar' ? 'الشطرنج' : 'Chess')
          : (language === 'ar' ? 'إكس-أو' : 'Tic-Tac-Toe');

        if (invite.status === 'accepted') {
          toast.success(language === 'ar'
            ? `تم قبول دعوة ${gameTitle}`
            : `Your ${gameTitle} invite was accepted`);
        }

        if (invite.status === 'declined') {
          toast.error(language === 'ar'
            ? `تم رفض دعوة ${gameTitle}`
            : `Your ${gameTitle} invite was declined`);
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(senderChannel);
    };
  }, [language, user?.id]);

  const visibleInvites = useMemo(
    () => pendingInvites.filter((invite) => !dismissedIds.includes(invite.id)),
    [dismissedIds, pendingInvites],
  );

  const currentInvite = visibleInvites[0] ?? null;
  const isAr = language === 'ar';

  const removeInviteFromView = (inviteId: string) => {
    setDismissedIds((prev) => (prev.includes(inviteId) ? prev : [...prev, inviteId]));
    setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
  };

  const restoreInviteToView = (invite: GameInviteRecord) => {
    setDismissedIds((prev) => prev.filter((id) => id !== invite.id));
    setPendingInvites((prev) => (prev.some((row) => row.id === invite.id) ? prev : [...prev, invite]));
  };

  const handleClose = () => {
    if (!currentInvite) return;
    setDismissedIds((prev) => [...prev, currentInvite.id]);
  };

  const handleAccept = async () => {
    if (!currentInvite || isSubmitting) return;
    const invite = currentInvite;
    removeInviteFromView(invite.id);
    setIsSubmitting(true);
    try {
      const defaultName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.username as string | undefined) ||
        user?.email?.split('@')[0] ||
        (isAr ? 'لاعب' : 'Player');

      const result = await acceptGameInvite(invite.id, defaultName);
      const launchToken = `${invite.id}:${Date.now()}`;
      const inviteParams = new URLSearchParams({
        gameInviteType: result.game_type,
        gameInviteCode: result.game_code,
        gameInviteLaunch: launchToken,
      });
      navigate(`/games?${inviteParams.toString()}`, {
        state: {
          gameInviteTarget: {
            gameType: result.game_type,
            gameCode: result.game_code,
            launchToken,
          },
        },
      });
      toast.success(isAr ? 'تم قبول الدعوة ✓' : 'Invite accepted ✓');
    } catch (error: any) {
      restoreInviteToView(invite);
      console.error('[GameInviteNotificationProvider] accept error:', error);
      toast.error((isAr ? 'فشل قبول الدعوة' : 'Failed to accept invite') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!currentInvite || isSubmitting) return;
    const invite = currentInvite;
    removeInviteFromView(invite.id);
    setIsSubmitting(true);
    try {
      await declineGameInvite(invite.id);
      toast.success(isAr ? 'تم رفض الدعوة' : 'Invite declined');
    } catch (error: any) {
      restoreInviteToView(invite);
      console.error('[GameInviteNotificationProvider] decline error:', error);
      toast.error((isAr ? 'فشل رفض الدعوة' : 'Failed to decline invite') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {children}
      <GameInviteNotificationPopup
        isOpen={!!currentInvite}
        invite={currentInvite}
        onClose={handleClose}
        onAccept={handleAccept}
        onDecline={handleDecline}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
