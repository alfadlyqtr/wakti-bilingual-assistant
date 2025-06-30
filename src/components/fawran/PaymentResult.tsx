
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, MessageCircle } from 'lucide-react';

interface PaymentResultProps {
  result: {
    success: boolean;
    needsReview?: boolean;
    message?: string;
  };
  onStartOver: () => void;
  onClose: () => void;
}

export function PaymentResult({ result, onStartOver, onClose }: PaymentResultProps) {
  const { language } = useTheme();

  const handleWhatsAppContact = () => {
    const whatsappUrl = `https://wa.me/97433994166?text=${encodeURIComponent(
      language === 'ar' 
        ? 'مرحباً، أحتاج مساعدة في تأكيد دفع اشتراك WAKTI'
        : 'Hello, I need help with confirming my WAKTI subscription payment'
    )}`;
    window.open(whatsappUrl, '_blank');
  };

  if (result.success) {
    return (
      <div className="p-4 sm:p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
            <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
          </div>
          
          <h2 className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
            {language === 'ar' ? '🎉 تم تأكيد الدفع!' : '🎉 Payment Verified!'}
          </h2>
          
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            {result.message || (language === 'ar' 
              ? 'تم تفعيل اشتراكك بنجاح. مرحباً بك في WAKTI!'
              : 'Your subscription has been activated successfully. Welcome to WAKTI!'
            )}
          </p>
        </div>

        <Card className="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 mb-6">
          <p className="text-xs sm:text-sm text-green-700 dark:text-green-300">
            {language === 'ar' 
              ? 'يمكنك الآن الاستمتاع بجميع ميزات WAKTI. قم بتسجيل الدخول للبدء!'
              : 'You can now enjoy all WAKTI features. Please sign in to get started!'
            }
          </p>
        </Card>

        <Button onClick={onClose} size="lg" className="w-full sm:w-auto px-6 sm:px-8">
          {language === 'ar' ? 'ابدأ استخدام WAKTI' : 'Start Using WAKTI'}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 text-center">
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-4">
          <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 dark:text-orange-400" />
        </div>
        
        <h2 className="text-xl sm:text-2xl font-bold text-orange-700 dark:text-orange-300 mb-2">
          {language === 'ar' ? '⏳ قيد المراجعة' : '⏳ Under Review'}
        </h2>
        
        <p className="text-muted-foreground mb-6 text-sm sm:text-base">
          {result.message || (language === 'ar' 
            ? 'نحتاج لمراجعة دفعتك يدوياً. سنتواصل معك قريباً.'
            : 'We need to review your payment manually. We\'ll contact you soon.'
          )}
        </p>
      </div>

      <Card className="p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 mb-6">
        <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 mb-3">
          {language === 'ar' 
            ? 'إذا كنت بحاجة لمساعدة فورية، تواصل معنا عبر الواتساب:'
            : 'If you need immediate assistance, contact us via WhatsApp:'
          }
        </p>
        
        <Button 
          variant="outline" 
          onClick={handleWhatsAppContact}
          className="w-full sm:w-auto border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'تواصل عبر الواتساب' : 'Contact via WhatsApp'}
        </Button>
      </Card>

      <div className="space-y-3">
        <Button onClick={onStartOver} variant="outline" className="w-full">
          {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
        </Button>
        
        <Button onClick={onClose} variant="ghost" className="w-full">
          {language === 'ar' ? 'إغلاق' : 'Close'}
        </Button>
      </div>
    </div>
  );
}
