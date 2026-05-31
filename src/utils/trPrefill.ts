export type TRPrefillKind = 'task' | 'reminder';
export type TRPrefillOpenTab = 'tasks' | 'reminders';
export type TRPrefillMissingField = 'title' | 'due_date' | 'due_time';

export interface TRPrefillSubtaskDraft {
  title: string;
  due_date?: string | null;
  due_time?: string | null;
}

export interface TRTaskPrefillDraft {
  title?: string;
  description?: string;
  due_date?: string | null;
  due_time?: string | null;
  priority?: 'normal' | 'high' | 'urgent';
  task_type?: 'one-time' | 'repeated';
  is_shared?: boolean;
  subtasks?: TRPrefillSubtaskDraft[];
}

export interface TRReminderPrefillDraft {
  title?: string;
  description?: string;
  due_date?: string | null;
  due_time?: string | null;
}

export interface TRPrefillSource {
  type: 'email_ai';
  action?: 'summarize_email' | 'summarize_email_with_pdf' | 'extract_tasks' | 'extract_deadlines' | 'brief_recent';
  contextKey?: string;
  emailSubject?: string;
  emailFrom?: string;
  rawItemText?: string;
}

interface TRPrefillBase {
  version: 1;
  openTab?: TRPrefillOpenTab;
  openModal?: 'create';
  source?: TRPrefillSource;
  missing?: TRPrefillMissingField[];
  needsConfirmation?: boolean;
}

export interface TRTaskPrefill extends TRPrefillBase {
  kind: 'task';
  draft: TRTaskPrefillDraft;
}

export interface TRReminderPrefill extends TRPrefillBase {
  kind: 'reminder';
  draft: TRReminderPrefillDraft;
}

export type TRPrefill = TRTaskPrefill | TRReminderPrefill;

const TR_PREFILL_KEY = 'wakti-tr-prefill-v1';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.sessionStorage) {
      const probe = '__wakti_tr_prefill_probe__';
      window.sessionStorage.setItem(probe, '1');
      window.sessionStorage.removeItem(probe);
      return window.sessionStorage;
    }
  } catch {}

  try {
    if (window.localStorage) {
      const probe = '__wakti_tr_prefill_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {}

  return null;
}

export function saveTRPrefill(prefill: TRPrefill) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(TR_PREFILL_KEY, JSON.stringify(prefill));
  } catch {}
}

export function consumeTRPrefill(): TRPrefill | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(TR_PREFILL_KEY);
    if (!raw) return null;
    storage.removeItem(TR_PREFILL_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== 1) return null;
    if (parsed.kind !== 'task' && parsed.kind !== 'reminder') return null;
    if (!parsed.draft || typeof parsed.draft !== 'object') return null;
    return parsed as TRPrefill;
  } catch {
    return null;
  }
}
