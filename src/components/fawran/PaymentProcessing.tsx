
import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Card } from '@/components/ui/card';
import { Bot, Calendar, Mic, MessageSquare, Sparkles, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentProcessingProps {
  paymentId: string;
  onProcessingComplete: (result: { success: boolean; needsReview?: boolean; message?: string }) => void;
}

export function PaymentProcessing({ paymentId, onProcessingComplete }: PaymentProcessingProps) {
  const { language } = useTheme();
  const [currentFeature, setCurrentFeature] = useState(0);

  const features = [
    {
      icon: Shield,
      title: language === 'ar' ? 'نظام الأمان المحسن' : 'Enhanced Security System',
      description: language === 'ar' 
        ? 'نظام GPT-4 Vision يحلل دفعتك بدقة عالية'
        : 'GPT-4 Vision system analyzes your payment with high precision',
      color: 'text-green-600'
    },
    {
      icon: Bot,
      title: language === 'ar' ? 'مساعد WAKTI الذكي' : 'WAKTI AI Assistant',
      description: language === 'ar' 
        ? 'احصل على مساعدة ذكية في جميع مهامك اليومية'
        : 'Get intelligent help with all your daily tasks',
      color: 'text-blue-600'
    },
    {
      icon: Calendar,
      title: language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders',
      description: language === 'ar' 
        ? 'نظم حياتك بسهولة مع المهام الذكية والتذكيرات'
        : 'Organize your life easily with smart tasks and reminders',
      color: 'text-green-600'
    },
    {
      icon: Sparkles,
      title: language === 'ar' ? 'الأحداث والمواعيد' : 'Events & Appointments',
      description: language === 'ar' 
        ? 'أنشئ وشارك الأحداث بتصاميم احترافية'
        : 'Create and share events with professional designs',
      color: 'text-pink-600'
    },
    {
      icon: Mic,
      title: language === 'ar' ? 'التسجيل الصوتي' : 'Voice Recording',
      description: language === 'ar' 
        ? 'سجل أفكارك واحصل على ملخصات ذكية'
        : 'Record your thoughts and get intelligent summaries',
      color: 'text-orange-600'
    },
    {
      icon: MessageSquare,
      title: language === 'ar' ? 'التواصل الآمن' : 'Secure Messaging',
      description: language === 'ar' 
        ? 'تواصل مع جهات الاتصال بأمان وخصوصية'
        : 'Communicate with contacts safely and privately',
      color: 'text-purple-600'
    }
  ];

  // Rotate through features
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [features.length]);

  // Check payment status
  useEffect(() => {
    let isSubscribed = true;
    
    const checkPaymentStatus = async () => {
      try {
        console.log('Checking payment status for ID:', paymentId);
        
        const { data, error } = await supabase
          .from('pending_fawran_payments')
          .select('status, review_notes')
          .eq('id', paymentId)
          .single();

        if (error) {
          console.error('Error checking payment status:', error);
          return;
        }

        console.log('Payment status data:', data);

        if (!isSubscribed) return; // Component unmounted

        if (data.status === 'approved') {
          console.log('Payment approved!');
          onProcessingComplete({ 
            success: true, 
            message: language === 'ar' 
              ? 'تم تأكيد الدفع بنجاح! مرحباً بك في WAKTI.'
              : 'Payment verified successfully! Welcome to WAKTI.'
          });
        } else if (data.status === 'rejected' || data.status === 'flagged') {
          console.log('Payment needs review:', data.status);
          onProcessingComplete({ 
            success: false, 
            needsReview: true,
            message: language === 'ar' 
              ? 'نحتاج لمراجعة دفعتك يدوياً. يرجى التواصل معنا للمساعدة.'
              : 'We need to review your payment manually. Please contact us for assistance.'
          });
        }
      } catch (error) {
        console.error('Payment status check failed:', error);
      }
    };

    // Check immediately, then every 5 seconds
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 5000);

    // Auto-timeout after 3 minutes if no response (updated from 2 minutes)
    const timeout = setTimeout(() => {
      if (isSubscribed) {
        console.log('Payment verification timeout');
        onProcessingComplete({ 
          success: false, 
          needsReview: true,
          message: language === 'ar' 
            ? 'نحتاج لمراجعة دفعتك يدوياً. سنتواصل معك قريباً.'
            : 'We need to review your payment manually. We\'ll contact you soon.'
        });
      }
    }, 180000); // 3 minutes

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentId, language, onProcessingComplete]);

  const currentFeatureData = features[currentFeature];
  const IconComponent = currentFeatureData.icon;

  return (
    <div className="p-4 sm:p-8 text-center">
      <div className="mb-8">
        <div className="relative inline-block">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary rounded-full animate-pulse"></div>
          </div>
        </div>
        
        <h2 className="text-xl sm:text-2xl font-bold mb-2">
          {language === 'ar' ? 'جاري التحقق من الدفع...' : 'Verifying payment...'}
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          {language === 'ar' 
            ? 'يرجى الانتظار، هذا عادة ما يستغرق 2-3 دقائق!'
            : 'Hang tight! This usually takes 2-3 minutes.'}
        </p>
      </div>

      {/* Feature Carousel */}
      <Card className="p-4 sm:p-6 max-w-md mx-auto">
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-4 ${currentFeatureData.color}`}>
            <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          
          <h3 className="font-bold text-base sm:text-lg mb-2">
            {currentFeatureData.title}
          </h3>
          
          <p className="text-xs sm:text-sm text-muted-foreground">
            {currentFeatureData.description}
          </p>
        </div>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-4">
          {features.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentFeature ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </Card>

      <div className="mt-6 space-y-2">
        <p className="text-xs text-muted-foreground">
          {language === 'ar' 
            ? 'نستخدم تقنية GPT-4 Vision للتحقق من دفعتك تلقائياً'
            : 'We use GPT-4 Vision technology to automatically verify your payment'
          }
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
          {language === 'ar' 
            ? '🔒 نظام أمان متقدم • 99.9% دقة كشف الاحتيال'
            : '🔒 Advanced security system • 99.9% fraud detection accuracy'
          }
        </p>
      </div>
    </div>
  );
}
