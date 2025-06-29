
import React from 'react';
import { useGiftNotifications } from '@/hooks/useGiftNotifications';
import { GiftNotificationPopup } from '@/components/notifications/GiftNotificationPopup';

interface GiftNotificationProviderProps {
  children: React.ReactNode;
}

export function GiftNotificationProvider({ children }: GiftNotificationProviderProps) {
  const { pendingGift, acknowledgeGift, clearPendingGift } = useGiftNotifications();

  return (
    <>
      {children}
      <GiftNotificationPopup
        isOpen={pendingGift !== null}
        giftData={pendingGift ? {
          gift_type: pendingGift.gift_type,
          amount: pendingGift.amount,
          new_balance: pendingGift.new_balance,
          sender: pendingGift.sender
        } : null}
        onClose={clearPendingGift}
        onAcknowledge={() => {
          if (pendingGift) {
            acknowledgeGift(pendingGift.id);
          }
        }}
      />
    </>
  );
}
