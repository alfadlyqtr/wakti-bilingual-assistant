import { useState, useEffect } from 'react';
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

  useEffect(() => {
    // CRITICAL: Wait for auth to complete AND user to be logged in
    if (loading || !user?.id) return;

    type NotificationRow = {
      id: string;
      type: string;
      title?: string | null;
      body?: string | null;
      data?: Record<string, any> | null;
      created_at?: string | null;
    };

    // Listen for new notifications of type 'admin_gifts'
    const channel = supabase
      .channel(`gift-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_history',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new as NotificationRow;
          
          // Check if this is an admin gift notification
          if (notification.type === 'admin_gifts' && notification.data) {
            const giftData = notification.data;
            const giftType = giftData.gift_type || 'voice_credits';
            const amount = Number(giftData.amount || 0);
            const sender = String(giftData.sender || 'Wakti team');
            
            // Show the gift popup
            setCurrentGift({
              id: notification.id,
              giftType,
              amount,
              sender,
              timestamp: notification.created_at || new Date().toISOString(),
              title: notification.title || undefined,
              body: notification.body || undefined,
            });
            
            setIsPopupOpen(true);
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loading]);

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
