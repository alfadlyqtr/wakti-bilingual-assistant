import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { callEdgeFunctionWithRetry } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import DiagramsTab from './DiagramsTab';
import PresentationTab from './PresentationTab';
import TextTranslateTab from './TextTranslateTab';

interface TextGeneratorPopupProps {
  isOpen?: boolean;
  onClose: () => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply') => void;
  renderAsPage?: boolean;
  initialTab?: 'compose' | 'reply' | 'generated' | 'diagrams' | 'presentation' | 'translate';
}

type Mode = 'compose' | 'reply';
type Tab = 'compose' | 'reply' | 'generated' | 'diagrams' | 'presentation' | 'translate';
type Language = 'en' | 'ar';
type ModelPreference = 'gpt-4o' | 'gpt-4o-mini' | 'auto';

// Stable keys for option values; labels are localized at render time
type ContentTypeKey =
  | 'auto' | 'email' | 'text_message' | 'message' | 'blog_post' | 'story' | 'press_release' | 'cover_letter'
  | 'research_brief' | 'research_report' | 'case_study' | 'how_to_guide' | 'policy_note' | 'product_description' | 'report' | 'essay' | 'proposal' | 'official_letter' | 'poem'
  | 'school_project' | 'questionnaire';
type ToneKey =
  | 'auto' | 'human' | 'professional' | 'casual' | 'formal' | 'friendly' | 'persuasive' | 'romantic' | 'neutral' | 'empathetic' | 'confident' | 'humorous' | 'urgent'
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
  'auto',
  'email', 'text_message', 'message', 'blog_post', 'story', 'press_release', 'cover_letter',
  'research_brief', 'research_report', 'case_study', 'how_to_guide', 'policy_note', 'product_description', 'report', 'essay', 'proposal', 'official_letter', 'poem',
  'school_project', 'questionnaire'
];
const TONE_KEYS: ToneKey[] = [
  'auto',
  'human',
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
    auto: 'Auto',
    email: 'Email', text_message: 'Text Message', message: 'Message', blog_post: 'Blog Post', story: 'Story', press_release: 'Press Release', cover_letter: 'Cover Letter',
    research_brief: 'Research Brief', research_report: 'Research Report', case_study: 'Case Study', how_to_guide: 'How-to Guide', policy_note: 'Policy Note', product_description: 'Product Description', report: 'Report', essay: 'Essay', proposal: 'Proposal', official_letter: 'Official Letter', poem: 'Poem',
    school_project: 'School Project', questionnaire: 'Questionnaire'
  };
  const ar: Record<ContentTypeKey, string> = {
    auto: 'تلقائي',
    email: 'بريد إلكتروني', text_message: 'رسالة نصية', message: 'رسالة', blog_post: 'مقال مدونة', story: 'قصة', press_release: 'بيان صحفي', cover_letter: 'خطاب تقديم', poem: 'قصيدة',
    research_brief: 'موجز بحثي', research_report: 'تقرير بحثي', case_study: 'دراسة حالة', how_to_guide: 'دليل إرشادي', policy_note: 'مذكرة سياسات', product_description: 'وصف منتج', report: 'تقرير', essay: 'مقال', proposal: 'اقتراح', official_letter: 'خطاب رسمي',
    school_project: 'مشروع مدرسي', questionnaire: 'استبيان'
  };
  return lang === 'ar' ? ar[k] : en[k];
};
const toneLabel = (k: ToneKey, lang: 'en' | 'ar') => {
  const en: Record<ToneKey, string> = {
    auto: 'Auto',
    human: 'Human (never sounds like AI)',
    professional: 'Professional', casual: 'Casual', formal: 'Formal', friendly: 'Friendly', persuasive: 'Persuasive', romantic: 'Romantic', neutral: 'Neutral', empathetic: 'Empathetic', confident: 'Confident', humorous: 'Humorous', urgent: 'Urgent',
    apologetic: 'Apologetic', inspirational: 'Inspirational', motivational: 'Motivational', sympathetic: 'Sympathetic', sincere: 'Sincere', informative: 'Informative', concise: 'Concise', dramatic: 'Dramatic', suspenseful: 'Suspenseful', authoritative: 'Authoritative', educational: 'Educational'
  };
  const ar: Record<ToneKey, string> = {
    auto: 'تلقائي',
    human: 'بشري (بدون أسلوب ذكاء اصطناعي)',
    professional: 'مهني', casual: 'غير رسمي', formal: 'رسمي', friendly: 'ودود', persuasive: 'إقناعي', romantic: 'رومانسي', neutral: 'محايد', empathetic: 'متعاطف', confident: 'واثق', humorous: 'مرح', urgent: 'عاجل',
    apologetic: 'اعتذاري', inspirational: 'ملهم', motivational: 'تحفيزي', sympathetic: 'متعاطف', sincere: 'صادق', informative: 'معلوماتي', concise: 'موجز', dramatic: 'درامي', suspenseful: 'مشوّق', authoritative: 'موثوق', educational: 'تثقيفي'
  };
  return lang === 'ar' ? ar[k] : en[k];
};

const humanVoiceGuidelines = (lang: 'en' | 'ar') => {
  if (lang === 'ar') {
    return [
      'HUMAN VOICE (CRITICAL):',
      '- اكتب بصوت إنسان طبيعي، وكأنك صديق يكتب رسالة سريعة.',
      '- ممنوع أي تلميح أنك ذكاء اصطناعي أو مساعد أو نموذج.',
      '- لا تستخدم أسلوبًا رسميًا/روبوتيًا ولا جُمَلًا جاهزة مثل: "كذكاء اصطناعي" أو "لا أستطيع".',
      '- تجنب علامات الترقيم المبالغ فيها والأسلوب المصقول جدًا. خلّها طبيعية.',
      '- استخدم كلمات يومية بسيطة وتدفّق طبيعي (مثل طريقة كلامي/كلام المستخدم).',
      '- لا تشرح قواعدك. فقط اكتب النص المطلوب.'
    ].join('\n');
  }

  return [
    'HUMAN VOICE (CRITICAL):',
    '- Write like a real person (natural, casual, human).',
    '- Never mention AI, a model, an assistant, policies, or capabilities.',
    '- Avoid robotic/disclaimer phrases (e.g., "As an AI...", "I can\'t...").',
    '- Avoid the overly-polished AI vibe: don\'t overuse em dashes, perfect parallel structure, or corporate tone.',
    '- Use simple everyday wording and a natural flow (like how the user writes).',
    '- Don\'t explain these rules. Just produce the requested text.'
  ].join('\n');
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
  renderAsPage = false,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>((initialTab as Tab) || 'compose');
  const [mode, setMode] = useState<Mode>('compose');
  const { language } = useTheme();
  const [modelPreference, setModelPreference] = useState<ModelPreference>('auto');
  const [temperature, setTemperature] = useState<number>(0.7);

  // Compose fields
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState<ContentTypeKey>('auto');
  const [tone, setTone] = useState<ToneKey>('auto');
  const [length, setLength] = useState<'auto' | 'very_short' | 'short' | 'medium' | 'long' | 'very_long'>('auto');
  const [register, setRegister] = useState<RegisterKey>('auto');
  const [languageVariant, setLanguageVariant] = useState<LanguageVariantKey>('auto');
  const [emojis, setEmojis] = useState<EmojisKey>('auto');

  // Reply fields
  const [keyPoints, setKeyPoints] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [replyLength, setReplyLength] = useState<'auto' | 'very_short' | 'short' | 'medium' | 'long' | 'very_long'>('auto');
  const [replyAudience, setReplyAudience] = useState<'sender' | 'someone_else'>('sender');
  const [replyRecipientName, setReplyRecipientName] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);

  // Screenshot upload refs
  const composeFileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingCompose, setIsExtractingCompose] = useState(false);
  const [isExtractingReply, setIsExtractingReply] = useState(false);
  const [extractProgressCompose, setExtractProgressCompose] = useState<{ current: number; total: number } | null>(null);
  const [extractProgressReply, setExtractProgressReply] = useState<{ current: number; total: number } | null>(null);

  // Extracted form fields (from screenshot)
  interface ExtractedFormFields {
    subject?: string;
    category?: string;
    service_affected?: string;
    severity?: string;
    message?: string;
    sender?: string;
    recipient?: string;
  }
  const [extractedForm, setExtractedForm] = useState<{ formType: string; fields: ExtractedFormFields } | null>(null);
  const [formSubject, setFormSubject] = useState('');
  const [formServiceAffected, setFormServiceAffected] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formSeverity, setFormSeverity] = useState('');
  const [showExtractedFields, setShowExtractedFields] = useState(false);

  const buildFormSummary = useCallback((fields: ExtractedFormFields) => {
    const subject = (fields.subject || '').trim();
    const service = (fields.service_affected || fields.category || '').trim();
    const severityVal = (fields.severity || '').trim();
    const message = (fields.message || '').trim();

    const lines: string[] = [];
    if (subject) lines.push(`${language === 'ar' ? 'الموضوع' : 'Subject'}: ${subject}`);
    if (service) lines.push(`${language === 'ar' ? 'الخدمة المتأثرة' : 'Service affected'}: ${service}`);
    if (severityVal) lines.push(`${language === 'ar' ? 'الأولوية' : 'Severity'}: ${severityVal}`);
    if (message) lines.push(`${language === 'ar' ? 'الرسالة' : 'Message'}: ${message}`);
    return lines.join('\n');
  }, [language]);

  const mergeExtractedFields = useCallback((base: ExtractedFormFields, incoming: ExtractedFormFields): ExtractedFormFields => {
    const pick = (a?: string, b?: string) => (a && a.trim() ? a : (b && b.trim() ? b : ''));
    const messageA = (base.message || '').trim();
    const messageB = (incoming.message || '').trim();
    const mergedMessage = messageA && messageB
      ? `${messageA}\n\n${messageB}`
      : (messageA || messageB);

    return {
      subject: pick(base.subject, incoming.subject),
      category: pick(base.category, incoming.category),
      service_affected: pick(base.service_affected, incoming.service_affected),
      severity: pick(base.severity, incoming.severity),
      message: mergedMessage,
      sender: pick(base.sender, incoming.sender),
      recipient: pick(base.recipient, incoming.recipient),
    };
  }, []);

  // Cached generated texts (persisted)
  const CACHE_KEY = 'wakti_generated_text_cache_v1';
  const [cachedTexts, setCachedTexts] = useState<string[]>([]);

  // Local accent for this page (match purple Text Generator icon)
  const fieldAccent = "border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500";
  const placeholderMuted = "placeholder:text-muted-foreground/60 dark:placeholder:text-muted-foreground/50";

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

  useEffect(() => {
    if (initialTab && ['compose', 'reply', 'generated', 'diagrams', 'presentation', 'translate'].includes(initialTab)) {
      setActiveTab(initialTab as Tab);
      if (initialTab !== 'diagrams') {
        setMode(initialTab === 'reply' ? 'reply' : 'compose');
      }
    }
  }, [initialTab]);

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
      const humanBlock = tone === 'human' ? humanVoiceGuidelines(language) : '';
      const parts = [
        contentType === 'auto'
          ? `Write about: ${topic}`
          : `Write a ${ctLabel(contentType, language)} about: ${topic}`,
        tone !== 'auto' && tone !== 'human' ? `Tone: ${tone}` : '',
        length !== 'auto' ? `Length: ${length}` : '',
        register ? `Register: ${register}` : '',
        languageVariant ? `Language Variant: ${languageVariant}` : '',
        emojis ? `Emojis: ${emojis}` : '',
        humanBlock,
      ].filter(Boolean);
      return parts.join('\n');
    } else if (activeTab === 'reply') {
      const humanBlock = tone === 'human' ? humanVoiceGuidelines(language) : '';
      // If a screenshot was detected as a form, switch Reply into Fill Mode.
      // Output should be copy/paste friendly (Subject + Message), not a letter-style reply.
      if (extractedForm) {
        const parts = [
          language === 'ar'
            ? 'أنت تساعد المستخدم في تعبئة نموذج (Form).'
            : 'You are helping the user fill out a form.',
          language === 'ar'
            ? 'اكتب نصًّا جاهزًا للصق في حقول النموذج.'
            : 'Generate copy/paste-ready text for the form fields.',
          language === 'ar'
            ? 'أعد النتيجة بهذا الشكل فقط، بدون أي كلام إضافي:'
            : 'Return ONLY in this exact format, with no extra text:',
          'SUBJECT: <one short subject line>',
          'MESSAGE: <the full message body to paste into the form>',
          '',
          language === 'ar' ? 'بيانات النموذج:' : 'Form details:',
          `Subject (detected): ${formSubject || 'N/A'}`,
          `Service affected (detected): ${formServiceAffected || 'N/A'}`,
          formSeverity ? `Severity (detected): ${formSeverity}` : '',
          `Message/context (detected): ${formMessage || 'N/A'}`,
          keyPoints ? `Key points to include: ${keyPoints}` : '',
          replyLength !== 'auto' ? `Reply length: ${replyLength}` : '',
          tone !== 'auto' && tone !== 'human' ? `Tone: ${tone}` : '',
          register ? `Register: ${register}` : '',
          languageVariant ? `Language Variant: ${languageVariant}` : '',
          emojis ? `Emojis: ${emojis}` : '',
          humanBlock,
        ].filter(Boolean);
        return parts.join('\n');
      }

      // Normal reply flow (email/message): choose whether we are replying to the sender
      // or messaging someone else (e.g., a friend) about the original message.
      const audienceLine = replyAudience === 'someone_else'
        ? `Write a message to my friend${replyRecipientName.trim() ? ` (${replyRecipientName.trim()})` : ''}. The message should be addressed to my friend, not to the original sender.`
        : 'Craft a reply to the original sender.';

      const parts = [
        audienceLine,
        replyAudience === 'someone_else'
          ? 'Your job: read the original message, extract the key issues/next steps, then write a clear message to my friend telling them what to do.'
          : '',
        keyPoints ? `Instructions / key points from me: ${keyPoints}` : '',
        replyLength !== 'auto' ? `Reply length: ${replyLength}` : '',
        tone !== 'auto' && tone !== 'human' ? `Tone: ${tone}` : '',
        register ? `Register: ${register}` : '',
        languageVariant ? `Language Variant: ${languageVariant}` : '',
        emojis ? `Emojis: ${emojis}` : '',
        humanBlock,
        'Original message (context):',
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

  const parsedGenerated = useMemo(() => {
    const text = (generatedText || '').trim();
    const subjectMatch = text.match(/\bSUBJECT:\s*(.+?)(?=\n\s*MESSAGE:|$)/is);
    const messageMatch = text.match(/\bMESSAGE:\s*([\s\S]+)/i);
    const subject = (subjectMatch?.[1] || '').trim();
    const message = (messageMatch?.[1] || '').trim();
    const hasFillFormat = !!(subject && message);
    return { hasFillFormat, subject, message };
  }, [generatedText]);

  const copyWithFeedback = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  }, []);

  const handleCopySubject = useCallback(async () => {
    if (!parsedGenerated.hasFillFormat) return;
    await copyWithFeedback(parsedGenerated.subject);
    setCopyMenuOpen(false);
  }, [parsedGenerated, copyWithFeedback]);

  const handleCopyMessage = useCallback(async () => {
    if (!parsedGenerated.hasFillFormat) return;
    await copyWithFeedback(parsedGenerated.message);
    setCopyMenuOpen(false);
  }, [parsedGenerated, copyWithFeedback]);

  const handleCopyAll = useCallback(async () => {
    await copyWithFeedback((generatedText || '').trim());
    setCopyMenuOpen(false);
  }, [generatedText, copyWithFeedback]);

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
      const effectiveLength = (val: string): 'short' | 'medium' | 'long' | undefined => {
        if (!val || val === 'auto') return undefined;
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
        contentType: modeForRequest === 'compose' ? (contentType === 'auto' ? undefined : contentType) : undefined,
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

  // Handle screenshot upload(s) and extract text using text-generator's extract mode
  const handleScreenshotUpload = useCallback(async (
    files: File[],
    target: 'compose' | 'reply'
  ) => {
    if (!files?.length) return;
    const setExtracting = target === 'compose' ? setIsExtractingCompose : setIsExtractingReply;
    const setProgress = target === 'compose' ? setExtractProgressCompose : setExtractProgressReply;

    setExtracting(true);
    setProgress({ current: 0, total: files.length });
    setError('');

    try {
      let combinedTextParts: string[] = [];
      let combinedFields: ExtractedFormFields = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });

        // Convert file to base64 data URI
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;

        const resp = await callEdgeFunctionWithRetry<any>('text-generator', {
          body: {
            mode: 'extract',
            image: base64,
            extractTarget: target,
            language
          },
          maxRetries: 2,
          retryDelay: 1000,
        });

        const extractedText = (resp?.extractedText || '').trim();
        const formData = resp?.extractedForm;

        if (formData?.fields) {
          combinedFields = mergeExtractedFields(combinedFields, formData.fields as ExtractedFormFields);
        }
        if (extractedText) {
          combinedTextParts.push(extractedText);
        }
      }

      const combinedText = combinedTextParts.join('\n\n');

      // If we detected any form fields across the uploads, treat it as a combined form
      const hasAnyFormField = Object.values(combinedFields).some((v) => (v || '').toString().trim());
      if (hasAnyFormField) {
        setExtractedForm({ formType: extractedForm?.formType || 'other', fields: combinedFields });
        setFormSubject(combinedFields.subject || '');
        setFormServiceAffected(combinedFields.service_affected || combinedFields.category || '');
        setFormMessage(combinedFields.message || '');
        setFormSeverity(combinedFields.severity || '');
        setShowExtractedFields(false);

        if (target === 'reply') {
          const summary = buildFormSummary(combinedFields);
          if (summary.trim()) setOriginalMessage(summary);
        } else if (combinedText) {
          // Compose: if it was a form-like image set, also include raw combined text into topic
          setTopic((prev) => prev ? `${prev}\n\n${combinedText}` : combinedText);
        }
        return;
      }

      // Fallback: no structured form detected, just fill/append the combined text
      if (combinedText) {
        if (target === 'compose') {
          setTopic((prev) => prev ? `${prev}\n\n${combinedText}` : combinedText);
        } else {
          setOriginalMessage((prev) => prev ? `${prev}\n\n${combinedText}` : combinedText);
        }
      } else {
        setError(language === 'ar' ? 'فشل استخراج النص من الصورة' : 'Failed to extract text from image');
      }
    } catch (e: any) {
      console.error('Screenshot extraction error:', e);
      setError(e?.message || (language === 'ar' ? 'فشل استخراج النص' : 'Text extraction failed'));
    } finally {
      setExtracting(false);
      setProgress(null);
    }
  }, [language, buildFormSummary, mergeExtractedFields, extractedForm?.formType]);

  // Keep Original Message in sync with the editable extracted form fields
  useEffect(() => {
    if (!extractedForm) return;
    const summary = buildFormSummary({
      subject: formSubject,
      service_affected: formServiceAffected,
      severity: formSeverity,
      message: formMessage,
    });
    if (summary.trim()) setOriginalMessage(summary);
  }, [extractedForm, buildFormSummary, formSubject, formServiceAffected, formSeverity, formMessage]);

  // Clear extracted form
  const clearExtractedForm = useCallback(() => {
    setExtractedForm(null);
    setFormSubject('');
    setFormServiceAffected('');
    setFormMessage('');
    setFormSeverity('');
    setShowExtractedFields(false);
  }, []);

  const body = (
    <div className="px-6 md:pb-6 pb-[calc(var(--app-bottom-tabs-h)+16px)]">
          {activeTab === 'compose' && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'الموضوع' : 'Topic to write'}</label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={composeFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      aria-label={language === 'ar' ? 'رفع صور' : 'Upload screenshots'}
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) handleScreenshotUpload(files, 'compose');
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => composeFileInputRef.current?.click()}
                      disabled={isExtractingCompose}
                      className={`text-xs px-2 py-1 rounded-md border hover:bg-muted flex items-center gap-1 ${isExtractingCompose ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 animate-pulse' : ''}`}
                      aria-label={language === 'ar' ? 'رفع صورة' : 'Upload screenshot'}
                      title={language === 'ar' ? 'رفع صورة لاستخراج النص' : 'Upload screenshot to extract text'}
                    >
                      {isExtractingCompose
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <ImagePlus className="w-3.5 h-3.5" />}
                      {isExtractingCompose
                        ? (extractProgressCompose
                          ? `${extractProgressCompose.current}/${extractProgressCompose.total}`
                          : (language === 'ar' ? 'جارٍ...' : '...'))
                        : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopic('')}
                      className="text-xs px-2 py-1 rounded-md border hover:bg-muted"
                      aria-label={language === 'ar' ? 'مسح النص' : 'Clear text'}
                    >
                      {language === 'ar' ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                </div>
                <textarea
                  className={`w-full border rounded p-3 min-h-[120px] ${fieldAccent} ${placeholderMuted}`}
                  placeholder={language === 'ar' ? 'أدخل الموضوع أو الفكرة...' : 'Topic or idea you want to write about...'}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              {/* Row 1: Content Type | Tone */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'نوع المحتوى' : 'Content Type'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={contentType} onChange={(e) => setContentType(e.target.value as ContentTypeKey)}>
                    {CONTENT_TYPE_KEYS.map((k) => (<option key={k} value={k}>{ctLabel(k, language)}</option>))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'النبرة' : 'Tone'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={tone} onChange={(e) => setTone(e.target.value as ToneKey)}>
                    {TONE_KEYS.map((k) => (<option key={k} value={k}>{toneLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>

              {/* Row 2: Length | Register (requested side-by-side) */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'الطول' : 'Length'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={length} onChange={(e) => setLength(e.target.value as any)}>
                    <option value="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</option>
                    <option value="very_short">{language === 'ar' ? 'قصير جدًا' : 'Very short'}</option>
                    <option value="short">{language === 'ar' ? 'قصير' : 'Short'}</option>
                    <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                    <option value="long">{language === 'ar' ? 'طويل' : 'Long'}</option>
                    <option value="very_long">{language === 'ar' ? 'طويل جدًا' : 'Very long'}</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'السجل اللغوي' : 'Register'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={register} onChange={(e) => setRegister(e.target.value as RegisterKey)}>
                    {REGISTER_KEYS.map((k) => (<option key={k} value={k}>{registerLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>

              {/* Row 2: Language Variant | Emojis */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'متغير اللغة' : 'Language Variant'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={languageVariant} onChange={(e) => setLanguageVariant(e.target.value as LanguageVariantKey)}>
                    {(language === 'ar' ? LANGUAGE_VARIANT_KEYS_AR : LANGUAGE_VARIANT_KEYS_EN).map((k) => (
                      <option key={k} value={k}>{langVariantLabel(k, language)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Emojis</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={emojis} onChange={(e) => setEmojis(e.target.value as EmojisKey)}>
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'نقاط أساسية وكلمات مفتاحية' : 'Key Points & Keywords'}</label>
                  <button
                    type="button"
                    onClick={() => setKeyPoints('')}
                    className="text-xs px-2 py-1 rounded-md border hover:bg-muted"
                    aria-label={language === 'ar' ? 'مسح النص' : 'Clear text'}
                  >
                    {language === 'ar' ? 'مسح' : 'Clear'}
                  </button>
                </div>
                <textarea
                  className={`w-full border rounded px-3 py-2 min-h-[96px] ${fieldAccent} ${placeholderMuted}`}
                  placeholder={
                    language === 'ar'
                      ? 'نقاط أساسية مفصولة بفواصل. مثال: اعتذار عن التأخير، رقم الطلب #1234، إرسال البديل، رقم التتبع، خصم 10%'
                      : 'Must‑have points, comma‑separated. e.g., apologize for delay, order #1234, send replacement, tracking no., 10% coupon'
                  }
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                />
              </div>

              {/* Row 1: Who is this message for? | Name (optional) */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="replyAudienceSelect">{language === 'ar' ? 'لمن هذه الرسالة؟' : 'Who is this message for?'} </label>
                  <select
                    id="replyAudienceSelect"
                    className={`border rounded px-3 py-2 ${fieldAccent}`}
                    value={replyAudience}
                    onChange={(e) => setReplyAudience(e.target.value as 'sender' | 'someone_else')}
                  >
                    <option value="sender">{language === 'ar' ? 'الرد على المرسل الأصلي' : 'Reply to original sender'}</option>
                    <option value="someone_else">{language === 'ar' ? 'رسالة لشخص آخر (صديق/زميل)' : 'Message someone else (friend)'}</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="replyRecipientNameInput">{language === 'ar' ? 'اسم الشخص (اختياري)' : 'Name (optional)'} </label>
                  <input
                    id="replyRecipientNameInput"
                    type="text"
                    className={`border rounded px-3 py-2 ${fieldAccent} ${placeholderMuted}`}
                    placeholder={language === 'ar' ? 'مثال: Jan' : 'e.g., Jan'}
                    value={replyRecipientName}
                    onChange={(e) => setReplyRecipientName(e.target.value)}
                    disabled={replyAudience !== 'someone_else'}
                  />
                </div>
              </div>

              {/* Row 2: Content Type | Tone */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'نوع المحتوى' : 'Content Type'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={contentType} onChange={(e) => setContentType(e.target.value as ContentTypeKey)}>
                    {CONTENT_TYPE_KEYS.map((k) => (<option key={k} value={k}>{ctLabel(k, language)}</option>))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'النبرة' : 'Tone'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={tone} onChange={(e) => setTone(e.target.value as ToneKey)}>
                    {TONE_KEYS.map((k) => (<option key={k} value={k}>{toneLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>

              {/* Row 3: Length | Register */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'الطول' : 'Length'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={replyLength} onChange={(e) => setReplyLength(e.target.value as any)}>
                    <option value="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</option>
                    <option value="very_short">{language === 'ar' ? 'قصير جدًا' : 'Very short'}</option>
                    <option value="short">{language === 'ar' ? 'قصير' : 'Short'}</option>
                    <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                    <option value="long">{language === 'ar' ? 'طويل' : 'Long'}</option>
                    <option value="very_long">{language === 'ar' ? 'طويل جدًا' : 'Very long'}</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'السجل اللغوي' : 'Register'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={register} onChange={(e) => setRegister(e.target.value as RegisterKey)}>
                    {REGISTER_KEYS.map((k) => (<option key={k} value={k}>{registerLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>

              {/* Row 4: Language Variant | Emojis */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === 'ar' ? 'متغير اللغة' : 'Language Variant'}</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={languageVariant} onChange={(e) => setLanguageVariant(e.target.value as LanguageVariantKey)}>
                    {(language === 'ar' ? LANGUAGE_VARIANT_KEYS_AR : LANGUAGE_VARIANT_KEYS_EN).map((k) => (
                      <option key={k} value={k}>{langVariantLabel(k, language)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Emojis</label>
                  <select className={`border rounded px-3 py-2 ${fieldAccent}`} value={emojis} onChange={(e) => setEmojis(e.target.value as EmojisKey)}>
                    {EMOJIS_KEYS.map((k) => (<option key={k} value={k}>{emojisLabel(k, language)}</option>))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'generated' && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === 'ar' ? 'النص المُولد' : 'Generated Text'}</label>
                <textarea className={`w-full border rounded p-3 min-h-[220px] ${fieldAccent}`} readOnly value={generatedText} />
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
                <div className="relative">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border hover:bg-muted"
                    onClick={() => setCopyMenuOpen((v) => !v)}
                    disabled={!generatedText.trim()}
                    aria-haspopup="menu"
                    aria-expanded={copyMenuOpen ? 'true' : 'false'}
                  >
                    {copied ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') : (language === 'ar' ? 'نسخ' : 'Copy')}
                  </button>

                  {copyMenuOpen && (
                    <div
                      className="absolute z-50 mt-2 w-44 rounded-md border bg-background shadow-lg p-1"
                      role="menu"
                      onMouseLeave={() => setCopyMenuOpen(false)}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className={`w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm ${parsedGenerated.hasFillFormat ? '' : 'opacity-50 cursor-not-allowed'}`}
                        onClick={handleCopySubject}
                        disabled={!parsedGenerated.hasFillFormat}
                      >
                        {language === 'ar' ? 'نسخ الموضوع' : 'Copy subject'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={`w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm ${parsedGenerated.hasFillFormat ? '' : 'opacity-50 cursor-not-allowed'}`}
                        onClick={handleCopyMessage}
                        disabled={!parsedGenerated.hasFillFormat}
                      >
                        {language === 'ar' ? 'نسخ الرسالة' : 'Copy message'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
                        onClick={handleCopyAll}
                      >
                        {language === 'ar' ? 'نسخ الكل' : 'Copy all'}
                      </button>
                    </div>
                  )}
                </div>
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

          {/* Always render Diagrams and Presentation tabs to preserve state when switching tabs */}
          <div className={activeTab === 'diagrams' ? '' : 'hidden'}>
            <DiagramsTab />
          </div>

          <div className={activeTab === 'presentation' ? '' : 'hidden'}>
            <PresentationTab />
          </div>

          <div className={activeTab === 'translate' ? '' : 'hidden'}>
            <div className="-mx-6">
              <TextTranslateTab />
            </div>
          </div>

          {error && activeTab !== 'diagrams' && activeTab !== 'presentation' && activeTab !== 'translate' && (
            <div className="mt-4 text-sm text-destructive">{error}</div>
          )}
          {/* Inline generate button at end of content (not sticky) - hide for diagrams and presentation */}
          {activeTab !== 'diagrams' && activeTab !== 'presentation' && activeTab !== 'translate' && (
          <div className="mt-6 flex justify-end">
              <button
                className={`px-5 py-2.5 rounded-full text-sm font-medium shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 hover:shadow-xl transition-all ${canGenerate ? '' : 'opacity-60 cursor-not-allowed'}`}
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {isLoading ? (language === 'ar' ? 'جارٍ الإنشاء...' : 'Generating...') : (language === 'ar' ? 'توليد النص' : 'Generate Text')}
              </button>
            </div>
          )}
        </div>
  );

  if (renderAsPage) {
    return (
      <div className="w-full">
        {body}
      </div>
    );
  }

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
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
            <button
              onClick={() => { setActiveTab('compose'); setMode('compose'); }}
              className={`px-3 py-2 rounded-md border text-sm ${activeTab === 'compose' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >{language === 'ar' ? 'تأليف' : 'Compose'}</button>
            <button
              onClick={() => { setActiveTab('reply'); setMode('reply'); }}
              className={`px-3 py-2 rounded-md border text-sm ${activeTab === 'reply' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
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
              className={`px-3 py-2 rounded-md border text-sm ${
                activeTab === 'generated'
                  ? 'bg-primary text-primary-foreground'
                  : (generatedText || cachedTexts.length > 0)
                    ? 'hover:bg-muted'
                    : 'opacity-60 cursor-not-allowed'
              }`}
            >{language === 'ar' ? 'النص المُولد' : 'Generated Text'}</button>
            <button
              onClick={() => setActiveTab('diagrams')}
              className={`px-3 py-2 rounded-md border text-sm ${activeTab === 'diagrams' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >{language === 'ar' ? 'المخططات' : 'Diagrams'}</button>
            <button
              onClick={() => setActiveTab('presentation')}
              className={`px-3 py-2 rounded-md border text-sm bg-gradient-to-r ${activeTab === 'presentation' ? 'from-indigo-600 to-purple-600 text-white' : 'from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/40 dark:hover:to-purple-900/40 text-indigo-700 dark:text-indigo-300'}`}
            >{language === 'ar' ? 'العروض التقديمية' : 'Presentations'}</button>
            <button
              onClick={() => setActiveTab('translate')}
              className={`px-3 py-2 rounded-md border text-sm ${activeTab === 'translate' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >{language === 'ar' ? 'مترجم النص' : 'Text Translator'}</button>
          </div>
        </div>

        {/* Body */}
        {body}
      </div>
    </div>
  );
};

export default TextGeneratorPopup;
