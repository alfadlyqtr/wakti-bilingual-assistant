import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, SkipForward, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export interface QuestionOption {
  id: string;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  icon?: React.ReactNode;
}

export interface ClarifyingQuestion {
  id: string;
  category: string;
  categoryAr: string;
  question: string;
  questionAr: string;
  options: QuestionOption[];
  allowMultiple?: boolean;
}

interface ClarifyingQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: ClarifyingQuestion[];
  onComplete: (answers: Record<string, string | string[]>) => void;
  onSkip: () => void;
  isRTL?: boolean;
}

export const ClarifyingQuestionsModal: React.FC<ClarifyingQuestionsModalProps> = ({
  isOpen,
  onClose,
  questions,
  onComplete,
  onSkip,
  isRTL = false,
}) => {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const currentQuestion = questions[currentStep];
  const isLastStep = currentStep === questions.length - 1;
  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleOptionSelect = useCallback((optionId: string) => {
    if (currentQuestion.allowMultiple) {
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  }, [currentQuestion?.allowMultiple]);

  const handleNext = useCallback(() => {
    if (selectedOptions.length === 0) return;

    const answer = currentQuestion.allowMultiple ? selectedOptions : selectedOptions[0];
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    if (isLastStep) {
      onComplete(newAnswers);
    } else {
      setCurrentStep(prev => prev + 1);
      setSelectedOptions([]);
    }
  }, [selectedOptions, currentQuestion, answers, isLastStep, onComplete]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      const prevQuestion = questions[currentStep - 1];
      const prevAnswer = answers[prevQuestion.id];
      setSelectedOptions(Array.isArray(prevAnswer) ? prevAnswer : prevAnswer ? [prevAnswer] : []);
    }
  }, [currentStep, questions, answers]);

  const handleSkipAll = useCallback(() => {
    onSkip();
    onClose();
  }, [onSkip, onClose]);

  if (!isOpen || !currentQuestion) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}
        >
          {/* Progress Bar */}
          <div className="h-1 bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {isArabic ? 'قبل أن أبدأ...' : 'Before I proceed...'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Category Chip */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full border border-primary/20">
                {isArabic ? currentQuestion.categoryAr : currentQuestion.category}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Question */}
            <h3 className="text-lg font-semibold text-foreground mb-6">
              {isArabic ? currentQuestion.questionAr : currentQuestion.question}
            </h3>

            {/* Options Grid */}
            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedOptions.includes(option.id);
                return (
                  <motion.button
                    key={option.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOptionSelect(option.id)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2"
                      >
                        <Check className="w-4 h-4 text-primary" />
                      </motion.div>
                    )}
                    <div className="flex flex-col gap-1">
                      {option.icon && (
                        <div className="mb-1 text-muted-foreground">
                          {option.icon}
                        </div>
                      )}
                      <span className="font-medium text-foreground text-sm">
                        {isArabic ? option.labelAr : option.label}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {isArabic ? option.descriptionAr : option.description}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-between p-4 border-t border-border bg-muted/30 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {currentStep > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="gap-1"
                >
                  {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  {isArabic ? 'السابق' : 'Back'}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipAll}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <SkipForward className="w-4 h-4" />
                {isArabic ? 'تخطي الكل' : 'Skip all'}
              </Button>
            </div>
            
            <Button
              size="sm"
              onClick={handleNext}
              disabled={selectedOptions.length === 0}
              className="gap-1 min-w-[100px]"
            >
              {isLastStep ? (
                <>
                  {isArabic ? 'إنهاء' : 'Done'}
                  <Check className="w-4 h-4" />
                </>
              ) : (
                <>
                  {isArabic ? 'التالي' : 'Next'}
                  {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </Button>
          </div>

          {/* Step Indicator */}
          <div className="flex justify-center gap-1.5 pb-4">
            {questions.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentStep
                    ? 'bg-primary w-6'
                    : index < currentStep
                    ? 'bg-primary/50'
                    : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Pre-defined question templates for common features
export const QUESTION_TEMPLATES: Record<string, ClarifyingQuestion[]> = {
  authentication: [
    {
      id: 'auth_method',
      category: 'Auth Method',
      categoryAr: 'طريقة المصادقة',
      question: 'How should users authenticate?',
      questionAr: 'كيف يجب على المستخدمين المصادقة؟',
      options: [
        { id: 'email', label: 'Email/Password', labelAr: 'البريد/كلمة المرور', description: 'Traditional email and password login', descriptionAr: 'تسجيل دخول تقليدي بالبريد وكلمة المرور' },
        { id: 'social', label: 'Social Login', labelAr: 'تسجيل اجتماعي', description: 'Login with Google, GitHub, etc.', descriptionAr: 'تسجيل الدخول عبر Google, GitHub, إلخ' },
        { id: 'magic', label: 'Magic Link', labelAr: 'رابط سحري', description: 'Passwordless email link', descriptionAr: 'رابط بريد إلكتروني بدون كلمة مرور' },
        { id: 'otp', label: 'Phone OTP', labelAr: 'رمز الهاتف', description: 'SMS verification code', descriptionAr: 'رمز تحقق عبر الرسائل النصية' },
      ],
    },
  ],
  dashboard: [
    {
      id: 'layout_style',
      category: 'Layout Style',
      categoryAr: 'نمط التخطيط',
      question: 'What layout style do you prefer?',
      questionAr: 'ما نمط التخطيط الذي تفضله؟',
      options: [
        { id: 'sidebar', label: 'Sidebar', labelAr: 'شريط جانبي', description: 'Fixed sidebar navigation', descriptionAr: 'تنقل بشريط جانبي ثابت' },
        { id: 'tabs', label: 'Tabs', labelAr: 'علامات تبويب', description: 'Tab-based navigation', descriptionAr: 'تنقل بعلامات التبويب' },
        { id: 'cards', label: 'Cards', labelAr: 'بطاقات', description: 'Card-based grid layout', descriptionAr: 'تخطيط شبكي بالبطاقات' },
        { id: 'minimal', label: 'Minimal', labelAr: 'بسيط', description: 'Clean, minimal interface', descriptionAr: 'واجهة نظيفة وبسيطة' },
      ],
    },
  ],
  forms: [
    {
      id: 'validation_type',
      category: 'Validation',
      categoryAr: 'التحقق',
      question: 'What type of validation do you need?',
      questionAr: 'ما نوع التحقق الذي تحتاجه؟',
      options: [
        { id: 'client', label: 'Client-side', labelAr: 'من جهة العميل', description: 'Instant feedback as user types', descriptionAr: 'ردود فعل فورية أثناء الكتابة' },
        { id: 'server', label: 'Server-side', labelAr: 'من جهة الخادم', description: 'Validate on submit', descriptionAr: 'التحقق عند الإرسال' },
        { id: 'both', label: 'Both', labelAr: 'كلاهما', description: 'Client + server validation', descriptionAr: 'تحقق من العميل والخادم' },
        { id: 'minimal', label: 'Minimal', labelAr: 'الحد الأدنى', description: 'Basic required field checks', descriptionAr: 'فحوصات أساسية للحقول المطلوبة' },
      ],
    },
  ],
  admin: [
    {
      id: 'access_control',
      category: 'Access Control',
      categoryAr: 'التحكم بالوصول',
      question: 'How should access be controlled?',
      questionAr: 'كيف يجب التحكم بالوصول؟',
      options: [
        { id: 'roles', label: 'Role-based', labelAr: 'حسب الدور', description: 'Admin, Editor, Viewer roles', descriptionAr: 'أدوار: مدير، محرر، مشاهد' },
        { id: 'permissions', label: 'Permissions', labelAr: 'الصلاحيات', description: 'Granular permission system', descriptionAr: 'نظام صلاحيات مفصل' },
        { id: 'both', label: 'Roles + Permissions', labelAr: 'أدوار + صلاحيات', description: 'Full RBAC system', descriptionAr: 'نظام RBAC كامل' },
        { id: 'simple', label: 'Simple Admin', labelAr: 'مدير بسيط', description: 'Just admin/user distinction', descriptionAr: 'فقط تمييز مدير/مستخدم' },
      ],
    },
  ],
  notifications: [
    {
      id: 'notification_type',
      category: 'Notification Type',
      categoryAr: 'نوع الإشعارات',
      question: 'What types of notifications do you need?',
      questionAr: 'ما أنواع الإشعارات التي تحتاجها؟',
      allowMultiple: true,
      options: [
        { id: 'inapp', label: 'In-app', labelAr: 'داخل التطبيق', description: 'Toast and bell notifications', descriptionAr: 'إشعارات منبثقة وجرس' },
        { id: 'email', label: 'Email', labelAr: 'البريد الإلكتروني', description: 'Email notifications', descriptionAr: 'إشعارات عبر البريد' },
        { id: 'push', label: 'Push', labelAr: 'دفع', description: 'Browser push notifications', descriptionAr: 'إشعارات دفع المتصفح' },
        { id: 'sms', label: 'SMS', labelAr: 'رسائل نصية', description: 'Text message alerts', descriptionAr: 'تنبيهات برسائل نصية' },
      ],
    },
  ],
};

export default ClarifyingQuestionsModal;
