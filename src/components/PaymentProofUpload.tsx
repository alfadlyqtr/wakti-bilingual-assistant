
import { useState } from "react";
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentProofUploadProps {
  selectedPlan: 'monthly' | 'yearly';
  planDetails: {
    name: string;
    nameAr: string;
    price: number;
    savings?: number;
    savingsAr?: string;
  };
  onBack: () => void;
  onSuccess: () => void;
  language: 'en' | 'ar';
}

export function PaymentProofUpload({ 
  selectedPlan, 
  planDetails, 
  onBack, 
  onSuccess, 
  language 
}: PaymentProofUploadProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(language === "ar" ? "يرجى اختيار صورة فقط" : "Please select an image file only");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error(language === "ar" ? "حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)" : "File size too large (max 5MB)");
      return;
    }
    
    setScreenshot(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const uploadScreenshot = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    
    const { data, error } = await supabase.storage
      .from('fawran-screenshots')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('fawran-screenshots')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  };

  const submitPaymentProof = async () => {
    if (!user || !screenshot || !email.trim()) {
      toast.error(language === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload screenshot
      const screenshotUrl = await uploadScreenshot(screenshot);

      // Create payment submission record
      const { data: paymentData, error } = await supabase
        .from('pending_fawran_payments')
        .insert({
          user_id: user.id,
          email: email.trim(),
          plan_type: selectedPlan,
          amount: planDetails.price,
          screenshot_url: screenshotUrl
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(
        language === "ar" 
          ? "تم إرسال إثبات الدفع بنجاح!" 
          : "Payment proof submitted successfully!"
      );

      // Start AI analysis
      setIsAnalyzing(true);
      
      try {
        const { data: analysisResult, error: analysisError } = await supabase.functions
          .invoke('analyze-payment-screenshot', {
            body: { paymentId: paymentData.id }
          });

        if (analysisError) {
          console.error('AI analysis failed:', analysisError);
          toast.info(
            language === "ar" 
              ? "سيتم مراجعة الدفع يدوياً خلال 24 ساعة" 
              : "Payment will be reviewed manually within 24 hours"
          );
        } else if (analysisResult?.auto_approved) {
          toast.success(
            language === "ar" 
              ? "تم تفعيل اشتراكك تلقائياً! مرحباً بك في واقتي المميز" 
              : "Your subscription has been activated automatically! Welcome to Wakti Premium"
          );
        } else {
          toast.info(
            language === "ar" 
              ? "سيتم مراجعة الدفع وتفعيل اشتراكك خلال 24 ساعة" 
              : "Payment will be reviewed and your subscription activated within 24 hours"
          );
        }
      } catch (analysisError) {
        console.error('Analysis request failed:', analysisError);
        toast.info(
          language === "ar" 
            ? "سيتم مراجعة الدفع يدوياً خلال 24 ساعة" 
            : "Payment will be reviewed manually within 24 hours"
        );
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error submitting payment proof:', error);
      toast.error(
        language === "ar" 
          ? "حدث خطأ في إرسال إثبات الدفع. يرجى المحاولة مرة أخرى." 
          : "Error submitting payment proof. Please try again."
      );
    } finally {
      setIsSubmitting(false);
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <CardHeader className="text-center pt-16 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-xl font-bold flex-1">
            {language === "ar" ? "إثبات الدفع" : "Payment Proof"}
          </CardTitle>
        </div>
        <CardDescription>
          {language === "ar" 
            ? `${planDetails.nameAr} - ${planDetails.price} ريال قطري`
            : `${planDetails.name} - ${planDetails.price} QAR`
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* AI Analysis Badge */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Brain className="h-4 w-4" />
            <span className="text-sm font-medium">
              {language === "ar" 
                ? "تحليل ذكي لإثبات الدفع - تفعيل فوري محتمل"
                : "AI-Powered Payment Analysis - Potential Instant Activation"
              }
            </span>
          </div>
        </div>

        {/* Payment Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            {language === "ar" ? "تعليمات الدفع:" : "Payment Instructions:"}
          </h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <p>
              {language === "ar" 
                ? "1. افتح تطبيق البنك الخاص بك"
                : "1. Open your banking app"
              }
            </p>
            <p>
              {language === "ar" 
                ? "2. اختر الدفع بفوران"
                : "2. Select Fawran payment"
              }
            </p>
            <p>
              {language === "ar" 
                ? "3. أرسل المبلغ إلى: alfadlyqtr أو عبدالله حسون"
                : "3. Send amount to: alfadlyqtr or Abdullah Hassoun"
              }
            </p>
            <p className="font-semibold">
              {language === "ar" 
                ? `4. المبلغ: ${planDetails.price} ريال قطري`
                : `4. Amount: ${planDetails.price} QAR`
              }
            </p>
            <p>
              {language === "ar" 
                ? "5. التقط لقطة شاشة لإثبات الدفع وارفعها أدناه"
                : "5. Take a screenshot of payment confirmation and upload below"
              }
            </p>
          </div>
        </div>

        {/* Email Input */}
        <div className="space-y-2">
          <Label htmlFor="email">
            {language === "ar" ? "البريد الإلكتروني" : "Email Address"}
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={language === "ar" ? "أدخل بريدك الإلكتروني" : "Enter your email"}
            required
          />
        </div>

        {/* Screenshot Upload */}
        <div className="space-y-2">
          <Label>
            {language === "ar" ? "لقطة شاشة إثبات الدفع" : "Payment Proof Screenshot"}
          </Label>
          <div
            className={`
              border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${dragOver ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600'}
              ${screenshot ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}
            `}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
          >
            {screenshot ? (
              <div className="space-y-2">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  {screenshot.name}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {language === "ar" ? "تم تحديد الملف" : "File selected"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScreenshot(null)}
                >
                  {language === "ar" ? "إزالة" : "Remove"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {language === "ar" 
                    ? "اسحب الصورة هنا أو انقر للتحديد"
                    : "Drag image here or click to select"
                  }
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="screenshot-upload"
                />
                <Label
                  htmlFor="screenshot-upload"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                >
                  {language === "ar" ? "اختيار ملف" : "Choose File"}
                </Label>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          className="w-full" 
          onClick={submitPaymentProof}
          disabled={!screenshot || !email.trim() || isSubmitting || isAnalyzing}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {language === "ar" ? "جاري الإرسال..." : "Submitting..."}
            </>
          ) : isAnalyzing ? (
            <>
              <Brain className="h-4 w-4 mr-2 animate-pulse" />
              {language === "ar" ? "جاري التحليل الذكي..." : "AI Analyzing..."}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {language === "ar" ? "إرسال إثبات الدفع" : "Submit Payment Proof"}
            </>
          )}
        </Button>

        {/* Footer Note */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>
            {language === "ar" 
              ? "سيتم تحليل إثبات الدفع باستخدام الذكاء الاصطناعي للتفعيل الفوري"
              : "Payment proof will be analyzed using AI for instant activation"
            }
          </p>
          <p>
            {language === "ar" 
              ? "أو مراجعة يدوية خلال 24 ساعة كحد أقصى"
              : "or manual review within 24 hours maximum"
            }
          </p>
        </div>
      </CardContent>
    </>
  );
}
