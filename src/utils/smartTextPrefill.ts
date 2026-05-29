export type SmartTextPrefillTab = 'compose' | 'reply' | 'generated' | 'diagrams' | 'presentation' | 'translate' | 'a4';

export interface SmartTextPrefill {
  tab: SmartTextPrefillTab;
  topic?: string;
  originalMessage?: string;
  keyPoints?: string;
  generatedText?: string;
  tone?: string;
  length?: string;
  replyLength?: string;
  contentType?: string;
}

const SMART_TEXT_PREFILL_KEY = 'wakti-smart-text-prefill-v1';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.sessionStorage) {
      const probe = '__wakti_smart_text_prefill_probe__';
      window.sessionStorage.setItem(probe, '1');
      window.sessionStorage.removeItem(probe);
      return window.sessionStorage;
    }
  } catch {}

  try {
    if (window.localStorage) {
      const probe = '__wakti_smart_text_prefill_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {}

  return null;
}

export function saveSmartTextPrefill(prefill: SmartTextPrefill) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SMART_TEXT_PREFILL_KEY, JSON.stringify(prefill));
  } catch {}
}

export function consumeSmartTextPrefill(): SmartTextPrefill | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SMART_TEXT_PREFILL_KEY);
    if (!raw) return null;
    storage.removeItem(SMART_TEXT_PREFILL_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const tab = parsed.tab;
    if (tab !== 'compose' && tab !== 'reply' && tab !== 'generated' && tab !== 'diagrams' && tab !== 'presentation' && tab !== 'translate' && tab !== 'a4') return null;
    return parsed as SmartTextPrefill;
  } catch {
    return null;
  }
}
