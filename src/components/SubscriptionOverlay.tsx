
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
      {/* Faded Dashboard Background */}
      <div className="absolute inset-0 bg-gradient-background opacity-30 blur-sm" />
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
      
      {/* Top Controls */}
      <div className="fixed top-4 left-0 right-0 z-10 flex justify-between items-center px-4 max-w-md mx-auto">
        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="bg-gradient-card hover:bg-accent/20 border border-border/50 shadow-soft hover:shadow-glow-orange transition-all duration-300"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'خروج' : 'Logout'}
        </Button>

        {/* Language Toggle */}
        <ThemeLanguageToggle />
      </div>

      {/* Main Subscription Card */}
      <Card className="w-full max-w-md mx-auto relative z-10 bg-gradient-card border-2 border-accent-blue/30 shadow-vibrant">
        <CardContent className="p-8 text-center space-y-6">
          {/* Welcome Header */}
          <div className="space-y-3">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="text-5xl animate-bounce-subtle">👋</div>
                <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-accent-orange animate-pulse-color" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {t("welcomeToWakti", language)}
            </h1>
            
            <p className="text-sm text-accent-green font-medium">
              {t("thankYouMessage", language)}
            </p>
          </div>

          {/* Description */}
          <div className="bg-gradient-secondary/20 rounded-lg p-4 border border-accent-blue/20">
            <p className="text-sm text-foreground/80 leading-relaxed">
              {t("subscriptionRequired", language)}
            </p>
          </div>

          {/* Subscription Buttons */}
          <div className="space-y-4">
            {/* Monthly Plan */}
            <Button 
              onClick={() => handleSubscribe(monthlyPlanUrl)}
              className="w-full h-14 text-base bg-gradient-vibrant hover:shadow-glow-blue border border-accent-blue/30 transition-all duration-300 hover:scale-105 relative overflow-hidden group"
              size="lg"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-accent-blue/20 to-accent-purple/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Star className="h-5 w-5 mr-2 text-accent-amber" />
              <span className="relative z-10">
                {t("subscribeMonthly", language)}
              </span>
            </Button>

            {/* Yearly Plan */}
            <Button 
              onClick={() => handleSubscribe(yearlyPlanUrl)}
              variant="outline"
              className="w-full h-14 text-base bg-gradient-warm hover:shadow-glow-green border-2 border-accent-green/50 hover:border-accent-green transition-all duration-300 hover:scale-105 relative overflow-hidden group"
              size="lg"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-accent-green/20 to-accent-emerald/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Sparkles className="h-5 w-5 mr-2 text-accent-green" />
              <span className="relative z-10">
                {t("subscribeYearly", language)}
              </span>
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
