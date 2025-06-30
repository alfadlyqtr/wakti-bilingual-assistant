
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";

interface SubscriptionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionOverlay({ isOpen, onClose }: SubscriptionOverlayProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, [isOpen]);

  if (!mounted) return null;

  if (!isOpen) return null;

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
                  <Button className="w-full" disabled>
                    {language === "ar" ? "قريباً" : "Coming Soon"}
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
                  <Button className="w-full" disabled>
                    {language === "ar" ? "قريباً" : "Coming Soon"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                {language === "ar" 
                  ? "نظام دفع جديد قادم قريباً"
                  : "New payment system coming soon"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
