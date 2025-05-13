
/// <reference types="vite/client" />

declare module '@/utils/translations' {
  import { TranslationKey } from '@/utils/translationTypes';
  
  export function t(key: TranslationKey, lang: string): string;
  
  export interface GeneralText {
    // General text interface
  }
  
  export interface TaskText {
    // Task text interface
  }
  
  export interface ReminderText {
    // Reminder text interface
  }
  
  export interface EventText {
    // Event text interface
  }
  
  export interface VoiceSummaryText {
    // Voice summary text interface
  }
  
  export interface SettingsText {
    // Settings text interface
  }
  
  export interface CalendarText {
    // Calendar text interface
  }
  
  export interface ContactText {
    // Contact text interface
  }
  
  export interface MessageText {
    // Message text interface
  }
  
  export interface AIAssistantText {
    // AI Assistant text interface
  }
}
