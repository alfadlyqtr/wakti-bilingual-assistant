
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, ArrowLeft, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { PlanType } from './FawranPaymentOverlay';

interface ScreenshotUploadProps {
  userEmail: string;
  selectedPlan: PlanType;
  onUploadComplete: (data: { screenshotUrl: string; senderAlias: string; paymentId: string }) => void;
  onBack: () => void;
}

export function ScreenshotUpload({ userEmail, selectedPlan, onUploadComplete, onBack }: ScreenshotUploadProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [senderAlias, setSenderAlias] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const amount = selectedPlan === 'monthly' ? 60 : 600;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: language === 'ar' ? 'نوع ملف غير صحيح' : 'Invalid file type',
        description: language === 'ar' 
          ? 'يرجى اختيار صورة بصيغة PNG, JPG, JPEG, أو WebP'
          : 'Please select a PNG, JPG, JPEG, or WebP image',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: language === 'ar' ? 'حجم الملف كبير جداً' : 'File too large',
        description: language === 'ar' 
          ? 'يجب أن يكون حجم الملف أقل من 5 ميجابايت'
          : 'File size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !senderAlias.trim() || !user) {
      toast({
        title: language === 'ar' ? 'حقول مطلوبة' : 'Required fields',
        description: language === 'ar' 
          ? 'يرجى اختيار صورة وإدخال الاسم المستعار'
          : 'Please select a screenshot and enter your alias',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('fawran-screenshots')
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fawran-screenshots')
        .getPublicUrl(fileName);

      // Insert payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('pending_fawran_payments')
        .insert({
          user_id: user.id,
          email: userEmail,
          plan_type: selectedPlan,
          amount: amount,
          screenshot_url: publicUrl,
        })
        .select()
        .single();

      if (paymentError) {
        throw paymentError;
      }

      // Trigger analysis
      const { error: analysisError } = await supabase.functions.invoke('analyze-payment-screenshot', {
        body: { paymentId: paymentData.id }
      });

      if (analysisError) {
        console.error('Analysis trigger failed:', analysisError);
        // Don't throw - let it continue, analysis can be done manually
      }

      onUploadComplete({
        screenshotUrl: publicUrl,
        senderAlias: senderAlias.trim(),
        paymentId: paymentData.id
      });

    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: language === 'ar' ? 'فشل في الرفع' : 'Upload failed',
        description: language === 'ar' 
          ? 'حدث خطأ أثناء رفع الصورة. يرجى المحاولة مرة أخرى.'
          : 'An error occurred while uploading. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">
            {language === 'ar' ? 'رفع صورة التأكيد' : 'Upload Payment Screenshot'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? `ارفع صورة تأكيد تحويل ${amount} QAR`
              : `Upload your ${amount} QAR transfer confirmation`
            }
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Email Field */}
        <div>
          <Label htmlFor="email">
            {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
          </Label>
          <Input
            id="email"
            type="email"
            value={userEmail}
            disabled
            className="bg-muted"
          />
        </div>

        {/* Sender Alias Field */}
        <div>
          <Label htmlFor="senderAlias">
            {language === 'ar' ? 'اسمك المستعار في البنك' : 'Your Bank Alias Name'}
          </Label>
          <Input
            id="senderAlias"
            type="text"
            value={senderAlias}
            onChange={(e) => setSenderAlias(e.target.value)}
            placeholder={language === 'ar' 
              ? 'أدخل اسمك المستعار أو رقم الهاتف المسجل في البنك'
              : 'Enter your bank alias or registered mobile number'
            }
            required
          />
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'ar' 
              ? 'هذا الاسم يجب أن يطابق الاسم الظاهر في صورة التحويل'
              : 'This name must match the sender name shown in your transfer screenshot'
            }
          </p>
        </div>

        {/* Screenshot Upload */}
        <div>
          <Label htmlFor="screenshot">
            {language === 'ar' ? 'صورة تأكيد التحويل' : 'Transfer Confirmation Screenshot'}
          </Label>
          <Card className="p-6 border-dashed border-2 hover:border-primary/50 transition-colors">
            <div className="text-center">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <div className="mb-4">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  {language === 'ar' ? 'اختر صورة' : 'Choose Image'}
                </Button>
                <input
                  id="file-input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'PNG, JPG, JPEG, WebP (حد أقصى 5 ميجابايت)'
                  : 'PNG, JPG, JPEG, WebP (max 5MB)'
                }
              </p>
              {selectedFile && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    ✅ {selectedFile.name}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Important Notice */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <div className="font-medium mb-1">
                {language === 'ar' ? 'تأكد من وضوح الصورة' : 'Ensure Screenshot Clarity'}
              </div>
              <ul className="space-y-1 text-xs">
                <li>• {language === 'ar' ? 'المبلغ المحول واضح' : 'Transfer amount is clear'}</li>
                <li>• {language === 'ar' ? 'اسم المستلم (alfadlyqtr) ظاهر' : 'Recipient alias (alfadlyqtr) visible'}</li>
                <li>• {language === 'ar' ? 'تاريخ ووقت التحويل واضح' : 'Transfer date and time visible'}</li>
                <li>• {language === 'ar' ? 'رقم المرجع ظاهر' : 'Reference number visible'}</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit} 
          disabled={!selectedFile || !senderAlias.trim() || isUploading}
          className="w-full"
          size="lg"
        >
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {language === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
            </>
          ) : (
            language === 'ar' ? 'رفع وتأكيد الدفع' : 'Upload & Confirm Payment'
          )}
        </Button>
      </div>
    </div>
  );
}
