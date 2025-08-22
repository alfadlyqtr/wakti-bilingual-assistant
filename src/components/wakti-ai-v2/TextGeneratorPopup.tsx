import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Wand2, Reply, FileText, Copy, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface TextGeneratorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply') => void;
}

const TextGeneratorPopup: React.FC<TextGeneratorPopupProps> = ({
  isOpen,
  onClose,
  onTextGenerated
}) => {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  
  const [activeTab, setActiveTab] = useState('compose');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [lastError, setLastError] = useState<string>('');
  
  // Compose tab state
  const [composePrompt, setComposePrompt] = useState('');
  const [contentType, setContentType] = useState('');
  const [tone, setTone] = useState('');
  const [length, setLength] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  
  // Reply tab state
  const [keywords, setKeywords] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [replyTone, setReplyTone] = useState('');
  const [replyLength, setReplyLength] = useState('');

  // New: Register/Dialect controls and Story dialogue density
  const [register, setRegister] = useState<'auto' | 'formal' | 'neutral' | 'casual' | 'slang'>('auto');
  const [englishVariant, setEnglishVariant] = useState<'auto' | 'us' | 'uk' | 'ca' | 'au'>('auto');
  const [arabicVariant, setArabicVariant] = useState<'auto' | 'msa' | 'gcc'>('auto');
  const [dialogueDensity, setDialogueDensity] = useState<'none' | 'light' | 'rich'>('light');
  const [emojiLevel, setEmojiLevel] = useState<'auto' | 'none' | 'light' | 'rich'>('auto');

  // UPDATED: Content types - added text_message and removed social_post
  const contentTypes = {
    email: language === 'ar' ? 'بريد إلكتروني' : 'Email',
    letter: language === 'ar' ? 'خطاب' : 'Letter',
    text_message: language === 'ar' ? 'رسالة نصية' : 'Text Message',
    report: language === 'ar' ? 'تقرير' : 'Report',
    article: language === 'ar' ? 'مقال' : 'Article',
    official_letter: language === 'ar' ? 'كتاب رسمي' : 'Official Letter',
    poem: language === 'ar' ? 'قصيدة' : 'Poem',
    story: language === 'ar' ? 'قصة' : 'Story',
    memo: language === 'ar' ? 'مذكرة' : 'Memo',
    proposal: language === 'ar' ? 'مقترح' : 'Proposal',
    blog_post: language === 'ar' ? 'تدوينة' : 'Blog Post',
    press_release: language === 'ar' ? 'بيان صحفي' : 'Press Release',
    cover_letter: language === 'ar' ? 'خطاب تقديم' : 'Cover Letter',
    summary: language === 'ar' ? 'ملخص' : 'Summary',
    research_brief: language === 'ar' ? 'موجز بحثي' : 'Research Brief',
    research_report: language === 'ar' ? 'تقرير بحثي' : 'Research Report',
    case_study: language === 'ar' ? 'دراسة حالة' : 'Case Study',
    how_to_guide: language === 'ar' ? 'دليل إرشادي' : 'How-To Guide',
    policy_note: language === 'ar' ? 'مذكرة سياسات' : 'Policy Note',
    announcement: language === 'ar' ? 'إعلان' : 'Announcement',
    product_description: language === 'ar' ? 'وصف منتج' : 'Product Description',
    essay: language === 'ar' ? 'مقالة' : 'Essay'
  };

  // RESTORED: All tones including romantic
  const tones = {
    professional: language === 'ar' ? 'مهني' : 'Professional',
    casual: language === 'ar' ? 'عادي' : 'Casual',
    formal: language === 'ar' ? 'رسمي' : 'Formal',
    friendly: language === 'ar' ? 'ودود' : 'Friendly',
    persuasive: language === 'ar' ? 'مقنع' : 'Persuasive',
    romantic: language === 'ar' ? 'رومانسي' : 'Romantic',
    neutral: language === 'ar' ? 'محايد' : 'Neutral',
    empathetic: language === 'ar' ? 'متعاطف' : 'Empathetic',
    confident: language === 'ar' ? 'واثق' : 'Confident',
    humorous: language === 'ar' ? 'طريف' : 'Humorous',
    urgent: language === 'ar' ? 'عاجل' : 'Urgent',
    apologetic: language === 'ar' ? 'اعتذاري' : 'Apologetic',
    inspirational: language === 'ar' ? 'ملهم' : 'Inspirational',
    motivational: language === 'ar' ? 'تحفيزي' : 'Motivational',
    sympathetic: language === 'ar' ? 'متفهم' : 'Sympathetic',
    sincere: language === 'ar' ? 'صادق' : 'Sincere',
    informative: language === 'ar' ? 'معلوماتي' : 'Informative',
    concise: language === 'ar' ? 'موجز' : 'Concise',
    dramatic: language === 'ar' ? 'درامي' : 'Dramatic',
    suspenseful: language === 'ar' ? 'مشوق' : 'Suspenseful',
    authoritative: language === 'ar' ? 'موثوق' : 'Authoritative',
    educational: language === 'ar' ? 'تعليمي' : 'Educational'
  };

  const lengths = {
    short: language === 'ar' ? 'قصير' : 'Short',
    medium: language === 'ar' ? 'متوسط' : 'Medium',
    long: language === 'ar' ? 'طويل' : 'Long'
  };

  // Per-type profiles: allowed tones, default tone, base temperature, and model preference
  const typeProfiles: Record<string, {
    allowedTones: Array<keyof typeof tones>;
    defaultTone: keyof typeof tones;
    baseTemperature: number;
    modelPreference: 'gpt-4o' | 'gpt-4o-mini';
  }> = {
    story: { allowedTones: ['empathetic','inspirational','motivational','dramatic','suspenseful','humorous','romantic','friendly','neutral'], defaultTone: 'empathetic', baseTemperature: 0.75, modelPreference: 'gpt-4o' },
    report: { allowedTones: ['professional','neutral','formal','informative','authoritative'], defaultTone: 'professional', baseTemperature: 0.35, modelPreference: 'gpt-4o' },
    article: { allowedTones: ['informative','professional','neutral','confident','friendly','educational'], defaultTone: 'informative', baseTemperature: 0.45, modelPreference: 'gpt-4o' },
    proposal: { allowedTones: ['professional','persuasive','confident'], defaultTone: 'persuasive', baseTemperature: 0.45, modelPreference: 'gpt-4o' },
    press_release: { allowedTones: ['professional','formal','confident'], defaultTone: 'formal', baseTemperature: 0.4, modelPreference: 'gpt-4o' },
    cover_letter: { allowedTones: ['professional','confident','empathetic','sincere'], defaultTone: 'professional', baseTemperature: 0.4, modelPreference: 'gpt-4o' },
    blog_post: { allowedTones: ['informative','friendly','confident','humorous','empathetic','educational'], defaultTone: 'friendly', baseTemperature: 0.55, modelPreference: 'gpt-4o-mini' },
    email: { allowedTones: ['professional','concise','friendly','apologetic','urgent','persuasive','sincere'], defaultTone: 'professional', baseTemperature: 0.3, modelPreference: 'gpt-4o-mini' },
    letter: { allowedTones: ['formal','professional','empathetic','sincere'], defaultTone: 'formal', baseTemperature: 0.35, modelPreference: 'gpt-4o-mini' },
    official_letter: { allowedTones: ['formal','professional','authoritative'], defaultTone: 'formal', baseTemperature: 0.3, modelPreference: 'gpt-4o' },
    text_message: { allowedTones: ['casual','friendly','urgent','apologetic','humorous','sincere'], defaultTone: 'friendly', baseTemperature: 0.4, modelPreference: 'gpt-4o-mini' },
    memo: { allowedTones: ['professional','neutral','concise','informative'], defaultTone: 'concise', baseTemperature: 0.3, modelPreference: 'gpt-4o-mini' },
    summary: { allowedTones: ['neutral','concise','professional','informative'], defaultTone: 'concise', baseTemperature: 0.25, modelPreference: 'gpt-4o-mini' },
    poem: { allowedTones: ['romantic','empathetic','humorous','neutral','inspirational'], defaultTone: 'romantic', baseTemperature: 0.75, modelPreference: 'gpt-4o' },
    research_brief: { allowedTones: ['professional','neutral','informative','authoritative'], defaultTone: 'informative', baseTemperature: 0.35, modelPreference: 'gpt-4o' },
    research_report: { allowedTones: ['professional','neutral','authoritative'], defaultTone: 'professional', baseTemperature: 0.35, modelPreference: 'gpt-4o' },
    case_study: { allowedTones: ['professional','persuasive','confident'], defaultTone: 'persuasive', baseTemperature: 0.4, modelPreference: 'gpt-4o' },
    how_to_guide: { allowedTones: ['informative','friendly','professional'], defaultTone: 'informative', baseTemperature: 0.4, modelPreference: 'gpt-4o' },
    policy_note: { allowedTones: ['professional','neutral','authoritative'], defaultTone: 'professional', baseTemperature: 0.35, modelPreference: 'gpt-4o' },
    announcement: { allowedTones: ['professional','confident','friendly'], defaultTone: 'confident', baseTemperature: 0.35, modelPreference: 'gpt-4o-mini' },
    product_description: { allowedTones: ['persuasive','friendly','confident'], defaultTone: 'persuasive', baseTemperature: 0.5, modelPreference: 'gpt-4o-mini' },
    essay: { allowedTones: ['informative','neutral','confident','empathetic'], defaultTone: 'informative', baseTemperature: 0.45, modelPreference: 'gpt-4o' },
  };

  const toneRaiseSet = new Set(['humorous','inspirational','motivational','dramatic','suspenseful','romantic','friendly']);
  const toneLowerSet = new Set(['professional','formal','concise','neutral','authoritative']);
  const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

  const deriveTemperature = (base: number, currentToneKey?: string) => {
    if (!currentToneKey) return clamp(base);
    if (toneRaiseSet.has(currentToneKey)) return clamp(base + 0.1);
    if (toneLowerSet.has(currentToneKey)) return clamp(base - 0.1);
    return clamp(base);
  };

  const getAddOns = (ct?: string) => {
    if (!ct) return '';
    const ar = language === 'ar';
    switch (ct) {
      case 'story': {
        const density = dialogueDensity;
        const densityLine = ar
          ? density === 'none' ? 'بدون حوارات.' : density === 'rich' ? 'أدرج حوارات كثيرة عبر المشاهد.' : 'تضمين سطرين إلى ثلاثة أسطر من الحوار.'
          : density === 'none' ? 'No dialogue lines.' : density === 'rich' ? 'Include frequent dialogue lines across scenes.' : 'Include two to three short dialogue lines.';
        return ar
          ? `\nالإضافات: عنوان للقصة، ثلاث لقطات (بداية/نقطة تحول/خاتمة)، تفاصيل حسية موجزة، سطر خلاصة/عبرة في النهاية. ${densityLine}`
          : `\nAdd-ons: Include a title, three short scenes (beginning/turning point/resolution), brief sensory details, and a one-line moral at the end. ${densityLine}`;
      }
      case 'report': return ar ? `\nالتنسيق: عنوان، عناوين أقسام، نقاط تعداد للنتائج، وخلاصة واضحة.` : `\nFormatting: Title, section headings, bullet points for findings, clear conclusion.`;
      case 'article': return ar ? `\nالتنسيق: عنوان جذاب، عناوين فرعية، مقدمة موجزة، وفقـرات قصيرة، وخاتمة واضحة.` : `\nFormatting: Catchy title, subheadings, short intro, short paragraphs, clear takeaway.`;
      case 'press_release': return ar ? `\nالتنسيق: عنوان رئيسي، عنوان فرعي، سطر المكان والتاريخ، فقرة تمهيدية (من/ماذا/متى/أين/لماذا)، اقتباس، نص تعريفي، ومعلومات التواصل.` : `\nFormatting: Headline, subheadline, dateline (CITY, DATE), lead paragraph (5Ws), quote, boilerplate, media contact.`;
      case 'proposal': return ar ? `\nالبنية: ملخص تنفيذي، الأهداف، النطاق، الفوائد، الجدول الزمني، وخطوة تالية واضحة.` : `\nStructure: Executive summary, objectives, scope, benefits, timeline, and a clear next step.`;
      case 'cover_letter': return ar ? `\nالبنية: افتتاح جذاب، مواءمة مع الدور، إنجاز واحد أو اثنان، وخاتمة بليغة.` : `\nStructure: Opening hook, role alignment, one or two quantified wins, polished closing.`;
      case 'blog_post': return ar ? `\nالتنسيق: عنوان متوافق مع محركات البحث، عناوين فرعية، نقاط للتصفح السريع.` : `\nFormatting: SEO-style title, subheadings, skimmable bullets.`;
      case 'research_brief': return ar ? `\nالبنية: الهدف، المنهجية بإيجاز، النتائج الأساسية كنقاط، الانعكاسات، والخطوات التالية.` : `\nStructure: Objective, brief method, key findings as bullets, implications, next steps.`;
      case 'research_report': return ar ? `\nالبنية: ملخص، خلفية، منهجية، نتائج، مناقشة، خاتمة.` : `\nStructure: Abstract, background, method, results, discussion, conclusion.`;
      case 'case_study': return ar ? `\nالبنية: سياق العميل، التحدي، الحل، النتائج مع أرقام، واقتباس.` : `\nStructure: Client context, challenge, solution, results with metrics, and a quote.`;
      case 'how_to_guide': return ar ? `\nالبنية: المتطلبات المسبقة، خطوات مرقمة، نصائح، ومزالق شائعة.` : `\nStructure: Prerequisites, numbered steps, tips, and common pitfalls.`;
      case 'policy_note': return ar ? `\nالبنية: ملخص، المشكلة، الخيارات، التوصية، والتداعيات.` : `\nStructure: Summary, problem, options, recommendation, implications.`;
      case 'announcement': return ar ? `\nالتنسيق: عنوان واضح، الفائدة الأساسية، التفاصيل الأساسية، ودعوة لاتخاذ إجراء.` : `\nFormatting: Clear headline, key benefit, essential details, and a call to action.`;
      case 'product_description': return ar ? `\nالبنية: المزايا والميزات كنقاط، لمن هذا المنتج، وخطوة الشراء.` : `\nStructure: Benefits and features as bullets, who it’s for, and a clear purchase CTA.`;
      case 'essay': return ar ? `\nالبنية: مقدمة بحجة رئيسية، فقرات مدعومة، وخاتمة تلخص الفكرة.` : `\nStructure: Introduction with thesis, supported body paragraphs, and a concluding summary.`;
      default: return '';
    }
  };

  const allowedTonesForType = (ct?: string) => {
    if (!ct || !typeProfiles[ct]) return Object.keys(tones);
    return typeProfiles[ct].allowedTones as string[];
  };

  // Emoji helpers
  const getEffectiveEmojiLevel = (ct?: string): 'none' | 'light' | 'rich' => {
    if (emojiLevel !== 'auto') return emojiLevel;
    const lightSet = new Set(['text_message','blog_post','announcement','product_description','story','poem','case_study','how_to_guide','essay']);
    const noneSet = new Set(['email','official_letter','report','article','proposal','press_release','policy_note','letter','memo','summary','research_brief','research_report']);
    if (!ct) return 'none';
    if (lightSet.has(ct)) return 'light';
    if (noneSet.has(ct)) return 'none';
    return 'light';
  };

  const getEmojiLine = (ct?: string): string => {
    const lvl = getEffectiveEmojiLevel(ct);
    if (language === 'ar') {
      if (lvl === 'none') return 'الإيموجي: بدون.';
      if (lvl === 'light') return 'الإيموجي: أدرج إيموجي واحد أو اثنين عند الملاءمة.';
      if (lvl === 'rich') return 'الإيموجي: استخدم الإيموجي بكثرة عندما يكون مناسباً.';
      return '';
    } else {
      if (lvl === 'none') return 'Emojis: none.';
      if (lvl === 'light') return 'Emojis: include one or two relevant emojis when natural.';
      if (lvl === 'rich') return 'Emojis: use emojis frequently when appropriate.';
      return '';
    }
  };

  // Check if current content type requires address fields
  const showAddressFields = ['email', 'letter', 'official_letter'].includes(contentType);

  const generateText = async () => {
    if (activeTab === 'compose' && !composePrompt.trim()) {
      showError(language === 'ar' ? 'يرجى إدخال الموضوع أو الفكرة' : 'Please enter a topic or idea');
      return;
    }
    
    if (activeTab === 'reply' && !originalMessage.trim()) {
      showError(language === 'ar' ? 'يرجى إدخال الرسالة الأصلية' : 'Please enter the original message');
      return;
    }

    setIsLoading(true);
    setLastError('');
    setGeneratedText(''); // Clear previous text
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30 second timeout
    
    try {
      let prompt = '';
      
      if (activeTab === 'compose') {
        // Build compose prompt
        prompt = language === 'ar' ? 
          `اكتب ${contentType ? contentTypes[contentType] : 'نص'} حول: ${composePrompt}` :
          `Write a ${contentType ? contentTypes[contentType] : 'text'} about: ${composePrompt}`;
        
        if (tone) {
          prompt += language === 'ar' ? 
            `\nالنبرة: ${tones[tone]}` : 
            `\nTone: ${tones[tone]}`;
        }
        
        if (length) {
          prompt += language === 'ar' ? 
            `\nالطول: ${lengths[length]}` : 
            `\nLength: ${lengths[length]}`;
        }

        // Per-type add-ons
        prompt += getAddOns(contentType);

        // Add address information if provided and relevant
        if (showAddressFields) {
          if (toAddress.trim()) {
            prompt += language === 'ar' ? 
              `\nإلى: ${toAddress}` : 
              `\nTo: ${toAddress}`;
          }
          
          if (fromAddress.trim()) {
            prompt += language === 'ar' ? 
              `\nمن: ${fromAddress}` : 
              `\nFrom: ${fromAddress}`;
          }
        }

        // Register and dialect
        if (register !== 'auto') {
          prompt += language === 'ar' ? `\nالسجل: ${register === 'formal' ? 'رسمي' : register === 'neutral' ? 'محايد' : register === 'casual' ? 'غير رسمي' : 'عامية'}` : `\nRegister: ${register}`;
        }
        if (language !== 'ar' && englishVariant !== 'auto') {
          const map: any = { us: 'US English', uk: 'UK English', ca: 'Canadian English', au: 'Australian English' };
          prompt += `\nUse ${map[englishVariant]}.`;
        }
        if (language === 'ar' && arabicVariant !== 'auto') {
          const map: any = { msa: 'العربية الفصحى الحديثة', gcc: 'العربية الخليجية' };
          prompt += `\n${arabicVariant === 'msa' ? 'استخدم' : 'استخدم لهجة'} ${map[arabicVariant]}.`;
        }

        // Emojis preference
        const emojiDirective = getEmojiLine(contentType);
        if (emojiDirective) {
          prompt += `\n${emojiDirective}`;
        }
      } else {
        // Build reply prompt with keywords and original message
        prompt = language === 'ar' ? 
          'اكتب رداً على الرسالة التالية:' : 
          'Write a reply to the following message:';
        
        prompt += `\n\n${language === 'ar' ? 'الرسالة الأصلية:' : 'Original Message:'}\n${originalMessage}`;
        
        if (keywords.trim()) {
          prompt += `\n\n${language === 'ar' ? 'نقاط للتضمين عند الملاءمة:' : 'Key points to include when natural:'}\n${keywords}`;
        }
        
        if (replyTone) {
          prompt += language === 'ar' ? 
            `\nالنبرة: ${tones[replyTone]}` : 
            `\nTone: ${tones[replyTone]}`;
        }
        
        if (replyLength) {
          prompt += language === 'ar' ? 
            `\nالطول: ${lengths[replyLength]}` : 
            `\nLength: ${lengths[replyLength]}`;
        }

        // Register and dialect for replies
        if (register !== 'auto') {
          prompt += language === 'ar' ? `\nالسجل: ${register === 'formal' ? 'رسمي' : register === 'neutral' ? 'محايد' : register === 'casual' ? 'غير رسمي' : 'عامية'}` : `\nRegister: ${register}`;
        }
        if (language !== 'ar' && englishVariant !== 'auto') {
          const map: any = { us: 'US English', uk: 'UK English', ca: 'Canadian English', au: 'Australian English' };
          prompt += `\nUse ${map[englishVariant]}.`;
        }
        if (language === 'ar' && arabicVariant !== 'auto') {
          const map: any = { msa: 'العربية الفصحى الحديثة', gcc: 'العربية الخليجية' };
          prompt += `\n${arabicVariant === 'msa' ? 'استخدم' : 'استخدم لهجة'} ${map[arabicVariant]}.`;
        }

        // Emojis preference
        const emojiDirective = getEmojiLine(contentType);
        if (emojiDirective) {
          prompt += `\n${emojiDirective}`;
        }
      }

      console.log('🎯 Text Generator: Using text-generator function for standalone text generation');
      
      // FIXED: Use text-generator function instead of unified-ai-brain
      const { data, error } = await supabase.functions.invoke('text-generator', {
        body: {
          prompt: prompt,
          mode: activeTab,
          language: language,
          contentType: contentType || null,
          // Routing params
          modelPreference: contentType && typeProfiles[contentType] ? typeProfiles[contentType].modelPreference : (activeTab === 'reply' ? 'gpt-4o-mini' : 'gpt-4o-mini'),
          temperature: (() => {
            const currentToneKey = (activeTab === 'compose' ? tone : replyTone) || undefined;
            const base = contentType && typeProfiles[contentType] ? typeProfiles[contentType].baseTemperature : (activeTab === 'reply' ? 0.35 : 0.5);
            return deriveTemperature(base, currentToneKey);
          })()
        },
        signal: abortController.signal
      });

      if (abortController.signal.aborted) {
        console.log('🚫 Text generation aborted');
        return;
      }

      if (error) {
        console.error('Text generation error:', error);
        const errorMessage = error.message || 'Text generation failed';
        setLastError(errorMessage);
        throw new Error(errorMessage);
      }

      if (!data?.success) {
        const errorMessage = data?.error || 'Text generation failed';
        console.error('Text generation failed:', errorMessage);
        setLastError(errorMessage);
        throw new Error(errorMessage);
      }

      if (!data?.generatedText) {
        const errorMessage = 'No text generated';
        setLastError(errorMessage);
        throw new Error(errorMessage);
      }

      setGeneratedText(data.generatedText);
      setActiveTab('generated'); // Switch to generated text tab
      showSuccess(language === 'ar' ? 'تم إنشاء النص بنجاح!' : 'Text generated successfully!');
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('🚫 Text generation was cancelled');
        setLastError(language === 'ar' ? 'تم إلغاء العملية' : 'Operation cancelled');
        return;
      }
      
      console.error('Text generation error:', error);
      const errorMessage = error.message || (language === 'ar' ? 'فشل في إنشاء النص' : 'Failed to generate text');
      setLastError(errorMessage);
      showError(errorMessage);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setIsCopied(true);
      showSuccess(language === 'ar' ? 'تم نسخ النص!' : 'Text copied!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      showError(language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text');
    }
  };


  const handleRegenerate = () => {
    setGeneratedText('');
    setLastError('');
    setIsCopied(false);
    generateText();
  };

  const handleClose = () => {
    // Reset all states
    setActiveTab('compose');
    setGeneratedText('');
    setComposePrompt('');
    setKeywords('');
    setOriginalMessage('');
    setContentType('');
    setTone('');
    setReplyTone('');
    setLength('');
    setReplyLength('');
    setToAddress('');
    setFromAddress('');
    setIsCopied(false);
    setLastError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="w-5 h-5" />
            {language === 'ar' ? 'منشئ النصوص الذكي' : 'Smart Text Generator'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === 'ar' 
              ? 'أداة لإنشاء النصوص والردود الذكية باستخدام الذكاء الاصطناعي'
              : 'Tool for generating smart texts and replies using artificial intelligence'}
          </DialogDescription>
        </DialogHeader>

        {/* Error Display */}
        {lastError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-red-700">
              <strong>{language === 'ar' ? 'خطأ:' : 'Error:'}</strong>
              <br />
              {lastError}
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="compose" className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4" />
              {language === 'ar' ? 'إنشاء' : 'Compose'}
            </TabsTrigger>
            <TabsTrigger value="reply" className="flex items-center gap-2 text-sm">
              <Reply className="w-4 h-4" />
              {language === 'ar' ? 'رد' : 'Reply'}
            </TabsTrigger>
            <TabsTrigger value="generated" className="flex items-center gap-2 text-sm" disabled={!generatedText}>
              <Wand2 className="w-4 h-4" />
              {language === 'ar' ? 'النص المُولد' : 'Generated Text'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="compose-prompt" className="text-sm font-medium">
                {language === 'ar' ? 'الموضوع أو الفكرة' : 'Topic or Idea'}
              </Label>
              <Textarea
                id="compose-prompt"
                placeholder={language === 'ar' ? 'اكتب الموضوع أو الفكرة التي تريد إنشاء نص حولها...' : 'Enter the topic or idea you want to write about...'}
                value={composePrompt}
                onChange={(e) => setComposePrompt(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'نوع المحتوى' : 'Content Type'}</Label>
                <Select value={contentType} onValueChange={(val) => {
                  setContentType(val);
                  const p = typeProfiles[val];
                  if (p) setTone(p.defaultTone);
                }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'اختر النوع' : 'Select type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(contentTypes).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'النبرة' : 'Tone'}</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'اختر النبرة' : 'Select tone'} />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTonesForType(contentType).map((key) => (
                      <SelectItem key={key} value={key}>{(tones as any)[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'الطول' : 'Length'}</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'اختر الطول' : 'Select length'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(lengths).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Style Controls: Register + Variant + Emojis */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'السجل اللغوي' : 'Register'}</Label>
                <Select value={register} onValueChange={(v) => setRegister(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'تلقائي' : 'Auto'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</SelectItem>
                    <SelectItem value="formal">{language === 'ar' ? 'رسمي' : 'Formal'}</SelectItem>
                    <SelectItem value="neutral">{language === 'ar' ? 'محايد' : 'Neutral'}</SelectItem>
                    <SelectItem value="casual">{language === 'ar' ? 'غير رسمي' : 'Casual'}</SelectItem>
                    <SelectItem value="slang">{language === 'ar' ? 'عامية' : 'Slang'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'النوع اللغوي' : 'Language Variant'}</Label>
                {language !== 'ar' ? (
                  <Select value={englishVariant} onValueChange={(v) => setEnglishVariant(v as any)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={language === 'ar' ? 'تلقائي' : 'Auto'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="us">US English</SelectItem>
                      <SelectItem value="uk">UK English</SelectItem>
                      <SelectItem value="ca">Canadian English</SelectItem>
                      <SelectItem value="au">Australian English</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={arabicVariant} onValueChange={(v) => setArabicVariant(v as any)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="تلقائي" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">تلقائي</SelectItem>
                      <SelectItem value="msa">العربية الفصحى الحديثة (MSA)</SelectItem>
                      <SelectItem value="gcc">العربية الخليجية</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Emojis inline (Compose) */}
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'الإيموجي' : 'Emojis'}</Label>
                <Select value={emojiLevel} onValueChange={(v) => setEmojiLevel(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'تلقائي' : 'Auto'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</SelectItem>
                    <SelectItem value="none">{language === 'ar' ? 'بدون' : 'None'}</SelectItem>
                    <SelectItem value="light">{language === 'ar' ? 'خفيف' : 'Light'}</SelectItem>
                    <SelectItem value="rich">{language === 'ar' ? 'غني' : 'Rich'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Story-only control: Dialogue Density */}
            {contentType === 'story' && (
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'كثافة الحوارات' : 'Dialogue Density'}</Label>
                <Select value={dialogueDensity} onValueChange={(v) => setDialogueDensity(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'اختر' : 'Select'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{language === 'ar' ? 'بدون' : 'None'}</SelectItem>
                    <SelectItem value="light">{language === 'ar' ? 'خفيف' : 'Light'}</SelectItem>
                    <SelectItem value="rich">{language === 'ar' ? 'غني' : 'Rich'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Address Fields - Only show for relevant content types */}
            {showAddressFields && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {language === 'ar' ? 'معلومات العنوان' : 'Address Information'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="to-address" className="text-sm font-medium">
                      {language === 'ar' ? 'إلى من' : 'To whom'}
                    </Label>
                    <Input
                      id="to-address"
                      placeholder={language === 'ar' ? 'اسم المستلم أو عنوانه' : 'Recipient name or address'}
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="from-address" className="text-sm font-medium">
                      {language === 'ar' ? 'من' : 'From'}
                    </Label>
                    <Input
                      id="from-address"
                      placeholder={language === 'ar' ? 'اسم المرسل أو عنوانه' : 'Sender name or address'}
                      value={fromAddress}
                      onChange={(e) => setFromAddress(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reply" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="keywords" className="text-sm font-medium">
                  {language === 'ar' ? 'النقاط المهمة أو الكلمات المفتاحية' : 'Key Points or Keywords'}
                </Label>
                <Textarea
                  id="keywords"
                  placeholder={language === 'ar' ? 'اكتب النقاط المهمة أو الكلمات المفتاحية التي تريد تضمينها في الرد...' : 'Enter key points or keywords you want to include in the reply...'}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  rows={2}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'و' : 'and'}
                </span>
                <Separator className="flex-1" />
              </div>

              <div>
                <Label htmlFor="original-message" className="text-sm font-medium">
                  {language === 'ar' ? 'الرسالة الأصلية' : 'Original Message'}
                </Label>
                <Textarea
                  id="original-message"
                  placeholder={language === 'ar' ? 'الصق الرسالة الأصلية التي تريد الرد عليها...' : 'Paste the original message you want to reply to...'}
                  value={originalMessage}
                  onChange={(e) => setOriginalMessage(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'النبرة' : 'Tone'}</Label>
                <Select value={replyTone} onValueChange={setReplyTone}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'اختر النبرة' : 'Select tone'} />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTonesForType(contentType).map((key) => (
                      <SelectItem key={key} value={key}>{(tones as any)[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'الطول' : 'Length'}</Label>
                <Select value={replyLength} onValueChange={setReplyLength}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'اختر الطول' : 'Select length'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(lengths).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Emojis inline (Reply) */}
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'الإيموجي' : 'Emojis'}</Label>
                <Select value={emojiLevel} onValueChange={(v) => setEmojiLevel(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'تلقائي' : 'Auto'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</SelectItem>
                    <SelectItem value="none">{language === 'ar' ? 'بدون' : 'None'}</SelectItem>
                    <SelectItem value="light">{language === 'ar' ? 'خفيف' : 'Light'}</SelectItem>
                    <SelectItem value="rich">{language === 'ar' ? 'غني' : 'Rich'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Style Controls: Register + Variant + Emojis (Reply) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'السجل اللغوي' : 'Register'}</Label>
                <Select value={register} onValueChange={(v) => setRegister(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'تلقائي' : 'Auto'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</SelectItem>
                    <SelectItem value="formal">{language === 'ar' ? 'رسمي' : 'Formal'}</SelectItem>
                    <SelectItem value="neutral">{language === 'ar' ? 'محايد' : 'Neutral'}</SelectItem>
                    <SelectItem value="casual">{language === 'ar' ? 'غير رسمي' : 'Casual'}</SelectItem>
                    <SelectItem value="slang">{language === 'ar' ? 'عامية' : 'Slang'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'النوع اللغوي' : 'Language Variant'}</Label>
                {language !== 'ar' ? (
                  <Select value={englishVariant} onValueChange={(v) => setEnglishVariant(v as any)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={language === 'ar' ? 'تلقائي' : 'Auto'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="us">US English</SelectItem>
                      <SelectItem value="uk">UK English</SelectItem>
                      <SelectItem value="ca">Canadian English</SelectItem>
                      <SelectItem value="au">Australian English</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={arabicVariant} onValueChange={(v) => setArabicVariant(v as any)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="تلقائي" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">تلقائي</SelectItem>
                      <SelectItem value="msa">العربية الفصحى الحديثة (MSA)</SelectItem>
                      <SelectItem value="gcc">العربية الخليجية</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Emojis inline (Reply) */}
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'الإيموجي' : 'Emojis'}</Label>
                <Select value={emojiLevel} onValueChange={(v) => setEmojiLevel(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'تلقائي' : 'Auto'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</SelectItem>
                    <SelectItem value="none">{language === 'ar' ? 'بدون' : 'None'}</SelectItem>
                    <SelectItem value="light">{language === 'ar' ? 'خفيف' : 'Light'}</SelectItem>
                    <SelectItem value="rich">{language === 'ar' ? 'غني' : 'Rich'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Story-only control shown for Reply too (based on chosen content type if any) */}
            {contentType === 'story' && (
              <div>
                <Label className="text-sm font-medium">{language === 'ar' ? 'كثافة الحوارات' : 'Dialogue Density'}</Label>
                <Select value={dialogueDensity} onValueChange={(v) => setDialogueDensity(v as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={language === 'ar' ? 'اختر' : 'Select'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{language === 'ar' ? 'بدون' : 'None'}</SelectItem>
                    <SelectItem value="light">{language === 'ar' ? 'خفيف' : 'Light'}</SelectItem>
                    <SelectItem value="rich">{language === 'ar' ? 'غني' : 'Rich'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          <TabsContent value="generated" className="space-y-4 mt-4">
            {generatedText ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm">
                      {language === 'ar' ? 'النص المُولد' : 'Generated Text'}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyText}
                        className="flex items-center gap-2"
                      >
                        {isCopied ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {language === 'ar' ? 'نسخ' : 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isLoading}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {language === 'ar' ? 'إعادة إنشاء' : 'Regenerate'}
                      </Button>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                    {generatedText}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Wand2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{language === 'ar' ? 'لا يوجد نص مُولد بعد' : 'No generated text yet'}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {activeTab !== 'generated' && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={generateText} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  {language === 'ar' ? 'إنشاء النص' : 'Generate Text'}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TextGeneratorPopup;
