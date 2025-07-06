
import { Check, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import type { PlanType } from './FawranPaymentOverlay';

interface PlanSelectionProps {
  onPlanSelect: (plan: PlanType) => void;
}

export function PlanSelection({ onPlanSelect }: PlanSelectionProps) {
  const { language } = useTheme();

  const plans = [
    {
      type: 'monthly' as PlanType,
      name: language === 'ar' ? 'الخطة الشهرية' : 'Monthly Plan',
      price: '60 QAR',
      period: language === 'ar' ? 'شهرياً' : 'per month',
      description: language === 'ar' ? 'مثالية للتجربة والاستخدام المؤقت' : 'Perfect for trying out and temporary use',
      icon: <Zap className="h-6 w-6" />,
      features: [
        language === 'ar' ? 'جميع الميزات المتقدمة' : 'All premium features',
        language === 'ar' ? 'دعم فني 24/7' : '24/7 technical support',
        language === 'ar' ? 'تحديثات تلقائية' : 'Automatic updates',
        language === 'ar' ? 'مزامنة عبر الأجهزة' : 'Cross-device sync'
      ],
      popular: false
    },
    {
      type: 'yearly' as PlanType,
      name: language === 'ar' ? 'الخطة السنوية' : 'Yearly Plan',
      price: '600 QAR',
      period: language === 'ar' ? 'سنوياً' : 'per year',
      originalPrice: '720 QAR',
      description: language === 'ar' ? 'الأفضل قيمة - وفر 120 ريال!' : 'Best value - Save 120 QAR!',
      icon: <Crown className="h-6 w-6" />,
      features: [
        language === 'ar' ? 'جميع ميزات الخطة الشهرية' : 'All monthly plan features',
        language === 'ar' ? 'خصم 17% (توفير 120 ريال)' : '17% discount (Save 120 QAR)',
        language === 'ar' ? 'دعم أولوية' : 'Priority support',
        language === 'ar' ? 'وصول مبكر للميزات الجديدة' : 'Early access to new features'
      ],
      popular: true
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-enhanced-heading mb-2">
          {language === 'ar' ? 'اختر خطة الاشتراك' : 'Choose Your Subscription Plan'}
        </h2>
        <p className="text-muted-foreground">
          {language === 'ar' ? 
            'فعل حسابك للاستمتاع بجميع ميزات واكتي المتقدمة' : 
            'Activate your account to enjoy all of Wakti\'s premium features'
          }
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <Card 
            key={plan.type}
            className={`
              relative transition-all duration-300 hover:shadow-xl cursor-pointer
              ${plan.popular ? 'border-primary shadow-lg scale-105' : 'border-border hover:border-primary/50'}
            `}
            onClick={() => onPlanSelect(plan.type)}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white px-4 py-1">
                  {language === 'ar' ? '🔥 الأكثر شعبية' : '🔥 Most Popular'}
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center pb-4">
              <div className={`
                mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4
                ${plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
              `}>
                {plan.icon}
              </div>
              
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold text-enhanced-heading">{plan.price}</span>
                  {plan.originalPrice && (
                    <span className="text-lg text-muted-foreground line-through">{plan.originalPrice}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{plan.period}</p>
              </div>
              
              <CardDescription className="text-center">
                {plan.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className={`
                  w-full mt-6
                  ${plan.popular 
                    ? 'bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90' 
                    : ''
                  }
                `}
                size="lg"
                onClick={() => onPlanSelect(plan.type)}
              >
                {language === 'ar' ? 'اختيار هذه الخطة' : 'Choose This Plan'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Method Info */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200">
              {language === 'ar' ? '💳 الدفع عبر فوران' : '💳 Payment via Fawran'}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {language === 'ar' ? 
                'دفع آمن وسريع عبر نظام فوران للتحويلات الفورية - متاح 24/7' :
                'Secure and fast payment via Fawran instant transfer system - Available 24/7'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
