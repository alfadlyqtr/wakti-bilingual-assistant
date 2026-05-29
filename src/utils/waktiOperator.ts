import type { MailComposerAttachment } from '@/components/email/MailComposer';
import { getWaktiCapabilityGuide, getWaktiCapabilityRouteLabel, getWaktiCapabilitySteps, getWaktiCapabilitySupportSummary, getWaktiCapabilityTitle, type WaktiCapability } from '@/utils/waktiCapabilities';
import { analyzeWaktiOperatorIntent, type WaktiOperatorIntentKind } from '@/utils/waktiOperatorIntent';
import { saveTRPrefill, type TRPrefill, type TRReminderPrefillDraft, type TRTaskPrefillDraft } from '@/utils/trPrefill';

const WAKTI_OPERATOR_PAYLOAD_PREFIX = 'wakti-operator-payload:';

export type WaktiOperatorRisk = 'safe' | 'approval_required';
export type WaktiOperatorStepStatus = 'pending' | 'running' | 'completed' | 'paused' | 'failed';
export type WaktiOperatorStepKind =
  | 'open_wakti_agent'
  | 'show_guidance'
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
  trPrefill?: TRPrefill;
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

export interface WaktiOperatorAction {
  label: string;
  href: string;
}

export interface WaktiOperatorPlan {
  id: string;
  transcript: string;
  summary: string;
  mode?: 'guidance' | 'navigation' | 'execution';
  answer?: string;
  primaryAction?: WaktiOperatorAction;
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

function buildGuidanceStep(label: string): WaktiOperatorStep {
  return {
    id: createId('step'),
    kind: 'show_guidance',
    label,
    description: '',
    risk: 'safe',
    status: 'pending',
  };
}

function shouldPreferGuidanceFlow(transcript: string, kind: WaktiOperatorIntentKind) {
  if (kind === 'guidance') return true;
  if (kind !== 'mixed') return false;
  return /^(how do i|how can i|can you explain|explain|show me how|help me understand|where do i|what is|كيف|اشرح|وريني|دلني|ساعدني أفهم|ساعدني افهم)/i.test(trimSentence(transcript));
}

function buildCapabilityGuidancePlan(
  transcript: string,
  language: 'ar' | 'en',
  capability: WaktiCapability,
  includeSupportNote = false,
) {
  const title = getWaktiCapabilityTitle(capability, language);
  const guide = getWaktiCapabilityGuide(capability, language);
  const supportNote = includeSupportNote ? getWaktiCapabilitySupportSummary(capability, language) : '';
  return {
    id: createId('plan'),
    transcript,
    mode: 'guidance' as const,
    summary: title,
    answer: trimSentence(`${guide}${supportNote ? ` ${supportNote}` : ''}`),
    primaryAction: {
      label: getWaktiCapabilityRouteLabel(capability, language),
      href: capability.route,
    },
    steps: getWaktiCapabilitySteps(capability, language).map((step) => buildGuidanceStep(step)),
  };
}

function stripTaskLanguage(transcript: string): string {
  return trimSentence(
    transcript
      .replace(/\b(remind me to|remember to|create a task to|create task to|add a task to|add task to|make a task to|make task to|set a reminder to|create a reminder to|add a reminder to|task to|reminder to)\b/gi, ' ')
      .replace(/\b(ذكرني أن|ذكرني بـ|أنشئ مهمة|اضف مهمة|أضف مهمة|سوي مهمة|أنشئ تذكير|اضف تذكير|أضف تذكير|سوي تذكير)\b/gi, ' ')
      .replace(/\b(in wakti|inside wakti|using wakti)\b/gi, ' ')
      .replace(/\s+/g, ' ')
  );
}

function extractRelativeMinutes(transcript: string): number | null {
  const lower = transcript.toLowerCase();
  const numericMatch = lower.match(/\b(?:in|after)\s+(\d{1,3})\s*(minute|minutes|min|mins)\b/);
  if (numericMatch) {
    const minutes = Number.parseInt(numericMatch[1], 10);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }
  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    fifteen: 15,
    twenty: 20,
    thirty: 30,
  };
  const wordMatch = lower.match(/\b(?:in|after)\s+(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s+minutes?\b/);
  if (wordMatch) return wordMap[wordMatch[1]] || null;

  const arabicNumericMatch = transcript.match(/بعد\s+(\d{1,3})\s*دقائق?/);
  if (arabicNumericMatch) {
    const minutes = Number.parseInt(arabicNumericMatch[1], 10);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }

  const arabicWordMap: Record<string, number> = {
    دقيقة: 1,
    دقيقتين: 2,
    دقيقتان: 2,
    ثلاث: 3,
    ثلاثة: 3,
    أربع: 4,
    أربعة: 4,
    خمس: 5,
    خمسة: 5,
    ست: 6,
    ستة: 6,
    سبع: 7,
    سبعة: 7,
    ثمان: 8,
    ثمانية: 8,
    تسع: 9,
    تسعة: 9,
    عشر: 10,
    عشرة: 10,
  };
  const arabicWordMatch = transcript.match(/بعد\s+(دقيقة|دقيقتين|دقيقتان|ثلاث|ثلاثة|أربع|أربعة|خمس|خمسة|ست|ستة|سبع|سبعة|ثمان|ثمانية|تسع|تسعة|عشر|عشرة)\s*دقائق?/);
  if (arabicWordMatch) return arabicWordMap[arabicWordMatch[1]] || null;

  return null;
}

function stripReminderTiming(text: string): string {
  return trimSentence(
    text
      .replace(/\b(in|after)\s+\d{1,3}\s*(minute|minutes|min|mins)\b/gi, ' ')
      .replace(/\b(in|after)\s+(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s+minutes?\b/gi, ' ')
      .replace(/\b(today|tomorrow|tonight|this evening|this afternoon|next week|next month)\b/gi, ' ')
      .replace(/بعد\s+\d{1,3}\s*دقائق?/g, ' ')
      .replace(/بعد\s+(دقيقة|دقيقتين|دقيقتان|ثلاث|ثلاثة|أربع|أربعة|خمس|خمسة|ست|ستة|سبع|سبعة|ثمان|ثمانية|تسع|تسعة|عشر|عشرة)\s*دقائق?/g, ' ')
      .replace(/\b(اليوم|بكرة|غداً|غدا|الليلة|هذا المساء|الأسبوع القادم|الشهر القادم)\b/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function extractTaskTitle(transcript: string): string {
  const cleaned = stripReminderTiming(stripTaskLanguage(transcript));
  return titleCaseFromWords(cleaned || transcript, 8).slice(0, 120);
}

function detectReminderIntent(transcript: string): boolean {
  return /\b(remind|reminder|ذكرني|تذكير)\b/i.test(transcript);
}

function buildTaskPrefill(transcript: string): TRTaskPrefillDraft {
  return {
    title: extractTaskTitle(transcript),
    description: trimSentence(transcript),
    priority: /\b(urgent|asap|important|ضروري|عاجل|مهم)\b/i.test(transcript) ? 'urgent' : /\b(high priority|high|soon|قريب|أولوية)\b/i.test(transcript) ? 'high' : 'normal',
    task_type: /\b(repeat|every day|daily|weekly|شهري|يومي|أسبوعي|متكرر)\b/i.test(transcript) ? 'repeated' : 'one-time',
    is_shared: false,
  };
}

function buildReminderPrefill(transcript: string): TRReminderPrefillDraft {
  const relativeMinutes = extractRelativeMinutes(transcript);
  const reminderTime = relativeMinutes
    ? new Date(Date.now() + relativeMinutes * 60 * 1000)
    : null;
  return {
    title: extractTaskTitle(transcript),
    description: trimSentence(transcript),
    due_date: reminderTime ? reminderTime.toISOString().split('T')[0] : undefined,
    due_time: reminderTime
      ? `${String(reminderTime.getHours()).padStart(2, '0')}:${String(reminderTime.getMinutes()).padStart(2, '0')}`
      : undefined,
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
  const intentAnalysis = analyzeWaktiOperatorIntent(normalized);
  const matchedCapability = intentAnalysis.capability;

  if (matchedCapability && shouldPreferGuidanceFlow(normalized, intentAnalysis.kind)) {
    return buildCapabilityGuidancePlan(normalized, language, matchedCapability);
  }

  if (matchedCapability && intentAnalysis.kind === 'navigation') {
    return {
      id: createId('plan'),
      transcript: normalized,
      mode: 'navigation',
      summary: getWaktiCapabilityTitle(matchedCapability, language),
      answer: language === 'ar' ? 'سأنقلك إلى المكان الصحيح داخل وكتي.' : 'I will take you to the right place inside Wakti.',
      steps: [
        buildAgentStep(
          matchedCapability.route,
          getWaktiCapabilityRouteLabel(matchedCapability, language),
          language === 'ar'
            ? `سأفتح ${getWaktiCapabilityTitle(matchedCapability, language)} داخل وكتي.`
            : `I will open ${getWaktiCapabilityTitle(matchedCapability, language)} inside Wakti.`
        ),
      ],
    };
  }

  if (matchedCapability && matchedCapability.supportLevel !== 'full_operator' && (intentAnalysis.kind === 'execution' || intentAnalysis.kind === 'mixed')) {
    return buildCapabilityGuidancePlan(normalized, language, matchedCapability, true);
  }

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
    const isReminder = detectReminderIntent(normalized);
    const openStepId = createId('step');
    const createStepId = createId('step');
    const trPrefill: TRPrefill = isReminder
      ? {
          version: 1,
          kind: 'reminder',
          openTab: 'reminders',
          openModal: 'create',
          draft: buildReminderPrefill(normalized),
        }
      : {
          version: 1,
          kind: 'task',
          openTab: 'tasks',
          openModal: 'create',
          draft: buildTaskPrefill(normalized),
        };
    saveTRPrefill(trPrefill);
    const taskPayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: isReminder
        ? (language === 'ar' ? 'تحضير التذكير داخل المهام والتذكيرات' : 'Preparing the reminder inside Tasks & Reminders')
        : (language === 'ar' ? 'تحضير المهمة داخل المهام والتذكيرات' : 'Preparing the task inside Tasks & Reminders'),
      stepRefs: {
        openStepId,
        handoffStepId: createStepId,
      },
      trPrefill,
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(taskPayload);
    steps.push({
      id: openStepId,
      kind: isReminder ? 'create_reminder' : 'create_task',
      label: isReminder
        ? (language === 'ar' ? 'افتح التذكيرات' : 'Open reminders')
        : (language === 'ar' ? 'افتح المهام' : 'Open tasks'),
      description: isReminder
        ? (language === 'ar' ? 'أنتقل إلى صفحة التذكيرات داخل وكتي.' : 'Navigate to Tasks & Reminders inside Wakti.')
        : (language === 'ar' ? 'أنتقل إلى صفحة المهام داخل وكتي.' : 'Navigate to Tasks & Reminders inside Wakti.'),
      risk: 'safe',
      status: 'pending',
      href: `/tr?intent=create&tab=${trPrefill.openTab}&waktiOperator=${payloadId}`,
      payloadId,
    });
    steps.push({
      id: createStepId,
      kind: isReminder ? 'create_reminder' : 'create_task',
      label: isReminder
        ? (language === 'ar' ? 'أنشئ التذكير' : 'Create reminder')
        : (language === 'ar' ? 'أنشئ المهمة' : 'Create task'),
      description: trPrefill.draft.title || normalized,
      risk: 'safe',
      status: 'pending',
      payloadId,
    });
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
    mode: 'execution',
    summary: language === 'ar'
      ? `فهمت طلبك وسأبدأ بالخطوات الآمنة داخل وكتي.`
      : 'I understood your request and will start the safe steps inside Wakti.',
    steps,
  };
}
