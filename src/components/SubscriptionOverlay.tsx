
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';
import { Logo3D } from '@/components/Logo3D';
import { LogOut, Sparkles, Star, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/utils/translations';

interface SubscriptionOverlayProps {
  onClose?: () => void;
}

export function SubscriptionOverlay({ onClose }: SubscriptionOverlayProps) {
  const { language, theme } = useTheme();
  const { signOut } = useAuth();
  
  // Currency state - default to USD for English, QAR for Arabic
  const [currency, setCurrency] = useState<'USD' | 'QAR'>(language === 'ar' ? 'QAR' : 'USD');

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

  // Get pricing text based on currency and language
  const getMonthlyPricing = () => {
    if (currency === 'USD') {
      return language === 'ar' ? 'اشتراك شهري - 16 دولار' : 'Monthly Plan - $16 USD';
    } else {
      return language === 'ar' ? 'اشتراك شهري - 60 ريال' : 'Monthly Plan - 60 QAR';
    }
  };

  const getYearlyPricing = () => {
    if (currency === 'USD') {
      return language === 'ar' ? 'اشتراك سنوي - 165 دولار' : 'Yearly Plan - $165 USD';
    } else {
      return language === 'ar' ? 'اشتراك سنوي - 600 ريال' : 'Yearly Plan - 600 QAR';
    }
  };

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
    buttonText: '#1a1a3a', // Dark navy text for light mode
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

          {/* Currency Toggle */}
          <div className="flex justify-center">
            <div
              className="flex p-1 rounded-full transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${glassStyles.buttonBg} 0%, ${glassStyles.buttonHoverBg} 100%)`,
                backdropFilter: 'blur(15px)',
                WebkitBackdropFilter: 'blur(15px)',
                border: `1px solid ${glassStyles.buttonBorder}`,
                boxShadow: `
                  0 8px 32px rgba(0, 0, 0, 0.1),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2)
                `,
              }}
            >
              <button
                onClick={() => setCurrency('USD')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  currency === 'USD' ? 'scale-105' : 'scale-100'
                }`}
                style={{
                  background: currency === 'USD' 
                    ? `linear-gradient(135deg, ${glassStyles.highlightColor} 0%, ${glassStyles.highlightColor}CC 100%)`
                    : 'transparent',
                  color: currency === 'USD' ? '#ffffff' : glassStyles.buttonText,
                  boxShadow: currency === 'USD' 
                    ? `0 4px 16px ${glassStyles.highlightColor}40, inset 0 1px 0 rgba(255, 255, 255, 0.3)`
                    : 'none',
                }}
              >
                <DollarSign className="h-4 w-4" />
                USD
              </button>
              
              <button
                onClick={() => setCurrency('QAR')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  currency === 'QAR' ? 'scale-105' : 'scale-100'
                }`}
                style={{
                  background: currency === 'QAR' 
                    ? `linear-gradient(135deg, ${glassStyles.highlightColor} 0%, ${glassStyles.highlightColor}CC 100%)`
                    : 'transparent',
                  color: currency === 'QAR' ? '#ffffff' : glassStyles.buttonText,
                  boxShadow: currency === 'QAR' 
                    ? `0 4px 16px ${glassStyles.highlightColor}40, inset 0 1px 0 rgba(255, 255, 255, 0.3)`
                    : 'none',
                }}
              >
                <span className="text-xs">ر.ق</span>
                QAR
              </button>
            </div>
          </div>

          {/* Enhanced 3D Subscribe Buttons with deep shadow and glow */}
          <div className="space-y-4">
            {/* Monthly Plan - Enhanced 3D Button */}
            <button
              onClick={() => handleSubscribe(monthlyPlanUrl)}
              className="w-full h-14 text-base font-bold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] group relative overflow-hidden"
              style={{
                background: `linear-gradient(145deg, ${glassStyles.buttonBg} 0%, ${glassStyles.buttonHoverBg} 50%, ${glassStyles.buttonBg} 100%)`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `3px solid ${glassStyles.buttonBorder}`,
                borderRadius: '18px',
                color: glassStyles.buttonText,
                boxShadow: `
                  0 12px 48px rgba(0, 0, 0, 0.25),
                  0 8px 32px rgba(0, 0, 0, 0.15),
                  0 4px 16px rgba(0, 0, 0, 0.1),
                  inset 0 3px 0 rgba(255, 255, 255, 0.3),
                  inset 0 -3px 0 rgba(0, 0, 0, 0.2),
                  0 0 20px rgba(233, 206, 176, 0.3),
                  0 0 40px rgba(233, 206, 176, 0.1)
                `,
                transform: 'translateZ(0) perspective(1000px) rotateX(2deg)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) translateZ(0) perspective(1000px) rotateX(1deg)';
                e.currentTarget.style.boxShadow = `
                  0 20px 60px rgba(0, 0, 0, 0.3),
                  0 12px 40px rgba(0, 0, 0, 0.2),
                  0 6px 24px rgba(0, 0, 0, 0.15),
                  inset 0 4px 0 rgba(255, 255, 255, 0.4),
                  inset 0 -4px 0 rgba(0, 0, 0, 0.25),
                  0 0 30px rgba(233, 206, 176, 0.5),
                  0 0 60px rgba(233, 206, 176, 0.2)
                `;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) translateZ(0) perspective(1000px) rotateX(2deg)';
                e.currentTarget.style.boxShadow = `
                  0 12px 48px rgba(0, 0, 0, 0.25),
                  0 8px 32px rgba(0, 0, 0, 0.15),
                  0 4px 16px rgba(0, 0, 0, 0.1),
                  inset 0 3px 0 rgba(255, 255, 255, 0.3),
                  inset 0 -3px 0 rgba(0, 0, 0, 0.2),
                  0 0 20px rgba(233, 206, 176, 0.3),
                  0 0 40px rgba(233, 206, 176, 0.1)
                `;
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(2px) translateZ(0) perspective(1000px) rotateX(3deg)';
                e.currentTarget.style.boxShadow = `
                  0 6px 24px rgba(0, 0, 0, 0.3),
                  0 4px 16px rgba(0, 0, 0, 0.2),
                  0 2px 8px rgba(0, 0, 0, 0.15),
                  inset 0 2px 0 rgba(255, 255, 255, 0.2),
                  inset 0 -2px 0 rgba(0, 0, 0, 0.3),
                  0 0 15px rgba(233, 206, 176, 0.4)
                `;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) translateZ(0) perspective(1000px) rotateX(1deg)';
                e.currentTarget.style.boxShadow = `
                  0 20px 60px rgba(0, 0, 0, 0.3),
                  0 12px 40px rgba(0, 0, 0, 0.2),
                  0 6px 24px rgba(0, 0, 0, 0.15),
                  inset 0 4px 0 rgba(255, 255, 255, 0.4),
                  inset 0 -4px 0 rgba(0, 0, 0, 0.25),
                  0 0 30px rgba(233, 206, 176, 0.5),
                  0 0 60px rgba(233, 206, 176, 0.2)
                `;
              }}
            >
              <div className="flex items-center justify-center relative z-10">
                <Star className="h-5 w-5 mr-2" style={{ color: glassStyles.highlightColor }} />
                {getMonthlyPricing()}
              </div>
              {/* Subtle inner glow */}
              <div 
                className="absolute inset-0 rounded-[15px] opacity-20"
                style={{
                  background: `radial-gradient(circle at center, ${glassStyles.buttonBorder} 0%, transparent 70%)`
                }}
              />
            </button>

            {/* Yearly Plan with Best Value Badge - Enhanced 3D Button */}
            <div className="relative">
              <button
                onClick={() => handleSubscribe(yearlyPlanUrl)}
                className="w-full h-14 text-base font-bold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] group relative overflow-hidden"
                style={{
                  background: `linear-gradient(145deg, ${glassStyles.buttonBg} 0%, ${glassStyles.buttonHoverBg} 50%, ${glassStyles.buttonBg} 100%)`,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: `3px solid ${glassStyles.buttonBorder}`,
                  borderRadius: '18px',
                  color: glassStyles.buttonText,
                  boxShadow: `
                    0 12px 48px rgba(0, 0, 0, 0.25),
                    0 8px 32px rgba(0, 0, 0, 0.15),
                    0 4px 16px rgba(0, 0, 0, 0.1),
                    inset 0 3px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -3px 0 rgba(0, 0, 0, 0.2),
                    0 0 20px rgba(233, 206, 176, 0.3),
                    0 0 40px rgba(233, 206, 176, 0.1)
                  `,
                  transform: 'translateZ(0) perspective(1000px) rotateX(2deg)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) translateZ(0) perspective(1000px) rotateX(1deg)';
                  e.currentTarget.style.boxShadow = `
                    0 20px 60px rgba(0, 0, 0, 0.3),
                    0 12px 40px rgba(0, 0, 0, 0.2),
                    0 6px 24px rgba(0, 0, 0, 0.15),
                    inset 0 4px 0 rgba(255, 255, 255, 0.4),
                    inset 0 -4px 0 rgba(0, 0, 0, 0.25),
                    0 0 30px rgba(233, 206, 176, 0.5),
                    0 0 60px rgba(233, 206, 176, 0.2)
                  `;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) translateZ(0) perspective(1000px) rotateX(2deg)';
                  e.currentTarget.style.boxShadow = `
                    0 12px 48px rgba(0, 0, 0, 0.25),
                    0 8px 32px rgba(0, 0, 0, 0.15),
                    0 4px 16px rgba(0, 0, 0, 0.1),
                    inset 0 3px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -3px 0 rgba(0, 0, 0, 0.2),
                    0 0 20px rgba(233, 206, 176, 0.3),
                    0 0 40px rgba(233, 206, 176, 0.1)
                  `;
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(2px) translateZ(0) perspective(1000px) rotateX(3deg)';
                  e.currentTarget.style.boxShadow = `
                    0 6px 24px rgba(0, 0, 0, 0.3),
                    0 4px 16px rgba(0, 0, 0, 0.2),
                    0 2px 8px rgba(0, 0, 0, 0.15),
                    inset 0 2px 0 rgba(255, 255, 255, 0.2),
                    inset 0 -2px 0 rgba(0, 0, 0, 0.3),
                    0 0 15px rgba(233, 206, 176, 0.4)
                  `;
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) translateZ(0) perspective(1000px) rotateX(1deg)';
                  e.currentTarget.style.boxShadow = `
                    0 20px 60px rgba(0, 0, 0, 0.3),
                    0 12px 40px rgba(0, 0, 0, 0.2),
                    0 6px 24px rgba(0, 0, 0, 0.15),
                    inset 0 4px 0 rgba(255, 255, 255, 0.4),
                    inset 0 -4px 0 rgba(0, 0, 0, 0.25),
                    0 0 30px rgba(233, 206, 176, 0.5),
                    0 0 60px rgba(233, 206, 176, 0.2)
                  `;
                }}
              >
                <div className="flex items-center justify-center relative z-10">
                  <Sparkles className="h-5 w-5 mr-2" style={{ color: glassStyles.highlightColor }} />
                  {getYearlyPricing()}
                </div>
                {/* Subtle inner glow */}
                <div 
                  className="absolute inset-0 rounded-[15px] opacity-20"
                  style={{
                    background: `radial-gradient(circle at center, ${glassStyles.buttonBorder} 0%, transparent 70%)`
                  }}
                />
              </button>
              
              {/* Best Value Badge with enhanced 3D effect */}
              <div 
                className="absolute -top-2 -right-2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg transform rotate-12"
                style={{ 
                  background: `linear-gradient(135deg, ${glassStyles.highlightColor} 0%, ${glassStyles.highlightColor}CC 100%)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: `1px solid ${glassStyles.highlightColor}80`,
                  boxShadow: `
                    0 8px 32px rgba(0, 0, 0, 0.2), 
                    inset 0 1px 0 rgba(255, 255, 255, 0.3),
                    0 0 15px ${glassStyles.highlightColor}40
                  `,
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
