import type { MailComposerAttachment } from '@/components/email/MailComposer';
import type { SmartTextPrefill, SmartTextPrefillTab, SmartTextToolBridge } from '@/utils/smartTextPrefill';
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
  | 'open_tasks_reminders'
  | 'prepare_task_update'
  | 'complete_task'
  | 'snooze_reminder'
  | 'open_image_studio'
  | 'generate_image'
  | 'save_image'
  | 'open_music_studio'
  | 'generate_music'
  | 'open_email_compose'
  | 'open_contacts_chat'
  | 'prepare_chat_message'
  | 'open_text_tools'
  | 'prepare_text_request'
  | 'open_voice_studio'
  | 'prepare_voice_request'
  | 'generate_voice_audio'
  | 'open_maw3d'
  | 'prepare_event_request'
  | 'open_projects'
  | 'prepare_project_request'
  | 'open_social'
  | 'prepare_social_request'
  | 'open_games'
  | 'prepare_game_request'
  | 'open_vitality'
  | 'prepare_vitality_request'
  | 'open_calendar'
  | 'change_calendar_view'
  | 'prepare_calendar_entry';

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

export interface WaktiOperatorChatRequest {
  targetContactName: string;
  draftMessage: string;
}

export interface WaktiOperatorTextRequest {
  tab: SmartTextPrefillTab;
  prefill?: SmartTextPrefill;
  bridge?: SmartTextToolBridge;
}

export interface WaktiOperatorVoiceRequest {
  tab: 'tts' | 'live-translator' | 'clone' | 'tasjeel';
  text?: string;
  targetLanguage?: string;
  spokenLanguage?: string;
  voice?: 'cedar' | 'marin';
  autoGenerate?: boolean;
}

export interface WaktiOperatorMaw3dRequest {
  action: 'create';
  title: string;
  description?: string;
  organizer?: string;
  location?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  isPublic?: boolean;
}

export interface WaktiOperatorProjectRequest {
  action: 'create';
  prompt: string;
  tab?: 'coder' | 'assistant';
}

export interface WaktiOperatorSocialRequest {
  section: 'contacts' | 'gallery';
  tab?: 'contacts' | 'requests' | 'blocked' | 'groups';
  view?: 'contacts' | 'cards';
}

export interface WaktiOperatorGameRequest {
  screen: 'home' | 'chess' | 'tictactoe' | 'solitaire' | 'letters';
}

export interface WaktiOperatorVitalityRequest {
  dataSource: 'whoop' | 'healthkit';
}

export interface WaktiOperatorTaskRequest {
  action: 'create' | 'edit' | 'complete' | 'snooze' | 'add_subtasks';
  kind: 'task' | 'reminder';
  targetTitle?: string;
  taskDraft?: TRTaskPrefillDraft;
  reminderDraft?: TRReminderPrefillDraft;
  subtasks?: string[];
  snoozeMinutes?: number;
}

export interface WaktiOperatorCalendarRequest {
  action: 'open_date' | 'change_view' | 'create_note' | 'edit_note';
  date?: string;
  view?: 'month' | 'week' | 'year';
  targetTitle?: string;
  title?: string;
  description?: string;
  time?: string;
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
  chat?: WaktiOperatorChatRequest;
  textTool?: WaktiOperatorTextRequest;
  voiceTool?: WaktiOperatorVoiceRequest;
  maw3d?: WaktiOperatorMaw3dRequest;
  project?: WaktiOperatorProjectRequest;
  social?: WaktiOperatorSocialRequest;
  game?: WaktiOperatorGameRequest;
  vitality?: WaktiOperatorVitalityRequest;
  taskAction?: WaktiOperatorTaskRequest;
  calendar?: WaktiOperatorCalendarRequest;
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

function extractQuotedText(transcript: string) {
  const match = transcript.match(/["“”'']([^"“”'']+)["“”'']/);
  return trimSentence(match?.[1] || '');
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

function stripTextRequestLanguage(transcript: string): string {
  return trimSentence(
    transcript
      .replace(/\b(can you|please|could you|would you|inside wakti|in wakti|using wakti|with wakti|for me)\b/gi, ' ')
      .replace(/\b(write|rewrite|generate|create|make|draft|compose|prepare|reply|respond|translate|summarize|improve|polish|turn|open)\b/gi, ' ')
      .replace(/\b(text tools|text tool|smart text generator|message|email|presentation|diagram|a4|document|translation|translator)\b/gi, ' ')
      .replace(/\b(اكتب|أكتب|اعد|أعد|صياغة|أنشئ|انشئ|ولّد|ولد|جهز|جهّز|رد|جاوب|ترجم|ترجمة|لخص|لخّص|افتح|أدوات النص|النص|رسالة|بريد|عرض|مخطط|مستند)\b/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function cleanNameFragment(value: string) {
  return trimSentence(
    value
      .replace(/^[@\s]+/, '')
      .replace(/\b(my contact|contact|person|conversation|chat)\b/gi, ' ')
      .replace(/\b(جهة الاتصال|جهات الاتصال|الشخص|المحادثة|الدردشة)\b/g, ' ')
      .replace(/[,.!?;:]+$/g, '')
  ).slice(0, 80);
}

function extractChatTargetName(transcript: string) {
  const patterns = [
    /(?:send|text|message|dm|chat|write|reply)\s+(?:a\s+)?(?:message|dm|chat|reply)?\s*(?:to|for)\s+(.+?)(?=\s+(?:saying|say|that says|with message|and say|to say|about|regarding)\b|$)/i,
    /(?:reply to|chat with|message)\s+(.+?)(?=\s+(?:saying|say|with message|and say|to say|about|regarding)\b|$)/i,
    /(?:ارسل|أرسل|ابعث|ابعت|دز|راسل|كلم|كلّم|رد على|ردّ على)\s+(?:رسالة\s+)?(?:إلى|الى|ل|على)?\s*(.+?)(?=\s+(?:وقل|قل|نصها|محتواها|بخصوص|عن|يقول|تقول)\b|$)/,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    const candidate = cleanNameFragment(match?.[1] || '');
    if (candidate) return candidate;
  }
  return '';
}

function convertAskClauseToDirectMessage(clause: string) {
  const normalized = cleanDraftMessage(clause)
    .replace(/[?؟]+$/g, '')
    .trim();

  const conversions: Array<[RegExp, string]> = [
    [/^(?:he|she|they)\s+is\s+/i, 'are you '],
    [/^(?:he|she|they)'s\s+/i, 'are you '],
    [/^(?:he|she|they)\s+are\s+/i, 'are you '],
    [/^(?:he|she|they)\s+was\s+/i, 'were you '],
    [/^(?:he|she|they)\s+were\s+/i, 'were you '],
    [/^(?:he|she|they)\s+will\s+/i, 'will you '],
    [/^(?:he|she|they)\s+would\s+/i, 'would you '],
    [/^(?:he|she|they)\s+can\s+/i, 'can you '],
    [/^(?:he|she|they)\s+could\s+/i, 'could you '],
    [/^(?:he|she|they)\s+has\s+/i, 'have you '],
    [/^(?:he|she|they)\s+have\s+/i, 'have you '],
    [/^(?:he|she|they)\s+had\s+/i, 'had you '],
    [/^(?:he|she|they)\s+did\s+/i, 'did you '],
    [/^(?:he|she|they)\s+sent\s+/i, 'did you send '],
    [/^(?:he|she|they)\s+received\s+/i, 'did you receive '],
  ];

  for (const [pattern, replacement] of conversions) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, replacement).trim();
    }
  }

  return normalized.replace(/^(?:he|she|they)\s+/i, '').trim();
}

function extractAskStyleDraftMessage(transcript: string) {
  const patterns = [
    /^(.*?)(?:\s+and\s+)?ask\s+(?:him|her|them)\s+(?:if|whether)\s+(.+)$/i,
    /^(.*?)(?:\s+and\s+)?ask\s+(?:him|her|them)\s+(.+)$/i,
    /^(.*?)(?:\s+and\s+)?check\s+if\s+(?:he|she|they)\s+(.+)$/i,
    /^(.*?)(?:\s+و)?\s*اسأ(?:له|ليها|لهم)\s+(?:إذا|اذا)\s+(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (!match) continue;
    const prefix = cleanDraftMessage(match[1] || '').replace(/[?؟]+$/g, '').trim();
    const directQuestion = convertAskClauseToDirectMessage(match[2] || '');
    if (!directQuestion) continue;
    const combined = prefix
      ? `${prefix.replace(/[،,]+$/g, '').trim()}, ${directQuestion}`
      : directQuestion;
    return cleanDraftMessage(combined);
  }

  return '';
}

function extractChatDraftMessage(transcript: string) {
  const quoted = extractQuotedText(transcript);
  if (quoted) return cleanDraftMessage(quoted);
  const askStyleDraft = extractAskStyleDraftMessage(transcript);
  if (askStyleDraft) return askStyleDraft;
  // IMPORTANT: do NOT match the bare word "message" here, because phrases like
  // "send a message to ..." would then capture the instructions as the draft.
  // Only capture what follows an explicit speech marker (say / saying / tell).
  const patterns = [
    /\b(?:saying|that says|that reads|tell(?:\s+(?:him|her|them))?|to say)\b\s+(.+)/i,
    /\b(?:and\s+)?say\b\s+(.+)/i,
    /\b(?:message|msg)\s+(?:saying|that says|that reads)\b\s+(.+)/i,
    /\bwith(?:\s+the)?\s+message\b\s+(.+)/i,
    /(?:وقل|قل له|قل لها|قل لهم|نصها|محتواها|رسالتها|يقول|تقول)\s+(.+)/,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    const candidate = cleanDraftMessage(match?.[1] || '');
    if (candidate) return candidate;
  }
  return '';
}

function cleanDraftMessage(value: string) {
  return trimSentence(value)
    .replace(/^[\s:،,-]+/, '')
    .replace(/[\s]+$/, '')
    .replace(/[.،,]+$/, '')
    .slice(0, 400)
    .trim();
}

function stripTaskTargetNoise(value: string) {
  return trimSentence(
    value
      .replace(/\b(my|the|task|tasks|reminder|reminders|item|items)\b/gi, ' ')
      .replace(/\b(مهمتي|المهمة|المهام|التذكير|التذكيرات|العنصر|العناصر)\b/g, ' ')
      .replace(/[.،,!?;:]+$/g, ' ')
  ).slice(0, 120);
}

function splitOperatorList(value: string) {
  return Array.from(new Set(
    value
      .replace(/\s+(?:and|&)\s+/gi, ',')
      .replace(/\s+و\s+/g, ',')
      .split(/[\n,;]+/)
      .map((item) => trimSentence(item))
      .filter(Boolean)
      .map((item) => item.slice(0, 120))
  ));
}

function extractTaskSubtasks(transcript: string) {
  const patterns = [
    /(?:add|create)\s+(?:these\s+)?subtasks?\s+(.+?)\s+(?:to|into|for)\s+(?:my\s+)?(.+?)\s+task\b/i,
    /(?:add|create)\s+(.+?)\s+(?:as\s+)?subtasks?\s+(?:to|into|for)\s+(?:my\s+)?(.+?)\s+task\b/i,
    /(?:أضف|اضف|أنشئ|انشئ)\s+(?:مهام\s+فرعية|مهمات\s+فرعية)\s+(.+?)\s+(?:إلى|الى|ل)\s+(.+?)\s+مهمة/,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    const subtaskChunk = trimSentence(match?.[1] || '');
    const targetTitle = stripTaskTargetNoise(match?.[2] || '');
    if (!subtaskChunk || !targetTitle) continue;
    const subtasks = splitOperatorList(subtaskChunk);
    if (subtasks.length > 0) {
      return { targetTitle, subtasks };
    }
  }

  return { targetTitle: '', subtasks: [] as string[] };
}

function extractTaskTargetTitle(transcript: string, action: WaktiOperatorTaskRequest['action']) {
  const patterns = action === 'complete'
    ? [
        /(?:mark|complete|finish)\s+(.+?)\s+(?:as\s+done|done|complete(?:d)?)\b/i,
        /(?:خل(?:ي|ّ)|كمّل|كمل|أنهِ|انهي|أنهِ|انهِ|تمم|تمّم)\s+(.+?)\s+(?:كمكتملة|مكتملة|منتهية|منجز(?:ة)?|تمت?)\b/,
      ]
    : action === 'snooze'
      ? [
          /(?:snooze|postpone|delay)\s+(?:my\s+)?(.+?)\s+reminder\b/i,
          /(?:أجل|اجل|أخّر|اخر)\s+(.+?)\s+تذكير/,
        ]
      : action === 'edit'
        ? [
            /(?:edit|update|change|move|rename|modify)\s+(?:my\s+)?(.+?)(?:\s+(?:task|reminder)\b|$)/i,
            /(?:عدّل|عدل|غيّر|غير|حدّث|حدث|انقل)\s+(.+?)(?:\s+(?:مهمة|تذكير)\b|$)/,
          ]
        : [
            /(?:task|reminder)\s+(.+?)$/i,
            /(?:مهمة|تذكير)\s+(.+)$/,
          ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    const candidate = stripTaskTargetNoise(match?.[1] || '');
    if (candidate) return candidate;
  }

  const quoted = stripTaskTargetNoise(extractQuotedText(transcript));
  if (quoted) return quoted;
  return '';
}

function extractSnoozeMinutes(transcript: string) {
  const relativeMinutes = extractRelativeMinutes(transcript);
  if (relativeMinutes) return relativeMinutes;
  if (/\b(one|an)\s+hour\b/i.test(transcript) || /ساعة\b/.test(transcript)) return 60;
  if (/\b(two)\s+hours\b/i.test(transcript) || /ساعت(?:ين|ان)\b/.test(transcript)) return 120;
  return 10;
}

function detectTaskAction(transcript: string): WaktiOperatorTaskRequest['action'] {
  if (/\b(add|create)\b[\s\S]*\bsubtasks?\b/i.test(transcript) || /\b(أضف|اضف|أنشئ|انشئ)\b[\s\S]*\b(مهام\s+فرعية|مهمات\s+فرعية)\b/.test(transcript)) {
    return 'add_subtasks';
  }
  if (/\b(mark|complete|finish)\b[\s\S]*\b(done|complete(?:d)?)\b/i.test(transcript) || /\b(كمّل|كمل|أنهِ|انهي|تمم|تمّم)\b/.test(transcript)) {
    return 'complete';
  }
  if (/\b(snooze|postpone|delay)\b/i.test(transcript) || /\b(أجل|اجل|أخّر|اخر)\b/.test(transcript)) {
    return 'snooze';
  }
  if (/\b(edit|update|change|move|rename|modify|reschedule)\b/i.test(transcript) || /\b(عدّل|عدل|غيّر|غير|حدّث|حدث|انقل)\b/.test(transcript)) {
    return 'edit';
  }
  return 'create';
}

function buildTaskOperatorRequest(transcript: string): WaktiOperatorTaskRequest {
  const action = detectTaskAction(transcript);
  const reminderIntent = detectReminderIntent(transcript) || action === 'snooze';
  if (action === 'add_subtasks') {
    const { targetTitle, subtasks } = extractTaskSubtasks(transcript);
    return {
      action,
      kind: 'task',
      targetTitle,
      subtasks,
    };
  }
  if (action === 'complete') {
    return {
      action,
      kind: reminderIntent ? 'reminder' : 'task',
      targetTitle: extractTaskTargetTitle(transcript, action),
    };
  }
  if (action === 'snooze') {
    return {
      action,
      kind: 'reminder',
      targetTitle: extractTaskTargetTitle(transcript, action),
      snoozeMinutes: extractSnoozeMinutes(transcript),
    };
  }
  if (action === 'edit') {
    return {
      action,
      kind: reminderIntent ? 'reminder' : 'task',
      targetTitle: extractTaskTargetTitle(transcript, action),
      taskDraft: reminderIntent ? undefined : buildTaskPrefill(transcript),
      reminderDraft: reminderIntent ? buildReminderPrefill(transcript) : undefined,
    };
  }
  return {
    action: 'create',
    kind: reminderIntent ? 'reminder' : 'task',
    taskDraft: reminderIntent ? undefined : buildTaskPrefill(transcript),
    reminderDraft: reminderIntent ? buildReminderPrefill(transcript) : undefined,
  };
}

const LANGUAGE_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'ar', pattern: /\b(arabic|العربية|عربي)\b/i },
  { code: 'en', pattern: /\b(english|الانجليزية|الإنجليزية|انجليزي|إنجليزي)\b/i },
  { code: 'fr', pattern: /\b(french|الفرنسية|فرنسي)\b/i },
  { code: 'es', pattern: /\b(spanish|الإسبانية|الاسبانية|اسباني|إسباني)\b/i },
  { code: 'de', pattern: /\b(german|الألمانية|الالمانية|ألماني|الماني)\b/i },
  { code: 'tr', pattern: /\b(turkish|التركية|تركي)\b/i },
  { code: 'it', pattern: /\b(italian|الإيطالية|الايطالية|إيطالي|ايطالي)\b/i },
  { code: 'ur', pattern: /\b(urdu|الأوردية|الاردية|اوردو)\b/i },
];

function extractTextTargetLanguage(transcript: string) {
  const match = LANGUAGE_PATTERNS.find((item) => item.pattern.test(transcript));
  return match?.code;
}

function extractVoiceTargetLanguage(transcript: string) {
  const patterns = [
    /(?:to|into)\s+(arabic|english|french|spanish|german|turkish|italian|urdu)\b/i,
    /(?:إلى|الى)\s+(العربية|عربي|الانجليزية|الإنجليزية|انجليزي|إنجليزي|الفرنسية|فرنسي|الإسبانية|الاسبانية|اسباني|إسباني|الألمانية|الالمانية|ألماني|الماني|التركية|تركي|الإيطالية|الايطالية|إيطالي|ايطالي|الأوردية|الاردية|اوردو)\b/,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (!match?.[1]) continue;
    const languageCode = LANGUAGE_PATTERNS.find((item) => item.pattern.test(match[1] || ''))?.code;
    if (languageCode) return languageCode;
  }
  return extractTextTargetLanguage(transcript);
}

function extractVoiceSpokenLanguage(transcript: string) {
  const patterns = [
    /(?:from|spoken in)\s+(arabic|english|french|spanish|german|turkish|italian|urdu)\b/i,
    /(?:من|باللغة)\s+(العربية|عربي|الانجليزية|الإنجليزية|انجليزي|إنجليزي|الفرنسية|فرنسي|الإسبانية|الاسبانية|اسباني|إسباني|الألمانية|الالمانية|ألماني|الماني|التركية|تركي|الإيطالية|الايطالية|إيطالي|ايطالي|الأوردية|الاردية|اوردو)\b/,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (!match?.[1]) continue;
    const languageCode = LANGUAGE_PATTERNS.find((item) => item.pattern.test(match[1] || ''))?.code;
    if (languageCode) return languageCode;
  }
  return undefined;
}

function extractVoicePreferredVoice(transcript: string) {
  if (/\b(male|man|masculine|ذكر|رجالي)\b/i.test(transcript)) return 'cedar' as const;
  if (/\b(female|woman|feminine|أنثى|نسائي)\b/i.test(transcript)) return 'marin' as const;
  return undefined;
}

function stripVoiceRequestLanguage(transcript: string) {
  return trimSentence(
    transcript
      .replace(/\b(can you|please|could you|would you|inside wakti|in wakti|using wakti|with wakti|for me)\b/gi, ' ')
      .replace(/\b(text to speech|tts|read aloud|say this|speak this|voice this|turn this into speech|turn into speech|convert to speech|live translator|voice translator|speech translator|clone my voice|voice clone|tasjeel|voice studio|audio)\b/gi, ' ')
      .replace(/\b(حول هذا إلى صوت|حوّل هذا إلى صوت|حول النص إلى كلام|حوّل النص إلى كلام|نص إلى كلام|ترجمة صوتية|مترجم صوتي|استنساخ الصوت|استنسخ صوتي|تسجيل|استوديو الصوت|صوت)\b/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function extractVoiceTtsText(transcript: string) {
  const quoted = extractQuotedText(transcript);
  if (quoted) return quoted.slice(0, 800);
  const patterns = [
    /(?:read|say|speak|narrate|voice|convert|turn)\s+(?:this|the following)?\s*(?:text)?\s*(?:out loud|aloud|into speech|to speech)?\s*[:\-]?\s+(.+)/i,
    /(?:اقرأ|اقرا|انطق|قول|حوّل|حول)\s+(?:هذا|النص|الجملة)?\s*(?:إلى صوت|الى صوت|كصوت)?\s*[:\-]?\s+(.+)/,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    const candidate = cleanDraftMessage(match?.[1] || '');
    if (candidate) return candidate.slice(0, 800);
  }
  return stripVoiceRequestLanguage(transcript).slice(0, 800);
}

function inferVoiceToolTab(transcript: string): WaktiOperatorVoiceRequest['tab'] {
  if (/\b(tasjeel|record|recording|transcribe|transcription|voice note|voice memo|تسجيل|سجل|سجّل|نسخ صوتي|تفريغ)\b/i.test(transcript)) return 'tasjeel';
  if (/\b(clone my voice|voice clone|cloned voice|استنساخ الصوت|استنسخ صوتي)\b/i.test(transcript)) return 'clone';
  if (/\b(live translator|voice translator|speech translator|ترجمة صوتية|مترجم صوتي|ترجم صوتي|ترجم كلامي)\b/i.test(transcript)) return 'live-translator';
  return 'tts';
}

function buildVoiceToolRequest(transcript: string): WaktiOperatorVoiceRequest {
  const tab = inferVoiceToolTab(transcript);
  if (tab === 'live-translator') {
    return {
      tab,
      targetLanguage: extractVoiceTargetLanguage(transcript),
      spokenLanguage: extractVoiceSpokenLanguage(transcript),
      voice: extractVoicePreferredVoice(transcript),
    };
  }
  if (tab === 'tts') {
    const text = extractVoiceTtsText(transcript);
    return {
      tab,
      text,
      autoGenerate: Boolean(text),
    };
  }
  return { tab };
}

function stripMaw3dRequestLanguage(transcript: string) {
  return trimSentence(
    transcript
      .replace(/\b(can you|please|could you|would you|inside wakti|in wakti|using wakti|with wakti|for me)\b/gi, ' ')
      .replace(/\b(create|make|plan|organize|prepare|set up|open|draft|new)\b/gi, ' ')
      .replace(/\b(event|invite|invitation|party|gathering|rsvp|maw3d)\b/gi, ' ')
      .replace(/\b(أنشئ|انشئ|سوي|سو|جهز|جهّز|رتب|افتح|حدث|دعوة|دعوة|حفلة|مناسبة|موعد)\b/g, ' ')
      .replace(/\b(public|private)\b/gi, ' ')
      .replace(/\b(عام|خاص)\b/g, ' ')
      .replace(/\b(today|tomorrow|tonight|next week|next month)\b/gi, ' ')
      .replace(/\b(اليوم|بكرة|غداً|غدا|الليلة|الأسبوع القادم|الشهر القادم)\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
      .replace(/\b\d{1,2}\s*(am|pm)\b/gi, ' ')
      .replace(/\s+/g, ' ')
  );
}

function extractMaw3dTitle(transcript: string) {
  const quoted = extractQuotedText(transcript);
  if (quoted) return quoted.slice(0, 120);
  const named = transcript.match(/(?:called|named|titled)\s+(.+?)(?=\s+(?:on|at|in|for)\b|$)/i)
    || transcript.match(/(?:بعنوان|اسمها|اسمه)\s+(.+?)(?=\s+(?:في|على|الساعة|يوم)\b|$)/);
  if (named?.[1]) return trimSentence(named[1]).slice(0, 120);
  return stripMaw3dRequestLanguage(transcript).slice(0, 120);
}

function extractMaw3dLocation(transcript: string) {
  const match = transcript.match(/\b(?:at|in)\s+(.+?)(?=\s+(?:on|tomorrow|today|next|at\s+\d|for|called|named)\b|$)/i)
    || transcript.match(/(?:في|بـ|ب)\s+(.+?)(?=\s+(?:يوم|غداً|غدا|بكرة|الساعة|على|بعنوان)\b|$)/);
  const candidate = trimSentence(match?.[1] || '');
  return candidate.slice(0, 120);
}

function extractMaw3dOrganizer(transcript: string) {
  const match = transcript.match(/(?:hosted by|organizer|organized by)\s+(.+?)(?=\s+(?:on|at|in|for)\b|$)/i)
    || transcript.match(/(?:من تنظيم|المنظم|بواسطة)\s+(.+?)(?=\s+(?:في|على|الساعة|يوم)\b|$)/);
  const candidate = trimSentence(match?.[1] || '');
  return candidate.slice(0, 120);
}

function detectMaw3dAllDay(transcript: string) {
  return /\b(all day|all-day)\b/i.test(transcript) || /\b(طوال اليوم|كامل اليوم)\b/.test(transcript);
}

function detectMaw3dPublic(transcript: string) {
  if (/\b(private|invite only|invitation only)\b/i.test(transcript) || /\b(خاص|للمدعوين فقط)\b/.test(transcript)) return false;
  if (/\b(public|open to everyone)\b/i.test(transcript) || /\b(عام|مفتوح للجميع)\b/.test(transcript)) return true;
  return true;
}

function buildMaw3dOperatorRequest(transcript: string): WaktiOperatorMaw3dRequest {
  const isAllDay = detectMaw3dAllDay(transcript);
  return {
    action: 'create',
    title: extractMaw3dTitle(transcript),
    organizer: extractMaw3dOrganizer(transcript),
    location: extractMaw3dLocation(transcript),
    eventDate: resolveOperatorDate(transcript),
    startTime: isAllDay ? undefined : extractTimeString(transcript),
    endTime: undefined,
    isAllDay,
    isPublic: detectMaw3dPublic(transcript),
  };
}

function stripProjectsRequestLanguage(transcript: string) {
  return trimSentence(
    transcript
      .replace(/\b(can you|please|could you|would you|inside wakti|in wakti|using wakti|with wakti|for me)\b/gi, ' ')
      .replace(/\b(build|create|make|generate|design|develop|start|open|launch)\b/gi, ' ')
      .replace(/\b(project|projects|website|site|web app|app|landing page|portfolio|dashboard)\b/gi, ' ')
      .replace(/\b(أنشئ|انشئ|ابني|ابنِ|سوي|سو|صمم|طوّر|طور|ابدأ|افتح|مشروع|موقع|تطبيق|لوحة تحكم|صفحة هبوط)\b/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function buildProjectOperatorRequest(transcript: string): WaktiOperatorProjectRequest {
  const quoted = extractQuotedText(transcript);
  const prompt = (quoted || trimSentence(
    transcript
      .replace(/\b(inside wakti|in wakti|using wakti|with wakti|for me)\b/gi, ' ')
      .replace(/\s+/g, ' ')
  ) || stripProjectsRequestLanguage(transcript)).slice(0, 1400);
  return {
    action: 'create',
    prompt,
    tab: 'coder',
  };
}

function detectSocialPublishIntent(transcript: string) {
  return /\b(post|publish|caption|instagram|reel|story|tweet|facebook|tiktok|social media|نشر|منشور|كابشن|انستغرام|ريل|ستوري|تيك توك|فيسبوك)\b/i.test(transcript);
}

function buildSocialOperatorRequest(transcript: string): WaktiOperatorSocialRequest {
  if (/\b(my gallery|gallery|photos?|images?|معرضي|المعرض|الصور)\b/i.test(transcript)) {
    return { section: 'gallery' };
  }
  if (/\b(group chat|groups?|المجموعات|مجموعة|قروبات)\b/i.test(transcript)) {
    return { section: 'contacts', tab: 'groups' };
  }
  if (/\b(requests?|friend requests?|طلبات|طلبات الصداقة)\b/i.test(transcript)) {
    return { section: 'contacts', tab: 'requests' };
  }
  if (/\b(blocked|blocked users|المحظورين|المحظورون|محظور)\b/i.test(transcript)) {
    return { section: 'contacts', tab: 'blocked' };
  }
  if (/\b(contact list|contacts list|friends list|list view|جهات الاتصال|الأصدقاء|قائمة)\b/i.test(transcript)) {
    return { section: 'contacts', tab: 'contacts', view: 'contacts' };
  }
  if (/\b(cards?|بطاقات)\b/i.test(transcript)) {
    return { section: 'contacts', tab: 'contacts', view: 'cards' };
  }
  return { section: 'contacts', tab: 'contacts', view: 'cards' };
}

function buildSocialOperatorHref(payloadId: string, social: WaktiOperatorSocialRequest) {
  const params = new URLSearchParams();
  params.set('waktiOperator', payloadId);
  params.set('section', social.section);
  if (social.section === 'contacts') {
    params.set('tab', social.tab || 'contacts');
    if ((social.tab || 'contacts') === 'contacts' && social.view) {
      params.set('view', social.view);
    }
  }
  return `/social?${params.toString()}`;
}

function getSocialRequestLabel(social: WaktiOperatorSocialRequest, language: 'ar' | 'en') {
  if (social.section === 'gallery') return language === 'ar' ? 'افتح معرضي' : 'Open My Gallery';
  if (social.tab === 'groups') return language === 'ar' ? 'افتح مجموعات سوشيال' : 'Open Social groups';
  if (social.tab === 'requests') return language === 'ar' ? 'افتح طلبات التواصل' : 'Open contact requests';
  if (social.tab === 'blocked') return language === 'ar' ? 'افتح المحظورين' : 'Open blocked users';
  if (social.view === 'contacts') return language === 'ar' ? 'افتح قائمة جهات الاتصال' : 'Open contacts list';
  return language === 'ar' ? 'افتح بطاقات التواصل' : 'Open social contacts cards';
}

function buildGameOperatorRequest(transcript: string): WaktiOperatorGameRequest {
  if (/\b(chess|شطرنج)\b/i.test(transcript)) return { screen: 'chess' };
  if (/\b(tic[ -]?tac[ -]?toe|x-?o|إكس-أو|اكس-او|إكس او|اكس او)\b/i.test(transcript)) return { screen: 'tictactoe' };
  if (/\b(solitaire|سوليتير)\b/i.test(transcript)) return { screen: 'solitaire' };
  if (/\b(letters|letters game|حروف|الحروف)\b/i.test(transcript)) return { screen: 'letters' };
  return { screen: 'home' };
}

function buildGameOperatorHref(payloadId: string, game: WaktiOperatorGameRequest) {
  const params = new URLSearchParams();
  params.set('waktiOperator', payloadId);
  params.set('screen', game.screen);
  return `/games?${params.toString()}`;
}

function getGameRequestLabel(game: WaktiOperatorGameRequest, language: 'ar' | 'en') {
  if (game.screen === 'chess') return language === 'ar' ? 'افتح الشطرنج' : 'Open Chess';
  if (game.screen === 'tictactoe') return language === 'ar' ? 'افتح إكس-أو' : 'Open Tic-Tac-Toe';
  if (game.screen === 'solitaire') return language === 'ar' ? 'افتح سوليتير' : 'Open Solitaire';
  if (game.screen === 'letters') return language === 'ar' ? 'افتح لعبة الحروف' : 'Open Letters';
  return language === 'ar' ? 'افتح الألعاب' : 'Open Games';
}

function buildVitalityOperatorRequest(transcript: string): WaktiOperatorVitalityRequest {
  if (/\b(healthkit|apple health|ابل هيلث|أبل هيلث|صحة آبل|صحة ابل)\b/i.test(transcript)) {
    return { dataSource: 'healthkit' };
  }
  return { dataSource: 'whoop' };
}

function buildVitalityOperatorHref(payloadId: string, vitality: WaktiOperatorVitalityRequest) {
  const params = new URLSearchParams();
  params.set('waktiOperator', payloadId);
  params.set('source', vitality.dataSource);
  return `/fitness?${params.toString()}`;
}

function getVitalityRequestLabel(vitality: WaktiOperatorVitalityRequest, language: 'ar' | 'en') {
  return vitality.dataSource === 'healthkit'
    ? (language === 'ar' ? 'افتح HealthKit' : 'Open HealthKit')
    : (language === 'ar' ? 'افتح WHOOP' : 'Open WHOOP');
}

function stripTranslationLanguage(text: string) {
  return trimSentence(
    text
      .replace(/\b(to|into)\s+(arabic|english|french|spanish|german|turkish|italian|urdu)\b/gi, ' ')
      .replace(/\b(إلى|الى)\s+(العربية|عربي|الانجليزية|الإنجليزية|انجليزي|إنجليزي|الفرنسية|فرنسي|الإسبانية|الاسبانية|اسباني|إسباني|الألمانية|الالمانية|ألماني|الماني|التركية|تركي|الإيطالية|الايطالية|إيطالي|ايطالي|الأوردية|الاردية|اوردو)\b/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function inferTextToolTab(transcript: string): SmartTextPrefillTab {
  if (/\b(translate|translation|translator|ترجم|ترجمة|مترجم)\b/i.test(transcript)) return 'translate';
  if (/\b(diagram|flowchart|flow chart|mind map|schema|chart|مخطط|رسم بياني|خريطة ذهنية)\b/i.test(transcript)) return 'diagrams';
  if (/\b(presentation|slides|slide deck|powerpoint|deck|عرض تقديمي|شرائح|برزنتيشن|عرض)\b/i.test(transcript)) return 'presentation';
  if (/\b(a4|document|letter|report|proposal|essay|contract|invoice|مستند|وثيقة|تقرير|خطاب|رسالة رسمية)\b/i.test(transcript)) return 'a4';
  if (/\b(reply|respond|response|رد|جاوب|رد على|ردّ على)\b/i.test(transcript)) return 'reply';
  return 'compose';
}

function detectTextContentType(transcript: string) {
  if (/\b(email|mail|gmail|بريد|ايميل)\b/i.test(transcript)) return 'email';
  if (/\b(text message|sms|رسالة نصية)\b/i.test(transcript)) return 'text_message';
  if (/\b(message|رسالة)\b/i.test(transcript)) return 'message';
  if (/\b(summarize|summary|summarise|تلخيص|لخص|لخّص)\b/i.test(transcript)) return 'summarize';
  return 'auto';
}

function extractTextReplySource(transcript: string) {
  const quoted = extractQuotedText(transcript);
  if (quoted) return quoted.slice(0, 800);
  const patterns = [
    /(?:reply|respond)(?:\s+to)?\s+(?:this|the following|following)?\s*[:\-]?\s*(.+)/i,
    /(?:رد|جاوب)(?:\s+على)?\s*(?:هذا|التالي)?\s*[:\-]?\s*(.+)/,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    const candidate = trimSentence(match?.[1] || '');
    if (candidate) return candidate.slice(0, 800);
  }
  return '';
}

function extractTextRequestTopic(transcript: string) {
  const quoted = extractQuotedText(transcript);
  if (quoted) return quoted.slice(0, 800);
  const cleaned = stripTextRequestLanguage(transcript);
  return (cleaned || transcript).slice(0, 800).trim();
}

function inferA4ThemeId(transcript: string) {
  if (/\b(resume|cv|curriculum vitae|سيرة ذاتية)\b/i.test(transcript)) return 'resume_cv';
  if (/\b(invoice|receipt|فاتورة|إيصال)\b/i.test(transcript)) return 'invoice_receipt';
  if (/\b(menu|price list|restaurant menu|cafe menu|منيو|قائمة أسعار)\b/i.test(transcript)) return 'menu_price_list';
  if (/\b(certificate|diploma|award|completion certificate|شهادة|دبلوم|جائزة)\b/i.test(transcript)) return 'certificate';
  if (/\b(invitation|invite card|thank you card|دعوة|بطاقة شكر)\b/i.test(transcript)) return 'thank_you_invitation_card';
  if (/\b(event flyer|event poster|flyer|poster|ملصق|منشور فعالية)\b/i.test(transcript)) return 'event_flyer';
  if (/\b(letter|notice|announcement|report|brief|proposal|خطاب|إعلان|تقرير|موجز)\b/i.test(transcript)) return 'clean_minimal';
  return undefined;
}

function inferA4PurposeId(transcript: string, themeId?: string) {
  if (!themeId) return undefined;
  if (themeId === 'resume_cv') {
    if (/\b(student|school|طالب|مدرسة)\b/i.test(transcript)) return 'student_cv';
    if (/\b(graduate|fresh grad|خريج)\b/i.test(transcript)) return 'graduate_cv';
    if (/\b(professional|job|work|career|مهني|وظيفة|عمل)\b/i.test(transcript)) return 'professional_cv';
  }
  if (themeId === 'invoice_receipt') {
    if (/\b(receipt|إيصال)\b/i.test(transcript)) return 'receipt';
    if (/\b(invoice|فاتورة)\b/i.test(transcript)) return 'invoice';
  }
  if (themeId === 'certificate') {
    if (/\b(training|course|ورشة|تدريب|دورة)\b/i.test(transcript)) return 'training';
    if (/\b(award|achievement|prize|جائزة|إنجاز)\b/i.test(transcript)) return 'achievement_award';
    if (/\b(completion|completed|إتمام|اكمال|إكمال)\b/i.test(transcript)) return 'completion';
    if (/\b(academic|school|university|أكاديمي|مدرسة|جامعة)\b/i.test(transcript)) return 'academic';
  }
  if (themeId === 'thank_you_invitation_card') {
    if (/\b(invitation|invite|دعوة)\b/i.test(transcript)) return 'invitation';
    if (/\b(thank\s*you|thanks|شكر)\b/i.test(transcript)) return 'thank_you';
  }
  if (themeId === 'clean_minimal') {
    if (/\b(letter|خطاب)\b/i.test(transcript)) return 'letter';
    if (/\b(notice|announcement|إعلان)\b/i.test(transcript)) return 'notice';
    if (/\b(flyer|poster|ملصق)\b/i.test(transcript)) return 'flyer';
    if (/\b(report|brief|proposal|تقرير|موجز)\b/i.test(transcript)) return 'report';
  }
  if (themeId === 'event_flyer') {
    if (/\b(school|school event|مدرسة|مدرسي)\b/i.test(transcript)) return 'school';
    if (/\b(work|office|company|corporate|عمل|شركة)\b/i.test(transcript)) return 'work';
    if (/\b(personal|birthday|party|شخصي|حفلة|عيد ميلاد)\b/i.test(transcript)) return 'personal';
  }
  return undefined;
}

function inferA4InputMode(transcript: string, sourceText: string) {
  if (/\b(idea|concept|rough idea|just an idea|brainstorm|فكرة|تصور|مبدئي)\b/i.test(transcript) && sourceText.length <= 240) {
    return 'idea' as const;
  }
  return 'content_ready' as const;
}

function buildTextToolRequest(transcript: string): WaktiOperatorTextRequest {
  const tab = inferTextToolTab(transcript);
  if (tab === 'reply') {
    const originalMessage = extractTextReplySource(transcript);
    return {
      tab,
      prefill: {
        tab,
        originalMessage,
      },
    };
  }
  if (tab === 'translate') {
    const sourceText = stripTranslationLanguage(extractTextRequestTopic(transcript));
    return {
      tab,
      prefill: {
        tab,
      },
      bridge: {
        tab,
        sourceText,
        targetLanguage: extractTextTargetLanguage(transcript),
      },
    };
  }
  if (tab === 'diagrams') {
    const sourceText = extractTextRequestTopic(transcript);
    return {
      tab,
      prefill: {
        tab,
      },
      bridge: {
        tab,
        sourceText,
        prompt: sourceText,
      },
    };
  }
  if (tab === 'presentation') {
    const topic = extractTextRequestTopic(transcript);
    return {
      tab,
      prefill: {
        tab,
      },
      bridge: {
        tab,
        topic,
        prompt: topic,
      },
    };
  }
  if (tab === 'compose') {
    return {
      tab,
      prefill: {
        tab,
        topic: extractTextRequestTopic(transcript),
        contentType: detectTextContentType(transcript),
      },
    };
  }
  if (tab === 'a4') {
    const sourceText = extractTextRequestTopic(transcript);
    const a4ThemeId = inferA4ThemeId(transcript);
    const a4PurposeId = inferA4PurposeId(transcript, a4ThemeId);
    const a4InputMode = inferA4InputMode(transcript, sourceText);
    return {
      tab,
      prefill: {
        tab,
      },
      bridge: {
        tab,
        sourceText,
        prompt: sourceText,
        a4ThemeId,
        a4PurposeId,
        a4InputMode,
      },
    };
  }
  return {
    tab,
    prefill: {
      tab,
    },
  };
}

function extractTimeString(transcript: string) {
  const direct = transcript.match(/\b(\d{1,2}:\d{2})\b/);
  if (direct?.[1]) return direct[1].padStart(5, '0');

  const twelveHour = transcript.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (twelveHour) {
    let hours = Number.parseInt(twelveHour[1], 10);
    const period = twelveHour[2].toLowerCase();
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:00`;
  }

  const arabic = transcript.match(/(\d{1,2})\s*(صباحاً|صباحا|مساءً|مساء|ص|م)/);
  if (arabic) {
    let hours = Number.parseInt(arabic[1], 10);
    const marker = arabic[2];
    if ((marker === 'م' || marker.includes('مساء')) && hours < 12) hours += 12;
    if ((marker === 'ص' || marker.includes('صباح')) && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:00`;
  }

  return undefined;
}

function resolveOperatorDate(transcript: string) {
  const now = new Date();
  const lower = transcript.toLowerCase();
  const explicitIso = transcript.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicitIso?.[1]) return explicitIso[1];

  const explicitSlash = transcript.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (explicitSlash) {
    const month = Number.parseInt(explicitSlash[1], 10) - 1;
    const day = Number.parseInt(explicitSlash[2], 10);
    const year = explicitSlash[3]
      ? Number.parseInt(explicitSlash[3].length === 2 ? `20${explicitSlash[3]}` : explicitSlash[3], 10)
      : now.getFullYear();
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  if (/\b(today|tonight|اليوم|الليلة)\b/i.test(transcript)) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (/\b(tomorrow|بكرة|غداً|غدا)\b/i.test(transcript)) {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  }

  const weekdays: Array<{ pattern: RegExp; day: number }> = [
    { pattern: /\b(next\s+)?monday\b/i, day: 1 },
    { pattern: /\b(next\s+)?tuesday\b/i, day: 2 },
    { pattern: /\b(next\s+)?wednesday\b/i, day: 3 },
    { pattern: /\b(next\s+)?thursday\b/i, day: 4 },
    { pattern: /\b(next\s+)?friday\b/i, day: 5 },
    { pattern: /\b(next\s+)?saturday\b/i, day: 6 },
    { pattern: /\b(next\s+)?sunday\b/i, day: 0 },
    { pattern: /\bالاثنين\b/, day: 1 },
    { pattern: /\bالثلاثاء\b/, day: 2 },
    { pattern: /\bالأربعاء\b|\bالاربعاء\b/, day: 3 },
    { pattern: /\bالخميس\b/, day: 4 },
    { pattern: /\bالجمعة\b/, day: 5 },
    { pattern: /\bالسبت\b/, day: 6 },
    { pattern: /\bالأحد\b|\bالاحد\b/, day: 0 },
  ];

  const weekday = weekdays.find((item) => item.pattern.test(lower) || item.pattern.test(transcript));
  if (weekday) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = date.getDay();
    let offset = (weekday.day - currentDay + 7) % 7;
    if (offset === 0 || /\bnext\b/i.test(transcript) || /القادم|الجاية|الجاي/.test(transcript)) {
      offset = offset === 0 ? 7 : offset;
    }
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  return undefined;
}

function detectCalendarAction(transcript: string): WaktiOperatorCalendarRequest['action'] {
  if (/\b(week view|month view|year view|switch to week|switch to month|switch to year|show week|show month|show year)\b/i.test(transcript) || /\b(عرض أسبوعي|عرض شهري|عرض سنوي|حول إلى الأسبوع|حول إلى الشهر|حول إلى السنة)\b/.test(transcript)) {
    return 'change_view';
  }
  if (/\b(add|create|new)\b[\s\S]*\b(note|calendar note)\b/i.test(transcript) || /\b(أضف|اضف|أنشئ|انشئ)\b[\s\S]*\b(ملاحظة|مذكرة)\b/.test(transcript)) {
    return 'create_note';
  }
  if (/\b(edit|update|change|move)\b[\s\S]*\b(note)\b/i.test(transcript) || /\b(عدّل|عدل|غيّر|غير|حدّث|حدث)\b[\s\S]*\b(ملاحظة|مذكرة)\b/.test(transcript)) {
    return 'edit_note';
  }
  return 'open_date';
}

function extractCalendarView(transcript: string): 'month' | 'week' | 'year' | undefined {
  if (/\bweek\b/i.test(transcript) || /\bأسبوع|اسبوع\b/.test(transcript)) return 'week';
  if (/\byear\b/i.test(transcript) || /\bسنة|سنوي\b/.test(transcript)) return 'year';
  if (/\bmonth\b/i.test(transcript) || /\bشهر|شهري\b/.test(transcript)) return 'month';
  return undefined;
}

function extractCalendarNoteTitle(transcript: string) {
  const quoted = extractQuotedText(transcript);
  if (quoted) return quoted.slice(0, 120);
  const named = transcript.match(/(?:called|named|titled)\s+(.+)/i) || transcript.match(/(?:اسمها|اسمها|بعنوان)\s+(.+)/);
  if (named?.[1]) return trimSentence(named[1]).slice(0, 120);
  const stripped = trimSentence(
    transcript
      .replace(/\b(add|create|new|edit|update|change|calendar|note|open|switch|week|month|year|for|on|at|called|named|titled)\b/gi, ' ')
      .replace(/\b(أضف|اضف|أنشئ|انشئ|عدّل|عدل|غيّر|غير|التقويم|ملاحظة|افتح|حوّل|حول|أسبوع|اسبوع|شهر|سنة|يوم|الساعة|بعنوان)\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
      .replace(/\s+/g, ' ')
  );
  return stripped.slice(0, 120);
}

function extractCalendarEditTarget(transcript: string) {
  const match = transcript.match(/(?:note|calendar note)\s+(.+?)(?=\s+(?:to|at|for)\b|$)/i) || transcript.match(/(?:ملاحظة|مذكرة)\s+(.+?)(?=\s+(?:إلى|الى|في|على)\b|$)/);
  const candidate = trimSentence(match?.[1] || extractQuotedText(transcript));
  return candidate.slice(0, 120);
}

function buildCalendarOperatorRequest(transcript: string): WaktiOperatorCalendarRequest {
  const action = detectCalendarAction(transcript);
  return {
    action,
    date: resolveOperatorDate(transcript),
    view: extractCalendarView(transcript),
    targetTitle: action === 'edit_note' ? extractCalendarEditTarget(transcript) : undefined,
    title: action === 'create_note' ? extractCalendarNoteTitle(transcript) : undefined,
    time: extractTimeString(transcript),
  };
}

function getTextToolTabLabel(tab: SmartTextPrefillTab, language: 'ar' | 'en') {
  const labels = {
    compose: language === 'ar' ? 'التأليف' : 'Compose',
    reply: language === 'ar' ? 'الرد' : 'Reply',
    generated: language === 'ar' ? 'النص المولد' : 'Generated',
    diagrams: language === 'ar' ? 'المخططات' : 'Diagrams',
    presentation: language === 'ar' ? 'العروض' : 'Presentations',
    translate: language === 'ar' ? 'الترجمة' : 'Translate',
    a4: language === 'ar' ? 'مستند A4' : 'A4 Document',
  } as const;
  return labels[tab];
}

function getVoiceToolTabLabel(tab: WaktiOperatorVoiceRequest['tab'], language: 'ar' | 'en') {
  const labels = {
    tts: language === 'ar' ? 'تحويل النص إلى كلام' : 'Text to Speech',
    'live-translator': language === 'ar' ? 'المترجم الفوري' : 'Live Translator',
    clone: language === 'ar' ? 'استنساخ الصوت' : 'Voice Clone',
    tasjeel: language === 'ar' ? 'تسجيل' : 'Tasjeel',
  } as const;
  return labels[tab];
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
  const intentAnalysis = analyzeWaktiOperatorIntent(normalized);
  const matchedCapability = intentAnalysis.capability;

  // Detect real, do-it-now requests up front. These mirror the execution
  // builders at the bottom of this function. We compute them early so the
  // capability-guidance gate and the section-routing blocks below can step
  // aside whenever the user actually asked Wakti to DO something.
  const isExecutionLikeIntent = intentAnalysis.kind === 'execution' || intentAnalysis.kind === 'mixed';
  const wantsImage = /(image|picture|photo|poster|logo|thumbnail|cover|صورة|بوستر|شعار)/i.test(normalized);
  const wantsMusic = /(music|song|track|beat|jingle|anthem|أغنية|موسيقى|مقطع)/i.test(normalized);
  const wantsEmail = matchedCapability?.id === 'email' || /(email|mail|gmail|بريد|ايميل)/i.test(normalized) || extractEmailAddresses(normalized).length > 0;
  const wantsTasks = /(task|todo|to do|remind|reminder|schedule|مهمة|تذكير|ذكرني|رتب)/i.test(normalized);
  const wantsContactsChat = matchedCapability?.id === 'contacts_chat' || /\b(contact|contacts|chat|dm|direct message|conversation|group chat|جهات الاتصال|جهة الاتصال|دردشة|محادثة)\b/i.test(normalized);
  const wantsTextTools = matchedCapability?.id === 'text_tools' || /\b(write|rewrite|reply|respond|translate|translation|diagram|presentation|summarize|document|a4|compose|text tools|text generator|اكتب|أكتب|إعادة صياغة|اعادة صياغة|رد|جاوب|ترجم|ترجمة|مخطط|عرض|مستند|لخص|لخّص)\b/i.test(normalized);
  const wantsVoice = matchedCapability?.id === 'voice_studio' || /\b(voice|speech|audio|tts|text to speech|read aloud|say this|speak this|voice clone|clone my voice|live translator|voice translator|tasjeel|صوت|صوتي|نطق|اقرأ بصوت|تحويل النص إلى كلام|استنساخ الصوت|تسجيل|مترجم صوتي|ترجمة صوتية)\b/i.test(normalized);
  const wantsMaw3d = matchedCapability?.id === 'maw3d' || /\b(maw3d|event|invite|invitation|rsvp|party|gathering|celebration|birthday|meeting invite|حدث|دعوة|دعوة مناسبة|حفلة|تجمع|مناسبة)\b/i.test(normalized);
  const wantsProjects = matchedCapability?.id === 'projects' || /\b(project|projects|website|site|web app|landing page|portfolio|dashboard|build app|build website|create website|create app|مشروع|موقع|تطبيق|صفحة هبوط|بورتفوليو|لوحة تحكم)\b/i.test(normalized);
  const wantsCalendar = matchedCapability?.id === 'calendar' || /\b(calendar|agenda|date|day view|week view|month view|year view|note)\b/i.test(normalized) || /\b(التقويم|موعد|مواعيد|أسبوع|اسبوع|شهر|سنة|ملاحظة)\b/.test(normalized);
  const hasDirectExecution = isExecutionLikeIntent && (
    wantsImage || wantsMusic || wantsEmail || wantsTasks || wantsContactsChat ||
    wantsTextTools || wantsVoice || wantsMaw3d || wantsProjects || wantsCalendar
  );

  if (matchedCapability && shouldPreferGuidanceFlow(normalized, intentAnalysis.kind)) {
    return buildCapabilityGuidancePlan(normalized, language, matchedCapability);
  }

  if (matchedCapability?.id === 'social' && !hasDirectExecution && (intentAnalysis.kind === 'navigation' || intentAnalysis.kind === 'execution' || intentAnalysis.kind === 'mixed')) {
    if (detectSocialPublishIntent(normalized)) {
      return buildCapabilityGuidancePlan(normalized, language, matchedCapability, true);
    }

    const planId = createId('plan');
    const openStepId = createId('step');
    const handoffStepId = createId('step');
    const social = buildSocialOperatorRequest(normalized);
    const socialPayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير قسم سوشيال المطلوب' : 'Preparing the requested Social section',
      stepRefs: {
        openStepId,
        handoffStepId,
      },
      social,
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(socialPayload);
    const requestLabel = getSocialRequestLabel(social, language);

    return {
      id: planId,
      transcript: normalized,
      mode: 'execution',
      summary: language === 'ar'
        ? 'سأفتح القسم الصحيح داخل سوشيال.'
        : 'I will open the right section inside Social.',
      steps: [
        {
          id: openStepId,
          kind: 'open_social',
          label: language === 'ar' ? 'افتح سوشيال' : 'Open Social',
          description: language === 'ar' ? 'أنتقل إلى صفحة سوشيال داخل وكتي.' : 'Navigate to the Social page inside Wakti.',
          risk: 'safe',
          status: 'pending',
          href: buildSocialOperatorHref(payloadId, social),
          payloadId,
        },
        {
          id: handoffStepId,
          kind: 'prepare_social_request',
          label: requestLabel,
          description: requestLabel,
          risk: 'safe',
          status: 'pending',
          payloadId,
        },
      ],
    };
  }

  const wantsGamesCapability = matchedCapability?.id === 'games';
  const wantsGamesByText = /\b(game|games|play chess|play tic tac toe|play x o|play solitaire|play letters|chess|tic[ -]?tac[ -]?toe|solitaire|letters game|لعبة|الألعاب|شطرنج|إكس-أو|اكس-او|سوليتير|الحروف)\b/i.test(normalized);
  if ((wantsGamesCapability || wantsGamesByText) && !hasDirectExecution && (intentAnalysis.kind === 'navigation' || intentAnalysis.kind === 'execution' || intentAnalysis.kind === 'mixed')) {
    const planId = createId('plan');
    const openStepId = createId('step');
    const handoffStepId = createId('step');
    const game = buildGameOperatorRequest(normalized);
    const gamePayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير شاشة اللعبة المطلوبة' : 'Preparing the requested game screen',
      stepRefs: {
        openStepId,
        handoffStepId,
      },
      game,
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(gamePayload);
    const requestLabel = getGameRequestLabel(game, language);

    return {
      id: planId,
      transcript: normalized,
      mode: 'execution',
      summary: language === 'ar'
        ? 'سأفتح اللعبة الصحيحة داخل الألعاب.'
        : 'I will open the right game inside Games.',
      steps: [
        {
          id: openStepId,
          kind: 'open_games',
          label: language === 'ar' ? 'افتح الألعاب' : 'Open Games',
          description: language === 'ar' ? 'أنتقل إلى صفحة الألعاب داخل وكتي.' : 'Navigate to the Games page inside Wakti.',
          risk: 'safe',
          status: 'pending',
          href: buildGameOperatorHref(payloadId, game),
          payloadId,
        },
        {
          id: handoffStepId,
          kind: 'prepare_game_request',
          label: requestLabel,
          description: requestLabel,
          risk: 'safe',
          status: 'pending',
          payloadId,
        },
      ],
    };
  }

  const wantsVitalityCapability = matchedCapability?.id === 'vitality';
  const wantsVitalityByText = /\b(vitality|fitness|health|whoop|healthkit|apple health|wellness|الحيوية|الصحة|اللياقة|ووب|هيلث كت|هلث كت|صحة آبل|صحة ابل)\b/i.test(normalized);
  if ((wantsVitalityCapability || wantsVitalityByText) && !hasDirectExecution && (intentAnalysis.kind === 'navigation' || intentAnalysis.kind === 'execution' || intentAnalysis.kind === 'mixed')) {
    const planId = createId('plan');
    const openStepId = createId('step');
    const handoffStepId = createId('step');
    const vitality = buildVitalityOperatorRequest(normalized);
    const vitalityPayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير قسم الحيوية المطلوب' : 'Preparing the requested Vitality source',
      stepRefs: {
        openStepId,
        handoffStepId,
      },
      vitality,
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(vitalityPayload);
    const requestLabel = getVitalityRequestLabel(vitality, language);

    return {
      id: planId,
      transcript: normalized,
      mode: 'execution',
      summary: language === 'ar'
        ? 'سأفتح مصدر الحيوية الصحيح.'
        : 'I will open the right Vitality source.',
      steps: [
        {
          id: openStepId,
          kind: 'open_vitality',
          label: language === 'ar' ? 'افتح الحيوية' : 'Open Vitality',
          description: language === 'ar' ? 'أنتقل إلى صفحة الحيوية داخل وكتي.' : 'Navigate to the Vitality page inside Wakti.',
          risk: 'safe',
          status: 'pending',
          href: buildVitalityOperatorHref(payloadId, vitality),
          payloadId,
        },
        {
          id: handoffStepId,
          kind: 'prepare_vitality_request',
          label: requestLabel,
          description: requestLabel,
          risk: 'safe',
          status: 'pending',
          payloadId,
        },
      ],
    };
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

  if (matchedCapability && matchedCapability.supportLevel !== 'full_operator' && !hasDirectExecution && (intentAnalysis.kind === 'execution' || intentAnalysis.kind === 'mixed')) {
    return buildCapabilityGuidancePlan(normalized, language, matchedCapability, true);
  }

  const planId = createId('plan');
  const steps: WaktiOperatorStep[] = [];

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

  if (steps.length === 0 && !wantsEmail && !wantsImage && !wantsMusic && !wantsTasks && !wantsTextTools && wantsCalendar) {
    const openStepId = createId('step');
    const actionStepId = createId('step');
    const calendar = buildCalendarOperatorRequest(normalized);
    const calendarPayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير إجراء التقويم' : 'Preparing the Calendar action',
      stepRefs: {
        openStepId,
        handoffStepId: actionStepId,
      },
      calendar,
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(calendarPayload);
    const actionLabel = calendar.action === 'change_view'
      ? (language === 'ar' ? 'غيّر طريقة العرض' : 'Change the view')
      : calendar.action === 'create_note'
        ? (language === 'ar' ? 'أنشئ ملاحظة تقويم' : 'Create calendar note')
        : calendar.action === 'edit_note'
          ? (language === 'ar' ? 'عدّل ملاحظة التقويم' : 'Edit calendar note')
          : (language === 'ar' ? 'افتح التاريخ المطلوب' : 'Open the requested date');
    const actionDescription = calendar.title || calendar.targetTitle || calendar.date || calendar.view || normalized;
    steps.push({
      id: openStepId,
      kind: 'open_calendar',
      label: language === 'ar' ? 'افتح التقويم' : 'Open Calendar',
      description: language === 'ar' ? 'أنتقل إلى صفحة التقويم داخل وكتي.' : 'Navigate to the Calendar page inside Wakti.',
      risk: 'safe',
      status: 'pending',
      href: `/calendar?waktiOperator=${payloadId}`,
      payloadId,
    });
    steps.push({
      id: actionStepId,
      kind: calendar.action === 'change_view' ? 'change_calendar_view' : 'prepare_calendar_entry',
      label: actionLabel,
      description: actionDescription,
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

  if (steps.length === 0 && !wantsEmail && !wantsImage && !wantsMusic) {
    const targetContactName = extractChatTargetName(normalized);
    const draftMessage = extractChatDraftMessage(normalized);
    const looksLikeDirectMessage = wantsContactsChat || Boolean(targetContactName) || (/\b(send|text|message|reply|write)\b/i.test(normalized) && /\b(to|for)\b/i.test(normalized));
    if (looksLikeDirectMessage) {
      const openStepId = createId('step');
      const handoffStepId = createId('step');
      const chatPayload: WaktiOperatorRoutePayload = {
        runId: planId,
        stepId: openStepId,
        transcript: normalized,
        summary: language === 'ar' ? 'تحضير الدردشة المباشرة' : 'Preparing the direct chat',
        stepRefs: {
          openStepId,
          handoffStepId,
        },
        chat: {
          targetContactName,
          draftMessage,
        },
        source: 'voice',
      };
      const payloadId = stashWaktiOperatorPayload(chatPayload);
      steps.push({
        id: openStepId,
        kind: 'open_contacts_chat',
        label: language === 'ar' ? 'افتح المحادثة الصحيحة' : 'Open the right chat',
        description: targetContactName
          ? (language === 'ar' ? `أبحث عن ${targetContactName} داخل جهات الاتصال المعتمدة.` : `Find ${targetContactName} inside approved contacts.`)
          : (language === 'ar' ? 'أفتح قسم جهات الاتصال والمحادثة داخل وكتي.' : 'Open the Contacts & Chat area inside Wakti.'),
        risk: 'safe',
        status: 'pending',
        href: `/contacts?waktiOperator=${payloadId}&tab=contacts`,
        payloadId,
      });
      steps.push({
        id: handoffStepId,
        kind: 'prepare_chat_message',
        label: draftMessage
          ? (language === 'ar' ? 'راجع وأرسل الرسالة' : 'Review and send the message')
          : (language === 'ar' ? 'تابع من داخل الدردشة' : 'Continue inside chat'),
        description: draftMessage || (targetContactName || normalized),
        risk: draftMessage ? 'approval_required' : 'safe',
        status: 'pending',
        payloadId,
      });
    }
  }

  if (wantsTasks && steps.length === 0) {
    const taskAction = buildTaskOperatorRequest(normalized);
    if (taskAction.action === 'create') {
      const trPrefill: TRPrefill = taskAction.kind === 'reminder'
        ? {
            version: 1,
            kind: 'reminder',
            openTab: 'reminders',
            openModal: 'create',
            draft: taskAction.reminderDraft || buildReminderPrefill(normalized),
          }
        : {
            version: 1,
            kind: 'task',
            openTab: 'tasks',
            openModal: 'create',
            draft: taskAction.taskDraft || buildTaskPrefill(normalized),
          };
      saveTRPrefill(trPrefill);
      const openStepId = createId('step');
      const createStepId = createId('step');
      const taskPayload: WaktiOperatorRoutePayload = {
        runId: planId,
        stepId: openStepId,
        transcript: normalized,
        summary: taskAction.kind === 'reminder'
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
        kind: taskAction.kind === 'reminder' ? 'create_reminder' : 'create_task',
        label: taskAction.kind === 'reminder'
          ? (language === 'ar' ? 'افتح التذكيرات' : 'Open reminders')
          : (language === 'ar' ? 'افتح المهام' : 'Open tasks'),
        description: language === 'ar' ? 'أنتقل إلى صفحة المهام والتذكيرات داخل وكتي.' : 'Navigate to Tasks & Reminders inside Wakti.',
        risk: 'safe',
        status: 'pending',
        href: `/tr?intent=create&tab=${trPrefill.openTab}&waktiOperator=${payloadId}`,
        payloadId,
      });
      steps.push({
        id: createStepId,
        kind: taskAction.kind === 'reminder' ? 'create_reminder' : 'create_task',
        label: taskAction.kind === 'reminder'
          ? (language === 'ar' ? 'أنشئ التذكير' : 'Create reminder')
          : (language === 'ar' ? 'أنشئ المهمة' : 'Create task'),
        description: trPrefill.draft.title || normalized,
        risk: 'safe',
        status: 'pending',
        payloadId,
      });
    } else {
      const openStepId = createId('step');
      const actionStepId = createId('step');
      const taskPayload: WaktiOperatorRoutePayload = {
        runId: planId,
        stepId: openStepId,
        transcript: normalized,
        summary: language === 'ar' ? 'تحضير إجراء المهام والتذكيرات' : 'Preparing the Tasks & Reminders action',
        stepRefs: {
          openStepId,
          handoffStepId: actionStepId,
        },
        taskAction,
        source: 'voice',
      };
      const payloadId = stashWaktiOperatorPayload(taskPayload);
      const actionLabel = taskAction.action === 'complete'
        ? (language === 'ar' ? 'إكمال العنصر' : 'Complete the item')
        : taskAction.action === 'snooze'
          ? (language === 'ar' ? 'تأجيل التذكير' : 'Snooze reminder')
          : taskAction.action === 'add_subtasks'
            ? (language === 'ar' ? 'أضف المهام الفرعية' : 'Add subtasks')
            : (language === 'ar' ? 'افتح وضع التعديل' : 'Open edit mode');
      steps.push({
        id: openStepId,
        kind: 'open_tasks_reminders',
        label: language === 'ar' ? 'افتح المهام والتذكيرات' : 'Open Tasks & Reminders',
        description: language === 'ar' ? 'أنتقل إلى صفحة المهام والتذكيرات داخل وكتي.' : 'Navigate to Tasks & Reminders inside Wakti.',
        risk: 'safe',
        status: 'pending',
        href: `/tr?tab=${taskAction.kind === 'reminder' ? 'reminders' : 'tasks'}&waktiOperator=${payloadId}`,
        payloadId,
      });
      steps.push({
        id: actionStepId,
        kind: taskAction.action === 'complete' ? 'complete_task' : taskAction.action === 'snooze' ? 'snooze_reminder' : 'prepare_task_update',
        label: actionLabel,
        description: taskAction.targetTitle || taskAction.subtasks?.join(', ') || normalized,
        risk: 'safe',
        status: 'pending',
        payloadId,
      });
    }
  }

  if (steps.length === 0 && !wantsEmail && !wantsImage && !wantsMusic && !wantsTasks && wantsVoice) {
    const openStepId = createId('step');
    const handoffStepId = createId('step');
    const voiceTool = buildVoiceToolRequest(normalized);
    const generateStepId = voiceTool.tab === 'tts' && voiceTool.autoGenerate ? createId('step') : undefined;
    const voicePayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير طلب الصوت داخل استوديو الصوت' : 'Preparing the voice request inside Voice Studio',
      stepRefs: {
        openStepId,
        handoffStepId,
        generateStepId,
      },
      voiceTool,
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(voicePayload);
    const tabLabel = getVoiceToolTabLabel(voiceTool.tab, language);
    const voiceDescription = voiceTool.text || voiceTool.targetLanguage || tabLabel;
    steps.push({
      id: openStepId,
      kind: 'open_voice_studio',
      label: language === 'ar' ? 'افتح استوديو الصوت' : 'Open Voice Studio',
      description: language === 'ar' ? 'أنتقل إلى صفحة استوديو الصوت داخل وكتي.' : 'Navigate to the Voice Studio page inside Wakti.',
      risk: 'safe',
      status: 'pending',
      href: `/tools/voice-studio?tab=${voiceTool.tab}&waktiOperator=${payloadId}`,
      payloadId,
    });
    steps.push({
      id: handoffStepId,
      kind: 'prepare_voice_request',
      label: language === 'ar' ? `جهّز ${tabLabel}` : `Prepare ${tabLabel}`,
      description: voiceDescription,
      risk: 'safe',
      status: 'pending',
      payloadId,
    });
    if (generateStepId) {
      steps.push({
        id: generateStepId,
        kind: 'generate_voice_audio',
        label: language === 'ar' ? 'أنشئ الصوت' : 'Generate voice audio',
        description: voiceTool.text || tabLabel,
        risk: 'safe',
        status: 'pending',
        payloadId,
      });
    }
  }

  if (steps.length === 0 && !wantsEmail && !wantsImage && !wantsMusic && !wantsTasks && !wantsVoice && !wantsTextTools && wantsMaw3d) {
    const createIntent = /\b(create|make|plan|organize|prepare|set up|new)\b/i.test(normalized)
      || /\b(أنشئ|انشئ|سوي|سو|جهز|جهّز|رتب|جديد)\b/.test(normalized);
    if (createIntent) {
      const openStepId = createId('step');
      const handoffStepId = createId('step');
      const maw3d = buildMaw3dOperatorRequest(normalized);
      const maw3dPayload: WaktiOperatorRoutePayload = {
        runId: planId,
        stepId: openStepId,
        transcript: normalized,
        summary: language === 'ar' ? 'تحضير الحدث داخل موعد' : 'Preparing the event inside Maw3d',
        stepRefs: {
          openStepId,
          handoffStepId,
        },
        maw3d,
        source: 'voice',
      };
      const payloadId = stashWaktiOperatorPayload(maw3dPayload);
      steps.push({
        id: openStepId,
        kind: 'open_maw3d',
        label: language === 'ar' ? 'افتح موعد' : 'Open Maw3d',
        description: language === 'ar' ? 'أنتقل إلى صفحة إنشاء الحدث داخل موعد.' : 'Navigate to the Maw3d event creation page.',
        risk: 'safe',
        status: 'pending',
        href: `/maw3d/create?waktiOperator=${payloadId}`,
        payloadId,
      });
      steps.push({
        id: handoffStepId,
        kind: 'prepare_event_request',
        label: language === 'ar' ? 'جهّز مسودة الحدث' : 'Prepare the event draft',
        description: maw3d.title || normalized,
        risk: 'approval_required',
        status: 'pending',
        payloadId,
      });
    }
  }

  if (steps.length === 0 && !wantsEmail && !wantsImage && !wantsMusic && !wantsTasks && !wantsVoice && !wantsMaw3d && wantsProjects) {
    const createIntent = /\b(build|create|make|generate|design|develop|start|launch)\b/i.test(normalized)
      || /\b(أنشئ|انشئ|ابني|ابنِ|سوي|سو|صمم|طوّر|طور|ابدأ)\b/.test(normalized);
    if (createIntent) {
      const openStepId = createId('step');
      const handoffStepId = createId('step');
      const project = buildProjectOperatorRequest(normalized);
      const projectPayload: WaktiOperatorRoutePayload = {
        runId: planId,
        stepId: openStepId,
        transcript: normalized,
        summary: language === 'ar' ? 'تحضير المشروع داخل صفحة المشاريع' : 'Preparing the project inside Projects',
        stepRefs: {
          openStepId,
          handoffStepId,
        },
        project,
        source: 'voice',
      };
      const payloadId = stashWaktiOperatorPayload(projectPayload);
      steps.push({
        id: openStepId,
        kind: 'open_projects',
        label: language === 'ar' ? 'افتح المشاريع' : 'Open Projects',
        description: language === 'ar' ? 'أنتقل إلى صفحة المشاريع داخل وكتي.' : 'Navigate to the Projects page inside Wakti.',
        risk: 'safe',
        status: 'pending',
        href: `/projects?waktiOperator=${payloadId}`,
        payloadId,
      });
      steps.push({
        id: handoffStepId,
        kind: 'prepare_project_request',
        label: language === 'ar' ? 'جهّز مسودة المشروع' : 'Prepare the project draft',
        description: project.prompt || normalized,
        risk: 'approval_required',
        status: 'pending',
        payloadId,
      });
    }
  }

  if (steps.length === 0 && !wantsEmail && !wantsImage && !wantsMusic && !wantsTasks && !wantsVoice && !wantsMaw3d && !wantsProjects && wantsTextTools) {
    const openStepId = createId('step');
    const handoffStepId = createId('step');
    const textTool = buildTextToolRequest(normalized);
    const textPayload: WaktiOperatorRoutePayload = {
      runId: planId,
      stepId: openStepId,
      transcript: normalized,
      summary: language === 'ar' ? 'تحضير طلب النص داخل أدوات النص' : 'Preparing the text request inside Text Tools',
      stepRefs: {
        openStepId,
        handoffStepId,
      },
      textTool,
      source: 'voice',
    };
    const payloadId = stashWaktiOperatorPayload(textPayload);
    const tabLabel = getTextToolTabLabel(textTool.tab, language);
    const draftDescription = textTool.prefill?.originalMessage || textTool.prefill?.topic || tabLabel;
    steps.push({
      id: openStepId,
      kind: 'open_text_tools',
      label: language === 'ar' ? 'افتح أدوات النص' : 'Open Text Tools',
      description: language === 'ar' ? 'أنتقل إلى صفحة أدوات النص داخل وكتي.' : 'Navigate to the Text Tools page inside Wakti.',
      risk: 'safe',
      status: 'pending',
      href: `/tools/text?tab=${textTool.tab}&waktiOperator=${payloadId}`,
      payloadId,
    });
    steps.push({
      id: handoffStepId,
      kind: 'prepare_text_request',
      label: language === 'ar' ? `جهّز ${tabLabel}` : `Prepare ${tabLabel}`,
      description: draftDescription,
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
