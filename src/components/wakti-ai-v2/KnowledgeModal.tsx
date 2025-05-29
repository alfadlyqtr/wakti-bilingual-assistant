import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Brain, 
  Check, 
  MessageCircle, 
  Settings,
  User,
  FileText,
  Target,
  Briefcase,
  Heart,
  Sparkles,
  X,
  GraduationCap,
  Building2,
  Users,
  Home,
  Code,
  Palette,
  Stethoscope,
  Scale,
  TrendingUp,
  Camera
} from 'lucide-react';

interface KnowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserKnowledge {
  personal_info?: string;
  goals?: string;
  preferences?: string;
  work_context?: string;
  communication_style?: 'formal' | 'casual' | 'technical' | 'friendly';
  response_length?: 'brief' | 'detailed' | 'comprehensive';
  primary_language?: 'en' | 'ar' | 'auto';
  time_zone?: string;
  working_hours?: string;
  notification_preferences?: string[];
}

export function KnowledgeModal({ open, onOpenChange }: KnowledgeModalProps) {
  const { user } = useAuth();
  const { theme, language } = useTheme();
  const { isMobile } = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  
  const [knowledge, setKnowledge] = useState<UserKnowledge>({
    personal_info: '',
    goals: '',
    preferences: '',
    work_context: '',
    communication_style: 'friendly',
    response_length: 'detailed',
    primary_language: 'auto',
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    working_hours: '09:00-17:00',
    notification_preferences: []
  });

  // Professional roles with icons
  const professionalRoles = [
    { value: 'student_university', label: language === 'ar' ? 'طالب جامعي' : 'University Student', icon: GraduationCap },
    { value: 'student_high_school', label: language === 'ar' ? 'طالب ثانوي' : 'High School Student', icon: GraduationCap },
    { value: 'software_engineer', label: language === 'ar' ? 'مهندس برمجيات' : 'Software Engineer', icon: Code },
    { value: 'designer', label: language === 'ar' ? 'مصمم' : 'Designer', icon: Palette },
    { value: 'doctor', label: language === 'ar' ? 'طبيب' : 'Doctor', icon: Stethoscope },
    { value: 'lawyer', label: language === 'ar' ? 'محامي' : 'Lawyer', icon: Scale },
    { value: 'business_owner', label: language === 'ar' ? 'صاحب عمل' : 'Business Owner', icon: Building2 },
    { value: 'manager', label: language === 'ar' ? 'مدير' : 'Manager', icon: Users },
    { value: 'freelancer', label: language === 'ar' ? 'مستقل' : 'Freelancer', icon: Home },
    { value: 'entrepreneur', label: language === 'ar' ? 'رائد أعمال' : 'Entrepreneur', icon: TrendingUp },
    { value: 'content_creator', label: language === 'ar' ? 'منشئ محتوى' : 'Content Creator', icon: Camera },
    { value: 'other', label: language === 'ar' ? 'أخرى' : 'Other', icon: User }
  ];

  // Goals categories
  const goalCategories = [
    { value: 'academic_success', label: language === 'ar' ? 'النجاح الأكاديمي' : 'Academic Success' },
    { value: 'career_growth', label: language === 'ar' ? 'النمو المهني' : 'Career Growth' },
    { value: 'skill_development', label: language === 'ar' ? 'تطوير المهارات' : 'Skill Development' },
    { value: 'productivity', label: language === 'ar' ? 'زيادة الإنتاجية' : 'Increase Productivity' },
    { value: 'work_life_balance', label: language === 'ar' ? 'توازن العمل والحياة' : 'Work-Life Balance' },
    { value: 'business_growth', label: language === 'ar' ? 'نمو الأعمال' : 'Business Growth' },
    { value: 'personal_projects', label: language === 'ar' ? 'مشاريع شخصية' : 'Personal Projects' },
    { value: 'health_fitness', label: language === 'ar' ? 'الصحة واللياقة' : 'Health & Fitness' }
  ];

  // Preferences options
  const preferenceOptions = [
    { value: 'visual_learner', label: language === 'ar' ? 'متعلم بصري' : 'Visual Learner' },
    { value: 'step_by_step', label: language === 'ar' ? 'تعليمات خطوة بخطوة' : 'Step-by-step Instructions' },
    { value: 'quick_summaries', label: language === 'ar' ? 'ملخصات سريعة' : 'Quick Summaries' },
    { value: 'detailed_explanations', label: language === 'ar' ? 'شروحات مفصلة' : 'Detailed Explanations' },
    { value: 'examples_first', label: language === 'ar' ? 'أمثلة أولاً' : 'Examples First' },
    { value: 'theory_first', label: language === 'ar' ? 'النظرية أولاً' : 'Theory First' },
    { value: 'collaborative', label: language === 'ar' ? 'تعاوني' : 'Collaborative Approach' },
    { value: 'independent', label: language === 'ar' ? 'مستقل' : 'Independent Work' }
  ];

  useEffect(() => {
    if (open && user) {
      loadExistingKnowledge();
    }
  }, [open, user]);

  const loadExistingKnowledge = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ai_user_knowledge')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading knowledge:', error);
        return;
      }

      if (data) {
        setHasExistingData(true);
        setKnowledge({
          personal_info: data.personal_info || '',
          goals: data.goals || '',
          preferences: data.preferences || '',
          work_context: data.work_context || '',
          communication_style: data.communication_style || 'friendly',
          response_length: data.response_length || 'detailed',
          primary_language: data.primary_language || 'auto',
          time_zone: data.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          working_hours: data.working_hours || '09:00-17:00',
          notification_preferences: data.notification_preferences || []
        });
      }
    } catch (error) {
      console.error('Error loading knowledge:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('ai_user_knowledge')
        .upsert({
          user_id: user.id,
          personal_info: knowledge.personal_info,
          goals: knowledge.goals,
          preferences: knowledge.preferences,
          work_context: knowledge.work_context,
          communication_style: knowledge.communication_style,
          response_length: knowledge.response_length,
          primary_language: knowledge.primary_language,
          time_zone: knowledge.time_zone,
          working_hours: knowledge.working_hours,
          notification_preferences: knowledge.notification_preferences
        });

      if (error) throw error;

      // Show success confirmation
      setSavedConfirmation(true);
      
      // Custom success toast
      toast.success(
        language === 'ar' ? '✅ تم الحفظ لاستخدام وكتي AI' : '✅ Saved for Wakti AI use',
        {
          description: language === 'ar' 
            ? 'سيستخدم الذكاء الاصطناعي هذه المعلومات لتقديم إجابات أفضل'
            : 'AI will use this information to provide better, personalized responses',
          duration: 4000
        }
      );

      // Close modal after brief delay
      setTimeout(() => {
        onOpenChange(false);
        setSavedConfirmation(false);
      }, 2000);

    } catch (error) {
      console.error('Error saving knowledge:', error);
      toast.error(
        language === 'ar' ? 'فشل في الحفظ' : 'Failed to save',
        {
          description: language === 'ar' 
            ? 'يرجى المحاولة مرة أخرى'
            : 'Please try again'
        }
      );
    } finally {
      setSaving(false);
    }
  };

  const MainContent = () => {
    if (savedConfirmation) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
              {language === 'ar' ? 'تم الحفظ لاستخدام وكتي AI' : 'Saved for Wakti AI use'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'ar' 
                ? 'سيستخدم الذكاء الاصطناعي هذه المعلومات لتحسين تجربتك'
                : 'AI will use this information to enhance your experience'
              }
            </p>
          </div>
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
        </div>
      );
    }

    return (
      <ScrollArea className="max-h-[70vh] pr-4">
        <div className="space-y-6">
          {/* Header with existing data indicator */}
          {hasExistingData && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'تحديث إعدادات AI الموجودة' : 'Updating existing AI settings'}
                </span>
              </div>
            </div>
          )}

          {/* Personal Information - Keep as textarea */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <label className="text-base font-medium">
                {language === 'ar' ? 'معلومات شخصية' : 'Personal Information'}
              </label>
            </div>
            <Textarea
              value={knowledge.personal_info}
              onChange={(e) => setKnowledge({ ...knowledge, personal_info: e.target.value })}
              placeholder={language === 'ar' 
                ? 'مثال: اسمي أحمد، أعمل كمطور برمجيات، أحب التقنية والرياضة...'
                : 'e.g., My name is Ahmed, I work as a software developer, I enjoy technology and sports...'
              }
              className="min-h-[80px] resize-none"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          {/* 2-Column Grid for Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Professional Role */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <label className="text-base font-medium">
                  {language === 'ar' ? 'المجال المهني' : 'Professional Role'}
                </label>
              </div>
              <Select
                value={knowledge.work_context}
                onValueChange={(value) => setKnowledge({ ...knowledge, work_context: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر مجالك المهني' : 'Select your role'} />
                </SelectTrigger>
                <SelectContent>
                  {professionalRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <role.icon className="w-4 h-4" />
                        {role.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Primary Goals */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <label className="text-base font-medium">
                  {language === 'ar' ? 'الهدف الأساسي' : 'Primary Goal'}
                </label>
              </div>
              <Select
                value={knowledge.goals}
                onValueChange={(value) => setKnowledge({ ...knowledge, goals: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر هدفك الأساسي' : 'Select your main goal'} />
                </SelectTrigger>
                <SelectContent>
                  {goalCategories.map((goal) => (
                    <SelectItem key={goal.value} value={goal.value}>
                      {goal.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Learning Style */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-primary" />
                <label className="text-base font-medium">
                  {language === 'ar' ? 'أسلوب التعلم المفضل' : 'Learning Style'}
                </label>
              </div>
              <Select
                value={knowledge.preferences}
                onValueChange={(value) => setKnowledge({ ...knowledge, preferences: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر أسلوب التعلم' : 'Select your style'} />
                </SelectTrigger>
                <SelectContent>
                  {preferenceOptions.map((pref) => (
                    <SelectItem key={pref.value} value={pref.value}>
                      {pref.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Communication Style - Keep as is */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <label className="text-base font-medium">
                  {language === 'ar' ? 'أسلوب التواصل' : 'Communication Style'}
                </label>
              </div>
              <Select
                value={knowledge.communication_style}
                onValueChange={(value: any) => setKnowledge({ ...knowledge, communication_style: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">
                    {language === 'ar' ? 'رسمي' : 'Formal'}
                  </SelectItem>
                  <SelectItem value="casual">
                    {language === 'ar' ? 'غير رسمي' : 'Casual'}
                  </SelectItem>
                  <SelectItem value="technical">
                    {language === 'ar' ? 'تقني' : 'Technical'}
                  </SelectItem>
                  <SelectItem value="friendly">
                    {language === 'ar' ? 'ودود' : 'Friendly'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Response Length - Keep as is */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <label className="text-base font-medium">
                  {language === 'ar' ? 'طول الإجابة' : 'Response Length'}
                </label>
              </div>
              <Select
                value={knowledge.response_length}
                onValueChange={(value: any) => setKnowledge({ ...knowledge, response_length: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">
                    {language === 'ar' ? 'مختصر' : 'Brief'}
                  </SelectItem>
                  <SelectItem value="detailed">
                    {language === 'ar' ? 'مفصل' : 'Detailed'}
                  </SelectItem>
                  <SelectItem value="comprehensive">
                    {language === 'ar' ? 'شامل' : 'Comprehensive'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  {language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {language === 'ar' ? 'حفظ للذكاء الاصطناعي' : 'Save for AI'}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-2" />
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-center border-b">
            <DrawerTitle className="flex items-center justify-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'تحسين وكتي AI الخاص بي' : 'Improve My Wakti AI'}
            </DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'ar' 
                ? 'ساعد الذكاء الاصطناعي على فهمك بشكل أفضل'
                : 'Help AI understand you better for personalized responses'
              }
            </p>
          </DrawerHeader>
          <div className="p-4">
            <MainContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {language === 'ar' ? 'تحسين وكتي AI الخاص بي' : 'Improve My Wakti AI'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' 
              ? 'ساعد الذكاء الاصطناعي على فهمك بشكل أفضل لتقديم إجابات شخصية ومفيدة'
              : 'Help AI understand you better for personalized and helpful responses'
            }
          </p>
        </DialogHeader>
        <MainContent />
      </DialogContent>
    </Dialog>
  );
}
