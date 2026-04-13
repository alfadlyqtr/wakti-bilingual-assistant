type EventMap = {
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
