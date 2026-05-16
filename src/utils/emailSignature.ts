import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client';
import { getScopedStorageItem, migrateLegacyScopedStorage, setScopedStorageItem } from '@/utils/userScopedStorage';

export interface EmailSignatureSettings {
  enabled: boolean;
  html: string;
  showWaktiAiFooter: boolean;
  prompt: string;
  stylePreset: string;
  imageDataUrl: string;
  imageAlt: string;
  updatedAt: string;
}

export type EmailSignatureStylePreset =
  | 'luxe-card'
  | 'executive-dark'
  | 'modern-split'
  | 'soft-blush'
  | 'bold-stripe'
  | 'minimal-frame';

const EMAIL_SIGNATURE_STORAGE_KEY = 'wakti_email_signature_v1';
const EMAIL_SIGNATURE_LEGACY_KEY = 'wakti_email_signature';
const SIGNATURE_IMAGE_MAX_DIMENSION = 240;
const SIGNATURE_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TAGS = new Set(['div', 'table', 'tbody', 'tr', 'td', 'p', 'span', 'strong', 'em', 'b', 'i', 'a', 'br', 'img']);
const REMOVE_ENTIRELY_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'option', 'video', 'audio', 'svg', 'canvas']);
const ALLOWED_ATTRIBUTES = new Set(['style', 'href', 'src', 'alt', 'width', 'height', 'cellpadding', 'cellspacing', 'border', 'align', 'target', 'rel']);
const ALLOWED_STYLE_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'font-size',
  'font-weight',
  'font-family',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration',
  'text-align',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'display',
  'width',
  'min-width',
  'max-width',
  'height',
  'vertical-align',
  'border-collapse',
  'border-spacing',
  'box-shadow',
]);

const SIGNATURE_STYLE_DIRECTIONS: Record<EmailSignatureStylePreset, { en: string; ar: string }> = {
  'luxe-card': {
    en: 'Design a luxury signature card with elegant spacing, refined typography, a premium cream or gold-accent feel, and a polished business-card look.',
    ar: 'صمّم توقيعاً فاخراً جداً بأسلوب بطاقة أعمال راقية مع مسافات أنيقة وخطوط مرتبة ولمسات كريمية أو ذهبية وإحساس premium واضح.',
  },
  'executive-dark': {
    en: 'Design a dark executive signature with a bold premium presence, strong contrast, thin luxury dividers, and a confident leadership feel.',
    ar: 'صمّم توقيعاً تنفيذياً داكناً بحضور قوي وتباين واضح وفواصل رفيعة فاخرة وإحساس قيادي وراقي.',
  },
  'modern-split': {
    en: 'Design a modern two-column signature with smart hierarchy, clean geometry, elegant alignment, and a polished corporate-tech feel.',
    ar: 'صمّم توقيعاً حديثاً بعمودين مع تسلسل بصري ذكي ومحاذاة نظيفة وهندسة مرتبة وإحساس تقني راقٍ.',
  },
  'soft-blush': {
    en: 'Design a soft premium signature with warm editorial styling, delicate color work, graceful spacing, and a feminine luxury feel.',
    ar: 'صمّم توقيعاً ناعماً وفاخراً بأسلوب تحريري دافئ وألوان رقيقة ومسافات جميلة وإحساس أنثوي راقٍ.',
  },
  'bold-stripe': {
    en: 'Design a bold signature with a strong color block or stripe, sharp hierarchy, premium edge, and a memorable personal-brand feel.',
    ar: 'صمّم توقيعاً جريئاً مع شريط أو كتلة لونية واضحة وتسلسل بصري قوي وطابع شخصي فاخر ولافت.',
  },
  'minimal-frame': {
    en: 'Design a minimal premium signature with a clean frame, airy spacing, subtle lines, and elegant understated sophistication.',
    ar: 'صمّم توقيعاً بسيطاً وفاخراً بإطار نظيف ومسافات مريحة وخطوط خفيفة وأناقة هادئة جداً.',
  },
};

function resolveSignatureStylePreset(value?: string): EmailSignatureStylePreset | null {
  if (!value) return null;
  if (value in SIGNATURE_STYLE_DIRECTIONS) {
    return value as EmailSignatureStylePreset;
  }
  return null;
}

export function getDefaultEmailSignatureSettings(): EmailSignatureSettings {
  return {
    enabled: true,
    html: '',
    showWaktiAiFooter: true,
    prompt: '',
    stylePreset: '',
    imageDataUrl: '',
    imageAlt: '',
    updatedAt: '',
  };
}

export function readEmailSignatureSettings(explicitUid?: string | null): EmailSignatureSettings {
  migrateLegacyScopedStorage(EMAIL_SIGNATURE_STORAGE_KEY, explicitUid, EMAIL_SIGNATURE_LEGACY_KEY);
  const raw = getScopedStorageItem(EMAIL_SIGNATURE_STORAGE_KEY, explicitUid, EMAIL_SIGNATURE_LEGACY_KEY);
  if (!raw) return getDefaultEmailSignatureSettings();

  try {
    const parsed = JSON.parse(raw) as Partial<EmailSignatureSettings>;
    return {
      enabled: parsed.enabled ?? true,
      html: typeof parsed.html === 'string' ? parsed.html : '',
      showWaktiAiFooter: parsed.showWaktiAiFooter ?? true,
      prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
      stylePreset: resolveSignatureStylePreset(typeof parsed.stylePreset === 'string' ? parsed.stylePreset : '') || '',
      imageDataUrl: typeof parsed.imageDataUrl === 'string' ? parsed.imageDataUrl : '',
      imageAlt: typeof parsed.imageAlt === 'string' ? parsed.imageAlt : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return getDefaultEmailSignatureSettings();
  }
}

export function saveEmailSignatureSettings(settings: EmailSignatureSettings, explicitUid?: string | null) {
  const safeImageDataUrl = settings.imageDataUrl ? sanitizeUrl(settings.imageDataUrl, 'src') : '';
  const next: EmailSignatureSettings = {
    enabled: Boolean(settings.enabled),
    html: sanitizeEmailSignatureHtml(settings.html || ''),
    showWaktiAiFooter: Boolean(settings.showWaktiAiFooter),
    prompt: typeof settings.prompt === 'string' ? settings.prompt.trim() : '',
    stylePreset: resolveSignatureStylePreset(settings.stylePreset) || '',
    imageDataUrl: safeImageDataUrl,
    imageAlt: typeof settings.imageAlt === 'string' ? settings.imageAlt.replace(/[\r\n]+/g, ' ').trim() : '',
    updatedAt: settings.updatedAt || new Date().toISOString(),
  };

  setScopedStorageItem(EMAIL_SIGNATURE_STORAGE_KEY, JSON.stringify(next), explicitUid);
  return next;
}

function sanitizeUrl(value: string, kind: 'href' | 'src'): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text/html')) {
    return '';
  }

  if (kind === 'href') {
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:') || lower.startsWith('tel:')) {
      return trimmed;
    }
    return '';
  }

  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return trimmed;
  }
  if (/^data:image\/(png|jpeg|jpg|gif|webp);/i.test(lower)) {
    return trimmed;
  }
  return '';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

export async function prepareEmailSignatureImage(file: File): Promise<{ dataUrl: string; alt: string }> {
  if (typeof window === 'undefined') {
    throw new Error('Image upload is only available in the browser');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file');
  }

  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Use JPG, PNG, WEBP, or GIF for the signature image');
  }

  if (file.size > SIGNATURE_IMAGE_MAX_FILE_SIZE) {
    throw new Error('Signature image must be smaller than 5MB');
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const scale = Math.min(1, SIGNATURE_IMAGE_MAX_DIMENSION / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round((image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to prepare the signature image');
  }
  context.drawImage(image, 0, 0, width, height);
  const outputType = file.type === 'image/png' || file.type === 'image/gif' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(outputType, outputType === 'image/png' ? undefined : 0.86);
  const safeDataUrl = sanitizeUrl(dataUrl, 'src');
  if (!safeDataUrl) {
    throw new Error('Failed to prepare a safe signature image');
  }

  return {
    dataUrl: safeDataUrl,
    alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'signature image',
  };
}

function sanitizeStyleAttribute(value: string): string {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf(':');
      if (separatorIndex === -1) return '';
      const property = part.slice(0, separatorIndex).trim().toLowerCase();
      const propertyValue = part.slice(separatorIndex + 1).trim();
      const lowerValue = propertyValue.toLowerCase();
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) return '';
      if (!propertyValue) return '';
      if (lowerValue.includes('expression(') || lowerValue.includes('javascript:') || lowerValue.includes('url(') || lowerValue.includes('@import')) {
        return '';
      }
      return `${property}: ${propertyValue}`;
    })
    .filter(Boolean)
    .join('; ');
}

function sanitizeElementTree(root: ParentNode) {
  const elements = Array.from(root.querySelectorAll('*'));

  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();

    if (REMOVE_ENTIRELY_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      const parent = element.parentNode;
      if (!parent) {
        element.remove();
        continue;
      }
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith('on')) {
        element.removeAttribute(attr.name);
        continue;
      }
      if (!ALLOWED_ATTRIBUTES.has(attrName)) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (attrName === 'href') {
        const safeHref = sanitizeUrl(attr.value, 'href');
        if (!safeHref) {
          element.removeAttribute(attr.name);
        } else {
          element.setAttribute('href', safeHref);
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
        continue;
      }

      if (attrName === 'src') {
        const safeSrc = sanitizeUrl(attr.value, 'src');
        if (!safeSrc) {
          element.removeAttribute(attr.name);
        } else {
          element.setAttribute('src', safeSrc);
        }
        continue;
      }

      if (attrName === 'style') {
        const safeStyle = sanitizeStyleAttribute(attr.value);
        if (!safeStyle) {
          element.removeAttribute(attr.name);
        } else {
          element.setAttribute('style', safeStyle);
        }
      }
    }
  }
}

export function sanitizeEmailSignatureHtml(rawHtml: string): string {
  const input = (rawHtml || '').trim();
  if (!input || typeof window === 'undefined') return input;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html');
  const wrapper = doc.body.firstElementChild;
  if (!wrapper) return '';
  sanitizeElementTree(wrapper);
  return wrapper.innerHTML.trim();
}

function decodeHtmlEntities(rawValue: string): string {
  if (!rawValue || typeof window === 'undefined') return rawValue;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = rawValue;
  return textarea.value;
}

function normalizeGeneratedSignatureHtml(rawValue: string): string {
  let normalized = (rawValue || '').trim();
  if (!normalized) return '';

  normalized = normalized
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const bodyMatch = normalized.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    normalized = bodyMatch[1].trim();
  }

  normalized = normalized
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .trim();

  if (!/<(table|div|p|span|strong|em|a|br|img|tbody|tr|td)\b/i.test(normalized) && /&lt;|&#60;|&amp;lt;/i.test(normalized)) {
    normalized = decodeHtmlEntities(normalized)
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  const firstAllowedTagIndex = normalized.search(/<(table|div|p|span|strong|em|a|br|img|tbody|tr|td)\b/i);
  if (firstAllowedTagIndex > 0) {
    normalized = normalized.slice(firstAllowedTagIndex).trim();
  }

  return normalized;
}

function hasRenderableSignatureContent(html: string): boolean {
  const normalized = (html || '').trim();
  if (!normalized) return false;
  const plainText = htmlToPlainText(normalized);
  const meaningfulText = plainText.replace(/\s+/g, ' ').trim();
  const hasImage = /<img\b/i.test(normalized);
  const looksLikeRawCode = /&lt;(table|div|p|span|a|img|tbody|tr|td)\b/i.test(normalized)
    || /(^|\s)<(table|div|p|span|a|img|tbody|tr|td)\b/i.test(meaningfulText);
  return !looksLikeRawCode && (meaningfulText.length >= 8 || hasImage);
}

function buildPlainTextSignatureFallback(rawValue: string): string {
  const lines = rawValue
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!lines.length) return '';

  const [nameLine, ...restLines] = lines;
  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#111827;font-size:14px;line-height:1.6;">',
    `<div style="font-size:18px;font-weight:700;line-height:1.3;color:#060541;">${escapeHtml(nameLine)}</div>`,
    ...restLines.map((line, index) => (
      `<div style="margin-top:${index === 0 ? '4px' : '2px'};${index === 0 ? 'font-weight:600;color:#374151;' : 'color:#4b5563;'}">${escapeHtml(line)}</div>`
    )),
    '</div>',
  ].join('');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function htmlToPlainText(value: string): string {
  const html = (value || '').trim();
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|tr|table|tbody|td)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildWaktiAiFooterHtml() {
  return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;">Wakti AI</div>';
}

export function buildWaktiAiFooterText() {
  return 'Wakti AI';
}

export function buildSignatureHtml(settings: EmailSignatureSettings): string {
  const sanitized = sanitizeEmailSignatureHtml(settings.html || '');
  const footerHtml = settings.showWaktiAiFooter ? buildWaktiAiFooterHtml() : '';
  if (!sanitized && !footerHtml) return '';
  return `${sanitized}${footerHtml}`.trim();
}

export function buildSignatureText(settings: EmailSignatureSettings): string {
  const pieces = [htmlToPlainText(settings.html || ''), settings.showWaktiAiFooter ? buildWaktiAiFooterText() : '']
    .map((value) => value.trim())
    .filter(Boolean);
  return pieces.join('\n');
}

export function buildComposedEmailBodies(body: string, settings: EmailSignatureSettings, includeSignature: boolean) {
  const normalizedBody = (body || '').replace(/\r\n?/g, '\n').trimEnd();
  const signatureHtml = includeSignature && settings.enabled ? buildSignatureHtml(settings) : '';
  const signatureText = includeSignature && settings.enabled ? buildSignatureText(settings) : '';
  const htmlBody = [
    `<div style="white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#111827;font-size:14px;line-height:1.65;">${escapeHtml(normalizedBody).replace(/\n/g, '<br/>')}</div>`,
    signatureHtml ? `<div style="margin-top:16px;">${signatureHtml}</div>` : '',
  ].filter(Boolean).join('');
  const textBody = [normalizedBody, signatureText].filter(Boolean).join('\n\n').trim();

  return {
    textBody,
    htmlBody,
  };
}

export async function generateEmailSignatureHtml(options: {
  prompt: string;
  language: 'en' | 'ar';
  stylePreset?: string;
  imageDataUrl?: string;
  imageAlt?: string;
}) {
  const trimmedPrompt = options.prompt.trim();
  if (!trimmedPrompt) {
    throw new Error(options.language === 'ar' ? 'اكتب وصفاً للتوقيع أولاً' : 'Write a signature prompt first');
  }

  const resolvedStylePreset = resolveSignatureStylePreset(options.stylePreset);
  const safeImageDataUrl = options.imageDataUrl ? sanitizeUrl(options.imageDataUrl, 'src') : '';
  const safeImageAlt = options.imageAlt ? options.imageAlt.replace(/[\r\n]+/g, ' ').trim() : 'signature image';
  const styleDirection = resolvedStylePreset ? SIGNATURE_STYLE_DIRECTIONS[resolvedStylePreset][options.language] : '';

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/text-generator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      prompt: [
        options.language === 'ar' ? 'أنت أفضل AI coder لتواقيع البريد في Wakti.' : 'You are the best AI coder for email signatures inside Wakti.',
        options.language === 'ar' ? 'أعد فقط كود HTML جاهز للإرسال كتوقيع بريد إلكتروني جميل وعملي.' : 'Return only production-ready HTML for a beautiful, practical email signature.',
        options.language === 'ar' ? 'المطلوب بسيط: المستخدم يصف التوقيع، وأنت تبني التوقيع النهائي مباشرة.' : 'The task is simple: the user describes the signature, and you build the final signature directly.',
        options.language === 'ar' ? 'أنشئ توقيع بريد حقيقياً ومضغوطاً يظهر بشكل واضح داخل البريد، وليس بطاقة كبيرة أو بلوك فارغ.' : 'Build a real compact email signature that displays clearly inside an email, not a large card or empty block.',
        options.language === 'ar' ? 'اجعل النتيجة ممتازة بصرياً لكن نظيفة وواضحة وصالحة للبريد.' : 'Make the result visually excellent but still clean, clear, and email-safe.',
        options.language === 'ar' ? 'لا تعرض الكود كنص، ولا ترجع HTML escaped مثل &lt;div&gt;.' : 'Do not display the code as text, and do not return escaped HTML like &lt;div&gt;.',
        options.language === 'ar' ? 'استخدم فقط أنماطاً داخلية inline styles.' : 'Use inline styles only.',
        options.language === 'ar' ? 'لا ترجع markdown أو ``` أو html أو body أو head أو script أو style.' : 'Do not return markdown, ``` fences, html, body, head, script, or style tags.',
        options.language === 'ar' ? 'استخدم بنية بريد آمنة: يفضّل table أو div واضح مع محاذاة جيدة.' : 'Use email-safe structure: prefer a clean table or div layout with good alignment.',
        options.language === 'ar' ? 'اجعل التوقيع بحجم طبيعي يناسب نهاية رسالة بريد، وليس عرضاً كاملاً أو حاوية ضخمة. تجنب width:100% و min-height والمساحات الفارغة الكبيرة.' : 'Keep the signature naturally sized for the end of an email, not full-width or oversized. Avoid width:100%, min-height, and large empty padding.',
        options.language === 'ar' ? 'اجعل العرض مناسباً للبريد، مع تسلسل بصري قوي واسم واضح وتفاصيل مرتبة.' : 'Keep the signature email-friendly, with strong hierarchy, a clear name treatment, and tidy details.',
        options.language === 'ar' ? 'اجعل النص واضحاً جداً. إذا استخدمت خلفية فاتحة أو كريمية أو بيضاء، فاجعل النص داكناً وواضحاً.' : 'Keep the text clearly visible. If you use a light, cream, or white background, use dark readable text.',
        options.language === 'ar' ? 'إذا أعطاك المستخدم اسماً أو منصباً أو شركة أو روابط أو موقعاً أو مدينة أو هاتفاً فاستخدمها بذكاء داخل التصميم.' : 'If the user gives a name, title, company, links, website, city, or phone, use them intelligently inside the design.',
        options.language === 'ar' ? 'يمكنك جعلها حديثة أو فاخرة أو تنفيذية حسب الطلب، لكن بدون عناصر زائدة أو شرح.' : 'You can make it modern, premium, or executive depending on the request, but do not add fluff or explanation.',
        options.language === 'ar' ? 'لا تستخدم أي CSS غير مناسب للبريد مثل position absolute أو external assets غير مطلوبة أو class names.' : 'Do not use email-unfriendly CSS like position absolute, external assets that were not provided, or class names.',
        options.language === 'ar' ? 'لا تخترع بيانات أو روابط أو صور غير مذكورة.' : 'Do not invent any personal details, links, or images that were not requested.',
        options.language === 'ar' ? 'المسموح: div, table, tbody, tr, td, p, span, strong, em, a, br, img.' : 'Allowed tags: div, table, tbody, tr, td, p, span, strong, em, a, br, img.',
        ...(styleDirection ? [`${options.language === 'ar' ? 'اتجاه التصميم المختار' : 'Selected design direction'}: ${styleDirection}`] : []),
        safeImageDataUrl
          ? `${options.language === 'ar' ? 'إذا استخدمت الصورة، فاستخدم هذا src حرفياً بدون تعديل' : 'If you use the image, use this exact src without changing it'}: ${safeImageDataUrl}`
          : options.language === 'ar' ? 'لا توجد صورة مرفقة. لا تخترع صورة.' : 'No image source was provided. Do not invent one.',
        safeImageDataUrl
          ? `${options.language === 'ar' ? 'النص البديل للصورة' : 'Image alt text'}: ${safeImageAlt}`
          : '',
        `${options.language === 'ar' ? 'طلب المستخدم' : 'User request'}: ${trimmedPrompt}`,
      ].join('\n\n'),
      mode: 'compose',
      language: options.language,
      contentType: 'email',
      tone: 'professional',
      length: 'short',
      temperature: 0.85,
    }),
  });

  const responseContentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (responseContentType.includes('application/json')) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload?.error || 'Failed to generate signature');
    }
    throw new Error((await response.text()) || 'Failed to generate signature');
  }

  let generatedText = '';
  if (responseContentType.includes('application/json')) {
    const payload = await response.json().catch(() => ({}));
    generatedText = typeof payload?.generatedText === 'string' ? payload.generatedText : '';
  } else if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

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
          try {
            const event = JSON.parse(dataLine);
            if (event?.type === 'chunk' && typeof event.text === 'string') {
              generatedText += event.text;
            }
            if (event?.type === 'complete' && typeof event.generatedText === 'string') {
              generatedText = event.generatedText;
            }
            if (event?.type === 'error') {
              throw new Error(event?.error || 'Failed to generate signature');
            }
          } catch (streamError) {
            if (streamError instanceof Error) throw streamError;
          }
        }
      }
    }
  }

  const normalizedGeneratedHtml = normalizeGeneratedSignatureHtml(generatedText);
  const sanitized = sanitizeEmailSignatureHtml(normalizedGeneratedHtml);
  if (sanitized && hasRenderableSignatureContent(sanitized)) {
    return sanitized;
  }

  const fallbackHtml = buildPlainTextSignatureFallback(generatedText.trim());
  const sanitizedFallback = sanitizeEmailSignatureHtml(fallbackHtml);
  if (sanitizedFallback && hasRenderableSignatureContent(sanitizedFallback)) {
    return sanitizedFallback;
  }

  if (!sanitized) {
    throw new Error(options.language === 'ar' ? 'تعذر إنشاء توقيع صالح' : 'Failed to generate a valid signature');
  }
  return sanitized;
}
