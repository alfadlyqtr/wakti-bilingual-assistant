
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, ArrowLeft, AlertCircle, LogOut, X, FileImage, Clock, CheckCircle } from 'lucide-react';
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

// FIXED: More lenient rate limiting - only 3 uploads per hour, no 5-minute restriction
const checkRateLimit = async (): Promise<boolean> => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const { data: hourlyUploads } = await supabase
    .from('pending_fawran_payments')
    .select('submitted_at')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .gte('submitted_at', oneHourAgo.toISOString());

  // Only limit to 3 per hour, no 5-minute restriction
  return (hourlyUploads?.length || 0) < 3;
};

export function ScreenshotUpload({ userEmail, selectedPlan, onUploadComplete, onBack }: ScreenshotUploadProps) {
  const { language } = useTheme();
  const { user, signOut } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [senderAlias, setSenderAlias] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [imageHash, setImageHash] = useState<string>('');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [aliasError, setAliasError] = useState('');
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed'>('idle');
  const [processingMessage, setProcessingMessage] = useState('');

  const amount = selectedPlan === 'monthly' ? 60 : 600;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setImagePreview('');
    setImageHash('');
    setIsDuplicate(false);
    setProcessingStatus('idle');
    setProcessingMessage('');
    // Reset the file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const validateAlias = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setAliasError(language === 'ar' ? 'الاسم المستعار مطلوب' : 'Alias name is required');
      return false;
    }
    if (trimmedValue.length < 2) {
      setAliasError(language === 'ar' ? 'الاسم المستعار يجب أن يكون حرفين على الأقل' : 'Alias must be at least 2 characters');
      return false;
    }
    setAliasError('');
    return true;
  };

  const handleAliasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSenderAlias(value);
    if (value.trim()) {
      validateAlias(value);
    } else {
      setAliasError('');
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
        setIsDuplicate(true);
        toast.warning(language === 'ar' ? 'صورة مكررة' : 'Duplicate image detected', {
          description: language === 'ar' 
            ? 'هذه الصورة تم رفعها من قبل. يمكنك المتابعة أو اختيار صورة أخرى.'
            : 'This image has been uploaded before. You can continue or choose a different screenshot.'
        });
      } else {
        setIsDuplicate(false);
      }

      // Create image preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      setSelectedFile(file);
      console.log('File validation passed, hash generated:', hash.substring(0, 16) + '...');
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(language === 'ar' ? 'خطأ في معالجة الملف' : 'Error processing file');
    }
  };

  // CRITICAL: Robust payment submission with mandatory worker triggering
  const handleSubmit = async () => {
    if (!selectedFile || !senderAlias.trim()) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة وإدخال الاسم المستعار' : 'Please select an image and enter sender alias');
      return;
    }

    if (!validateAlias(senderAlias)) {
      return;
    }

    // Check rate limit (3 per hour only)
    const canUpload = await checkRateLimit();
    if (!canUpload) {
      toast.error(language === 'ar' ? 'تجاوزت الحد المسموح به' : 'Rate limit exceeded', {
        description: language === 'ar' 
          ? 'يمكنك رفع 3 صور كحد أقصى في الساعة'
          : 'You can upload up to 3 screenshots per hour'
      });
      return;
    }

    setIsUploading(true);
    setProcessingStatus('uploading');
    setProcessingMessage(language === 'ar' ? 'جاري رفع الصورة...' : 'Uploading screenshot...');

    console.log('🚀 CRITICAL FAWRAN UPLOAD STARTED - User:', userEmail, 'Plan:', selectedPlan, 'Amount:', amount);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('fawran-screenshots')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error('Failed to upload screenshot');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fawran-screenshots')
        .getPublicUrl(fileName);

      console.log('✅ Screenshot uploaded successfully:', publicUrl);

      setProcessingStatus('processing');
      setProcessingMessage(language === 'ar' ? 'جاري إنشاء السجل...' : 'Creating payment record...');

      // Create payment record in database
      const { data: paymentData, error: paymentError } = await supabase
        .from('pending_fawran_payments')
        .insert({
          user_id: user.id,
          email: userEmail,
          plan_type: selectedPlan,
          amount: amount,
          screenshot_url: publicUrl,
          sender_alias: senderAlias.trim(),
          screenshot_hash: imageHash,
          account_created_at: user.created_at,
          status: 'pending'
        })
        .select()
        .single();

      if (paymentError) {
        console.error('Payment record creation error:', paymentError);
        throw new Error('Failed to create payment record');
      }

      console.log('✅ Payment record created:', paymentData.id);

      // Store screenshot hash to prevent duplicates
      await supabase
        .from('screenshot_hashes')
        .insert({
          user_id: user.id,
          image_hash: imageHash,
          payment_id: paymentData.id
        });

      setProcessingMessage(language === 'ar' ? 'جاري تحليل الدفعة بالذكاء الاصطناعي...' : 'AI analyzing payment...');

      // CRITICAL: MANDATORY worker invocation with robust error handling and retry
      console.log('🔥 TRIGGERING FAWRAN WORKER - MANDATORY PROCESSING');
      
      let workerSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!workerSuccess && retryCount < maxRetries) {
        try {
          console.log(`🔄 Fawran Worker Attempt ${retryCount + 1}/${maxRetries}`);
          
          const { data: workerResult, error: workerError } = await supabase.functions.invoke('analyze-payment-screenshot', {
            body: { paymentId: paymentData.id }
          });

          if (workerError) {
            console.error(`❌ Worker attempt ${retryCount + 1} failed:`, workerError);
            throw workerError;
          }

          console.log('✅ Fawran Worker Success:', workerResult);
          workerSuccess = true;

        } catch (error) {
          retryCount++;
          console.error(`❌ Fawran Worker attempt ${retryCount} failed:`, error);
          
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying in ${retryCount} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
          }
        }
      }

      if (!workerSuccess) {
        console.error('🚨 CRITICAL: All worker attempts failed - Setting up manual processing fallback');
        
        // Update payment with processing failure note
        await supabase
          .from('pending_fawran_payments')
          .update({
            review_notes: JSON.stringify({
              worker_failed: true,
              retry_attempts: maxRetries,
              failed_at: new Date().toISOString(),
              manual_review_required: true
            })
          })
          .eq('id', paymentData.id);

        toast.warning(language === 'ar' ? 'جاري المراجعة اليدوية' : 'Manual review initiated', {
          description: language === 'ar' 
            ? 'سيتم مراجعة دفعتك يدوياً خلال دقائق'
            : 'Your payment will be reviewed manually within minutes'
        });

        setProcessingStatus('processing');
        setProcessingMessage(language === 'ar' ? 'جاري المراجعة اليدوية...' : 'Manual review in progress...');
      } else {
        setProcessingStatus('completed');
        setProcessingMessage(language === 'ar' ? 'تم التحليل بنجاح!' : 'Analysis completed successfully!');
      }

      // Call completion callback
      onUploadComplete({
        screenshotUrl: publicUrl,
        senderAlias: senderAlias.trim(),
        paymentId: paymentData.id
      });

      toast.success(language === 'ar' ? 'تم رفع الصورة بنجاح!' : 'Screenshot uploaded successfully!', {
        description: language === 'ar' 
          ? 'جاري مراجعة دفعتك الآن...'
          : 'Your payment is being reviewed now...'
      });

      console.log('🎉 FAWRAN UPLOAD COMPLETED SUCCESSFULLY');

    } catch (error: any) {
      console.error('🚨 CRITICAL FAWRAN UPLOAD ERROR:', error);
      setProcessingStatus('failed');
      setProcessingMessage(language === 'ar' ? 'فشل في العملية' : 'Process failed');
      
      toast.error(language === 'ar' ? 'فشل في رفع الصورة' : 'Upload failed', {
        description: error.message || (language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred')
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = () => {
    switch (processingStatus) {
      case 'uploading':
      case 'processing':
        return <Clock className="h-5 w-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
          
          <div className="flex items-center gap-2">
            <ThemeLanguageToggle />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-800"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Card */}
        <Card className="p-6 space-y-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {language === 'ar' ? 'رفع صورة الدفع' : 'Upload Payment Screenshot'}
            </h2>
            <p className="text-gray-600">
              {language === 'ar' 
                ? `خطة ${selectedPlan === 'monthly' ? 'شهرية' : 'سنوية'} - ${amount} ريال قطري`
                : `${selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} Plan - ${amount} QAR`
              }
            </p>
          </div>

          {/* File Upload Area */}
          <div className="space-y-4">
            <Label htmlFor="file-input" className="text-sm font-medium text-gray-700">
              {language === 'ar' ? 'صورة تحويل فوران' : 'Fawran Transfer Screenshot'}
            </Label>
            
            {!selectedFile ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                <input
                  id="file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600">
                    {language === 'ar' 
                      ? 'انقر لاختيار صورة أو اسحبها هنا'
                      : 'Click to select image or drag here'
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {language === 'ar' 
                      ? 'PNG, JPG, JPEG أو WebP (حد أقصى 5 ميجابايت)'
                      : 'PNG, JPG, JPEG or WebP (max 5MB)'
                    }
                  </p>
                </label>
              </div>
            ) : (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Screenshot preview" 
                  className="w-full h-48 object-contain bg-gray-50 rounded-lg border"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={clearSelectedFile}
                  className="absolute top-2 right-2 h-8 w-8 p-0"
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
                
                {isDuplicate && (
                  <div className="absolute bottom-2 left-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                    {language === 'ar' ? 'مكرر' : 'Duplicate'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sender Alias Input */}
          <div className="space-y-2">
            <Label htmlFor="sender-alias" className="text-sm font-medium text-gray-700">
              {language === 'ar' ? 'الاسم المستعار للمرسل' : 'Sender Alias'}
            </Label>
            <Input
              id="sender-alias"
              type="text"
              value={senderAlias}
              onChange={handleAliasChange}
              placeholder={language === 'ar' ? 'رقم الهاتف أو الاسم المستعار' : 'Phone number or alias'}
              className={`w-full ${aliasError ? 'border-red-500' : ''}`}
              disabled={isUploading}
            />
            {aliasError && (
              <p className="text-sm text-red-600">{aliasError}</p>
            )}
          </div>

          {/* Processing Status */}
          {processingStatus !== 'idle' && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {getStatusIcon()}
              <span className="text-sm text-gray-700">{processingMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedFile || !senderAlias.trim() || isUploading || !!aliasError}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 rounded-lg transition-all duration-200 disabled:opacity-50"
          >
            {isUploading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {language === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
              </div>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'رفع الصورة' : 'Upload Screenshot'}
              </>
            )}
          </Button>

          {/* Important Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">
                  {language === 'ar' ? 'ملاحظة مهمة:' : 'Important Note:'}
                </p>
                <p>
                  {language === 'ar' 
                    ? 'تأكد من وضوح تفاصيل التحويل في الصورة. سيتم مراجعة دفعتك خلال دقائق.'
                    : 'Ensure transfer details are clearly visible in the screenshot. Your payment will be reviewed within minutes.'
                  }
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
