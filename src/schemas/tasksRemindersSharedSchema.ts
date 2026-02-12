/**
 * Schema: tasks.reminders.shared.v1
 *
 * Describes the data contract the Voice Assistant uses to produce
 * a "draft" object for creating / updating tasks, subtasks, reminders,
 * and sharing links.  Field paths map 1-to-1 to the real Supabase
 * columns in tr_tasks, tr_subtasks, tr_reminders, tr_shared_access.
 *
 * Priority values match the DB enum: normal | high | urgent.
 * Dates are local-day strings (yyyy-MM-dd); times are HH:mm.
 */

// ── shared field types ──────────────────────────────────────────────
type FieldKind = 'text' | 'textarea' | 'date' | 'time' | 'select' | 'boolean' | 'number';

export interface SchemaField {
  id: string;
  /** dot-path inside the draft object, e.g. "task.title" */
  path: string;
  kind: FieldKind;
  required?: boolean;
  options?: readonly string[];
  defaultValue?: string | number | boolean | null;
  labelEn: string;
  labelAr: string;
  placeholderEn?: string;
  placeholderAr?: string;
  notesEn?: string;
  notesAr?: string;
}

export interface SchemaAction {
  id: string;
  labelEn: string;
  labelAr: string;
  kind: 'openDialog' | 'save' | 'cancel' | 'delete';
}

// ── voice contract types ────────────────────────────────────────────
export type VoiceIntent =
  | 'create_task'
  | 'add_subtask'
  | 'schedule_reminder'
  | 'share_task'
  | 'complete_task'
  | 'complete_subtask'
  | 'snooze_reminder'
  | 'reschedule_task'
  | 'reschedule_reminder';

export interface VoiceClarification {
  fieldPath: string;
  questionEn: string;
  questionAr: string;
}

export interface VoiceContract {
  /** Shape the VA must output (flat key list for validation) */
  outputShape: Record<string, string>;
  intents: VoiceIntent[];
  clarifications: VoiceClarification[];
}

// ── the schema ──────────────────────────────────────────────────────
export const TASKS_REMINDERS_SHARED_SCHEMA = {
  id: 'tasks.reminders.shared.v1',
  version: 1,

  entities: {
    task: {
      table: 'tr_tasks',
      timezoneStrategy: 'store_local_day_and_time',
    },
    subtask: {
      table: 'tr_subtasks',
      parentRef: 'task_id',
    },
    reminder: {
      table: 'tr_reminders',
      timezoneStrategy: 'store_local_day_and_time',
    },
    shared_access: {
      table: 'tr_shared_access',
      parentRef: 'task_id',
    },
  },

  // ── Task fields ───────────────────────────────────────────────────
  taskFields: [
    {
      id: 'title',
      path: 'task.title',
      kind: 'text',
      required: true,
      labelEn: 'Title',
      labelAr: 'العنوان',
      placeholderEn: 'Task title…',
      placeholderAr: 'عنوان المهمة…',
    },
    {
      id: 'description',
      path: 'task.description',
      kind: 'textarea',
      required: false,
      labelEn: 'Description',
      labelAr: 'الوصف',
    },
    {
      id: 'due_date',
      path: 'task.due.day',
      kind: 'date',
      required: true,
      labelEn: 'Due Date',
      labelAr: 'تاريخ الاستحقاق',
      notesEn: "Local day string 'yyyy-MM-dd'.",
      notesAr: "تاريخ محلي بصيغة 'yyyy-MM-dd'.",
    },
    {
      id: 'due_time',
      path: 'task.due.time',
      kind: 'time',
      required: false,
      labelEn: 'Due Time',
      labelAr: 'وقت الاستحقاق',
      notesEn: "HH:mm (24-hour). Optional.",
      notesAr: "HH:mm (24 ساعة). اختياري.",
    },
    {
      id: 'priority',
      path: 'task.priority',
      kind: 'select',
      required: true,
      options: ['normal', 'high', 'urgent'] as const,
      defaultValue: 'normal',
      labelEn: 'Priority',
      labelAr: 'الأولوية',
    },
    {
      id: 'task_type',
      path: 'task.task_type',
      kind: 'select',
      required: true,
      options: ['one-time', 'repeated'] as const,
      defaultValue: 'one-time',
      labelEn: 'Task Type',
      labelAr: 'نوع المهمة',
    },
    {
      id: 'is_shared',
      path: 'task.is_shared',
      kind: 'boolean',
      required: false,
      defaultValue: false,
      labelEn: 'Shared',
      labelAr: 'مشتركة',
    },
  ] as SchemaField[],

  // ── Subtask fields ────────────────────────────────────────────────
  subtaskFields: [
    {
      id: 'title',
      path: 'subtask.title',
      kind: 'text',
      required: true,
      labelEn: 'Subtask Title',
      labelAr: 'عنوان المهمة الفرعية',
    },
    {
      id: 'order_index',
      path: 'subtask.order_index',
      kind: 'number',
      required: false,
      defaultValue: 0,
      labelEn: 'Sort Order',
      labelAr: 'ترتيب الفرز',
    },
    {
      id: 'due_date',
      path: 'subtask.due.day',
      kind: 'date',
      required: false,
      labelEn: 'Subtask Due Date',
      labelAr: 'تاريخ استحقاق المهمة الفرعية',
    },
    {
      id: 'due_time',
      path: 'subtask.due.time',
      kind: 'time',
      required: false,
      labelEn: 'Subtask Due Time',
      labelAr: 'وقت استحقاق المهمة الفرعية',
    },
  ] as SchemaField[],

  // ── Reminder fields ───────────────────────────────────────────────
  reminderFields: [
    {
      id: 'title',
      path: 'reminder.title',
      kind: 'text',
      required: true,
      labelEn: 'Reminder Title',
      labelAr: 'عنوان التذكير',
    },
    {
      id: 'description',
      path: 'reminder.description',
      kind: 'textarea',
      required: false,
      labelEn: 'Description',
      labelAr: 'الوصف',
    },
    {
      id: 'due_date',
      path: 'reminder.due.day',
      kind: 'date',
      required: true,
      labelEn: 'Reminder Date',
      labelAr: 'تاريخ التذكير',
      notesEn: "Local day string 'yyyy-MM-dd'.",
      notesAr: "تاريخ محلي بصيغة 'yyyy-MM-dd'.",
    },
    {
      id: 'due_time',
      path: 'reminder.due.time',
      kind: 'time',
      required: true,
      labelEn: 'Reminder Time',
      labelAr: 'وقت التذكير',
      notesEn: "HH:mm (24-hour). Required for reminders.",
      notesAr: "HH:mm (24 ساعة). مطلوب للتذكيرات.",
    },
  ] as SchemaField[],

  // ── Actions ───────────────────────────────────────────────────────
  actions: [
    { id: 'create_task', labelEn: 'Create Task', labelAr: 'إنشاء مهمة', kind: 'save' },
    { id: 'create_reminder', labelEn: 'Create Reminder', labelAr: 'إنشاء تذكير', kind: 'save' },
    { id: 'cancel', labelEn: 'Cancel', labelAr: 'إلغاء', kind: 'cancel' },
    { id: 'delete', labelEn: 'Delete', labelAr: 'حذف', kind: 'delete' },
  ] as SchemaAction[],

  // ── Voice Assistant contract ──────────────────────────────────────
  voiceContract: {
    outputShape: {
      'task.title': 'string',
      'task.description': 'string?',
      'task.due.day': 'yyyy-MM-dd',
      'task.due.time': 'HH:mm?',
      'task.priority': 'normal|high|urgent',
      'task.task_type': 'one-time|repeated',
      'task.is_shared': 'boolean',
      'subtasks': 'Array<{ title, order_index?, due.day?, due.time? }>',
      'reminder.title': 'string',
      'reminder.description': 'string?',
      'reminder.due.day': 'yyyy-MM-dd',
      'reminder.due.time': 'HH:mm',
    },
    intents: [
      'create_task',
      'add_subtask',
      'schedule_reminder',
      'share_task',
      'complete_task',
      'complete_subtask',
      'snooze_reminder',
      'reschedule_task',
      'reschedule_reminder',
    ] as VoiceIntent[],
    clarifications: [
      {
        fieldPath: 'task.due.day',
        questionEn: 'When is this task due? Please provide a date.',
        questionAr: 'متى موعد هذه المهمة؟ يرجى تحديد التاريخ.',
      },
      {
        fieldPath: 'task.due.time',
        questionEn: 'What time is this task due?',
        questionAr: 'في أي وقت موعد هذه المهمة؟',
      },
      {
        fieldPath: 'reminder.due.day',
        questionEn: 'When should I remind you? Please provide a date.',
        questionAr: 'متى أذكرك؟ يرجى تحديد التاريخ.',
      },
      {
        fieldPath: 'reminder.due.time',
        questionEn: 'What time should I remind you?',
        questionAr: 'في أي وقت أذكرك؟',
      },
      {
        fieldPath: 'task.title',
        questionEn: 'What should I call this task?',
        questionAr: 'ماذا أسمي هذه المهمة؟',
      },
    ] as VoiceClarification[],
  } satisfies VoiceContract,
} as const;

export type TasksRemindersSchema = typeof TASKS_REMINDERS_SHARED_SCHEMA;
