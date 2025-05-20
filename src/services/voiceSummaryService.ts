// First, import necessary utilities and ensure we're using the path generation functions
import { supabase } from "@/integrations/supabase/client";
import { generateRecordingPath, validateRecordingPath, ensureCorrectMimeType } from "@/utils/audioUtils";

/**
 * Creates a new voice summary recording entry in the database
 */
export const createRecording = async () => {
  try {
    // Verify we have an authenticated session
    const { data: authData } = await supabase.auth.getSession();
    
    if (!authData.session) {
      console.error("No authenticated session found when creating recording");
      return { error: "Authentication required", recording: null, userId: null };
    }
    
    const userId = authData.session.user.id;
    console.log("Creating recording for user:", userId);
    
    // Default title based on date/time
    const defaultTitle = `Recording ${new Date().toLocaleString()}`;
    
    // Insert new recording entry
    const { data, error } = await supabase
      .from('voice_summaries')
      .insert({
        user_id: userId,
        title: defaultTitle,
        type: 'recording',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        is_processing_transcript: true // Mark as processing immediately
      })
      .select('*')
      .single();
    
    if (error) {
      console.error("Error creating recording in database:", error);
      return { error: error.message, recording: null, userId };
    }
    
    return { recording: data, error: null, userId };
  } catch (error) {
    console.error("Exception in createRecording:", error);
    return { error: error.message, recording: null, userId: null };
  }
};

/**
 * Uploads audio recording to Supabase Storage
 * @param blob - The audio blob to upload
 * @param recordingId - UUID of the recording
 * @param userId - User ID who owns the recording
 * @returns Path to the uploaded file and error if any
 */
export const uploadAudio = async (blob: Blob, recordingId: string, userId: string) => {
  try {
    // Safety check for userId - this is critical for the path to work with RLS
    if (!userId) {
      console.error("Missing userId in uploadAudio, cannot proceed");
      return { 
        error: "Missing user ID", 
        path: null, 
        publicUrl: null,
        detailedError: "User ID is required for storing recordings securely" 
      };
    }
    
    // Safety check for recordingId
    if (!recordingId) {
      console.error("Missing recordingId in uploadAudio, cannot proceed");
      return { 
        error: "Missing recording ID", 
        path: null, 
        publicUrl: null,
        detailedError: "Recording ID is required for proper file organization" 
      };
    }
    
    // Ensure blob has correct MIME type
    const fixedBlob = ensureCorrectMimeType(blob, 'audio/webm');
    
    // Generate the correct path using our utility function
    // CRITICAL: Path must be in format: userId/recordingId/recording.webm
    const filePath = generateRecordingPath(userId, recordingId);
    
    // Validate the path before proceeding
    const pathValidation = validateRecordingPath(filePath);
    if (!pathValidation.valid) {
      console.error(`Invalid file path generated: ${filePath}`, pathValidation.reason);
      return { 
        error: "Invalid file path", 
        path: null, 
        publicUrl: null,
        detailedError: pathValidation.reason || "Path structure is incorrect"
      };
    }
    
    console.log(`Uploading audio recording with path: ${filePath}`);
    console.log(`Blob size: ${fixedBlob.size} bytes, type: ${fixedBlob.type}`);
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice_recordings')
      .upload(filePath, fixedBlob, {
        contentType: 'audio/webm',
        upsert: false
      });
      
    if (uploadError) {
      console.error("Error uploading audio to Supabase:", uploadError);
      // Try to get more detailed error info
      const detailedError = typeof uploadError === 'object' 
        ? JSON.stringify(uploadError) 
        : uploadError.message || "Unknown upload error";
        
      return { 
        error: uploadError, 
        path: null, 
        publicUrl: null,
        detailedError
      };
    }
    
    console.log("Audio uploaded successfully:", uploadData);
    
    // Get the public URL (if needed)
    const { data: publicUrlData } = supabase.storage
      .from('voice_recordings')
      .getPublicUrl(filePath);
      
    const publicUrl = publicUrlData?.publicUrl || null;
    
    return { path: uploadData.path, error: null, publicUrl };
  } catch (error) {
    console.error("Exception in uploadAudio:", error);
    return { 
      error: error, 
      path: null, 
      publicUrl: null,
      detailedError: error.message || "Exception occurred during upload"
    };
  }
};

/**
 * Transcribes audio recording using Supabase Edge Function
 * @param recordingId - UUID of the recording
 * @returns Transcription text and error if any
 */
export const transcribeAudio = async (recordingId: string) => {
  try {
    // Call the edge function to transcribe the audio
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: { recordingId }
    });
    
    if (error) {
      console.error("Error transcribing audio:", error);
      return { error: error.message, transcription: null };
    }
    
    console.log("Transcription started successfully:", data);
    return { transcription: data, error: null };
  } catch (error) {
    console.error("Exception in transcribeAudio:", error);
    return { error: error.message, transcription: null };
  }
};
