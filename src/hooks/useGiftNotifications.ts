
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface GiftNotification {
  id: string;
  gift_type: 'voice_credits' | 'translation_credits';
  amount: number;
  new_balance: number;
  sender: string;
  timestamp: string;
}

export function useGiftNotifications() {
  const { user } = useAuth();
  const [pendingGift, setPendingGift] = useState<GiftNotification | null>(null);
  const [acknowledgedGifts, setAcknowledgedGifts] = useState<Set<string>>(new Set());

  // Load acknowledged gifts from localStorage
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`acknowledged_gifts_${user.id}`);
      if (stored) {
        try {
          const gifts = JSON.parse(stored);
          setAcknowledgedGifts(new Set(gifts));
        } catch (error) {
          console.error('Error loading acknowledged gifts:', error);
        }
      }
    }
  }, [user]);

  // Listen for new gift notifications
  useEffect(() => {
    if (!user) return;

    console.log('🎁 Setting up gift notification listener for user:', user.id);

    const channel = supabase
      .channel('gift-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_queue',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 New notification received:', payload);
          
          if (payload.new && payload.new.notification_type === 'admin_gifts') {
            const notification = payload.new;
            
            // Check if this gift has already been acknowledged
            if (!acknowledgedGifts.has(notification.id)) {
              console.log('🎁 New gift notification detected:', notification);
              
              try {
                const giftData = typeof notification.data === 'string' 
                  ? JSON.parse(notification.data) 
                  : notification.data;
                
                setPendingGift({
                  id: notification.id,
                  gift_type: giftData.gift_type,
                  amount: giftData.amount,
                  new_balance: giftData.new_balance,
                  sender: giftData.sender,
                  timestamp: notification.created_at
                });
              } catch (error) {
                console.error('Error parsing gift notification data:', error);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🎁 Cleaning up gift notification listener');
      supabase.removeChannel(channel);
    };
  }, [user, acknowledgedGifts]);

  // Acknowledge a gift (mark as seen)
  const acknowledgeGift = useCallback((giftId: string) => {
    if (!user) return;

    console.log('✅ Acknowledging gift:', giftId);
    
    const newAcknowledged = new Set(acknowledgedGifts);
    newAcknowledged.add(giftId);
    setAcknowledgedGifts(newAcknowledged);
    
    // Save to localStorage
    localStorage.setItem(
      `acknowledged_gifts_${user.id}`, 
      JSON.stringify(Array.from(newAcknowledged))
    );
    
    // Clear pending gift
    setPendingGift(null);
  }, [user, acknowledgedGifts]);

  // Clear pending gift without acknowledging
  const clearPendingGift = useCallback(() => {
    setPendingGift(null);
  }, []);

  return {
    pendingGift,
    acknowledgeGift,
    clearPendingGift,
    hasUnacknowledgedGifts: pendingGift !== null
  };
}
