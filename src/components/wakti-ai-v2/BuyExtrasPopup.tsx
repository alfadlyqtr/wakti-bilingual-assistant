import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { Coins, Search, Zap, Loader2, CheckCircle, Mic, Languages } from 'lucide-react';
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
    userSearchQuota,
    userVoiceQuota,
    purchaseExtraSearches,
    purchaseExtraVoiceCredits,
    purchaseExtraTranslations,
    MAX_MONTHLY_ADVANCED_SEARCHES,
    MAX_MONTHLY_REGULAR_SEARCHES
  } = useExtendedQuotaManagement(language);
  const [isSearchPurchasing, setIsSearchPurchasing] = useState(false);
  const [isAdvancedSearchPurchasing, setIsAdvancedSearchPurchasing] = useState(false);
  const [isVoicePurchasing, setIsVoicePurchasing] = useState(false);
  const [isTranslationPurchasing, setIsTranslationPurchasing] = useState(false);
  const handlePurchaseSearches = async () => {
    setIsSearchPurchasing(true);
    try {
      const success = await purchaseExtraSearches(50);
      if (success) {
        toast.success(language === 'ar' ? 'تم شراء 50 بحث عادي إضافي بنجاح!' : 'Successfully purchased 50 extra regular searches!');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error purchasing regular searches:', error);
      toast.error(language === 'ar' ? 'فشل في الشراء' : 'Purchase failed');
    } finally {
      setIsSearchPurchasing(false);
    }
  };
  const handlePurchaseAdvancedSearches = async () => {
    setIsAdvancedSearchPurchasing(true);
    try {
      const success = await purchaseExtraSearches(50);
      if (success) {
        toast.success(language === 'ar' ? 'تم شراء 50 بحث متقدم إضافي بنجاح!' : 'Successfully purchased 50 extra advanced searches!');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error purchasing advanced searches:', error);
      toast.error(language === 'ar' ? 'فشل في الشراء' : 'Purchase failed');
    } finally {
      setIsAdvancedSearchPurchasing(false);
    }
  };
  const handlePurchaseVoiceCredits = async () => {
    setIsVoicePurchasing(true);
    try {
      const success = await purchaseExtraVoiceCredits(5000);
      if (success) {
        toast.success(language === 'ar' ? 'تم شراء 5,000 حرف صوتي إضافي بنجاح!' : 'Successfully purchased 5,000 extra voice characters!');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error purchasing voice credits:', error);
      toast.error(language === 'ar' ? 'فشل في الشراء' : 'Purchase failed');
    } finally {
      setIsVoicePurchasing(false);
    }
  };
  const handlePurchaseTranslations = async () => {
    setIsTranslationPurchasing(true);
    try {
      const success = await purchaseExtraTranslations(100);
      if (success) {
        toast.success(language === 'ar' ? 'تم شراء 100 ترجمة إضافية بنجاح!' : 'Successfully purchased 100 extra translations!');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error purchasing translations:', error);
      toast.error(language === 'ar' ? 'فشل في الشراء' : 'Purchase failed');
    } finally {
      setIsTranslationPurchasing(false);
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
  const getVoiceQuotaStatus = () => {
    const used = userVoiceQuota.characters_used;
    const limit = userVoiceQuota.characters_limit;
    const extra = userVoiceQuota.extra_characters;
    return {
      remaining: Math.max(0, limit - used),
      extraCharacters: extra
    };
  };
  const quotaStatus = getSearchQuotaStatus();
  const voiceStatus = getVoiceQuotaStatus();
  return <Dialog open={open} onOpenChange={onOpenChange}>
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
                <span>{language === 'ar' ? 'الأحرف الصوتية:' : 'Voice Characters:'}</span>
                <span className="font-medium">
                  {voiceStatus.remaining}/5,000 {language === 'ar' ? 'متبقي' : 'remaining'}
                </span>
              </div>
              
            </CardContent>
          </Card>

          {/* Purchase Options */}
          <div className="space-y-3">
            {/* Regular Search Extras */}
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-500" />
                  {language === 'ar' ? 'بحثات عادية إضافية' : 'Extra Regular Searches'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'احصل على 50 بحث عادي إضافي صالح لمدة شهر واحد' : 'Get 50 extra regular searches valid for 1 month'}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-blue-600">
                    10 {language === 'ar' ? 'ريال' : 'QAR'}
                  </div>
                  <Button onClick={handlePurchaseSearches} disabled={isSearchPurchasing} className="bg-blue-600 hover:bg-blue-700" size="sm">
                    {isSearchPurchasing ? <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {language === 'ar' ? 'جاري الشراء...' : 'Purchasing...'}
                      </> : <>
                        <Zap className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'شراء الآن' : 'Buy Now'}
                      </>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Search Extras */}
            <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-500" />
                  {language === 'ar' ? 'بحثات متقدمة إضافية' : 'Extra Advanced Searches'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'احصل على 50 بحث متقدم إضافي صالح لمدة شهر واحد' : 'Get 50 extra advanced searches valid for 1 month'}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-purple-600">
                    10 {language === 'ar' ? 'ريال' : 'QAR'}
                  </div>
                  <Button onClick={handlePurchaseAdvancedSearches} disabled={isAdvancedSearchPurchasing} className="bg-purple-600 hover:bg-purple-700" size="sm">
                    {isAdvancedSearchPurchasing ? <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {language === 'ar' ? 'جاري الشراء...' : 'Purchasing...'}
                      </> : <>
                        <Zap className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'شراء الآن' : 'Buy Now'}
                      </>}
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                  <Button onClick={handlePurchaseVoiceCredits} disabled={isVoicePurchasing} className="bg-green-600 hover:bg-green-700" size="sm">
                    {isVoicePurchasing ? <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {language === 'ar' ? 'جاري الشراء...' : 'Purchasing...'}
                      </> : <>
                        <Zap className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'شراء الآن' : 'Buy Now'}
                      </>}
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
                  <Button onClick={handlePurchaseTranslations} disabled={isTranslationPurchasing} className="bg-orange-600 hover:bg-orange-700" size="sm">
                    {isTranslationPurchasing ? <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {language === 'ar' ? 'جاري الشراء...' : 'Purchasing...'}
                      </> : <>
                        <Zap className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'شراء الآن' : 'Buy Now'}
                      </>}
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
    </Dialog>;
}