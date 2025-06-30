
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";
import { toast } from "sonner";

interface SubscriptionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// Declare PayPal SDK types
declare global {
  interface Window {
    paypal?: {
      Buttons: (options: any) => {
        render: (selector: string) => Promise<void>;
      };
    };
  }
}

export function SubscriptionOverlay({ isOpen, onClose }: SubscriptionOverlayProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Load PayPal SDK with LIVE client ID
    const loadPayPalSDK = () => {
      if (window.paypal) {
        setPaypalLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.paypal.com/sdk/js?client-id=ATVW7zXzTxmmYdKWHV-kKupIv3rk2OcLn6fBQMR_ANGdPqIqJt3AhQ4iY-doB8xGkHkLnmYHMEYQNwZ&vault=true&intent=subscription';
      script.onload = () => {
        setPaypalLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load PayPal SDK');
        toast.error(language === 'ar' ? 'فشل في تحميل PayPal' : 'Failed to load PayPal');
      };
      document.head.appendChild(script);
    };

    if (isOpen) {
      loadPayPalSDK();
    }
  }, [isOpen, language]);

  useEffect(() => {
    if (!paypalLoaded || !window.paypal || !user?.id) return;

    // Render monthly subscription button
    if (document.getElementById('paypal-monthly-button')) {
      window.paypal.Buttons({
        style: {
          shape: 'rect',
          color: 'blue',
          layout: 'vertical',
          label: 'subscribe'
        },
        createSubscription: function(data: any, actions: any) {
          return actions.subscription.create({
            plan_id: 'P-5RM543441H466435NNBGLCWA', // Monthly plan
            custom_id: user.id,
            application_context: {
              brand_name: 'WAKTI',
              locale: language === 'ar' ? 'ar_SA' : 'en_US',
              user_action: 'SUBSCRIBE_NOW'
            }
          });
        },
        onApprove: function(data: any, actions: any) {
          console.log('Monthly subscription approved:', data);
          toast.success(language === 'ar' ? 'تم تفعيل الاشتراك الشهري بنجاح!' : 'Monthly subscription activated successfully!');
          setTimeout(() => onClose(), 2000);
        },
        onError: function(err: any) {
          console.error('Monthly subscription error:', err);
          toast.error(language === 'ar' ? 'خطأ في الاشتراك الشهري' : 'Monthly subscription error');
        },
        onCancel: function(data: any) {
          console.log('Monthly subscription cancelled:', data);
          toast.info(language === 'ar' ? 'تم إلغاء الاشتراك الشهري' : 'Monthly subscription cancelled');
        }
      }).render('#paypal-monthly-button');
    }

    // Render yearly subscription button
    if (document.getElementById('paypal-yearly-button')) {
      window.paypal.Buttons({
        style: {
          shape: 'rect',
          color: 'gold',
          layout: 'vertical',
          label: 'subscribe'
        },
        createSubscription: function(data: any, actions: any) {
          return actions.subscription.create({
            plan_id: 'P-5V753699962632454NBGLE6Y', // Yearly plan
            custom_id: user.id,
            application_context: {
              brand_name: 'WAKTI',
              locale: language === 'ar' ? 'ar_SA' : 'en_US',
              user_action: 'SUBSCRIBE_NOW'
            }
          });
        },
        onApprove: function(data: any, actions: any) {
          console.log('Yearly subscription approved:', data);
          toast.success(language === 'ar' ? 'تم تفعيل الاشتراك السنوي بنجاح!' : 'Yearly subscription activated successfully!');
          setTimeout(() => onClose(), 2000);
        },
        onError: function(err: any) {
          console.error('Yearly subscription error:', err);
          toast.error(language === 'ar' ? 'خطأ في الاشتراك السنوي' : 'Yearly subscription error');
        },
        onCancel: function(data: any) {
          console.log('Yearly subscription cancelled:', data);
          toast.info(language === 'ar' ? 'تم إلغاء الاشتراك السنوي' : 'Yearly subscription cancelled');
        }
      }).render('#paypal-yearly-button');
    }
  }, [paypalLoaded, user?.id, language, onClose]);

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
              {language === "ar" ? "اشترك للوصول إلى تطبيق واقتي AI" : "Subscribe to access Wakti AI app"}
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
                  {paypalLoaded ? (
                    <div id="paypal-monthly-button" className="min-h-[45px]"></div>
                  ) : (
                    <div className="min-h-[45px] flex items-center justify-center bg-gray-100 rounded">
                      <span className="text-sm text-gray-600">
                        {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                      </span>
                    </div>
                  )}
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
                  {paypalLoaded ? (
                    <div id="paypal-yearly-button" className="min-h-[45px]"></div>
                  ) : (
                    <div className="min-h-[45px] flex items-center justify-center bg-gray-100 rounded">
                      <span className="text-sm text-gray-600">
                        {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                {language === "ar" 
                  ? "إلغاء في أي وقت"
                  : "Cancel anytime"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
