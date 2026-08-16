/**
 * Temporary diagnostics recorder ("black box") for the OAuth session-loss bug.
 * Appends tiny, non-sensitive events to localStorage so we can see exactly
 * what happened on a device across app restarts. No tokens, no user data —
 * only tags, booleans and timestamps. Remove once the bug is solved.
 */

const KEY = 'wakti_debug_log';
const MAX_ENTRIES = 20;

export interface DebugEntry {
  t: number;
  tag: string;
  [k: string]: unknown;
}

export function dlog(tag: string, data: Record<string, unknown> = {}): void {
  try {
    const raw = localStorage.getItem(KEY);
    const entries: DebugEntry[] = raw ? JSON.parse(raw) : [];
    entries.push({
      t: Date.now(),
      tag,
      origin: window.location.origin.replace(/^https?:\/\//, ''),
      ...data,
    });
    while (entries.length > MAX_ENTRIES) entries.shift();
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {}
}

export function getDebugLog(): DebugEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
