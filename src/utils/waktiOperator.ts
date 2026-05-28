import type { MailComposerAttachment } from '@/components/email/MailComposer';

const WAKTI_OPERATOR_PAYLOAD_PREFIX = 'wakti-operator-payload:';

export type WaktiOperatorRisk = 'safe' | 'approval_required';
export type WaktiOperatorStepStatus = 'pending' | 'running' | 'completed' | 'paused' | 'failed';
export type WaktiOperatorStepKind =
  | 'open_wakti_agent'
  | 'create_task'
  | 'create_reminder'
  | 'open_image_studio'
  | 'generate_image'
  | 'save_image'
  | 'open_music_studio'
  | 'generate_music'
  | 'open_email_compose';

export interface WaktiOperatorEmailDraft {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachments?: MailComposerAttachment[];
  preferredProvider?: 'gmail' | 'mail';
}

export interface WaktiOperatorImageRequest {
  prompt: string;
  submode?: 'text2image' | 'image2image';
  autoGenerate?: boolean;
  autoSave?: boolean;
  nextEmailDraft?: WaktiOperatorEmailDraft | null;
}

export interface WaktiOperatorMusicRequest {
  title: string;
  lyrics: string;
  autoGenerate?: boolean;
}

export interface WaktiOperatorRoutePayload {
  runId: string;
  stepId: string;
  transcript: string;
  summary: string;
  stepRefs?: {
    openStepId?: string;
    generateStepId?: string;
    saveStepId?: string;
    handoffStepId?: string;
  };
  image?: WaktiOperatorImageRequest;
  music?: WaktiOperatorMusicRequest;
  email?: WaktiOperatorEmailDraft;
  source?: string;
}

export interface WaktiOperatorStep {
  id: string;
  kind: WaktiOperatorStepKind;
  label: string;
  description: string;
  risk: WaktiOperatorRisk;
  status: WaktiOperatorStepStatus;
  href?: string;
  payloadId?: string;
}

export interface WaktiOperatorPlan {
  id: string;
  transcript: string;
  summary: string;
  steps: WaktiOperatorStep[];
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function trimSentence(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function titleCaseFromWords(input: string, maxWords = 6) {
  const words = input
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, maxWords);

  if (words.length === 0) return 'Wakti Draft';

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

function extractEmailAddresses(transcript: string): string[] {
  const matches = transcript.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return Array.from(new Set((matches || []).map((item) => item.trim())));
}

function stripEmailAddresses(transcript: string): string {
  return trimSentence(transcript.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' '));
}

function stripOperatorPhrases(transcript: string): string {
  return trimSentence(
    transcript
      .replace(/\b(can you|please|could you|would you|for me|inside wakti|in wakti|using wakti)\b/gi, ' ')
      .replace(/\b(send|email|mail|gmail|compose|draft|generate|create|make|save|and then|then)\b/gi, ' ')
      .replace(/\s+/g, ' ')
  );
}

function stripImageWorkflowTail(value: string): string {
  return trimSentence(
    value
      .replace(/\b(and then|then|after that|afterwards)\b[\s\S]*$/i, ' ')
      .replace(/[,.!?;:]?\s*\b(save|download|attach|share|email|mail|send|compose|draft)\b[\s\S]*$/i, ' ')
      .replace(/[,.!?;:]?\s*\busing my\b[\s\S]*$/i, ' ')
      .replace(/[,.!?;:]?\s*\bto\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b[\s\S]*$/i, ' ')
  );
}

function extractImagePrompt(transcript: string): string {
  const normalized = stripEmailAddresses(transcript);
  const promptMatch = normalized.match(/(?:image|picture|photo|poster|logo|thumbnail|cover)\s+(?:of|for|about)\s+(.+)/i)
    || normalized.match(/(?:generate|create|make)\s+(?:an?|the)?\s*(?:image|picture|photo|poster|logo|thumbnail|cover)\s+(.+)/i);
  const raw = promptMatch?.[1] || stripOperatorPhrases(normalized);
  const cleaned = stripImageWorkflowTail(raw).replace(/^(of|for|about)\s+/i, '');
  return trimSentence(cleaned) || 'A polished image for Wakti';
}

function extractMusicTitle(transcript: string): string {
  const titleMatch = transcript.match(/(?:called|named|title(?:d)?)\s+['"]?([^'".,!?]+)['"]?/i);
  if (titleMatch?.[1]) {
    return trimSentence(titleMatch[1]).slice(0, 80);
  }
  return titleCaseFromWords(stripOperatorPhrases(transcript), 5).slice(0, 80);
}

function extractMusicLyrics(transcript: string): string {
  const lyricsMatch = transcript.match(/(?:about|with lyrics about|lyrics about|that says)\s+(.+)/i);
  const fallback = stripOperatorPhrases(stripEmailAddresses(transcript));
  return trimSentence(lyricsMatch?.[1] || fallback) || 'Create a short, catchy original track.';
}

function extractEmailBody(transcript: string): string {
  const bodyMatch = transcript.match(/(?:say|saying|body|message)(?:\s+that)?\s+(.+)/i);
  const fallback = stripOperatorPhrases(stripEmailAddresses(transcript));
  return trimSentence(bodyMatch?.[1] || fallback) || 'Here is the draft prepared by Wakti.';
}

function extractEmailSubject(transcript: string, fallback: string): string {
  const subjectMatch = transcript.match(/subject(?: line)?\s+(.+)/i);
  if (subjectMatch?.[1]) {
    return trimSentence(subjectMatch[1]).slice(0, 120);
  }
  return titleCaseFromWords(fallback, 8).slice(0, 120);
}

function buildEmailDraft(transcript: string, attachments?: MailComposerAttachment[]): WaktiOperatorEmailDraft {
  const body = extractEmailBody(transcript);
  return {
    to: extractEmailAddresses(transcript),
    cc: [],
    subject: extractEmailSubject(transcript, body),
    body,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
    preferredProvider: /gmail/gi.test(transcript) ? 'gmail' : 'mail',
  };
}

function buildAgentStep(href: string, label: string, description: string): WaktiOperatorStep {
  return {
    id: createId('step'),
    kind: 'open_wakti_agent',
    label,
    description,
    risk: 'safe',
    status: 'pending',
    href,
  };
}

export function stashWaktiOperatorPayload(payload: WaktiOperatorRoutePayload) {
  const id = createId('payload');
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(`${WAKTI_OPERATOR_PAYLOAD_PREFIX}${id}`, JSON.stringify(payload));
  }
  return id;
}

export function readWaktiOperatorPayload(payloadId?: string | null): WaktiOperatorRoutePayload | null {
  if (!payloadId || typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(`${WAKTI_OPERATOR_PAYLOAD_PREFIX}${payloadId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as WaktiOperatorRoutePayload) : null;
  } catch {
    return null;
  }
}

export function clearWaktiOperatorPayload(payloadId?: string | null) {
  if (!payloadId || typeof window === 'undefined') return;
  window.sessionStorage.removeItem(`${WAKTI_OPERATOR_PAYLOAD_PREFIX}${payloadId}`);
}

export function buildVoiceOperatorPlan(transcript: string, language: 'ar' | 'en' = 'en'): WaktiOperatorPlan {
  const normalized = trimSentence(transcript);
  const lower = normalized.toLowerCase();
  const planId = createId('plan');
  const steps: WaktiOperatorStep[] = [];
  const wantsImage = /(image|picture|photo|poster|logo|thumbnail|cover|صورة|بوستر|شعار)/i.test(normalized);
  const wantsMusic = /(music|song|track|beat|jingle|anthem|أغنية|موسيقى|مقطع)/i.test(normalized);
  const wantsEmail = /(email|mail|gmail|send|compose|draft|بريد|ايميل|أرسل)/i.test(normalized);
  const wantsTasks = /(task|todo|to do|remind|reminder|schedule|مهمة|تذكير|ذكرني|رتب)/i.test(normalized);

  if (wantsImage) {
    const openStepId = createId('step');
    const generateStepId = createId('step');
    const saveStepId = wantsEmail ? createId('step') : undefined;
    const handoffStepId = wantsEmail ? createId('step') : undefined;
    const imagePayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير طلب الصورة داخل الاستوديو' : 'Preparing the image request inside Studio',
      stepRefs: {
        openStepId,
        generateStepId,
        saveStepId,
        handoffStepId,
      },
      image: {
        prompt: extractImagePrompt(normalized),
        submode: 'text2image',
        autoGenerate: true,
        autoSave: wantsEmail,
        nextEmailDraft: wantsEmail ? buildEmailDraft(normalized) : null,
      },
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(imagePayload);
    steps.push({
      id: openStepId,
      kind: 'open_image_studio',
      label: language === 'ar' ? 'افتح استوديو الصورة' : 'Open Image Studio',
      description: language === 'ar' ? 'أنتقل إلى شاشة إنشاء الصورة داخل وكتي.' : 'Navigate to the in-app image creation screen.',
      risk: 'safe',
      status: 'pending',
      href: `/music?waktiOperator=${payloadId}&operatorTarget=image`,
      payloadId,
    });
    steps.push({
      id: generateStepId,
      kind: 'generate_image',
      label: language === 'ar' ? 'أنشئ الصورة' : 'Generate image',
      description: imagePayload.image?.prompt || '',
      risk: 'safe',
      status: 'pending',
      payloadId,
    });
    if (saveStepId) {
      steps.push({
        id: saveStepId,
        kind: 'save_image',
        label: language === 'ar' ? 'احفظ الصورة' : 'Save image',
        description: language === 'ar' ? 'أحفظ الصورة الناتجة داخل وكتي.' : 'Save the generated image inside Wakti.',
        risk: 'safe',
        status: 'pending',
        payloadId,
      });
    }
    if (handoffStepId) {
      steps.push({
        id: handoffStepId,
        kind: 'open_email_compose',
        label: language === 'ar' ? 'افتح مسودة البريد' : 'Open email draft',
        description: language === 'ar' ? 'أفتح البريد المخصص مع الصورة كمرفق.' : 'Open Custom Mail with the image attached.',
        risk: 'safe',
        status: 'pending',
      });
    }
  }

  if (wantsMusic) {
    const openStepId = createId('step');
    const generateStepId = createId('step');
    const musicPayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير طلب الموسيقى داخل الاستوديو' : 'Preparing the music request inside Studio',
      stepRefs: {
        openStepId,
        generateStepId,
      },
      music: {
        title: extractMusicTitle(normalized),
        lyrics: extractMusicLyrics(normalized),
        autoGenerate: true,
      },
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(musicPayload);
    steps.push({
      id: openStepId,
      kind: 'open_music_studio',
      label: language === 'ar' ? 'افتح استوديو الموسيقى' : 'Open Music Studio',
      description: language === 'ar' ? 'أنتقل إلى شاشة إنشاء الموسيقى داخل وكتي.' : 'Navigate to the in-app music creation screen.',
      risk: 'safe',
      status: 'pending',
      href: `/music?waktiOperator=${payloadId}&operatorTarget=music`,
      payloadId,
    });
    steps.push({
      id: generateStepId,
      kind: 'generate_music',
      label: language === 'ar' ? 'أنشئ الموسيقى' : 'Generate music',
      description: musicPayload.music?.title || '',
      risk: 'safe',
      status: 'pending',
      payloadId,
    });
  }

  if (wantsEmail && !wantsImage && !wantsMusic) {
    const openStepId = createId('step');
    const emailPayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير مسودة البريد' : 'Preparing the email draft',
      stepRefs: {
        handoffStepId: openStepId,
      },
      email: buildEmailDraft(normalized),
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(emailPayload);
    steps.push({
      id: openStepId,
      kind: 'open_email_compose',
      label: language === 'ar' ? 'تحضير البريد' : 'Prepare email draft',
      description: emailPayload.email?.subject || '',
      risk: 'safe',
      status: 'pending',
      href: `/tools/email?waktiOperator=${payloadId}`,
      payloadId,
    });
  }

  if (wantsTasks && steps.length === 0) {
    steps.push(buildAgentStep(
      '/tr',
      language === 'ar' ? 'تحويل الصوت إلى مهام' : 'Turn voice into tasks',
      language === 'ar' ? 'أفتح صفحة المهام والتذكيرات لتكمل الخطوات من داخل وكتي.' : 'Open Tasks & Reminders so you can continue the flow inside Wakti.'
    ));
  }

  if (steps.length === 0) {
    steps.push(buildAgentStep(
      '/wakti-ai-v2',
      language === 'ar' ? 'افتح وكيل وكتي' : 'Open Wakti Agent',
      language === 'ar' ? 'سأحوّل هذا الطلب إلى مسار واضح داخل واجهة وكتي الحالية.' : 'I will turn this into a guided flow inside the current Wakti interface.'
    ));
  }

  return {
    id: planId,
    transcript: normalized,
    summary: language === 'ar'
      ? `فهمت طلبك وسأبدأ بالخطوات الآمنة داخل وكتي.`
      : 'I understood your request and will start the safe steps inside Wakti.',
    steps,
  };
}
