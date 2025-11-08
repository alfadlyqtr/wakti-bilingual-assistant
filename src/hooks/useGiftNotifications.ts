
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GiftNotification {
  id: string;
  giftType: 'voice_credits' | 'translation_credits';
  amount: number;
  sender: string;
  timestamp: string;
}

export function useGiftNotifications() {
  const DEV = !!(import.meta && import.meta.env && import.meta.env.DEV);
  const { user, loading } = useAuth();
  const [currentGift, setCurrentGift] = useState<GiftNotification | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  useEffect(() => {
    // CRITICAL: Wait for auth to complete AND user to be logged in
    if (loading || !user?.id) return;

    if (DEV) console.log('Gift notification system ready - setting up listener for user:', user.id);

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
          if (DEV) console.log('New notification received:', payload);
          
          const notification = payload.new;
          
          // Check if this is an admin gift notification
          if (notification.type === 'admin_gifts' && notification.data) {
            if (DEV) console.log('Gift notification detected:', notification);
            
            const giftData = notification.data;
            
            // Show the gift popup
            setCurrentGift({
              id: notification.id,
              giftType: giftData.gift_type || 'voice_credits',
              amount: giftData.amount || 0,
              sender: giftData.sender || 'Wakti Admin Team',
              timestamp: notification.sent_at
            });
            
            setIsPopupOpen(true);
          }
        }
      )
      .subscribe((status) => {
        if (DEV) console.log('Gift notification subscription status:', status);
      });

    // Cleanup
    return () => {
      if (DEV) console.log('Cleaning up gift notification listener');
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
