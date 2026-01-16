// ============================================================================
// APPLICATION CONSTANTS
// Centralized app-wide configuration values
// ============================================================================

/**
 * Application metadata
 */
export const APP_CONFIG = {
  name: 'WAKTI',
  version: '1.0.0',
  defaultLanguage: 'en' as const,
  supportedLanguages: ['en', 'ar'] as const,
  timezone: 'Asia/Qatar',
} as const;

/**
 * Theme configuration
 */
export const THEME_CONFIG = {
  defaultTheme: 'system' as const,
  themes: ['light', 'dark', 'system'] as const,
  colors: {
    dark: {
      background: '#0c0f14',
      foreground: '#606062',
      accent: '#858384',
    },
    light: {
      background: '#fcfefd',
      foreground: '#060541',
      accent: '#e9ceb0',
    },
  },
} as const;

/**
 * Mobile breakpoints
 */
export const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  wide: 1536,
} as const;

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION_DURATION = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 700,
} as const;

/**
 * Z-index layers for consistent stacking
 */
export const Z_INDEX = {
  base: 0,
  dropdown: 50,
  sticky: 100,
  fixed: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
  toast: 600,
  overlay: 700,
  max: 9999,
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  theme: 'wakti-theme',
  language: 'wakti-language',
  authToken: 'wakti-auth-token',
  leftPanelWidth: 'wakti-coder-leftPanelWidth',
  dashboardWidgets: 'wakti-dashboard-widgets',
  recentProjects: 'wakti-recent-projects',
  userPreferences: 'wakti-user-preferences',
  aiConversations: 'wakti-ai-conversations',
  draftMessages: 'wakti-draft-messages',
} as const;

/**
 * Session storage keys
 */
export const SESSION_KEYS = {
  currentProject: 'wakti-current-project',
  unsavedChanges: 'wakti-unsaved-changes',
  scrollPosition: 'wakti-scroll-position',
} as const;

/**
 * Feature flags
 */
export const FEATURES = {
  aiCoder: true,
  visualEditMode: true,
  agentMode: true,
  voiceInput: true,
  imageGeneration: true,
  multiLanguage: true,
  darkMode: true,
  offlineMode: false, // Coming soon
  pushNotifications: false, // Coming soon
} as const;

/**
 * Subscription tiers
 */
export const SUBSCRIPTION = {
  trialDays: 3,
  monthlyPriceQAR: 55,
  yearlyPriceQAR: 550,
  currency: 'QAR',
} as const;
