import React, { useState, useRef, useCallback } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Camera,
  Sparkles,
  User,
  Building2,
  Mail,
  Phone,
  Globe,
  Image as ImageIcon,
  Check,
  X,
  FileText,
  Loader2,
} from 'lucide-react';

interface BusinessCardData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  website: string;
  logoUrl: string;
  profilePhotoUrl: string;
}

interface BusinessCardWizardProps {
  onComplete: (data: BusinessCardData) => void;
  onCancel: () => void;
}

const translations = {
  en: {
    // Step titles
    step1Title: "First things first... what's your name?",
    step2Title: "How can people reach you?",
    step3Title: "What professional details should your card display?",
    step4Title: "Next, let's add your logo!",
    step5Title: "Finally, add a profile picture",
    
    // Subtitles
    logoSubtitle: "A logo makes your card stand out and look professional",
    photoSubtitle: "A profile picture makes your card easier to remember",
    
    // Fields
    firstName: "First name",
    lastName: "Last name",
    workEmail: "Work email",
    phoneNumber: "Phone number",
    companyName: "Company name",
    jobTitle: "Job title",
    companyWebsite: "Company website",
    
    // Buttons
    continue: "Continue",
    back: "Back",
    skip: "Not now",
    finish: "Create My Card",
    
    // Upload options
    selectFromLibrary: "Select from photo library",
    useCamera: "Use camera",
    autoDetectLogo: "Auto-detect my logo",
    removeLogo: "Remove logo",
    removePhoto: "Remove picture",
    
    // Alternative path
    orUploadResume: "Or upload your resume",
    aiWillExtract: "AI will extract your details automatically",
    uploadResume: "Upload Resume/CV",
    
    // Validation
    required: "required",
    
    // Progress
    stepOf: "Step {current} of {total}",
  },
  ar: {
    step1Title: "أولاً... ما اسمك؟",
    step2Title: "كيف يمكن للناس التواصل معك؟",
    step3Title: "ما التفاصيل المهنية التي يجب أن تظهر على بطاقتك؟",
    step4Title: "الآن، لنضف شعارك!",
    step5Title: "أخيراً، أضف صورتك الشخصية",
    
    logoSubtitle: "الشعار يجعل بطاقتك مميزة واحترافية",
    photoSubtitle: "الصورة الشخصية تجعل بطاقتك أسهل للتذكر",
    
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    workEmail: "البريد الإلكتروني للعمل",
    phoneNumber: "رقم الهاتف",
    companyName: "اسم الشركة",
    jobTitle: "المسمى الوظيفي",
    companyWebsite: "موقع الشركة",
    
    continue: "متابعة",
    back: "رجوع",
    skip: "ليس الآن",
    finish: "إنشاء بطاقتي",
    
    selectFromLibrary: "اختر من مكتبة الصور",
    useCamera: "استخدم الكاميرا",
    autoDetectLogo: "اكتشاف الشعار تلقائياً",
    removeLogo: "إزالة الشعار",
    removePhoto: "إزالة الصورة",
    
    orUploadResume: "أو ارفع سيرتك الذاتية",
    aiWillExtract: "سيستخرج الذكاء الاصطناعي بياناتك تلقائياً",
    uploadResume: "رفع السيرة الذاتية",
    
    required: "مطلوب",
    
    stepOf: "الخطوة {current} من {total}",
  },
};

const TOTAL_STEPS = 5;

export const BusinessCardWizard: React.FC<BusinessCardWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const { language } = useTheme();
  const { user } = useAuth();
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState<BusinessCardData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    jobTitle: '',
    website: '',
    logoUrl: '',
    profilePhotoUrl: '',
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const updateField = (field: keyof BusinessCardData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1:
        return formData.firstName.trim().length > 0;
      case 2:
      case 3:
      case 4:
      case 5:
        return true; // Optional steps
      default:
        return true;
    }
  }, [currentStep, formData.firstName]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      onCancel();
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const uploadImage = async (file: File, folder: 'logos' | 'photos'): Promise<string | null> => {
    if (!user) return null;
    
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('business-card-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('business-card-assets')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload image. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = await uploadImage(file, 'logos');
    if (url) {
      updateField('logoUrl', url);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = await uploadImage(file, 'photos');
    if (url) {
      updateField('profilePhotoUrl', url);
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = await uploadImage(file, 'photos');
    if (url) {
      updateField('profilePhotoUrl', url);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      // Read file as base64
      const reader = new FileReader();
      const fileContent = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 content after the data URL prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call AI to extract details from resume
      const { data, error } = await supabase.functions.invoke('extract-resume-data', {
        body: {
          fileContent,
          fileName: file.name,
          mimeType: file.type,
        },
      });

      if (error) throw error;

      if (data?.extracted) {
        const extracted = data.extracted;
        
        // Auto-fill form fields
        if (extracted.firstName) updateField('firstName', extracted.firstName);
        if (extracted.lastName) updateField('lastName', extracted.lastName);
        if (extracted.email) updateField('email', extracted.email);
        if (extracted.phone) updateField('phone', extracted.phone);
        if (extracted.companyName) updateField('companyName', extracted.companyName);
        if (extracted.jobTitle) updateField('jobTitle', extracted.jobTitle);
        if (extracted.website) updateField('website', extracted.website);

        toast({
          title: isRTL ? 'تم استخراج البيانات!' : 'Data Extracted!',
          description: isRTL 
            ? 'تم ملء بياناتك تلقائياً من السيرة الذاتية'
            : 'Your details have been auto-filled from the resume',
        });

        // Move to next step if we have first name
        if (extracted.firstName) {
          setCurrentStep(2);
        }
      } else {
        toast({
          title: isRTL ? 'لم يتم العثور على بيانات' : 'No Data Found',
          description: isRTL 
            ? 'لم نتمكن من استخراج البيانات. يرجى إدخالها يدوياً'
            : 'Could not extract data. Please enter manually.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Resume extraction error:', error);
      toast({
        title: isRTL ? 'فشل الاستخراج' : 'Extraction Failed',
        description: isRTL 
          ? 'حدث خطأ أثناء معالجة السيرة الذاتية'
          : 'Error processing resume. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
    }
  };

  // Progress bar component - Premium stepped design
  const ProgressBar = () => (
    <div className="flex items-center justify-center gap-3 w-full max-w-sm mx-auto mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const stepNum = i + 1;
        const isCompleted = currentStep > stepNum;
        const isCurrent = currentStep === stepNum;
        
        return (
          <React.Fragment key={i}>
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                    : isCurrent
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/40 ring-4 ring-blue-500/20'
                      : 'bg-white/10 text-muted-foreground border border-white/20'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  stepNum
                )}
              </div>
            </div>
            
            {/* Connector line */}
            {i < TOTAL_STEPS - 1 && (
              <div
                className={`h-0.5 flex-1 max-w-8 rounded-full transition-all duration-300 ${
                  currentStep > stepNum
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : 'bg-white/10'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Step 1: Name
  const renderStep1 = () => (
    <div className="flex flex-col gap-6">
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">
          {t.firstName} <span className="text-blue-400">({t.required})</span>
        </label>
        <Input
          value={formData.firstName}
          onChange={(e) => updateField('firstName', e.target.value)}
          placeholder={t.firstName}
          className="h-14 text-lg bg-white/5 border-2 border-border focus:border-blue-500 rounded-xl"
          autoFocus
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">{t.lastName}</label>
        <Input
          value={formData.lastName}
          onChange={(e) => updateField('lastName', e.target.value)}
          placeholder={t.lastName}
          className="h-14 text-lg bg-white/5 border-2 border-border focus:border-blue-500 rounded-xl"
        />
      </div>
    </div>
  );

  // Step 2: Contact
  const renderStep2 = () => (
    <div className="flex flex-col gap-6">
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">{t.workEmail}</label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder={t.workEmail}
          className="h-14 text-lg bg-white/5 border-2 border-border focus:border-blue-500 rounded-xl"
          autoFocus
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">{t.phoneNumber}</label>
        <Input
          type="tel"
          value={formData.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          placeholder={t.phoneNumber}
          className="h-14 text-lg bg-white/5 border-2 border-border focus:border-blue-500 rounded-xl"
        />
      </div>
    </div>
  );

  // Step 3: Professional
  const renderStep3 = () => (
    <div className="flex flex-col gap-6">
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">{t.companyName}</label>
        <Input
          value={formData.companyName}
          onChange={(e) => updateField('companyName', e.target.value)}
          placeholder={t.companyName}
          className="h-14 text-lg bg-white/5 border-2 border-border focus:border-blue-500 rounded-xl"
          autoFocus
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">{t.jobTitle}</label>
        <Input
          value={formData.jobTitle}
          onChange={(e) => updateField('jobTitle', e.target.value)}
          placeholder={t.jobTitle}
          className="h-14 text-lg bg-white/5 border-2 border-border focus:border-blue-500 rounded-xl"
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">{t.companyWebsite}</label>
        <Input
          type="url"
          value={formData.website}
          onChange={(e) => updateField('website', e.target.value)}
          placeholder="https://example.com"
          className="h-14 text-lg bg-white/5 border-2 border-border focus:border-blue-500 rounded-xl"
        />
      </div>
    </div>
  );

  // Step 4: Logo
  const renderStep4 = () => (
    <div className="flex flex-col items-center gap-6">
      {/* Logo Preview */}
      <div className="w-full aspect-square max-w-[280px] rounded-2xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
        {formData.logoUrl ? (
          <img
            src={formData.logoUrl}
            alt="Logo"
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <ImageIcon className="w-16 h-16 text-white/20" />
        )}
      </div>

      {/* Upload Options */}
      <div className="w-full flex flex-col gap-3">
        {formData.website && (
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-border bg-white/5 hover:bg-white/10 transition-all"
            onClick={() => {
              // TODO: Implement auto-detect logo from website
              toast({ title: 'Coming soon', description: 'Auto-detect logo feature coming soon!' });
            }}
          >
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="underline">{t.autoDetectLogo}</span>
          </button>
        )}
        
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-border bg-white/5 hover:bg-white/10 transition-all"
          onClick={() => logoInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          <span className="underline">{t.selectFromLibrary}</span>
        </button>

        {formData.logoUrl && (
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 py-3 text-red-400 hover:text-red-300 transition-all"
            onClick={() => updateField('logoUrl', '')}
          >
            <X className="w-4 h-4" />
            <span className="underline">{t.removeLogo}</span>
          </button>
        )}
      </div>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoSelect}
      />
    </div>
  );

  // Step 5: Profile Photo
  const renderStep5 = () => (
    <div className="flex flex-col items-center gap-6">
      {/* Photo Preview */}
      <div className="w-full aspect-square max-w-[280px] rounded-2xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
        {formData.profilePhotoUrl ? (
          <img
            src={formData.profilePhotoUrl}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-16 h-16 text-white/20" />
        )}
      </div>

      {/* Upload Options */}
      <div className="w-full flex flex-col gap-3">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-border bg-white/5 hover:bg-white/10 transition-all"
          onClick={() => photoInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          <span className="underline">{t.selectFromLibrary}</span>
        </button>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-border bg-white/5 hover:bg-white/10 transition-all"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
        >
          <Camera className="w-5 h-5" />
          <span className="underline">{t.useCamera}</span>
        </button>

        {formData.profilePhotoUrl && (
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 py-3 text-red-400 hover:text-red-300 transition-all"
            onClick={() => updateField('profilePhotoUrl', '')}
          >
            <X className="w-4 h-4" />
            <span className="underline">{t.removePhoto}</span>
          </button>
        )}
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleCameraCapture}
      />
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return t.step1Title;
      case 2: return t.step2Title;
      case 3: return t.step3Title;
      case 4: return t.step4Title;
      case 5: return t.step5Title;
      default: return '';
    }
  };

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 4: return t.logoSubtitle;
      case 5: return t.photoSubtitle;
      default: return null;
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return null;
    }
  };

  const isOptionalStep = currentStep >= 2;

  return (
    <div
      className={`flex flex-col h-full bg-gradient-to-b from-background via-background to-blue-500/5 ${isRTL ? 'rtl' : 'ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header with back button */}
      <div className="flex items-center px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className={`w-6 h-6 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="px-6">
        <ProgressBar />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-2">{getStepTitle()}</h1>
        
        {/* Subtitle */}
        {getStepSubtitle() && (
          <p className="text-muted-foreground mb-6">{getStepSubtitle()}</p>
        )}

        {/* Step Content */}
        <div className="mt-6">
          {renderCurrentStep()}
        </div>

        {/* Resume Upload Option (Step 1 only) */}
        {currentStep === 1 && (
          <div className="mt-10 pt-6 border-t border-white/10">
            <p className="text-center text-muted-foreground mb-4">{t.orUploadResume}</p>
            <p className="text-center text-xs text-muted-foreground/60 mb-4">{t.aiWillExtract}</p>
            <button
              type="button"
              disabled={isUploading}
              className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-dashed transition-all ${
                isUploading 
                  ? 'border-purple-500/60 bg-purple-500/20 cursor-wait' 
                  : 'border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20'
              }`}
              onClick={() => resumeInputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="text-purple-400 font-medium">
                    {isRTL ? 'جاري استخراج البيانات...' : 'Extracting data...'}
                  </span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="text-purple-400 font-medium">{t.uploadResume}</span>
                </>
              )}
            </button>
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={isUploading}
            />
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="shrink-0 px-6 pb-6 pt-2 space-y-3">
        <Button
          onClick={handleNext}
          disabled={!canProceed() || isUploading}
          className={`w-full h-14 text-lg font-semibold rounded-xl transition-all ${
            canProceed()
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {currentStep === TOTAL_STEPS ? t.finish : t.continue}
        </Button>

        {isOptionalStep && currentStep < TOTAL_STEPS && (
          <button
            type="button"
            onClick={handleSkip}
            className="w-full py-3 text-muted-foreground hover:text-foreground underline transition-colors"
          >
            {t.skip}
          </button>
        )}
      </div>
    </div>
  );
};

export default BusinessCardWizard;
