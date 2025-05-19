
import { supabase } from "@/integrations/supabase/client";

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
      if (recording.is_ready === true) {
        result.ready.push(recording);
      } else if (
        recording.is_processing_transcript === true || 
        recording.is_processing_summary === true || 
        recording.is_processing_tts === true
      ) {
        // Check if the recording is stuck
        const createdAt = new Date(recording.created_at).getTime();
        const processingTime = now - createdAt;
        
        if (processingTime > MAX_PROCESSING_TIME && includeStuck) {
          result.stuck.push(recording);
        } else {
          result.processing.push(recording);
        }
      } else {
        // If no processing flags are set but it's not ready,
        // check when it was created to determine if it's stuck
        const createdAt = new Date(recording.created_at).getTime();
        const processingTime = now - createdAt;
        
        // Check if it's recoverable (has transcript but no summary or vice versa)
        if (recording.transcript && !recording.is_ready) {
          result.recoverable.push(recording);
        } else if (processingTime > MAX_PROCESSING_TIME && includeStuck) {
          result.stuck.push(recording);
        } else {
          result.processing.push(recording);
        }
      }
    });

    return result;
  } catch (error) {
    console.error("Exception in getAllRecordings:", error);
    return { ready: [], processing: [], stuck: [], recoverable: [], error };
  }
}
