
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Copy, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PlanType } from './FawranPaymentOverlay';

interface PaymentInstructionsProps {
  selectedPlan: PlanType;
  onContinue: () => void;
}

export function PaymentInstructions({ selectedPlan, onContinue }: PaymentInstructionsProps) {
  const { language } = useTheme();
  const { toast } = useToast();
  
  const amount = selectedPlan === 'monthly' ? '60 QAR' : '600 QAR';
  const alias = 'alfadlyqtr';

  const handleCopyAlias = async () => {
    try {
      await navigator.clipboard.writeText(alias);
      toast({
        title: language === 'ar' ? 'تم النسخ!' : 'Copied!',
        description: language === 'ar' ? 'تم نسخ الاسم المستعار' : 'Alias copied to clipboard',
      });
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
      title: language === 'ar' ? 'اختر "الفوران"' : 'Select Transfer "Fawran"',
      description: language === 'ar' ? 'اختر خدمة التحويل الفوري "الفوران"' : 'Choose the instant transfer "Fawran" service'
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
      title: language === 'ar' ? 'أكمل التحويل' : 'Complete the transfer',
      description: language === 'ar' ? 'أكمل التحويل والتقط صورة للتأكيد' : 'Complete transfer and screenshot confirmation'
    }
  ];

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">
          {language === 'ar' ? 'تعليمات الدفع' : 'Payment Instructions'}
        </h2>
        <p className="text-muted-foreground">
          {language === 'ar' 
            ? `اتبع هذه الخطوات لإكمال دفع ${amount}`
            : `Follow these steps to complete your ${amount} payment`
          }
        </p>
      </div>

      {/* Important Notice */}
      <Card className="p-4 mb-6 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <Clock className="h-5 w-5" />
          <div className="font-medium">
            {language === 'ar' 
              ? '⚠️ يجب إكمال التحويل خلال 90 دقيقة (1.5 ساعة) من التقديم'
              : '⚠️ Transfers must be completed within 90 minutes (1.5 hours) of submission'
            }
          </div>
        </div>
      </Card>

      {/* Payment Steps */}
      <div className="space-y-4 mb-8">
        {steps.map((step) => (
          <Card key={step.number} className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                {step.number}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                
                {step.number === 3 && (
                  <div className="mt-3 flex items-center gap-2">
                    <code className="bg-muted px-3 py-2 rounded text-lg font-mono font-bold">
                      {alias}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAlias}
                      className="flex items-center gap-1"
                    >
                      <Copy className="h-4 w-4" />
                      {language === 'ar' ? 'نسخ' : 'Copy'}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Continue Button */}
      <div className="text-center">
        <Button onClick={onContinue} size="lg" className="px-8">
          {language === 'ar' ? 'متابعة لرفع الصورة' : 'Continue to Upload Screenshot'}
        </Button>
      </div>
    </div>
  );
}
