
import React, { useState } from 'react';
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
import { Brain } from 'lucide-react';

interface KnowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeModal({ open, onOpenChange }: KnowledgeModalProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    mainUse: '',
    role: '',
    interests: [] as string[],
    personalNote: ''
  });

  const roleOptions = [
    { value: 'student', label: language === 'ar' ? 'طالب' : 'Student' },
    { value: 'freelancer', label: language === 'ar' ? 'مستقل' : 'Freelancer' },
    { value: 'business_owner', label: language === 'ar' ? 'صاحب عمل' : 'Business Owner' },
    { value: 'parent', label: language === 'ar' ? 'والد/والدة' : 'Parent' },
    { value: 'other', label: language === 'ar' ? 'أخرى' : 'Other' }
  ];

  const interestOptions = [
    { value: 'productivity', label: language === 'ar' ? 'الإنتاجية' : 'Productivity' },
    { value: 'study', label: language === 'ar' ? 'الدراسة' : 'Study' },
    { value: 'fitness', label: language === 'ar' ? 'اللياقة البدنية' : 'Fitness' },
    { value: 'creativity', label: language === 'ar' ? 'الإبداع' : 'Creativity' },
    { value: 'business', label: language === 'ar' ? 'الأعمال' : 'Business' },
    { value: 'writing', label: language === 'ar' ? 'الكتابة' : 'Writing' },
    { value: 'other', label: language === 'ar' ? 'أخرى' : 'Other' }
  ];

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
      // Store locally if not logged in
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
        title: language === 'ar' ? '✅ تم الحفظ' : '✅ Saved',
        description: language === 'ar' ? 'تم حفظ معلوماتك بنجاح' : 'Your information has been saved successfully'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {language === 'ar' ? 'تحسين WAKTI AI الخاص بي' : 'Improve My Wakti AI'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <Label htmlFor="main-use">
              🔘 {language === 'ar' ? 'لماذا تستخدم WAKTI AI بشكل أساسي؟' : 'What do you mainly use Wakti AI for?'}
            </Label>
            <Textarea
              id="main-use"
              value={formData.mainUse}
              onChange={(e) => setFormData(prev => ({ ...prev, mainUse: e.target.value }))}
              placeholder={language === 'ar' ? 'مثال: إدارة المهام والمواعيد...' : 'e.g., Managing tasks and appointments...'}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="role">
              🔘 {language === 'ar' ? 'ما هو دورك أو هويتك؟' : 'Your role or identity?'}
            </Label>
            <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر دورك' : 'Select your role'} />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              🔘 {language === 'ar' ? 'ما هي اهتماماتك؟' : 'What are your interests?'}
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {interestOptions.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.value}
                    checked={formData.interests.includes(option.value)}
                    onCheckedChange={(checked) => handleInterestChange(option.value, !!checked)}
                  />
                  <Label htmlFor={option.value} className="text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="personal-note">
              🔘 {language === 'ar' ? 'ما هو الشيء الواحد الذي تريد أن يعرفه WAKTI AI عنك؟' : "What's one thing you want Wakti AI to know about you?"}
            </Label>
            <Textarea
              id="personal-note"
              value={formData.personalNote}
              onChange={(e) => setFormData(prev => ({ ...prev, personalNote: e.target.value }))}
              placeholder={language === 'ar' ? 'مثال: أحب العمل في الصباح الباكر...' : 'e.g., I prefer working early mornings...'}
              rows={3}
            />
          </div>

          <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
            {isLoading 
              ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
              : (language === 'ar' ? 'حفظ المعلومات' : 'Save Information')
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
