
import { ReactNode } from 'react';
import { useGiftNotifications } from '@/hooks/useGiftNotifications';
import { GiftNotificationPopup } from './GiftNotificationPopup';

interface GiftNotificationProviderProps {
  children: ReactNode;
}

export function GiftNotificationProvider({ children }: GiftNotificationProviderProps) {
  const { currentGift, isPopupOpen, closeGiftPopup } = useGiftNotifications();

  return (
    <>
      {children}
      {currentGift && (
        <GiftNotificationPopup
          isOpen={isPopupOpen}
          onClose={closeGiftPopup}
          giftType={currentGift.giftType}
          amount={currentGift.amount}
          sender={currentGift.sender}
        />
      )}
    </>
  );
}
