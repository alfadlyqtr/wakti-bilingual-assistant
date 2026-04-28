export interface SavedSmartTextItem {
  id: string;
  text: string;
  savedAt: string;
}

const PERCENT_ENCODED_SEQUENCE_REGEX = /%[0-9A-Fa-f]{2}/g;

function maybeDecodePercentEncodedText(value: string): string {
  let current = value;

  for (let i = 0; i < 2; i += 1) {
    const currentMatches = current.match(PERCENT_ENCODED_SEQUENCE_REGEX) || [];
    if (currentMatches.length === 0) return current;

    try {
      const decoded = decodeURIComponent(current.replace(/\+/g, '%20'));
      const decodedMatches = decoded.match(PERCENT_ENCODED_SEQUENCE_REGEX) || [];
      const looksMoreReadable =
        decodedMatches.length < currentMatches.length ||
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

  if (/^mailto:/i.test(next)) {
    try {
      const query = next.split('?')[1] || '';
      const params = new URLSearchParams(query);
      const subject = maybeDecodePercentEncodedText(params.get('subject') || '').trim();
      const body = maybeDecodePercentEncodedText(params.get('body') || '').trim();

      if (subject && body) next = `Subject: ${subject}\n\n${body}`;
      else next = body || subject || next;
    } catch {
    }
  }

  next = maybeDecodePercentEncodedText(next);

  return next
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

export function readSavedSmartTexts(storageKey: string): SavedSmartTextItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
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
  localStorage.setItem(storageKey, JSON.stringify(items));
}
