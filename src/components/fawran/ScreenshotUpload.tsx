
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, ArrowLeft, AlertCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';
import type { PlanType } from './FawranPaymentOverlay';

interface ScreenshotUploadProps {
  userEmail: string;
  selectedPlan: PlanType;
  onUploadComplete: (data: { screenshotUrl: string; senderAlias: string; paymentId: string }) => void;
  onBack: () => void;
}

export function ScreenshotUpload({ userEmail, selectedPlan, onUploadComplete, onBack }: ScreenshotUploadProps) {
  const { language } = useTheme();
  const { user, signOut } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [senderAlias, setSenderAlias] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const amount = selectedPlan === 'monthly' ? 60 : 600;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    // Validate file type
    const validTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(language === 'ar' ? 'نوع ملف غير صحيح' : 'Invalid file type', {
        description: language === 'ar' 
          ? 'يرجى اختيار صورة بصيغة PNG, JPG, JPEG, أو WebP'
          : 'Please select a PNG, JPG, JPEG, or WebP image'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الملف كبير جداً' : 'File too large', {
        description: language === 'ar' 
          ? 'يجب أن يكون حجم الملف أقل من 5 ميجابايت'
          : 'File size must be less than 5MB'
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !senderAlias.trim() || !user) {
      toast.error(language === 'ar' ? 'حقول مطلوبة' : 'Required fields', {
        description: language === 'ar' 
          ? 'يرجى اختيار صورة وإدخال الاسم المستعار'
          : 'Please select a screenshot and enter your alias'
      });
      return;
    }

    setIsUploading(true);
    console.log('Starting upload process...');

    try {
      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`;
      console.log('Uploading file:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('fawran-screenshots')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('File uploaded successfully:', uploadData);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fawran-screenshots')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Insert payment record
      const paymentRecord = {
        user_id: user.id,
        email: userEmail,
        plan_type: selectedPlan,
        amount: amount,
        screenshot_url: publicUrl,
        sender_alias: senderAlias.trim(),
        status: 'pending'
      };

      console.log('Inserting payment record:', paymentRecord);

      const { data: paymentData, error: paymentError } = await supabase
        .from('pending_fawran_payments')
        .insert(paymentRecord)
        .select()
        .single();

      if (paymentError) {
        console.error('Payment insert error:', paymentError);
        throw paymentError;
      }

      console.log('Payment record created:', paymentData);

      // Trigger analysis
      console.log('Triggering GPT-4 Vision analysis...');
      const { error: analysisError } = await supabase.functions.invoke('analyze-payment-screenshot', {
        body: { paymentId: paymentData.id }
      });

      if (analysisError) {
        console.error('Analysis trigger failed:', analysisError);
        // Don't throw - let it continue, analysis can be done manually
      } else {
        console.log('Analysis triggered successfully');
      }

      toast.success(language === 'ar' ? 'تم رفع الصورة بنجاح!' : 'Screenshot uploaded successfully!');

      onUploadComplete({
        screenshotUrl: publicUrl,
        senderAlias: senderAlias.trim(),
        paymentId: paymentData.id
      });

    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(language === 'ar' ? 'فشل في الرفع' : 'Upload failed', {
        description: language === 'ar' 
          ? 'حدث خطأ أثناء رفع الصورة. يرجى المحاولة مرة أخرى.'
          : 'An error occurred while uploading. Please try again.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
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

      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">
          {language === 'ar' ? 'رفع صورة التأكيد' : 'Upload Payment Screenshot'}
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          {language === 'ar' 
            ? `ارفع صورة تأكيد تحويل ${amount} QAR`
            : `Upload your ${amount} QAR transfer confirmation`
          }
        </p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Email Field */}
        <div>
          <Label htmlFor="email" className="text-sm sm:text-base">
            {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
          </Label>
          <Input
            id="email"
            type="email"
            value={userEmail}
            disabled
            className="bg-muted mt-2"
          />
        </div>

        {/* Sender Alias Field */}
        <div>
          <Label htmlFor="senderAlias" className="text-sm sm:text-base">
            {language === 'ar' ? 'اسمك المستعار في فوران' : 'Your Fawran Alias Name'}
          </Label>
          <Input
            id="senderAlias"
            type="text"
            value={senderAlias}
            onChange={(e) => setSenderAlias(e.target.value)}
            placeholder={language === 'ar' 
              ? 'أدخل اسمك المستعار في فوران أو رقم الهاتف المسجل'
              : 'Enter your Fawran alias or registered mobile number'
            }
            required
            className="mt-2"
          />
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {language === 'ar' 
              ? 'هذا الاسم يجب أن يطابق الاسم الظاهر في صورة التحويل'
              : 'This name must match the sender name shown in your transfer screenshot'
            }
          </p>
        </div>

        {/* Screenshot Upload */}
        <div>
          <Label htmlFor="screenshot" className="text-sm sm:text-base">
            {language === 'ar' ? 'صورة تأكيد التحويل' : 'Transfer Confirmation Screenshot'}
          </Label>
          <Card className="p-4 sm:p-6 border-dashed border-2 hover:border-primary/50 transition-colors mt-2">
            <div className="text-center">
              <Upload className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <div className="mb-4">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-input')?.click()}
                  className="w-full sm:w-auto text-sm sm:text-base"
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
              <p className="text-xs sm:text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'PNG, JPG, JPEG, WebP (حد أقصى 5 ميجابايت)'
                  : 'PNG, JPG, JPEG, WebP (max 5MB)'
                }
              </p>
              {selectedFile && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 break-all">
                    ✅ {selectedFile.name}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Important Notice */}
        <Card className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              <div className="font-medium mb-1">
                {language === 'ar' ? 'تأكد من وضوح الصورة' : 'Ensure Screenshot Clarity'}
              </div>
              <ul className="space-y-1 text-xs">
                <li>• {language === 'ar' ? 'المبلغ المحول واضح' : 'Transfer amount is clear'}</li>
                <li>• {language === 'ar' ? 'اسم المستلم (alfadlyqtr) ظاهر' : 'Recipient alias (alfadlyqtr) visible'}</li>
                <li>• {language === 'ar' ? 'تاريخ ووقت التحويل واضح' : 'Transfer date and time visible'}</li>
                <li>• {language === 'ar' ? 'رقم المرجع ظاهر' : 'Reference number visible'}</li>
                <li>• {language === 'ar' ? 'تأكد من وضوح اسم المرسل ومطابقته للإدخال أعلاه' : 'Make sure your alias name is clear and matches your above input'}</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Fraud Warning */}
        <div className="text-center p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-300">
            {language === 'ar' 
              ? '⚠️ الاحتيال لن يُتساهل معه وستكون عرضة للشروط القانونية'
              : '⚠️ Fraud will not be tolerated and you will be subject to legal terms'
            }
          </p>
        </div>

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
