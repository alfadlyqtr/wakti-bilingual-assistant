
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to get color by entry type
export function getEntryTypeColor(type: string): string {
  switch(type) {
    case 'task':
      return 'green-500';
    case 'event':
      return 'blue-500';
    case 'reminder':
      return 'red-500';
    case 'manual_note':
      return 'yellow-500';
    default:
      return 'gray-500';
  }
}

// Safe date formatting helper
export function isValidDate(date: any): boolean {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}

// Check if a recording is fully processed and ready to display
export function isRecordingReady(recording: any): boolean {
  if (!recording) return false;
  
  // Check for essential fields to be present
  return Boolean(
    recording.id && 
    recording.audio_url && 
    recording.transcript &&
    recording.summary
  );
}

// Check if a recording is partially processed (has transcript but no summary yet)
export function isRecordingPartiallyReady(recording: any): boolean {
  if (!recording) return false;
  
  // Has essential fields but missing summary
  return Boolean(
    recording.id && 
    recording.audio_url && 
    recording.transcript &&
    !recording.summary
  );
}

// Get a recording's processing status
export function getRecordingStatus(recording: any): 'complete' | 'processing' | 'transcribing' | 'pending' {
  if (!recording) return 'pending';
  
  if (recording.summary && recording.transcript) {
    return 'complete';
  } else if (recording.transcript) {
    return 'processing'; // Has transcript but no summary
  } else if (recording.audio_url) {
    return 'transcribing'; // Has audio but no transcript
  }
  
  return 'pending';
}
