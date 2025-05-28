
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Plus, User, Brain, Star } from 'lucide-react';
import { WaktiAIV2Service, UserKnowledge } from '@/services/WaktiAIV2Service';
import { toast } from 'sonner';

interface UserKnowledgeSetupProps {
  onComplete?: () => void;
}

export function UserKnowledgeSetup({ onComplete }: UserKnowledgeSetupProps) {
  const { language } = useTheme();
  const [knowledge, setKnowledge] = useState<UserKnowledge>({
    interests: [],
    main_use: '',
    role: '',
    personal_note: ''
  });
  const [newInterest, setNewInterest] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    loadUserKnowledge();
  }, []);

  const loadUserKnowledge = async () => {
    try {
      const existingKnowledge = await WaktiAIV2Service.getUserKnowledge();
      if (existingKnowledge) {
        setKnowledge(existingKnowledge);
      }
    } catch (error) {
      console.error('Error loading user knowledge:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const addInterest = () => {
    if (newInterest.trim() && !knowledge.interests.includes(newInterest.trim())) {
      setKnowledge(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }));
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setKnowledge(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await WaktiAIV2Service.updateUserKnowledge(knowledge);
      toast.success(
        language === 'ar' 
          ? 'تم حفظ معلوماتك بنجاح! سيصبح المساعد الذكي أكثر تخصصاً لك.' 
          : 'Your information saved successfully! The AI assistant will be more personalized for you.'
      );
      onComplete?.();
    } catch (error) {
      console.error('Error saving user knowledge:', error);
      toast.error(
        language === 'ar' 
          ? 'خطأ في حفظ المعلومات. يرجى المحاولة مرة أخرى.' 
          : 'Error saving information. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          {language === 'ar' ? 'تخصيص المساعد الذكي' : 'Personalize Your AI Assistant'}
        </CardTitle>
        <p className="text-muted-foreground">
          {language === 'ar' 
            ? 'أخبرنا عن نفسك لنجعل WAKTI AI أكثر فائدة لك'
            : 'Tell us about yourself to make WAKTI AI more helpful for you'
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role */}
        <div className="space-y-2">
          <Label htmlFor="role" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {language === 'ar' ? 'مهنتك أو دورك' : 'Your Role/Profession'}
          </Label>
          <Input
            id="role"
            value={knowledge.role || ''}
            onChange={(e) => setKnowledge(prev => ({ ...prev, role: e.target.value }))}
            placeholder={language === 'ar' ? 'مثال: مطور، طالب، مدير...' : 'e.g., Developer, Student, Manager...'}
          />
        </div>

        {/* Main Use */}
        <div className="space-y-2">
          <Label htmlFor="main_use">
            {language === 'ar' ? 'كيف تخطط لاستخدام WAKTI AI؟' : 'How do you plan to use WAKTI AI?'}
          </Label>
          <Input
            id="main_use"
            value={knowledge.main_use || ''}
            onChange={(e) => setKnowledge(prev => ({ ...prev, main_use: e.target.value }))}
            placeholder={language === 'ar' ? 'مثال: إدارة المهام، التعلم، العمل...' : 'e.g., Task management, Learning, Work...'}
          />
        </div>

        {/* Interests */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            {language === 'ar' ? 'اهتماماتك' : 'Your Interests'}
          </Label>
          <div className="flex gap-2">
            <Input
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              placeholder={language === 'ar' ? 'أضف اهتماماً جديداً' : 'Add a new interest'}
              onKeyPress={(e) => e.key === 'Enter' && addInterest()}
            />
            <Button onClick={addInterest} size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {knowledge.interests.map((interest) => (
              <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                {interest}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => removeInterest(interest)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Personal Note */}
        <div className="space-y-2">
          <Label htmlFor="personal_note">
            {language === 'ar' ? 'ملاحظة شخصية (اختيارية)' : 'Personal Note (Optional)'}
          </Label>
          <Textarea
            id="personal_note"
            value={knowledge.personal_note || ''}
            onChange={(e) => setKnowledge(prev => ({ ...prev, personal_note: e.target.value }))}
            placeholder={language === 'ar' 
              ? 'أي شيء آخر تريد أن يعرفه المساعد الذكي عنك...'
              : 'Anything else you want the AI assistant to know about you...'
            }
            rows={3}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={handleSave} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
              </div>
            ) : (
              language === 'ar' ? 'حفظ المعلومات' : 'Save Information'
            )}
          </Button>
          {onComplete && (
            <Button variant="outline" onClick={onComplete}>
              {language === 'ar' ? 'تخطي' : 'Skip'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
