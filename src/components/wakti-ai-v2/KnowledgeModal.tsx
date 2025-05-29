
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Brain, Sparkles, User, Target } from 'lucide-react';

interface KnowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeModal({ open, onOpenChange }: KnowledgeModalProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    mainUse: '',
    role: '',
    interests: [] as string[],
    personalNote: ''
  });

  const roleOptions = [
    { value: 'student', label: language === 'ar' ? 'طالب' : 'Student', icon: '🎓' },
    { value: 'professional', label: language === 'ar' ? 'موظف' : 'Professional', icon: '💼' },
    { value: 'entrepreneur', label: language === 'ar' ? 'رائد أعمال' : 'Entrepreneur', icon: '🚀' },
    { value: 'creative', label: language === 'ar' ? 'مبدع' : 'Creative', icon: '🎨' },
    { value: 'parent', label: language === 'ar' ? 'والد/والدة' : 'Parent', icon: '👨‍👩‍👧‍👦' },
    { value: 'freelancer', label: language === 'ar' ? 'مستقل' : 'Freelancer', icon: '💻' }
  ];

  const interestOptions = [
    { value: 'productivity', label: language === 'ar' ? 'الإنتاجية' : 'Productivity', icon: '⚡' },
    { value: 'learning', label: language === 'ar' ? 'التعلم' : 'Learning', icon: '📚' },
    { value: 'fitness', label: language === 'ar' ? 'اللياقة' : 'Fitness', icon: '💪' },
    { value: 'creativity', label: language === 'ar' ? 'الإبداع' : 'Creativity', icon: '🎨' },
    { value: 'business', label: language === 'ar' ? 'الأعمال' : 'Business', icon: '📈' },
    { value: 'technology', label: language === 'ar' ? 'التكنولوجيا' : 'Technology', icon: '💻' },
    { value: 'health', label: language === 'ar' ? 'الصحة' : 'Health', icon: '🏥' },
    { value: 'travel', label: language === 'ar' ? 'السفر' : 'Travel', icon: '✈️' }
  ];

  // Load existing knowledge when modal opens
  useEffect(() => {
    if (open && user) {
      loadExistingKnowledge();
    }
  }, [open, user]);

  const loadExistingKnowledge = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_user_knowledge')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setFormData({
          mainUse: data.main_use || '',
          role: data.role || '',
          interests: data.interests || [],
          personalNote: data.personal_note || ''
        });
      }
    } catch (error) {
      console.error('Error loading knowledge:', error);
    }
  };

  const handleInterestChange = (interest: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      interests: checked 
        ? [...prev.interests, interest]
        : prev.interests.filter(i => i !== interest)
    }));
  };

  const handleSubmit = async () => {
    if (!user) {
      localStorage.setItem('wakti_ai_knowledge', JSON.stringify(formData));
      toast({
        title: language === 'ar' ? '✅ تم الحفظ محلياً' : '✅ Saved Locally',
        description: language === 'ar' ? 'تم حفظ معلوماتك محلياً' : 'Your information has been saved locally'
      });
      onOpenChange(false);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('ai_user_knowledge')
        .upsert({
          user_id: user.id,
          main_use: formData.mainUse,
          role: formData.role,
          interests: formData.interests,
          personal_note: formData.personalNote,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: language === 'ar' ? '✅ تم التحسين' : '✅ AI Enhanced',
        description: language === 'ar' ? 'سيقوم WAKTI AI الآن بتخصيص الردود لك' : 'Wakti AI will now personalize responses for you'
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving knowledge:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في حفظ المعلومات' : 'Failed to save information',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return formData.mainUse.trim().length > 0;
      case 2: return formData.role.length > 0;
      case 3: return formData.interests.length > 0;
      default: return true;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {language === 'ar' ? 'هدفك الأساسي' : 'Your Main Goal'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'كيف تريد أن يساعدك WAKTI AI؟' : 'How do you want Wakti AI to help you?'}
                </p>
              </div>
            </div>
            
            <Textarea
              value={formData.mainUse}
              onChange={(e) => setFormData(prev => ({ ...prev, mainUse: e.target.value }))}
              placeholder={language === 'ar' 
                ? 'مثال: أريد تنظيم مهامي اليومية وتذكيري بالمواعيد المهمة...' 
                : 'e.g., I want to organize my daily tasks and remind me of important appointments...'}
              rows={4}
              className={language === 'ar' ? 'text-right' : ''}
            />
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 {language === 'ar' 
                  ? 'كلما كنت أكثر تفصيلاً، كان WAKTI AI أفضل في مساعدتك'
                  : 'The more specific you are, the better Wakti AI can assist you'
                }
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {language === 'ar' ? 'من أنت؟' : 'Who Are You?'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'اختر الدور الذي يصفك أفضل' : 'Choose the role that best describes you'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {roleOptions.map(option => (
                <div
                  key={option.value}
                  onClick={() => setFormData(prev => ({ ...prev, role: option.value }))}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    formData.role === option.value 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-border hover:border-blue-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{option.icon}</div>
                  <div className="font-medium text-sm">{option.label}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {language === 'ar' ? 'اهتماماتك' : 'Your Interests'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'اختر ما يهمك (يمكن اختيار أكثر من واحد)' : 'Select what interests you (multiple choices allowed)'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {interestOptions.map(option => (
                <div
                  key={option.value}
                  onClick={() => handleInterestChange(option.value, !formData.interests.includes(option.value))}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    formData.interests.includes(option.value)
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                      : 'border-border hover:border-green-300'
                  }`}
                >
                  <div className="text-xl mb-1">{option.icon}</div>
                  <div className="font-medium text-sm">{option.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Label htmlFor="personal-note" className="text-sm font-medium mb-2 block">
                💭 {language === 'ar' ? 'شيء مميز عنك (اختياري)' : 'Something unique about you (optional)'}
              </Label>
              <Textarea
                id="personal-note"
                value={formData.personalNote}
                onChange={(e) => setFormData(prev => ({ ...prev, personalNote: e.target.value }))}
                placeholder={language === 'ar' 
                  ? 'مثال: أحب العمل في الصباح الباكر، أفضل المهام القصيرة...' 
                  : 'e.g., I prefer working early mornings, I like short tasks...'}
                rows={3}
                className={language === 'ar' ? 'text-right' : ''}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-blue-600" />
            <div>
              <div className="text-lg">
                {language === 'ar' ? 'تحسين WAKTI AI' : 'Enhance Wakti AI'}
              </div>
              <div className="text-sm font-normal text-muted-foreground">
                {language === 'ar' ? `الخطوة ${step} من 3` : `Step ${step} of 3`}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>

        {renderStep()}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
            disabled={isLoading}
          >
            {step > 1 
              ? (language === 'ar' ? 'السابق' : 'Previous')
              : (language === 'ar' ? 'إلغاء' : 'Cancel')
            }
          </Button>
          
          <Button
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleSubmit();
              }
            }}
            disabled={!canProceed() || isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {language === 'ar' ? 'حفظ...' : 'Saving...'}
              </div>
            ) : step < 3 ? (
              language === 'ar' ? 'التالي' : 'Next'
            ) : (
              language === 'ar' ? 'تحسين AI' : 'Enhance AI'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
