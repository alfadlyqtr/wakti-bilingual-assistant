
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { Coins, Zap, Loader2, CheckCircle, Mic, Languages } from 'lucide-react';
import { toast } from 'sonner';

interface BuyExtrasPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyExtrasPopup({
  open,
  onOpenChange
}: BuyExtrasPopupProps) {
  const {
    language
  } = useTheme();
  const {
    userVoiceQuota,
    purchaseExtraVoiceCredits
  } = useExtendedQuotaManagement(language);
  const {
    userQuota: translationQuota,
    purchaseExtraTranslations,
    MAX_DAILY_TRANSLATIONS
  } = useQuotaManagement(language);

  const [isVoicePurchasing, setIsVoicePurchasing] = useState(false);
  const [isTranslationPurchasing, setIsTranslationPurchasing] = useState(false);

  const handlePurchaseVoiceCredits = async () => {
    setIsVoicePurchasing(true);
    console.log('🛒 Starting voice credits purchase...');
    try {
      const success = await purchaseExtraVoiceCredits(5000);
      console.log('🛒 Voice credits purchase result:', success);
      if (success) {
        toast.success(language === 'ar' ? 'تم شراء 5,000 حرف صوتي إضافي بنجاح!' : 'Successfully purchased 5,000 extra voice characters!', {
          description: language === 'ar' ? 'صالح لمدة 30 يوماً من تاريخ الشراء' : 'Valid for 30 days from purchase date'
        });
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        console.error('❌ Voice credits purchase failed');
        toast.error(language === 'ar' ? 'فشل في الشراء' : 'Purchase failed', {
          description: language === 'ar' ? 'يرجى المحاولة مرة أخرى أو الاتصال بالدعم' : 'Please try again or contact support'
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error during voice credits purchase:', error);
      toast.error(language === 'ar' ? 'خطأ غير متوقع' : 'Unexpected error', {
        description: language === 'ar' ? 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً' : 'An unexpected error occurred, please try again later'
      });
    } finally {
      setIsVoicePurchasing(false);
    }
  };

  const handlePurchaseTranslations = async () => {
    setIsTranslationPurchasing(true);
    console.log('🛒 Starting translations purchase...');
    try {
      const success = await purchaseExtraTranslations(100);
      console.log('🛒 Translations purchase result:', success);
      if (success) {
        toast.success(language === 'ar' ? 'تم شراء 100 ترجمة إضافية بنجاح!' : 'Successfully purchased 100 extra translations!', {
          description: language === 'ar' ? 'صالح لمدة 30 يوماً من تاريخ الشراء' : 'Valid for 30 days from purchase date'
        });
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        console.error('❌ Translations purchase failed');
        toast.error(language === 'ar' ? 'فشل في الشراء' : 'Purchase failed', {
          description: language === 'ar' ? 'يرجى المحاولة مرة أخرى أو الاتصال بالدعم' : 'Please try again or contact support'
        });
      }
    } catch (error) {
      console.error('❌ Unexpected error during translations purchase:', error);
      toast.error(language === 'ar' ? 'خطأ غير متوقع' : 'Unexpected error', {
        description: language === 'ar' ? 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً' : 'An unexpected error occurred, please try again later'
      });
    } finally {
      setIsTranslationPurchasing(false);
    }
  };

  const getVoiceQuotaStatus = () => {
    const used = userVoiceQuota.characters_used;
    const limit = userVoiceQuota.characters_limit;
    const extra = userVoiceQuota.extra_characters;
    return {
      remaining: Math.max(0, limit - used),
      extraCharacters: extra
    };
  };

  const getTranslationQuotaStatus = () => {
    const used = translationQuota.daily_count;
    const extra = translationQuota.extra_translations;
    return {
      remaining: Math.max(0, MAX_DAILY_TRANSLATIONS - used),
      extraTranslations: extra
    };
  };

  const voiceStatus = getVoiceQuotaStatus();
  const translationStatus = getTranslationQuotaStatus();

  const anyPurchaseInProgress = isVoicePurchasing || isTranslationPurchasing;

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
              {/* Voice Characters */}
              <div className="text-sm">
                <span>
                  {language === 'ar' ? 'الأحرف الصوتية:' : 'Voice Characters:'} {voiceStatus.remaining}/5,000 {language === 'ar' ? 'متبقي' : 'remaining'}
                </span>
                {voiceStatus.extraCharacters > 0 && (
                  <span className="text-green-600 ml-2">
                    - {language === 'ar' ? 'إضافية:' : 'Extra:'} +{voiceStatus.extraCharacters}
                  </span>
                )}
              </div>
              
              {/* Daily Translations */}
              <div className="text-sm">
                <span>
                  {language === 'ar' ? 'الترجمات اليومية:' : 'Daily Translations:'} {translationStatus.remaining}/{MAX_DAILY_TRANSLATIONS} {language === 'ar' ? 'متبقي' : 'remaining'}
                </span>
                {translationStatus.extraTranslations > 0 && (
                  <span className="text-green-600 ml-2">
                    - {language === 'ar' ? 'إضافية:' : 'Extra:'} +{translationStatus.extraTranslations}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Purchase Options */}
          <div className="space-y-3">
            {/* Voice Credits */}
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mic className="h-4 w-4 text-green-500" />
                  {language === 'ar' ? 'أحرف صوتية إضافية' : 'Extra Voice Characters'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'احصل على 5,000 حرف صوتي إضافي صالح لمدة شهر واحد' : 'Get 5,000 extra voice characters valid for 1 month'}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-green-600">
                    10 {language === 'ar' ? 'ريال' : 'QAR'}
                  </div>
                  <Button onClick={handlePurchaseVoiceCredits} disabled={isVoicePurchasing || anyPurchaseInProgress} className="bg-green-600 hover:bg-green-700" size="sm">
                    {isVoicePurchasing ? (
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

            {/* Translation Credits */}
            <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Languages className="h-4 w-4 text-orange-500" />
                  {language === 'ar' ? 'ترجمات إضافية' : 'Extra Translations'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'احصل على 100 ترجمة إضافية صالحة لمدة شهر واحد' : 'Get 100 extra translations valid for 1 month'}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-orange-600">
                    10 {language === 'ar' ? 'ريال' : 'QAR'}
                  </div>
                  <Button onClick={handlePurchaseTranslations} disabled={isTranslationPurchasing || anyPurchaseInProgress} className="bg-orange-600 hover:bg-orange-700" size="sm">
                    {isTranslationPurchasing ? (
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
            {language === 'ar' ? 'جميع الإضافات صالحة لمدة 30 يوماً من تاريخ الشراء' : 'All extras are valid for 30 days from purchase date'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
