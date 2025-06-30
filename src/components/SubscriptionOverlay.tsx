
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, CreditCard, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Logo3D } from '@/components/Logo3D';

interface SubscriptionOverlayProps {
  onClose?: () => void;
}

export default function SubscriptionOverlay({ onClose }: SubscriptionOverlayProps) {
  const { user, profile } = useAuth();
  const { language } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFawranPayment = async (planType: 'monthly' | 'yearly') => {
    setIsProcessing(true);
    
    try {
      const amount = planType === 'yearly' ? 550 : 55;
      const planName = planType === 'yearly' ? 'Wakti Pro - Yearly' : 'Wakti Pro - Monthly';
      
      // Create Fawran payment request
      const response = await fetch('/api/fawran/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'QAR',
          planType,
          planName,
          userId: user?.id,
          userEmail: user?.email,
        }),
      });

      const data = await response.json();
      
      if (data.paymentUrl) {
        // Redirect to Fawran payment page
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('Failed to create payment session');
      }
    } catch (error) {
      console.error('Payment error:', error);
      // Handle error - show toast or error message
    } finally {
      setIsProcessing(false);
    }
  };

  // If user is already subscribed, show different content
  if (profile?.is_subscribed) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Logo3D size="sm" />
            <CardTitle className="text-green-600">
              {t("subscriptionActive", language)}
            </CardTitle>
            <CardDescription>
              {t("thankYouForSubscribing", language)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="w-4 h-4" />
                <span className="font-medium">{profile.plan_name}</span>
              </div>
              <div className="flex items-center gap-2 text-green-600 text-sm mt-1">
                <Calendar className="w-4 h-4" />
                <span>
                  {t("nextBillingDate", language)}: {
                    profile.next_billing_date ? 
                    new Date(profile.next_billing_date).toLocaleDateString() : 
                    t("notAvailable", language)
                  }
                </span>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">
              {t("continue", language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <Logo3D size="sm" />
              <CardTitle className="text-2xl mt-2">
                {t("welcomeToWakti", language)}
              </CardTitle>
              <CardDescription>
                {t("thankYouMessage", language)}
              </CardDescription>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground">
              {t("subscriptionRequired", language)}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Monthly Plan */}
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-lg">{t("monthlyPlan", language)}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-primary">55 QAR</span>
                  <span className="text-muted-foreground">/{t("month", language)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("unlimitedAI", language)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("voiceFeatures", language)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("eventManagement", language)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("taskSharing", language)}</span>
                  </li>
                </ul>
                <Button 
                  className="w-full" 
                  onClick={() => handleFawranPayment('monthly')}
                  disabled={isProcessing}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {isProcessing ? t("processing", language) : t("subscribeMonthly", language)}
                </Button>
              </CardContent>
            </Card>

            {/* Yearly Plan */}
            <Card className="relative border-primary">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">
                  {t("bestValue", language)}
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{t("yearlyPlan", language)}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-primary">550 QAR</span>
                  <span className="text-muted-foreground">/{t("year", language)}</span>
                  <div className="text-green-600 text-sm font-medium">
                    {t("save110QAR", language)}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("unlimitedAI", language)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("voiceFeatures", language)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("eventManagement", language)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("taskSharing", language)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{t("prioritySupport", language)}</span>
                  </li>
                </ul>
                <Button 
                  className="w-full" 
                  onClick={() => handleFawranPayment('yearly')}
                  disabled={isProcessing}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {isProcessing ? t("processing", language) : t("subscribeYearly", language)}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>{t("fawranRedirectNote", language)}</p>
            <p className="mt-2">{t("securePaymentNote", language)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
