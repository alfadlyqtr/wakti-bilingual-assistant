
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Get the status of a voice recording
export function getRecordingStatus(recording: any): 'complete' | 'processing' | 'transcribing' | 'pending' {
  // Check for the new is_ready flag first
  if (recording.is_ready === true) {
    return 'complete';
  }
  
  // Check if any processing is happening
  if (recording.is_processing_transcript === true) {
    return 'transcribing';
  }
  
  if (recording.is_processing_summary === true || recording.is_processing_tts === true) {
    return 'processing';
  }
  
  // Legacy checks for backwards compatibility
  if (!recording) return 'pending';
  
  if (recording.summary && recording.transcript) {
    return 'complete';
  }
  
  if (recording.transcript) {
    return 'processing';
  }
  
  return 'pending';
}

// New helper function to validate dates
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
