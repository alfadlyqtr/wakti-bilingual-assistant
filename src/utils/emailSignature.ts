import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client';
import { getScopedStorageItem, migrateLegacyScopedStorage, setScopedStorageItem } from '@/utils/userScopedStorage';

export interface EmailSignatureSettings {
  enabled: boolean;
  html: string;
  showWaktiAiFooter: boolean;
  prompt: string;
  imageDataUrl: string;
  imageAlt: string;
  updatedAt: string;
}

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
  'max-width',
  'height',
  'vertical-align',
]);

export function getDefaultEmailSignatureSettings(): EmailSignatureSettings {
  return {
    enabled: true,
    html: '',
    showWaktiAiFooter: true,
    prompt: '',
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
  imageDataUrl?: string;
  imageAlt?: string;
}) {
  const trimmedPrompt = options.prompt.trim();
  if (!trimmedPrompt) {
    throw new Error(options.language === 'ar' ? 'اكتب وصفاً للتوقيع أولاً' : 'Write a signature prompt first');
  }

  const safeImageDataUrl = options.imageDataUrl ? sanitizeUrl(options.imageDataUrl, 'src') : '';
  const safeImageAlt = options.imageAlt ? options.imageAlt.replace(/[\r\n]+/g, ' ').trim() : 'signature image';

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
        options.language === 'ar' ? 'أنت مصمم تواقيع بريد إلكتروني فاخر في Wakti.' : 'You are a premium Wakti email signature designer.',
        options.language === 'ar' ? 'أعد فقط كود HTML جاهز للإرسال كتوقيع بريد إلكتروني.' : 'Return only production-ready HTML for an email signature.',
        options.language === 'ar' ? 'اجعل النتيجة سهلة وغير تقنية للمستخدم النهائي.' : 'Make the result feel polished, premium, and effortless for the end user.',
        options.language === 'ar' ? 'استخدم فقط أنماطاً داخلية inline styles.' : 'Use inline styles only.',
        options.language === 'ar' ? 'لا ترجع markdown أو ``` أو html أو body أو head أو script أو style.' : 'Do not return markdown, ``` fences, html, body, head, script, or style tags.',
        options.language === 'ar' ? 'اجعل التوقيع صغيراً ومضغوطاً ومتوافقاً مع البريد، ويفضل هيكل table أو div بسيط.' : 'Keep the signature compact, email-friendly, and preferably use a simple table or div layout.',
        options.language === 'ar' ? 'لا تخترع بيانات أو روابط أو صور غير مذكورة.' : 'Do not invent any personal details, links, or images that were not requested.',
        options.language === 'ar' ? 'المسموح: div, table, tbody, tr, td, p, span, strong, em, a, br, img.' : 'Allowed tags: div, table, tbody, tr, td, p, span, strong, em, a, br, img.',
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
      temperature: 0.7,
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
        }
      }
    }
  }

  const sanitized = sanitizeEmailSignatureHtml(generatedText.trim());
  if (!sanitized) {
    throw new Error(options.language === 'ar' ? 'تعذر إنشاء توقيع صالح' : 'Failed to generate a valid signature');
  }
  return sanitized;
}
