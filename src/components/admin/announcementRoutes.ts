// Real WAKTI user-facing app routes that are valid targets for announcements.
// Keep in sync with src/routes/ConsumerRouter.tsx (protected app routes only).
// Parametric routes (e.g. /projects/:id) are represented with a wildcard.

export interface AppRouteOption {
  path: string;
  label: string;
  group: string;
}

export const APP_ROUTES: AppRouteOption[] = [
  // Core
  { path: '/dashboard',       label: 'Dashboard',           group: 'Core' },
  { path: '/wakti-ai-v2',     label: 'Wakti AI',            group: 'Core' },
  { path: '/calendar',        label: 'Calendar',            group: 'Core' },
  { path: '/tasks-reminders', label: 'Tasks & Reminders',   group: 'Core' },
  { path: '/journal',         label: 'Journal',             group: 'Core' },
  { path: '/contacts',        label: 'Contacts',            group: 'Core' },

  // Events & planning
  { path: '/maw3d',           label: 'Events (Maw3d)',      group: 'Events & Planning' },
  { path: '/projects',        label: 'Projects',            group: 'Events & Planning' },
  { path: '/projects/*',      label: 'Project details (any)', group: 'Events & Planning' },
  { path: '/wishlists',       label: 'My Wishlists',        group: 'Events & Planning' },
  { path: '/my-warranty',     label: 'My Warranty',         group: 'Events & Planning' },

  // Studio / Tools
  { path: '/music',           label: 'Music Studio',        group: 'Studio & Tools' },
  { path: '/tasjeel',         label: 'Tasjeel',             group: 'Studio & Tools' },
  { path: '/voice-tts',       label: 'Voice TTS',           group: 'Studio & Tools' },
  { path: '/tools/text',      label: 'Text Generator',      group: 'Studio & Tools' },
  { path: '/tools/voice-studio', label: 'Voice Studio',     group: 'Studio & Tools' },
  { path: '/tools/game',      label: 'Game Mode',           group: 'Studio & Tools' },
  { path: '/games',           label: 'Games',               group: 'Studio & Tools' },

  // Deen
  { path: '/deen',            label: 'Deen · Home',         group: 'Deen' },
  { path: '/deen/quran',      label: 'Deen · Quran',        group: 'Deen' },
  { path: '/deen/hadith',     label: 'Deen · Hadith',       group: 'Deen' },
  { path: '/deen/ask',        label: 'Deen · Ask Imam',     group: 'Deen' },
  { path: '/deen/study',      label: 'Deen · Study',        group: 'Deen' },
  { path: '/deen/azkar',      label: 'Deen · Azkar',        group: 'Deen' },

  // Health
  { path: '/fitness',         label: 'Fitness / Vitality',  group: 'Health' },

  // Account
  { path: '/account',         label: 'Account',             group: 'Account' },
  { path: '/settings',        label: 'Settings',            group: 'Account' },
  { path: '/help',            label: 'Help',                group: 'Account' },
];

export function slugifyTitle(title: string): string {
  const base = (title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\u0600-\u06FF\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 48) || 'announcement';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}_${suffix}`;
}
