
// First, import necessary utilities and ensure we're using the path generation functions
import { supabase } from "@/integrations/supabase/client";
import { generateRecordingPath, validateRecordingPath, ensureCorrectMimeType } from "@/utils/audioUtils";

/**
 * Creates a new voice summary recording entry in the database
 */
export const createRecording = async (recordingType: string = "note") => {
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
        type: recordingType,
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
  } catch (error: any) {
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
      // Fix: Handle the uploadError correctly without assuming it has a message property
      const detailedError = typeof uploadError === 'object' && uploadError !== null
        ? (uploadError as any).message || JSON.stringify(uploadError)
        : String(uploadError);
        
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
  } catch (error: any) {
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
    return { transcription: data, error: null, text: data?.text };
  } catch (error: any) {
    console.error("Exception in transcribeAudio:", error);
    return { error: error.message, transcription: null };
  }
};

/**
 * Updates the transcript for a voice summary
 * @param recordingId - UUID of the recording
 * @param transcript - Updated transcript text
 */
export const updateTranscript = async (recordingId: string, transcript: string) => {
  try {
    const { error } = await supabase
      .from('voice_summaries')
      .update({ 
        transcript: transcript,
        transcript_updated_at: new Date().toISOString(),
        is_transcript_edited: true
      })
      .eq('id', recordingId);
      
    if (error) {
      console.error("Error updating transcript:", error);
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (error: any) {
    console.error("Exception in updateTranscript:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Regenerates the summary for a recording after transcript update
 * @param recordingId - UUID of the recording to regenerate summary for
 */
export const regenerateSummary = async (recordingId: string) => {
  try {
    // Mark as processing
    const { error: updateError } = await supabase
      .from('voice_summaries')
      .update({ 
        is_processing_summary: true,
        summary_updated_at: new Date().toISOString()
      })
      .eq('id', recordingId);
      
    if (updateError) {
      console.error("Error setting summary processing state:", updateError);
      return { success: false, error: updateError.message };
    }
    
    // Call the edge function to generate summary
    const { data, error } = await supabase.functions.invoke('generate-summary', {
      body: { recordingId }
    });
    
    if (error) {
      console.error("Error calling generate-summary function:", error);
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (error: any) {
    console.error("Exception in regenerateSummary:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Creates a summary for a voice recording
 * @param recordingId - UUID of the recording to summarize
 */
export const createSummary = async (recordingId: string) => {
  try {
    // Call the edge function to generate summary
    const { data, error } = await supabase.functions.invoke('generate-summary', {
      body: { recordingId }
    });
    
    if (error) {
      console.error("Error generating summary:", error);
      return { data: null, error: error.message };
    }
    
    return { data, error: null };
  } catch (error: any) {
    console.error("Exception in createSummary:", error);
    return { data: null, error: error.message };
  }
};

/**
 * Generates Text-to-Speech for a summary
 * @param recordingId - UUID of the recording
 * @param voiceGender - 'male' or 'female' voice
 * @param language - 'en' or 'ar' language
 */
export const generateTTS = async (
  recordingId: string, 
  voiceGender: "male" | "female" = "male", 
  language: "en" | "ar" = "en"
) => {
  try {
    // Get the summary text first
    const { data } = await supabase
      .from('voice_summaries')
      .select('summary')
      .eq('id', recordingId)
      .single();
      
    if (!data || !data.summary) {
      return { success: false, error: "No summary found", audioUrl: null };
    }
    
    // Call the TTS edge function
    const response = await supabase.functions.invoke('generate-tts', {
      body: { 
        text: data.summary,
        voice: voiceGender === 'male' ? 'echo' : 'alloy',
        language
      }
    });
    
    if (response.error) {
      console.error("Error generating TTS:", response.error);
      return { success: false, error: response.error.message, audioUrl: null };
    }
    
    // Save the audio URL to the database
    const { error: updateError } = await supabase
      .from('voice_summaries')
      .update({ 
        summary_audio_url: response.data.audioUrl,
        summary_audio_updated_at: new Date().toISOString()
      })
      .eq('id', recordingId);
      
    if (updateError) {
      console.error("Error saving audio URL:", updateError);
    }
    
    return { 
      success: true, 
      error: null, 
      audioUrl: response.data.audioUrl 
    };
  } catch (error: any) {
    console.error("Exception in generateTTS:", error);
    return { success: false, error: error.message, audioUrl: null };
  }
};

/**
 * Exports a summary as PDF
 * @param recordingId - UUID of the recording to export
 */
export const exportSummaryAsPDF = async (recordingId: string) => {
  try {
    // Get the recording data
    const { data, error } = await supabase
      .from('voice_summaries')
      .select('*')
      .eq('id', recordingId)
      .single();
      
    if (error || !data) {
      console.error("Error fetching recording for PDF export:", error);
      return { pdfBlob: null, error: error?.message || "Recording not found" };
    }
    
    // Call the edge function to generate PDF
    const response = await supabase.functions.invoke('generate-pdf', {
      body: { 
        recordingId,
        title: data.title,
        transcript: data.transcript,
        summary: data.summary,
        createdAt: data.created_at
      }
    });
    
    if (response.error) {
      console.error("Error generating PDF:", response.error);
      return { pdfBlob: null, error: response.error.message };
    }
    
    // Convert base64 to Blob
    const base64Data = response.data.pdfBase64;
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
    
    return { pdfBlob, error: null };
  } catch (error: any) {
    console.error("Exception in exportSummaryAsPDF:", error);
    return { pdfBlob: null, error: error.message };
  }
};
