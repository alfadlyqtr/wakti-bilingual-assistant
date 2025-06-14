
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';
import { LogOut, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/utils/translations';

interface SubscriptionOverlayProps {
  onClose?: () => void;
}

export function SubscriptionOverlay({ onClose }: SubscriptionOverlayProps) {
  const { language } = useTheme();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success(language === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(language === 'ar' ? 'خطأ في تسجيل الخروج' : 'Logout error');
    }
  };

  const handleSubscribe = (planUrl: string) => {
    window.open(planUrl, '_blank');
    toast.info(t("paymentPageOpened", language));
  };

  const monthlyPlanUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5RM543441H466435NNBGLCWA';
  const yearlyPlanUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5V753699962632454NBGLE6Y';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Real Dashboard Background - Blurred and Faded */}
      <div className="absolute inset-0 overflow-hidden">
        {/* This captures the actual dashboard behind */}
        <div className="absolute inset-0 bg-background/10 backdrop-blur-xl opacity-30"></div>
        {/* Additional overlay for readability */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, rgba(252, 254, 253, 0.95) 0%, rgba(96, 96, 98, 0.85) 50%, rgba(252, 254, 253, 0.95) 100%)',
          backdropFilter: 'blur(20px)'
        }}></div>
      </div>
      
      {/* Top Controls */}
      <div className="fixed top-4 left-0 right-0 z-10 flex justify-between items-center px-4 max-w-md mx-auto">
        {/* Logout Button - Using exact app color #d3655a */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-white border border-opacity-50 shadow-soft transition-all duration-300"
          style={{ 
            backgroundColor: '#d3655a',
            borderColor: '#d3655a'
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'خروج' : 'Logout'}
        </Button>

        {/* Language Toggle */}
        <ThemeLanguageToggle />
      </div>

      {/* Main Subscription Card */}
      <Card className="w-full max-w-md mx-auto relative z-10 border-2 shadow-lg" style={{
        backgroundColor: '#fcfefd',
        borderColor: '#060541'
      }}>
        <CardContent className="p-8 text-center space-y-6">
          {/* Welcome Header */}
          <div className="space-y-3">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="text-5xl animate-bounce-subtle">👋</div>
                <Sparkles className="absolute -top-1 -right-1 h-6 w-6 animate-pulse" style={{ color: '#d3655a' }} />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold" style={{ color: '#060541' }}>
              {t("welcomeToWakti", language)}
            </h1>
            
            <p className="text-sm font-medium" style={{ color: '#2d7a5f' }}>
              {t("thankYouMessage", language)}
            </p>
          </div>

          {/* Description */}
          <div className="rounded-lg p-4 border" style={{
            backgroundColor: '#f8f9fa',
            borderColor: '#060541',
            opacity: 0.9
          }}>
            <p className="text-sm leading-relaxed" style={{ color: '#060541' }}>
              {t("subscriptionRequired", language)}
            </p>
          </div>

          {/* Subscription Buttons */}
          <div className="space-y-4">
            {/* Monthly Plan - Using exact app color #060541 */}
            <Button 
              onClick={() => handleSubscribe(monthlyPlanUrl)}
              className="w-full h-14 text-base text-white border transition-all duration-300 hover:scale-105"
              style={{ 
                backgroundColor: '#060541',
                borderColor: '#060541'
              }}
              size="lg"
            >
              <Star className="h-5 w-5 mr-2" style={{ color: '#e9ceb0' }} />
              {t("subscribeMonthly", language)}
            </Button>

            {/* Yearly Plan - Using exact app color #3eb489 */}
            <Button 
              onClick={() => handleSubscribe(yearlyPlanUrl)}
              variant="outline"
              className="w-full h-14 text-base text-white border-2 transition-all duration-300 hover:scale-105"
              style={{ 
                backgroundColor: '#3eb489',
                borderColor: '#3eb489'
              }}
              size="lg"
            >
              <Sparkles className="h-5 w-5 mr-2 text-white" />
              {t("subscribeYearly", language)}
            </Button>
          </div>

          {/* Footer note */}
          <div className="rounded-md p-3 border" style={{
            backgroundColor: '#f8f9fa',
            borderColor: '#e9ceb0'
          }}>
            <p className="text-xs" style={{ color: '#60606288' }}>
              {t("paypalRedirectNote", language)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
