
/**
 * Audio utility functions for handling recording formats, file paths, and processing
 */

/**
 * Determines the best supported MIME type for audio recording
 * Prioritizes MP3 format
 */
export const getBestSupportedMimeType = (): string => {
  const preferredTypes = [
    'audio/mp3',
    'audio/mpeg',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav'
  ];
  
  // First try to find MP3/MPEG format support as it's our standardized format
  for (const type of ['audio/mp3', 'audio/mpeg']) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`Using preferred format: ${type}`);
      return type;
    }
  }
  
  // Fall back to other formats if MP3 isn't supported
  for (const type of preferredTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`Browser supports recording in ${type} format`);
      return type;
    }
  }
  
  // Default fallback
  console.log('No preferred MIME types supported, falling back to audio/webm');
  return 'audio/webm';
};

/**
 * Gets the file extension from a MIME type
 */
export const getFileExtension = (mimeType: string): string => {
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
    return 'mp3';
  } else if (mimeType.includes('ogg')) {
    return 'ogg';
  } else if (mimeType.includes('wav')) {
    return 'wav';
  }
  return 'webm'; // Default
};

/**
 * Generates the standardized file path for audio recordings
 */
export const generateRecordingPath = (userId: string, recordingId: string): string => {
  return `voice_recordings/${userId}/${recordingId}/recording.mp3`;
};

/**
 * Formats recording time in MM:SS format
 */
export const formatRecordingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
