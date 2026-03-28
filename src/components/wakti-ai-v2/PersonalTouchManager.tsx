// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToastHelper } from "@/hooks/use-toast-helper";
import { Brain, Save, Bot, Zap, Cpu } from 'lucide-react';
import { WaktiAIV2Service } from '@/services/WaktiAIV2Service';
import { supabase } from '@/integrations/supabase/client';

const PERSONAL_TOUCH_KEY = "wakti_personal_touch";

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
  aiNickname?: string; // NEW: AI nickname feature
  engineTier?: 'speed' | 'intelligence';
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
    aiNickname: '',
    engineTier: 'speed'
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load from DB first (source of truth), fallback to localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !cancelled) {
          const { data, error } = await supabase
            .from('user_personal_touch')
            .select('nickname, ai_nickname, tone, style, instruction, engine_tier, pt_version, updated_at')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!error && data && !cancelled) {
            const dbData: PersonalTouchData = {
              nickname: data.nickname || '',
              aiNickname: data.ai_nickname || '',
              tone: data.tone || 'neutral',
              style: data.style || 'short answers',
              instruction: data.instruction || '',
              engineTier: (data.engine_tier as 'speed' | 'intelligence') || 'speed',
              pt_version: data.pt_version,
              pt_updated_at: data.updated_at
            };
            setFormData(dbData);
            // Sync localStorage from DB
            try { localStorage.setItem(PERSONAL_TOUCH_KEY, JSON.stringify(dbData)); } catch {}
            return;
          }
        }
      } catch {}
      // Fallback to localStorage if DB load failed or no user yet
      if (!cancelled) {
        const saved = loadWaktiPersonalTouch();
        if (saved) {
          setFormData({
            ...saved,
            aiNickname: saved.aiNickname || '',
            engineTier: saved.engineTier || 'speed'
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { showError } = await import('@/hooks/use-toast-helper').then(m => ({ showError: m.useToastHelper }));
        console.error('❌ PT SAVE: No authenticated user');
        setIsSaving(false);
        return;
      }

      const existingRaw = localStorage.getItem(PERSONAL_TOUCH_KEY);
      let existing: any = null;
      try { existing = existingRaw ? JSON.parse(existingRaw) : null; } catch {}
      const nextVersion = typeof existing?.pt_version === 'number' ? existing.pt_version + 1 : 1;

      const { error } = await supabase.from('user_personal_touch').upsert({
        user_id: user.id,
        nickname: formData.nickname || '',
        ai_nickname: formData.aiNickname || '',
        tone: formData.tone || 'neutral',
        style: formData.style || 'short answers',
        instruction: formData.instruction || '',
        engine_tier: formData.engineTier || 'speed',
        pt_version: nextVersion,
        updated_at: new Date().toISOString()
      });

      if (error) {
        console.error('❌ PT DB SAVE ERROR:', error.message, error.code);
        const { toast } = await import('@/hooks/use-toast');
        toast({ title: language === 'ar' ? 'فشل الحفظ' : 'Save failed', description: error.message, variant: 'destructive' });
        setIsSaving(false);
        return;
      }

      // DB save succeeded — sync localStorage
      const payload: any = { ...formData, pt_version: nextVersion, pt_updated_at: new Date().toISOString() };
      try { localStorage.setItem(PERSONAL_TOUCH_KEY, JSON.stringify(payload)); } catch {}
      try { sessionStorage.setItem(PERSONAL_TOUCH_KEY, JSON.stringify(payload)); } catch {}

      WaktiAIV2Service.clearPersonalTouchCache();
      try {
        window.dispatchEvent(new CustomEvent('wakti-personal-touch-updated', { detail: payload }));
      } catch {}

      showSuccess(language === 'ar' ? 'تم حفظ الإعدادات!' : 'Settings saved!');
    } catch (e) {
      console.error('❌ PT SAVE EXCEPTION:', e);
      const { toast } = await import('@/hooks/use-toast');
      toast({ title: language === 'ar' ? 'فشل الحفظ' : 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
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
    { value: 'bullet points', label: language === 'ar' ? 'نقاط' : 'Bullet points' },
    { value: 'conversational', label: language === 'ar' ? 'حواري' : 'Conversational' },
    { value: 'analytical', label: language === 'ar' ? 'تحليلي' : 'Analytical' }
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
          <>
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

            {/* Tone Dropdown (native for compact/mobile) */}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'النبرة' : 'Tone'}
              </Label>
              <select
                className="h-8 w-full rounded-md border bg-white/80 dark:bg-black/20 border-white/20 dark:border-white/10 text-[13px] px-2"
                value={formData.tone}
                onChange={(e) => setFormData(prev => ({ ...prev, tone: e.target.value }))}
              >
                {toneOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {/* Style Dropdown (native for compact/mobile) */}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'الأسلوب' : 'Style'}
              </Label>
              <select
                className="h-8 w-full rounded-md border bg-white/80 dark:bg-black/20 border-white/20 dark:border-white/10 text-[13px] px-2"
                value={formData.style}
                onChange={(e) => setFormData(prev => ({ ...prev, style: e.target.value }))}
              >
                {styleOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Engine Tier Toggle (compact) */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-600 dark:text-slate-400">
              {language === 'ar' ? 'محرك الذكاء' : 'AI Engine'}
            </Label>
            <div className="flex rounded-lg border border-white/20 dark:border-white/10 overflow-hidden h-8">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, engineTier: 'speed' }))}
                className={`flex-1 flex items-center justify-center gap-1 text-[12px] font-medium transition-all ${
                  formData.engineTier !== 'intelligence'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/60 dark:bg-black/20 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Zap className="h-3 w-3" />
                {language === 'ar' ? 'سريع' : 'Speed'}
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, engineTier: 'intelligence' }))}
                className={`flex-1 flex items-center justify-center gap-1 text-[12px] font-medium transition-all ${
                  formData.engineTier === 'intelligence'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/60 dark:bg-black/20 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Cpu className="h-3 w-3" />
                {language === 'ar' ? 'ذكاء' : 'Intelligence'}
              </button>
            </div>
          </div>
          </>
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

            {/* Engine Tier Toggle (non-compact) */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'محرك الذكاء الاصطناعي' : 'AI Engine Mode'}
              </Label>
              <div className="flex rounded-xl border border-white/20 dark:border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, engineTier: 'speed' }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
                    formData.engineTier !== 'intelligence'
                      ? 'bg-blue-500 text-white shadow-inner'
                      : 'bg-white/10 dark:bg-black/10 text-slate-600 dark:text-slate-400 hover:bg-white/20'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  <div className="text-left">
                    <div className="text-[13px] font-semibold leading-none">{language === 'ar' ? 'سريع' : 'Speed'}</div>
                    <div className="text-[10px] opacity-75 leading-none mt-0.5">{language === 'ar' ? 'ردود فورية' : 'Fast responses'}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, engineTier: 'intelligence' }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
                    formData.engineTier === 'intelligence'
                      ? 'bg-purple-500 text-white shadow-inner'
                      : 'bg-white/10 dark:bg-black/10 text-slate-600 dark:text-slate-400 hover:bg-white/20'
                  }`}
                >
                  <Cpu className="h-4 w-4" />
                  <div className="text-left">
                    <div className="text-[13px] font-semibold leading-none">{language === 'ar' ? 'ذكاء' : 'Intelligence'}</div>
                    <div className="text-[10px] opacity-75 leading-none mt-0.5">{language === 'ar' ? 'تفكير عميق' : 'Deep reasoning'}</div>
                  </div>
                </button>
              </div>
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
          disabled={isSaving}
          className={compact ? "w-full bg-blue-500 hover:bg-blue-600 text-white h-8 text-[13px] disabled:opacity-60" : "w-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-60"}
          size={compact ? 'sm' : 'sm'}
        >
          <Save className={compact ? "h-3.5 w-3.5 mr-2" : "h-4 w-4 mr-2"} />
          {isSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
        </Button>
      </CardContent>
    </Card>
  );
}
