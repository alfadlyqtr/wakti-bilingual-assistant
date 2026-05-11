import { getActiveScopedUserId, getScopedStorageItem, getUserScopedStorageKey, migrateLegacyScopedStorage } from './userScopedStorage';

export interface SavedSmartTextItem {
  id: string;
  text: string;
  savedAt: string;
}

const PERCENT_ENCODED_SEQUENCE_REGEX = /%[0-9A-Fa-f]{2}/g;

function normalizeLineEndings(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function buildEmailLikeText(subject: string, body: string): string {
  const normalizedSubject = normalizeLineEndings(maybeDecodePercentEncodedText(subject)).trim();
  const normalizedBody = normalizeLineEndings(maybeDecodePercentEncodedText(body)).trim();

  if (normalizedSubject && normalizedBody) {
    return `Subject: ${normalizedSubject}\n\n${normalizedBody}`;
  }

  return normalizedBody || normalizedSubject;
}

function parseQueryStyleEmailText(value: string): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;

  const looksLikeEmailQuery = /^mailto:/i.test(trimmed) || /^\??(?:subject|body|message)\s*(?:=|:)/i.test(trimmed);
  if (!looksLikeEmailQuery) return null;

  const normalizedQuery = trimmed
    .replace(/^mailto:\??/i, '')
    .replace(/^\?/, '')
    .replace(/^subject\s*:/i, 'subject=')
    .replace(/^body\s*:/i, 'body=')
    .replace(/^message\s*:/i, 'body=')
    .replace(/&subject\s*:/ig, '&subject=')
    .replace(/&body\s*:/ig, '&body=')
    .replace(/&message\s*:/ig, '&body=');

  try {
    const params = new URLSearchParams(normalizedQuery);
    const subject = params.get('subject') || '';
    const body = params.get('body') || params.get('message') || '';
    if (!subject && !body) return null;
    return buildEmailLikeText(subject, body);
  } catch {
    return null;
  }
}

function parseHeaderStyleEmailText(value: string): string | null {
  const decoded = normalizeLineEndings(maybeDecodePercentEncodedText((value || '').trim())).trim();
  if (!decoded || !/^(?:subject|body|message)\s*[:=]/i.test(decoded)) return null;

  const subjectMatch = decoded.match(/^\s*subject\s*[:=]\s*(.+?)(?=\n\s*\n|\n\s*(?:message|body)\s*[:=]|$)/is);
  const bodyLabelMatch = decoded.match(/(?:^|\n)\s*(?:message|body)\s*[:=]\s*([\s\S]+)$/i);
  const bodyAfterSubjectMatch = decoded.match(/^\s*subject\s*[:=]\s*.+?\n\s*\n([\s\S]+)$/is);
  const firstLineBodyMatch = decoded.match(/^\s*subject\s*[:=]\s*.+?\n([\s\S]+)$/is);

  const subject = (subjectMatch?.[1] || '').trim();
  const body = (bodyLabelMatch?.[1] || bodyAfterSubjectMatch?.[1] || firstLineBodyMatch?.[1] || '').trim();

  if (!subject && !body) return null;
  return buildEmailLikeText(subject, body);
}

function maybeDecodePercentEncodedText(value: string): string {
  let current = value;

  for (let i = 0; i < 2; i += 1) {
    const currentMatches = current.match(PERCENT_ENCODED_SEQUENCE_REGEX) || [];
    if (currentMatches.length === 0) return current;
    try {
      const decoded = decodeURIComponent(current.replace(/\+/g, '%20'));
      const decodedMatches = decoded.match(PERCENT_ENCODED_SEQUENCE_REGEX) || [];
      const looksMoreReadable =
        decodedMatches.length < (current.match(PERCENT_ENCODED_SEQUENCE_REGEX) || []).length ||
        decoded.includes('\n') ||
        /\s/.test(decoded);

      if (!looksMoreReadable || decoded === current) return current;
      current = decoded;
    } catch {
      return current;
    }
  }

  return current;
}

export function normalizeSmartText(value: string): string {
  let next = (value || '').trim();
  if (!next) return '';

  next = parseQueryStyleEmailText(next) || parseHeaderStyleEmailText(next) || next;

  next = maybeDecodePercentEncodedText(next);

  next = parseQueryStyleEmailText(next) || parseHeaderStyleEmailText(next) || next;

  return normalizeLineEndings(next).trim();
}

export function extractSmartTextEmailParts(value: string): { hasFillFormat: boolean; subject: string; message: string } {
  const text = normalizeSmartText(value);
  const labeledSubjectMatch = text.match(/\bSUBJECT:\s*(.+?)(?=\n\s*MESSAGE:|$)/is);
  const labeledMessageMatch = text.match(/\bMESSAGE:\s*([\s\S]+)/i);

  let subject = (labeledSubjectMatch?.[1] || '').trim();
  let message = (labeledMessageMatch?.[1] || '').trim();

  if (!subject || !message) {
    const subjectLineMatch = text.match(/^\s*Subject:\s*(.+?)(?=\n\s*\n|$)/i);
    const bodyLabelMatch = text.match(/(?:^|\n)\s*(?:Message|Body):\s*([\s\S]+)$/i);
    const bodyAfterSubjectMatch = text.match(/^\s*Subject:\s*.+?\n\s*\n([\s\S]+)$/is);
    const firstLineBodyMatch = text.match(/^\s*Subject:\s*.+?\n([\s\S]+)$/is);

    subject = subject || (subjectLineMatch?.[1] || '').trim();
    message = message || (bodyLabelMatch?.[1] || bodyAfterSubjectMatch?.[1] || firstLineBodyMatch?.[1] || '').trim();
  }

  return {
    hasFillFormat: !!(subject && message),
    subject,
    message,
  };
}

function readSavedSmartTextsRaw(storageKey: string): string | null {
  try {
    migrateLegacyScopedStorage(storageKey, undefined, storageKey);
    return getScopedStorageItem(storageKey, undefined, storageKey);
  } catch {
    return null;
  }
}

export function readSavedSmartTexts(storageKey: string): SavedSmartTextItem[] {
  try {
    const raw = readSavedSmartTextsRaw(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const items = parsed
      .map((item): SavedSmartTextItem | null => {
        if (!item || typeof item !== 'object') return null;

        const text = normalizeSmartText(typeof item.text === 'string' ? item.text : '');
        const id = typeof item.id === 'string' && item.id.trim() ? item.id : `${Date.now()}-${Math.random()}`;
        const savedAt = typeof item.savedAt === 'string' && item.savedAt.trim()
          ? item.savedAt
          : new Date().toISOString();

        if (!text) return null;
        const dedupeKey = text.toLowerCase();
        if (seen.has(dedupeKey)) return null;
        seen.add(dedupeKey);

        return { id, text, savedAt };
      })
      .filter((item): item is SavedSmartTextItem => !!item)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    return items;
  } catch {
    return [];
  }
}

export function writeSavedSmartTexts(storageKey: string, items: SavedSmartTextItem[]): void {
  const serialized = JSON.stringify(items);
  const activeUserId = getActiveScopedUserId();

  if (activeUserId) {
    localStorage.setItem(getUserScopedStorageKey(storageKey, activeUserId), serialized);
    return;
  }

  localStorage.setItem(storageKey, serialized);
}
