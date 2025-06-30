
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
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [loadingAttempts, setLoadingAttempts] = useState(0);

  useEffect(() => {
    setMounted(true);
    
    // Load PayPal SDK with exact recommended parameters
    const loadPayPalSDK = () => {
      console.log('🔄 Starting PayPal SDK loading process...');
      
      if (window.paypal) {
        console.log('✅ PayPal SDK already loaded');
        setPaypalLoaded(true);
        return;
      }

      const script = document.createElement('script');
      // Use PayPal's exact recommended URL with vault=true and intent=subscription
      script.src = 'https://www.paypal.com/sdk/js?client-id=ATVW7zXzTxmmYdKWHV-kKupIv3rk2OcLn6fBQMR_ANGdPqIqJt3AhQ4iY-doB8xGkHkLnmYHMEYQNwZ&vault=true&intent=subscription';
      script.async = true;
      
      script.onload = () => {
        console.log('✅ PayPal SDK loaded successfully');
        setPaypalLoaded(true);
        setPaypalError(null);
      };
      
      script.onerror = (error) => {
        console.error('❌ PayPal SDK failed to load:', error);
        const errorMsg = language === 'ar' ? 'فشل في تحميل PayPal. يرجى المحاولة مرة أخرى.' : 'Failed to load PayPal. Please try again.';
        setPaypalError(errorMsg);
        toast.error(errorMsg);
        
        // Retry logic with exponential backoff
        if (loadingAttempts < 3) {
          const retryDelay = Math.pow(2, loadingAttempts) * 1000; // 1s, 2s, 4s
          console.log(`🔄 Retrying PayPal SDK load in ${retryDelay}ms (attempt ${loadingAttempts + 1}/3)`);
          setTimeout(() => {
            setLoadingAttempts(prev => prev + 1);
            loadPayPalSDK();
          }, retryDelay);
        }
      };
      
      // Remove any existing PayPal scripts first
      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        existingScript.remove();
      }
      
      document.head.appendChild(script);
      console.log('📡 PayPal SDK script added to DOM');
    };

    if (isOpen) {
      loadPayPalSDK();
    }
  }, [isOpen, language, loadingAttempts]);

  useEffect(() => {
    if (!paypalLoaded || !window.paypal || !user?.id) {
      console.log('⏳ PayPal not ready:', { paypalLoaded, hasPaypalWindow: !!window.paypal, hasUserId: !!user?.id });
      return;
    }

    console.log('🎯 Rendering PayPal subscription buttons...');

    // Render monthly subscription button - simplified approach per PayPal support
    const monthlyContainer = document.getElementById('paypal-monthly-button');
    if (monthlyContainer) {
      // Clear any existing content
      monthlyContainer.innerHTML = '';
      
      try {
        window.paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'blue',
            layout: 'vertical',
            label: 'subscribe'
          },
          createSubscription: function(data: any, actions: any) {
            console.log('💳 Creating monthly subscription...');
            // Simplified subscription creation - exactly as recommended by PayPal
            return actions.subscription.create({
              plan_id: 'P-5RM543441H466435NNBGLCWA' // Monthly plan
            });
          },
          onApprove: function(data: any, actions: any) {
            console.log('✅ Monthly subscription approved:', data);
            console.log('Subscription ID:', data.subscriptionID);
            toast.success(language === 'ar' ? 'تم تفعيل الاشتراك الشهري بنجاح!' : 'Monthly subscription activated successfully!');
            // Don't do anything else here - webhook will handle activation
            setTimeout(() => onClose(), 2000);
          },
          onError: function(err: any) {
            console.error('❌ Monthly subscription error:', err);
            toast.error(language === 'ar' ? 'خطأ في الاشتراك الشهري' : 'Monthly subscription error');
          },
          onCancel: function(data: any) {
            console.log('🚫 Monthly subscription cancelled:', data);
            toast.info(language === 'ar' ? 'تم إلغاء الاشتراك الشهري' : 'Monthly subscription cancelled');
          }
        }).render('#paypal-monthly-button');
        console.log('✅ Monthly PayPal button rendered successfully');
      } catch (error) {
        console.error('❌ Error rendering monthly PayPal button:', error);
        setPaypalError(language === 'ar' ? 'خطأ في عرض أزرار PayPal' : 'Error displaying PayPal buttons');
      }
    }

    // Render yearly subscription button - simplified approach per PayPal support
    const yearlyContainer = document.getElementById('paypal-yearly-button');
    if (yearlyContainer) {
      // Clear any existing content
      yearlyContainer.innerHTML = '';
      
      try {
        window.paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe'
          },
          createSubscription: function(data: any, actions: any) {
            console.log('💳 Creating yearly subscription...');
            // Simplified subscription creation - exactly as recommended by PayPal
            return actions.subscription.create({
              plan_id: 'P-5V753699962632454NBGLE6Y' // Yearly plan
            });
          },
          onApprove: function(data: any, actions: any) {
            console.log('✅ Yearly subscription approved:', data);
            console.log('Subscription ID:', data.subscriptionID);
            toast.success(language === 'ar' ? 'تم تفعيل الاشتراك السنوي بنجاح!' : 'Yearly subscription activated successfully!');
            // Don't do anything else here - webhook will handle activation
            setTimeout(() => onClose(), 2000);
          },
          onError: function(err: any) {
            console.error('❌ Yearly subscription error:', err);
            toast.error(language === 'ar' ? 'خطأ في الاشتراك السنوي' : 'Yearly subscription error');
          },
          onCancel: function(data: any) {
            console.log('🚫 Yearly subscription cancelled:', data);
            toast.info(language === 'ar' ? 'تم إلغاء الاشتراك السنوي' : 'Yearly subscription cancelled');
          }
        }).render('#paypal-yearly-button');
        console.log('✅ Yearly PayPal button rendered successfully');
      } catch (error) {
        console.error('❌ Error rendering yearly PayPal button:', error);
        setPaypalError(language === 'ar' ? 'خطأ في عرض أزرار PayPal' : 'Error displaying PayPal buttons');
      }
    }
  }, [paypalLoaded, user?.id, language, onClose]);

  const handleRetryPayPal = () => {
    console.log('🔄 Manual retry of PayPal SDK loading...');
    setPaypalError(null);
    setPaypalLoaded(false);
    setLoadingAttempts(0);
    
    // Remove existing script and reload
    const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
    if (existingScript) {
      existingScript.remove();
    }
    
    // Trigger reload
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=ATVW7zXzTxmmYdKWHV-kKupIv3rk2OcLn6fBQMR_ANGdPqIqJt3AhQ4iY-doB8xGkHkLnmYHMEYQNwZ&vault=true&intent=subscription';
    script.async = true;
    script.onload = () => {
      setPaypalLoaded(true);
      setPaypalError(null);
      toast.success(language === 'ar' ? 'تم تحميل PayPal بنجاح' : 'PayPal loaded successfully');
    };
    script.onerror = () => {
      setPaypalError(language === 'ar' ? 'فشل في تحميل PayPal مرة أخرى' : 'Failed to load PayPal again');
    };
    document.head.appendChild(script);
  };

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
            {/* Error Display */}
            {paypalError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700 mb-3">{paypalError}</p>
                <Button onClick={handleRetryPayPal} variant="outline" size="sm">
                  {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                </Button>
              </div>
            )}

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
                        {language === 'ar' ? 'جاري التحميل...' : 'Loading PayPal...'}
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
                        {language === 'ar' ? 'جاري التحميل...' : 'Loading PayPal...'}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Debug Info (only in development) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500 p-4 bg-gray-50 rounded">
                <p>Debug Info:</p>
                <p>PayPal Loaded: {paypalLoaded ? '✅' : '❌'}</p>
                <p>User ID: {user?.id ? '✅' : '❌'}</p>
                <p>Attempts: {loadingAttempts}/3</p>
                <p>Error: {paypalError || 'None'}</p>
              </div>
            )}

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
