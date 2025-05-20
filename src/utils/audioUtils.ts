/**
 * Audio utility functions for handling recording formats, file paths, and processing
 */

/**
 * Determines the best supported MIME type for audio recording
 * Prioritizes webm format for Whisper compatibility
 */
export const getBestSupportedMimeType = (): string => {
  // First check if MediaRecorder exists in this environment
  if (typeof MediaRecorder === 'undefined') {
    console.warn('MediaRecorder not available in this environment, defaulting to audio/webm');
    return 'audio/webm';
  }
  
  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav',
    'audio/mp3',
    'audio/mpeg'
  ];
  
  // Try to find webm format support as it's our standardized format
  for (const type of ['audio/webm;codecs=opus', 'audio/webm']) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`Using preferred format: ${type}`);
      return type;
    }
  }
  
  // Fall back to other formats if webm isn't supported
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
  if (mimeType.includes('webm')) {
    return 'webm';
  } else if (mimeType.includes('ogg')) {
    return 'ogg';
  } else if (mimeType.includes('wav')) {
    return 'wav';
  } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
    return 'mp3';
  }
  return 'webm'; // Default to webm
};

/**
 * Generates the standardized file path for audio recordings
 * CRITICAL: This must follow the pattern ${userId}/${recordingId}/recording.webm
 * This is required for RLS policies to work correctly
 */
export const generateRecordingPath = (userId: string, recordingId: string): string => {
  // IMPORTANT: This path is critical and must not be modified without updating RLS policies
  // The path structure must be exactly: ${userId}/${recordingId}/recording.webm
  // This allows RLS to correctly enforce access based on auth.uid()
  return `${userId}/${recordingId}/recording.webm`;
};

/**
 * Validates if a recording path follows the required structure
 * This helps catch path format issues before uploading
 */
export const validateRecordingPath = (path: string): { valid: boolean; reason?: string } => {
  // Path should match format: userId/recordingId/recording.webm
  const pathParts = path.split('/');
  
  if (pathParts.length !== 3) {
    return { 
      valid: false, 
      reason: `Path has ${pathParts.length} parts but should have exactly 3 parts (userId/recordingId/filename)` 
    };
  }
  
  // First part should be the userId
  if (!pathParts[0] || pathParts[0].length < 10) {
    return { valid: false, reason: 'First path segment should be a valid userId' };
  }
  
  // Second part should be a UUID-like recordingId
  if (!pathParts[1] || pathParts[1].length < 10) {
    return { valid: false, reason: 'Second path segment should be a valid recordingId' };
  }
  
  // Third part should be the filename
  if (!pathParts[2] || !pathParts[2].endsWith('.webm')) {
    return { valid: false, reason: 'Third path segment should be a filename ending with .webm' };
  }
  
  return { valid: true };
};

/**
 * Formats recording time in MM:SS format
 */
export const formatRecordingTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Converts blob to base64
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Combines multiple audio blobs into a single blob
 */
export const combineAudioBlobs = async (blobs: Blob[], mimeType: string): Promise<Blob> => {
  if (blobs.length === 1) return blobs[0];
  
  const audioBuffers = await Promise.all(blobs.map(async blob => {
    const arrayBuffer = await blob.arrayBuffer();
    return arrayBuffer;
  }));
  
  // Calculate total length
  const totalLength = audioBuffers.reduce((acc, buffer) => acc + buffer.byteLength, 0);
  const result = new Uint8Array(totalLength);
  
  // Copy all arrays into the result
  let offset = 0;
  audioBuffers.forEach(buffer => {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  });
  
  return new Blob([result], { type: mimeType });
};

/**
 * Ensures audio blob has correct MIME type
 * This helps fix issues where MIME types get lost or changed
 */
export const ensureCorrectMimeType = (blob: Blob, preferredType: string = 'audio/webm'): Blob => {
  // If the blob already has the correct MIME type, return it
  if (blob.type === preferredType) {
    return blob;
  }
  
  console.log(`Correcting MIME type from ${blob.type || 'empty'} to ${preferredType}`);
  // Create a new blob with the correct MIME type
  return new Blob([blob], { type: preferredType });
};

/**
 * Validates that a blob appears to be a valid audio file
 */
export const validateAudioBlob = (blob: Blob): { valid: boolean; reason?: string } => {
  if (!blob) {
    return { valid: false, reason: "Blob is null or undefined" };
  }
  
  if (blob.size === 0) {
    return { valid: false, reason: "Blob is empty (0 bytes)" };
  }
  
  // Check if the MIME type is at least some kind of audio type
  // Note: We only allow specific audio MIME types that match our bucket configuration
  const validAudioTypes = ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/ogg'];
  const hasValidType = validAudioTypes.includes(blob.type) || 
                        blob.type === '' || // Empty type will be corrected by ensureCorrectMimeType
                        blob.type === 'application/octet-stream'; // Some browsers use this generic type
  
  if (!hasValidType) {
    return { 
      valid: false, 
      reason: `Invalid MIME type: ${blob.type}. Must be one of: ${validAudioTypes.join(', ')}` 
    };
  }
  
  return { valid: true };
};
