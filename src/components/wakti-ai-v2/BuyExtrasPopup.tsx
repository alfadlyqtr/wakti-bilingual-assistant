
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { Coins, Search, Zap, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BuyExtrasPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyExtrasPopup({ open, onOpenChange }: BuyExtrasPopupProps) {
  const { language } = useTheme();
  const { 
    userSearchQuota,
    purchaseExtraSearches,
    MAX_MONTHLY_ADVANCED_SEARCHES,
    MAX_MONTHLY_REGULAR_SEARCHES
  } = useExtendedQuotaManagement(language);

  const [isSearchPurchasing, setIsSearchPurchasing] = useState(false);

  const handlePurchaseSearches = async () => {
    setIsSearchPurchasing(true);
    try {
      const success = await purchaseExtraSearches(50); // 50 extra searches for 10 QAR
      if (success) {
        toast.success(language === 'ar' ? 'تم شراء 50 بحث إضافي بنجاح!' : 'Successfully purchased 50 extra searches!');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error purchasing searches:', error);
      toast.error(language === 'ar' ? 'فشل في الشراء' : 'Purchase failed');
    } finally {
      setIsSearchPurchasing(false);
    }
  };

  const getSearchQuotaStatus = () => {
    const regularUsed = userSearchQuota.regular_search_count;
    const advancedUsed = userSearchQuota.daily_count;
    const extraSearches = userSearchQuota.extra_searches;

    return {
      regularRemaining: Math.max(0, MAX_MONTHLY_REGULAR_SEARCHES - regularUsed),
      advancedRemaining: Math.max(0, MAX_MONTHLY_ADVANCED_SEARCHES - advancedUsed),
      extraSearches
    };
  };

  const quotaStatus = getSearchQuotaStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            {language === 'ar' ? 'شراء إضافات' : 'Buy Extras'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Quota Status */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {language === 'ar' ? 'حصتك الحالية' : 'Your Current Quota'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'البحث العادي:' : 'Regular Search:'}</span>
                <span className="font-medium">
                  {quotaStatus.regularRemaining}/{MAX_MONTHLY_REGULAR_SEARCHES} {language === 'ar' ? 'متبقي' : 'remaining'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'البحث المتقدم:' : 'Advanced Search:'}</span>
                <span className="font-medium">
                  {quotaStatus.advancedRemaining}/{MAX_MONTHLY_ADVANCED_SEARCHES} {language === 'ar' ? 'متبقي' : 'remaining'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'البحثات الإضافية:' : 'Extra Searches:'}</span>
                <span className="font-medium text-blue-600">
                  {quotaStatus.extraSearches} {language === 'ar' ? 'متوفر' : 'available'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Options */}
          <div className="space-y-3">
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-500" />
                  {language === 'ar' ? 'بحثات إضافية' : 'Extra Searches'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' 
                    ? 'احصل على 50 بحث إضافي (عادي ومتقدم) صالح لمدة شهر واحد'
                    : 'Get 50 extra searches (regular and advanced) valid for 1 month'
                  }
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-blue-600">
                    10 {language === 'ar' ? 'ريال' : 'QAR'}
                  </div>
                  <Button 
                    onClick={handlePurchaseSearches}
                    disabled={isSearchPurchasing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSearchPurchasing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {language === 'ar' ? 'جاري الشراء...' : 'Purchasing...'}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'شراء الآن' : 'Buy Now'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {language === 'ar' 
              ? 'جميع الإضافات صالحة لمدة 30 يوماً من تاريخ الشراء'
              : 'All extras are valid for 30 days from purchase date'
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
