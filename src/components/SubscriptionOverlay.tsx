
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';
import { Logo3D } from '@/components/Logo3D';
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

  // Enhanced liquid glass styles with liquid light red and better contrast
  const glassStyles = theme === 'dark' ? {
    // Dark mode liquid glass
    overlayBg: 'rgba(12, 15, 20, 0.05)', // More transparent to show dashboard
    cardBg: 'rgba(18, 17, 32, 0.15)',
    cardBorder: 'rgba(233, 206, 176, 0.15)',
    textColor: '#e9ceb0',
    primaryText: '#ffffff',
    buttonBg: 'rgba(233, 206, 176, 0.12)',
    buttonBorder: 'rgba(233, 206, 176, 0.25)',
    buttonText: '#ffffff', // White text for dark mode
    buttonHoverBg: 'rgba(233, 206, 176, 0.18)',
    highlightColor: '#2d5a3d', // Dark liquid green accent
    logoutColor: '#ff6b6b', // Liquid light red
    backdropBlur: 'blur(25px)',
    textAreaBg: 'rgba(26, 26, 58, 0.05)',
    textAreaBorder: 'rgba(233, 206, 176, 0.08)'
  } : {
    // Light mode liquid glass
    overlayBg: 'rgba(252, 254, 253, 0.05)', // More transparent to show dashboard
    cardBg: 'rgba(252, 254, 253, 0.15)',
    cardBorder: 'rgba(6, 5, 65, 0.15)',
    textColor: '#060541',
    primaryText: '#060541',
    buttonBg: 'rgba(6, 5, 65, 0.12)',
    buttonBorder: 'rgba(6, 5, 65, 0.25)',
    buttonText: '#060541', // Dark blue text for light mode
    buttonHoverBg: 'rgba(6, 5, 65, 0.18)',
    highlightColor: '#2d5a3d', // Dark liquid green accent
    logoutColor: '#ff6b6b', // Liquid light red
    backdropBlur: 'blur(25px)',
    textAreaBg: 'rgba(6, 5, 65, 0.03)',
    textAreaBorder: 'rgba(6, 5, 65, 0.08)'
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${glassStyles.overlayBg} 0%, ${glassStyles.overlayBg} 100%)`,
        backdropFilter: glassStyles.backdropBlur,
        WebkitBackdropFilter: glassStyles.backdropBlur,
      }}
    >
      {/* Top Controls */}
      <div className="fixed top-4 left-0 right-0 z-10 flex justify-between items-center px-4 max-w-md mx-auto">
        {/* Logout Button with liquid light red 3D effect */}
        <div
          className="px-4 py-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            background: `linear-gradient(135deg, ${glassStyles.logoutColor}90, ${glassStyles.logoutColor}70)`,
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: `2px solid ${glassStyles.logoutColor}60`,
            boxShadow: `
              0 8px 32px rgba(255, 107, 107, 0.3),
              0 4px 16px rgba(255, 107, 107, 0.2),
              inset 0 2px 0 rgba(255, 255, 255, 0.3),
              inset 0 -2px 0 rgba(0, 0, 0, 0.1)
            `,
          }}
        >
          <button
            onClick={handleLogout}
            className="flex items-center text-white font-medium"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'خروج' : 'Logout'}
          </button>
        </div>

        {/* Language Toggle */}
        <ThemeLanguageToggle />
      </div>

      {/* Main Liquid Glass Card */}
      <Card 
        className="w-full max-w-md mx-auto relative z-10 border-0 shadow-none"
        style={{
          background: `linear-gradient(135deg, ${glassStyles.cardBg} 0%, ${glassStyles.cardBg}90 50%, ${glassStyles.cardBg} 100%)`,
          backdropFilter: glassStyles.backdropBlur,
          WebkitBackdropFilter: glassStyles.backdropBlur,
          border: `1px solid ${glassStyles.cardBorder}`,
          borderRadius: '24px',
          boxShadow: `
            0 32px 64px rgba(0, 0, 0, 0.1),
            0 16px 32px rgba(0, 0, 0, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1)
          `,
        }}
      >
        <CardContent className="p-8 text-center space-y-6">
          {/* App Logo and Welcome Header */}
          <div className="space-y-4">
            {/* Proper 3D App Logo */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Logo3D size="lg" className="drop-shadow-lg" />
                <Sparkles 
                  className="absolute -top-2 -right-2 h-6 w-6" 
                  style={{ color: glassStyles.highlightColor }} 
                />
              </div>
            </div>
            
            <h1 
              className="text-2xl font-bold" 
              style={{ color: glassStyles.primaryText }}
            >
              {t("welcomeToWakti", language)}
            </h1>
            
            <p 
              className="text-sm font-medium" 
              style={{ color: glassStyles.highlightColor }}
            >
              {t("thankYouMessage", language)}
            </p>
          </div>

          {/* Clean Description Text Area */}
          <div 
            className="rounded-lg p-4"
            style={{
              background: `linear-gradient(135deg, ${glassStyles.textAreaBg} 0%, ${glassStyles.textAreaBg}80 100%)`,
              border: `1px solid ${glassStyles.textAreaBorder}`,
            }}
          >
            <p 
              className="text-sm leading-relaxed" 
              style={{ color: glassStyles.textColor }}
            >
              {t("subscriptionRequired", language)}
            </p>
          </div>

          {/* 3D Subscribe Buttons with pressable effect */}
          <div className="space-y-4">
            {/* Monthly Plan - 3D Pressable Button */}
            <button
              onClick={() => handleSubscribe(monthlyPlanUrl)}
              className="w-full h-14 text-base font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.95] group relative"
              style={{
                background: `linear-gradient(135deg, ${glassStyles.buttonBg} 0%, ${glassStyles.buttonHoverBg} 50%, ${glassStyles.buttonBg} 100%)`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `2px solid ${glassStyles.buttonBorder}`,
                borderRadius: '16px',
                color: glassStyles.buttonText,
                boxShadow: `
                  0 8px 32px rgba(0, 0, 0, 0.15),
                  0 4px 16px rgba(0, 0, 0, 0.1),
                  inset 0 2px 0 rgba(255, 255, 255, 0.2),
                  inset 0 -2px 0 rgba(0, 0, 0, 0.1),
                  0 0 0 1px ${glassStyles.buttonBorder}60
                `,
                transform: 'translateZ(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) translateZ(0)';
                e.currentTarget.style.boxShadow = `
                  0 12px 48px rgba(0, 0, 0, 0.2),
                  0 6px 24px rgba(0, 0, 0, 0.15),
                  inset 0 3px 0 rgba(255, 255, 255, 0.3),
                  inset 0 -3px 0 rgba(0, 0, 0, 0.15),
                  0 0 0 2px ${glassStyles.buttonBorder}80
                `;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) translateZ(0)';
                e.currentTarget.style.boxShadow = `
                  0 8px 32px rgba(0, 0, 0, 0.15),
                  0 4px 16px rgba(0, 0, 0, 0.1),
                  inset 0 2px 0 rgba(255, 255, 255, 0.2),
                  inset 0 -2px 0 rgba(0, 0, 0, 0.1),
                  0 0 0 1px ${glassStyles.buttonBorder}60
                `;
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(1px) translateZ(0)';
                e.currentTarget.style.boxShadow = `
                  0 4px 16px rgba(0, 0, 0, 0.2),
                  0 2px 8px rgba(0, 0, 0, 0.15),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) translateZ(0)';
                e.currentTarget.style.boxShadow = `
                  0 12px 48px rgba(0, 0, 0, 0.2),
                  0 6px 24px rgba(0, 0, 0, 0.15),
                  inset 0 3px 0 rgba(255, 255, 255, 0.3),
                  inset 0 -3px 0 rgba(0, 0, 0, 0.15),
                  0 0 0 2px ${glassStyles.buttonBorder}80
                `;
              }}
            >
              <div className="flex items-center justify-center">
                <Star className="h-5 w-5 mr-2" style={{ color: glassStyles.highlightColor }} />
                {t("subscribeMonthly", language)}
              </div>
            </button>

            {/* Yearly Plan with Best Value Badge - 3D Pressable Button */}
            <div className="relative">
              <button
                onClick={() => handleSubscribe(yearlyPlanUrl)}
                className="w-full h-14 text-base font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.95] group relative"
                style={{
                  background: `linear-gradient(135deg, ${glassStyles.buttonBg} 0%, ${glassStyles.buttonHoverBg} 50%, ${glassStyles.buttonBg} 100%)`,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: `2px solid ${glassStyles.buttonBorder}`,
                  borderRadius: '16px',
                  color: glassStyles.buttonText,
                  boxShadow: `
                    0 8px 32px rgba(0, 0, 0, 0.15),
                    0 4px 16px rgba(0, 0, 0, 0.1),
                    inset 0 2px 0 rgba(255, 255, 255, 0.2),
                    inset 0 -2px 0 rgba(0, 0, 0, 0.1),
                    0 0 0 1px ${glassStyles.buttonBorder}60
                  `,
                  transform: 'translateZ(0)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) translateZ(0)';
                  e.currentTarget.style.boxShadow = `
                    0 12px 48px rgba(0, 0, 0, 0.2),
                    0 6px 24px rgba(0, 0, 0, 0.15),
                    inset 0 3px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -3px 0 rgba(0, 0, 0, 0.15),
                    0 0 0 2px ${glassStyles.buttonBorder}80
                  `;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) translateZ(0)';
                  e.currentTarget.style.boxShadow = `
                    0 8px 32px rgba(0, 0, 0, 0.15),
                    0 4px 16px rgba(0, 0, 0, 0.1),
                    inset 0 2px 0 rgba(255, 255, 255, 0.2),
                    inset 0 -2px 0 rgba(0, 0, 0, 0.1),
                    0 0 0 1px ${glassStyles.buttonBorder}60
                  `;
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(1px) translateZ(0)';
                  e.currentTarget.style.boxShadow = `
                    0 4px 16px rgba(0, 0, 0, 0.2),
                    0 2px 8px rgba(0, 0, 0, 0.15),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                  `;
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) translateZ(0)';
                  e.currentTarget.style.boxShadow = `
                    0 12px 48px rgba(0, 0, 0, 0.2),
                    0 6px 24px rgba(0, 0, 0, 0.15),
                    inset 0 3px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -3px 0 rgba(0, 0, 0, 0.15),
                    0 0 0 2px ${glassStyles.buttonBorder}80
                  `;
                }}
              >
                <div className="flex items-center justify-center">
                  <Sparkles className="h-5 w-5 mr-2" style={{ color: glassStyles.highlightColor }} />
                  {t("subscribeYearly", language)}
                </div>
              </button>
              
              {/* Best Value Badge with liquid glass effect */}
              <div 
                className="absolute -top-2 -right-2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg transform rotate-12"
                style={{ 
                  background: `linear-gradient(135deg, ${glassStyles.highlightColor} 0%, ${glassStyles.highlightColor}CC 100%)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: `1px solid ${glassStyles.highlightColor}80`,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                }}
              >
                {language === 'ar' ? 'أفضل قيمة' : 'Best Value'}
              </div>
            </div>
          </div>

          {/* Clean Footer Note Text Area */}
          <div 
            className="rounded-md p-3"
            style={{
              background: `linear-gradient(135deg, ${glassStyles.textAreaBg} 0%, ${glassStyles.textAreaBg}60 100%)`,
              border: `1px solid ${glassStyles.textAreaBorder}`,
            }}
          >
            <p 
              className="text-xs" 
              style={{ color: glassStyles.textColor }}
            >
              {t("paypalRedirectNote", language)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
