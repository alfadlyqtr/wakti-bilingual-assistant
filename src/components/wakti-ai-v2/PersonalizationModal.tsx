
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Settings, 
  Check, 
  X,
  Sparkles,
  User,
  MessageCircle,
  Brain,
  Wand2
} from 'lucide-react';
import { PersonalizationCache, UserPersonalization } from '@/services/PersonalizationCache';

interface PersonalizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonalizationModal({ open, onOpenChange }: PersonalizationModalProps) {
  const { user } = useAuth();
  const { theme, language } = useTheme();
  const { isMobile } = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);
  
  const [personalization, setPersonalization] = useState<UserPersonalization>({
    nickname: '',
    role: '',
    main_use: '',
    interests: [],
    ai_tone: 'neutral',
    reply_style: 'detailed',
    traits: [],
    communication_style: '',
    response_length: '',
    personal_note: '',
    auto_enable: true
  });

  // AI Tone options
  const aiToneOptions = [
    { value: 'funny', label: language === 'ar' ? 'مرح' : 'Funny' },
    { value: 'serious', label: language === 'ar' ? 'جدي' : 'Serious' },
    { value: 'casual', label: language === 'ar' ? 'عفوي' : 'Casual' },
    { value: 'encouraging', label: language === 'ar' ? 'مشجع' : 'Encouraging' },
    { value: 'formal', label: language === 'ar' ? 'رسمي' : 'Formal' },
    { value: 'sassy', label: language === 'ar' ? 'ساخر' : 'Sassy' },
    { value: 'neutral', label: language === 'ar' ? 'متوازن' : 'Neutral' }
  ];

  // Reply Style options
  const replyStyleOptions = [
    { value: 'short', label: language === 'ar' ? 'مختصر' : 'Short' },
    { value: 'detailed', label: language === 'ar' ? 'مفصل' : 'Detailed' },
    { value: 'walkthrough', label: language === 'ar' ? 'خطوة بخطوة' : 'Walkthrough' },
    { value: 'bullet_points', label: language === 'ar' ? 'نقاط' : 'Bullet Points' }
  ];

  // Traits options
  const traitsOptions = [
    { value: 'chatty', label: language === 'ar' ? 'ثرثار' : 'Chatty' },
    { value: 'witty', label: language === 'ar' ? 'ذكي' : 'Witty' },
    { value: 'straight_shooting', label: language === 'ar' ? 'مباشر' : 'Straight shooting' },
    { value: 'encouraging', label: language === 'ar' ? 'مشجع' : 'Encouraging' },
    { value: 'gen_z', label: language === 'ar' ? 'جيل زد' : 'Gen Z' },
    { value: 'skeptical', label: language === 'ar' ? 'متشكك' : 'Skeptical' },
    { value: 'traditional', label: language === 'ar' ? 'تقليدي' : 'Traditional' },
    { value: 'forward_thinking', label: language === 'ar' ? 'متطلع للمستقبل' : 'Forward thinking' },
    { value: 'poetic', label: language === 'ar' ? 'شاعري' : 'Poetic' }
  ];

  useEffect(() => {
    if (open && user) {
      loadPersonalization();
    }
  }, [open, user]);

  const loadPersonalization = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // First, try to load from cache
      const cached = PersonalizationCache.load();
      if (cached) {
        console.log('🚀 Loading personalization from cache');
        setPersonalization({ ...personalization, ...cached });
        setIsLoading(false);
        return;
      }

      // If no cache, fetch from database
      console.log('📡 Loading personalization from database');
      const { data, error } = await supabase
        .from('ai_user_knowledge')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading personalization:', error);
        return;
      }

      if (data) {
        const loadedPersonalization: UserPersonalization = {
          nickname: data.nickname || '',
          role: data.role || '',
          main_use: data.main_use || '',
          interests: data.interests || [],
          ai_tone: data.ai_tone || 'neutral',
          reply_style: data.reply_style || 'detailed',
          traits: data.traits || [],
          communication_style: data.communication_style || '',
          response_length: data.response_length || '',
          personal_note: data.personal_note || '',
          auto_enable: data.auto_enable !== false
        };
        
        setPersonalization(loadedPersonalization);
        
        // Cache the loaded data
        PersonalizationCache.save(loadedPersonalization);
      }
    } catch (error) {
      console.error('Error loading personalization:', error);
      toast.error(
        language === 'ar' ? 'فشل في تحميل الإعدادات' : 'Failed to load settings'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      
      console.log('💾 Saving personalization...', personalization);

      const { error } = await supabase.rpc('upsert_user_personalization', {
        p_user_id: user.id,
        p_nickname: personalization.nickname || null,
        p_role: personalization.role || null,
        p_main_use: personalization.main_use || null,
        p_interests: personalization.interests || [],
        p_ai_tone: personalization.ai_tone || 'neutral',
        p_reply_style: personalization.reply_style || 'detailed',
        p_traits: personalization.traits || [],
        p_communication_style: personalization.communication_style || null,
        p_response_length: personalization.response_length || null,
        p_personal_note: personalization.personal_note || null,
        p_auto_enable: personalization.auto_enable !== false
      });

      if (error) throw error;

      // Update cache
      PersonalizationCache.save(personalization);

      console.log('✅ Personalization saved successfully');

      // Show success confirmation
      setSavedConfirmation(true);
      
      toast.success(
        language === 'ar' ? '✅ تم حفظ إعدادات وكتي AI' : '✅ Wakti AI settings saved',
        {
          description: language === 'ar' 
            ? 'سيستخدم الذكاء الاصطناعي هذه الإعدادات في المحادثات الجديدة'
            : 'AI will use these settings in new conversations',
          duration: 4000
        }
      );

      // Close modal after brief delay
      setTimeout(() => {
        onOpenChange(false);
        setSavedConfirmation(false);
      }, 2000);

    } catch (error) {
      console.error('Error saving personalization:', error);
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

  const handleTraitToggle = (trait: string) => {
    const currentTraits = personalization.traits || [];
    const updatedTraits = currentTraits.includes(trait)
      ? currentTraits.filter(t => t !== trait)
      : [...currentTraits, trait];
    
    setPersonalization({ ...personalization, traits: updatedTraits });
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
              {language === 'ar' ? 'تم حفظ إعدادات وكتي AI' : 'Wakti AI Settings Saved'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'ar' 
                ? 'سيستخدم الذكاء الاصطناعي هذه الإعدادات في المحادثات الجديدة'
                : 'AI will use these settings in new conversations'
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
          {/* Header */}
          <div className="text-center pb-4">
            <div className="flex items-center justify-center mb-2">
              <Wand2 className="w-5 h-5 text-primary mr-2" />
              <span className="text-sm font-medium text-muted-foreground">
                {language === 'ar' ? 'اجعل وكتي يتحدث بطريقتك' : 'Make Wakti talk your way'}
              </span>
            </div>
          </div>

          {/* Nickname */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <Label className="text-sm font-medium">
                {language === 'ar' ? 'ماذا يجب أن يناديك وكتي؟' : 'What should Wakti call you?'}
              </Label>
            </div>
            <Input
              value={personalization.nickname || ''}
              onChange={(e) => setPersonalization({ ...personalization, nickname: e.target.value })}
              placeholder={language === 'ar' ? 'أحمد' : 'abood'}
              className="w-full"
            />
          </div>

          {/* Role/Job */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {language === 'ar' ? 'ما هو عملك أو اهتمامك؟' : 'What do you do?'}
            </Label>
            <Input
              value={personalization.role || ''}
              onChange={(e) => setPersonalization({ ...personalization, role: e.target.value })}
              placeholder={language === 'ar' ? 'مصمم داخلي' : 'Interior designer'}
              className="w-full"
            />
          </div>

          {/* AI Tone and Reply Style - Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Tone */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">
                  {language === 'ar' ? 'نبرة الذكاء الاصطناعي' : 'AI Tone'}
                </Label>
              </div>
              <Select
                value={personalization.ai_tone || 'neutral'}
                onValueChange={(value) => setPersonalization({ ...personalization, ai_tone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aiToneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reply Style */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">
                  {language === 'ar' ? 'أسلوب الرد' : 'Reply Style'}
                </Label>
              </div>
              <Select
                value={personalization.reply_style || 'detailed'}
                onValueChange={(value) => setPersonalization({ ...personalization, reply_style: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {replyStyleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Traits */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {language === 'ar' ? 'السمات' : 'Traits'}
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {traitsOptions.map((trait) => (
                <div key={trait.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={trait.value}
                    checked={personalization.traits?.includes(trait.value) || false}
                    onCheckedChange={() => handleTraitToggle(trait.value)}
                  />
                  <Label
                    htmlFor={trait.value}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {trait.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {language === 'ar' ? 'أي شيء آخر يجب أن يعرفه وكتي؟' : 'Anything else Wakti should know?'}
            </Label>
            <Textarea
              value={personalization.personal_note || ''}
              onChange={(e) => setPersonalization({ ...personalization, personal_note: e.target.value })}
              placeholder={language === 'ar' 
                ? 'كلما طلبت تعليمات خطوة بخطوة، قسمها إلى خطوات بطيئة وواضحة. تأكد من كل خطوة قبل الانتقال للتالية.'
                : 'Whenever I ask for step-by-step instructions, break them into slow, clear baby steps. Confirm each one before moving on.'
              }
              className="min-h-[80px] resize-none"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Auto Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                {language === 'ar' ? 'تفعيل للمحادثات الجديدة' : 'Enable for New Chats'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' 
                  ? 'استخدم هذه الإعدادات تلقائياً في كل محادثة جديدة'
                  : 'Automatically use these settings in every new chat'
                }
              </p>
            </div>
            <Switch
              checked={personalization.auto_enable !== false}
              onCheckedChange={(checked) => setPersonalization({ ...personalization, auto_enable: checked })}
            />
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
                  {language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
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
              <Settings className="w-5 h-5 text-primary" />
              {language === 'ar' ? '🎛️ تخصيص وكتي' : '🎛️ Personalize Wakti'}
            </DrawerTitle>
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
            <Settings className="w-5 h-5 text-primary" />
            {language === 'ar' ? '🎛️ تخصيص وكتي' : '🎛️ Personalize Wakti'}
          </DialogTitle>
        </DialogHeader>
        <MainContent />
      </DialogContent>
    </Dialog>
  );
}
