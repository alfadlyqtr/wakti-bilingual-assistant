
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileImage, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";
import type { PlanType } from './FawranPaymentOverlay';

interface ScreenshotUploadProps {
  userEmail: string;
  selectedPlan: PlanType;
  onUploadComplete: (data: { screenshotUrl: string; senderAlias: string; paymentId: string }) => void;
  onBack: () => void;
}

export function ScreenshotUpload({ userEmail, selectedPlan, onUploadComplete, onBack }: ScreenshotUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [senderAlias, setSenderAlias] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { language } = useTheme();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)' : 'File too large (max 10MB)');
        return;
      }
      setUploadedFile(file);
      toast.success(language === 'ar' ? 'تم اختيار الصورة' : 'Screenshot selected');
    }
  }, [language]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024
  });

  const handleSubmit = async () => {
    if (!uploadedFile || !senderAlias.trim()) {
      toast.error(language === 'ar' ? 'يرجى رفع الصورة وإدخال الاسم المستعار' : 'Please upload screenshot and enter sender alias');
      return;
    }

    try {
      setIsUploading(true);
      console.log('🔄 Starting Fawran payment submission...');

      // Generate unique filename
      const fileExtension = uploadedFile.name.split('.').pop();
      const fileName = `fawran_${Date.now()}.${fileExtension}`;
      const filePath = `${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('fawran-screenshots')
        .upload(filePath, uploadedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fawran-screenshots')
        .getPublicUrl(filePath);

      console.log('✅ Screenshot uploaded:', publicUrl);

      // Submit payment record
      const amount = selectedPlan === 'monthly' ? 60 : 600;
      const { data: paymentData, error: paymentError } = await supabase
        .from('pending_fawran_payments')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          email: userEmail,
          plan_type: selectedPlan,
          amount: amount,
          screenshot_url: publicUrl,
          sender_alias: senderAlias.trim(),
          status: 'pending'
        })
        .select()
        .single();

      if (paymentError) {
        console.error('❌ Payment submission error:', paymentError);
        throw new Error(`Payment submission failed: ${paymentError.message}`);
      }

      console.log('✅ Payment record created:', paymentData.id);
      
      toast.success(language === 'ar' ? '✅ تم إرسال الدفع بنجاح!' : '✅ Payment submitted successfully!');
      
      onUploadComplete({
        screenshotUrl: publicUrl,
        senderAlias: senderAlias.trim(),
        paymentId: paymentData.id
      });

    } catch (error: any) {
      console.error('❌ CRITICAL: Upload submission error:', error);
      toast.error(language === 'ar' ? 
        `❌ فشل في إرسال الدفع: ${error.message}` : 
        `❌ Payment submission failed: ${error.message}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">
            {language === 'ar' ? 'رفع صورة الدفع' : 'Upload Payment Screenshot'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 
              `خطة ${selectedPlan === 'monthly' ? 'الشهرية' : 'السنوية'} - ${selectedPlan === 'monthly' ? '60' : '600'} ريال` :
              `${selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} Plan - ${selectedPlan === 'monthly' ? '60' : '600'} QAR`
            }
          </p>
        </div>
      </div>

      {/* Sender Alias Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'ar' ? 'الاسم المستعار للمرسل' : 'Sender Alias'}
          </CardTitle>
          <CardDescription>
            {language === 'ar' ? 
              'أدخل الاسم المستعار الذي ظهر في تطبيق البنك عند إرسال التحويل' :
              'Enter the sender alias that appeared in your banking app when sending the transfer'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="sender-alias">
            {language === 'ar' ? 'الاسم المستعار' : 'Sender Alias'}
          </Label>
          <Input
            id="sender-alias"
            value={senderAlias}
            onChange={(e) => setSenderAlias(e.target.value)}
            placeholder={language === 'ar' ? 'مثال: user12345' : 'Example: user12345'}
            className="mt-2"
            disabled={isUploading}
          />
        </CardContent>
      </Card>

      {/* Screenshot Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'ar' ? 'صورة تأكيد الدفع' : 'Payment Confirmation Screenshot'}
          </CardTitle>
          <CardDescription>
            {language === 'ar' ? 
              'ارفع صورة واضحة لشاشة تأكيد التحويل من تطبيق البنك' :
              'Upload a clear screenshot of the transfer confirmation from your banking app'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${uploadedFile ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} disabled={isUploading} />
            
            {uploadedFile ? (
              <div className="space-y-2">
                <FileImage className="h-12 w-12 mx-auto text-green-600" />
                <p className="font-medium text-green-700">
                  {uploadedFile.name}
                </p>
                <p className="text-sm text-green-600">
                  {language === 'ar' ? 'تم اختيار الصورة - انقر لتغيير' : 'Screenshot selected - click to change'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="font-medium">
                  {language === 'ar' ? 
                    'اسحب الصورة هنا أو انقر للاختيار' :
                    'Drag screenshot here or click to select'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 
                    'PNG, JPG, JPEG أو WEBP (حد أقصى 10 ميجابايت)' :
                    'PNG, JPG, JPEG or WEBP (max 10MB)'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Important Note */}
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {language === 'ar' ? '📸 نصائح للحصول على أفضل النتائج:' : '📸 Tips for best results:'}
                </p>
                <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
                  <li>• {language === 'ar' ? 'تأكد من وضوح النص والأرقام' : 'Ensure text and numbers are clear'}</li>
                  <li>• {language === 'ar' ? 'قم بتضمين المبلغ الكامل والاسم المستعار' : 'Include the full amount and alias name'}</li>
                  <li>• {language === 'ar' ? 'تجنب الظلال أو الانعكاسات' : 'Avoid shadows or reflections'}</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button 
        onClick={handleSubmit} 
        className="w-full" 
        size="lg"
        disabled={!uploadedFile || !senderAlias.trim() || isUploading}
      >
        {isUploading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {language === 'ar' ? 'جاري الإرسال...' : 'Submitting...'}
          </div>
        ) : (
          language === 'ar' ? '🚀 إرسال الدفع' : '🚀 Submit Payment'
        )}
      </Button>
    </div>
  );
}
