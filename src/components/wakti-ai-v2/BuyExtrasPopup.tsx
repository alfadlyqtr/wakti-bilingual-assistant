
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { Coins, Zap, CheckCircle, Mic, Languages } from 'lucide-react';
import { toast } from 'sonner';

interface BuyExtrasPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyExtrasPopup({
  open,
  onOpenChange
}: BuyExtrasPopupProps) {
  const { language } = useTheme();
  const { userVoiceQuota, refreshVoiceQuota } = useExtendedQuotaManagement(language);
  const { 
    userQuota: translationQuota, 
    MAX_DAILY_TRANSLATIONS,
    refreshTranslationQuota 
  } = useQuotaManagement(language);

  const handlePurchaseVoiceCredits = () => {
    const voiceCreditsUrl = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=E3F4LJP2UR57A';
    window.open(voiceCreditsUrl, '_blank');
    toast.info(language === 'ar' ? 'تم فتح صفحة الدفع في نافذة جديدة. ستتم إضافة الرصيد تلقائياً بعد الدفع' : 'Payment page opened. Credits will be added automatically after payment');
    setTimeout(() => onOpenChange(false), 1500);
  };

  const handlePurchaseTranslationCredits = () => {
    const translationCreditsUrl = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=96SVWU6YWXBFL';
    window.open(translationCreditsUrl, '_blank');
    toast.info(language === 'ar' ? 'تم فتح صفحة الدفع في نافذة جديدة. ستتم إضافة الرصيد تلقائياً بعد الدفع' : 'Payment page opened. Credits will be added automatically after payment');
    setTimeout(() => onOpenChange(false), 1500);
  };

  const getVoiceQuotaStatus = () => {
    const used = userVoiceQuota.characters_used;
    const limit = userVoiceQuota.characters_limit;
    const extra = userVoiceQuota.extra_characters;
    return {
      remaining: Math.max(0, limit - used),
      extraCharacters: extra,
      total: Math.max(0, limit - used) + extra
    };
  };

  const getTranslationQuotaStatus = () => {
    const used = translationQuota.daily_count;
    const extra = translationQuota.extra_translations;
    return {
      remaining: Math.max(0, MAX_DAILY_TRANSLATIONS - used),
      extraTranslations: extra,
      total: Math.max(0, MAX_DAILY_TRANSLATIONS - used) + extra
    };
  };

  const voiceStatus = getVoiceQuotaStatus();
  const translationStatus = getTranslationQuotaStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            {language === 'ar' ? 'شراء إضافات' : 'Buy Extras'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Quota Status */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {language === 'ar' ? 'حصتك الحالية' : 'Your Current Quota'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm pt-0">
              {/* Voice Characters (for TTS/Voice Clone) */}
              <div className="text-sm">
                <span className="font-medium">
                  {language === 'ar' ? 'أحرف صوتية:' : 'Voice Characters:'} 
                </span>
                <span className="ml-2">
                  {voiceStatus.remaining.toLocaleString()}/5,000 {language === 'ar' ? 'متبقي' : 'remaining'}
                </span>
                {voiceStatus.extraCharacters > 0 && (
                  <span className="text-green-600 ml-2">
                    + {voiceStatus.extraCharacters.toLocaleString()} {language === 'ar' ? 'إضافية' : 'extra'}
                  </span>
                )}
              </div>
              
              {/* Translation Credits (for Voice Translator) */}
              <div className="text-sm">
                <span className="font-medium">
                  {language === 'ar' ? 'رصيد الترجمة:' : 'Translation Credits:'} 
                </span>
                <span className="ml-2">
                  {translationStatus.remaining}/{MAX_DAILY_TRANSLATIONS} {language === 'ar' ? 'متبقي اليوم' : 'remaining today'}
                </span>
                {translationStatus.extraTranslations > 0 && (
                  <span className="text-green-600 ml-2">
                    + {translationStatus.extraTranslations} {language === 'ar' ? 'إضافية' : 'extra'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Purchase Options */}
          <div className="space-y-3">
            {/* Voice Characters Package */}
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mic className="h-4 w-4 text-green-500" />
                  {language === 'ar' ? 'أحرف صوتية إضافية' : 'Extra Voice Characters'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' 
                    ? 'احصل على 5,000 حرف صوتي إضافي لاستخدام ميزات التحويل لصوت وتقليد الصوت' 
                    : 'Get 5,000 extra voice characters for text-to-speech and voice cloning features'
                  }
                </div>
                <div className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'صالح لمدة 30 يوماً' : 'Valid for 30 days'}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-green-600">
                    10 {language === 'ar' ? 'ريال' : 'QAR'}
                  </div>
                  <Button onClick={handlePurchaseVoiceCredits} className="bg-green-600 hover:bg-green-700" size="sm">
                    <Zap className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'شراء الآن' : 'Buy Now'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Translation Credits Package */}
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Languages className="h-4 w-4 text-blue-500" />
                  {language === 'ar' ? 'رصيد ترجمة إضافي' : 'Extra Translation Credits'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' 
                    ? 'احصل على 100 رصيد ترجمة إضافي لاستخدام المترجم الصوتي' 
                    : 'Get 100 extra translation credits for the Voice Translator feature'
                  }
                </div>
                <div className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'صالح لمدة 30 يوماً' : 'Valid for 30 days'}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-blue-600">
                    10 {language === 'ar' ? 'ريال' : 'QAR'}
                  </div>
                  <Button onClick={handlePurchaseTranslationCredits} className="bg-blue-600 hover:bg-blue-700" size="sm">
                    <Zap className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'شراء الآن' : 'Buy Now'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-xs text-muted-foreground text-center space-y-1">
            <div>
              {language === 'ar' ? 'جميع الإضافات صالحة لمدة 30 يوماً من تاريخ الشراء' : 'All extras are valid for 30 days from purchase date'}
            </div>
            <div className="text-green-600">
              {language === 'ar' ? 'سيتم إضافة الرصيد تلقائياً بعد إتمام الدفع' : 'Credits will be added automatically after payment completion'}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
