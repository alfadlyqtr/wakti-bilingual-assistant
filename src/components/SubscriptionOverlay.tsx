
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
  const { language, theme } = useTheme();
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

  // Theme-based colors
  const colors = theme === 'dark' ? {
    background: '#121120',
    primary: '#2d2a66',
    accent: '#e9ceb0',
    success: '#3eb489',
    highlight: '#d3655a'
  } : {
    background: '#fcfefd',
    primary: '#060541',
    accent: '#e9ceb0',
    success: '#3eb489',
    highlight: '#d3655a'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dashboard Background - Minimal Overlay to Show Dashboard */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 backdrop-blur-[2px]" 
          style={{ 
            backgroundColor: theme === 'dark' 
              ? 'rgba(18, 17, 32, 0.3)' 
              : 'rgba(252, 254, 253, 0.3)' 
          }}
        />
      </div>
      
      {/* Top Controls */}
      <div className="fixed top-4 left-0 right-0 z-10 flex justify-between items-center px-4 max-w-md mx-auto">
        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-white border shadow-lg transition-all duration-300 hover:scale-105"
          style={{ 
            backgroundColor: colors.highlight,
            borderColor: colors.highlight
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'خروج' : 'Logout'}
        </Button>

        {/* Language Toggle */}
        <ThemeLanguageToggle />
      </div>

      {/* Main Subscription Card */}
      <Card 
        className="w-full max-w-md mx-auto relative z-10 border-2 shadow-2xl backdrop-blur-sm"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.primary,
          boxShadow: `0 20px 40px rgba(0,0,0,0.3)`
        }}
      >
        <CardContent className="p-8 text-center space-y-6">
          {/* Welcome Header */}
          <div className="space-y-3">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="text-5xl animate-bounce-subtle">👋</div>
                <Sparkles 
                  className="absolute -top-1 -right-1 h-6 w-6 animate-pulse" 
                  style={{ color: colors.success }} 
                />
              </div>
            </div>
            
            <h1 
              className="text-2xl font-bold" 
              style={{ color: colors.primary }}
            >
              {t("welcomeToWakti", language)}
            </h1>
            
            <p 
              className="text-sm font-medium" 
              style={{ color: colors.success }}
            >
              {t("thankYouMessage", language)}
            </p>
          </div>

          {/* Description */}
          <div 
            className="rounded-lg p-4 border"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(45, 42, 102, 0.2)' : 'rgba(6, 5, 65, 0.05)',
              borderColor: colors.accent
            }}
          >
            <p 
              className="text-sm leading-relaxed" 
              style={{ color: colors.primary }}
            >
              {t("subscriptionRequired", language)}
            </p>
          </div>

          {/* Subscription Buttons */}
          <div className="space-y-4">
            {/* Monthly Plan */}
            <Button 
              onClick={() => handleSubscribe(monthlyPlanUrl)}
              className="w-full h-14 text-base text-white border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              style={{ 
                backgroundColor: colors.primary,
                borderColor: colors.primary
              }}
              size="lg"
            >
              <Star className="h-5 w-5 mr-2" style={{ color: colors.accent }} />
              {t("subscribeMonthly", language)}
            </Button>

            {/* Yearly Plan with Best Value Badge */}
            <div className="relative">
              <Button 
                onClick={() => handleSubscribe(yearlyPlanUrl)}
                className="w-full h-14 text-base text-white border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                style={{ 
                  backgroundColor: colors.primary,
                  borderColor: colors.primary
                }}
                size="lg"
              >
                <Sparkles className="h-5 w-5 mr-2" style={{ color: colors.accent }} />
                {t("subscribeYearly", language)}
              </Button>
              
              {/* Best Value Badge - Redesigned */}
              <div 
                className="absolute -top-3 -right-3 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg transform rotate-12 animate-pulse"
                style={{ backgroundColor: colors.highlight }}
              >
                {language === 'ar' ? 'أفضل قيمة' : 'Best Value'}
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div 
            className="rounded-md p-3 border"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(233, 206, 176, 0.1)' : 'rgba(233, 206, 176, 0.2)',
              borderColor: colors.accent
            }}
          >
            <p 
              className="text-xs" 
              style={{ color: theme === 'dark' ? colors.accent : colors.primary }}
            >
              {t("paypalRedirectNote", language)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
