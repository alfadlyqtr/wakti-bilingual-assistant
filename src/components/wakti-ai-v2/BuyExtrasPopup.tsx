
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExtendedQuotaManagement } from '@/hooks/useExtendedQuotaManagement';
import { useQuotaManagement } from '@/hooks/useQuotaManagement';
import { Coins, Search, Zap, Loader2, CheckCircle, Mic, Languages, AlertCircle } from 'lucide-react';
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
  
  const {
    userSearchQuota,
    userVoiceQuota,
    purchaseExtraRegularSearches,
    purchaseExtraAdvancedSearches,
    purchaseExtraVoiceCredits,
    MAX_MONTHLY_ADVANCED_SEARCHES,
    MAX_MONTHLY_REGULAR_SEARCHES
  } = useExtendedQuotaManagement(language);

  const {
    userQuota: translationQuota,
    purchaseExtraTranslations,
    MAX_DAILY_TRANSLATIONS
  } = useQuotaManagement(language);
  
  const [isRegularSearchPurchasing, setIsRegularSearchPurchasing] = useState(false);
  const [isAdvancedSearchPurchasing, setIsAdvancedSearchPurchasing] = useState(false);
  const [isVoicePurchasing, setIsVoicePurchasing] = useState(false);
  const [isTranslationPurchasing, setIsTranslationPurchasing] = useState(false);

  const handlePurchaseRegularSearches = async () => {
    setIsRegularSearchPurchasing(true);
    console.log('🛒 Starting regular search purchase...');
    
    try {
      const success = await purchaseExtraRegularSearches(50);
      console.log('🛒 Regular search purchase result:', success);
      
      if (success) {
        toast.success(
          language === 'ar' 
            ? 'تم شراء 50 بحث عادي إضافي بنجاح!' 
            : 'Successfully purchased 50 extra regular searches!',
          {
            description: language === 'ar' 
              ? 'صالح لمدة 30 يوماً من تاريخ الشراء' 
              : 'Valid for 30 days from purchase date'
          }
        );
        
        // Close popup after successful purchase
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        console.error('❌ Regular search purchase failed');
        toast.error(
          language === 'ar' ? 'فشل في الشراء' : 'Purchase failed',
          {
            description: language === 'ar' 
              ? 'يرجى المحاولة مرة أخرى أو الاتصال بالدعم' 
              : 'Please try again or contact support'
          }
        );
      }
    } catch (error) {
      console.error('❌ Unexpected error during regular search purchase:', error);
      toast.error(
        language === 'ar' ? 'خطأ غير متوقع' : 'Unexpected error',
        {
          description: language === 'ar' 
            ? 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً' 
            : 'An unexpected error occurred, please try again later'
        }
      );
    } finally {
      setIsRegularSearchPurchasing(false);
    }
  };

  const handlePurchaseAdvancedSearches = async () => {
    setIsAdvancedSearchPurchasing(true);
    console.log('🛒 Starting advanced search purchase...');
    
    try {
      const success = await purchaseExtraAdvancedSearches(50);
      console.log('🛒 Advanced search purchase result:', success);
      
      if (success) {
        toast.success(
          language === 'ar' 
            ? 'تم شراء 50 بحث متقدم إضافي بنجاح!' 
            : 'Successfully purchased 50 extra advanced searches!',
          {
            description: language === 'ar' 
              ? 'صالح لمدة 30 يوماً من تاريخ الشراء' 
              : 'Valid for 30 days from purchase date'
          }
        );
        
        // Close popup after successful purchase
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        console.error('❌ Advanced search purchase failed');
        toast.error(
          language === 'ar' ? 'فشل في الشراء' : 'Purchase failed',
          {
            description: language === 'ar' 
              ? 'يرجى المحاولة مرة أخرى أو الاتصال بالدعم' 
              : 'Please try again or contact support'
          }
        );
      }
    } catch (error) {
      console.error('❌ Unexpected error during advanced search purchase:', error);
      toast.error(
        language === 'ar' ? 'خطأ غير متوقع' : 'Unexpected error',
        {
          description: language === 'ar' 
            ? 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً' 
            : 'An unexpected error occurred, please try again later'
        }
      );
    } finally {
      setIsAdvancedSearchPurchasing(false);
    }
  };

  const handlePurchaseVoiceCredits = async () => {
    setIsVoicePurchasing(true);
    console.log('🛒 Starting voice credits purchase...');
    
    try {
      const success = await purchaseExtraVoiceCredits(5000);
      console.log('🛒 Voice credits purchase result:', success);
      
      if (success) {
        toast.success(
          language === 'ar' 
            ? 'تم شراء 5,000 حرف صوتي إضافي بنجاح!' 
            : 'Successfully purchased 5,000 extra voice characters!',
          {
            description: language === 'ar' 
              ? 'صالح لمدة 30 يوماً من تاريخ الشراء' 
              : 'Valid for 30 days from purchase date'
          }
        );
        
        // Close popup after successful purchase
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        console.error('❌ Voice credits purchase failed');
        toast.error(
          language === 'ar' ? 'فشل في الشراء' : 'Purchase failed',
          {
            description: language === 'ar' 
              ? 'يرجى المحاولة مرة أخرى أو الاتصال بالدعم' 
              : 'Please try again or contact support'
          }
        );
      }
    } catch (error) {
      console.error('❌ Unexpected error during voice credits purchase:', error);
      toast.error(
        language === 'ar' ? 'خطأ غير متوقع' : 'Unexpected error',
        {
          description: language === 'ar' 
            ? 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً' 
            : 'An unexpected error occurred, please try again later'
        }
      );
    } finally {
      setIsVoicePurchasing(false);
    }
  };

  const handlePurchaseTranslations = async () => {
    setIsTranslationPurchasing(true);
    console.log('🛒 Starting translations purchase...');
    
    try {
      const success = await purchaseExtraTranslations(150);
      console.log('🛒 Translations purchase result:', success);
      
      if (success) {
        toast.success(
          language === 'ar' 
            ? 'تم شراء 150 ترجمة إضافية بنجاح!' 
            : 'Successfully purchased 150 extra translations!',
          {
            description: language === 'ar' 
              ? 'صالح لمدة 30 يوماً من تاريخ الشراء' 
              : 'Valid for 30 days from purchase date'
          }
        );
        
        // Close popup after successful purchase
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        console.error('❌ Translations purchase failed');
        toast.error(
          language === 'ar' ? 'فشل في الشراء' : 'Purchase failed',
          {
            description: language === 'ar' 
              ? 'يرجى المحاولة مرة أخرى أو الاتصال بالدعم' 
              : 'Please try again or contact support'
          }
        );
      }
    } catch (error) {
      console.error('❌ Unexpected error during translations purchase:', error);
      toast.error(
        language === 'ar' ? 'خطأ غير متوقع' : 'Unexpected error',
        {
          description: language === 'ar' 
            ? 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً' 
            : 'An unexpected error occurred, please try again later'
        }
      );
    } finally {
      setIsTranslationPurchasing(false);
    }
  };

  const getSearchQuotaStatus = () => {
    const regularUsed = userSearchQuota.regular_search_count;
    const advancedUsed = userSearchQuota.daily_count;
    const extraRegularSearches = userSearchQuota.extra_regular_searches;
    const extraAdvancedSearches = userSearchQuota.extra_advanced_searches;
    
    return {
      regularRemaining: Math.max(0, MAX_MONTHLY_REGULAR_SEARCHES - regularUsed),
      advancedRemaining: Math.max(0, MAX_MONTHLY_ADVANCED_SEARCHES - advancedUsed),
      extraRegularSearches,
      extraAdvancedSearches
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

  const getTranslationQuotaStatus = () => {
    const used = translationQuota.daily_count;
    const extra = translationQuota.extra_translations;
    
    return {
      remaining: Math.max(0, MAX_DAILY_TRANSLATIONS - used),
      extraTranslations: extra
    };
  };

  const quotaStatus = getSearchQuotaStatus();
  const voiceStatus = getVoiceQuotaStatus();
  const translationStatus = getTranslationQuotaStatus();

  // Helper to determine if any purchase is in progress
  const anyPurchaseInProgress = isRegularSearchPurchasing || isAdvancedSearchPurchasing || isVoicePurchasing || isTranslationPurchasing;

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
          {/* Debug Info Card - Only show in development */}
          {process.env.NODE_ENV === 'development' && (
            <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-blue-500" />
                  Debug Info
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div>Search Quota: R:{userSearchQuota.regular_search_count}, A:{userSearchQuota.daily_count}</div>
                <div>Extra Searches: R:{userSearchQuota.extra_regular_searches}, A:{userSearchQuota.extra_advanced_searches}</div>
                <div>Voice: {userVoiceQuota.characters_used}/{userVoiceQuota.characters_limit} (+{userVoiceQuota.extra_characters})</div>
                <div>Translations: {translationQuota.daily_count}/{MAX_DAILY_TRANSLATIONS} (+{translationQuota.extra_translations})</div>
              </CardContent>
            </Card>
          )}

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
              <div className="flex justify-between">
                <span>{language === 'ar' ? 'الترجمات الشهرية:' : 'Monthly Translations:'}</span>
                <span className="font-medium">
                  {translationStatus.remaining}/{MAX_DAILY_TRANSLATIONS} {language === 'ar' ? 'متبقي' : 'remaining'}
                </span>
              </div>
              {quotaStatus.extraRegularSearches > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{language === 'ar' ? 'بحثات عادية إضافية:' : 'Extra Regular Searches:'}</span>
                  <span className="font-medium">+{quotaStatus.extraRegularSearches}</span>
                </div>
              )}
              {quotaStatus.extraAdvancedSearches > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{language === 'ar' ? 'بحثات متقدمة إضافية:' : 'Extra Advanced Searches:'}</span>
                  <span className="font-medium">+{quotaStatus.extraAdvancedSearches}</span>
                </div>
              )}
              {voiceStatus.extraCharacters > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{language === 'ar' ? 'أحرف صوتية إضافية:' : 'Extra Voice Characters:'}</span>
                  <span className="font-medium">+{voiceStatus.extraCharacters}</span>
                </div>
              )}
              {translationStatus.extraTranslations > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{language === 'ar' ? 'ترجمات إضافية:' : 'Extra Translations:'}</span>
                  <span className="font-medium">+{translationStatus.extraTranslations}</span>
                </div>
              )}
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
                  <Button 
                    onClick={handlePurchaseRegularSearches} 
                    disabled={isRegularSearchPurchasing || anyPurchaseInProgress} 
                    className="bg-blue-600 hover:bg-blue-700" 
                    size="sm"
                  >
                    {isRegularSearchPurchasing ? (
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
                    {isAdvancedSearchPurchasing ? (
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
                  {language === 'ar' ? 'احصل على 150 ترجمة إضافية صالحة لمدة شهر واحد' : 'Get 150 extra translations valid for 1 month'}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-orange-600">
                    10 {language === 'ar' ? 'ريال' : 'QAR'}
                  </div>
                  <Button onClick={handlePurchaseTranslations} disabled={isTranslationPurchasing} className="bg-orange-600 hover:bg-orange-700" size="sm">
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
