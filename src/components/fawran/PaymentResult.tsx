
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";

interface PaymentResultProps {
  result: {
    success: boolean;
    message: string;
  };
  onStartOver?: () => void;
  onClose: () => void;
}

export function PaymentResult({ result, onStartOver, onClose }: PaymentResultProps) {
  const { language } = useTheme();

  return (
    <div className="space-y-6">
      <Card className={`
        border-2 
        ${result.success 
          ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
          : 'border-red-500 bg-red-50 dark:bg-red-950/20'
        }
      `}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {result.success ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
            <span className={result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
              {result.success 
                ? (language === 'ar' ? '🎉 تم بنجاح!' : '🎉 Success!')
                : (language === 'ar' ? '❌ فشل في المعالجة' : '❌ Processing Failed')
              }
            </span>
          </CardTitle>
          <CardDescription className={result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {result.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.success ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  {language === 'ar' ? '✅ تم تفعيل اشتراكك' : '✅ Your Subscription is Active'}
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {language === 'ar' ? 
                    'يمكنك الآن الاستمتاع بجميع ميزات واكتي المتقدمة!' :
                    'You can now enjoy all of Wakti\'s premium features!'
                  }
                </p>
              </div>
              <Button onClick={onClose} className="w-full" size="lg">
                {language === 'ar' ? '🚀 ابدأ استخدام واكتي' : '🚀 Start Using Wakti'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                  {language === 'ar' ? '💡 ماذا يمكنك فعله:' : '💡 What you can do:'}
                </h3>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  <li>• {language === 'ar' ? 'تأكد من وضوح الصورة' : 'Ensure the screenshot is clear'}</li>
                  <li>• {language === 'ar' ? 'تحقق من صحة المبلغ والاسم المستعار' : 'Verify the amount and alias are correct'}</li>
                  <li>• {language === 'ar' ? 'حاول مرة أخرى بصورة جديدة' : 'Try again with a new screenshot'}</li>
                </ul>
              </div>
              <div className="flex gap-3">
                {onStartOver && (
                  <Button onClick={onStartOver} variant="outline" className="flex-1">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}
                  </Button>
                )}
                <Button onClick={onClose} variant="outline" className="flex-1">
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
