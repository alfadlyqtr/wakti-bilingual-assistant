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
  Settings,
  User,
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
  Camera,
  MessageCircle,
  FileText,
  Info
} from 'lucide-react';
import { PersonalizationCache } from '@/services/PersonalizationCache';

interface KnowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserKnowledge {
  personal_note?: string;
  role?: string;
  main_use?: string;
  interests?: string[];
  communication_style?: string;
  response_length?: string;
  nickname?: string;
  ai_tone?: string;
  reply_style?: string;
  traits?: string[];
  auto_enable?: boolean;
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
    personal_note: '',
    role: '',
    main_use: '',
    interests: [],
    communication_style: '',
    response_length: '',
    nickname: '',
    ai_tone: 'neutral',
    reply_style: 'detailed',
    traits: [],
    auto_enable: true
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

  // Main use categories
  const mainUseCategories = [
    { value: 'academic_success', label: language === 'ar' ? 'النجاح الأكاديمي' : 'Academic Success' },
    { value: 'career_growth', label: language === 'ar' ? 'النمو المهني' : 'Career Growth' },
    { value: 'skill_development', label: language === 'ar' ? 'تطوير المهارات' : 'Skill Development' },
    { value: 'productivity', label: language === 'ar' ? 'زيادة الإنتاجية' : 'Increase Productivity' },
    { value: 'work_life_balance', label: language === 'ar' ? 'توازن العمل والحياة' : 'Work-Life Balance' },
    { value: 'business_growth', label: language === 'ar' ? 'نمو الأعمال' : 'Business Growth' },
    { value: 'personal_projects', label: language === 'ar' ? 'مشاريع شخصية' : 'Personal Projects' },
    { value: 'health_fitness', label: language === 'ar' ? 'الصحة واللياقة' : 'Health & Fitness' }
  ];

  // Interest options
  const interestOptions = [
    { value: 'visual_learner', label: language === 'ar' ? 'متعلم بصري' : 'Visual Learning' },
    { value: 'step_by_step', label: language === 'ar' ? 'تعليمات خطوة بخطوة' : 'Step-by-step Instructions' },
    { value: 'quick_summaries', label: language === 'ar' ? 'ملخصات سريعة' : 'Quick Summaries' },
    { value: 'detailed_explanations', label: language === 'ar' ? 'شروحات مفصلة' : 'Detailed Explanations' },
    { value: 'examples_first', label: language === 'ar' ? 'أمثلة أولاً' : 'Examples First' },
    { value: 'theory_first', label: language === 'ar' ? 'النظرية أولاً' : 'Theory First' },
    { value: 'collaborative', label: language === 'ar' ? 'تعاوني' : 'Collaborative Approach' },
    { value: 'independent', label: language === 'ar' ? 'مستقل' : 'Independent Work' }
  ];

  // Communication style options
  const communicationStyles = [
    { value: 'friendly_casual', label: language === 'ar' ? 'ودود وعفوي' : 'Friendly & Casual' },
    { value: 'professional_formal', label: language === 'ar' ? 'مهني ورسمي' : 'Professional & Formal' },
    { value: 'direct_concise', label: language === 'ar' ? 'مباشر ومختصر' : 'Direct & Concise' },
    { value: 'encouraging_supportive', label: language === 'ar' ? 'مشجع وداعم' : 'Encouraging & Supportive' }
  ];

  // Response length options
  const responseLengths = [
    { value: 'brief', label: language === 'ar' ? 'موجز' : 'Brief' },
    { value: 'balanced', label: language === 'ar' ? 'متوازن' : 'Balanced' },
    { value: 'detailed', label: language === 'ar' ? 'مفصل' : 'Detailed' }
  ];

  useEffect(() => {
    if (open && user) {
      loadExistingKnowledge();
    }
  }, [open, user]);

  const loadExistingKnowledge = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      console.log('Loading knowledge for user:', user.id);
      
      const { data, error } = await supabase
        .from('ai_user_knowledge')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading knowledge:', error);
        return;
      }

      if (data) {
        console.log('Loaded existing knowledge:', data);
        setHasExistingData(true);
        
        // Map all database values to form state (including new personalization fields)
        setKnowledge({
          personal_note: data.personal_note || '',
          role: data.role || '',
          main_use: data.main_use || '',
          interests: Array.isArray(data.interests) ? data.interests : [],
          communication_style: data.communication_style || '',
          response_length: data.response_length || '',
          nickname: data.nickname || '',
          ai_tone: data.ai_tone || 'neutral',
          reply_style: data.reply_style || 'detailed',
          traits: Array.isArray(data.traits) ? data.traits : [],
          auto_enable: data.auto_enable !== false
        });
      } else {
        console.log('No existing knowledge found, using defaults');
        setHasExistingData(false);
        // Reset to defaults when no data exists
        setKnowledge({
          personal_note: '',
          role: '',
          main_use: '',
          interests: [],
          communication_style: '',
          response_length: '',
          nickname: '',
          ai_tone: 'neutral',
          reply_style: 'detailed',
          traits: [],
          auto_enable: true
        });
      }
    } catch (error) {
      console.error('Error loading knowledge:', error);
      toast.error(
        language === 'ar' ? 'فشل في تحميل البيانات' : 'Failed to load data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      
      // Use the new upsert function for comprehensive save
      const { error } = await supabase.rpc('upsert_user_personalization', {
        p_user_id: user.id,
        p_nickname: knowledge.nickname || null,
        p_role: knowledge.role || null,
        p_main_use: knowledge.main_use || null,
        p_interests: knowledge.interests && knowledge.interests.length > 0 ? knowledge.interests : [],
        p_ai_tone: knowledge.ai_tone || 'neutral',
        p_reply_style: knowledge.reply_style || 'detailed',
        p_traits: knowledge.traits && knowledge.traits.length > 0 ? knowledge.traits : [],
        p_communication_style: knowledge.communication_style || null,
        p_response_length: knowledge.response_length || null,
        p_personal_note: knowledge.personal_note || null,
        p_auto_enable: knowledge.auto_enable !== false
      });

      if (error) throw error;

      console.log('Knowledge saved successfully');
      setHasExistingData(true);

      // Update personalization cache
      PersonalizationCache.save({
        nickname: knowledge.nickname,
        role: knowledge.role,
        main_use: knowledge.main_use,
        interests: knowledge.interests,
        ai_tone: knowledge.ai_tone,
        reply_style: knowledge.reply_style,
        traits: knowledge.traits,
        communication_style: knowledge.communication_style,
        response_length: knowledge.response_length,
        personal_note: knowledge.personal_note,
        auto_enable: knowledge.auto_enable
      });

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
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </p>
        </div>
      );
    }

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

          {/* Note about new personalization feature */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
            <div className="flex items-start gap-2 text-purple-600 dark:text-purple-400">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">
                  {language === 'ar' ? 'ميزة جديدة: تخصيص وكتي!' : 'New Feature: Personalize Wakti!'}
                </p>
                <p className="text-xs mt-1 opacity-90">
                  {language === 'ar' 
                    ? 'يمكنك الآن استخدام "تخصيص وكتي" من قائمة المحادثات للحصول على تجربة أكثر تخصيصاً'
                    : 'You can now use "Personalize Wakti" from the conversations menu for a more customized experience'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <label className="text-base font-medium">
                {language === 'ar' ? 'معلومات شخصية' : 'Personal Information'}
              </label>
            </div>
            <Textarea
              value={knowledge.personal_note || ''}
              onChange={(e) => setKnowledge({ ...knowledge, personal_note: e.target.value })}
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
                value={knowledge.role || ''}
                onValueChange={(value) => setKnowledge({ ...knowledge, role: value })}
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

            {/* Main Use */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <label className="text-base font-medium">
                  {language === 'ar' ? 'الهدف الأساسي' : 'Main Use'}
                </label>
              </div>
              <Select
                value={knowledge.main_use || ''}
                onValueChange={(value) => setKnowledge({ ...knowledge, main_use: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر هدفك الأساسي' : 'Select your main goal'} />
                </SelectTrigger>
                <SelectContent>
                  {mainUseCategories.map((use) => (
                    <SelectItem key={use.value} value={use.value}>
                      {use.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Communication Style and Response Length - New Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Communication Style */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <label className="text-base font-medium">
                  {language === 'ar' ? 'أسلوب التواصل' : 'Communication Style'}
                </label>
              </div>
              <Select
                value={knowledge.communication_style || ''}
                onValueChange={(value) => setKnowledge({ ...knowledge, communication_style: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر أسلوب التواصل' : 'Select communication style'} />
                </SelectTrigger>
                <SelectContent>
                  {communicationStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Response Length */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <label className="text-base font-medium">
                  {language === 'ar' ? 'طول الاستجابة' : 'Response Length'}
                </label>
              </div>
              <Select
                value={knowledge.response_length || ''}
                onValueChange={(value) => setKnowledge({ ...knowledge, response_length: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر طول الاستجابة' : 'Select response length'} />
                </SelectTrigger>
                <SelectContent>
                  {responseLengths.map((length) => (
                    <SelectItem key={length.value} value={length.value}>
                      {length.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Interests - Full width */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              <label className="text-base font-medium">
                {language === 'ar' ? 'الاهتمامات والتفضيلات' : 'Interests & Preferences'}
              </label>
            </div>
            <Select
              value={knowledge.interests?.[0] || ''}
              onValueChange={(value) => setKnowledge({ ...knowledge, interests: value ? [value] : [] })}
            >
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر اهتماماتك' : 'Select your interests'} />
              </SelectTrigger>
              <SelectContent>
                {interestOptions.map((interest) => (
                  <SelectItem key={interest.value} value={interest.value}>
                    {interest.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
