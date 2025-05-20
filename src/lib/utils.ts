
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Get the status of a voice recording
export function getRecordingStatus(recording: any): 'complete' | 'processing' | 'transcribing' | 'pending' {
  // Check for the is_ready flag first
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
  
  // If has transcript but no summary, mark as processing
  if (recording.transcript && !recording.summary) {
    return 'processing';
  }
  
  // If no transcript yet, mark as transcribing
  if (!recording.transcript) {
    return 'transcribing';
  }
  
  // If we have both transcript and summary, mark as complete
  if (recording.transcript && recording.summary) {
    return 'complete';
  }
  
  // Default to pending
  return 'pending';
}

// New helper function to validate dates
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
