
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { CreditCard, Calendar, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserSubscription {
  is_subscribed: boolean;
  subscription_status: string | null;
  plan_name: string | null;
  billing_start_date: string | null;
  next_billing_date: string | null;
}

export function BillingTab() {
  const { language } = useTheme();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_subscribed, subscription_status, plan_name, billing_start_date, next_billing_date')
        .maybeSingle();

      if (error) {
        console.error('Error fetching user subscription:', error);
        throw error;
      }
      
      // If no profile found, return default values
      if (!profile) {
        console.log('No profile found, returning default subscription data');
        setSubscription({
          is_subscribed: false,
          subscription_status: 'inactive',
          plan_name: null,
          billing_start_date: null,
          next_billing_date: null
        });
      } else {
        console.log('User subscription data:', profile);
        setSubscription(profile);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      toast.error('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = (planUrl: string) => {
    window.open(planUrl, '_blank');
    toast.info(language === 'ar' ? 'تم فتح صفحة الدفع في نافذة جديدة' : 'Payment page opened in new window');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const planName = subscription?.plan_name || '';
  const subscriptionStatus = subscription?.subscription_status || '';
  const nextBillingDate = formatDate(subscription?.next_billing_date);
  const billingStartDate = formatDate(subscription?.billing_start_date);
  const isMonthlyPlan = subscription?.plan_name === 'Wakti Monthly';
  const isSubscribed = subscription?.is_subscribed || false;

  const monthlyPlanUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5RM543441H466435NNBGLCWA';
  const yearlyPlanUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5V753699962632454NBGLE6Y';

  return (
    <div className="space-y-6">
      {/* Subscription Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("subscriptionInfo", language)}
          </CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'معلومات خطة الاشتراك الحالية'
              : 'Current subscription plan information'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="plan-name">{t("planName", language)}</Label>
            <Input
              id="plan-name"
              value={planName}
              readOnly
              className="bg-muted cursor-not-allowed"
              placeholder={language === 'ar' ? 'لم يتم تحديد الخطة' : 'No plan selected'}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="subscription-status">{t("subscriptionStatus", language)}</Label>
            <Input
              id="subscription-status"
              value={subscriptionStatus}
              readOnly
              className="bg-muted cursor-not-allowed"
              placeholder={language === 'ar' ? 'غير محدد' : 'Not specified'}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="next-billing">{t("nextBillingDate", language)}</Label>
            <Input
              id="next-billing"
              value={nextBillingDate}
              readOnly
              className="bg-muted cursor-not-allowed"
              placeholder={language === 'ar' ? 'غير محدد' : 'Not specified'}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="billing-start">{t("billingStartDate", language)}</Label>
            <Input
              id="billing-start"
              value={billingStartDate}
              readOnly
              className="bg-muted cursor-not-allowed"
              placeholder={language === 'ar' ? 'غير محدد' : 'Not specified'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("upgradeOptions", language)}
          </CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'خيارات ترقية خطة الاشتراك'
              : 'Subscription plan upgrade options'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSubscribed ? (
            <div className="space-y-3">
              <Button 
                className="w-full sm:w-auto"
                onClick={() => handleSubscribe(monthlyPlanUrl)}
              >
                {language === 'ar' ? 'اشترك شهرياً - $16.50 USD ≈ 60 ريال' : 'Subscribe Monthly - $16.50 USD ≈ 60 QAR'}
              </Button>
              <Button 
                variant="outline"
                className="w-full sm:w-auto ml-0 sm:ml-2"
                onClick={() => handleSubscribe(yearlyPlanUrl)}
              >
                {language === 'ar' ? 'اشترك سنوياً - $165.00 USD ≈ 600 ريال' : 'Subscribe Yearly - $165.00 USD ≈ 600 QAR'}
              </Button>
            </div>
          ) : isMonthlyPlan ? (
            <Button 
              className="w-full sm:w-auto"
              onClick={() => handleSubscribe(yearlyPlanUrl)}
            >
              {t("upgradeToYearly", language)}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("highestPlanMessage", language)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t("paymentHistory", language)}
          </CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'سجل المدفوعات والفواتير السابقة'
              : 'Previous payments and billing history'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("noPaymentHistory", language)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
