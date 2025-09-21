import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { callEdgeFunctionWithRetry } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';

interface TextGeneratorPopupProps {
  isOpen?: boolean;
  onClose: () => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply') => void;
  renderAsPage?: boolean;
  initialTab?: 'compose' | 'reply' | 'generated';
}

type Mode = 'compose' | 'reply';
type Tab = 'compose' | 'reply' | 'generated';
type Language = 'en' | 'ar';
type ModelPreference = 'gpt-4o' | 'gpt-4o-mini' | 'auto';

// Stable keys for option values; labels are localized at render time
type ContentTypeKey =
  | 'email' | 'text_message' | 'message' | 'blog_post' | 'story' | 'press_release' | 'cover_letter'
  | 'research_brief' | 'research_report' | 'case_study' | 'how_to_guide' | 'policy_note' | 'product_description' | 'essay' | 'proposal' | 'official_letter' | 'poem'
  | 'school_project' | 'questionnaire';
type ToneKey =
  | 'professional' | 'casual' | 'formal' | 'friendly' | 'persuasive' | 'romantic' | 'neutral' | 'empathetic' | 'confident' | 'humorous' | 'urgent'
  | 'apologetic' | 'inspirational' | 'motivational' | 'sympathetic' | 'sincere' | 'informative' | 'concise' | 'dramatic' | 'suspenseful' | 'authoritative' | 'educational';
type RegisterKey = 'auto' | 'formal' | 'neutral' | 'casual' | 'slang' | 'poetic' | 'gen_z' | 'business_formal' | 'executive_brief';
type LanguageVariantKey =
  | 'auto'
  | 'us_english'
  | 'uk_english'
  | 'canadian_english'
  | 'australian_english'
  | 'msa'            // Modern Standard Arabic
  | 'gulf_arabic';   // Gulf Arabic
type EmojisKey = 'auto' | 'none' | 'light' | 'rich' | 'extra';

const CONTENT_TYPE_KEYS: ContentTypeKey[] = [
  'email', 'text_message', 'message', 'blog_post', 'story', 'press_release', 'cover_letter',
  'research_brief', 'research_report', 'case_study', 'how_to_guide', 'policy_note', 'product_description', 'essay', 'proposal', 'official_letter', 'poem',
  'school_project', 'questionnaire'
];
const TONE_KEYS: ToneKey[] = [
  'professional', 'casual', 'formal', 'friendly', 'persuasive', 'romantic', 'neutral', 'empathetic', 'confident', 'humorous', 'urgent',
  'apologetic', 'inspirational', 'motivational', 'sympathetic', 'sincere', 'informative', 'concise', 'dramatic', 'suspenseful', 'authoritative', 'educational'
];
const REGISTER_KEYS: RegisterKey[] = ['auto', 'formal', 'neutral', 'casual', 'slang', 'poetic', 'gen_z', 'business_formal', 'executive_brief'];
// Base English variants. For Arabic UI we will present Arabic-specific variants instead.
const LANGUAGE_VARIANT_KEYS_EN: LanguageVariantKey[] = ['auto', 'us_english', 'uk_english', 'canadian_english', 'australian_english'];
const LANGUAGE_VARIANT_KEYS_AR: LanguageVariantKey[] = ['auto', 'msa', 'gulf_arabic'];
const EMOJIS_KEYS: EmojisKey[] = ['auto', 'none', 'light', 'rich', 'extra'];

const ctLabel = (k: ContentTypeKey, lang: 'en' | 'ar') => {
  const en: Record<ContentTypeKey, string> = {
    email: 'Email', text_message: 'Text Message', message: 'Message', blog_post: 'Blog Post', story: 'Story', press_release: 'Press Release', cover_letter: 'Cover Letter',
    research_brief: 'Research Brief', research_report: 'Research Report', case_study: 'Case Study', how_to_guide: 'How-to Guide', policy_note: 'Policy Note', product_description: 'Product Description', essay: 'Essay', proposal: 'Proposal', official_letter: 'Official Letter', poem: 'Poem',
    school_project: 'School Project', questionnaire: 'Questionnaire'
  };
  const ar: Record<ContentTypeKey, string> = {
    email: 'بريد إلكتروني', text_message: 'رسالة نصية', message: 'رسالة', blog_post: 'مقال مدونة', story: 'قصة', press_release: 'بيان صحفي', cover_letter: 'خطاب تقديم', poem: 'قصيدة',
    research_brief: 'موجز بحثي', research_report: 'تقرير بحثي', case_study: 'دراسة حالة', how_to_guide: 'دليل إرشادي', policy_note: 'مذكرة سياسات', product_description: 'وصف منتج', essay: 'مقال', proposal: 'اقتراح', official_letter: 'خطاب رسمي',
    school_project: 'مشروع مدرسي', questionnaire: 'استبيان'
  };
  return lang === 'ar' ? ar[k] : en[k];
};
const toneLabel = (k: ToneKey, lang: 'en' | 'ar') => {
  const en: Record<ToneKey, string> = {
    professional: 'Professional', casual: 'Casual', formal: 'Formal', friendly: 'Friendly', persuasive: 'Persuasive', romantic: 'Romantic', neutral: 'Neutral', empathetic: 'Empathetic', confident: 'Confident', humorous: 'Humorous', urgent: 'Urgent',
    apologetic: 'Apologetic', inspirational: 'Inspirational', motivational: 'Motivational', sympathetic: 'Sympathetic', sincere: 'Sincere', informative: 'Informative', concise: 'Concise', dramatic: 'Dramatic', suspenseful: 'Suspenseful', authoritative: 'Authoritative', educational: 'Educational'
  };
  const ar: Record<ToneKey, string> = {
    professional: 'مهني', casual: 'غير رسمي', formal: 'رسمي', friendly: 'ودود', persuasive: 'إقناعي', romantic: 'رومانسي', neutral: 'محايد', empathetic: 'متعاطف', confident: 'واثق', humorous: 'مرح', urgent: 'عاجل',
    apologetic: 'اعتذاري', inspirational: 'ملهم', motivational: 'تحفيزي', sympathetic: 'متعاطف', sincere: 'صادق', informative: 'معلوماتي', concise: 'موجز', dramatic: 'درامي', suspenseful: 'مشوّق', authoritative: 'موثوق', educational: 'تثقيفي'
  };
  return lang === 'ar' ? ar[k] : en[k];
};
const registerLabel = (k: RegisterKey, lang: 'en' | 'ar') => {
  const en: Record<RegisterKey, string> = {
    auto: 'Auto',
    formal: 'Formal',
    neutral: 'Neutral',
    casual: 'Casual',
    slang: 'Slang',
    poetic: 'Poetic / Lyrical',
    gen_z: 'Gen Z',
    business_formal: 'Business Formal',
    executive_brief: 'Executive Brief'
  };
  const ar: Record<RegisterKey, string> = {
    auto: 'تلقائي',
    formal: 'رسمي',
    neutral: 'محايد',
    casual: 'غير رسمي',
    slang: 'عامي',
    poetic: 'شِعري / أدبي',
    gen_z: 'أسلوب جيل زد',
    business_formal: 'رسمي للأعمال',
    executive_brief: 'موجز تنفيذي'
  };
  return lang === 'ar' ? ar[k] : en[k];
};
const langVariantLabel = (k: LanguageVariantKey, lang: 'en' | 'ar') => {
  const en: Record<LanguageVariantKey, string> = {
    auto: 'Auto',
    us_english: 'US English',
    uk_english: 'UK English',
    canadian_english: 'Canadian English',
    australian_english: 'Australian English',
    msa: 'Modern Standard Arabic (MSA)',
    gulf_arabic: 'Gulf Arabic'
  };
  const ar: Record<LanguageVariantKey, string> = {
    auto: 'تلقائي',
    us_english: 'الإنجليزية الأمريكية',
    uk_english: 'الإنجليزية البريطانية',
    canadian_english: 'الإنجليزية الكندية',
    australian_english: 'الإنجليزية الأسترالية',
    msa: 'العربية الفصحى MSA',
    gulf_arabic: 'العربية الخليجية'
  };
  return lang === 'ar' ? ar[k] : en[k];
};
const emojisLabel = (k: EmojisKey, lang: 'en' | 'ar') => {
  const en: Record<EmojisKey, string> = { auto: 'Auto', none: 'None', light: 'Light', rich: 'Rich', extra: 'Extra' };
  const ar: Record<EmojisKey, string> = { auto: 'تلقائي', none: 'بدون', light: 'قليل', rich: 'كثير', extra: 'كثيف جدًا' };
  return lang === 'ar' ? ar[k] : en[k];
};

const TextGeneratorPopup: React.FC<TextGeneratorPopupProps> = ({
  isOpen = true,
  onClose,
  onTextGenerated,
  initialTab = 'compose',
}) => {
  const [activeTab, setActiveTab] = useState<Tab>((initialTab as Tab) || 'compose');
  const [mode, setMode] = useState<Mode>('compose');
  const { language } = useTheme();
  const [modelPreference, setModelPreference] = useState<ModelPreference>('auto');
  const [temperature, setTemperature] = useState<number>(0.7);

  // Compose fields
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState<ContentTypeKey>('email');
  const [tone, setTone] = useState<ToneKey | ''>('');
  const [length, setLength] = useState<'very_short' | 'short' | 'medium' | 'long' | 'very_long' | ''>('');
  const [register, setRegister] = useState<RegisterKey>('auto');
  const [languageVariant, setLanguageVariant] = useState<LanguageVariantKey>('auto');
  const [emojis, setEmojis] = useState<EmojisKey>('auto');

  // Reply fields
  const [keyPoints, setKeyPoints] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [replyLength, setReplyLength] = useState<'very_short' | 'short' | 'medium' | 'long' | 'very_long' | ''>('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);

  // Cached generated texts (persisted)
  const CACHE_KEY = 'wakti_generated_text_cache_v1';
  const [cachedTexts, setCachedTexts] = useState<string[]>([]);

  // Load cache on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCachedTexts(arr.filter((s) => typeof s === 'string').slice(0, 3));
      }
    } catch { }
  }, []);

  // Ensure initialTab is respected on first mount
  useEffect(() => {
    if (initialTab && ['compose','reply','generated'].includes(initialTab)) {
      setActiveTab(initialTab as Tab);
      setMode(initialTab === 'reply' ? 'reply' : 'compose');
    }
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If user opens Generated tab and there's no current text, auto-load newest cached
  useEffect(() => {
    if (activeTab === 'generated' && !generatedText && cachedTexts.length > 0) {
      setGeneratedText(cachedTexts[0]);
    }
  }, [activeTab, generatedText, cachedTexts]);

  const saveCache = (arr: string[]) => {
    setCachedTexts(arr);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(arr)); } catch { }
  };

  const canGenerate = useMemo(() => {
    if (activeTab === 'compose') return topic.trim().length > 0 && !isLoading;
    if (activeTab === 'reply') return originalMessage.trim().length > 0 && !isLoading;
    if (activeTab === 'generated') return generatedText.trim().length > 0 && !isLoading;
    return !isLoading;
  }, [activeTab, topic, originalMessage, generatedText, isLoading]);

  const buildPrompt = (): string => {
    if (activeTab === 'compose') {
      const parts = [
        `Write a ${ctLabel(contentType, language)} about: ${topic}`,
        tone ? `Tone: ${tone}` : '',
        length ? `Length: ${length}` : '',
        register ? `Register: ${register}` : '',
        languageVariant ? `Language Variant: ${languageVariant}` : '',
        emojis ? `Emojis: ${emojis}` : '',
      ].filter(Boolean);
      return parts.join('\n');
    } else if (activeTab === 'reply') {
      const parts = [
        'Craft a reply.',
        keyPoints ? `Key points to include: ${keyPoints}` : '',
        replyLength ? `Reply length: ${replyLength}` : '',
        tone ? `Tone: ${tone}` : '',
        register ? `Register: ${register}` : '',
        languageVariant ? `Language Variant: ${languageVariant}` : '',
        emojis ? `Emojis: ${emojis}` : '',
        'Original message:',
        originalMessage,
      ].filter(Boolean);
      return parts.join('\n');
    } else if (activeTab === 'generated') {
      // Use the last generated text as the seed for regeneration
      // Keep intent but improve clarity, style and flow.
      return [
        'Rewrite and improve the following text while keeping the original intent. Refine clarity, style and flow. Preserve language and emojis if present.',
        '',
        generatedText || ''
      ].join('\n');
    }
    return '';
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedText || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  }, [generatedText]);

  const handleShare = useCallback(async () => {
    try {
      const text = (generatedText || '').trim();
      if (!text) return;
      if (navigator.share) {
        await navigator.share({
          title: 'Wakti • Smart Text',
          text,
        });
      } else {
        // Fallback: try mailto as a basic share option
        const mailto = `mailto:?subject=${encodeURIComponent('Wakti • Smart Text')}&body=${encodeURIComponent(text)}`;
        window.location.href = mailto;
      }
    } catch (e) {
      console.error('Share failed:', e);
      setError(e?.message || 'Share failed');
    }
  }, [generatedText]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setIsLoading(true);
    setError('');
    setCopied(false);
    try {
      const prompt = buildPrompt();
      if (!prompt || !prompt.trim()) {
        setError('Nothing to regenerate');
        return;
      }
      const modeForRequest: 'compose' | 'reply' = activeTab === 'compose' ? 'compose' : activeTab === 'reply' ? 'reply' : mode;
      const effectiveLength = (val: string | ''): 'short' | 'medium' | 'long' | undefined => {
        if (!val) return undefined;
        if (val === 'very_short') return 'short';
        if (val === 'very_long') return 'long';
        return val as 'short' | 'medium' | 'long';
      };
      const body: any = {
        prompt,
        mode: modeForRequest,
        language,
        modelPreference: modelPreference === 'auto' ? undefined : modelPreference,
        temperature,
        contentType: modeForRequest === 'compose' ? contentType : undefined,
        length: modeForRequest === 'compose' ? effectiveLength(length) : undefined,
        replyLength: modeForRequest === 'reply' ? effectiveLength(replyLength) : undefined,
      };

      const resp = await callEdgeFunctionWithRetry<any>('text-generator', {
        body,
        maxRetries: 1,
        retryDelay: 500,
      });

      if (resp?.success && resp?.generatedText) {
        setGeneratedText(resp.generatedText);
        setActiveTab('generated');
        onTextGenerated(resp.generatedText, body.mode);

        // Update cache: newest first, keep max 3, remove duplicates/empties
        const clean = (resp.generatedText || '').trim();
        if (clean) {
          const next = [clean, ...cachedTexts.filter((t) => t.trim() && t.trim() !== clean)].slice(0, 3);
          saveCache(next);
        }
      } else {
        setError(resp?.error || 'Failed to generate text');
      }
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setIsLoading(false);
    }
  }, [canGenerate, buildPrompt, activeTab, language, modelPreference, temperature, contentType, length, replyLength, onTextGenerated]);

  const title = language === 'ar' ? 'منشئ النص الذكي' : 'Smart Text Generator';

  return (
    <div className="w-full h-full flex items-start justify-center p-4">
      <div className="w-full max-w-6xl rounded-xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 mt-6 border-b flex items-center gap-3">
          <h1 className="text-lg font-semibold whitespace-nowrap">{title}</h1>
          <div className="ml-auto" />
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => { setActiveTab('compose'); setMode('compose'); }}
              className={`px-3 py-2 rounded-md border ${activeTab === 'compose' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >{language === 'ar' ? 'تأليف' : 'Compose'}</button>
            <button
              onClick={() => { setActiveTab('reply'); setMode('reply'); }}
              className={`px-3 py-2 rounded-md border ${activeTab === 'reply' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >{language === 'ar' ? 'رد' : 'Reply'}</button>
            <button
              disabled={!generatedText && cachedTexts.length === 0}
              onClick={() => {
                // Switch to Generated; if empty, preload latest cached
                if (!generatedText && cachedTexts.length > 0) {
                  setGeneratedText(cachedTexts[0]);
                }
                setActiveTab('generated');
              }}
              className={`px-3 py-2 rounded-md border ${
                activeTab === 'generated'
                  ? 'bg-primary text-primary-foreground'
                  : (generatedText || cachedTexts.length > 0)
                    ? 'hover:bg-muted'
                    : 'opacity-60 cursor-not-allowed'
              }`}
            >{language === 'ar' ? 'النص المُولد' : 'Generated Text'}</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 md:pb-6 pb-[calc(var(--app-bottom-tabs-h)+16px)]">
          {activeTab === 'compose' && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === 'ar' ? 'الموضوع' : 'Topic to write'}</label>
                <textarea
                  className="w-full border rounded p-3 min-h-[120px]"
                  placeholder={language === 'ar' ? 'أدخل الموضوع أو الفكرة...' : 'Topic or idea you want to write about...'}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              {/* Row 1: Content Type | Tone */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'نوع المحتوى' : 'Content Type'}</label>
                  <select className="border rounded px-3 py-2" value={contentType} onChange={(e) => setContentType(e.target.value as ContentTypeKey)}>
                    {CONTENT_TYPE_KEYS.map((k) => (<option key={k} value={k}>{ctLabel(k, language)}</option>))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'النبرة' : 'Tone'}</label>
                  <select className="border rounded px-3 py-2" value={tone} onChange={(e) => setTone(e.target.value as ToneKey)}>
                    <option value="">{language === 'ar' ? 'اختر النبرة' : 'Select tone'}</option>
                    {TONE_KEYS.map((k) => (<option key={k} value={k}>{toneLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>

              {/* Row 2: Length | Register (requested side-by-side) */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'الطول' : 'Length'}</label>
                  <select className="border rounded px-3 py-2" value={length} onChange={(e) => setLength(e.target.value as any)}>
                    <option value="">{language === 'ar' ? 'اختر الطول' : 'Select length'}</option>
                    <option value="very_short">{language === 'ar' ? 'قصير جدًا' : 'Very short'}</option>
                    <option value="short">{language === 'ar' ? 'قصير' : 'Short'}</option>
                    <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                    <option value="long">{language === 'ar' ? 'طويل' : 'Long'}</option>
                    <option value="very_long">{language === 'ar' ? 'طويل جدًا' : 'Very long'}</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'السجل اللغوي' : 'Register'}</label>
                  <select className="border rounded px-3 py-2" value={register} onChange={(e) => setRegister(e.target.value as RegisterKey)}>
                    {REGISTER_KEYS.map((k) => (<option key={k} value={k}>{registerLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>

              {/* Row 2: Language Variant | Emojis */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'متغير اللغة' : 'Language Variant'}</label>
                  <select className="border rounded px-3 py-2" value={languageVariant} onChange={(e) => setLanguageVariant(e.target.value as LanguageVariantKey)}>
                    {(language === 'ar' ? LANGUAGE_VARIANT_KEYS_AR : LANGUAGE_VARIANT_KEYS_EN).map((k) => (
                      <option key={k} value={k}>{langVariantLabel(k, language)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Emojis</label>
                  <select className="border rounded px-3 py-2" value={emojis} onChange={(e) => setEmojis(e.target.value as EmojisKey)}>
                    {EMOJIS_KEYS.map((k) => (<option key={k} value={k}>{emojisLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>

              {/* Row 3 removed (Register was duplicated) */}
            </div>
          )}

          {activeTab === 'reply' && (
            <div className="space-y-4">
              <div className="grid gap-3 mb-3">
                <label className="text-sm font-medium">{language === 'ar' ? 'نقاط أساسية وكلمات مفتاحية' : 'Key Points & Keywords'}</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[96px]"
                  placeholder={
                    language === 'ar'
                      ? 'نقاط أساسية مفصولة بفواصل. مثال: اعتذار عن التأخير، رقم الطلب #1234، إرسال البديل، رقم التتبع، خصم 10%'
                      : 'Must‑have points, comma‑separated. e.g., apologize for delay, order #1234, send replacement, tracking no., 10% coupon'
                  }
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === 'ar' ? 'الرسالة الأصلية' : 'Original Message'}</label>
                <textarea
                  className="w-full border rounded p-3 min-h-[140px]"
                  placeholder={language === 'ar' ? 'الرسالة التي تريد الرد عليها...' : 'Original message you want to reply to...'}
                  value={originalMessage}
                  onChange={(e) => setOriginalMessage(e.target.value)}
                />
              </div>

              {/* Row 1: Tone | Reply Length */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'النبرة' : 'Tone'}</label>
                  <select className="border rounded px-3 py-2" value={tone} onChange={(e) => setTone(e.target.value as ToneKey)}>
                    <option value="">{language === 'ar' ? 'اختر النبرة' : 'Select tone'}</option>
                    {TONE_KEYS.map((k) => (<option key={k} value={k}>{toneLabel(k, language)}</option>))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'الطول' : 'Length'}</label>
                  <select className="border rounded px-3 py-2" value={replyLength} onChange={(e) => setReplyLength(e.target.value as any)}>
                    <option value="">{language === 'ar' ? 'اختر الطول' : 'Select length'}</option>
                    <option value="very_short">{language === 'ar' ? 'قصير جدًا' : 'Very short'}</option>
                    <option value="short">{language === 'ar' ? 'قصير' : 'Short'}</option>
                    <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                    <option value="long">{language === 'ar' ? 'طويل' : 'Long'}</option>
                    <option value="very_long">{language === 'ar' ? 'طويل جدًا' : 'Very long'}</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Language Variant | Emojis */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'متغير اللغة' : 'Language Variant'}</label>
                  <select className="border rounded px-3 py-2" value={languageVariant} onChange={(e) => setLanguageVariant(e.target.value as LanguageVariantKey)}>
                    {(language === 'ar' ? LANGUAGE_VARIANT_KEYS_AR : LANGUAGE_VARIANT_KEYS_EN).map((k) => (
                      <option key={k} value={k}>{langVariantLabel(k, language)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Emojis</label>
                  <select className="border rounded px-3 py-2" value={emojis} onChange={(e) => setEmojis(e.target.value as EmojisKey)}>
                    {EMOJIS_KEYS.map((k) => (<option key={k} value={k}>{emojisLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>

              {/* Row 3: Register */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'السجل اللغوي' : 'Register'}</label>
                  <select className="border rounded px-3 py-2" value={register} onChange={(e) => setRegister(e.target.value as RegisterKey)}>
                    {REGISTER_KEYS.map((k) => (<option key={k} value={k}>{registerLabel(k, language)}</option>))}
                  </select>
                </div>
                <div></div>
              </div>
            </div>
          )}

          {activeTab === 'generated' && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === 'ar' ? 'النص المُولد' : 'Generated Text'}</label>
                <textarea className="w-full border rounded p-3 min-h-[220px]" readOnly value={generatedText} />
              </div>
              {/* Cached texts: show up to 3 previous results */}
              {cachedTexts.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'نصوص محفوظة:' : 'Cached texts:'}
                  </div>
                  <div className="flex flex-col gap-2">
                    {cachedTexts.map((t, idx) => (
                      <button
                        key={idx}
                        className="text-left border rounded p-2 hover:bg-muted"
                        onClick={() => { setGeneratedText(t); setActiveTab('generated'); }}
                        title={language === 'ar' ? 'تحميل في مربع النص' : 'Load into Generated Text'}
                      >
                        <div className="text-xs line-clamp-2 whitespace-pre-wrap break-words">{t}</div>
                      </button>
                    ))}
                  </div>
                  <div>
                    <button
                      className="px-3 py-1.5 rounded border hover:bg-muted"
                      onClick={() => { saveCache([]); }}
                    >
                      {language === 'ar' ? 'مسح المحفوظات' : 'Clear Cache'}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded border hover:bg-muted" onClick={handleCopy}>
                  {copied ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') : (language === 'ar' ? 'نسخ' : 'Copy')}
                </button>
                <button className="px-3 py-1.5 rounded border hover:bg-muted" onClick={handleGenerate}>
                  {language === 'ar' ? 'إعادة توليد' : 'Regenerate'}
                </button>
                <button
                  className="px-3 py-1.5 rounded border hover:bg-muted"
                  onClick={() => setGeneratedText('')}
                  aria-label="Clear generated text"
                >
                  {language === 'ar' ? 'مسح النص' : 'Clear'}
                </button>
                <button
                  className="px-3 py-1.5 rounded border hover:bg-muted"
                  onClick={handleShare}
                  disabled={!generatedText.trim()}
                >
                  {language === 'ar' ? 'إرسال' : 'Send'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-sm text-destructive">{error}</div>
          )}
          {/* Inline generate button at end of content (not sticky) */}
          <div className="mt-6 flex justify-end">
            <button
              className={`px-5 py-2.5 rounded-full text-sm font-medium shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 hover:shadow-xl transition-all ${canGenerate ? '' : 'opacity-60 cursor-not-allowed'}`}
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {isLoading ? (language === 'ar' ? 'جارٍ الإنشاء...' : 'Generating...') : (language === 'ar' ? 'توليد النص' : 'Generate Text')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextGeneratorPopup;
