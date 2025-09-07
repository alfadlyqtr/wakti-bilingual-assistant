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
  pt_version?: number;
  pt_updated_at?: string;
}

function saveWaktiPersonalTouch(data: PersonalTouchData) {
  try {
    const existingRaw = localStorage.getItem(PERSONAL_TOUCH_KEY);
    let existing: any = null;
    try { existing = existingRaw ? JSON.parse(existingRaw) : null; } catch {}
    
    const nextVersion = typeof existing?.pt_version === 'number' ? existing.pt_version + 1 : 1;
    const payload: any = {
      ...data,
      pt_version: nextVersion,
      pt_updated_at: new Date().toISOString()
    };
    localStorage.setItem(PERSONAL_TOUCH_KEY, JSON.stringify(payload));
  } catch {
    localStorage.setItem(PERSONAL_TOUCH_KEY, JSON.stringify({
      ...data,
      pt_version: 1,
      pt_updated_at: new Date().toISOString()
    }));
  }
}

function loadWaktiPersonalTouch(): PersonalTouchData | null {
  try {
    const stored = localStorage.getItem(PERSONAL_TOUCH_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

interface PTMProps { compact?: boolean }
export function PersonalTouchManager({ compact = false }: PTMProps) {
  const { language } = useTheme();
  const { showSuccess } = useToastHelper();
  
  const [showMore, setShowMore] = useState<boolean>(!compact);

  const [formData, setFormData] = useState<PersonalTouchData>({
    nickname: '',
    tone: 'neutral',
    style: 'short answers',
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
    
    // Also persist in sessionStorage for immediate availability in this session
    try {
      sessionStorage.setItem(PERSONAL_TOUCH_KEY, JSON.stringify({ ...formData }));
    } catch {}
    
    // Clear the cache so settings take effect without refresh
    WaktiAIV2Service.clearPersonalTouchCache();
    
    // Notify the app to refresh Personal Touch immediately
    try {
      const latest = loadWaktiPersonalTouch() || formData;
      window.dispatchEvent(new CustomEvent('wakti-personal-touch-updated', { detail: latest }));
    } catch {}
    
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
    <Card className={compact ? "bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl" : "bg-white/20 dark:bg-black/20 border-white/30 dark:border-white/20 backdrop-blur-xl"}>
      <CardHeader className={compact ? "py-1.5" : undefined}>
        <CardTitle className={compact ? "text-[13px] text-slate-700 dark:text-slate-300 flex items-center gap-2" : "text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"}>
          <Brain className="h-4 w-4" />
          {language === 'ar' ? 'تخصيص وقتي الذكي' : '🧠 Personalize Wakti AI'}
        </CardTitle>
        {!compact && (
          <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
            {language === 'ar' ? 'خصص طريقة تفاعل الذكاء الاصطناعي معك' : 'Customize how AI interacts with you'}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={compact ? "space-y-2.5 pt-0" : "space-y-4"}>
        {/* Core fields grid in compact mode */}
        {compact ? (
          <div className="grid grid-cols-2 gap-3 items-end">
            {/* Nickname Field */}
            <div className="space-y-1">
              <Label htmlFor="nickname" className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 h-4">
                {language === 'ar' ? 'اسم المستخدم' : 'User nickname'}
              </Label>
              <Input
                id="nickname"
                value={formData.nickname}
                onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                placeholder={language === 'ar' ? 'عبود' : 'Abood'}
                className="w-full h-9 text-[13px] bg-white dark:bg-black/10 border border-primary/30 dark:border-white/20 rounded-md shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
              />
            </div>

            {/* AI Nickname Field */}
            <div className="space-y-1">
              <Label htmlFor="aiNickname" className="block text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 mb-1 h-4">
                <Bot className="h-3 w-3" />
                {language === 'ar' ? 'اسم وقتي' : 'AI nickname'}
              </Label>
              <Input
                id="aiNickname"
                value={formData.aiNickname}
                onChange={(e) => setFormData(prev => ({ ...prev, aiNickname: e.target.value }))}
                placeholder={language === 'ar' ? 'مساعدي' : 'Assistant'}
                className="w-full h-9 text-[13px] bg-white dark:bg-black/10 border border-primary/30 dark:border-white/20 rounded-md shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
              />
            </div>

            {/* Tone Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'النبرة' : 'Tone'}
              </Label>
              <Select value={formData.tone} onValueChange={(value) => setFormData(prev => ({ ...prev, tone: value }))}>
                <SelectTrigger className="bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-[13px] h-8">
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
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'الأسلوب' : 'Style'}
              </Label>
              <Select value={formData.style} onValueChange={(value) => setFormData(prev => ({ ...prev, style: value }))}>
                <SelectTrigger className="bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 text-[13px] h-8">
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
          </div>
        ) : (
          <>
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
              <Label className="text-xs text-slate-600 dark:text-slate-400">
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
          </>
        )}

        {/* Special Instructions Textarea (always visible, small box) */}
        <div className={compact ? "space-y-1.5" : "space-y-2"}>
          <Label htmlFor="instruction" className={compact ? "text-[11px] text-slate-600 dark:text-slate-400" : "text-xs text-slate-600 dark:text-slate-400"}>
            {language === 'ar' ? 'أي شيء آخر؟' : 'Anything else?'}
          </Label>
          <Textarea
            id="instruction"
            value={formData.instruction}
            onChange={(e) => setFormData(prev => ({ ...prev, instruction: e.target.value }))}
            placeholder={language === 'ar' ? 'اكتب ملاحظة قصيرة...' : 'Write a short note...'}
            className={compact
              ? "h-12 text-[13px] bg-white border border-primary/30 rounded-md shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
              : "h-16 text-sm bg-white border border-primary/30 rounded-md shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0"}
            rows={compact ? 2 : 3}
          />
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave}
          className={compact ? "w-full bg-blue-500 hover:bg-blue-600 text-white h-8 text-[13px]" : "w-full bg-blue-500 hover:bg-blue-600 text-white"}
          size={compact ? 'sm' : 'sm'}
        >
          <Save className={compact ? "h-3.5 w-3.5 mr-2" : "h-4 w-4 mr-2"} />
          {language === 'ar' ? 'حفظ' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
}
