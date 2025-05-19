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

  // Legacy checks for backwards compatibility
  if (!recording) return 'pending';
  
  if (recording.summary && recording.transcript) {
    return 'complete';
  }
  
  if (recording.transcript) {
    return 'processing';
  }
  
  if (recording.is_processing_transcript) {
    return 'transcribing';
  }
  
  return 'pending';
}

// New helper function to validate dates
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
