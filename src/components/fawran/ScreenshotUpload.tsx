
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

// Enhanced hash generation for image duplicate detection
const generateImageHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Rate limiting check
const checkRateLimit = async (): Promise<boolean> => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const { data: recentUploads } = await supabase
    .from('pending_fawran_payments')
    .select('submitted_at')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .gte('submitted_at', fiveMinutesAgo.toISOString());

  const { data: hourlyUploads } = await supabase
    .from('pending_fawran_payments')
    .select('submitted_at')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .gte('submitted_at', oneHourAgo.toISOString());

  return (recentUploads?.length || 0) === 0 && (hourlyUploads?.length || 0) < 3;
};

export function ScreenshotUpload({ userEmail, selectedPlan, onUploadComplete, onBack }: ScreenshotUploadProps) {
  const { language } = useTheme();
  const { user, signOut } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [senderAlias, setSenderAlias] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [imageHash, setImageHash] = useState<string>('');

  const amount = selectedPlan === 'monthly' ? 60 : 600;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      // Generate image hash for duplicate detection
      const hash = await generateImageHash(file);
      setImageHash(hash);
      
      // Check for duplicate hash in screenshot_hashes table
      const { data: existingHash } = await supabase
        .from('screenshot_hashes')
        .select('id')
        .eq('image_hash', hash)
        .maybeSingle();

      if (existingHash) {
        toast.error(language === 'ar' ? 'صورة مكررة' : 'Duplicate image detected', {
          description: language === 'ar' 
            ? 'هذه الصورة تم رفعها من قبل. يرجى استخدام صورة أخرى.'
            : 'This image has been uploaded before. Please use a different screenshot.'
        });
        return;
      }

      setSelectedFile(file);
      console.log('File validation passed, hash generated:', hash.substring(0, 16) + '...');
    } catch (error) {
      console.error('Hash generation failed:', error);
      toast.error(language === 'ar' ? 'خطأ في معالجة الصورة' : 'Image processing error');
    }
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

    // Rate limiting check
    const canUpload = await checkRateLimit();
    if (!canUpload) {
      toast.error(language === 'ar' ? 'تم تجاوز الحد المسموح' : 'Rate limit exceeded', {
        description: language === 'ar' 
          ? 'يمكنك رفع صورة واحدة كل 5 دقائق، بحد أقصى 3 صور في الساعة'
          : 'You can upload one image every 5 minutes, maximum 3 per hour'
      });
      return;
    }

    setIsUploading(true);
    console.log('Starting upload process with enhanced debugging...');

    try {
      // Get user creation time for validation
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        console.error('User authentication error:', userError);
        throw new Error('User not authenticated');
      }

      console.log('User authenticated, proceeding with upload...');

      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`;
      console.log('Uploading file to storage:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('fawran-screenshots')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('File uploaded successfully to storage:', uploadData);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fawran-screenshots')
        .getPublicUrl(fileName);

      console.log('Generated public URL:', publicUrl);

      // Store screenshot hash first
      console.log('Storing screenshot hash...');
      const { error: hashError } = await supabase
        .from('screenshot_hashes')
        .insert({
          user_id: user.id,
          image_hash: imageHash
        });

      if (hashError) {
        console.error('Hash storage error (continuing anyway):', hashError);
      }

      // Insert payment record with all required fields
      const paymentRecord = {
        user_id: user.id,
        email: userEmail,
        plan_type: selectedPlan,
        amount: amount,
        screenshot_url: publicUrl,
        sender_alias: senderAlias.trim(),
        status: 'pending',
        screenshot_hash: imageHash,
        account_created_at: userData.user.created_at,
        time_validation_passed: false,
        tampering_detected: false,
        duplicate_detected: false,
        payment_reference_number: null,
        transaction_reference_number: null
      };

      console.log('Inserting payment record:', paymentRecord);

      const { data: paymentData, error: paymentError } = await supabase
        .from('pending_fawran_payments')
        .insert(paymentRecord)
        .select()
        .single();

      if (paymentError) {
        console.error('Payment record insert error:', paymentError);
        throw new Error(`Database insert failed: ${paymentError.message}`);
      }

      console.log('Payment record created successfully:', paymentData);

      // Update screenshot hash with payment ID
      if (paymentData.id) {
        await supabase
          .from('screenshot_hashes')
          .update({ payment_id: paymentData.id })
          .eq('image_hash', imageHash);
      }

      // Trigger GPT-4 Vision analysis (optional, don't fail if this errors)
      try {
        console.log('Triggering GPT-4 Vision analysis...');
        const { error: analysisError } = await supabase.functions.invoke('analyze-payment-screenshot', {
          body: { paymentId: paymentData.id }
        });

        if (analysisError) {
          console.warn('Analysis trigger failed (non-critical):', analysisError);
        } else {
          console.log('GPT-4 Vision analysis triggered successfully');
        }
      } catch (analysisErr) {
        console.warn('Analysis invocation failed (non-critical):', analysisErr);
      }

      toast.success(language === 'ar' ? 'تم رفع الصورة بنجاح!' : 'Screenshot uploaded successfully!');

      onUploadComplete({
        screenshotUrl: publicUrl,
        senderAlias: senderAlias.trim(),
        paymentId: paymentData.id
      });

    } catch (error) {
      console.error('Complete upload process failed:', error);
      toast.error(language === 'ar' ? 'فشل في الرفع' : 'Upload failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
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
            ? '✅ تم إنشاء حسابك وتأكيد البريد الإلكتروني - شكراً لك! ارفع صورة تأكيد التحويل لإكمال التفعيل 👇'
            : '✅ Your account created and email confirmed - thank you! Upload your transfer confirmation screenshot to complete activation 👇'
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
                  {imageHash && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Hash: {imageHash.substring(0, 16)}...
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Enhanced Security Notice */}
        <Card className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              <div className="font-medium mb-1">
                {language === 'ar' ? 'نظام الأمان المحسن' : 'Enhanced Security System'}
              </div>
              <ul className="space-y-1 text-xs">
                <li>• {language === 'ar' ? 'فحص الصور المكررة تلقائياً' : 'Automatic duplicate image detection'}</li>
                <li>• {language === 'ar' ? 'كشف التلاعب بالصور' : 'Image tampering detection'}</li>
                <li>• {language === 'ar' ? 'تحقق من توقيت التحويل' : 'Transfer timing verification'}</li>
                <li>• {language === 'ar' ? 'فحص أرقام المراجع' : 'Reference number validation'}</li>
                <li>• {language === 'ar' ? 'معالجة خلال 90 ثانية' : '90-second processing guarantee'}</li>
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
              {language === 'ar' ? 'جاري المعالجة المحسنة...' : 'Enhanced Processing...'}
            </>
          ) : (
            language === 'ar' ? 'رفع وتأكيد الدفع' : 'Upload & Confirm Payment'
          )}
        </Button>
      </div>
    </div>
  );
}
