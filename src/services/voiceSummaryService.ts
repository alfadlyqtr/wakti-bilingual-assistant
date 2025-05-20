import { supabase } from "@/integrations/supabase/client";
import { generateRecordingPath } from "@/utils/audioUtils";
import { toast } from "sonner";

/**
 * Create a new voice recording entry
 * @param type Type of recording (note, summary, lecture, meeting)
 * @param title Optional title for the recording (defaults to "Untitled")
 * @returns Promise with recording data
 */
export async function createRecording(type = "note", title?: string) {
  try {
    console.log("[VoiceSummary] Creating new recording:", { type, title });
    
    // Check authentication status
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error("[VoiceSummary] Auth error while creating recording:", authError);
      return { error: "Authentication error: " + authError.message };
    }
    
    if (!authData.session || !authData.session.user) {
      console.error("[VoiceSummary] No authenticated user found");
      return { error: "Not authenticated" };
    }
    
    console.log("[VoiceSummary] User authenticated:", { 
      userId: authData.session.user.id,
      authProvider: authData.session.user.app_metadata?.provider || 'unknown'
    });

    // Generate a UUID for the recording
    const recordingId = crypto.randomUUID();
    
    // Set correct file path structure for storage
    const audioPath = generateRecordingPath(authData.session.user.id, recordingId);
    console.log("[VoiceSummary] Generated recording path:", audioPath);
    
    // Create record first, we'll update the URL after successful upload
    const { data, error } = await supabase
      .from('voice_summaries')
      .insert({
        id: recordingId,
        user_id: authData.session.user.id,
        title: title || "Untitled Recording",
        type: type,
        expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        audio_url: "", // Will be updated after upload
        is_processing_transcript: false // Set to false initially, will be set to true after upload
      })
      .select('id')
      .single();

    if (error) {
      console.error("[VoiceSummary] Error creating recording in database:", error);
      return { error };
    }

    console.log("[VoiceSummary] Recording created successfully:", data);
    return { recording: data, error: null, userId: authData.session.user.id };
  } catch (error) {
    console.error("[VoiceSummary] Exception in createRecording:", error);
    return { error };
  }
}

/**
 * Upload audio blob to storage
 * @param audioBlob Audio blob to upload
 * @param recordingId Recording ID to link to
 * @param userId User ID for path construction
 * @returns Promise with path and error
 */
export async function uploadAudio(audioBlob: Blob, recordingId: string, userId: string) {
  try {
    console.log("[VoiceSummary] Starting upload diagnostics");
    
    // Detailed logging of blob information
    console.log("[VoiceSummary] Blob details:", {
      typeofBlob: typeof audioBlob,
      constructor: audioBlob.constructor.name,
      size: audioBlob.size,
      type: audioBlob.type,
      lastModified: new Date().toISOString()
    });
    
    // Check if blob is valid
    if (!audioBlob) {
      console.error("[VoiceSummary] Upload failed: No audio blob provided");
      return { error: "No audio blob provided", path: null, publicUrl: null };
    }
    
    if (audioBlob.size === 0) {
      console.error("[VoiceSummary] Upload failed: Audio blob is empty (0 bytes)");
      return { error: "Audio blob is empty (0 bytes)", path: null, publicUrl: null };
    }
    
    // Check authentication status
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log("[VoiceSummary] Auth status:", { 
      hasSession: !!authData.session, 
      hasUser: !!authData.session?.user,
      authError: authError || 'none',
      userIdMatch: userId === authData.session?.user?.id
    });
    
    if (authError) {
      console.error("[VoiceSummary] Authentication error before upload:", authError);
      return { error: "Authentication error: " + authError.message, path: null, publicUrl: null };
    }
    
    if (!authData.session || !authData.session.user) {
      console.error("[VoiceSummary] No active session found before upload");
      return { error: "Not authenticated", path: null, publicUrl: null };
    }
    
    // Verify user ID matches the authenticated user
    if (userId !== authData.session.user.id) {
      console.error("[VoiceSummary] User ID mismatch:", { 
        providedUserId: userId, 
        authenticatedUserId: authData.session.user.id 
      });
      return { error: "User ID mismatch", path: null, publicUrl: null };
    }
    
    // Use correct file path structure
    const filePath = `${userId}/${recordingId}/recording.webm`;
    console.log(`[VoiceSummary] Upload destination:`, { 
      bucket: 'voice_recordings',
      filePath: filePath,
      fullPath: `voice_recordings/${filePath}`
    });
    
    // Log access token info (without exposing the actual token)
    console.log("[VoiceSummary] Access token info:", {
      exists: !!authData.session.access_token,
      length: authData.session.access_token?.length || 0,
      expiresAt: authData.session.expires_at ? new Date(authData.session.expires_at * 1000).toISOString() : 'unknown'
    });
    
    // First check if bucket exists
    console.log("[VoiceSummary] Checking storage buckets...");
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error("[VoiceSummary] Error listing buckets:", bucketsError);
      return { error: "Storage error: " + bucketsError.message, path: null, publicUrl: null };
    }
    
    console.log("[VoiceSummary] Available buckets:", buckets.map(b => ({ name: b.name, id: b.id, public: b.public })));
    const bucketExists = buckets.some(b => b.name === 'voice_recordings');
    if (!bucketExists) {
      console.error("[VoiceSummary] voice_recordings bucket does not exist");
      return { error: "Storage bucket 'voice_recordings' does not exist", path: null, publicUrl: null };
    }
    
    // Check MIME type before upload to ensure it's not text/plain
    console.log("[VoiceSummary] Pre-upload MIME check:", {
      mimeType: audioBlob.type,
      isTextPlain: audioBlob.type === 'text/plain'
    });
    
    // Create a new blob with explicit MIME type if needed
    let uploadBlob = audioBlob;
    if (!audioBlob.type || audioBlob.type === 'text/plain') {
      console.log("[VoiceSummary] Correcting MIME type to audio/webm");
      uploadBlob = new Blob([audioBlob], { type: 'audio/webm' });
      console.log("[VoiceSummary] New blob created with correct MIME type:", {
        size: uploadBlob.size,
        type: uploadBlob.type
      });
    }
    
    // Upload the file with detailed error handling
    console.log("[VoiceSummary] Starting upload to Supabase Storage...");
    
    try {
      const uploadResult = await supabase.storage
        .from('voice_recordings')
        .upload(filePath, uploadBlob, {
          contentType: 'audio/webm',
          upsert: true,
          duplex: 'half'
        });
      
      const { data: uploadData, error: uploadError } = uploadResult;
      
      // Log detailed response
      console.log("[VoiceSummary] Upload response:", { 
        success: !!uploadData && !uploadError,
        data: uploadData,
        hasError: !!uploadError,
        errorDetails: uploadError ? {
          message: uploadError.message,
          name: uploadError.name,
          code: uploadError.code,
          statusCode: uploadError.status,
          details: typeof uploadError === 'object' ? JSON.stringify(uploadError) : 'none'
        } : 'none'
      });
      
      if (uploadError) {
        console.error("[VoiceSummary] Error uploading audio:", uploadError);
        let detailedError = `Upload failed: ${uploadError.message || 'Unknown error'}`;
        
        if (uploadError.message?.includes('permission denied')) {
          detailedError += " - This appears to be a permissions issue. Check RLS policies.";
        } else if (uploadError.message?.includes('not found')) {
          detailedError += " - Bucket may not exist or path is incorrect.";
        }
        
        return { error: uploadError, path: null, publicUrl: null, detailedError };
      }
      
      console.log("[VoiceSummary] Audio successfully uploaded:", uploadData);
      
      // Get public URL after successful upload
      console.log("[VoiceSummary] Generating public URL...");
      const { data: urlData } = supabase.storage
        .from('voice_recordings')
        .getPublicUrl(filePath);
      
      console.log("[VoiceSummary] Generated public URL:", urlData.publicUrl);
      
      // Update the record with the correct audio URL and set processing flag to true
      console.log("[VoiceSummary] Updating recording with URL in database...");
      const { error: updateError } = await supabase
        .from('voice_summaries')
        .update({
          audio_url: urlData.publicUrl,
          is_processing_transcript: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
      
      if (updateError) {
        console.error("[VoiceSummary] Error updating record with audio URL:", updateError);
        return { error: updateError, path: filePath, publicUrl: urlData.publicUrl, detailedError: "Upload succeeded but failed to update database" };
      }
      
      console.log("[VoiceSummary] Recording updated successfully with URL");
      return { path: filePath, error: null, publicUrl: urlData.publicUrl };
    } catch (uploadException) {
      console.error("[VoiceSummary] Exception during upload operation:", uploadException);
      return { 
        error: uploadException, 
        path: null, 
        publicUrl: null, 
        detailedError: "Upload exception: " + (uploadException instanceof Error ? uploadException.message : String(uploadException))
      };
    }
  } catch (error) {
    console.error("[VoiceSummary] Uncaught exception in uploadAudio:", error);
    return { error, path: null, publicUrl: null, detailedError: "Uncaught exception: " + (error instanceof Error ? error.message : String(error)) };
  }
}

/**
 * Start transcription process for a recording
 * @param recordingId Recording ID
 * @returns Promise with transcription status
 */
export async function transcribeAudio(recordingId: string) {
  try {
    // Call the transcribe-audio edge function
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { error: "No auth session" };
    }

    const response = await fetch(
      "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/transcribe-audio",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          recordingId
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      return { error: errorData.error || "Transcription failed" };
    }

    const data = await response.json();
    return { text: data.text, error: null };
  } catch (error) {
    console.error("Exception in transcribeAudio:", error);
    return { error };
  }
}

/**
 * Create a summary by calling the edge function
 * @param recordingId Recording ID
 * @returns Promise with summary data
 */
export async function createSummary(recordingId: string) {
  try {
    // Mark recording as processing summary
    await supabase
      .from('voice_summaries')
      .update({ 
        is_processing_summary: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordingId);
      
    // Call the generate-summary edge function
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { error: "No auth session" };
    }

    const generateResponse = await fetch(
      "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-summary",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          recordingId
        }),
      }
    );

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      // Update the record to show the error
      await supabase
        .from('voice_summaries')
        .update({ 
          is_processing_summary: false,
          summary_error: errorData.error || "Summary generation failed",
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
        
      return { error: errorData.error || "Summary generation failed" };
    }

    const data = await generateResponse.json();
    
    // Update the record to mark summary as complete
    await supabase
      .from('voice_summaries')
      .update({ 
        is_processing_summary: false,
        summary_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', recordingId);
      
    return { data, error: null };
  } catch (error) {
    console.error("Exception in createSummary:", error);
    
    // Update the record to show the error
    try {
      await supabase
        .from('voice_summaries')
        .update({ 
          is_processing_summary: false,
          summary_error: error.message || "An error occurred during summary generation",
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
    } catch (e) {
      console.error("Error updating record with summary error:", e);
    }
    
    return { error };
  }
}

/**
 * Update transcript for a recording
 * @param recordingId Recording ID
 * @param transcript Updated transcript text
 * @returns Promise with success status
 */
export async function updateTranscript(recordingId: string, transcript: string): Promise<{success: boolean, error?: any}> {
  try {
    const { error } = await supabase
      .from('voice_summaries')
      .update({ 
        transcript: transcript,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordingId);
      
    if (error) {
      console.error("Error updating transcript:", error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error("Exception in updateTranscript:", error);
    return { success: false, error };
  }
}

/**
 * Generate TTS for summary
 * @param recordingId Recording ID
 * @param voiceGender Voice gender (male/female)
 * @param language Language (en/ar)
 * @returns Promise with success status
 */
export async function generateTTS(recordingId: string, voiceGender: "male" | "female" = "male", language: "en" | "ar" = "en"): Promise<{success: boolean, audioUrl?: string, error?: any}> {
  try {
    // Mark recording as processing TTS
    await supabase
      .from('voice_summaries')
      .update({ 
        is_processing_tts: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordingId);
      
    // Get the recording to get the summary text
    const { data: recording, error: fetchError } = await supabase
      .from('voice_summaries')
      .select('summary')
      .eq('id', recordingId)
      .single();
      
    if (fetchError || !recording || !recording.summary) {
      console.error("Error fetching summary:", fetchError);
      
      await supabase
        .from('voice_summaries')
        .update({ 
          is_processing_tts: false,
          tts_error: "No summary found to generate audio",
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
        
      return { success: false, error: fetchError || "No summary found" };
    }
    
    // Call the generate-tts edge function
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { success: false, error: "No auth session" };
    }

    const ttsResponse = await fetch(
      "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-tts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          recordingId,
          text: recording.summary,
          voiceGender,
          language
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorData = await ttsResponse.json();
      
      // Update the record to show the error
      await supabase
        .from('voice_summaries')
        .update({ 
          is_processing_tts: false,
          tts_error: errorData.error || "TTS generation failed",
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
        
      return { success: false, error: errorData.error || "TTS generation failed" };
    }

    const data = await ttsResponse.json();
    
    if (!data.audioUrl) {
      // Update the record to show the error
      await supabase
        .from('voice_summaries')
        .update({ 
          is_processing_tts: false,
          tts_error: "No audio URL returned",
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
        
      return { success: false, error: "No audio URL returned" };
    }
    
    // Update the record with the audio URL and mark TTS as complete
    await supabase
      .from('voice_summaries')
      .update({ 
        is_processing_tts: false,
        summary_audio_url: data.audioUrl,
        summary_voice: voiceGender,
        summary_language: language,
        tts_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', recordingId);
      
    return { success: true, audioUrl: data.audioUrl };
  } catch (error) {
    console.error("Exception in generateTTS:", error);
    
    // Update the record to show the error
    try {
      await supabase
        .from('voice_summaries')
        .update({ 
          is_processing_tts: false,
          tts_error: error.message || "An error occurred during TTS generation",
          updated_at: new Date().toISOString()
        })
        .eq('id', recordingId);
    } catch (e) {
      console.error("Error updating record with TTS error:", e);
    }
    
    return { success: false, error };
  }
}

/**
 * Delete recordings that have been stuck in processing for too long
 * @param recordingIds Array of recording IDs to delete
 * @returns Promise with success status
 */
export async function deleteStuckRecordings(recordingIds: string[]): Promise<{success: boolean, error?: any}> {
  try {
    if (!recordingIds || recordingIds.length === 0) {
      return { success: false, error: "No recording IDs provided" };
    }

    // Delete the recordings from the voice_summaries table
    const { error } = await supabase
      .from('voice_summaries')
      .delete()
      .in('id', recordingIds);

    if (error) {
      console.error("Error deleting stuck recordings:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in deleteStuckRecordings:", error);
    return { success: false, error };
  }
}

/**
 * Mark recordings as ready if they have both transcript and summary but aren't marked ready
 * @param recordingIds Array of recording IDs to mark as ready
 * @returns Promise with success status and count of updated recordings
 */
export async function markRecordingsAsReady(recordingIds: string[]): Promise<{success: boolean, count: number, error?: any}> {
  try {
    if (!recordingIds || recordingIds.length === 0) {
      return { success: false, count: 0, error: "No recording IDs provided" };
    }

    // Update the recordings to mark them as ready
    const { data, error } = await supabase
      .from('voice_summaries')
      .update({
        is_ready: true,
        is_processing_transcript: false,
        is_processing_summary: false,
        is_processing_tts: false,
        ready_at: new Date().toISOString()
      })
      .in('id', recordingIds)
      .select();

    if (error) {
      console.error("Error marking recordings as ready:", error);
      return { success: false, count: 0, error };
    }

    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error("Exception in markRecordingsAsReady:", error);
    return { success: false, count: 0, error };
  }
}

/**
 * Force regeneration of a summary for a recording that already has a transcript
 * @param recordingId ID of the recording to regenerate summary for
 * @returns Promise with success status
 */
export async function regenerateSummary(recordingId: string): Promise<{success: boolean, error?: any}> {
  try {
    if (!recordingId) {
      return { success: false, error: "No recording ID provided" };
    }

    // Get the recording to check if it has a transcript
    const { data: recording, error: fetchError } = await supabase
      .from('voice_summaries')
      .select('transcript')
      .eq('id', recordingId)
      .single();

    if (fetchError || !recording) {
      console.error("Error fetching recording:", fetchError);
      return { success: false, error: fetchError || "Recording not found" };
    }

    if (!recording.transcript) {
      return { success: false, error: "Recording has no transcript" };
    }

    // Update the recording to mark it for summary regeneration
    const { error: updateError } = await supabase
      .from('voice_summaries')
      .update({
        is_processing_summary: true,
        summary_error: null,
        summary: null
      })
      .eq('id', recordingId);

    if (updateError) {
      console.error("Error updating recording for summary regeneration:", updateError);
      return { success: false, error: updateError };
    }

    // Call the generate-summary edge function
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { success: false, error: "No auth session" };
    }

    const generateResponse = await fetch(
      "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-summary",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          recordingId
        }),
      }
    );

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json();
      return { success: false, error: errorData.error || "Summary regeneration failed" };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in regenerateSummary:", error);
    return { success: false, error };
  }
}

/**
 * Retrieve all recordings with status information
 * @param includeStuck Whether to include stuck recordings
 * @returns Promise with recordings data
 */
export async function getAllRecordings(includeStuck: boolean = true): Promise<{
  ready: any[],
  processing: any[],
  stuck: any[],
  recoverable: any[],
  error?: any
}> {
  try {
    // Default return structure
    const result = {
      ready: [],
      processing: [],
      stuck: [],
      recoverable: []
    };

    // Fetch all recordings
    const { data, error } = await supabase
      .from('voice_summaries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching recordings:", error);
      return { ...result, error };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return result;
    }

    // Maximum processing time before considering a recording as stuck (in milliseconds)
    const MAX_PROCESSING_TIME = 10 * 60 * 1000; // 10 minutes
    const now = new Date().getTime();

    // Process the results
    data.forEach(recording => {
      // Check if it has transcript but no summary
      const hasTranscriptNoSummary = recording.transcript && !recording.summary && 
        recording.summary_error === null && !recording.is_processing_summary;
        
      if (hasTranscriptNoSummary) {
        // These are recoverable records - they have transcript but summary failed silently
        result.recoverable.push(recording);
        return;
      }
      
      // Check if it's fully ready
      if (recording.is_ready === true && recording.transcript) {
        result.ready.push(recording);
        return;
      }
      
      // Check if it's in active processing
      if (
        recording.is_processing_transcript === true || 
        recording.is_processing_summary === true || 
        recording.is_processing_tts === true
      ) {
        // Check if the recording is stuck in processing too long
        const createdAt = new Date(recording.created_at).getTime();
        const processingTime = now - createdAt;
        
        if (processingTime > MAX_PROCESSING_TIME && includeStuck) {
          result.stuck.push(recording);
        } else {
          result.processing.push(recording);
        }
        return;
      }
      
      // If it has a summary_error, it's recoverable
      if (recording.summary_error) {
        result.recoverable.push(recording);
        return;
      }
      
      // If no processing flags are set but it's not ready,
      // check when it was created to determine if it's stuck
      const createdAt = new Date(recording.created_at).getTime();
      const processingTime = now - createdAt;
      
      // Check if it's old enough to be considered stuck
      if (processingTime > MAX_PROCESSING_TIME && includeStuck) {
        result.stuck.push(recording);
      } else {
        result.processing.push(recording);
      }
    });

    return result;
  } catch (error) {
    console.error("Exception in getAllRecordings:", error);
    return { ready: [], processing: [], stuck: [], recoverable: [], error };
  }
}

/**
 * Export recording summary as PDF
 * @param recordingId Recording ID
 * @returns Promise with PDF blob
 */
export async function exportSummaryAsPDF(recordingId: string): Promise<{pdfBlob?: Blob, error?: any}> {
  try {
    // Get the recording data
    const { data: recording, error: fetchError } = await supabase
      .from('voice_summaries')
      .select('title, summary, transcript, created_at, type')
      .eq('id', recordingId)
      .single();
      
    if (fetchError || !recording) {
      console.error("Error fetching recording for PDF export:", fetchError);
      return { error: fetchError || "Recording not found" };
    }
    
    // Dynamically import the PDF generation library
    const { jsPDF } = await import('jspdf');
    
    // Create a new PDF document
    const doc = new jsPDF();
    
    // Add WAKTI branding
    doc.setFontSize(22);
    doc.setTextColor(6, 5, 65); // #060541
    doc.text("WAKTI", 105, 20, { align: 'center' });
    
    // Add title
    doc.setFontSize(18);
    doc.text(recording.title, 105, 30, { align: 'center' });
    
    // Add recording type and date
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    const date = new Date(recording.created_at).toLocaleDateString();
    doc.text(`${recording.type} - ${date}`, 105, 38, { align: 'center' });
    
    // Add summary section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("Summary", 20, 50);
    
    doc.setFontSize(12);
    const summaryLines = doc.splitTextToSize(recording.summary || "No summary available", 170);
    doc.text(summaryLines, 20, 60);
    
    // Add transcript section if available
    if (recording.transcript) {
      const summaryHeight = summaryLines.length * 7; // Approximate height of summary text
      
      doc.setFontSize(16);
      doc.text("Transcript", 20, 70 + summaryHeight);
      
      doc.setFontSize(12);
      const transcriptLines = doc.splitTextToSize(recording.transcript, 170);
      doc.text(transcriptLines, 20, 80 + summaryHeight);
    }
    
    // Add footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated by WAKTI - Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }
    
    // Save the PDF as a blob
    const pdfBlob = doc.output('blob');
    
    return { pdfBlob };
  } catch (error) {
    console.error("Exception in exportSummaryAsPDF:", error);
    return { error };
  }
}
