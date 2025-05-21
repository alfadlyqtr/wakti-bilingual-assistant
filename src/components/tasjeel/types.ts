
export interface SummaryAudioUploadResult {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

export interface TasjeelRecord {
  id: string;
  user_id: string;
  title: string | null;
  original_recording_path: string | null;
  transcription: string | null;
  summary: string | null;
  summary_audio_path: string | null;
  duration: number | null;
  saved: boolean;
  created_at: string;
  source_type: 'recording' | 'upload' | 'quick_summary';
}

export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: boolean;
  errorMessage: string | null;
}

// Add the missing AudioUploadOptions interface
export interface AudioUploadOptions {
  file: File;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: (url: string) => void;
}
