
import { useEffect, useState } from "react";
import { X, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";
import { PaymentProofUpload } from "@/components/PaymentProofUpload";

interface FawranSubscriptionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlanType = 'monthly' | 'yearly';

interface PlanDetails {
  name: string;
  nameAr: string;
  price: number;
  savings?: number;
  savingsAr?: string;
}

const PLANS: Record<PlanType, PlanDetails> = {
  monthly: {
    name: "Monthly Plan",
    nameAr: "الخطة الشهرية",
    price: 60
  },
  yearly: {
    name: "Yearly Plan", 
    nameAr: "الخطة السنوية",
    price: 600,
    savings: 120,
    savingsAr: "وفر 120 ريال سنوياً"
  }
};

export function FawranSubscriptionOverlay({ isOpen, onClose }: FawranSubscriptionOverlayProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const handlePlanSelect = (planType: PlanType) => {
    setSelectedPlan(planType);
    setShowPaymentForm(true);
  };

  const handleBackToPlanSelection = () => {
    setShowPaymentForm(false);
    setSelectedPlan(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
          {/* Header with Controls */}
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

          {!showPaymentForm ? (
            // Plan Selection View
            <>
              <CardHeader className="text-center pt-16 pb-6">
                <CardTitle className="text-2xl font-bold">
                  {language === "ar" ? "اشترك للوصول إلى تطبيق واقتي" : "Subscribe to access Wakti"}
                </CardTitle>
                <CardDescription className="text-lg">
                  {language === "ar" 
                    ? "اختر خطة الاشتراك المناسبة لك"
                    : "Choose the subscription plan that works for you"
                  }
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing Plans */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Monthly Plan */}
                  <Card 
                    className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => handlePlanSelect('monthly')}
                  >
                    <CardHeader className="text-center">
                      <CardTitle className="text-lg">
                        {language === "ar" ? PLANS.monthly.nameAr : PLANS.monthly.name}
                      </CardTitle>
                      <div className="text-3xl font-bold">
                        {PLANS.monthly.price} <span className="text-sm font-normal text-muted-foreground">QAR/month</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full">
                        {language === "ar" ? "اختيار" : "Select"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Yearly Plan */}
                  <Card className="border-2 border-primary relative cursor-pointer" onClick={() => handlePlanSelect('yearly')}>
                    <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
                      {language === "ar" ? "الأكثر شعبية" : "Most Popular"}
                    </Badge>
                    <CardHeader className="text-center">
                      <CardTitle className="text-lg">
                        {language === "ar" ? PLANS.yearly.nameAr : PLANS.yearly.name}
                      </CardTitle>
                      <div className="text-3xl font-bold">
                        {PLANS.yearly.price} <span className="text-sm font-normal text-muted-foreground">QAR/year</span>
                      </div>
                      <div className="text-sm text-green-600 font-medium">
                        {language === "ar" ? PLANS.yearly.savingsAr : `Save ${PLANS.yearly.savings} QAR yearly`}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full">
                        {language === "ar" ? "اختيار" : "Select"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Fawran Info */}
                <div className="text-center text-sm text-muted-foreground space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>
                      {language === "ar" 
                        ? "ادفع بأمان باستخدام فوران - نظام الدفع الفوري القطري"
                        : "Pay securely with Fawran - Qatar's instant payment system"
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            // Payment Form View
            <PaymentProofUpload
              selectedPlan={selectedPlan!}
              planDetails={PLANS[selectedPlan!]}
              onBack={handleBackToPlanSelection}
              onSuccess={onClose}
              language={language}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
