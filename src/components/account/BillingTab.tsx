
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { CreditCard, Calendar, History } from 'lucide-react';

export function BillingTab() {
  const { language } = useTheme();
  
  // These will be connected to backend later
  const planName = "";
  const subscriptionStatus = "";
  const nextBillingDate = "";
  const billingStartDate = "";
  const isMonthlyPlan = true; // This will come from backend
  const paymentHistory = []; // This will come from backend

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
          {isMonthlyPlan ? (
            <Button 
              className="w-full sm:w-auto"
              onClick={() => {
                // Will be connected to PayPal later
                console.log('Upgrade to yearly plan');
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
          {paymentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("noPaymentHistory", language)}
            </p>
          ) : (
            <div className="space-y-2">
              {/* This structure will be populated later from Supabase */}
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">{t("amount", language)}</span>
                <span className="font-medium">{t("date", language)}</span>
              </div>
              {/* Payment items will be mapped here */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
