import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GiftNotification {
  id: string;
  giftType: 'voice_credits' | 'translation_credits' | 'voice_characters_monthly' | 'music_generations';
  amount: number;
  sender: string;
  timestamp: string;
  title?: string;
  body?: string;
}

export function useGiftNotifications() {
  const { user, loading } = useAuth();
  const [currentGift, setCurrentGift] = useState<GiftNotification | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [giftQueue, setGiftQueue] = useState<GiftNotification[]>([]);
  const currentGiftRef = useRef<GiftNotification | null>(null);

  useEffect(() => {
    currentGiftRef.current = currentGift;
  }, [currentGift]);

  useEffect(() => {
    if (loading || user?.id) return;
    setCurrentGift(null);
    setGiftQueue([]);
    setIsPopupOpen(false);
  }, [loading, user?.id]);

  useEffect(() => {
    if (loading || !user?.id) return;

    type GiftPopupRow = {
      id: string;
      gift_type?: string | null;
      amount?: number | string | null;
      sender?: string | null;
      title?: string | null;
      body?: string | null;
      month?: string | null;
      meta?: Record<string, any> | null;
      created_at?: string | null;
      seen_at?: string | null;
    };

    let active = true;

    const markGiftSeen = async (giftId: string) => {
      await (supabase as any)
        .from('admin_gift_popups')
        .update({ seen_at: new Date().toISOString() })
        .eq('id', giftId)
        .eq('user_id', user.id)
        .is('seen_at', null);
    };

    const toGiftNotification = (row: GiftPopupRow): GiftNotification => ({
      id: row.id,
      giftType: (row.gift_type || 'voice_credits') as GiftNotification['giftType'],
      amount: Number(row.amount || 0),
      sender: String(row.sender || 'Wakti team'),
      timestamp: row.created_at || new Date().toISOString(),
      title: row.title || undefined,
      body: row.body || undefined,
    });

    const enqueueGift = async (row: GiftPopupRow) => {
      const nextGift = toGiftNotification(row);

      setGiftQueue((prev) => {
        if (prev.some((gift) => gift.id === nextGift.id) || currentGiftRef.current?.id === nextGift.id) {
          return prev;
        }
        return [...prev, nextGift];
      });

      await markGiftSeen(nextGift.id);
    };

    const loadPendingGifts = async () => {
      const { data, error } = await (supabase as any)
        .from('admin_gift_popups')
        .select('id, gift_type, amount, sender, title, body, month, meta, created_at, seen_at')
        .eq('user_id', user.id)
        .is('seen_at', null)
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) {
        console.error('[useGiftNotifications] loadPendingGifts error:', error);
        return;
      }

      if (!active || !data?.length) return;

      for (const row of data as GiftPopupRow[]) {
        await enqueueGift(row);
      }
    };

    loadPendingGifts();

    const channel = supabase
      .channel(`gift-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_gift_popups',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const giftPopup = payload.new as GiftPopupRow;
          if (giftPopup?.id) {
            await enqueueGift(giftPopup);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, loading]);

  useEffect(() => {
    if (currentGift || giftQueue.length === 0) return;

    setCurrentGift(giftQueue[0]);
    setGiftQueue((prev) => prev.slice(1));
    setIsPopupOpen(true);
  }, [currentGift, giftQueue]);

  const closeGiftPopup = () => {
    setIsPopupOpen(false);
    setCurrentGift(null);
  };

  return {
    currentGift,
    isPopupOpen,
    closeGiftPopup
  };
}
