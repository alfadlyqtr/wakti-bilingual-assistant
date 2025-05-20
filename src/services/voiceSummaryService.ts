import { supabase } from "@/integrations/supabase/client";

/**
 * Create a new voice recording entry
 * @param type Type of recording (note, summary, lecture, meeting)
 * @param title Optional title for the recording (defaults to "Untitled")
 * @returns Promise with recording data
 */
export async function createRecording(type = "note", title?: string) {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { error: "Not authenticated" };
    }

    // Generate a UUID for the recording
    const recordingId = crypto.randomUUID();
    
    // Set file path and URL
    const audioPath = `audio/${recordingId}.webm`;
    
    // Use getPublicUrl method instead of directly accessing storageUrl
    const { data: { publicUrl: audioUrl } } = supabase.storage
      .from('voice-recordings')
      .getPublicUrl(audioPath);
    
    // Set expiration date (10 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 10);

    const { data, error } = await supabase
      .from('voice_summaries')
      .insert({
        id: recordingId,
        user_id: user.user.id,
        title: title || "Untitled Recording",
        type: type,
        expires_at: expiresAt.toISOString(),
        audio_url: audioUrl,
        is_processing_transcript: true
      })
      .select('id')
      .single();

    if (error) {
      console.error("Error creating recording:", error);
      return { error };
    }

    return { recording: data, error: null };
  } catch (error) {
    console.error("Exception in createRecording:", error);
    return { error };
  }
}

/**
 * Upload audio blob to storage
 * @param audioBlob Audio blob to upload
 * @param recordingId Recording ID to link to
 * @returns Promise with path and error
 */
export async function uploadAudio(audioBlob: Blob, recordingId: string) {
  try {
    const filePath = `audio/${recordingId}.webm`;
    
    const { data, error } = await supabase.storage
      .from('voice-recordings')
      .upload(filePath, audioBlob, {
        contentType: 'audio/webm',
        upsert: true
      });

    if (error) {
      console.error("Error uploading audio:", error);
      return { error, path: null };
    }

    return { path: filePath, error: null };
  } catch (error) {
    console.error("Exception in uploadAudio:", error);
    return { error, path: null };
  }
}

/**
 * Create a summary by calling the edge function
 * @param recordingId Recording ID
 * @returns Promise with summary data
 */
export async function createSummary(recordingId: string) {
  try {
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
      const errorData = await generateResponse.json();
      return { error: errorData.error || "Summary generation failed" };
    }

    const data = await generateResponse.json();
    return { data, error: null };
  } catch (error) {
    console.error("Exception in createSummary:", error);
    return { error };
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
