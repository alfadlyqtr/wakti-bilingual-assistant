import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { CreditCard, Calendar, History, RefreshCw, ThumbsUp } from 'lucide-react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [showLinkPayPal, setShowLinkPayPal] = useState(false);
  const [linkPayPalId, setLinkPayPalId] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    loadSubscription();
    // eslint-disable-next-line
  }, []);

  const loadSubscription = async () => {
    setLoading(true);
    try {
      // 1. Try to fetch latest subscription from subscriptions table; Fallback to profiles if none.
      const { data: subRows, error: subErr } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let sub: UserSubscription | null = null;

      if (subRows && (subRows.status === "active" || subRows.status === "trialing")) {
        sub = {
          is_subscribed: subRows.status === "active" || subRows.status === "trialing",
          subscription_status: subRows.status,
          plan_name: subRows.plan_name,
          billing_start_date: subRows.start_date,
          next_billing_date: subRows.next_billing_date,
        };
      } else {
        // fallback to profiles (legacy)
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_subscribed, subscription_status, plan_name, billing_start_date, next_billing_date')
          .maybeSingle();

        if (error) {
          console.error('Error fetching user subscription:', error);
          throw error;
        }
        sub = profile
          ? {
              is_subscribed: profile.is_subscribed,
              subscription_status: profile.subscription_status,
              plan_name: profile.plan_name,
              billing_start_date: profile.billing_start_date,
              next_billing_date: profile.next_billing_date,
            }
          : {
              is_subscribed: false,
              subscription_status: 'inactive',
              plan_name: null,
              billing_start_date: null,
              next_billing_date: null,
            };
      }
      setSubscription(sub);
    } catch (error) {
      console.error('Error loading subscription:', error);
      toast.error(language === 'ar' ? 'فشل في تحميل تفاصيل الاشتراك' : 'Failed to load subscription details');
      setSubscription({
        is_subscribed: false,
        subscription_status: 'inactive',
        plan_name: null,
        billing_start_date: null,
        next_billing_date: null
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubscribe = (planUrl: string) => {
    window.open(planUrl, '_blank');
    toast.info(language === 'ar' ? 'تم فتح صفحة الدفع في نافذة جديدة' : 'Payment page opened in new window');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSubscription();
    toast.success(language === 'ar' ? 'تم تحديث بيانات الاشتراك' : 'Subscription info refreshed');
  };

  const handleManualLink = async () => {
    if (!linkPayPalId) {
      toast.error(language === 'ar' ? 'يرجى إدخال معرف الاشتراك' : 'Please enter subscription ID');
      return;
    }
    setLinking(true);
    try {
      const res = await fetch(
        '/functions/v1/link-paypal-subscription',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await supabase.auth.getSession().then(r => r.data.session?.access_token || '')}`,
          },
          body: JSON.stringify({ paypal_subscription_id: linkPayPalId }),
        }
      );
      const result = await res.json();
      if (result.success) {
        toast.success(language === 'ar' ? 'تم ربط الاشتراك بنجاح' : 'Subscription linked successfully');
        loadSubscription();
        setShowLinkPayPal(false);
        setLinkPayPalId('');
      } else {
        toast.error(result.error || language === 'ar' ? 'فشل في ربط الاشتراك' : 'Failed to link subscription');
      }
    } catch (e) {
      toast.error(language === 'ar' ? 'فشل في ربط الاشتراك' : 'Failed to link subscription');
    } finally {
      setLinking(false);
    }
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
  const isMonthlyPlan = planName?.toLowerCase().includes('month');
  const isYearlyPlan = planName?.toLowerCase().includes('year');
  const isSubscribed = subscription?.is_subscribed || false;

  const userId = supabase.auth.user()?.id || "";

  const monthlyPlanUrl =
    'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5RM543441H466435NNBGLCWA'
    + (userId ? `&custom_id=${userId}` : '');

  const yearlyPlanUrl =
    'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5V753699962632454NBGLE6Y'
    + (userId ? `&custom_id=${userId}` : '');

  return (
    <div className="space-y-6">
      {/* Subscription Information */}
      <Card>
        <CardHeader>
          <div className="flex flex-row justify-between items-center">
            <div>
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
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
              <RefreshCw className={`h-4 w-4${refreshing ? " animate-spin" : ""} mr-1`} />
              {language === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
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
            <>
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
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-xs underline text-primary underline-offset-4"
                onClick={() => setShowLinkPayPal(true)}
              >
                {language === 'ar'
                  ? 'ربط اشتراك بايبال يدوياً'
                  : 'Link existing PayPal Subscription manually'}
              </Button>
              {showLinkPayPal && (
                <div className="my-3 space-y-2 rounded-md border bg-muted p-4">
                  <label className="block text-sm mb-1">
                    {language === 'ar'
                      ? 'ادخل معرف اشتراك PayPal'
                      : 'Enter your PayPal subscription ID'}
                  </label>
                  <input
                    className="bg-white border p-2 w-full rounded"
                    value={linkPayPalId}
                    onChange={e => setLinkPayPalId(e.target.value)}
                    placeholder="sub_xxxxxxxxxx"
                  />
                  <Button
                    className="mt-2"
                    disabled={linking}
                    onClick={handleManualLink}
                  >
                    {linking
                      ? (language === 'ar' ? 'جاري الربط...' : 'Linking...')
                      : (language === 'ar' ? 'ربط الاشتراك' : 'Link Subscription')
                    }
                  </Button>
                </div>
              )}
            </>
          ) : isMonthlyPlan ? (
            <Button 
              className="w-full sm:w-auto"
              onClick={() => handleSubscribe(yearlyPlanUrl)}
            >
              {t("upgradeToYearly", language)}
            </Button>
          ) : isYearlyPlan ? (
            <div className="flex flex-col items-center justify-center gap-2 py-3">
              <ThumbsUp className="h-8 w-8 text-green-600 dark:text-green-400 mb-1" />
              <p className="text-base font-semibold text-center">
                {language === 'ar'
                  ? 'أنت مشترك في الخطة الأعلى 👍'
                  : "You're on the highest available plan 👍"}
              </p>
            </div>
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
