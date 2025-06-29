import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { Brain, Save, Bot } from 'lucide-react';
import { WaktiAIV2Service } from '@/services/WaktiAIV2Service';

const PERSONAL_TOUCH_KEY = "wakti_personal_touch";

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
  aiNickname?: string; // NEW: AI nickname feature
}

function saveWaktiPersonalTouch(data: PersonalTouchData) {
  localStorage.setItem(PERSONAL_TOUCH_KEY, JSON.stringify(data));
}

function loadWaktiPersonalTouch(): PersonalTouchData | null {
  try {
    const stored = localStorage.getItem(PERSONAL_TOUCH_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function PersonalTouchManager() {
  const { language } = useTheme();
  const { showSuccess } = useToastHelper();
  
  const [formData, setFormData] = useState<PersonalTouchData>({
    nickname: '',
    tone: 'neutral',
    style: 'detailed',
    instruction: '',
    aiNickname: '' // NEW: AI nickname
  });

  // Load saved data on mount
  useEffect(() => {
    const saved = loadWaktiPersonalTouch();
    if (saved) {
      setFormData({
        ...saved,
        aiNickname: saved.aiNickname || '' // Handle existing data without aiNickname
      });
    }
  }, []);

  const handleSave = () => {
    saveWaktiPersonalTouch(formData);
    
    // NEW: Clear the cache immediately so settings take effect without refresh
    WaktiAIV2Service.clearPersonalTouchCache();
    
    showSuccess(language === 'ar' ? 'تم حفظ الإعدادات!' : 'Settings saved!');
  };

  const toneOptions = [
    { value: 'funny', label: language === 'ar' ? 'مرح' : 'Funny' },
    { value: 'serious', label: language === 'ar' ? 'جدي' : 'Serious' },
    { value: 'casual', label: language === 'ar' ? 'عادي' : 'Casual' },
    { value: 'encouraging', label: language === 'ar' ? 'محفز' : 'Encouraging' },
    { value: 'neutral', label: language === 'ar' ? 'محايد' : 'Neutral' }
  ];

  const styleOptions = [
    { value: 'short answers', label: language === 'ar' ? 'إجابات قصيرة' : 'Short answers' },
    { value: 'detailed', label: language === 'ar' ? 'مفصل' : 'Detailed' },
    { value: 'step-by-step', label: language === 'ar' ? 'خطوة بخطوة' : 'Step-by-step' },
    { value: 'bullet points', label: language === 'ar' ? 'نقاط' : 'Bullet points' }
  ];

  return (
    <Card className="bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Brain className="h-4 w-4" />
          {language === 'ar' ? 'تخصيص وقتي الذكي' : '🧠 Personalize Wakti AI'}
        </CardTitle>
        <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
          {language === 'ar' ? 'خصص طريقة تفاعل الذكاء الاصطناعي معك' : 'Customize how AI interacts with you'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nickname Field */}
        <div className="space-y-2">
          <Label htmlFor="nickname" className="text-xs text-slate-600 dark:text-slate-400">
            {language === 'ar' ? 'ماذا يجب أن يناديك وقتي؟' : 'What should Wakti call you?'}
          </Label>
          <Input
            id="nickname"
            value={formData.nickname}
            onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
            placeholder={language === 'ar' ? 'عبود' : 'Abood'}
            className="bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-sm"
          />
        </div>

        {/* NEW: AI Nickname Field */}
        <div className="space-y-2">
          <Label htmlFor="aiNickname" className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Bot className="h-3 w-3" />
            {language === 'ar' ? 'أعط وقتي اسماً مستعاراً' : 'Give Wakti AI a nickname'}
          </Label>
          <Input
            id="aiNickname"
            value={formData.aiNickname}
            onChange={(e) => setFormData(prev => ({ ...prev, aiNickname: e.target.value }))}
            placeholder={language === 'ar' ? 'مساعدي الذكي' : 'My Smart Assistant'}
            className="bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-sm"
          />
        </div>

        {/* Tone Dropdown */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-600 dark:text-slate-400">
            {language === 'ar' ? 'النبرة المفضلة' : 'Preferred tone'}
          </Label>
          <Select value={formData.tone} onValueChange={(value) => setFormData(prev => ({ ...prev, tone: value }))}>
            <SelectTrigger className="bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {toneOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Style Dropdown */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-600 dark:text-slave-400">
            {language === 'ar' ? 'أسلوب الرد' : 'Reply style'}
          </Label>
          <Select value={formData.style} onValueChange={(value) => setFormData(prev => ({ ...prev, style: value }))}>
            <SelectTrigger className="bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {styleOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Special Instructions Textarea */}
        <div className="space-y-2">
          <Label htmlFor="instruction" className="text-xs text-slate-600 dark:text-slate-400">
            {language === 'ar' ? 'أي شيء آخر؟' : 'Anything else?'}
          </Label>
          <Textarea
            id="instruction"
            value={formData.instruction}
            onChange={(e) => setFormData(prev => ({ ...prev, instruction: e.target.value }))}
            placeholder={language === 'ar' ? 'قسم الأشياء إلى خطوات بسيطة وانتظر حتى أقول "التالي".' : "Break things down into baby steps and wait for me to say 'next'."}
            className="bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-sm resize-none"
            rows={3}
          />
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          size="sm"
        >
          <Save className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'حفظ' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
}
