
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface NotificationBarsProps {
  searchConfirmationRequired: boolean;
  error: string | null;
  onSearchConfirmation: () => void;
  onDismissSearchConfirmation: () => void;
}

export function NotificationBars({
  searchConfirmationRequired,
  error,
  onSearchConfirmation,
  onDismissSearchConfirmation
}: NotificationBarsProps) {
  const { language } = useTheme();

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
              onClick={onDismissSearchConfirmation}
            >
              {language === 'ar' ? 'لا، شكراً' : 'No, Thanks'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border-b p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </>
  );
}
