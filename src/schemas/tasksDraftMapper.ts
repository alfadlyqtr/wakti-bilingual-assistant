/**
 * tasksDraftMapper.ts
 *
 * Converts a Voice Assistant "draft" object (shaped by the
 * tasks.reminders.shared.v1 schema) into payloads that
 * TRService.createTask / createSubtask / createReminder accept.
 *
 * Also provides validation helpers that return missing-field
 * clarification questions (bilingual).
 */

import { format } from 'date-fns';
import type { VoiceIntent, VoiceClarification } from './tasksRemindersSharedSchema';
export type { VoiceIntent } from './tasksRemindersSharedSchema';
import { TASKS_REMINDERS_SHARED_SCHEMA } from './tasksRemindersSharedSchema';

// ── Draft shapes coming from the Voice Assistant ────────────────────

export interface TaskDraft {
  title: string;
  description?: string;
  due_day?: string;       // yyyy-MM-dd
  due_time?: string;      // HH:mm
  priority?: 'normal' | 'high' | 'urgent';
  task_type?: 'one-time' | 'repeated';
  is_shared?: boolean;
  subtasks?: SubtaskDraft[];
}

export interface SubtaskDraft {
  title: string;
  order_index?: number;
  due_day?: string;
  due_time?: string;
}

export interface ReminderDraft {
  title: string;
  description?: string;
  due_day?: string;       // yyyy-MM-dd
  due_time?: string;      // HH:mm
}

// ── Validation result ───────────────────────────────────────────────

export interface DraftValidation {
  valid: boolean;
  missingFields: VoiceClarification[];
}

// ── Helpers ─────────────────────────────────────────────────────────

const clarifications = TASKS_REMINDERS_SHARED_SCHEMA.voiceContract.clarifications;

function findClarification(fieldPath: string): VoiceClarification | undefined {
  return clarifications.find((c) => c.fieldPath === fieldPath);
}

// ── Validate a task draft ───────────────────────────────────────────

export function validateTaskDraft(draft: TaskDraft): DraftValidation {
  const missing: VoiceClarification[] = [];

  if (!draft.title || !draft.title.trim()) {
    const c = findClarification('task.title');
    if (c) missing.push(c);
  }

  if (!draft.due_day || !draft.due_day.trim()) {
    const c = findClarification('task.due.day');
    if (c) missing.push(c);
  }

  return { valid: missing.length === 0, missingFields: missing };
}

// ── Validate a reminder draft ───────────────────────────────────────

export function validateReminderDraft(draft: ReminderDraft): DraftValidation {
  const missing: VoiceClarification[] = [];

  if (!draft.title || !draft.title.trim()) {
    const c = findClarification('task.title');
    if (c) missing.push({ ...c, fieldPath: 'reminder.title' });
  }

  if (!draft.due_day || !draft.due_day.trim()) {
    const c = findClarification('reminder.due.day');
    if (c) missing.push(c);
  }

  if (!draft.due_time || !draft.due_time.trim()) {
    const c = findClarification('reminder.due.time');
    if (c) missing.push(c);
  }

  return { valid: missing.length === 0, missingFields: missing };
}

// ── Map task draft → TRService.createTask payload ───────────────────

export function mapTaskDraftToPayload(draft: TaskDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description?.trim() || undefined,
    due_date: draft.due_day || format(new Date(), 'yyyy-MM-dd'),
    due_time: draft.due_time || undefined,
    priority: draft.priority || 'normal',
    task_type: draft.task_type || 'one-time',
    is_shared: draft.is_shared ?? false,
  };
}

// ── Map subtask draft → TRService.createSubtask payload ─────────────

export function mapSubtaskDraftToPayload(draft: SubtaskDraft, taskId: string, index: number) {
  return {
    task_id: taskId,
    title: draft.title.trim(),
    completed: false,
    order_index: draft.order_index ?? index,
    due_date: draft.due_day || null,
    due_time: draft.due_time || null,
  };
}

// ── Map reminder draft → TRService.createReminder payload ───────────

export function mapReminderDraftToPayload(draft: ReminderDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description?.trim() || undefined,
    due_date: draft.due_day || format(new Date(), 'yyyy-MM-dd'),
    due_time: draft.due_time || undefined,
  };
}

// ── Detect intent from transcript keywords ──────────────────────────

const INTENT_PATTERNS: { intent: VoiceIntent; en: string[]; ar: string[] }[] = [
  {
    intent: 'create_task',
    en: ['create task', 'new task', 'add task', 'make task', 'create a task', 'add a task'],
    ar: ['أنشئ مهمة', 'مهمة جديدة', 'أضف مهمة', 'اعمل مهمة', 'إنشاء مهمة'],
  },
  {
    intent: 'add_subtask',
    en: ['add subtask', 'new subtask', 'add step', 'add sub task'],
    ar: ['أضف مهمة فرعية', 'مهمة فرعية جديدة', 'أضف خطوة'],
  },
  {
    intent: 'schedule_reminder',
    en: [
      'create reminder',
      'remind me',
      'set reminder',
      'set the reminder',
      'set a reminder',
      'set an reminder',
      'add reminder',
      'new reminder',
      'schedule reminder',
    ],
    ar: [
      'أنشئ تذكير',
      'ذكرني',
      'اضبط تذكير',
      'أضف تذكير',
      'تذكير جديد',
      'حط تذكير',
      'سوّي تذكير',
      'ضع تذكير',
    ],
  },
  {
    intent: 'share_task',
    en: ['share task', 'share this task', 'make shared'],
    ar: ['شارك المهمة', 'شارك هذه المهمة', 'اجعلها مشتركة'],
  },
  {
    intent: 'complete_task',
    en: ['complete task', 'mark done', 'finish task', 'task done', 'mark complete'],
    ar: ['أكمل المهمة', 'علّم مكتملة', 'أنهِ المهمة', 'المهمة تمت'],
  },
  {
    intent: 'complete_subtask',
    en: ['complete subtask', 'subtask done', 'finish step', 'mark step done'],
    ar: ['أكمل المهمة الفرعية', 'الخطوة تمت', 'أنهِ الخطوة'],
  },
];

export function detectTRIntent(transcript: string): VoiceIntent | null {
  const lower = transcript.toLowerCase().trim();
  for (const { intent, en, ar } of INTENT_PATTERNS) {
    for (const phrase of [...en, ...ar]) {
      if (lower.includes(phrase.toLowerCase())) return intent;
    }
  }

  // Heuristic: if the user says "reminder" but not an exact phrase, treat it as a reminder
  // only when there are clear scheduling cues (time / relative time / date words). This avoids
  // stealing generic calendar phrases.
  const hasReminderWord = lower.includes('reminder') || lower.includes('تذكير') || lower.includes('ذكرني');
  if (hasReminderWord) {
    const hasTimeCue = /\b\d{1,2}(?::\d{2})?\s*(am|pm|a\.?m\.?|p\.?m\.?)\b/i.test(lower)
      || /\b\d{1,2}\s*(ص|صباح|صباحاً|صباحا|م|مساء|مساءً|مساءا)\b/i.test(lower)
      || /\b(in\s+\d+\s*(minute|minutes|min|mins))\b/i.test(lower)
      || /\b(after\s+\d+\s*(minute|minutes|min|mins))\b/i.test(lower)
      || /\b(in\s+(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+minutes?)\b/i.test(lower)
      || /\b(بعد\s+\d+\s*دقائق?)\b/.test(lower)
      || /\b(بعد\s+(خمس|عشر|عشرة|١٠|٥)\s*دقائق?)\b/.test(lower)
      || /\b(today|tomorrow|tonight|this\s+evening|this\s+morning)\b/i.test(lower)
      || /\b(اليوم|غدا|غداً|بكرة|بكره|الليلة|مساء|صباح)\b/.test(lower);

    if (hasTimeCue) return 'schedule_reminder';
  }

  return null;
}

// ── Build a combined clarification question string ──────────────────

export function buildClarificationMessage(
  missing: VoiceClarification[],
  language: 'en' | 'ar',
): string {
  if (missing.length === 0) return '';
  return missing
    .map((c) => (language === 'ar' ? c.questionAr : c.questionEn))
    .join(' ');
}
