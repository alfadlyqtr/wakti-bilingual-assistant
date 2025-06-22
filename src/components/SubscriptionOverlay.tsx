
import { useEffect, useState } from "react";
import { X, Crown, Check, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { UserMenu } from "@/components/UserMenu";
import { t } from "@/utils/translations";
import { toast } from "sonner";

interface SubscriptionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionOverlay({ isOpen, onClose }: SubscriptionOverlayProps) {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!isOpen) return null;

  const handleMonthlySubscription = () => {
    // PayPal Monthly Plan URL (60 QAR/month)
    const monthlyPlanUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5RM543441H466435NNBGLCWA';
    window.open(monthlyPlanUrl, '_blank');
    toast.info(language === 'ar' ? 'تم فتح صفحة الدفع في نافذة جديدة' : 'Payment page opened in new window');
    setTimeout(() => onClose(), 1500);
  };

  const handleYearlySubscription = () => {
    // PayPal Yearly Plan URL (600 QAR/year)
    const yearlyPlanUrl = 'https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-5V753699962632454NBGLE6Y';
    window.open(yearlyPlanUrl, '_blank');
    toast.info(language === 'ar' ? 'تم فتح صفحة الدفع في نافذة جديدة' : 'Payment page opened in new window');
    setTimeout(() => onClose(), 1500);
  };

  const features = [
    {
      icon: <Zap className="h-5 w-5" />,
      title: language === "ar" ? "AI متقدم غير محدود" : "Unlimited Advanced AI",
      description: language === "ar" ? "وصول كامل لجميع ميزات الذكي الاصطناعي" : "Full access to all AI features"
    },
    {
      icon: <Crown className="h-5 w-5" />,
      title: language === "ar" ? "ميزات حصرية" : "Premium Features",
      description: language === "ar" ? "احصل على ميزات متقدمة حصرية للمشتركين" : "Get advanced features exclusive to subscribers"
    },
    {
      icon: <Star className="h-5 w-5" />,
      title: language === "ar" ? "أولوية الدعم" : "Priority Support",
      description: language === "ar" ? "دعم فني سريع ومخصص" : "Fast and dedicated technical support"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
          {/* Header with Controls - Fixed positioning and higher z-index */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <div className="pointer-events-auto">
              <UserMenu />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-accent border pointer-events-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <CardHeader className="text-center pt-16 pb-6">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                <Crown className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {language === "ar" ? "اشترك في واقتي بريميوم" : "Upgrade to Wakti Premium"}
            </CardTitle>
            <CardDescription className="text-lg">
              {language === "ar" 
                ? "احصل على وصول كامل لجميع الميزات المتقدمة"
                : "Get full access to all advanced features"
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Features */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-accent/5">
                  <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full text-primary">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                  <Check className="h-5 w-5 text-green-500 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>

            {/* Pricing Plans */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Monthly Plan */}
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">
                    {language === "ar" ? "الخطة الشهرية" : "Monthly Plan"}
                  </CardTitle>
                  <div className="text-3xl font-bold">
                    60 <span className="text-sm font-normal text-muted-foreground">QAR/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleMonthlySubscription} className="w-full" size="lg">
                    {language === "ar" ? "اشترك شهرياً" : "Subscribe Monthly"}
                  </Button>
                </CardContent>
              </Card>

              {/* Yearly Plan */}
              <Card className="border-2 border-primary relative">
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
                  {language === "ar" ? "الأكثر شعبية" : "Most Popular"}
                </Badge>
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">
                    {language === "ar" ? "الخطة السنوية" : "Yearly Plan"}
                  </CardTitle>
                  <div className="text-3xl font-bold">
                    600 <span className="text-sm font-normal text-muted-foreground">QAR/year</span>
                  </div>
                  <div className="text-sm text-green-600 font-medium">
                    {language === "ar" ? "وفر 120 ريال سنوياً" : "Save 120 QAR yearly"}
                  </div>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleYearlySubscription} className="w-full" size="lg">
                    {language === "ar" ? "اشترك سنوياً" : "Subscribe Yearly"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                {language === "ar" 
                  ? "تجربة مجانية لمدة 3 أيام • إلغاء في أي وقت"
                  : "3-day free trial • Cancel anytime"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
