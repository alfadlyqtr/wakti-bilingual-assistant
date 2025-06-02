
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ShoppingCart, Languages, Search, Mic, Loader2, CheckCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuyExtrasPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyExtrasPopup({ open, onOpenChange }: BuyExtrasPopupProps) {
  const { language } = useTheme();
  const { userQuota, purchaseExtraTranslations } = useQuotaManagement(language);
  const { 
    userSearchQuota, 
    userVoiceQuota, 
    purchaseExtraSearches, 
    purchaseExtraVoiceCredits 
  } = useExtendedQuotaManagement(language);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);

  const handleTranslatorPurchase = async () => {
    setIsPurchasing('translator');
    try {
      const success = await purchaseExtraTranslations(100);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsPurchasing(null);
    }
  };

  const handleSearchPurchase = async () => {
    setIsPurchasing('search');
    try {
      const success = await purchaseExtraSearches(50);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsPurchasing(null);
    }
  };

  const handleVoicePurchase = async () => {
    setIsPurchasing('voice');
    try {
      const success = await purchaseExtraVoiceCredits(5000);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsPurchasing(null);
    }
  };

  const purchaseOptions = [
    {
      id: 'translator',
      icon: Languages,
      title: language === 'ar' ? 'ترجمات إضافية' : 'Extra Translations',
      quota: language === 'ar' ? '100 ترجمة' : '100 translations',
      price: '10 QAR',
      validity: language === 'ar' ? 'صالحة لشهر واحد' : 'Valid for 1 month',
      available: true,
      current: userQuota.extra_translations,
      remaining: language === 'ar' ? `${userQuota.extra_translations} متبقي` : `${userQuota.extra_translations} remaining`,
      onPurchase: handleTranslatorPurchase,
      color: 'from-rose-500 to-pink-500'
    },
    {
      id: 'search',
      icon: Zap,
      title: language === 'ar' ? 'بحث متقدم' : 'Advanced Search Boost',
      quota: language === 'ar' ? '50 بحث متقدم' : '50 advanced searches',
      price: '10 QAR',
      validity: language === 'ar' ? 'صالحة لشهر واحد' : 'Valid for 1 month',
      available: true,
      current: userSearchQuota.extra_searches,
      remaining: language === 'ar' ? `${userSearchQuota.extra_searches} متبقي` : `${userSearchQuota.extra_searches} remaining`,
      onPurchase: handleSearchPurchase,
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'voice',
      icon: Mic,
      title: language === 'ar' ? 'أصوات إضافية' : 'Extra Voice Credits',
      quota: language === 'ar' ? '5,000 حرف' : '5,000 characters',
      price: '10 QAR',
      validity: language === 'ar' ? 'صالحة لشهر واحد' : 'Valid for 1 month',
      available: true,
      current: userVoiceQuota.extra_characters,
      remaining: language === 'ar' ? `${userVoiceQuota.extra_characters} متبقي` : `${userVoiceQuota.extra_characters} remaining`,
      onPurchase: handleVoicePurchase,
      color: 'from-purple-500 to-violet-500'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-5 w-5" />
            {language === 'ar' ? 'شراء إضافات' : 'Buy Extras'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 mt-4">
          {purchaseOptions.map((option) => (
            <Card key={option.id} className={cn(
              "transition-all duration-200 hover:shadow-md border-border"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg bg-gradient-to-r",
                      option.color
                    )}>
                      <option.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{option.title}</CardTitle>
                      {option.current > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {option.remaining}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{option.quota}</div>
                    <div className="text-xs text-muted-foreground">{option.validity}</div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-lg">{option.price}</div>
                      <div className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'شهرياً' : 'monthly'}
                      </div>
                    </div>
                    
                    <Button
                      onClick={option.onPurchase}
                      disabled={isPurchasing === option.id}
                      size="sm"
                      className="min-w-[80px]"
                    >
                      {isPurchasing === option.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        language === 'ar' ? 'شراء' : 'Buy'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground text-center">
            {language === 'ar' 
              ? 'جميع المشتريات صالحة لمدة شهر واحد من تاريخ الشراء' 
              : 'All purchases are valid for one month from purchase date'
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
