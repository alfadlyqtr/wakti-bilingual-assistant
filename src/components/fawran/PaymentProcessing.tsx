import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Brain, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";

interface PaymentProcessingProps {
  paymentId: string;
  onProcessingComplete: (result: { success: boolean; message: string }) => void;
}

export function PaymentProcessing({ paymentId, onProcessingComplete }: PaymentProcessingProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const { language } = useTheme();

  const steps = [
    {
      icon: <Brain className="h-5 w-5" />,
      title: language === 'ar' ? 'تحليل الصورة باستخدام الذكاء الاصطناعي' : 'AI Image Analysis',
      description: language === 'ar' ? 'فحص تفاصيل الدفع' : 'Analyzing payment details'
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: language === 'ar' ? 'فحص الأمان' : 'Security Verification',
      description: language === 'ar' ? 'التحقق من صحة المعاملة' : 'Verifying transaction authenticity'
    },
    {
      icon: <CheckCircle className="h-5 w-5" />,
      title: language === 'ar' ? 'معالجة الطلب' : 'Processing Request',
      description: language === 'ar' ? 'تجهيز حسابك' : 'Preparing your account'
    }
  ];

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let stepInterval: NodeJS.Timeout;
    let pollInterval: NodeJS.Timeout;

    const startProcessing = async () => {
      console.log('🔄 Starting payment processing for ID:', paymentId);
      
      // Animate progress
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return 95; // Keep some room for completion
          return prev + Math.random() * 15;
        });
      }, 500);

      // Animate steps
      stepInterval = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % steps.length);
      }, 2000);

      // Poll for payment status
      const pollStatus = async () => {
        try {
          const { data, error } = await supabase
            .from('pending_fawran_payments')
            .select('status, review_notes')
            .eq('id', paymentId)
            .single();

          if (error) {
            console.error('❌ Polling error:', error);
            return;
          }

          console.log('📊 Payment status:', data.status);

          if (data.status === 'approved') {
            clearAllIntervals();
            setProgress(100);
            setCurrentStep(2);
            setTimeout(() => {
              onProcessingComplete({
                success: true,
                message: language === 'ar' ? 
                  'تم قبول الدفع وتفعيل الاشتراك!' : 
                  'Payment approved and subscription activated!'
              });
            }, 1000);
          } else if (data.status === 'rejected') {
            clearAllIntervals();
            setProgress(100);
            onProcessingComplete({
              success: false,
              message: language === 'ar' ? 
                'تم رفض الدفع. يرجى المحاولة مرة أخرى أو التواصل مع الدعم.' : 
                'Payment was rejected. Please try again or contact support.'
            });
          } else if (data.status === 'pending') {
            // Keep polling - payment still being processed
            console.log('⏳ Payment still processing...');
          }
        } catch (error) {
          console.error('❌ Status polling error:', error);
        }
      };

      // Start polling immediately and then every 3 seconds
      await pollStatus();
      pollInterval = setInterval(pollStatus, 3000);

      // Trigger AI analysis after a short delay
      setTimeout(async () => {
        try {
          console.log('🧠 Triggering AI analysis...');
          const response = await supabase.functions.invoke('analyze-payment-screenshot', {
            body: { paymentId }
          });
          
          if (response.error) {
            console.error('❌ AI analysis trigger error:', response.error);
          } else {
            console.log('✅ AI analysis triggered successfully');
          }
        } catch (error) {
          console.error('❌ Failed to trigger AI analysis:', error);
        }
      }, 2000);
    };

    const clearAllIntervals = () => {
      if (progressInterval) clearInterval(progressInterval);
      if (stepInterval) clearInterval(stepInterval);
      if (pollInterval) clearInterval(pollInterval);
    };

    startProcessing();

    // Cleanup on unmount
    return () => {
      clearAllIntervals();
    };
  }, [paymentId, onProcessingComplete, language]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-enhanced-heading mb-2">
          {language === 'ar' ? 'معالجة الدفع' : 'Processing Payment'}
        </h2>
        <p className="text-muted-foreground">
          {language === 'ar' ? 
            'يتم تحليل دفعتك باستخدام الذكاء الاصطناعي المتقدم' : 
            'Your payment is being analyzed using advanced AI technology'
          }
        </p>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{language === 'ar' ? 'التقدم' : 'Progress'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Processing Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={index} className={`
            transition-all duration-500 
            ${index === currentStep ? 'border-primary bg-primary/5' : 'border-border'}
            ${index < currentStep ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}
          `}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full
                  ${index === currentStep ? 'bg-primary text-primary-foreground animate-pulse' : ''}
                  ${index < currentStep ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}
                `}>
                  {index === currentStep ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {index < currentStep && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Processing Notice */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200">
                {language === 'ar' ? '⏰ المعالجة الآلية' : '⏰ Automated Processing'}
              </p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                {language === 'ar' ? 
                  'يتم تحليل دفعتك تلقائياً. عادة ما تستغرق هذه العملية 1-3 دقائق.' :
                  'Your payment is being processed automatically. This usually takes 1-3 minutes.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
