
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Copy, Clock, CheckCircle, ArrowLeft, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';
import type { PlanType } from './FawranPaymentOverlay';

interface PaymentInstructionsProps {
  selectedPlan: PlanType;
  onContinue: () => void;
  onBack: () => void;
}

export function PaymentInstructions({ selectedPlan, onContinue, onBack }: PaymentInstructionsProps) {
  const { language } = useTheme();
  const { signOut } = useAuth();
  
  const amount = selectedPlan === 'monthly' ? '60 QAR' : '600 QAR';
  const alias = 'alfadlyqtr';

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleCopyAlias = async () => {
    try {
      await navigator.clipboard.writeText(alias);
      toast.success(language === 'ar' ? 'تم النسخ!' : 'Copied!');
    } catch (error) {
      console.error('Failed to copy alias:', error);
    }
  };

  const steps = [
    {
      number: 1,
      title: language === 'ar' ? 'افتح تطبيق البنك' : 'Open your bank\'s mobile app',
      description: language === 'ar' ? 'افتح تطبيق البنك الخاص بك على الهاتف' : 'Launch your bank\'s mobile application'
    },
    {
      number: 2,
      title: language === 'ar' ? 'اختر "فوران"' : 'Select Transfer "Fawran"',
      description: language === 'ar' ? 'اختر خدمة التحويل الفوري "فوران"' : 'Choose the instant transfer "Fawran" service'
    },
    {
      number: 3,
      title: language === 'ar' ? 'أدخل الاسم المستعار' : 'Enter the alias',
      description: language === 'ar' ? 'اكتب الاسم المستعار المطلوب' : 'Type the required alias name'
    },
    {
      number: 4,
      title: language === 'ar' ? 'أدخل المبلغ' : 'Type the payment amount',
      description: language === 'ar' ? `اكتب المبلغ المطلوب: ${amount}` : `Enter the exact amount: ${amount}`
    },
    {
      number: 5,
      title: language === 'ar' ? 'أكمل التحويل' : 'Complete the transfer and screenshot your confirmation',
      description: language === 'ar' ? 'أكمل التحويل والتقط صورة للتأكيد' : 'Complete transfer and take a screenshot of confirmation'
    }
  ];

  return (
    <div className="p-4 sm:p-8 relative">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-1 sm:p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="p-1 sm:p-2">
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline ml-1 text-xs sm:text-sm">
              {language === 'ar' ? 'خروج' : 'Logout'}
            </span>
          </Button>
        </div>
        <ThemeLanguageToggle />
      </div>

      {/* Account Creation Indicator */}
      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium">
          {language === 'ar' 
            ? '✅ تم إنشاء حسابك وتأكيد البريد الإلكتروني - شكراً لك! يجب إكمال الاشتراك خلال 90 دقيقة من إنشاء الحساب 👇'
            : '✅ Your account created and email confirmed - thank you! Must complete subscription within 90 minutes from account creation 👇'
          }
        </p>
      </div>

      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">
          {language === 'ar' ? 'تعليمات الدفع' : 'Payment Instructions'}
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          {language === 'ar' 
            ? `اتبع هذه الخطوات لإكمال دفع ${amount}`
            : `Follow these steps to complete your ${amount} payment`
          }
        </p>
      </div>

      {/* Important Notice */}
      <Card className="p-3 sm:p-4 mb-4 sm:mb-6 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <Clock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <div className="font-medium text-sm sm:text-base">
            {language === 'ar' 
              ? '⚠️ يجب إكمال التحويل خلال 90 دقيقة (1.5 ساعة) من التقديم'
              : '⚠️ Transfers must be completed within 90 minutes (1.5 hours) of submission'
            }
          </div>
        </div>
      </Card>

      {/* Payment Steps */}
      <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
        {steps.map((step) => (
          <Card key={step.number} className="p-3 sm:p-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm">
                {step.number}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold mb-1 text-sm sm:text-base">{step.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{step.description}</p>
                
                {step.number === 3 && (
                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <code className="bg-muted px-2 sm:px-3 py-1 sm:py-2 rounded text-base sm:text-lg font-mono font-bold break-all">
                      {alias}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAlias}
                      className="flex items-center gap-1 w-full sm:w-auto text-xs sm:text-sm"
                    >
                      <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                      📋 {language === 'ar' ? 'نسخ' : 'Copy'}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 hidden sm:block">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Continue Button */}
      <div className="text-center">
        <Button onClick={onContinue} size="lg" className="w-full sm:w-auto px-4 sm:px-8 text-sm sm:text-base">
          {language === 'ar' ? 'متابعة لرفع الصورة' : 'Continue to Upload Screenshot'}
        </Button>
      </div>
    </div>
  );
}
