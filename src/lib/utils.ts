
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Get the status of a voice recording
export function getRecordingStatus(recording: any): 'complete' | 'processing' | 'transcribing' | 'pending' {
  if (!recording) {
    console.log("Recording not found, returning 'pending'");
    return 'pending';
  }
  
  // Check for the is_ready flag first
  if (recording.is_ready === true) {
    console.log("Recording is ready");
    return 'complete';
  }
  
  // Check if any processing is happening
  if (recording.is_processing_transcript === true) {
    console.log("Recording is being transcribed");
    return 'transcribing';
  }
  
  if (recording.is_processing_summary === true || recording.is_processing_tts === true) {
    console.log("Recording is being processed");
    return 'processing';
  }
  
  // Legacy checks for backwards compatibility
  if (recording.summary && recording.transcript) {
    console.log("Recording has summary and transcript");
    return 'complete';
  }
  
  if (recording.transcript) {
    console.log("Recording has transcript only");
    return 'processing';
  }
  
  console.log("Recording is pending");
  return 'pending';
}

// New helper function to validate dates
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
