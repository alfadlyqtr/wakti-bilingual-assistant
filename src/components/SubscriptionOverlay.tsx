
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SubscriptionOverlayProps {
  onClose?: () => void;
}

export function SubscriptionOverlay({ onClose }: SubscriptionOverlayProps) {
  const { language } = useTheme();

  const handleSubscribe = (planUrl: string) => {
    window.open(planUrl, '_blank');
  };

  const monthlyPlanUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5RM543441H466435NNBGLCWA';
  const yearlyPlanUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5V753699962632454NBGLE6Y';

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl border-2">
        <CardContent className="p-8 text-center space-y-6">
          {/* Welcome Message */}
          <div className="space-y-2">
            <div className="text-4xl mb-2">👋</div>
            <h1 className="text-2xl font-bold">
              {language === 'ar' ? 'مرحباً بك في وقتي' : 'Welcome to Wakti'}
            </h1>
          </div>

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed">
            {language === 'ar' 
              ? 'للوصول إلى جميع أدوات الذكاء الاصطناعي وميزات الإنتاجية في wakti، الإنتاجية، يرجى الاشتراك:'
              : 'To access all wakti AI tools, productivity features, please subscribe below:'
            }
          </p>

          {/* Subscription Buttons */}
          <div className="space-y-3">
            {/* Monthly Plan */}
            <Button 
              onClick={() => handleSubscribe(monthlyPlanUrl)}
              className="w-full h-12 text-base"
              size="lg"
            >
              {language === 'ar' 
                ? 'اشتراك شهري – $16.50 USD ≈ 60 ريال قطري'
                : 'Subscribe Monthly – $16.50 USD ≈ 60 QAR'
              }
            </Button>

            {/* Yearly Plan */}
            <Button 
              onClick={() => handleSubscribe(yearlyPlanUrl)}
              variant="outline"
              className="w-full h-12 text-base"
              size="lg"
            >
              {language === 'ar' 
                ? 'اشتراك سنوي – $165.00 USD ≈ 600 ريال قطري'
                : 'Subscribe Yearly – $165.00 USD ≈ 600 QAR'
              }
            </Button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-muted-foreground">
            {language === 'ar'
              ? 'سيتم إعادة توجيهك إلى PayPal لإكمال عملية الدفع'
              : 'You will be redirected to PayPal to complete payment'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
