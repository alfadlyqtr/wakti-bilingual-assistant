
// Type definitions for Tasjeel component

export interface TasjeelRecord {
  id: string;
  user_id: string;
  title: string | null;
  original_recording_path: string | null;
  transcription: string | null;
  summary: string | null;
  summary_audio_path: string | null;
  duration: number | null;
  created_at: string;
  updated_at: string;
  saved: boolean;
  source_type: 'recording' | 'upload' | 'quick_summary';
}

export interface SummaryAudioUploadResult {
  audioUrl: string; 
}

export interface TranscriptionResult {
  transcript: string;
}

export interface SummarizationResult {
  summary: string;
}
