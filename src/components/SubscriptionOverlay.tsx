
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

  // App-specific colors based on theme
  const colors = theme === 'dark' ? {
    cardBackground: '#121120',
    primaryText: '#e9ceb0',
    buttonBackground: '#1a1a3a', // Dark navy blue for dark mode
    buttonText: '#e9ceb0',
    buttonBorder: '#e9ceb0', // Border matches text color
    accentColor: '#e9ceb0',
    successColor: '#3eb489',
    highlightColor: '#d3655a'
  } : {
    cardBackground: '#fcfefd',
    primaryText: '#060541',
    buttonBackground: '#060541',
    buttonText: '#fcfefd',
    buttonBorder: '#060541',
    accentColor: '#e9ceb0',
    successColor: '#3eb489',
    highlightColor: '#d3655a'
  };

  // Enhanced button style with proper border radius and thickness
  const buttonStyle = {
    backgroundColor: `${colors.buttonBackground} !important`,
    color: `${colors.buttonText} !important`,
    borderColor: `${colors.buttonBorder} !important`,
    borderWidth: '3px !important',
    borderStyle: 'solid !important',
    borderRadius: '12px !important',
    background: `${colors.buttonBackground} !important`, // Override any gradients
    backgroundImage: 'none !important', // Ensure no gradients in dark mode
    boxShadow: `0 4px 8px rgba(0, 0, 0, 0.1) !important`,
    transition: 'all 0.2s ease !important'
  };

  const buttonHoverStyle = {
    transform: 'translateY(-2px)',
    boxShadow: `0 6px 12px rgba(0, 0, 0, 0.15)`
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Minimal overlay to show dashboard behind */}
      <div 
        className="absolute inset-0" 
        style={{ 
          backgroundColor: theme === 'dark' 
            ? 'rgba(18, 17, 32, 0.4)' 
            : 'rgba(252, 254, 253, 0.4)'
        }}
      />
      
      {/* Top Controls */}
      <div className="fixed top-4 left-0 right-0 z-10 flex justify-between items-center px-4 max-w-md mx-auto">
        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-white font-medium transition-all duration-300 hover:scale-105"
          style={{ 
            backgroundColor: colors.highlightColor,
            color: '#ffffff'
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
        className="w-full max-w-md mx-auto relative z-10 border-2 shadow-2xl"
        style={{
          backgroundColor: colors.cardBackground,
          borderColor: colors.accentColor,
        }}
      >
        <CardContent className="p-8 text-center space-y-6">
          {/* Welcome Header */}
          <div className="space-y-3">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="text-5xl">👋</div>
                <Sparkles 
                  className="absolute -top-1 -right-1 h-6 w-6" 
                  style={{ color: colors.successColor }} 
                />
              </div>
            </div>
            
            <h1 
              className="text-2xl font-bold" 
              style={{ color: colors.primaryText }}
            >
              {t("welcomeToWakti", language)}
            </h1>
            
            <p 
              className="text-sm font-bold" 
              style={{ color: colors.successColor }}
            >
              {t("thankYouMessage", language)}
            </p>
          </div>

          {/* Description */}
          <div 
            className="rounded-lg p-4 border-2"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(26, 26, 58, 0.3)' : 'rgba(6, 5, 65, 0.1)',
              borderColor: colors.accentColor
            }}
          >
            <p 
              className="text-sm leading-relaxed font-bold" 
              style={{ color: colors.primaryText }}
            >
              {t("subscriptionRequired", language)}
            </p>
          </div>

          {/* Subscription Buttons */}
          <div className="space-y-4">
            {/* Monthly Plan */}
            <Button 
              onClick={() => handleSubscribe(monthlyPlanUrl)}
              className="w-full h-14 text-base font-bold transition-all duration-200 hover:transform hover:-translate-y-0.5 active:translate-y-0"
              style={buttonStyle}
              size="lg"
            >
              <Star className="h-5 w-5 mr-2" style={{ color: colors.accentColor }} />
              {t("subscribeMonthly", language)}
            </Button>

            {/* Yearly Plan with Best Value Badge */}
            <div className="relative">
              <Button 
                onClick={() => handleSubscribe(yearlyPlanUrl)}
                className="w-full h-14 text-base font-bold transition-all duration-200 hover:transform hover:-translate-y-0.5 active:translate-y-0"
                style={buttonStyle}
                size="lg"
              >
                <Sparkles className="h-5 w-5 mr-2" style={{ color: colors.accentColor }} />
                {t("subscribeYearly", language)}
              </Button>
              
              {/* Best Value Badge */}
              <div 
                className="absolute -top-2 -right-2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg transform rotate-12"
                style={{ backgroundColor: colors.highlightColor }}
              >
                {language === 'ar' ? 'أفضل قيمة' : 'Best Value'}
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div 
            className="rounded-md p-3 border-2"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(233, 206, 176, 0.2)' : 'rgba(233, 206, 176, 0.3)',
              borderColor: colors.accentColor
            }}
          >
            <p 
              className="text-xs font-bold" 
              style={{ color: colors.primaryText }}
            >
              {t("paypalRedirectNote", language)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
