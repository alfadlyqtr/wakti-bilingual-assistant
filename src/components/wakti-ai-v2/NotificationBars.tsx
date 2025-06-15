
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface NotificationBarsProps {
  searchConfirmationRequired: boolean;
  onSearchConfirmation: () => void;
  onQuotaRefresh: () => void;
  quotaStatus?: any;
}

export function NotificationBars({
  searchConfirmationRequired,
  onSearchConfirmation,
  onQuotaRefresh,
  quotaStatus
}: NotificationBarsProps) {
  const { language } = useTheme();

  const handleDismissSearchConfirmation = () => {
    // Handle dismiss logic if needed
  };

  return (
    <>
      {/* Search Confirmation */}
      {searchConfirmationRequired && (
        <div className="bg-yellow-100 border-b p-4">
          <p className="text-sm text-yellow-800">
            {language === 'ar'
              ? 'هل تريد إجراء بحث على الإنترنت؟'
              : 'Do you want to perform an internet search?'}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={onSearchConfirmation}>
              {language === 'ar' ? 'نعم، ابحث' : 'Yes, Search'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismissSearchConfirmation}
            >
              {language === 'ar' ? 'لا، شكراً' : 'No, Thanks'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Quota Status Display */}
      {quotaStatus && quotaStatus.needs_upgrade && (
        <div className="bg-orange-100 border-b p-4">
          <p className="text-sm text-orange-800">
            {language === 'ar' 
              ? 'تم الوصول للحد الأقصى اليومي - انقر للترقية' 
              : 'Daily quota reached - Click to refresh'}
          </p>
          <div className="mt-2">
            <Button size="sm" onClick={onQuotaRefresh}>
              {language === 'ar' ? 'تحديث الحصة' : 'Refresh Quota'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
