// Item #8 Medium #2: Typed channel registry for all app-wide events.
// Events above the ─── separator are fully migrated to emitEvent()/onEvent().
// Events below are registered for type discoverability but many call sites
// still use raw window.dispatchEvent — migrate incrementally as you touch them.
type EventMap = {
  // ─── Fully migrated to typed bus ────────────────────────────────────────
  'avatar-updated': { avatarUrl: string | null; userId: string; timestamp: number };
  'widgetSettingsChanged': Record<string, unknown>;
  'dashboardLookChanged': string;
  'homescreenBgChanged': { mode?: string; color1?: string; color2?: string; color3?: string; angle?: number; glow?: boolean } | void;
  'ig-account-changed': unknown | null;
  'wakti-voice-add-entry': unknown;
  'wakti-audio-play': { playerId: string };
  'wakti-bg-music-indicator-on': void;
  'wakti-bg-music-pause': void;
  'wakti-bg-loop-change': 'none' | 'one' | 'all';
  'wakti:clear-insights': void;
  'badge-updated': void;
  'refreshTimeline': void;
  'wakti-trial-limit-reached': { feature: string };

  // ─── Registered for type-safety, still emitted via window.dispatchEvent ─
  // Safe to migrate incrementally — the listeners already accept these shapes.
  'wakti-trial-started': void;
  'wakti-profile-updated': void;
  'wakti-subscription-updated': void;
  'wakti-music-tracks-reload': void;
  'wakti-personal-touch-updated': unknown;
  'wakti-quick-prompt': { prompt?: string };
  'wakti-search-confirm': { query?: string };
  'wakti-ai-stream-finished': void;
  'wakti-auto-submit': void;
  'wakti-chat-input-resized': { height: number };
  'wakti-chat-input-offset': { offset: number };
  'wakti-tts-autoplay-changed': { value: boolean };
  'wakti-close-all-overlays': void;
  'wakti-file-selected': { file?: File };
  'wakti-audio-session-changed': { sessionId?: string };
  'wakti-music-share-status-changed': unknown;
  'wakti-music-tracks-reload-requested': void;
};

type EventName = keyof EventMap;

export function emitEvent<K extends EventName>(
  name: K,
  ...args: EventMap[K] extends void ? [] : [EventMap[K]]
): void {
  const detail = args[0];
  window.dispatchEvent(detail === undefined ? new Event(name) : new CustomEvent(name, { detail }));
}

export function onEvent<K extends EventName>(
  name: K,
  handler: EventMap[K] extends void ? () => void : (detail: EventMap[K]) => void,
): () => void {
  const wrapped = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    (handler as (d?: unknown) => void)(detail);
  };
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}
