
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
      {/* Real Dashboard Background - Blurred */}
      <div className="absolute inset-0">
        <div className="w-full h-full bg-background opacity-20 blur-lg" />
        <div className="absolute inset-0 bg-background/95 backdrop-blur-md" />
      </div>
      
      {/* Top Controls */}
      <div className="fixed top-4 left-0 right-0 z-10 flex justify-between items-center px-4 max-w-md mx-auto">
        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="bg-accent-orange hover:bg-accent-orange/80 text-white border border-accent-orange/50 shadow-soft transition-all duration-300"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'خروج' : 'Logout'}
        </Button>

        {/* Language Toggle */}
        <ThemeLanguageToggle />
      </div>

      {/* Main Subscription Card */}
      <Card className="w-full max-w-md mx-auto relative z-10 bg-card border-2 border-accent-blue/30 shadow-vibrant">
        <CardContent className="p-8 text-center space-y-6">
          {/* Welcome Header */}
          <div className="space-y-3">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="text-5xl animate-bounce-subtle">👋</div>
                <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-accent-orange animate-pulse-color" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-accent-blue">
              {t("welcomeToWakti", language)}
            </h1>
            
            <p className="text-sm text-green-700 font-medium">
              {t("thankYouMessage", language)}
            </p>
          </div>

          {/* Description */}
          <div className="bg-muted/30 rounded-lg p-4 border border-accent-blue/20">
            <p className="text-sm text-foreground/80 leading-relaxed">
              {t("subscriptionRequired", language)}
            </p>
          </div>

          {/* Subscription Buttons */}
          <div className="space-y-4">
            {/* Monthly Plan */}
            <Button 
              onClick={() => handleSubscribe(monthlyPlanUrl)}
              className="w-full h-14 text-base bg-accent-blue hover:bg-accent-blue/80 text-white border border-accent-blue/30 transition-all duration-300 hover:scale-105"
              size="lg"
            >
              <Star className="h-5 w-5 mr-2 text-accent-amber" />
              {t("subscribeMonthly", language)}
            </Button>

            {/* Yearly Plan */}
            <Button 
              onClick={() => handleSubscribe(yearlyPlanUrl)}
              variant="outline"
              className="w-full h-14 text-base bg-accent-green hover:bg-accent-green/80 text-white border-2 border-accent-green/50 hover:border-accent-green transition-all duration-300 hover:scale-105"
              size="lg"
            >
              <Sparkles className="h-5 w-5 mr-2 text-white" />
              {t("subscribeYearly", language)}
            </Button>
          </div>

          {/* Footer note */}
          <div className="bg-muted/30 rounded-md p-3 border border-border/50">
            <p className="text-xs text-muted-foreground">
              {t("paypalRedirectNote", language)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
