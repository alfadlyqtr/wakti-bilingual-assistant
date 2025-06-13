
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { CreditCard, Calendar, History } from 'lucide-react';
import { PayPalService } from '@/services/paypalService';
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
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const data = await PayPalService.getUserSubscription();
      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
      toast.error('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setUpgrading(true);
      
      // Create subscription plan
      const { planId } = await PayPalService.createSubscriptionPlan();
      
      // Create subscription and get approval URL
      const { approvalUrl } = await PayPalService.createSubscription(planId);
      
      // Redirect to PayPal for approval
      window.location.href = approvalUrl;
      
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error('Failed to start subscription process');
    } finally {
      setUpgrading(false);
    }
  };

  // Handle return from PayPal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionId = urlParams.get('subscription_id');
    const success = urlParams.get('subscription');

    if (success === 'success' && subscriptionId) {
      handleSubscriptionSuccess(subscriptionId);
    } else if (success === 'cancelled') {
      toast.error('Subscription was cancelled');
    }
  }, []);

  const handleSubscriptionSuccess = async (subscriptionId: string) => {
    try {
      await PayPalService.completeSubscription(subscriptionId);
      toast.success('Subscription activated successfully!');
      loadSubscription(); // Reload subscription data
      
      // Clean up URL
      window.history.replaceState({}, document.title, '/account');
    } catch (error) {
      console.error('Error completing subscription:', error);
      toast.error('Failed to activate subscription');
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
  const isMonthlyPlan = subscription?.plan_name === 'Wakti Monthly';
  const isSubscribed = subscription?.is_subscribed || false;

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
            <Button 
              className="w-full sm:w-auto"
              onClick={handleSubscribe}
              disabled={upgrading}
            >
              {upgrading ? (
                language === 'ar' ? 'جاري المعالجة...' : 'Processing...'
              ) : (
                language === 'ar' ? 'اشترك الآن - 60 ريال/شهر' : 'Subscribe Now - 60 QAR/month'
              )}
            </Button>
          ) : isMonthlyPlan ? (
            <Button 
              className="w-full sm:w-auto"
              onClick={() => {
                toast.info(language === 'ar' ? 'سيتم إضافة الخطة السنوية قريباً' : 'Yearly plan coming soon');
              }}
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
