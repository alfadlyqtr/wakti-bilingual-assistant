
import { ReactNode, RefObject } from "react";

// Interface for the Tasjeel Record
export interface TasjeelRecord {
  id: string;
  user_id: string;
  title: string | null;
  original_recording_path: string;
  transcription: string | null;
  summary: string | null;
  summary_audio_path: string | null;
  duration: number | null;
  created_at: string;
  updated_at: string;
  saved: boolean; // New field to track if record has been explicitly saved
}

// Translations interface
export interface TasjeelTranslations {
  [key: string]: {
    [key: string]: string;
  };
}

// Export options for PDF
export interface PDFExportOptions {
  title: string;
  content: { text: string; html?: string }; // Updated: Now expects an object with text and optional html
  metadata?: {
    createdAt: string;
    expiresAt: string;
    type: string;
  };
  language?: 'en' | 'ar';
}

// Audio file types
export interface AudioFile {
  blob: Blob;
  url: string;
}

// Audio control actions
export enum AudioControlAction {
  Play = 'play',
  Pause = 'pause',
  Rewind = 'rewind',
  Stop = 'stop'
}
