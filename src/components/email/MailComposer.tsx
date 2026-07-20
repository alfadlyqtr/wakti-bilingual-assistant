import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Paperclip, Loader2, Send, Sparkles, ArrowUpRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { SavedMediaAttachmentPicker, SavedMediaSelection } from '@/components/email/SavedMediaAttachmentPicker';
import { buildComposedEmailBodies, buildSignatureHtml, EMAIL_SIGNATURE_UPDATED_EVENT, readEmailSignatureSettings, type EmailSignatureSettings } from '@/utils/emailSignature';
import { saveSmartTextPrefill } from '@/utils/smartTextPrefill';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';

export interface MailComposerAttachment {
  name: string;
  contentType?: string;
  content: string;
}

export interface MailComposerReplyTo {
  to: string;
  subject: string;
  threadId?: string;
}

export interface MailComposerSubmitInput {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments: MailComposerAttachment[];
  threadId?: string;
  sendId?: string;
}

export interface MailComposerPreset {
  to?: string[];
  cc?: string[];
  subject?: string;
  body?: string;
  attachments?: MailComposerAttachment[];
}

interface MailComposerProps {
  onClose: () => void;
  onSend: (input: MailComposerSubmitInput) => Promise<boolean>;
  replyTo?: MailComposerReplyTo;
  fromLabel?: string | null;
  initialBody?: string;
  preset?: MailComposerPreset | null;
}

const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/webp', 'image/png']);
const MAX_ATTACHMENT_DIMENSION = 1920;
const IMAGE_COMPRESSION_QUALITY = 0.82;
const MIN_IMAGE_SIZE_FOR_COMPRESSION = 350 * 1024;

function splitRecipientList(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let angleDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previousChar = index > 0 ? value[index - 1] : '';

    if (char === '"' && previousChar !== '\\') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === '<') {
      angleDepth += 1;
    } else if (!inQuotes && char === '>') {
      angleDepth = Math.max(0, angleDepth - 1);
    }

    if (!inQuotes && angleDepth === 0 && (char === ',' || char === ';')) {
      const token = current.trim();
      if (token) tokens.push(token);
      current = '';
      continue;
    }

    current += char;
  }

  const lastToken = current.trim();
  if (lastToken) tokens.push(lastToken);
  return tokens;
}

function splitRecipients(value: string): string[] {
  return splitRecipientList(value);
}

async function fileToAttachment(file: Blob, name: string, contentType?: string): Promise<MailComposerAttachment> {
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const content = result.includes(',') ? result.split(',')[1] || '' : result;
      resolve({
        name,
        contentType: contentType || 'application/octet-stream',
        content,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read attachment'));
    reader.readAsDataURL(file);
  });
}

async function loadImageSource(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      };
    } catch {
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = objectUrl;
    });
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressImageFile(file: File): Promise<Blob | null> {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type) || file.size < MIN_IMAGE_SIZE_FOR_COMPRESSION) {
    return null;
  }

  try {
    const source = await loadImageSource(file);
    const scale = Math.min(1, MAX_ATTACHMENT_DIMENSION / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    source.draw(context, width, height);
    const outputType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, outputType === 'image/png' ? undefined : IMAGE_COMPRESSION_QUALITY);
    });
    if (!blob || blob.size >= file.size) return null;
    return blob;
  } catch {
    return null;
  }
}

function readFileAsBase64(file: File): Promise<MailComposerAttachment> {
  return new Promise(async (resolve, reject) => {
    try {
      const compressed = await compressImageFile(file);
      const attachment = await fileToAttachment(compressed || file, file.name, compressed?.type || file.type || 'application/octet-stream');
      resolve(attachment);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Failed to read attachment'));
    }
  });
}

function sanitizeAttachmentName(name: string) {
  return (name || 'attachment')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'attachment';
}

function extensionFromMimeType(contentType?: string | null) {
  if (!contentType) return '';
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  switch (normalized) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    default:
      return normalized.includes('/') ? normalized.split('/')[1] || '' : '';
  }
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop() || '';
    const ext = lastSegment.includes('.') ? lastSegment.split('.').pop() || '' : '';
    return ext.toLowerCase();
  } catch {
    return '';
  }
}

function ensureAttachmentName(name: string, contentType?: string | null, url?: string) {
  const safeName = sanitizeAttachmentName(name);
  if (/\.[a-z0-9]{2,5}$/i.test(safeName)) return safeName;
  const ext = extensionFromMimeType(contentType) || (url ? extensionFromUrl(url) : '');
  return ext ? `${safeName}.${ext}` : safeName;
}

function savedMediaBaseName(item: SavedMediaSelection) {
  const fallback = item.kind === 'image' ? 'wakti-image' : item.kind === 'video' ? 'wakti-video' : 'wakti-audio';
  return ensureAttachmentName(item.title || fallback, item.contentType, item.url);
}

async function savedMediaToAttachment(item: SavedMediaSelection): Promise<MailComposerAttachment> {
  const response = await fetch(item.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch saved media (${response.status})`);
  }

  const blob = await response.blob();
  const contentType = blob.type || item.contentType || 'application/octet-stream';
  const attachmentName = ensureAttachmentName(savedMediaBaseName(item), contentType, item.url);
  return fileToAttachment(blob, attachmentName, contentType);
}

type ComposeAiTone = 'auto' | 'apologetic' | 'authoritative' | 'casual' | 'concise' | 'confident' | 'dramatic' | 'educational' | 'empathetic' | 'formal' | 'friendly' | 'humorous' | 'human' | 'informative' | 'inspirational' | 'motivational' | 'neutral' | 'persuasive' | 'professional' | 'romantic' | 'sales' | 'sincere' | 'sympathetic' | 'suspenseful' | 'urgent';
type ComposeAiStyle = 'auto' | 'business_formal' | 'casual' | 'executive_brief' | 'formal' | 'gen_z' | 'neutral' | 'poetic' | 'slang';
type ComposeAiLength = 'auto' | 'very_short' | 'short' | 'medium' | 'long' | 'very_long';
type ComposeAiLanguage = 'en' | 'ar';
type ComposeAiLanguageVariant = 'auto' | 'australian_english' | 'canadian_english' | 'uk_english' | 'us_english' | 'gulf_arabic' | 'msa';

const COMPOSE_AI_TONES: ComposeAiTone[] = [
  'auto',
  'apologetic',
  'authoritative',
  'casual',
  'concise',
  'confident',
  'dramatic',
  'educational',
  'empathetic',
  'formal',
  'friendly',
  'humorous',
  'human',
  'informative',
  'inspirational',
  'motivational',
  'neutral',
  'persuasive',
  'professional',
  'romantic',
  'sales',
  'sincere',
  'sympathetic',
  'suspenseful',
  'urgent',
];

const COMPOSE_AI_STYLES: ComposeAiStyle[] = ['auto', 'business_formal', 'casual', 'executive_brief', 'formal', 'gen_z', 'neutral', 'poetic', 'slang'];
const COMPOSE_AI_LENGTHS: ComposeAiLength[] = ['auto', 'very_short', 'short', 'medium', 'long', 'very_long'];
const COMPOSE_AI_LENGTH_WORD_COUNTS: Record<Exclude<ComposeAiLength, 'auto'>, number> = {
  very_short: 30,
  short: 60,
  medium: 110,
  long: 180,
  very_long: 260,
};
const COMPOSE_AI_EN_LANGUAGE_VARIANTS: ComposeAiLanguageVariant[] = ['auto', 'australian_english', 'canadian_english', 'uk_english', 'us_english'];
const COMPOSE_AI_AR_LANGUAGE_VARIANTS: ComposeAiLanguageVariant[] = ['auto', 'gulf_arabic', 'msa'];

function composeLanguageFromVariant(value: ComposeAiLanguageVariant, fallback: ComposeAiLanguage): ComposeAiLanguage {
  if (value === 'gulf_arabic' || value === 'msa') return 'ar';
  if (value === 'auto') return fallback;
  return 'en';
}

function composeToneLabel(value: ComposeAiTone, lang: 'en' | 'ar') {
  const en: Record<ComposeAiTone, string> = {
    auto: 'Auto',
    apologetic: 'Apologetic',
    authoritative: 'Authoritative',
    casual: 'Casual',
    concise: 'Concise',
    confident: 'Confident',
    dramatic: 'Dramatic',
    educational: 'Educational',
    empathetic: 'Empathetic',
    formal: 'Formal',
    friendly: 'Friendly',
    humorous: 'Humorous',
    human: 'Human (never sounds like AI)',
    informative: 'Informative',
    inspirational: 'Inspirational',
    motivational: 'Motivational',
    neutral: 'Neutral',
    persuasive: 'Persuasive',
    professional: 'Professional',
    romantic: 'Romantic',
    sales: 'Sales',
    sincere: 'Sincere',
    sympathetic: 'Sympathetic',
    suspenseful: 'Suspenseful',
    urgent: 'Urgent',
  };
  const ar: Record<ComposeAiTone, string> = {
    auto: 'تلقائي',
    apologetic: 'اعتذاري',
    authoritative: 'موثوق',
    casual: 'غير رسمي',
    concise: 'موجز',
    confident: 'واثق',
    dramatic: 'درامي',
    educational: 'تثقيفي',
    empathetic: 'متعاطف',
    formal: 'رسمي',
    friendly: 'ودود',
    humorous: 'مرح',
    human: 'بشري',
    informative: 'معلوماتي',
    inspirational: 'ملهم',
    motivational: 'تحفيزي',
    neutral: 'محايد',
    persuasive: 'إقناعي',
    professional: 'مهني',
    romantic: 'رومانسي',
    sales: 'مبيعات',
    sincere: 'صادق',
    sympathetic: 'متعاطف',
    suspenseful: 'مشوّق',
    urgent: 'عاجل',
  };
  return lang === 'ar' ? ar[value] : en[value];
}

function composeStyleLabel(value: ComposeAiStyle, lang: 'en' | 'ar') {
  const en: Record<ComposeAiStyle, string> = {
    auto: 'Auto',
    business_formal: 'Business Formal',
    casual: 'Casual',
    executive_brief: 'Executive Brief',
    formal: 'Formal',
    gen_z: 'Gen Z',
    neutral: 'Neutral',
    poetic: 'Poetic / Lyrical',
    slang: 'Slang',
  };
  const ar: Record<ComposeAiStyle, string> = {
    auto: 'تلقائي',
    business_formal: 'رسمي للأعمال',
    casual: 'غير رسمي',
    executive_brief: 'موجز تنفيذي',
    formal: 'رسمي',
    gen_z: 'أسلوب جيل زد',
    neutral: 'محايد',
    poetic: 'شِعري / أدبي',
    slang: 'عامي',
  };
  return lang === 'ar' ? ar[value] : en[value];
}

function composeLengthLabel(value: ComposeAiLength, lang: 'en' | 'ar') {
  const en: Record<ComposeAiLength, string> = {
    auto: 'Auto',
    very_short: 'Very short',
    short: 'Short',
    medium: 'Medium',
    long: 'Long',
    very_long: 'Very long',
  };
  const ar: Record<ComposeAiLength, string> = {
    auto: 'تلقائي',
    very_short: 'قصير جدًا',
    short: 'قصير',
    medium: 'متوسط',
    long: 'طويل',
    very_long: 'طويل جدًا',
  };
  return lang === 'ar' ? ar[value] : en[value];
}

function composeLanguageVariantLabel(value: ComposeAiLanguageVariant, lang: 'en' | 'ar') {
  const en: Record<ComposeAiLanguageVariant, string> = {
    auto: 'Auto',
    australian_english: 'Australian English',
    canadian_english: 'Canadian English',
    uk_english: 'UK English',
    us_english: 'US English',
    gulf_arabic: 'Gulf Arabic',
    msa: 'Modern Standard Arabic (MSA)',
  };
  const ar: Record<ComposeAiLanguageVariant, string> = {
    auto: 'تلقائي',
    australian_english: 'الإنجليزية الأسترالية',
    canadian_english: 'الإنجليزية الكندية',
    uk_english: 'الإنجليزية البريطانية',
    us_english: 'الإنجليزية الأمريكية',
    gulf_arabic: 'العربية الخليجية',
    msa: 'العربية الفصحى MSA',
  };
  return lang === 'ar' ? ar[value] : en[value];
}

function buildComposeAiSettingsBlock(params: {
  language: ComposeAiLanguage;
  tone: ComposeAiTone;
  register: ComposeAiStyle;
  length: ComposeAiLength;
  languageVariant: ComposeAiLanguageVariant;
}) {
  const { language, tone, register, length, languageVariant } = params;
  const lines = language === 'ar'
    ? [
      'إعدادات الكتابة التالية إلزامية ويجب تطبيقها بالكامل.',
      'النبرة تحدد الإحساس العام وطريقة مخاطبة الطرف الآخر.',
      'الأسلوب يحدد صياغة الجمل ومستوى الرسمية أو العفوية.',
      'الطول يحدد الحجم التقريبي للنص النهائي.',
      'نوع اللغة يحدد التهجئة والصياغة المحلية.',
      'إذا كانت صياغة المستخدم الأصلية لا تطابق الإعدادات المختارة، فأعد كتابة الرسالة لتطابق الإعدادات المختارة ولا تنسخ الأسلوب الأصلي كما هو.',
      'إذا بدا أن النبرة والأسلوب بينهما شد وجذب، فامزجهما معاً ولا تتجاهل أي واحد منهما.',
    ]
    : [
      'The writing settings below are mandatory and must be applied fully.',
      'Tone controls the overall feel and interpersonal attitude.',
      'Register controls wording style and the level of formality or casualness.',
      'Length controls the approximate size of the final email.',
      'Language variant controls spelling, phrasing, and local wording.',
      'If the user\'s original wording does not match the selected settings, rewrite the email to match the selected settings instead of copying the original style as-is.',
      'If tone and register pull in different directions, blend them intentionally and do not ignore either one.',
    ];

  if (tone !== 'auto') {
    lines.push(language === 'ar' ? `النبرة المطلوبة: ${composeToneLabel(tone, language)}` : `Required tone: ${composeToneLabel(tone, language)}`);
  }

  if (register !== 'auto') {
    lines.push(language === 'ar' ? `الأسلوب المطلوب: ${composeStyleLabel(register, language)}` : `Required register: ${composeStyleLabel(register, language)}`);
  }

  if (length !== 'auto') {
    lines.push(language === 'ar' ? `الطول المطلوب: ${composeLengthLabel(length, language)}` : `Required length: ${composeLengthLabel(length, language)}`);
  }

  if (languageVariant !== 'auto') {
    lines.push(language === 'ar' ? `نوع اللغة المطلوب: ${composeLanguageVariantLabel(languageVariant, language)}` : `Required language variant: ${composeLanguageVariantLabel(languageVariant, language)}`);
  }

  return lines.join('\n');
}

async function callComposeAiTextGenerator(body: Record<string, unknown>, onChunk?: (text: string) => void) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/text-generator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const responseContentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (responseContentType.includes('application/json')) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload?.error || 'Failed to generate email draft');
    }
    throw new Error((await response.text()) || 'Failed to generate email draft');
  }

  if (responseContentType.includes('application/json')) {
    const jsonPayload = await response.json().catch(() => ({}));
    const cleanJsonText = typeof jsonPayload?.generatedText === 'string' ? jsonPayload.generatedText.trim() : '';
    if (!jsonPayload?.success || !cleanJsonText) {
      throw new Error(jsonPayload?.error || 'Failed to generate email draft');
    }
    return cleanJsonText;
  }

  if (!response.body) {
    throw new Error('Streaming response not available');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let finalGeneratedText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const events = sseBuffer.split('\n\n');
    sseBuffer = events.pop() || '';

    for (const eventChunk of events) {
      const dataLines = eventChunk
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);

      for (const dataLine of dataLines) {
        const event = JSON.parse(dataLine);
        if (event?.type === 'chunk' && typeof event.text === 'string') {
          finalGeneratedText += event.text;
          onChunk?.(event.text);
        }
        if (event?.type === 'complete' && typeof event.generatedText === 'string') {
          finalGeneratedText = event.generatedText;
        }
        if (event?.type === 'error') {
          throw new Error(event?.error || 'Streaming failed');
        }
      }
    }
  }

  const clean = finalGeneratedText.trim();
  if (!clean) {
    throw new Error('Failed to generate email draft');
  }
  return clean;
}

function cleanComposeAiDraft(text: string, params: { signatureEnabled: boolean }) {
  let next = text.trim();

  next = next.replace(/\n+\s*(?:\[\s*(?:your name|name|اسمك|الاسم)\s*\]|your name|name|اسمك|الاسم)\s*$/i, '');

  if (params.signatureEnabled) {
    const trailingSignoffPatterns = [
      /\n+\s*(?:best regards|kind regards|warm regards|regards|sincerely|many thanks|thanks|thank you)\s*,?\s*(?:\n+\s*(?:\[\s*(?:your name|name)\s*\]|your name|name))?\s*$/i,
      /\n+\s*(?:مع التحية|مع خالص التحية|وتفضلوا بقبول فائق الاحترام|أطيب التحيات|تحياتي)\s*[،,]?\s*(?:\n+\s*(?:\[\s*(?:اسمك|الاسم)\s*\]|اسمك|الاسم))?\s*$/i,
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const pattern of trailingSignoffPatterns) {
        const updated = next.replace(pattern, '');
        if (updated !== next) {
          next = updated.trimEnd();
          changed = true;
        }
      }
    }
  }

  return next.trim();
}

function buildComposeAiPrompt(params: {
  prompt: string;
  subject: string;
  currentBody: string;
  replyMode: boolean;
  language: ComposeAiLanguage;
  tone: ComposeAiTone;
  register: ComposeAiStyle;
  length: ComposeAiLength;
  languageVariant: ComposeAiLanguageVariant;
  signatureEnabled: boolean;
}) {
  const prompt = params.prompt.trim();
  const subject = params.subject.trim();
  const currentBody = params.currentBody.trim();
  const settingsBlock = buildComposeAiSettingsBlock({
    language: params.language,
    tone: params.tone,
    register: params.register,
    length: params.length,
    languageVariant: params.languageVariant,
  });

  if (params.language === 'ar') {
    return [
      'اكتب فقط نص البريد النهائي الجاهز للإرسال.',
      'لا تضف عناوين أو شروح أو نقاط خارج نص البريد نفسه.',
      settingsBlock,
      params.replyMode ? 'هذه الرسالة ستكون رداً داخل البريد.' : 'هذه الرسالة ستكون بريداً جديداً.',
      subject ? `الموضوع: ${subject}` : '',
      `ما أريد قوله: ${prompt}`,
      currentBody ? `المسودة الحالية لتحسينها أو البناء عليها:\n${currentBody}` : '',
      params.signatureEnabled ? 'توقيع البريد مفعّل في التطبيق، لذلك لا تضف أي سطر ختامي مثل مع التحية أو أطيب التحيات، ولا تضف الاسم في النهاية.' : '',
      'ممنوع استخدام أي placeholder مثل [Your Name] أو [الاسم] أو [اسمك].',
      'استخدم تنسيق بريد طبيعي عادي بمحاذاة نص عادية، وليس نصاً وسطياً أو شكلاً يبدو كعنوان أو بطاقة.',
      'أعد صياغة المحتوى ليلتزم بالكامل بالنبرة والأسلوب والطول ونوع اللغة المختار.',
      'اجعل النتيجة طبيعية، بشرية، واضحة، ومناسبة للإرسال مباشرة.',
    ].filter(Boolean).join('\n\n');
  }

  return [
    'Write only the final email body ready to send.',
    'Do not add headings, notes, or explanation outside the email itself.',
    settingsBlock,
    params.replyMode ? 'This email will be used as a reply.' : 'This email will be used as a new message.',
    subject ? `Subject: ${subject}` : '',
    `What I want to say: ${prompt}`,
    currentBody ? `Current draft to improve or build on:\n${currentBody}` : '',
    params.signatureEnabled ? 'The email signature is already enabled in the app, so do not add any closing sign-off like Best regards, Kind regards, Sincerely, Thanks, or the sender name at the end.' : '',
    'Never use placeholders like [Your Name], [Name], [الاسم], or [اسمك].',
    'Use normal email paragraph formatting with standard text alignment, not centered text or title-style layout.',
    'Rewrite the content so it fully matches the selected tone, register, length, and language variant.',
    'Make the result natural, human, clear, and ready to send.',
  ].filter(Boolean).join('\n\n');
}

export function MailComposer({ onClose, onSend, replyTo, fromLabel, initialBody = '', preset = null }: MailComposerProps) {
  const navigate = useNavigate();
  const { language } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [signatureSettings, setSignatureSettings] = useState<EmailSignatureSettings>(() => readEmailSignatureSettings());
  const [to, setTo] = useState((preset?.to || []).join(', ') || replyTo?.to || '');
  const [cc, setCc] = useState((preset?.cc || []).join(', '));
  const [subject, setSubject] = useState(preset?.subject || (replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : ''));
  const [body, setBody] = useState(preset?.body ?? initialBody);
  const [sending, setSending] = useState(false);
  const [sendId] = useState(() => crypto.randomUUID());
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachments, setAttachments] = useState<MailComposerAttachment[]>(preset?.attachments || []);
  const [attachSourceOpen, setAttachSourceOpen] = useState(false);
  const [savedPickerOpen, setSavedPickerOpen] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(() => readEmailSignatureSettings().enabled);
  const [showComposeAi, setShowComposeAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState<ComposeAiTone>('auto');
  const [aiStyle, setAiStyle] = useState<ComposeAiStyle>('auto');
  const [aiLength, setAiLength] = useState<ComposeAiLength>('auto');
  const [aiLanguageVariant, setAiLanguageVariant] = useState<ComposeAiLanguageVariant>('auto');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState('');

  const uiLang: 'en' | 'ar' = language === 'ar' ? 'ar' : 'en';
  const defaultComposeAiLanguage: ComposeAiLanguage = uiLang === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    setTo((preset?.to || []).join(', ') || replyTo?.to || '');
    setCc((preset?.cc || []).join(', '));
    setSubject(preset?.subject || (replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : ''));
    setBody(preset?.body ?? initialBody);
    setAttachments(preset?.attachments || []);
  }, [initialBody, preset, replyTo]);

  useEffect(() => {
    const refreshSignatureSettings = () => {
      setSignatureSettings(readEmailSignatureSettings());
    };

    refreshSignatureSettings();
    window.addEventListener('storage', refreshSignatureSettings);
    window.addEventListener(EMAIL_SIGNATURE_UPDATED_EVENT, refreshSignatureSettings as EventListener);
    return () => {
      window.removeEventListener('storage', refreshSignatureSettings);
      window.removeEventListener(EMAIL_SIGNATURE_UPDATED_EVENT, refreshSignatureSettings as EventListener);
    };
  }, []);

  const openAttachmentPicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
      }
    }

    input.click();
  }, []);

  const handleOpenAttachSource = useCallback(() => {
    setAttachSourceOpen(true);
  }, []);

  const handleAttachFromDevice = useCallback(() => {
    setAttachSourceOpen(false);
    openAttachmentPicker();
  }, [openAttachmentPicker]);

  const handleAttachFromSaved = useCallback(() => {
    setAttachSourceOpen(false);
    setSavedPickerOpen(true);
  }, []);

  const canSend = useMemo(() => {
    return splitRecipients(to).length > 0 && subject.trim().length > 0 && body.trim().length > 0 && !loadingAttachments;
  }, [body, loadingAttachments, subject, to]);

  const signaturePreviewHtml = useMemo(() => {
    if (!signatureSettings.enabled || !includeSignature) return '';
    return buildSignatureHtml(signatureSettings);
  }, [includeSignature, signatureSettings]);

  const canGenerateComposeAi = useMemo(() => aiPrompt.trim().length > 0 && !aiGenerating, [aiGenerating, aiPrompt]);

  const composeAiSignatureEnabled = useMemo(
    () => signatureSettings.enabled && includeSignature,
    [includeSignature, signatureSettings.enabled],
  );

  const composeAiPrompt = useMemo(() => buildComposeAiPrompt({
    prompt: aiPrompt,
    subject,
    currentBody: body,
    replyMode: Boolean(replyTo),
    language: composeLanguageFromVariant(aiLanguageVariant, defaultComposeAiLanguage),
    tone: aiTone,
    register: aiStyle,
    length: aiLength,
    languageVariant: aiLanguageVariant,
    signatureEnabled: composeAiSignatureEnabled,
  }), [aiLanguageVariant, aiLength, aiPrompt, aiStyle, aiTone, body, composeAiSignatureEnabled, defaultComposeAiLanguage, replyTo, subject]);

  const composeAiLanguage = useMemo(
    () => composeLanguageFromVariant(aiLanguageVariant, defaultComposeAiLanguage),
    [aiLanguageVariant, defaultComposeAiLanguage],
  );

  const composeAiWordCount = useMemo(
    () => (aiLength === 'auto' ? undefined : COMPOSE_AI_LENGTH_WORD_COUNTS[aiLength]),
    [aiLength],
  );

  const availableLanguageVariants = useMemo(
    () => (defaultComposeAiLanguage === 'ar' ? COMPOSE_AI_AR_LANGUAGE_VARIANTS : COMPOSE_AI_EN_LANGUAGE_VARIANTS),
    [defaultComposeAiLanguage],
  );

  const normalizedAiResult = useMemo(
    () => cleanComposeAiDraft(aiResult, { signatureEnabled: composeAiSignatureEnabled }),
    [aiResult, composeAiSignatureEnabled],
  );

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setLoadingAttachments(true);
    try {
      const nextAttachments = await Promise.all(files.map(readFileAsBase64));
      setAttachments(prev => [...prev, ...nextAttachments]);
    } finally {
      setLoadingAttachments(false);
      event.target.value = '';
    }
  };

  const handleSavedMediaSelect = useCallback(async (item: SavedMediaSelection) => {
    setLoadingAttachments(true);
    try {
      const attachment = await savedMediaToAttachment(item);
      setAttachments(prev => [...prev, attachment]);
      toast.success('Saved media attached');
    } catch (error) {
      console.error('Failed to attach saved media:', error);
      toast.error('Failed to attach saved media');
      throw error;
    } finally {
      setLoadingAttachments(false);
    }
  }, []);

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleGenerateComposeAi = useCallback(async () => {
    if (!canGenerateComposeAi) return;
    setAiGenerating(true);
    setAiError('');
    setAiResult('');

    try {
      const generated = await callComposeAiTextGenerator({
        prompt: composeAiPrompt,
        mode: 'compose',
        language: composeAiLanguage,
        contentType: 'email',
        tone: aiTone === 'auto' ? undefined : aiTone,
        register: aiStyle === 'auto' ? undefined : aiStyle,
        length: aiLength === 'auto' ? undefined : aiLength,
        languageVariant: aiLanguageVariant === 'auto' ? undefined : aiLanguageVariant,
        wordCount: composeAiWordCount,
        temperature: 0.6,
      }, (chunk) => {
        setAiResult((prev) => prev + chunk);
      });
      setAiResult(generated);
      toast.success(uiLang === 'ar' ? 'تم إنشاء مسودة البريد' : 'Email draft generated');
    } catch (error) {
      const message = error instanceof Error ? error.message : (uiLang === 'ar' ? 'تعذر إنشاء المسودة' : 'Failed to generate draft');
      setAiError(message);
      toast.error(message);
    } finally {
      setAiGenerating(false);
    }
  }, [aiLanguageVariant, aiLength, aiStyle, aiTone, canGenerateComposeAi, composeAiLanguage, composeAiPrompt, composeAiWordCount, uiLang]);

  const handleUseAiReplace = useCallback(() => {
    const next = normalizedAiResult.trim();
    if (!next) return;
    setBody(next);
    toast.success(uiLang === 'ar' ? 'تم نقل النص إلى الرسالة' : 'Draft moved into the message');
  }, [normalizedAiResult, uiLang]);

  const handleUseAiAppend = useCallback(() => {
    const next = normalizedAiResult.trim();
    if (!next) return;
    setBody((prev) => prev.trim() ? `${prev.trim()}\n\n${next}` : next);
    toast.success(uiLang === 'ar' ? 'تمت إضافة النص إلى الرسالة' : 'Draft added to the message');
  }, [normalizedAiResult, uiLang]);

  const handleOpenSmartTextGenerator = useCallback(() => {
    saveSmartTextPrefill({
      tab: 'compose',
      topic: aiPrompt.trim() || composeAiPrompt,
      contentType: 'email',
      tone: aiTone,
      length: aiLength,
    });
    navigate('/text-generator?tab=compose');
  }, [aiLength, aiPrompt, aiTone, composeAiPrompt, navigate]);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    const composedBodies = buildComposedEmailBodies(body, signatureSettings, includeSignature);
    const ok = await onSend({
      to: splitRecipients(to),
      cc: splitRecipients(cc),
      subject: subject.trim(),
      body: composedBodies.textBody,
      htmlBody: composedBodies.htmlBody,
      attachments,
      threadId: replyTo?.threadId,
      sendId,
    });
    setSending(false);
    if (ok) onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
        <div className="flex max-h-[calc(100dvh-0.75rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
          <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-foreground">{replyTo ? 'Reply' : 'Compose Email'}</div>
                {fromLabel ? <div className="mt-1 truncate text-xs text-muted-foreground">From: {fromLabel}</div> : null}
              </div>
              <button title="Close" onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-border bg-background/80 px-3 py-2.5">
                <label htmlFor="mail-composer-to" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">To</label>
                <input
                  id="mail-composer-to"
                  type="text"
                  value={to}
                  onChange={event => setTo(event.target.value)}
                  placeholder="name@email.com, another@email.com"
                  className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
              </div>

              <div className="rounded-2xl border border-border bg-background/80 px-3 py-2.5">
                <label htmlFor="mail-composer-cc" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">CC</label>
                <input
                  id="mail-composer-cc"
                  type="text"
                  value={cc}
                  onChange={event => setCc(event.target.value)}
                  placeholder="optional@email.com"
                  className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
              </div>

              <div className="rounded-2xl border border-border bg-background/80 px-3 py-2.5">
                <label htmlFor="mail-composer-subject" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subject</label>
                <input
                  id="mail-composer-subject"
                  type="text"
                  value={subject}
                  onChange={event => setSubject(event.target.value)}
                  placeholder="Subject"
                  className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/80 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="mail-composer-body" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Message</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id="mail-composer-attachments"
                    type="file"
                    multiple
                    title="Choose attachments, photos, videos, or audio"
                    aria-label="Choose attachments, photos, videos, or audio"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    title="Add attachments"
                    onClick={handleOpenAttachSource}
                    className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {loadingAttachments ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                    Attach
                  </button>
                  <button
                    type="button"
                    title={uiLang === 'ar' ? 'مساعد Wakti AI للبريد' : 'Wakti AI for composing'}
                    onClick={() => setShowComposeAi((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${showComposeAi
                      ? 'border-[#060541]/20 bg-[linear-gradient(135deg,#060541_0%,hsl(260_70%_25%)_100%)] text-white shadow-[0_10px_24px_rgba(6,5,65,0.28)] dark:border-[#E9CEB0]/25 dark:bg-[linear-gradient(135deg,hsl(243_84%_18%)_0%,hsl(260_70%_28%)_100%)] dark:text-[#f2f2f2]'
                      : 'border-[#060541]/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(243,246,255,0.98))] text-[#060541] shadow-[0_6px_16px_rgba(6,5,65,0.08)] hover:bg-[#eef2ff] dark:border-white/12 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))] dark:text-[#f2f2f2] dark:shadow-[0_12px_26px_rgba(0,0,0,0.32)] dark:hover:bg-[linear-gradient(180deg,rgba(31,37,51,0.98),rgba(18,22,31,0.96))]'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Wakti AI
                  </button>
                </div>
              </div>
              {showComposeAi ? (
                <div className="mb-3 overflow-hidden rounded-[24px] border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,248,255,0.98))] shadow-[0_18px_40px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(18,22,31,0.97),rgba(10,12,18,0.96))] dark:shadow-[0_20px_42px_rgba(0,0,0,0.38)]">
                  <div className="border-b border-[#060541]/10 bg-[linear-gradient(135deg,rgba(6,5,65,0.03),rgba(233,206,176,0.16))] px-4 py-3 dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(6,5,65,0.34),rgba(233,206,176,0.08))]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#060541_0%,hsl(260_70%_25%)_100%)] text-white shadow-[0_10px_22px_rgba(6,5,65,0.3)]">
                            <Sparkles className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#060541] dark:text-[#f2f2f2]">{uiLang === 'ar' ? 'Wakti AI للبريد' : 'Wakti AI'}</div>
                            <div className="mt-0.5 text-xs font-normal text-[#060541]/62 dark:text-white/65">
                              {uiLang === 'ar' ? 'اكتب الفكرة وحدد النبرة والأسلوب والطول، ثم أنشئ بريدًا جاهزًا بشكل احترافي.' : 'Write the idea, set the tone, style, and length, then generate a polished email draft.'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        title={uiLang === 'ar' ? 'إغلاق' : 'Close'}
                        onClick={() => setShowComposeAi(false)}
                        className="rounded-xl p-2 text-[#060541]/55 transition-colors hover:bg-[#eef2ff] hover:text-[#060541] dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-[#f2f2f2]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 px-4 py-4">
                    <div className="rounded-[20px] border border-[#060541]/10 bg-white/80 p-3.5 shadow-[0_8px_18px_rgba(6,5,65,0.04)] dark:border-white/8 dark:bg-white/[0.04] dark:shadow-none">
                      <label htmlFor="mail-composer-ai-prompt" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {uiLang === 'ar' ? 'الفكرة أو ما تريد قوله' : 'Idea or what to say'}
                      </label>
                      <textarea
                        id="mail-composer-ai-prompt"
                        value={aiPrompt}
                        onChange={(event) => setAiPrompt(event.target.value)}
                        placeholder={uiLang === 'ar' ? 'مثال: اكتب رسالة مهذبة للعميل أبلغه فيها أن المشروع جاهز، واطلب منه مراجعة النسخة النهائية هذا الأسبوع.' : 'Example: write a polite email to the client saying the project is ready and ask them to review the final version this week.'}
                        rows={4}
                        className="min-h-[104px] w-full resize-none rounded-2xl border border-border bg-background/80 px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70 dark:border-white/10 dark:bg-background/70"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[18px] border border-[#060541]/10 bg-white/80 p-3 dark:border-white/8 dark:bg-white/[0.04]">
                        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{uiLang === 'ar' ? 'النبرة' : 'Tone'}</div>
                        <Select value={aiTone} onValueChange={(value) => setAiTone(value as ComposeAiTone)}>
                          <SelectTrigger className="h-10 rounded-xl border border-border bg-background/80 text-left dark:border-white/10 dark:bg-background/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMPOSE_AI_TONES.map((tone) => (
                              <SelectItem key={tone} value={tone}>{composeToneLabel(tone, uiLang)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-[18px] border border-[#060541]/10 bg-white/80 p-3 dark:border-white/8 dark:bg-white/[0.04]">
                        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{uiLang === 'ar' ? 'الأسلوب' : 'Register'}</div>
                        <Select value={aiStyle} onValueChange={(value) => setAiStyle(value as ComposeAiStyle)}>
                          <SelectTrigger className="h-10 rounded-xl border border-border bg-background/80 text-left dark:border-white/10 dark:bg-background/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMPOSE_AI_STYLES.map((style) => (
                              <SelectItem key={style} value={style}>{composeStyleLabel(style, uiLang)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-[18px] border border-[#060541]/10 bg-white/80 p-3 dark:border-white/8 dark:bg-white/[0.04]">
                        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{uiLang === 'ar' ? 'الطول' : 'Length'}</div>
                        <Select value={aiLength} onValueChange={(value) => setAiLength(value as ComposeAiLength)}>
                          <SelectTrigger className="h-10 rounded-xl border border-border bg-background/80 text-left dark:border-white/10 dark:bg-background/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMPOSE_AI_LENGTHS.map((lengthValue) => (
                              <SelectItem key={lengthValue} value={lengthValue}>{composeLengthLabel(lengthValue, uiLang)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-[18px] border border-[#060541]/10 bg-white/80 p-3 dark:border-white/8 dark:bg-white/[0.04]">
                        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{uiLang === 'ar' ? 'نوع اللغة' : 'Language Variant'}</div>
                        <Select value={aiLanguageVariant} onValueChange={(value) => setAiLanguageVariant(value as ComposeAiLanguageVariant)}>
                          <SelectTrigger className="h-10 rounded-xl border border-border bg-background/80 text-left dark:border-white/10 dark:bg-background/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLanguageVariants.map((variant) => (
                              <SelectItem key={variant} value={variant}>{composeLanguageVariantLabel(variant, uiLang)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={handleGenerateComposeAi}
                        disabled={!canGenerateComposeAi}
                        className="h-10 gap-2 rounded-xl bg-[linear-gradient(135deg,#060541_0%,hsl(260_70%_25%)_100%)] px-4 text-white shadow-[0_12px_24px_rgba(6,5,65,0.24)] hover:opacity-95"
                      >
                        {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {aiGenerating ? (uiLang === 'ar' ? 'جاري إنشاء المسودة...' : 'Generating draft...') : (uiLang === 'ar' ? 'أنشئ المسودة' : 'Generate draft')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleOpenSmartTextGenerator}
                        className="h-10 gap-2 rounded-xl border-black/10 bg-white text-black shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:bg-[#f5f5f5] dark:border-white/12 dark:bg-white dark:text-black dark:hover:bg-[#f2f2f2]"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        {uiLang === 'ar' ? 'افتح في Smart Text Generator' : 'Open in Smart Text Generator'}
                      </Button>
                    </div>

                    {aiError ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                        {aiError}
                      </div>
                    ) : null}

                    {normalizedAiResult.trim() ? (
                      <div className="rounded-[20px] border border-[#060541]/10 bg-white/80 p-3.5 shadow-[0_8px_18px_rgba(6,5,65,0.04)] dark:border-white/8 dark:bg-white/[0.04] dark:shadow-none">
                        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{uiLang === 'ar' ? 'المسودة الناتجة' : 'Generated draft'}</div>
                        <div dir={composeAiLanguage === 'ar' ? 'rtl' : 'ltr'} className={`max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-background/80 px-3 py-2.5 text-sm leading-6 text-foreground dark:border-white/10 dark:bg-background/70 ${composeAiLanguage === 'ar' ? 'text-right' : 'text-left'}`}>{normalizedAiResult.trim()}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" onClick={handleUseAiReplace} className="h-9 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700">
                            {uiLang === 'ar' ? 'استبدل الرسالة' : 'Replace message'}
                          </Button>
                          <Button type="button" variant="outline" onClick={handleUseAiAppend} className="h-9 rounded-xl border-black/10 bg-white text-black shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:bg-[#f5f5f5] dark:border-white/12 dark:bg-white dark:text-black dark:hover:bg-[#f2f2f2]">
                            {uiLang === 'ar' ? 'أضف إلى الرسالة' : 'Add to message'}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <textarea
                id="mail-composer-body"
                value={body}
                onChange={event => setBody(event.target.value)}
                placeholder="Write your message..."
                rows={10}
                className="min-h-[180px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70 sm:min-h-[220px]"
              />
            </div>

            <div className="rounded-2xl border border-border bg-background/80 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Email signature</div>
                  <div className="mt-1 text-xs text-muted-foreground">Add your Wakti signature to this email.</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{includeSignature ? 'On' : 'Off'}</span>
                  <Switch checked={includeSignature} onCheckedChange={setIncludeSignature} aria-label="Include email signature" />
                </div>
              </div>

              {includeSignature && signaturePreviewHtml ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-white">
                  <div
                    className="min-h-[144px] w-full bg-white p-4"
                    dangerouslySetInnerHTML={{ __html: signaturePreviewHtml }}
                  />
                </div>
              ) : null}
            </div>

            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-foreground/80">
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[180px] truncate">{attachment.name}</span>
                    <button
                      type="button"
                      title="Remove attachment"
                      onClick={() => handleRemoveAttachment(index)}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
            <button onClick={onClose} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Cancel
            </button>
            <Button
              onClick={handleSend}
              disabled={sending || !canSend}
              className="h-10 gap-2 rounded-xl bg-blue-600 px-5 text-white hover:bg-blue-700"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>

      {attachSourceOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[22px] border border-[#060541]/12 bg-white p-4 text-[#060541] shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Attach</div>
                <div className="mt-1 text-xs text-[#060541]/60">Choose where to attach from.</div>
              </div>
              <button type="button" title="Close" onClick={() => setAttachSourceOpen(false)} className="rounded-xl p-2 text-[#060541]/55 transition-colors hover:bg-[#f4f6ff] hover:text-[#060541]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <Button type="button" variant="outline" className="justify-start gap-2 border-[#060541]/12 text-[#060541] hover:bg-[#f7f8ff]" onClick={handleAttachFromDevice}>
                <Paperclip className="h-4 w-4" />
                From device
              </Button>
              <Button type="button" variant="outline" className="justify-start gap-2 border-[#060541]/12 text-[#060541] hover:bg-[#f7f8ff]" onClick={handleAttachFromSaved}>
                <Paperclip className="h-4 w-4" />
                From Wakti Saved
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {savedPickerOpen ? (
        <SavedMediaAttachmentPicker
          onClose={() => setSavedPickerOpen(false)}
          onSelect={handleSavedMediaSelect}
        />
      ) : null}
    </>
  );
}
