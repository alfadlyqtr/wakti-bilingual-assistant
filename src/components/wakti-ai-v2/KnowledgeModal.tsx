
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Brain, 
  Check, 
  Clock, 
  Globe, 
  MessageCircle, 
  Settings,
  User,
  FileText,
  Target,
  Briefcase,
  Heart,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const [notificationOptions] = useState([
    'task_reminders',
    'event_notifications', 
    'daily_summaries',
    'smart_suggestions',
    'deadline_alerts'
  ]);

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

  const handleNotificationToggle = (option: string) => {
    const current = knowledge.notification_preferences || [];
    const updated = current.includes(option)
      ? current.filter(item => item !== option)
      : [...current, option];
    
    setKnowledge({ ...knowledge, notification_preferences: updated });
  };

  const getNotificationLabel = (option: string) => {
    const labels = {
      task_reminders: language === 'ar' ? 'تذكيرات المهام' : 'Task Reminders',
      event_notifications: language === 'ar' ? 'إشعارات الأحداث' : 'Event Notifications',
      daily_summaries: language === 'ar' ? 'ملخصات يومية' : 'Daily Summaries',
      smart_suggestions: language === 'ar' ? 'اقتراحات ذكية' : 'Smart Suggestions',
      deadline_alerts: language === 'ar' ? 'تنبيهات المواعيد' : 'Deadline Alerts'
    };
    return labels[option as keyof typeof labels] || option;
  };

  const ContentComponent = ({ children }: { children: React.ReactNode }) => {
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

          {/* Personal Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <Label className="text-base font-medium">
                {language === 'ar' ? 'معلومات شخصية' : 'Personal Information'}
              </Label>
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

          {/* Goals */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <Label className="text-base font-medium">
                {language === 'ar' ? 'أهداف وطموحات' : 'Goals & Aspirations'}
              </Label>
            </div>
            <Textarea
              value={knowledge.goals}
              onChange={(e) => setKnowledge({ ...knowledge, goals: e.target.value })}
              placeholder={language === 'ar' 
                ? 'مثال: أريد تحسين إنتاجيتي، تعلم لغة جديدة، بناء مشروع تقني...'
                : 'e.g., I want to improve my productivity, learn a new language, build a tech project...'
              }
              className="min-h-[80px] resize-none"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Work Context */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              <Label className="text-base font-medium">
                {language === 'ar' ? 'سياق العمل' : 'Work Context'}
              </Label>
            </div>
            <Textarea
              value={knowledge.work_context}
              onChange={(e) => setKnowledge({ ...knowledge, work_context: e.target.value })}
              placeholder={language === 'ar' 
                ? 'مثال: أعمل في شركة تقنية، أدير فريق من 5 أشخاص، مسؤول عن تطوير المنتجات...'
                : 'e.g., I work at a tech company, manage a team of 5, responsible for product development...'
              }
              className="min-h-[80px] resize-none"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Preferences */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              <Label className="text-base font-medium">
                {language === 'ar' ? 'اهتمامات وتفضيلات' : 'Interests & Preferences'}
              </Label>
            </div>
            <Textarea
              value={knowledge.preferences}
              onChange={(e) => setKnowledge({ ...knowledge, preferences: e.target.value })}
              placeholder={language === 'ar' 
                ? 'مثال: أفضل الاجتماعات في الصباح، أحب الملخصات المرئية، لا أحب المقاطعات أثناء العمل المركز...'
                : 'e.g., I prefer morning meetings, like visual summaries, dislike interruptions during deep work...'
              }
              className="min-h-[80px] resize-none"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          <Separator />

          {/* AI Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'تفضيلات الذكاء الاصطناعي' : 'AI Preferences'}
            </h3>

            {/* Communication Style */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                {language === 'ar' ? 'أسلوب التواصل' : 'Communication Style'}
              </Label>
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

            {/* Response Length */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {language === 'ar' ? 'طول الإجابة' : 'Response Length'}
              </Label>
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

            {/* Primary Language */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {language === 'ar' ? 'لغة الاستجابة المفضلة' : 'Preferred Response Language'}
              </Label>
              <Select
                value={knowledge.primary_language}
                onValueChange={(value: any) => setKnowledge({ ...knowledge, primary_language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    {language === 'ar' ? 'تلقائي (حسب المدخل)' : 'Auto (match input)'}
                  </SelectItem>
                  <SelectItem value="en">
                    {language === 'ar' ? 'الإنجليزية' : 'English'}
                  </SelectItem>
                  <SelectItem value="ar">
                    {language === 'ar' ? 'العربية' : 'Arabic'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Working Hours */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {language === 'ar' ? 'ساعات العمل' : 'Working Hours'}
              </Label>
              <Input
                value={knowledge.working_hours}
                onChange={(e) => setKnowledge({ ...knowledge, working_hours: e.target.value })}
                placeholder="09:00-17:00"
              />
            </div>

            {/* Notification Preferences */}
            <div className="space-y-3">
              <Label className="text-base font-medium">
                {language === 'ar' ? 'تفضيلات الإشعارات' : 'Notification Preferences'}
              </Label>
              <div className="flex flex-wrap gap-2">
                {notificationOptions.map((option) => (
                  <Badge
                    key={option}
                    variant={knowledge.notification_preferences?.includes(option) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleNotificationToggle(option)}
                  >
                    {getNotificationLabel(option)}
                  </Badge>
                ))}
              </div>
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
            <ContentComponent>
              {/* Content rendered by ContentComponent */}
            </ContentComponent>
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
        <ContentComponent>
          {/* Content rendered by ContentComponent */}
        </ContentComponent>
      </DialogContent>
    </Dialog>
  );
}
