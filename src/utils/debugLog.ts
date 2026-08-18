/**
 * Temporary diagnostics recorder ("black box") for the OAuth session-loss bug.
 * Appends tiny, non-sensitive events to localStorage AND mirrors them to the
 * backend so the story can be read from the database. No tokens, no user
 * data — only tags, booleans, origins and timestamps. Remove once solved.
 */

const KEY = 'wakti_debug_log';
const MAX_ENTRIES = 20;
const DEVICE_KEY = 'wakti_debug_device';

// Public project coordinates (same values as the app client) — used via raw
// fetch to avoid a circular import with the supabase client module.
const SUPABASE_URL = 'https://hxauxozopvpzpdygoqwf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';

export interface DebugEntry {
  t: number;
  tag: string;
  [k: string]: unknown;
}

function getDeviceTag(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id.slice(0, 8);
  } catch {
    return 'unknown';
  }
}

export function dlog(tag: string, data: Record<string, unknown> = {}): void {
  const entry: DebugEntry = {
    t: Date.now(),
    tag,
    origin: typeof window !== 'undefined' ? window.location.origin.replace(/^https?:\/\//, '') : 'n/a',
    ...data,
  };

  try {
    const raw = localStorage.getItem(KEY);
    const entries: DebugEntry[] = raw ? JSON.parse(raw) : [];
    entries.push(entry);
    while (entries.length > MAX_ENTRIES) entries.shift();
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {}

  // Mirror to the backend (fire-and-forget) so the story is readable remotely.
  try {
    fetch(`${SUPABASE_URL}/functions/v1/oauth-handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'log',
        tag,
        data: { ...entry, dev: getDeviceTag(), ua: navigator.userAgent },
      }),
    }).catch(() => {});
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
