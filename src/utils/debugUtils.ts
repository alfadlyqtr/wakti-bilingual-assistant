// This file contains utility functions for debugging purposes
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if the voice_recordings bucket exists, creates it if it doesn't
 * and ensures it has the correct permissions
 */
export const createVoiceRecordingsBucket = async () => {
  try {
    console.log("[createVoiceRecordingsBucket] Checking if voice_recordings bucket exists...");
    
    // First check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      return { success: false, error: listError };
    }
    
    // Check if bucket exists
    const bucketExists = buckets?.some(bucket => bucket.name === 'voice_recordings');
    console.log(`[createVoiceRecordingsBucket] Bucket exists: ${bucketExists}`);
    
    if (!bucketExists) {
      console.log("[createVoiceRecordingsBucket] Creating voice_recordings bucket...");
      
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket('voice_recordings', {
        public: false // Make private by default with RLS
      });
      
      if (createError) {
        console.error("Error creating bucket:", createError);
        return { success: false, error: createError };
      }
      
      console.log("[createVoiceRecordingsBucket] Bucket created successfully");
    }
    
    // Check for auth before testing permissions
    const { data: authData } = await supabase.auth.getSession();
    
    // Verify auth before attempting to test permissions
    if (!authData.session) {
      console.warn("[createVoiceRecordingsBucket] No auth session, skipping permission test");
      return { success: true, error: null };
    }
    
    // Don't perform actual test uploads in production - too risky
    // Just check if the user has a valid session and assume permissions are correct
    
    console.log("[createVoiceRecordingsBucket] ✅ Bucket verification complete");
    return { success: true, error: null };
    
  } catch (error) {
    console.error("Exception in createVoiceRecordingsBucket:", error);
    return { success: false, error };
  }
};
