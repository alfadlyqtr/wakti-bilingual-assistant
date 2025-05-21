
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
}

// Translations interface
export interface TasjeelTranslations {
  [key: string]: {
    [key: string]: string;
  };
}

// Export options for PDF
export interface PDFExportOptions {
  content: string;
  title: string;
  type: string;
}
